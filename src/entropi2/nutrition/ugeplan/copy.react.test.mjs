// Actual React/ReactDOM and copied product modules; synthetic host and clipboard.
import test from 'node:test'
import assert from 'node:assert/strict'
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import { Ugeplan } from './Ugeplan.mjs'
import { createWeekPlan } from './model.mjs'
import { createNutritionController } from '../controller.mjs'
import { mountNutrition } from '../view.mjs'
import { sessionReactDocument } from '../../session/sessionQuickSetReactDom.mjs'

const propsOf = node => node[Object.keys(node).find(k => k.startsWith('__reactProps$'))]
const tick = () => new Promise(resolve => setImmediate(resolve))
const template = { id: 'PRIVATE-TEMPLATE', name: 'Synthetic bowl', meal: { meal: 'Synthetic bowl' },
  ingredients: [{ name: 'Linser <rå>', quantity: 100, unit: 'g', preparation: 'rå', foodId: 'PRIVATE-FOOD', source: 'PRIVATE-SOURCE' }] }

function hostFixture() {
  const doc = sessionReactDocument(), host = doc.createElement('div'); doc.body.append(host)
  Object.defineProperty(Object.getPrototypeOf(host), 'options', { configurable: true,
    get() { return this.querySelectorAll('option') } })
  const keys = ['window', 'document', 'IS_REACT_ACT_ENVIRONMENT']
  const previous = keys.map(key => globalThis[key])
  globalThis.window = doc.defaultView; globalThis.document = doc; globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const restore = () => keys.forEach((key, i) => {
    if (previous[i] === undefined) delete globalThis[key]; else globalThis[key] = previous[i]
  })
  return { host, restore }
}

async function fixture(t, clipboard, templates = [template]) {
  const { host, restore } = hostFixture(), root = createRoot(host), data = new Map(), writes = []
  const storage = { getItem: k => data.get(k) ?? null, setItem(k, v) { writes.push(k); data.set(k, v) } }
  let props = { enabled: true, athleteId: 'PRIVATE-OWNER', date: '2026-11-04', templates, storage, clipboard }
  const seed = extra => { const m = createWeekPlan({ ...props, ...extra }); m.add(0, templates[0].id); return m }
  seed()
  const render = async extra => { props = { ...props, ...extra }; await act(async () => root.render(h(Ugeplan, props))) }
  let disposed = false
  const dispose = async () => { if (!disposed) { disposed = true; await act(async () => root.unmount()) } }
  t.after(async () => { try { await dispose() } finally { restore() } })
  await render({})
  const button = () => host.querySelectorAll('button').find(n => n.textContent === 'Kopiér indkøbsliste')
  // This minimal host has no browser event bubbling. Invoke the handler attached
  // by actual ReactDOM, as the existing mounted week-plan tests do.
  const click = async () => { assert.ok(button()); await act(async () => { await propsOf(button()).onClick() }) }
  return { host, render, seed, button, click, dispose, writes, data }
}

test('mounted action writes only on click, current projected stock/portions, safely escaped names and no storage writes', async t => {
  const calls = [], f = await fixture(t, { writeText: text => { calls.push(text); return Promise.resolve() } })
  assert.deepEqual(calls, [])
  const submit = async (name, value) => {
    const form = f.host.querySelectorAll('form').find(n => n.querySelectorAll('input').some(i => i.name === name))
    await act(async () => propsOf(form).onSubmit({ preventDefault() {}, currentTarget: { elements: { [name]: { value } } } }))
  }
  await submit('portions', '2'); await submit('stock', '0')
  assert.deepEqual(calls, [])
  const before = [...f.data], count = f.writes.length
  await f.click()
  assert.equal(calls.length, 1)
  assert.match(calls[0], /Linser <rå>: 200 g.*Tilberedning: rå.*Bekræftet beholdning: 0 g.*Nettokøb: 200 g/)
  assert.doesNotMatch(calls[0], /PRIVATE/)
  assert.match(f.host.textContent, /Kopieret\./)
  assert.equal(f.host.querySelectorAll('rå').length, 0)
  await submit('stock', '-1')
  await f.click()
  assert.equal(calls.length, 2)
  assert.match(calls[1], /Beholdning blev ikke gemt\. Angiv en kendt mængde på mindst 0 i listens enhed\./)
  assert.match(calls[1], /Bekræftet beholdning: 0 g.*Nettokøb: 200 g/)
  assert.deepEqual([...f.data], before); assert.equal(f.writes.length, count)
})

for (const kind of ['rejection', 'missing', 'throw']) {
  test(`mounted ${kind}: honest alert, selectable current text, explicit retry, no automatic fallback`, async t => {
    const calls = []
    const clipboard = kind === 'missing' ? null : { writeText(text) {
      calls.push(text)
      if (kind === 'throw') throw Error('synthetic denial')
      return Promise.reject(Error('synthetic denial'))
    } }
    const f = await fixture(t, clipboard)
    await f.click()
    assert.doesNotMatch(f.host.textContent, /Kopieret\./)
    assert.match(f.host.textContent, /Kopiering kunne ikke bekræftes.*Prøv igen/)
    const textarea = f.host.querySelectorAll('textarea')[0]
    assert.ok(textarea); assert.equal(propsOf(textarea).readOnly, true)
    assert.match(propsOf(textarea).value, /Linser <rå>: 100 g/)
    assert.equal(calls.length, kind === 'missing' ? 0 : 1)
    await act(async () => { await tick() }); assert.equal(calls.length, kind === 'missing' ? 0 : 1)
    await f.render({ clipboard: { writeText(text) { calls.push(text); return Promise.resolve() } } })
    await f.click(); assert.match(f.host.textContent, /Kopieret\./)
    assert.equal(f.host.querySelectorAll('textarea').length, 0)
  })
}

test('pending rapid clicks make one write; dispose invalidates captured callbacks and late success', async t => {
  const calls = []; let finish
  const f = await fixture(t, { writeText(text) { calls.push(text); return new Promise(resolve => { finish = resolve }) } })
  const stale = propsOf(f.button()).onClick
  await act(async () => { stale(); stale() })
  assert.equal(calls.length, 1); assert.equal(propsOf(f.button()).disabled, true)
  assert.match(f.host.textContent, /Kopierer…/)
  await f.dispose(); await stale(); assert.equal(calls.length, 1)
  await act(async () => { finish(); await tick() })
  assert.equal(f.host.textContent, ''); assert.equal(calls.length, 1)
})

test('dispose suppresses late rejection and captured callbacks, without fallback writes', async t => {
  const calls = []; let reject
  const f = await fixture(t, { writeText(text) { calls.push(text); return new Promise((_resolve, fail) => { reject = fail }) } })
  const stale = propsOf(f.button()).onClick
  await act(async () => { stale() })
  await f.dispose()
  await act(async () => { reject(Error('synthetic late denial')); await tick() })
  await stale()
  assert.equal(f.host.textContent, ''); assert.equal(calls.length, 1)
})

test('default adapter is resolved on user click only; OFF removes the action without another lookup', async t => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  const calls = []; let lookups = 0
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
    get clipboard() { lookups++; return { writeText(text) { calls.push(text); return Promise.resolve() } } },
  } })
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor)
    else delete globalThis.navigator
  })
  const f = await fixture(t, undefined)
  assert.equal(lookups, 0)
  await f.click(); assert.equal(lookups, 1); assert.equal(calls.length, 1)
  await f.render({ enabled: false })
  assert.equal(f.host.textContent, ''); assert.equal(lookups, 1)
})

for (const replacement of [{ athleteId: 'PRIVATE-OTHER-OWNER' }, { date: '2026-11-11' }]) {
  test(`mounted context replacement ${Object.keys(replacement)[0]} invalidates old action and acknowledgement`, async t => {
    const calls = []; let finish
    const adapter = { writeText(text) { calls.push(text); return new Promise(resolve => { finish = resolve }) } }
    const f = await fixture(t, adapter), old = propsOf(f.button()).onClick
    await act(async () => { old() }); const oldFinish = finish
    f.seed(replacement); await f.render(replacement)
    await old(); assert.equal(calls.length, 1)
    assert.doesNotMatch(f.host.textContent, /Kopierer|Kopieret/)
    await act(async () => { oldFinish(); await tick() })
    assert.doesNotMatch(f.host.textContent, /Kopieret/)
    await act(async () => { propsOf(f.button()).onClick() }); assert.equal(calls.length, 2)
    await act(async () => { finish(); await tick() }); assert.match(f.host.textContent, /Kopieret\./)
    assert.doesNotMatch(calls.join('\n'), /PRIVATE/)
    if (replacement.date) assert.match(calls[1], /ugen fra 2026-11-09/)
  })
}

test('mounted partial/error snapshots copy exact visible warnings without inventing a complete list', async t => {
  const calls = [], f = await fixture(t, { writeText(text) { calls.push(text); return Promise.resolve() } },
    [{ ...template, ingredients: undefined }])
  await f.click()
  assert.match(f.host.textContent, /Listen er ufuldstændig: 1 måltid/)
  assert.match(calls[0], /Listen er ufuldstændig: 1 måltid mangler ingredienser eller skabelon\./)
  await f.render({ templates: [{ ...template, ingredients: [{ name: 'Fejl', quantity: -1, unit: 'g' }] }] })
  await f.click()
  assert.match(f.host.textContent, /Indkøbslisten kunne ikke beregnes/)
  assert.match(calls[1], /Listen er ufuldstændig/)
  assert.match(calls[1], /Indkøbslisten kunne ikke beregnes/)
  assert.doesNotMatch(calls[1], /Nettokøb|samlet behov/)
})

test('normal lazy nutrition route passes fake clipboard into actual mounted week plan; disposal leaves no action', async t => {
  const { host, restore } = hostFixture(), calls = [], data = new Map(), backend = [], writes = []
  const storage = { getItem: k => data.get(k) ?? null, setItem(k, v) { writes.push(k); data.set(k, v) } }
  const athleteId = 'synthetic:route', date = '2026-11-04'
  const rows = ['a', 'b', 'c'].map(id => ({ id, athlete_id: athleteId, date, meal: 'Route bowl',
    kcal: 400, protein: 20, carb: 60, fat: 10, ingredients: template.ingredients }))
  const controller = createNutritionController({ enabled: true, athlete: { id: athleteId }, date, storage,
    contracts: { load: async () => rows, save: async payload => { backend.push(payload); return true } } })
  let dispose
  t.after(async () => { try { await act(async () => dispose?.()) } finally { restore() } })
  await act(async () => { dispose = mountNutrition(host, controller,
    { clipboard: { writeText(text) { calls.push(text); return Promise.resolve() } } }); await tick() })
  const all = tag => host.querySelectorAll(tag)
  await act(async () => all('button').find(n => n.textContent === 'Gem skabelon: Route bowl').click())
  await act(async () => {
    const fold = all('details').find(n => n.getAttribute('data-focus') === 'week-plan')
    fold.open = true; fold.dispatch('toggle')
  })
  for (let attempt = 0; attempt < 100 && !all('select').some(n => n.getAttribute('data-focus') === 'week-plan-add-0'); attempt++) {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)) })
  }
  const selector = all('select').find(n => n.getAttribute('data-focus') === 'week-plan-add-0')
  assert.ok(selector, 'normal lazy React mount completed')
  await act(async () => propsOf(selector).onChange({ currentTarget: { value: controller.weekPlanInputs().templates[0].id } }))
  assert.deepEqual(calls, [])
  const before = [...data], count = writes.length
  await act(async () => { await propsOf(all('button').find(n => n.textContent === 'Kopiér indkøbsliste')).onClick() })
  assert.equal(calls.length, 1); assert.match(calls[0], /Linser <rå>: 100 g/)
  assert.deepEqual(backend, []); assert.deepEqual([...data], before); assert.equal(writes.length, count)
  await act(async () => dispose()); dispose = null
  assert.equal(host.textContent, '')
})
