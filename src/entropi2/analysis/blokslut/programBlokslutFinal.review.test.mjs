// Independent fixture construction, executed in a fresh Node test process.
import test from 'node:test'
import assert from 'node:assert/strict'
import { selectProgramBlock, programBlokslutModel, renderProgramBlokslut } from './programBlokslut.mjs'
function plan() {
  return ['2026-10-26', '2026-11-02'].map((start_date, i) => ({ id: `review-w${i}`, start_date, block_name: 'Basis',
    sessions: [{ id: `review-s${i}`, exercises: [{ id: `review-e${i}`, name: 'Bench', sets: 1 }] }] }))
}
test('independent exact-final review: dates, arithmetic, denominator and conflicting evidence', async () => {
  const weeks = plan(), block = selectProgramBlock(weeks, '2026-11-09')
  assert.equal(block.start_date, '2026-10-26'); assert.equal(block.end_date, '2026-11-08')
  assert.equal(selectProgramBlock(weeks, '2026-11-01'), null)
  assert.equal(selectProgramBlock(weeks, '2026-11-16'), null)
  const rows = [{ exercise_id: 'review-e0', set_number: 1, weight: 60, reps_completed: 3, logged_at: '2026-10-27' },
    { exercise_id: 'review-e1', set_number: 1, weight: 70, reps_completed: 3, logged_at: '2026-11-03' }]
  const run = data => programBlokslutModel({ athleteId: 'review-only', block, now: '2026-11-09', readPage: () => ({ data }) })
  const ready = await run(rows)
  assert.equal(ready.completed, 2); assert.equal(ready.planned, 2)
  assert.equal(ready.lifts[1].baseline.value, 66); assert.equal(ready.lifts[1].current.value, 77)
  assert.equal(ready.lifts[1].delta, 11)
  const uncertain = await run([...rows, { ...rows[1], weight: 71 }])
  assert.equal(uncertain.completed, 1); assert.equal(uncertain.lifts[1].delta, null)
  const h = (type, props, ...children) => ({ type, props, children })
  const card = renderProgramBlokslut(h, ready, { open: false })
  assert.equal(card.type, 'details'); assert.equal(card.props.open, false)
  assert.equal(card.props['aria-label'], 'Din blok')
})
test('independent exact-final review: partial failure discards accumulated rows', async () => {
  const block = selectProgramBlock(plan(), '2026-11-09'); let calls = 0
  const model = await programBlokslutModel({ athleteId: 'review-only', block, now: '2026-11-09',
    readPage() { return ++calls === 1 ? { data: Array(500).fill({}) } : { error: true, data: [] } } })
  assert.equal(calls, 2); assert.equal(model.status, 'error'); assert.equal(model.completed, undefined)
})
