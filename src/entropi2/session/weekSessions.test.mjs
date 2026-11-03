import test from 'node:test'
import assert from 'node:assert/strict'
import { weekSessions } from './weekSessions.mjs'

const session = (id, weekday, sets = 2) => ({ id, title: id, weekday,
  exercises: [{ id: `ex-${id}`, sets }] })
const week = () => ({ id: 'week-a', athlete_id: 'synthetic-a', start_date: '2026-11-02',
  sessions: [session('a', 0), session('b', 1), session('c', 2), session('d', 6)] })
const log = (exercise_id = 'ex-a', set_number = 1, extra = {}) => ({
  exercise_id, set_number, logged_at: '2026-11-02T12:00:00Z', ...extra })
const project = (extra = {}) => weekSessions({ week: week(), athleteId: 'synthetic-a',
  exerciseLogs: [], now: '2026-11-03T12:00:00Z', ...extra })

test('four statuses; skipped counts as addressed but is separately exposed', () => {
  const result = project({ exerciseLogs: [log(), log('ex-a', 2, { skipped: true }), log('ex-b')] })
  assert.deepEqual(result.sessions.map(s => s.status), ['klaret', 'delvist', 'fremtid', 'fremtid'])
  assert.deepEqual(result.sessions.map(s => [s.done, s.planned]), [[2, 2], [1, 2], [0, 2], [0, 2]])
  assert.equal(result.sessions[0].confirmed, 1)
  assert.equal(result.sessions[0].skipped, 1)
  assert.equal(project().sessions[0].status, 'mangler')
})

test('duplicates count once, out-of-range and unknown exercises never fill slots', () => {
  const result = project({ exerciseLogs: [log(), log(), log('ex-a', 3), log('unknown'),
    log('ex-a', 0), log('ex-a', '2'), log('ex-a', 1.5), null] })
  assert.equal(result.sessions.length, 4)
  assert.equal(result.sessions[0].done, 1)
  assert.equal(result.sessions[0].status, 'delvist')
})

test('conflicting skip/confirmation is unknown, independent of log order', () => {
  const logs = [log(), log('ex-a', 1, { skipped: true })]
  for (const exerciseLogs of [logs, [...logs].reverse()]) {
    const s = project({ exerciseLogs }).sessions[0]
    assert.equal(s.done, null); assert.equal(s.dataMissing, true)
    assert.equal(s.status, 'mangler')
  }
})

test('pending, parked, optimistic and foreign athlete records are excluded', () => {
  for (const extra of [{ exerciseLogs: [log('ex-a', 1, { _optimistic: true })] },
    { exerciseLogs: [log('ex-a', 1, { athlete_id: 'synthetic-b' })] },
    { exerciseLogs: [log()], pendingSyncKeys: ['ex-a_1'] },
    { exerciseLogs: [log()], parkedSets: [{ exerciseId: 'ex-a', setNumber: 1 }] }])
    assert.equal(project(extra).sessions[0].done, 0)
  assert.equal(project({ athleteId: 'synthetic-b' }).sessions[0].done, null)
  assert.equal(project({ athleteId: undefined }).sessions[0].done, null)
})

test('week boundaries use Danish dates; previous/next week and future instants are excluded', () => {
  const logs = [log('ex-a', 1, { logged_at: '2026-11-01T22:59:59Z' }),
    log('ex-a', 2, { logged_at: '2026-11-08T23:00:00Z' }),
    log('ex-b', 1, { logged_at: '2026-11-03T12:00:01Z' }),
    log('ex-a', 1, { logged_at: '2026-11-01T23:00:00Z' })]
  assert.equal(project({ exerciseLogs: logs }).sessions[0].done, 1)
  assert.equal(project({ exerciseLogs: logs }).sessions[1].done, 0)
  const next = week(); next.start_date = '2026-11-09'
  assert.ok(project({ week: next, exerciseLogs: logs }).sessions.every(s => s.done === 0 && s.status === 'fremtid'))
})

test('year and DST transitions retain seven calendar days and weekday offsets', () => {
  for (const [start, end] of [['2025-12-29', '2026-01-04'], ['2026-03-23', '2026-03-29'],
    ['2026-10-19', '2026-10-25']]) {
    const w = week(); w.start_date = start
    const r = project({ week: w, now: `${end}T22:00:00Z` })
    assert.equal(r.end, end); assert.equal(r.sessions[3].date, end)
    assert.ok(r.sessions.every(s => s.status === 'mangler'))
  }
})

test('explicit now is required; ambiguous and invalid timestamps never become evidence', () => {
  for (const logged_at of ['2026-11-02', '2026-11-02T12:00:00', '2026-02-30T12:00:00Z',
    '2026-11-02T24:00:00Z', '2026-11-02T12:00:00Zjunk', '', null])
    assert.equal(project({ exerciseLogs: [log('ex-a', 1, { logged_at })] }).sessions[0].done, 0)
  for (const now of [undefined, null, NaN, 'bad', '2026-11-03'])
    assert.equal(project({ now }).sessions[0].done, null)
  assert.deepEqual(project({ now: new Date('2026-11-03T12:00Z') }), project())
  assert.deepEqual(project({ now: Date.parse('2026-11-03T12:00Z') }), project())
})

test('missing logs and malformed plan are distinct from a known empty snapshot', () => {
  assert.equal(weekSessions().dataMissing, true)
  for (const exerciseLogs of [undefined, null, {}])
    assert.equal(project({ exerciseLogs }).sessions[0].done, null)
  assert.equal(project().sessions[0].done, 0)
  for (const start_date of [undefined, '2026-02-30', '2026-11-02T00:00:00Z']) {
    const w = week(); w.start_date = start_date
    assert.equal(project({ week: w, exerciseLogs: [log()] }).sessions[0].done, null)
  }
  for (const sets of [null, -1, 1.5, '2', Infinity]) {
    const w = week(); w.sessions[0].exercises[0].sets = sets
    const s = project({ week: w }).sessions[0]
    assert.equal(s.planned, null); assert.equal(s.done, null)
  }
  const w = week(); w.sessions[0].exercises = []
  assert.equal(project({ week: w }).sessions[0].status, 'mangler')
  assert.equal(project({ week: w }).sessions[0].planned, 0)
})

test('extra sessions, flexible weekdays and duplicate IDs have explicit outcomes', () => {
  const w = week(); w.sessions.push(session('extra', null, 1))
  let r = project({ week: w, exerciseLogs: [log('ex-extra')] })
  assert.equal(r.sessions.length, 5); assert.equal(r.sessions[4].status, 'klaret')
  assert.equal(r.sessions[4].date, null)
  w.sessions.push(session('extra', 3))
  r = project({ week: w, exerciseLogs: [log('ex-extra')] })
  assert.ok(r.sessions.slice(4).every(s => s.dataMissing && s.done === null))
  w.sessions[1].exercises[0].id = 'ex-a'
  assert.ok(project({ week: w }).sessions.slice(0, 2).every(s => s.planned === null))
})

test('deeply frozen inputs remain untouched; repeated calls and row order agree', () => {
  const freeze = value => { if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze); Object.freeze(value)
  } return value }
  const input = freeze({ week: week(), exerciseLogs: [log('ex-b'), log()],
    athleteId: 'synthetic-a', now: '2026-11-03T12:00:00Z' })
  const before = JSON.stringify(input), result = weekSessions(input)
  assert.deepEqual(weekSessions(input), result)
  assert.deepEqual(weekSessions({ ...input, exerciseLogs: [...input.exerciseLogs].reverse() }), result)
  assert.equal(JSON.stringify(input), before)
})

test('independent exhaustive oracle: all 256 combinations of four slot states', () => {
  const w = week()
  w.sessions = [{ id: 'oracle', weekday: 0,
    exercises: [{ id: 'x', sets: 2 }, { id: 'y', sets: 2 }] }]
  for (let mask = 0; mask < 256; mask++) {
    let digits = mask, confirmed = 0, skipped = 0
    const logs = []
    for (let i = 0; i < 4; i++, digits = Math.floor(digits / 4)) {
      const state = digits % 4
      if (state === 1) confirmed++
      if (state === 2) skipped++
      if (state) {
        const row = log(i < 2 ? 'x' : 'y', i % 2 + 1,
          state === 2 ? { skipped: true } : state === 3 ? { _optimistic: true } : {})
        logs.push(row, { ...row })
      }
    }
    const s = project({ week: w, exerciseLogs: logs }).sessions[0]
    const addressed = confirmed + skipped
    assert.equal(s.done, addressed, `mask ${mask}`)
    assert.equal(s.confirmed, confirmed)
    assert.equal(s.skipped, skipped)
    assert.equal(s.planned, 4)
    assert.equal(s.status, addressed === 4 ? 'klaret' : addressed ? 'delvist' : 'mangler')
  }
})
