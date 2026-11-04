// Separate checks with independent fixtures/expected values; no shared test builder.
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAthleteWeek } from './athleteWeekModel.mjs'
const snapshot = () => ({ status: 'ready', complete: true, athleteId: 'review-athlete',
  endDate: '2026-11-04', sessions: [], daily: [], nutritionDays: [], strength: null })
const build = data => buildAthleteWeek(data, { enabled: true })

test('review: seven calendar dates across month/DST boundary, not 168-hour timestamp slicing', () => {
  const data = snapshot()
  data.endDate = '2026-10-27'
  data.daily = ['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24',
    '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28'].map(day => ({
    athleteId: 'review-athlete', day, source: 'athlete_manual', sleepHours: 8, energy: 4 }))
  const model = build(data)
  assert.equal(model.sleep.count, 7)
  assert.deepEqual(model.sleep.observations.map(row => row.day), ['2026-10-21', '2026-10-22',
    '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27'])
  assert.ok(Math.abs(model.sleep.average - 8) < 1e-12)
})

test('review: target changes use weighted paired totals, exclude unversioned and partial days', () => {
  const data = snapshot()
  data.nutritionDays = [
    { athleteId: 'review-athlete', day: '2026-11-01', complete: true, kcal: 1000, kcalTarget: 2000, targetVersion: 'old' },
    { athleteId: 'review-athlete', day: '2026-11-02', complete: true, kcal: 4000, kcalTarget: 5000, targetVersion: 'new' },
    { athleteId: 'review-athlete', day: '2026-11-03', complete: false, kcal: 10000, kcalTarget: 2000, targetVersion: 'new' },
    { athleteId: 'review-athlete', day: '2026-11-04', complete: true, kcal: 10000, kcalTarget: 2000 },
  ]
  const model = build(data), result = model.nutrition.kcal
  assert.equal(result.count, 2)
  assert.ok(Math.abs(result.percent - 5000 / 7000 * 100) < 1e-12)
  assert.notEqual(result.percent, 65) // mean of daily percentages would be wrong
  data.nutritionDays.reverse()
  assert.deepEqual(build(data), model)
  assert.equal(model.nutrition.protein.count, 0)
})

test('review: lower-weight higher-rep set may win, without inventing completed sessions', () => {
  const data = snapshot()
  const row = (id, kg, reps) => ({ athleteId: 'review-athlete', day: '2026-11-04',
    id, exerciseId: 'lift-x', variantId: 'variant-y', unit: 'kg', kg, reps,
    confirmed: true, skipped: false, warmup: false })
  data.strength = { exerciseId: 'lift-x', variantId: 'variant-y', label: 'Testløft · variant Y',
    sets: [row('heavier', 100, 1), row('better-estimate', 90, 10)] }
  const model = build(data)
  assert.equal(model.bestSet.value.id, 'better-estimate')
  assert.equal(model.bestSet.value.estimate, 120)
  assert.equal(model.sessions.completed, 0)
  data.strength.sets.reverse()
  assert.deepEqual(build(data), model)
})

test('review: malformed complete snapshots never become success or empty', () => {
  for (const patch of [{ complete: 'true' }, { strength: undefined }, { sessions: Array(10001) },
    { sessions: [{ athleteId: 'another-athlete', day: '2020-01-01' }] },
    { daily: [{ athleteId: 'review-athlete', day: '2026-11-03', source: 'device', energy: 3 }] }]) {
    assert.deepEqual(build({ ...snapshot(), ...patch }), { status: 'error' })
  }
})

test('review: no private or arbitrary metadata is traversed, no writes to frozen data', () => {
  const data = snapshot()
  data.daily = [{ athleteId: 'review-athlete', day: '2026-11-04', source: 'athlete_manual', energy: 1 }]
  for (const object of [data, data.daily[0]]) {
    for (const field of ['cycle', 'notes', 'auth']) Object.defineProperty(object, field,
      { get() { throw Error('Unrequested data read') } })
    Object.freeze(object)
  }
  Object.freeze(data.daily)
  const model = build(data)
  assert.equal(model.energy.count, 1); assert.equal(model.energy.average, null)
  assert.doesNotMatch(JSON.stringify(model), /review-athlete|cycle|notes|auth/)
})
