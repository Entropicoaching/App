import test from 'node:test'
import assert from 'node:assert/strict'
import { FOODS, NUTRIENTS, sumMeal, sumDay } from '../foedevarer/index.mjs'
import { CATEGORIES, RECIPES, recipePortions, sumRecipe, scaleRecipe } from './index.mjs'

const macroKeys = ['energyKcal', 'proteinG', 'carbohydrateG', 'fatG']
const foodById = new Map(FOODS.map(food => [food.id, food]))
const foodId = name => FOODS.find(food => food.name === name).id
const close = (actual, expected) => assert.ok(
  Math.abs(actual - expected) <= Math.max(1, Math.abs(expected)) * 1e-12,
  `${actual} should equal ${expected}`,
)
const single = (name, grams = 100) => ({ ingredients: [{ foodId: foodId(name), grams }] })

test('24 distinct simple meals cover all six categories with catalog foods and positive gram portions', () => {
  assert.equal(RECIPES.length, 24)
  assert.deepEqual(CATEGORIES, [
    'morgenmad', 'frokost', 'aftensmad', 'mellemmaaltid', 'foer-traening', 'efter-traening',
  ])
  assert.equal(new Set(RECIPES.map(recipe => recipe.id)).size, 24)
  assert.equal(new Set(RECIPES.map(recipe => recipe.name)).size, 24)
  assert.equal(new Set(RECIPES.map(recipe => JSON.stringify(recipe.ingredients))).size, 24)
  for (const category of CATEGORIES) assert.equal(RECIPES.filter(recipe => recipe.category === category).length, 4)
  for (const recipe of RECIPES) {
    assert.match(recipe.id, /^[a-z][a-z0-9-]+$/)
    assert.ok(recipe.name.trim())
    assert.ok(CATEGORIES.includes(recipe.category))
    assert.ok(recipe.ingredients.length >= 2 && recipe.ingredients.length <= 5)
    assert.equal(new Set(recipe.ingredients.map(item => item.foodId)).size, recipe.ingredients.length)
    for (const item of recipe.ingredients) {
      assert.deepEqual(Object.keys(item).sort(), ['foodId', 'grams'])
      assert.ok(foodById.has(item.foodId))
      assert.ok(Number.isFinite(item.grams) && item.grams > 0)
    }
    assert.ok(recipe.steps.length > 0 && recipe.steps.every(step => typeof step === 'string' && step.trim()))
  }
})

test('built-in suggestions and their nested data cannot be mutated', () => {
  const recipe = RECIPES[0]
  assert.throws(() => RECIPES.push(recipe), TypeError)
  assert.throws(() => CATEGORIES.push('unknown'), TypeError)
  assert.throws(() => { recipe.name = 'changed' }, TypeError)
  assert.throws(() => recipe.ingredients.pop(), TypeError)
  assert.throws(() => { recipe.ingredients[0].grams = 1 }, TypeError)
  assert.throws(() => recipe.steps.push('changed'), TypeError)
})

test('each meal uses the real catalog and existing sumMeal; macro arithmetic agrees independently', () => {
  const before = structuredClone(FOODS)
  for (const recipe of RECIPES) {
    const portions = recipePortions(recipe)
    const total = sumRecipe(recipe)
    assert.deepEqual(total, sumMeal(portions))
    assert.equal(total.hasData, true)
    for (const portion of portions) assert.equal(portion.food, foodById.get(portion.food.id))
    for (const key of macroKeys) {
      const expected = recipe.ingredients.reduce((sum, item) =>
        sum + foodById.get(item.foodId).nutrientsPer100g[key] * item.grams / 100, 0)
      close(total.nutrients[key].value, expected)
      assert.equal(total.nutrients[key].complete, true)
    }
  }
  assert.deepEqual(FOODS, before)
})

test('concrete breakfast fixture has exact catalog-derived macros and honest missing micronutrients', () => {
  const total = sumRecipe(RECIPES[0])
  assert.equal(total.grams, 410)
  close(total.nutrients.energyKcal.value, 436.5)
  close(total.nutrients.proteinG.value, 36.3)
  close(total.nutrients.carbohydrateG.value, 58.8)
  close(total.nutrients.fatG.value, 4.2)
  for (const key of Object.keys(NUTRIENTS).filter(key => !macroKeys.includes(key))) {
    assert.equal(total.nutrients[key].value, null)
    assert.equal(total.nutrients[key].complete, false)
    assert.equal(total.nutrients[key].missingGrams, 410)
    assert.equal(total.nutrients[key].missingPortions, 3)
  }
  const portions = recipePortions(RECIPES[0])
  assert.equal(portions[0].food.source.verification, 'kilde skal verificeres')
  assert.equal(portions[0].food.preparation, 'as-named; otherwise unspecified')
})

test('cooked foods resolve as cooked catalog entries and day composition works unchanged', () => {
  const dinner = RECIPES.find(recipe => recipe.id === 'kylling-ris')
  const rice = recipePortions(dinner).find(portion => portion.food.name === 'Ris kogt')
  assert.equal(rice.grams, 250)
  assert.equal(rice.food.nutrientsPer100g.energyKcal, 130)
  const meals = [RECIPES[0], dinner].map(recipePortions)
  const day = sumDay(meals)
  close(day.nutrients.energyKcal.value,
    sumRecipe(RECIPES[0]).nutrients.energyKcal.value + sumRecipe(dinner).nutrients.energyKcal.value)
  assert.equal(day.nutrients.leucineG.value, null)
})

test('every recipe scales proportionally to energy or protein goals without mutating input or catalog', () => {
  const beforeRecipes = structuredClone(RECIPES), beforeFoods = structuredClone(FOODS)
  for (const recipe of RECIPES) {
    const original = sumRecipe(recipe)
    for (const nutrient of ['energyKcal', 'proteinG']) {
      for (const factor of [0.25, 1, 1.7, 3]) {
        const value = original.nutrients[nutrient].value * factor
        const scaled = scaleRecipe(recipe, { nutrient, value })
        const actual = sumRecipe(scaled)
        close(actual.nutrients[nutrient].value, value)
        assert.notEqual(scaled, recipe)
        assert.notEqual(scaled.ingredients, recipe.ingredients)
        assert.equal(scaled.id, recipe.id)
        assert.equal(scaled.name, recipe.name)
        assert.equal(scaled.category, recipe.category)
        assert.deepEqual(scaled.steps, recipe.steps)
        scaled.ingredients.forEach((item, index) => {
          assert.notEqual(item, recipe.ingredients[index])
          assert.equal(item.foodId, recipe.ingredients[index].foodId)
          close(item.grams, recipe.ingredients[index].grams * factor)
        })
        for (const key of macroKeys) close(actual.nutrients[key].value, original.nutrients[key].value * factor)
        assert.equal(actual.nutrients.ironMg.value, null)
        close(actual.grams, original.grams * factor)
      }
    }
  }
  assert.deepEqual(RECIPES, beforeRecipes)
  assert.deepEqual(FOODS, beforeFoods)
})

test('fractional grams are retained, rescaling composes, and returned ingredients are detached', () => {
  const recipe = RECIPES[0], before = structuredClone(recipe)
  const small = scaleRecipe(recipe, { nutrient: 'proteinG', value: 0.031 })
  assert.ok(small.ingredients.every(item => item.grams > 0 && item.grams < 1))
  close(sumRecipe(small).nutrients.proteinG.value, 0.031)
  const rescaled = scaleRecipe(small, { nutrient: 'energyKcal', value: 650 })
  const direct = scaleRecipe(recipe, { nutrient: 'energyKcal', value: 650 })
  rescaled.ingredients.forEach((item, index) => close(item.grams, direct.ingredients[index].grams))
  small.ingredients[0].grams = 123
  assert.deepEqual(recipe, before)
  const portions = recipePortions(recipe)
  portions[0].grams = 123
  assert.deepEqual(recipe, before)
})

test('malformed, empty, sparse or non-catalog ingredients fail instead of producing invented data', () => {
  const id = foodId('Skyr naturel')
  const badRecipes = [undefined, null, {}, [], { ingredients: [] }, { ingredients: {} },
    { ingredients: new Array(1) }, { ingredients: [null] },
    { ingredients: [{ foodId: 'invented', grams: 100 }] },
    { ingredients: [{ foodId: '__proto__', grams: 100 }] },
    { ingredients: [{ food: FOODS[0], grams: 100 }] }]
  for (const grams of [undefined, null, -1, -0, 0, NaN, Infinity, -Infinity, '100', true, {}]) {
    badRecipes.push({ ingredients: [{ foodId: id, grams }] })
  }
  for (const recipe of badRecipes) {
    assert.throws(() => recipePortions(recipe), TypeError)
    assert.throws(() => sumRecipe(recipe), TypeError)
    assert.throws(() => scaleRecipe(recipe, { nutrient: 'proteinG', value: 30 }), TypeError)
  }
})

test('caller-supplied nutrient objects cannot override canonical catalog values', () => {
  const recipe = single('Skyr naturel')
  recipe.ingredients[0].food = { nutrientsPer100g: { proteinG: 999 } }
  recipe.ingredients[0].nutrientsPer100g = { proteinG: 999 }
  close(sumRecipe(recipe).nutrients.proteinG.value, 11)
  const scaled = scaleRecipe(recipe, { nutrient: 'proteinG', value: 22 })
  assert.deepEqual(scaled.ingredients, [{ foodId: foodId('Skyr naturel'), grams: 200 }])
})

test('invalid, ambiguous-unit and non-positive scaling goals fail explicitly', () => {
  const recipe = RECIPES[0]
  for (const target of [undefined, null, {}, { energyKcal: 600 }, { proteinG: 30 },
    { nutrient: 'energyKj', value: 600 }, { nutrient: 'fatG', value: 20 },
    { nutrient: 'toString', value: 20 }, { nutrient: 'proteinG', value: '30' }]) {
    assert.throws(() => scaleRecipe(recipe, target), TypeError)
  }
  for (const value of [undefined, null, 0, -0, -1, NaN, Infinity, -Infinity, '', true, {}]) {
    for (const nutrient of ['energyKcal', 'proteinG']) {
      assert.throws(() => scaleRecipe(recipe, { nutrient, value }), TypeError)
    }
  }
})

test('zero protein or zero energy cannot provide a scaling basis', () => {
  assert.throws(() => scaleRecipe(single('Olivenolie'), { nutrient: 'proteinG', value: 30 }), RangeError)
  assert.throws(() => scaleRecipe(single('Cola zero'), { nutrient: 'energyKcal', value: 600 }), RangeError)
})

test('numeric overflow and underflow reject unusable quantities and totals', () => {
  assert.throws(() => sumRecipe(single('Olivenolie', Number.MAX_VALUE)), RangeError)
  assert.throws(() => scaleRecipe(RECIPES[0], { nutrient: 'energyKcal', value: Number.MIN_VALUE }), RangeError)
  assert.throws(() => scaleRecipe(single('Banan'), { nutrient: 'proteinG', value: Number.MAX_VALUE }), RangeError)
  // Each ingredient is finite, but the sum of grams exceeds the numeric range.
  assert.throws(() => sumRecipe({ ingredients: [
    { foodId: foodId('Cola zero'), grams: Number.MAX_VALUE },
    { foodId: foodId('Cola zero'), grams: Number.MAX_VALUE },
  ] }), RangeError)
})
