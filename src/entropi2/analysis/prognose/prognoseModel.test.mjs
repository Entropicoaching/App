import test from 'node:test'
import assert from 'node:assert/strict'
import { meetPrognose } from './prognoseModel.mjs'

const now = '2026-11-04T12:00:00Z'
const day = offset => new Date(Date.UTC(2026, 8, 2 + offset)).toISOString().slice(0, 10)
const row = (i, extra = {}) => ({ exercise_id: `synthetic-${i}`, logged_at: day(7 * i),
  weight: 100 + i, reps_completed: 3,
  exercises: { name: 'Squat', sessions: { weeks: { block_name: 'Styrke' } } }, ...extra })
const history = () => Array.from({ length: 10 }, (_, i) => row(i))
const props = extra => ({ now, meetDate: '2026-11-18', fremgangLogs: history(), ...extra })
const squat = p => meetPrognose(p).lifts[0]

test('linear weekly Epley values project to a hand-computed target with a nonzero interval', () => {
  const result = squat(props())
  assert.equal(result.status, 'ready')
  // Sep 2 -> Nov 18 = 11 weeks; (100 + 11) * (1 + 3/30).
  assert.ok(Math.abs(result.estimate - 122.1) < 1e-9)
  assert.equal(result.weeks, 10)
  assert.equal(result.firstDay, '2026-09-02')
  assert.equal(result.lastDay, '2026-11-04')
  assert.ok(result.lower < 116 && result.upper > 128)
})

test('flat data retains uncertainty; increasing horizon and noise widen it', () => {
  const flat = history().map(r => ({ ...r, weight: 100 }))
  const current = squat(props({ fremgangLogs: flat, meetDate: '2026-11-04' }))
  const future = squat(props({ fremgangLogs: flat, meetDate: '2026-12-16' }))
  assert.ok(Math.abs(current.estimate - 110) < 1e-9)
  assert.ok(current.upper - current.lower >= 11)
  assert.ok(future.upper - future.lower > current.upper - current.lower)
  const noisy = squat(props({ fremgangLogs: flat.map((r, i) => ({ ...r, weight: i % 2 ? 109 : 91 })) }))
  assert.equal(noisy.status, 'ready')
  assert.ok(noisy.upper - noisy.lower > future.upper - future.lower)
})

test('negative trends are preserved instead of always predicting improvement', () => {
  const result = squat(props({ fremgangLogs: history().map((r, i) => ({ ...r, weight: 110 - i })) }))
  assert.equal(result.status, 'ready')
  assert.ok(Math.abs(result.estimate - 108.9) < 1e-9)
})

test('each exact main lift has its own series; variants and assistance do not enter', () => {
  const names = ['Squat', 'Bænkpres', 'Dødløft', 'Sumo dødløft']
  const logs = names.flatMap((name, j) => history().map(r => ({ ...r, exercise_id: `${j}-${r.exercise_id}`,
    exercises: { name, sessions: { weeks: { block_name: 'Styrke' } } } })))
  assert.deepEqual(meetPrognose(props({ fremgangLogs: logs })).lifts.map(r => r.status), names.map(() => 'ready'))
  for (const name of ['Front squat', 'Pause squat', 'Romanian deadlift', 'Close grip bench press', 'Squat opvarmning']) {
    assert.equal(squat(props({ fremgangLogs: history().map(r => ({ ...r,
      exercises: { name, sessions: { weeks: { block_name: 'Styrke' } } } })) })).status, 'insufficient', name)
  }
})

test('empty data, short spans, sparse weeks and stale history cannot create forecasts', () => {
  for (const logs of [[], history().slice(3), history().filter((_, i) => i % 2 === 0),
    history().map((r, i) => ({ ...r, logged_at: day(i) })), history().slice(0, 7)])
    assert.equal(squat(props({ fremgangLogs: logs })).status, 'insufficient')
  assert.match(squat(props({ now: '2026-11-20', meetDate: '2026-12-01' })).message, /14 dage/)
  assert.match(squat(props({ meetDate: '2026-12-31' })).message, /for langt/)
})

test('minimum span and forecast horizon boundaries are explicit', () => {
  assert.equal(squat(props({ fremgangLogs: history().slice(1) })).status, 'ready') // 56 days
  assert.match(squat(props({ fremgangLogs: history().slice(2) })).message, /spænde/)
  assert.equal(squat(props({ meetDate: '2026-12-30' })).status, 'ready') // 56 ahead
  assert.equal(squat(props({ now: '2026-11-18', meetDate: '2026-11-18' })).status, 'ready')
  assert.equal(squat(props({ now: '2026-11-19', meetDate: '2026-11-19' })).status, 'insufficient')
})

test('bad dates, missing history, load/error states are distinct from empty history', () => {
  for (const now of [undefined, null, 0, {}, '', 'invalid', '2026-02-30', new Date(NaN), 'Nov 4 2026'])
    assert.equal(meetPrognose(props({ now })).status, 'error')
  for (const meetDate of [undefined, null, '', '2026-02-30', '2026-11-03', '2026-11-18T10:00:00Z'])
    assert.equal(meetPrognose(props({ meetDate })).status, 'error')
  for (const fremgangLogs of [undefined, null, {}]) assert.equal(meetPrognose(props({ fremgangLogs })).status, 'error')
  assert.equal(meetPrognose(props({ fremgangLogs: [] })).status, 'insufficient')
  assert.equal(meetPrognose(props({ fremgangLoading: true })).status, 'loading')
  assert.equal(meetPrognose(props({ fremgangError: true, fremgangLoading: true })).status, 'error')
  assert.equal(meetPrognose(props({ exerciseLogsError: true })).status, 'error')
  assert.equal(meetPrognose(null).status, 'error')
})

test('ineligible or malformed sets cannot fill missing evidence', () => {
  const changes = [{ skipped: true }, { _optimistic: true }, { weight: 0 }, { weight: -1 }, { weight: Infinity },
    { reps_completed: 9 }, { reps_completed: 0 }, { reps_completed: 1.5 }, { logged_at: '2026-02-30' },
    { logged_at: '2026-11-05' }, { logged_at: '2026-11-04T13:00:00Z' },
    ...['', 'Deload', 'Taper', 'Aflastning'].map(block_name => ({ exercises: { name: 'Squat', sessions: { weeks: { block_name } } } }))]
  for (const change of changes) {
    const result = squat(props({ fremgangLogs: history().map(r => ({ ...r, ...change })) }))
    assert.equal(result.status, 'insufficient', JSON.stringify(change))
  }
  assert.equal(squat(props({ fremgangLogs: [null, {}, ...history()] })).status, 'ready')
})

test('84-day window excludes older sets, even when they would meet the span gate', () => {
  const short = history().slice(3)
  assert.equal(squat(props({ fremgangLogs: [...short, { ...row(0), logged_at: '2026-08-11' }] })).status, 'insufficient')
  assert.equal(squat(props({ fremgangLogs: [...short, { ...row(0), logged_at: '2026-08-12' }] })).status, 'ready')
})

test('many same-week sets and exact retries never inflate independent weeks', () => {
  const logs = history()
  assert.deepEqual(squat(props({ fremgangLogs: [...logs, ...logs, ...logs] })), squat(props()))
  assert.deepEqual(squat(props({ fremgangLogs: logs.flatMap(r => [r, { ...r, id: 'retry-' + r.exercise_id }]) })), squat(props()))
  assert.equal(squat(props({ fremgangLogs: Array.from({ length: 100 }, (_, i) => ({ ...row(9), exercise_id: `same-week-${i}` })) })).status, 'insufficient')
})

test('conflicting and pending retries suppress a position regardless of array order', () => {
  const logs = history().slice(1)
  for (const bad of [{ ...logs[0], id: 'retry', weight: 500 }, { ...logs[0], _optimistic: true }]) {
    for (const ordered of [[...logs, bad], [bad, ...logs]])
      assert.equal(squat(props({ fremgangLogs: ordered })).status, 'insufficient')
  }
})

test('reused IDs across dates cannot fabricate independent weeks', () => {
  for (const logs of [history().map(r => ({ ...r, id: 'same-id' })),
    history().map((r, i) => ({ ...r, id: i < 4 ? 'conflict' : `id-${i}` }))])
    assert.equal(squat(props({ fremgangLogs: logs })).status, 'insufficient')
})

test('timestamp rows use the Copenhagen day and the explicit instant cutoff', () => {
  const logs = history().slice(0, 9)
  logs.push({ ...row(9), logged_at: '2026-11-03T23:30:00Z' })
  assert.equal(squat(props({ fremgangLogs: logs })).lastDay, '2026-11-04')
  assert.deepEqual(squat(props({ now: new Date(now), fremgangLogs: logs })), squat(props({ fremgangLogs: logs })))
  logs[9].logged_at = '2026-11-04T12:00:01Z'
  assert.equal(squat(props({ fremgangLogs: logs })).lastDay, '2026-10-28')
})

test('current-week local undo owns historical positions; no mutation', () => {
  const logs = history(), input = props({ currentWeek: { start_date: '2026-11-02', block_name: 'Styrke',
    sessions: [{ exercises: [{ id: 'synthetic-9', name: 'Squat', sets: 1 }] }] },
  exerciseLogs: [], fremgangLogs: logs })
  const before = structuredClone(input)
  assert.equal(squat(input).lastDay, '2026-10-28')
  assert.deepEqual(input, before)
  assert.deepEqual(squat(props({ fremgangLogs: [...logs].reverse() })), squat(props()))
})

test('extreme trends and non-finite arithmetic return no numerical forecast', () => {
  for (const logs of [history().map((r, i) => ({ ...r, weight: 10 + i * 10 })),
    history().map((r, i) => ({ ...r, weight: i % 2 ? 400 : 10 })),
    history().map(r => ({ ...r, weight: 1e307 }))]) {
    const result = squat(props({ fremgangLogs: logs, meetDate: '2026-12-30' }))
    assert.equal(result.status, 'insufficient')
    assert.equal(result.estimate, undefined)
  }
})
