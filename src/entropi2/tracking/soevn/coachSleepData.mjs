import { addCalendarDays } from '../../../calendarDate.js'
import { isDay } from '../visning/trackingContract.mjs'
import { buildSleepOverview } from './sleepModel.mjs'

export const SLEEP_READ_CAP = 1000
export const validSleepScope = ({ coachId, athleteId, asOf } = {}) =>
  typeof coachId === 'string' && coachId.trim().length > 0 &&
  typeof athleteId === 'string' && athleteId.trim().length > 0 && isDay(asOf)

// Legacy rows prove presence only, never completeness. Do not inspect them OFF.
export function hasReadinessSleep(props = {}) {
  if (props.enabled !== true || !validSleepScope(props)) return false
  const to = addCalendarDays(props.asOf, -1), from = addCalendarDays(to, -55)
  return Array.isArray(props.readinessRows) && props.readinessRows.some(row =>
    row?.athlete_id === props.athleteId && !row._optimistic && isDay(row.logged_date) &&
    row.logged_date >= from && row.logged_date <= to &&
    typeof row.sleep_hours === 'number' && Number.isFinite(row.sleep_hours) &&
    row.sleep_hours >= 0 && row.sleep_hours <= 24)
}

// Read only the existing role-authorized production source. No quality/training
// query and no assumption that the legacy graph's last 90 rows are complete.
export async function readCoachSleep(client, scope) {
  if (!validSleepScope(scope) || !client) return { status: 'error' }
  const endDate = addCalendarDays(scope.asOf, -1)
  const from = addCalendarDays(endDate, -55)
  try {
    const result = await client.from('readiness_logs')
      .select('athlete_id, logged_date, sleep_hours').eq('athlete_id', scope.athleteId)
      .gte('logged_date', from).lte('logged_date', endDate)
      .order('logged_date').limit(SLEEP_READ_CAP)
    if (result?.error || !Array.isArray(result?.data) || result.data.length >= SLEEP_READ_CAP)
      return { status: 'error' }
    const snapshot = { status: 'ready', complete: true, athleteId: scope.athleteId,
      endDate, readinessRows: result.data.map(row => ({ athlete_id: row?.athlete_id,
        logged_date: row?.logged_date, sleep_hours: row?.sleep_hours })),
      qualityRows: [], exerciseLogs: [] }
    return buildSleepOverview(snapshot, { enabled: true, weeks: 8 }).status === 'error'
      ? { status: 'error' } : snapshot
  } catch {
    return { status: 'error' }
  }
}

export function selectCoachSleep(result, client, scope, attempt) {
  return result?.client === client && result?.coachId === scope.coachId &&
    result?.athleteId === scope.athleteId && result?.asOf === scope.asOf &&
    result?.attempt === attempt ? result.snapshot : null
}

export function startCoachSleep({ enabled, client, scope, attempt }, onResult) {
  if (enabled !== true || !validSleepScope(scope) || !client) return undefined
  let current = true
  readCoachSleep(client, scope).then(snapshot => {
    if (current) onResult({ client, ...scope, attempt, snapshot })
  })
  return () => { current = false }
}
