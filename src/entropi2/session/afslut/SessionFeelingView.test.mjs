import test from 'node:test'
import assert from 'node:assert/strict'
import SessionFeeling from './SessionFeelingView.mjs'
import { createSessionFeeling } from './sessionFeelingDom.mjs'

test('both rating views stay hidden before reading fields, document or callbacks', () => {
  let calls = 0
  const poison = { get value() { assert.fail('read draft') }, get scope() { assert.fail('read scope') },
    onChange() { calls++ }, onComplete() { calls++ } }
  const doc = new Proxy({}, { get() { assert.fail('touched document') } })
  for (const enabled of [undefined, false, true, 'true', 1]) {
    assert.equal(SessionFeeling(Object.create(poison, { enabled: { value: enabled } })), null)
    assert.equal(createSessionFeeling(doc, poison), null)
  }
  assert.equal(SessionFeeling(), null)
  assert.equal(createSessionFeeling(doc), null)
  assert.equal(calls, 0)
})
