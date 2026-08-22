import { targetPrescriptionForExercise } from '../supabase/functions/_shared/progressionState.js'

export const FORECAST_FIELD_LABELS = {
  sets: 'sæt',
  reps: 'reps',
  load_kg: 'vægt',
  rpe_target: 'RPE',
}

function forecastKeyParts(key) {
  const [sessionIndex, exerciseIndex] = String(key || '').split(':').map(Number)
  return Number.isInteger(sessionIndex) && Number.isInteger(exerciseIndex)
    ? { sessionIndex, exerciseIndex }
    : null
}

export function draftExerciseForForecast(payload, key) {
  const parts = forecastKeyParts(key)
  if (!parts) return null
  return payload?.sessions?.[parts.sessionIndex]?.exercises?.[parts.exerciseIndex] || null
}

function ensureDraftSets(exercise) {
  if (!Array.isArray(exercise.sets) || !exercise.sets.length) exercise.sets = [{}]
  return exercise.sets
}

function nullableNumber(value) {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(String(value).replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function sameForecastValue(left, right, field) {
  if (field === 'reps') {
    const a = left === null || left === undefined ? null : String(left).trim()
    const b = right === null || right === undefined ? null : String(right).trim()
    return a === b
  }
  if (left === null || left === undefined) return right === null || right === undefined
  if (right === null || right === undefined) return false
  return Number(left) === Number(right)
}

function prescriptionValue(prescription, field) {
  return prescription?.[field === 'sets' ? 'set_count' : field]
}

function changedForecastFields(current, baseline) {
  if (!baseline) return Object.keys(FORECAST_FIELD_LABELS)
  return Object.keys(FORECAST_FIELD_LABELS).filter(field =>
    !sameForecastValue(prescriptionValue(current, field), prescriptionValue(baseline, field), field))
}

/** Opdaterer både den synlige kladde og det forecast der senere godkendes. */
export function updateDraftForecast({ draftPayload, forecastState, baselineState, key, field, value }) {
  const nextPayload = structuredClone(draftPayload)
  const nextExercise = draftExerciseForForecast(nextPayload, key)
  if (!nextExercise) return null

  if (field === 'sets') {
    const count = Math.max(1, Math.round(nullableNumber(value) || 1))
    const currentSets = ensureDraftSets(nextExercise).map(set => ({ ...set }))
    const template = currentSets[0] || {}
    nextExercise.sets = Array.from({ length: count }, (_, index) => ({ ...currentSets[index] || template }))
  } else if (field === 'reps') {
    const reps = String(value || '').trim()
    ensureDraftSets(nextExercise).forEach(set => {
      if (reps) set.reps = reps
      else delete set.reps
    })
  } else if (field === 'load_kg') {
    const load = nullableNumber(value)
    ensureDraftSets(nextExercise).forEach(set => {
      if (load === null) delete set.weight
      else set.weight = load
    })
  } else if (field === 'rpe_target') {
    const rpe = nullableNumber(value)
    if (rpe === null) delete nextExercise.rpeTarget
    else nextExercise.rpeTarget = rpe
  }

  const nextState = structuredClone(forecastState)
  const nextForecast = nextState?.expected_progression?.exercises?.find(item => item.key === key)
  const baselineForecast = baselineState?.expected_progression?.exercises?.find(item => item.key === key)
  if (!nextForecast) return null

  const prescription = targetPrescriptionForExercise(nextExercise)
  nextForecast.expected = {
    ...nextForecast.expected,
    prescription,
    load_kg: field === 'load_kg'
      ? (prescription.load_kg === null
        ? null
        : { min: prescription.load_kg, target: prescription.load_kg, max: prescription.load_kg })
      : nextForecast.expected?.load_kg,
  }
  const changedFields = changedForecastFields(prescription, baselineForecast?.expected?.prescription)
  if (changedFields.length) {
    nextForecast.override = {
      fields: changedFields,
      reason: nextForecast.override?.reason || '',
    }
  } else {
    delete nextForecast.override
  }
  return { draftPayload: nextPayload, forecastState: nextState }
}

export function updateForecastOverrideReason(forecastState, key, reason) {
  const nextState = structuredClone(forecastState)
  const forecast = nextState?.expected_progression?.exercises?.find(item => item.key === key)
  if (!forecast?.override) return nextState
  forecast.override = { ...forecast.override, reason }
  return nextState
}

export function progressionOverrideErrors(state) {
  return (state?.expected_progression?.exercises || [])
    .filter(item => item.override && !String(item.override.reason || '').trim())
    .map(item => `${item.exercise_name}: begrundelse for manuel ændring mangler`)
}
