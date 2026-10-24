import test from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeVideoCoachFeedbackEvidence as sanitize } from './videoCoachFeedbackEvidence.js'

test('APP-TEST5 Evidence: empty or ungrounded cards are absent', () => {
  for (const value of [undefined, null, [], {}, { priority: { title: 'Sikker teknik' } }, { strength: { evidence: '1 rep' } }])
    assert.equal(sanitize(value), null)
})
test('APP-TEST5 Evidence: retains supplied measurement but adds no new claim', () => {
  const value = { version: 'coach-feedback-v3', priority: { title: ' Stangbane ', why: 'Kun dette sæt', evidence: '1 rep\r\n4 cm' }, extra: 'not public' }
  const before = structuredClone(value), result = sanitize(value)
  assert.deepEqual(result, { version: 'coach-feedback-v3', priority: { title: 'Stangbane', why: 'Kun dette sæt', evidence: '1 rep 4 cm' }, strength: null })
  assert.deepEqual(value, before)
})
test('APP-TEST5 Evidence: nontext values never become measurement evidence', () => {
  for (const value of [NaN, Infinity, -Infinity, 1, false, {}])
    assert.equal(sanitize({ strength: { title: 'Observation', evidence: value } }), null)
})
test('APP-TEST5 Evidence: bounded strings and unknown version stay explicit', () => {
  const result = sanitize({ version: 'untrusted', priority: { title: 'x'.repeat(200), why: 'y'.repeat(600), evidence: 'z'.repeat(400) } })
  assert.equal(result.version, 'coach-feedback-unknown')
  assert.equal(result.priority.title.length, 160)
  assert.equal(result.priority.why.length, 500)
  assert.equal(result.priority.evidence.length, 300)
})
