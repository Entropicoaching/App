import test from 'node:test'
import assert from 'node:assert/strict'
import { createWeekPlan } from './model.mjs'
import { buildShoppingList } from '../indkoeb/shoppingList.mjs'

// All numbers and identities are synthetic, supplied facts, not nutrition advice.
const small = { id: 'synthetic:small', name: 'Lille syntetisk portion',
  meal: { meal: 'Syntetisk ret', kcal: 120, protein: 6 },
  ingredients: [{ name: 'Syntetisk ingrediens', quantity: '12,5', unit: 'g' }] }
const large = { id: 'synthetic:large', name: 'Stor syntetisk portion',
  meal: { meal: 'Syntetisk ret', kcal: 300, protein: 15 },
  ingredients: [{ name: 'Syntetisk ingrediens', quantity: 31.25, unit: 'g' }] }

function freeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child)
    Object.freeze(value)
  }
  return value
}

function memory() {
  const data = new Map(), writes = []
  return { data, writes,
    getItem: key => data.get(key) ?? null,
    setItem(key, value) { writes.push([key, value]); data.set(key, value) } }
}

function options(storage, templates, extra = {}) {
  return { enabled: true, athleteId: 'synthetic:plan-a', date: '2027-01-01',
    targets: { kcal: 900, protein: 45 }, storage, templates, ...extra }
}

test('mixed supplied portions survive year/month rollover, repeated recipes and removal to an empty week', () => {
  // User failure: de-duplicating a recipe loses portions; stale totals survive removal.
  const catalog = freeze(structuredClone([small, large]))
  const before = structuredClone(catalog), storage = memory()
  const plan = createWeekPlan(options(storage, catalog))
  assert.deepEqual(plan.snapshot().days.map(day => day.date), [
    '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31',
    '2027-01-01', '2027-01-02', '2027-01-03',
  ])
  assert.equal(plan.add(3, small.id), true)
  assert.equal(plan.add(3, large.id), true)
  assert.equal(plan.add(4, small.id), true)
  const state = plan.snapshot()
  assert.deepEqual(state.days[3].totals, { kcal: 420, protein: 21 })
  assert.deepEqual(state.days[4].totals, { kcal: 120, protein: 6 })
  for (const index of [0, 1, 2, 5, 6]) {
    assert.deepEqual(state.days[index].entries, [])
    assert.deepEqual(state.days[index].totals, { kcal: null, protein: null })
  }
  assert.deepEqual(state.shopping, {
    items: [{ name: 'Syntetisk ingrediens', quantity: 56.25, unit: 'g', confirmedStock: null, netPurchase: 56.25 }],
    missingMeals: [], selectedCount: 3, error: '', unavailableCount: 0,
  })
  const saved = [...storage.data]
  state.days[3].entries[0].name = 'changed snapshot'
  state.days[4].totals.kcal = 999
  state.shopping.items[0].quantity = 999
  assert.deepEqual(plan.snapshot(), createWeekPlan(options(storage, catalog)).snapshot())
  assert.deepEqual([...storage.data], saved)
  assert.equal(storage.writes.length, 3)
  assert.equal(plan.remove(3, 1), true)
  assert.equal(plan.snapshot().shopping.items[0].quantity, 25)
  assert.equal(plan.remove(3, 0), true)
  assert.equal(plan.remove(4, 0), true)
  const empty = plan.snapshot()
  assert.ok(empty.days.every(day => day.entries.length === 0))
  assert.ok(empty.days.every(day => day.totals.kcal === null && day.totals.protein === null))
  assert.deepEqual(empty.shopping, {
    items: [], missingMeals: [], selectedCount: 0, error: '', unavailableCount: 0,
  })
  assert.deepEqual(catalog, before)
})

test('unknown food/macros mixed with known entries never acquire inferred nutrition or ingredients', () => {
  // User failure: a plausible partial total is presented as complete nutrition.
  const unknown = { id: 'synthetic:unknown', name: 'Ukendt syntetisk ret',
    meal: { meal: small.meal.meal, kcal: '', protein: '2,5' },
    ingredients: [{ name: 'Ukendt syntetisk foedevare', quantity: 7, unit: 'g' }] }
  const noIngredients = { id: 'synthetic:no-ingredients', name: 'Uden ingrediensdata',
    meal: { meal: 'Syntetisk ret uden ingredienser', kcal: 40, protein: -1 } }
  const catalog = freeze(structuredClone([small, unknown, noIngredients]))
  const before = structuredClone(catalog), storage = memory()
  const plan = createWeekPlan(options(storage, catalog))
  for (const [day, id] of [[0, small.id], [0, unknown.id], [1, small.id], [1, noIngredients.id]]) {
    assert.equal(plan.add(day, id), true)
  }
  const state = plan.snapshot()
  assert.deepEqual(state.days[0].totals, { kcal: null, protein: 8.5 })
  assert.deepEqual(state.days[1].totals, { kcal: 160, protein: null })
  assert.deepEqual(state.shopping, {
    items: [
      { name: 'Syntetisk ingrediens', quantity: 25, unit: 'g', confirmedStock: null, netPurchase: 25 },
      { name: 'Ukendt syntetisk foedevare', quantity: 7, unit: 'g', confirmedStock: null, netPurchase: 7 },
    ],
    missingMeals: [{ id: '1:1', meal: noIngredients.meal.meal }],
    selectedCount: 4, error: '', unavailableCount: 0,
  })
  assert.deepEqual(plan.snapshot(), state)
  assert.equal(storage.writes.length, 4)
  assert.deepEqual(catalog, before)
})

test('a removed recipe invalidates only affected daily totals and never contributes stale shopping', () => {
  // User failure: removing a saved recipe leaves its old nutrition in a mixed day.
  const storage = memory(), catalog = freeze(structuredClone([small, large]))
  const plan = createWeekPlan(options(storage, catalog))
  assert.equal(plan.add(0, small.id), true)
  assert.equal(plan.add(0, large.id), true)
  assert.equal(plan.add(6, small.id), true)
  const original = plan.snapshot(), saved = [...storage.data]
  const restored = createWeekPlan(options(storage, freeze([catalog[0]])))
  const state = restored.snapshot()
  assert.deepEqual(state.days[0].entries.map(entry => entry.missing), [false, true])
  assert.deepEqual(state.days[0].totals, { kcal: null, protein: null })
  assert.deepEqual(state.days[6].totals, { kcal: 120, protein: 6 })
  assert.deepEqual(state.shopping, {
    items: [{ name: 'Syntetisk ingrediens', quantity: 25, unit: 'g', confirmedStock: null, netPurchase: 25 }],
    missingMeals: [], selectedCount: 2, error: '', unavailableCount: 1,
  })
  assert.deepEqual([...storage.data], saved)
  assert.equal(storage.writes.length, 3)
  assert.equal(restored.remove(0, 1), true)
  assert.deepEqual(restored.snapshot().days[0].totals, { kcal: 120, protein: 6 })
  assert.equal(restored.snapshot().shopping.unavailableCount, 0)
  assert.deepEqual(plan.snapshot(), original)
  assert.deepEqual(catalog, [small, large])
})

test('invalid selected quantities clear the entire shopping result and removal restores the valid list', () => {
  // User failure: adding a malformed portion leaves an apparently usable old list.
  for (const quantity of [0, -1, NaN, Infinity, '', null, true, '1e2', '12g', '1,2.3']) {
    const invalid = { ...structuredClone(large), id: 'synthetic:invalid',
      ingredients: [{ name: 'Syntetisk ingrediens', quantity, unit: 'g' }] }
    const catalog = freeze(structuredClone([small, invalid]))
    const before = structuredClone(catalog), storage = memory()
    const plan = createWeekPlan(options(storage, catalog))
    assert.equal(plan.add(0, small.id), true)
    const valid = plan.snapshot()
    assert.equal(plan.add(1, invalid.id), true)
    const saved = [...storage.data], state = plan.snapshot()
    assert.deepEqual(state.shopping.items, [])
    assert.deepEqual(state.shopping.missingMeals, [])
    assert.ok(state.shopping.error.length > 0)
    assert.deepEqual(state.days[0].totals, valid.days[0].totals)
    // Independent supplied macro facts do not depend on ingredient quantities.
    assert.deepEqual(state.days[1].totals, { kcal: 300, protein: 15 })
    assert.throws(() => buildShoppingList(catalog, [small.id, invalid.id]), TypeError)
    assert.deepEqual([...storage.data], saved)
    assert.equal(storage.writes.length, 2)
    assert.equal(plan.remove(1, 0), true)
    assert.deepEqual(plan.snapshot(), valid)
    assert.deepEqual(catalog, before)
  }
})

for (const [label, change, secondKey] of [
  ['different encoded athlete IDs', { athleteId: 'synthetic:plan%2Fa' },
    'entropi2:nutrition:ugeplan:v1:synthetic%3Aplan%252Fa:2026-12-28'],
  ['adjacent weeks across New Year', { date: '2027-01-04' },
    'entropi2:nutrition:ugeplan:v1:synthetic%3Aplan%2Fa:2027-01-04'],
]) {
  test(`two active plans sharing a catalog/storage isolate interleaved edits: ${label}`, () => {
    // User failure: editing another athlete/week changes the first plan or its draft.
    const catalog = freeze(structuredClone([small, large]))
    const before = structuredClone(catalog), storage = memory()
    const firstOptions = options(storage, catalog, { athleteId: 'synthetic:plan/a' })
    const secondOptions = { ...firstOptions, ...change }
    const first = createWeekPlan(firstOptions), second = createWeekPlan(secondOptions)
    const firstKey = 'entropi2:nutrition:ugeplan:v1:synthetic%3Aplan%2Fa:2026-12-28'
    const secondEmpty = second.snapshot()
    assert.equal(first.add(0, small.id), true)
    const firstSaved = first.snapshot(), firstRaw = storage.data.get(firstKey)
    assert.deepEqual(second.snapshot(), secondEmpty)
    assert.equal(second.add(6, large.id), true)
    assert.equal(second.add(6, large.id), true)
    const secondSaved = second.snapshot(), secondRaw = storage.data.get(secondKey)
    assert.deepEqual(first.snapshot(), firstSaved)
    assert.equal(storage.data.get(firstKey), firstRaw)
    assert.deepEqual(secondSaved.days[6].totals, { kcal: 600, protein: 30 })
    assert.deepEqual(secondSaved.shopping.items, [
      { name: 'Syntetisk ingrediens', quantity: 62.5, unit: 'g', confirmedStock: null, netPurchase: 62.5 },
    ])
    assert.equal(first.remove(0, 0), true)
    assert.deepEqual(second.snapshot(), secondSaved)
    assert.equal(storage.data.get(secondKey), secondRaw)
    const detached = second.snapshot()
    detached.days[6].entries.length = 0
    detached.shopping.items.length = 0
    assert.deepEqual(second.snapshot(), secondSaved)
    assert.deepEqual(createWeekPlan(firstOptions).snapshot(), first.snapshot())
    assert.deepEqual(createWeekPlan(secondOptions).snapshot(), secondSaved)
    assert.deepEqual(storage.writes.map(([key]) => key), [firstKey, secondKey, secondKey, firstKey])
    assert.deepEqual([...storage.data.keys()].sort(), [firstKey, secondKey].sort())
    assert.deepEqual(catalog, before)
  })
}
