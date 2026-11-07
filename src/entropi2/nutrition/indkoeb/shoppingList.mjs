import { readIngredients, massIngredient, ingredientKey, quantityNumber, ingredientText as text } from './ingredients.mjs'

// ownMeals must be supplied from the current user's own local collection.
// No ingredients are inferred from meal names or macro totals.
export function buildShoppingList(ownMeals, selectedIds) {
  if (!Array.isArray(ownMeals) || !Array.isArray(selectedIds)) throw new TypeError('Ugyldigt måltidsvalg')
  const meals = new Map()
  for (const meal of ownMeals) {
    if (!meal || typeof meal.id !== 'string' || !meal.id.trim() || meals.has(meal.id)) {
      throw new TypeError('Måltider skal have entydige id’er')
    }
    meals.set(meal.id, meal)
  }
  const items = new Map(), missingMeals = []
  const ids = [...new Set(selectedIds)]
  for (const id of ids) {
    const meal = meals.get(id)
    if (!meal) throw new TypeError('Et valgt måltid findes ikke i egne måltider')
    if (!Array.isArray(meal.ingredients) || !meal.ingredients.length) {
      missingMeals.push({ id, meal: text(meal.meal) || 'Eget måltid' })
      continue
    }
    const portions = meal.portions === undefined ? 1 : quantityNumber(meal.portions)
    if (!Number.isFinite(portions) || portions <= 0 || portions > 1000) throw new TypeError('Ugyldigt portionsantal')
    for (const ingredient of readIngredients(meal.ingredients)) {
      const normalized = massIngredient(ingredient), identity = ingredientKey(normalized)
      const previous = items.get(identity)
      const total = (previous?.quantity || 0) + normalized.quantity * portions
      if (!Number.isFinite(total)) throw new TypeError('Den samlede mængde er for stor')
      items.set(identity, { ...normalized, name: previous?.name || normalized.name, quantity: total })
    }
  }
  return { items: [...items.values()], missingMeals, selectedCount: ids.length }
}
