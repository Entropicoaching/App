import test from 'node:test'
import assert from 'node:assert/strict'
import { validateVideoCoachPayloadBounds as bounds, videoCoachSavedIdentityMatches as matches,
  saveVideoCoachDraft as save, isRetryableVideoCoachError as retryable } from './videoCoachSubmission.js'

const row = (count = 1) => ({ client_analysis_id: 'synthetic-analysis', athlete_id: 'synthetic-athlete', status: 'draft',
  reps_count: count, load_kg: 100, rpe: 7, low_conf_pct: 5, position_quality_pct: 95,
  metrics: {}, findings: [], rep_details: Array.from({ length: count }, (_, i) => ({ start_s: i * 2, end_s: i * 2 + 1, valid_ratio: 1, confidence: 0.9 })) })
test('APP-TEST5 Submission: empty, one rep, maximum reps and over limit', () => {
  for (const value of [null, undefined, [], {}, row(0), row(21)]) assert.equal(typeof bounds(value), 'string')
  for (const n of [1, 20]) assert.equal(bounds(row(n)), null)
  const value = row(); value.rep_details = []
  assert.equal(typeof bounds(value), 'string')
})
test('APP-TEST5 Submission: missing angles stay missing without invented findings', () => {
  const value = row(), before = structuredClone(value)
  assert.equal(bounds(value), null)
  assert.deepEqual(value, before)
  assert.deepEqual(value.metrics, {})
  assert.deepEqual(value.findings, [])
})
test('APP-TEST5 Submission: nonfinite values and reversed rep times are rejected', () => {
  for (const value of [NaN, Infinity, -Infinity]) {
    for (const field of ['load_kg', 'rpe', 'low_conf_pct', 'position_quality_pct'])
      assert.equal(typeof bounds({ ...row(), [field]: value }), 'string', field)
    const metric = row(); metric.metrics.rom = { value, method: 'synthetic', confidence: 1 }
    assert.equal(typeof bounds(metric), 'string')
    const rep = row(); rep.rep_details[0].start_s = value
    assert.equal(typeof bounds(rep), 'string')
  }
  const reversed = row(); reversed.rep_details[0].end_s = -1
  assert.equal(typeof bounds(reversed), 'string')
})
test('APP-TEST5 Submission: numeric boundary and payload caps are enforced', () => {
  for (const patch of [{ load_kg: -1 }, { load_kg: 1001 }, { rpe: 11 }, { low_conf_pct: 101 }])
    assert.equal(typeof bounds({ ...row(), ...patch }), 'string')
  const value = row(); value.findings = Array.from({ length: 33 }, () => ({ summary: 'Synthetic' }))
  assert.equal(typeof bounds(value), 'string')
  assert.equal(typeof bounds({ ...row(), coach_note: 'x'.repeat(256001) }), 'string')
  const cyclic = row(); cyclic.extra = cyclic
  assert.equal(typeof bounds(cyclic), 'string')
})
test('APP-TEST5 Submission: nonfinite bar origin must not be accepted for a path', () => {
  for (const x0 of [NaN, Infinity, -Infinity])
    assert.equal(typeof bounds({ ...row(), bar_path: { x0, y0: 0, dx: [1], dy: [1] } }), 'string')
})
test('APP-TEST5 Submission: save fake checks returned athlete and client identity', async () => {
  const value = row(), calls = []
  const fake = data => ({ from(table) { calls.push(['from', table]); return {
    insert(payload) { assert.equal(payload, value); return this }, select() { return this },
    single: async () => ({ data, error: null }),
  } } })
  assert.equal(matches({ ...value, athlete_id: 'other' }, value), false)
  const wrong = await save(fake({ ...value, athlete_id: 'other' }), value)
  assert.equal(wrong.error.code, 'VC_IDENTITY_MISMATCH')
  const right = await save(fake(value), value)
  assert.equal(right.error, null)
  assert.equal(right.duplicate, false)
  assert.deepEqual(calls, [['from', 'video_analyses'], ['from', 'video_analyses']])
})
test('APP-TEST5 Submission: retry classification excludes validation errors', () => {
  for (const code of ['08006', '503', 'PGRST000']) assert.equal(retryable({ code }), true)
  for (const code of ['23505', '42501', 'VC_IDENTITY_MISMATCH']) assert.equal(retryable({ code }), false)
  assert.equal(retryable(null), false)
})
