import { test } from 'node:test'
import assert from 'node:assert/strict'
import api from './fundEngine.mjs'

import { measurement } from './appTest2Measurement.mjs'
const batch = () => ({ schema: 'va-k5-batch/v1', status: 'synthetic_only', clips: [{ clip_id: 'clip1', measurement: measurement() }] })
const answer = (extra = {}) => ({ clip_id: 'clip1', finding_id: 'BAR_FORWARD', decision: 'enig', comment: '', ...extra })

test('APP-TEST2: four nominal findings retain units but cannot certify technique', () => {
  const a = api.analyze(measurement())
  assert.deepEqual(a.map(x => x.id), ['BAR_FORWARD', 'HIP_LEAD', 'SPEED_RANGE', 'KNEE_REVERSAL'])
  for (const x of a) {
    assert.equal(x.nominal_exceeds, true)
    assert.equal(x.robust_exceeds, null)
    assert.equal(x.certain, false)
    assert.equal(x.capture_quality.physical_vc_pass, false)
    assert.equal(x.capture_quality.technique_acceptance, false)
  }
  assert.ok(Math.abs(a.find(x => x.id === 'SPEED_RANGE').value - 0.3) < 1e-12)
})
test('APP-TEST2: strict nominal threshold and bench rule subset', () => {
  const d = measurement(); d.lift = 'bench'; d.samples[1].bar_x_px = 3; d.samples[2].bar_x_px = 3
  const a = api.analyze(d)
  assert.deepEqual(a.map(x => x.id), ['BAR_FORWARD', 'SPEED_RANGE'])
  assert.equal(a[0].value, 3)
  assert.equal(a[0].nominal_exceeds, false)
})
test('APP-TEST2: missing scale and channel stay unknown', () => {
  const d = measurement(); d.cm_per_px = null
  const a = api.analyze(d)
  assert.equal(a[0].value, null); assert.equal(a[0].unavailable_reason, 'missing_scale')
  assert.equal(a[0].nominal_exceeds, null)
  d.cm_per_px = 1; d.samples[1].knee_deg = null
  assert.equal(api.analyze(d).find(x => x.id === 'KNEE_REVERSAL').value, null)
})
test('APP-TEST2: malformed timing, units, fields and uncertainty are rejected', () => {
  const mutations = [d => { d.samples[1].t_s = 0 }, d => { d.samples[0].valid = false }, d => { d.units.time = 'ms' }, d => { d.extra = 1 }, d => { d.uncertainty.scale_cm_per_px = 1 }, d => { d.phase.end = 3 }, d => { d.samples[0].knee_deg = 181 }]
  for (const mutate of mutations) { const d = measurement(); mutate(d); assert.throws(() => api.analyze(d), TypeError) }
})
test('APP-TEST2: incomplete channel marks batch incomplete and duplicate clip ids fail', () => {
  const b = batch(); b.clips[0].measurement.samples[1].bar_x_px = null
  assert.equal(api.batch(b)[0].complete, false)
  b.clips.push(structuredClone(b.clips[0])); assert.throws(() => api.batch(b), TypeError)
})
test('APP-TEST2: review round trip binds full batch and keeps all acceptance flags false', () => {
  const b = batch(), before = JSON.stringify(b), s = api.decode(api.encode(b, [answer()]))
  assert.equal(s.basis, api.canonical(b)); assert.deepEqual(s.answers, [answer()])
  for (const key of ['physical_vc_pass', 'technique_acceptance', 'five_real_clips_accepted']) assert.equal(s[key], false)
  assert.equal(JSON.stringify(b), before)
})
test('APP-TEST2: stale basis and forged acceptance are rejected on decode', () => {
  for (const mutate of [s => { s.batch.clips[0].measurement.setup_id = 'changed' }, s => { s.technique_acceptance = true }, s => { s.ruleset = 'other' }]) {
    const s = api.session(batch(), []); mutate(s); assert.throws(() => api.decode(JSON.stringify(s)), TypeError)
  }
})
test('APP-TEST2: answers require present finding, one answer per pair and nonempty comment decision', () => {
  for (const answers of [[answer(), answer()], [answer({ finding_id: 'missing' })], [answer({ clip_id: 'other' })], [answer({ decision: 'kommentar', comment: ' ' })], [answer({ decision: 'auto' })]])
    assert.throws(() => api.session(batch(), answers), TypeError)
  assert.equal(api.session(batch(), [answer({ decision: 'kommentar', comment: 'review' })]).answers.length, 1)
})
