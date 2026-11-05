import test from 'node:test'
import assert from 'node:assert/strict'
import { createPlanAdapter } from './planAdapter.mjs'
import { syntheticTables, tableNames, flush } from './coach/activation.fixture.mjs'

const open = client => createPlanAdapter({ enabled: true, athleteId: 'synthetic-retry', date: '2026-11-05', client })

test('rejected schema result is evicted at every probe position; same adapter can retry', async () => {
  for (const table of tableNames) for (const code of ['42501', 'PGRST301', 'XX000']) {
    let failed = false
    const f = syntheticTables({ response(call, rows) {
      if (!failed && call.table === table && call.limit === 0) { failed = true; return { data: null, error: { code } } }
      return { data: rows, error: null }
    } })
    const adapter = open(f.client)
    await assert.rejects(adapter.loadActive())
    assert.equal(await adapter.loadActive(), null)
    const probes = f.calls.filter(c => c.limit === 0).length
    assert.equal(probes, tableNames.indexOf(table) + 1 + 3)
    assert.equal(await open(f.client).loadActive(), null)
    assert.equal(f.calls.filter(c => c.limit === 0).length, probes)
    assert.equal(f.writes().length, 0)
  }
})

test('synchronous transport failure can recover on the same client', async () => {
  const f = syntheticTables()
  let offline = true
  const client = { from(table) { if (offline) throw Error('synthetic offline'); return f.client.from(table) } }
  const adapter = open(client)
  await assert.rejects(adapter.loadActive(), /offline/)
  offline = false
  assert.equal(await adapter.loadActive(), null)
  assert.equal(f.calls.filter(c => c.limit === 0).length, 3)
  assert.equal(f.writes().length, 0)
})

test('overlapping loads share one rejection and one fresh successful probe', async () => {
  let release, first = true
  const gate = new Promise(resolve => { release = resolve })
  const f = syntheticTables({ async before(call) {
    if (first && call.limit === 0) { await gate; first = false; throw Error('synthetic lost response') }
  } })
  const pending = [open(f.client).loadActive(), open(f.client).loadActive()]
  const settled = Promise.allSettled(pending)
  await flush(); assert.equal(f.calls.length, 1)
  release()
  assert.deepEqual((await settled).map(r => r.status), ['rejected', 'rejected'])
  assert.deepEqual(await Promise.all([open(f.client).loadActive(), open(f.client).loadActive()]), [null, null])
  assert.equal(f.calls.filter(c => c.limit === 0).length, 4)
  assert.equal(f.writes().length, 0)
})

test('a failed active-plan read does not poison confirmed schema capability', async () => {
  let offline = true
  const f = syntheticTables({ before(call) {
    if (offline && call.limit !== 0) throw Error('synthetic plan read failure')
  } })
  const adapter = open(f.client)
  await assert.rejects(adapter.loadActive())
  offline = false
  assert.equal(await adapter.loadActive(), null)
  assert.equal(f.calls.filter(c => c.limit === 0).length, 3)
  assert.equal(f.writes().length, 0)
})

test('exact missing-table results remain cached independently per client', async () => {
  for (const missingCode of ['42P01', 'PGRST205']) {
    const first = syntheticTables({ missing: tableNames[1], missingCode })
    const second = syntheticTables()
    assert.equal(await open(first.client).loadActive(), null)
    assert.equal(await open(first.client).loadActive(), null)
    assert.equal(first.calls.length, 2)
    assert.equal(await open(second.client).loadActive(), null)
    assert.equal(second.calls.filter(c => c.limit === 0).length, 3)
    assert.equal(first.writes().length + second.writes().length, 0)
  }
})
