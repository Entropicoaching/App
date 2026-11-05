import test from 'node:test'
import assert from 'node:assert/strict'
import { FOODS } from '../foedevarer/catalog.mjs'
import { generateGramPlan } from './index.mjs'
import { suggestFoodItems } from './suggestions.mjs'
import { suggestionReason } from './reasons.mjs'

const id = name => 'local:' + encodeURIComponent(name)
const targets = { kcal: 2400, protein: 160, carb: 280, fat: 70 }
const request = names => ({ targets, mealCount: names.length,
  meals: names.map((name, i) => ({ id: `synthetic-${i}`, name, items: [] })) })
const names = result => result.meals.map(meal => meal.items.map(item => item.food.name))
const frozen = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(frozen); Object.freeze(value) }
  return value
}

test('actual catalogue gives distinct breakfast, lunch, dinner and snack with unchanged source data', () => {
  const input = frozen(request(['Morgenmad', 'Frokost', 'Aftensmad', 'Mellemmåltid']))
  const before = JSON.stringify(input), catalogue = JSON.stringify(FOODS)
  const plan = generateGramPlan(input)
  assert.deepEqual(names(plan), [
    ['Skyr naturel', 'Havregryn'],
    ['Kyllingebryst', 'Ris kogt', 'Broccoli'],
    ['Laks fersk', 'Linser kogte', 'Broccoli'],
    ['Skyr naturel'],
  ])
  assert.equal(new Set(names(plan).map(JSON.stringify)).size, 4)
  assert.deepEqual(generateGramPlan(input), plan)
  assert.equal(JSON.stringify(input), before); assert.equal(JSON.stringify(FOODS), catalogue)
  for (const item of plan.meals.flatMap(meal => meal.items)) {
    const food = FOODS.find(food => food.id === item.foodId)
    assert.equal(item.prioritetBegrundelse, food.prioritetBegrundelse)
    assert.deepEqual(item.source, food.source)
    assert.equal(item.minGrams, 5); assert.equal(item.maxGrams, 300)
    assert.ok(item.grams >= 5 && item.grams <= 300 && item.grams % 5 === 0)
  }
})

test('repeated named meals rotate mains and sides without random or cross-call state', () => {
  const input = request(['Frokost', 'Frokost 2', 'Frokost 3', 'Frokost 4', 'Frokost 5'])
  const plan = generateGramPlan(input)
  assert.deepEqual(names(plan).map(meal => meal[0]),
    ['Kyllingebryst', 'Tofu fast', 'Hakket oksekød 8%', 'Laks fersk', 'Kyllingebryst'])
  assert.deepEqual(names(plan).map(meal => meal[1]),
    ['Ris kogt', 'Linser kogte', 'Ris kogt', 'Linser kogte', 'Ris kogt'])
  generateGramPlan(request(['Aftensmad', 'Aftensmad']))
  assert.deepEqual(generateGramPlan(input), plan)
  const changedCase = request(['  MORGENMAD  ', 'frokost', 'Aftensmad', 'mellemmåltid 2'])
  assert.deepEqual(names(generateGramPlan(changedCase)), names(generateGramPlan(request(
    ['Morgenmad', 'Frokost', 'Aftensmad', 'Mellemmåltid']))))
})

test('later coach choices influence rotation but retain every explicit food and fixed bound', () => {
  const input = request(['Frokost', 'Coachens valg'])
  input.meals[1].items = ['Kyllingebryst', 'Ris kogt', 'Sukker'].map(name =>
    ({ foodId: id(name), minGrams: 25, maxGrams: 25 }))
  input.prioritizedFoodIds = [id('Kyllingebryst')]
  const plan = generateGramPlan(input)
  assert.deepEqual(names(plan)[0], ['Tofu fast', 'Linser kogte', 'Broccoli'])
  assert.deepEqual(plan.meals[1].items.map(item => [item.foodId, item.grams, item.minGrams, item.maxGrams]),
    input.meals[1].items.map(item => [item.foodId, 25, 25, 25]))
  // Regeneration receives existing selections, so it cannot rotate them away.
  const selected = plan.meals.map(meal => ({ id: meal.id, name: meal.name,
    items: meal.items.map(({ foodId, minGrams, maxGrams }) => ({ foodId, minGrams, maxGrams })) }))
  assert.deepEqual(names(generateGramPlan({ ...input, meals: selected })), names(plan))
})

test('availability restricts profiles without substituting lunch foods into breakfast or inventing metadata', () => {
  const input = request(['Morgenmad'])
  assert.equal(generateGramPlan({ ...input, availableFoodIds: [id('Kyllingebryst')] }).status, 'no-plan')
  assert.deepEqual(names(generateGramPlan({ ...input, availableFoodIds: [id('Havregryn')] })), [['Havregryn']])
  const day = request(['Frokost', 'Aftensmad'])
  const availableFoodIds = ['Tofu fast', 'Ris kogt', 'Broccoli'].map(id)
  const result = generateGramPlan({ ...day, availableFoodIds })
  assert.deepEqual(names(result), Array.from({ length: 2 }, () => ['Tofu fast', 'Ris kogt', 'Broccoli']))
  assert.deepEqual(generateGramPlan({ ...day, availableFoodIds: [...availableFoodIds].reverse() }), result)
  for (const food of FOODS.filter(food => food.prioritet)) {
    const bad = structuredClone(food)
    bad.nutrientsPer100g.proteinG = null
    assert.deepEqual(suggestFoodItems([bad], targets, { mealName: 'Frokost' }), [])
    assert.deepEqual(suggestFoodItems([{ ...food, prioritetBegrundelse: '' }], targets, { mealName: 'Frokost' }), [])
  }
  assert.deepEqual(suggestFoodItems(FOODS, { kcal: 500, protein: 0, carb: 0, fat: 0 }, { mealName: 'Morgenmad' }), [])
})

test('unknown names use deterministic available macro choices and do not mutate usage', () => {
  const input = request(['Coachens navn', 'Andet navn'])
  const plan = generateGramPlan(input)
  assert.notDeepEqual(names(plan)[0], names(plan)[1])
  const usage = new Map([[id('Kyllingebryst'), 4]])
  const before = [...usage]
  assert.notEqual(suggestFoodItems(FOODS, targets, { usage })[0].foodId, id('Kyllingebryst'))
  assert.deepEqual([...usage], before)
  assert.deepEqual(names(generateGramPlan({ ...input, availableFoodIds: [id('Ris kogt')] })),
    [['Ris kogt'], ['Ris kogt']])
})

test('short display reasons stay one concise line, retain unknowns, and require real metadata', () => {
  for (const food of FOODS.filter(food => food.prioritet)) {
    const reason = suggestionReason(food.id, food.prioritetBegrundelse)
    assert.ok(reason && reason.length <= 90 && reason.length < food.prioritetBegrundelse.length, food.name)
    assert.doesNotMatch(reason, /[\r\n]/)
    assert.equal(suggestionReason(food.id, ''), null)
    assert.equal(suggestionReason(food.id, null), null)
  }
  assert.match(suggestionReason(id('Laks fersk'), 'catalogue reason'), /ukendt/)
  assert.match(suggestionReason(id('Hakket oksekød 8%'), 'catalogue reason'), /rødt kød/)
  assert.equal(suggestionReason('synthetic-unknown', 'catalogue reason'), null)
})
