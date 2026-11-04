import test from 'node:test'
import assert from 'node:assert/strict'
import { createFood } from './foedevarer/catalog.mjs'
import { createPlanFoodSnapshot, createPlanSnapshot, summarizePlanSnapshot } from './planSnapshot.mjs'

const food = () => createFood({ id: 'synthetic:1', name: 'Synthetic food',
  nutrientsPer100g: { energyKcal: 200, proteinG: 10, carbohydrateG: 25, fatG: 6, ironMg: 2 },
  source: { citation: 'synthetic fixture', verification: 'synthetic' } })
const input = () => ({ goal: 'bulk', intensity: 0.5, meals: [
  { name: 'Meal one', portions: [{ food: food(), grams: 150 }] },
  { name: 'Meal two', portions: [{ food: food(), grams: 50 }] },
] })

test('JSON round trip uses actual food totals for grams, macros and structured micronutrients', () => {
  const result = summarizePlanSnapshot(JSON.parse(JSON.stringify(createPlanSnapshot(input()))))
  assert.equal(result.grams, 200)
  assert.equal(result.mealCount, 2)
  for (const [key, expected] of Object.entries({ energyKcal: 400, proteinG: 20,
    carbohydrateG: 50, fatG: 12, ironMg: 4 })) assert.equal(result.nutrients[key].value, expected)
  assert.equal(result.nutrients.vitaminDUg.value, null)
  assert.equal(result.nutrients.vitaminDUg.complete, false)
})

test('snapshots copy caller data and food values; empty drafts retain unknown totals', () => {
  const data = input(), saved = createPlanSnapshot(data)
  data.meals[0].portions[0].grams = 900
  data.meals[0].portions.push({ food: food(), grams: 800 })
  assert.equal(saved.meals[0].portions[0].grams, 150)
  assert.equal(saved.meals[0].portions.length, 1)
  assert.notEqual(saved.meals[0].portions[0].food, data.meals[0].portions[0].food)
  assert.ok(Object.isFrozen(saved.meals[0].portions[0].food.nutrientsPer100g))
  const empty = summarizePlanSnapshot({ goal: 'vedligehold', intensity: 0 })
  assert.equal(empty.hasData, false)
  assert.equal(empty.nutrients.energyKcal.value, null)
})

test('all selected goals and intensity bounds work; obsolete codes and malformed data fail', () => {
  for (const goal of ['bulk', 'vedligehold', 'cut']) for (const intensity of [0, 0.5, 1]) {
    assert.equal(createPlanSnapshot({ ...input(), goal, intensity }).intensity, intensity)
  }
  for (const goal of ['opbygning', 'vaegtklasse_cut', 'restitution', '', null]) {
    assert.throws(() => createPlanSnapshot({ ...input(), goal }), TypeError)
  }
  for (const intensity of [undefined, null, '0.5', -0.1, 1.1, NaN, Infinity]) {
    assert.throws(() => createPlanSnapshot({ ...input(), intensity }), TypeError)
  }
  for (const meals of [null, {}, [null], new Array(1), [{ name: ' ', portions: [] }],
    [{ name: 'Meal', portions: new Array(1) }], Array.from({ length: 31 }, () => input().meals[0])]) {
    assert.throws(() => createPlanSnapshot({ ...input(), meals }), TypeError)
  }
  for (const grams of [0, -1, 100001, '150', null, NaN, Infinity]) {
    const data = input(); data.meals[0].portions[0].grams = grams
    assert.throws(() => createPlanSnapshot(data), TypeError)
  }
  const data = input(); data.meals[0].portions[0].food = { ...food(), basisGrams: 1 }
  assert.throws(() => createPlanSnapshot(data), TypeError)
})

test('missing values do not become zero; saved snapshot ignores later catalog changes', () => {
  const data = JSON.parse(JSON.stringify(input()))
  data.meals[1].portions[0].food.nutrientsPer100g.proteinG = null
  const saved = createPlanSnapshot(data)
  data.meals[0].portions[0].food.nutrientsPer100g.energyKcal = 1000
  const result = summarizePlanSnapshot(saved)
  assert.equal(result.nutrients.energyKcal.value, 400)
  assert.equal(result.nutrients.proteinG.value, null)
  assert.equal(result.nutrients.proteinG.knownSubtotal, 15)
  assert.equal(result.nutrients.proteinG.missingGrams, 50)
})

test('manual name-only or id-only foods normalize to the existing totals contract', () => {
  const { id, name, ...rest } = food()
  const named = createPlanFoodSnapshot({ ...rest, name })
  assert.equal(named.id, 'manual:' + encodeURIComponent(name))
  assert.equal(named.basisGrams, 100)
  assert.equal(createPlanFoodSnapshot({ ...rest, id }).name, id)
  assert.throws(() => createPlanFoodSnapshot(rest), TypeError)
  assert.throws(() => createPlanFoodSnapshot({ ...food(), source: null }), TypeError)
  assert.throws(() => createPlanFoodSnapshot({ ...food(), nutrientsPer100g: { energyKcal: 1e13 } }), TypeError)
})
