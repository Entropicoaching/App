import { MICRONUTRIENTS } from './foedevarer/catalog.mjs'
import { parseInputNumber, nutritionValues } from '../../athlete/kostNumbers.mjs'

const KEYS = ['kcal', 'protein', 'carb', 'fat']
const text = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 200
const number = (value, max) => {
  const result = parseInputNumber(value)
  if (result === null || result > max) throw new TypeError('Ugyldig næringsværdi eller gramvægt')
  return result
}

// Same kcal100/protein100/carb100/fat100 contract as lokaleFoedevarer.js and
// nutrition/controller.foodPortion. Reuse the application's numeric parser and
// final display rounding, but sum unrounded ingredient values before rounding.
function itemNutrition(item) {
  if (!text(item?.food?.name)) throw new TypeError('Konkret fødevarenavn kræves')
  const grams = number(item.grams, 10000)
  if (grams <= 0) throw new TypeError('Gram skal være større end nul')
  const food = { name: item.food.name.trim() }
  const raw = Object.fromEntries(KEYS.map(key => {
    const value = number(item.food[key + '100'], key === 'kcal' ? 10000 : 100)
    food[key + '100'] = value
    return [key, value * grams / 100]
  }))
  if (item.food.micronutrients100 != null) {
    const micro = item.food.micronutrients100
    if (typeof micro !== 'object' || Array.isArray(micro) || Object.keys(micro).length > 50) throw new TypeError('Ugyldige mikronæringsstoffer')
    food.micronutrients100 = Object.fromEntries(Object.entries(micro).map(([key, nutrient]) => {
      if (!/^[a-zA-Z][a-zA-Z0-9_]{0,49}$/.test(key) || !['g', 'mg', 'ug'].includes(nutrient?.unit)) throw new TypeError('Mikronæringsstof kræver entydigt navn og enhed')
      if (Object.hasOwn(MICRONUTRIENTS, key) && nutrient.unit !== MICRONUTRIENTS[key].unit) {
        throw new TypeError('Ugyldige enheder for mikronæringsstof: ' + key)
      }
      if (nutrient.source != null && (typeof nutrient.source !== 'string' || nutrient.source.length > 200)) {
        throw new TypeError('Mikronæringsstof kræver en navngiven kilde på højst 200 tegn')
      }
      const source = nutrient.source?.trim() || null
      const value = nutrient.value == null ? null : number(nutrient.value, 1000000)
      // Older snapshots without provenance remain readable, but cannot supply a total.
      return [key, { value: source ? value : null, unit: nutrient.unit, source }]
    }))
  }
  return { food, grams, raw }
}

function summarize(items) {
  const totals = nutritionValues(Object.fromEntries(KEYS.map(key => [key, items.reduce((sum, item) => sum + item.raw[key], 0)])))
  if (!totals) throw new TypeError('Næringssum kan ikke repræsenteres')
  const names = [...new Set([...Object.keys(MICRONUTRIENTS),
    ...items.flatMap(item => Object.keys(item.food.micronutrients100 || {}))])].sort()
  const micronutrients = Object.fromEntries(names.map(name => {
    const entries = items.map(item => ({ item, nutrient: item.food.micronutrients100?.[name] }))
    const present = entries.filter(entry => entry.nutrient)
    const unit = present[0]?.nutrient.unit ?? MICRONUTRIENTS[name].unit
    if (present.some(entry => entry.nutrient.unit !== unit)) throw new TypeError('Blandede enheder for samme mikronæringsstof')
    const known = present.filter(({ nutrient }) => nutrient.value !== null && nutrient.source)
    const complete = items.length > 0 && known.length === items.length
    return [name, { unit, value: complete
      ? known.reduce((sum, { item, nutrient }) => sum + nutrient.value * item.grams / 100, 0) : null,
    knownItems: known.length, totalItems: items.length,
    status: complete ? 'complete' : 'insufficient-data',
    sources: [...new Set(known.map(({ nutrient }) => nutrient.source))] }]
  }))
  return { totals, micronutrients }
}

/** Concrete food snapshots, grams, macros and optional micronutrients; no I/O. */
export function calculateMeals(meals) {
  if (!Array.isArray(meals) || meals.length > 20) throw new TypeError('Højst 20 måltider')
  const ids = new Set(), all = []
  const result = meals.map(meal => {
    if (!text(meal?.id) || ids.has(meal.id) || !text(meal.name) || !Array.isArray(meal.items)
      || meal.items.length < 1 || meal.items.length > 100) throw new TypeError('Måltid kræver unikt id, navn og 1–100 fødevarer')
    ids.add(meal.id)
    const items = meal.items.map(itemNutrition)
    all.push(...items)
    return { id: meal.id, name: meal.name.trim(),
      items: items.map(({ food, grams }) => ({ food, grams })), ...summarize(items) }
  })
  return { meals: result, ...summarize(all) }
}
