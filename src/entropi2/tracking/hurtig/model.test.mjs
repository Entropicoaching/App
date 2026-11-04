import test from 'node:test'
import assert from 'node:assert/strict'
import { buildQuickModel, cleanMeal, mealKey, preferenceKey, readinessValue, weightValue } from './model.mjs'
import { athleteId, date, data, meal, scores } from './testFixtures.mjs'

const model = (input = data(), extra = {}) => buildQuickModel({ athleteId, date, ...input, ...extra })

test('prefills exact yesterday without mutating input; only whitelisted readiness fields', () => {
  const input = data()
  Object.defineProperty(input.readinessRows[0], 'cycle', { get() { throw Error('private read') } })
  const before = JSON.stringify(input)
  const value = model(input)
  assert.deepEqual(value.draft.readiness, Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, String(v)])))
  assert.equal(value.draft.weight, '80.2')
  assert.equal(value.readinessSource, 'yesterday'); assert.equal(value.weightSource, 'yesterday')
  assert.equal(value.canRepeat, true)
  assert.equal(JSON.stringify(input), before)
  assert.deepEqual(readinessValue(value.draft.readiness), scores)
})

test('today takes precedence; older, foreign and future records are never used as yesterday', () => {
  const input = data()
  input.readinessRows.push({ athlete_id: athleteId, logged_date: date, energy: 5 })
  input.weightRows.push({ athlete_id: athleteId, logged_at: date, weight: 81 })
  assert.equal(model(input).draft.readiness.energy, '5')
  assert.equal(model(input).draft.readiness.stress, '')
  assert.equal(model(input).draft.weight, '81')
  assert.equal(model(input).readinessSource, 'today')
  const empty = model(data({ readinessRows: [{ athlete_id: athleteId, logged_date: '2026-11-02', energy: 5 }],
    weightRows: [{ athlete_id: 'synthetic-other', logged_at: '2026-11-03', weight: 55 },
      { athlete_id: athleteId, logged_at: '2026-11-05', weight: 70 }], mealRows: [meal('future', { date: '2026-11-05' })] }))
  assert.equal(empty.canRepeat, false); assert.equal(empty.draft.weight, '')
  assert.equal(empty.draft.readiness.energy, ''); assert.deepEqual(empty.meals, [])
})

test('calendar yesterday survives year, month, leap year and Danish DST boundaries', () => {
  for (const [day, previous] of [['2027-01-01', '2026-12-31'], ['2028-03-01', '2028-02-29'],
    ['2027-03-01', '2027-02-28'], ['2026-03-30', '2026-03-29'], ['2026-10-26', '2026-10-25']]) {
    const result = model(data({ readinessRows: [], weightRows: [{ athlete_id: athleteId, logged_at: previous, weight: 77 }] }), { date: day })
    assert.equal(result.yesterday, previous); assert.equal(result.draft.weight, '77')
  }
})

test('meal ranking uses frequency, then recency, distinct portions and row-id deduplication', () => {
  const rows = [meal('A', { id: 'a' }), meal('A', { id: 'b' }), meal('A', { id: 'b' }),
    meal('B', { date: '2026-11-02' }), meal('B', { date: '2026-11-02' }),
    meal('C', { date }), meal('A', { kcal: 999 }), meal('D', { date: '2026-11-01' })]
  const ranked = model(data({ mealRows: rows })).meals
  assert.deepEqual(ranked.map(x => [x.value.meal, x.count]), [['A', 2], ['B', 2], ['C', 1], ['A', 1], ['D', 1]])
  assert.equal(new Set(ranked.map(x => x.key)).size, 5)
  assert.equal(ranked[0].key, mealKey(ranked[0].value))
  assert.deepEqual(model(data({ mealRows: [...rows].reverse() })).meals, ranked)
})

test('no implicit zero nutrients, day receipts, blank names, invalid values or foreign rows', () => {
  const invalid = [meal('  '), meal(' [appData2-day-v1]receipt'),
    ...['kcal', 'protein', 'carb', 'fat'].flatMap(key => [null, '', -1, NaN, Infinity, 'bad'].map(value => meal('invalid', { [key]: value })))]
  assert.ok(invalid.every(row => cleanMeal(row) === null))
  const value = model(data({ mealRows: [...invalid, meal('zero', { kcal: '0', protein: '0', carb: '0', fat: '0' }),
    meal('private', { athlete_id: 'synthetic-other' })] }))
  assert.equal(value.meals.length, 1); assert.equal(value.meals[0].value.kcal, 0)
  assert.equal(value.ignoredMeals, invalid.length - 1) // Day receipts are expected, not invalid meals.
})

test('existing required readiness scores only, optional sleep and Danish decimal weight', () => {
  assert.deepEqual(readinessValue({ ...scores, sleep_hours: '' }), { ...scores, sleep_hours: null })
  assert.equal(readinessValue({ ...scores, sleep_hours: '0' }).sleep_hours, 0)
  assert.equal(weightValue('80,25'), 80.25)
  for (const invalid of ['', 0, -1, null, Infinity, '80kg']) assert.throws(() => weightValue(invalid))
  for (const field of ['energy', 'motivation', 'stress', 'soreness_level']) {
    for (const value of ['', 0, 6, '2.5', NaN]) assert.throws(() => readinessValue({ ...scores, [field]: value }))
  }
  for (const value of ['bad', 25, -1]) assert.throws(() => readinessValue({ ...scores, sleep_hours: value }))
})

test('bad context, incomplete arrays, conflicting or invalid daily data fail closed', () => {
  for (const date of ['2026-02-30', 'bad', '0000-01-01']) assert.throws(() => model(data(), { date }))
  assert.throws(() => model(data(), { athleteId: '' }))
  assert.throws(() => model(data(), { mealRows: null }))
  assert.throws(() => model(data({ readinessRows: [data().readinessRows[0], data().readinessRows[0]] })))
  assert.throws(() => model(data({ weightRows: [{ athlete_id: athleteId, logged_at: '2026-11-03', weight: 0 }] })))
  assert.throws(() => model(data({ readinessRows: [{ athlete_id: athleteId, logged_date: date, energy: 6 }] })))
  assert.notEqual(preferenceKey('synthetic:a'), preferenceKey('synthetic%3Aa'))
})
