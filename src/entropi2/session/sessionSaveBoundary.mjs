// Synthetic transport boundary. No real client, environment or network.
export const rows = new Map(), calls = []
export let behavior = 'ok'
export function reset(mode = 'ok') { rows.clear(); calls.length = 0; behavior = mode }
export function mode(value) { behavior = value }
export const supabase = { from(table) {
  if (table !== 'exercise_logs') throw Error('Forbidden table: ' + table)
  let op = 'select', body, filters = []
  const builder = {
    select() { return this }, single() { return this }, limit() { return this },
    eq(k, v) { filters.push([k, v]); return this },
    insert(v) { op = 'insert'; body = v; return this },
    update(v) { op = 'update'; body = v; return this },
    delete() { op = 'delete'; return this },
    then(resolve, reject) {
      const run = async () => {
        calls.push({ op, body, filters: [...filters] })
        if (behavior === 'throw') throw new TypeError('Synthetic disconnected transport')
        if (behavior === 'offline') return { data: null, error: { message: 'Failed to fetch' } }
        // A successful transport resets the real module's network memory.
        const { markNetworkSuccess } = await import('../../offlineSession.js'); markNetworkSuccess()
        const matches = [...rows.values()].filter(row => filters.every(([k, v]) => row[k] === v))
        if (op === 'select') return { data: matches, error: null }
        if (op === 'insert') {
          if (rows.has(body.id)) return { data: null, error: { code: '23505' } }
          rows.set(body.id, { ...body })
          if (behavior === 'lost') { behavior = 'ok'; return { data: null, error: { message: 'Reply lost' } } }
          return { data: { id: body.id }, error: null }
        }
        if (op === 'update') for (const row of matches) rows.set(row.id, { ...row, ...body })
        if (op === 'delete') for (const row of matches) rows.delete(row.id)
        return { data: matches.map(row => ({ id: row.id })), error: null }
      }
      return run().then(resolve, reject)
    },
  }
  return builder
} }
export const queueWrite = (fn, options = {}) => { options.onStart?.(); return fn() }
export const recordSilentFail = () => {}
export const logFrontendError = () => {}
export const parsePlannedRpe = () => null
