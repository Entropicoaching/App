import test from 'node:test'
import assert from 'node:assert/strict'
import { PILOT_FEEDBACK_SCHEMA_VERSION, createPilotFeedbackExport, validatePilotFeedback } from '../pilotFeedback.js'
import { triagePilotFeedbackExport, validatePilotFeedbackExport } from '../pilotFeedbackReview.js'

const valid = { step: 'set-logging', severity: 'friction', note: 'Jeg kunne ikke se om mit sidste sæt var gemt.' }

test('pilotfeedback normaliserer en lokal produktfeedback-post', () => {
  const result = validatePilotFeedback(valid)
  assert.equal(result.ok, true)
  assert.equal(result.value.schemaVersion, PILOT_FEEDBACK_SCHEMA_VERSION)
  assert.equal(result.value.localOnly, true)
  assert.equal(result.value.note, valid.note)
})

test('pilotfeedback afviser manglende valg og kort tekst', () => {
  const result = validatePilotFeedback({ step: 'other', severity: '', note: 'kort' })
  assert.equal(result.ok, false)
  assert.deepEqual(result.errors, [
    { field: 'step', code: 'step-required' },
    { field: 'severity', code: 'severity-required' },
    { field: 'note', code: 'note-minimum-8-characters' },
  ])
})

test('eksporten indeholder kun validerede feedbackposter', () => {
  const result = createPilotFeedbackExport([valid, { step: '', severity: '', note: '' }])
  assert.equal(result.ok, true)
  assert.equal(result.value.kind, 'subscription-pilot-feedback-export')
  assert.equal(result.value.items.length, 1)
})

test('coach review holder pilotudvidelse når en blokering er rapporteret', () => {
  const exported = createPilotFeedbackExport([
    { step: 'set-logging', severity: 'blocking', note: 'Jeg kunne ikke afslutte passet efter det sidste sæt.' },
    { step: 'program', severity: 'idea', note: 'Jeg ville gerne kunne se flere alternativer.' },
  ])
  const result = triagePilotFeedbackExport(exported.value)
  assert.equal(result.ok, true)
  assert.equal(result.value.recommendation.status, 'hold-pilot')
  assert.equal(result.value.mostAffected.step, 'set-logging')
})

test('coach review afviser en eksport med forkert schema', () => {
  const result = validatePilotFeedbackExport({ schemaVersion: 'other', kind: 'subscription-pilot-feedback-export', items: [valid] })
  assert.equal(result.ok, false)
  assert.ok(result.errors.some(error => error.field === 'schemaVersion'))
})
