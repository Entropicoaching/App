import test from 'node:test'
import assert from 'node:assert/strict'
import { hasReadinessSleep, readCoachSleep, startCoachSleep, selectCoachSleep, SLEEP_READ_CAP } from './coachSleepData.mjs'
import { buildSleepOverview } from './sleepModel.mjs'

const scope = { coachId: 'synthetic-coach', athleteId: 'synthetic-athlete', asOf: '2026-11-04' }
const row = (extra = {}) => ({ athlete_id: scope.athleteId, logged_date: '2026-11-03', sleep_hours: 7, ...extra })
function clientFor(data, error = null) {
  const calls = []
  const client = { from(table) {
    calls.push(['from', table])
    const query = {}
    for (const method of ['select', 'eq', 'gte', 'lte', 'order']) query[method] = (...args) => {
      calls.push([method, ...args]); return query
    }
    query.limit = async cap => { calls.push(['limit', cap]); return { data, error } }
    return query
  } }
  return { client, calls }
}

test('presence gate: OFF reads no scope/rows; only valid selected-athlete hours in 56 completed days', () => {
  for (const enabled of [undefined, false, 'true', 1]) {
    assert.equal(hasReadinessSleep({ enabled, get coachId() { throw Error('OFF') } }), false)
  }
  const check = rows => hasReadinessSleep({ enabled: true, ...scope, readinessRows: rows })
  for (const sleep_hours of [null, undefined, NaN, Infinity, -1, 25, '8']) assert.equal(check([row({ sleep_hours })]), false)
  for (const extra of [{ athlete_id: 'synthetic-other' }, { _optimistic: true },
    { logged_date: '2026-11-04' }, { logged_date: '2026-09-08' }, { logged_date: '2026-02-30' }]) {
    assert.equal(check([row(extra)]), false)
  }
  for (const sleep_hours of [0, 7.5, 24]) assert.equal(check([row({ sleep_hours })]), true)
  assert.equal(check([row({ logged_date: '2026-09-09' })]), true)
  assert.equal(check([]), false)
})

test('actual read: only production readiness hours; scoped complete eight weeks across DST', async () => {
  const secret = { get note() { throw Error('private extra read') } }
  const r = row(); Object.defineProperty(r, 'private_extra', { get: () => secret.note })
  const { client, calls } = clientFor([r])
  const snapshot = await readCoachSleep(client, scope)
  assert.deepEqual(calls, [['from', 'readiness_logs'], ['select', 'athlete_id, logged_date, sleep_hours'],
    ['eq', 'athlete_id', scope.athleteId], ['gte', 'logged_date', '2026-09-09'],
    ['lte', 'logged_date', '2026-11-03'], ['order', 'logged_date'], ['limit', SLEEP_READ_CAP]])
  assert.deepEqual(snapshot.qualityRows, []); assert.deepEqual(snapshot.exerciseLogs, [])
  assert.deepEqual(Object.keys(snapshot.readinessRows[0]), ['athlete_id', 'logged_date', 'sleep_hours'])
  const model = buildSleepOverview(snapshot, { enabled: true, weeks: 8 })
  assert.equal(model.status, 'ready'); assert.equal(model.days.length, 56)
  assert.equal(model.from, '2026-09-09'); assert.equal(model.to, '2026-11-03')
  assert.equal(model.weeks.at(-1).hours.average, null)
  assert.equal(model.weeks.at(-1).hours.count, 1)
})

test('failed, capped, malformed, duplicated and foreign sources fail closed; empty stays empty', async () => {
  for (const data of [null, {}, [null], [row({ athlete_id: 'synthetic-other' })],
    [row(), row()], [row({ logged_date: '2026-02-30' })], Array(SLEEP_READ_CAP).fill(row())]) {
    assert.deepEqual(await readCoachSleep(clientFor(data).client, scope), { status: 'error' })
  }
  assert.deepEqual(await readCoachSleep(clientFor([row()], {}).client, scope), { status: 'error' })
  assert.deepEqual(await readCoachSleep({ from() { throw Error('synthetic-private-error') } }, scope), { status: 'error' })
  const poison = new Proxy({}, { get() { throw Error('invalid scope read') } })
  assert.deepEqual(await readCoachSleep(poison, { ...scope, asOf: '2026-02-30' }), { status: 'error' })
  const empty = await readCoachSleep(clientFor([]).client, scope)
  assert.equal(buildSleepOverview(empty, { enabled: true, weeks: 8 }).status, 'empty')
})

test('actual effect helper: cancellation and synchronous client/coach/athlete/day/retry guards', async () => {
  const client = clientFor([row()]).client
  const result = { client, ...scope, attempt: 0, snapshot: { status: 'ready' } }
  assert.equal(selectCoachSleep(result, client, scope, 0), result.snapshot)
  for (const key of ['coachId', 'athleteId', 'asOf'])
    assert.equal(selectCoachSleep(result, client, { ...scope, [key]: 'synthetic-other' }, 0), null)
  assert.equal(selectCoachSleep(result, {}, scope, 0), null)
  assert.equal(selectCoachSleep(result, client, scope, 1), null)
  const updates = []
  const stop = startCoachSleep({ enabled: true, client, scope, attempt: 0 }, value => updates.push(value))
  stop(); await new Promise(resolve => setImmediate(resolve))
  assert.equal(updates.length, 0)
  startCoachSleep({ enabled: true, client, scope, attempt: 2 }, value => updates.push(value))
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(updates.length, 1); assert.equal(updates[0].attempt, 2)
  assert.equal(startCoachSleep({ enabled: false, client: poisonClient(), scope }, () => assert.fail()), undefined)
})
function poisonClient() { return new Proxy({}, { get() { throw Error('OFF IO') } }) }
