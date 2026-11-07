import { createPortionMemory } from './portionMemory.mjs'
import { createMealTemplates } from './skabeloner/model.mjs'
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
// Entropi 2: currentDay (valgfri) giver den aktuelle kalenderdag, når skærmen følger dags dato. Et måltid
// får da dagen i det øjeblik, det gemmes, og onDayChanged får besked, når den ikke længere er date.
export function createNutritionController({ enabled = false, athlete, date, contracts, storage, foods = [], currentDay, onDayChanged,
  now = () => Date.now(), schedule = setTimeout, cancel = clearTimeout } = {}) {
  if (enabled !== true) return null
  if (!validId(athlete?.id) || calendarTime(date) === null) throw new TypeError('Atlet og dato kræves')
  const id = athlete.id
  const yesterdayDate = new Date(calendarTime(date) - 86400000).toISOString().slice(0, 10)
  const profileTargets = { kcal: parseInputNumber(athlete.kcal_target), protein: parseInputNumber(athlete.protein_target) }
  const dayTargets = contracts?.dayTargets
  const dailyReference = () => {
    const fallback = state => ({ targets: { ...profileTargets }, targetReference: { source: 'profile', state } })
    if (!dayTargets) return fallback('ready')
    try {
      const value = dayTargets.snapshot()
      if (!dayTargets.owner || typeof dayTargets.owner !== 'object'
        || dayTargets.athleteId !== id || dayTargets.date !== date
        || value?.owner !== dayTargets.owner || value.athleteId !== id || value.date !== date) return fallback('unavailable')
      if (value.source !== 'approved-plan') return fallback(value.state)
      if (!validId(value.planId) || !validId(value.revision)) return fallback('unavailable')
      // Unknown plan nutrients stay unknown; never fill individual gaps with
      // unrelated profile goals. This is the approved portion sum, not an estimate.
      return { targets: Object.fromEntries(['kcal', 'protein'].map(key => {
        const number = parseInputNumber(value.targets?.[key])
        return [key, number]
      })), targetReference: { source: 'approved-plan', state: value.state,
        planId: value.planId, revision: value.revision } }
    } catch { return fallback('unavailable') }
  }
  const storageKey = 'entropi2:nutrition:favorites:v1:' + encodeURIComponent(id)
  let rows = [], favorites = [], phase = 'idle', message = '', disposed = false, loadToken = 0
  let pending = null, history = false, favoriteError = '', committed = new Set()
  const portions = foods.length ? createPortionMemory(storage, id) : null
  let undo = null, undoTimer = null
  const clearUndo = () => {
    if (undoTimer !== null) cancel(undoTimer)
    undoTimer = null; undo = null
  }
  const listeners = new Set()
  const selectedParts = new Set()
  const refreshTemplates = () => createMealTemplates({ enabled: true, athleteId: id, date, rows, storage })
  let templates = refreshTemplates()
  const today = () => rows.filter(r => r?.date === date && !receipt(r))
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
  const checkedRows = result => {
    if (!Array.isArray(result) || result.some(r => r?.athlete_id !== id || calendarTime(r?.date) === null || r.date > date)) throw new Error()
    return result.map(r => ({ ...r })).sort((a, b) => b.date.localeCompare(a.date) || String(b.created_at || '').localeCompare(String(a.created_at || '')))
  }
  const mutable = row => validId(row?.id) && !row.id.startsWith('local:') && row.date === date
    && row.athlete_id === id && !receipt({ ...row, meal: typeof row.meal === 'string' ? row.meal.trimStart() : row.meal })
    && rows.filter(r => r.id === row.id).length === 1
  const ready = intent => !disposed && validId(intent) && !pending && !committed.has(intent)
    && ['ready', 'saved', 'save-error'].includes(phase)
  const mutate = async (kind, rowId, meal, intent, confirmed, undoing = false) => {
    if (!ready(intent) || typeof contracts?.[kind] !== 'function' || (kind === 'remove' && confirmed !== true)) return false
    const row = rows.find(r => r.id === rowId)
    if (!mutable(row)) return false
    const value = kind === 'update' ? cleanMeal(meal) : null
    if (kind === 'update' && !value) { message = 'Udfyld måltid og gyldige næringsværdier.'; emit(); return false }
    const payload = { id: row.id, athlete_id: id, date, ...(value || {}) }
    pending = intent; phase = 'saving'; message = kind === 'remove' ? 'Fjerner måltid…' : 'Gemmer ændring…'; emit()
    try {
      if (await contracts[kind](payload) !== true) throw new Error()
      committed.add(intent)
      if (disposed) return false
      if (undo?.rowId === row.id) clearUndo()
      selectedParts.delete(row)
      rows = kind === 'remove' ? rows.filter(r => r !== row) : rows.map(r => r === row ? { ...row, ...value } : r)
      templates = refreshTemplates()
      phase = 'saved'; message = undoing ? 'Måltid fortrudt.' : kind === 'remove' ? 'Måltid fjernet.' : 'Måltid rettet.'; return true
    } catch {
      if (!disposed) { phase = 'save-error'; message = undoing ? 'Måltidet blev ikke fortrudt. Det er stadig gemt.' : kind === 'remove' ? 'Måltidet blev ikke fjernet. Prøv igen.' : 'Ændringen blev ikke gemt. Prøv igen.' }
      return false
    } finally { pending = null; emit() }
  }
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
    // Current-athlete inputs for the owned React island; never diary rows or a client.
    // Read only on demand. The week model owns its separate local draft namespace.
    weekPlanInputs() {
      if (disposed) return null
      const state = templates.snapshot()
      return { enabled: true, embedded: true, athleteId: id, date, templates: state.templates,
        templateError: state.error === 'Skabeloner kunne ikke læses.' ? state.error : '',
        targets: { ...profileTargets }, storage, onRetry: () => api.load() }
    },
    snapshot() {
      const todayRows = today()
      const valid = todayRows.every(r => cleanMeal(r))
      const totals = Object.fromEntries(metrics.map(k => [k, valid ? todayRows.reduce((s, r) => s + parseInputNumber(r[k]), 0) : null]))
      const finite = valid && Object.values(totals).every(Number.isFinite)
      const favoriteKeys = new Set(favorites.map(mealKey))
      const list = recent().filter(meal => !favoriteKeys.has(mealKey(meal)))
      return { athleteId: id, date, phase, message, history, pending: !!pending, favoriteError,
        portionError: portions?.error() || '',
        undo: undo && now() < undo.expiresAt ? { ...undo } : null,
        mealTemplates: templates.snapshot(),
        ownMeals: favorites.map(meal => ({ ...meal, id: mealKey(meal) })),
        loaded: phase !== 'idle' && phase !== 'loading' && phase !== 'load-error',
        totals: finite ? totals : null, ...dailyReference(), profileTargets: { ...profileTargets }, invalid: !finite,
        logs: todayRows.map(r => ({ ...r })),
        selectedParts: todayRows.flatMap((r, i) => selectedParts.has(r) ? [i] : []),
        removableIds: todayRows.filter(mutable).filter(() => typeof contracts?.remove === 'function').map(r => r.id),
        editableIds: todayRows.filter(mutable).filter(() => typeof contracts?.update === 'function').map(r => r.id),
        needsRefresh: todayRows.some(r => r.id?.startsWith?.('local:'))
          && (typeof contracts?.remove === 'function' || typeof contracts?.update === 'function'),
        historyRows: rows.filter(r => !receipt(r)).map(r => ({ ...r })),
        yesterday: yesterday(),
        recent: list.slice(0, 20), favorites: favorites.map(r => ({ ...r })),
        favoriteKeys: favorites.map(mealKey), foods: foods.map(f => ({ ...f })),
      }
    },
    foodAmount(index) {
      return !disposed && foods[index] ? portions?.get(foods[index]) ?? 100 : 100
    },
    async logFood(index, amount, unitIndex, intent) {
      if (disposed || !Number.isInteger(index)) return false
      const food = foods[index], value = foodPortion(food, amount, unitIndex)
      if (!value) return api.log(null, intent)
      const grams = parseInputNumber(amount) * unitsForFood(food)[unitIndex].grams
      const ok = await api.log(value, intent)
      if (ok && !disposed) { portions?.remember(food, grams); emit() }
      return ok
    },
    undoLog(token, intent) {
      if (!undo || undo.token !== token || now() >= undo.expiresAt) return Promise.resolve(false)
      return mutate('remove', undo.rowId, null, intent, true, true)
    },
    async load() {
      if (disposed || pending) return false
      const token = ++loadToken
      phase = 'loading'; message = ''; emit()
      try {
        const result = await contracts.load(id, date)
        if (disposed || token !== loadToken) return false
        rows = checkedRows(result)
        clearUndo()
        templates = refreshTemplates()
        selectedParts.clear()
        phase = 'ready'; emit(); return true
      } catch {
        if (disposed || token !== loadToken) return false
        phase = 'load-error'; message = 'Kostloggen kunne ikke hentes. Prøv igen.'; emit(); return false
      }
    },
    setTemplateIngredients(templateId, ingredients) {
      if (disposed || pending) return false
      const ok = templates.setIngredients(templateId, ingredients); emit(); return ok
    },
    acceptTemplate(templateId) {
      if (disposed || pending) return false
      const ok = templates.accept(templateId); emit(); return ok
    },
    logTemplate(templateId, intent) { return api.log(templates.useTemplate(templateId), intent) },
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
    toggleMealPart(index) {
      if (disposed || pending || !['ready', 'saved', 'save-error'].includes(phase) || !Number.isInteger(index)) return false
      const row = today()[index]
      if (!row) return false
      if (selectedParts.has(row)) selectedParts.delete(row)
      else selectedParts.add(row)
      emit(); return true
    },
    saveOwnMeal(name) {
      if (disposed || pending || !['ready', 'saved', 'save-error'].includes(phase)) return false
      const fail = text => { favoriteError = text; emit(); return false }
      const label = typeof name === 'string' ? name.replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim() : ''
      if (!label || label.length > 60) return fail('Angiv et navn på højst 60 tegn.')
      const parts = today().filter(r => selectedParts.has(r))
      if (parts.length < 2) return fail('Vælg mindst to af dagens måltider.')
      const values = parts.map(cleanMeal)
      if (values.some(v => !v)) return fail('Kontrollér næringsværdierne i de valgte måltider. Intet blev gemt.')
      const combined = cleanMeal({ meal: label, ...Object.fromEntries(metrics.map(k => [k, values.reduce((sum, v) => sum + v[k], 0)])) })
      if (!combined) return fail('Kontrollér navn og næringsværdier. Intet blev gemt.')
      // Idempotent save, including a replay when the favorite list is full.
      if (favorites.some(v => mealKey(v) === mealKey(combined))) { favoriteError = ''; emit(); return true }
      try {
        if (!storage || favorites.length >= 100) throw new Error()
        // Put the new own meal in the existing five quick favorite slots.
        const next = [combined, ...favorites]
        storage.setItem(storageKey, JSON.stringify(next))
        favorites = next; favoriteError = ''; message = 'Eget måltid gemt i Favoritter.'; emit(); return true
      } catch { return fail('Favoritten blev ikke gemt. Prøv igen.') }
    },
    // Intent tokens deduplicate replays of the same UI action, including after success.
    // A fresh deliberate click after completion gets a fresh token, so two meals are possible.
    async log(meal, intent) {
      if (disposed || !validId(intent) || pending || committed.has(intent) || !['ready', 'saved', 'save-error'].includes(phase)) return false
      const value = cleanMeal(meal)
      if (!value) { message = 'Udfyld måltid og gyldige næringsværdier.'; emit(); return false }
      const day = typeof currentDay === 'function' ? currentDay() : date
      if (calendarTime(day) === null) { message = 'Datoen kunne ikke bestemmes. Prøv igen.'; emit(); return false }
      const payload = { athlete_id: id, date: day, ...value }
      pending = intent; phase = 'saving'; message = 'Gemmer måltid…'; emit()
      try {
        // The production adapter returns the identity from this exact insert.
        // Legacy boolean fixtures retain their existing unambiguous read-back path.
        const identified = typeof contracts.saveWithIdentity === 'function'
        const result = identified ? await contracts.saveWithIdentity(payload) : await contracts.save(payload)
        if (identified ? result?.ok !== true : result !== true) throw new Error()
        const savedId = identified && validId(result.id) && !result.id.startsWith('local:') ? result.id : null
        committed.add(intent)
        if (disposed) return false
        // No optimistic totals: failures leave the diary exactly as it was.
        const existingIds = new Set(rows.map(r => r.id))
        const localRow = { ...payload, id: savedId || 'local:' + intent }
        let savedRow = localRow
        rows.unshift(localRow)
        // Legacy save adapters return a boolean without the generated database ID.
        // Resolve canonical identities before offering edit/remove on those meals.
        // Runde 12 (fletning): only for the controller's own day; after midnight the
        // assembly replaces this controller via onDayChanged and a fresh load resolves it.
        if (!savedId && day === date && (typeof contracts.remove === 'function' || typeof contracts.update === 'function')) {
          try {
            const result = await contracts.load(id, date)
            if (disposed) return false
            // A stale read must not erase an already confirmed insert. Resolve
            // only an unambiguous new identity with exactly the saved values.
            const candidates = checkedRows(result).filter(r => validId(r.id) && !r.id.startsWith('local:')
              && !existingIds.has(r.id) && r.date === date && cleanMeal(r) && mealKey(cleanMeal(r)) === mealKey(value))
            if (candidates.length === 1) { savedRow = candidates[0]; rows = rows.map(r => r === localRow ? savedRow : r) }
          } catch { /* Keep the confirmed local log; a later load resolves its ID. */ }
        }
        if (disposed) return false
        templates = refreshTemplates()
        clearUndo()
        if (savedId && day === date && mutable(savedRow) && typeof contracts.remove === 'function') {
          undo = { rowId: savedRow.id, token: intent, meal: value.meal, expiresAt: now() + 5000 }
          undoTimer = schedule(() => { clearUndo(); emit() }, 5000)
        }
        phase = 'saved'; message = 'Måltid gemt.'
        if (day === date && typeof contracts.remove === 'function' && !undo)
          message += ' Fortryd kunne ikke klargøres. Hent dagbogen igen for at fjerne måltidet.'
        if (day !== date) { try { onDayChanged?.(day) } catch { /* ignoreret */ } }
        return true
      } catch {
        if (!disposed) { phase = 'save-error'; message = 'Måltidet blev ikke gemt. Prøv igen.' }
        return false
      } finally { pending = null; emit() }
    },
    update(rowId, meal, intent) { return mutate('update', rowId, meal, intent) },
    remove(rowId, intent, confirmed = false) { return mutate('remove', rowId, null, intent, confirmed) },
    dispose() { clearUndo(); disposed = true; unsubscribeTargets?.(); loadToken++; listeners.clear(); rows = []; favorites = []; committed.clear(); selectedParts.clear() },
  }
  const unsubscribeTargets = dayTargets?.subscribe?.(emit)
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
