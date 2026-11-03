import test from 'node:test'
import assert from 'node:assert/strict'
import { proteinDistribution, PROTEIN_GUIDANCE } from './proteinDistribution.mjs'

const meals = values => values.map(protein => ({ meal: 'Måltid', protein }))

test('3–5 meals and 20–40 grams are guidance, never a cap or prescribed total', () => {
  assert.deepEqual(PROTEIN_GUIDANCE, { minMeals: 3, maxMeals: 5, minGrams: 20, maxGrams: 40 })
  assert.ok(Object.isFrozen(PROTEIN_GUIDANCE))
  for (const count of [1, 2, 3, 4, 5, 6]) {
    const result = proteinDistribution(meals(Array(count).fill(30)))
    assert.equal(result.mealCount, count)
    assert.equal(result.totalProtein, count * 30)
  }
  assert.deepEqual(proteinDistribution(meals([0, 19.9, 20, 40, 40.1, 120])).meals.map(m => m.range),
    ['below', 'below', 'within', 'within', 'above', 'above'])
})

test('empty, unavailable and unknown are distinct; zero and decimal comma remain known', () => {
  assert.equal(proteinDistribution().status, 'unavailable')
  for (const value of [null, {}, 'bad']) assert.equal(proteinDistribution(value).totalProtein, null)
  const empty = proteinDistribution([])
  assert.equal(empty.status, 'empty'); assert.equal(empty.totalProtein, 0)
  const result = proteinDistribution(meals(['12,5', '20.25', 0, null, '', -1, Infinity, NaN, true, 'bad']))
  assert.equal(result.knownProtein, 32.75)
  assert.equal(result.unknownCount, 7); assert.equal(result.totalProtein, null)
  assert.equal(result.meals[2].protein, 0)
})

test('preserves order, duplicates, malformed rows and immutable input', () => {
  const input = Object.freeze([Object.freeze({ meal: ' Samme ', protein: 20 }),
    Object.freeze({ meal: ' Samme ', protein: 30 }), null, Object.freeze({ meal: '', protein: 40 })])
  const before = structuredClone(input)
  const result = proteinDistribution(input)
  assert.deepEqual(result.meals.map(m => m.label), ['Samme', 'Samme', 'Måltid 3', 'Måltid 4'])
  assert.equal(result.unknownCount, 1)
  assert.deepEqual(input, before)
  result.meals[0].protein = 999
  assert.equal(proteinDistribution(input).knownProtein, 90)
  const sparse = proteinDistribution(Array(2))
  assert.equal(sparse.unknownCount, 2); assert.equal(sparse.totalProtein, null)
})

test('overflow is not a finite total; fractions are not rounded before summation', () => {
  assert.equal(proteinDistribution(meals([Number.MAX_VALUE, Number.MAX_VALUE])).knownProtein, null)
  assert.equal(proteinDistribution(meals([0.25, 0.25, 0.25])).totalProtein, 0.75)
})
