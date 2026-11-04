import { calendarDay, addCalendarDays } from '../../../calendarDate.js'
import { parseInputNumber } from '../../../inputValues.js'

export const INTENSITY_ZONES = Object.freeze([
  Object.freeze({ key: 'under70', label: 'Under 70 %' }),
  Object.freeze({ key: '70to80', label: '70 til under 80 %' }),
  Object.freeze({ key: '80to90', label: '80 til under 90 %' }),
  Object.freeze({ key: '90plus', label: '90 % eller mere' }),
])
const timestamp = /^\d{4}-\d{2}-\d{2}(?:$|T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$)/

// Explicit external reference for THIS exercise/set; never derive the denominator
// from the same set's reps. Missing reference is unknown, not low intensity.
export function intensityZone(weight, referenceE1rm) {
  const load = parseInputNumber(weight), reference = parseInputNumber(referenceE1rm)
  if (!(load > 0) || !(reference > 0)) return null
  const ratio = load / reference
  if (!Number.isFinite(ratio) || ratio <= 0) return null
  return ratio < 0.7 ? 'under70' : ratio < 0.8 ? '70to80' : ratio < 0.9 ? '80to90' : '90plus'
}

function uniqueSets(rows) {
  const groups = new Map(), ids = new Map()
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue
    // An exercise_id denotes a programmed exercise instance, not a catalogue ID.
    const key = row.exercise_id != null && row.set_number != null
      ? JSON.stringify(['position', row.exercise_id, row.set_number])
      : row.id != null ? JSON.stringify(['id', row.id])
        : row.exercise_id != null ? JSON.stringify(['time', row.exercise_id, row.logged_at]) : null
    if (key === null) continue
    const signature = JSON.stringify([row.exercise_id, row.set_number, row.logged_at,
      row.weight, row.reps_completed, row.reference_e1rm, row.skipped ?? false, row._optimistic ?? false])
    const group = groups.get(key) ?? new Map()
    group.set(signature, row); groups.set(key, group)
    if (row.id != null) {
      const values = ids.get(row.id) ?? new Set()
      values.add(signature); ids.set(row.id, values)
    }
  }
  const conflicts = new Set([...ids.values()].filter(v => v.size > 1).flatMap(v => [...v]))
  return [...groups.values()].filter(g => g.size === 1 && !conflicts.has([...g.keys()][0]))
    .map(g => [...g.values()][0])
}

/** Four Danish Monday-Sunday weeks. Caller supplies one athlete's authoritative
 * Optional third argument { weeks: 1..26 }; default remains four weeks.
 * snapshot, enriched with reference_e1rm in the SAME weight unit and exercise
 * variation, chosen independently and known at the time of that set.
 * No fetching, current clock, writes, recommendations or screen integration.
 */
export function weeklyIntensity(exerciseLogs, asOf, { weeks: weekCount = 4 } = {}) {
  if (!Number.isSafeInteger(weekCount) || weekCount < 1 || weekCount > 26)
    return { ready: false, weeks: [], message: 'Ugeperioden er ugyldig.' }
  const isDay = typeof asOf === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(asOf)
  if (!(asOf instanceof Date) && !(typeof asOf === 'string' && timestamp.test(asOf)))
    return { ready: false, weeks: [], message: 'Dato mangler eller er ugyldig.' }
  const today = calendarDay(asOf)
  if (!today) return { ready: false, weeks: [], message: 'Dato mangler eller er ugyldig.' }
  if (!Array.isArray(exerciseLogs)) return { ready: false, weeks: [], message: 'Sætdata er ikke klar.' }
  const cutoff = isDay ? null : new Date(asOf).getTime()
  const monday = addCalendarDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7))
  const weeks = Array.from({ length: weekCount }, (_, i) => {
    const start = addCalendarDays(monday, (i - weekCount + 1) * 7)
    return { start, end: addCalendarDays(start, 6), total: 0, classified: 0, unknown: 0,
      zones: INTENSITY_ZONES.map(zone => ({ ...zone, count: 0, share: null })) }
  })
  if (weeks.some(w => !w.start || !w.end)) return { ready: false, weeks: [], message: 'Datoperioden er ugyldig.' }
  for (const row of uniqueSets(exerciseLogs)) {
    if (row.skipped || row._optimistic || typeof row.logged_at !== 'string' || !timestamp.test(row.logged_at)) continue
    const day = calendarDay(row.logged_at)
    if (!day || day > today || (cutoff !== null && row.logged_at.includes('T') && Date.parse(row.logged_at) > cutoff)) continue
    const week = weeks.find(w => day >= w.start && day <= w.end)
    if (!week) continue
    week.total++
    const reps = parseInputNumber(row.reps_completed)
    const key = Number.isSafeInteger(reps) && reps > 0 ? intensityZone(row.weight, row.reference_e1rm) : null
    if (key === null) week.unknown++
    else { week.classified++; week.zones.find(z => z.key === key).count++ }
  }
  for (const week of weeks) for (const zone of week.zones)
    zone.share = week.classified ? zone.count / week.classified : null
  return { ready: true, weeks, message: 'Fordeling af registrerede sæt efter vægt i procent af estimeret 1RM (e1RM). Denne uge er ufuldstændig. Procenterne gælder kun sæt med gyldige målinger og reference; ukendte sæt vises særskilt.' }
}
