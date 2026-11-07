import { generateGramPlan, GENERATOR_POLICY } from '../generator/index.mjs'
import { FOODS } from '../foedevarer/index.mjs'
import { GOALS, day, number, catalogFoods } from './model.mjs'

const keys = ['kcal', 'protein', 'carb', 'fat']
const foods = catalogFoods(FOODS)

// Only explicitly supplied categories from calculateNutrition's existing contract.
// Missing/partial/invalid input stays unknown; never manufacture a rest day.
export function profileTraining(training) {
  return training && ['rest', 'light', 'moderate', 'high'].includes(training.volume)
    && ['light', 'moderate', 'high'].includes(training.intensity)
    && (training.volume !== 'rest' || training.intensity === 'light')
    ? { volume: training.volume, intensity: training.intensity } : null
}

// Backwards-compatible local calculation metadata, not a new backend field.
export function validProfileCalculation(value, date) {
  return value && value.date === date && value.adult === true && value.profileEstimate === true
    && typeof value.weightKg === 'number' && number(value.weightKg, 350) >= 25
    && Object.keys(value).every(key => ['date', 'adult', 'weightKg', 'profileEstimate', 'training'].includes(key))
    && (value.training === undefined || value.training !== null && profileTraining(value.training) !== null
      && Object.keys(value.training).every(key => ['volume', 'intensity'].includes(key)))
}

// These fields already belong to the selected production profile. A kcal target
// is never treated as maintenance, and unknown age is never treated as adult.
export function profileCalculation(athlete, date) {
  const age = number(athlete?.age, 120), weightKg = number(athlete?.bodyweight, 350)
  const training = profileTraining(athlete?.training)
  return day(date) && date >= '1900-01-01' && date <= '9999-12-24'
    && Number.isInteger(age) && age >= 18 && weightKg >= 25
    && Object.hasOwn(GOALS, athlete?.goal)
    ? { date, adult: true, weightKg, profileEstimate: true, ...(training ? { training } : {}) } : null
}

// Only the catalogue used by the actual generator may supply nutrient values.
// Selected foods keep explicit coach bounds. Empty meals use the generator's
// disclosed draft bounds and only canonically matching, available foods.
export function generateCoachGrams(selection, targets, catalog) {
  const meals = selection.map(meal => ({ id: meal.id, name: meal.name,
    items: meal.items.map(item => {
      const canonical = foods.find(food => food.id === item.foodId)
      const selected = catalog.find(food => food.id === item.foodId)
      if (!canonical || !selected || keys.some(key => canonical.per100g[key] !== selected.per100g[key]))
        throw TypeError('Fødevaren stemmer ikke med generatorens katalog.')
      return { foodId: item.foodId, minGrams: number(item.minGrams, 1000), maxGrams: number(item.maxGrams, 1000) }
    }) }))
  const availableFoodIds = catalog.filter(selected => {
    const canonical = foods.find(food => food.id === selected.id)
    return canonical && keys.every(key => canonical.per100g[key] === selected.per100g[key])
  }).map(food => food.id)
  const result = generateGramPlan({ targets, mealCount: meals.length, meals, availableFoodIds })
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
