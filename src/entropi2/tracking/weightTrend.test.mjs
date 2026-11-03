import test from 'node:test'
import assert from 'node:assert/strict'
import { weightTrend } from './weightTrend.mjs'
import { weightSummary } from '../nutrition/startModel.mjs'

const id = 'synthetic-weight'
const date = '2026-11-03'
const day = (offset, end = date) => new Date(Date.parse(end + 'T00:00:00Z') + offset * 86400000).toISOString().slice(0, 10)
const row = (offset, weight, extra = {}) => ({ athlete_id: id, logged_at: day(offset), weight, ...extra })
const week = (offset, weight) => [0, -2, -6].map(d => row(d + offset, weight))
const weeks = (current = 104, previous = 102, oldest = 100) => [
  ...week(0, current), ...week(-7, previous), ...week(-14, oldest),
]
const trend = rows => weightTrend(rows, id, date)
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`)

test('empty, invalid dates, missing identity and invalid collections return null statistics', () => {
  const empty = { daily: [], average: null, days: 0, weeklyChange: null, previousWeeklyChange: null, fastChange: null }
  for (const rows of [[], null, undefined, {}, 'bad']) assert.deepEqual(trend(rows), empty)
  for (const end of [null, '', '2026-02-30', '2026-11-03T12:00:00Z']) {
    assert.deepEqual(weightTrend(weeks(), id, end), empty)
  }
  for (const athlete of [undefined, null, '', ' ', 5]) assert.deepEqual(weightTrend(weeks(), athlete, date), empty)
})

test('deduplication matches the actual copied weightSummary, latest valid creation wins', () => {
  const rows = [...weeks(), row(0, '105,5', { created_at: '2026-11-03T09:00:00Z' }),
    row(0, 900, { created_at: '2026-11-03T08:00:00Z' }),
    row(0, 0, { created_at: '2026-11-03T10:00:00Z' }),
    row(-1, 'bad'), row(-1, -1), row(-1, Infinity), row(-1, true), null,
    row(-1, 999, { athlete_id: 'synthetic-other' }), row(1, 999),
    row(-1, 999, { logged_at: '2026-02-30' }), row(-1, 999, { logged_at: date + 'T00:00:00Z' })]
  const result = trend(rows), original = weightSummary(rows, id, date)
  close(result.average, original.average)
  assert.equal(result.days, original.days)
  close(result.weeklyChange.kg, result.average - original.previousAverage)
  assert.equal(result.daily.at(-1).weight, 105.5)
  assert.deepEqual(trend([...rows].reverse()), result)
})

test('equal creation timestamps and missing creation timestamps keep the first valid row', () => {
  for (const created_at of [undefined, '', '2026-11-03T08:00:00Z']) {
    assert.equal(trend([row(0, 80, { created_at }), row(0, 90, { created_at })]).daily[0].weight, 80)
  }
})

test('moving average uses seven calendar days, three distinct days, no zero filling', () => {
  const s = trend([row(-9, 1000), row(-6, 60), row(-4, 70), row(0, 80)])
  assert.equal(s.average, 70)
  assert.equal(s.days, 3)
  assert.deepEqual(s.daily.slice(0, 2).map(d => d.average), [null, null])
  close(s.daily[2].average, 1130 / 3)
  assert.equal(s.daily[3].average, 70)
  assert.equal(s.weeklyChange, null)
  assert.equal(s.fastChange, null)
  assert.equal(trend([row(0, 80), row(0, 81), row(-6, 82)]).average, null)
})

test('exact -6/-7, -13/-14 and -20/-21 boundaries define three disjoint windows', () => {
  const s = trend([...weeks(), row(-21, 9999)])
  assert.equal(s.average, 104)
  assert.deepEqual(s.weeklyChange, { kg: 2, percent: 2 / 102 * 100 })
  assert.deepEqual(s.previousWeeklyChange, { kg: 2, percent: 2 })
  assert.equal(s.fastChange, true)
  assert.equal(trend([...weeks(), row(-21, 9999)]).daily.length, 10)
})

test('fast change requires two complete comparisons, each supported by at least three days per week', () => {
  for (let missing = 0; missing < 9; missing++) {
    const s = trend(weeks().filter((_, i) => i !== missing))
    assert.equal(s.fastChange, null)
    if (missing < 6) assert.equal(s.weeklyChange, null)
    if (missing >= 3) assert.equal(s.previousWeeklyChange, null)
  }
  assert.equal(trend(weeks().slice(0, 6)).fastChange, null)
})

test('both sustained gain and sustained loss qualify; reversal, flat or only one fast week do not', () => {
  for (const [current, previous, oldest, signal] of [
    [104, 102, 100, true], [96, 98, 100, true],
    [100, 102, 100, false], [100, 98, 100, false],
    [102.5, 102, 100, false], [102.5, 100.5, 100, false],
    [100, 100, 100, false],
  ]) assert.equal(trend(weeks(current, previous, oldest)).fastChange, signal)
})

test('strict 1% threshold uses each prior weekly bodyweight, including decimal boundary noise', () => {
  for (const [current, previous, oldest] of [[102.01, 101, 100], [78.408, 79.2, 80]]) {
    assert.equal(trend(weeks(current, previous, oldest)).fastChange, false)
  }
  assert.equal(trend(weeks(102.010001, 101.0000001, 100)).fastChange, true)
  assert.equal(trend(weeks(97.999999, 98.999999, 100)).fastChange, true)
  const s = trend(weeks(198, 200, 202))
  close(s.weeklyChange.percent, -1)
  assert.equal(s.fastChange, false)
})

test('explicit as-of date excludes future records and never substitutes the last measurement date', () => {
  const rows = [...weeks(), row(1, 1000)]
  assert.deepEqual(trend(rows), trend(weeks()))
  const stale = weightTrend(weeks(), id, day(21))
  assert.equal(stale.average, null)
  assert.equal(stale.days, 0)
  assert.equal(stale.fastChange, null)
})

test('UTC calendar arithmetic crosses year, month, leap day and daylight-saving boundaries', () => {
  for (const end of ['2026-01-03', '2024-03-02', '2026-03-30', '2026-10-26']) {
    const rows = weeks().map(r => ({ ...r, logged_at: day((Date.parse(r.logged_at) - Date.parse(date)) / 86400000, end) }))
    const s = weightTrend(rows, id, end)
    assert.equal(s.average, 104)
    assert.equal(s.weeklyChange.kg, 2)
    assert.equal(s.fastChange, true)
  }
})

test('frozen inputs remain unchanged; returned objects contain no row references or extra fields', () => {
  const rows = Object.freeze(weeks().map(r => Object.freeze({ ...r, ignored: 'synthetic' })))
  const before = JSON.stringify(rows)
  const first = trend(rows)
  first.daily[0].weight = 999
  first.weeklyChange.kg = 999
  assert.equal(JSON.stringify(rows), before)
  assert.equal(trend(rows).daily[0].weight, 100)
  assert.equal(trend(rows).weeklyChange.kg, 2)
  assert.deepEqual(Object.keys(trend(rows).daily[0]), ['date', 'weight', 'average', 'days'])
})

test('numeric extremes never expose Infinity or NaN, even when percentage is not representable', () => {
  for (const values of [[Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE],
    [Number.MAX_VALUE / 2, Number.MIN_VALUE, Number.MIN_VALUE], [1e-300, 1e-300, 1e-300]]) {
    const s = trend(weeks(...values))
    const inspect = value => {
      if (typeof value === 'number') assert.ok(Number.isFinite(value))
      else if (value && typeof value === 'object') Object.values(value).forEach(inspect)
    }
    inspect(s)
  }
})
