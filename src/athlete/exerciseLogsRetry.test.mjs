import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { supabase } from '../appRev2Fakes.mjs'

const hooks = registerHooks({ resolve(specifier, context, next) {
  if (/(?:^|\/)supabase(?:\.js)?$/.test(specifier))
    return { url: new URL('../appRev2Fakes.mjs', import.meta.url).href, shortCircuit: true }
  if (specifier.startsWith('.') && context.parentURL && !/\.[a-z]+$/i.test(specifier)) {
    const url = new URL(specifier + '.js', context.parentURL)
    if (existsSync(url)) return { url: url.href, shortCircuit: true }
  }
  return next(specifier, context)
} })
const { lavLaesninger } = await import('./laesninger.js')
const { sessionHistoryProps, mountExerciseHistory } = await import('../entropi2/session/historik/exerciseHistoryDom.mjs')
const { historyTestDom } = await import('../entropi2/session/historik/historyTestDom.mjs')
test.after(() => hooks.deregister())

const week = { id: 'synthetic-week', sessions: [{ id: 'synthetic-session', exercises: [{ id: 'synthetic-lift', name: 'Squat' }] }] }
const row = { id: 'synthetic-row', athlete_id: 'synthetic-athlete', exercise_id: 'synthetic-lift',
  set_number: 1, weight: 80, reps_completed: 5, logged_at: '2026-10-28T10:00:00Z' }
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
const tick = () => new Promise(resolve => setImmediate(resolve))

export function readerFixture(t, { tracked = true, initialLogs = [row], currentWeek = week } = {}) {
  const original = supabase.from
  const storage = globalThis.localStorage
  t.after(() => { supabase.from = original; if (storage === undefined) delete globalThis.localStorage; else globalThis.localStorage = storage })
  // Only an in-memory, empty local store. A service read cannot write a set.
  const storageReads = [], writes = [], requests = [], notices = [], statuses = []
  globalThis.localStorage = { getItem(key) { storageReads.push(key); return null },
    setItem(...args) { writes.push(args) }, removeItem(...args) { writes.push(args) } }
  let reply = Promise.resolve({ data: [], error: null })
  supabase.from = table => {
    const calls = [['from', table]]; requests.push(calls)
    const query = new Proxy({}, { get(_, key) {
      if (key === 'then') return (a, b) => reply.then(a, b)
      assert.ok(['select', 'eq', 'in'].includes(key), 'read-only query boundary: ' + String(key))
      return (...args) => { calls.push([key, ...args]); return query }
    } })
    return query
  }
  const state = { exerciseLogs: initialLogs, logInputs: { 'synthetic-lift_2': { weight: '82.5', reps: '4', rpe: '7' } }, status: null }
  const set = key => value => { state[key] = typeof value === 'function' ? value(state[key]) : value }
  const mountedRef = { current: true }
  const exerciseLogsReadRef = { current: { enabled: true, request: 0, athleteId: 'synthetic-athlete', weekId: currentWeek?.id } }
  const options = { mountedRef, setExerciseLogs: set('exerciseLogs'), setLogInputs: set('logInputs'),
    onReadError: (label, id) => error => notices.push({ label, id, error }), setUgensLogsHentet: set('weekRead'),
    ...(tracked ? { exerciseLogsReadRef, setExerciseLogsStatus(value) { state.status = value; statuses.push(value) } } : {}) }
  const reader = lavLaesninger(options)
  return { state, options, reader, mountedRef, exerciseLogsReadRef, requests, notices, statuses, storageReads, writes,
    reply(value) { reply = Promise.resolve(value) }, reject(error) { reply = Promise.reject(error) },
    wait(job) { reply = job.promise }, read(w = currentWeek) { return reader.fetchExerciseLogs('synthetic-athlete', w) } }
}

test('actual host reader exposes database error, rejection, loading and confirmed empty success', async t => {
  const f = readerFixture(t), initial = f.state.exerciseLogs
  f.reply({ error: Error('synthetic failure') }); assert.equal(await f.read(), false)
  assert.equal(f.state.exerciseLogs, initial); assert.deepEqual(f.state.status,
    { athleteId: 'synthetic-athlete', weekId: week.id, loading: false, error: true })
  f.reject(Error('synthetic rejection')); assert.equal(await f.read(), false)
  assert.equal(f.notices.length, 2)
  const job = deferred(); f.wait(job); const pending = f.read()
  assert.equal(f.state.status.loading, true); assert.equal(f.state.status.error, false)
  job.resolve({ data: [], error: null }); assert.equal(await pending, true)
  assert.deepEqual(f.state.exerciseLogs, []); assert.equal(f.state.status.loading, false); assert.equal(f.state.status.error, false)
  assert.equal(f.state.logInputs['synthetic-lift_2'].weight, '82.5')
  assert.deepEqual(f.requests[0], [['from', 'exercise_logs'], ['select', '*'], ['eq', 'athlete_id', 'synthetic-athlete'], ['in', 'exercise_id', ['synthetic-lift']]])
  assert.deepEqual(f.writes, [])
  assert.deepEqual([...new Set(f.storageReads)], ['entropi_offline_sets:synthetic-athlete'])
})

test('actual reader and native fold complete failure -> retry -> confirmed sets without changing drafts', async t => {
  const f = readerFixture(t), root = historyTestDom(), now = Date.parse('2026-11-04T12:00:00Z')
  f.reply({ error: Error('synthetic failure') }); await f.read()
  const read = () => sessionHistoryProps({ athleteId: 'synthetic-athlete', exerciseLogs: f.state.exerciseLogs,
    exerciseLogsError: f.state.status.error, exerciseLogsLoading: f.state.status.loading, onRetryExerciseLogs: () => f.read() },
    week.sessions[0].exercises[0], now)
  const stop = mountExerciseHistory(root, { detail: 'reader-retry', read, active: () => true, open: true })
  const before = structuredClone(f.state.logInputs)
  assert.match(root.textContent, /Historikken kunne ikke vises/)
  const job = deferred(); f.wait(job); root.querySelector('button').click()
  assert.match(root.textContent, /Historikken hentes/)
  job.resolve({ data: [{ ...row, weight: 85 }], error: null }); await tick()
  assert.match(root.textContent, /85 kg/); assert.doesNotMatch(root.textContent, /Hent igen|kunne ikke vises/)
  assert.deepEqual(f.state.logInputs['synthetic-lift_2'], before['synthetic-lift_2']); assert.deepEqual(f.writes, [])
  assert.equal(root.ownerDocument.activeElement, root.querySelector('h2')); stop()
})

test('late success or rejection after athlete/week change, OFF or unmount cannot publish state', async t => {
  for (const change of ['athleteId', 'weekId', 'off', 'unmount']) for (const failure of [false, true]) {
    const f = readerFixture(t), job = deferred(); f.wait(job); const pending = f.read()
    if (change === 'off') f.exerciseLogsReadRef.current.enabled = false
    else if (change === 'unmount') f.mountedRef.current = false
    else f.exerciseLogsReadRef.current[change] = 'synthetic-other'
    const count = f.statuses.length, logs = f.state.exerciseLogs
    if (failure) job.reject(Error('late synthetic failure')); else job.resolve({ data: [], error: null })
    assert.equal(await pending, false); assert.equal(f.state.exerciseLogs, logs)
    assert.equal(f.statuses.length, count); assert.deepEqual(f.notices, []); assert.deepEqual(f.writes, [])
  }
})

test('newest request wins and stale retained reader cannot invalidate it', async t => {
  const f = readerFixture(t), first = deferred(), second = deferred()
  f.wait(first); const old = f.read(); f.wait(second); const fresh = f.read()
  assert.equal(await f.read({ ...week, id: 'obsolete-week' }), false)
  assert.equal(f.requests.length, 2)
  second.resolve({ data: [{ ...row, weight: 90 }], error: null }); assert.equal(await fresh, true)
  first.resolve({ data: [{ ...row, weight: 70 }], error: null }); assert.equal(await old, false)
  assert.equal(f.state.exerciseLogs[0].weight, 90); assert.equal(f.state.status.error, false)
})

test('no week preserves rows; confirmed empty week clears failure without service access; OFF preserves original contract', async t => {
  const f = readerFixture(t)
  assert.equal(await f.read(null), false); assert.equal(f.requests.length, 0)
  assert.equal(await f.read({ id: week.id, sessions: [] }), true)
  assert.deepEqual(f.state.exerciseLogs, []); assert.equal(f.state.status.error, false); assert.equal(f.requests.length, 0)
  const legacy = readerFixture(t, { tracked: false })
  legacy.reply({ data: [row], error: null }); assert.equal(await legacy.read(), undefined)
  assert.equal(legacy.state.exerciseLogs[0].weight, 80); assert.deepEqual(legacy.statuses, [])
  legacy.reply({ error: Error('synthetic legacy error') }); assert.equal(await legacy.read(), undefined)
  assert.equal(legacy.state.exerciseLogs[0].weight, 80); assert.deepEqual(legacy.statuses, [])
})
