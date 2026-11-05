import test from 'node:test'
import assert from 'node:assert/strict'
import { createNutritionController, mealKey } from './controller.mjs'
import { mountNutrition } from './view.mjs'
import { syntheticHost, find, flush } from './synthetic-dom.mjs'

const id = 'synthetic-next', date = '2026-11-03'
const meal = i => ({ meal: 'Synthetic next ' + i, kcal: 100 + i, protein: 10, carb: 12, fat: 3 })
const row = (i, day = date) => ({ ...meal(i), athlete_id: id, date: day,
  created_at: day + 'T12:00:' + String(59 - i).padStart(2, '0') + 'Z' })
const buttons = host => find(host, 'h2', 'Log hurtigt').parentElement.querySelectorAll('button')
  .filter(b => /^(Log |Gentag dette måltid: )/.test(b.textContent))
async function mount(t, rows, favorites = [], save = async () => true) {
  const writes = [], saves = []
  const controller = createNutritionController({ enabled: true, athlete: { id }, date,
    storage: { getItem: () => JSON.stringify(favorites), setItem: (...args) => writes.push(args) },
    contracts: { load: async () => rows, save: value => { saves.push(value); return save(value) } } })
  const host = syntheticHost(), cleanup = mountNutrition(host, controller)
  t.after(cleanup); await flush()
  return { controller, host, writes, saves }
}

test('next: 25 rows with 20 newest favorites expose all five older non-favorites', async t => {
  const rows = Array.from({ length: 25 }, (_, i) => row(i))
  const original = structuredClone(rows)
  const { controller, host, writes } = await mount(t, rows, rows.slice(0, 20).map((_, i) => meal(i)))
  assert.deepEqual(controller.snapshot().recent.map(mealKey), [20, 21, 22, 23, 24].map(i => mealKey(meal(i))))
  const section = find(host, 'h2', 'Seneste måltider').parentElement
  assert.deepEqual(section.querySelectorAll('button').map(b => b.textContent), [20, 21, 22, 23, 24].map(i => 'Gentag dette måltid: Synthetic next ' + i))
  assert.equal(buttons(host).filter(b => b.textContent.startsWith('Log Synthetic next ')).length, 20)
  assert.deepEqual(rows, original)
  assert.deepEqual(writes, [])
})

test('next: yesterday takes precedence by full mealKey; deduplication precedes the shared three-button limit', async t => {
  const rows = [0, 1, 2, 3, 4, 5, 6].map(i => row(i, '2026-11-02'))
    .concat([10, 11, 12, 13, 14].map(i => row(i, '2026-11-01')))
  // Same label, different nutrients must remain a distinct meal.
  const variant = { ...meal(0), kcal: 999 }
  const favorites = [meal(0), meal(1), meal(20), meal(21), meal(22), meal(23), variant]
  const { host, controller, writes } = await mount(t, rows, favorites)
  assert.deepEqual(find(host, 'h2', 'Favoritter').parentElement.querySelectorAll('button').map(b => b.textContent),
    [20, 21, 22, 23, 0].map(i => 'Log Synthetic next ' + i))
  assert.deepEqual(find(host, 'h2', 'Seneste måltider').parentElement.querySelectorAll('button').map(b => b.textContent),
    [10, 11, 12, 13, 14].map(i => 'Gentag dette måltid: Synthetic next ' + i))
  assert.equal(buttons(host).filter(b => b.textContent === 'Log Synthetic next 1').length, 0)
  assert.equal(buttons(host).filter(b => b.textContent === 'Log igen: Synthetic next 1').length, 1)
  assert.equal(controller.snapshot().favorites.length, favorites.length)
  assert.deepEqual(writes, [])
  await find(host, 'button', 'Fjern favorit: Synthetic next 1').fire('click')
  assert.equal(buttons(host).filter(b => /Synthetic next 1$/.test(b.textContent)).length, 1)
  assert.equal(writes.length, 1)
  assert.equal(writes[0][0], 'entropi2:nutrition:favorites:v1:' + id)
})

test('next: groups containing only yesterday meals are hidden, including after a repeat', async t => {
  const { host, saves } = await mount(t, [row(1, '2026-11-02'), row(2, '2026-11-02')], [meal(1)])
  for (const heading of ['Favoritter', 'Seneste måltider']) assert.equal(find(host, 'h2', heading), undefined)
  assert.equal(buttons(host).length, 2)
  await find(host, 'button', 'Log igen: Synthetic next 2').fire('click'); await flush()
  assert.equal(buttons(host).length, 2)
  assert.equal(saves.length, 1)
})

for (const firstSource of ['yesterday', 'favorite', 'recent']) {
  test('next: cross-source double tap saves once with ' + firstSource + ' first', async t => {
    let resolve
    const gate = new Promise(r => { resolve = r })
    const { host, controller, saves, writes } = await mount(t,
      [row(1, '2026-11-02'), row(3, '2026-11-01')], [meal(1), meal(2)], () => gate)
    const stale = {
      yesterday: find(host, 'button', 'Log igen: Synthetic next 1'),
      favorite: find(host, 'button', 'Log Synthetic next 2'),
      recent: find(host, 'button', 'Gentag dette måltid: Synthetic next 3'),
    }
    const first = stale[firstSource].fire('click')
    for (const button of Object.values(stale)) await button.fire('click')
    // Also retain the guard for an alternate intent referring to the same meal.
    assert.equal(await controller.log(meal(1), 'synthetic-cross-intent'), false)
    assert.equal(saves.length, 1)
    assert.equal(controller.snapshot().logs.length, 0)
    assert.ok(buttons(host).every(b => b.disabled))
    resolve(true); await first; await flush()
    assert.equal(controller.snapshot().logs.length, 1)
    assert.equal(saves.length, 1)
    assert.deepEqual(writes, [])
  })
}
