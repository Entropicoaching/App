import test from 'node:test'
import assert from 'node:assert/strict'

import { recoverMemberJourneyFromHistory } from '../memberJourneyRecovery.js'
import { createAssignmentBinding, validateMemberJourneySnapshot } from '../memberJourneyStorage.js'

const USER_ID = '12345678-1234-4123-8123-123456789abc'
const ASSIGNMENT_ID = 'assignment-a'
const PROGRAM_ID = 'database-program-a'
const matchInput = {
  schemaVersion: 4,
  goal: 'general-strength',
  level: 'begynder',
  daysPerWeek: 2,
  equipment: 'gym',
  squatStyle: 'high-bar',
  deadliftStyle: 'sumo',
  updatedAt: '2026-08-02T08:00:00.000Z',
}
const baselineLoads = {
  squat: { weightKg: 100, reps: 3, rpe: 8 },
  bench: { weightKg: 70, reps: 3, rpe: 8 },
  deadlift: { weightKg: 130, reps: 3, rpe: 8 },
}
const program = {
  id: 'general-strength-begynder-2-gym',
  name: 'Styrke 2 dage',
  sessions: [
    {
      id: 'day-a',
      label: 'Pas A',
      movements: [
        {
          roleClass: 'main',
          exerciseId: 'high-bar-squat',
          exerciseName: 'High-bar squat',
          startingLoadKg: 70,
          prescription: { sets: 2, reps: '5', targetRpe: '7' },
        },
        {
          roleClass: 'assistance',
          exerciseId: 'ab-wheel',
          exerciseName: 'Ab wheel',
          prescription: { sets: 2, reps: '8â€“10', targetRpe: '7' },
        },
      ],
    },
    {
      id: 'day-b',
      label: 'Pas B',
      movements: [
        {
          roleClass: 'main',
          exerciseId: 'bench-press',
          exerciseName: 'BÃ¦nkpres',
          startingLoadKg: 50,
          prescription: { sets: 2, reps: '5', targetRpe: '7' },
        },
        {
          roleClass: 'assistance',
          exerciseId: 'row',
          exerciseName: 'Roning',
          prescription: { sets: 1, reps: '8â€“10', targetRpe: '7' },
        },
      ],
    },
  ],
}
const binding = createAssignmentBinding({
  assignmentId: ASSIGNMENT_ID,
  programId: PROGRAM_ID,
  matchInput,
  program,
})
const context = {
  userId: USER_ID,
  assignmentId: ASSIGNMENT_ID,
  programId: PROGRAM_ID,
  matchInput,
  baselineLoads,
  binding,
  program,
}

function loggedSet(weightKg, reps, rpe = 7, loggedAt = '2026-08-02T10:30:00.000Z') {
  return { weightKg, reps, rpe, loggedAt }
}

function entriesFor(dayId) {
  if (dayId === 'day-a') {
    return [
      { exerciseId: 'high-bar-squat', sets: [loggedSet(70, 5), loggedSet(70, 5)] },
      { exerciseId: 'ab-wheel', sets: [loggedSet(0, 9), loggedSet(0, 9)] },
    ]
  }
  return [
    { exerciseId: 'bench-press', sets: [loggedSet(50, 5), loggedSet(50, 5)] },
    { exerciseId: 'row', sets: [loggedSet(30, 9)] },
  ]
}

function completed(index, dayId, overrides = {}) {
  const day = String(index).padStart(2, '0')
  return {
    clientId: `11111111-1111-4111-8111-${String(index).padStart(12, '0')}`,
    assignmentId: ASSIGNMENT_ID,
    programId: PROGRAM_ID,
    dayId,
    startedAt: `2026-07-${day}T10:00:00.000Z`,
    completedAt: `2026-07-${day}T11:00:00.000Z`,
    entries: entriesFor(dayId),
    syncStatus: 'synced',
    ...overrides,
  }
}

function rotation(count) {
  return Array.from({ length: count }, (_, index) => completed(index + 1, index % 2 === 0 ? 'day-a' : 'day-b'))
}

test('ingen aktiv historik giver ingen recovery', () => {
  assert.deepEqual(recoverMemberJourneyFromHistory({ sessions: [] }), { status: 'none' })
  const unrelated = completed(1, 'day-a', { assignmentId: 'assignment-old', programId: 'program-old' })
  assert.deepEqual(recoverMemberJourneyFromHistory({ ...context, sessions: [unrelated] }), { status: 'none' })
})

test('et delvist uge-1-forlÃ¸b genskabes i den eksisterende uge-1-state', () => {
  const result = recoverMemberJourneyFromHistory({ ...context, sessions: rotation(1) })
  assert.equal(result.status, 'recovered')
  assert.equal(result.snapshot.stage, 'week-one')
  assert.equal(result.snapshot.completedWeekOne.length, 1)
  assert.equal(result.snapshot.completedWeekTwo.length, 0)
  assert.equal(result.snapshot.weeklyReview, null)
  assert.equal(result.snapshot.ongoing, null)
  assert.equal(result.snapshot.completedWeekOne[0].setLogs.length, 4)
  assert.deepEqual(result.snapshot.completedWeekOne[0].setLogs.map(row => row.actual.skipped), [false, false, false, false])
  assert.equal(result.snapshot.completedWeekOne[0].setLogs.find(row => row.exerciseId === 'ab-wheel').actual.weightKg, 0)
  assert.equal(validateMemberJourneySnapshot(result.snapshot).ok, true)
})

test('en afsluttet uge 1 fortsÃ¦tter konservativt i uge 2 uden opdigtet review', () => {
  const result = recoverMemberJourneyFromHistory({ ...context, sessions: rotation(2) })
  assert.equal(result.status, 'recovered')
  assert.equal(result.snapshot.stage, 'ongoing-ready')
  assert.equal(result.snapshot.ongoing.weekNumber, 2)
  assert.equal(result.snapshot.ongoing.previousCompleted.length, 2)
  assert.equal(result.snapshot.ongoing.completed.length, 0)
  assert.equal(result.snapshot.ongoing.currentChoice, 'kept')
  assert.equal(result.snapshot.ongoing.currentProposalId, null)
  assert.equal(result.snapshot.ongoing.review, null)
  assert.deepEqual(result.snapshot.ongoing.reviews, [])
  assert.equal(result.snapshot.ongoing.recoveredFromHistory, true)
  assert.equal(validateMemberJourneySnapshot(result.snapshot).ok, true)
})

test('en delvis uge 2 og en senere uge fÃ¥r prÃ¦cis forrige og nuvÃ¦rende uge', () => {
  const partialWeekTwo = recoverMemberJourneyFromHistory({ ...context, sessions: rotation(3) })
  assert.equal(partialWeekTwo.status, 'recovered')
  assert.equal(partialWeekTwo.snapshot.ongoing.weekNumber, 2)
  assert.deepEqual(partialWeekTwo.snapshot.ongoing.previousCompleted.map(item => item.clientId), rotation(2).map(item => item.clientId))
  assert.deepEqual(partialWeekTwo.snapshot.ongoing.completed.map(item => item.clientId), [rotation(3)[2].clientId])
  assert.equal(partialWeekTwo.snapshot.completedWeekTwo.length, 1)

  const partialWeekThree = recoverMemberJourneyFromHistory({ ...context, sessions: rotation(5) })
  assert.equal(partialWeekThree.status, 'recovered')
  assert.equal(partialWeekThree.snapshot.ongoing.weekNumber, 3)
  assert.deepEqual(partialWeekThree.snapshot.ongoing.previousCompleted.map(item => item.clientId), rotation(5).slice(2, 4).map(item => item.clientId))
  assert.deepEqual(partialWeekThree.snapshot.ongoing.completed.map(item => item.clientId), [rotation(5)[4].clientId])
  assert.equal(partialWeekThree.snapshot.completedWeekOne.length, 2)
  assert.equal(partialWeekThree.snapshot.completedWeekTwo.length, 2)
  assert.deepEqual(partialWeekThree.snapshot.ongoing.reviews, [])
  assert.equal(validateMemberJourneySnapshot(partialWeekThree.snapshot).ok, true)
})

test('Ã¸velsesrÃ¦kkefÃ¸lgen i remote-grupper er ligegyldig, nÃ¥r strukturen ellers er entydig', () => {
  const remote = completed(1, 'day-a')
  remote.entries = [...remote.entries].reverse()
  const result = recoverMemberJourneyFromHistory({ ...context, sessions: [remote] })
  assert.equal(result.status, 'recovered')
  assert.deepEqual(result.snapshot.completedWeekOne[0].setLogs.map(row => row.exerciseId), [
    'high-bar-squat',
    'high-bar-squat',
    'ab-wheel',
    'ab-wheel',
  ])
})

test('forkert rotation og duplikerede workout-id\'er fejler lukket', () => {
  const outOfOrder = recoverMemberJourneyFromHistory({ ...context, sessions: [completed(1, 'day-b')] })
  assert.equal(outOfOrder.status, 'blocked')
  assert.equal(outOfOrder.reason, 'unsafe-session-rotation:out-of-order-program-day')

  const duplicate = completed(2, 'day-b', { clientId: completed(1, 'day-a').clientId })
  const duplicateResult = recoverMemberJourneyFromHistory({ ...context, sessions: [completed(1, 'day-a'), duplicate] })
  assert.equal(duplicateResult.status, 'blocked')
  assert.equal(duplicateResult.reason, 'unsafe-session-rotation:duplicate-completed-session')
})

test('ugyldigt client-id, tidsstempel eller program-id kan ikke blive til en lokal uge', () => {
  const badClient = recoverMemberJourneyFromHistory({
    ...context,
    sessions: [completed(1, 'day-a', { clientId: 'ikke-et-uuid' })],
  })
  assert.deepEqual(badClient, { status: 'blocked', reason: 'unsafe-session-shape:1' })

  const unfinished = recoverMemberJourneyFromHistory({
    ...context,
    sessions: [completed(1, 'day-a', { completedAt: null })],
  })
  assert.deepEqual(unfinished, { status: 'blocked', reason: 'active-history-is-incomplete-or-invalid' })

  const wrongProgram = recoverMemberJourneyFromHistory({
    ...context,
    sessions: [completed(1, 'day-a', { programId: 'forkert-program' })],
  })
  assert.deepEqual(wrongProgram, { status: 'blocked', reason: 'active-assignment-program-mismatch' })
})

test('manglende remote-sæt bliver konservativt skipped, mens ekstra eller ugyldige data blokeres', () => {
  const missingSet = completed(1, 'day-a')
  missingSet.entries[0].sets.pop()
  const recoveredMissingSet = recoverMemberJourneyFromHistory({ ...context, sessions: [missingSet] })
  assert.equal(recoveredMissingSet.status, 'recovered')
  const recoveredSquatSets = recoveredMissingSet.snapshot.completedWeekOne[0].setLogs.filter(row => row.exerciseId === 'high-bar-squat')
  assert.equal(recoveredSquatSets[0].actual.skipped, false)
  assert.equal(recoveredSquatSets[1].actual.skipped, true)
  assert.match(recoveredSquatSets[1].actual.note, /serverhistorikken/)

  const allSkipped = completed(1, 'day-a', {
    entries: [],
    localOnly: true,
    syncStatus: 'local-only',
    skippedSetCount: 4,
  })
  const recoveredLocalOnly = recoverMemberJourneyFromHistory({ ...context, sessions: [allSkipped] })
  assert.equal(recoveredLocalOnly.status, 'recovered')
  assert.equal(recoveredLocalOnly.snapshot.completedWeekOne[0].setLogs.every(row => row.actual.skipped), true)
  const extraExercise = completed(1, 'day-a')
  extraExercise.entries.push({ exerciseId: 'ukendt', sets: [loggedSet(10, 10)] })
  const invalidLoad = completed(1, 'day-a')
  invalidLoad.entries[0].sets[0] = loggedSet(501, 5)
  const invalidRpe = completed(1, 'day-a')
  invalidRpe.entries[0].sets[0] = loggedSet(70, 5, 4)
  const duplicateExercise = completed(1, 'day-a')
  duplicateExercise.entries[1] = { ...duplicateExercise.entries[0] }

  for (const remote of [extraExercise, invalidLoad, invalidRpe, duplicateExercise]) {
    assert.deepEqual(
      recoverMemberJourneyFromHistory({ ...context, sessions: [remote] }),
      { status: 'blocked', reason: 'unsafe-session-shape:1' },
    )
  }
})

test('binding og resolved context skal beskrive samme immutable assignment', () => {
  const result = recoverMemberJourneyFromHistory({
    ...context,
    binding: { ...binding, assignmentId: 'assignment-b' },
    sessions: rotation(1),
  })
  assert.deepEqual(result, { status: 'blocked', reason: 'assigned-context-invalid' })
})
