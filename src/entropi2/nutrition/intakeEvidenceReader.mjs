// Explicit local read capability. The injected client's server-side RLS is authority.
import { INTAKE_LIMITS, readIntakeEvidence, summarizeIntakeEvidence } from './intakeEvidence.mjs'
import { calendarTime } from '../../athlete/kostNumbers.mjs'

const parentsTable = 'meal_logs'
const evidenceTable = 'meal_intake_evidence_v1'
const parentColumns = 'id,athlete_id,date,meal,kcal,protein,carb,fat'
const evidenceColumns = 'meal_log_id,request_id,athlete_id,date,version,food,grams,meal,kcal,protein,carb,fat,created_at'
const pageSize = 500
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const exact = (value, columns) => object(value) && Object.keys(value).length === columns.length && columns.every(key => Object.hasOwn(value, key))
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}
// Transport values must be JSON, not SQL-driver Date/NUMERIC objects or NaN.
function json(value, depth = 0) {
  if (depth > 16) return false
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (!object(value) && !Array.isArray(value)) return false
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return false
  return Object.values(value).every(item => json(item, depth + 1))
}
const copy = value => JSON.parse(JSON.stringify(value))
const stopped = (status, reason = null) => freeze({ status, reason, scope: null, summary: null, entries: [], mealLogs: [], evidenceRows: [] })
const issue = (status, reason) => { throw Object.freeze({ status, reason }) }
const validScope = scope => scope?.enabled === true && uuid(scope.ownerId) && uuid(scope.athleteId)
  && calendarTime(scope.date) !== null && scope.date >= '1900-01-01' && scope.date <= '9999-12-31'
  && Number.isSafeInteger(scope.generation) && scope.generation >= 0 && typeof scope.client?.from === 'function'

// One instance belongs to one immutable scope. getCurrentScope must expose every
// lifecycle change synchronously; a new generation is required even for A->B->A.
export function createIntakeEvidenceReader(options = {}) {
  // Do not read client, scope getter or any other option when the strict gate is OFF.
  if (options.enabled !== true) {
    const off = stopped('off')
    return Object.freeze({ snapshot: () => off, load: () => Promise.resolve(off), dispose() {} })
  }
  const initial = { enabled: true, ownerId: options.ownerId, athleteId: options.athleteId,
    date: options.date, generation: options.generation, client: options.client }
  const getCurrentScope = options.getCurrentScope
  let state = stopped('idle'), pending = null, terminal = false
  if (!validScope(initial) || typeof getCurrentScope !== 'function') { state = stopped('invalid-scope'); terminal = true }
  const retire = () => { terminal = true; state = stopped('retired'); return false }
  const current = () => {
    if (terminal) return false
    try {
      const value = getCurrentScope()
      return validScope(value) && Object.keys(initial).every(key => value[key] === initial[key]) ? true : retire()
    } catch { return retire() }
  }
  const check = () => { if (!current()) issue(state.status, null) }
  const scope = Object.freeze({ ownerId: initial.ownerId, athleteId: initial.athleteId, date: initial.date, generation: initial.generation })

  async function list(table, columns, identity) {
    const rows = [], identities = new Set(), requests = new Set()
    let count = null, previous = null
    // At most three queries/table, 1001 actual rows. Full pages always have an
    // explicit next-page probe, including exactly 1000 rows. Exact counts detect
    // silent server caps, dropped pages and count changes rather than assuming EOF.
    while (rows.length <= INTAKE_LIMITS.rows) {
      check()
      const start = rows.length, size = Math.min(pageSize, INTAKE_LIMITS.rows + 1 - start)
      const result = await initial.client.from(table).select(columns, { count: 'exact' })
        .eq('athlete_id', initial.athleteId).eq('date', initial.date)
        .order(identity, { ascending: true }).range(start, start + size - 1)
      check()
      if (result?.error) {
        const unavailable = ['42P01', '42883', 'PGRST202', 'PGRST205'].includes(result.error.code)
        issue(unavailable ? 'unavailable' : 'error', unavailable ? 'evidence-unavailable' : 'read-failed')
      }
      if (!Array.isArray(result?.data) || !Number.isSafeInteger(result.count) || result.count < 0) issue('incomplete', 'invalid-response')
      if (count !== null && count !== result.count) issue('incomplete', 'pagination-changed')
      count = result.count
      if (result.data.length !== Math.min(size, Math.max(0, count - start))) issue('incomplete', 'partial-page')
      // Detach immediately after the await, before another query can mutate a
      // transport-owned object. No partial rows survive an unsuccessful load.
      if (!json(result.data)) issue('incomplete', 'invalid-response')
      const page = copy(result.data)
      for (const row of page) {
        if (!exact(row, columns.split(',')) || !uuid(row[identity])
          || row.athlete_id !== initial.athleteId || row.date !== initial.date
          || typeof row.meal !== 'string'
          || ['kcal', 'protein', 'carb', 'fat'].some(key => row[key] !== null && !Number.isSafeInteger(row[key]))) issue('incomplete', 'invalid-row')
        if (identities.has(row[identity]) || (previous !== null && row[identity] <= previous)) issue('incomplete', 'pagination-identity')
        if (table === evidenceTable) {
          if (requests.has(row.request_id) || !readIntakeEvidence({ id: row.meal_log_id, athlete_id: row.athlete_id,
            date: row.date, meal: row.meal, kcal: row.kcal, protein: row.protein, carb: row.carb, fat: row.fat }, row, initial)) issue('incomplete', 'invalid-evidence')
          requests.add(row.request_id)
        }
        identities.add(row[identity]); previous = row[identity]; rows.push(row)
      }
      if (rows.length > INTAKE_LIMITS.rows) issue('incomplete', 'row-limit')
      if (page.length < size) return rows
    }
    issue('incomplete', 'row-limit')
  }

  async function run() {
    try {
      check()
      await list(parentsTable, parentColumns, 'id')
      check()
      const evidenceRows = await list(evidenceTable, evidenceColumns, 'meal_log_id')
      check()
      // These are separate requests, not a transaction snapshot. Always use the
      // final complete parent list, never the initial list or last load's cache.
      const mealLogs = await list(parentsTable, parentColumns, 'id')
      check()
      const summary = summarizeIntakeEvidence({ ...scope, mealLogs, evidenceRows })
      const byId = new Map(evidenceRows.map(row => [row.meal_log_id, row]))
      const entries = mealLogs.map(row => readIntakeEvidence(row, byId.get(row.id), scope))
      check()
      state = freeze({ status: 'ready', reason: null, scope, summary, entries, mealLogs, evidenceRows })
    } catch (error) {
      if (!terminal && current()) {
        const status = ['incomplete', 'unavailable', 'error'].includes(error?.status) ? error.status : 'error'
        state = stopped(status, status === 'error' ? 'read-failed' : error.reason)
      }
    }
    return state
  }
  return Object.freeze({
    load() {
      if (!current()) return Promise.resolve(state)
      if (pending) return pending
      state = stopped('loading')
      pending = run().finally(() => { pending = null })
      return pending
    },
    snapshot() { current(); return state },
    dispose() { terminal = true; state = stopped('disposed') },
  })
}
