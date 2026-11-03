import { calendarDay, addCalendarDays } from '../../calendarDate.js'
import { parseInputNumber } from '../../inputValues.js'
import { explicitRpe } from '../../dataEnough.mjs'

const timestamp = /^\d{4}-\d{2}-\d{2}(?:$|T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$)/

// Persisted IDs take precedence; without IDs, use a set position or timestamp.
// Conflicting copies are excluded rather than picking an input-order winner.
function uniqueSets(rows) {
  const groups = new Map()
  rows.forEach((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return
    const key = row.id != null ? JSON.stringify(['id', row.id])
      : row.exercise_id != null && row.set_number != null
        ? JSON.stringify(['position', row.exercise_id, row.set_number])
        : row.exercise_id != null ? JSON.stringify(['time', row.exercise_id, row.logged_at])
          : JSON.stringify(['row', index])
    const signature = JSON.stringify([row.exercise_id, row.set_number, row.logged_at,
      row.weight, row.reps_completed, row.skipped ?? false, row._optimistic ?? false,
      row.rpe_actual, row.rpe, row.rpe_source, row.note])
    const group = groups.get(key) ?? new Map()
    group.set(signature, row)
    groups.set(key, group)
  })
  return [...groups.values()].filter(group => group.size === 1).map(group => [...group.values()][0])
}

/**
 * Descriptive load for four Danish Monday–Sunday calendar weeks, oldest first.
 * `asOf` is required: YYYY-MM-DD (whole day) or an explicitly zoned timestamp /
 * Date (exact instant). No clock, queries, flags, UI, recommendations or writes.
 * Input is one already scoped, authoritative exercise_logs snapshot: one row
 * per set, NOT planned exercise sets/reps. Caller owns athlete/loading scope.
 * Empty weeks have tonnage 0 and RPE null. Invalid/missing set measurements
 * make that week's tonnage null; RPE uses only explicit athlete ratings.
 * Ratio needs at least one measurable set in EACH week and a positive chronic
 * mean. It compares the current (possibly partial) week to the previous three.
 */
export function weeklyLoad(exerciseLogs, asOf) {
  const isDay = typeof asOf === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(asOf)
  if (!(asOf instanceof Date) && !(typeof asOf === 'string' && timestamp.test(asOf))) return null
  const today = calendarDay(asOf)
  if (!today || !Array.isArray(exerciseLogs)) return null
  const cutoff = isDay ? null : new Date(asOf).getTime()
  const monday = addCalendarDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7))
  const weeks = Array.from({ length: 4 }, (_, i) => {
    const start = addCalendarDays(monday, (i - 3) * 7)
    return { start, end: start && addCalendarDays(start, 6), sets: 0,
      tonnage: 0, averageRpe: null, rpeCount: 0 }
  })
  if (weeks.some(week => !week.start || !week.end)) return null
  for (const row of uniqueSets(exerciseLogs)) {
    if (row.skipped || row._optimistic || typeof row.logged_at !== 'string' || !timestamp.test(row.logged_at)) continue
    const day = calendarDay(row.logged_at)
    if (!day || day > today || (cutoff !== null && row.logged_at.includes('T') && Date.parse(row.logged_at) > cutoff)) continue
    const week = weeks.find(w => day >= w.start && day <= w.end)
    if (!week) continue
    week.sets++
    const weight = parseInputNumber(row.weight), reps = parseInputNumber(row.reps_completed)
    const load = weight !== null && weight >= 0 && Number.isSafeInteger(reps) && reps > 0 ? weight * reps : NaN
    week.tonnage = week.tonnage !== null && Number.isFinite(load) && Number.isFinite(week.tonnage + load)
      ? week.tonnage + load : null
    if (explicitRpe(row)) {
      const rating = row.rpe_actual ?? row.rpe
      week.rpeCount++
      week.averageRpe = week.averageRpe === null ? rating
        : week.averageRpe + (rating - week.averageRpe) / week.rpeCount
    }
  }
  const previous = weeks.slice(0, 3), current = weeks[3]
  const chronicLoad = previous.every(w => w.sets > 0 && w.tonnage !== null)
    ? previous.reduce((sum, w) => sum + w.tonnage / 3, 0) : null
  const ratio = chronicLoad > 0 && current.sets > 0 && current.tonnage !== null
    ? current.tonnage / chronicLoad : null
  return { weeks, chronicLoad, acuteChronicRatio: Number.isFinite(ratio) ? ratio : null }
}
