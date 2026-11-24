// Ordre 2123: danske datoer og ugegrænse i indkøbslisten. Ingen "i dag" og ingen Date.now; alle datoer er faste.
import test from 'node:test'
import assert from 'node:assert/strict'
import { danskDato, datesAfterWeek } from './approvedShoppingModel.mjs'
import { upcomingDates } from './upcomingPlanModel.mjs'

test('danskDato giver ugedag, dag og kort måned', () => {
  assert.equal(danskDato('2026-11-24'), 'tirsdag 24. nov.')
  assert.equal(danskDato('2026-11-29'), 'søndag 29. nov.')
  assert.equal(danskDato('2026-03-01'), 'søndag 1. mar.')
  assert.equal(danskDato('2027-01-01'), 'fredag 1. jan.')
})

test('danskDato lader ugyldig tekst stå uændret', () => {
  for (const value of ['', 'i dag', '2026-13-40', '24/11/2026', null, undefined]) assert.equal(danskDato(value), String(value))
})

test('danskDato afhænger ikke af tidszone eller klokken', () => {
  const before = process.env.TZ
  try {
    for (const tz of ['UTC', 'America/Los_Angeles', 'Pacific/Auckland']) { process.env.TZ = tz; assert.equal(danskDato('2026-11-24'), 'tirsdag 24. nov.') }
  } finally { if (before === undefined) delete process.env.TZ; else process.env.TZ = before }
})

const uge = (start, n = 7) => Array.from({ length: n }, (_, i) => new Date(Date.parse(start + 'T00:00:00Z') + i * 86400000).toISOString().slice(0, 10))
const window = upcomingDates('2026-11-24')

test('dage efter en sendt uges sidste dag hører ikke til ugen', () => {
  assert.deepEqual(window, ['2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27'])
  assert.deepEqual(datesAfterWeek(window, uge('2026-11-18')), ['2026-11-25', '2026-11-26', '2026-11-27'])
  assert.deepEqual(datesAfterWeek(window, uge('2026-11-17')), window)
  assert.deepEqual(datesAfterWeek(window, uge('2026-11-17')).length, 4)
  assert.deepEqual(datesAfterWeek(window, uge('2026-11-22')), [])
  assert.deepEqual(datesAfterWeek(window, uge('2026-11-24')), [])
  assert.deepEqual(datesAfterWeek(window, uge('2026-11-20')), ['2026-11-27'])
})

test('en enkelt plan er ingen uge og gælder videre', () => {
  assert.deepEqual(datesAfterWeek(window, ['2026-11-20']), [])
  assert.deepEqual(datesAfterWeek(window, uge('2026-11-18', 6)), [])
  assert.deepEqual(datesAfterWeek(window, [...uge('2026-11-10', 3), ...uge('2026-11-18', 4)]), [])
})

test('ukendt slutdag fjerner ingen dage', () => {
  for (const value of [undefined, null, '', 'x', 20261124, ['x', null, 5]]) assert.deepEqual(datesAfterWeek(window, value), [])
})
