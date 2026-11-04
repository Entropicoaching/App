import test from 'node:test'
import assert from 'node:assert/strict'
import { saveSessionSet, sessionStorage } from './sessionSetSave.mjs'
import { loadOfflineSets } from '../../offlineSetQueue.js'
import { markNetworkSuccess } from '../../offlineSession.js'

function fixture(extra = {}) {
  const values = new Map(), reads = [], writes = [], confirmed = [], sent = []
  const storage = { getItem(k) { reads.push(k); return values.get(k) ?? null },
    setItem(k, v) { writes.push(k); values.set(k, v) } }
  const args = { athleteId: 'synthetic-a', exerciseId: 'lift', setNumber: 1,
    payload: { weight: 82.5, reps_completed: 5, rpe_actual: null, note: 'Teknik', logged_at: '2026-11-04T12:00:00Z' },
    storage, offline: () => false, confirm: row => confirmed.push(row),
    send(...args) { sent.push(args); return Promise.resolve({ data: { id: args[5] }, error: null }) }, ...extra }
  return { args, storage, values, reads, writes, confirmed, sent }
}

test('offline/reload retains athlete namespace, original time, values and id; only reply confirms', async () => {
  const f = fixture({ offline: () => true })
  assert.equal((await saveSessionSet(f.args)).phase, 'queued')
  assert.deepEqual(f.confirmed, []); assert.deepEqual(f.sent, [])
  const first = loadOfflineSets('synthetic-a', f.storage).lift_1
  assert.equal(first.payload.note, 'Teknik'); assert.equal(first.payload.rpe_actual, null)
  f.args.offline = () => false
  f.args.payload = { ...f.args.payload, logged_at: '2026-11-05T12:00:00Z' }
  assert.equal((await saveSessionSet(f.args)).phase, 'saved')
  assert.equal(f.sent[0][5], first.clientId)
  assert.equal(f.sent[0][3].logged_at, first.payload.logged_at)
  assert.equal(f.confirmed[0]._optimistic, false)
  assert.deepEqual(loadOfflineSets('synthetic-a', f.storage), {})
  assert.ok([...f.reads, ...f.writes].every(k => k === 'entropi_offline_sets:synthetic-a'))
})

test('pending request, dropped reply and retry produce no optimistic saved row or duplicate id', async () => {
  let reply
  const f = fixture({ send: () => new Promise(r => { reply = r }) })
  const pending = saveSessionSet(f.args)
  assert.deepEqual(f.confirmed, [])
  const first = loadOfflineSets('synthetic-a', f.storage).lift_1
  reply({ error: { message: 'Failed to fetch' } })
  assert.equal((await pending).phase, 'queued')
  const ids = new Set([first.clientId])
  f.args.send = (...args) => { ids.add(args[5]); return { data: { id: args[5] }, error: null } }
  assert.equal((await saveSessionSet(f.args)).phase, 'saved')
  assert.equal(ids.size, 1)
})

test('throwing storage getter, full storage and read failures stay honest and do not escape', async t => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw Error('blocked') } })
  t.after(() => { if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor); else delete globalThis.localStorage })
  assert.equal(sessionStorage(), null)
  for (const storage of [null, { getItem() { throw Error('blocked') }, setItem() { throw Error('full') } }]) {
    const f = fixture({ storage, offline: () => true })
    assert.deepEqual(await saveSessionSet(f.args), { phase: 'error', storageFailed: true })
    assert.deepEqual(f.confirmed, []); assert.deepEqual(f.sent, [])
    f.args.offline = () => false
    assert.equal((await saveSessionSet(f.args)).phase, 'saved', 'online save still possible without storage')
  }
})

test('server refusal parks visibly; rejected promise retains durable queue; empty result is never saved', async () => {
  for (const send of [() => { throw new TypeError('network') }, () => Promise.reject(new TypeError('network')), () => ({ data: null, error: null })]) {
    const f = fixture({ send })
    assert.equal((await saveSessionSet(f.args)).phase, 'queued')
    assert.equal(f.confirmed.length, 0)
    assert.ok(loadOfflineSets('synthetic-a', f.storage).lift_1)
  }
  const f = fixture({ send: () => ({ error: { code: '42501', message: 'forbidden' } }) })
  assert.equal((await saveSessionSet(f.args)).phase, 'parked')
  assert.equal(f.confirmed.length, 0)
  assert.ok(f.values.has('entropi_offline_sets_parkeret:synthetic-a'))
})

test('slow response keeps durable queue until late server acknowledgment, then confirms once', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let reply
  const f = fixture({ send: () => new Promise(r => { reply = r }) })
  const pending = saveSessionSet(f.args)
  t.mock.timers.tick(8001)
  assert.equal((await pending).phase, 'queued')
  assert.equal(f.confirmed.length, 0)
  const entry = loadOfflineSets('synthetic-a', f.storage).lift_1
  reply({ data: { id: entry.clientId }, error: null })
  await Promise.resolve(); await Promise.resolve()
  assert.equal(f.confirmed.length, 1)
  assert.deepEqual(loadOfflineSets('synthetic-a', f.storage), {})
  markNetworkSuccess()
})

test('new approval cannot overtake an older queued set or undo tombstone', async () => {
  const f = fixture({ offline: () => true })
  await saveSessionSet(f.args)
  const first = loadOfflineSets('synthetic-a', f.storage).lift_1
  f.args.setNumber = 2; f.args.offline = () => false
  assert.equal((await saveSessionSet(f.args)).phase, 'queued')
  assert.equal(f.sent.length, 0)
  assert.equal(loadOfflineSets('synthetic-a', f.storage).lift_1.clientId, first.clientId)
})

test('stored or caller payload cannot override athlete, exercise, set or row identity', async () => {
  const f = fixture()
  f.args.payload = { ...f.args.payload, athlete_id: 'synthetic-other', exercise_id: 'other-lift', set_number: 99, id: 'other-row' }
  assert.equal((await saveSessionSet(f.args)).phase, 'saved')
  for (const key of ['athlete_id', 'exercise_id', 'set_number', 'id']) assert.equal(Object.hasOwn(f.sent[0][3], key), false)
  assert.equal(f.confirmed[0].athlete_id, 'synthetic-a')
  assert.equal(f.confirmed[0].exercise_id, 'lift')
  assert.equal(f.confirmed[0].set_number, 1)
})
