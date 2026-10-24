import test from 'node:test'
import assert from 'node:assert/strict'
import { roundNutrition, nutritionValues } from './kostNumbers.mjs'

test('roundNutrition preserves the nearest integer for a large exact quarter', () => {
  assert.equal(roundNutrition(2 ** 50 + 0.25), 1125899906842624)
})

test('nutritionValues preserves the nearest integer for every large field', () => {
  const value = 2 ** 50 + 0.25
  const expected = 1125899906842624
  assert.deepEqual(nutritionValues({kcal:value,protein:value,carb:value,fat:value}),
    {kcal:expected,protein:expected,carb:expected,fat:expected})
})

test('rounding uses a bounded tolerance at small and large magnitudes', () => {
  for (const power of [0, 10, 20, 30, 40, 49, 50]) {
    for (const fraction of [0, 0.25, 0.5, 0.75]) {
      const value = 2 ** power + fraction
      assert.equal(roundNutrition(value), Math.round(value))
    }
  }
  assert.equal(roundNutrition(100 * 1.255), 126)
  assert.equal(roundNutrition(125.499999), 125)
  assert.equal(roundNutrition(Number.MAX_VALUE), Number.MAX_VALUE)
  for (const value of [-1, Infinity, NaN]) assert.equal(roundNutrition(value), null)
})
