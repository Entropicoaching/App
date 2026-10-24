import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as q from './offlineSetQueue.js'
import { loadShowNextSetPreview } from './nextSetPreview.js'
import { loadOfflineSnapshot, snapshotLogsForWeek } from './athlete/offlineSnapshot.js'

function storage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: k => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, String(v)),
    removeItem: k => values.delete(k),
  }
}
const key = 'entropi_offline_sets:a'
const parkedKey = 'entropi_offline_sets_parkeret:a'
const entry = { exerciseId: 'e', setNumber: 1, clientId: 'c1', payload: { weight: 80 } }

test('F1: arrayformede og ugyldige gamle lagerdata kan erstattes holdbart', () => {
  for (const raw of ['[]', 'null', '7', '"old"', '{broken']) {
    const st = storage({ [key]: raw, [parkedKey]: raw,
      'entropi_offline_vurderinger:a': raw, 'entropi_offline_rekorder:a': raw })
    assert.equal(q.saveOfflineSet('a', 'e_1', entry, st), true)
    assert.equal(q.loadOfflineSets('a', st).e_1.payload.weight, 80)
    assert.equal(q.saveQueuedRating('a', 's', { rating: 4 }, st), true)
    assert.equal(q.loadQueuedRatings('a', st).s.rating, 4)
    assert.equal(q.saveQueuedRecord('a', { exercise_name: 'Squat', weight: 80, reps: 5 }, st), true)
    assert.equal(Object.keys(q.loadQueuedRecords('a', st)).length, 1)
    assert.equal(q.parkOfflineSet('a', 'e_1', entry, '23503', st), true)
    assert.equal(q.loadParkedSets('a', st).e_1.payload.weight, 80)
    assert.equal(q.countOfflineSets('a', st), 0)
  }
  const st = storage({ [key]: JSON.stringify({ e_1: entry, broken: null, array: [], number: 4 }),
    [parkedKey]: JSON.stringify({ broken: null }) })
  assert.deepEqual(q.orderedOfflineSets('a', st).map(([k]) => k), ['e_1'])
  assert.equal(q.countOfflineSets('a', st), 1)
  assert.deepEqual(q.loadParkedSets('a', st), {})
})

test('F2: fuldt lager ved fortryd bevarer sidste holdbare saet', () => {
  const st = storage()
  q.saveOfflineSet('a', 'e_1', entry, st)
  const before = st.getItem(key)
  const write = st.setItem
  st.setItem = (k, v) => { if (String(v).includes('"op":"delete"')) throw Error('QuotaExceededError'); return write(k, v) }
  assert.equal(q.queueUndoTombstone('a', 'e_1', { exerciseId: 'e', setNumber: 1, rowId: 'c1' }, st), null)
  assert.equal(st.getItem(key), before)
  assert.equal(q.countOfflineSets('a', st), 1)
})

test('F3: sent svar paa sletning maa ikke rydde et andet raekke-id', () => {
  const st = storage()
  const sent = { ...entry, op: 'delete', payload: null }
  q.saveOfflineSet('a', 'e_1', { ...sent, clientId: 'c2' }, st)
  q.clearOfflineSetIfSame('a', 'e_1', sent, st)
  assert.equal(q.loadOfflineSets('a', st).e_1.clientId, 'c2')
  assert.deepEqual(q.noteOfflineSetFailure('a', 'e_1', sent, '42501', {}, st), { failures: 0, newCode: false })
  q.clearOfflineSetIfSame('a', 'e_1', { ...sent, clientId: 'c2' }, st)
  assert.deepEqual(q.loadOfflineSets('a', st), {})
})

test('F4: parkering efter sent afslag bevarer nyere rettelse', async () => {
  const st = storage()
  q.saveOfflineSet('a', 'e_1', entry, st)
  const sent = q.loadOfflineSets('a', st).e_1
  let reply
  const networkFake = new Promise(resolve => { reply = resolve })
  const sync = networkFake.then(() => q.parkOfflineSet('a', 'e_1', sent, '23503', st))
  q.saveOfflineSet('a', 'e_1', { ...entry, payload: { weight: 85 } }, st)
  reply()
  assert.equal(await sync, false)
  assert.equal(q.loadOfflineSets('a', st).e_1.payload.weight, 85)
  assert.deepEqual(q.loadParkedSets('a', st), {})
  const before = st.getItem(key)
  st.setItem = () => { throw Error('QuotaExceededError') }
  assert.equal(q.parkOfflineSet('a', 'e_1', q.loadOfflineSets('a', st).e_1, '23503', st), false)
  assert.equal(st.getItem(key), before)
})

test('F5: ugyldig gammel koetid stopper ikke resten af synkrunden', () => {
  const payload = { weight: 80 }
  for (const queuedAt of ['not-a-date', 9e20]) {
    const results = [{ payload, queuedAt }, { payload, queuedAt: 1000 }].map(q.queuedPayloadWithTime)
    assert.equal(results[0], payload)
    assert.equal(results[1].logged_at, '1970-01-01T00:00:01.000Z')
  }
})

test('F6: ukendt indstillingsvaerdi bruger standarden', () => {
  for (const raw of ['garbage', '{}', 'null', 'true', '2', '']) {
    assert.equal(loadShowNextSetPreview(storage({ entropi_dagens_pas_vis_naeste_saet: raw })), true)
  }
  assert.equal(loadShowNextSetPreview(storage({ entropi_dagens_pas_vis_naeste_saet: '0' })), false)
})

test('F7: forkert JSON-form for snapshotlogs giver en brugbar tom liste', () => {
  for (const logs of [{}, 'old', 5]) {
    const st = storage({ entropi_offline_pas_u: 'unused', 'entropi_offline_pas:u': JSON.stringify({ week: { id: 'w' }, logsWeekId: 'w', logs }) })
    assert.deepEqual([...snapshotLogsForWeek(loadOfflineSnapshot('u', st))], [])
  }
  assert.equal(loadOfflineSnapshot('u', storage({ 'entropi_offline_pas:u': '[]' })), null)
})
