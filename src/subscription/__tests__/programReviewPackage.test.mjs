import test from 'node:test'
import assert from 'node:assert/strict'

import { createMemberSessionDraft, memberSessionEntryFromDraft } from '../memberJourneyStorage.js'
import {
  buildNextWeekProposal,
  buildWeekTwoProposal,
  createCustomerProgram,
  createNextWeekView,
  createProgramReviewPackage,
  createWeekTwoView,
  NEXT_WEEK_PROPOSAL_SCHEMA_VERSION,
  PROGRAM_REVIEW_PACKAGE_SCHEMA_VERSION,
  validateNextWeekProposal,
  validateWeekTwoProposal,
  WEEK_TWO_PROPOSAL_SCHEMA_VERSION,
} from '../programReviewPackage.js'

const input = { goal: 'powerlifting-foundation', level: 'oevet', daysPerWeek: 2, equipment: 'gym', squatStyle: 'low-bar', deadliftStyle: 'sumo' }

function comparableExposure(movement, sessionId, rpe = 7, weekNumber = 1, weightKg = 100) {
  const reps = movement.prescription.targetReps
  return {
    sessionId,
    setLogs: Array.from({ length: movement.prescription.sets }, (_, index) => ({
      weekNumber,
      sessionId,
      exerciseId: movement.exerciseId,
      setNumber: index + 1,
      planned: { weightKg, reps, rpe: 7 },
      actual: { weightKg, repsCompleted: reps, rpeActual: rpe, note: '', skipped: false },
    })),
  }
}

function completedMovementWeek(program, movement, weekNumber, weightKg, rpe = 7) {
  return program.sessions
    .filter(session => session.movements.some(candidate => candidate.exerciseId === movement.exerciseId))
    .map(session => comparableExposure(movement, session.id, rpe, weekNumber, weightKg))
}

test('reviewpakken er stabil, forklarbar og kan ikke udgive sig for at være en tildeling', () => {
  const first = createProgramReviewPackage(input)
  const second = createProgramReviewPackage(input)
  assert.equal(first.outcome, 'review-ready')
  assert.equal(first.schemaVersion, PROGRAM_REVIEW_PACKAGE_SCHEMA_VERSION)
  assert.equal(first.reviewId, second.reviewId)
  assert.equal(first.assignment, null)
  assert.ok(first.guards.includes('requires-server-side-assignment'))
  assert.equal(first.decisionTrail.matchInput.deadliftStyle, 'sumo')
})

test('uklart input bliver i manuel review og modtager intet review-id', () => {
  const result = createProgramReviewPackage({ ...input, deadliftStyle: 'not-sure' })
  assert.equal(result.outcome, 'manual-review')
  assert.equal('reviewId' in result, false)
})

test('uge to foreslår ét fast vægttrin efter én komplet planlagt hovedløftseksponering', () => {
  const program = createCustomerProgram(createProgramReviewPackage({ ...input, goal: 'general-strength' }))
  const bench = program.sessions.flatMap(session => session.movements).find(movement => movement.role === 'bench-pattern')
  const proposal = buildWeekTwoProposal(program, [
    comparableExposure(bench, 'a', 7),
  ])
  const benchProposal = proposal.proposals.find(item => item.exerciseId === bench.exerciseId)
  assert.equal(benchProposal.action, 'increase-load')
  assert.equal(benchProposal.toLoadKg, 102.5)
  assert.equal(benchProposal.progressionKg, 2.5)
  assert.equal(proposal.status, 'proposal-requires-athlete-choice')
})

test('uge-to-evidens bruger de konkrete reps fra member-loggens sætplansstandard', () => {
  const match = {
    goal: 'powerlifting-foundation',
    level: 'begynder',
    daysPerWeek: 4,
    equipment: 'home',
    squatStyle: 'low-bar',
    deadliftStyle: 'sumo',
  }
  const program = createCustomerProgram(createProgramReviewPackage(match), {
    squat: { weightKg: 60, reps: 5, rpe: 8 },
    bench: { weightKg: 40, reps: 6, rpe: 8 },
    deadlift: { weightKg: 80, reps: 3, rpe: 8.5 },
  })
  const completed = program.sessions.map((session, sessionIndex) => {
    const draft = createMemberSessionDraft({
      assignmentId: 'assignment-a',
      session,
      weekNumber: 1,
      clientId: `11111111-1111-4111-a111-${String(sessionIndex + 1).padStart(12, '0')}`,
      now: Date.parse(`2026-08-02T1${sessionIndex}:00:00.000Z`),
    })
    const rows = draft.rows.map(row => Number.isFinite(row.actual.weightKg)
      ? row
      : { ...row, actual: { ...row.actual, weightKg: 10 } })
    const confirmed = Object.fromEntries(rows.map((_, index) => [index, true]))
    return memberSessionEntryFromDraft({ ...draft, rows, confirmed }, session, Date.parse(`2026-08-02T1${sessionIndex}:30:00.000Z`))
  })
  const bench = program.sessions.flatMap(session => session.movements).find(movement => movement.role === 'bench-pattern')
  const benchProposal = buildWeekTwoProposal(program, completed).proposals.find(item => item.exerciseId === bench.exerciseId)

  assert.equal(benchProposal.evidenceStatus, 'comparable-exposure')
  assert.equal(benchProposal.comparableExposureCount, 2)
  assert.doesNotMatch(benchProposal.reason, /repmålet blev ikke nået|belastningen afveg/)
})

test('uge to fastholder planen når data er ufuldstændige eller for hårde', () => {
  const program = createCustomerProgram(createProgramReviewPackage(input))
  const bench = program.sessions.flatMap(session => session.movements).find(movement => movement.role === 'bench-pattern')
  const proposal = buildWeekTwoProposal(program, [
    comparableExposure(bench, 'a', 8),
  ])
  assert.equal(proposal.proposals.find(item => item.exerciseId === bench.exerciseId).action, 'keep')
})

test('uge to viser kun en eksplicit accepteret belastning uden at ændre uge ét', () => {
  const program = createCustomerProgram(createProgramReviewPackage(input))
  const bench = program.sessions.flatMap(session => session.movements).find(movement => movement.role === 'bench-pattern')
  const proposal = buildWeekTwoProposal(program, [
    comparableExposure(bench, 'a', 7),
    comparableExposure(bench, 'b', 6.5),
  ])
  const accepted = createWeekTwoView(program, proposal)
  const kept = createWeekTwoView(program, null)
  const acceptedBench = accepted.sessions.flatMap(session => session.movements).find(movement => movement.exerciseId === bench.exerciseId)
  const originalBench = program.sessions.flatMap(session => session.movements).find(movement => movement.exerciseId === bench.exerciseId)
  assert.equal(accepted.progressionChoice, 'accepted-visible-proposal')
  assert.equal(acceptedBench.weekTwoStartingLoadKg, 102.5)
  assert.equal(originalBench.weekTwoStartingLoadKg, undefined)
  assert.equal(kept.progressionChoice, 'kept-week-one-plan')
  assert.equal(kept.sessions.flatMap(session => session.movements).find(movement => movement.exerciseId === bench.exerciseId).weekTwoStartingLoadKg, null)
})

test('den generiske kontrakt bygger uge tre fra præcis de gennemførte uge-to-data', () => {
  const program = createCustomerProgram(createProgramReviewPackage(input))
  const bench = program.sessions.flatMap(session => session.movements).find(movement => movement.role === 'bench-pattern')
  const weekTwoProposal = buildNextWeekProposal(
    program,
    completedMovementWeek(program, bench, 1, 100),
    2,
  )
  const weekTwo = createNextWeekView(program, weekTwoProposal, 2)
  const weekTwoBench = weekTwo.sessions.flatMap(session => session.movements).find(movement => movement.exerciseId === bench.exerciseId)
  assert.equal(weekTwoBench.weekStartingLoadKg, 102.5)

  const weekThreeProposal = buildNextWeekProposal(
    weekTwo,
    completedMovementWeek(weekTwo, weekTwoBench, 2, 102.5),
    3,
  )
  const benchProposal = weekThreeProposal.proposals.find(item => item.exerciseId === bench.exerciseId)
  const weekThree = createNextWeekView(weekTwo, weekThreeProposal, 3)
  const weekThreeBench = weekThree.sessions.flatMap(session => session.movements).find(movement => movement.exerciseId === bench.exerciseId)

  assert.equal(NEXT_WEEK_PROPOSAL_SCHEMA_VERSION, WEEK_TWO_PROPOSAL_SCHEMA_VERSION)
  assert.equal(weekThreeProposal.week, 3)
  assert.match(weekThreeProposal.proposalId, /^week-3-/)
  assert.notEqual(weekThreeProposal.proposalId, weekTwoProposal.proposalId)
  assert.equal(benchProposal.fromLoadKg, 102.5)
  assert.equal(benchProposal.toLoadKg, 105)
  assert.equal(benchProposal.progressionKg, 2.5)
  assert.equal(validateNextWeekProposal(weekTwo, weekThreeProposal, 3).ok, true)
  assert.equal(weekThree.weekNumber, 3)
  assert.equal(weekThreeBench.weekStartingLoadKg, 105)
  assert.equal(weekThreeBench.weekLoadSource, 'comparable-exposure')
})

test('uge-N-forslag fastholder belastningen ved for hårde eller ugyldige data', () => {
  const program = createCustomerProgram(createProgramReviewPackage(input))
  const bench = program.sessions.flatMap(session => session.movements).find(movement => movement.role === 'bench-pattern')
  const tooHard = buildNextWeekProposal(
    program,
    completedMovementWeek(program, bench, 2, 100, 8),
    3,
  ).proposals.find(item => item.exerciseId === bench.exerciseId)
  assert.equal(tooHard.action, 'keep')
  assert.equal(tooHard.progressionKg, null)
  assert.match(tooHard.reason, /RPE-loft/)

  const invalidSessions = completedMovementWeek(program, bench, 2, 100)
  invalidSessions[0].setLogs[0].actual.skipped = true
  const invalid = buildNextWeekProposal(program, invalidSessions, 3)
    .proposals.find(item => item.exerciseId === bench.exerciseId)
  assert.equal(invalid.action, 'keep')
  assert.equal(invalid.progressionKg, null)
  assert.match(invalid.reason, /ugyldige eller modstridende data/)
})

test('uge-N-validering binder både belastning og det præcise ugenummer', () => {
  const program = createCustomerProgram(createProgramReviewPackage(input))
  const bench = program.sessions.flatMap(session => session.movements).find(movement => movement.role === 'bench-pattern')
  const proposal = buildNextWeekProposal(
    program,
    completedMovementWeek(program, bench, 2, 100),
    3,
  )
  assert.equal(validateNextWeekProposal(program, proposal, 3).ok, true)

  const tamperedLoad = structuredClone(proposal)
  tamperedLoad.proposals.find(item => item.exerciseId === bench.exerciseId).toLoadKg = 999
  assert.equal(validateNextWeekProposal(program, tamperedLoad, 3).ok, false)

  const tamperedWeek = structuredClone(proposal)
  tamperedWeek.week = 4
  const weekValidation = validateNextWeekProposal(program, tamperedWeek, 3)
  assert.equal(weekValidation.ok, false)
  assert.ok(weekValidation.errors.includes('wrong-proposal-week'))
  assert.ok(weekValidation.errors.includes('proposal-fingerprint-mismatch'))

  const rejected = createNextWeekView(program, tamperedLoad, 3)
  assert.equal(rejected.progressionChoice, 'rejected-invalid-proposal')
  assert.equal(rejected.acceptedProposalId, null)
  assert.equal(rejected.sessions.flatMap(session => session.movements).find(movement => movement.exerciseId === bench.exerciseId).weekStartingLoadKg, null)
})

test('kundens program kan kun få uge-1-startvægt fra valideret, eksplicit 1RM-input', () => {
  const review = createProgramReviewPackage(input)
  const missing = createCustomerProgram(review, { squat: 120, bench: null, deadlift: 160 })
  const filled = createCustomerProgram(review, { squat: 120, bench: 80, deadlift: 160 })
  const squat = filled.sessions.flatMap(session => session.movements).find(movement => movement.role === 'squat-pattern')
  assert.equal(missing, null)
  assert.equal(squat.startingLoadKg, 87.5)
})

test('usikker baseline må ikke blokere progression efter en komplet uge-1-eksponering', () => {
  const review = createProgramReviewPackage(input)
  const program = createCustomerProgram(review, {
    squat: { weightKg: 100, reps: 10, rpe: 6 },
    bench: { weightKg: 80, reps: 10, rpe: 6 },
    deadlift: { weightKg: 120, reps: 10, rpe: 6 },
  })
  const squat = program.sessions.flatMap(session => session.movements).find(movement => movement.role === 'squat-pattern')
  const proposal = buildWeekTwoProposal(program, [
    comparableExposure(squat, 'a', 6),
  ])
  const item = proposal.proposals.find(candidate => candidate.exerciseId === squat.exerciseId)
  assert.equal(squat.baselineGuidance.confidence, 'low')
  assert.equal(item.action, 'increase-load')
  assert.equal(item.evidenceStatus, 'comparable-exposure')
  assert.equal(item.toLoadKg, 102.5)
})

test('fast 2,5 kg-trin gælder også ved lav belastning hvor den gamle 3 %-grænse blokerede', () => {
  const program = createCustomerProgram(createProgramReviewPackage({ ...input, goal: 'general-strength' }))
  const bench = program.sessions.flatMap(session => session.movements).find(movement => movement.role === 'bench-pattern')
  const exposure = comparableExposure(bench, 'a', 7)
  exposure.setLogs = exposure.setLogs.map(log => ({
    ...log,
    planned: { ...log.planned, weightKg: 40 },
    actual: { ...log.actual, weightKg: 40 },
  }))
  const item = buildWeekTwoProposal(program, [exposure]).proposals.find(candidate => candidate.exerciseId === bench.exerciseId)
  assert.equal(item.action, 'increase-load')
  assert.equal(item.fromLoadKg, 40)
  assert.equal(item.toLoadKg, 42.5)
  assert.equal(item.progressionKg, 2.5)
})

test('uge-2-forslaget er bundet til programmet og afviser ændret belastning', () => {
  const program = createCustomerProgram(createProgramReviewPackage(input))
  const bench = program.sessions.flatMap(session => session.movements).find(movement => movement.role === 'bench-pattern')
  const proposal = buildWeekTwoProposal(program, [
    comparableExposure(bench, 'a', 7),
    comparableExposure(bench, 'b', 6.5),
  ])
  assert.equal(proposal.schemaVersion, WEEK_TWO_PROPOSAL_SCHEMA_VERSION)
  assert.equal(validateWeekTwoProposal(program, proposal).ok, true)

  const tampered = structuredClone(proposal)
  const item = tampered.proposals.find(candidate => candidate.exerciseId === bench.exerciseId)
  item.action = 'increase-load'
  item.toLoadKg = 999
  assert.equal(validateWeekTwoProposal(program, tampered).ok, false)
  const rejected = createWeekTwoView(program, tampered)
  assert.equal(rejected.progressionChoice, 'rejected-invalid-proposal')
  assert.equal(rejected.acceptedProposalId, null)
  assert.equal(rejected.sessions.flatMap(session => session.movements).find(movement => movement.exerciseId === bench.exerciseId).weekTwoStartingLoadKg, null)
})

test('assistance genbruger kun atletens seneste log og får aldrig et opfundet 0 kg-forslag', () => {
  const program = createCustomerProgram(createProgramReviewPackage(input))
  const assistance = program.sessions.flatMap(session => session.movements).find(movement => movement.roleClass === 'assistance')
  const reps = Math.max(...String(assistance.prescription.reps).match(/\d+/g).map(Number))
  const completed = [{
    sessionId: 'day-a',
    setLogs: Array.from({ length: assistance.prescription.sets }, (_, index) => ({
      weekNumber: 1,
      sessionId: 'day-a',
      exerciseId: assistance.exerciseId,
      setNumber: index + 1,
      planned: { weightKg: 0, reps, rpe: 7 },
      actual: { weightKg: 24, repsCompleted: reps, rpeActual: 7, note: '', skipped: false },
    })),
  }]
  const proposal = buildWeekTwoProposal(program, completed)
  const item = proposal.proposals.find(candidate => candidate.exerciseId === assistance.exerciseId)
  assert.equal(item.action, 'keep')
  assert.equal(item.toLoadKg, 24)
  assert.equal(item.loadSource, 'latest-logged-set')
  const accepted = createWeekTwoView(program, proposal)
  assert.equal(accepted.sessions.flatMap(session => session.movements).find(movement => movement.exerciseId === assistance.exerciseId).weekTwoStartingLoadKg, 24)

  const withoutLog = buildWeekTwoProposal(program, [])
  const emptyItem = withoutLog.proposals.find(candidate => candidate.exerciseId === assistance.exerciseId)
  assert.equal(emptyItem.toLoadKg, null)
  assert.equal(emptyItem.loadSource, 'athlete-entry-required')
  assert.match(emptyItem.reason, /gætter ikke 0 kg/)
})

test('for hårde sæt forklares konkret og kan ikke ligne god progressionsevidens', () => {
  const program = createCustomerProgram(createProgramReviewPackage(input))
  const bench = program.sessions.flatMap(session => session.movements).find(movement => movement.role === 'bench-pattern')
  const proposal = buildWeekTwoProposal(program, [comparableExposure(bench, 'a', 8)])
  const item = proposal.proposals.find(candidate => candidate.exerciseId === bench.exerciseId)
  assert.equal(item.action, 'keep')
  assert.match(item.reason, /RPE-loft/)
})

test('én god og én afvist planlagt eksponering kan ikke udløse progression', () => {
  const program = createCustomerProgram(createProgramReviewPackage(input))
  const bench = program.sessions.flatMap(session => session.movements).find(movement => movement.role === 'bench-pattern')
  const item = buildWeekTwoProposal(program, [
    comparableExposure(bench, 'a', 7),
    comparableExposure(bench, 'b', 8),
  ]).proposals.find(candidate => candidate.exerciseId === bench.exerciseId)
  assert.equal(item.action, 'keep')
  assert.equal(item.progressionKg, null)
  assert.match(item.reason, /RPE-loft/)
})

test('hele engine-kontrakten holder for mål × niveau × 2/3/4 dage × gym/home', () => {
  for (const goal of ['general-strength', 'powerlifting-foundation']) {
    for (const level of ['begynder', 'oevet']) {
      for (const daysPerWeek of [2, 3, 4]) {
        for (const equipment of ['gym', 'home']) {
          const matchInput = { goal, level, daysPerWeek, equipment, squatStyle: 'low-bar', deadliftStyle: 'sumo' }
          const review = createProgramReviewPackage(matchInput)
          const program = createCustomerProgram(review, { squat: 140, bench: 100, deadlift: 180 })
          assert.ok(program, `${goal}/${level}/${daysPerWeek}/${equipment}`)
          const completed = program.sessions.map(session => ({
            sessionId: session.id,
            setLogs: session.movements.flatMap(movement => {
              const reps = movement.prescription.targetReps
                || Math.max(...String(movement.prescription.reps).match(/\d+/g).map(Number))
              const rpe = Math.max(...String(movement.prescription.targetRpe).match(/\d+(?:\.\d+)?/g).map(Number))
              const load = movement.startingLoadKg ?? (equipment === 'home' ? 12 : 20)
              return Array.from({ length: movement.prescription.sets }, (_, index) => ({
                weekNumber: 1,
                sessionId: session.id,
                exerciseId: movement.exerciseId,
                setNumber: index + 1,
                planned: { weightKg: load, reps, rpe },
                actual: { weightKg: load, repsCompleted: reps, rpeActual: rpe, note: '', skipped: false },
              }))
            }),
          }))
          const proposal = buildWeekTwoProposal(program, completed)
          assert.equal(validateWeekTwoProposal(program, proposal).ok, true)
          const weekTwo = createWeekTwoView(program, proposal)
          assert.equal(weekTwo.progressionChoice, 'accepted-visible-proposal')
          assert.equal(weekTwo.sessions.length, daysPerWeek)
          assert.ok(weekTwo.sessions.flatMap(session => session.movements).every(movement => movement.weekTwoStartingLoadKg !== null))
        }
      }
    }
  }
})
