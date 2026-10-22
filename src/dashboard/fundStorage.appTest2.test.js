import { test } from 'node:test'
import assert from 'node:assert/strict'
import { storageKey, emptyReview, activate, editReview, saveReview, loadReview } from './fundStorage.mjs'

// Deliberate fake: persistence contract only; fundEngine validation is tested separately.
const fakeApi = () => ({
  session: (batch, answers) => ({ batch: structuredClone(batch), answers: structuredClone(answers) }),
  encode: (batch, answers) => JSON.stringify({ batch, answers }),
  decode: text => { const v = JSON.parse(text); if (!v.batch || !Array.isArray(v.answers)) throw Error('invalid'); return v },
})
const memory = () => { const map = new Map(); return { getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) } }
const state = () => ({ batch: { synthetic: true }, answers: [], dirty: true, message: 'editing' })

test('APP-TEST2: empty state and activation are memory-only with detached validated values', () => {
  const empty = emptyReview(); assert.equal(empty.batch, null); assert.deepEqual(empty.answers, []); assert.equal(empty.dirty, false)
  const b = { synthetic: true }, next = activate(fakeApi(), b)
  assert.equal(next.dirty, true); assert.notEqual(next.batch, b)
  assert.match(next.message, /ikke gemt lokalt/)
})
test('APP-TEST2: edit replaces only exact clip/finding pair and can clear it', () => {
  const s = { ...state(), answers: [
    { clip_id: 'c1', finding_id: 'f', decision: 'enig', comment: '' },
    { clip_id: 'c2', finding_id: 'f', decision: 'enig', comment: '' },
  ] }, before = JSON.stringify(s)
  const edited = editReview(s, 'c1', 'f', 'uenig', 'reason')
  assert.equal(edited.answers.length, 2); assert.equal(edited.answers[1].decision, 'uenig')
  const cleared = editReview(edited, 'c1', 'f', '', '')
  assert.deepEqual(cleared.answers.map(a => a.clip_id), ['c2']); assert.equal(cleared.dirty, true)
  assert.equal(JSON.stringify(s), before)
})
test('APP-TEST2: successful save reads back exact bytes before clearing dirty', () => {
  const storage = memory(), s = state(), saved = saveReview(fakeApi(), () => storage, s)
  assert.equal(saved.dirty, false); assert.equal(s.dirty, true)
  assert.equal(storage.getItem(storageKey), JSON.stringify({ batch: s.batch, answers: s.answers }))
})
test('APP-TEST2: failed encode does not acquire storage', () => {
  let calls = 0
  const s = saveReview({ encode() { throw Error('invalid') } }, () => { calls++; return memory() }, state())
  assert.equal(calls, 0); assert.equal(s.dirty, true); assert.match(s.message, /IKKE GEMT/)
})
test('APP-TEST2: missing batch, denied storage and readback mismatch keep dirty work', () => {
  for (const [s, get] of [
    [{ ...state(), batch: null }, () => { throw Error('must not acquire') }],
    [state(), () => { throw Error('denied') }],
    [state(), () => ({ setItem() { throw Error('quota') }, getItem() { return null } })],
    [state(), () => ({ setItem() {}, getItem() { return 'different' } })],
  ]) {
    const next = saveReview(fakeApi(), get, s)
    assert.equal(next.dirty, true); assert.equal(next.batch, s.batch); assert.equal(next.answers, s.answers)
    assert.match(next.message, /IKKE GEMT/)
  }
})
test('APP-TEST2: missing, corrupt and inaccessible storage preserve current work', () => {
  for (const get of [() => memory(), () => ({ getItem: () => '{broken' }), () => { throw Error('denied') }]) {
    const s = state(), next = loadReview(fakeApi(), get, s)
    assert.equal(next.batch, s.batch); assert.equal(next.answers, s.answers); assert.equal(next.dirty, true)
  }
})
test('APP-TEST2: load validates before replacement and clears dirty only on success', () => {
  const store = memory(), api = fakeApi(), s = state()
  store.setItem(storageKey, api.encode({ restored: true }, [{ clip_id: 'c1' }]))
  const loaded = loadReview(api, () => store, s)
  assert.deepEqual(loaded.batch, { restored: true }); assert.equal(loaded.dirty, false)
  api.decode = () => { throw Error('not trusted') }
  assert.equal(loadReview(api, () => store, s).batch, s.batch)
})
