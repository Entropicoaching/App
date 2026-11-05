// Editorial draft bounds, not food-specific advice or a ranking of health value.
export const SUGGESTION_POLICY = Object.freeze({ minGrams: 5, maxGrams: 300 })
const roles = [['protein', 'proteinG'], ['carb', 'carbohydrateG'], ['fat', 'fatG']]
const marked = food => ['basis', 'god', 'særlig'].includes(food.prioritet)
  && typeof food.prioritetBegrundelse === 'string' && food.prioritetBegrundelse.trim().length > 0

const id = name => 'local:' + encodeURIComponent(name)
// Editorial meal combinations using existing catalogue IDs, not new food data,
// inferred preferences, allergy checks or a ranking of the priority labels.
const breakfast = [['protein', ['Skyr naturel']], ['carb', ['Havregryn']]]
const lunch = [['protein', ['Kyllingebryst', 'Tofu fast', 'Hakket oksekød 8%', 'Laks fersk']],
  ['carb', ['Ris kogt', 'Linser kogte']], ['carb', ['Broccoli']]]
const dinner = [['protein', ['Laks fersk', 'Tofu fast', 'Kyllingebryst', 'Hakket oksekød 8%']],
  ['carb', ['Linser kogte', 'Ris kogt']], ['carb', ['Broccoli']]]
const profiles = { morgenmad: breakfast, frokost: lunch, aftensmad: dinner,
  mellemmåltid: [['protein', ['Skyr naturel']]] }

// Only explicitly marked, available catalogue foods may seed an empty meal.
// Rotate by day-local use count, then profile order. Unknown meal names retain
// macro-based choices, rotating by use count before density/catalogue order.
// This function never mutates foods or the caller's use counts.
export function suggestFoodItems(foods, targets, { mealName = '', usage = new Map() } = {}) {
  const candidates = foods.filter(food => marked(food)
    && ['energyKcal', 'proteinG', 'carbohydrateG', 'fatG'].every(key => {
      const value = food.nutrientsPer100g?.[key]
      return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10000
    }))
  const type = mealName.trim().toLocaleLowerCase('da-DK').match(/^(morgenmad|frokost|aftensmad|mellemmåltid)(?:\s+\d+)?$/)?.[1]
  const profile = profiles[type]
  const selected = new Set(), used = food => usage.get(food.id) ?? 0
  if (profile) {
    for (const [target, names] of profile) {
      if (!(targets[target] > 0 || target === 'protein' && targets.fat > 0)) continue
      const options = names.map(name => candidates.find(food => food.id === id(name))).filter(food => food
        && roles.some(([key, nutrient]) => (key === target || target === 'protein' && key === 'fat')
          && targets[key] > 0 && food.nutrientsPer100g[nutrient] > 0))
      const best = options.filter(food => !selected.has(food.id)).sort((a, b) => used(a) - used(b))[0]
      if (best) selected.add(best.id)
    }
  } else {
    for (const [target, nutrient] of roles) {
      if (!(targets[target] > 0)) continue
      const options = candidates.filter(food => !selected.has(food.id) && food.nutrientsPer100g[nutrient] > 0)
      options.sort((a, b) => used(a) - used(b) || b.nutrientsPer100g[nutrient] - a.nutrientsPer100g[nutrient])
      if (options[0]) selected.add(options[0].id)
    }
  }
  return [...selected].map(foodId => ({ foodId, ...SUGGESTION_POLICY }))
}
