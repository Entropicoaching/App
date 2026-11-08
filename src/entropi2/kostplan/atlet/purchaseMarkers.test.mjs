import test from 'node:test'
import assert from 'node:assert/strict'
import { createApprovedShopping } from './approvedShoppingController.mjs'
import { purchaseNamespace, maxPurchaseBytes, maxPurchaseItems, openPurchaseMarkers } from './purchaseMarkers.mjs'
import { shoppingFixture, athleteId, dates, today } from './approvedShopping.fixture.mjs'

const key = `${purchaseNamespace}:${encodeURIComponent(athleteId)}`
async function saved(t) {
  let raw = null, writes = 0
  const storage = { getItem: () => raw, setItem(k, v) { assert.equal(k, key); raw = v; writes++ } }
  const make = () => {
    const c = createApprovedShopping({ enabled: true, client: shoppingFixture().client, athleteId, today, storage: () => storage })
    t.after(c.dispose); return c
  }
  const c = make(); await c.load(); c.markBought(0, true)
  return { make, original: raw, get raw() { return raw }, set raw(v) { raw = v }, get writes() { return writes } }
}

test('malformed, oversized, unknown and foreign JSON never restore markers or get rewritten', async t => {
  const f = await saved(t), valid = JSON.parse(f.original), foreignScope = JSON.parse(valid.scope)
  foreignScope[0] = 'foreign-athlete'
  const candidates = ['{', 'null', '[]', '1', '"str"', 'x'.repeat(maxPurchaseBytes + 1),
    JSON.stringify({ ...valid, namespace: 'foreign' }), JSON.stringify({ ...valid, unknown: 'text' }),
    JSON.stringify({ ...valid, __proto__: null, constructor: 'globalThis.attack()' }),
    JSON.stringify({ ...valid, bought: [0, 0] }), JSON.stringify({ ...valid, bought: [-1] }),
    JSON.stringify({ ...valid, bought: [maxPurchaseItems] }), JSON.stringify({ ...valid, bought: [5] }),
    JSON.stringify({ ...valid, bought: ['0'] }), JSON.stringify({ ...valid, bought: [null] }),
    JSON.stringify({ ...valid, bought: Array(maxPurchaseItems + 1).fill(0) }),
    JSON.stringify({ ...valid, scope: {} }), JSON.stringify({ ...valid, bought: {} }),
    JSON.stringify({ ...valid, scope: 'arbitrary text' }),
    JSON.stringify({ ...valid, scope: JSON.stringify(foreignScope) })]
  for (const raw of candidates) {
    f.raw = raw; const n = f.writes, c = f.make()
    assert.equal(await c.load(), true)
    assert.deepEqual(c.snapshot().purchases, { bought: [], persistent: false }, raw.slice(0, 70))
    c.markBought(1, true); assert.deepEqual(c.snapshot().purchases.bought, [1])
    assert.equal(f.raw, raw); assert.equal(f.writes, n)
  }
})

test('scope uses sorted dates and exact per-day portions; display names never enter storage; bounds allow full session use', async () => {
  const result = { complete: true, dates: [...dates], items: [{ key: 'ingredient', grams: '0.3', preparation: 'rå', names: ['<script>attack()</script>'] }] }
  const evidence = dates.map((date, i) => ({ date, planId: 'plan', versionId: `version-${i}`, versionNumber: i + 1,
    effectiveFrom: date, meals: [{ portions: [{ grams: .1, food: { id: 'ingredient', preparation: 'rå', source: { citation: 'source', verification: 'test' } } }] }] }))
  const options = { athleteId, today, result, evidence, storage: () => null }
  const a = openPurchaseMarkers(options), b = openPurchaseMarkers({ ...options, result: { ...result, dates: [...dates].reverse() }, evidence: [...evidence].reverse() })
  assert.equal(a.scope, b.scope); assert.ok(!a.scope.includes('attack'))
  const altered = structuredClone(evidence); altered[0].meals[0].portions[0].grams = .2
  assert.notEqual(openPurchaseMarkers({ ...options, evidence: altered }).scope, a.scope)
  let reads = 0
  const many = openPurchaseMarkers({ ...options, result: { ...result, items: Array(maxPurchaseItems + 1).fill(result.items[0]) }, storage: () => { reads++; assert.fail() } })
  assert.equal(reads, 0); assert.equal(many.snapshot().persistent, false)
  assert.equal(many.set(maxPurchaseItems, true), true); assert.deepEqual(many.snapshot().bought, [maxPurchaseItems])
})
