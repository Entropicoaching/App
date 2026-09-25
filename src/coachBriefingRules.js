// ORDRE 370 · Coach Briefingens regler som ren JS-funktion.
//
// detectSignalsV1 er en tro port af supabase/sql/training-signals-v1.sql
// (entropi_training_signals_v1: frafald, stagnation, RPE-drift), saa de samme
// syntetiske atlet-uger kan koeres gennem "det briefingen siger i dag" uden
// database. Tallene formateres som Postgres goer (round(...,1) -> "6.0").
//
// Input er de raekker SQL'en laeser, i tabellernes form:
//   { athlete: { id, name, status, vacation_until },
//     logs: exercise_logs + exercises.name ({ logged_at, weight, reps_completed,
//           rpe_planned, rpe_actual, skipped, name, session_id }),
//     weeks: weeks + sessions ({ week_number, start_date, sessions: [{ id, title, athlete_comment }] }),
//     readiness: readiness_logs, personal_records, today: 'YYYY-MM-DD' }

const DAY = 24 * 60 * 60 * 1000
const toDay = value => Date.parse(`${String(value).slice(0, 10)}T00:00:00Z`)
// date_trunc('week', d): mandag.
const mondayOf = ms => ms - ((new Date(ms).getUTCDay() + 6) % 7) * DAY

// percentile_cont(0.5): median med interpolation.
const median = values => {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = (sorted.length - 1) / 2
  return (sorted[Math.floor(mid)] + sorted[Math.ceil(mid)]) / 2
}
const avg = values => values.reduce((sum, value) => sum + value, 0) / values.length

export const epley = (weight, reps) => weight * (1 + reps / 30)

// Samme klassifikation som SQL'ens CASE: kun barbell-hovedloeft.
const NOT_BARBELL = /belt|hack|split|bulgar|goblet|smith|pendul|maskine|machine|leg press|sissy|db |dumbbell|håndvægt/
export function liftOf(exerciseName) {
  const nm = String(exerciseName || '').toLowerCase()
  if (NOT_BARBELL.test(nm)) return null
  if (nm.includes('squat')) return 'Squat'
  if (nm.includes('bænk') || nm.includes('bench')) return 'Bænk'
  if (nm.includes('dødløft') || nm.includes('deadlift') || /(^|\s)dl(\s|$)/.test(nm)) return 'Dødløft'
  return null
}

export function normalizeLogs(logs = []) {
  return logs
    .filter(log => !log.skipped && log.weight != null)
    .map(log => ({
      ...log,
      d: toDay(log.logged_at),
      reps: log.reps_completed ?? log.reps,
      lift: liftOf(log.name),
    }))
}

export function detectSignalsV1({ athlete, logs = [], today }) {
  const T = toDay(today)
  const L = normalizeLogs(logs)
  const name = athlete.name
  const out = []

  // Frafald
  const setsPerWeek = new Map()
  for (const log of L) {
    const week = mondayOf(log.d)
    setsPerWeek.set(week, (setsPerWeek.get(week) || 0) + 1)
  }
  const baselineCutoff = mondayOf(T - 30 * DAY)
  const baseline = [...setsPerWeek].filter(([week, sets]) => sets >= 10 && week < baselineCutoff).map(([, sets]) => sets)
  const norm = baseline.length ? median(baseline) : null
  const activeWeeks = baseline.length || null
  const s30 = L.filter(log => log.d > T - 30 * DAY).length
  const perWeek = s30 / (30 / 7)
  const onVacation = athlete.status === 'ferie' || (athlete.vacation_until && toDay(athlete.vacation_until) >= T)
  const dropoutVerdict = onVacation ? 'insufficient'
    : activeWeeks == null || activeWeeks < 3 || norm < 15 ? 'insufficient'
      : perWeek < 0.4 * norm ? 'alert'
        : perWeek < 0.65 * norm ? 'context' : 'ok'
  const rpw = perWeek.toFixed(1)
  out.push({
    athlete_id: athlete.id, athlete_name: name, detector: 'dropout', severity: dropoutVerdict,
    headline: dropoutVerdict === 'alert' ? `${name}: træningen er faldet markant`
      : dropoutVerdict === 'context' ? `${name}: træningen er dalet lidt`
        : dropoutVerdict === 'insufficient' ? `${name}: for spinkelt grundlag for frafalds-varsel`
          : `${name}: træningsmængde stabil`,
    detail: ['alert', 'context'].includes(dropoutVerdict) ? `${rpw} sæt/uge nu mod ${Math.round(norm)} historisk`
      : dropoutVerdict === 'insufficient' ? 'kræver ≥3 aktive uger med normal mængde'
        : `${rpw} sæt/uge (norm ${Math.round(norm)})`,
    metrics: { recent_per_week: Number(rpw), norm_per_week: norm, active_weeks: activeWeeks, sets_30d: s30 },
  })

  // Stagnation, pr. hovedloeft
  const byLift = new Map()
  for (const log of L) {
    if (!log.lift || log.reps < 1 || log.reps > 12) continue
    const weeks = byLift.get(log.lift) || new Map()
    const week = mondayOf(log.d)
    const entry = weeks.get(week) || { best: 0, vol: 0 }
    entry.best = Math.max(entry.best, epley(log.weight, log.reps))
    entry.vol += 1
    weeks.set(week, entry)
    byLift.set(log.lift, weeks)
  }
  for (const [lift, weeks] of byLift) {
    const ranked = [...weeks].sort((a, b) => b[0] - a[0]).map(([, entry]) => entry)
    const recent = ranked.slice(0, 3)
    const prior = ranked.slice(3, 6)
    const r3 = recent.length ? avg(recent.map(e => e.best)) : null
    const p3 = prior.length ? avg(prior.map(e => e.best)) : null
    const rvol = recent.reduce((sum, e) => sum + e.vol, 0)
    const pvol = prior.reduce((sum, e) => sum + e.vol, 0)
    const pct = r3 != null && p3 ? 100 * r3 / p3 - 100 : null
    const verdict = ranked.length < 6 || r3 == null || p3 == null ? 'insufficient'
      : rvol < 0.7 * pvol ? 'insufficient'
        : pct <= -5 ? 'context' : 'ok'
    const trend = r3 != null && p3 != null ? `${lift} e1RM ${Math.round(p3)}→${Math.round(r3)} kg (${pct.toFixed(1)}%)` : ''
    out.push({
      athlete_id: athlete.id, athlete_name: name, detector: 'stagnation', severity: verdict,
      headline: verdict === 'context' ? `${name}: ${lift} e1RM fladt/faldende`
        : verdict === 'insufficient' ? `${name}: ${lift} — for lidt grundlag` : `${name}: ${lift} i fremgang`,
      detail: verdict === 'context' ? `${trend} over 3 uger, volumen bevaret`
        : verdict === 'insufficient' ? 'kræver ≥6 ugers data og bevaret volumen' : trend,
      metrics: { lift, recent3_e1rm: r3, prior3_e1rm: p3, pct_change: pct, recent_vol: rvol, prior_vol: pvol, weeks: ranked.length, status: athlete.status },
    })
  }

  // RPE-drift (kun uafhaengig actual-log)
  const window = L.filter(log => log.rpe_actual != null && log.rpe_planned != null && log.d > T - 21 * DAY)
  const n21 = window.length
  const ndiff = window.filter(log => log.rpe_actual !== log.rpe_planned).length
  const drift = n21 ? avg(window.map(log => log.rpe_actual - log.rpe_planned)) : null
  const rpeVerdict = n21 < 20 ? 'insufficient'
    : ndiff < Math.max(4, n21 * 0.1) ? 'insufficient'
      : drift >= 0.75 ? 'alert'
        : drift <= -0.75 ? 'context' : 'ok'
  out.push({
    athlete_id: athlete.id, athlete_name: name, detector: 'rpe_drift', severity: rpeVerdict,
    headline: rpeVerdict === 'alert' ? `${name}: træner tungere end planlagt`
      : rpeVerdict === 'context' ? `${name}: træner lettere end planlagt`
        : rpeVerdict === 'insufficient' ? `${name}: ingen uafhængig RPE-log` : `${name}: RPE følger planen`,
    detail: ['alert', 'context'].includes(rpeVerdict) ? `snit-afvigelse ${drift.toFixed(2)} RPE over 3 uger (${n21} sæt)`
      : rpeVerdict === 'insufficient' ? 'atleten logger ikke faktisk RPE adskilt fra plan'
        : `afvigelse ${drift.toFixed(2)} RPE (${n21} sæt)`,
    metrics: { avg_drift: drift == null ? null : Number(drift.toFixed(2)), sets_21d: n21, sets_differing: ndiff },
  })

  return out
}

// Det RPC'en (entropi_coach_briefing_v1) sender videre: kun alert/context.
export const briefingVisible = signals => signals.filter(signal => ['alert', 'context'].includes(signal.severity))

// ---------------------------------------------------------------------------
// v2 (ORDRE 370): det en erfaren coach vil vide, i den raekkefoelge han vil
// vide det. Hvert signal har `headline` = fundet med tal (loeft, vaegt x reps,
// RPE, uge) og `detail` = hvad Marc goer nu. Samme handling ligger i
// metrics.action, saa n8n kan vise den som handlingslinje.
// Spejlet i supabase/migrations/20260925120000_training_signals_v2.sql.
//
// Prioritet (samme tabel inline i n8n/build-coach-briefing.code):
//   0 smerte · 1 fravaer (mistede pas, frafald) · 2 afvigelse fra plan
//   (RPE, stagnation, modstridende data) · 3 beskeder/videoer · 4 fremgang (PR)
// Inden for samme rang: alert foer context.
export const DETECTOR_RANK = { pain: 0, missed_sessions: 1, dropout: 1, rpe_drift: 2, stagnation: 2, data_conflict: 2, pr: 4 }
export const MESSAGE_VIDEO_RANK = 3

const MONTHS = ['jan.', 'feb.', 'mar.', 'apr.', 'maj', 'jun.', 'jul.', 'aug.', 'sep.', 'okt.', 'nov.', 'dec.']
const dec = (value, digits = 1) => value.toFixed(digits).replace('.', ',')
const signed = value => `${value >= 0 ? '+' : '-'}${dec(Math.abs(value))}`
const kg = value => (Number.isInteger(value) ? String(value) : dec(value))
const setText = (weight, reps) => `${kg(weight)}×${reps}`
const rpeText = value => (Number.isInteger(value) ? String(value) : dec(value))
const dayText = ms => `${new Date(ms).getUTCDate()}. ${MONTHS[new Date(ms).getUTCMonth()]}`

const PAIN_WORDS = /smert|ondt|skade|stikker|jager|pain|hurt|injur/i
// "ingen smerter", "gør ikke ondt", "smertefri" er det modsatte af en melding.
const PAIN_NEGATED = /(ingen|uden|ikke noget|ikke)\s+(smert\w*|ondt)|smertefri\w*|no pain/gi
export const mentionsPain = text => PAIN_WORDS.test(String(text || '').replace(PAIN_NEGATED, ''))
const BODY_PARTS = [
  [/knæ|knae|knee/i, 'knæet'], [/hofte|hip/i, 'hoften'], [/lyske/i, 'lysken'],
  [/lænd|ryg|back/i, 'ryggen'], [/skulder|shoulder/i, 'skulderen'], [/albue|elbow/i, 'albuen'],
  [/håndled|haandled|wrist/i, 'håndleddet'], [/ankel|ankle/i, 'anklen'], [/nakke|neck/i, 'nakken'],
]
const bodyPartOf = text => BODY_PARTS.find(([pattern]) => pattern.test(text))?.[1] || null

const mostCommon = values => {
  const counts = new Map()
  values.filter(Boolean).forEach(value => counts.set(value, (counts.get(value) || 0) + 1))
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] || null
}

function signal(athlete, detector, severity, headline, action, metrics = {}) {
  return {
    athlete_id: athlete.id, athlete_name: athlete.name, detector, severity,
    headline: `${athlete.name}: ${headline}`, detail: action, metrics: { ...metrics, action },
  }
}

// Smerte: pas-kommentar med smerteord i denne eller sidste uge (alert), ellers
// hoej oemhed (>=4/5) mindst 3 af de sidste 7 dage (context). Kommentaren
// citeres aldrig; kun kropsdelen naevnes.
function detectPain({ athlete, weeks = [], readiness = [] }, L, T) {
  const since = mondayOf(T) - 7 * DAY
  const hits = weeks
    .filter(week => toDay(week.start_date) >= since)
    .flatMap(week => (week.sessions || [])
      .filter(session => mentionsPain(session.athlete_comment))
      .map(session => ({
        week: week.week_number, title: session.title,
        part: bodyPartOf(session.athlete_comment),
        lift: mostCommon(L.filter(log => log.session_id === session.id).map(log => log.lift)),
      })))
  const sore = readiness.filter(entry => toDay(entry.logged_date) > T - 7 * DAY && toDay(entry.logged_date) <= T && Number(entry.soreness_level) >= 4)
  const zones = [...new Set(sore.flatMap(entry => entry.sore_zones || []))]
  const soreText = sore.length ? `ømhed ≥4/5${zones.length ? ` i ${zones.join('/')}` : ''} ${sore.length} af de sidste 7 dage` : ''
  const metrics = { comment_hits: hits.length, sore_days_7d: sore.length, zones }
  if (hits.length) {
    const hit = hits[hits.length - 1]
    const where = `pas-kommentar, uge ${hit.week}, ${hit.title}${hit.lift ? ` med ${hit.lift.toLowerCase()}` : ''}`
    const liftWord = hit.lift ? `${hit.lift.toLowerCase()}-pas` : 'pas'
    return signal(athlete, 'pain', 'alert',
      `melder ondt i ${hit.part || 'kroppen'} (${where})${soreText ? `; ${soreText}` : ''}`,
      `Kontakt i dag, før næste ${liftWord}. Skift til en smertefri variant og lavere vægt, indtil det er afklaret`,
      { ...metrics, body_part: hit.part, lift: hit.lift, week: hit.week })
  }
  if (sore.length >= 3) {
    return signal(athlete, 'pain', 'context', soreText,
      'Spørg ind: kommer det fra træningen eller hverdagen? Overvej at tage toppen af volumen næste uge', metrics)
  }
  return null
}

// Fremmoede: seneste afsluttede uge. >=2 mistede pas = alert; 1 mistet pas to
// uger i traek = context. Et pas er gennemfoert, naar mindst et saet er logget.
function detectMissedSessions({ athlete, weeks = [] }, L, T, onVacation) {
  if (onVacation) return null
  const finished = weeks
    .filter(week => toDay(week.start_date) + 7 * DAY <= T && (week.sessions || []).length)
    .sort((a, b) => toDay(b.start_date) - toDay(a.start_date))
  if (!finished.length) return null
  const done = new Set(L.map(log => log.session_id))
  const missedIn = week => week.sessions.filter(session => !done.has(session.id))
  const [last, previous] = finished
  const missed = missedIn(last)
  const start = toDay(last.start_date)
  const span = `${new Date(start).getUTCDate()}.-${dayText(start + 6 * DAY)}`
  const metrics = { week: last.week_number, planned: last.sessions.length, missed: missed.length }
  const headline = `mistede ${missed.length} af ${last.sessions.length} pas i uge ${last.week_number} (${span}): ${missed.map(session => session.title).join(', ')}`
  if (missed.length >= 2) {
    return signal(athlete, 'missed_sessions', 'alert', headline,
      `Skriv i dag og spørg hvorfor, før næste uge lægges. Er tiden problemet, så gør ugen til ${Math.max(1, last.sessions.length - 1)} pas`, metrics)
  }
  if (missed.length === 1 && previous && missedIn(previous).length >= 1) {
    return signal(athlete, 'missed_sessions', 'context', `${headline} (og 1 pas ugen før)`,
      'Spørg ind ved næste check-in: passer antallet af pas til ugen?', metrics)
  }
  return null
}

// Frafald: samme regel og taerskler som v1, skarpere tekst.
function detectDropout({ athlete }, L, T, onVacation) {
  const setsPerWeek = new Map()
  for (const log of L) setsPerWeek.set(mondayOf(log.d), (setsPerWeek.get(mondayOf(log.d)) || 0) + 1)
  const baseline = [...setsPerWeek].filter(([week, sets]) => sets >= 10 && week < mondayOf(T - 30 * DAY)).map(([, sets]) => sets)
  if (onVacation || baseline.length < 3) return null
  const norm = median(baseline)
  if (norm < 15) return null
  const perWeek = L.filter(log => log.d > T - 30 * DAY).length / (30 / 7)
  const metrics = { recent_per_week: Number(perWeek.toFixed(1)), norm_per_week: norm }
  if (perWeek < 0.4 * norm) {
    return signal(athlete, 'dropout', 'alert', `træningen er faldet til ${dec(perWeek)} sæt/uge de sidste 30 dage (normalt ${Math.round(norm)})`,
      'Ring eller skriv i dag: hvad er der sket? Læg en kortere uge ind, hvis livet fylder', metrics)
  }
  if (perWeek < 0.65 * norm) {
    return signal(athlete, 'dropout', 'context', `træningen er dalet til ${dec(perWeek)} sæt/uge de sidste 30 dage (normalt ${Math.round(norm)})`,
      'Hold øje, og spørg ind ved næste check-in', metrics)
  }
  return null
}

// Stagnation: antal uger siden loeftets seneste nye top (bedste e1RM > 0,5 %
// over alt foer). >=3 uger = plateau. Stiger topsaettets RPE imens (>=0,5
// siden toppen, eller >=0,5 over plan) er det alert; ellers context. v1's
// fald-regel (<=-5 % med bevaret volumen) er bevaret. Et signal pr. atlet:
// det tydeligste loeft; antallet af andre flade loeft staar i teksten.
function detectStagnation({ athlete, weeks = [] }, L) {
  const weekNumber = new Map(weeks.map(week => [mondayOf(toDay(week.start_date)), week.week_number]))
  const byLift = new Map()
  for (const log of L) {
    if (!log.lift || log.reps < 1 || log.reps > 12) continue
    const perWeek = byLift.get(log.lift) || new Map()
    const week = mondayOf(log.d)
    const entry = perWeek.get(week) || { week, best: 0, top: null, vol: 0 }
    const e1rm = epley(log.weight, log.reps)
    if (e1rm > entry.best || (e1rm === entry.best && (log.rpe_actual ?? 0) > (entry.top?.rpe_actual ?? 0))) {
      entry.best = e1rm
      entry.top = log
    }
    entry.vol += 1
    perWeek.set(week, entry)
    byLift.set(log.lift, perWeek)
  }
  const found = []
  for (const [lift, perWeek] of byLift) {
    const series = [...perWeek.values()].sort((a, b) => a.week - b.week)
    if (series.length < 4) continue
    const recent = series.slice(-3)
    const prior = series.slice(-6, -3)
    const rvol = recent.reduce((sum, e) => sum + e.vol, 0)
    const pvol = prior.reduce((sum, e) => sum + e.vol, 0)
    if (prior.length && rvol < 0.7 * pvol) continue
    let lastHigh = 0
    let runningBest = 0
    series.forEach((entry, index) => {
      if (entry.best > runningBest * 1.005) lastHigh = index
      runningBest = Math.max(runningBest, entry.best)
    })
    const stalled = series.length - 1 - lastHigh
    const high = series[lastHigh]
    const latest = series[series.length - 1]
    const label = weekNumber.has(high.week) ? `uge ${weekNumber.get(high.week)}` : dayText(high.week)
    if (stalled >= 3) {
      const from = high.top.rpe_actual
      const to = latest.top.rpe_actual
      const plan = latest.top.rpe_planned
      const rising = from != null && to != null && (to - from >= 0.5 || (plan != null && to >= plan + 0.5))
      const metrics = { lift, stalled_weeks: stalled, top_weight: high.top.weight, top_reps: high.top.reps, rpe_from: from, rpe_to: to, rpe_planned: plan }
      found.push(rising
        ? { rank: 0, stalled, s: signal(athlete, 'stagnation', 'alert',
          `${lift} stået stille ${stalled} uger (${setText(high.top.weight, high.top.reps)} siden ${label}), RPE ${rpeText(from)}→${rpeText(to)} mod plan ${rpeText(plan)}`,
          `Overvej deload eller en variation (fx pause- eller tempo-${lift.toLowerCase()}) i næste blok`, metrics) }
        : { rank: 1, stalled, s: signal(athlete, 'stagnation', 'context',
          `${lift} fladt ${stalled} uger (${setText(high.top.weight, high.top.reps)} siden ${label}), RPE uændret${to != null ? ` @${rpeText(to)}` : ''}`,
          'Ikke akut: har planen bedt om mere? Ellers +2,5 kg næste uge', metrics) })
      continue
    }
    if (prior.length === 3) {
      const r3 = avg(recent.map(e => e.best))
      const p3 = avg(prior.map(e => e.best))
      const pct = 100 * r3 / p3 - 100
      if (pct <= -5) {
        found.push({ rank: 1, stalled: 3, s: signal(athlete, 'stagnation', 'context',
          `${lift} e1RM faldet ${Math.round(p3)}→${Math.round(r3)} kg (${dec(pct)} %) på 3 uger med samme volumen`,
          `Tjek søvn og restitution, bed om en video af ${lift.toLowerCase()}, og overvej deload`, { lift, pct_change: Number(pct.toFixed(1)) }) })
      }
    }
  }
  if (!found.length) return null
  found.sort((a, b) => a.rank - b.rank || b.stalled - a.stalled)
  const [best, ...others] = found
  if (others.length) {
    best.s.headline += ` (+${others.length} løft mere fladt)`
    best.s.metrics.other_lifts = others.map(entry => entry.s.metrics.lift)
  }
  return best.s
}

// RPE: v1's uafhaengigheds-krav og taerskler, men pr. loeft, og RPE under plan
// holdes op mod check-ins. Siger check-ins det modsatte (oemhed >=4/5 eller
// energi <=2/5 i mindst halvdelen, min. 2), er det et data-tjek, ikke "plads
// til mere".
function detectRpe({ athlete, readiness = [] }, L, T) {
  const window = L.filter(log => log.rpe_actual != null && log.rpe_planned != null && log.d > T - 21 * DAY)
  const n21 = window.length
  const ndiff = window.filter(log => log.rpe_actual !== log.rpe_planned).length
  if (n21 < 20 || ndiff < Math.max(4, n21 * 0.1)) return []
  const drift = avg(window.map(log => log.rpe_actual - log.rpe_planned))
  const perLift = new Map()
  window.forEach(log => {
    const key = log.lift || 'Øvrige'
    perLift.set(key, [...(perLift.get(key) || []), log.rpe_actual - log.rpe_planned])
  })
  const lifts = [...perLift].map(([lift, diffs]) => ({ lift, drift: avg(diffs) }))
    .sort((a, b) => (drift >= 0 ? b.drift - a.drift : a.drift - b.drift))
  const top = lifts.find(entry => entry.lift !== 'Øvrige') || lifts[0]
  const metrics = { avg_drift: Number(drift.toFixed(2)), sets_21d: n21, top_lift: top.lift, top_lift_drift: Number(top.drift.toFixed(2)) }
  const liftWord = top.lift === 'Øvrige' ? 'belastningen' : top.lift.toLowerCase()
  if (drift >= 0.75) {
    return [signal(athlete, 'rpe_drift', 'alert',
      `RPE i snit ${signed(drift)} over plan de sidste 3 uger (${n21} sæt); mest på ${top.lift} ${signed(top.drift)}`,
      drift >= 1.25
        ? `Sænk ${liftWord} ~5 % næste uge, og spørg til søvn, stress og restitution`
        : 'Hold belastningen næste uge i stedet for at øge; spørg til restitution', metrics)]
  }
  if (drift <= -0.75) {
    const checkins = readiness.filter(entry => toDay(entry.logged_date) > T - 21 * DAY && toDay(entry.logged_date) <= T)
    const tired = checkins.filter(entry => Number(entry.soreness_level) >= 4 || (entry.energy != null && Number(entry.energy) <= 2))
    if (checkins.length >= 2 && tired.length >= Math.max(2, Math.ceil(checkins.length / 2))) {
      return [signal(athlete, 'data_conflict', 'context',
        `modstridende data: RPE i snit ${signed(drift)} under plan (3 uger, ${n21} sæt), men ømhed ≥4/5 eller energi ≤2/5 i ${tired.length} af ${checkins.length} check-ins`,
        'Øg ikke belastningen endnu: afklar, om RPE logges rigtigt, eller om træthed bliver skjult',
        { ...metrics, checkins_21d: checkins.length, tired_checkins: tired.length })]
    }
    return [signal(athlete, 'rpe_drift', 'context',
      `RPE i snit ${signed(drift)} under plan de sidste 3 uger (${n21} sæt); mest på ${top.lift} ${signed(top.drift)}`,
      `Plads til mere: øg ${liftWord} 2,5-5 % næste uge`, metrics)]
  }
  return []
}

// PR: appens egen personal_records (skrives naar et saet slaar rekorden) inden
// for de sidste 7 dage, med forrige bedste paa samme oevelse.
function detectPr({ athlete, personal_records: records = [] }, T) {
  const recent = records.filter(record => toDay(record.created_at) > T - 7 * DAY && toDay(record.created_at) <= T)
  if (!recent.length) return null
  const parts = recent.slice(-2).map(record => {
    const previous = records
      .filter(other => other.exercise_name === record.exercise_name && Date.parse(other.created_at) < Date.parse(record.created_at))
      .sort((a, b) => epley(b.weight, b.reps) - epley(a.weight, a.reps))[0]
    return `${record.exercise_name} ${setText(record.weight, record.reps)} (${dayText(toDay(record.created_at))}${previous ? `; før ${setText(previous.weight, previous.reps)}` : ''})`
  })
  return signal(athlete, 'pr', 'context', `PR på ${parts.join(' og ')}`,
    'Anerkend det i en kort besked; planen virker, ingen ændring nødvendig', { prs_7d: recent.length })
}

export function detectSignalsV2(input) {
  const { athlete, logs = [], today } = input
  const T = toDay(today)
  const L = normalizeLogs(logs)
  const onVacation = athlete.status === 'ferie' || Boolean(athlete.vacation_until && toDay(athlete.vacation_until) >= T)
  return [
    detectPain(input, L, T),
    detectMissedSessions(input, L, T, onVacation),
    detectDropout(input, L, T, onVacation),
    ...detectRpe(input, L, T),
    detectStagnation(input, L),
    detectPr(input, T),
  ].filter(Boolean)
}

// Raekkefoelgen i briefingen: rang, alert foer context, saa navn.
export const signalRank = item => (DETECTOR_RANK[item.detector] ?? 2) + (item.severity === 'alert' ? 0 : 0.5)
export const briefingOrder = signals => [...signals].sort((a, b) => signalRank(a) - signalRank(b)
  || String(a.athlete_name).localeCompare(String(b.athlete_name), 'da'))
