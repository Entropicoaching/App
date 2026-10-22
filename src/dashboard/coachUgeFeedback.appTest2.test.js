import { test } from 'node:test'
import assert from 'node:assert/strict'
import { erAfsluttetUge, logsForUge, coachUgeFeedback, ugeFeedbackTree } from './coachUgeFeedback.js'

const week = () => ({ start_date: '2026-10-12', sessions: [{ id: 's1', title: 'Dag 1', exercises: [
  { id: 'sq', name: 'Squat', sets: 2, reps: '5-8', recommended_weight: 100 },
  { id: 'bp', name: 'Bench', sets: 1, reps: 5, recommended_weight: 80 },
] }] })
const now = () => new Date(2026, 9, 19)
const row = (exercise_id, extra = {}) => ({ exercise_id, weight: 100, reps_completed: 5, ...extra })
const h = (tag, props, ...children) => ({ tag, props, children })
const text = node => node == null ? '' : typeof node !== 'object' ? String(node) : (node.children || []).map(text).join(' ')

test('APP-TEST2: calendar closes at local midnight after seven days', () => {
  assert.equal(erAfsluttetUge(week(), new Date(2026, 9, 18, 23, 59, 59, 999)), false)
  assert.equal(erAfsluttetUge(week(), now()), true)
})
test('APP-TEST2: invalid dates and invalid clocks do not close a week', () => {
  for (const start_date of [undefined, '', '2026-02-30', '2026-13-01', '12-10-2026'])
    assert.equal(erAfsluttetUge({ start_date }, now()), false)
  assert.equal(erAfsluttetUge(week(), new Date(NaN)), false)
  assert.equal(erAfsluttetUge(week(), '2026-10-20'), false)
})
test('APP-TEST2: known exercises and deleted exercises pinned to this session survive filtering', () => {
  const logs = [row('sq'), row('deleted', { exercises: { session_id: 's1' } }), row('other', { exercises: { session_id: 's2' } }), null]
  assert.deepEqual(logsForUge(week(), logs), logs.slice(0, 2))
  assert.deepEqual(logsForUge(week(), null), [])
})
test('APP-TEST2: open calendar or unavailable logs produce no summary', () => {
  assert.equal(coachUgeFeedback(week(), [], new Date(2026, 9, 18)), null)
  assert.equal(coachUgeFeedback(week(), null, now()), null)
})
test('APP-TEST2: empty and skipped logs have distinct states', () => {
  assert.equal(coachUgeFeedback(week(), [], now()).status, 'ingen_logs')
  const f = coachUgeFeedback(week(), [row('sq', { skipped: true })], now())
  assert.equal(f.status, 'sprunget_over')
  assert.equal(f.rpe.saetMedRpe, 0)
  assert.equal(f.automatiskProgramaendring, false)
})
test('APP-TEST2: extra squat sets cannot compensate for an uncovered bench', () => {
  const f = coachUgeFeedback(week(), [row('sq'), row('sq'), row('sq')], now())
  assert.equal(f.status, 'delvis')
  assert.deepEqual(f.pas[0].manglendeOevelser, ['Bench'])
  assert.ok(f.afvigelser.some(a => a.type === 'flere_saet'))
})
test('APP-TEST2: actual RPE overrides stale rpe; missing and invalid stay separate', () => {
  const f = coachUgeFeedback(week(), [row('sq', { rpe: 2, rpe_actual: 9 }), row('sq', { rpe_actual: 11 }), row('bp', { weight: 80 })], now())
  assert.equal(f.status, 'fuld')
  assert.deepEqual([f.rpe.gennemsnit, f.rpe.max, f.rpe.saetMedRpe, f.rpe.saetUdenRpe, f.rpe.ugyldigeRpe], [9, 9, 1, 1, 1])
})
test('APP-TEST2: deviations, trimmed note and deleted log are reported without mutation', () => {
  const w = week(), logs = [row('sq', { weight: 90, reps_completed: 4, note: '  follow up  ' }), row('deleted', { exercises: { session_id: 's1' } })]
  const before = JSON.stringify([w, logs]), f = coachUgeFeedback(w, logs, now())
  for (const type of ['faerre_saet', 'faerre_reps', 'anden_vaegt', 'ukendt_ovelse_log']) assert.ok(f.afvigelser.some(a => a.type === type))
  assert.equal(f.noter[0].tekst, 'follow up')
  assert.equal(JSON.stringify([w, logs]), before)
})
test('APP-TEST2: pure element tree exposes status and disclaimer without React', () => {
  assert.equal(ugeFeedbackTree(h, null, 3), null)
  const tree = ugeFeedbackTree(h, coachUgeFeedback(week(), [], now()), 3, 'scope')
  assert.equal(tree.tag, 'section')
  assert.equal(tree.props['aria-label'], 'Coachens ugeoverblik for uge 3')
  assert.match(text(tree), /Programmet ændres ikke automatisk/)
})
