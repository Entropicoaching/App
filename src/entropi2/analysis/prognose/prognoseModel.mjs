import { calendarDay, calendarDaysBetween } from '../../../calendarDate.js'
import { estimatedOneRepMax } from '../../../exerciseProgress.js'
import { ugenoegle } from '../../../volume/ugenoegle.js'
import { adaptPublicContract, uniqueLogs } from '../publicContract.mjs'
import { MAIN_LIFTS } from '../weekOverview.mjs'

const datePattern = /^\d{4}-\d{2}-\d{2}(?:$|T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$)/
const dayOnly = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? calendarDay(value) : null

// Pending positions suppress saved retries too. Conflicting retries are unknown,
// irrespective of IDs and input ordering. The public adapter still owns local
// edits/undo and the definition of a heavy set, lift and deload block.
function confirmedSnapshot(rows) {
  if (!Array.isArray(rows)) return rows
  const key = r => JSON.stringify(r?.exercise_id != null && r?.set_number != null
    ? [r.exercise_id, 'position', r.set_number] : [r?.exercise_id, 'time', r?.logged_at])
  const pending = new Set(rows.filter(r => r?._optimistic).map(key))
  const byId = new Map()
  for (const r of rows.filter(r => r?.id != null)) {
    const group = byId.get(r.id) || []
    group.push(r); byId.set(r.id, group)
  }
  for (const group of byId.values()) {
    const signatures = new Set(group.map(r => JSON.stringify([key(r), r.weight,
      r.reps_completed, r.skipped ?? false, r.exercises, r.logged_at])))
    if (signatures.size > 1 || group.some(r => r._optimistic))
      for (const r of group) pending.add(key(r))
  }
  return uniqueLogs(rows.filter(r => r && !pending.has(key(r))).map(r => ({ ...r, id: undefined })))
}

function project(rows, lift, today, meetDate) {
  const weekly = new Map()
  for (const row of rows.filter(r => r.lift === lift)) {
    const value = estimatedOneRepMax(row.weight, row.reps_completed)
    if (!(value > 0) || !Number.isFinite(value)) continue
    const week = ugenoegle(row.logged_at), previous = weekly.get(week)
    if (!previous || value > previous.value || (value === previous.value && row.logged_at < previous.day))
      weekly.set(week, { day: row.logged_at, value })
  }
  const points = [...weekly.values()].sort((a, b) => a.day.localeCompare(b.day))
  const missing = message => ({ lift, status: 'insufficient', message: `For lidt data. ${message}`, weeks: points.length })
  if (points.length < 8) return missing('Der kræves tunge sæt i mindst 8 forskellige uger inden for de seneste 12 uger.')
  const first = points[0], last = points.at(-1)
  const span = calendarDaysBetween(first.day, last.day)
  if (span < 56) return missing('Registreringerne skal spænde over mindst 8 uger.')
  if (calendarDaysBetween(last.day, today) > 14) return missing('Det seneste tunge sæt er mere end 14 dage gammelt.')
  const ahead = calendarDaysBetween(last.day, meetDate)
  if (ahead > 56 || ahead > span) return missing('Stævnet ligger for langt fra det seneste tunge sæt (højst 8 uger).')

  // Equal weight per calendar week prevents many sets in one session from
  // masquerading as independent evidence. OLS on weekly peak Epley estimates.
  const xs = points.map(p => calendarDaysBetween(first.day, p.day) / 7)
  const n = points.length, meanX = xs.reduce((a, b) => a + b, 0) / n
  const meanY = points.reduce((sum, p) => sum + p.value, 0) / n
  const sxx = xs.reduce((sum, x) => sum + (x - meanX) ** 2, 0)
  const slope = points.reduce((sum, p, i) => sum + (xs[i] - meanX) * (p.value - meanY), 0) / sxx
  const targetX = calendarDaysBetween(first.day, meetDate) / 7
  const estimate = meanY + slope * (targetX - meanX)
  const noise = Math.sqrt(points.reduce((sum, p, i) => sum + (p.value - meanY - slope * (xs[i] - meanX)) ** 2, 0) / (n - 2))
  // Heuristic uncertainty envelope, NOT a calibrated confidence interval.
  // Even a perfect straight line retains a 5% floor; distance widens the band.
  const halfWidth = Math.max(meanY * 0.05, 2 * noise) * Math.sqrt(1 + 1 / n + (targetX - meanX) ** 2 / sxx)
    + meanY * 0.05 * ahead / span
  if (![estimate, halfWidth, noise].every(Number.isFinite) || estimate <= 0 ||
      estimate < last.value * 0.75 || estimate > last.value * 1.25 || noise > meanY * 0.15)
    return missing('Udviklingen er for usikker til en enkel fremskrivning.')
  return { lift, status: 'ready', estimate, lower: Math.max(0, estimate - halfWidth), upper: estimate + halfWidth,
    weeks: n, firstDay: first.day, lastDay: last.day }
}

/** Pure, read-only forecast of loaded public snapshots. Explicit clock required.
 * No missing weeks are filled, no lift variants pooled, no program changes.
 * now: Date or ISO date/timestamp; meetDate: exact YYYY-MM-DD calendar date.
 */
export function meetPrognose(props = {}) {
  const result = (status, message) => ({ status, message, lifts: [] })
  if (!props || typeof props !== 'object') return result('error', 'Prognosedata har forkert format.')
  if (props.fremgangError || props.exerciseLogsError) return result('error', 'Løftehistorikken kunne ikke hentes. Prøv igen.')
  if (props.fremgangLoading === true) return result('loading', 'Henter løftehistorik.')
  const now = props.now
  const today = now instanceof Date || (typeof now === 'string' && datePattern.test(now)) ? calendarDay(now) : null
  if (!today) return result('error', 'En gyldig referencedato mangler.')
  const meetDate = dayOnly(props.meetDate)
  if (!meetDate) return result('error', 'Vælg en gyldig stævnedato.')
  if (meetDate < today) return result('error', 'Stævnedatoen må ikke ligge før referencedatoen.')
  if (!Array.isArray(props.fremgangLogs)) return result('error', 'Løftehistorikken er ikke klar. Indlæs historikken igen.')
  const contract = adaptPublicContract({
    currentWeek: props.currentWeek,
    exerciseLogs: confirmedSnapshot(props.exerciseLogs),
    fremgangLogs: confirmedSnapshot(props.fremgangLogs),
  }, now, { maxAgeDays: 84 })
  const lifts = MAIN_LIFTS.map(lift => project(contract.rows, lift, today, meetDate))
  return { status: lifts.some(lift => lift.status === 'ready') ? 'ready' : 'insufficient',
    today, meetDate, lifts, message: 'Fremskrevet e1RM til stævnet. Et skøn til evaluering med coachen; ingen garanti for et stævneresultat.' }
}
