import { dayNumber } from './dataEnough.mjs'
const prefix = '[appData2-day-v1]'
export const isDayReceipt = row => typeof row?.meal === 'string' && row.meal.startsWith(prefix)
// Compare the full multiset, including nutrient values. Editing, adding or
// deleting a meal invalidates the earlier explicit confirmation.
function signature(rows) {
  return JSON.stringify(rows.filter(r => !isDayReceipt(r)).map(r => [
    r.id, r.date, r.meal, r.kcal, r.protein, r.carb, r.fat,
  ]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))))
}
export function dayReceipt(rows, date, today) {
  if (dayNumber(date) === null || dayNumber(today) === null || date >= today || !rows.length ||
      rows.some(r => r.date !== date || !Number.isFinite(r.kcal) || r.kcal < 0)) return null
  return { date, meal: prefix + signature(rows), kcal: 0, protein: 0, carb: 0, fat: 0 }
}
export function confirmedMealDays(rows) {
  const dates = [...new Set(rows.map(r => r.date))]
  return dates.flatMap(date => {
    const all = rows.filter(r => r.date === date), meals = all.filter(r => !isDayReceipt(r))
    if (!meals.length || meals.some(r => !Number.isFinite(r.kcal) || r.kcal < 0) ||
        !all.some(r => isDayReceipt(r) && r.meal === prefix + signature(meals))) return []
    return [{ date, kcal: meals.reduce((n, r) => n + r.kcal, 0), completeDay: true }]
  })
}
