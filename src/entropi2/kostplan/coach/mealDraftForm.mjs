import { MEAL_DRAFT_SCHEMA, MEAL_DRAFT_MAX_LENGTH } from './mealDraft.mjs'

// Form-only data. No storage, solver or controller effects. IDs survive edits
// and explicit loading so an unchanged reapplication remains a controller no-op.
export const lineCount = draft => draft.meals.reduce((n, meal) => n + meal.items.length, 0)
export function emptyMealForm() {
  return { next: 2, meals: [{ id: 'form-meal-1', name: '', time: '', items: [{ key: 'row-1', foodId: '', grams: '' }] }] }
}
export function addFormMeal(draft) {
  if (draft.meals.length >= 12 || lineCount(draft) >= 100) return draft
  let next = draft.next
  while (draft.meals.some(m => m.id === `form-meal-${next}`)) next++
  return { next: next + 1, meals: [...draft.meals, { id: `form-meal-${next}`, name: '', time: '',
    items: [{ key: `row-${next}`, foodId: '', grams: '' }] }] }
}
export function addFormLine(draft, id) {
  const meal = draft.meals.find(m => m.id === id)
  if (!meal || meal.items.length >= 30 || lineCount(draft) >= 100) return draft
  return { next: draft.next + 1, meals: draft.meals.map(m => m !== meal ? m : { ...m,
    items: [...m.items, { key: `row-${draft.next}`, foodId: '', grams: '' }] }) }
}
// String(number) uses exponent notation for tiny valid portions. Expand only
// its shortest round-tripping digits, without rounding or changing precision.
function decimalText(value) {
  const text = String(value), [coefficient, exponent] = text.split('e')
  if (exponent === undefined) return text
  const [whole, fraction = ''] = coefficient.split('.')
  const digits = whole + fraction, point = whole.length + Number(exponent)
  if (point <= 0) return '0.' + '0'.repeat(-point) + digits
  if (point >= digits.length) return digits + '0'.repeat(point - digits.length)
  return digits.slice(0, point) + '.' + digits.slice(point)
}
export function loadMealForm(meals) {
  let next = 1
  return { meals: meals.map(meal => {
    const match = /^((?:[01]\d|2[0-3]):[0-5]\d) (.+)$/.exec(meal.name)
    return { id: meal.id, name: match ? match[2] : meal.name, time: match ? match[1] : '',
      items: meal.items.map(item => ({ key: `row-${next++}`, foodId: item.food.id, grams: decimalText(item.grams) })) }
  }), next }
}
const clean = text => typeof text === 'string' && text.trim() === text
  && Array.from(text).every(c => c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127)
export function serializeMealForm(draft, scope, foods) {
  const errors = []
  if (draft.meals.length < 1 || draft.meals.length > 12) errors.push('Brug 1–12 måltider.')
  if (lineCount(draft) > 100) errors.push('Brug højst 100 fødevarelinjer i alt.')
  const ids = new Set()
  const meals = draft.meals.map((meal, mi) => {
    const title = `Måltid ${mi + 1}`
    const name = meal.time === '' ? meal.name : `${meal.time} ${meal.name}`
    if (!clean(meal.name) || !meal.name || name.length > 200) errors.push(`${title}: Angiv et navn uden kantmellemrum eller kontroltegn, højst 200 tegn med tidspunkt.`)
    if (meal.time !== '' && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(meal.time)) errors.push(`${title}: Brug tidspunkt som 07:30 eller lad det stå tomt.`)
    if (ids.has(meal.id)) errors.push(`${title}: Gentaget måltid. Indlæs formularen igen.`)
    ids.add(meal.id)
    if (meal.items.length < 1 || meal.items.length > 30) errors.push(`${title}: Brug 1–30 fødevarelinjer.`)
    const used = new Set()
    const items = meal.items.map((item, ii) => {
      const at = `${title}, fødevare ${ii + 1}`
      if (!foods.some(f => f.id === item.foodId)) errors.push(`${at}: Vælg en kendt fødevare.`)
      if (used.has(item.foodId)) errors.push(`${at}: Brug hver fødevare én gang i samme måltid.`)
      used.add(item.foodId)
      const raw = typeof item.grams === 'string' ? item.grams.trim() : ''
      const grams = /^\d+(?:[.,]\d+)?$/.test(raw) ? Number(raw.replace(',', '.')) : NaN
      if (!Number.isFinite(grams) || grams <= 0 || grams > 10000) errors.push(`${at}: Angiv gram over 0 og højst 10.000, fx 125,5. Ingen enheder eller regneudtryk.`)
      return { foodId: item.foodId, grams }
    })
    return { id: meal.id, name, items }
  })
  const source = JSON.stringify({ schema: MEAL_DRAFT_SCHEMA, coachId: scope.coachId,
    athleteId: scope.athleteId, date: scope.date, meals })
  if (source.length > MEAL_DRAFT_MAX_LENGTH) errors.push('Kladden er for stor. Forkort navne eller fjern linjer.')
  return { source: errors.length ? null : source, errors }
}
