import { test } from 'node:test'
import assert from 'node:assert/strict'
import { startRestPause, loadRestPause, clearRestPause } from './restPause.js'

// In-memory fake af localStorage's API-flade — samme mønster som
// readinessDraft.test.js/warmupOverride.test.js.
function fakeStorage() {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)) },
    removeItem: (k) => { map.delete(k) },
  }
}

test('startRestPause gemmer starttidspunkt + varighed, loadRestPause henter dem igen', () => {
  const storage = fakeStorage()
  const before = Date.now()
  assert.equal(startRestPause('athlete-1', 90, 'Squat', storage), true)
  const loaded = loadRestPause('athlete-1', storage)
  assert.ok(loaded)
  assert.equal(loaded.durationSeconds, 90)
  assert.equal(loaded.label, 'Squat')
  assert.ok(loaded.startedAt >= before)
})

test('en ny pause overskriver den forrige (kun én aktiv pause pr. atlet)', () => {
  const storage = fakeStorage()
  startRestPause('athlete-1', 90, 'Squat', storage)
  startRestPause('athlete-1', 60, 'Bænkpres', storage)
  const loaded = loadRestPause('athlete-1', storage)
  assert.equal(loaded.durationSeconds, 60)
  assert.equal(loaded.label, 'Bænkpres')
})

test('clearRestPause fjerner den gemte pause', () => {
  const storage = fakeStorage()
  startRestPause('athlete-1', 90, null, storage)
  clearRestPause('athlete-1', storage)
  assert.equal(loadRestPause('athlete-1', storage), null)
})

test('pauser er pr. atlet — ingen krydssmitte', () => {
  const storage = fakeStorage()
  startRestPause('athlete-1', 90, null, storage)
  assert.equal(loadRestPause('athlete-2', storage), null)
})

test('loadRestPause uden gemt pause giver null', () => {
  assert.equal(loadRestPause('athlete-1', fakeStorage()), null)
})

test('loadRestPause på korrupt/ufuldstændig JSON giver null i stedet for at kaste', () => {
  const storage = fakeStorage()
  storage.setItem('entropi_rest_pause:athlete-1', '{ikke json')
  assert.equal(loadRestPause('athlete-1', storage), null)
  storage.setItem('entropi_rest_pause:athlete-1', JSON.stringify({ label: 'Squat' })) // mangler startedAt/durationSeconds
  assert.equal(loadRestPause('athlete-1', storage), null)
})

test('en fejlende storage (fx privat vindue) vælter ikke', () => {
  const throwingStorage = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') }, removeItem: () => { throw new Error('blocked') } }
  assert.equal(startRestPause('athlete-1', 90, null, throwingStorage), false)
  assert.equal(loadRestPause('athlete-1', throwingStorage), null)
  assert.doesNotThrow(() => clearRestPause('athlete-1', throwingStorage))
})
