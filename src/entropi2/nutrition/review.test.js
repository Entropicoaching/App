import test from 'node:test'
import assert from 'node:assert/strict'
import { createNutritionController, mealKey } from './controller.mjs'
import { nutritionContracts } from './contracts.mjs'
import { mountNutrition } from './view.mjs'
import { syntheticHost, find, flush } from './synthetic-dom.mjs'

const day = '2026-11-01'
const meal = { meal: 'Synthetic favorite', kcal: 50, protein: 2, carb: 7, fat: 1 }
const storedRow = (overrides = {}) => ({ ...meal, athlete_id: 'review-A', date: day, ...overrides })
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
function create(rows, options = {}) {
  return createNutritionController({ enabled: true, athlete: { id: 'review-A' }, date: day,
    storage: { getItem() { return null }, setItem() {} },
    contracts: { async load() { return rows }, async save() { return true } }, ...options })
}

test('counterexample: a favorite remains visible beyond the 20 recent buttons', async () => {
  const rows = [storedRow({ date: '2026-10-02' }), ...Array.from({ length: 25 }, (_, i) => storedRow({ meal: 'Synthetic ' + i }))]
  const c = create(rows, { storage: { getItem() { return JSON.stringify([mealKey(meal)]) }, setItem() {} } })
  await c.load()
  assert.equal(c.snapshot().recent.length, 20)
  assert.deepEqual(c.snapshot().favorites, [meal])
})

test('counterexample: duplicate history values select newest and do not multiply quick buttons', async () => {
  const c = create([storedRow({ date: '2026-10-20' }), storedRow({ date: '2026-10-30' })])
  await c.load()
  assert.equal(c.snapshot().recent.length, 1)
  assert.equal(c.snapshot().logs.length, 0)
})

test('counterexample: save completion after dispose cannot populate the next athlete', async () => {
  const gate = deferred()
  const a = create([], { contracts: { async load() { return [] }, save() { return gate.promise } } })
  await a.load(); const pending = a.log(meal, 'late'); a.dispose()
  const b = create([], { athlete: { id: 'review-B' } }); await b.load()
  gate.resolve(true); assert.equal(await pending, false)
  assert.equal(b.snapshot().logs.length, 0)
  assert.equal(a.snapshot().logs.length, 0)
})

test('counterexample: callback throw and missing result cannot show a successful save', async () => {
  for (const insert of [async () => { throw new Error('synthetic transport') }, async () => undefined]) {
    const contracts = nutritionContracts({ client: { from() { return { insert } } } })
    const c = create([], { contracts: { async load() { return [] }, save: contracts.save } })
    await c.load(); assert.equal(await c.log(meal, 'throws'), false)
    assert.equal(c.snapshot().phase, 'save-error'); assert.equal(c.snapshot().logs.length, 0)
  }
})

test('counterexample: form draft, disclosure and keyboard focus survive a failed submit', async () => {
  const c = create([], { contracts: { async load() { return [] }, async save() { return false } } })
  const host = syntheticHost(); mountNutrition(host, c); await flush()
  host.querySelectorAll('details')[0].open = true
  for (const [i, value] of ['Synthetic draft', '10', '1', '2', '3'].entries()) {
    const input = host.querySelectorAll('input')[i]; input.value = value; await input.fire('input')
  }
  find(host, 'button', 'Gem måltid').focus()
  await host.querySelectorAll('form')[0].fire('submit')
  assert.equal(host.querySelectorAll('details')[0].open, true)
  assert.equal(host.ownerDocument.activeElement.getAttribute('data-focus'), 'log-form-summary')
  assert.equal(host.querySelectorAll('input')[0].value, 'Synthetic draft')
  assert.equal(host.querySelectorAll('input').every(n => n.required), true)
})

test('counterexample: snapshot mutation cannot change source goals, rows or favorite scope', async () => {
  const original = storedRow(), athlete = { id: 'review-A', kcal_target: 1000 }
  const c = create([original], { athlete }); await c.load()
  athlete.id = 'review-B'; athlete.kcal_target = 9999
  const s = c.snapshot(); s.logs[0].kcal = 9999; s.targets.kcal = 1
  assert.equal(c.snapshot().athleteId, 'review-A'); assert.equal(c.snapshot().totals.kcal, 50)
  assert.equal(c.snapshot().targets.kcal, 1000)
  assert.equal(original.kcal, 50)
})
