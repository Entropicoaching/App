import { FOODS, sumMeal } from '../foedevarer/index.mjs'

const byId = new Map(FOODS.map(food => [food.id, food]))
const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0

// Resolve catalog IDs at the boundary; never accept supplied nutrient snapshots.
export function recipePortions(recipe) {
  if (!recipe || !Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
    throw new TypeError('Opskriften skal have mindst én ingrediens')
  }
  return Array.from(recipe.ingredients, ingredient => {
    const food = byId.get(ingredient?.foodId)
    if (!food || !positive(ingredient?.grams)) {
      throw new TypeError('Ingrediensen skal have et katalog-id og et positivt, endeligt gramantal')
    }
    return { food, grams: ingredient.grams }
  })
}

// Same result shape and missing-data semantics as the existing sumMeal.
export function sumRecipe(recipe) {
  return sumMeal(recipePortions(recipe))
}

// A single explicit target: { nutrient: 'energyKcal' | 'proteinG', value: number }.
// Scale every ingredient proportionally; retain fractional grams without rounding.
// This targets one nutrient, never promises simultaneous energy/protein targets.
export function scaleRecipe(recipe, target) {
  if (!target || !['energyKcal', 'proteinG'].includes(target.nutrient) || !positive(target.value)) {
    throw new TypeError('Målet skal være positiv energi i kcal eller protein i gram')
  }
  const original = sumRecipe(recipe).nutrients[target.nutrient].value
  if (!positive(original)) throw new RangeError('Opskriften har intet kendt positivt grundlag for målet')
  const factor = target.value / original
  if (!positive(factor)) throw new RangeError('Skaleringen overstiger talområdet')
  const ingredients = recipe.ingredients.map(ingredient => {
    const grams = ingredient.grams * factor
    if (!positive(grams)) throw new RangeError('Gram efter skalering overstiger talområdet')
    return { foodId: ingredient.foodId, grams }
  })
  const scaled = { ...recipe, ingredients }
  // Check all nutrient/gram sums for overflow, and the target for underflow.
  const actual = sumRecipe(scaled).nutrients[target.nutrient].value
  if (!positive(actual) || Math.abs(actual - target.value) / target.value > 1e-10) {
    throw new RangeError('Målet kan ikke repræsenteres præcist nok')
  }
  return scaled
}
