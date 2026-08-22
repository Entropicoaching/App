import assert from 'node:assert/strict'
import {
  assessProgressionGate,
  buildProgressionStateV1,
  progressionModelContextV1,
  validateProgressionStateV1,
} from '../supabase/functions/_shared/progressionState.js'

const sourceWeek = {
  id: 'source-week',
  week_number: 4,
  block_name: 'Basis',
  start_date: '2026-08-17',
  sessions: [{
    title: 'Dag A',
    exercises: [{ name: 'Primærløft', recommended_weight: 100, reps: '5', intensity: 'RPE 7' }],
  }],
}
const targetWeek = {
  week_number: 5,
  block_name: 'Basis',
  start_date: '2026-08-24',
  sessions: [{
    label: 'Dag A',
    exercises: [{ name: 'Primærløft', sets: [{ reps: 5, weight: 102.5 }], rpeTarget: 7 }],
  }],
}

const state = buildProgressionStateV1({
  sourceWeek,
  targetWeek,
  actuals: { 'Primærløft': { total: 3, skipped: 0, rpes: [6, 6.5, 6] } },
  logWindow: { from: '2026-08-17', to: '2026-08-24' },
  createdAt: '2026-08-22T09:00:00.000Z',
})

assert.equal(validateProgressionStateV1(state).ok, true, 'et komplet state-snapshot skal godkendes')
assert.equal(state.expected_progression.exercises[0].expected.decision, 'increase')
assert.deepEqual(state.expected_progression.exercises[0].expected.load_kg, { min: 100, target: 102.5, max: 102.5 })
assert.equal(state.evidence.summary.total_sets, 3, 'kun strukturerede input summeres')
assert.equal(progressionModelContextV1(state).available, true, 'modellen må kun få et valideret snapshot')
assert.deepEqual(state.decision_history, [], 'første snapshot må ikke opfinde historik')

const successor = buildProgressionStateV1({
  sourceWeek: { ...sourceWeek, id: 'target-week', week_number: 5 },
  targetWeek: { ...targetWeek, week_number: 6, start_date: '2026-08-31' },
  actuals: { 'Primærløft': { total: 3, skipped: 0, rpes: [7, 7, 7] } },
  logWindow: { from: '2026-08-24', to: '2026-08-31' },
  previousState: state,
  createdAt: '2026-08-29T09:00:00.000Z',
})
assert.equal(successor.decision_history.length, 1, 'den forrige godkendte beslutning skal følge med')
assert.equal(successor.decision_history[0].target_week_number, 5)

const missingState = structuredClone(state)
delete missingState.next_decision
assert.equal(validateProgressionStateV1(missingState).ok, false, 'manglende beslutningspunkt skal blokere prognosen')
assert.equal(progressionModelContextV1(missingState).available, false)

assert.deepEqual(
  assessProgressionGate({ latestState: null, sourceWeek, targetWeekNumber: 5 }),
  {
    status: 'approval_required',
    can_commit: false,
    reasons: ['Ingen godkendt progressionstilstand findes endnu.'],
  },
  'første prognose skal godkendes eksplicit',
)

const approvedForDraft = assessProgressionGate({
  latestState: {
    status: 'approved',
    source_week_id: 'source-week',
    target_week_id: null,
    target_week_number: 5,
    state,
  },
  sourceWeek,
  targetWeekNumber: 5,
})
assert.equal(approvedForDraft.can_commit, true, 'kun det godkendte snapshot må sende den tilhørende uge')

const successorRequired = assessProgressionGate({
  latestState: {
    status: 'approved',
    source_week_id: 'source-week',
    target_week_id: 'source-week',
    target_week_number: 5,
    state,
  },
  sourceWeek,
  targetWeekNumber: 5,
})
assert.equal(successorRequired.status, 'approval_required', 'en afsluttet forventning må ikke genbruges som næste')

console.log('OK: progressionstilstand v1 er komplet, valideres fail-closed og kræver eksplicit godkendelse.')
