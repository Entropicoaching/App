import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadShowNextSetPreview, saveShowNextSetPreview } from './nextSetPreview.js'

// In-memory fake af localStorage's API-flade — samme mønster som restPause.test.js.
function fakeStorage() {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)) },
    removeItem: (k) => { map.delete(k) },
  }
}

test('loadShowNextSetPreview er true som standard (ingen gemt værdi endnu)', () => {
  assert.equal(loadShowNextSetPreview(fakeStorage()), true)
})

test('saveShowNextSetPreview(false) + loadShowNextSetPreview giver false igen', () => {
  const storage = fakeStorage()
  saveShowNextSetPreview(false, storage)
  assert.equal(loadShowNextSetPreview(storage), false)
})

test('saveShowNextSetPreview(true) efter en false overskriver korrekt', () => {
  const storage = fakeStorage()
  saveShowNextSetPreview(false, storage)
  saveShowNextSetPreview(true, storage)
  assert.equal(loadShowNextSetPreview(storage), true)
})

test('en fejlende storage (fx privat vindue) vælter ikke, og giver default true', () => {
  const throwingStorage = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
  assert.doesNotThrow(() => saveShowNextSetPreview(false, throwingStorage))
  assert.equal(loadShowNextSetPreview(throwingStorage), true)
})
