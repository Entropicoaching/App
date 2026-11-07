// Independent synthetic stimuli against actual copied adapter/day/shopping owners.
import test from 'node:test'
import assert from 'node:assert/strict'
import * as adapter from './planAdapter.mjs'
import { createKostDaySession } from './atlet/daySession.mjs'
import { createApprovedShopping } from './atlet/approvedShoppingController.mjs'
import { fixture, athleteId, date, flush } from './atlet/daySession.fixture.mjs'
import { syntheticTables, tableNames } from './coach/activation.fixture.mjs'

// Baseline has no coalescing boundary: use the original client to expose the
// duplicate transport. This fallback still fails the unchanged count oracle.
const shared = client => adapter.sharePlanCapabilityProbes?.(client) ?? client
const open = (client, extra = {}) => adapter.createPlanAdapter({ enabled: true, athleteId, date, client, ...extra })
const probes = f => f.calls.filter(c => c.limit === 0)

test('actual concurrent day facade and shopping: three schema reads, live independent plan reads, fresh next day load', async t => {
  let release
  const gate = new Promise(resolve => { release = resolve })
  const f = fixture({ before: call => call.limit === 0 ? gate : undefined }); f.approve()
  const client = shared(f.client)
  const day = createKostDaySession({ enabled: true, athleteId, date, client, storage: f.storage })
  const shopping = createApprovedShopping({ enabled: true, athleteId, today: date, client })
  t.after(() => { release(); day.dispose(); shopping.dispose() })
  const pending = Promise.all([shopping.load(), day.controller.load()])
  await flush(); release(); await pending
  assert.equal(probes(f.plan).length, 3)
  assert.equal(shopping.snapshot().complete, true)
  assert.equal(day.controller.snapshot().mode, 'plan')
  assert.deepEqual(probes(f.plan).map(c => [c.table, c.columns]), tableNames.map((table, i) => [table, i === 2 ? 'version_id' : 'id']))
  const reads = f.plan.calls.filter(c => c.limit !== 0).length
  await day.controller.load()
  assert.equal(probes(f.plan).length, 6)
  assert.ok(f.plan.calls.filter(c => c.limit !== 0).length > reads)
  assert.equal(f.plan.writes().length, 0)
})

test('coalescing is pending-only: table errors, throwing transport, missing schema, explicit retry and new client stay fresh', async () => {
  for (const mode of ['error', 'throw', 'missing']) {
    let broken = true
    const f = syntheticTables({ before(call) {
      if (broken && mode === 'throw' && call.limit === 0) throw Error('independent transport failure')
    }, response(call, rows) {
      return broken && call.limit === 0 ? { data: null, error: { code: mode === 'missing' ? '42P01' : '42501' } } : { data: rows, error: null }
    } })
    const client = shared(f.client), a = open(client)
    const first = await Promise.allSettled([a.loadActive({ requireAvailable: true }), open(client).loadActive({ requireAvailable: true })])
    assert.deepEqual(first.map(r => r.status), ['rejected', 'rejected'])
    assert.equal(probes(f).length, 1)
    broken = false
    assert.equal(await a.loadActive({ requireAvailable: true, freshAvailability: true }), null)
    assert.equal(probes(f).length, 4)
    assert.equal(await a.loadActive({ freshAvailability: true }), null)
    assert.equal(probes(f).length, 7)
    const other = syntheticTables()
    assert.equal(await open(shared(other.client)).loadActive(), null)
    assert.equal(probes(other).length, 3)
    const beforeCoach = probes(f).length
    assert.equal(await a.available(), true)
    assert.equal(probes(f).length, beforeCoach + 3)
    assert.equal(f.writes().length, 0)
  }
})

test('sharing never caches date/athlete/version data or writes and preserves transport receivers', async () => {
  const f = fixture(); f.approve(); const original = f.client
  const client = shared(original)
  const first = await open(client).loadActive()
  assert.equal(first.date, date)
  assert.equal(await open(client, { athleteId: 'independent-other' }).loadActive(), null)
  f.plan.data[tableNames[1]][0].meals = structuredClone(f.plan.data[tableNames[1]][0].meals)
  f.plan.data[tableNames[1]][0].meals[0].name = 'Ny serverversion æøå'
  const second = await open(client, { date: '2026-11-06' }).loadActive()
  assert.equal(second.date, '2026-11-06')
  assert.equal(second.meals[0].name, 'Ny serverversion æøå')
  f.plan.data[tableNames[0]][0].status = 'arkiveret'
  assert.equal(await open(client).loadActive(), null)
  assert.equal(f.plan.writes().length, 0)
  const empty = syntheticTables()
  const transport = { value: 17, rpc() { assert.equal(this, transport); return this.value }, from(table) { assert.equal(this, transport); return empty.client.from(table) } }
  Object.freeze(transport)
  assert.equal(shared(transport).rpc(), 17)
  assert.equal(await open(shared(transport)).loadActive(), null)
})
