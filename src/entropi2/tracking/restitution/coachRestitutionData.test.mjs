import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './restitutionFixtures.mjs'
import { buildRestitution } from './restitutionModel.mjs'
import { hasRestitutionData, readCoachRestitution, selectCoachRestitution,
  startCoachRestitution, RESTITUTION_READ_CAP } from './coachRestitutionData.mjs'

const data = fixture()
const scope = { coachId: 'synthetic-coach', athleteId: data.athleteId, asOf: '2026-11-05' }
const present = { ...scope, enabled: true, readinessRows: data.readinessRows, exerciseLogs: data.exerciseLogs }
const poison = new Proxy({}, { get() { throw Error('Unexpected access') } })
function clientFor(snapshot = fixture(), overrides = {}) {
  const calls = []
  const client = { from(table) {
    calls.push(['from', table])
    const q = {}
    for (const method of ['select', 'eq', 'gte', 'lte', 'lt', 'order']) q[method] = (...args) => {
      calls.push([table, method, ...args]); return q
    }
    q.limit = async cap => {
      calls.push([table, 'limit', cap])
      return Object.hasOwn(overrides, table) ? overrides[table]
        : { data: table === 'readiness_logs' ? snapshot.readinessRows : snapshot.exerciseLogs }
    }
    return q
  } }
  return { client, calls }
}

test('presence: strict OFF never reads scope, rows, client or setter', () => {
  for (const enabled of [undefined, false, null, 1, 'true']) {
    assert.equal(hasRestitutionData({ enabled, get coachId() { assert.fail('OFF scope') } }), false)
    assert.equal(startCoachRestitution({ enabled, client: poison, scope: poison }, poison), undefined)
  }
})

test('presence: both sources for selected athlete, recent seven days and fourteen training days', () => {
  assert.equal(hasRestitutionData(present), true)
  for (const patch of [{ readinessRows: [] }, { exerciseLogs: [] }, { athleteId: 'synthetic-other' },
    { asOf: '2026-02-30' }, { coachId: '' }, { asOf: '2026-11-20' }]) {
    assert.equal(hasRestitutionData({ ...present, ...patch }), false)
  }
  for (const extra of [{ logged_date: '2026-10-28' }, { logged_date: '2026-11-05' },
    { _optimistic: true }, { athlete_id: 'synthetic-other' }, { logged_date: '2026-02-30' }]) {
    assert.equal(hasRestitutionData({ ...present, readinessRows: [{ ...data.readinessRows[0], ...extra }] }), false)
  }
  for (const extra of [{ logged_at: '2026-10-21' }, { logged_at: '2026-11-05' },
    { _optimistic: true }, { skipped: true }, { athlete_id: 'synthetic-other' }, { logged_at: 'invalid' }]) {
    assert.equal(hasRestitutionData({ ...present, exerciseLogs: [{ ...data.exerciseLogs[0], ...extra }] }), false)
  }
  for (const logged_at of ['2026-10-22', '2026-11-04T22:59:59Z'])
    assert.equal(hasRestitutionData({ ...present, exerciseLogs: [{ ...data.exerciseLogs[0], logged_at }] }), true)
  assert.equal(hasRestitutionData({ ...present, exerciseLogs: [{ ...data.exerciseLogs[0], logged_at: '2026-11-04T23:00:00Z' }] }), false)
})

test('presence accepts zero sleep or independently entered wellbeing, never legacy scores', () => {
  const check = extra => hasRestitutionData({ ...present, readinessRows: [{
    athlete_id: scope.athleteId, logged_date: '2026-11-04', ...extra,
  }] })
  for (const extra of [{ sleep_hours: 0 }, { energy: 4 }, { stress: 2 }, { soreness_level: 3 }]) assert.equal(check(extra), true)
  for (const extra of [{ score: 5 }, { sleep_quality: 5 }, { sleep_hours: '8' }, { energy: 0 },
    { sleep_hours: Infinity }, { stress: 1.5 }, { soreness_level: 6 }]) assert.equal(check(extra), false)
})

test('actual read imports model, requests only two scoped existing sources, exact DST bounds and fields', async () => {
  const { client, calls } = clientFor()
  const snapshot = await readCoachRestitution(client, scope)
  assert.equal(buildRestitution(snapshot, { enabled: true }).level, 'god')
  assert.equal(snapshot.endDate, '2026-11-04'); assert.equal(snapshot.complete, true)
  assert.deepEqual(calls, [
    ['from', 'readiness_logs'],
    ['readiness_logs', 'select', 'athlete_id, logged_date, sleep_hours, energy, stress, soreness_level'],
    ['readiness_logs', 'eq', 'athlete_id', scope.athleteId],
    ['readiness_logs', 'gte', 'logged_date', '2026-10-22'], ['readiness_logs', 'lte', 'logged_date', '2026-11-04'],
    ['readiness_logs', 'order', 'logged_date'], ['readiness_logs', 'limit', RESTITUTION_READ_CAP],
    ['from', 'exercise_logs'],
    ['exercise_logs', 'select', 'athlete_id, id, exercise_id, set_number, logged_at, weight, reps_completed, skipped'],
    ['exercise_logs', 'eq', 'athlete_id', scope.athleteId],
    ['exercise_logs', 'gte', 'logged_at', '2026-10-21T00:00:00Z'], ['exercise_logs', 'lt', 'logged_at', '2026-11-05T00:00:00Z'],
    ['exercise_logs', 'order', 'logged_at'], ['exercise_logs', 'limit', RESTITUTION_READ_CAP],
  ])
})

test('privacy: projection reads no notes, cycle, planned sets or RPE; numeric IDs remain usable', async () => {
  const source = fixture()
  source.exerciseLogs.forEach((row, i) => { row.id = i + 1 })
  for (const row of [...source.readinessRows, ...source.exerciseLogs])
    Object.defineProperty(row, 'private_note', { get() { assert.fail('Private field read') } })
  const before = JSON.stringify(source)
  const snapshot = await readCoachRestitution(clientFor(source).client, scope)
  assert.equal(snapshot.exerciseLogs[0].id, '1')
  assert.equal(buildRestitution(snapshot, { enabled: true }).level, 'god')
  assert.equal(JSON.stringify(source), before)
  assert.doesNotMatch(JSON.stringify(snapshot), /private_note|menstruation|rpe|readiness_score|sleep_quality/)
})

test('either failed, capped or malformed source fails closed, never produces partial evidence', async () => {
  for (const table of ['readiness_logs', 'exercise_logs']) {
    for (const response of [null, { error: {} }, { data: null }, { data: {} }, { data: [null] },
      { data: Array(RESTITUTION_READ_CAP).fill(table === 'readiness_logs' ? data.readinessRows[0] : data.exerciseLogs[0]) },
      { data: [{ ...(table === 'readiness_logs' ? data.readinessRows[0] : data.exerciseLogs[0]), athlete_id: 'synthetic-other' }] }]) {
      assert.deepEqual(await readCoachRestitution(clientFor(data, { [table]: response }).client, scope), { status: 'error' })
    }
  }
  assert.deepEqual(await readCoachRestitution({ from() { throw Error('synthetic-hidden') } }, scope), { status: 'error' })
  for (const s of [null, {}, { ...scope, asOf: 'invalid' }, { ...scope, athleteId: '' }])
    assert.deepEqual(await readCoachRestitution(poison, s), { status: 'error' })
})

test('successful empty, duplicate readiness and invalid timestamp are distinguished', async () => {
  const empty = await readCoachRestitution(clientFor({ readinessRows: [], exerciseLogs: [] }).client, scope)
  assert.equal(empty.status, 'ready'); assert.equal(buildRestitution(empty, { enabled: true }).status, 'insufficient')
  const duplicate = fixture(); duplicate.readinessRows.push({ ...duplicate.readinessRows[0] })
  assert.deepEqual(await readCoachRestitution(clientFor(duplicate).client, scope), { status: 'error' })
  const invalid = fixture(); invalid.exerciseLogs[0].logged_at = '2026-11-01T12:00:00'
  assert.deepEqual(await readCoachRestitution(clientFor(invalid).client, scope), { status: 'error' })
})

test('synchronous guard invalidates client, coach, athlete, day and retry before effect cleanup', () => {
  const client = {}, snapshot = { status: 'error' }, result = { client, ...scope, attempt: 0, snapshot }
  assert.equal(selectCoachRestitution(result, client, scope, 0), snapshot)
  for (const key of ['coachId', 'athleteId', 'asOf'])
    assert.equal(selectCoachRestitution(result, client, { ...scope, [key]: 'synthetic-other' }, 0), null)
  assert.equal(selectCoachRestitution(result, {}, scope, 0), null)
  assert.equal(selectCoachRestitution(result, client, scope, 1), null)
  assert.equal(selectCoachRestitution(null, client, scope, 0), null)
})

test('effect helper publishes only current results; cancelled success and rejection cannot publish', async () => {
  const updates = [], { client } = clientFor()
  const stop = startCoachRestitution({ enabled: true, client, scope, attempt: 0 }, value => updates.push(value))
  stop(); await new Promise(resolve => setImmediate(resolve)); assert.equal(updates.length, 0)
  startCoachRestitution({ enabled: true, client, scope, attempt: 2 }, value => updates.push(value))
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(updates.length, 1); assert.equal(updates[0].attempt, 2); assert.equal(updates[0].snapshot.status, 'ready')
})
