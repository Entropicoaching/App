import test from 'node:test'
import assert from 'node:assert/strict'
import { weekProgressSentence } from './weekProgressSentence.mjs'

// Separate verification fixtures: enumerate every state of three positions,
// rather than deriving expectations through the production adapter/counters.
const now = '2026-11-04T12:00:00Z'
const currentWeek = { start_date: '2026-11-02', sessions: [
  { exercises: [{ id: 'x', sets: 2 }] }, { exercises: [{ id: 'y', sets: 1 }] },
] }
const position = index => ({ exercise_id: index < 2 ? 'x' : 'y', set_number: index === 1 ? 2 : 1,
  logged_at: '2026-11-03', weight: 100, reps_completed: 3 })
const run = exerciseLogs => weekProgressSentence({ currentWeek, exerciseLogs }, now)

test('review: all 64 missing, confirmed, skipped and pending combinations match a numeric oracle', () => {
  for (let mask = 0; mask < 64; mask++) {
    const states = [mask % 4, Math.floor(mask / 4) % 4, Math.floor(mask / 16)]
    const logs = states.flatMap((state, i) => state === 0 ? [] : [{ ...position(i),
      ...(state === 2 ? { skipped: true } : state === 3 ? { _optimistic: true } : {}) }])
    const confirmed = states.filter(state => state === 1).length
    const addressed = states.map(state => state === 1 || state === 2)
    const closed = Number(addressed[0] && addressed[1]) + Number(addressed[2])
    const expected = confirmed ? `Denne uge: ${closed} afslutte${closed === 1 ? 't' : 'de'} pas og ${confirmed} bekræfte${confirmed === 1 ? 't sæt' : 'de sæt'}.` : null
    assert.equal(run(logs), expected, `state ${states}`)
  }
})

test('review: pending retry cannot make a position depend on array order', () => {
  const saved = position(0), pending = { ...saved, _optimistic: true }
  assert.equal(run([saved, pending]), null)
  assert.equal(run([pending, saved]), null)
  assert.equal(run([saved, pending, position(2)]), 'Denne uge: 1 afsluttet pas og 1 bekræftet sæt.')
  assert.equal(run([position(2), pending, saved]), 'Denne uge: 1 afsluttet pas og 1 bekræftet sæt.')
})

test('review: conflicting retries remain unknown in all permutations', () => {
  const a = { ...position(0), id: 'a' }, b = { ...position(0), id: 'b', skipped: true }, c = position(2)
  for (const logs of [[a, b, c], [a, c, b], [b, a, c], [b, c, a], [c, a, b], [c, b, a]])
    assert.equal(run(logs), 'Denne uge: 1 afsluttet pas og 1 bekræftet sæt.')
})
