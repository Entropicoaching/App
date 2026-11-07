import { quantityNumber, ingredientKey } from '../indkoeb/ingredients.mjs'
import { calendarTime, parseInputNumber } from '../../../athlete/kostNumbers.mjs'
import { buildShoppingList } from '../indkoeb/shoppingList.mjs'

export const dayNames = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag']
const dayMs = 86400000
const clone = value => structuredClone(value)
const portionOK = value => Number.isFinite(value) && value > 0 && value <= 1000
const entryId = entry => typeof entry === 'string' ? entry : entry.templateId
const entryPortions = entry => typeof entry === 'string' ? 1 : entry.portions
const idOK = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 10000
// A stock key is serialized ingredient metadata, not a template/athlete ID.
// foodId + source citation/status + preparation + unit: at most 5040 UTF-16
// code units, each up to six JSON characters (lone surrogates), plus 49 syntax
// characters. The name fallback/string source are shorter. Keep the v1 bytes.
const stockKeyLimit = 6 * (1000 + 2000 + 1000 + 1000 + 40) + 49
const stockKeyOK = value => typeof value === 'string' && value.trim().length > 0 && value.length <= stockKeyLimit

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
  let days = dayNames.map(() => []), stock = [], error = '', readFailed = false, saved = false
  try {
    if (typeof storage?.getItem !== 'function') throw new Error()
    const raw = storage.getItem(key)
    if (raw != null) {
      if (typeof raw !== 'string' || raw.length > 250000) throw new Error()
      const data = JSON.parse(raw)
      if (data?.version !== 1 || data.week !== monday || !Array.isArray(data.days) || data.days.length !== 7
        || data.days.some(day => !Array.isArray(day) || day.length > 20 || day.some(id => !idOK(id)))) throw new Error()
      if (data.stock !== undefined) {
        if (!Array.isArray(data.stock) || data.stock.length > 500) throw new Error()
        const keys = new Set()
        for (const row of data.stock) {
          if (!stockKeyOK(row?.key) || keys.has(row.key) || row.confirmed !== true
            || typeof row.quantity !== 'number' || !Number.isFinite(row.quantity) || row.quantity < 0) throw new Error()
          keys.add(row.key)
        }
        stock = data.stock.map(({ key, quantity }) => ({ key, quantity, confirmed: true }))
      }
      if (data.portions !== undefined && (!Array.isArray(data.portions) || data.portions.length !== 7
        || data.portions.some((amounts, day) => !Array.isArray(amounts) || amounts.length !== data.days[day].length
          || amounts.some(value => !portionOK(value))))) throw new Error()
      days = data.days.map((ids, day) => ids.map((templateId, slot) => {
        const portions = data.portions?.[day][slot] ?? 1
        return portions === 1 ? templateId : { templateId, portions }
      }))
      saved = true
    }
  } catch {
    readFailed = true
    error = 'Ugekladden kunne ikke læses. Prøv at åbne den igen. Den gemte kladde er ikke overskrevet.'
  }

  function persist(next, nextStock = stock) {
    // Never overwrite an unreadable draft with an apparently empty plan.
    if (readFailed) return false
    try {
      // Keep the original v1 days as template-ID strings. Optional aligned
      // portions are additive; old drafts need no migration or read-time write.
      const portions = next.map(entries => entries.map(entryPortions))
      const scaled = portions.some(amounts => amounts.some(value => value !== 1))
      const raw = JSON.stringify({ version: 1, week: monday, days: next.map(entries => entries.map(entryId)),
        ...(scaled ? { portions } : {}), ...(nextStock.length ? { stock: nextStock } : {}) })
      if (raw.length > 250000 || typeof storage?.setItem !== 'function') throw new Error()
      storage.setItem(key, raw)
      days = next
      stock = nextStock
      error = ''
      saved = true
      return true
    } catch {
      error = 'Ændringen blev ikke gemt. Ugeplanen viser den senest gemte kladde. Prøv igen.'
      return false
    }
  }

  const api = {
    snapshot() {
      const shoppingMeals = [], selected = []
      const result = days.map((ids, index) => {
        const entries = ids.map((entry, slot) => {
          const id = entryId(entry), portions = entryPortions(entry)
          const template = byId.get(id)
          if (template) {
            // Shopping de-duplicates IDs. Each planned occurrence must count.
            const occurrence = `${index}:${slot}`
            shoppingMeals.push({ id: occurrence, meal: template.meal.meal, ingredients: template.ingredients, portions })
            selected.push(occurrence)
          }
          return { templateId: id, portions, name: template?.name ?? 'Skabelon findes ikke længere', missing: !template }
        })
        const totals = {}
        for (const metric of ['kcal', 'protein']) {
          const values = ids.map(entry => {
            const value = byId.get(entryId(entry))?.meal[metric]
            return value == null ? null : value * entryPortions(entry)
          })
          const sum = values.reduce((total, value) => total + (value ?? 0), 0)
          totals[metric] = ids.length && values.every(value => value != null) && Number.isFinite(sum) ? sum : null
        }
        const date = new Date(calendarTime(monday) + index * dayMs).toISOString().slice(0, 10)
        return { name: dayNames[index], date, entries, totals, targets: goals }
      })
      let shopping
      try {
        shopping = { ...buildShoppingList(shoppingMeals, selected), error: '' }
        shopping.items = shopping.items.map(item => {
          const confirmedStock = stock.find(row => row.key === ingredientKey(item))?.quantity ?? null
          return { ...item, confirmedStock, netPurchase: Math.max(0, item.quantity - (confirmedStock ?? 0)) }
        })
      } catch {
        shopping = { items: [], missingMeals: [], error: 'Indkøbslisten kunne ikke beregnes. Tjek ingrediensernes navn, mængde og enhed.' }
      }
      shopping.unavailableCount = result.flatMap(day => day.entries).filter(entry => entry.missing).length
      return clone({ week: monday, templates: own.map(({ id, name }) => ({ id, name })),
        days: result, shopping, error, readFailed, saved })
    },
    add(day, templateId, value = 1) {
      const portions = quantityNumber(value)
      if (!portionOK(portions)) { error = 'Portioner blev ikke gemt. Angiv et antal større end 0 og højst 1000.'; return false }
      if (!Number.isInteger(day) || day < 0 || day > 6 || !byId.has(templateId) || days[day].length >= 20) return false
      return persist(days.map((ids, index) => index === day ? [...ids, portions === 1 ? templateId : { templateId, portions }] : [...ids]))
    },
    setPortions(day, slot, value) {
      const portions = quantityNumber(value)
      if (!portionOK(portions)) { error = 'Portioner blev ikke gemt. Angiv et antal større end 0 og højst 1000.'; return false }
      if (!Number.isInteger(day) || day < 0 || day > 6
        || !Number.isInteger(slot) || slot < 0 || slot >= days[day].length) return false
      const templateId = entryId(days[day][slot])
      return persist(days.map((entries, index) => index === day
        ? entries.map((entry, i) => i === slot ? (portions === 1 ? templateId : { templateId, portions }) : entry) : [...entries]))
    },
    confirmStock(key, value) {
      const quantity = quantityNumber(value)
      if (!stockKeyOK(key) || !Number.isFinite(quantity) || quantity < 0
        || !api.snapshot().shopping.items.some(item => ingredientKey(item) === key)) {
        error = 'Beholdning blev ikke gemt. Angiv en kendt mængde på mindst 0 i listens enhed.'
        return false
      }
      const next = [...stock.filter(row => row.key !== key), { key, quantity, confirmed: true }]
      if (next.length > 500) { error = 'Der er plads til 500 bekræftede beholdninger pr. uge.'; return false }
      return persist(days, next)
    },
    remove(day, slot) {
      if (!Number.isInteger(day) || day < 0 || day > 6 || !Number.isInteger(slot) || slot < 0 || slot >= days[day].length) return false
      return persist(days.map((ids, index) => index === day ? ids.filter((_, i) => i !== slot) : [...ids]))
    },
  }
  return api
}
