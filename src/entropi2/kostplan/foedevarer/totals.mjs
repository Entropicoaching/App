import { createFood, isAmount, NUTRIENTS } from './catalog.mjs'

const keys = Object.keys(NUTRIENTS)
function add(left, right) {
  const sum = left + right
  if (!Number.isFinite(sum)) throw new RangeError('Næringsberegning overstiger talområdet')
  return sum
}

// A portion is { food, grams }. Numeric parsing belongs to the future UI boundary.
// Zero grams do not establish intake or turn missing food data into known zeros.
export function sumMeal(portions = []) {
  if (!Array.isArray(portions)) throw new TypeError('Måltid skal være en liste af portioner')
  const nutrients = Object.fromEntries(keys.map(key => [key, {
    value: null, knownSubtotal: 0, knownGrams: 0, missingGrams: 0,
    missingPortions: 0, complete: false,
  }]))
  let grams = 0, activePortionCount = 0
  for (const portion of portions) {
    if (!portion || !isAmount(portion.grams)) throw new TypeError('Gram skal være et endeligt, ikke-negativt tal')
    if (portion.food?.basisGrams !== 100) throw new TypeError('Fødevarens basis skal være 100 g')
    const food = createFood(portion.food)
    if (portion.grams === 0) continue
    grams = add(grams, portion.grams)
    activePortionCount++
    for (const key of keys) {
      const result = nutrients[key], per100g = food.nutrientsPer100g[key]
      if (per100g === null) {
        result.missingGrams = add(result.missingGrams, portion.grams)
        result.missingPortions++
      } else {
        result.knownSubtotal = add(result.knownSubtotal, per100g * (portion.grams / 100))
        result.knownGrams = add(result.knownGrams, portion.grams)
      }
    }
  }
  for (const value of Object.values(nutrients)) {
    value.complete = activePortionCount > 0 && value.missingPortions === 0
    value.value = value.complete ? value.knownSubtotal : null
  }
  return { portionCount: portions.length, activePortionCount, grams, hasData: activePortionCount > 0, nutrients }
}

// Pass only meals belonging to the selected day. No dates, storage or logs read here.
// Flatten portions before summing; never round individual portions or meal totals.
export function sumDay(meals = []) {
  if (!Array.isArray(meals)) throw new TypeError('Dag skal være en liste af måltider')
  const portions = []
  for (const meal of meals) {
    if (!Array.isArray(meal)) throw new TypeError('Dag skal være en liste af måltider')
    // for..of keeps holes as undefined so malformed portions are not dropped.
    for (const portion of meal) portions.push(portion)
  }
  return { ...sumMeal(portions), mealCount: meals.length }
}

// Recommendations are explicit daily ranges, not universal athlete prescriptions.
// An unknown total cannot support a claim of dietary deficiency or adequacy.
export function compareDayToRecommendations(meals, recommendations = []) {
  const day = sumDay(meals)
  if (!Array.isArray(recommendations)) throw new TypeError('Anbefalinger skal være en liste')
  const seen = new Set()
  const assessment = Array.from(recommendations, recommendation => {
    const { nutrient, min, max, unit, source } = recommendation ?? {}
    if (!Object.hasOwn(NUTRIENTS, nutrient) || unit !== NUTRIENTS[nutrient].unit ||
        typeof source !== 'string' || !source.trim() || seen.has(nutrient) ||
        (min === undefined && max === undefined) ||
        (min !== undefined && !isAmount(min)) || (max !== undefined && !isAmount(max)) ||
        (min !== undefined && max !== undefined && min > max)) {
      throw new TypeError('Ugyldig eller gentaget dagsanbefaling')
    }
    seen.add(nutrient)
    const actual = day.nutrients[nutrient].value
    const status = actual === null ? 'unknown' : min !== undefined && actual < min ? 'below'
      : max !== undefined && actual > max ? 'above' : 'within'
    return { nutrient, unit, source, min: min ?? null, max: max ?? null,
      actual, status, deficit: status === 'below' ? min - actual : actual === null ? null : 0 }
  })
  return { day, assessment, unassessed: keys.filter(key => !seen.has(key)) }
}
