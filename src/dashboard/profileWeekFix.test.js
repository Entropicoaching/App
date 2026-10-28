import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nodes, text } from './profileWeekHarness.mjs'
const { ProfileWeekSummary } = await import('./profileWeekSummary.mjs')

const athleteId = 'synthetic-fix'
const log = (weight, logged_at, name = 'Squat', reps_completed = 5, extra = {}) => ({
  athlete_id: athleteId, exercise_id: name, weight, logged_at,
  reps_completed, exercises: { name }, ...extra,
})
function render(logs, today = '2026-10-28') {
  const reads = Object.fromEntries(['weeks', 'logs', 'messages', 'videos'].map(kind =>
    [kind, { athleteId, status: 'ready', rows: kind === 'logs' ? logs : [] }]))
  const before = structuredClone(reads)
  const tree = ProfileWeekSummary({ enabled: true, athleteId, reads, today })
  assert.deepEqual(reads, before, 'presentation must not mutate reader rows')
  assert.equal(nodes(tree).filter(node => node.type === 'p').length, 3)
  return text(tree)
}

test('F1: Danish Monday and Tuesday compete in the same visible week', () => {
  assert.match(render([
    log(50, '2026-10-25T23:30:00Z'),
    log(100, '2026-10-27T10:00:00Z'),
  ]), /Squat 100 kg × 5/)
})

test('F2: comma decimal retains the winning exercise name in DOM', () => {
  assert.match(render([log('102,5', '2026-10-27', 'Deadlift')]), /Deadlift 102.5 kg × 5/)
})

test('counter: highest weight wins even when the boundary set is heavier', () => {
  assert.match(render([
    log(120, '2026-10-25T23:30:00Z', 'Boundary'),
    log(100, '2026-10-27', 'Tuesday'),
  ]), /Boundary 120 kg × 5/)
})

test('counter: decimal reps and equal weights reuse the existing most-reps rule', () => {
  assert.match(render([
    log('102,5', '2026-10-25T23:30:00Z', 'Boundary', '5,5'),
    log(102.5, '2026-10-27', 'Tuesday', 6),
    log(102.5, '2026-10-28', 'Skipped', 20, { skipped: true }),
  ]), /Tuesday 102.5 kg × 6/)
})

test('counter: winter time week boundary excludes Sunday and accepts Monday', () => {
  assert.match(render([
    log(999, '2026-10-25T22:30:00Z', 'Sunday'),
    log(110, '2026-10-25T23:30:00Z', 'Monday'),
    log(100, '2026-10-27', 'Tuesday'),
  ]), /Monday 110 kg × 5/)
})

test('counter: summer time Monday uses Danish day and excludes previous Sunday', () => {
  assert.match(render([
    log(999, '2026-07-05T21:30:00Z', 'Sunday'),
    log(50, '2026-07-05T22:30:00Z', 'Monday'),
    log(100, '2026-07-07', 'Tuesday'),
  ], '2026-07-08'), /Tuesday 100 kg × 5/)
})

test('counter: year boundary, foreign athlete and future logs preserve scope', () => {
  const result = render([
    log(50, '2026-12-27T23:30:00Z', 'Monday'),
    log(100, '2027-01-01', 'Friday'),
    log(999, '2027-01-01', 'Foreign', 5, { athlete_id: 'other' }),
    log(998, '2027-01-03', 'Future'),
  ], '2027-01-02')
  assert.match(result, /Friday 100 kg × 5/)
  assert.doesNotMatch(result, /Foreign|Future/)
})
