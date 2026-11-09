// Producer tests: actual product modules + ReactDOM/StrictMode; synthetic I/O only.
// No database engine, SQL fixtures, alternate logger, or replacement calculations.
import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement as h, act, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Entropi2Kost from '../Entropi2Kost.mjs'
import { createNutritionController } from './controller.mjs'
import { mountNutrition } from './view.mjs'
import { fridaLogFoods } from './fridaLogFoods.mjs'
import { FRIDA_FOODS } from '../kostplan/foedevarer/frida55.mjs'
import { LOCAL_FOODS } from '../../athlete/lokaleFoedevarer.js'
import { sessionReactDocument } from '../session/sessionQuickSetReactDom.mjs'
import { fixture, athleteId, date, flush } from '../kostplan/atlet/daySession.fixture.mjs'

const key = (host, name) => [...host.querySelectorAll('[data-focus]')].find(n => n.getAttribute('data-focus') === name)
const form = host => key(host, 'log-portion').parentElement
const enter = (host, name, value, event = 'input') => {
  const input = key(host, name); assert.ok(input, name)
  input.value = value; input.dispatch(event, { target: input })
}
const click = (host, name) => { const n = key(host, name); assert.ok(n, name); n.dispatch('click') }
const defer = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
const draft = host => ['food-search', 'food-choice', 'field-Mængde', 'unit-choice'].map(k => key(host, k)?.value)
const macro = { kcal100: 'energyKcal', protein100: 'proteinG', carb100: 'carbohydrateG', fat100: 'fatG' }
const legacy = (id = 'synthetic-legacy') => ({ id, name: 'Syntetisk skål', isCustom: true,
  unit_label: 'skål', unit_grams: 60, kcal100: 131, protein100: 0, carb100: 11, fat100: 3 })
const frozenPrefix = () => Object.freeze([Object.freeze(legacy()), ...LOCAL_FOODS])
const choose = (host, id) => {
  const referenceIndex = fridaLogFoods().findIndex(food => food.id === id)
  const food = fridaLogFoods()[referenceIndex]; assert.ok(food)
  enter(host, 'food-search', food.name)
  const option = [...key(host, 'food-choice').querySelectorAll('option')].find(n => n.value === String(frozenPrefix().length + referenceIndex))
  assert.ok(option, id); assert.ok(option.textContent.includes(food.name)); assert.ok(option.textContent.includes(id)); enter(host, 'food-choice', option.value, 'change')
  return option.value
}

async function settleFrida(host) {
  for (let i = 0; i < 40 && key(host, 'enable-frida-log')?.disabled; i++) await flush()
}

async function mounted(t, options = {}) {
  const doc = sessionReactDocument(), host = doc.createElement('div'); doc.body.append(host)
  const saves = [], reads = [], writes = []
  let today = date
  const foods = options.foods || frozenPrefix()
  const c = createNutritionController({ enabled: true, athlete: { id: athleteId }, date, foods,
    currentDay: () => today, now: () => Date.parse(date + 'T12:00:00Z'),
    storage: { getItem: k => { reads.push(k); return null }, setItem: (...args) => writes.push(args) },
    contracts: { load: async () => [], save: async row => { saves.push(row); return options.save ? options.save(row) : true } },
    ...options.controller })
  const cleanup = mountNutrition(host, c, { clock: () => new Date(today + 'T12:00:00Z') })
  t.after(cleanup); await flush()
  return { host, c, foods, saves, reads, writes, cleanup, doc, setDay: value => { today = value } }
}

async function reactMounted(run) {
  mock.timers.enable({ apis: ['Date'], now: new Date(date + 'T12:00:00Z') })
  const f = fixture(), doc = sessionReactDocument(), host = doc.createElement('div'); doc.body.append(host)
  const replacements = { window: doc.defaultView, IS_REACT_ACT_ENVIRONMENT: true, localStorage: f.storage }
  const originals = new Map(Object.keys(replacements).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]))
  for (const [k, value] of Object.entries(replacements)) Object.defineProperty(globalThis, k, { configurable: true, value })
  const foods = frozenPrefix(), props = { enabled: true, athlete: { id: athleteId }, date, client: f.client, foods,
    weightLogs: [], weightStatus: { athleteId, state: 'loading' }, currentDay: () => date }
  let root
  const show = () => act(async () => { root.render(h(StrictMode, null, h(Entropi2Kost, props))); await flush(); await flush() })
  try { root = createRoot(host); await show(); await run({ f, host, doc, props, root, show, foods }) }
  finally {
    try { if (root) await act(async () => root.unmount()) }
    finally {
      for (const [k, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, k, descriptor); else delete globalThis[k]
      }
      mock.timers.reset()
    }
  }
}

test('Frida adapter: exactly the original 40 IDs, names, preparations, sources and unrounded per-100-g values', () => {
  const original = JSON.stringify(FRIDA_FOODS), foods = fridaLogFoods()
  assert.equal(foods.length, 40); assert.equal(new Set(foods.map(f => f.id)).size, 40)
  foods.forEach((food, i) => {
    const source = FRIDA_FOODS[i]
    for (const key of ['id', 'name', 'preparation', 'source']) assert.deepEqual(food[key], source[key])
    for (const [flat, nutrient] of Object.entries(macro)) assert.equal(food[flat], source.nutrientsPer100g[nutrient])
  })
  assert.equal(JSON.stringify(FRIDA_FOODS), original)
})

test('Frida default graph: controller/view have no static Frida dependency; normal athlete receives custom + LOCAL_FOODS', () => {
  for (const filename of ['./controller.mjs', './view.mjs']) {
    const source = readFileSync(new URL(filename, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /import\s+[^\n]*\sfrom\s+['"][^'"]*frida/i)
  }
  const view = readFileSync(new URL('../../AthleteView.jsx', import.meta.url), 'utf8')
  assert.match(view, /const e2Foods = useMemo\(\(\) => \[\.\.\.\(Array\.isArray\(customFoods\)/)
  assert.ok(LOCAL_FOODS.length > 0)
})

test('Frida normal ReactDOM StrictMode: explicit opt-in, official IDs and known zero macros, comma grams, exact existing math, one original writer', async t => {
  await reactMounted(async ({ f, host, props, show, foods }) => {
    t.diagnostic('Observed legacy=' + LOCAL_FOODS.length + ', custom+legacy=' + foods.length)
    const original = JSON.stringify(foods)
    assert.equal(key(host, 'food-choice').querySelectorAll('option').length, foods.length)
    assert.ok(!key(host, 'food-choice').querySelectorAll('option').some(n => n.textContent === 'Jordbær, rå'))
    enter(host, 'food-choice', '0', 'change'); enter(host, 'unit-choice', '1', 'change'); enter(host, 'field-Mængde', '2,25')
    key(host, 'log-form').open = true
    const before = draft(host), calls = [f.calls.length, f.plan.calls.length, f.writes.length]
    await act(async () => { click(host, 'enable-frida-log'); await settleFrida(host) })
    assert.equal(key(host, 'enable-frida-log'), undefined)
    assert.deepEqual(draft(host), before)
    assert.deepEqual([f.calls.length, f.plan.calls.length, f.writes.length], calls)
    const options = key(host, 'food-choice').querySelectorAll('option')
    assert.equal(options.length, foods.length + 40)
    assert.deepEqual(options.slice(0, foods.length).map(n => n.textContent), foods.map(f => f.name))
    assert.equal(JSON.stringify(foods), original)
    assert.equal(key(host, 'frida-source-summary'), undefined)
    assert.match(host.textContent, /Kostloggen gemmer makroer/)
    const index = choose(host, 'frida55:1')
    assert.equal(Number(index), foods.length)
    enter(host, 'field-Mængde', '137,5')
    assert.equal(key(host, 'frida-portion-values').textContent, '49 kcal · 1 g protein · 8 g kulhydrat · 1 g fedt')
    let source = key(host, 'frida-source-frida55:1')
    assert.ok(!source.open); assert.match(source.textContent, /FoodID=1;/)
    assert.ok(source.textContent.includes(FRIDA_FOODS[0].source.citation))
    assert.match(source.textContent, /Som navngivet: Jordbær, rå/)
    assert.equal(f.rows.length, 0)
    choose(host, 'frida55:2'); enter(host, 'field-Mængde', '72,5')
    assert.equal(key(host, 'frida-portion-values').textContent, '38 kcal · 0 g protein · 8 g kulhydrat · 0 g fedt')
    source = key(host, 'frida-source-frida55:2')
    assert.match(source.textContent, /FoodID=2;/); assert.doesNotMatch(source.textContent, /FoodID=1;/)
    choose(host, 'frida55:1467'); enter(host, 'field-Mængde', '72,5')
    assert.equal(key(host, 'frida-portion-values').textContent, '653 kcal · 0 g protein · 0 g kulhydrat · 73 g fedt')
    assert.match(key(host, 'frida-source-frida55:1467').textContent, /FoodID=1467;/)
    enter(host, 'food-search', 'ingen match')
    assert.equal(key(host, 'field-Mængde').value, '72,5'); assert.ok(key(host, 'log-portion').disabled)
    click(host, 'clear-food-search')
    props.weightStatus = { athleteId, state: 'ready' }; await show()
    assert.equal(key(host, 'field-Mængde').value, '72,5')
    assert.equal(f.rows.length, 0)
    await act(async () => { form(host).dispatch('submit'); await flush(); await flush() })
    assert.deepEqual(f.rows, [{ athlete_id: athleteId, date, id: 'synthetic-diary-1',
      meal: 'Olivenolie · 73 g', kcal: 653, protein: 0, carb: 0, fat: 73 }])
    assert.equal(f.calls.filter(c => c.action === 'insert').length, 1)
    assert.equal(f.plan.writes().length, 0)
    assert.deepEqual(f.writes, ['entropi2:nutrition:portions:v1:' + athleteId])
    const saved = JSON.parse(f.values.get(f.writes[0]))
    assert.deepEqual(JSON.parse(saved[0][0]), ['frida55:1467', 'Olivenolie', false, null, null])
    assert.equal(saved[0][1], 72.5)
  })
})

test('Frida pending load: exactly one import, stable query/selection/typed unit and grams, same prefix objects, no I/O', async t => {
  const gate = defer(); let imports = 0
  const f = await mounted(t, { controller: { loadFridaFoods: () => { imports++; return gate.promise } } })
  enter(f.host, 'unit-choice', '1', 'change'); enter(f.host, 'field-Mængde', '1,75')
  enter(f.host, 'food-search', 'skål')
  const before = draft(f.host), original = JSON.stringify(f.foods), reads = f.reads.length
  click(f.host, 'enable-frida-log'); click(f.host, 'enable-frida-log')
  assert.equal(await f.c.enableFridaFoods(() => true), false)
  assert.equal(imports, 1); assert.equal(f.c.snapshot().fridaLog.status, 'loading')
  assert.match(f.host.textContent, /Henter Frida-fødevarer/)
  gate.resolve(fridaLogFoods()); await flush()
  assert.equal(f.c.snapshot().fridaLog.status, 'enabled'); assert.deepEqual(draft(f.host), before)
  assert.deepEqual(f.c.snapshot().foods.slice(0, f.foods.length), f.foods)
  assert.equal(JSON.stringify(f.foods), original); assert.equal(f.reads.length, reads)
  assert.equal(f.saves.length + f.writes.length, 0)
  assert.equal(await f.c.enableFridaFoods(() => true), false); assert.equal(imports, 1)
})

test('Frida failed import: honest error, unchanged draft, no automatic retries and one explicit retry', async t => {
  let imports = 0
  const f = await mounted(t, { controller: { loadFridaFoods: () => {
    imports++; return imports === 1 ? Promise.reject(Error('Synthetic offline')) : Promise.resolve(fridaLogFoods())
  } } })
  enter(f.host, 'field-Mængde', '31,5'); enter(f.host, 'food-search', 'skål')
  const before = draft(f.host), count = f.c.snapshot().foods.length
  click(f.host, 'enable-frida-log'); await flush()
  assert.equal(f.c.snapshot().fridaLog.status, 'error'); assert.equal(f.c.snapshot().foods.length, count)
  assert.deepEqual(draft(f.host), before); assert.match(key(f.host, 'enable-frida-log').textContent, /Prøv/)
  f.cleanup.updateWeight({ weightInput: '72' }); f.c.toggleHistory(); await flush()
  assert.equal(imports, 1)
  click(f.host, 'enable-frida-log'); await flush()
  assert.equal(imports, 2); assert.equal(f.c.snapshot().foods.length, count + 40)
  assert.deepEqual(draft(f.host), before); assert.equal(f.saves.length + f.writes.length, 0)
})

for (const malformed of ['collision', 'duplicate-prefix', 'duplicate-added', 'bad-id', 'bad-source', 'missing-value', 'nan', 'negative', 'too-many']) {
  test('Frida rejects entire append atomically: ' + malformed, async t => {
    const added = fridaLogFoods().map(f => ({ ...f }))
    const foods = [legacy()]
    if (malformed === 'collision') foods.push({ ...legacy(added[0].id) })
    if (malformed === 'duplicate-prefix') foods.push({ ...foods[0] })
    if (malformed === 'duplicate-added') added[1] = { ...added[0] }
    if (malformed === 'bad-id') added[0].id = 'unknown:1'
    if (malformed === 'bad-source') added[0].source = { citation: 'FoodID=2;', verification: 'synthetic' }
    if (malformed === 'missing-value') delete added[0].fat100
    if (malformed === 'nan') added[0].kcal100 = NaN
    if (malformed === 'negative') added[0].protein100 = -1
    if (malformed === 'too-many') added.push({ ...added[0], id: 'frida55:9999' })
    const original = JSON.stringify(foods)
    const f = await mounted(t, { foods, controller: { loadFridaFoods: async () => added } })
    click(f.host, 'enable-frida-log'); await flush()
    assert.equal(f.c.snapshot().fridaLog.status, 'error')
    assert.deepEqual(f.c.snapshot().foods, foods); assert.equal(JSON.stringify(foods), original)
    assert.equal(f.saves.length + f.writes.length, 0); assert.equal(key(f.host, 'frida-source-summary'), undefined)
  })
}

for (const revoked of ['hide', 'inert', 'readOnly', 'future-before-commit', 'midnight', 'disposed', 'foreign-owner']) {
  test('Frida deferred completion and captured handlers cannot survive ' + revoked, async t => {
    const gate = defer(), owner = {}, other = {}
    let target = { owner, athleteId, date, state: 'ready' }
    const dayTargets = { owner, athleteId, date, snapshot: () => target }
    const f = await mounted(t, { controller: { loadFridaFoods: () => gate.promise, dayTargets,
      contracts: { dayTargets, load: async () => [], save: async () => { throw Error('Unexpected save') } } } })
    const oldEnable = key(f.host, 'enable-frida-log'), oldForm = form(f.host), oldAmount = key(f.host, 'field-Mængde')
    click(f.host, 'enable-frida-log')
    if (revoked === 'hide') f.host.hidden = true
    if (revoked === 'inert') f.host.inert = true
    if (revoked === 'readOnly') { const fieldset = f.doc.createElement('fieldset'); f.doc.body.append(fieldset); fieldset.append(f.host); fieldset.disabled = true }
    if (revoked === 'future-before-commit') {
      const select = f.doc.createElement('select'); select.setAttribute('aria-label', 'Vælg plandato')
      for (const day of [date, '2026-11-06']) { const opt = f.doc.createElement('option'); opt.value = day; select.append(opt) }
      const frame = f.doc.createElement('div'); f.doc.body.append(frame)
      f.host.remove(); frame.append(f.host, select); select.value = '2026-11-06'
    }
    if (revoked === 'midnight') f.setDay('2026-11-06')
    if (revoked === 'disposed') f.cleanup()
    if (revoked === 'foreign-owner') target = { ...target, owner: other }
    gate.resolve(fridaLogFoods()); await flush()
    assert.equal(f.c.snapshot().foods.length, f.foods.length)
    assert.notEqual(f.c.snapshot().fridaLog.status, 'enabled')
    oldEnable.dispatch('click'); oldAmount.value = '999'; oldAmount.dispatch('input', { target: oldAmount }); oldForm.dispatch('submit')
    await flush(); assert.equal(f.saves.length + f.writes.length, 0)
  })
}

test('Frida committed busy boundary: append refuses even after the in-flight write settles, then explicit retry works', async t => {
  const loading = defer(), saving = defer(); let imports = 0
  const f = await mounted(t, { save: () => saving.promise,
    controller: { loadFridaFoods: () => { imports++; return imports === 1 ? loading.promise : Promise.resolve(fridaLogFoods()) } } })
  click(f.host, 'enable-frida-log')
  form(f.host).dispatch('submit'); assert.equal(f.c.snapshot().pending, true)
  assert.equal(await f.c.enableFridaFoods(() => true), false)
  saving.resolve(true); await flush()
  loading.resolve(fridaLogFoods()); await flush()
  assert.equal(f.c.snapshot().fridaLog.status, 'error'); assert.equal(f.c.snapshot().foods.length, f.foods.length)
  click(f.host, 'enable-frida-log'); await flush()
  assert.equal(f.c.snapshot().fridaLog.status, 'enabled'); assert.equal(imports, 2)
  assert.equal(f.saves.length, 1); assert.equal(f.writes.length, 1)
})

test('Frida known zero stays valid, unknown fails closed; synthetic source renders literal text and never follows a duplicate name', async t => {
  const added = fridaLogFoods().map(f => ({ ...f }))
  const citation = 'DTU Frida5.5; FoodID=1; <img src=x onerror=synthetic()> & reference'
  added[0] = { ...added[0], kcal100: 123.75, protein100: 0, carb100: 2.5, fat100: 0,
    source: { citation, verification: 'Syntetisk <reference>' } }
  added[1] = { ...added[1], protein100: null }
  const f = await mounted(t, { foods: [legacy(), { ...legacy('same-name'), name: added[0].name }],
    controller: { loadFridaFoods: async () => added } })
  click(f.host, 'enable-frida-log'); await flush()
  enter(f.host, 'food-choice', '1', 'change'); assert.equal(key(f.host, 'frida-source-summary'), undefined)
  enter(f.host, 'food-choice', '2', 'change'); enter(f.host, 'field-Mængde', '40,5')
  assert.equal(key(f.host, 'frida-portion-values').textContent, '50 kcal · 0 g protein · 1 g kulhydrat · 0 g fedt')
  assert.ok(key(f.host, 'frida-source-frida55:1').textContent.includes(citation))
  assert.equal(f.host.querySelectorAll('img').length, 0)
  enter(f.host, 'food-choice', '3', 'change'); form(f.host).dispatch('submit'); await flush()
  assert.equal(f.saves.length + f.writes.length, 0)
  enter(f.host, 'food-choice', '2', 'change'); enter(f.host, 'field-Mængde', '40,5')
  form(f.host).dispatch('submit'); await flush()
  assert.deepEqual(f.saves, [{ athlete_id: athleteId, date, meal: 'Jordbær, rå · 41 g', kcal: 50, protein: 0, carb: 1, fat: 0 }])
})

for (const replacement of ['OFF', 'athlete', 'date', 'client', 'unmount']) {
  test('Frida real ReactDOM StrictMode: captured loaded controls are revoked on ' + replacement, async () => {
    await reactMounted(async ({ f, host, props, root, show }) => {
      await act(async () => { click(host, 'enable-frida-log'); await settleFrida(host) })
      choose(host, 'frida55:3'); enter(host, 'field-Mængde', '83,5')
      const staleForm = form(host), staleChoice = key(host, 'food-choice'), staleAmount = key(host, 'field-Mængde')
      if (replacement === 'OFF') props.enabled = false
      if (replacement === 'athlete') props.athlete = { id: 'synthetic-other-athlete' }
      if (replacement === 'date') props.date = '2026-11-06'
      if (replacement === 'client') props.client = fixture().client
      if (replacement === 'unmount') await act(async () => root.render(null)); else await show()
      await act(async () => {
        staleChoice.value = '0'; staleChoice.dispatch('change', { target: staleChoice })
        staleAmount.value = '999'; staleAmount.dispatch('input', { target: staleAmount }); staleForm.dispatch('submit'); await flush()
      })
      assert.equal(f.rows.length, 0); assert.equal(f.calls.filter(c => c.action === 'insert').length, 0)
      assert.equal(f.writes.length, 0); assert.equal(f.plan.writes().length, 0)
      if (key(host, 'food-choice')) {
        assert.equal(key(host, 'food-choice').value, '0'); assert.equal(key(host, 'field-Mængde').value, '100')
        assert.equal(key(host, 'frida-source-summary'), undefined)
      }
    })
  })
}

test('Frida real ReactDOM: hidden future preview blocks retained opt-in and portion handlers, then returns without resetting draft', async () => {
  await reactMounted(async ({ f, host, props, show }) => {
    enter(host, 'field-Mængde', '19,5')
    const retained = key(host, 'enable-frida-log')
    const dateSelect = host.querySelectorAll('select').find(n => n.getAttribute('aria-label') === 'Vælg plandato')
    dateSelect.value = '2026-11-06'
    const change = event => Object.entries(dateSelect).find(([k]) => k.startsWith('__reactProps$'))[1].onChange(event)
    await act(async () => { change({ currentTarget: dateSelect }); await flush() })
    retained.dispatch('click'); await flush()
    assert.equal(key(host, 'food-choice').querySelectorAll('option').length, frozenPrefix().length)
    dateSelect.value = date
    await act(async () => { change({ currentTarget: dateSelect }); await flush() })
    assert.equal(key(host, 'field-Mængde').value, '19,5')
    await act(async () => { click(host, 'enable-frida-log'); await settleFrida(host) })
    choose(host, 'frida55:1'); enter(host, 'field-Mængde', '44,5')
    const retainedForm = form(host), retainedAmount = key(host, 'field-Mængde')
    dateSelect.value = '2026-11-06'
    await act(async () => { change({ currentTarget: dateSelect }); await flush() })
    retainedAmount.value = '999'; retainedAmount.dispatch('input', { target: retainedAmount }); retainedForm.dispatch('submit'); await flush()
    assert.equal(f.rows.length, 0); assert.equal(f.writes.length, 0)
    dateSelect.value = date
    await act(async () => { change({ currentTarget: dateSelect }); await flush() })
    // Programmatic mutation of a hidden DOM field must not change the owned draft.
    props.weightInput = '71,5'; await show()
    assert.equal(key(host, 'field-Mængde').value, '44,5')
  })
})

test('Frida OFF and read-only/future mounts do not invoke a loader; existing portions are untouched', async t => {
  let imports = 0
  const poison = new Proxy({}, { get() { throw Error('OFF access') } })
  assert.equal(createNutritionController({ enabled: false, foods: poison, athlete: poison }), null)
  mountNutrition(poison, null)()
  const f = await mounted(t, { controller: { loadFridaFoods: () => { imports++; return Promise.resolve(fridaLogFoods()) } } })
  f.host.disabled = true; click(f.host, 'enable-frida-log'); await flush()
  assert.equal(imports, 0)
  f.host.disabled = false; f.setDay('2026-11-06'); click(f.host, 'enable-frida-log'); await flush()
  assert.equal(imports, 0); assert.equal(f.c.snapshot().foods.length, f.foods.length)
  assert.equal(f.saves.length + f.writes.length, 0)
})
