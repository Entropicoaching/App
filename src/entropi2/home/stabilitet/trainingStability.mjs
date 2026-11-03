import { calendarDay, addCalendarDays } from '../../../calendarDate.js'
import { weekSessions } from '../../session/weekSessions.mjs'

const validId = value => (typeof value === 'string' && value.trim() !== '') ||
  (Number.isSafeInteger(value) && value > 0)
const dateOnly = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  ? calendarDay(value) : null
const monday = day => addCalendarDays(day, -((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7))

/**
 * Read-only, unwired snapshot of this Danish calendar week and three previous
 * weeks, oldest first. Explicit Monday start_date anchors are required; missing
 * weeks are unknown, while a loaded week with sessions: [] has zero planned.
 * A completed session has every planned slot addressed (confirmed or skipped)
 * and at least one confirmed slot. Entirely skipped sessions are not completed.
 * Counts describe each plan week, including its future planned sessions; logs
 * must be dated within that week and no later than the explicit clock instant.
 */
export function trainingStability(props = {}) {
  // Do not read snapshots or start any work with the feature OFF.
  if (props?.enabled !== true) return null
  const { allWeeks, exerciseLogs, athleteId, now, loading = false,
    programError = false, offlineSnapshotAt, pendingSyncKeys = [], parkedSets = [] } = props
  if (loading || programError || offlineSnapshotAt != null || !validId(athleteId) ||
      !Array.isArray(allWeeks) || !Array.isArray(exerciseLogs) ||
      !Array.isArray(pendingSyncKeys) || !Array.isArray(parkedSets)) return null
  // Reuse the public session projection's strict timestamp and Danish day rules.
  const clock = weekSessions({ now }).today
  if (!clock) return null
  const currentStart = monday(clock)
  const starts = Array.from({ length: 4 }, (_, i) => addCalendarDays(currentStart, (i - 3) * 7))
  if (starts.some(start => !start || !addCalendarDays(start, 6))) return null
  // Undated/non-calendar plans cannot be safely assigned to a history bucket.
  if (allWeeks.some(week => !dateOnly(week?.start_date) || monday(week.start_date) !== week.start_date)) return null
  const pending = [...pendingSyncKeys, ...exerciseLogs.filter(row => row?._optimistic &&
    (row.athlete_id == null || row.athlete_id === athleteId))
    .map(row => `${row.exercise_id}_${row.set_number}`)]
  const weeks = starts.map(start => {
    const end = addCalendarDays(start, 6)
    const unknown = { start, end, state: 'unknown', planned: null, completed: null }
    const candidates = allWeeks.filter(week => week.start_date === start)
    if (candidates.length !== 1) return unknown
    const week = candidates[0]
    if (!validId(week.id) || allWeeks.filter(other => other.id === week.id).length !== 1) return unknown
    const result = weekSessions({ week, exerciseLogs, athleteId, now,
      pendingSyncKeys: pending, parkedSets })
    if (result.dataMissing || result.sessions.some(session => session.dataMissing)) return unknown
    // Empty exercise placeholders are not planned training sessions.
    const planned = result.sessions.filter(session => session.planned > 0)
    return { start, end, state: 'ready', planned: planned.length,
      completed: planned.filter(session => session.status === 'klaret' && session.confirmed > 0).length }
  })
  const current = weeks[3]
  const line = current.state !== 'ready' ? null : current.planned === 0
    ? 'Ingen pas planlagt i denne uge.'
    : `${current.completed} af ${current.planned} pas i denne uge`
  return { today: clock, weeks, line }
}
