import { parseInputNumber } from './kostNumbers.mjs'

// Afvis hele skabelonen, saa et enkelt ugyldigt maaltid ikke giver delvis logning.
export function mealTemplateItems(items) {
  if (!Array.isArray(items) || items.length === 0) return null
  const result = []
  for (const item of items) {
    if (!item || typeof item.meal !== 'string' || !item.meal.trim()) return null
    const row = { meal: item.meal }
    for (const key of ['kcal', 'protein', 'carb', 'fat']) {
      const value = parseInputNumber(item[key])
      if (value === null) return null
      row[key] = value
    }
    result.push(row)
  }
  return result
}
