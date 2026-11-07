import test from 'node:test'
import assert from 'node:assert/strict'
import { createMealTemplates } from '../skabeloner/model.mjs'
import { ingredientKey } from '../indkoeb/ingredients.mjs'
import { createWeekPlan } from './model.mjs'

function maximum(char = '"', unit = 'g') {
  return { name: 'Valid maximum metadata', quantity: 10, unit,
    foodId: char.repeat(1000), preparation: char.repeat(1000),
    source: { citation: char.repeat(2000), verification: char.repeat(1000) } }
}
function fixture(ingredients = [maximum()]) {
  const data = new Map(), writes = []
  const storage = { getItem: key => data.get(key) ?? null,
    setItem(key, raw) { writes.push([key, raw]); data.set(key, raw) } }
  const options = { enabled: true, athleteId: 'synthetic:stock-roundtrip', date: '2026-11-05', storage }
  const rows = ['a', 'b', 'c'].map(id => ({ id, athlete_id: options.athleteId, date: options.date,
    meal: 'Synthetic escaped recipe', kcal: 400, protein: 20, carb: 60, fat: 10, ingredients }))
  const library = createMealTemplates({ ...options, rows })
  const id = library.snapshot().suggestions[0].id
  assert.equal(library.accept(id), true)
  const open = (extra = {}) => createWeekPlan({ ...options, templates: library.snapshot().templates, ...extra })
  const plan = open()
  assert.equal(plan.add(0, id), true)
  const weekKey = writes.at(-1)[0]
  return { data, writes, storage, library, id, plan, open, weekKey }
}
const line = plan => plan.snapshot().shopping.items[0]

test('P2 exact review case: 10050-character stock key survives reopening and quantity/portion changes', () => {
  const f = fixture(), key = ingredientKey(line(f.plan))
  assert.equal(key.length, 10050)
  assert.equal(f.plan.confirmStock(key, 1), true)
  const bytes = [...f.data], count = f.writes.length
  let reopened = f.open()
  assert.equal(reopened.snapshot().readFailed, false)
  assert.equal(reopened.snapshot().days[0].entries[0].templateId, f.id)
  assert.deepEqual([line(reopened).quantity, line(reopened).confirmedStock, line(reopened).netPurchase], [10, 1, 9])
  reopened.snapshot(); f.open().snapshot()
  assert.deepEqual([...f.data], bytes)
  assert.equal(f.writes.length, count)
  assert.equal(reopened.confirmStock(key, '25'), true)
  reopened = f.open()
  assert.equal(line(reopened).confirmedStock, 25)
  assert.equal(line(reopened).netPurchase, 0)
  assert.equal(reopened.setPortions(0, 0, '3'), true)
  reopened = f.open()
  assert.equal(line(reopened).confirmedStock, 25)
  assert.equal(line(reopened).netPurchase, 5)
  assert.equal(reopened.confirmStock(key, '0'), true)
  reopened = f.open()
  assert.equal(line(reopened).confirmedStock, 0)
  assert.equal(line(reopened).netPurchase, 30)
  assert.equal(JSON.parse(f.data.get(f.weekKey)).stock[0].key, key)
})

for (const [label, ingredients, expected] of [
  ['quotes and maximum unit', [maximum('"', '"'.repeat(40))], 10129],
  ['backslashes', [maximum('\\', '\\'.repeat(40))], 10129],
  ['lone high surrogates (six-character JSON escapes)', [maximum('\ud800', '\ud800'.repeat(40))], 30289],
  ['lone low surrogates', [maximum('\udfff', '\udfff'.repeat(40))], 30289],
  ['string source and name fallback', [{ ...maximum('\\'), foodId: undefined, name: '"'.repeat(200), source: '\\'.repeat(2000) }]],
  ['paired Unicode and normalization', [{ ...maximum('ø'), name: 'A\u030a', preparation: '🍲'.repeat(500) }]],
]) {
  test(`P2 escaped metadata roundtrip: ${label}`, () => {
    const f = fixture(ingredients), key = ingredientKey(line(f.plan))
    if (expected !== undefined) assert.equal(key.length, expected)
    assert.equal(f.plan.confirmStock(key, 4), true)
    const saved = [...f.data], count = f.writes.length, reopened = f.open()
    assert.equal(reopened.snapshot().readFailed, false)
    assert.equal(ingredientKey(line(reopened)), key)
    assert.equal(line(reopened).confirmedStock, 4)
    assert.equal(line(reopened).netPurchase, 6)
    assert.deepEqual([...f.data], saved)
    assert.equal(f.writes.length, count)
    assert.equal(reopened.confirmStock(key, 6), true)
    assert.equal(line(f.open()).confirmedStock, 6)
    assert.equal(line(f.open()).netPurchase, 4)
  })
}

test('P2 prior accepted stock bytes reopen without migration; legacy keys survive later explicit edits', () => {
  const f = fixture(), key = ingredientKey(line(f.plan))
  const prior = { version: 1, week: '2026-11-02', days: [[f.id], [], [], [], [], [], []],
    stock: [{ key: 'legacy opaque key', quantity: 7, confirmed: true }, { key, quantity: 2, confirmed: true }] }
  const raw = JSON.stringify(prior, null, 2)
  f.data.set(f.weekKey, raw)
  f.data.set('synthetic:unrelated', 'preserve these bytes')
  const before = [...f.data], count = f.writes.length, reopened = f.open()
  assert.equal(reopened.snapshot().readFailed, false)
  assert.equal(line(reopened).confirmedStock, 2)
  assert.deepEqual([...f.data], before)
  assert.equal(f.writes.length, count)
  assert.equal(reopened.confirmStock(key, 3), true)
  assert.deepEqual(JSON.parse(f.data.get(f.weekKey)).stock,
    [prior.stock[0], { key, quantity: 3, confirmed: true }])
  assert.equal(f.data.get('synthetic:unrelated'), 'preserve these bytes')
  for (const extra of [{ athleteId: 'synthetic:other' }, { date: '2026-11-09' }]) {
    assert.equal(f.open(extra).snapshot().shopping.items.length, 0)
  }
})

test('P2 malformed stored stock and unrelated guards fail closed without overwriting any bytes', () => {
  const f = fixture(), key = ingredientKey(line(f.plan)), valid = JSON.parse(f.data.get(f.weekKey))
  const row = { key, quantity: 1, confirmed: true }
  const changes = [
    ...[null, 1, true, {}, [], '', ' ', 'x'.repeat(30290)].map(key => ({ stock: [{ ...row, key }] })),
    ...[null, '1', -1, true, {}, []].map(quantity => ({ stock: [{ ...row, quantity }] })),
    ...[false, 1, 'true', null].map(confirmed => ({ stock: [{ ...row, confirmed }] })),
    { stock: [row, row] }, { stock: null }, { stock: {} }, { stock: [null] },
    { stock: Array.from({ length: 501 }, (_, i) => ({ ...row, key: `legacy:${i}` })) },
    { version: 2 }, { week: '2026-11-09' },
    { days: [['x'.repeat(10001)], [], [], [], [], [], []] },
    { portions: [[0], [], [], [], [], [], []] },
    { portions: [['2'], [], [], [], [], [], []] },
  ]
  const raws = changes.map(change => JSON.stringify({ ...valid, ...change }))
  raws.push(JSON.stringify({ ...valid, stock: [row] }).replace('"quantity":1', '"quantity":1e400'))
  raws.push(' '.repeat(250001))
  for (const raw of raws) {
    f.data.set(f.weekKey, raw)
    const count = f.writes.length, plan = f.open()
    assert.equal(plan.snapshot().readFailed, true)
    assert.equal(plan.add(1, f.id), false)
    assert.equal(plan.remove(0, 0), false)
    assert.equal(plan.setPortions(0, 0, 2), false)
    assert.equal(plan.confirmStock(key, 2), false)
    assert.equal(f.writes.length, count)
    assert.equal(f.data.get(f.weekKey), raw)
  }
})

test('P2 invalid confirmations and oversized metadata retain the last accepted stock and all saved bytes', () => {
  const f = fixture(), key = ingredientKey(line(f.plan))
  assert.equal(f.plan.confirmStock(key, 3), true)
  const bytes = [...f.data], count = f.writes.length
  for (const value of [undefined, null, '', -1, Infinity, NaN, true, '1e3', '4g', {}, []]) {
    assert.equal(f.plan.confirmStock(key, value), false)
  }
  for (const badKey of [null, {}, '', 'foreign', key + 'x', 'x'.repeat(30290)]) {
    assert.equal(f.plan.confirmStock(badKey, 1), false)
  }
  for (const patch of [{ foodId: 'x'.repeat(1001) }, { preparation: 'x'.repeat(1001) },
    { unit: 'x'.repeat(41) }, { source: { citation: 'x'.repeat(2001), verification: 'ok' } },
    { source: { citation: 'ok', verification: 'x'.repeat(1001) } }]) {
    assert.equal(f.library.setIngredients(f.id, [{ ...maximum(), ...patch }]), false)
  }
  assert.deepEqual([...f.data], bytes)
  assert.equal(f.writes.length, count)
  assert.equal(line(f.open()).confirmedStock, 3)
})

test('P2 aggregate payload limit still rejects an oversized write atomically', () => {
  const ingredients = Array.from({ length: 8 }, (_, i) => ({ ...maximum('\ud800', '\ud800'.repeat(40)),
    foodId: '\ud800'.repeat(999) + i }))
  const f = fixture(ingredients)
  let failures = 0
  for (const item of f.plan.snapshot().shopping.items) {
    const before = [...f.data], state = f.plan.snapshot().shopping, count = f.writes.length
    if (!f.plan.confirmStock(ingredientKey(item), 2)) {
      failures++
      assert.deepEqual([...f.data], before)
      assert.equal(f.writes.length, count)
      assert.deepEqual(f.plan.snapshot().shopping, state)
    }
    assert.equal(f.open().snapshot().readFailed, false)
    assert.ok(f.data.get(f.weekKey).length <= 250000)
  }
  assert.ok(failures > 0, 'oversized aggregate must reach the existing payload guard')
})
