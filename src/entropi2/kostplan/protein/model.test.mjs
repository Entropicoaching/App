import test from 'node:test'
import assert from 'node:assert/strict'
import { FOODS } from '../foedevarer/index.mjs'
import { planProteinDistribution as plan, PROTEIN_POLICY } from './model.mjs'

const slots = (count = 4, values = []) => Array.from({ length: count }, (_, index) => ({
  id: `synthetic-${index}`, name: 'Syntetisk måltid',
  timing: index === count - 1 ? 'before-sleep' : 'daytime', proteinG: values[index] ?? null,
}))
const input = (overrides = {}) => ({ weightKg: 80, dailyProteinG: 128, meals: slots(), ...overrides })
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`)

test('distributes the existing goal across 3–5 slots including explicit before sleep', () => {
  for (const count of [3, 4, 5]) {
    for (const goal of [0.1, 31.47, 128, 160, 1000]) {
      const result = plan(input({ dailyProteinG: goal, meals: slots(count) }))
      near(result.meals.reduce((sum, meal) => sum + meal.targetProteinG, 0), goal)
      assert.equal(result.beforeSleepIncluded, true)
      assert.equal(result.meals.at(-1).timing, 'before-sleep')
      assert.equal(result.dailyProteinG, goal)
      assert.ok(result.meals.every(meal => meal.targetProteinG >= 0))
    }
  }
  assert.deepEqual(plan(input()).meals.map(meal => meal.targetProteinG), [32, 32, 32, 32])
})

test('flags known amounts below 0.3 g/kg; reference range never changes the goal', () => {
  const result = plan(input({ meals: slots(4, [0, 23.9, 24, 90]) }))
  assert.equal(result.thresholdG, 24)
  assert.equal(result.referenceUpperG, 32)
  assert.deepEqual(result.meals.map(meal => meal.belowThreshold), [true, true, false, false])
  assert.ok(plan(input({ dailyProteinG: 40 })).meals.every(meal => meal.targetBelowThreshold))
  assert.ok(plan(input({ dailyProteinG: 200 })).meals.every(meal => meal.targetAboveReference))
  assert.equal(plan(input({ dailyProteinG: 200 })).dailyProteinG, 200)
})

test('missing and empty data never become an invented intake or plan', () => {
  for (const value of [undefined, {}, { weightKg: 80 }]) assert.equal(plan(value).status, 'unavailable')
  const empty = plan(input({ meals: [] }))
  assert.equal(empty.status, 'empty'); assert.equal(empty.totalProteinG, null)
  const partial = plan(input({ meals: slots(4, [0, 24, null, 24]) }))
  assert.equal(partial.totalProteinG, null)
  assert.equal(partial.knownProteinG, 48)
  assert.equal(partial.meals[2].belowThreshold, null)
  assert.equal(partial.meals[0].belowThreshold, true)
  assert.equal(partial.suggestionsStatus, 'incomplete-day')
  assert.ok(partial.meals.every(meal => meal.suggestions.length === 0))
})

test('small alternatives use actual catalogue macros and preserve provenance', () => {
  const result = plan(input({ meals: slots(4, [10, 10, 10, 10]) }))
  for (const meal of result.meals) {
    assert.ok(meal.suggestions.length > 0)
    for (const suggestion of meal.suggestions) {
      const food = FOODS.find(food => food.id === suggestion.foodId)
      assert.ok(food)
      near(suggestion.proteinG, food.nutrientsPer100g.proteinG * suggestion.grams / 100)
      near(suggestion.energyKcal, food.nutrientsPer100g.energyKcal * suggestion.grams / 100)
      assert.ok(suggestion.grams > 0 && suggestion.grams <= 150)
      assert.equal(suggestion.grams % 5, 0)
      assert.ok(suggestion.proteinG <= 15)
      assert.ok(meal.proteinG + suggestion.proteinG <= Math.min(result.thresholdG, meal.targetProteinG))
      assert.deepEqual(suggestion.source, food.source)
      assert.equal(suggestion.source.verification, 'kilde skal verificeres')
    }
  }
})

test('even largest alternatives together stay within the daily remainder', () => {
  for (const values of [[0, 0, 0, 120], [10, 10, 10, 90], [32, 32, 32, 32], [0, 0, 0, 200]]) {
    const result = plan(input({ meals: slots(4, values) }))
    const additions = result.meals.reduce((sum, meal) => sum + Math.max(0, ...meal.suggestions.map(s => s.proteinG)), 0)
    assert.ok(additions <= Math.max(0, 128 - result.totalProteinG) + 1e-9)
    if (result.totalProteinG >= 128) assert.equal(additions, 0)
  }
})

test('explicit food choices constrain suggestions; empty choice list means none', () => {
  const tofu = FOODS.find(food => food.name === 'Tofu fast').id
  const result = plan(input({ meals: slots(4, [0, 0, 0, 0]), allowedFoodIds: [tofu] }))
  assert.ok(result.meals.every(meal => meal.suggestions.length === 1 && meal.suggestions[0].foodId === tofu))
  assert.ok(plan(input({ meals: slots(4, [0, 0, 0, 0]), allowedFoodIds: [] })).meals.every(m => !m.suggestions.length))
  for (const ids of [['unknown'], [tofu, tofu], null, Array(1)]) {
    assert.throws(() => plan(input({ allowedFoodIds: ids })), TypeError)
  }
})

test('does not infer before sleep, combine repeated names or mutate caller/catalogue data', () => {
  const value = input({ meals: slots(4, [10, 20, 30, 40]).map(meal => ({ ...meal, timing: 'daytime' })) })
  const snapshot = structuredClone(value), foods = structuredClone(FOODS)
  Object.freeze(value); Object.freeze(value.meals); value.meals.forEach(Object.freeze)
  const result = plan(value)
  assert.equal(result.beforeSleepIncluded, false)
  assert.equal(result.meals.length, 4)
  result.meals[0].name = 'changed'
  result.meals[0].suggestions[0].source.citation = 'changed'
  assert.deepEqual(value, snapshot); assert.deepEqual(FOODS, foods)
  assert.equal(PROTEIN_POLICY.verification, 'kilde skal verificeres')
})

test('rejects malformed, duplicate, sparse, negative and nonfinite inputs', () => {
  for (const bad of [null, [], '80']) assert.throws(() => plan(bad), TypeError)
  for (const key of ['weightKg', 'dailyProteinG']) {
    for (const bad of [0, -1, NaN, Infinity, '80', true, 1001]) assert.throws(() => plan(input({ [key]: bad })), TypeError)
  }
  for (const meals of [{}, slots(1), slots(2), slots(6), Array(4),
    [slots()[0], slots()[0], slots()[2]],
    slots().map(meal => ({ ...meal, timing: 'before-sleep' }))]) {
    assert.throws(() => plan(input({ meals })), TypeError)
  }
  for (const bad of ['', -1, Infinity, NaN, true, '24', 1001]) {
    const meals = slots(); meals[0].proteinG = bad
    assert.throws(() => plan(input({ meals })), TypeError)
  }
})
