import test from 'node:test'
import assert from 'node:assert/strict'
import { createNutritionController } from './controller.mjs'
import { nutritionContracts } from './contracts.mjs'
import { mountNutrition } from './view.mjs'
import { syntheticHost, find, flush } from './synthetic-dom.mjs'

// Separate control cases, constructed after the correction, all synthetic.
const m = { meal: 'Control meal', kcal: 0, protein: 0, carb: 0, fat: 0 }
const scope = 'entropi2:nutrition:favorites:v1:control'
function fixture(entries) {
  const data = new Map([[scope, JSON.stringify(entries)]]), writes = []
  const storage = { getItem(k) { return data.get(k) ?? null }, setItem(k, v) { data.set(k, v) } }
  const c = createNutritionController({ enabled: true, athlete: { id: 'control' }, date: '2027-01-01', storage,
    contracts: { async load() { return [] }, async save(v) { writes.push(v); return false } } })
  return { c, storage, data, writes }
}

test('control: expired zero-valued favorite supports removal through DOM and reload', async () => {
  const { c, storage, data } = fixture([m, m]), host = syntheticHost()
  mountNutrition(host, c); await flush()
  assert.equal(c.snapshot().favorites.length, 1)
  await find(host, 'button', 'Fjern favorit: ' + m.meal).fire('click')
  assert.deepEqual(c.snapshot().favorites, [])
  assert.equal(data.get(scope), '[]')
  assert.equal(storage.getItem(scope), '[]')
  assert.equal(find(host, 'button', 'Log ' + m.meal), undefined)
})

test('control: persisted values are detached; denied removal and failed log preserve favorite', async () => {
  const { c, storage, writes } = fixture([m]); await c.load()
  const s = c.snapshot(); s.favorites[0].meal = 'Mutated'; s.favoriteKeys.length = 0
  assert.equal(c.snapshot().favorites[0].meal, m.meal)
  storage.setItem = () => { throw Error('synthetic denial') }
  assert.equal(c.toggleFavorite(m), false)
  assert.equal(c.snapshot().favorites.length, 1)
  assert.equal(await c.log(c.snapshot().favorites[0], 'independent'), false)
  assert.equal(writes.length, 1); assert.equal(c.snapshot().logs.length, 0)
  assert.equal(c.snapshot().favorites.length, 1)
})

test('control: oversized storage is rejected and reserved legacy key cannot reach client', async () => {
  const { c } = fixture(Array.from({ length: 101 }, () => m)); await c.load()
  assert.deepEqual(c.snapshot().favorites, []); assert.ok(c.snapshot().favoriteError)
  const reserved = { ...m, meal: '[appData2-day-v1]control' }
  const encoded = JSON.stringify([reserved.meal, 0, 0, 0, 0])
  const legacy = fixture([encoded]); await legacy.c.load()
  assert.deepEqual(legacy.c.snapshot().favorites, [])
  let calls = 0
  const contracts = nutritionContracts({ client: { from() { calls++; throw Error('must remain unused') } } })
  assert.equal(await contracts.save({ ...reserved, athlete_id: 'control', date: '2027-01-01' }), false)
  assert.equal(calls, 0)
})
