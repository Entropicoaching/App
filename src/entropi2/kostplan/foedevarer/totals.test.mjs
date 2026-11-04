import test from 'node:test'
import assert from 'node:assert/strict'
import { createFood, FOODS, NUTRIENTS, sumMeal, sumDay, compareDayToRecommendations } from './index.mjs'

const food = name => FOODS.find(food => food.name === name)
const portion = (name, grams) => ({ food: food(name), grams })
const fixture = values => createFood({ id: 'synthetic', name: 'Syntetisk',
  source: { citation: 'synthetic fixture, not a food reference', verification: 'synthetic' },
  nutrientsPer100g: values })
const recommendation = (nutrient, min, max) => ({ nutrient, min, max,
  unit: NUTRIENTS[nutrient].unit, source: 'synthetic daily target, not advice' })

test('200 g cooked rice, 100 g chicken and 50 g broccoli use exact legacy data', () => {
  const input = [portion('Ris kogt', 200), portion('Kyllingebryst', 100), portion('Broccoli', 50)]
  const before = structuredClone(input), result = sumMeal(input)
  assert.equal(result.grams, 350)
  assert.equal(result.activePortionCount, 3)
  for (const [key, expected] of Object.entries({ energyKcal: 387, proteinG: 30.5, carbohydrateG: 59.5, fatG: 2 })) {
    assert.equal(result.nutrients[key].value, expected)
    assert.equal(result.nutrients[key].complete, true)
  }
  assert.equal(result.nutrients.fibreG.value, null)
  assert.equal(result.nutrients.calciumMg.missingGrams, 350)
  assert.deepEqual(input, before)
})

test('day sums every portion without intermediate rounding or accidental deduplication', () => {
  const p = portion('Skyr naturel', 0.5)
  const meals = [[p], [], [p, p]]
  const day = sumDay(meals)
  assert.equal(day.mealCount, 3)
  assert.equal(day.portionCount, 3)
  assert.equal(day.grams, 1.5)
  assert.ok(Math.abs(day.nutrients.proteinG.value - 0.165) < 1e-12)
  assert.deepEqual(day.nutrients, sumMeal([p, p, p]).nutrients)
})

test('unknown nutrient stays unknown while known subtotal and missing coverage remain visible', () => {
  const calcium = { food: fixture({ calciumMg: 120, vitaminDUg: 2.5 }), grams: 50 }
  const result = sumMeal([calcium, portion('Ris kogt', 200)])
  assert.deepEqual(result.nutrients.calciumMg, {
    value: null, knownSubtotal: 60, knownGrams: 50, missingGrams: 200, missingPortions: 1, complete: false,
  })
  assert.equal(result.nutrients.vitaminDUg.knownSubtotal, 1.25)
  assert.equal(result.nutrients.energyKcal.value, null)
  assert.equal(result.nutrients.energyKcal.knownSubtotal, 260)
  assert.equal(sumDay([[calcium], [portion('Ris kogt', 200)]]).nutrients.calciumMg.value, null)
})

test('empty day, empty meal and zero portions cannot establish adequacy; measured zero can', () => {
  for (const result of [sumMeal(), sumDay(), sumDay([[]]), sumMeal([portion('Ris kogt', 0)])]) {
    assert.equal(result.hasData, false)
    for (const value of Object.values(result.nutrients)) {
      assert.equal(value.value, null); assert.equal(value.complete, false)
      assert.equal(value.knownSubtotal, 0)
    }
  }
  assert.equal(sumMeal([portion('Ris kogt', 10)]).nutrients.fatG.value, 0)
  const measuredZero = sumMeal([{ food: fixture({ fibreG: 0 }), grams: 100 }])
  assert.equal(measuredZero.nutrients.fibreG.value, 0)
  assert.equal(measuredZero.nutrients.fibreG.complete, true)
  assert.equal(sumMeal([{ food: fixture({ calciumMg: 5 }), grams: 100 }, portion('Ris kogt', 0)]).nutrients.calciumMg.value, 5)
})

test('explicit daily recommendations flag below/within/above including exact bounds', () => {
  const meals = [[{ food: fixture({ proteinG: 20, sodiumMg: 300, fibreG: 5 }), grams: 100 }]]
  const { assessment, unassessed } = compareDayToRecommendations(meals, [
    recommendation('proteinG', 30, 40), recommendation('sodiumMg', undefined, 200), recommendation('fibreG', 5, 5),
  ])
  assert.deepEqual(assessment.map(item => item.status), ['below', 'above', 'within'])
  assert.equal(assessment[0].deficit, 10)
  assert.equal(assessment[1].deficit, 0)
  assert.equal(assessment[0].source, 'synthetic daily target, not advice')
  assert.ok(unassessed.includes('calciumMg'))
  assert.ok(!unassessed.includes('proteinG'))
  assert.equal(compareDayToRecommendations(meals, [recommendation('proteinG', 20)]).assessment[0].status, 'within')
  assert.equal(compareDayToRecommendations(meals, [recommendation('proteinG', undefined, 20)]).assessment[0].status, 'within')
})

test('partial or empty intake produces unknown, never a fabricated nutrient deficiency', () => {
  const target = [recommendation('calciumMg', 100)]
  for (const meals of [[], [[]], [[portion('Ris kogt', 100)]],
    [[{ food: fixture({ calciumMg: 200 }), grams: 100 }, portion('Ris kogt', 1)]]]) {
    const item = compareDayToRecommendations(meals, target).assessment[0]
    assert.equal(item.status, 'unknown'); assert.equal(item.actual, null); assert.equal(item.deficit, null)
  }
  const result = compareDayToRecommendations([[portion('Ris kogt', 100)]])
  assert.deepEqual(result.assessment, [])
  assert.equal(result.unassessed.length, Object.keys(NUTRIENTS).length)
})

test('reject malformed quantities/foods/meals and never silently skip invalid portions', () => {
  for (const grams of [-1, Infinity, NaN, '100', '', null, undefined, true]) {
    assert.throws(() => sumMeal([portion('Ris kogt', grams)]), TypeError)
  }
  for (const bad of [null, {}, [null], [undefined], Array(1), [{ grams: 50 }],
    [{ food: { ...food('Ris kogt'), basisGrams: 1 }, grams: 100 }]]) {
    assert.throws(() => sumMeal(bad), TypeError)
  }
  for (const bad of [null, {}, [null], Array(1), [Array(1)], [portion('Ris kogt', 100)]]) assert.throws(() => sumDay(bad), TypeError)
})

test('reject wrong recommendation units, invalid ranges, duplicates and missing attribution', () => {
  for (const bad of [null, {}, [null], Array(1), [recommendation('proteinG', -1)], [recommendation('proteinG', 5, 4)],
    [recommendation('proteinG', NaN)], [recommendation('proteinG', 0, Infinity)], [recommendation('proteinG')],
    [{ ...recommendation('proteinG', 1), source: '' }], [{ ...recommendation('proteinG', 1), min: '1' }],
    [{ ...recommendation('calciumMg', 1), unit: 'g' }], [{ nutrient: 'invented', unit: 'g', min: 1, source: 'synthetic' }],
    [recommendation('proteinG', 1), recommendation('proteinG', 2)]]) {
    assert.throws(() => compareDayToRecommendations([], bad), TypeError)
  }
})

test('numeric overflow fails loudly, including intermediate per-portion and day sums', () => {
  const extreme = fixture({ energyKcal: Number.MAX_VALUE })
  assert.throws(() => sumMeal([{ food: extreme, grams: 200 }]), RangeError)
  assert.throws(() => sumDay([[{ food: extreme, grams: 100 }], [{ food: extreme, grams: 100 }]]), RangeError)
  assert.throws(() => sumMeal([portion('Ris kogt', Number.MAX_VALUE), portion('Ris kogt', Number.MAX_VALUE)]), RangeError)
})
