import test from 'node:test'
import assert from 'node:assert/strict'
import { createPlanAdapter } from './planAdapter.mjs'
import { historyFixture, athleteId, date, uuid } from './dailyReference.fixture.mjs'
import { tableNames } from './coach/activation.fixture.mjs'

const open = f => createPlanAdapter({ enabled: true, client: f.client, athleteId, date })
function ready() {
  const f = historyFixture(); f.plan(); f.version(); f.approve(); return f
}

test('active contract: approvals probe rejects unknown id even at limit zero and projects only real columns', async () => {
  const f = ready()
  assert.equal((await f.client.from(tableNames[2]).select('id').limit(0)).error.code, '42703')
  assert.equal((await f.client.from(tableNames[2]).select('version_id').eq('id', uuid(10)).limit(0)).error.code, '42703')
  assert.deepEqual((await f.client.from(tableNames[2]).select('version_id').limit(1)).data, [{ version_id: uuid(10) }])
  const plan = await open(f).loadActive()
  assert.equal(plan.revision, uuid(10))
  assert.equal(plan.targets.carb, 0)
  assert.equal(plan.targets.fat, null)
  const probes = f.calls.filter(c => c.limit === 0).slice(-3)
  assert.deepEqual(probes.map(c => c.columns), ['id', 'id', 'version_id'])
  assert.ok(f.calls.filter(c => c.table === tableNames[2]).slice(3).every(c => !c.columns.split(',').includes('id')))
  assert.equal(f.writes().length, 0)
})

test('active contract: effective date then exact microseconds resolve corrections independently of row order', async () => {
  for (const reverse of [false, true]) {
    const f = ready()
    f.plan(2); f.version(11, uuid(2), '2026-11-01', 1, 137, 0)
    f.approve(11, uuid(2), '2026-11-01T10:00:00.000002Z')
    if (reverse) for (const table of tableNames) f.data[table].reverse()
    assert.equal((await open(f).loadActive()).revision, uuid(11))
    f.version(12, uuid(2), '2026-11-04', 2, 211, 0)
    f.approve(12, uuid(2), '2026-11-04T10:00:00.000001Z')
    assert.equal((await open(f).loadActive()).revision, uuid(12))
  }
})

test('active contract: equal-time approvals fail closed within a plan and across replacement plans in either order', async () => {
  for (const samePlan of [false, true]) for (const reverse of [false, true]) {
    const f = ready(), parent = samePlan ? uuid(1) : uuid(2)
    if (!samePlan) f.plan(2)
    f.version(11, parent, '2026-11-01', samePlan ? 2 : 1, 137, 0)
    f.approve(11, parent, '2026-11-01T11:00:00.000001+01:00')
    if (reverse) for (const table of tableNames) f.data[table].reverse()
    await assert.rejects(open(f).loadActive())
  }
})

test('active contract: future approvals use Copenhagen calendar dates and cannot hide the current reference', async () => {
  const f = ready()
  f.version(11, uuid(1), '2026-11-04', 2, 137, 0)
  const a = f.approve(11, uuid(1), '2026-11-07T23:30:00Z') // November 8 in Copenhagen
  assert.equal((await open(f).loadActive()).revision, uuid(10))
  a.approved_at = '2026-11-07T22:59:59.999999Z'
  assert.equal((await open(f).loadActive()).revision, uuid(11))
})

test('active contract: duplicate keys and invalid version, parent, owner and timestamp contexts are rejected', async () => {
  for (const table of tableNames) {
    const f = ready(); f.data[table].push(structuredClone(f.data[table][0]))
    await assert.rejects(open(f).loadActive())
  }
  for (const mutate of [
    f => { f.data[tableNames[1]][0].effective_from = '2026-10-31' },
    f => { f.data[tableNames[1]][0].version_no = 0 },
    f => { f.data[tableNames[2]][0].plan_id = uuid(999) },
    f => { f.data[tableNames[2]][0].approved_at = '2026-11-01T25:00:00Z' },
    f => { f.data[tableNames[2]][0].approval_kind = 'invented' },
    f => { const v = structuredClone(f.data[tableNames[1]][0]); v.id = uuid(99); f.data[tableNames[1]].push(v) },
  ]) {
    const f = ready(); mutate(f); await assert.rejects(open(f).loadActive()); assert.equal(f.writes().length, 0)
  }
  const f = ready()
  f.options.response = (call, rows) => call.table === tableNames[2] && call.limit !== 0
    ? { data: rows.map(row => ({ ...row, athlete_id: 'foreign' })), error: null } : undefined
  await assert.rejects(open(f).loadActive())
})

test('active contract: unavailable, empty, failed and crossed archive reads never fabricate a plan', async () => {
  assert.equal(await open(historyFixture()).loadActive(), null)
  assert.equal(await open(historyFixture({ missing: true })).loadActive(), null)
  await assert.rejects(open(historyFixture({ error: '42501' })).loadActive())
  const f = ready(); let reads = 0
  f.options.before = call => {
    if (call.table === tableNames[0] && call.limit !== 0 && ++reads === 2) f.data[tableNames[0]][0].status = 'arkiveret'
  }
  await assert.rejects(open(f).loadActive())
  assert.equal(f.writes().length, 0)
})
