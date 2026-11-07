import { activityDay } from '../../../dashboard/coachInactive.mjs'
import { civilDay, shiftDay, compare } from './rules.mjs'

export const RADAR_READ_CAP = 10000
export const RADAR_READ_PAGE_SIZE = 2000
export const RADAR_READ_MAX_PAGES = 100
export const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(value)
export function validScope(scope) {
  return validId(scope?.coachId) && civilDay(scope.day) && Array.isArray(scope.athleteIds) &&
    scope.athleteIds.every(validId) && new Set(scope.athleteIds).size === scope.athleteIds.length
}
export function scopeKey(scope) {
  return validScope(scope) ? JSON.stringify([scope.coachId, scope.day, [...scope.athleteIds].sort(compare)]) : null
}
const error = () => ({ state: 'error', complete: false, rows: [] })
const ready = rows => ({ state: 'ready', complete: true, rows })

// Existing role-authorized tables and passed client only. No client construction,
// auth lookup, service key, storage, writes or profile-cache reuse.
export async function loadRadarSnapshot(options = {}) {
  if (options.enabled !== true) return { state: 'off' }
  const { scope, client } = options
  if (!validScope(scope)) return { state: 'error' }
  const captured = { coachId: scope.coachId, day: scope.day, athleteIds: [...scope.athleteIds].sort(compare) }
  const from = shiftDay(captured.day, -13), through = captured.day
  const base = { ...captured, from, through }
  if (!captured.athleteIds.length) return { ...base, state: 'ready', logs: ready([]), readiness: ready([]) }
  if (typeof client?.from !== 'function') return { ...base, state: 'partial', logs: error(), readiness: error() }
  async function read(kind) {
    try {
      const logs = kind === 'logs'
      const rows = [], seen = new Set()
      let offset = 0
      for (let page = 0; page < RADAR_READ_MAX_PAGES; page++) {
        // Readiness uses the existing '*' contract because legacy rows can lack
        // pain columns. Only the explicit fields below leave this boundary.
        let query = client.from(logs ? 'exercise_logs' : 'readiness_logs')
          .select(logs ? 'id, athlete_id, logged_at, skipped, rpe_actual, exercises(sessions(id))' : '*')
          .in('athlete_id', captured.athleteIds)
        query = logs ? query.gte('logged_at', `${shiftDay(from, -1)}T00:00:00Z`)
          .lte('logged_at', `${shiftDay(through, 1)}T00:00:00Z`).order('logged_at', { ascending: true }).order('id', { ascending: true })
          : query.gte('logged_date', from).lte('logged_date', through).order('logged_date', { ascending: true }).order('athlete_id', { ascending: true })
        // A short page can be the server's Max rows cap, not the end. Advance
        // by the received count and require an empty page under a total order.
        const result = await query.range(offset, offset + RADAR_READ_PAGE_SIZE - 1)
        if (result?.error || !Array.isArray(result?.data) || result.data.length > RADAR_READ_PAGE_SIZE) return error()
        if (!result.data.length) return ready(rows)
        offset += result.data.length
        if (offset >= RADAR_READ_CAP) return error()
        for (const row of result.data) {
          if (!captured.athleteIds.includes(row?.athlete_id)) return error()
          const day = logs ? typeof row.logged_at === 'string' && activityDay(row.logged_at) : row.logged_date
          if (!civilDay(day)) return error()
          const key = logs ? row.id : `${row.athlete_id}:${day}`
          if ((logs && (!validId(key) || typeof row.skipped !== 'boolean')) || seen.has(key)) return error()
          seen.add(key)
          // Count and deduplicate UTC padding rows too, so a repeated outside
          // page cannot masquerade as an empty or complete in-window read.
          if (logs && (day < from || day > through)) continue
          if (day < from || day > through) return error()
          rows.push(logs ? { id: row.id, athlete_id: row.athlete_id, logged_at: row.logged_at,
            skipped: row.skipped, rpe_actual: row.rpe_actual,
            sessionId: row.exercises?.sessions?.id } : {
            athlete_id: row.athlete_id, day, readiness: row.readiness_score,
            sleep: row.sleep_hours, pain: row.pain, location: row.pain_location, source: row.source,
          })
        }
      }
      return error()
    } catch { return error() }
  }
  const [logs, readiness] = await Promise.all([read('logs'), read('readiness')])
  return { ...base, state: logs.state === 'ready' && readiness.state === 'ready' ? 'ready' : 'partial', logs, readiness }
}
