import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { supabase } from '../appRev2Fakes.mjs'
import { navnForOevelse, ugensSaet } from './rekorder.js'

// Import the actual reader. Only the service boundary is synthetic, as in appRev2.
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
test.after(() => hooks.deregister())

test('F6: no current program yields no current sets or invented names', () => {
  for (const week of [null, undefined]) for (const weeks of [[], null, undefined, [null, undefined]]) {
    assert.deepEqual(ugensSaet([], week, weeks), [])
    assert.deepEqual(ugensSaet([{ exercise_id: 'synthetic-orphan', set_number: 1 }], week, weeks), [])
  }
  const week = { sessions: [{ exercises: [{ id: 'synthetic-exercise', name: 'Squat' }] }] }
  assert.deepEqual([...navnForOevelse([null, week, undefined])], [['synthetic-exercise', 'Squat']])
  assert.equal(ugensSaet([{ exercise_id: 'synthetic-exercise', set_number: 1 }], week, [])[0].navn, 'Squat')
})

function fixture(t, initialLogs = []) {
  const original = supabase.from
  t.after(() => { supabase.from = original })
  let reply, rejected
  const reads = [], notices = [], events = []
  const state = { volumeLogs: initialLogs, volumeLoading: false, volumeError: false }
  supabase.from = table => {
    assert.equal(table, 'exercise_logs')
    const query = new Proxy({}, { get(_, key) {
      if (key === 'then') return (resolve, reject) =>
        (rejected ? Promise.reject(rejected) : Promise.resolve(reply)).then(resolve, reject)
      assert.ok(['select', 'eq', 'gte', 'order', 'limit'].includes(key), `Unexpected capability: ${String(key)}`)
      return (...args) => { reads.push([key, ...args]); return query }
    } })
    return query
  }
  const setter = key => value => { state[key] = value; events.push([key, value]) }
  const handlers = lavLaesninger({
    setVolumeLogs: setter('volumeLogs'), setVolumeLoading: setter('volumeLoading'), setVolumeError: setter('volumeError'),
    onReadError: (label, id) => error => notices.push({ label, id, error }),
  })
  return { state, events, reads, notices, async read(next, rejection) {
    reply = next; rejected = rejection
    await handlers.fetchVolumeLogs('synthetic-athlete')
  } }
}

test('F4: failed first read explicitly marks error, keeps logs, and ends loading', async t => {
  const f = fixture(t), error = { message: 'synthetic failure' }
  await f.read({ data: null, error })
  assert.deepEqual(f.state, { volumeLogs: [], volumeLoading: false, volumeError: true })
  assert.deepEqual(f.notices, [{ label: 'Din volumen', id: 'synthetic-athlete', error }])
  assert.ok(f.reads.some(([key, column, value]) => key === 'eq' && column === 'athlete_id' && value === 'synthetic-athlete'))
})

test('F4: rejected read also ends loading and exposes an honest error', async t => {
  const f = fixture(t), error = Error('synthetic rejection')
  await f.read(undefined, error)
  assert.equal(f.state.volumeError, true)
  assert.equal(f.state.volumeLoading, false)
  assert.equal(f.notices[0].error, error)
})

test('F4: retry clears error, shows loading, then accepts genuine empty success', async t => {
  const f = fixture(t)
  await f.read({ data: null, error: { message: 'synthetic failure' } })
  f.events.length = 0
  await f.read({ data: [], error: null })
  assert.deepEqual(f.events.slice(0, 2), [['volumeLoading', true], ['volumeError', false]])
  assert.deepEqual(f.state, { volumeLogs: [], volumeLoading: false, volumeError: false })
  assert.equal(f.notices.length, 1)
})

test('F4: refresh failure preserves known rows; successful retry replaces them', async t => {
  const old = [{ exercises: { name: 'Squat' }, logged_at: '2026-11-03' }]
  const fresh = [{ exercises: { name: 'Squat' }, logged_at: '2026-11-04' }]
  const f = fixture(t, old)
  await f.read({ data: null, error: { message: 'synthetic failure' } })
  assert.equal(f.state.volumeLogs, old)
  assert.equal(f.state.volumeError, true)
  await f.read({ data: fresh, error: null })
  assert.equal(f.state.volumeLogs, fresh)
  assert.equal(f.state.volumeError, false)
  assert.equal(f.state.volumeLoading, false)
})
