import { RECIPES, recipePortions, scaleRecipe } from '../opskrifter/index.mjs'
import { catalogFoods, totals, number, day, identifier } from './model.mjs'
import { planProteinDistribution } from '../protein/model.mjs'
import { buildNutritionReport } from '../rapport/nutritionReport.mjs'
import { isDayReceipt } from '../../../mealEvidence.mjs'
import { tjekMaaltid } from '../realisme.mjs'

// Recipes resolve the existing catalogue, never nutrient values supplied by UI.
// An injected catalogue must agree with those foods before offering a recipe.
export function recipeChoices(foods) {
  if (!Array.isArray(foods)) return []
  return RECIPES.filter(recipe => recipePortions(recipe).every(({ food }) => {
    const expected = catalogFoods([food])?.[0]
    const actual = foods.find(entry => entry.id === food.id)
    return expected && actual && Object.keys(expected.per100g).every(key => actual.per100g?.[key] === expected.per100g[key])
  }))
}

export function recipeItems(recipeId, foods, kcal) {
  const recipe = recipeChoices(foods).find(entry => entry.id === recipeId)
  if (!recipe) return null
  try {
    const selected = kcal === undefined ? recipe : scaleRecipe(recipe, { nutrient: 'energyKcal', value: kcal })
    const items = recipePortions(selected).map(({ food, grams }) => ({ foodId: food.id, grams }))
    // U1: a scaled recipe must still be a realistic meal before anyone sees it.
    return items.every(item => number(item.grams, 10000) > 0) && tjekMaaltid({ items }).ok ? items : null
  } catch { return null }
}

// The concrete realism problems for a scaled recipe, for the coach's message.
export function recipeProblems(recipeId, foods, kcal) {
  const recipe = recipeChoices(foods).find(entry => entry.id === recipeId)
  if (!recipe || kcal === undefined) return []
  try {
    const items = recipePortions(scaleRecipe(recipe, { nutrient: 'energyKcal', value: kcal }))
      .map(({ food, grams }) => ({ foodId: food.id, grams }))
    return tjekMaaltid({ items }).problemer
  } catch { return [] }
}

// Weight is the selected athlete's explicit profile weight. Missing/invalid
// weight, changed goals or unsupported slot counts mean no heuristic marks.
export function proteinDistribution(meals, planTargets, weightKg) {
  const weight = number(weightKg, 350)
  if (!(weight >= 25) || !planTargets || !Array.isArray(meals) || meals.length < 3 || meals.length > 5) return null
  try {
    return planProteinDistribution({ weightKg: weight, dailyProteinG: planTargets.protein, allowedFoodIds: [],
      meals: meals.map(meal => ({ id: meal.id, name: meal.name, timing: 'daytime', proteinG: totals([meal])?.protein ?? null })) })
  } catch { return null }
}

// No new query or fabricated activation history. This boundary accepts only a
// completed, scoped read with saved plan history and logged meals in the week.
// Never compare a device draft to historical logs.
export function portalNutritionReport(options = {}) {
  if (options.enabled !== true) return null
  const { athleteId, coachId, date, receipt } = options
  if (!identifier(athleteId) || !identifier(coachId) || !day(date) || date < '1900-01-01' || date > '9999-12-24'
    || !receipt || receipt.athleteId !== athleteId || receipt.coachId !== coachId || receipt.date !== date
    || receipt.state !== 'ready' || receipt.complete !== true || !Array.isArray(receipt.mealLogs)) return null
  const stamp = Date.parse(`${date}T00:00:00Z`)
  const from = new Date(stamp - (new Date(stamp).getUTCDay() + 6) % 7 * 86400000).toISOString().slice(0, 10)
  const hasLog = receipt.mealLogs.some(row => row?.athlete_id === athleteId && day(row.date) && row.date >= from && row.date <= date
    && typeof row.meal === 'string' && row.meal.trim() && !isDayReceipt({ meal: row.meal.trimStart() }))
  if (!hasLog) return null
  try {
    // An explicit unavailable capability means there is no production history
    // to compare. Missing reads are not silently turned into empty lists.
    if (receipt.planHistory === 'unavailable') return null
    const plans = receipt.plans
    const report = buildNutritionReport({ enabled: true, athleteId, date, plans,
      mealLogs: receipt.mealLogs, weightLogs: receipt.weightLogs })
    const hasPlan = report.week.plannedDays > 0 || report.week.conflictDays > 0
    return report.week.loggedDays > 0 && hasPlan ? { state: 'ready', report } : null
  } catch { return { state: 'error' } }
}
