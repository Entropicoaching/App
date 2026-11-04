import test from 'node:test'
import assert from 'node:assert/strict'
import { meetPrognose } from './prognoseModel.mjs'

// Independent numerical checks: expected lines are defined first, rather than
// fitting through the implementation's regression or adapter helpers.
const dates = ['2026-09-02', '2026-09-09', '2026-09-16', '2026-09-23', '2026-09-30',
  '2026-10-07', '2026-10-14', '2026-10-21', '2026-10-28', '2026-11-04']
const run = (values, meetDate = '2026-11-18') => meetPrognose({ now: '2026-11-04', meetDate,
  fremgangLogs: dates.map((logged_at, i) => ({ exercise_id: `oracle-${i}`, logged_at,
    weight: values[i] / 1.1, reps_completed: 3,
    exercises: { name: 'Squat', sessions: { weeks: { block_name: 'Styrke' } } } })) }).lifts[0]

test('independent oracle: 35 known straight lines retain level and direction', () => {
  for (const level of [60, 90, 120, 150, 180]) for (const slope of [-1.5, -1, -0.5, 0, 0.5, 1, 1.5]) {
    const result = run(dates.map((_, week) => level + slope * week))
    assert.equal(result.status, 'ready')
    assert.ok(Math.abs(result.estimate - (level + 11 * slope)) < 1e-9)
    assert.ok(result.lower < result.estimate && result.upper > result.estimate)
  }
})

test('independent oracle: constant series interval has the documented floor and distance term', () => {
  const values = dates.map(() => 99)
  // Ten evenly spaced weeks: mean x=4.5, sum squared deviations=82.5.
  const current = run(values, '2026-11-04')
  const currentMargin = 4.95 * Math.sqrt(1.1 + 20.25 / 82.5)
  assert.ok(Math.abs(current.upper - (99 + currentMargin)) < 1e-9)
  const future = run(values, '2026-12-30')
  const futureMargin = 4.95 * Math.sqrt(1.1 + 156.25 / 82.5) + 4.95 * 56 / 63
  assert.ok(Math.abs(future.lower - (99 - futureMargin)) < 1e-9)
  assert.ok(Math.abs(future.upper - (99 + futureMargin)) < 1e-9)
})
