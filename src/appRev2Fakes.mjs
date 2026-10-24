// Synthetic database boundary. Calls are recorded; no service client is imported.
export const writes = []
export let reply = { data: [], error: null }
export function resetFake(next = { data: [], error: null }) { writes.length = 0; reply = next }
export const supabase = {
  from(table) {
    let kind = 'select'
    const query = {
      select() { return query }, eq() { return query }, limit() { return query },
      order() { return query }, in() { return query }, gte() { return query },
      single() { return query }, maybeSingle() { return query },
      insert(payload) { kind = 'insert'; writes.push({ table, kind, payload }); return query },
      update(payload) { kind = 'update'; writes.push({ table, kind, payload }); return query },
      upsert(payload) { kind = 'upsert'; writes.push({ table, kind, payload }); return query },
      then(resolve, reject) { return Promise.resolve(reply).then(resolve, reject) },
    }
    return query
  },
}
export const queueWrite = async (fn, options) => { options?.onStart?.(); return fn() }
export const withRetry = fn => fn()
export function targetPrescriptionForExercise() { throw new Error('Unpinned progressionState branch must not execute') }
