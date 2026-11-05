// Test-only synthetic read boundary for the actual copied lavLaesninger.
import assert from 'node:assert/strict'
export const fixture = { result: { data: [], error: null }, calls: [] }
export const supabase = {
  from(table) {
    const query = new Proxy({}, { get(_, method) {
      if (['insert', 'update', 'upsert', 'delete'].includes(method))
        return () => assert.fail('No mutation capability in the program-read fixture')
      if (method === 'then') return (resolve, reject) =>
        Promise.resolve(table === 'weeks' ? fixture.result : { data: [], error: null }).then(resolve, reject)
      return (...args) => { fixture.calls.push([table, method, ...args]); return query }
    } })
    return query
  },
  rpc() { assert.fail('No RPC in the program-read fixture') },
}
export const withRetry = read => read()
export const queueWrite = () => assert.fail('No queued writes in a program read')
