import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyResults } from './athleteMeetModel.mjs'
import { clearDraft, draftKey, loadDraft, saveDraft } from './athleteMeetDraft.mjs'
import { memoryStorage } from '../../checkin/syntheticReact.mjs'

const key = draftKey('synthetic-athlete', 'synthetic-meet', 'v1'), fingerprint = 'synthetic-plan'

test('keys separate athletes, meets and revisions and reject ambiguous identity encoding', () => {
  for (const values of [['other', 'synthetic-meet', 'v1'], ['synthetic-athlete', 'other', 'v1'], ['synthetic-athlete', 'synthetic-meet', 'v2']])
    assert.notEqual(draftKey(...values), key)
  assert.notEqual(draftKey('a:b', 'c', 'v1'), draftKey('a', 'b:c', 'v1'))
  for (const bad of ['', ' ', null, 1, 'x'.repeat(129), '\uD800'])
    for (let index = 0; index < 3; index++) {
      const values = ['a', 'b', 'c']; values[index] = bad; assert.equal(draftKey(...values), null)
    }
})

test('storage round trip strips unknown fields, reads do not write and clearing preserves other namespaces', () => {
  const storage = memoryStorage(), results = emptyResults()
  results.squat = ['good', 'miss', 'pending']; results.extra = 'ignored'
  assert.equal(saveDraft(key, fingerprint, results, storage), true)
  const loaded = loadDraft(key, fingerprint, storage)
  assert.deepEqual(loaded, { status: 'saved', results: { ...emptyResults(), squat: ['good', 'miss', 'pending'] } })
  loaded.results.squat[0] = 'miss'
  assert.equal(loadDraft(key, fingerprint, storage).results.squat[0], 'good')
  const other = draftKey('other', 'synthetic-meet', 'v1')
  saveDraft(other, fingerprint, emptyResults(), storage)
  assert.equal(clearDraft(key, storage), true)
  assert.equal(loadDraft(key, fingerprint, storage).status, 'empty')
  assert.equal(storage.data.get('unrelated-key'), 'preserved')
  assert.equal(loadDraft(other, fingerprint, storage).status, 'saved')
  assert.ok(storage.calls.every(([, used]) => used === key || used === other))
})

test('every exported storage helper refuses foreign, malformed and noncanonical keys before IO', () => {
  const storage = memoryStorage()
  for (const bad of [null, '', 'unrelated-key', 'entropi2:staevne:atlet:v1:a:b',
    'entropi2:staevne:atlet:v1:%61:b:c', 'entropi2:staevne:atlet:v1:%ZZ:b:c',
    'entropi2:staevne:atlet:v1:a:b:c:d', 'entropi2:staevne:atlet:v1::b:c']) {
    assert.equal(loadDraft(bad, fingerprint, storage).status, 'unavailable')
    assert.equal(saveDraft(bad, fingerprint, emptyResults(), storage), false)
    assert.equal(clearDraft(bad, storage), false)
  }
  for (const bad of [null, '', 'x'.repeat(20001)]) {
    assert.equal(loadDraft(key, bad, storage).status, 'unavailable')
    assert.equal(saveDraft(key, bad, emptyResults(), storage), false)
  }
  assert.equal(saveDraft(key, fingerprint, {}, storage), false)
  assert.deepEqual(storage.calls, [])
})

test('changed plan, corrupt JSON, unsupported version and malformed outcomes are never silently reused or overwritten', () => {
  const storage = memoryStorage(), results = emptyResults(); results.squat[0] = 'good'
  saveDraft(key, fingerprint, results, storage)
  const saved = storage.data.get(key)
  assert.deepEqual(loadDraft(key, 'changed-plan', storage), { status: 'changed', results: emptyResults() })
  assert.equal(storage.data.get(key), saved)
  for (const raw of ['{', 'null', '[]', 'x'.repeat(50001), JSON.stringify({ version: 2, plan: fingerprint, results }),
    JSON.stringify({ version: 1, plan: fingerprint, results: {} }), JSON.stringify({ version: 1, results })]) {
    storage.data.set(key, raw)
    assert.deepEqual(loadDraft(key, fingerprint, storage), { status: 'unavailable', results: emptyResults() })
    assert.equal(storage.data.get(key), raw)
  }
  assert.equal(storage.calls.filter(([op]) => op === 'set').length, 1)
})

test('denied storage getters, reads, quota and deletion errors stay contained with no fallback', () => {
  const denied = { getItem() { throw Error('synthetic read') }, setItem() { throw Error('synthetic quota') }, removeItem() { throw Error('synthetic removal') } }
  for (const storage of [null, {}, denied]) {
    assert.equal(loadDraft(key, fingerprint, storage).status, 'unavailable')
    assert.equal(saveDraft(key, fingerprint, emptyResults(), storage), false)
    assert.equal(clearDraft(key, storage), false)
  }
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw Error('synthetic getter') } })
  try {
    assert.equal(loadDraft(key, fingerprint).status, 'unavailable')
    assert.equal(saveDraft(key, fingerprint, emptyResults()), false)
    assert.equal(clearDraft(key), false)
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor)
    else delete globalThis.localStorage
  }
})
