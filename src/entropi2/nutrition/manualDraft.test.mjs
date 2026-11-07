import test from 'node:test'
import assert from 'node:assert/strict'
import { createNutritionController } from './controller.mjs'
import { mountNutrition } from './view.mjs'
import { mountExistingTracker } from '../kostplan/atlet/trackerAdapter.mjs'
import { syntheticHost, find, flush } from './synthetic-dom.mjs'

const date = '2026-11-06', id = 'synthetic-manual-a'
const labels = { meal: 'Måltid', kcal: 'Energi (kcal)', protein: 'Protein (g)', carb: 'Kulhydrat (g)', fat: 'Fedt (g)' }
const key = (host, value) => host.querySelectorAll('[data-focus]').find(n => n.getAttribute('data-focus') === value)
const input = (host, name) => key(host, 'field-' + labels[name])
const form = host => input(host, 'meal').parentElement.parentElement
const feedback = host => key(host, 'manual-feedback')
const draft = { meal: 'Syntetisk <ret>', kcal: '125,5', protein: '', carb: '0', fat: '2,5' }
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
async function enter(host, values) {
  for (const [k, v] of Object.entries(values)) { const n = input(host, k); n.value = v; await n.fire('input') }
}
function assertDraft(host, values) { for (const [k, v] of Object.entries(values)) assert.equal(input(host, k).value, v, k) }
async function fixture(t, options = {}) {
  const saves = [], loads = [], host = syntheticHost()
  const controller = createNutritionController({ enabled: true, athlete: { id }, date,
    foods: [{ name: 'Syntetisk vare', kcal100: 100, protein100: 0, carb100: 0, fat100: 0 }],
    contracts: { load: async (...args) => { loads.push(args); return [] },
      save: async value => { saves.push(value); return true }, ...options.contracts }, ...options.controller })
  const cleanup = mountNutrition(host, controller, { mountWeekPlan: () => () => {}, ...options.view })
  t.after(cleanup); await flush()
  key(host, 'log-form').open = true
  return { saves, loads, host, controller, cleanup }
}

test('manual: missing fields are named before save, zero is known, correction retains all text', async t => {
  const f = await fixture(t)
  await enter(f.host, draft)
  assert.equal(feedback(f.host)?.textContent, 'Mangler: Protein (g).')
  assert.equal(form(f.host).noValidate, true)
  await form(f.host).fire('submit')
  assert.deepEqual(f.saves, []); assertDraft(f.host, draft)
  assert.equal(input(f.host, 'protein').getAttribute('aria-invalid'), 'true')
  assert.equal(input(f.host, 'protein').getAttribute('aria-describedby'), feedback(f.host).getAttribute('id'))
  assert.equal(f.host.ownerDocument.activeElement, input(f.host, 'protein'))
  await enter(f.host, { protein: '0' })
  assert.equal(feedback(f.host).textContent, '')
  assert.equal(input(f.host, 'protein').getAttribute('aria-invalid'), 'false')
  assert.deepEqual(f.saves, [])
  await form(f.host).fire('submit')
  assert.deepEqual(f.saves, [{ athlete_id: id, date, meal: draft.meal, kcal: 125.5, protein: 0, carb: 0, fat: 2.5 }])
  assertDraft(f.host, Object.fromEntries(Object.keys(labels).map(k => [k, ''])))
})

test('manual: blank and malformed fields get separate complete feedback without changing values', async t => {
  const f = await fixture(t)
  const values = { meal: '  ', kcal: '  ', protein: '-1', carb: '1,2,3', fat: 'Infinity' }
  await enter(f.host, values); await form(f.host).fire('submit')
  assert.equal(feedback(f.host)?.textContent,
    'Mangler: Måltid, Energi (kcal). Angiv gyldige værdier: Protein (g), Kulhydrat (g), Fedt (g).')
  assertDraft(f.host, values); assert.deepEqual(f.saves, [])
  assert.equal(f.host.ownerDocument.activeElement, input(f.host, 'meal'))
  await enter(f.host, { meal: 'Rettet', kcal: '0', protein: '0', carb: '0', fat: '0' })
  await form(f.host).fire('submit')
  assert.equal(f.saves.length, 1); assert.equal(f.saves[0].kcal, 0)
})

test('manual: pending locks fields and duplicate submit, failure retains draft, explicit retry saves once', async t => {
  const gate = deferred(), calls = []
  const f = await fixture(t, { contracts: { save: value => { calls.push(value); return calls.length === 1 ? gate.promise : true } } })
  const values = { ...draft, protein: '0' }
  await enter(f.host, values)
  const old = form(f.host), pending = old.fire('submit')
  assert.equal(calls.length, 1)
  for (const k of Object.keys(labels)) assert.equal(input(f.host, k).disabled, true, k)
  assert.equal(key(f.host, 'save').disabled, true)
  await old.fire('submit'); await form(f.host).fire('submit')
  assert.equal(calls.length, 1)
  f.cleanup.updateWeight({ weightLogs: [], weightStatus: { athleteId: id, state: 'ready' } })
  assertDraft(f.host, values)
  gate.resolve(false); await pending
  assertDraft(f.host, values); assert.equal(input(f.host, 'meal').disabled, false)
  assert.match(f.host.textContent, /Måltidet blev ikke gemt/)
  await form(f.host).fire('submit')
  assert.equal(calls.length, 2); assert.deepEqual(calls[0], calls[1])
  assert.equal(f.controller.snapshot().logs.length, 1)
})

test('manual: real tracker refresh retains incomplete draft, quantity, open fold and feedback across failed and successful reads', async t => {
  const host = syntheticHost(), gate = deferred(), calls = [], saves = []
  let reads = 0
  const cleanup = mountExistingTracker(host, { enabled: true, athlete: { id }, date,
    foods: [{ name: 'Syntetisk vare', kcal100: 100, protein100: 0, carb100: 0, fat100: 0 }],
    contracts: { load: async (...args) => { calls.push(args); return ++reads === 2 ? gate.promise : [] },
      save: async value => { saves.push(value); return true } }, mountWeekPlan: () => () => {} })
  t.after(cleanup); await flush(); key(host, 'log-form').open = true
  await enter(host, draft)
  const amount = key(host, 'field-Mængde'); amount.value = '62,5'; await amount.fire('input')
  await form(host).fire('submit')
  cleanup.refresh(); await flush()
  assert.match(host.textContent, /Henter kostloggen/)
  gate.resolve(Promise.reject(Error('synthetic read failure'))); await flush()
  assert.match(host.textContent, /Kostloggen kunne ikke hentes/)
  await find(host, 'button', 'Hent igen').fire('click'); await flush()
  assertDraft(host, draft)
  assert.equal(key(host, 'field-Mængde').value, '62,5')
  assert.equal(key(host, 'log-form').open, true)
  assert.equal(feedback(host)?.textContent, 'Mangler: Protein (g).')
  assert.deepEqual(calls, Array.from({ length: 3 }, () => [id, date])); assert.deepEqual(saves, [])
  await enter(host, { protein: '0' }); await form(host).fire('submit')
  assert.equal(saves.length, 1); assert.equal(saves[0].athlete_id, id); assert.equal(saves[0].date, date)
})

for (const next of [{ id, date: '2026-11-07' }, { id: 'synthetic-manual-b', date }]) {
  test('manual: disposed date/athlete context cannot submit old draft into ' + JSON.stringify(next), async t => {
    const oldRead = deferred(), gate = deferred(), saves = []
    let reads = 0
    const f = await fixture(t, { contracts: { load: () => ++reads === 1 ? [] : oldRead.promise } })
    await enter(f.host, { ...draft, protein: '0' })
    const stale = form(f.host)
    const refresh = f.controller.load()
    f.cleanup()
    const c = createNutritionController({ enabled: true, athlete: { id: next.id }, date: next.date,
      contracts: { load: () => gate.promise, save: async value => { saves.push(value); return true } } })
    const cleanup = mountNutrition(f.host, c, { mountWeekPlan: () => () => {} }); t.after(cleanup)
    await stale.fire('submit'); gate.resolve([]); oldRead.resolve([]); await refresh; await flush()
    assertDraft(f.host, Object.fromEntries(Object.keys(labels).map(k => [k, ''])))
    assert.deepEqual(f.saves, []); assert.deepEqual(saves, [])
    await enter(f.host, { ...draft, meal: 'Ny eksplicit ret', protein: '0' }); await form(f.host).fire('submit')
    assert.equal(saves.length, 1); assert.equal(saves[0].athlete_id, next.id); assert.equal(saves[0].date, next.date)
  })
}

for (const nutrient of ['kcal', 'protein', 'carb', 'fat']) test('manual: only blank ' + nutrient + ' is missing; correcting to known zero needs no retyping', async t => {
  const f = await fixture(t)
  const values = { ...draft, protein: '0', [nutrient]: '' }
  await enter(f.host, values)
  await form(f.host).fire('submit')
  assert.equal(feedback(f.host).textContent, 'Mangler: ' + labels[nutrient] + '.')
  assertDraft(f.host, values); assert.deepEqual(f.saves, [])
  assert.equal(await f.controller.log(values, 'blank-' + nutrient), false)
  await enter(f.host, { [nutrient]: '0' })
  await form(f.host).fire('submit')
  assert.equal(f.saves.length, 1); assert.equal(f.saves[0][nutrient], 0)
})

test('manual controller boundary: unknown never writes, valid zero/comma writes only on explicit log', async t => {
  const f = await fixture(t)
  for (const value of ['', ' ', null, undefined, '-1', '1,2,3', Infinity]) {
    assert.equal(await f.controller.log({ ...draft, protein: value }, 'bad-' + String(value)), false)
  }
  assert.deepEqual(f.saves, [])
  assert.equal(await f.controller.log({ ...draft, protein: '0' }, 'explicit'), true)
  assert.equal(await f.controller.log({ ...draft, protein: '0' }, 'explicit'), false)
  assert.equal(f.saves.length, 1); assert.equal(f.saves[0].protein, 0)
})
