import { test } from 'node:test'
import assert from 'node:assert/strict'
import { saveOfflineSet, loadOfflineSets, clearOfflineSet, countOfflineSets } from './offlineSetQueue.js'

// In-memory fake af localStorage's API-flade — samme mønster som restPause.test.js.
function fakeStorage() {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)) },
    removeItem: (k) => { map.delete(k) },
  }
}

test('saveOfflineSet gemmer et sæt, loadOfflineSets henter det igen', () => {
  const storage = fakeStorage()
  const before = Date.now()
  assert.equal(saveOfflineSet('athlete-1', 'ex1_1', { exerciseId: 'ex1', setNumber: 1, payload: { weight: 80, reps_completed: 5 } }, storage), true)
  const queue = loadOfflineSets('athlete-1', storage)
  assert.equal(queue.ex1_1.exerciseId, 'ex1')
  assert.equal(queue.ex1_1.payload.weight, 80)
  assert.ok(queue.ex1_1.queuedAt >= before)
})

test('flere ventende sæt lever side om side, hver på sin nøgle', () => {
  const storage = fakeStorage()
  saveOfflineSet('athlete-1', 'ex1_1', { exerciseId: 'ex1', setNumber: 1, payload: { weight: 80 } }, storage)
  saveOfflineSet('athlete-1', 'ex1_2', { exerciseId: 'ex1', setNumber: 2, payload: { weight: 82.5 } }, storage)
  assert.equal(countOfflineSets('athlete-1', storage), 2)
})

test('clearOfflineSet fjerner kun det ene sæt', () => {
  const storage = fakeStorage()
  saveOfflineSet('athlete-1', 'ex1_1', { exerciseId: 'ex1', setNumber: 1, payload: { weight: 80 } }, storage)
  saveOfflineSet('athlete-1', 'ex1_2', { exerciseId: 'ex1', setNumber: 2, payload: { weight: 82.5 } }, storage)
  clearOfflineSet('athlete-1', 'ex1_1', storage)
  const queue = loadOfflineSets('athlete-1', storage)
  assert.equal(queue.ex1_1, undefined)
  assert.equal(queue.ex1_2.payload.weight, 82.5)
  assert.equal(countOfflineSets('athlete-1', storage), 1)
})

test('ventende sæt er pr. atlet — ingen krydssmitte', () => {
  const storage = fakeStorage()
  saveOfflineSet('athlete-1', 'ex1_1', { exerciseId: 'ex1', setNumber: 1, payload: { weight: 80 } }, storage)
  assert.equal(countOfflineSets('athlete-2', storage), 0)
})

test('loadOfflineSets uden gemt kø giver et tomt objekt', () => {
  assert.deepEqual(loadOfflineSets('athlete-1', fakeStorage()), {})
})

test('loadOfflineSets på korrupt JSON giver et tomt objekt i stedet for at kaste', () => {
  const storage = fakeStorage()
  storage.setItem('entropi_offline_sets:athlete-1', '{ikke json')
  assert.deepEqual(loadOfflineSets('athlete-1', storage), {})
})

test('en fejlende storage (fx privat vindue) vælter ikke', () => {
  const throwingStorage = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') }, removeItem: () => { throw new Error('blocked') } }
  assert.equal(saveOfflineSet('athlete-1', 'ex1_1', { exerciseId: 'ex1', setNumber: 1, payload: {} }, throwingStorage), false)
  assert.deepEqual(loadOfflineSets('athlete-1', throwingStorage), {})
  assert.doesNotThrow(() => clearOfflineSet('athlete-1', 'ex1_1', throwingStorage))
  assert.equal(countOfflineSets('athlete-1', throwingStorage), 0)
})

// ORDRE 456 (A3): vurderinger af passet i en lokal kø.
test('saveQueuedRating/clearQueuedRatingIfSame: nyeste vurdering vinder, og kun den sendte ryddes', async () => {
  const { saveQueuedRating, loadQueuedRatings, clearQueuedRatingIfSame } = await import('./offlineSetQueue.js')
  const storage = fakeStorage()
  assert.equal(saveQueuedRating('a1', 's1', { rating: 4 }, storage), true)
  assert.equal(saveQueuedRating('a1', 's1', { rating: 3, comment: 'tung' }, storage), true)
  assert.deepEqual({ rating: loadQueuedRatings('a1', storage).s1.rating, comment: loadQueuedRatings('a1', storage).s1.comment }, { rating: 3, comment: 'tung' })
  clearQueuedRatingIfSame('a1', 's1', { rating: 4, comment: null }, storage)
  assert.equal(loadQueuedRatings('a1', storage).s1.rating, 3, 'en ældre afsendelse må ikke rydde den nyere vurdering')
  clearQueuedRatingIfSame('a1', 's1', { rating: 3, comment: 'tung' }, storage)
  assert.deepEqual(loadQueuedRatings('a1', storage), {})
  assert.equal(saveQueuedRating('a1', 's1', { rating: null }, storage), false)
})

test('overlayQueuedRatings lægger ventende vurderinger på ugens pas', async () => {
  const { overlayQueuedRatings } = await import('./offlineSetQueue.js')
  const weeks = [{ id: 'w', sessions: [{ id: 's1', athlete_rating: null }, { id: 's2', athlete_rating: 5 }] }]
  const ud = overlayQueuedRatings(weeks, { s1: { rating: 4, comment: null } })
  assert.equal(ud[0].sessions[0].athlete_rating, 4)
  assert.equal(ud[0].sessions[1].athlete_rating, 5)
  assert.equal(overlayQueuedRatings(weeks, {}), weeks)
})

// ORDRE 456 (A5): rekord-rækker, der venter på personal_records.
test('saveQueuedRecord: én post pr. (øvelse, vægt, reps), clearQueuedRecord fjerner den', async () => {
  const { saveQueuedRecord, loadQueuedRecords, clearQueuedRecord, recordKey } = await import('./offlineSetQueue.js')
  const storage = fakeStorage()
  const pr = { exercise_name: 'Bænkpres', weight: 70, reps: 8 }
  assert.equal(saveQueuedRecord('a1', pr, storage), true)
  assert.equal(saveQueuedRecord('a1', { ...pr, exercise_name: 'bænkpres ' }, storage), true)
  assert.equal(Object.keys(loadQueuedRecords('a1', storage)).length, 1, 'samme rekord to gange er én post')
  assert.equal(saveQueuedRecord('a1', { exercise_name: 'Planke', weight: 0, reps: 1 }, storage), false)
  clearQueuedRecord('a1', recordKey(pr), storage)
  assert.deepEqual(loadQueuedRecords('a1', storage), {})
})
