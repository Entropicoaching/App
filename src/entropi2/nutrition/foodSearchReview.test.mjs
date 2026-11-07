// Same-engine Codex review checks, independently sequenced against mounted
// product modules. No search-helper import or duplicated conversion logic.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createNutritionController } from './controller.mjs'
import { mountNutrition } from './view.mjs'
import { sessionReactDocument } from '../session/sessionQuickSetReactDom.mjs'

const flush = () => new Promise(resolve => setImmediate(resolve))
const key = (host, name) => host.querySelectorAll('[data-focus]').find(n => n.getAttribute('data-focus') === name)
const form = host => key(host, 'log-portion').parentElement
function change(host, name, value, event = 'input') {
  const n = key(host, name); n.value = value; n.dispatch(event, { target: n })
}
const food = (id, name, extra = {}) => ({ id, name, kcal100: 100, protein100: 0, carb100: 0, fat100: 0, ...extra })
async function mount(t, foods) {
  const rows = [], writes = [], doc = sessionReactDocument(), host = doc.createElement('div'); doc.body.append(host)
  const controller = createNutritionController({ enabled: true, athlete: { id: 'synthetic-review' }, date: '2026-11-07', foods,
    storage: { getItem: () => null, setItem: (...a) => writes.push(a) },
    contracts: { load: async () => [], save: async row => { rows.push(row); return true } } })
  const cleanup = mountNutrition(host, controller); t.after(cleanup); await flush()
  return { host, rows, writes, controller, cleanup }
}

test('review: identical labels and IDs across catalogue/custom origin cannot exchange a bowl draft', async t => {
  const foods = [food('shared', 'Ærter'), food('shared', 'Ærter', { isCustom: true, unit_label: 'kop', unit_grams: 55 })]
  const f = await mount(t, foods), { host } = f
  change(host, 'food-choice', '1', 'change'); change(host, 'unit-choice', '1', 'change')
  change(host, 'field-Mængde', '2,5'); change(host, 'food-search', 'ÆRTER')
  // Change order without a controller notification: submit must resolve identity now.
  foods.reverse(); form(host).dispatch('submit'); await flush()
  assert.equal(f.rows.length, 1)
  assert.deepEqual(f.rows[0], { athlete_id: 'synthetic-review', date: '2026-11-07',
    meal: 'Ærter · 2.5 kop (138 g)', kcal: 138, protein: 0, carb: 0, fat: 0 })
})

test('review: no-match and detached pre-clear handlers stay inert; only current explicit submit saves', async t => {
  const f = await mount(t, [food('a', 'Havre'), food('b', 'Økologisk æble')]), { host } = f
  key(host, 'log-form').open = true
  change(host, 'food-choice', '1', 'change'); change(host, 'field-Mængde', '27,5')
  change(host, 'food-search', 'ubekendt')
  const oldForm = form(host), oldSearch = key(host, 'food-search')
  oldForm.dispatch('submit'); await flush(); assert.equal(f.rows.length, 0)
  key(host, 'clear-food-search').dispatch('click')
  oldSearch.value = 'Havre'; oldSearch.dispatch('input', { target: oldSearch }); oldForm.dispatch('submit')
  await flush(); assert.equal(f.rows.length, 0)
  assert.equal(key(host, 'food-search').value, ''); assert.equal(key(host, 'food-choice').value, '1')
  form(host).dispatch('submit'); await flush()
  assert.equal(f.rows.length, 1); assert.equal(f.rows[0].meal, 'Økologisk æble · 28 g')
})

test('review: catalogue disappears and returns with another product; stale choice cannot become the new zero', async t => {
  const foods = [food('a', 'Valgt produkt')], f = await mount(t, foods), { host } = f
  const retained = form(host)
  foods.length = 0; f.controller.toggleHistory()
  assert.equal(key(host, 'food-choice'), undefined)
  retained.dispatch('submit'); await flush(); assert.equal(f.rows.length, 0)
  foods.push(food('b', 'Andet produkt')); f.controller.toggleHistory()
  assert.equal(key(host, 'food-choice').value, ''); assert.ok(key(host, 'log-portion').disabled)
  form(host).dispatch('submit'); await flush(); assert.equal(f.rows.length, 0)
  change(host, 'food-choice', '0', 'change'); form(host).dispatch('submit'); await flush()
  assert.equal(f.rows.length, 1); assert.equal(f.rows[0].meal, 'Andet produkt · 100 g')
})

test('review: known zero logs unchanged, unknown stays unsavable, strict OFF never accesses its host', async t => {
  const f = await mount(t, [food('zero', 'Kendt nul', { kcal100: 0 }), food('unknown', 'Ukendt', { protein100: null })]), { host } = f
  change(host, 'food-search', 'UKENDT'); change(host, 'food-choice', '1', 'change')
  form(host).dispatch('submit'); await flush(); assert.equal(f.rows.length + f.writes.length, 0)
  change(host, 'food-search', 'KENDT NUL'); change(host, 'food-choice', '0', 'change')
  form(host).dispatch('submit'); await flush()
  assert.equal(f.rows.length, 1); assert.equal(f.rows[0].kcal, 0); assert.equal(f.rows[0].protein, 0)
  const poison = new Proxy({}, { get() { throw Error('OFF accessed host') } })
  mountNutrition(poison, null)()
})
