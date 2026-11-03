import { parseInputNumber, calendarTime, nutritionValues } from '../../athlete/kostNumbers.mjs'
import { mealTemplateItems } from '../../athlete/kostSkabeloner.mjs'
import { unitsForFood } from '../../athleteShared.js'
import { isDayReceipt } from '../../mealEvidence.mjs'

const metrics = ['kcal', 'protein', 'carb', 'fat']
const receipt = isDayReceipt
export const mealKey = row => JSON.stringify([row.meal, ...metrics.map(k => row[k])])
const cleanMeal = row => {
  const value = mealTemplateItems([row])?.[0] ?? null
  return value && !receipt({ ...value, meal: value.meal.trimStart() }) ? value : null
}
// Old v1 keys encode the complete meal; recover and validate without log history.
const storedMeal = entry => {
  if (typeof entry !== 'string') return cleanMeal(entry)
  const data = JSON.parse(entry)
  if (!Array.isArray(data) || data.length !== 5) return null
  const value = cleanMeal({ meal: data[0], ...Object.fromEntries(metrics.map((k, i) => [k, data[i + 1]])) })
  return value && mealKey(value) === entry ? value : null
}
const validId = id => typeof id === 'string' && id.trim().length > 0

// A controller belongs to ONE immutable athlete/date. Dispose before replacing it.
// enabled must be the assembly's strict boolean entropi2 gate; default is OFF.
export function createNutritionController({ enabled = false, athlete, date, contracts, storage, foods = [] } = {}) {
  if (enabled !== true) return null
  if (!validId(athlete?.id) || calendarTime(date) === null) throw new TypeError('Atlet og dato kræves')
  const id = athlete.id
  const yesterdayDate = new Date(calendarTime(date) - 86400000).toISOString().slice(0, 10)
  const targets = { kcal: parseInputNumber(athlete.kcal_target), protein: parseInputNumber(athlete.protein_target) }
  const storageKey = 'entropi2:nutrition:favorites:v1:' + encodeURIComponent(id)
  let rows = [], favorites = [], phase = 'idle', message = '', disposed = false, loadToken = 0
  let pending = null, history = false, favoriteError = '', committed = new Set()
  const listeners = new Set()
  try {
    const raw = storage?.getItem(storageKey)
    if (raw != null) {
      const data = JSON.parse(raw)
      if (!Array.isArray(data) || data.length > 100) throw new Error()
      const values = data.map(storedMeal)
      if (values.some(v => !v)) throw new Error()
      favorites = [...new Map(values.map(v => [mealKey(v), v])).values()]
    }
  } catch { favoriteError = 'Favoritter kunne ikke læses.' }
  const emit = () => { if (!disposed) for (const fn of listeners) fn() }
  const known = () => rows.filter(r => !receipt(r) && cleanMeal(r))
  const recent = () => {
    const map = new Map()
    for (const row of known()) { const m = cleanMeal(row); if (!map.has(mealKey(m))) map.set(mealKey(m), m) }
    return [...map.values()]
  }
  const yesterday = () => {
    const map = new Map()
    // A separate sorted copy keeps the existing newest-first diary/history intact.
    const previous = known().filter(r => r.date === yesterdayDate)
      .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))
    for (const row of previous) { const m = cleanMeal(row); if (!map.has(mealKey(m))) map.set(mealKey(m), m) }
    return [...map.values()]
  }
  const api = {
    subscribe(fn) { if (disposed) return () => {}; listeners.add(fn); return () => listeners.delete(fn) },
    snapshot() {
      const todayRows = rows.filter(r => r?.date === date && !receipt(r))
      const valid = todayRows.every(r => cleanMeal(r))
      const totals = Object.fromEntries(metrics.map(k => [k, valid ? todayRows.reduce((s, r) => s + parseInputNumber(r[k]), 0) : null]))
      const finite = valid && Object.values(totals).every(Number.isFinite)
      const list = recent()
      return { athleteId: id, date, phase, message, history, pending: !!pending, favoriteError,
        loaded: phase !== 'idle' && phase !== 'loading' && phase !== 'load-error',
        totals: finite ? totals : null, targets: { ...targets }, invalid: !finite,
        logs: todayRows.map(r => ({ ...r })),
        historyRows: rows.filter(r => !receipt(r)).map(r => ({ ...r })),
        yesterday: yesterday(),
        recent: list.slice(0, 20), favorites: favorites.map(r => ({ ...r })),
        favoriteKeys: favorites.map(mealKey), foods: foods.map(f => ({ ...f })),
      }
    },
    async load() {
      if (disposed || pending) return false
      const token = ++loadToken
      phase = 'loading'; message = ''; emit()
      try {
        const result = await contracts.load(id, date)
        if (disposed || token !== loadToken) return false
        if (!Array.isArray(result) || result.some(r => r?.athlete_id !== id || calendarTime(r?.date) === null || r.date > date)) throw new Error()
        rows = result.map(r => ({ ...r })).sort((a, b) => b.date.localeCompare(a.date) || String(b.created_at || '').localeCompare(String(a.created_at || '')))
        phase = 'ready'; emit(); return true
      } catch {
        if (disposed || token !== loadToken) return false
        phase = 'load-error'; message = 'Kostloggen kunne ikke hentes. Prøv igen.'; emit(); return false
      }
    },
    toggleHistory() { if (!disposed) { history = !history; emit() } },
    toggleFavorite(meal) {
      const value = cleanMeal(meal)
      if (disposed || !value) return false
      const key = mealKey(value)
      const existing = favorites.some(r => mealKey(r) === key)
      if (!existing && !recent().some(r => mealKey(r) === key)) return false
      const next = existing ? favorites.filter(r => mealKey(r) !== key) : [...favorites, value]
      try {
        if (!storage || next.length > 100) throw new Error()
        storage.setItem(storageKey, JSON.stringify(next))
        favorites = next; favoriteError = ''; emit(); return true
      } catch { favoriteError = 'Favoritten blev ikke gemt. Prøv igen.'; emit(); return false }
    },
    // Intent tokens deduplicate replays of the same UI action, including after success.
    // A fresh deliberate click after completion gets a fresh token, so two meals are possible.
    async log(meal, intent) {
      if (disposed || !validId(intent) || pending || committed.has(intent) || !['ready', 'saved', 'save-error'].includes(phase)) return false
      const value = cleanMeal(meal)
      if (!value) { message = 'Udfyld måltid og gyldige næringsværdier.'; emit(); return false }
      const payload = { athlete_id: id, date, ...value }
      pending = intent; phase = 'saving'; message = 'Gemmer måltid…'; emit()
      try {
        const ok = await contracts.save(payload)
        if (ok !== true) throw new Error()
        committed.add(intent)
        if (disposed) return false
        // No optimistic totals: failures leave the diary exactly as it was.
        rows.unshift({ ...payload, id: 'local:' + intent })
        phase = 'saved'; message = 'Måltid gemt.'; return true
      } catch {
        if (!disposed) { phase = 'save-error'; message = 'Måltidet blev ikke gemt. Prøv igen.' }
        return false
      } finally { pending = null; emit() }
    },
    dispose() { disposed = true; loadToken++; listeners.clear(); rows = []; favorites = []; committed.clear() },
  }
  return api
}

// Uses precisely the existing portion conversion/label/rounding contract.
export function foodPortion(food, amount, unitIndex = 0) {
  if (!food || typeof food.name !== 'string' || !food.name.trim()) return null
  const units = unitsForFood(food), unit = units[unitIndex], n = parseInputNumber(amount)
  if (!unit || n === null || n <= 0) return null
  const grams = n * unit.grams
  if (!Number.isFinite(grams) || grams <= 0) return null
  // Missing nutrient values stay unknown rather than being silently converted to zero.
  if (metrics.some(k => parseInputNumber(food[k + '100']) === null)) return null
  const values = nutritionValues(Object.fromEntries(metrics.map(k => [k, food[k + '100']])), grams / 100)
  if (!values) return null
  return { meal: unit.label === 'g' ? `${food.name} · ${Math.round(grams)} g`
    : `${food.name} · ${n} ${unit.label} (${Math.round(grams)} g)`, ...values }
}
export { unitsForFood }
