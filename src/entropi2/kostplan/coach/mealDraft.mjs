import { catalogFoods, copy, day, identifier, totals } from './model.mjs'

export const MEAL_DRAFT_SCHEMA = 'entropi2:meal-draft:v1'
export const MEAL_DRAFT_MAX_LENGTH = 32000
const fail = () => { throw TypeError('Ugyldig måltidskladde. Kontrollér format, valgt coach, atlet, dato, katalog-id og gram.') }
const exact = (value, keys) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== keys.length || keys.some(k => !Object.hasOwn(value, k))) fail()
}
const text = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max
  && value.trim() === value && Array.from(value).every(c => c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127)

// Bound nesting before JSON.parse; reject duplicate JSON members as well as
// duplicate meal/food IDs. Strings are data, never evaluated or merged into objects.
function boundedJson(source) {
  if (typeof source !== 'string' || source.length > MEAL_DRAFT_MAX_LENGTH) fail()
  const stack = []
  for (let i = 0; i < source.length; i++) {
    const c = source[i]
    if (c === '"') {
      const start = i++
      for (; i < source.length; i++) {
        if (source[i] === '\\') { i++; continue }
        if (source[i] === '"') break
      }
      let next = i + 1
      while (/\s/.test(source[next] ?? '') && next < source.length) next++
      if (source[next] === ':') {
        const frame = stack.at(-1)
        if (!(frame instanceof Set)) fail()
        const key = JSON.parse(source.slice(start, i + 1))
        if (frame.has(key)) fail()
        frame.add(key)
      }
    } else if (c === '{' || c === '[') {
      stack.push(c === '{' ? new Set() : null)
      if (stack.length > 5) fail()
    } else if (c === '}' || c === ']') stack.pop()
  }
  return JSON.parse(source)
}

export function parseMealDraft(source, scope, catalog) {
  try {
    const raw = boundedJson(source)
    exact(raw, ['schema', 'coachId', 'athleteId', 'date', 'meals'])
    if (raw.schema !== MEAL_DRAFT_SCHEMA || !identifier(scope?.coachId) || !identifier(scope?.athleteId)
      || !day(scope?.date) || raw.coachId !== scope.coachId || raw.athleteId !== scope.athleteId || raw.date !== scope.date
      || !Array.isArray(raw.meals) || raw.meals.length < 1 || raw.meals.length > 12) fail()
    const foods = catalogFoods(catalog)
    if (!foods) fail()
    const ids = new Set()
    let count = 0
    const meals = raw.meals.map(meal => {
      exact(meal, ['id', 'name', 'items'])
      if (!identifier(meal.id) || !text(meal.id, 160) || ids.has(meal.id) || !text(meal.name, 200)
        || !Array.isArray(meal.items) || meal.items.length < 1 || meal.items.length > 30) fail()
      ids.add(meal.id)
      const used = new Set()
      return { id: meal.id, name: meal.name, items: meal.items.map(item => {
        exact(item, ['foodId', 'grams'])
        const food = foods.find(food => food.id === item.foodId)
        if (!food || used.has(item.foodId) || typeof item.grams !== 'number'
          || !Number.isFinite(item.grams) || item.grams <= 0 || item.grams > 10000 || ++count > 100) fail()
        used.add(item.foodId)
        return { grams: item.grams, food: copy(food) }
      }) }
    })
    if (!totals(meals)) fail()
    return meals
  } catch { fail() }
}
