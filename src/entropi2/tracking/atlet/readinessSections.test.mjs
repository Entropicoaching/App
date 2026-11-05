import test from 'node:test'
import assert from 'node:assert/strict'
import { readinessSections } from './readinessSections.mjs'

const row = extra => ({ athlete_id: 'synthetic-a', source: 'readiness_logs',
  logged_date: '2026-11-03', sleep_hours: 0, energy: 2, stress: 3, soreness_level: 5, ...extra })
const snapshot = dailyRows => ({ status: 'ready', complete: true, athleteId: 'synthetic-a',
  endDate: '2026-11-03', dailySource: 'readiness_logs', dailyRows,
  exerciseLogs: [], mealRows: [], weightRows: [] })
const build = input => readinessSections(input, { enabled: true })

test('OFF never inspects the snapshot; unknown and failed sources are not adapted', () => {
  const poison = new Proxy({}, { get() { throw Error('OFF read') } })
  for (const enabled of [undefined, false, 'true', 1]) assert.equal(readinessSections(poison, { enabled }), null)
  for (const input of [null, {}, { ...snapshot([]), dailySource: 'tracking_daily_v1' },
    { ...snapshot([]), status: 'loading' }, { ...snapshot([]), complete: false }]) assert.equal(build(input), null)
})

test('independent data gates keep zero sleep and native 1..5 dagsform', () => {
  const sleep = build(snapshot([row({ energy: null, stress: null, soreness_level: null })]))
  assert.equal(sleep.sleep.readinessRows[0].sleep_hours, 0)
  assert.equal(sleep.restitution, null)
  const rest = build(snapshot([row({ sleep_hours: null })]))
  assert.equal(rest.sleep, null); assert.equal(rest.restitution.readinessRows[0].soreness_level, 5)
  assert.deepEqual(build(snapshot([])), { sleep: null, restitution: null })
})

test('current periods, measurements and confirmed rows alone control presence', () => {
  for (const changes of [{ sleep_hours: '8', energy: 0, stress: 6, soreness_level: 10 },
    { _optimistic: true }, { logged_date: '2026-11-04' }, { logged_date: '2026-10-06' }]) {
    assert.deepEqual(build(snapshot([row(changes)])), { sleep: null, restitution: null })
  }
  const older = build(snapshot([row({ logged_date: '2026-10-20' })]))
  assert.ok(older.sleep); assert.equal(older.restitution, null)
  const boundary = build(snapshot([row({ logged_date: '2026-10-28' })]))
  assert.ok(boundary.sleep); assert.ok(boundary.restitution)
})

test('structural errors reject both sections; projection ignores unrelated private fields', () => {
  for (const dailyRows of [[row({ athlete_id: 'foreign' })], [row(), row()],
    [row({ source: 'athlete_manual' })], [row({ logged_date: '2026-02-30' })]]) {
    assert.equal(build(snapshot(dailyRows)), null)
  }
  const inputRow = Object.freeze(Object.defineProperty(row(), 'cycle', { enumerable: true, get() { throw Error('private row read') } }))
  const input = Object.freeze(Object.defineProperty(snapshot(Object.freeze([inputRow])), 'cycle', {
    enumerable: true, get() { throw Error('private snapshot read') },
  }))
  const result = build(input)
  assert.ok(result.sleep); assert.ok(result.restitution)
  assert.deepEqual(Object.keys(result.sleep.readinessRows[0]).sort(),
    ['athlete_id', 'logged_date', 'sleep_hours', 'energy', 'stress', 'soreness_level'].sort())
  assert.deepEqual(result.sleep.exerciseLogs, []); assert.deepEqual(result.sleep.qualityRows, [])
})
