const text = value => typeof value === 'string'
  ? value.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().replace(/\s+/g, ' ')
  : ''
const key = value => text(value).toLocaleLowerCase('da-DK')

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
    for (const ingredient of meal.ingredients) {
      const name = text(ingredient?.name), unit = key(ingredient?.unit)
      const raw = ingredient?.quantity
      const quantity = typeof raw === 'number' ? raw
        : typeof raw === 'string' && /^\d+(?:[.,]\d+)?$/.test(raw.trim()) ? Number(raw.trim().replace(',', '.')) : NaN
      if (!name || !unit || !Number.isFinite(quantity) || quantity <= 0) {
        throw new TypeError('Ingredienser skal have navn, positiv mængde og enhed')
      }
      // Tuple encoding avoids delimiter collisions. Different units stay separate.
      const identity = JSON.stringify([key(name), unit])
      const previous = items.get(identity)
      const total = (previous?.quantity || 0) + quantity
      if (!Number.isFinite(total)) throw new TypeError('Den samlede mængde er for stor')
      items.set(identity, { name: previous?.name || name, unit, quantity: total })
    }
  }
  return { items: [...items.values()], missingMeals, selectedCount: ids.length }
}
