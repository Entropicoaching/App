// Separate reference checks: construct expected calendar buckets without calling
// any production helper, then import and compare the actual module under review.
import test from 'node:test'
import assert from 'node:assert/strict'
import { weightTrend } from './weightTrend.mjs'

const end = '2026-11-03', id = 'synthetic-review'
const day = offset => new Date(Date.UTC(2026, 10, 3 + offset)).toISOString().slice(0, 10)
const near = (actual, expected) => expected === null ? assert.equal(actual, null)
  : assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`)

test('independent seeded calendar-bucket oracle: 200 sparse, shuffled, duplicate histories', () => {
  let seed = 7319
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32 }
  for (let trial = 0; trial < 200; trial++) {
    const rows = [], selected = new Map()
    for (let offset = -35; offset <= 2; offset++) {
      if (random() < 0.25) continue
      const weight = 50 + Math.floor(random() * 80)
      const base = { athlete_id: id, logged_at: day(offset), weight, created_at: '2026-11-03T08:00:00Z' }
      rows.push(base, { ...base, weight: weight + 100, created_at: '2026-11-03T07:00:00Z' },
        { ...base, weight: 0, created_at: '2026-11-03T09:00:00Z' },
        { ...base, weight: 1000, athlete_id: 'synthetic-other' })
      if (offset <= 0) selected.set(offset, weight)
    }
    for (let i = rows.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1)); [rows[i], rows[j]] = [rows[j], rows[i]]
    }
    const bucket = until => {
      const values = []
      for (let offset = until - 6; offset <= until; offset++) {
        if (selected.has(offset)) values.push(selected.get(offset))
      }
      return { days: values.length, mean: values.length >= 3 ? values.reduce((a, b) => a + b, 0) / values.length : null }
    }
    const current = bucket(0), previous = bucket(-7), oldest = bucket(-14)
    const result = weightTrend(rows, id, end)
    near(result.average, current.mean); assert.equal(result.days, current.days)
    const expectedChanges = [[current, previous], [previous, oldest]].map(([a, b]) =>
      a.mean === null || b.mean === null ? null : { kg: a.mean - b.mean, percent: (a.mean / b.mean - 1) * 100 })
    for (const [index, actual] of [result.weeklyChange, result.previousWeeklyChange].entries()) {
      const expected = expectedChanges[index]
      if (expected === null) assert.equal(actual, null)
      else { near(actual.kg, expected.kg); near(actual.percent, expected.percent) }
    }
    const [a, b] = expectedChanges
    const expectedSignal = !a || !b ? null : Math.abs(a.percent) > 1 + 1e-12
      && Math.abs(b.percent) > 1 + 1e-12 && a.kg * b.kg > 0
    assert.equal(result.fastChange, expectedSignal)
    assert.deepEqual(result.daily.map(r => r.date), [...selected.keys()].map(day))
    result.daily.forEach(r => {
      const offset = (Date.parse(r.date) - Date.parse(end)) / 86400000
      near(r.average, bucket(offset).mean)
      assert.equal(r.days, bucket(offset).days)
      assert.equal(r.weight, selected.get(offset))
    })
  }
})

test('independent explicit 21-day examples and missing-week regression', () => {
  const full = Array.from({ length: 21 }, (_, i) => ({ athlete_id: id, logged_at: day(i - 20),
    weight: i < 7 ? 100 : i < 14 ? 98 : 96 }))
  const result = weightTrend(full, id, end)
  near(result.average, 96)
  near(result.weeklyChange.kg, -2)
  near(result.weeklyChange.percent, -2 / 98 * 100)
  near(result.previousWeeklyChange.kg, -2)
  assert.equal(result.fastChange, true)
  const gap = weightTrend(full.filter(r => r.logged_at < day(-13) || r.logged_at > day(-7)), id, end)
  near(gap.average, 96)
  assert.equal(gap.weeklyChange, null)
  assert.equal(gap.previousWeeklyChange, null)
  assert.equal(gap.fastChange, null)
})
