import { createAthleteDay, mealKey } from './dayModel.mjs'

export const athleteId = 'synthetic-athlete', date = '2026-11-04'
export function source() {
  return { plan: { id: 'synthetic-plan', revision: 'r1', active: true, athlete_id: athleteId, date,
    targets: { kcal: 2200, protein: 140, carb: 260, fat: 70 },
    meals: [{ id: 'lunch', name: 'Frokost <test>', foods: [
      { id: 'rice', name: 'Ris', grams: 200, kcal100: 130, protein100: 3, carb100: 28, fat100: 0 },
      { id: 'chicken', name: 'Kylling', grams: 100, kcal100: 150, protein100: 30, carb100: 0, fat100: 3 },
      { id: 'veg', name: 'Grøntsager', grams: 50, kcal100: 20, protein100: 2, carb100: 4, fat100: 0 },
    ] }, { id: 'snack', name: 'Mellemmåltid', foods: [
      { id: 'apple', name: 'Æble', grams: 100, kcal100: 50, protein100: 0, carb100: 12, fat100: 0 },
    ] }] }, logs: [], eaten: [] }
}
export function setup(options = {}) {
  let value = options.value ?? source()
  const calls = [], loads = []
  const model = createAthleteDay({ enabled: true, athleteId, date,
    loadDay: async scope => { loads.push(scope); return value },
    saveMeal: async payload => { calls.push(payload); return true }, ...options })
  return { model, calls, loads, value, setSource(next) { value = next } }
}
export function persisted(payload, rowId = 'synthetic-log') {
  return { log: { id: rowId, athlete_id: payload.athlete_id, date: payload.date, ...payload.log },
    receipt: { key: payload.key, meal_id: payload.meal_id, log_id: rowId,
      foods: payload.foods.map(({ id, grams }) => ({ id, grams })) } }
}
export function consumed(value = source()) {
  const plan = value.plan, meal = plan.meals[1], key = mealKey(athleteId, date, plan, meal.id)
  value.logs.push({ id: 'synthetic-eaten', athlete_id: athleteId, date, meal: meal.name,
    kcal: 50, protein: 0, carb: 12, fat: 0 })
  value.eaten.push({ key, meal_id: meal.id, log_id: 'synthetic-eaten', foods: [{ id: 'apple', grams: 100 }] })
  return value
}
export function deferred() {
  let resolve, reject
  const promise = new Promise((a, b) => { resolve = a; reject = b })
  return { promise, resolve, reject }
}
