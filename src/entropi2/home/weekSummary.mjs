import { weekSessions } from '../session/weekSessions.mjs'

// Only summarize the loaded calendar week: next week's card must not relabel it.
export function weekSummary({ enabled, currentWeek, exerciseLogs, athlete, now,
  programError, offlineSnapshotAt, pendingSyncKeys, parkedSets } = {}) {
  if (enabled !== true || programError || offlineSnapshotAt != null) return null
  const result = weekSessions({ week: currentWeek, exerciseLogs, athleteId: athlete?.id,
    now, pendingSyncKeys, parkedSets })
  if (result.dataMissing || !result.today || result.today < result.start || result.today > result.end ||
      !result.sessions.length || result.sessions.some(s => s.dataMissing || !s.planned)) return null
  const done = result.sessions.filter(s => s.status === 'klaret').length
  return `Ugen: ${done} af ${result.sessions.length} pas`
}
