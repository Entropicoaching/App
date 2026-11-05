import { FOODS } from '../foedevarer/catalog.mjs'
import { calculateMeals } from '../foedevarer.mjs'
import { solvePortions } from './solver.mjs'
import { suggestFoodItems } from './suggestions.mjs'

const KEYS = ['kcal', 'protein', 'carb', 'fat']
const NUTRIENTS = ['energyKcal', 'proteinG', 'carbohydrateG', 'fatG']
const catalog = new Map(FOODS.map(food => [food.id, food]))
const amount = (value, max) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max
const text = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 200
export const GENERATOR_POLICY = Object.freeze({
  version: 'gramplan-v1', stepGrams: 5, maxMeals: 8, maxItemsPerMeal: 12, maxItems: 64,
  maxPortionGrams: 1000, relativeTolerance: 0.05,
  absoluteTolerance: Object.freeze({ kcal: 50, protein: 5, carb: 10, fat: 3 }),
})

/** Pure draft generator. Bounds are explicit editorial choices, never nutrition data. */
export function generateGramPlan(input) {
  const { targets, mealCount, meals, prioritizedFoodIds = [], availableFoodIds } = input ?? {}
  if (!targets || KEYS.some(key => !amount(targets[key], key === 'kcal' ? 100000 : 10000)) || targets.kcal === 0) {
    throw new TypeError('Dagens mål kræver kendte tal: kcal, protein, carb og fat')
  }
  if (!Number.isInteger(mealCount) || mealCount < 1 || mealCount > GENERATOR_POLICY.maxMeals
    || !Array.isArray(meals) || meals.length !== mealCount) throw new TypeError('Antal måltider skal svare til 1–8 måltider')
  if (availableFoodIds !== undefined && (!Array.isArray(availableFoodIds)
    || availableFoodIds.length > FOODS.length || new Set(availableFoodIds).size !== availableFoodIds.length
    || Array.from(availableFoodIds).some(id => !catalog.has(id)))) throw new TypeError('Tilgængelige fødevarer kræver unikke katalog-id’er')
  const available = availableFoodIds === undefined ? null : new Set(availableFoodIds)
  const suggestionFoods = FOODS.filter(food => !available || available.has(food.id))
  // Count all explicit choices first, including later meals, so automatic
  // choices can vary around them without replacing any coach selection.
  const usage = new Map()
  for (const meal of meals) if (Array.isArray(meal?.items)) for (const item of meal.items) {
    if (catalog.has(item?.foodId)) usage.set(item.foodId, (usage.get(item.foodId) ?? 0) + 1)
  }
  const ids = new Set(), selected = new Set(), rows = []
  const normalizedMeals = Array.from(meals, (meal, mealIndex) => {
    if (!text(meal?.id) || ids.has(meal.id) || !text(meal.name) || !Array.isArray(meal.items)
      || meal.items.length > GENERATOR_POLICY.maxItemsPerMeal) throw new TypeError('Måltid kræver unikt id, navn og højst 12 fødevarer')
    ids.add(meal.id)
    const seen = new Set()
    const suggested = meal.items.length ? null : suggestFoodItems(suggestionFoods, targets, { mealName: meal.name, usage })
    Array.from(suggested ?? meal.items, item => {
      const food = catalog.get(item?.foodId)
      if (!food || seen.has(food.id)) throw new TypeError('Vælg et kendt katalog-id én gang pr. måltid')
      seen.add(food.id); selected.add(food.id)
      if (suggested) usage.set(food.id, (usage.get(food.id) ?? 0) + 1)
      const { minGrams, maxGrams } = item
      if (!amount(minGrams, 1000) || !amount(maxGrams, 1000) || minGrams < 5 || minGrams > maxGrams
        || minGrams % 5 || maxGrams % 5) throw new TypeError('Hver fødevare kræver min/max i trin på 5 g mellem 5 og 1000 g')
      const macros = NUTRIENTS.map(key => food.nutrientsPer100g[key])
      if (macros.some(value => !amount(value, 10000))) throw new TypeError('Fødevaren mangler kendte makroer pr. 100 g')
      rows.push({ food, foodId: food.id, mealIndex, minGrams, maxGrams, macros, priority: 0 })
    })
    return { id: meal.id, name: meal.name.trim(), items: [] }
  })
  if (rows.length > GENERATOR_POLICY.maxItems) throw new TypeError('Højst 64 fødevareportioner pr. dag')
  if (!Array.isArray(prioritizedFoodIds) || prioritizedFoodIds.length > selected.size
    || new Set(prioritizedFoodIds).size !== prioritizedFoodIds.length
    || Array.from(prioritizedFoodIds).some(id => !selected.has(id))) throw new TypeError('Prioriteter skal være unikke, valgte katalog-id’er')
  for (const row of rows) {
    const rank = prioritizedFoodIds.indexOf(row.foodId)
    row.priority = rank < 0 ? 0 : prioritizedFoodIds.length - rank
  }
  const target = Object.fromEntries(KEYS.map(key => [key, targets[key]]))
  const tolerance = Object.fromEntries(KEYS.map(key => [key,
    Math.max(GENERATOR_POLICY.absoluteTolerance[key], target[key] * GENERATOR_POLICY.relativeTolerance)]))
  if (normalizedMeals.some((_, index) => !rows.some(row => row.mealIndex === index))) {
    return { policyVersion: GENERATOR_POLICY.version, status: 'no-plan', targets: target, tolerance,
      meals: [], totals: null, displayTotals: null, deviation: null, bounds: null,
      message: 'Der er ingen tilgængelige prioriterede fødevarer til et tomt måltid. Vælg fødevarer og portionsgrænser. Der er endnu ingen gramplan.' }
  }
  const grams = solvePortions(rows, KEYS.map(key => target[key]), KEYS.map(key => tolerance[key]))
  const totals = Object.fromEntries(KEYS.map((key, k) => [key,
    rows.reduce((sum, row, i) => sum + row.macros[k] * grams[i] / 100, 0)]))
  const deviation = Object.fromEntries(KEYS.map(key => {
    const delta = totals[key] - target[key]
    return [key, { delta, percent: target[key] === 0 ? null : delta / target[key] * 100,
      withinTolerance: Math.abs(delta) <= tolerance[key] + 1e-9 }]
  }))
  const bounds = Object.fromEntries(KEYS.map((key, k) => {
    const min = rows.reduce((sum, row) => sum + row.macros[k] * row.minGrams / 100, 0)
    const max = rows.reduce((sum, row) => sum + row.macros[k] * row.maxGrams / 100, 0)
    return [key, { min, max, excludesTarget: target[key] < min - tolerance[key] - 1e-9
      || target[key] > max + tolerance[key] + 1e-9 }]
  }))
  rows.forEach((row, i) => normalizedMeals[row.mealIndex].items.push({
    food: { name: row.food.name, ...Object.fromEntries(KEYS.map((key, k) => [key + '100', row.macros[k]])) },
    grams: grams[i],
  }))
  const calculated = calculateMeals(normalizedMeals)
  let offset = 0
  const resultMeals = calculated.meals.map(meal => ({ ...meal, items: meal.items.map(item => {
    const row = rows[offset++]
    return { ...item, foodId: row.foodId, preparation: row.food.preparation, source: { ...row.food.source },
      minGrams: row.minGrams, maxGrams: row.maxGrams,
      ...(row.food.prioritetBegrundelse ? { prioritet: row.food.prioritet, prioritetBegrundelse: row.food.prioritetBegrundelse } : {}) }
  }) }))
  const met = KEYS.every(key => deviation[key].withinTolerance)
  const status = met ? 'matched' : KEYS.some(key => bounds[key].excludesTarget) ? 'infeasible' : 'unmet'
  return { policyVersion: GENERATOR_POLICY.version, status, targets: target, tolerance, meals: resultMeals,
    totals, displayTotals: calculated.totals, deviation, bounds,
    message: met ? 'Planen rammer alle fire mål inden for den viste tolerance. Gennemgå portionerne.'
      : status === 'infeasible' ? 'Målet kan ikke nås inden for tolerancen med de valgte fødevarer og portionsgrænser. Se afvigelserne; vælg andre fødevarer eller grænser.'
        : 'Der blev ikke fundet en plan inden for tolerancen. Se afvigelserne; prøv andre fødevarer eller portionsgrænser. Søgningen beviser ikke, at målet er umuligt.' }
}
