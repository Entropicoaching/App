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
const isoDay = ms => new Date(ms).toISOString().slice(0, 10)
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

export const _internal = { toDay, isoDay, mondayOf, median, DAY }
