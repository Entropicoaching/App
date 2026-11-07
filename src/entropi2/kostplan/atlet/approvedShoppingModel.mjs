import { supportedPlanSnapshot } from '../sqlSnapshot.mjs'
import { upcomingDates } from './upcomingPlanModel.mjs'

export const grossLabel = 'Bruttobehov – lager ikke fratrukket'
export const maxShoppingText = 200000
export const freezeShopping = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freezeShopping); Object.freeze(value)
  }
  return value
}
const invalid = () => { throw new TypeError('Kostplanens indkøbsgrundlag kunne ikke bekræftes.') }
export const shoppingNumber = value => String(value).replace('.', ',')
export const foodKey = food => JSON.stringify([food.id, food.preparation, food.source.citation, food.source.verification])

// Sum canonical decimal gram values without binary-float drift or rounding.
// Inputs are validated positive JSON numbers by the existing snapshot contract.
function decimal(value) {
  const [mantissa, exp = '0'] = String(value).split('e')
  const [whole, fraction = ''] = mantissa.split('.')
  const scale = fraction.length - Number(exp)
  return { units: BigInt(whole + fraction) * 10n ** BigInt(Math.max(0, -scale)), scale: Math.max(0, scale) }
}
function addGrams(before, value) {
  const a = decimal(before), b = decimal(value), scale = Math.max(a.scale, b.scale)
  const units = a.units * 10n ** BigInt(scale - a.scale) + b.units * 10n ** BigInt(scale - b.scale)
  const digits = String(units).padStart(scale + 1, '0')
  return scale ? (digits.slice(0, -scale) + '.' + digits.slice(-scale)).replace(/\.?0+$/, '') : digits
}

export function shoppingDates(today, selected) {
  const window = upcomingDates(today)
  if (!window.length || !Array.isArray(selected) || selected.length > 4
    || new Set(selected).size !== selected.length || selected.some(d => !window.includes(d))) invalid()
  return window.filter(d => selected.includes(d))
}

// Validate the ORIGINAL immutable food snapshots before any normalization.
// The day adapter deliberately projects away identity/state/source; its selected
// revision authorizes this exact secondary read, never a title-based lookup.
export function shoppingVersion(row, active, athleteId, date) {
  if (!row || active?.athlete_id !== athleteId || active.date !== date || active.active !== true
    || row.id !== active.revision || row.plan_id !== active.id
    || !Number.isSafeInteger(row.version_no) || row.version_no < 1
    || !upcomingDates(row.effective_from).length || row.effective_from > date
    || new TextEncoder().encode(JSON.stringify(row)).length > 200000) invalid()
  const snapshot = supportedPlanSnapshot(row)
  if (!snapshot.meals.length || snapshot.meals.length !== active.meals.length) invalid()
  const metrics = [['kcal100', 'energyKcal'], ['protein100', 'proteinG'], ['carb100', 'carbohydrateG'], ['fat100', 'fatG']]
  snapshot.meals.forEach((meal, mi) => {
    const selected = active.meals[mi]
    if (selected?.id !== `${row.id}:meal:${mi}` || selected.name !== meal.name
      || selected.foods?.length !== meal.portions.length) invalid()
    meal.portions.forEach((portion, fi) => {
      const food = selected.foods[fi]
      if (food?.id !== `${row.id}:meal:${mi}:food:${fi}` || food.name !== portion.food.name
        || food.grams !== portion.grams || metrics.some(([key, nutrient]) => food[key] !== portion.food.nutrientsPer100g[nutrient])) invalid()
    })
  })
  return freezeShopping({ date, versionId: row.id, planId: row.plan_id,
    versionNumber: row.version_no, effectiveFrom: row.effective_from, meals: snapshot.meals })
}

// Each selected DATE contributes all planned portions, even when it resolves
// the same version as another date. No consumption/stock or nutrient arithmetic.
export function sumApprovedShopping(today, selected, evidence) {
  const dates = shoppingDates(today, selected), items = new Map()
  if (!dates.length || !Array.isArray(evidence) || evidence.length !== dates.length) invalid()
  const days = dates.map(date => {
    const rows = evidence.filter(v => v.date === date)
    if (rows.length !== 1) invalid()
    const day = rows[0]
    for (const meal of day.meals) for (const { grams, food } of meal.portions) {
      const key = foodKey(food), before = items.get(key)
      const quantity = addGrams(before?.grams ?? 0, grams)
      items.set(key, { key, foodId: food.id,
        names: [...new Set([...(before?.names ?? []), food.name])], preparation: food.preparation,
        source: { ...food.source }, grams: quantity })
    }
    return { date, versionId: day.versionId, versionNumber: day.versionNumber,
      effectiveFrom: day.effectiveFrom, mealNames: day.meals.map(m => m.name) }
  })
  const result = freezeShopping({ complete: true, dates, days, items: [...items.values()] })
  formatApprovedShopping(result) // Bound the selectable/copy text before publishing completeness.
  return result
}

export function shoppingItemText(item) {
  return `${item.names.join(' / ')}: ${shoppingNumber(item.grams)} g. Tilberedning: ${item.preparation}. `
    + `Fødevare-id: ${item.foodId}. Kilde: ${item.source.citation} (${item.source.verification}).`
}

// The accepted local-week formatter includes stock/week semantics that do not
// apply here. Keep the same pure formatting / explicit clipboard boundary.
export function formatApprovedShopping(result) {
  if (result?.complete !== true) invalid()
  const text = ['Indkøb fra kostplanen', grossLabel,
    ...result.days.map(d => `${d.date}: godkendt version ${d.versionNumber} (${d.versionId}), gældende fra ${d.effectiveFrom}. Måltider: ${d.mealNames.join(', ')}.`),
    ...result.items.map(shoppingItemText)].join('\n')
  if (text.length > maxShoppingText) invalid()
  return text
}
