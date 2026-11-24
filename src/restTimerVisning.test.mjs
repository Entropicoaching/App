// Ordre 2033f: atletens valg om at skjule pausetimeren huskes pr. atlet, og fejl i lageret sluges.
import test from 'node:test'
import assert from 'node:assert/strict'
import { isRestTimerHidden, setRestTimerHidden } from './restTimerVisning.js'

const fakeStorage = () => {
  const map = new Map()
  return { getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k), map }
}

test('standard er vist; valget huskes pr. atlet og kan slaas til igen', () => {
  const storage = fakeStorage()
  assert.equal(isRestTimerHidden('a', storage), false)
  assert.equal(setRestTimerHidden('a', true, storage), true)
  assert.equal(isRestTimerHidden('a', storage), true)
  assert.equal(isRestTimerHidden('b', storage), false, 'en anden atlet paa samme telefon beholder timeren')
  assert.deepEqual([...storage.map.keys()], ['entropi_rest_timer_skjult:a'])
  assert.equal(setRestTimerHidden('a', false, storage), true)
  assert.equal(isRestTimerHidden('a', storage), false)
  assert.equal(storage.map.size, 0, 'standard efterlader ingen noegle')
})

test('uden atlet, uden lager eller med et lager der kaster, er timeren vist og intet gemmes', () => {
  assert.equal(isRestTimerHidden(undefined, fakeStorage()), false)
  assert.equal(setRestTimerHidden(undefined, true, fakeStorage()), false)
  assert.equal(isRestTimerHidden('a', null), false)
  assert.equal(setRestTimerHidden('a', true, null), false)
  const broken = { getItem() { throw new Error('privat tilstand') }, setItem() { throw new Error('fuldt') }, removeItem() { throw new Error('fuldt') } }
  assert.equal(isRestTimerHidden('a', broken), false)
  assert.equal(setRestTimerHidden('a', true, broken), false)
  assert.equal(setRestTimerHidden('a', false, broken), false)
})
