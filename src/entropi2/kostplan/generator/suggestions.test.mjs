import test from 'node:test'
import assert from 'node:assert/strict'
import { FOODS } from '../foedevarer/catalog.mjs'
import { generateGramPlan } from './index.mjs'
import { suggestFoodItems, SUGGESTION_POLICY } from './suggestions.mjs'
import { selection, strengthDays } from './days.fixture.mjs'

const targets = { kcal: 2400, protein: 160, carb: 280, fat: 70 }
const empty = { id: 'empty', name: 'Syntetisk måltid', items: [] }
const request = extra => ({ targets, mealCount: 1, meals: [empty], ...extra })

test('empty meals use actual marked foods, exact catalogue reasons and bounded macro-based proposals', () => {
  const before = JSON.stringify(FOODS), input = request(), original = structuredClone(input)
  const result = generateGramPlan(input), items = result.meals[0].items
  assert.ok(items.length > 0 && items.length <= 3)
  assert.deepEqual(generateGramPlan(input), result)
  assert.deepEqual(input, original); assert.equal(JSON.stringify(FOODS), before)
  for (const item of items) {
    const food = FOODS.find(food => food.id === item.foodId)
    assert.ok(food.prioritet && food.prioritetBegrundelse)
    assert.equal(item.prioritet, food.prioritet)
    assert.equal(item.prioritetBegrundelse, food.prioritetBegrundelse)
    assert.equal(item.minGrams, SUGGESTION_POLICY.minGrams)
    assert.equal(item.maxGrams, SUGGESTION_POLICY.maxGrams)
    assert.ok(item.grams >= item.minGrams && item.grams <= item.maxGrams && item.grams % 5 === 0)
  }
  for (const [target, nutrient] of [['protein', 'proteinG'], ['carb', 'carbohydrateG'], ['fat', 'fatG']]) {
    assert.ok(targets[target] > 0)
    const highest = Math.max(...FOODS.filter(food => food.prioritet).map(food => food.nutrientsPer100g[nutrient]))
    assert.ok(items.some(item => FOODS.find(food => food.id === item.foodId).nutrientsPer100g[nutrient] === highest))
  }
  result.meals[0].items[0].prioritetBegrundelse = 'changed'
  assert.notEqual(generateGramPlan(input).meals[0].items[0].prioritetBegrundelse, 'changed')
})

test('all explicit choices and bounds take precedence, including unmarked foods in mixed days', () => {
  const manual = { id: 'chosen', name: 'Coachens valg', items: [selection('Sukker', 15, 15)] }
  const result = generateGramPlan(request({ mealCount: 2, meals: [manual, empty] }))
  assert.deepEqual(result.meals[0].items.map(item => [item.foodId, item.grams, item.minGrams, item.maxGrams]),
    [[manual.items[0].foodId, 15, 15, 15]])
  assert.equal(Object.hasOwn(result.meals[0].items[0], 'prioritetBegrundelse'), false)
  assert.ok(result.meals[1].items.every(item => FOODS.find(food => food.id === item.foodId).prioritet))
  for (const { input } of strengthDays()) {
    const generated = generateGramPlan(input)
    for (const [mi, meal] of input.meals.entries()) {
      assert.deepEqual(generated.meals[mi].items.map(item => item.foodId), meal.items.map(item => item.foodId))
    }
  }
})

test('availability is explicit; absent metadata, unknown macros and zero macro targets never invent choices', () => {
  const rice = FOODS.find(food => food.name === 'Ris kogt')
  const input = request({ availableFoodIds: [rice.id] })
  assert.deepEqual(generateGramPlan(input).meals[0].items.map(item => item.foodId), [rice.id])
  assert.equal(generateGramPlan(request({ availableFoodIds: [] })).status, 'no-plan')
  for (const availableFoodIds of [null, 'rice', Array(1), ['missing'], [rice.id, rice.id]])
    assert.throws(() => generateGramPlan(request({ availableFoodIds })), TypeError)
  const altered = structuredClone(rice)
  altered.nutrientsPer100g.proteinG = null
  assert.deepEqual(suggestFoodItems([altered], targets), [])
  assert.deepEqual(suggestFoodItems([{ ...rice, prioritetBegrundelse: '' }], targets), [])
  assert.deepEqual(suggestFoodItems([{ ...rice, prioritet: undefined }], targets), [])
  assert.deepEqual(suggestFoodItems([rice], { kcal: 500, protein: 0, carb: 0, fat: 0 }), [])
  assert.deepEqual(suggestFoodItems([rice], targets).map(item => item.foodId), [rice.id])
})

test('eight empty meals stay bounded; malformed explicit choices are never replaced by suggestions', () => {
  const result = generateGramPlan(request({ mealCount: 8,
    meals: Array.from({ length: 8 }, (_, index) => ({ ...empty, id: `m${index}` })) }))
  assert.ok(result.meals.every(meal => meal.items.length > 0 && meal.items.length <= 3))
  for (const items of [[{ foodId: '', minGrams: 5, maxGrams: 50 }], [selection('Ris kogt', 5, 53)], Array(1)])
    assert.throws(() => generateGramPlan(request({ meals: [{ ...empty, items }] })), TypeError)
})
