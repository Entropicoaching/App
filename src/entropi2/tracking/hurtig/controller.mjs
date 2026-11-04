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
 */
export function createQuickController(options = {}) {
  if (options.enabled !== true) return null
  const { athleteId, date, data, save: injectedSave = {}, storage, clock = defaultClock, currentDay } = options
  requireId(athleteId); dayNumber(date)
  const save = Object.fromEntries(['readiness', 'weight', 'meal'].map(kind => [kind, injectedSave[kind]]))
  const listeners = new Set(), successful = new Map()
  let disposed = false, timer = null, pending = null, cached, model = null
  let phase = data?.status === 'loading' ? 'loading' : 'error', message = '', preferenceMessage = ''
  let draft, selectedMeal = '', readinessSource, weightSource
  if (data?.status === 'ready' && data.complete === true) {
    try {
      model = buildQuickModel({ athleteId, date, readinessRows: data.readinessRows,
        weightRows: data.weightRows, mealRows: data.mealRows })
      draft = structuredClone(model.draft)
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
      busy: phase === 'pending' || phase === 'saving',
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
      if (operation.kind === 'readiness') readinessSource = 'today'
      if (operation.kind === 'weight') weightSource = 'today'
      return true
    } catch {
      if (!disposed) { phase = 'save-error'; message = 'Kunne ikke bekræfte gemningen. Dine valg er bevaret. Kontrollér loggen før du prøver igen.' }
      return false
    } finally { pending = null; if (!disposed) emit() }
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
        draft.readiness = { ...model.yesterdayDraft.readiness }; readinessSource = 'yesterday'
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
        if (kind === 'readiness') payload = { athlete_id: athleteId, logged_date: date, ...readinessValue(draft.readiness) }
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
      pending = { kind, payload, deadline: clock.now() + UNDO_MS }
      phase = 'pending'; message = 'Klar til at gemme. Du kan fortryde i 5 sekunder.'
      const operation = pending
      timer = clock.setTimeout(() => { void commit(operation) }, UNDO_MS)
      emit(); return true
    },
    undo() {
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
