import { parseInputNumber } from '../../../athlete/kostNumbers.mjs'

export const PROTEIN_GUIDANCE = Object.freeze({
  minMeals: 3, maxMeals: 5, minGrams: 20, maxGrams: 40,
})

// Caller supplies one entry per meal for ONE athlete and diary date.
// Never group by name: repeated names can describe separate meals.
// Missing collection means unavailable; [] means no registered meals.
export function proteinDistribution(meals) {
  if (!Array.isArray(meals)) return {
    status: 'unavailable', meals: [], mealCount: null, unknownCount: null,
    knownProtein: null, totalProtein: null, guidance: PROTEIN_GUIDANCE,
  }
  const entries = Array.from(meals, (meal, index) => {
    const protein = parseInputNumber(meal?.protein)
    return {
      label: typeof meal?.meal === 'string' && meal.meal.trim()
        ? meal.meal.trim() : `Måltid ${index + 1}`,
      protein,
      range: protein === null ? 'unknown'
        : protein < PROTEIN_GUIDANCE.minGrams ? 'below'
          : protein > PROTEIN_GUIDANCE.maxGrams ? 'above' : 'within',
    }
  })
  const unknownCount = entries.filter(meal => meal.protein === null).length
  const sum = entries.reduce((total, meal) => total + (meal.protein ?? 0), 0)
  // Do not turn overflow or an incomplete diary into an exact daily total.
  const knownProtein = Number.isFinite(sum) ? sum : null
  return {
    status: entries.length === 0 ? 'empty' : 'recorded',
    meals: entries, mealCount: entries.length, unknownCount, knownProtein,
    totalProtein: unknownCount === 0 ? knownProtein : null,
    guidance: PROTEIN_GUIDANCE,
  }
}
