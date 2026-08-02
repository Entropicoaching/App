import test from 'node:test'
import assert from 'node:assert/strict'

import {
  CUSTOMER_SET_LOG_SCHEMA_VERSION,
  isValidCustomerSetLog,
  summarizeCustomerWeek,
  validateCustomerSetLog,
} from '../customerSetLogging.js'

function loggedSet(overrides = {}) {
  return {
    weekNumber: 1,
    sessionId: 'uge-1-pas-a',
    exerciseId: 'low-bar-squat',
    setNumber: 1,
    planned: { weightKg: 100, reps: 5, rpe: 7 },
    actual: { weightKg: 100, repsCompleted: 5, rpeActual: 6.5, note: '', skipped: false },
    ...overrides,
  }
}

test('set-log bevarer plan og faktisk udfoerelse i et normaliseret, rent resultat', () => {
  const result = validateCustomerSetLog(loggedSet({ actual: { weightKg: 100, repsCompleted: 5, rpeActual: 6.5, note: '  Rolig teknik. ', skipped: false } }))
  assert.equal(result.ok, true)
  assert.equal(result.value.schemaVersion, CUSTOMER_SET_LOG_SCHEMA_VERSION)
  assert.equal(result.value.planned.weightKg, 100)
  assert.equal(result.value.actual.repsCompleted, 5)
  assert.equal(result.value.actual.note, 'Rolig teknik.')
  assert.equal(isValidCustomerSetLog(loggedSet()), true)
})

test('validatoren afviser ufuldfoerte eller selvmodsigende saet deterministisk', () => {
  const missingActual = validateCustomerSetLog(loggedSet({ actual: { weightKg: 100, repsCompleted: 5, rpeActual: null, note: '', skipped: false } }))
  assert.equal(missingActual.ok, false)
  assert.deepEqual(missingActual.errors, [{ field: 'actual.rpeActual', code: 'rpe-1-to-10-required' }])

  const skippedWithLoad = validateCustomerSetLog(loggedSet({ actual: { weightKg: 100, repsCompleted: null, rpeActual: null, note: 'Syg', skipped: true } }))
  assert.equal(skippedWithLoad.ok, false)
  assert.deepEqual(skippedWithLoad.errors, [{ field: 'actual.weightKg', code: 'must-be-empty-when-skipped' }])

  assert.equal(isValidCustomerSetLog(loggedSet({ weekNumber: 0 })), false)
})

test('et sprunget saet gemmer kun den forklaring atleten skrev', () => {
  const result = validateCustomerSetLog(loggedSet({ actual: { weightKg: null, repsCompleted: null, rpeActual: null, note: '  Hoften var irriteret. ', skipped: true } }))
  assert.equal(result.ok, true)
  assert.deepEqual(result.value.actual, {
    weightKg: null,
    repsCompleted: null,
    rpeActual: null,
    note: 'Hoften var irriteret.',
    skipped: true,
  })
})

test('ugesummering gør en god uge klar til forslag, men aldrig til automatisk stigning', () => {
  const summary = summarizeCustomerWeek([
    loggedSet({ setNumber: 2, actual: { weightKg: 100, repsCompleted: 5, rpeActual: 7, note: '', skipped: false } }),
    loggedSet({ setNumber: 1, actual: { weightKg: 100, repsCompleted: 5, rpeActual: 6.5, note: '', skipped: false } }),
    loggedSet({ sessionId: 'uge-1-pas-b', exerciseId: 'bench', setNumber: 1, planned: { weightKg: 60, reps: 6, rpe: 7 }, actual: { weightKg: 60, repsCompleted: 6, rpeActual: 6, note: '', skipped: false } }),
  ], 1)

  assert.equal(summary.plannedSets, 3)
  assert.equal(summary.completedSets, 3)
  assert.equal(summary.volumeKg, 1360)
  assert.equal(summary.exercises[0].exerciseId, 'bench')
  assert.deepEqual(summary.weekTwoSignal, {
    readiness: 'proposal-ready',
    reasonCode: 'complete-acceptable-week',
    stableExerciseIds: ['bench', 'low-bar-squat'],
    eligibleForWeekTwoProposal: true,
    eligibleForAutomaticProgression: false,
  })
})

test('mangelfulde eller sprugne data kan aldrig blive til progression', () => {
  const invalid = { weekNumber: 1, sessionId: 'x' }
  const skipped = loggedSet({ actual: { weightKg: null, repsCompleted: null, rpeActual: null, note: 'Syg', skipped: true } })
  const summary = summarizeCustomerWeek([invalid, skipped], 1)
  assert.equal(summary.invalidLogCount, 1)
  assert.equal(summary.weekTwoSignal.readiness, 'review')
  assert.equal(summary.weekTwoSignal.reasonCode, 'invalid-log-present')
  assert.equal(summary.weekTwoSignal.eligibleForWeekTwoProposal, false)
  assert.equal(summary.weekTwoSignal.eligibleForAutomaticProgression, false)

  const noData = summarizeCustomerWeek([], 2)
  assert.equal(noData.weekTwoSignal.reasonCode, 'no-valid-sets-for-week')
})
