import test from 'node:test'
import assert from 'node:assert/strict'
import { exerciseHistory } from './exerciseHistory.mjs'

const now = Date.parse('2026-11-04T12:00:00Z')
const row = (extra = {}) => ({ id: 'set-a', athlete_id: 'synthetic-a', exercise_id: 'exercise-a',
  set_number: 1, logged_at: '2026-10-28T10:00:00Z', weight: 80, reps_completed: 5, rpe_actual: 8, ...extra })
const input = (logs, extra = {}) => ({ enabled: true, athleteId: 'synthetic-a', exerciseId: 'exercise-a',
  exerciseName: 'Squat', logs, now, ...extra })
const model = (logs, extra) => exerciseHistory(input(logs, extra))

test('OFF does not read any history or clock; enable is explicit', () => {
  assert.deepEqual(exerciseHistory(), { status: 'off' })
  for (const enabled of [undefined, false, 1, 'true']) {
    assert.deepEqual(exerciseHistory({ enabled, get logs() { assert.fail('OFF read') },
      get now() { assert.fail('OFF clock') } }), { status: 'off' })
  }
})

test('ready shows numbers and Copenhagen date, with the shared Epley formula', () => {
  const m = model([row({ weight: '82,5', reps_completed: '5', rpe_actual: '8.5' })])
  assert.equal(m.status, 'ready')
  assert.equal(m.sets[0].weight, 82.5); assert.equal(m.sets[0].rpe, 8.5)
  assert.equal(m.sets[0].e1rm, 82.5 * (1 + 5 / 30))
  assert.equal(m.curve[0].day, '2026-10-28')
  assert.equal(m.sets[0].date, '28. okt. 2026')
})

test('latest eight heavy sets, rather than heaviest eight, are sorted without mutation', () => {
  const logs = Array.from({ length: 12 }, (_, i) => Object.freeze(row({ id: `set-${i}`, weight: 150 - i,
    logged_at: `2026-10-${String(i + 1).padStart(2, '0')}T10:00:00Z` })))
  Object.freeze(logs)
  const m = model(logs)
  assert.equal(m.sets.length, 8)
  assert.deepEqual(m.sets.map(s => s.weight), [139, 140, 141, 142, 143, 144, 145, 146])
  assert.deepEqual(model(logs.toReversed()), m)
  assert.equal(logs[0].weight, 150)
})

test('exact athlete and exercise IDs only, no name inference or absent owner', () => {
  for (const extra of [{ athlete_id: 'synthetic-b' }, { athlete_id: undefined },
    { exercise_id: 'exercise-b', exercises: { name: 'Squat' } }]) {
    assert.equal(model([row(extra)]).status, 'empty')
  }
})

test('empty differs from read error, malformed collection or missing context', () => {
  assert.equal(model([]).status, 'empty')
  for (const extra of [{ error: new Error('PRIVATE DETAIL') }, { athleteId: '' }, { exerciseId: null },
    { exerciseName: '' }, { now: NaN }, { pendingSyncKeys: null }, { parkedSets: {} }]) {
    const m = model([row()], extra)
    assert.equal(m.status, 'error'); assert.doesNotMatch(m.message, /PRIVATE/)
  }
  for (const logs of [undefined, null, {}, 'bad']) assert.equal(model(logs).status, 'error')
})

test('skipped, optimistic, pending and parked sets never enter list or curve', () => {
  for (const extra of [{ skipped: true }, { _optimistic: true }]) assert.equal(model([row(extra)]).status, 'empty')
  assert.equal(model([row()], { pendingSyncKeys: ['exercise-a_1'] }).status, 'empty')
  assert.equal(model([row()], { parkedSets: [null, { exerciseId: 'exercise-a', setNumber: 1 }] }).status, 'empty')
})

test('shared heavy rule excludes >8 reps, light names and deload; eight is included', () => {
  for (const extra of [{ reps_completed: 9 }, { exercises: { name: 'Squat backoff' } },
    { exercises: { name: 'Squat teknik single' } }, { exercises: { name: 'Squat', sessions: { weeks: { block_name: 'Deload' } } } }]) {
    assert.equal(model([row(extra)]).status, 'empty', JSON.stringify(extra))
  }
  assert.equal(model([row({ reps_completed: 8 })]).status, 'ready')
})

test('invalid values and dates are omitted honestly, never drawn as zero', () => {
  for (const extra of [{ weight: 0 }, { weight: -1 }, { weight: true }, { weight: '' }, { weight: Infinity },
    { weight: Number.MAX_VALUE, reps_completed: 8 }, { reps_completed: 1.5 }, { reps_completed: null },
    { rpe_actual: 11 }, { rpe_actual: -1 }, { rpe_actual: false }, { set_number: 0 },
    { logged_at: '2026-02-30T12:00:00Z' }, { logged_at: '2026-10-28T24:00:00Z' },
    { logged_at: '2026-11-05T00:00:00Z' }, { logged_at: '2026-10-28' }, { logged_at: 'invalid' }]) {
    const m = model([row(extra)])
    assert.equal(m.status, 'empty', JSON.stringify(extra)); assert.equal(m.omitted, 1)
    assert.deepEqual(m.curve, [])
  }
  assert.equal(model([null, false, 'bad']).status, 'empty')
})

test('missing RPE remains missing; zero RPE is retained', () => {
  for (const rpe_actual of [null, undefined, '']) assert.equal(model([row({ rpe_actual })]).sets[0].rpe, null)
  assert.equal(model([row({ rpe_actual: 0 })]).sets[0].rpe, 0)
})

test('curve uses best estimate per shown day, chronological, with calendar gaps', () => {
  const m = model([row({ id: 'one', weight: 100, reps_completed: 1 }),
    row({ id: 'two', set_number: 2, weight: 95, reps_completed: 8 }),
    row({ id: 'three', logged_at: '2026-11-02T23:30:00Z', weight: 105 })])
  assert.equal(m.sets.length, 3)
  assert.deepEqual(m.curve.map(p => p.day), ['2026-10-28', '2026-11-03'])
  assert.equal(m.curve[0].e1rm, 95 * (1 + 8 / 30))
})

test('deduplicate persisted IDs and identical no-ID events; tie uses set number', () => {
  assert.equal(model([row(), row()]).sets.length, 1)
  assert.equal(model([row({ id: undefined }), row({ id: undefined })]).sets.length, 1)
  assert.deepEqual(model([row(), row({ id: 'two', set_number: 2 })]).sets.map(s => s.setNumber), [2, 1])
})

test('Copenhagen dates handle midnight, year and DST boundaries', () => {
  for (const [logged_at, day] of [['2025-12-31T23:30:00Z', '2026-01-01'],
    ['2026-03-29T22:30:00Z', '2026-03-30'], ['2026-10-25T23:30:00Z', '2026-10-26']]) {
    assert.equal(model([row({ logged_at })]).curve[0].day, day)
  }
})
