// Synthetic public test data only. No user IDs, real names or captured payloads.
import { shiftDay } from './rules.mjs'
export const day = '2026-11-06'
export function fixture(count = 1) {
  const ids = Array.from({ length: count }, (_, i) => `synthetic-${String(i).padStart(2, '0')}`)
  const source = { session: { user: { id: 'synthetic-coach' } },
    readContext: { coachId: 'synthetic-coach', day, athleteIds: [...ids] },
    athletes: ids.map(id => ({ id, name: `Syntetisk atlet ${id.slice(-2)}` })),
    calendarWeeks: Object.fromEntries(ids.map(id => [id, []])),
    coachActionsStatus: { calendar: 'ready', activity: { state: 'ready', day, ids, rows: [] } },
    coachMorningData: { messages: { state: 'ready', day, ids, rows: [] }, videos: { state: 'ready', day, ids, rows: [] } } }
  const snapshot = { coachId: 'synthetic-coach', day, athleteIds: [...ids], state: 'ready',
    from: shiftDay(day, -13), through: day,
    logs: { state: 'ready', complete: true, rows: ids.map(id => ({ id: `log-${id}`, athlete_id: id,
      logged_at: `${day}T10:00:00Z`, skipped: false, sessionId: `session-${id}` })) },
    readiness: { state: 'ready', complete: true, rows: [] } }
  return { source, snapshot, ids }
}
export function mockClient(data = {}) {
  const calls = []
  const client = { from(table) {
    const call = { table, methods: [] }; calls.push(call)
    const query = Object.fromEntries(['select', 'in', 'gte', 'lte', 'order'].map(method => [method, (...args) => {
      call.methods.push([method, ...args]); return query
    }]))
    query.limit = cap => {
      call.methods.push(['limit', cap])
      const value = data[table] ?? { data: [], error: null }
      return typeof value === 'function' ? value() : value
    }
    query.range = (start, end) => {
      call.methods.push(['range', start, end])
      const value = data[table] ?? { data: [], error: null }
      const result = typeof value === 'function' ? value({ start, end }) : value
      const slice = response => Array.isArray(response?.data)
        ? { ...response, data: response.data.slice(start, end + 1) } : response
      return typeof result?.then === 'function' ? result.then(slice) : slice(result)
    }
    return query
  } }
  return { client, calls }
}
