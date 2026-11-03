import test from 'node:test'
import assert from 'node:assert/strict'
import { lastSetLine } from './sessionHistory.mjs'

const now = Date.parse('2026-11-03T12:00:00Z')
const row = (extra = {}) => ({ athlete_id: 'athlete-a', exercise_id: 'ex-a', set_number: 1,
  logged_at: '2026-10-28T10:00:00Z', weight: 80, reps_completed: 5, rpe_actual: 8, ...extra })
const line = (logs, extra = {}) => lastSetLine({ athleteId: 'athlete-a', exerciseLogs: logs, ...extra }, 'ex-a', now)
test('no history, another exercise and another athlete produce no line', () => {
  for (const logs of [[], [row({ exercise_id: 'ex-b' })], [row({ athlete_id: 'athlete-b' })]]) assert.equal(line(logs), null)
  assert.equal(line([row()], { athleteId: null }), null)
})
test('latest timestamp wins regardless of array order; same timestamp uses set number', () => {
  const logs = [row({ logged_at: '2026-10-28T11:00:00Z', weight: 82.5 }), row()]
  assert.equal(line(logs), 'Sidst: 82,5 kg × 5 · RPE 8 (28. okt.)')
  assert.equal(line(logs.toReversed()), line(logs))
  assert.equal(line([row({ set_number: 3, weight: 85 }), row()]), 'Sidst: 85 kg × 5 · RPE 8 (28. okt.)')
  assert.equal(logs[0].weight, 82.5)
})
test('invalid numbers, dates, future and nonconfirmed sets are omitted', () => {
  for (const extra of [{ weight: null }, { weight: '' }, { weight: -1 }, { weight: Infinity },
    { weight: true }, { reps_completed: 1.5 }, { reps_completed: 0 }, { reps_completed: 'five' },
    { rpe_actual: 11 }, { rpe_actual: NaN }, { logged_at: 'invalid' }, { logged_at: '2026-11-04T00:00:00Z' },
    { logged_at: '2026-10-28' }, { logged_at: '2026-02-30T12:00:00Z' }, { skipped: true }, { _optimistic: true }]) assert.equal(line([row(extra)]), null, JSON.stringify(extra))
  assert.equal(line([row()], { pendingSyncKeys: ['ex-a_1'] }), null)
  assert.equal(line([row()], { parkedSets: [{ exerciseId: 'ex-a', setNumber: 1 }] }), null)
})
test('zero load, numeric strings and optional RPE retain their meaning', () => {
  assert.equal(line([row({ weight: '0', reps_completed: '5', rpe_actual: null })]), 'Sidst: 0 kg × 5 · RPE ikke angivet (28. okt.)')
  assert.equal(line([row({ athlete_id: undefined })]), 'Sidst: 80 kg × 5 · RPE 8 (28. okt.)')
})
test('Danish calendar is stable across midnight, week, year and DST boundaries', () => {
  for (const [stamp, expected] of [['2026-11-01T23:30:00Z', '2. nov.'],
    ['2025-12-31T23:30:00Z', '1. jan.'], ['2026-03-29T22:30:00Z', '30. mar.'],
    ['2026-10-25T23:30:00Z', '26. okt.']]) assert.ok(line([row({ logged_at: stamp })]).endsWith(`(${expected})`))
})
