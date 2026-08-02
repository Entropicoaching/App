import test from 'node:test'
import assert from 'node:assert/strict'

import { formatTimedPrescription, isMemberBodyweightMovement, parseTimedPrescription } from '../memberExerciseLogging.js'
import {
  advanceOngoingCycle,
  createAssignedSnapshot,
  createAssignmentBinding,
  createMemberSetRows,
  createMemberSessionDraft,
  createOngoingCycle,
  createSetupBinding,
  createSetupSnapshot,
  loadMemberJourneySnapshot,
  memberMatchFingerprint,
  memberSessionDraftMatches,
  memberSessionEntryFromDraft,
  memberSessionEntryMatches,
  prefillNextAssistanceSetLoad,
  saveMemberJourneySnapshot,
  validateMemberJourneySnapshot,
} from '../memberJourneyStorage.js'

class MemoryStorage {
  constructor() { this.values = new Map() }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null }
  setItem(key, value) { this.values.set(key, String(value)) }
  removeItem(key) { this.values.delete(key) }
}

const USER_ID = '12345678-1234-4123-8123-123456789abc'
const REQUEST_ID = '11111111-1111-4111-a111-111111111111'
const matchInput = {
  schemaVersion: 4,
  goal: 'general-strength',
  level: 'begynder',
  daysPerWeek: 2,
  equipment: 'gym',
  squatStyle: 'high-bar',
  deadliftStyle: 'sumo',
  updatedAt: '2026-08-02T10:00:00.000Z',
}
const baselineLoads = {
  squat: { weightKg: 100, reps: 3, rpe: 8 },
  bench: { weightKg: 70, reps: 3, rpe: 8 },
  deadlift: { weightKg: 130, reps: 3, rpe: 8 },
}
const session = {
  id: 'a',
  label: 'Pas A',
  movements: [{
    role: 'squat-pattern',
    roleClass: 'main',
    exerciseId: 'high-bar-squat',
    exerciseName: 'High-bar squat',
    startingLoadKg: 70,
    prescription: { sets: 2, reps: '5', targetRpe: '6–7', loadIncrementKg: 2.5 },
  }],
}
const program = { id: 'review-test', name: 'Testprogram', sessions: [session] }

function clientIdFor(value) {
  return `00000000-0000-4000-a000-${String(value).padStart(12, '0')}`
}

function completedSession(weekNumber, { assignmentId = 'assignment-a', sessionValue = session, clientId = clientIdFor(weekNumber) } = {}) {
  const draft = createMemberSessionDraft({ assignmentId, session: sessionValue, weekNumber, clientId, now: Date.parse('2026-08-02T10:00:00.000Z') })
  return memberSessionEntryFromDraft({ ...draft, confirmed: Object.fromEntries(draft.rows.map((_, index) => [index, true])) }, sessionValue, Date.parse('2026-08-02T11:00:00.000Z'))
}

function completedReview(weekNumber, overrides = {}) {
  return {
    weekNumber,
    rating: 'appropriate',
    note: `Uge ${weekNumber} passede fint.`,
    completedAt: '2026-08-02T12:00:00.000Z',
    ...overrides,
  }
}

test('setup-state er user-scoped, refresh-sikker og bundet til serverens startinput', () => {
  const storage = new MemoryStorage()
  const snapshot = createSetupSnapshot(USER_ID, matchInput, REQUEST_ID)
  assert.equal(validateMemberJourneySnapshot(snapshot).ok, true)
  assert.equal(saveMemberJourneySnapshot(snapshot, storage), true)
  assert.deepEqual(loadMemberJourneySnapshot({ userId: USER_ID, expectedBinding: createSetupBinding(matchInput), storage }), snapshot)
  assert.equal(loadMemberJourneySnapshot({ userId: 'anden-bruger', expectedBinding: createSetupBinding(matchInput), storage }), null)
})

test('match-binding ignorerer kosmetisk updatedAt men ændres ved et reelt atletvalg', () => {
  assert.equal(memberMatchFingerprint(matchInput), memberMatchFingerprint({ ...matchInput, updatedAt: '2026-08-03T10:00:00.000Z' }))
  assert.notEqual(memberMatchFingerprint(matchInput), memberMatchFingerprint({ ...matchInput, deadliftStyle: 'conventional' }))
})

test('assignment-skift eller ændret program åbner aldrig en gammel lokal uge', () => {
  const storage = new MemoryStorage()
  const binding = createAssignmentBinding({ assignmentId: 'assignment-a', programId: 'program-a', matchInput, program })
  const snapshot = createAssignedSnapshot({ userId: USER_ID, binding, matchInput, baselineLoads })
  assert.equal(saveMemberJourneySnapshot(snapshot, storage), true)
  const changedProgram = { ...program, sessions: [{ ...session, movements: [{ ...session.movements[0], startingLoadKg: 72.5 }] }] }
  const changedBinding = createAssignmentBinding({ assignmentId: 'assignment-b', programId: 'program-b', matchInput, program: changedProgram })
  const immutableProgramChanged = createAssignmentBinding({ assignmentId: 'assignment-a', programId: 'program-b', matchInput, program })
  assert.notDeepEqual(immutableProgramChanged, binding)
  assert.equal(loadMemberJourneySnapshot({ userId: USER_ID, expectedBinding: changedBinding, storage }), null)
  assert.equal(storage.values.size, 0)
})

test('et pas kan først blive en persistérbar entry når alle planlagte sæt er afklaret', () => {
  const draft = createMemberSessionDraft({ assignmentId: 'assignment-a', session, weekNumber: 1, clientId: REQUEST_ID, now: Date.parse('2026-08-02T10:00:00.000Z') })
  assert.equal(memberSessionDraftMatches(draft, { assignmentId: 'assignment-a', session, weekNumber: 1 }), true)
  assert.equal(memberSessionEntryFromDraft(draft, session), null)
  const complete = { ...draft, confirmed: { 0: true, 1: true } }
  const entry = memberSessionEntryFromDraft(complete, session, Date.parse('2026-08-02T11:00:00.000Z'))
  assert.equal(entry.setLogs.length, 2)
  assert.equal(memberSessionEntryMatches(entry, { assignmentId: 'assignment-a', session, weekNumber: 1 }), true)
})

test('spring over er eksplicit, og en ændret plan fejler lukket ved refresh', () => {
  const draft = createMemberSessionDraft({ assignmentId: 'assignment-a', session, weekNumber: 1, clientId: REQUEST_ID })
  const skipped = {
    ...draft,
    rows: draft.rows.map((row, index) => index === 0 ? { ...row, actual: { weightKg: null, repsCompleted: null, rpeActual: null, note: 'Rack optaget', skipped: true } } : row),
    confirmed: { 0: true, 1: true },
  }
  const entry = memberSessionEntryFromDraft(skipped, session)
  assert.equal(entry.setLogs[0].actual.skipped, true)
  assert.equal(entry.setLogs[0].actual.note, 'Rack optaget')
  const tampered = { ...entry, setLogs: entry.setLogs.map((row, index) => index === 0 ? { ...row, planned: { ...row.planned, weightKg: 200 } } : row) }
  assert.equal(memberSessionEntryMatches(tampered, { assignmentId: 'assignment-a', session, weekNumber: 1 }), false)
})

test('assistance uden startload står blank og kræver atletens eksplicitte vægtvalg', () => {
  const assistanceSession = {
    id: 'assistance',
    label: 'Assistance',
    movements: [{
      role: 'pull',
      roleClass: 'assistance',
      exerciseId: 'row',
      exerciseName: 'Roning',
      prescription: { sets: 1, reps: '8–10', targetRpe: '7', loadIncrementKg: 2.5 },
    }],
  }
  const draft = createMemberSessionDraft({ assignmentId: 'assignment-a', session: assistanceSession, weekNumber: 1, clientId: REQUEST_ID })
  assert.equal(draft.rows[0].planned.weightKg, null)
  assert.equal(draft.rows[0].planned.loadSource, 'athlete-entry-required')
  assert.equal(draft.rows[0].actual.weightKg, null)
  assert.equal(memberSessionDraftMatches(draft, { assignmentId: 'assignment-a', session: assistanceSession, weekNumber: 1 }), true)
  assert.equal(memberSessionEntryFromDraft({ ...draft, confirmed: { 0: true } }, assistanceSession), null)

  const explicitBodyweight = {
    ...draft,
    rows: [{ ...draft.rows[0], actual: { ...draft.rows[0].actual, weightKg: 0 } }],
    confirmed: { 0: true },
  }
  const entry = memberSessionEntryFromDraft(explicitBodyweight, assistanceSession)
  assert.equal(entry.setLogs[0].planned.weightKg, null)
  assert.equal(entry.setLogs[0].actual.weightKg, 0)
})

test('bekræftet assistance-load foreslås kun til næste blanke sæt i samme øvelse', () => {
  const assistanceSession = {
    id: 'assistance-prefill',
    label: 'Assistance',
    movements: [{
      role: 'pull',
      roleClass: 'assistance',
      exerciseId: 'row',
      exerciseName: 'Roning',
      prescription: { sets: 3, reps: '8–10', targetRpe: '7', loadIncrementKg: 2.5 },
    }],
  }
  const base = createMemberSessionDraft({ assignmentId: 'assignment-a', session: assistanceSession, weekNumber: 1, clientId: REQUEST_ID })
  const confirmedFirst = {
    ...base,
    rows: base.rows.map((row, index) => index === 0 ? { ...row, actual: { ...row.actual, weightKg: 32.5 } } : row),
    confirmed: { 0: true },
  }
  const proposed = prefillNextAssistanceSetLoad(confirmedFirst, 0)
  assert.equal(proposed.rows[1].actual.weightKg, 32.5)
  assert.equal(proposed.rows[2].actual.weightKg, null)

  const explicitSecond = {
    ...confirmedFirst,
    rows: confirmedFirst.rows.map((row, index) => index === 1 ? { ...row, actual: { ...row.actual, weightKg: 30 } } : row),
  }
  const preserved = prefillNextAssistanceSetLoad(explicitSecond, 0)
  assert.equal(preserved.rows[1].actual.weightKg, 30)

  const ongoingSession = {
    ...assistanceSession,
    movements: assistanceSession.movements.map(movement => ({ ...movement, weekStartingLoadKg: 20 })),
  }
  const ongoing = createMemberSessionDraft({ assignmentId: 'assignment-a', session: ongoingSession, weekNumber: 3, clientId: REQUEST_ID })
  const changedFirst = {
    ...ongoing,
    rows: ongoing.rows.map((row, index) => index === 0
      ? { ...row, actual: { ...row.actual, weightKg: 22.5, weightTouched: true } }
      : row),
    confirmed: { 0: true },
  }
  const carriedInOngoingWeek = prefillNextAssistanceSetLoad(changedFirst, 0)
  assert.equal(carriedInOngoingWeek.rows[1].planned.weightKg, 20)
  assert.equal(carriedInOngoingWeek.rows[1].actual.weightKg, 22.5)

  const manuallyChangedSecond = {
    ...changedFirst,
    rows: changedFirst.rows.map((row, index) => index === 1
      ? { ...row, actual: { ...row.actual, weightKg: 17.5, weightTouched: true } }
      : row),
  }
  const manualValuePreserved = prefillNextAssistanceSetLoad(manuallyChangedSecond, 0)
  assert.equal(manualValuePreserved.rows[1].actual.weightKg, 17.5)
})

test('canonical kropsvægtøvelser starter menneskeligt på gyldige 0 kg', () => {
  const bodyweightSession = {
    id: 'core',
    label: 'Core',
    movements: [{
      role: 'core',
      roleClass: 'assistance',
      exerciseId: 'ab-wheel',
      exerciseName: 'Ab wheel',
      prescription: { sets: 2, reps: '8–15', targetRpe: '6–7', loadIncrementKg: 2.5 },
    }],
  }
  assert.equal(isMemberBodyweightMovement(bodyweightSession.movements[0]), true)
  const draft = createMemberSessionDraft({ assignmentId: 'assignment-a', session: bodyweightSession, weekNumber: 1, clientId: REQUEST_ID })
  assert.deepEqual(draft.rows.map(row => row.actual.weightKg), [0, 0])
  assert.deepEqual(draft.rows.map(row => row.planned.weightKg), [null, null])
  const entry = memberSessionEntryFromDraft({ ...draft, confirmed: { 0: true, 1: true } }, bodyweightSession)
  assert.deepEqual(entry.setLogs.map(row => row.actual.weightKg), [0, 0])
})

test('kun eksplicitte tidsenheder bliver til timer, og tidsdata bliver aldrig reps', () => {
  assert.equal(parseTimedPrescription({ reps: '8–15' }), null)
  assert.equal(parseTimedPrescription({ reps: 30 }), null)
  assert.deepEqual(parseTimedPrescription({ reps: '30 sekunder' }), {
    minSeconds: 30,
    maxSeconds: 30,
    countdownSeconds: 30,
    source: 'explicit-time-unit',
  })
  assert.deepEqual(parseTimedPrescription({ reps: '1–2 min' }), {
    minSeconds: 60,
    maxSeconds: 120,
    countdownSeconds: 60,
    source: 'explicit-time-unit',
  })
  assert.equal(parseTimedPrescription({ reps: 2, unit: 'min' }).countdownSeconds, 120)
  assert.equal(formatTimedPrescription(parseTimedPrescription({ durationSeconds: 45 })), '45 sek.')

  const timedSession = {
    id: 'timed-core',
    label: 'Core',
    movements: [{
      role: 'core',
      roleClass: 'assistance',
      exerciseId: 'plank',
      exerciseName: 'Planke',
      prescription: { sets: 2, reps: '30 sekunder', targetRpe: '6–7' },
    }],
  }
  assert.equal(createMemberSessionDraft({ assignmentId: 'assignment-a', session: timedSession, weekNumber: 1, clientId: REQUEST_ID }), null)
})

test('en komplet uge kan gemmes og genoptages, mens korrupt JSON fjernes', () => {
  const storage = new MemoryStorage()
  const binding = createAssignmentBinding({ assignmentId: 'assignment-a', programId: 'program-a', matchInput, program })
  const base = createAssignedSnapshot({ userId: USER_ID, binding, matchInput, baselineLoads })
  const draft = createMemberSessionDraft({ assignmentId: 'assignment-a', session, weekNumber: 1, clientId: REQUEST_ID })
  const entry = memberSessionEntryFromDraft({ ...draft, confirmed: { 0: true, 1: true } }, session)
  const completeWeek = { ...base, stage: 'week-review', completedWeekOne: [entry] }
  assert.equal(validateMemberJourneySnapshot(completeWeek).ok, true)
  assert.equal(saveMemberJourneySnapshot(completeWeek, storage), true)
  assert.deepEqual(loadMemberJourneySnapshot({ userId: USER_ID, expectedBinding: binding, storage }), completeWeek)

  for (const key of storage.values.keys()) storage.setItem(key, '{bad-json')
  assert.equal(loadMemberJourneySnapshot({ userId: USER_ID, expectedBinding: binding, storage }), null)
  assert.equal(storage.values.size, 0)
})

test('ugentlig vurdering og uge-2-valg overlever refresh som eksplicit state', () => {
  const storage = new MemoryStorage()
  const binding = createAssignmentBinding({ assignmentId: 'assignment-a', programId: 'program-a', matchInput, program })
  const base = createAssignedSnapshot({ userId: USER_ID, binding, matchInput, baselineLoads })
  const draft = createMemberSessionDraft({ assignmentId: 'assignment-a', session, weekNumber: 1, clientId: REQUEST_ID })
  const entry = memberSessionEntryFromDraft({ ...draft, confirmed: { 0: true, 1: true } }, session)
  const readyForProposal = {
    ...base,
    stage: 'week-two-proposal',
    completedWeekOne: [entry],
    weeklyReview: { rating: 'appropriate', note: 'God uge uden tekniske problemer.', completedAt: '2026-08-02T12:00:00.000Z' },
  }
  assert.equal(validateMemberJourneySnapshot(readyForProposal).ok, true)
  assert.equal(saveMemberJourneySnapshot(readyForProposal, storage), true)
  assert.deepEqual(loadMemberJourneySnapshot({ userId: USER_ID, expectedBinding: binding, storage }), readyForProposal)
})

test('ongoing uge 2 kan begynde review uden svar og fortsætte sikkert til uge 3', () => {
  const storage = new MemoryStorage()
  const binding = createAssignmentBinding({ assignmentId: 'assignment-a', programId: 'program-a', matchInput, program })
  const base = createAssignedSnapshot({ userId: USER_ID, binding, matchInput, baselineLoads })
  const weekOne = completedSession(1)
  const weekTwo = completedSession(2)
  const reviewHistory = [completedReview(1)]
  const awaitingReview = createOngoingCycle({
    stage: 'ongoing-review',
    weekNumber: 2,
    previousCompleted: [weekOne],
    completed: [weekTwo],
    currentChoice: 'accepted',
    currentProposalId: 'week-two-proposal-safe',
    review: null,
    reviews: reviewHistory,
  })
  assert.ok(awaitingReview)

  const incompleteReview = createOngoingCycle({
    ...awaitingReview,
    stage: 'ongoing-review',
    review: { rating: '', note: 'Lidt tung til sidst.', completedAt: null },
  })
  assert.ok(incompleteReview)

  const readyForProposal = createOngoingCycle({
    ...incompleteReview,
    stage: 'ongoing-proposal',
    review: { rating: 'appropriate', note: 'God kontrol.', completedAt: '2026-08-09T12:00:00.000Z' },
  })
  assert.ok(readyForProposal)
  const weekThree = advanceOngoingCycle(readyForProposal, { choice: 'accepted', proposalId: 'week-three-proposal-safe' })
  assert.equal(weekThree.weekNumber, 3)
  assert.deepEqual(weekThree.previousCompleted, [weekTwo])
  assert.deepEqual(weekThree.completed, [])
  assert.deepEqual(weekThree.reviews.map(item => item.weekNumber), [1, 2])

  const snapshot = {
    ...base,
    stage: 'ongoing-ready',
    completedWeekOne: [weekOne],
    completedWeekTwo: [weekTwo],
    weeklyReview: { rating: 'appropriate', note: 'Uge 1 var god.', completedAt: '2026-08-02T12:00:00.000Z' },
    weekTwoChoice: 'accepted',
    ongoing: weekThree,
  }
  assert.equal(validateMemberJourneySnapshot(snapshot).ok, true)
  assert.equal(saveMemberJourneySnapshot(snapshot, storage), true)
  assert.deepEqual(loadMemberJourneySnapshot({ userId: USER_ID, expectedBinding: binding, storage }), snapshot)

  const draft = createMemberSessionDraft({ assignmentId: 'assignment-a', session, weekNumber: 3, clientId: clientIdFor(303) })
  assert.equal(validateMemberJourneySnapshot({ ...snapshot, stage: 'ongoing-session', sessionDraft: draft }).ok, true)
  assert.equal(validateMemberJourneySnapshot({ ...snapshot, stage: 'ongoing-session', sessionDraft: null }).ok, false)
  assert.equal(validateMemberJourneySnapshot({ ...snapshot, stage: 'ongoing-session', sessionDraft: { ...draft, assignmentId: 'assignment-b' } }).ok, false)
  assert.equal(validateMemberJourneySnapshot({ ...snapshot, stage: 'ongoing-ready', sessionDraft: draft }).ok, false)
})

test('ongoing state fejler lukket ved forkert uge, assignment, dubletter og reviewhistorik', () => {
  const binding = createAssignmentBinding({ assignmentId: 'assignment-a', programId: 'program-a', matchInput, program })
  const base = createAssignedSnapshot({ userId: USER_ID, binding, matchInput, baselineLoads })
  const weekOne = completedSession(1)
  const weekTwo = completedSession(2)
  const validCycle = createOngoingCycle({
    stage: 'ongoing-review',
    weekNumber: 2,
    previousCompleted: [weekOne],
    completed: [weekTwo],
    currentChoice: 'kept',
    currentProposalId: null,
    review: null,
    reviews: [completedReview(1)],
  })
  const snapshot = {
    ...base,
    stage: 'ongoing-review',
    completedWeekOne: [weekOne],
    completedWeekTwo: [weekTwo],
    weeklyReview: { rating: 'appropriate', note: '', completedAt: '2026-08-02T12:00:00.000Z' },
    weekTwoChoice: 'kept',
    ongoing: validCycle,
  }
  const checked = ongoing => validateMemberJourneySnapshot({ ...snapshot, ongoing }).ok
  assert.equal(checked(validCycle), true)
  assert.equal(checked({ ...validCycle, weekNumber: 1 }), false)
  assert.equal(checked({ ...validCycle, weekNumber: 521 }), false)
  assert.equal(checked({ ...validCycle, previousCompleted: [weekTwo] }), false)
  assert.equal(checked({ ...validCycle, completed: [weekOne] }), false)
  assert.equal(checked({ ...validCycle, previousCompleted: [weekOne, weekOne] }), false)
  assert.equal(checked({ ...validCycle, completed: [{ ...weekTwo, clientId: weekOne.clientId }] }), false)
  assert.equal(checked({
    ...validCycle,
    previousCompleted: [{
      ...weekOne,
      setLogs: weekOne.setLogs.map((row, index) => index === 0 ? { ...row, weekNumber: 2 } : row),
    }],
  }), false)
  assert.equal(checked({ ...validCycle, reviews: [completedReview(1), completedReview(1)] }), false)
  assert.equal(checked({ ...validCycle, reviews: [completedReview(2)] }), false)
  assert.equal(checked({ ...validCycle, currentChoice: 'accepted', currentProposalId: null }), false)
  assert.equal(checked({ ...validCycle, currentChoice: 'kept', currentProposalId: 'unexpected-proposal' }), false)
  assert.equal(checked({ ...validCycle, previousCompleted: [{ ...weekOne, assignmentId: 'assignment-b' }] }), false)

  const incompleteProposal = { ...validCycle, review: { rating: '', note: '', completedAt: null } }
  assert.equal(validateMemberJourneySnapshot({ ...snapshot, stage: 'ongoing-proposal', ongoing: incompleteProposal }).ok, false)
})

test('reviewhistorik er unik, sorteret og rullende begrænset til 104 uger', () => {
  const reviews = Array.from({ length: 104 }, (_, index) => completedReview(index + 1))
  const cycle = createOngoingCycle({
    stage: 'ongoing-proposal',
    weekNumber: 105,
    previousCompleted: [completedSession(104)],
    completed: [completedSession(105)],
    currentChoice: 'kept',
    review: { rating: 'appropriate', note: 'Stabil uge.', completedAt: '2026-08-02T12:00:00.000Z' },
    reviews,
  })
  assert.ok(cycle)
  const next = advanceOngoingCycle(cycle, { choice: 'kept' })
  assert.equal(next.weekNumber, 106)
  assert.equal(next.reviews.length, 104)
  assert.equal(next.reviews[0].weekNumber, 2)
  assert.equal(next.reviews.at(-1).weekNumber, 105)
  assert.equal(createOngoingCycle({ ...cycle, stage: 'ongoing-proposal', reviews: [...reviews, completedReview(105)] }), null)
  assert.equal(createOngoingCycle({ ...cycle, stage: 'ongoing-proposal', reviews: [completedReview(2), completedReview(1)] }), null)
})

test('generic uge-load har prioritet over uge-2- og startload', () => {
  const genericSession = {
    ...session,
    movements: [{
      ...session.movements[0],
      startingLoadKg: 70,
      weekTwoStartingLoadKg: 72.5,
      weekTwoLoadSource: 'legacy-week-two',
      weekStartingLoadKg: 75,
      weekLoadSource: 'accepted-week-three-proposal',
    }],
  }
  const rows = createMemberSetRows(genericSession, 3)
  assert.deepEqual(rows.map(row => row.planned.weightKg), [75, 75])
  assert.deepEqual(rows.map(row => row.planned.loadSource), ['accepted-week-three-proposal', 'accepted-week-three-proposal'])
  assert.equal(createMemberSessionDraft({ assignmentId: 'assignment-a', session, weekNumber: 0, clientId: REQUEST_ID }), null)
  assert.equal(createMemberSessionDraft({ assignmentId: 'assignment-a', session, weekNumber: 521, clientId: REQUEST_ID }), null)
})

test('alle legacy v1 assignment-stages accepteres fortsat uden ongoing-felt', () => {
  const binding = createAssignmentBinding({ assignmentId: 'assignment-a', programId: 'program-a', matchInput, program })
  const base = createAssignedSnapshot({ userId: USER_ID, binding, matchInput, baselineLoads })
  delete base.ongoing
  const weekOne = completedSession(1)
  const weekTwo = completedSession(2)
  const weeklyReview = { rating: 'appropriate', note: 'Passende uge.', completedAt: '2026-08-02T12:00:00.000Z' }
  const weekTwoDraft = createMemberSessionDraft({ assignmentId: 'assignment-a', session, weekNumber: 2, clientId: clientIdFor(202) })
  const snapshots = [
    base,
    { ...base, stage: 'week-review', completedWeekOne: [weekOne] },
    { ...base, stage: 'week-two-proposal', completedWeekOne: [weekOne], weeklyReview },
    { ...base, stage: 'week-two-ready', completedWeekOne: [weekOne], weeklyReview, weekTwoChoice: 'kept' },
    { ...base, stage: 'week-two-session', completedWeekOne: [weekOne], weeklyReview, weekTwoChoice: 'kept', sessionDraft: weekTwoDraft },
    { ...base, stage: 'week-two-complete', completedWeekOne: [weekOne], completedWeekTwo: [weekTwo], weeklyReview, weekTwoChoice: 'kept' },
  ]
  for (const value of snapshots) assert.equal(validateMemberJourneySnapshot(value).ok, true, value.stage)
})
