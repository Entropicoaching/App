import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseRepsPrescription } from './repsPrescription.js'

test('interval ("4-6") gør reps redigerbar pr. sæt, forudfyldt med nederste tal', () => {
  const p = parseRepsPrescription('4-6')
  assert.equal(p.type, 'range')
  assert.equal(p.min, 4)
  assert.equal(p.max, 6)
})

test('interval med en-dash ("4–6") genkendes ligesom bindestreg', () => {
  const p = parseRepsPrescription('4–6')
  assert.equal(p.type, 'range')
  assert.equal(p.min, 4)
  assert.equal(p.max, 6)
})

test('interval med mellemrum ("4 - 6") genkendes', () => {
  const p = parseRepsPrescription('4 - 6')
  assert.equal(p.type, 'range')
  assert.equal(p.min, 4)
})

test('"frit" (uanset store/små bogstaver og omgivende mellemrum) giver type frit', () => {
  for (const raw of ['frit', 'FRIT', ' Frit ']) {
    assert.equal(parseRepsPrescription(raw).type, 'free')
  }
})

test('fast tal ("8") giver IKKE et redigerbart felt — opfører sig som i dag', () => {
  const p = parseRepsPrescription('8')
  assert.equal(p.type, 'fixed')
  assert.equal(p.min, null)
})

test('tom/manglende ordination giver fast (uændret fallback-visning "—")', () => {
  for (const raw of ['', null, undefined, '   ']) {
    assert.equal(parseRepsPrescription(raw).type, 'fixed')
  }
})

test('andre fritekst-ordinationer (fx "AMRAP") forbliver faste, ikke frie', () => {
  assert.equal(parseRepsPrescription('AMRAP').type, 'fixed')
  assert.equal(parseRepsPrescription('8 pr. side').type, 'fixed')
})
