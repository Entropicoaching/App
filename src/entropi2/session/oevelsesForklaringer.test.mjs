import test from 'node:test'
import assert from 'node:assert/strict'
import * as data from './oevelsesForklaringer.mjs'

const { oevelsesForklaringer } = data

function tekst(value, maxLength) {
  assert.equal(typeof value, 'string')
  assert.ok(value.trim().length > 0)
  assert.equal(value, value.trim())
  assert.ok(value.length <= maxLength, `For lang tekst: ${value}`)
  assert.equal(value, value.normalize('NFC'))
  assert.doesNotMatch(value, /[\u0000-\u001f\u007f\ufffd<>]/u)
}

test('data-only ESM export contains exactly 25 distinct exercise explanations', () => {
  assert.deepEqual(Object.keys(data), ['oevelsesForklaringer'])
  assert.ok(Array.isArray(oevelsesForklaringer))
  assert.equal(oevelsesForklaringer.length, 25)
  assert.deepEqual(JSON.parse(JSON.stringify(oevelsesForklaringer)), oevelsesForklaringer)
  assert.equal(new Set(oevelsesForklaringer.map(item => item.id)).size, 25)
  assert.equal(new Set(oevelsesForklaringer.map(item => item.name.toLocaleLowerCase('da-DK'))).size, 25)
})

test('every entry has short execution text, exactly three technical cues and common mistakes', () => {
  for (const item of oevelsesForklaringer) {
    assert.deepEqual(Object.keys(item).sort(), ['almindeligeFejl', 'fokuspunkter', 'id', 'name', 'udfoerelse'])
    assert.match(item.id, /^[a-z]+(?:-[a-z]+)*$/)
    tekst(item.name, 80)
    tekst(item.udfoerelse, 350)
    assert.ok(Array.isArray(item.fokuspunkter))
    assert.equal(item.fokuspunkter.length, 3, item.id)
    assert.ok(Array.isArray(item.almindeligeFejl))
    assert.ok(item.almindeligeFejl.length > 0, item.id)
    for (const values of [item.fokuspunkter, item.almindeligeFejl]) {
      assert.equal(new Set(values).size, values.length, item.id)
      for (const value of values) tekst(value, 180)
    }
  }
})

test('current editorial content contains no numerical exercise prescriptions requiring a source', () => {
  // Counts in the format contract are not training prescriptions. If numerical
  // training guidance is added later, introduce named sources and update this gate.
  for (const item of oevelsesForklaringer) {
    const content = [item.name, item.udfoerelse, ...item.fokuspunkter, ...item.almindeligeFejl].join(' ')
    assert.doesNotMatch(content, /\p{Number}|\b(?:grader|procent|sekunder|minutter|centimeter|kilogram|reps|gentagelser)\b/iu, item.id)
  }
})
