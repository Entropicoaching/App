import { readIngredients } from '../indkoeb/ingredients.mjs'
import { mealTemplateItems } from '../../../athlete/kostSkabeloner.mjs'
import { calendarTime } from '../../../athlete/kostNumbers.mjs'
import { isDayReceipt } from '../../../mealEvidence.mjs'

const metrics = ['kcal', 'protein', 'carb', 'fat']
const validId = value => typeof value === 'string' && value.trim().length > 0
const clone = value => structuredClone(value)
const nameOf = value => typeof value === 'string' && value.trim().length > 0
  && value.trim().length <= 80 ? value.trim() : null

function cleanMeal(row) {
  const meal = mealTemplateItems([row])?.[0]
  if (!meal) return null
  meal.meal = meal.meal.normalize('NFC').trim().replace(/\s+/gu, ' ')
  return meal.meal.length <= 1000 && !isDayReceipt(meal) ? meal : null
}

const keyOf = meal => JSON.stringify([meal.meal, ...metrics.map(key => meal[key])])

// Fourteen UTC calendar dates, including date. Only persisted, scoped rows count.
// Repeated response rows are one occurrence; conflicting copies are ignored.
export function recurringMeals(rows, { athleteId, date } = {}) {
  const end = calendarTime(date)
  if (!validId(athleteId) || end === null || !Array.isArray(rows)) return []
  const start = end - 13 * 86400000
  const occurrences = new Map(), conflicts = new Set()
  for (const row of rows) {
    if (row?.athlete_id !== athleteId || !validId(row.id) || row.id.startsWith('local:')) continue
    const time = calendarTime(row.date), meal = cleanMeal(row)
    if (time === null || time < start || time > end || !meal) continue
    let ingredients
    try { ingredients = readIngredients(row.ingredients) } catch { ingredients = undefined }
    const entry = { key: keyOf(meal), date: row.date, meal, ingredients }
    const previous = occurrences.get(row.id)
    if (previous && (previous.key !== entry.key || previous.date !== entry.date
      || JSON.stringify(previous.ingredients) !== JSON.stringify(entry.ingredients))) conflicts.add(row.id)
    else occurrences.set(row.id, entry)
  }
  const groups = new Map()
  for (const [id, entry] of occurrences) {
    if (conflicts.has(id)) continue
    const group = groups.get(entry.key) || {
      id: entry.key, name: entry.meal.meal.slice(0, 80), meal: entry.meal, ingredients: entry.ingredients, count: 0, lastDate: entry.date,
    }
    if (JSON.stringify(group.ingredients) !== JSON.stringify(entry.ingredients)) group.ingredients = undefined
    group.count++
    if (entry.date > group.lastDate) group.lastDate = entry.date
    groups.set(entry.key, group)
  }
  return [...groups.values()].filter(group => group.count >= 3)
    .sort((a, b) => b.count - a.count || b.lastDate.localeCompare(a.lastDate) || a.id.localeCompare(b.id))
}

// No browser globals, backend or UI wiring. The assembly supplies storage and
// the strict Entropi 2 gate. Recreate for each athlete/date/history refresh.
export function createMealTemplates({ enabled = false, athleteId, date, rows = [], storage } = {}) {
  if (enabled !== true) return null
  if (!validId(athleteId) || calendarTime(date) === null) throw new TypeError('Atlet og dato kræves')
  const storageKey = 'entropi2:nutrition:skabeloner:v1:' + encodeURIComponent(athleteId)
  const candidates = recurringMeals(rows, { athleteId, date })
  let templates = [], error = '', readFailed = false
  try {
    if (typeof storage?.getItem !== 'function') throw new Error()
    const raw = storage.getItem(storageKey)
    if (raw != null) {
      if (typeof raw !== 'string' || raw.length > 250000) throw new Error()
      const data = JSON.parse(raw)
      if (data?.version !== 1 || !Array.isArray(data.templates) || data.templates.length > 100) throw new Error()
      const ids = new Set()
      templates = data.templates.map(item => {
        const meal = cleanMeal(item?.meal), name = nameOf(item?.name)
        if (!meal || !name || item.id !== keyOf(meal) || ids.has(item.id)) throw new Error()
        ids.add(item.id)
        const ingredients = readIngredients(item.ingredients)
        return { id: item.id, name, meal, ...(ingredients === undefined ? {} : { ingredients }) }
      })
    }
  } catch { templates = []; readFailed = true; error = 'Skabeloner kunne ikke læses.' }

  function commit(next) {
    if (readFailed) return false
    try {
      if (typeof storage?.setItem !== 'function') throw new Error()
      const raw = JSON.stringify({ version: 1, templates: next })
      if (raw.length > 250000) throw new Error()
      storage.setItem(storageKey, raw)
      templates = next
      error = ''
      return true
    } catch { error = 'Skabeloner blev ikke gemt. Prøv igen.'; return false }
  }

  return {
    snapshot() {
      const saved = new Set(templates.map(item => item.id))
      return clone({ athleteId, date, templates, suggestions: candidates.filter(item => !saved.has(item.id)), error })
    },
    // One action accepts a suggestion; double taps are idempotent.
    accept(id) {
      if (templates.some(item => item.id === id)) return true
      const candidate = candidates.find(item => item.id === id)
      if (!candidate || templates.length >= 100) return false
      const { name, meal, ingredients } = candidate
      return commit([...templates, { id, name, meal: clone(meal), ...(ingredients === undefined ? {} : { ingredients: clone(ingredients) }) }])
    },
    setIngredients(id, value) {
      if (!templates.some(item => item.id === id)) return false
      let ingredients
      try { ingredients = readIngredients(value) }
      catch { error = 'Ingredienser blev ikke gemt. Tjek navn, positiv mængde, enhed og kilde.'; return false }
      return commit(templates.map(item => item.id === id ? { ...item, ingredients } : item))
    },
    rename(id, value) {
      const name = nameOf(value)
      if (!name || !templates.some(item => item.id === id)) return false
      return commit(templates.map(item => item.id === id ? { ...item, name } : item))
    },
    remove(id) {
      if (!templates.some(item => item.id === id)) return false
      return commit(templates.filter(item => item.id !== id))
    },
    // The later integration can pass this detached payload to its existing log
    // action. Returning a meal does not claim that a backend write succeeded.
    useTemplate(id) {
      const item = templates.find(item => item.id === id)
      return item ? clone(item.meal) : null
    },
  }
}
