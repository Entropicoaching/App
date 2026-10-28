import { test } from 'node:test'
import assert from 'node:assert/strict'
import { h, nodes, text } from './profileWeekHarness.mjs'
const { ProfileWeekSummary, profileWeekLines } = await import('./profileWeekSummary.mjs')
const { readFourWeekSource, reduceFourWeekRead } = await import('./coachFourWeeks.mjs')
const athleteId = 'review-a', today = '2026-10-28'
const reads = () => Object.fromEntries(['weeks', 'logs', 'messages', 'videos'].map(kind => [kind, { athleteId, status: 'ready', rows: [] }]))
test('counterexample: timestamp offsets use actual latest event', () => {
  const input = reads()
  input.messages.rows = [
    { athlete_id: athleteId, sender_role: 'athlete', created_at: today+'T10:00:00+02:00', content: 'older' },
    { athlete_id: athleteId, sender_role: 'athlete', created_at: today+'T09:00:00Z', content: 'newer' },
  ]
  const lines = profileWeekLines({ athleteId, reads: input, today }).lines
  assert.match(lines[2], /newer/)
})
test('counterexample: video cap never claims newest event is known', () => {
  const input = reads(); input.videos.rows = Array(30).fill({ athlete_id: athleteId, source_mode: 'athlete_submission', created_at: today })
  assert.match(profileWeekLines({ athleteId, reads: input, today }).lines[2], /Ufuldstændigt/)
})
test('counterexample: payload is text, long content wraps, no injected HTML or handlers', () => {
  const input = reads(); input.messages.rows = [{ athlete_id: athleteId, sender_role: 'athlete', created_at: today, content: '<img onerror=attack()>'+ 'x'.repeat(1000) }]
  const tree = ProfileWeekSummary({ enabled: true, athleteId, reads: input, today })
  assert.match(text(tree), /<img onerror/)
  assert.ok(!nodes(tree).some(node => node.type === 'img' || node.props.dangerouslySetInnerHTML))
  assert.equal(tree.props.style.overflowWrap, 'anywhere')
  assert.equal(nodes(tree).filter(node => node.type === 'p').length, 3)
})
test('counterexample: old and future athlete messages do not fill an empty week', () => {
  const input = reads(); input.messages.rows = ['2026-10-25','2026-10-29'].map(at => ({ athlete_id: athleteId, sender_role: 'athlete', created_at: at, content: 'OUTSIDE' }))
  assert.doesNotMatch(text(ProfileWeekSummary({ enabled: true, athleteId, reads: input, today })), /OUTSIDE/)
})
test('counterexample: failed read and out-of-order response cannot replace current data', async () => {
  let state = {}
  const capture = event => { state = reduceFourWeekRead(state, event) }
  let finish
  const old = readFourWeekSource(capture, 'messages', athleteId, () => new Promise(resolve => { finish = resolve }))
  await readFourWeekSource(capture, 'messages', athleteId, async () => ({ data: [], error: Error('synthetic') }))
  finish({ data: [{ content: 'STALE' }] }); await old
  assert.equal(state[athleteId].messages.status, 'error')
  assert.deepEqual(state[athleteId].messages.rows, [])
})
