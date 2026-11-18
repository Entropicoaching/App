import test from 'node:test'
import assert from 'node:assert/strict'
import { helpers } from './forenkl6Cases.mjs'

const { computeActiveWeekIdx } = helpers
const uger = (...datoer) => datoer.map((d, i) => ({ id: `w${i + 1}`, week_number: i + 1, start_date: d }))
const nu = (t, dato = '2026-11-18T12:00:00') => t.mock.timers.enable({ apis: ['Date'], now: new Date(dato).getTime() })

test('fire uger uden dato: den foerste uge er aktiv', t => {
  nu(t)
  assert.equal(computeActiveWeekIdx(uger(null, null, null, null)), 0)
  assert.equal(computeActiveWeekIdx(uger('', undefined, null, null)), 0)
})
test('en uge uden dato vinder ikke over en dateret uge', t => {
  nu(t)
  assert.equal(computeActiveWeekIdx(uger('2026-11-16', null, null)), 0)
  assert.equal(computeActiveWeekIdx(uger(null, '2026-11-16', null)), 1)
  assert.equal(computeActiveWeekIdx(uger('2026-11-02', '2026-11-09', null, null)), 2)
  assert.equal(computeActiveWeekIdx(uger('2026-10-05', '2026-10-12', null, null)), 3)
  assert.equal(computeActiveWeekIdx(uger('2026-10-26', null, null, null)), 3)
})
test('daterede uger: dagens uge', t => {
  nu(t)
  assert.equal(computeActiveWeekIdx(uger('2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23')), 2)
  assert.equal(computeActiveWeekIdx(uger('2026-11-16', '2026-11-23')), 0)
})
test('daterede uger: kun fremtidige giver foerste uge, kun fortid giver sidste', t => {
  nu(t)
  assert.equal(computeActiveWeekIdx(uger('2026-12-07', '2026-12-14')), 0)
  assert.equal(computeActiveWeekIdx(uger('2026-10-05', '2026-10-12', '2026-10-19')), 2)
})
test('daterede uger med hul i dagens dato: seneste ikke-fremtidige', t => {
  nu(t, '2026-11-18T12:00:00')
  assert.equal(computeActiveWeekIdx(uger('2026-10-05', '2026-11-30')), 0)
})
test('ingen uger giver 0', () => { assert.equal(computeActiveWeekIdx([]), 0) })
test('uge uden dato efter en udloebet dateret uge faar sin udledte dato', t => {
  nu(t, '2026-09-21T00:00:00+02:00')
  assert.equal(computeActiveWeekIdx(uger('2026-09-14', null)), 1)
})
