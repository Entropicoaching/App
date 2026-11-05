import { parsePlannedRpe } from './ugeHjaelp.js'
import { nextSetInSession } from '../nextSet.js'
import { inputInteger, parseInputNumber, optionalInput } from '../inputValues.js'

export function trainingInput(input = {}) {
  const weight = parseInputNumber(input.weight)
  const reps = inputInteger(input.reps)
  const rpe = optionalInput(input.rpe) ? null : parseInputNumber(input.rpe)
  if (weight === null || reps === null || reps < 1 ||
      (!optionalInput(input.rpe) && (rpe === null || rpe > 10))) return null
  return { ...input, weight: String(weight), reps: String(reps), rpe: rpe === null ? '' : String(rpe), rpe_source: rpe === null ? null : 'athlete' }
}

export function createTrainingApproval(latest, changed) {
  const pending = new Set()
  const settled = new Set()
  return {
    pending,
    // Called after React commits props, so automatic batching cannot turn an
    // optimistic log into a false failure or unlock a stale click too early.
    reconcile() {
      for (const key of settled) {
        settled.delete(key)
        pending.delete(key)
        const saved = latest().exerciseLogs.some(l => `${l.exercise_id}_${l.set_number}` === key)
        changed(saved ? '' : 'Sættet blev ikke gemt. Prøv igen.')
      }
    },
    async approve(session, expected, input) {
      const { exerciseLogs, onLogSet } = latest()
      const next = nextSetInSession(session, exerciseLogs)
      if (!next || next.exercise.id !== expected.exercise.id || next.setNumber !== expected.setNumber) return false
      const key = `${next.exercise.id}_${next.setNumber}`
      if (pending.has(key)) return false
      const values = trainingInput(input)
      if (!values) { changed('Skriv vægt og hele gentagelser. RPE er valgfri fra 0 til 10.'); return false }
      pending.add(key)
      changed('')
      try {
        // This existing API supplies optimistic logs and the existing offline queue.
        // Preserve the actual missing value and the separate planned RPE.
        await onLogSet(next.exercise, next.setNumber, next.totalSets, Number(values.reps), parsePlannedRpe(next.exercise.intensity), values, { preserveMissingRpe: true })
        settled.add(key)
        return true
      } catch {
        pending.delete(key)
        changed('Sættet blev ikke gemt. Prøv igen.')
        return false
      } finally {
        changed()
      }
    },
  }
}
