import test from 'node:test'
import assert from 'node:assert/strict'

import {
  comparableExposureFromSession,
  comparableExposures,
  progressionEvidenceForMovement,
} from '../progressionEvidence.js'

const movement = {
  exerciseId: 'low-bar-squat',
  prescription: { sets: 2, reps: '5 reps', targetRpe: '6–7' },
}

function loggedSet(setNumber, overrides = {}) {
  return {
    weekNumber: 1,
    sessionId: 'uge-1-pas-a',
    exerciseId: movement.exerciseId,
    setNumber,
    planned: { weightKg: 100, reps: 5, rpe: 7 },
    actual: { weightKg: 100, repsCompleted: 5, rpeActual: 6.5, note: '', skipped: false },
    ...overrides,
  }
}

function session(overrides = {}) {
  return {
    setLogs: [loggedSet(1), loggedSet(2)],
    ...overrides,
  }
}

function comparableSession(weekNumber, sessionId) {
  return session({
    setLogs: [
      loggedSet(1, { weekNumber, sessionId }),
      loggedSet(2, { weekNumber, sessionId }),
    ],
  })
}

test('en komplet, sammenlignelig eksponering bevarer den faktiske referencebelastning', () => {
  const result = comparableExposureFromSession(session({
    setLogs: [
      loggedSet(1, { actual: { weightKg: 100, repsCompleted: 5, rpeActual: 6, note: '', skipped: false } }),
      loggedSet(2, { actual: { weightKg: 102.5, repsCompleted: 5, rpeActual: 7, note: '', skipped: false } }),
    ],
  }), movement)

  assert.deepEqual(result, {
    ok: true,
    key: '1:uge-1-pas-a:low-bar-squat',
    weekNumber: 1,
    sessionId: 'uge-1-pas-a',
    referenceLoadKg: 101.25,
    completedSets: 2,
    repTarget: 5,
    maxRpe: 7,
  })
})

test('faktiske reps under maalet fejler lukket', () => {
  const result = comparableExposureFromSession(session({
    setLogs: [loggedSet(1), loggedSet(2, { actual: { weightKg: 100, repsCompleted: 4, rpeActual: 7, note: '', skipped: false } })],
  }), movement)
  assert.deepEqual(result, { ok: false, reason: 'rep-target-not-met' })
})

test('RPE over loftet fejler lukket', () => {
  const result = comparableExposureFromSession(session({
    setLogs: [loggedSet(1), loggedSet(2, { actual: { weightKg: 100, repsCompleted: 5, rpeActual: 7.5, note: '', skipped: false } })],
  }), movement)
  assert.deepEqual(result, { ok: false, reason: 'rpe-above-target' })
})

test('et sprunget saet kan aldrig udgoere en sammenlignelig eksponering', () => {
  const result = comparableExposureFromSession(session({
    setLogs: [loggedSet(1), loggedSet(2, { actual: { weightKg: null, repsCompleted: null, rpeActual: null, note: 'Syg', skipped: true } })],
  }), movement)
  assert.deepEqual(result, { ok: false, reason: 'skipped-set-present' })
})

test('manglende saet kan aldrig udgoere en sammenlignelig eksponering', () => {
  const result = comparableExposureFromSession(session({ setLogs: [loggedSet(1)] }), movement)
  assert.deepEqual(result, { ok: false, reason: 'incomplete-exposure' })
})

test('mere end ti procents belastningsafvigelse fejler lukket, mens ti procent er gyldig', () => {
  const atLimit = comparableExposureFromSession(session({
    setLogs: [
      loggedSet(1, { actual: { weightKg: 110, repsCompleted: 5, rpeActual: 7, note: '', skipped: false } }),
      loggedSet(2, { actual: { weightKg: 110, repsCompleted: 5, rpeActual: 7, note: '', skipped: false } }),
    ],
  }), movement)
  assert.equal(atLimit.ok, true)

  const aboveLimit = comparableExposureFromSession(session({
    setLogs: [
      loggedSet(1, { actual: { weightKg: 110.1, repsCompleted: 5, rpeActual: 7, note: '', skipped: false } }),
      loggedSet(2, { actual: { weightKg: 110.1, repsCompleted: 5, rpeActual: 7, note: '', skipped: false } }),
    ],
  }), movement)
  assert.deepEqual(aboveLimit, { ok: false, reason: 'load-deviates-from-plan' })
})

test('duplikeret session-identitet giver kun ét evidenspunkt', () => {
  const duplicate = comparableSession(1, 'uge-1-pas-a')
  const exposures = comparableExposures([duplicate, duplicate], movement)
  assert.equal(exposures.length, 1)
  const evidence = progressionEvidenceForMovement([duplicate, duplicate], movement)
  assert.equal(evidence.status, 'comparable-exposure')
  assert.equal(evidence.requiredExposures, 1)
})

test('én komplet session er tilstrækkelig evidens, mens summary/legacy logs fejler lukket', () => {
  const first = comparableSession(1, 'uge-1-pas-a')
  const second = comparableSession(2, 'uge-2-pas-a')
  const evidence = progressionEvidenceForMovement([second, first], movement)
  assert.equal(evidence.status, 'comparable-exposure')
  assert.deepEqual(evidence.exposures.map(exposure => exposure.key), [
    '1:uge-1-pas-a:low-bar-squat',
    '2:uge-2-pas-a:low-bar-squat',
  ])

  const legacySummary = { weekNumber: 1, exercises: [{ exerciseId: movement.exerciseId, stableExposure: true }] }
  assert.deepEqual(comparableExposureFromSession(legacySummary, movement), {
    ok: false,
    reason: 'validated-set-logs-required',
  })
  assert.equal(progressionEvidenceForMovement([legacySummary], movement).status, 'insufficient-comparable-exposures')
  assert.equal(progressionEvidenceForMovement([legacySummary, first], movement).status, 'comparable-exposure')
})

test('afvist eksponering bevarer en forklarlig årsag til uge-reviewet', () => {
  const tooHard = session({
    setLogs: [
      loggedSet(1, { actual: { weightKg: 100, repsCompleted: 5, rpeActual: 8, note: '', skipped: false } }),
      loggedSet(2, { actual: { weightKg: 100, repsCompleted: 5, rpeActual: 8, note: '', skipped: false } }),
    ],
  })
  const evidence = progressionEvidenceForMovement([tooHard], movement)
  assert.equal(evidence.status, 'insufficient-comparable-exposures')
  assert.deepEqual(evidence.rejectedExposures, [{ weekNumber: 1, sessionId: 'uge-1-pas-a', reason: 'rpe-above-target' }])
})

test('meget forskellige belastninger reduceres til den seneste sammenlignelige eksponering', () => {
  const atLoad = (weekNumber, sessionId, load) => session({
    setLogs: [1, 2].map(setNumber => loggedSet(setNumber, {
      weekNumber,
      sessionId,
      planned: { weightKg: load, reps: 5, rpe: 7 },
      actual: { weightKg: load, repsCompleted: 5, rpeActual: 7, note: '', skipped: false },
    })),
  })
  const evidence = progressionEvidenceForMovement([
    atLoad(1, 'uge-1-pas-a', 100),
    atLoad(2, 'uge-2-pas-a', 200),
  ], movement)
  assert.equal(evidence.status, 'comparable-exposure')
  assert.equal(evidence.exposures.length, 1)
  assert.equal(evidence.latest.referenceLoadKg, 200)
})
