export const SESSION_NOTE_LIMIT = 280
export const ENERGY_LEVELS = Object.freeze([
  'Helt tømt', 'Lav energi', 'Middel energi', 'God energi', 'Masser af energi',
])

const missing = value => value == null || (typeof value === 'string' && !value.trim())
function number(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN
  if (typeof value !== 'string' || !/^\d+(?:[.,]\d+)?$/.test(value.trim())) return NaN
  return Number(value.trim().replace(',', '.'))
}

// Pure, explicit input only. No set-RPE inference, identity, clock or persistence.
// A ready value is a draft for the caller, never evidence that anything was saved.
export function sessionFeeling(input) {
  const draft = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const errors = {}, value = { rpe: null, energy: null, note: '' }
  const rpe = number(draft.rpe), energy = number(draft.energy)
  if (missing(draft.rpe)) errors.rpe = 'Vælg samlet RPE for passet.'
  else if (!Number.isFinite(rpe) || rpe < 0 || rpe > 10 || !Number.isInteger(rpe * 2)) {
    errors.rpe = 'Brug RPE fra 0 til 10 i halve trin.'
  } else value.rpe = rpe
  if (missing(draft.energy)) errors.energy = 'Vælg din energi efter passet.'
  else if (!Number.isInteger(energy) || energy < 1 || energy > 5) {
    errors.energy = 'Brug et energiniveau fra 1 til 5.'
  } else value.energy = energy
  if (draft.note != null && typeof draft.note !== 'string') errors.note = 'Noten skal være tekst.'
  else if ((draft.note ?? '').length > SESSION_NOTE_LIMIT) errors.note = `Brug højst ${SESSION_NOTE_LIMIT} tegn i noten.`
  else value.note = (draft.note ?? '').trim()
  const invalid = (!missing(draft.rpe) && !!errors.rpe) || (!missing(draft.energy) && !!errors.energy) || !!errors.note
  return { status: invalid ? 'invalid' : Object.keys(errors).length ? 'incomplete' : 'ready', value, errors }
}
