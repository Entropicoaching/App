// Separate review checks: direct API invariants, not the producer fixture's expected algorithm.
import test from 'node:test'
import assert from 'node:assert/strict'
import { suggestBlock } from './blockPlan.mjs'
import { fixture, today } from '../planlaegning/syntheticFixture.mjs'
function freeze(v) {
  if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v) }
  return v
}
test('review: deep-frozen public snapshot and edits work deterministically', () => {
  const p = freeze(fixture()), edits = freeze({ 4: { deload: false, lifts: { Squat: { sets: 4, targetRpe: 8 } } } })
  const a = suggestBlock(p, today, { edits }), b = suggestBlock(p, today, { edits })
  assert.deepEqual(a, b); assert.equal(a.state, 'ready'); assert.equal(a.weeks[3].deload, false)
  assert.equal(a.weeks[3].lifts[0].sets, 4)
  a.weeks[0].lifts[0].sets = 999
  assert.notDeepEqual(a, suggestBlock(p, today, { edits }))
})
test('review: mismatched owner and stale receipts never produce weekly targets', () => {
  for (const source of ['blocks', 'plan', 'logs']) {
    const p = fixture(); p[source].athleteId = 'synthetic-other'
    assert.equal(suggestBlock(p, today).weeks.length, 0)
  }
  const p = fixture(); p.logs.through = '2026-10-24'
  assert.equal(suggestBlock(p, today).weeks.length, 0)
})
test('review: threshold boundary and edit RPE/set limits', () => {
  const p = fixture(5); p.logs.rows.splice(0, 2)
  assert.equal(suggestBlock(p, today).cautious, false) // exactly 80 percent
  p.logs.rows.pop(); assert.equal(suggestBlock(p, today).cautious, true)
  for (const [sets, targetRpe] of [[0, 1], [100, 9.5]]) {
    const m = suggestBlock(fixture(), today, { edits: { 1: { lifts: { Squat: { sets, targetRpe } } } } })
    assert.equal(m.state, 'ready'); assert.equal(m.weeks[0].lifts[0].sets, sets)
  }
})
