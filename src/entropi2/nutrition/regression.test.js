import test from 'node:test'
import assert from 'node:assert/strict'
import { createNutritionController, mealKey } from './controller.mjs'
import { nutritionContracts } from './contracts.mjs'
import { mountNutrition } from './view.mjs'
import { syntheticHost, find, flush } from './synthetic-dom.mjs'

const meal = { meal: 'Synthetic meal', kcal: 100, protein: 5, carb: 10, fat: 2 }
const key = 'entropi2:nutrition:favorites:v1:A'
const storageFake = () => { const values = new Map(); return { values, getItem(k) { return values.get(k) ?? null }, setItem(k, v) { values.set(k, v) } } }
function setup({ date = '2026-11-01', rows = [], storage = storageFake(), id = 'A' } = {}) {
  const writes = []
  const c = createNutritionController({ enabled: true, athlete: { id }, date, storage,
    contracts: { async load() { return rows }, async save(r) { writes.push(r); return true } } })
  return { c, writes, storage }
}
async function submit(host, value) {
  for (const [i, v] of [value.meal, value.kcal, value.protein, value.carb, value.fat].entries()) {
    const input = host.querySelectorAll('input')[i]; input.value = String(v); await input.fire('input')
  }
  await host.querySelectorAll('form')[0].fire('submit')
}

test('R1: actual DOM submit rejects reserved receipt names, allows ordinary meal', async () => {
  const { c, writes } = setup(), host = syntheticHost()
  mountNutrition(host, c); await flush()
  await submit(host, { ...meal, meal: '[appData2-day-v1]Synthetic meal' })
  assert.equal(writes.length, 0)
  assert.equal(c.snapshot().logs.length, 0)
  assert.doesNotMatch(host.textContent, /Måltid gemt/)
  await submit(host, meal)
  assert.equal(writes.length, 1)
  assert.equal(c.snapshot().totals.kcal, 100)
})

test('R1: adapter rejects reserved names before client access, including normalized whitespace', async () => {
  const writes = []
  const adapter = nutritionContracts({ client: { from() { return { async insert(r) { writes.push(r); return { error: null } } } } } })
  for (const name of ['[appData2-day-v1]Synthetic meal', '  [appData2-day-v1]Synthetic meal  ']) {
    assert.equal(await adapter.save({ ...meal, meal: name, athlete_id: 'A', date: '2026-11-01' }), false)
  }
  assert.equal(writes.length, 0)
  assert.equal(await adapter.save({ ...meal, athlete_id: 'A', date: '2026-11-01' }), true)
  assert.equal(writes.length, 1)
})

test('R2: persisted favorite survives empty next-month window and logs with one DOM click', async () => {
  const first = setup({ rows: [{ ...meal, athlete_id: 'A', date: '2026-11-01' }] })
  await first.c.load(); assert.equal(first.c.toggleFavorite(meal), true); first.c.dispose()
  const next = setup({ date: '2026-12-02', storage: first.storage })
  const host = syntheticHost(); mountNutrition(host, next.c); await flush()
  assert.deepEqual(next.c.snapshot().favorites, [meal])
  await find(host, 'button', 'Log ' + meal.meal).fire('click'); await flush()
  assert.deepEqual(next.writes, [{ ...meal, athlete_id: 'A', date: '2026-12-02' }])
  assert.equal(next.c.snapshot().totals.kcal, 100)
})

test('R2: legacy encoded favorite migrates without logs, remains removable and athlete scoped', async () => {
  const storage = storageFake(); storage.setItem(key, JSON.stringify([mealKey(meal)]))
  const a = setup({ storage, date: '2026-12-02' }); await a.c.load()
  assert.deepEqual(a.c.snapshot().favorites, [meal])
  const b = setup({ storage, id: 'B' }); await b.c.load(); assert.deepEqual(b.c.snapshot().favorites, [])
  assert.equal(a.c.toggleFavorite(meal), true); assert.deepEqual(a.c.snapshot().favorites, [])
  assert.deepEqual(JSON.parse(storage.getItem(key)), [])
})

test('R2: malformed or reserved stored favorites never become a logging shortcut', async () => {
  for (const entry of [{ ...meal, kcal: -1 }, { ...meal, meal: '[appData2-day-v1]hidden' }, 'bad-key']) {
    const storage = storageFake(); storage.setItem(key, JSON.stringify([entry]))
    const { c } = setup({ storage }); await c.load()
    assert.deepEqual(c.snapshot().favorites, [])
    assert.ok(c.snapshot().favoriteError)
  }
})
