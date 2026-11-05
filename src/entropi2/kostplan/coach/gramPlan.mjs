import { generateGramPlan, GENERATOR_POLICY } from '../generator/index.mjs'
import { FOODS } from '../foedevarer/index.mjs'
import { GOALS, day, number, catalogFoods } from './model.mjs'

const keys = ['kcal', 'protein', 'carb', 'fat']
const foods = catalogFoods(FOODS)

// These fields already belong to the selected production profile. A kcal target
// is never treated as maintenance, and unknown age is never treated as adult.
export function profileCalculation(athlete, date) {
  const age = number(athlete?.age, 120), weightKg = number(athlete?.bodyweight, 350)
  return day(date) && date >= '1900-01-01' && date <= '9999-12-24'
    && Number.isInteger(age) && age >= 18 && weightKg >= 25
    && Object.hasOwn(GOALS, athlete?.goal)
    ? { date, adult: true, weightKg, profileEstimate: true } : null
}

// Only the catalogue used by the actual generator may supply nutrient values.
// Bounds are explicit coach input, never guessed from food type or old grams.
export function generateCoachGrams(selection, targets, catalog) {
  const meals = selection.map(meal => ({ id: meal.id, name: meal.name,
    items: meal.items.map(item => {
      const canonical = foods.find(food => food.id === item.foodId)
      const selected = catalog.find(food => food.id === item.foodId)
      if (!canonical || !selected || keys.some(key => canonical.per100g[key] !== selected.per100g[key]))
        throw TypeError('Fødevaren stemmer ikke med generatorens katalog.')
      return { foodId: item.foodId, minGrams: number(item.minGrams, 1000), maxGrams: number(item.maxGrams, 1000) }
    }) }))
  const result = generateGramPlan({ targets, mealCount: meals.length, meals })
  if (result.status === 'no-plan') throw TypeError(result.message)
  return { result: { status: result.status, message: result.message },
    meals: result.meals.map(meal => ({ id: meal.id, name: meal.name,
      items: meal.items.map(item => ({ food: structuredClone(catalog.find(food => food.id === item.foodId)),
        grams: item.grams, minGrams: item.minGrams, maxGrams: item.maxGrams })) })) }
}

export function gramFeedback(totals, targets, result) {
  if (!totals || !targets) return null
  const tolerance = Object.fromEntries(keys.map(key => [key,
    Math.max(GENERATOR_POLICY.absoluteTolerance[key], targets[key] * GENERATOR_POLICY.relativeTolerance)]))
  const deviation = Object.fromEntries(keys.map(key => [key, totals[key] - targets[key]]))
  const matched = keys.every(key => Math.abs(deviation[key]) <= tolerance[key] + 1e-9)
  return { deviation, tolerance, matched, message: result?.message ?? (matched
    ? 'De rettede portioner rammer alle fire mål inden for tolerancen. Gennemgå planen før gemning.'
    : 'De rettede portioner rammer ikke alle fire mål inden for tolerancen. Se afvigelserne; ret gram eller generér igen.') }
}
