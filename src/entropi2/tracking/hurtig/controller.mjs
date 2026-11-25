import { dayNumber, requireId } from '../trackingDates.mjs'
import { buildQuickModel, preferenceKey, readinessValue, weightValue } from './model.mjs'

export const UNDO_MS = 5000
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}
const defaultClock = { now: () => Date.now(), setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: id => clearTimeout(id) }

/** One immutable athlete/calendar day. Host owns disposal and existing write adapters.
 * No persistence of drafts or logs. Only an explicitly selected meal key is stored.
 * A save is held locally for 5 seconds; undo cancels BEFORE any write is called.
 * Ordre 2380: a kind with an `undo` adapter is written at once instead (no hold). The snapshot then
 * says canUndo, and undo() calls the adapter, which removes the row again (literal true = removed).
 */
export function createQuickController(options = {}) {
  if (options.enabled !== true) return null
  const { athleteId, date, data, save: injectedSave = {}, storage, clock = defaultClock, currentDay, kortDagsform = false, undo: undoSave = {} } = options
  requireId(athleteId); dayNumber(date)
  const save = Object.fromEntries(['readiness', 'weight', 'meal'].map(kind => [kind, injectedSave[kind]]))
  const listeners = new Set(), successful = new Map()
  let disposed = false, timer = null, pending = null, cached, model = null, lastSaved = null
  let phase = data?.status === 'loading' ? 'loading' : 'error', message = '', preferenceMessage = ''
  let draft, selectedMeal = '', readinessSource, weightSource
  if (data?.status === 'ready' && data.complete === true) {
    try {
      model = buildQuickModel({ athleteId, date, readinessRows: data.readinessRows,
        weightRows: data.weightRows, mealRows: data.mealRows })
      draft = structuredClone(model.draft)
      // Ordre 2172: den korte Dagsform har sult som ekstra, valgfrit felt.
      if (kortDagsform === true) draft.readiness.hunger = ''
      ;({ readinessSource, weightSource } = model)
      phase = 'ready'
      if (storage) {
        try {
          const raw = storage.getItem(preferenceKey(athleteId))
          if (raw !== null && raw !== undefined) {
            const stored = JSON.parse(raw)
            if (stored?.version !== 1 || typeof stored.mealKey !== 'string') throw new Error()
            if (model.meals.some(meal => meal.key === stored.mealKey)) selectedMeal = stored.mealKey
          }
        } catch { preferenceMessage = 'Sidste måltidsvalg kunne ikke læses. Vælg igen.' }
      }
    } catch { model = null; phase = 'error' }
  }
  const snapshot = () => cached
  const refresh = () => {
    cached = freeze({ athleteId, date, phase, message, preferenceMessage, selectedMeal,
      draft: draft ? structuredClone(draft) : null, readinessSource, weightSource,
      meals: model ? structuredClone(model.meals) : [], ignoredMeals: model?.ignoredMeals ?? 0,
      canRepeat: model?.canRepeat ?? false, deadline: pending?.deadline ?? null,
      busy: phase === 'pending' || phase === 'saving', canUndo: phase === 'saved' && lastSaved !== null,
      available: Object.fromEntries(['readiness', 'weight', 'meal'].map(kind => [kind, typeof save[kind] === 'function'])) })
  }
  const emit = () => { refresh(); if (!disposed) for (const fn of listeners) fn() }
  const editable = () => !disposed && model && phase !== 'pending' && phase !== 'saving'
  const sameDay = () => {
    try { return typeof currentDay !== 'function' || currentDay() === date }
    catch { return false }
  }
  const clearTimer = () => { if (timer !== null) clock.clearTimeout(timer); timer = null }
  const commit = async operation => {
    if (disposed || pending !== operation || phase !== 'pending') return false
    clearTimer()
    if (clock.now() < operation.deadline) { timer = clock.setTimeout(() => { void commit(operation) }, operation.deadline - clock.now()); return false }
    try {
      if (!sameDay()) throw new Error('day-changed')
    } catch {
      pending = null; phase = 'save-error'; message = 'Dagen er skiftet eller ukendt. Åbn dagens log igen. Intet blev sendt.'; emit(); return false
    }
    phase = 'saving'; message = 'Gemmer…'; emit()
    if (disposed) return false
    try {
      // Adapter must return literal true only for a confirmed successful write.
      const ok = await save[operation.kind](structuredClone(operation.payload))
      if (disposed) return ok === true
      if (ok !== true) throw new Error()
      successful.set(operation.kind, JSON.stringify(operation.payload))
      phase = 'saved'; message = 'Gemt.'
      lastSaved = typeof undoSave[operation.kind] === 'function' ? { kind: operation.kind } : null
      if (operation.kind === 'readiness') readinessSource = 'today'
      if (operation.kind === 'weight') weightSource = 'today'
      return true
    } catch {
      if (!disposed) { phase = 'save-error'; message = 'Kunne ikke bekræfte gemningen. Dine valg er bevaret. Kontrollér loggen før du prøver igen.' }
      return false
    } finally { pending = null; if (!disposed) emit() }
  }
  // Ordre 2380: fortryd efter en øjeblikkelig gemning. Fejler fjernelsen, står rækken stadig, og atleten ser det.
  const undoSaved = async () => {
    const { kind } = lastSaved
    phase = 'saving'; message = 'Fortryder…'; emit()
    let removed = false
    try { removed = await undoSave[kind]() === true } catch { removed = false }
    if (disposed) return removed
    if (removed) {
      successful.delete(kind); lastSaved = null; phase = 'ready'; message = 'Fortrudt. Dagsformen er fjernet igen.'
      if (kind === 'readiness') readinessSource = 'edited'
    } else { phase = 'saved'; message = 'Kunne ikke fortryde. Dagsformen er stadig gemt. Tjek din forbindelse og prøv igen.' }
    emit(); return removed
  }
  const api = {
    snapshot,
    subscribe(fn) { if (disposed) return () => {}; listeners.add(fn); return () => listeners.delete(fn) },
    setField(kind, field, value) {
      if (!editable() || typeof value !== 'string') return false
      if (kind === 'readiness' && Object.hasOwn(draft.readiness, field)) { draft.readiness[field] = value; readinessSource = 'edited' }
      else if (kind === 'weight' && field === 'weight') { draft.weight = value; weightSource = 'edited' }
      else return false
      phase = 'ready'; message = ''; emit(); return true
    },
    sameAsYesterday() {
      if (!editable() || !model.canRepeat) return false
      // Missing yesterday values do not erase today's answers in another domain.
      if (Object.values(model.yesterdayDraft.readiness).some(value => value !== '')) {
        draft.readiness = { ...model.yesterdayDraft.readiness,
          ...(kortDagsform === true ? { hunger: draft.readiness.hunger ?? '' } : {}) }; readinessSource = 'yesterday'
      }
      if (model.yesterdayDraft.weight !== '') { draft.weight = model.yesterdayDraft.weight; weightSource = 'yesterday' }
      phase = 'ready'; message = 'Forslag fra i går er indsat. Kontrollér dem og tryk Gem.'; emit(); return true
    },
    selectMeal(key) {
      if (!editable() || !model.meals.some(meal => meal.key === key)) return false
      selectedMeal = key; phase = 'ready'; message = ''
      if (storage) {
        try { storage.setItem(preferenceKey(athleteId), JSON.stringify({ version: 1, mealKey: key })); preferenceMessage = '' }
        catch { preferenceMessage = 'Valget huskes kun, mens denne log er åben.' }
      } else preferenceMessage = 'Valget huskes kun, mens denne log er åben.'
      emit(); return true
    },
    save(kind) {
      if (!editable() || !['readiness', 'weight', 'meal'].includes(kind)) return false
      if (typeof save[kind] !== 'function') { message = 'Gemning er ikke tilsluttet her.'; phase = 'save-error'; emit(); return false }
      let payload
      try {
        if (!sameDay()) throw new TypeError('Dagen er skiftet. Åbn dagens log igen.')
        if (kind === 'readiness') payload = { athlete_id: athleteId, logged_date: date, ...readinessValue(draft.readiness, kortDagsform === true) }
        if (kind === 'weight') payload = { athlete_id: athleteId, logged_at: date, weight: weightValue(draft.weight) }
        if (kind === 'meal') {
          const meal = model.meals.find(item => item.key === selectedMeal)
          if (!meal) throw new TypeError('Vælg et måltid.')
          payload = { athlete_id: athleteId, date, ...meal.value }
        }
      } catch (error) { phase = 'save-error'; message = error instanceof TypeError ? error.message : 'Datoen kunne ikke bestemmes. Åbn dagens log igen.'; emit(); return false }
      if (kind !== 'meal' && successful.get(kind) === JSON.stringify(payload)) {
        phase = 'saved'; message = 'Disse svar er allerede gemt.'; emit(); return false
      }
      const now = typeof undoSave[kind] === 'function'
      pending = { kind, payload, deadline: clock.now() + (now ? 0 : UNDO_MS) }
      phase = 'pending'; lastSaved = null
      const operation = pending
      if (now) { message = 'Gemmer…'; emit(); void commit(operation); return true }
      message = 'Klar til at gemme. Du kan fortryde i 5 sekunder.'
      timer = clock.setTimeout(() => { void commit(operation) }, UNDO_MS)
      emit(); return true
    },
    undo() {
      if (!disposed && phase === 'saved' && lastSaved) return undoSaved()
      if (disposed || phase !== 'pending') return false
      if (clock.now() >= pending.deadline) { void commit(pending); return false }
      return api.cancelPending()
    },
    cancelPending() {
      if (disposed || phase !== 'pending') return false
      clearTimer(); pending = null; phase = 'ready'; message = 'Fortrudt. Intet blev sendt til gemning.'; emit(); return true
    },
    dispose() { clearTimer(); disposed = true; pending = null; listeners.clear() },
  }
  // The snapshot reference changes only after a state transition (React contract).
  refresh()
  return api
}
