// Local, deterministic end-to-end regression control for the subscription
// pilot journey. It intentionally has no browser, network, auth, payment or
// Supabase dependency. A passing result means only that the local contract is
// internally coherent; it is never permission to activate a pilot.

import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'

import { validateBaselineLoads } from '../src/subscription/baselineLoads.js'
import { createPilotFeedbackExport } from '../src/subscription/pilotFeedback.js'
import { createCustomerProgram, createProgramReviewPackage, buildWeekTwoProposal, createWeekTwoView } from '../src/subscription/programReviewPackage.js'
import { customerSetPresentationState, isCustomerSessionReady, nextUnconfirmedSetIndex } from '../src/subscription/customerJourneyState.js'
import { LOCAL_CUSTOMER_JOURNEY_SCHEMA_VERSION, loadLocalCustomerJourney, localDemoIdFromEmail, saveLocalCustomerJourney, validateLocalCustomerJourneySnapshot } from '../src/subscription/localCustomerJourney.js'
import { validateCustomerSetLog } from '../src/subscription/customerSetLogging.js'

class MemoryStorage {
  constructor() { this.values = new Map() }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null }
  setItem(key, value) { this.values.set(key, String(value)) }
  removeItem(key) { this.values.delete(key) }
}

const input = {
  schemaVersion: 4,
  goal: 'powerlifting-foundation',
  level: 'oevet',
  daysPerWeek: 2,
  equipment: 'gym',
  squatStyle: 'low-bar',
  deadliftStyle: 'sumo',
  updatedAt: null,
}

const baselineLoads = { squat: 120, bench: 82.5, deadlift: 160 }

function upperNumber(value) {
  return Math.max(...String(value).match(/\d+/g).map(Number))
}

function targetRpe(value) {
  return Math.max(...String(value).match(/\d+(?:\.\d+)?/g).map(Number))
}

function plannedLoad(movement) {
  return Number.isFinite(movement.startingLoadKg) ? movement.startingLoadKg : 20
}

function loggedSet({ weekNumber, sessionId, movement, setNumber, weightKg = plannedLoad(movement) }) {
  const reps = upperNumber(movement.prescription.reps)
  const rpe = targetRpe(movement.prescription.targetRpe)
  return {
    weekNumber,
    sessionId,
    exerciseId: movement.exerciseId,
    setNumber,
    planned: { weightKg, reps, rpe },
    actual: { weightKg, repsCompleted: reps, rpeActual: rpe, note: '', skipped: false },
  }
}

function sessionResult(session, weekNumber) {
  const setLogs = session.movements.flatMap(movement =>
    Array.from({ length: movement.prescription.sets }, (_, index) => loggedSet({ weekNumber, sessionId: session.id, movement, setNumber: index + 1 })),
  )
  const logs = setLogs.map(log => ({
    exerciseId: log.exerciseId,
    loadKg: log.actual.weightKg,
    reps: log.actual.repsCompleted,
    rpe: log.actual.rpeActual,
  }))
  return { sessionId: session.id, logs, setLogs }
}

export function runSubscriptionPilotSmoke() {
  const checks = []
  const pass = (name, condition) => {
    assert.ok(condition, name)
    checks.push(name)
  }

  // 1. Variant selection is explicit and produces the athlete's own choices.
  const review = createProgramReviewPackage(input)
  pass('variantvalg er review-klar', review.outcome === 'review-ready')
  pass('low-bar bevares i beslutningssporet', review.decisionTrail.matchInput.squatStyle === 'low-bar')
  pass('sumo bevares i beslutningssporet', review.decisionTrail.matchInput.deadliftStyle === 'sumo')
  pass('uklar variant fejler lukket', createProgramReviewPackage({ ...input, deadliftStyle: 'not-sure' }).outcome === 'manual-review')

  // 2. Baselines are explicit and only decorate the local customer program.
  const baseline = validateBaselineLoads(baselineLoads)
  pass('baselinebelastninger er gyldige', baseline.ok)
  const program = createCustomerProgram(review, baselineLoads)
  pass('programudkast oprettes fra reviewpakken', Boolean(program && program.sessions.length === 2))
  const mainMovements = program.sessions.flatMap(session => session.movements).filter(movement => movement.roleClass === 'main')
  pass('hovedloeft har kun eksplicitte startbelastninger', mainMovements.every(movement => Number.isFinite(movement.startingLoadKg)))

  // 3. A full local week-one artifact has valid, independently normalised sets.
  const completed = program.sessions.map(session => sessionResult(session, 1))
  const setLogs = completed.flatMap(session => session.setLogs)
  pass('alle uge-1-saet validerer', setLogs.every(log => validateCustomerSetLog(log).ok))
  pass('saettilstand starter med et aktivt saet', customerSetPresentationState({ index: 0, activeIndex: 0, confirmed: {} }) === 'active')
  pass('saettilstand viser foerste gemte saet', customerSetPresentationState({ index: 0, activeIndex: 1, confirmed: { 0: true } }) === 'logged')
  pass('naeste saet findes deterministisk', nextUnconfirmedSetIndex(3, { 0: true }, 0) === 1)
  pass('pas kan afsluttes foerst ved komplette, gyldige saet', isCustomerSessionReady(setLogs, Object.fromEntries(setLogs.map((_, index) => [index, true])), validateCustomerSetLog))

  // 4. Week two remains an explicit athlete choice. The original week remains untouched.
  const proposal = buildWeekTwoProposal(program, completed)
  pass('uge-2-forslag kraever valg', proposal.status === 'proposal-requires-athlete-choice')
  const weekTwo = createWeekTwoView(program, proposal)
  pass('accepteret uge-2-visning er synlig men muterer ikke uge-1', weekTwo.progressionChoice === 'accepted-visible-proposal' && !Object.hasOwn(program.sessions[0].movements[0], 'weekTwoStartingLoadKg'))

  // 5. Snapshot survives a local reload. No raw email is persisted.
  const demoId = localDemoIdFromEmail('pilot+smoke@entropicoaching.local')
  const weekTwoDraft = sessionResult(program.sessions[0], 2)
  const snapshot = {
    schemaVersion: LOCAL_CUSTOMER_JOURNEY_SCHEMA_VERSION,
    demoId,
    stage: 'week-two-session',
    matchInput: input,
    baselineLoads,
    completed,
    setLogs,
    weekTwoChoice: 'accepted',
    sessionDraft: { weekNumber: 2, sessionId: weekTwoDraft.sessionId, rows: weekTwoDraft.setLogs, confirmed: {}, activeIndex: 0 },
    weekTwoCompleted: null,
  }
  pass('lokalt snapshot er komplet nok til genoptagelse', validateLocalCustomerJourneySnapshot(snapshot).ok)
  const storage = new MemoryStorage()
  pass('lokalt snapshot kan gemmes', saveLocalCustomerJourney(snapshot, storage))
  const reloaded = loadLocalCustomerJourney(storage)
  pass('lokal reload giver samme snapshot', JSON.stringify(reloaded) === JSON.stringify(snapshot))
  pass('snapshot gemmer ikke ra e-mail', !JSON.stringify(reloaded).includes('pilot+smoke@entropicoaching.local'))

  // 6. Feedback can be exported locally. Timestamp is intentionally excluded
  // from the deterministic assertion because it records the actual export time.
  const feedback = createPilotFeedbackExport([
    { step: 'week-two', severity: 'friction', note: 'Forslaget var tydeligt, men jeg vil gerne kunne sammenligne det med uge et.' },
  ])
  pass('feedbackartefakt er lokal-only', feedback.ok && feedback.value.localOnly === true && feedback.value.items.length === 1)
  pass('feedbackartefakt har korrekt kategori', feedback.value.items[0].step === 'week-two' && feedback.value.items[0].severity === 'friction')

  return { checkCount: checks.length, checks }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const result = runSubscriptionPilotSmoke()
    console.log(`PASS subscription pilot smoke (${result.checkCount} checks)`)
    for (const check of result.checks) console.log(`  OK ${check}`)
  } catch (error) {
    console.error(`FAIL subscription pilot smoke: ${error.message}`)
    process.exitCode = 1
  }
}
