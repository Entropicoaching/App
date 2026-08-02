// A deliberately small, pure model for the member product's set log.
//
// A planned set and its result stay together. That makes it possible to show
// the athlete exactly what was planned, preserve what they actually did, and
// later make a cautious week-two proposal without guessing from a session
// total. This module does not persist data or decide a new load.

export const CUSTOMER_SET_LOG_SCHEMA_VERSION = 1

const MAX_NOTE_LENGTH = 500

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0
}

function isNonNegativeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isRpe(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= 10
}

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function issue(errors, field, code) {
  errors.push({ field, code })
}

// Validates one set as a whole rather than validating the visible input fields
// independently. In particular, a skipped set can have a note but cannot also
// masquerade as a completed set with performance data.
export function validateCustomerSetLog(input) {
  const errors = []
  if (!isObject(input)) return { ok: false, errors: [{ field: 'set', code: 'not-an-object' }] }

  const planned = input.planned
  const actual = input.actual
  if (!isObject(planned)) issue(errors, 'planned', 'required-object')
  if (!isObject(actual)) issue(errors, 'actual', 'required-object')

  const weekNumber = input.weekNumber
  const sessionId = text(input.sessionId)
  const exerciseId = text(input.exerciseId)
  const setNumber = input.setNumber

  if (!isPositiveInteger(weekNumber)) issue(errors, 'weekNumber', 'positive-integer-required')
  if (!sessionId) issue(errors, 'sessionId', 'required')
  if (!exerciseId) issue(errors, 'exerciseId', 'required')
  if (!isPositiveInteger(setNumber)) issue(errors, 'setNumber', 'positive-integer-required')

  if (isObject(planned)) {
    const athleteEntryRequired = planned.loadSource === 'athlete-entry-required'
    if (!isNonNegativeNumber(planned.weightKg) && !(planned.weightKg === null && athleteEntryRequired)) {
      issue(errors, 'planned.weightKg', 'non-negative-number-or-athlete-entry-required')
    }
    if (planned.loadSource != null && typeof planned.loadSource !== 'string') issue(errors, 'planned.loadSource', 'string-required')
    if (!isPositiveInteger(planned.reps)) issue(errors, 'planned.reps', 'positive-integer-required')
    if (!isRpe(planned.rpe)) issue(errors, 'planned.rpe', 'rpe-1-to-10-required')
  }

  if (isObject(actual)) {
    if (typeof actual.skipped !== 'boolean') issue(errors, 'actual.skipped', 'boolean-required')
    const note = actual.note == null ? '' : actual.note
    if (typeof note !== 'string') issue(errors, 'actual.note', 'string-required')
    if (typeof note === 'string' && note.trim().length > MAX_NOTE_LENGTH) issue(errors, 'actual.note', 'too-long')

    if (actual.skipped === true) {
      for (const field of ['weightKg', 'repsCompleted', 'rpeActual']) {
        if (actual[field] != null) issue(errors, `actual.${field}`, 'must-be-empty-when-skipped')
      }
    } else if (actual.skipped === false) {
      if (!isNonNegativeNumber(actual.weightKg)) issue(errors, 'actual.weightKg', 'non-negative-number-required')
      if (!isPositiveInteger(actual.repsCompleted)) issue(errors, 'actual.repsCompleted', 'positive-integer-required')
      if (!isRpe(actual.rpeActual)) issue(errors, 'actual.rpeActual', 'rpe-1-to-10-required')
    }
  }

  if (errors.length) return { ok: false, errors }

  return {
    ok: true,
    errors: [],
    value: {
      schemaVersion: CUSTOMER_SET_LOG_SCHEMA_VERSION,
      weekNumber,
      sessionId,
      exerciseId,
      setNumber,
      planned: {
        weightKg: planned.weightKg,
        reps: planned.reps,
        rpe: planned.rpe,
        ...(planned.loadSource ? { loadSource: planned.loadSource } : {}),
      },
      actual: actual.skipped
        ? { weightKg: null, repsCompleted: null, rpeActual: null, note: text(actual.note), skipped: true }
        : {
            weightKg: actual.weightKg,
            repsCompleted: actual.repsCompleted,
            rpeActual: actual.rpeActual,
            note: text(actual.note),
            skipped: false,
          },
    },
  }
}

export function isValidCustomerSetLog(input) {
  return validateCustomerSetLog(input).ok
}

function compareLogs(a, b) {
  return a.sessionId.localeCompare(b.sessionId)
    || a.exerciseId.localeCompare(b.exerciseId)
    || a.setNumber - b.setNumber
}

function round(value) {
  return Math.round(value * 10) / 10
}

function exerciseSummary(logs, exerciseId) {
  const exerciseLogs = logs.filter(log => log.exerciseId === exerciseId)
  const completed = exerciseLogs.filter(log => !log.actual.skipped)
  const skipped = exerciseLogs.length - completed.length
  const volumeKg = completed.reduce((sum, log) => sum + log.actual.weightKg * log.actual.repsCompleted, 0)
  const actualRpe = completed.map(log => log.actual.rpeActual)
  const allRepsMet = completed.length === exerciseLogs.length
    && completed.every(log => log.actual.repsCompleted >= log.planned.reps)
  const atOrBelowPlannedRpe = completed.length === exerciseLogs.length
    && completed.every(log => log.actual.rpeActual <= log.planned.rpe)

  return {
    exerciseId,
    plannedSets: exerciseLogs.length,
    completedSets: completed.length,
    skippedSets: skipped,
    volumeKg: Math.round(volumeKg),
    averageRpeActual: actualRpe.length ? round(actualRpe.reduce((sum, value) => sum + value, 0) / actualRpe.length) : null,
    allRepsMet,
    atOrBelowPlannedRpe,
    // One complete week is enough evidence for a visible week-two proposal.
    // It is still not an automatic progression command or a programme write.
    stableExposure: allRepsMet && atOrBelowPlannedRpe && skipped === 0,
  }
}

// Summarises only valid, complete set records for one specified week. Invalid
// data is reported, never silently treated as a successful set. The result is
// intentionally conservative: it can make a complete, acceptable week ready
// for a visible proposal, but never applies a load increase automatically.
export function summarizeCustomerWeek(logs, weekNumber) {
  const source = Array.isArray(logs) ? logs : []
  const valid = []
  let invalidLogCount = 0

  for (const item of source) {
    const checked = validateCustomerSetLog(item)
    if (!checked.ok) {
      invalidLogCount += 1
      continue
    }
    if (checked.value.weekNumber === weekNumber) valid.push(checked.value)
  }

  const ordered = [...valid].sort(compareLogs)
  const exerciseIds = [...new Set(ordered.map(log => log.exerciseId))].sort()
  const exercises = exerciseIds.map(exerciseId => exerciseSummary(ordered, exerciseId))
  const plannedSets = ordered.length
  const completedSets = ordered.filter(log => !log.actual.skipped).length
  const skippedSets = plannedSets - completedSets
  const rpes = ordered.filter(log => !log.actual.skipped).map(log => log.actual.rpeActual)
  const stableExercises = exercises.filter(exercise => exercise.stableExposure).map(exercise => exercise.exerciseId)
  const allSetsStable = plannedSets > 0 && stableExercises.length === exercises.length

  let readiness = 'insufficient-data'
  let reasonCode = plannedSets === 0 ? 'no-valid-sets-for-week' : 'complete-week-required'
  if (plannedSets === 0) {
    readiness = 'insufficient-data'
    reasonCode = 'no-valid-sets-for-week'
  } else if (invalidLogCount > 0) {
    readiness = 'review'
    reasonCode = 'invalid-log-present'
  } else if (skippedSets > 0) {
    readiness = 'hold'
    reasonCode = 'skipped-set-present'
  } else if (!allSetsStable) {
    readiness = 'hold'
    reasonCode = 'performance-not-clearly-below-plan'
  } else if (allSetsStable) {
    readiness = 'proposal-ready'
    reasonCode = 'complete-acceptable-week'
  }

  return {
    schemaVersion: CUSTOMER_SET_LOG_SCHEMA_VERSION,
    weekNumber,
    plannedSets,
    completedSets,
    skippedSets,
    completionRate: plannedSets ? round(completedSets / plannedSets) : 0,
    volumeKg: Math.round(ordered
      .filter(log => !log.actual.skipped)
      .reduce((sum, log) => sum + log.actual.weightKg * log.actual.repsCompleted, 0)),
    averageRpeActual: rpes.length ? round(rpes.reduce((sum, value) => sum + value, 0) / rpes.length) : null,
    invalidLogCount,
    exercises,
    weekTwoSignal: {
      readiness,
      reasonCode,
      stableExerciseIds: stableExercises,
      eligibleForWeekTwoProposal: readiness === 'proposal-ready',
      eligibleForAutomaticProgression: false,
    },
  }
}
