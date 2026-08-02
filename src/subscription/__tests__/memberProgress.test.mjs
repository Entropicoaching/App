import test from 'node:test'
import assert from 'node:assert/strict'

import {
  activeCompletedSessions,
  buildMemberProgress,
  compactMemberSessionSummaries,
  latestLoggedLoadMap,
  mainMovementTrendFacts,
  strictMemberRotationPosition,
} from '../memberProgress.js'

const assignment = { id: 'assignment-a', program_id: 'database-program-a' }
const otherAssignment = { id: 'assignment-b', program_id: 'database-program-b' }
const program = {
  // The resolved client programme deliberately has a different identity from
  // the immutable database programme id on the assignment.
  id: 'general-strength-begynder-3-gym',
  sessions: [
    {
      id: 'day-a',
      label: 'Pas A',
      movements: [
        { exerciseId: 'high-bar-squat', exerciseName: 'High-bar squat', roleClass: 'main', prescription: { sets: 2, reps: '5', targetRpe: '7' } },
        { exerciseId: 'ab-wheel', exerciseName: 'Ab wheel', roleClass: 'assistance', prescription: { sets: 2, reps: '8', targetRpe: '7' } },
      ],
    },
    {
      id: 'day-b',
      label: 'Pas B',
      movements: [
        { exerciseId: 'bench-press', exerciseName: 'Bænkpres', roleClass: 'main', prescription: { sets: 2, reps: '5', targetRpe: '7' } },
      ],
    },
    {
      id: 'day-c',
      label: 'Pas C',
      movements: [
        { exerciseId: 'high-bar-squat', exerciseName: 'High-bar squat', roleClass: 'main', prescription: { sets: 2, reps: '5', targetRpe: '7' } },
      ],
    },
  ],
}

function set(weightKg, reps = 5, rpe = 7) {
  return { weightKg, reps, rpe, loggedAt: '2026-08-02T10:30:00.000Z' }
}

function session({
  clientId,
  dayId,
  startedAt,
  completedAt,
  entries = [],
  assignmentId = assignment.id,
  programId = assignment.program_id,
  syncStatus = 'synced',
}) {
  return { clientId, assignmentId, programId, dayId, startedAt, completedAt, entries, syncStatus }
}

function completed(index, dayId, entries = []) {
  const hour = String(8 + index).padStart(2, '0')
  return session({
    clientId: `11111111-1111-4111-8111-${String(index).padStart(12, '0')}`,
    dayId,
    startedAt: `2026-08-02T${hour}:00:00.000Z`,
    completedAt: `2026-08-02T${hour}:45:00.000Z`,
    entries,
  })
}

test('completed sessions filtreres til aktiv assignment/program og sorteres kronologisk', () => {
  const later = completed(2, 'day-b')
  const earlier = completed(1, 'day-a')
  const wrongAssignment = session({ ...completed(3, 'day-c'), assignmentId: otherAssignment.id })
  const wrongProgram = session({ ...completed(4, 'day-a'), programId: otherAssignment.program_id })
  const unfinished = session({ ...completed(5, 'day-b'), completedAt: null })

  const result = activeCompletedSessions({ sessions: [later, wrongProgram, unfinished, earlier, wrongAssignment], assignment, program })
  assert.deepEqual(result.map(item => item.clientId), [earlier.clientId, later.clientId])
  assert.deepEqual(activeCompletedSessions({ sessions: [earlier], assignment: null, program }), [])
})

test('strict rotation finder vilkårlig ugeposition efter den faste pasrækkefølge', () => {
  const sessions = ['day-a', 'day-b', 'day-c', 'day-a', 'day-b'].map((dayId, index) => completed(index + 1, dayId))
  assert.deepEqual(strictMemberRotationPosition({ sessions, assignment, program }), {
    ok: true,
    reason: null,
    completedWeeks: 1,
    currentWeekNumber: 2,
    completedInCurrentWeek: 2,
    nextSessionIndex: 2,
    nextSessionId: 'day-c',
    completedSessionCount: 5,
    sessionsPerWeek: 3,
  })

  const afterTwoWeeks = strictMemberRotationPosition({ sessions: [...sessions, completed(6, 'day-c')], assignment, program })
  assert.equal(afterTwoWeeks.completedWeeks, 2)
  assert.equal(afterTwoWeeks.currentWeekNumber, 3)
  assert.equal(afterTwoWeeks.completedInCurrentWeek, 0)
  assert.equal(afterTwoWeeks.nextSessionId, 'day-a')
})

test('rotation fejler lukket på ukendt eller forkert pas i stedet for at gætte', () => {
  const unknown = strictMemberRotationPosition({ sessions: [completed(1, 'day-x')], assignment, program })
  assert.equal(unknown.ok, false)
  assert.equal(unknown.reason, 'unknown-program-day')
  assert.equal(unknown.currentWeekNumber, null)

  const outOfOrder = strictMemberRotationPosition({ sessions: [completed(1, 'day-a'), completed(2, 'day-c')], assignment, program })
  assert.equal(outOfOrder.ok, false)
  assert.equal(outOfOrder.reason, 'out-of-order-program-day')
  assert.equal(outOfOrder.expectedSessionId, 'day-b')
  assert.equal(outOfOrder.actualSessionId, 'day-c')

  const duplicateProgram = { sessions: [{ id: 'same', movements: [] }, { id: 'same', movements: [] }] }
  assert.equal(strictMemberRotationPosition({ sessions: [], assignment, program: duplicateProgram }).reason, 'program-session-ids-must-be-unique')
})

test('kompakte sessioner viser nyeste først med label, valideret sætantal og synkstatus', () => {
  const sessions = [
    completed(1, 'day-a', [{ exerciseId: 'high-bar-squat', sets: [set(80), { weightKg: null, reps: 5, rpe: 7 }] }]),
    session({ ...completed(2, 'day-b', [{ exerciseId: 'bench-press', sets: [set(60), set(60)] }]), syncStatus: 'failed' }),
  ]
  const summaries = compactMemberSessionSummaries({ sessions, assignment, program })
  assert.equal(summaries[0].sessionLabel, 'Pas B')
  assert.equal(summaries[0].setCount, 2)
  assert.equal(summaries[0].invalidSetCount, 0)
  assert.equal(summaries[0].syncStatus, 'failed')
  assert.equal(summaries[1].sessionLabel, 'Pas A')
  assert.equal(summaries[1].setCount, 1)
  assert.equal(summaries[1].invalidSetCount, 1)
  assert.equal(summaries[1].date, '2026-08-02T09:45:00.000Z')
})

test('main-movement facts sammenligner kun vægt når reps og RPE matcher', () => {
  const sessions = [
    completed(1, 'day-a', [
      { exerciseId: 'high-bar-squat', sets: [set(77.5), set(80)] },
      { exerciseId: 'ab-wheel', sets: [set(0, 8, 7)] },
    ]),
    completed(2, 'day-b', [{ exerciseId: 'bench-press', sets: [set(60, 5, 7)] }]),
    completed(3, 'day-c', [{ exerciseId: 'high-bar-squat', sets: [set(80), set(82.5)] }]),
    completed(4, 'day-a', [{ exerciseId: 'high-bar-squat', sets: [set(85, 6, 8)] }]),
    completed(5, 'day-b', [{ exerciseId: 'bench-press', sets: [set(62.5, 5, 7)] }]),
  ]
  const facts = mainMovementTrendFacts({ sessions, assignment, program })
  assert.equal(facts.some(item => item.exerciseId === 'ab-wheel'), false)

  const squat = facts.find(item => item.exerciseId === 'high-bar-squat')
  assert.equal(squat.latest.lastSet.weightKg, 85)
  assert.equal(squat.previous.lastSet.weightKg, 82.5)
  assert.deepEqual(squat.comparison, { basis: 'different-reps', comparable: false, loadDeltaKg: null })

  const bench = facts.find(item => item.exerciseId === 'bench-press')
  assert.deepEqual(bench.comparison, { basis: 'same-reps-and-rpe', comparable: true, loadDeltaKg: 2.5 })
  assert.doesNotMatch(JSON.stringify(facts), /\bPR\b|rekord|garanteret/i)
})

test('latest load map ignorerer ukendte/ufuldstændige sæt og viser kropsvægt ærligt', () => {
  const sessions = [
    completed(1, 'day-a', [
      { exerciseId: 'high-bar-squat', sets: [set(80)] },
      { exerciseId: 'ab-wheel', sets: [set(0, 8, 7)] },
      { exerciseId: 'unknown-exercise', sets: [set(999)] },
    ]),
    completed(2, 'day-b', [{ exerciseId: 'bench-press', sets: [{ weightKg: 62.5, reps: null, rpe: 7 }] }]),
    completed(3, 'day-c', [{ exerciseId: 'high-bar-squat', sets: [set(82.5)] }]),
    completed(4, 'day-a', [{ exerciseId: 'ab-wheel', sets: [set(5, 8, 7)] }]),
  ]
  const latest = latestLoggedLoadMap({ sessions, assignment, program })
  assert.equal(latest.get('high-bar-squat').weightKg, 82.5)
  assert.equal(latest.get('high-bar-squat').displayLoad, '82,5 kg')
  assert.equal(latest.get('ab-wheel').loadKind, 'bodyweight-plus-external')
  assert.equal(latest.get('ab-wheel').displayLoad, 'Kropsvægt + 5 kg')
  assert.equal(latest.has('bench-press'), false)
  assert.equal(latest.has('unknown-exercise'), false)

  const bodyweightOnly = latestLoggedLoadMap({ sessions: sessions.slice(0, 1), assignment, program })
  assert.equal(bodyweightOnly.get('ab-wheel').loadKind, 'bodyweight')
  assert.equal(bodyweightOnly.get('ab-wheel').displayLoad, 'Kropsvægt')
})

test('samlet progresspakke returnerer de samme rene delkontrakter', () => {
  const sessions = [completed(1, 'day-a', [{ exerciseId: 'high-bar-squat', sets: [set(80)] }])]
  const result = buildMemberProgress({ sessions, assignment, program })
  assert.equal(result.completedSessions.length, 1)
  assert.equal(result.rotation.nextSessionId, 'day-b')
  assert.equal(result.sessionSummaries[0].setCount, 1)
  assert.equal(result.mainMovementTrends.find(item => item.exerciseId === 'high-bar-squat').latest.lastSet.weightKg, 80)
  assert.equal(result.latestLoads.get('high-bar-squat').weightKg, 80)
})
