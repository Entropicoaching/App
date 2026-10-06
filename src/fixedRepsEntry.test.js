import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixedRepsEntry } from './fixedRepsEntry.js'
import { autoFillSetInput } from './setLogDefaults.js'

test('numeric plans provide an editable default, including zero', () => {
  assert.equal(fixedRepsEntry('8'), '8')
  assert.equal(fixedRepsEntry(' 8 '), '8')
  assert.equal(fixedRepsEntry(8), '8')
  assert.equal(fixedRepsEntry('0'), '0')
})

test('text, time, range and missing plans stay outside numeric fixed entry', () => {
  for (const reps of ['AMRAP', '8 pr. side', '30 sek', '4-6', 'frit', '', null, undefined]) {
    assert.equal(fixedRepsEntry(reps), null)
  }
})

test('next fixed set defaults to plan despite fewer reps on the preceding set', () => {
  const next = autoFillSetInput({ current: { weight: '80', reps: '' },
    lastAuto: { weight: '80', reps: '' }, touched: false,
    weightDefault: '80', repsDefault: fixedRepsEntry('8') })
  assert.equal(next.reps, '8')
})

test('explicit zero and fewer actual reps survive automatic input filling', () => {
  for (const reps of ['0', '3']) {
    assert.equal(autoFillSetInput({ current: { weight: '80', reps }, touched: true,
      weightDefault: '80', repsDefault: fixedRepsEntry('8') }), null)
  }
})
