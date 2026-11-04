import { calculateNutrition } from '../beregning.mjs'
import { createFood, sumDay } from '../foedevarer/index.mjs'

// Isolated contract. No client, storage, clock, environment or default food data.
export const NAMESPACE = 'entropi2:kostplan:coach:v1'
export const GOALS = Object.freeze({ bulk: 'Bulk', maintain: 'Vedligehold', cut: 'Cut' })
export const INTENSITIES = Object.freeze([5, 10, 15])
export const CONTEXT_LABELS = Object.freeze({
  weightTrend: 'Vægttrend', training: 'Træning: volumen og intensitet',
  foodLog: 'Kostlog', readiness: 'Dagsform', competition: 'Stævnedato', experience: 'Tidligere erfaringer',
})
export const copy = value => structuredClone(value)
export function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}
export const identifier = value => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 160
export const label = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 200
export function day(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const time = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
}
export function number(value, max = 100000) {
  if (typeof value === 'string') {
    if (!/^\d+(?:[.,]\d+)?$/.test(value.trim())) return null
    value = Number(value.trim().replace(',', '.'))
  }
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max ? value : null
}
const positive = (value, max) => { const n = number(value, max); return n > 0 ? n : null }
const macroKeys = ['kcal', 'protein', 'carb', 'fat']
const nutrientKeys = { kcal: 'energyKcal', protein: 'proteinG', carb: 'carbohydrateG', fat: 'fatG' }
export function macros(value) {
  if (!value || macroKeys.some(key => number(value[key]) === null)) return null
  return Object.fromEntries(macroKeys.map(key => [key, number(value[key])]))
}
export function catalogFoods(catalog) {
  if (!Array.isArray(catalog) || catalog.length === 0 || catalog.length > 300) return null
  const ids = new Set(), result = []
  for (const food of catalog) {
    const canonical = food?.nutrientsPer100g != null
    const per100g = macros(canonical
      ? Object.fromEntries(macroKeys.map(key => [key, food.nutrientsPer100g[nutrientKeys[key]]]))
      : food?.per100g ?? Object.fromEntries(macroKeys.map(key => [key, food?.[key + '100']])))
    if (!identifier(food?.id) || !label(food.name) || !per100g || ids.has(food.id)) return null
    let nutrition
    try {
      if (canonical && food.basisGrams !== 100) return null
      nutrition = createFood(canonical ? food : {
        id: food.id, name: food.name.trim(), preparation: 'as-named; otherwise unspecified',
        nutrientsPer100g: Object.fromEntries(macroKeys.map(key => [nutrientKeys[key], per100g[key]])),
        source: { citation: 'Coach-supplied food snapshot', verification: 'unverified' },
      })
      if (food.nutrition != null) {
        const retained = createFood(food.nutrition)
        if (retained.id !== food.id || retained.name.trim() !== food.name.trim()
          || macroKeys.some(key => retained.nutrientsPer100g[nutrientKeys[key]] !== per100g[key])) return null
        nutrition = retained
      }
    } catch { return null }
    ids.add(food.id)
    result.push({ id: food.id, name: food.name.trim(), per100g, nutrition })
  }
  return result
}
export function nutritionProposal(form, calculation) {
  if (!calculation || !Object.hasOwn(GOALS, form.goal) || !INTENSITIES.includes(form.intensity)) return null
  const maintenanceKcal = number(form.maintenanceKcal)
  if (maintenanceKcal === null || maintenanceKcal <= 0) return null
  try {
    return calculateNutrition({ ...calculation, goal: form.goal,
      intensity: { 5: 'light', 10: 'moderate', 15: 'aggressive' }[form.intensity], maintenanceKcal })
  } catch { return null }
}
export function targets(form, calculation) {
  if (calculation !== undefined) return nutritionProposal(form, calculation)?.targets ?? null
  const maintenance = positive(form.maintenanceKcal), protein = positive(form.protein), fat = number(form.fat)
  if (!Object.hasOwn(GOALS, form.goal) || !INTENSITIES.includes(form.intensity)) return null
  if (maintenance === null || protein === null || fat === null) return null
  const direction = form.goal === 'bulk' ? 1 : form.goal === 'cut' ? -1 : 0
  const kcal = Math.round(maintenance * (1 + direction * form.intensity / 100))
  const carb = (kcal - protein * 4 - fat * 9) / 4
  return kcal > 0 && kcal <= 100000 && carb >= 0 ? { kcal, protein, carb, fat } : null
}
export function totals(meals) {
  if (!Array.isArray(meals) || meals.length === 0 || meals.length > 12) return null
  const portions = []
  const mealIds = new Set()
  for (const meal of meals) {
    if (!identifier(meal?.id) || mealIds.has(meal.id) || !label(meal.name)
      || !Array.isArray(meal.items) || meal.items.length === 0 || meal.items.length > 30) return null
    mealIds.add(meal.id)
    const mealPortions = [], foodIds = new Set()
    for (const item of meal.items) {
      const grams = positive(item?.grams, 10000), food = item?.food
      const per100g = macros(food?.per100g)
      if (grams === null || !identifier(food?.id) || !label(food.name) || !per100g) return null
      if (foodIds.has(food.id)) return null
      foodIds.add(food.id)
      const normalized = catalogFoods([food])?.[0]
      if (!normalized) return null
      // Persisted snapshots retain the canonical food, including unknown micros.
      mealPortions.push({ grams, food: normalized.nutrition })
    }
    portions.push(mealPortions)
  }
  try {
    const result = sumDay(portions)
    const sum = Object.fromEntries(macroKeys.map(key => [key, result.nutrients[nutrientKeys[key]].value]))
    return Object.values(sum).every(value => typeof value === 'number' && Number.isFinite(value)) ? sum : null
  } catch { return null }
}
export function generateMeals(template, catalog, kcal) {
  if (!Array.isArray(template) || !Array.isArray(catalog) || positive(kcal) === null) return null
  const meals = template.map(meal => ({ id: meal?.id, name: meal?.name,
    items: Array.isArray(meal?.items) ? meal.items.map(item => ({ grams: item?.grams,
      food: copy(catalog.find(food => food.id === item?.foodId) ?? null) })) : [] }))
  const base = totals(meals)
  if (!base || base.kcal <= 0) return null
  for (const meal of meals) for (const item of meal.items)
    item.grams = Math.max(1, Math.round(number(item.grams) * kcal / base.kcal))
  return totals(meals) ? meals : null
}
export function normalizePlan(raw, athleteId) {
  if (raw?.namespace !== NAMESPACE || raw.athleteId !== athleteId || !identifier(raw.id)
    || !identifier(raw.revision) || !day(raw.date) || !['draft', 'active', 'archived'].includes(raw.status)
    || !Object.hasOwn(GOALS, raw.goal) || !INTENSITIES.includes(raw.intensity)) return null
  const goal = macros(raw.targets)
  if (!goal || goal.kcal <= 0 || !totals(raw.meals)) return null
  return { namespace: NAMESPACE, athleteId, id: raw.id, revision: raw.revision,
    date: raw.date, status: raw.status, goal: raw.goal, intensity: raw.intensity, targets: goal,
    meals: raw.meals.map(meal => ({ id: meal.id, name: meal.name.trim(),
      items: meal.items.map(item => ({ grams: number(item.grams), food: {
        id: item.food.id, name: item.food.name.trim(), per100g: macros(item.food.per100g),
        ...(item.food.nutrition ? { nutrition: copy(catalogFoods([item.food])[0].nutrition) } : {}),
      } })) })) }
}
export function historyReceipt(receipt, athleteId) {
  const failure = state => ({ athleteId, state, plans: [], responses: [] })
  if (!receipt || receipt.state === 'loading') return failure('loading')
  if (receipt.athleteId !== athleteId || receipt.state !== 'ready'
    || !Array.isArray(receipt.plans) || !Array.isArray(receipt.responses)
    || receipt.plans.length > 200 || receipt.responses.length > 1000) return failure('error')
  const plans = receipt.plans.map(plan => normalizePlan(plan, athleteId))
  if (plans.some(plan => !plan) || new Set(plans.map(plan => plan.id)).size !== plans.length) return failure('error')
  const activeDays = plans.filter(plan => plan.status === 'active').map(plan => plan.date)
  if (new Set(activeDays).size !== activeDays.length) return failure('error')
  const responses = []
  for (const row of receipt.responses) {
    if (row?.athleteId !== athleteId || !plans.some(plan => plan.id === row.planId)
      || !day(row.date) || !label(row.text)) return failure('error')
    responses.push({ athleteId, planId: row.planId, date: row.date, text: row.text.trim() })
  }
  return { athleteId, state: 'ready', plans: plans.sort((a, b) => b.date.localeCompare(a.date)), responses }
}
