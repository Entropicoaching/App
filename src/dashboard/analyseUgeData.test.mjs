import test from 'node:test'
import assert from 'node:assert/strict'
import { readAnalyseWeek, analyseWeekSnapshot, startAnalyseWeek, selectAnalyseWeek, WEEK_READ_CAP } from './analyseUgeData.mjs'
import { evaluateCoachWeek } from '../entropi2/tracking/coachuge/evaluate.mjs'
import { weeklyDataBasis } from '../entropi2/tracking/kvalitet/weeklyDataBasis.mjs'

const scope = { coachId: 'synthetic-coach', athleteId: 'synthetic-athlete', asOf: '2026-11-04' }
function client(results = {}) {
  const calls = []
  return { calls, from(table) {
    const call = { table, operations: [] }; calls.push(call)
    const query = Object.fromEntries(['select', 'eq', 'gte', 'lte', 'lt', 'order', 'limit'].map(method => [method, (...args) => {
      call.operations.push([method, ...args]); return query
    }]))
    query.then = (yes, no) => Promise.resolve(results[table] ?? { data: [] }).then(yes, no)
    return query
  } }
}
const ready = data => ({ data })
test('actual scoped reader uses only whitelisted columns and bounded read operations', async () => {
  const db = client(); const batch = await readAnalyseWeek(db, scope)
  assert.equal(db.calls.length, 4)
  for (const call of db.calls) {
    assert.ok(call.operations.some(op => JSON.stringify(op) === JSON.stringify(['eq', 'athlete_id', scope.athleteId])))
    assert.deepEqual(call.operations.at(-1), ['limit', WEEK_READ_CAP])
    assert.doesNotMatch(call.operations[0][1], /\*|cycle|menstr|note|name|target/i)
  }
  assert.equal(analyseWeekSnapshot(batch).complete, true)
  assert.equal(evaluateCoachWeek({ enabled: true, data: analyseWeekSnapshot(batch) }).state, 'empty')
  const quality = weeklyDataBasis({ enabled: true, athleteId: scope.athleteId, asOf: scope.asOf, sources: batch.sources })
  assert.equal(quality.weeks[3].domains.readiness.recordedDays, 0)
})
test('real copied evaluator receives sleep/energy/stress and dated weight; unsupported evidence remains unknown', async () => {
  const rows = [1, 2, 3, 4].map(n => ({ id: n, athlete_id: scope.athleteId, logged_date: `2026-11-0${n}`, sleep_hours: 5, energy: 2, stress: 4, readiness_score: 50, cycle: 'DO NOT COPY' }))
  const batch = await readAnalyseWeek(client({ readiness_logs: ready(rows) }), scope)
  const snapshot = analyseWeekSnapshot(batch)
  assert.deepEqual(snapshot.daily[0], { day: '2026-11-01', source: 'athlete_manual', sleepHours: 5, energy: 2, stress: 4 })
  const model = evaluateCoachWeek({ enabled: true, data: snapshot })
  assert.deepEqual(model.flags.map(flag => flag.id), ['energy', 'sleepHours', 'stress'])
  for (const id of ['load', 'strength', 'nutrition', 'compliance']) assert.equal(model.sections.find(s => s.id === id).dataBasis.sampleCount, null)
  assert.doesNotMatch(JSON.stringify(batch), /DO NOT COPY/)
})
test('errors, rejected reads, caps and unrelated athletes never become complete or empty', async () => {
  for (const response of [{ error: { message: 'private error' }, data: [] }, { data: null },
    ready(Array.from({ length: WEEK_READ_CAP }, () => ({ athlete_id: scope.athleteId }))),
    ready([{ athlete_id: 'another-synthetic-athlete' }])]) {
    const batch = await readAnalyseWeek(client({ readiness_logs: response }), scope)
    assert.equal(analyseWeekSnapshot(batch).state, 'error')
    assert.notEqual(batch.sources.readiness.state, 'ready')
    assert.doesNotMatch(JSON.stringify(batch), /private error|another-synthetic/)
  }
  const throwing = { from() { throw Error('synthetic failure') } }
  assert.equal(analyseWeekSnapshot(await readAnalyseWeek(throwing, scope)).state, 'error')
})
test('unknown values and duplicate days do not manufacture a valid flag', async () => {
  for (const rows of [[{ logged_date: scope.asOf, sleep_hours: null }],
    [{ logged_date: scope.asOf, sleep_hours: 2 }, { logged_date: scope.asOf, sleep_hours: 8 }]]) {
    const batch = await readAnalyseWeek(client({ readiness_logs: ready(rows.map(row => ({ ...row, athlete_id: scope.athleteId }))) }), scope)
    assert.equal(evaluateCoachWeek({ enabled: true, data: analyseWeekSnapshot(batch) }).flags.length, 0)
  }
})
test('OFF never touches client/scope and invalid scope never queries', async () => {
  const poison = new Proxy({}, { get() { throw Error('OFF access') } })
  assert.equal(startAnalyseWeek({ enabled: false, client: poison, scope: poison }, () => {}), undefined)
  assert.equal(selectAnalyseWeek(poison, false, poison, poison, 0), null)
  const db = client()
  for (const change of [{ athleteId: '' }, { coachId: '' }, { asOf: '2026-02-30' }]) assert.equal(await readAnalyseWeek(db, { ...scope, ...change }), null)
  assert.equal(db.calls.length, 0)
})
test('selection rejects stale coach, athlete, date, client, retry and OFF before effect cleanup', () => {
  const db = client(), batch = {}, result = { client: db, attempt: 0, ...scope, batch }
  assert.equal(selectAnalyseWeek(result, true, db, scope, 0), batch)
  for (const change of [{ coachId: 'other' }, { athleteId: 'other' }, { asOf: '2026-11-05' }]) assert.equal(selectAnalyseWeek(result, true, db, { ...scope, ...change }, 0), null)
  assert.equal(selectAnalyseWeek(result, true, {}, scope, 0), null)
  assert.equal(selectAnalyseWeek(result, true, db, scope, 1), null)
})
test('cancelled asynchronous read never delivers; new read does', async () => {
  const results = [], db = client()
  const cancel = startAnalyseWeek({ enabled: true, client: db, scope, attempt: 0 }, x => results.push(x))
  cancel()
  await new Promise(resolve => setImmediate(resolve)); assert.equal(results.length, 0)
  startAnalyseWeek({ enabled: true, client: db, scope, attempt: 1 }, x => results.push(x))
  await new Promise(resolve => setImmediate(resolve)); assert.equal(results.length, 1)
  assert.equal(selectAnalyseWeek(results[0], true, db, scope, 1).athleteId, scope.athleteId)
})
