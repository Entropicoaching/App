import { parseInputNumber, inputInteger } from '../inputValues.js'
import { parseRepsPrescription } from '../repsPrescription.js'
import { fixedRepsEntry } from '../fixedRepsEntry.js'

// Kun den eksplicitte tekst true aktiverer forsøget. Ingen storage eller net.
export const APP_LOG2_ENABLED = import.meta.env?.VITE_APP_LOG2 === 'true'

// Historikken er grupperet pr. navn og dato af fetchExerciseHistory.
// Samme sætnummer på seneste tidligere dag, ellers dagens sidste sæt.
export function previousLog2Set(history, name, today, setNumber) {
  const days = (history?.[name?.toLowerCase()] || [])
    .filter(day => day.date < today && day.sets?.length)
    .slice().sort((a, b) => b.date.localeCompare(a.date))
  const sets = days[0]?.sets || []
  return sets.find(set => set.set === setNumber) || sets[sets.length - 1] || null
}

export function log2Defaults(ex, last, suggestion) {
  const weight = parseInputNumber(ex.recommended_weight) ?? parseInputNumber(last?.weight)
    ?? parseInputNumber(suggestion?.weight)
  const prescription = parseRepsPrescription(ex.reps)
  const fixed = fixedRepsEntry(ex.reps)
  let reps = fixed == null ? null : inputInteger(fixed)
  if (prescription.type === 'range') {
    const previous = inputInteger(last?.reps)
    reps = previous != null && previous >= prescription.min && previous <= prescription.max
      ? previous : prescription.min
  } else if (prescription.type === 'free') reps = inputInteger(last?.reps)
  return { weight: weight == null ? '' : String(weight), reps: reps == null ? '' : String(reps) }
}

// Opdater kun vores egen forudfyldning. Tømte, berørte felter bliver tomme.
export function fillLog2Input(current, lastAuto, touched, defaults) {
  if (touched) return null
  const next = { weight: '', reps: '', note: '', rpe: '', ...current }
  let changed = false
  for (const field of ['weight', 'reps']) {
    const value = next[field] || ''
    if ((!value || value === lastAuto?.[field]) && value !== defaults[field]) {
      next[field] = defaults[field]
      changed = true
    }
  }
  return changed ? next : null
}

// Den renderede knap og dens handler bruges også i de syntetiske DOM-prøver.
export function renderLog2Button(h, { style, describedBy, input, reps, exercise,
  setNumber, totalSets, plannedRpe, askZero, acceptTap, clearZero, onLogSet }) {
  return h('button', { type: 'button', 'aria-describedby': describedBy, style,
    onClick() {
      if (askZero()) return
      if (!acceptTap()) return
      clearZero()
      return onLogSet(exercise, setNumber, totalSets, reps, plannedRpe, { ...input })
    },
  }, 'Som planlagt')
}
