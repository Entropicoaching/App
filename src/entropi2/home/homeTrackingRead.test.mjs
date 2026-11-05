import test from 'node:test'
import assert from 'node:assert/strict'
import { readHomeReadiness, homeWeekSnapshot, HOME_READ_CAP } from './homeTrackingRead.mjs'
import { buildAthleteWeek } from '../tracking/ugeatlet/athleteWeekModel.mjs'

const athleteId = 'synthetic-athlete', today = '2026-11-04'
function fixture(result) {
  const calls = []
  const query = Object.fromEntries(['select', 'eq', 'gte', 'lte', 'order', 'limit'].map(name => [name,
    (...args) => { calls.push([name, ...args]); return query }]))
  query.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject)
  const client = { from(table) { calls.push(['from', table]); return query } }
  return { client, calls }
}
const row = extra => ({ athlete_id: athleteId, logged_date: '2026-11-03', energy: 3, sleep_hours: 7,
  motivation: 4, stress: 2, soreness_level: 1, ...extra })

test('actual read adapter filters the profile/calendar window and projects only required fields', async () => {
  const record = row(); Object.defineProperty(record, 'cycle', { get() { assert.fail('private field') } })
  const f = fixture({ data: [record], error: null })
  const data = await readHomeReadiness({ athleteId, today, client: f.client })
  assert.equal(data.status, 'ready'); assert.deepEqual(data.readinessRows, [row()])
  assert.deepEqual(f.calls.filter(call => ['eq','gte','lte'].includes(call[0])), [
    ['eq', 'athlete_id', athleteId], ['gte', 'logged_date', '2026-10-28'], ['lte', 'logged_date', today]])
  assert.deepEqual(f.calls.at(-1), ['limit', HOME_READ_CAP])
  assert.equal(f.calls[0][1], 'readiness_logs')
})

test('errors, truncation, mixed owners, duplicates and invalid/out-of-window dates fail closed', async () => {
  for (const result of [{ error: { message: 'synthetic' }, data: [] }, { data: null },
    { data: Array(HOME_READ_CAP).fill(row()) }, { data: [row({ athlete_id: 'other' })] },
    { data: [row(), row()] }, { data: Array(1) }, { data: [row({ logged_date: '2026-02-30' })] },
    { data: [row({ logged_date: '2026-10-27' })] }, { data: [row({ logged_date: '2026-11-05' })] }]) {
    const f = fixture(result)
    assert.equal((await readHomeReadiness({ athleteId, today, client: f.client })).status, 'error')
  }
})

test('invalid scope never touches a client; rejected reads return an honest error', async () => {
  for (const scope of [{ athleteId: '', today }, { athleteId, today: null }, { athleteId, today: '2026-02-30' }]) {
    assert.equal((await readHomeReadiness({ ...scope, client: { from() { assert.fail('invalid scope read') } } })).status, 'error')
  }
  assert.equal((await readHomeReadiness({ athleteId, today, client: { from() { throw Error('synthetic') } } })).status, 'error')
})

test('home week uses completed Copenhagen calendar days across DST, never today or absent zeroes', () => {
  const data = { status: 'ready', complete: true, athleteId, today: '2026-10-26', readinessRows: [
    row({ logged_date: '2026-10-25', sleep_hours: 0 }), row({ logged_date: '2026-10-26' })] }
  const snapshot = homeWeekSnapshot(data, athleteId, data.today)
  const model = buildAthleteWeek(snapshot, { enabled: true })
  assert.equal(model.from, '2026-10-19'); assert.equal(model.to, '2026-10-25')
  assert.equal(model.sleep.count, 1); assert.equal(model.sleep.average, null)
  assert.equal(model.sleep.observations[0].value, 0)
  assert.equal(model.energy.count, 1)
  assert.deepEqual(snapshot.sessions, []); assert.equal(snapshot.strength, null)
  for (const changed of [{ status: 'error' }, { status: 'loading' }, { athleteId: 'other' }, { today }, { complete: false }])
    assert.equal(homeWeekSnapshot({ ...data, ...changed }, athleteId, data.today), null)
})

test('empty or today-only histories do not qualify a weekly card; four measured days support averages', () => {
  const snapshot = readinessRows => homeWeekSnapshot({ status: 'ready', complete: true, athleteId, today, readinessRows }, athleteId, today)
  for (const rows of [[], [row({ logged_date: today })]]) assert.equal(buildAthleteWeek(snapshot(rows), { enabled: true }).status, 'empty')
  const rows = ['2026-10-31','2026-11-01','2026-11-02','2026-11-03'].map(logged_date => row({ logged_date }))
  const model = buildAthleteWeek(snapshot(rows), { enabled: true })
  assert.equal(model.sleep.average, 7); assert.equal(model.energy.average, 3)
})


test('projection independently rejects mixed ownership, duplicate dates and sparse histories', () => {
  for (const readinessRows of [[row({ athlete_id: 'other' })], [row(), row()], Array(1), [row({ logged_date: '2026-02-30' })]])
    assert.equal(homeWeekSnapshot({ status: 'ready', complete: true, athleteId, today, readinessRows }, athleteId, today), null)
})
