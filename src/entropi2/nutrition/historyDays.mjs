import { parseInputNumber, calendarTime } from '../../athlete/kostNumbers.mjs'
import { mealTemplateItems } from '../../athlete/kostSkabeloner.mjs'
import { isDayReceipt } from '../../mealEvidence.mjs'

// Pure snapshot projection. Dates are ISO calendar dates; malformed dates are ignored.
// Unknown meal data invalidates both daily sums, as in the nutrition controller.
// Targets use snapshot keys (kcal/protein); absent, invalid or zero goals stay unknown.
export function historyDays(historyRows, targets) {
  const goals = Object.fromEntries(['kcal', 'protein'].map(key => {
    const value = parseInputNumber(targets?.[key])
    return [key, value > 0 ? value : null]
  }))
  const days = new Map()
  for (const row of Array.isArray(historyRows) ? historyRows : []) {
    if (isDayReceipt(row) || calendarTime(row?.date) === null) continue
    let day = days.get(row.date)
    if (!day) {
      day = { date: row.date, count: 0, kcal: 0, protein: 0 }
      days.set(row.date, day)
    }
    day.count++
    const meal = mealTemplateItems([row])?.[0]
    if (!meal || isDayReceipt({ meal: meal.meal.trimStart() }) || day.kcal === null) {
      day.kcal = day.protein = null
      continue
    }
    const kcal = day.kcal + meal.kcal, protein = day.protein + meal.protein
    if (!Number.isFinite(kcal) || !Number.isFinite(protein)) {
      day.kcal = day.protein = null
    } else {
      day.kcal = kcal
      day.protein = protein
    }
  }
  return [...days.values()].sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0)
    .map(day => ({ ...day, reached: Object.fromEntries(['kcal', 'protein'].map(key => [
      key, day[key] === null || goals[key] === null ? null : day[key] + 1e-9 >= goals[key],
    ])) }))
}
