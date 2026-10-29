import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_PROGRAM_OVERBLIK, programOverblikEnabled, buildProgramOverblik, copenhagenDay } from './programOverblik.mjs'
import { REL1030_FEATURES, rel1030Feature } from './rel1030.mjs'

const athlete = { id: 'synthetic-a', name: 'Alfa' }
const week = (start_date, extra = {}) => ({ week_number: 4, start_date, exercise_count: 1, ...extra })
const row = (weeks, today = '2026-10-26', extra = {}) => buildProgramOverblik({ athletes: [{ ...athlete, ...extra }], calendarWeeks: { [athlete.id]: weeks }, today })[0]

test('default OFF, strict opt-ins, independent release activation', () => {
  assert.equal(DEFAULT_PROGRAM_OVERBLIK, false)
  for (const search of ['', '?programOverblik=0', '?programOverblik=true', '?programOverblik', '?PROGRAMOVERBLIK=1', '?programOverblik=1&programOverblik=1', '?programOverblik=1&programOverblik=0', '?rel1030=1&rel1030=0']) assert.equal(programOverblikEnabled(search), false, search)
  for (const search of ['?programOverblik=1', '?rel1030=1', '?rel1030=0&programOverblik=1', '?programOverblik=0&rel1030=1']) assert.equal(programOverblikEnabled(search), true, search)
  assert.ok(REL1030_FEATURES.includes('programOverblik'))
  assert.equal(rel1030Feature('programOverblik', '?rel1030=1'), true)
})

test('0, 1, 2 and several weeks use strict urgency boundaries', () => {
  for (const [start, days, tone] of [['2026-10-20',0,'red'], ['2026-10-26',6,'red'], ['2026-10-27',7,'yellow'], ['2026-11-02',13,'yellow'], ['2026-11-03',14,'normal'], ['2026-11-17',28,'normal']]) {
    const result = row([week(start)])
    assert.equal(result.daysLeft, days)
    assert.equal(result.weeksLeft, days / 7)
    assert.equal(result.urgency, tone)
  }
  assert.equal(row([week('2026-10-01')]).weeksLeft, 0)
  assert.equal(row([week('2026-10-01')]).urgency, 'red')
})

test('empty, undated and invalid weeks cannot extend coverage', () => {
  for (const weeks of [[], [week('2026-12-01', {exercise_count: 0})], [null]]) assert.equal(row(weeks).status, 'empty')
  assert.equal(row([week(null)]).status, 'undated')
  assert.equal(row([week('2026-02-30')]).lastDate, null)
  const result = row([week('2026-10-26'), week('2027-01-01', {exercise_count: 0})])
  assert.equal(result.lastDate, '2026-11-01')
  assert.deepEqual(result.calendarWeek, { year: 2026, week: 44 })
  assert.deepEqual(row([week('2026-12-28')]).calendarWeek, { year: 2026, week: 53 })
})

test('earliest expiry first; no dates last; no input mutation', () => {
  const input = { athletes: [{id:'none',name:'Ingen'}, {id:'late',name:'Sen'}, athlete, {id:'expired',name:'Udloebet'}], calendarWeeks: { late:[week('2026-11-17')], [athlete.id]:[week('2026-10-26')], expired:[week('2026-10-01')] }, today:'2026-10-26' }
  const before = structuredClone(input)
  assert.deepEqual(buildProgramOverblik(input).map(r => r.athlete.id), ['expired',athlete.id,'late','none'])
  assert.deepEqual(input, before)
  assert.equal(row([week('2026-11-17', {week_number: 1}), week('2026-10-26', {week_number: 99})]).lastWeek, 1)
})

test('next competition remains visible before and after plan end; past and invalid dates omitted', () => {
  for (const date of ['2026-10-26', '2026-10-28','2026-12-01']) assert.equal(row([week('2026-10-26')], undefined, {competition_date:date}).nextCompetition, date)
  for (const date of [null, '', '2026-10-25', '2026-02-30']) assert.equal(row([], undefined, {competition_date:date}).nextCompetition, null)
})

test('Copenhagen midnight, summer/winter DST and civil-day arithmetic', () => {
  for (const [instant, day] of [['2026-10-28T22:59:59Z','2026-10-28'], ['2026-10-28T23:00:00Z','2026-10-29'], ['2026-06-01T22:00:00Z','2026-06-02'], ['2026-03-28T23:30:00Z','2026-03-29'], ['2026-10-25T00:30:00Z','2026-10-25'], ['2026-10-25T01:30:00Z','2026-10-25']]) assert.equal(copenhagenDay(new Date(instant)), day)
  assert.equal(row([week('2026-10-26')], '2026-10-28T23:00:00Z').daysLeft, 3)
  assert.equal(row([week('2026-03-23')], '2026-03-28T23:30:00Z').daysLeft, 0)
  for (const invalid of ['bad', '2026-02-30', '2026-10-29T00:00:00', new Date(NaN), null]) assert.equal(copenhagenDay(invalid), null)
})
