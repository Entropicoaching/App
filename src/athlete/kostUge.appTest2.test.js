import { test } from 'node:test'
import assert from 'node:assert/strict'
import { summarizeKostWeek } from './kostUge.mjs'

const input = () => ({ selectedDate: '2026-10-14', asOfDate: '2026-10-15', coveredDates: ['2026-10-12', '2026-10-13', '2026-10-14'],
  logs: [{ date: '2026-10-12', kcal: 1000, protein: 40 }, { date: '2026-10-12', kcal: 500, protein: 30 }, { date: '2026-10-14', kcal: 2000, protein: null }],
  targetHistory: [{ effectiveFrom: '2026-10-01', kcal: 1800, protein: 100 }, { effectiveFrom: '2026-10-14', kcal: 2200, protein: null }] })

test('APP-TEST2: Monday through Sunday separates logged, missing, unavailable and future', () => {
  const s = summarizeKostWeek(input())
  assert.equal(s.startDate, '2026-10-12'); assert.equal(s.endDate, '2026-10-18')
  assert.deepEqual(s.days.map(d => d.status), ['logged', 'missing', 'logged', 'unavailable', 'future', 'future', 'future'])
  assert.deepEqual(s.counts, { logged: 2, missing: 1, unavailable: 1, future: 3 })
  assert.equal(s.days[1].totals.kcal, null); assert.equal(s.days[1].entryCount, null)
})
test('APP-TEST2: totals and averages use known values per metric and paired historic targets', () => {
  const s = summarizeKostWeek(input())
  assert.deepEqual(s.days[0].totals, { kcal: 1500, protein: 70 })
  assert.equal(s.days[2].totals.protein, null)
  assert.deepEqual(s.metrics.kcal, { average: 1750, knownDays: 2, comparison: { days: 2, intakeAverage: 1750, targetAverage: 2000, difference: -250 } })
  assert.equal(s.metrics.protein.knownDays, 1); assert.equal(s.metrics.protein.comparison.days, 1)
})
test('APP-TEST2: absent goals stay unknown; explicit zero is known and removed goal is null', () => {
  const i = input(); i.targetHistory = [{ effectiveFrom: '2026-10-13', kcal: 0, protein: null }]
  const s = summarizeKostWeek(i)
  assert.equal(s.days[0].targets.kcal, null); assert.equal(s.days[2].targets.kcal, 0)
  assert.equal(s.metrics.kcal.comparison.days, 1); assert.equal(s.metrics.kcal.comparison.targetAverage, 0)
  assert.equal(s.metrics.protein.comparison.difference, null)
})
test('APP-TEST2: rows on uncovered or future dates do not create known intake', () => {
  const i = input(); i.logs.push({ date: '2026-10-15', kcal: 100, protein: 1 }, { date: '2026-10-16', kcal: 100, protein: 1 })
  const s = summarizeKostWeek(i)
  assert.equal(s.metrics.kcal.knownDays, 2)
  assert.equal(s.days[3].totals.kcal, null); assert.equal(s.days[4].totals.kcal, null)
})
test('APP-TEST2: invalid or incomplete metric poisons only that metric; zero remains known', () => {
  const i = input(); i.logs[0].protein = -1; i.logs[0].kcal = 0; i.logs[1].kcal = 0
  const s = summarizeKostWeek(i)
  assert.equal(s.days[0].totals.kcal, 0); assert.equal(s.days[0].totals.protein, null)
  i.logs[0].kcal = '1000'; assert.equal(summarizeKostWeek(i).days[0].totals.kcal, null)
})
test('APP-TEST2: invalid dates, duplicate goal snapshots and missing lists fail', () => {
  for (const mutate of [i => { i.selectedDate = '2026-02-30' }, i => { i.asOfDate = '2026-1-1' }, i => { i.coveredDates.push('bad') }, i => { i.logs[0].date = 'bad' }, i => { i.targetHistory.push({ ...i.targetHistory[0] }) }, i => { i.logs = null }]) {
    const i = input(); mutate(i); assert.throws(() => summarizeKostWeek(i), TypeError)
  }
})
test('APP-TEST2: overflow throws and input arrays remain unchanged', () => {
  const i = input(), before = JSON.stringify(i); summarizeKostWeek(i); assert.equal(JSON.stringify(i), before)
  i.logs[0].kcal = Number.MAX_VALUE; i.logs[1].kcal = Number.MAX_VALUE
  assert.throws(() => summarizeKostWeek(i), RangeError)
})
