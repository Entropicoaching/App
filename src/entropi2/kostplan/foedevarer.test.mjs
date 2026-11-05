import test from 'node:test'
import assert from 'node:assert/strict'
import { LOCAL_FOODS } from '../../athlete/lokaleFoedevarer.js'
import { foodPortion } from '../nutrition/controller.mjs'
import { MICRONUTRIENTS } from './foedevarer/index.mjs'
import { calculateMeals } from './foedevarer.mjs'

const food = { name: 'Syntetisk fødevare', kcal100: 200, protein100: 20, carb100: 25, fat100: 5 }
const meal = items => ({ id: 'm1', name: 'Frokost', items })
const item = (grams = 100, extra = {}) => ({ food: { ...food, ...extra }, grams })

test('actual built-in food catalog and existing portion calculator agree for gram portions', () => {
  assert.ok(LOCAL_FOODS.length > 20)
  for (const food of LOCAL_FOODS) {
    for (const grams of [1, 50, 200]) {
      const expected = foodPortion(food, grams, 0)
      const { meal: ignored, ...macros } = expected
      void ignored
      assert.deepEqual(calculateMeals([meal([{ food, grams }])]).totals, macros)
    }
  }
})

test('concrete grams scale per-100-g macros, including decimal comma from existing food contract', () => {
  const result = calculateMeals([meal([item('200'), item('50,5', { protein100: '10,0' })])])
  assert.deepEqual(result.totals, { kcal: 501, protein: 45, carb: 63, fat: 13 })
  assert.equal(result.meals[0].items[1].grams, 50.5)
  assert.equal(result.meals[0].items[0].food.name, food.name)
})

test('small ingredients are summed before final application rounding, also across meals', () => {
  const result = calculateMeals([meal([item(0.2), item(0.2)]), { id: 'm2', name: 'Aften', items: [item(0.2)] }])
  assert.equal(result.totals.kcal, 1)
  assert.equal(result.meals[0].totals.kcal, 1)
  assert.equal(result.meals[1].totals.kcal, 0)
  assert.equal(calculateMeals([meal([item(0.2)])]).totals.kcal, 0)
})

test('meal and plan totals both calculated from original quantities, not rounded meal subtotals', () => {
  const a = item(0.2)
  const result = calculateMeals([meal([a]), { id: 'm2', name: 'Aften', items: [a] }])
  assert.equal(result.meals[0].totals.kcal + result.meals[1].totals.kcal, 0)
  assert.equal(result.totals.kcal, 1)
})

test('empty draft has zero macro totals and no invented micronutrients', () => {
  const result = calculateMeals([])
  assert.deepEqual(result.meals, [])
  assert.deepEqual(result.totals, { kcal: 0, protein: 0, carb: 0, fat: 0 })
  assert.equal(Object.keys(result.micronutrients).length, 9)
  for (const [name, nutrient] of Object.entries(result.micronutrients)) {
    assert.deepEqual(nutrient, { value: null, unit: MICRONUTRIENTS[name].unit,
      knownItems: 0, totalItems: 0, status: 'insufficient-data', sources: [] })
  }
})

test('micronutrients scale with grams only when every selected food has the value', () => {
  const a = item(200, { micronutrients100: { iron: { value: 2, unit: 'mg', source: 'Synthetic fixture A' }, vitaminD: { value: 0, unit: 'ug', source: 'Synthetic fixture A' } } })
  const b = item(50, { micronutrients100: { iron: { value: 1, unit: 'mg', source: 'Synthetic fixture B' } } })
  const result = calculateMeals([meal([a, b])])
  assert.deepEqual(result.micronutrients.iron, { value: 4.5, unit: 'mg', knownItems: 2, totalItems: 2,
    status: 'complete', sources: ['Synthetic fixture A', 'Synthetic fixture B'] })
  assert.deepEqual(result.micronutrients.vitaminD, { value: null, unit: 'ug', knownItems: 1, totalItems: 2,
    status: 'insufficient-data', sources: ['Synthetic fixture A'] })
  assert.equal(calculateMeals([meal([item(100), b])]).micronutrients.iron.value, null)
})

test('input and returned food snapshots are detached; catalog entries never mutated', () => {
  const meals = [meal([item(100, { micronutrients100: { iron: { value: 2, unit: 'mg', source: 'Synthetic fixture A' } } })])]
  const before = JSON.stringify(meals), result = calculateMeals(meals)
  assert.equal(JSON.stringify(meals), before)
  result.meals[0].items[0].food.micronutrients100.iron.value = 99
  assert.equal(meals[0].items[0].food.micronutrients100.iron.value, 2)
})

test('unknown nutrients, invalid gram quantities and names fail rather than silently becoming zero', () => {
  for (const grams of [null, undefined, 0, -1, '', 'bad', Infinity, 1e308, 10001]) {
    assert.throws(() => calculateMeals([meal([{ ...item(), grams }])]), TypeError)
  }
  for (const patch of [{ name: '' }, { kcal100: null }, { fat100: '' }, { carb100: undefined }, { protein100: 101 }, { kcal100: Infinity }]) {
    assert.throws(() => calculateMeals([meal([item(100, patch)])]), TypeError)
  }
  assert.deepEqual(calculateMeals([meal([item(100, { kcal100: 0, protein100: 0, carb100: 0, fat100: 0 })])]).totals,
    { kcal: 0, protein: 0, carb: 0, fat: 0 })
})

test('invalid meal shapes, duplicate IDs and unbounded lists are rejected', () => {
  for (const meals of [null, {}, [null], [meal([])], [meal([item()]), meal([item()])],
    [{ ...meal([item()]), name: '' }], [meal(Array.from({ length: 101 }, () => item()))],
    Array.from({ length: 21 }, (_, i) => ({ ...meal([item()]), id: String(i) }))]) {
    assert.throws(() => calculateMeals(meals), TypeError)
  }
})

test('ambiguous micronutrient units, non-finite amounts and invalid names fail explicitly', () => {
  for (const micronutrients100 of [[], { iron: { value: Infinity, unit: 'mg' } },
    { iron: { value: 2, unit: 'IU' } }, { 'bad name': { value: 2, unit: 'mg', source: 'Synthetic fixture A' } },
    { iron: { value: -1, unit: 'mg' } }]) {
    assert.throws(() => calculateMeals([meal([item(100, { micronutrients100 })])]), TypeError)
  }
  assert.throws(() => calculateMeals([meal([
    item(100, { micronutrients100: { iron: { value: 2, unit: 'mg', source: 'Synthetic fixture A' } } }),
    item(100, { micronutrients100: { iron: { value: 2, unit: 'ug' } } }),
  ])]), /enheder/)
})
