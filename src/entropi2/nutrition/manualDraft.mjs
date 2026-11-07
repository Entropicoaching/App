import { parseInputNumber } from '../../athlete/kostNumbers.mjs'

export const manualFields = [
  ['meal', 'Måltid'], ['kcal', 'Energi (kcal)'], ['protein', 'Protein (g)'],
  ['carb', 'Kulhydrat (g)'], ['fat', 'Fedt (g)'],
]

// Presentation validation only. The controller remains the authority for saves.
// Keep raw draft strings intact; a blank nutrient is never a known zero.
export function manualDraftErrors(draft) {
  return manualFields.flatMap(([key, label]) => {
    const value = draft[key]
    const missing = value == null || (typeof value === 'string' && !value.trim())
    const invalid = key === 'meal' ? typeof value !== 'string' : parseInputNumber(value) === null
    return missing || invalid ? [{ key, label, missing }] : []
  })
}
