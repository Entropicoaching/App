import { athleteGoals, goalChoices, goalDraft, goalFields, validateGoalDraft } from './profileGoalsModel.mjs'
import { ownGoalScope, readProfileGoals, writeProfileGoals } from './profileGoalsStore.mjs'

const savedMessage = 'Gemt på denne enhed; din coach ser det ikke endnu'

export function createProfileGoals(options = {}) {
  if (options.enabled !== true) return null
  const { getScope, storage } = options
  const scope = { ...getScope?.() }
  if (!ownGoalScope(scope) || options.athlete?.id !== scope.athleteId || options.athlete?.user_id !== scope.ownerId) return null
  const athlete = { ...options.athlete }
  const coachGoal = typeof athlete.goal === 'string' && !goalChoices.some(([code]) => code === athlete.goal.trim())
    ? athlete.goal.trim() : null
  let saved = athleteGoals(athlete), local = {}, draft = goalDraft(saved), raw = null
  let phase = 'loading', errors = {}, message = '', pending = false, disposed = false
  const listeners = new Set()
  const current = () => {
    if (disposed) return false
    const next = getScope?.()
    return ownGoalScope(next) && next.ownerId === scope.ownerId && next.athleteId === scope.athleteId
  }
  const emit = () => { if (current()) for (const listener of listeners) listener() }
  const snapshot = () => ({ phase, values: { ...saved }, localFields: Object.keys(local), draft: { ...draft },
    coachGoal, errors: { ...errors }, message, pending })
  const api = {
    snapshot,
    subscribe(fn) { if (!current()) return () => {}; listeners.add(fn); return () => listeners.delete(fn) },
    load() {
      if (!current() || pending) return false
      try {
        const result = readProfileGoals({ enabled: true, scope, athlete, storage, isCurrent: current })
        if (!current()) return false
        saved = result.values; local = result.local; raw = result.raw; draft = goalDraft(saved)
        phase = 'ready'; message = Object.keys(local).length ? savedMessage : ''; errors = {}; emit(); return true
      } catch {
        if (current()) {
          phase = 'load-error'; message = 'Dine lokale mål kunne ikke læses. Prøv igen, før du redigerer.'; emit()
        }
        return false
      }
    },
    refresh() { return api.load() },
    change(key, value) {
      if (!current() || pending || phase === 'loading' || phase === 'load-error' || !goalFields.includes(key)) return false
      draft = { ...draft, [key]: value }; errors = {}; phase = 'ready'; message = ''; emit(); return true
    },
    reset() {
      if (!current() || pending || phase === 'loading' || phase === 'load-error') return false
      draft = goalDraft(saved); errors = {}; phase = 'ready'; message = Object.keys(local).length ? savedMessage : ''; emit(); return true
    },
    async save() {
      if (!current() || pending || phase === 'loading' || phase === 'load-error') return false
      const checked = validateGoalDraft(draft, saved)
      errors = checked.errors
      if (Object.keys(errors).length) { phase = 'error'; message = 'Ret felterne nedenfor.'; emit(); return false }
      pending = true; phase = 'saving'; message = 'Gemmer mål…'; emit()
      try {
        // One local record contains all four fields, including explicit clears.
        // Neither the host athlete nor any coach-owned database field is written.
        const nextRaw = writeProfileGoals(scope, checked.values, storage, { isCurrent: current, expectedRaw: raw })
        if (!current()) return false
        raw = nextRaw; local = { ...checked.values }; saved = { ...checked.values }; draft = goalDraft(saved)
        phase = 'saved'; message = savedMessage; return true
      } catch {
        if (current()) {
          phase = 'error'; message = 'Målene blev ikke gemt. Dit udkast er bevaret. Prøv igen. Hvis målene er ændret i en anden fane, luk og åbn profilen før du prøver igen.'
        }
        return false
      } finally { pending = false; emit() }
    },
    dispose() { disposed = true; listeners.clear() },
  }
  return api
}
