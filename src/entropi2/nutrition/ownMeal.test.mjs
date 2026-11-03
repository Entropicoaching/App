import test from 'node:test'
import assert from 'node:assert/strict'
import { createNutritionController } from './controller.mjs'
import { mountNutrition } from './view.mjs'
import { syntheticHost, find, flush } from './synthetic-dom.mjs'

const date = '2026-11-03', athlete = { id: 'synthetic-own' }
const meal = (i, extra = {}) => ({ athlete_id: athlete.id, date, id: 'row-' + i, meal: 'Del ' + i,
  kcal: '10,25', protein: 2.5, carb: '3.75', fat: 0, ...extra })
const key = 'entropi2:nutrition:favorites:v1:synthetic-own'
async function fixture(t, rows, { favorites = [], fail = false, save = async () => true } = {}) {
  const writes = [], values = new Map([[key, JSON.stringify(favorites)]])
  const storage = { getItem: k => values.get(k), setItem(k, v) { if (fail) throw Error('synthetic'); writes.push([k, v]); values.set(k, v) } }
  const c = createNutritionController({ enabled: true, athlete, date, storage, contracts: { load: async () => rows, save } })
  t.after(() => c.dispose()); await c.load()
  return { c, writes, values }
}
const select = (c, n) => { for (let i = 0; i < n; i++) assert.equal(c.toggleMealPart(i), true) }

test('own meal: two and many parts, comma/decimals, repeated identical rows count separately, exact log payload', async t => {
  for (const n of [2, 37]) {
    let payload
    const { c, writes } = await fixture(t, Array.from({ length: n }, (_, i) => meal(i)), { save: async p => { payload = p; return true } })
    select(c, n)
    assert.equal(c.saveOwnMeal('  Min\u0000 morgenmad\n  '), true)
    const combined = { meal: 'Min morgenmad', kcal: n * 10.25, protein: n * 2.5, carb: n * 3.75, fat: 0 }
    assert.deepEqual(c.snapshot().favorites, [combined]); assert.equal(writes[0][0], key)
    assert.equal(c.saveOwnMeal('Min morgenmad'), true); assert.equal(writes.length, 1)
    assert.equal(await c.log(c.snapshot().favorites[0], 'own-log'), true)
    assert.deepEqual(payload, { athlete_id: athlete.id, date, ...combined })
    assert.equal(c.snapshot().logs.length, n + 1)
  }
})

test('own meal: bad part rejects entire sum with feedback and no persistence', async t => {
  for (const value of ['', null, undefined, -1, 'bad', Infinity]) {
    for (const k of ['kcal', 'protein', 'carb', 'fat']) {
      const { c, writes } = await fixture(t, [meal(1), meal(2, { [k]: value })]); select(c, 2)
      assert.equal(c.saveOwnMeal('Samlet'), false); assert.equal(writes.length, 0)
      assert.match(c.snapshot().favoriteError, /Intet blev gemt/); assert.equal(c.snapshot().favorites.length, 0)
    }
  }
  const { c, writes } = await fixture(t, [meal(1, { kcal: 1e308 }), meal(2, { kcal: 1e308 })]); select(c, 2)
  assert.equal(c.saveOwnMeal('Samlet'), false); assert.equal(writes.length, 0)
})

test('own meal: name bounds, controls, count, invalid selection and previous day exclusion', async t => {
  const { c, writes } = await fixture(t, [meal(1), meal(2), meal(3, { date: '2026-11-02' })])
  assert.equal(c.saveOwnMeal('Navn'), false); assert.match(c.snapshot().favoriteError, /mindst to/)
  c.toggleMealPart(0); assert.equal(c.saveOwnMeal('Navn'), false)
  assert.equal(c.toggleMealPart(2), false); assert.equal(c.toggleMealPart(-1), false); assert.equal(c.toggleMealPart(0.5), false)
  c.toggleMealPart(1)
  for (const name of ['', '  ', '\u0000\n', 'a'.repeat(61), null]) {
    assert.equal(c.saveOwnMeal(name), false); assert.match(c.snapshot().favoriteError, /højst 60/)
  }
  assert.equal(writes.length, 0); assert.equal(c.saveOwnMeal('a'.repeat(60)), true)
  assert.equal(c.snapshot().favorites[0].meal.length, 60)
})

test('own meal: favorite capacity, duplicate at capacity, failed storage and remount persistence', async t => {
  const favorites = Array.from({ length: 100 }, (_, i) => ({ meal: 'Favorit ' + i, kcal: 1, protein: 2, carb: 3, fat: 4 }))
  const full = await fixture(t, [meal(1), meal(2)], { favorites }); select(full.c, 2)
  assert.equal(full.c.saveOwnMeal('Samlet'), false); assert.equal(full.writes.length, 0)
  assert.equal(full.c.snapshot().favoriteError, 'Favoritten blev ikke gemt. Prøv igen.')
  const duplicate = { meal: 'Samlet', kcal: 20.5, protein: 5, carb: 7.5, fat: 0 }
  const dup = await fixture(t, [meal(1), meal(2)], { favorites: [...favorites.slice(0, 99), duplicate] }); select(dup.c, 2)
  assert.equal(dup.c.saveOwnMeal('Samlet'), true); assert.equal(dup.writes.length, 0)
  const failed = await fixture(t, [meal(1), meal(2)], { fail: true }); select(failed.c, 2)
  assert.equal(failed.c.saveOwnMeal('Samlet'), false); assert.deepEqual(failed.c.snapshot().favorites, [])
  assert.equal(failed.c.snapshot().favoriteError, 'Favoritten blev ikke gemt. Prøv igen.')
  const good = await fixture(t, [meal(1), meal(2)]); select(good.c, 2); good.c.saveOwnMeal('Samlet')
  const reloaded = await fixture(t, [], { favorites: JSON.parse(good.values.get(key)) })
  assert.deepEqual(reloaded.c.snapshot().favorites, [duplicate])
})

test('own meal DOM: selected checkboxes, name, repeated submit and single-row log even beyond five quick slots', async t => {
  const saves = [], favorites = Array.from({ length: 6 }, (_, i) => ({ meal: 'Favorit ' + i, kcal: 1, protein: 1, carb: 1, fat: 1 }))
  const { c, writes } = await fixture(t, [meal(1), meal(2)], { favorites, save: async p => { saves.push(p); return true } })
  const host = syntheticHost(); t.after(mountNutrition(host, c)); await flush()
  const checkbox = i => host.querySelectorAll('input').find(n => n.getAttribute('data-focus') === 'meal-part-' + i)
  const button = () => find(host, 'button', 'Gem i Favoritter')
  assert.equal(button().disabled, true)
  await checkbox(0).fire('change'); assert.equal(checkbox(0).checked, true)
  await checkbox(1).fire('change'); assert.equal(button().disabled, false)
  const name = host.querySelectorAll('input').find(n => n.getAttribute('data-focus') === 'field-Navn på eget måltid')
  assert.equal(name.inputMode, 'text'); assert.equal(name.maxLength, 60)
  name.value = 'Min morgenmad'; await name.fire('input')
  const form = host.querySelectorAll('form').find(n => n.getAttribute('aria-label') === 'Gem eget måltid')
  await form.fire('submit'); await form.fire('submit'); assert.equal(writes.length, 1)
  assert.match(host.textContent, /Eget måltid gemt i Favoritter/)
  await find(host, 'button', 'Log Min morgenmad').fire('click')
  assert.deepEqual(saves, [{ athlete_id: athlete.id, date, meal: 'Min morgenmad', kcal: 20.5, protein: 5, carb: 7.5, fat: 0 }])
  assert.equal(c.snapshot().logs.length, 3)
})

test('own meal: reload clears selection; disposed calls are inert', async t => {
  const { c, writes } = await fixture(t, [meal(1), meal(2)]); select(c, 2)
  await c.load(); assert.deepEqual(c.snapshot().selectedParts, [])
  assert.equal(c.saveOwnMeal('Samlet'), false)
  c.dispose(); assert.equal(c.toggleMealPart(0), false); assert.equal(c.saveOwnMeal('Samlet'), false)
  assert.equal(writes.length, 0)
})

test('own meal DOM: invalid selected part leaves both storage and diary intact with inline alert', async t => {
  const { c, writes } = await fixture(t, [meal(1), meal(2, { fat: null })])
  const host = syntheticHost(); t.after(mountNutrition(host, c)); await flush()
  for (const index of [0, 1]) await host.querySelectorAll('input').find(n => n.getAttribute('data-focus') === 'meal-part-' + index).fire('change')
  const input = host.querySelectorAll('input').find(n => n.getAttribute('data-focus') === 'field-Navn på eget måltid')
  input.value = 'Min ret'; await input.fire('input')
  const form = () => host.querySelectorAll('form').find(n => n.getAttribute('aria-label') === 'Gem eget måltid')
  await form().fire('submit')
  assert.equal(writes.length, 0); assert.equal(c.snapshot().logs.length, 2)
  assert.equal(form().querySelectorAll('p').some(n => n.getAttribute('role') === 'alert' && n.textContent.includes('Intet blev gemt')), true)
  assert.equal(form().querySelectorAll('input')[0].value, 'Min ret')
  await host.querySelectorAll('input').find(n => n.getAttribute('data-focus') === 'meal-part-1').fire('change')
  assert.equal(find(host, 'button', 'Gem i Favoritter').disabled, true)
})

test('own meal: in-flight remote log blocks selection and local favorite save', async t => {
  let complete
  const { c, writes } = await fixture(t, [meal(1), meal(2)], { save: () => new Promise(resolve => { complete = resolve }) })
  select(c, 2)
  const saving = c.log(meal(3), 'remote-pending')
  assert.equal(c.toggleMealPart(0), false); assert.equal(c.saveOwnMeal('Samlet'), false); assert.equal(writes.length, 0)
  complete(true); await saving
  assert.equal(c.saveOwnMeal('Samlet'), true); assert.equal(writes.length, 1)
})
