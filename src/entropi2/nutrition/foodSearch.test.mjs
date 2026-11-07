import test from 'node:test'
import assert from 'node:assert/strict'
import { createNutritionController } from './controller.mjs'
import { mountNutrition } from './view.mjs'
import { syntheticHost, flush } from './synthetic-dom.mjs'
import { foodChoices, foodIdentity } from './foodSearch.mjs'

const key = (host, value) => host.querySelectorAll('[data-focus]').find(n => n.getAttribute('data-focus') === value)
const catalogue = () => Array.from({ length: 1000 }, (_, i) => ({ id: 'synthetic-' + i,
  name: i === 731 ? 'Æblegrød, ØKO på skål' : 'Syntetisk vare ' + i,
  isCustom: true, unit_label: 'skål', unit_grams: 80,
  kcal100: 200, protein100: 0, carb100: 20, fat100: 0 }))

async function mounted(t, options = {}) {
  const foods = options.foods || catalogue(), saves = [], writes = []
  const controller = createNutritionController({ enabled: true, athlete: { id: 'synthetic-search' }, date: '2026-11-06',
    foods, storage: { getItem: () => null, setItem: (...args) => writes.push(args) },
    contracts: { load: options.load || (async () => []), save: async row => {
      saves.push(row); return options.save ? options.save(row) : true
    } } })
  const host = syntheticHost(), cleanup = mountNutrition(host, controller)
  t.after(cleanup); await flush()
  key(host, 'log-form').open = true
  return { foods, controller, host, cleanup, saves, writes }
}
const enter = async (host, name, value, event = 'input') => {
  const input = key(host, name); input.value = value; await input.fire(event)
}
const form = host => key(host, 'log-portion').parentElement
const chosen = host => key(host, 'food-choice').value
const draft = host => [key(host, 'field-Mængde').value, key(host, 'unit-choice').value]

test('mounted food search narrows the existing 1000-food portion selector', async t => {
  const controller = createNutritionController({ enabled: true, athlete: { id: 'synthetic-search' }, date: '2026-11-06',
    foods: catalogue(), contracts: { load: async () => [], save: async () => true } })
  const host = syntheticHost()
  t.after(mountNutrition(host, controller)); await flush()
  assert.equal(key(host, 'food-choice').querySelectorAll('option').length, 1000)
  const search = key(host, 'food-search')
  assert.ok(search, 'mounted portion form needs an accessible catalogue search')
  search.value = 'æBLEGRØD, øko'; await search.fire('input')
  assert.equal(key(host, 'food-choice').querySelectorAll('option').filter(n => n.value !== '').length, 2)
})

test('search uses Danish case and NFC, literal comma text, original indices and no mutation', () => {
  const foods = Object.freeze(catalogue().map(Object.freeze)), before = JSON.stringify(foods)
  for (const query of ['æBLEGRØD, øko', 'ÆBLEGRØD, ØKO', ' på SKÅL ', ' pa\u030A SKA\u030AL ']) {
    const result = foodChoices(foods, query, foodIdentity(foods[731]))
    assert.deepEqual(result.matches, [731]); assert.equal(result.selectedIndex, 731)
  }
  assert.deepEqual(foodChoices(foods, 'æblegrød. øko', null).matches, [])
  assert.deepEqual(foodChoices(foods, 'ablegrod', null).matches, [])
  assert.equal(foodChoices(foods, '  ', null).matches.length, 1000)
  assert.equal(JSON.stringify(foods), before)
})

test('non-first food, raw comma amount and bowl unit survive repeated filters, no match and clear', async t => {
  const f = await mounted(t), { host } = f
  await enter(host, 'food-search', 'ÆBLEGRØD, ØKO')
  await enter(host, 'food-choice', '731', 'change')
  await enter(host, 'unit-choice', '1', 'change'); await enter(host, 'field-Mængde', '1,5')
  for (const query of ['vare 99', 'øko', '<ingen & match>', 'på skål', 'vare 2', 'ØKO']) {
    await enter(host, 'food-search', query)
    assert.equal(chosen(host), '731'); assert.deepEqual(draft(host), ['1,5', '1'])
    assert.ok(key(host, 'food-choice').querySelectorAll('option').some(n => n.value === '731'))
  }
  await enter(host, 'food-search', 'ingen træffere')
  assert.match(host.textContent, /Ingen fødevarer matcher/)
  assert.ok(key(host, 'log-portion').disabled)
  await form(host).fire('submit'); assert.equal(f.saves.length + f.writes.length, 0)
  await key(host, 'clear-food-search').fire('click')
  assert.equal(key(host, 'food-search').value, '')
  assert.ok(host.ownerDocument.activeElement === key(host, 'food-search'))
  assert.equal(key(host, 'food-choice').querySelectorAll('option').length, 1000)
  assert.equal(chosen(host), '731'); assert.deepEqual(draft(host), ['1,5', '1'])
  await form(host).fire('submit')
  assert.deepEqual(f.saves, [{ athlete_id: 'synthetic-search', date: '2026-11-06',
    meal: 'Æblegrød, ØKO på skål · 1.5 skål (120 g)', kcal: 240, protein: 0, carb: 24, fat: 0 }])
  assert.equal(f.controller.foodAmount(731), 120)
  assert.equal(f.writes.length, 1)
})

test('refresh and reordered fresh catalogue copies preserve identity, quantity and unit, never filtered index', async t => {
  let release, calls = 0
  const f = await mounted(t, { load: () => ++calls === 1 ? Promise.resolve([]) : new Promise(r => { release = r }) })
  const { host } = f
  await enter(host, 'food-choice', '731', 'change')
  await enter(host, 'unit-choice', '1', 'change'); await enter(host, 'field-Mængde', '2,25')
  await enter(host, 'food-search', 'ØKO')
  const stale = form(host), load = f.controller.load()
  assert.equal(key(host, 'food-choice'), undefined)
  await stale.fire('submit'); assert.equal(f.saves.length, 0)
  f.foods.splice(0, f.foods.length, ...f.foods.map(food => ({ ...food })).reverse())
  release([]); await load
  assert.equal(chosen(host), '268'); assert.deepEqual(draft(host), ['2,25', '1'])
  assert.equal(key(host, 'food-search').value, 'ØKO')
  await stale.fire('submit'); assert.equal(f.saves.length, 0)
  await form(host).fire('submit')
  assert.equal(f.saves[0].meal, 'Æblegrød, ØKO på skål · 2.25 skål (180 g)')
  assert.equal(f.saves[0].kcal, 360)
})

test('removed, changed or ambiguous selection requires explicit choice and cannot default to food zero', async t => {
  for (const change of ['remove', 'nutrients', 'unit', 'duplicate']) {
    const f = await mounted(t), { host } = f
    await enter(host, 'food-choice', '731', 'change')
    await enter(host, 'field-Mængde', '43,5')
    if (change === 'remove') f.foods.splice(731, 1)
    if (change === 'nutrients') f.foods[731] = { ...f.foods[731], kcal100: 999 }
    if (change === 'unit') f.foods[731] = { ...f.foods[731], unit_grams: 900 }
    if (change === 'duplicate') f.foods.push({ ...f.foods[731] })
    // Submission checks the current catalogue even before a new render.
    await form(host).fire('submit'); assert.equal(f.saves.length, 0)
    f.controller.toggleHistory()
    assert.equal(chosen(host), ''); assert.ok(key(host, 'log-portion').disabled)
    assert.equal(draft(host)[0], '43,5'); assert.match(host.textContent, /Vælg en fødevare igen/)
    await form(host).fire('submit'); assert.equal(f.saves.length, 0)
    await enter(host, 'food-choice', '5', 'change')
    await form(host).fire('submit'); assert.equal(f.saves[0].meal, 'Syntetisk vare 5 · 100 g')
  }
})

test('pending locks every portion control; stale controls cannot alter the retained draft or double-save', async t => {
  let release
  const f = await mounted(t, { save: () => new Promise(r => { release = r }) }), { host } = f
  await enter(host, 'food-choice', '731', 'change')
  await enter(host, 'unit-choice', '1', 'change'); await enter(host, 'field-Mængde', '1,5')
  await enter(host, 'food-search', 'ØKO')
  const stale = Object.fromEntries(['food-search', 'food-choice', 'unit-choice', 'field-Mængde', 'gram-step-100'].map(k => [k, key(host, k)]))
  const staleForm = form(host), pending = staleForm.fire('submit')
  for (const name of [...Object.keys(stale), 'log-portion', 'clear-food-search']) assert.ok(key(host, name).disabled, name)
  await enter(host, 'field-Mængde', '900')
  stale['food-search'].value = 'vare'; await stale['food-search'].fire('input')
  stale['food-choice'].value = '1'; await stale['food-choice'].fire('change')
  stale['unit-choice'].value = '0'; await stale['unit-choice'].fire('change')
  stale['field-Mængde'].value = '700'; await stale['field-Mængde'].fire('input')
  await stale['gram-step-100'].fire('click'); await staleForm.fire('submit'); await form(host).fire('submit')
  assert.equal(f.saves.length, 1)
  release(false); await pending
  assert.equal(chosen(host), '731'); assert.deepEqual(draft(host), ['1,5', '1'])
  assert.equal(key(host, 'food-search').value, 'ØKO'); assert.equal(f.writes.length, 0)
})

test('search label, controlled select, live status and focus/caret remain scoped to the mounted form', async t => {
  const f = await mounted(t), { host } = f
  host.querySelectorAll('details').find(n => n.getAttribute('data-focus') === 'log-form').open = true
  const search = key(host, 'food-search')
  assert.equal(search.type, 'search'); assert.match(search.parentElement.textContent, /^Søg i fødevarer/)
  assert.equal(search.required, undefined)
  assert.equal(search.getAttribute('aria-controls'), key(host, 'food-choice').getAttribute('id'))
  const status = host.querySelectorAll('p').find(n => n.getAttribute('id') === search.getAttribute('aria-describedby'))
  assert.equal(status.getAttribute('role'), 'status'); assert.equal(status.getAttribute('aria-live'), 'polite')
  search.focus(); search.selectionStart = 2; search.selectionEnd = 4; search.selectionDirection = 'forward'
  await enter(host, 'food-search', 'øko')
  assert.ok(host.ownerDocument.activeElement === key(host, 'food-search'))
  assert.equal(f.saves.length + f.writes.length, 0)
})
