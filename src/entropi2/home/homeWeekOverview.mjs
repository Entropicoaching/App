import { addCalendarDays } from '../../calendarDate.js'
import { weekSessions } from '../session/weekSessions.mjs'
import { weekSummary } from './weekSummary.mjs'

// Select the single loaded seven-calendar-day interval containing today.
// Undated plans cannot anchor it; calendar arithmetic preserves DST boundaries.
// Keep Home's existing addressed-slot completion semantics.
export function homeWeekOverview(props = {}) {
  if (props.enabled !== true) return null
  if (props.onHoliday || props.loading || props.programError || props.offlineSnapshotAt != null ||
      !Array.isArray(props.allWeeks) || !Array.isArray(props.exerciseLogs)) return null
  const today = weekSessions({ now: props.now }).today
  if (!today) return null
  const candidates = props.allWeeks.filter(week => {
    const start = week?.start_date
    if (typeof start !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(start)) return false
    const end = addCalendarDays(start, 7)
    return end != null && start <= today && today < end
  })
  if (candidates.length !== 1) return null
  const week = candidates[0]
  if (week.id == null || props.allWeeks.filter(other => other?.id === week.id).length !== 1) return null
  const plan = { enabled: true, week, athleteId: props.athlete?.id, now: props.now,
    exerciseLogs: props.exerciseLogs, pendingSyncKeys: props.pendingSyncKeys, parkedSets: props.parkedSets }
  const result = weekSessions(plan)
  if (result.dataMissing) return null
  return {
    line: week.sessions.length === 0 ? 'Ingen pas planlagt i denne uge.'
      : weekSummary({ ...props, currentWeek: week }),
    plan: week.sessions.length ? plan : null,
  }
}
