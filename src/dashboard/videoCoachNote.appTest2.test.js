import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RULESET, canonical, approvalBasis, createCoachNote, noteForSession, renderCoachNote } from '../videoCoachNote.mjs'
import { measurement } from './appTest2Measurement.mjs'

const target = () => ({ athlete_id: 'athlete1', session_id: 'session1' })
const request = () => {
  const batch = { schema: 'va-k5-batch/v1', status: 'synthetic_only', clips: [{ clip_id: 'clip1', measurement: measurement() }] }
  return { schema: 'va-k6-request/v1', status: 'synthetic_only', target: target(),
    review: { schema: 'va-k5-review/v1', status: 'synthetic_only', ruleset: RULESET, basis: canonical(batch), batch,
      answers: [{ clip_id: 'clip1', finding_id: 'BAR_FORWARD', decision: 'enig', comment: '' }],
      physical_vc_pass: false, technique_acceptance: false, five_real_clips_accepted: false },
    clip_id: 'clip1', finding_ids: ['BAR_FORWARD'], cue: 'Hold cue explicit' }
}
const receipt = q => ({ schema: 'va-k6-direct-approval/v1', status: 'synthetic_only', actor: 'Marc', method: 'direct', decision: 'enig', basis: approvalBasis(q) })

test('APP-TEST2: canonical JSON sorts nested keys and rejects lossy values', () => {
  assert.equal(canonical({ b: [2, { z: 1, a: true }], a: null }), '{"a":null,"b":[2,{"a":true,"z":1}]}')
  for (const x of [undefined, NaN, Infinity, { x: undefined }, new Date(), Array(1)]) assert.throws(() => canonical(x), TypeError)
})
test('APP-TEST2: valid direct approval binds cue and target without mutating request', () => {
  const q = request(), a = receipt(q), before = canonical(q), note = createCoachNote(q, a)
  assert.match(note.text, /^Syntetisk tekniknote:/); assert.ok(note.text.endsWith('Cue: Hold cue explicit'))
  assert.equal(noteForSession([note], target()), note.text)
  q.target.session_id = 'changed'; assert.equal(note.target.session_id, 'session1')
  assert.equal(canonical(note.request), before)
})
test('APP-TEST2: missing, indirect, other actor or rejected approval yields no note', () => {
  const q = request(); assert.equal(createCoachNote(q, null), null)
  for (const patch of [{ actor: 'Other' }, { method: 'indirect' }, { decision: 'uenig' }])
    assert.equal(createCoachNote(q, { ...receipt(q), ...patch }), null)
})
test('APP-TEST2: stale receipt after cue change is rejected', () => {
  const q = request(), a = receipt(q); q.cue = 'Changed cue'
  assert.throws(() => createCoachNote(q, a), TypeError)
})
test('APP-TEST2: request requires agreed finding, explicit single-line cue and exact target', () => {
  const changes = [q => { q.review.answers[0].decision = 'uenig' }, q => { q.finding_ids.push('BAR_FORWARD') }, q => { q.cue = ' ' }, q => { q.cue = 'a\nb' }, q => { q.target.extra = true }, q => { q.review.basis = 'stale' }]
  for (const change of changes) { const q = request(); change(q); assert.throws(() => approvalBasis(q), TypeError) }
})
test('APP-TEST2: absent, duplicate, foreign and tampered notes fail closed', () => {
  const q = request(), n = createCoachNote(q, receipt(q))
  assert.equal(noteForSession([], target()), null)
  assert.equal(noteForSession([n, n], target()), null)
  assert.equal(noteForSession([n], { ...target(), athlete_id: 'other' }), null)
  assert.equal(noteForSession([{ ...n, text: 'forged' }], target()), null)
  assert.equal(noteForSession([n], { ...target(), extra: true }), null)
})
test('APP-TEST2: element fake renders only validated session note', () => {
  const h = (tag, props, ...children) => ({ tag, props, children }), q = request(), n = createCoachNote(q, receipt(q))
  assert.equal(renderCoachNote(h, [], target()), null)
  const tree = renderCoachNote(h, [n], target())
  assert.equal(tree.tag, 'aside'); assert.equal(tree.props['aria-label'], 'Tekniknote til passet')
  assert.equal(tree.children[1].children[0], n.text)
})
