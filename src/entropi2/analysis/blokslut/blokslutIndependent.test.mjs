import test from 'node:test'
import assert from 'node:assert/strict'
import { blokslutModel } from './blokslutModel.mjs'

// Independent construction, without shared producer fixtures or metric helpers.
function data() {
  return { now: '2026-11-04', block: { start_date: '2026-10-28', end_date: '2026-11-10', weeks: [
    { start_date: '2026-10-28', block_name: 'Styrke', sessions: [
      { id: 'a', exercises: [{ id: 'a1', name: 'Bench', sets: 2 }] }] },
    { start_date: '2026-11-04', block_name: 'Styrke', sessions: [
      { id: 'b', exercises: [{ id: 'b1', name: 'Bench', sets: 1 }] }] },
  ] }, exerciseLogs: [
    { exercise_id: 'a1', set_number: 1, logged_at: '2026-10-28', weight: 60, reps_completed: 3 },
    { exercise_id: 'a1', set_number: 2, logged_at: '2026-10-29', weight: 50, reps_completed: 5 },
    { exercise_id: 'b1', set_number: 1, logged_at: '2026-11-04', weight: 70, reps_completed: 3 },
  ] }
}
const freeze = x => { if (x && typeof x === 'object') { Object.values(x).forEach(freeze); Object.freeze(x) } return x }

test('independent arithmetic, anchored weeks, deep-frozen snapshot and repeatability', () => {
  const p = freeze(data()), before = JSON.stringify(p)
  const m = blokslutModel(p)
  assert.equal(m.completed, 2); assert.equal(m.planned, 2)
  assert.deepEqual(m.weeks.map(w => w.tonnage), [430, 210])
  assert.equal(m.lifts[1].baseline.value, 66); assert.equal(m.lifts[1].current.value, 77)
  assert.equal(m.lifts[1].delta, 11)
  assert.deepEqual(blokslutModel(p), m); assert.equal(JSON.stringify(p), before)
})

test('input permutation, exact retries and conflicts are order-independent', () => {
  for (const change of [{}, { weight: 61 }, { _optimistic: true }]) {
    const p = data(); p.exerciseLogs.push({ ...p.exerciseLogs[0], ...change })
    const first = blokslutModel(p)
    p.exerciseLogs.reverse()
    assert.deepEqual(blokslutModel(p), first)
  }
})

test('Copenhagen midnight, DST and exact instant cutoff use calendar boundaries', () => {
  const p = data(); p.now = '2026-11-03T23:30:00Z'
  p.exerciseLogs[2].logged_at = '2026-11-03T23:00:00Z'
  assert.equal(blokslutModel(p).lifts[1].delta, 11)
  p.exerciseLogs[2].logged_at = '2026-11-03T23:31:00Z'
  assert.equal(blokslutModel(p).lifts[1].delta, null)
  // Both 02:30 occurrences on the autumn DST transition are the same Danish
  // calendar day, in one block week, without collapsing distinct set positions.
  p.now = '2026-10-28'; p.exerciseLogs[2].logged_at = '2026-10-28'
  p.block.start_date = '2026-10-21'; p.block.end_date = '2026-11-03'
  p.block.weeks[0].start_date = '2026-10-21'; p.block.weeks[1].start_date = '2026-10-28'
  p.exerciseLogs[0].logged_at = '2026-10-25T00:30:00Z'
  p.exerciseLogs[1].logged_at = '2026-10-25T01:30:00Z'
  const autumn = blokslutModel(p)
  assert.equal(autumn.weeks[1].start, '2026-10-28')
  assert.deepEqual(autumn.weeks.map(w => w.tonnage), [430, 210])
  assert.equal(autumn.completed, 2)
})

test('finite extreme values stay finite, even when decimal rounding could overflow', () => {
  const p = data()
  p.exerciseLogs = [p.exerciseLogs[0], p.exerciseLogs[2]]
  p.block.weeks[0].sessions[0].exercises[0].sets = 1
  p.exerciseLogs[0].weight = 1; p.exerciseLogs[0].reps_completed = 1
  p.exerciseLogs[1].weight = 1e308; p.exerciseLogs[1].reps_completed = 1
  const m = blokslutModel(p)
  assert.ok(Number.isFinite(m.lifts[1].delta)); assert.ok(m.lifts[1].delta > 1e307)
})
