import { calendarDay, addCalendarDays } from '../../calendarDate.js'

// Below the API's usual 1000-row cap. A full cap is deliberately incomplete.
export const TRACKING_READ_CAP = 500
// Mine tal shows wellbeing only. Other domains have their own Mine data reads.
const columns = 'id,athlete_id,logged_date,sleep_hours,energy,stress,soreness_level'

export function trackingScope(props = {}) {
  if (props.enabled !== true) return null
  const { athleteId, day } = props
  if (typeof athleteId !== 'string' || !athleteId.trim() || typeof day !== 'string'
    || !/^\d{4}-\d{2}-\d{2}$/.test(day) || calendarDay(day) !== day) return null
  const endDate = addCalendarDays(day, -1)
  return endDate && addCalendarDays(endDate, -28) ? { athleteId, endDate } : null
}

/** Injected existing app client; no auth lookup, storage, writes or new table.
 * The host permits only the signed-in athlete's own surface. Every query also
 * filters athlete_id; every returned row is checked before it reaches the UI.
 */
export async function readOwnTracking(props = {}) {
  const scope = trackingScope(props)
  if (!scope) return null
  const { athleteId, endDate } = scope, from = addCalendarDays(endDate, -27)
  const failed = { ...scope, status: 'error', complete: false }
  try {
    const result = await props.client.from('readiness_logs').select(columns).eq('athlete_id', athleteId)
      .gte('logged_date', from).lte('logged_date', endDate)
      .order('logged_date').order('id').limit(TRACKING_READ_CAP)
    if (result?.error || !Array.isArray(result?.data) || result.data.length >= TRACKING_READ_CAP)
      throw Error('Incomplete tracking source')
    const dailyRows = result.data.map(row => {
      if (!row || typeof row !== 'object' || row.athlete_id !== athleteId)
        throw Error('Unexpected tracking identity')
      if (typeof row.logged_date !== 'string') throw Error('Missing tracking date')
      const day = calendarDay(row.logged_date)
      if (!day || day !== row.logged_date) throw Error('Invalid tracking date')
      // Whitelist output too: unrelated/private properties are never copied.
      return { ...Object.fromEntries(columns.split(',').map(column => [column, row[column]])), source: 'readiness_logs' }
    }).filter(row => row.logged_date >= from && row.logged_date <= endDate)
    return { ...scope, status: 'ready', complete: true, dailySource: 'readiness_logs', dailyRows }
  } catch {
    return failed
  }
}

// Cancellation prevents late results after a tab, identity, day or retry change.
export function startTrackingRead(props, onResult) {
  if (!trackingScope(props)) return undefined
  let active = true
  readOwnTracking(props).then(snapshot => { if (active) onResult(snapshot) })
  return () => { active = false }
}

export function selectTrackingResult(result, client, scope, attempt) {
  if (!scope) return null
  const matches = result?.client === client && result?.attempt === attempt
    && result?.snapshot?.athleteId === scope.athleteId && result?.snapshot?.endDate === scope.endDate
  return matches ? result.snapshot : { ...scope, status: 'loading', complete: false }
}
