import test from 'node:test'
import assert from 'node:assert/strict'
import { FOODS } from '../foedevarer/catalog.mjs'
import { calculateMeals } from '../foedevarer.mjs'
import { generateGramPlan, GENERATOR_POLICY } from './index.mjs'
import { foodId, selection, strengthDays } from './days.fixture.mjs'

const keys = ['kcal', 'protein', 'carb', 'fat']
const nutrients = ['energyKcal', 'proteinG', 'carbohydrateG', 'fatG']
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`)
const oneMeal = (items, targets = { kcal: 500, protein: 30, carb: 60, fat: 15 }) =>
  ({ targets, mealCount: 1, meals: [{ id: 'm', name: 'Måltid', items }] })
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}

for (const { label, input } of strengthDays()) {
  test(`synthetic strength day: ${label}`, () => {
    const snapshot = structuredClone(input), catalogBefore = JSON.stringify(FOODS)
    const plan = generateGramPlan(freeze(input))
    assert.equal(plan.status, 'matched')
    assert.equal(plan.meals.length, input.mealCount)
    assert.deepEqual(generateGramPlan(input), plan)
    assert.deepEqual(input, snapshot)
    assert.equal(JSON.stringify(FOODS), catalogBefore)
    assert.deepEqual(JSON.parse(JSON.stringify(plan)), plan)
    const recalculated = calculateMeals(plan.meals)
    assert.deepEqual(plan.displayTotals, recalculated.totals)
    const items = plan.meals.flatMap(meal => meal.items)
    for (const [i, meal] of plan.meals.entries()) {
      assert.equal(meal.id, input.meals[i].id)
      assert.deepEqual(meal.items.map(item => item.foodId), input.meals[i].items.map(item => item.foodId))
      for (const item of meal.items) {
        assert.equal(item.grams % 5, 0)
        assert.ok(item.grams >= item.minGrams && item.grams <= item.maxGrams)
        const catalogFood = FOODS.find(food => food.id === item.foodId)
        for (let k = 0; k < keys.length; k++) assert.equal(item.food[keys[k] + '100'], catalogFood.nutrientsPer100g[nutrients[k]])
        assert.deepEqual(item.source, catalogFood.source)
      }
    }
    for (const key of keys) {
      const raw = items.reduce((sum, item) => sum + item.food[key + '100'] * item.grams / 100, 0)
      close(plan.totals[key], raw)
      close(plan.deviation[key].delta, raw - input.targets[key])
      assert.ok(Math.abs(plan.deviation[key].delta) <= plan.tolerance[key])
      assert.equal(plan.deviation[key].withinTolerance, true)
    }
  })
}

test('fixed 200 g cooked rice, 100 g chicken, 50 g broccoli retain exact values', () => {
  const targets = { kcal: 387, protein: 30.5, carb: 59.5, fat: 2 }
  const result = generateGramPlan(oneMeal([selection('Ris kogt', 200, 200),
    selection('Kyllingebryst', 100, 100), selection('Broccoli', 50, 50)], targets))
  assert.deepEqual(result.totals, targets)
  assert.equal(result.status, 'matched')
  for (const key of keys) assert.equal(result.deviation[key].delta, 0)
})

test('infeasible protein-only choice reports missing fat/carbs without inventing nutrients', () => {
  const result = generateGramPlan(oneMeal([selection('Kyllingebryst', 50, 200)]))
  assert.equal(result.status, 'infeasible')
  assert.equal(result.totals.carb, 0)
  assert.equal(result.bounds.carb.excludesTarget, true)
  assert.equal(result.bounds.carb.max, 0)
  assert.ok(result.deviation.carb.delta < 0)
  assert.match(result.message, /kan ikke nås/)
})

test('unavoidable minimums can make a small target infeasible, with positive deviation', () => {
  const result = generateGramPlan(oneMeal([selection('Olivenolie', 100, 150)], { kcal: 10, protein: 0, carb: 0, fat: 0 }))
  assert.equal(result.status, 'infeasible')
  assert.equal(result.bounds.kcal.min, 884)
  assert.ok(result.deviation.kcal.delta > 0)
  assert.equal(result.deviation.fat.percent, null)
  assert.equal(result.meals[0].items[0].grams, 100)
})

test('coupled infeasibility is reported as unmet without claiming a mathematical proof', () => {
  // Each independent macro interval contains its target, but rice cannot have
  // simultaneously 130 kcal (100 g) and 84 g carbohydrate (300 g).
  const result = generateGramPlan(oneMeal([selection('Ris kogt', 100, 300)], { kcal: 130, protein: 9, carb: 84, fat: 0 }))
  assert.equal(result.status, 'unmet')
  assert.ok(keys.every(key => !result.bounds[key].excludesTarget))
  assert.match(result.message, /beviser ikke/)
})

test('empty selections produce no plan and null totals instead of an invented zero intake', () => {
  const input = strengthDays()[0].input
  input.meals[1].items = []
  const result = generateGramPlan(input)
  assert.equal(result.status, 'no-plan')
  for (const key of ['totals', 'displayTotals', 'deviation', 'bounds']) assert.equal(result[key], null)
  assert.deepEqual(result.meals, [])
  assert.match(result.message, /Vælg/)
})

test('ordered priorities favour equivalent selected foods, preserving bounds and total macros', () => {
  const items = [selection('Cottage cheese', 50, 300), selection('Hytteost', 50, 300)]
  const input = oneMeal(items, { kcal: 343, protein: 38.5, carb: 10.5, fat: 14 })
  const left = generateGramPlan({ ...input, prioritizedFoodIds: [foodId('Cottage cheese')] })
  const right = generateGramPlan({ ...input, prioritizedFoodIds: [foodId('Hytteost')] })
  assert.ok(left.meals[0].items[0].grams > left.meals[0].items[1].grams)
  assert.ok(right.meals[0].items[1].grams > right.meals[0].items[0].grams)
  assert.deepEqual(left.totals, right.totals)
  assert.equal(left.status, 'matched')
  assert.equal(right.status, 'matched')
})

test('same food in different meals is a separate bounded portion', () => {
  const meal = { id: 'a', name: 'Ris', items: [selection('Ris kogt', 100, 100)] }
  const result = generateGramPlan({ targets: { kcal: 260, protein: 6, carb: 56, fat: 0 },
    mealCount: 2, meals: [meal, { ...meal, id: 'b' }] })
  assert.deepEqual(result.meals.map(m => m.items[0].grams), [100, 100])
  assert.equal(result.totals.carb, 56)
})

test('all returned mutable snapshots are detached across calls, inputs and catalog', () => {
  const input = strengthDays()[0].input, before = structuredClone(input)
  const result = generateGramPlan(input), original = structuredClone(result)
  result.meals[0].items[0].source.citation = 'changed'
  result.meals[0].items[0].food.kcal100 = 0
  result.targets.protein = 0
  result.tolerance.protein = 0
  result.meals[0].items.pop()
  assert.deepEqual(input, before)
  assert.deepEqual(generateGramPlan(input), original)
})

test('invalid and missing targets never become numeric zero or NaN', () => {
  const good = strengthDays()[0].input
  for (const key of keys) for (const bad of [undefined, null, '', '100', NaN, Infinity, -1, 1e300]) {
    assert.throws(() => generateGramPlan({ ...good, targets: { ...good.targets, [key]: bad } }), TypeError)
  }
  for (const bad of [undefined, null, {}, { ...good, targets: null }, { ...good, targets: { ...good.targets, kcal: 0 } }]) {
    assert.throws(() => generateGramPlan(bad), TypeError)
  }
})

test('invalid meal counts, sparse arrays and duplicate meal or food IDs fail explicitly', () => {
  const good = strengthDays()[0].input
  for (const mealCount of [undefined, null, 0, 1.5, 9, '3', Infinity]) {
    assert.throws(() => generateGramPlan({ ...good, mealCount }), TypeError)
  }
  for (const meals of [null, {}, [], Array(3), [null, ...good.meals.slice(1)],
    [good.meals[0], good.meals[0], good.meals[2]]]) assert.throws(() => generateGramPlan({ ...good, meals }), TypeError)
  for (const items of [null, Array(1), [null], [selection('unknown', 5, 50)],
    [selection('Ris kogt', 5, 50), selection('Ris kogt', 5, 50)]]) {
    assert.throws(() => generateGramPlan(oneMeal(items)), TypeError)
  }
  for (const patch of [{ name: '' }, { id: '' }, { items: Array.from({ length: 13 }, () => selection('Ris kogt', 5, 50)) }]) {
    assert.throws(() => generateGramPlan({ ...oneMeal([]), meals: [{ id: 'a', name: 'A', items: [], ...patch }] }), TypeError)
  }
})

test('every food requires explicit positive, ordered and 5 g aligned practical bounds', () => {
  for (const [min, max] of [[undefined, 100], [10, undefined], [0, 50], [10, 5], [3, 50], [5, 53],
    [5, 1005], [NaN, 100], [5, Infinity], ['5', 100], [null, 100], [-5, 100]]) {
    assert.throws(() => generateGramPlan(oneMeal([selection('Ris kogt', min, max)])), TypeError)
  }
})

test('priorities must refer to distinct selected catalog foods, without sparse entries', () => {
  const good = strengthDays()[0].input
  for (const prioritizedFoodIds of [null, 'rice', Array(1), ['unknown'],
    [foodId('Ris kogt'), foodId('Ris kogt')], [foodId('Torsk')]]) {
    assert.throws(() => generateGramPlan({ ...good, prioritizedFoodIds }), TypeError)
  }
})

test('search budget accepts 64 bounded portions and rejects larger days', () => {
  const items = FOODS.slice(0, 9).map(food => ({ foodId: food.id, minGrams: 5, maxGrams: 10 }))
  const meals = Array.from({ length: 8 }, (_, i) => ({ id: `m${i}`, name: 'M', items: items.slice(0, 8) }))
  const input = { ...oneMeal([]), mealCount: 8, meals }
  assert.equal(generateGramPlan(input).meals.flatMap(m => m.items).length, 64)
  meals[0].items.push(items[8])
  assert.throws(() => generateGramPlan(input), /64/)
  assert.equal(GENERATOR_POLICY.stepGrams, 5)
})
