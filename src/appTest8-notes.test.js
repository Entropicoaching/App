import test from 'node:test'
import assert from 'node:assert/strict'
import { RULESET, canonical, approvalBasis, createCoachNote, noteForSession, renderCoachNote } from './videoCoachNote.mjs'

function request(cue = 'Pres fødderne ned, og hold knæene rolige') {
  const measurement = {
    schema: 'va-k4-synthetic/v1', status: 'synthetic_only', lift: 'squat', setup_id: 'synthetic-only',
    units: { time: 's', position: 'px_x_anterior_y_down', angle: 'deg_inner_0_180', scale: 'cm_per_px' },
    phase: { name: 'concentric', start: 0, end: 1 }, cm_per_px: 1,
    uncertainty: { x_px: 0, y_px: 0, body_y_px: 0, knee_deg: 0, scale_cm_per_px: 0, time_s: 0 },
    samples: [0, 1].map(i => ({ t_s: i, valid: true, bar_x_px: i * 4, bar_y_px: 100 - i,
      hip_y_px: null, shoulder_y_px: null, knee_deg: null })),
  }
  const batch = { schema: 'va-k5-batch/v1', status: 'synthetic_only', clips: [{ clip_id: 'synthetic-clip', measurement }] }
  return { schema: 'va-k6-request/v1', status: 'synthetic_only', target: { athlete_id: 'synthetic1', session_id: 'session1' },
    review: { schema: 'va-k5-review/v1', status: 'synthetic_only', ruleset: RULESET, basis: canonical(batch), batch,
      answers: [{ clip_id: 'synthetic-clip', finding_id: 'BAR_FORWARD', decision: 'enig', comment: 'Øv med blå sko, æøå' }],
      physical_vc_pass: false, technique_acceptance: false, five_real_clips_accepted: false },
    clip_id: 'synthetic-clip', finding_ids: ['BAR_FORWARD'], cue }
}
const receipt = q => ({ schema: 'va-k6-direct-approval/v1', status: 'synthetic_only', actor: 'Marc', method: 'direct', decision: 'enig', basis: approvalBasis(q) })
const note = q => createCoachNote(q, receipt(q))
const h = (tag, props, ...children) => ({ tag, props, children })

test('APP-TEST8: tom noteliste giver ingen note og kalder ikke renderer', () => {
  const target = request().target
  assert.equal(noteForSession([], target), null)
  assert.equal(renderCoachNote(() => assert.fail('Tom liste må ikke rendere'), [], target), null)
})

test('APP-TEST8: danske tegn og markup bevares som tekst i notemodellen', () => {
  const q = request('ÆØÅ æøå <b>løft</b> & "ro"'), n = note(q)
  assert.equal(n.text, 'Syntetisk tekniknote: Stangens fremadrettede forskydning. Cue: ÆØÅ æøå <b>løft</b> & "ro"')
  const tree = renderCoachNote(h, [n], q.target)
  assert.equal(tree.tag, 'aside')
  assert.equal(tree.props['aria-label'], 'Tekniknote til passet')
  assert.equal(tree.props.style.overflowWrap, 'anywhere')
  assert.equal(tree.children[1].tag, 'p')
  assert.equal(tree.children[1].children[0], n.text)
  assert.equal(tree.children[1].props.style.whiteSpace, 'pre-wrap')
  assert.equal(Object.hasOwn(tree.children[1].props, 'dangerouslySetInnerHTML'), false)
})

test('APP-TEST8: cue på 160 tegn accepteres, længere og tomme afvises', () => {
  const cue = 'Æøå '.repeat(39) + 'løft'
  assert.equal(cue.length, 160)
  const q = request(cue), n = note(q)
  assert.equal(noteForSession([n], q.target), n.text)
  for (const invalid of ['', ' ', cue + 'x', 'ø'.repeat(10000), ' løft', 'løft ', 'løft\nroligt', 'løft\r\nroligt']) {
    assert.throws(() => approvalBasis(request(invalid)), TypeError)
  }
})

test('APP-TEST8: dansk reviewkommentar bevares ved grænsen på 2000 tegn', () => {
  const q = request()
  q.review.answers[0].comment = 'Æøå '.repeat(500)
  const n = note(q)
  assert.equal(n.request.review.answers[0].comment, q.review.answers[0].comment)
  q.review.answers[0].comment += 'x'
  assert.throws(() => approvalBasis(q), TypeError)
})

test('APP-TEST8: samme note to gange skjules og må ikke vises dobbelt', () => {
  const q = request(), first = note(q), second = note(q)
  assert.deepEqual(first, second)
  assert.notStrictEqual(first, second)
  assert.equal(noteForSession([first, second], q.target), null)
  assert.equal(renderCoachNote(h, [first, first], q.target), null)
  assert.equal(noteForSession([first], q.target), first.text)
})

test('APP-TEST8: noter isoleres pr. atlet og pas', () => {
  const q1 = request(), q2 = request('Øg roen i løftet'), q3 = request('Bøj knæene roligt')
  q2.target.athlete_id = 'synthetic2'
  q3.target.session_id = 'session2'
  const notes = [note(q1), note(q2), note(q3)]
  for (const [index, q] of [q1, q2, q3].entries()) assert.equal(noteForSession(notes, q.target), notes[index].text)
  assert.equal(noteForSession(notes, { athlete_id: 'synthetic2', session_id: 'session2' }), null)
})

test('APP-TEST8: ændret dansk cue kræver ny præcis godkendelse', () => {
  const q = request(), approval = receipt(q), before = canonical(q), n = createCoachNote(q, approval)
  q.cue = 'Løft med ro i knæene'
  assert.throws(() => createCoachNote(q, approval), TypeError)
  assert.equal(canonical(n.request), before)
  assert.equal(noteForSession([{ ...n, text: n.text + ' ændret' }], n.target), null)
  assert.equal(noteForSession([{ ...n, approval: { ...n.approval, basis: approval.basis + ' ' } }], n.target), null)
  assert.equal(createCoachNote(q, null), null)
  assert.ok(note(q).text.endsWith(q.cue))
})
