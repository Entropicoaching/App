import test from 'node:test'
import assert from 'node:assert/strict'
import { trainingStability } from './trainingStability.mjs'

const athleteId = 'synthetic-athlete'
const starts = ['2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02']
const week = (start_date = starts[3], count = 4) => ({ id: `w-${start_date}`, start_date, athlete_id: athleteId,
  sessions: Array.from({ length: count }, (_, i) => ({ id: `s-${start_date}-${i}`, weekday: i,
    exercises: [{ id: `e-${start_date}-${i}`, sets: 2 }] })) })
const log = (session = 0, set_number = 1, extra = {}) => ({ athlete_id: athleteId,
  exercise_id: `e-${starts[3]}-${session}`, set_number, logged_at: '2026-11-02T10:00:00Z', ...extra })
const input = extra => ({ enabled: true, allWeeks: starts.map(start => week(start)), athleteId,
  exerciseLogs: [], now: '2026-11-03T12:00:00Z', ...extra })
const project = extra => trainingStability(input(extra))

test('four calendar weeks, oldest first, with a calm current-week line', () => {
  const exerciseLogs = [0, 1, 2].flatMap(i => [log(i, 1), log(i, 2)])
  const result = project({ exerciseLogs })
  assert.equal(result.line, '3 af 4 pas i denne uge')
  assert.deepEqual(result.weeks.map(w => [w.start, w.end, w.planned, w.completed]), [
    ['2026-10-12', '2026-10-18', 4, 0], ['2026-10-19', '2026-10-25', 4, 0],
    ['2026-10-26', '2026-11-01', 4, 0], ['2026-11-02', '2026-11-08', 4, 3],
  ])
})

test('missing history stays unknown; known empty plans are zero', () => {
  const result = project({ allWeeks: [week()] })
  assert.deepEqual(result.weeks.map(w => w.completed), [null, null, null, 0])
  assert.equal(result.line, '0 af 4 pas i denne uge')
  assert.equal(project({ allWeeks: [] }).line, null)
  const empty = project({ allWeeks: [week(starts[3], 0)] })
  assert.equal(empty.weeks[3].planned, 0)
  assert.equal(empty.line, 'Ingen pas planlagt i denne uge.')
})

test('partial, skipped, pending and conflicting records have distinct outcomes', () => {
  assert.equal(project({ exerciseLogs: [log()] }).weeks[3].completed, 0)
  assert.equal(project({ exerciseLogs: [log(), log(0, 2, { skipped: true })] }).weeks[3].completed, 1)
  assert.equal(project({ exerciseLogs: [log(0, 1, { skipped: true }), log(0, 2, { skipped: true })] }).weeks[3].completed, 0)
  const exerciseLogs = [log(), log(0, 2)]
  for (const extra of [{ pendingSyncKeys: [`e-${starts[3]}-0_1`] },
    { parkedSets: [{ exerciseId: `e-${starts[3]}-0`, setNumber: 1 }] },
    { exerciseLogs: [...exerciseLogs, log(0, 1, { _optimistic: true })] }]) {
    assert.equal(project({ exerciseLogs, ...extra }).weeks[3].completed, 0)
  }
  const conflict = project({ exerciseLogs: [...exerciseLogs, log(0, 1, { skipped: true })] })
  assert.equal(conflict.weeks[3].state, 'unknown')
  assert.equal(conflict.line, null)
})

test('only confirmed in-week, non-future, matching-athlete logs count', () => {
  for (const extra of [{ athlete_id: 'synthetic-other' }, { _optimistic: true },
    { logged_at: '2026-11-01T10:00:00Z' }, { logged_at: '2026-11-03T13:00:00Z' },
    { logged_at: '2026-11-09T10:00:00Z' }, { logged_at: 'bad' },
    { logged_at: '2026-11-02' }, { set_number: 3 }, { set_number: '2' }]) {
    assert.equal(project({ exerciseLogs: [log(), log(0, 2, extra)] }).weeks[3].completed, 0)
  }
  assert.equal(project({ exerciseLogs: [log(), log(), log(0, 2), log(0, 2)] }).weeks[3].completed, 1)
})

test('malformed or ambiguous plans cannot claim a count', () => {
  for (const alter of [w => ({ ...w, athlete_id: 'synthetic-other' }),
    w => ({ ...w, sessions: undefined }), w => ({ ...w, id: null }),
    w => ({ ...w, sessions: [...w.sessions, w.sessions[0]] }),
    w => ({ ...w, sessions: [{ id: 's', exercises: [{ id: 'e', sets: -1 }] }] })]) {
    assert.equal(project({ allWeeks: [alter(week())] }).weeks[3].state, 'unknown')
  }
  assert.equal(project({ allWeeks: [week(), week()] }).line, null)
  for (const start_date of [undefined, '2026-11-03', '2026-02-30']) {
    assert.equal(project({ allWeeks: [{ ...week(), start_date }] }), null)
  }
  const placeholder = week(starts[3], 0)
  placeholder.sessions = [{ id: 'empty', exercises: [] }]
  assert.equal(project({ allWeeks: [placeholder] }).weeks[3].planned, 0)
})

test('OFF and unavailable snapshots do not invent an overview', () => {
  assert.equal(trainingStability(), null)
  assert.equal(trainingStability({ enabled: false, get allWeeks() { throw Error('read while OFF') } }), null)
  for (const extra of [{ enabled: 'true' }, { loading: true }, { programError: true },
    { offlineSnapshotAt: 'snapshot' }, { athleteId: null }, { exerciseLogs: undefined },
    { allWeeks: null }, { now: undefined }, { now: '2026-02-30T12:00:00Z' },
    { now: '2026-11-03' }, { pendingSyncKeys: null }, { parkedSets: null }]) {
    assert.equal(project(extra), null)
  }
})

test('Copenhagen midnight, DST and year boundaries retain calendar weeks', () => {
  for (const [now, expected] of [
    ['2026-11-01T22:59:59Z', '2026-10-26'], ['2026-11-01T23:00:00Z', '2026-11-02'],
    ['2026-03-29T22:00:00Z', '2026-03-30'], ['2026-10-25T23:00:00Z', '2026-10-26'],
    ['2027-01-01T12:00:00Z', '2026-12-28'],
  ]) {
    const result = project({ now, allWeeks: [] })
    assert.equal(result.weeks[3].start, expected)
    assert.equal(result.weeks.length, 4)
  }
  assert.deepEqual(project({ now: new Date('2026-11-03T12:00:00Z') }), project())
})

test('historical completions remain in their own plan week', () => {
  const exerciseLogs = starts.flatMap((start, i) => Array.from({ length: i }, (_, s) => [1, 2].map(n =>
    log(s, n, { exercise_id: `e-${start}-${s}`, logged_at: `${start}T10:00:00Z` })))).flat()
  assert.deepEqual(project({ exerciseLogs }).weeks.map(w => w.completed), [0, 1, 2, 3])
})

test('independent exhaustive oracle: 256 slot-state combinations across two sessions', () => {
  const allWeeks = [week(starts[3], 2)]
  for (let code = 0; code < 256; code++) {
    const states = Array.from({ length: 4 }, (_, i) => (code >> (i * 2)) & 3)
    const exerciseLogs = states.flatMap((state, i) => state === 0 ? [] :
      [log(Math.floor(i / 2), i % 2 + 1, { skipped: state === 2, _optimistic: state === 3 })])
    const expected = [states.slice(0, 2), states.slice(2)].filter(slots =>
      slots.every(s => s === 1 || s === 2) && slots.includes(1)).length
    assert.equal(project({ allWeeks, exerciseLogs }).weeks[3].completed, expected, `case ${code}`)
  }
})

test('frozen snapshots stay unchanged; plan/log order does not change results', () => {
  function freeze(value) {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
    return value
  }
  const snapshot = freeze(input({ exerciseLogs: [log(), log(0, 2)] }))
  const result = trainingStability(snapshot)
  assert.deepEqual(trainingStability(snapshot), result)
  assert.deepEqual(trainingStability({ ...snapshot, allWeeks: [...snapshot.allWeeks].reverse(),
    exerciseLogs: [...snapshot.exerciseLogs].reverse() }), result)
})
