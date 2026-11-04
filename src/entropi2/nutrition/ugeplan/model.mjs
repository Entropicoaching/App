import { calendarTime, parseInputNumber } from '../../../athlete/kostNumbers.mjs'
import { buildShoppingList } from '../indkoeb/shoppingList.mjs'

export const dayNames = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag']
const dayMs = 86400000
const clone = value => structuredClone(value)
const idOK = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 10000

export function weekStart(date) {
  const time = calendarTime(date)
  if (time === null) throw new TypeError('Vælg en gyldig dato for ugen.')
  const offset = (new Date(time).getUTCDay() + 6) % 7
  const monday = new Date(time - offset * dayMs).toISOString().slice(0, 10)
  const sunday = new Date(time + (6 - offset) * dayMs).toISOString().slice(0, 10)
  if (calendarTime(monday) === null || calendarTime(sunday) === null) throw new TypeError('Vælg en gyldig dato for ugen.')
  return monday
}

function readTemplates(templates) {
  if (!Array.isArray(templates) || templates.length > 100) throw new TypeError('Skabeloner kunne ikke læses.')
  const ids = new Set()
  return templates.map(template => {
    if (!idOK(template?.id) || ids.has(template.id)
      || typeof template.name !== 'string' || !template.name.trim() || template.name.length > 80
      || typeof template.meal?.meal !== 'string' || !template.meal.meal.trim()) {
      throw new TypeError('Skabeloner kunne ikke læses.')
    }
    ids.add(template.id)
    // Unknown macros remain unknown; never turn missing values into zero.
    const meal = { meal: template.meal.meal }
    for (const metric of ['kcal', 'protein']) meal[metric] = parseInputNumber(template.meal[metric])
    return { id: template.id, name: template.name.trim(), meal,
      ingredients: clone(template.ingredients) }
  })
}

// The caller supplies ONLY the current athlete's own templates and storage.
// No globals, automatic persistence, logging, backend or feature-flag reads.
export function createWeekPlan(options = {}) {
  if (options.enabled !== true) return null
  const { athleteId, date, templates = [], targets = {}, storage } = options
  if (!idOK(athleteId)) throw new TypeError('Atlet mangler.')
  const monday = weekStart(date), own = readTemplates(templates)
  const byId = new Map(own.map(item => [item.id, item]))
  const goals = Object.fromEntries(['kcal', 'protein'].map(metric => {
    const value = parseInputNumber(targets?.[metric])
    return [metric, value > 0 ? value : null]
  }))
  const key = `entropi2:nutrition:ugeplan:v1:${encodeURIComponent(athleteId)}:${monday}`
  let days = dayNames.map(() => []), error = '', readFailed = false, saved = false
  try {
    if (typeof storage?.getItem !== 'function') throw new Error()
    const raw = storage.getItem(key)
    if (raw != null) {
      if (typeof raw !== 'string' || raw.length > 250000) throw new Error()
      const data = JSON.parse(raw)
      if (data?.version !== 1 || data.week !== monday || !Array.isArray(data.days) || data.days.length !== 7
        || data.days.some(day => !Array.isArray(day) || day.length > 20 || day.some(id => !idOK(id)))) throw new Error()
      days = data.days
      saved = true
    }
  } catch {
    readFailed = true
    error = 'Ugekladden kunne ikke læses. Prøv at åbne den igen. Den gemte kladde er ikke overskrevet.'
  }

  function persist(next) {
    // Never overwrite an unreadable draft with an apparently empty plan.
    if (readFailed) return false
    try {
      const raw = JSON.stringify({ version: 1, week: monday, days: next })
      if (raw.length > 250000 || typeof storage?.setItem !== 'function') throw new Error()
      storage.setItem(key, raw)
      days = next
      error = ''
      saved = true
      return true
    } catch {
      error = 'Ændringen blev ikke gemt. Ugeplanen viser den senest gemte kladde. Prøv igen.'
      return false
    }
  }

  return {
    snapshot() {
      const shoppingMeals = [], selected = []
      const result = days.map((ids, index) => {
        const entries = ids.map((id, slot) => {
          const template = byId.get(id)
          if (template) {
            // Shopping de-duplicates IDs. Each planned occurrence must count.
            const occurrence = `${index}:${slot}`
            shoppingMeals.push({ id: occurrence, meal: template.meal.meal, ingredients: template.ingredients })
            selected.push(occurrence)
          }
          return { templateId: id, name: template?.name ?? 'Skabelon findes ikke længere', missing: !template }
        })
        const totals = {}
        for (const metric of ['kcal', 'protein']) {
          const values = ids.map(id => byId.get(id)?.meal[metric])
          const sum = values.reduce((total, value) => total + (value ?? 0), 0)
          totals[metric] = ids.length && values.every(value => value != null) && Number.isFinite(sum) ? sum : null
        }
        const date = new Date(calendarTime(monday) + index * dayMs).toISOString().slice(0, 10)
        return { name: dayNames[index], date, entries, totals, targets: goals }
      })
      let shopping
      try {
        shopping = { ...buildShoppingList(shoppingMeals, selected), error: '' }
      } catch {
        shopping = { items: [], missingMeals: [], error: 'Indkøbslisten kunne ikke beregnes. Tjek ingrediensernes navn, mængde og enhed.' }
      }
      shopping.unavailableCount = result.flatMap(day => day.entries).filter(entry => entry.missing).length
      return clone({ week: monday, templates: own.map(({ id, name }) => ({ id, name })),
        days: result, shopping, error, readFailed, saved })
    },
    add(day, templateId) {
      if (!Number.isInteger(day) || day < 0 || day > 6 || !byId.has(templateId) || days[day].length >= 20) return false
      return persist(days.map((ids, index) => index === day ? [...ids, templateId] : [...ids]))
    },
    remove(day, slot) {
      if (!Number.isInteger(day) || day < 0 || day > 6 || !Number.isInteger(slot) || slot < 0 || slot >= days[day].length) return false
      return persist(days.map((ids, index) => index === day ? ids.filter((_, i) => i !== slot) : [...ids]))
    },
  }
}
