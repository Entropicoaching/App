import test from 'node:test'
import assert from 'node:assert/strict'
import { RULESET, canonical, approvalBasis, createCoachNote, noteForSession } from './videoCoachNote.mjs'

function request({ knee = null, count = 3, finding = 'BAR_FORWARD' } = {}) {
  const measurement = {
    schema: 'va-k4-synthetic/v1', status: 'synthetic_only', lift: 'squat', setup_id: 'synthetic-only',
    units: { time: 's', position: 'px_x_anterior_y_down', angle: 'deg_inner_0_180', scale: 'cm_per_px' },
    phase: { name: 'concentric', start: 0, end: count - 1 }, cm_per_px: 1,
    uncertainty: { x_px: 0, y_px: 0, body_y_px: 0, knee_deg: 0, scale_cm_per_px: 0, time_s: 0 },
    samples: Array.from({ length: count }, (_, i) => ({ t_s: i, valid: true,
      bar_x_px: i === 0 ? 0 : 4, bar_y_px: 100 - i * 2, hip_y_px: null, shoulder_y_px: null,
      knee_deg: knee === null ? null : knee[i % knee.length] })),
  }
  const batch = { schema: 'va-k5-batch/v1', status: 'synthetic_only', clips: [{ clip_id: 'synthetic1', measurement }] }
  return { schema: 'va-k6-request/v1', status: 'synthetic_only', target: { athlete_id: 'athlete1', session_id: 'session1' },
    review: { schema: 'va-k5-review/v1', status: 'synthetic_only', ruleset: RULESET, basis: canonical(batch), batch,
      answers: [{ clip_id: 'synthetic1', finding_id: finding, decision: 'enig', comment: '' }],
      physical_vc_pass: false, technique_acceptance: false, five_real_clips_accepted: false },
    clip_id: 'synthetic1', finding_ids: [finding], cue: 'Pres fødderne ned i gulvet' }
}
const receipt = q => ({ schema: 'va-k6-direct-approval/v1', status: 'synthetic_only', actor: 'Marc', method: 'direct', decision: 'enig', basis: approvalBasis(q) })
const rebind = q => { q.review.basis = canonical(q.review.batch); return q }
test('APP-TEST5 Note: one synthetic rep and many samples remain explicitly synthetic', () => {
  // Each request describes one concentric phase, never a real clip or rep detector.
  for (const count of [2, 3, 200]) {
    const q = request({ count }), note = createCoachNote(q, receipt(q))
    assert.equal(note.status, 'synthetic_only')
    assert.equal(noteForSession([note], q.target), note.text)
    assert.equal(note.text, 'Syntetisk tekniknote: Stangens fremadrettede forskydning. Cue: ' + q.cue)
    assert.equal(note.request.review.physical_vc_pass, false)
    assert.equal(note.request.review.technique_acceptance, false)
    assert.equal(note.request.review.five_real_clips_accepted, false)
  }
})
test('APP-TEST5 Note: absent angles cannot justify knee or hip findings', () => {
  for (const finding of ['KNEE_REVERSAL', 'HIP_LEAD'])
    assert.throws(() => approvalBasis(request({ finding })), TypeError)
  const q = request()
  assert.doesNotMatch(createCoachNote(q, receipt(q)).text, /knaevinkel|hofte/)
})
test('APP-TEST5 Note: empty samples, one sample and nonfinite measurement fail closed', () => {
  for (const count of [0, 1]) assert.throws(() => approvalBasis(request({ count })), TypeError)
  for (const value of [NaN, Infinity, -Infinity]) {
    const q = request(); q.review.batch.clips[0].measurement.samples[1].bar_x_px = value
    assert.throws(() => approvalBasis(q), TypeError)
  }
})
test('APP-TEST5 Note: threshold equality carries no finding; strict exceedance does', () => {
  const q = request(); q.review.batch.clips[0].measurement.samples.forEach((s, i) => { s.bar_x_px = i === 0 ? 0 : 3 })
  rebind(q)
  assert.throws(() => approvalBasis(q), TypeError)
  q.review.batch.clips[0].measurement.samples[1].bar_x_px = 3.001
  rebind(q)
  assert.ok(createCoachNote(q, receipt(q)))
})
test('APP-TEST5 Note: altered evidence, omitted approval and foreign target expose no text', () => {
  const q = request(), approval = receipt(q), note = createCoachNote(q, approval)
  assert.equal(createCoachNote(q, null), null)
  assert.equal(noteForSession([note], { ...q.target, session_id: 'other' }), null)
  assert.equal(noteForSession([note, note], q.target), null)
  assert.equal(noteForSession([{ ...note, text: 'Teknikken er sikker' }], q.target), null)
  q.review.batch.clips[0].measurement.samples[1].bar_x_px = 6
  rebind(q)
  assert.throws(() => createCoachNote(q, approval), TypeError)
})
