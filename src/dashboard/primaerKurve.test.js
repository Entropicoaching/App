import test from 'node:test'
import assert from 'node:assert/strict'
import { primaerKurve, primaerOverskrift } from './primaerKurve.js'

const p = [{ y: 100, label: 'a' }]
const e1 = { s: { e1rmData: p, actualData: [{ y: 80, label: 'a' }] } }
const kgKun = { s: { e1rmData: [], actualData: [{ y: 80, label: 'a' }] } }

test('e1RM naar den findes', () => {
  const k = primaerKurve(e1.s)
  assert.equal(k.enhed, 'e1RM'); assert.equal(k.data[0].y, 100); assert.equal(k.note, null)
})
test('falder tilbage til kg og siger det ved loeftet', () => {
  const k = primaerKurve(kgKun.s)
  assert.equal(k.enhed, 'kg'); assert.equal(k.data[0].y, 80); assert.match(k.note, /kg/)
})
test('overskrift: ren e1RM naar alle er e1RM, ellers nævner den kg', () => {
  assert.doesNotMatch(primaerOverskrift([e1, e1]), /faktiske kg/)
  assert.match(primaerOverskrift([e1, kgKun]), /faktiske kg/)
})
test('tom serie giver tom kurve i kg, ikke nedbrud', () => {
  assert.deepEqual(primaerKurve({}).data, []); assert.equal(primaerKurve(undefined).enhed, 'kg')
})
