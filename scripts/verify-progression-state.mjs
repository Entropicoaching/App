import assert from 'node:assert/strict'
import {
  assessProgressionGate,
  buildProgressionStateV1,
  progressionModelContextV1,
  progressionStateMatchesDraftPayload,
  validateProgressionStateV1,
} from '../supabase/functions/_shared/progressionState.js'
import { progressionOverrideErrors, updateDraftForecast, updateForecastOverrideReason } from '../src/progressionDraft.js'

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

const draftPayload = { sessions: targetWeek.sessions }
assert.equal(progressionStateMatchesDraftPayload(state, draftPayload).ok, true,
  'den oprindelige kladde skal matche forecastet')

let editedDraft = updateDraftForecast({
  draftPayload,
  forecastState: state,
  baselineState: state,
  key: '0:0',
  field: 'sets',
  value: '4',
})
for (const [field, value] of [['reps', '6'], ['load_kg', '105'], ['rpe_target', '7.5']]) {
  editedDraft = updateDraftForecast({
    draftPayload: editedDraft.draftPayload,
    forecastState: editedDraft.forecastState,
    baselineState: state,
    key: '0:0',
    field,
    value,
  })
}
assert.deepEqual(editedDraft.forecastState.expected_progression.exercises[0].override.fields,
  ['sets', 'reps', 'load_kg', 'rpe_target'], 'alle manuelle parameterændringer skal spores')
assert.equal(progressionOverrideErrors(editedDraft.forecastState).length, 1,
  'en ændret kladde må ikke godkendes uden begrundelse')
const reasonedDraftState = updateForecastOverrideReason(
  editedDraft.forecastState,
  '0:0',
  'Coachen vælger en roligere, men mere voluminøs uge.',
)
assert.equal(progressionOverrideErrors(reasonedDraftState).length, 0,
  'en begrundet kladde kan gå videre til godkendelse')
assert.equal(progressionStateMatchesDraftPayload(reasonedDraftState, editedDraft.draftPayload).ok, true,
  'kladden og dens opdaterede forecast skal følges ad')

const missingOverrideReason = structuredClone(state)
missingOverrideReason.expected_progression.exercises[0].expected.prescription.reps = '6'
missingOverrideReason.expected_progression.exercises[0].override = { fields: ['reps'], reason: '' }
assert.equal(validateProgressionStateV1(missingOverrideReason).ok, false,
  'en manuel ændring må ikke godkendes uden begrundelse')

const manualOverride = structuredClone(state)
const manualExpected = manualOverride.expected_progression.exercises[0].expected
manualExpected.prescription = { set_count: 4, reps: '6', load_kg: 105, rpe_target: 7.5 }
manualExpected.load_kg = { min: 105, target: 105, max: 105 }
manualOverride.expected_progression.exercises[0].override = {
  fields: ['sets', 'reps', 'load_kg', 'rpe_target'],
  reason: 'Coachen vælger en roligere, men mere voluminøs uge.',
}
assert.equal(validateProgressionStateV1(manualOverride).ok, true,
  'en begrundet manuel kladde skal kunne valideres')

const manualPayload = structuredClone(draftPayload)
manualPayload.sessions[0].exercises[0].sets = Array.from({ length: 4 }, () => ({ reps: 6, weight: 105 }))
manualPayload.sessions[0].exercises[0].rpeTarget = 7.5
assert.equal(progressionStateMatchesDraftPayload(manualOverride, manualPayload).ok, true,
  'den godkendte manuelle kladde skal kunne sendes')
manualPayload.sessions[0].exercises[0].rpeTarget = 8
assert.equal(progressionStateMatchesDraftPayload(manualOverride, manualPayload).ok, false,
  'en ændring efter godkendelse skal blokere afsendelse')

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
