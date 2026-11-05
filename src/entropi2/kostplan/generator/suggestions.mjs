// Editorial draft bounds, not food-specific advice or a ranking of health value.
export const SUGGESTION_POLICY = Object.freeze({ minGrams: 5, maxGrams: 300 })
const roles = [['protein', 'proteinG'], ['carb', 'carbohydrateG'], ['fat', 'fatG']]
const marked = food => ['basis', 'god', 'særlig'].includes(food.prioritet)
  && typeof food.prioritetBegrundelse === 'string' && food.prioritetBegrundelse.trim().length > 0

// Only explicitly marked, available catalogue foods may seed an empty meal.
// Pick the highest known density for each requested macro, in catalogue order
// on ties. Labels are not treated as an ordinal nutrition/quality score.
// No training, allergies, preferences or micronutrient coverage are inferred.
export function suggestFoodItems(foods, targets) {
  const candidates = foods.filter(food => marked(food)
    && ['energyKcal', 'proteinG', 'carbohydrateG', 'fatG'].every(key => {
      const value = food.nutrientsPer100g?.[key]
      return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10000
    }))
  const selected = new Set()
  for (const [target, nutrient] of roles) {
    if (!(targets[target] > 0)) continue
    let best = null
    for (const food of candidates) {
      if (food.nutrientsPer100g[nutrient] > (best?.nutrientsPer100g[nutrient] ?? 0)) best = food
    }
    if (best) selected.add(best.id)
  }
  return [...selected].map(foodId => ({ foodId, ...SUGGESTION_POLICY }))
}
