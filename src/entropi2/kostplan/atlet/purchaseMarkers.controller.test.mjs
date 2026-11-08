import test from 'node:test'
import assert from 'node:assert/strict'
import { createApprovedShopping } from './approvedShoppingController.mjs'
import { formatApprovedShopping } from './approvedShoppingModel.mjs'
import { purchaseNamespace, maxPurchaseBytes } from './purchaseMarkers.mjs'
import { shoppingFixture, athleteId, dates, today, tableNames, gate, uuid } from './approvedShopping.fixture.mjs'

const memory = () => {
  const data = new Map([['unrelated', 'keep'], ['entropi2:kostplan:atlet:v1:tracker-draft', 'keep']]), writes = [], reads = []
  return { data, writes, reads, getItem(k) { reads.push(k); return data.get(k) ?? null }, setItem(k, v) { writes.push(k); data.set(k, v) } }
}
const open = (f, s, extra = {}) => createApprovedShopping({ enabled: true, client: f.client, athleteId, today, storage: () => s, ...extra })

test('purchase markers persist/reopen without modifying gross decimals, copies, plans, logs or other storage', async t => {
  const f = shoppingFixture(), storage = memory(), before = JSON.stringify(f.data)
  const c = open(f, storage); t.after(c.dispose); await c.load()
  const original = c.snapshot().result, copy = formatApprovedShopping(original)
  assert.deepEqual(c.snapshot().purchases.bought, [])
  assert.equal(storage.writes.length, 0)
  assert.equal(c.markBought(0, true, original), true)
  assert.equal(c.markBought(2, true, original), true)
  assert.equal(c.markBought(0, false, original), true)
  assert.strictEqual(c.snapshot().result, original)
  assert.deepEqual(c.snapshot().purchases.bought, [2])
  let copied; await c.copy({ writeText: text => { copied = text } }); assert.equal(copied, copy)
  await c.copy(null); assert.equal(c.snapshot().copyText, copy)
  const reopened = open(f, storage); t.after(reopened.dispose); await reopened.load()
  assert.deepEqual(reopened.snapshot().purchases.bought, [2])
  assert.equal(JSON.stringify(f.data), before); assert.equal(f.writes().length, 0)
  assert.ok(storage.writes.every(k => k === `${purchaseNamespace}:${encodeURIComponent(athleteId)}`))
  assert.equal(storage.data.get('unrelated'), 'keep'); assert.equal(storage.data.get('entropi2:kostplan:atlet:v1:tracker-draft'), 'keep')
  assert.ok([...storage.data.values()].every(raw => raw.length < maxPurchaseBytes))
  assert.equal([...storage.data.values()].some(raw => raw.includes('Linser')), false, 'no display names persisted')
})

for (const kind of ['date', 'version', 'plan', 'grams', 'preparation', 'source', 'athlete', 'today'])
  test(`exact evidence isolation: ${kind}`, async t => {
    const f = shoppingFixture(), storage = memory(), c = open(f, storage); t.after(c.dispose)
    await c.load(); c.markBought(0, true)
    const extra = {}, v = f.data[tableNames[1]][0]
    if (kind === 'date') extra.dates = dates.slice(0, 2)
    if (kind === 'version') {
      const old = v.id; v.id = uuid(79000)
      for (const a of f.data[tableNames[2]]) if (a.version_id === old) a.version_id = v.id
    }
    if (kind === 'plan') {
      const old = v.plan_id, id = uuid(79001)
      f.data[tableNames[0]].find(p => p.id === old).id = id
      for (const row of f.data[tableNames[1]]) if (row.plan_id === old) row.plan_id = id
      for (const row of f.data[tableNames[2]]) if (row.plan_id === old) row.plan_id = id
    }
    if (kind === 'grams') v.meals[0].portions[0].grams = .12345
    if (kind === 'preparation') v.meals[0].portions[0].food.preparation = 'ny tilberedning'
    if (kind === 'source') v.meals[0].portions[0].food.source.citation = 'ændret kilde'
    if (kind === 'athlete') {
      extra.athleteId = 'synthetic-other'
      for (const table of [tableNames[0], tableNames[2]]) for (const row of f.data[table]) row.athlete_id = extra.athleteId
    }
    if (kind === 'today') { extra.today = dates[0]; extra.dates = dates }
    const changed = open(f, storage, extra); t.after(changed.dispose)
    assert.equal(await changed.load(), true)
    assert.deepEqual(changed.snapshot().purchases.bought, [])
  })

test('storage is deferred until all approved access; incomplete/empty/loading/stale/disposed/current-day events cannot mark', async t => {
  const f = shoppingFixture(), storage = memory(), g = gate(); let current = true, blocked = false
  const c = open(f, storage, { isCurrent: () => current }); t.after(c.dispose)
  assert.equal(c.markBought(0, true), false); assert.equal(storage.reads.length, 0)
  f.options.before = async call => { if (call.limit === 2 && !blocked) { blocked = true; await g.promise } }
  const old = c.load(); while (!blocked) await new Promise(r => setImmediate(r))
  assert.equal(storage.reads.length, 0); assert.equal(c.snapshot().purchases, null)
  await c.choose([dates[2]]); c.markBought(0, true)
  const latest = c.snapshot(); g.resolve(); assert.equal(await old, false); assert.strictEqual(c.snapshot(), latest)
  const evidence = latest.result
  await c.load(); assert.equal(c.markBought(0, false, evidence), false)
  assert.deepEqual(c.snapshot().purchases.bought, [0])
  f.options.error = '42501'; await c.load()
  assert.equal(c.snapshot().purchases, null); assert.equal(c.markBought(0, true), false)
  f.options.error = null; await c.load(); assert.deepEqual(c.snapshot().purchases.bought, [0])
  await c.choose([]); assert.equal(c.snapshot().purchases, null); assert.equal(c.markBought(0, true), false)
  await c.choose([dates[2]]); current = false
  const n = storage.writes.length; assert.equal(c.markBought(0, false), false); assert.equal(storage.writes.length, n)
  c.dispose(); assert.equal(c.markBought(0, true), false)
})

for (const kind of ['read-denied', 'quota', 'silent-drop', 'missing'])
  test(`storage ${kind}: full list and session checkmarks remain usable with honest status`, async t => {
    const f = shoppingFixture(), s = memory()
    if (kind === 'read-denied') s.getItem = () => { throw Error('denied') }
    if (kind === 'quota') s.setItem = () => { throw Error('quota') }
    if (kind === 'silent-drop') s.setItem = () => {}
    const c = open(f, kind === 'missing' ? null : s); t.after(c.dispose)
    assert.equal(await c.load(), true); assert.equal(c.snapshot().result.items.length, 5)
    c.markBought(0, true); assert.deepEqual(c.snapshot().purchases.bought, [0]); assert.equal(c.snapshot().purchases.persistent, false)
    await c.load(); assert.deepEqual(c.snapshot().purchases.bought, [0]); assert.equal(c.snapshot().purchases.persistent, false)
    c.markBought(1, true); c.markBought(0, false); assert.deepEqual(c.snapshot().purchases.bought, [1])
    assert.equal(f.writes().length, 0)
  })

test('OFF/readOnly/missing identity never resolve storage; invalid marker actions are inert', async t => {
  const storage = () => { assert.fail('storage must be untouched') }
  assert.equal(createApprovedShopping({ enabled: false, storage }), null)
  assert.equal(createApprovedShopping({ enabled: true, readOnly: true, storage }), null)
  assert.throws(() => open(shoppingFixture(), null, { athleteId: '' }))
  const c = open(shoppingFixture(), memory()); t.after(c.dispose); await c.load()
  for (const index of [-1, .5, NaN, '0', 5, {}, '__proto__']) assert.equal(c.markBought(index, true), false)
  assert.equal(c.markBought(0, 'true'), false)
})
