import test from 'node:test'
import assert from 'node:assert/strict'
import { readOwnTracking, trackingScope, startTrackingRead, selectTrackingResult, TRACKING_READ_CAP } from './readOwnTracking.mjs'
import { buildAthleteOverview } from './atlet/overview.mjs'
import { fremgangSnapshot } from './atlet/fremgangSnapshot.mjs'

const id = 'synthetic-a'
const scope = { enabled: true, athleteId: id, day: '2026-11-04' }
const row = (extra = {}) => ({ id: 'r', athlete_id: id, logged_date: '2026-11-03',
  sleep_hours: 0, energy: 2, stress: 3, soreness_level: 5, ...extra })
function fixture(responses = {}) {
  const calls = []
  const client = { from(table) {
    calls.push([table, 'from'])
    const query = Object.fromEntries(['select', 'eq', 'gte', 'lte', 'lt', 'order'].map(method => [method, (...args) => {
      calls.push([table, method, ...args]); return query
    }]))
    query.limit = cap => {
      calls.push([table, 'limit', cap])
      const response = responses[table] ?? { data: [], error: null }
      return typeof response === 'function' ? response() : response
    }
    return query
  } }
  return { client, calls }
}
const project = snapshot => fremgangSnapshot({ enabled: true, athleteId: id, now: scope.day, snapshot })

test('reader OFF and invalid identity/day never access client', async () => {
  for (const enabled of [false, undefined, 1, 'true']) {
    const poison = { enabled, get client() { throw Error('OFF') }, get athleteId() { throw Error('OFF') } }
    assert.equal(await readOwnTracking(poison), null)
    assert.equal(startTrackingRead(poison, () => assert.fail()), undefined)
  }
  for (const change of [{ athleteId: '' }, { athleteId: undefined }, { day: '2026-02-30' },
    { day: undefined }, { day: '0000-01-02' }, { day: '2026-11-04T00:00:00Z' }]) {
    assert.equal(await readOwnTracking({ ...scope, ...change, get client() { throw Error('invalid') } }), null)
  }
})

test('one readiness query whitelists fields and fetches complete trailing days only', async () => {
  const daily = row()
  Object.defineProperty(daily, 'cycle', { enumerable: true, get() { throw Error('private') } })
  const f = fixture({ readiness_logs: { data: [daily] } })
  const result = await readOwnTracking({ ...scope, client: f.client })
  assert.equal(result.status, 'ready'); assert.equal(result.complete, true)
  assert.equal(result.dailyRows[0].soreness_level, 5)
  assert.equal(Object.hasOwn(result.dailyRows[0], 'soreness'), false)
  assert.equal(Object.hasOwn(result.dailyRows[0], 'cycle'), false)
  assert.equal(result.dailySource, 'readiness_logs')
  assert.deepEqual(Object.keys(result).sort(), ['athleteId', 'complete', 'dailyRows', 'dailySource', 'endDate', 'status'])
  assert.deepEqual(f.calls.filter(c => c[1] === 'from'), [['readiness_logs', 'from']])
  for (const table of ['readiness_logs']) {
    assert.ok(f.calls.some(c => c[0] === table && c[1] === 'eq' && c[2] === 'athlete_id' && c[3] === id))
    assert.ok(f.calls.some(c => c[0] === table && c[1] === 'order' && c[2] === 'id'))
    assert.ok(f.calls.some(c => c[0] === table && c[1] === 'limit' && c[2] === TRACKING_READ_CAP))
    const columns = f.calls.find(c => c[0] === table && c[1] === 'select')[2]
    assert.doesNotMatch(columns, /\*|cycle|notes|sore_zones|user_id/)
  }
  assert.ok(f.calls.some(c => c.join('|') === 'readiness_logs|gte|logged_date|2026-10-07'))
  assert.ok(f.calls.some(c => c.join('|') === 'readiness_logs|lte|logged_date|2026-11-03'))
  assert.deepEqual(f.calls.filter(c => c[1] === 'order'),
    [['readiness_logs', 'order', 'logged_date'], ['readiness_logs', 'order', 'id']])
})

test('busy or failing unused domains cannot cap or fail the wellbeing snapshot', async () => {
  const f = fixture({ readiness_logs: { data: [row()] } })
  const client = { from(table) {
    assert.equal(table, 'readiness_logs', 'only the displayed domain may be queried')
    return f.client.from(table)
  } }
  const result = await readOwnTracking({ ...scope, client })
  assert.equal(result.status, 'ready')
  assert.equal(result.dailyRows.length, 1)
  assert.equal(buildAthleteOverview(project(result), { enabled: true }).status, 'ready')
})

test('actual reader -> snapshot -> overview preserves native soreness and zero sleep', async () => {
  const data = [31, 1, 2, 3].map(day => row({ logged_date: day === 31 ? '2026-10-31' : `2026-11-0${day}` }))
  const f = fixture({ readiness_logs: { data } })
  const result = await readOwnTracking({ ...scope, client: f.client })
  const overview = buildAthleteOverview(project(result), { enabled: true })
  assert.equal(overview.status, 'ready')
  const fields = overview.weeks.at(-1).wellbeing
  assert.equal(fields[0].average, 0); assert.equal(fields[0].count, 4)
  assert.equal(fields[3].key, 'soreness_level'); assert.equal(fields[3].average, 5)
  assert.equal(fields[3].unit, 'af 5 (5 mest)')
  const empty = await readOwnTracking({ ...scope, client: fixture().client })
  assert.equal(buildAthleteOverview(project(empty), { enabled: true }).status, 'empty')
  const sparse = await readOwnTracking({ ...scope, client: fixture({ readiness_logs: { data: [row()] } }).client })
  assert.equal(buildAthleteOverview(project(sparse), { enabled: true }).weeks.at(-1).wellbeing[0].average, null)
})

test('failure, rejection, malformed, foreign or capped source cannot become empty success', async () => {
  const bad = [{ error: { message: 'synthetic secret must not escape' }, data: [] },
    { data: null }, {}, { data: [null] }, { data: [row({ athlete_id: 'other' })] },
    { data: [row({ logged_date: '2026-02-30' })] }, { data: Array(TRACKING_READ_CAP).fill(row()) },
    () => { throw Error('synthetic rejected') }]
  for (const table of ['readiness_logs']) {
    for (const response of bad) {
      const result = await readOwnTracking({ ...scope, client: fixture({ [table]: response }).client })
      assert.deepEqual(result, { athleteId: id, endDate: '2026-11-03', status: 'error', complete: false })
    }
  }
})

test('legacy invalid scales and duplicate days stay unknown or error, never canonicalized', async () => {
  for (const level of [0, 6, 1.5, '3', null]) {
    const result = await readOwnTracking({ ...scope,
      client: fixture({ readiness_logs: { data: [row({ soreness_level: level })] } }).client })
    assert.equal(buildAthleteOverview(project(result), { enabled: true }).weeks.at(-1).wellbeing[3].count, 0)
  }
  const duplicate = await readOwnTracking({ ...scope,
    client: fixture({ readiness_logs: { data: [row(), row()] } }).client })
  assert.equal(buildAthleteOverview(project(duplicate), { enabled: true }).status, 'error')
})

test('late reads are ignored after cleanup; selection hides changed scope/client/retry synchronously', async () => {
  let resolve, calls = 0
  const f = fixture({ readiness_logs: () => new Promise(r => { resolve = r }) })
  const stop = startTrackingRead({ ...scope, client: f.client }, () => calls++)
  stop(); resolve({ data: [row()] })
  await new Promise(r => setImmediate(r)); assert.equal(calls, 0)
  const snapshot = await readOwnTracking({ ...scope, client: fixture().client })
  const stored = { client: f.client, attempt: 0, snapshot }, current = trackingScope(scope)
  assert.equal(selectTrackingResult(stored, f.client, current, 0), snapshot)
  for (const [client, ownScope, attempt] of [[{}, current, 0], [f.client, current, 1],
    [f.client, { ...current, athleteId: 'other' }, 0], [f.client, { ...current, endDate: '2026-11-04' }, 0]]) {
    const selected = selectTrackingResult(stored, client, ownScope, attempt)
    assert.equal(selected.status, 'loading'); assert.equal(selected.dailyRows, undefined)
  }
  assert.equal(selectTrackingResult(stored, f.client, null, 0), null)
})

test('Copenhagen DST date scopes use calendar days, including leap day', () => {
  assert.equal(trackingScope({ ...scope, day: '2026-10-26' }).endDate, '2026-10-25')
  assert.equal(trackingScope({ ...scope, day: '2026-03-30' }).endDate, '2026-03-29')
  assert.equal(trackingScope({ ...scope, day: '2028-03-01' }).endDate, '2028-02-29')
})
