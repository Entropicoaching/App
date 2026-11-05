import { antalOrd } from '../antalOrd.mjs'
import { calendarDay, addCalendarDays, calendarDaysBetween } from '../../calendarDate.js'
import { parseInputNumber } from '../../inputValues.js'
import { mainLiftName } from '../../exerciseSetView.js'
import { adaptPublicContract } from './publicContract.mjs'
import { analysisIntensity } from './analysisSnapshots.mjs'
import { MAIN_LIFTS, bestWeeklySet } from './weekOverview.mjs'
import { weeklyLoad } from './weeklyLoad.mjs'
import { weeklyIntensity } from './intensitet/intensityModel.mjs'
import { load } from '../tracking/load.mjs'
import { meetPrognose } from './prognose/prognoseModel.mjs'
import { formatBlokslutNumber as number } from './blokslut/blokslutModel.mjs'

export const developmentNumber = number
export const developmentDate = day => day.split('-').reverse().join('.')
const stamp = /^\d{4}-\d{2}-\d{2}(?:$|T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$)/
const dateOnly = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? calendarDay(value) : null
const list = value => Array.isArray(value) ? value.filter(r => r && typeof r === 'object') : []
const position = r => JSON.stringify(r.exercise_id != null && r.set_number != null
  ? ['position', r.exercise_id, r.set_number] : ['time', r.exercise_id, r.logged_at])

// The host's already scoped history is authoritative; explicit foreign rows
// are rejected by analysisIntensity. Local edits/undo own this week's IDs.
// Reject ambiguous retries across BOTH positions and persisted IDs before
// splitting dates; pending/invalid copies cannot resurrect a saved value.
export function developmentSnapshot(props, now) {
  const raw = analysisIntensity(props, { includePending: true })
  if (!raw) return null
  const exercises = new Map(list(props.currentWeek?.sessions).flatMap(s =>
    list(s.exercises).map(e => [e.id, e])))
  const rows = raw.filter(r => r && typeof r === 'object').map(r => {
    const ex = Array.isArray(props.exerciseLogs) && exercises.get(r.exercise_id)
    return ex ? { ...r, exercises: { name: ex.name,
      sessions: { weeks: { block_name: props.currentWeek.block_name } } } } : r
  })
  const groups = new Map(), signatures = new Map(), blocked = new Set()
  for (const r of rows) {
    const key = position(r)
    const signature = JSON.stringify([key, r.logged_at, r.weight, r.reps_completed,
      r.skipped ?? false, !!r.pending, !!r._optimistic, r.reference_e1rm, r.exercises])
    signatures.set(r, signature)
    for (const identity of [key, ...(r.id == null ? [] : [`id:${r.id}`])]) {
      const copies = groups.get(identity) ?? []
      copies.push(r); groups.set(identity, copies)
    }
  }
  for (const copies of groups.values()) if (new Set(copies.map(r => signatures.get(r))).size > 1 ||
    copies.some(r => r.pending || r._optimistic)) copies.forEach(r => blocked.add(r))
  const seen = new Set(), today = calendarDay(now)
  return rows.filter(r => {
    const key = position(r), date = typeof r.logged_at === 'string' && stamp.test(r.logged_at) ? calendarDay(r.logged_at) : null
    if (blocked.has(r) || seen.has(key) || r.exercise_id == null || r.skipped || !date || date > today ||
      (!dateOnly(now) && r.logged_at.includes('T') && Date.parse(r.logged_at) > new Date(now).getTime())) return false
    seen.add(key); return true
  })
}

export function developmentModel(props = {}, now) {
  const empty = (state, message) => ({ state, message, lifts: [], weeks: [], insights: [], forecast: null })
  const today = now instanceof Date || (typeof now === 'string' && stamp.test(now)) ? calendarDay(now) : null
  if (!today) return empty('error', 'Datoen er ugyldig. Din udvikling kan ikke vises.')
  if (props.fremgangError || props.exerciseLogsError) return empty('error', 'Din udvikling kunne ikke hentes. Prøv at åbne analyse igen.')
  if (props.fremgangLoading || props.exerciseLogsLoading) return empty('loading', 'Henter din udvikling…')
  // The host does not forward a read error. Missing history cannot establish
  // the cause, so describe the failed display without inventing a network error.
  if (!Array.isArray(props.fremgangLogs)) return empty('unavailable', 'Din udvikling er ikke klar endnu. Prøv at åbne analyse igen.')
  const rows = developmentSnapshot(props, now)
  const calendarRows = rows.map(r => ({ ...r, day: calendarDay(r.logged_at) }))
  // Preserve original timestamps as set identities. The host history does not
  // carry persisted IDs; normalizing timestamps before deduplication loses sets.
  const weekly = weeklyLoad(rows, now, { weeks: 26 })
  const intensity = weeklyIntensity(rows, now, { weeks: 26 })
  const start = weekly.weeks[0].start
  // Visibility follows confirmed training in the displayed period, including
  // light sets and deload. Strength comparisons keep their stricter evidence
  // gate, so training a lift never fabricates a comparable e1RM observation.
  const trainedLifts = new Set(calendarRows.filter(r => {
    const weight = parseInputNumber(r.weight), reps = parseInputNumber(r.reps_completed)
    return r.day >= start && weight > 0 && Number.isSafeInteger(reps) && reps > 0
  }).map(r => mainLiftName(r.exercises?.name)))
  const contract = adaptPublicContract({ fremgangLogs: rows }, now, { maxAgeDays: 182 })
  const lifts = MAIN_LIFTS.filter(lift => trainedLifts.has(lift)).map(lift => {
    const eligible = contract.rows.filter(r => r.lift === lift && r.logged_at >= start)
    const latestDay = eligible.map(r => r.logged_at).sort().at(-1)
    const latest = latestDay && bestWeeklySet(eligible, lift, latestDay, latestDay)
    // Like blokslut, do not compare the first and last estimates across rep zones.
    const zone = latest?.repZone
    const comparable = eligible.filter(r => r.repZone === zone)
    const points = weekly.weeks.map(w => {
      const best = bestWeeklySet(comparable, lift, w.start, w.end)
      return { start: w.start, end: w.end, value: best?.value ?? null, day: best?.logged_at ?? null }
    })
    const observed = points.filter(p => p.value !== null), first = observed[0], last = observed.at(-1)
    const enough = observed.length >= 4 && calendarDaysBetween(first.day, last.day) >= 21
    const delta = enough ? Number((last.value - first.value).toFixed(1)) || 0 : null
    const message = enough ? delta === 0
      ? `${lift}: dit beregnede maksimum er uændret fra ${developmentDate(first.day)} til ${developmentDate(last.day)}.`
      : `${lift}: dit beregnede maksimum er ${delta > 0 ? 'steget' : 'faldet'} ${number(Math.abs(delta))} kg fra ${developmentDate(first.day)} til ${developmentDate(last.day)}.`
      : `${lift}: for lidt data til at beskrive en udvikling. Log tunge sæt i samme rep-område i mindst 4 uger over mindst 21 dage.`
    return { lift, zone, points, delta, message, observed: observed.length,
      stale: !!last && calendarDaysBetween(last.day, today) > 14,
      evidence: first ? `${observed.length} ${antalOrd(observed.length, 'uge', 'uger')} med data · ${zone} ${antalOrd(zone, 'gentagelse', 'gentagelser')} · ${developmentDate(first.day)}–${developmentDate(last.day)}. Bedste e1RM pr. uge; ændringen beskriver registreringerne, ikke årsagen.` : null }
  })
  const weeks = weekly.weeks.map((w, i) => {
    const matching = calendarRows.filter(r => r.day >= w.start && r.day <= w.end)
    const blocks = [...new Set(matching.map(r => r.exercises?.sessions?.weeks?.block_name)
      .filter(name => typeof name === 'string' && name.trim()).map(name => name.trim()))].sort()
    const zones = intensity.weeks[i]
    const high = zones.zones.filter(z => z.key === '80to90' || z.key === '90plus').reduce((n, z) => n + z.count, 0)
    return { ...w, blocks, classified: zones.classified, unknown: zones.unknown,
      highShare: zones.classified ? high / zones.classified * 100 : null }
  })
  const insights = []
  const strength = lifts.filter(l => l.delta !== null && !l.stale).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0]
  if (strength) insights.push({ text: `Du har ${strength.observed} ${antalOrd(strength.observed, 'uge', 'uger')} med sammenlignelige tunge sæt i ${strength.lift}.`, evidence: strength.evidence })
  // Tracking's native four-week load model, ending on the last complete Sunday.
  const completed = load(rows, addCalendarDays(weeks.at(-1).start, -1)).weeks
  if (completed.every(w => w.sets > 0 && w.tonnage > 0)) {
    const first = completed[0], last = completed.at(-1)
    const percent = (last.tonnage / first.tonnage - 1) * 100
    if (Number.isFinite(percent)) insights.push({ text: `Din registrerede volumen er ${number(Math.abs(percent))} % ${percent >= 0 ? 'højere' : 'lavere'} i den seneste afsluttede uge end tre uger før.`,
      evidence: `${developmentDate(first.start)}: ${number(first.tonnage)} kg × gentagelser; ${developmentDate(last.start)}: ${number(last.tonnage)}. Alle 4 uger har målinger. Det siger ikke, om du bør træne mere eller mindre.` })
  }
  const recorded = weeks.filter(w => w.sets > 0)
  if (recorded.length) insights.push({ text: `Du har registrerede sæt i ${recorded.length} af de 26 viste uger.`,
    evidence: `${developmentDate(start)}–${developmentDate(today)} · kun den indlæste historik. Uger uden logning beviser ikke manglende træning; denne uge er ufuldstændig.` })
  const planned = props.athlete?.competition_date
  const meetDate = dateOnly(planned)
  const projection = meetDate && meetDate >= today ? meetPrognose({ now, meetDate, fremgangLogs: rows }) : null
  // Filter this athlete overview only; shared coach/forecast models retain
  // their existing contract and eligibility rules.
  const forecast = projection ? { ...projection, lifts: projection.lifts.filter(lift => trainedLifts.has(lift.lift)) } : null
  return { state: 'ready', today, start, lifts, weeks, insights: insights.slice(0, 3), forecast,
    meetMessage: !planned || (meetDate && meetDate < today) ? 'Intet kommende stævne er planlagt.'
      : !meetDate ? 'Den planlagte stævnedato er ugyldig. Prognosen kan ikke vises.' : null }
}
