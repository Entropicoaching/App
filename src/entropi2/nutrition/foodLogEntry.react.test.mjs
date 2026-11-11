// Real ReactDOM/StrictMode, copied product modules, public synthetic DOM and I/O.
// DOM contracts only: no browser, layout, server, database or live acceptance.
import test from 'node:test'
import assert from 'node:assert/strict'
import { act, createElement as h, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Entropi2Kost, { mountKost } from '../Entropi2Kost.mjs'
import { mountNutrition } from './view.mjs'
import { createNutritionController } from './controller.mjs'
import { sessionReactDocument } from '../session/sessionQuickSetReactDom.mjs'
import { fixture, athleteId, date, flush } from '../kostplan/atlet/daySession.fixture.mjs'
import { LOCAL_FOODS } from '../../athlete/lokaleFoedevarer.js'

const key = (host, value) => [...host.querySelectorAll('[data-focus]')].find(n => n.getAttribute('data-focus') === value)
const buttons = host => [...host.querySelectorAll('button')].filter(n => n.textContent === 'Log mad')
const outer = host => [...host.querySelectorAll('details')].find(n => n.children[0]?.textContent === 'Kostlog og vejning')
const enter = (host, name, value, type = 'input') => {
  const node = key(host, name); assert.ok(node, name)
  node.value = value; node.dispatch(type, { target: node })
}
// Use the synthetic host's public native event surface, letting ReactDOM dispatch
// the real delegated event. No reading or mutation of React's private properties.
const reactEvent = (host, node, type = 'click') => host.dispatch(type, {
  type, target: node, button: 0, bubbles: true, stopPropagation() {},
})
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
const food = { id: 'own-synthetic-food', name: 'Egen syntetisk skål', isCustom: true,
  unit_label: 'skål', unit_grams: 60, kcal100: 121, protein100: 10, carb100: 12, fat100: 3 }
const foods = [food, ...LOCAL_FOODS]
const manualKeys = ['Måltid', 'Energi (kcal)', 'Protein (g)', 'Kulhydrat (g)', 'Fedt (g)'].map(s => 'field-' + s)
const draft = host => [...manualKeys, 'food-search', 'food-choice', 'field-Mængde', 'unit-choice'].map(k => key(host, k)?.value)

async function route(t, options = {}) {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(date + 'T12:00:00Z') })
  const f = fixture(options); if (options.approved) f.approve()
  let storageReads = 0, today = date
  const get = f.storage.getItem; f.storage.getItem = k => { storageReads++; return get(k) }
  const doc = sessionReactDocument(), host = doc.createElement('div'); doc.body.append(host)
  const replacements = { window: doc.defaultView, IS_REACT_ACT_ENVIRONMENT: true, localStorage: f.storage }
  const originals = new Map(Object.keys(replacements).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]))
  for (const [k, value] of Object.entries(replacements)) Object.defineProperty(globalThis, k, { configurable: true, value })
  const props = { enabled: true, athlete: { id: athleteId }, date, client: f.client, foods,
    currentDay: () => today, weightLogs: [], weightStatus: { athleteId, state: 'ready' } }
  const root = createRoot(host)
  const show = () => act(async () => { root.render(h(StrictMode, null, h(Entropi2Kost, props))); await flush(); await flush() })
  t.after(async () => {
    try { await act(async () => root.unmount()) }
    finally {
      for (const [k, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, k, descriptor); else delete globalThis[k]
      }
      t.mock.timers.reset()
    }
  })
  await show()
  const count = () => [f.calls.length, f.plan.calls.length, f.writes.length, storageReads, f.plan.writes().length]
  return { f, doc, host, props, root, show, count, setDay: day => { today = day },
    press: node => act(async () => { reactEvent(host, node || buttons(host)[0]); await flush() }) }
}

for (const approved of [false, true]) {
  test('normal StrictMode route: one top entry opens the same form with zero I/O, plan=' + approved, async t => {
    const r = await route(t, { approved }), { host, doc } = r
    assert.equal(buttons(host).length, 1)
    const entry = buttons(host)[0], fold = outer(host), manual = key(host, 'log-form'), search = key(host, 'food-search')
    assert.ok(Number.parseFloat(entry.style.minHeight) >= 44)
    assert.ok(fold.open === true || fold.getAttribute('open') !== null); assert.equal(!!manual.open, false)
    const controls = [...host.querySelectorAll('button')]
    assert.ok(controls.indexOf(entry) < controls.indexOf(key(host, 'save')))
    const forms = [...host.querySelectorAll('form')], root = search.parentElement.parentElement
    fold.open = false
    const before = r.count()
    await r.press(entry)
    assert.equal(fold.open, true); assert.equal(manual.open, true); assert.equal(doc.activeElement, search)
    await r.press(entry)
    assert.equal(doc.activeElement, search); assert.equal(search.parentElement.parentElement, root)
    assert.deepEqual([...host.querySelectorAll('form')], forms)
    assert.deepEqual(r.count(), before)
    assert.equal(key(host, 'food-choice').querySelectorAll('option').length, foods.length)
    assert.ok(key(host, 'enable-frida-log')); assert.equal(key(host, 'frida-source-summary'), undefined)
    assert.equal(r.f.rows.length, 0)
  })
}

test('normal route: dirty manual and food drafts survive repeated entry, weight props and delayed plan read', async t => {
  const plan = deferred(), r = await route(t, { approved: true, before: () => plan.promise })
  t.after(() => plan.resolve())
  const { host } = r
  for (const [i, k] of manualKeys.entries()) enter(host, k, ['Kladde <&>', '12,5', '', '0', '2,5'][i])
  enter(host, 'unit-choice', '1', 'change'); enter(host, 'field-Mængde', '2,75'); enter(host, 'food-search', 'skål')
  const before = draft(host), tracker = host.querySelectorAll('[data-entropi2-kost]')[0]
  await r.press(); await r.press(); assert.deepEqual(draft(host), before)
  r.props.weightInput = '73,5'; await r.show(); assert.deepEqual(draft(host), before)
  await act(async () => { plan.resolve(); await flush(); await flush() })
  assert.deepEqual(draft(host), before); assert.equal(host.querySelectorAll('[data-entropi2-kost]')[0], tracker)
  assert.equal(r.f.rows.length + r.f.writes.length + r.f.plan.writes().length, 0)
})

test('normal route: failed plan read does not prevent the writable diary entry', async t => {
  const r = await route(t, { before: () => { throw Error('Synthetic plan read unavailable') } })
  assert.match(r.host.textContent, /Kostplanen kunne ikke hentes/)
  await r.press(); assert.equal(r.doc.activeElement, key(r.host, 'food-search'))
  assert.equal(key(r.host, 'log-form').open, true)
})

test('normal route: future selection revokes entry before commit; returning creates a new capability', async t => {
  const r = await route(t), { host, doc } = r
  const retained = buttons(host)[0], select = [...host.querySelectorAll('select')].find(n => n.getAttribute('aria-label') === 'Vælg plandato')
  const foreign = doc.createElement('input'); doc.body.append(foreign); foreign.focus()
  const fold = outer(host), manual = key(host, 'log-form'); fold.open = false
  await act(async () => {
    select.value = '2026-11-06'; reactEvent(host, select, 'change')
    reactEvent(host, retained) // React has queued the preview; it has not committed yet.
    assert.equal(!!manual.open, false); assert.equal(fold.open, false); assert.equal(doc.activeElement, foreign)
    await flush()
  })
  assert.equal(buttons(host).length, 0)
  await r.press(retained); assert.equal(doc.activeElement, foreign); assert.equal(fold.open, false)
  await act(async () => { select.value = date; reactEvent(host, select, 'change'); await flush() })
  assert.equal(buttons(host).length, 1); assert.notEqual(buttons(host)[0], retained)
  await r.press(retained); assert.equal(doc.activeElement, foreign); assert.equal(fold.open, false)
  await r.press(); assert.equal(doc.activeElement, key(host, 'food-search'))
  assert.equal(r.f.rows.length + r.f.writes.length, 0)
})

for (const replacement of ['OFF', 'owner', 'date', 'client', 'unmount', 'midnight', 'currentDay']) {
  test('normal route: retained entry cannot open or focus another session after ' + replacement, async t => {
    const r = await route(t), { host, doc } = r, retained = buttons(host)[0]
    if (replacement === 'OFF') r.props.enabled = false
    if (replacement === 'owner') r.props.athlete = { id: 'other-synthetic-athlete' }
    if (replacement === 'date') r.props.date = '2026-11-06'
    if (replacement === 'client') r.props.client = fixture().client
    if (replacement === 'midnight') t.mock.timers.setTime(new Date('2026-11-06T12:00:00Z').getTime())
    if (replacement === 'currentDay') r.setDay('2026-11-06')
    if (replacement === 'unmount') await act(async () => r.root.render(null))
    else if (!['midnight', 'currentDay'].includes(replacement)) await r.show()
    const fold = outer(host), manual = key(host, 'log-form')
    if (fold) fold.open = false
    const foreign = doc.createElement('input'); doc.body.append(foreign); foreign.focus()
    const before = r.count()
    await r.press(retained)
    assert.equal(doc.activeElement, foreign)
    if (fold) assert.equal(fold.open, false)
    if (manual) assert.equal(!!manual.open, false)
    assert.deepEqual(r.count(), before)
  })
}

test('normal route: busy diary causes no opening/focus/retry; recovery requires explicit click', async t => {
  const gate = deferred(), r = await route(t, { beforeLog: c => c.action === 'insert' ? gate.promise : undefined })
  t.after(() => gate.resolve())
  const { host, doc } = r
  for (const [i, k] of manualKeys.entries()) enter(host, k, ['Synthetic meal', '100', '10', '12', '2'][i])
  const manual = key(host, 'log-form'), fold = outer(host)
  await act(async () => { key(host, 'save').parentElement.dispatch('submit'); await flush() })
  assert.equal(key(host, 'save').disabled, true)
  const liveManual = key(host, 'log-form'); liveManual.open = false; fold.open = false
  const foreign = doc.createElement('input'); doc.body.append(foreign); foreign.focus()
  const before = r.count(); await r.press()
  assert.equal(liveManual.open, false); assert.equal(fold.open, false); assert.equal(doc.activeElement, foreign)
  assert.deepEqual(r.count(), before); assert.notEqual(manual, liveManual)
  await act(async () => { gate.resolve(); await flush(); await flush() })
  assert.equal(fold.open, false); assert.equal(doc.activeElement, foreign)
  await r.press(); assert.equal(fold.open, true); assert.equal(doc.activeElement, key(host, 'food-search'))
  assert.equal(r.f.calls.filter(c => c.action === 'insert').length, 1)
})

async function direct(t, options = {}) {
  let day = date, imports = 0, reads = 0, writes = 0, saves = 0
  const doc = sessionReactDocument(), host = doc.createElement('div'); doc.body.append(host)
  const c = createNutritionController({ enabled: true, athlete: { id: athleteId }, date, foods,
    currentDay: () => day, loadFridaFoods: () => { imports++; throw Error('Unexpected opt-in') },
    storage: { getItem() { reads++; return null }, setItem() { writes++ } },
    contracts: { load: async () => [], save: async () => { saves++; return true }, ...options.contracts } })
  const cleanup = mountNutrition(host, c, { clock: () => new Date(date + 'T12:00:00Z') })
  t.after(cleanup); await flush()
  return { host, doc, c, cleanup, setDay: value => { day = value }, count: () => [imports, reads, writes, saves] }
}

test('public cleanup: same function API, no implicit import/I/O, safe fallback, dirty values and source folds retained', async t => {
  const r = await direct(t), { host, cleanup, doc } = r
  assert.equal(typeof cleanup, 'function'); assert.equal(typeof cleanup.updateWeight, 'function')
  const before = r.count(), forms = [...host.querySelectorAll('form')]
  assert.equal(cleanup.openFoodLog(), true); assert.equal(doc.activeElement, key(host, 'food-search'))
  enter(host, manualKeys[0], 'Syntetisk kladde'); enter(host, 'field-Mængde', '17,5')
  const saved = draft(host)
  cleanup.openFoodLog(); assert.deepEqual([...host.querySelectorAll('form')], forms)
  cleanup.updateWeight({ weightInput: '77' }); assert.deepEqual(draft(host), saved)
  key(host, 'food-search').remove()
  assert.equal(cleanup.openFoodLog(), true); assert.equal(doc.activeElement, key(host, manualKeys[0]))
  assert.deepEqual(r.count(), before)
})

for (const revoked of ['hidden', 'inert', 'readOnly', 'disabled', 'missing-form', 'foreign-root', 'disposed', 'currentDay']) {
  test('public cleanup: fails closed for ' + revoked, async t => {
    const r = await direct(t), { host, doc, cleanup } = r
    const manual = key(host, 'log-form'), foreign = doc.createElement('input'); doc.body.append(foreign)
    if (revoked === 'hidden') host.hidden = true
    if (revoked === 'inert') host.inert = true
    if (revoked === 'readOnly') host.readOnly = true
    if (revoked === 'disabled') host.disabled = true
    if (revoked === 'missing-form') manual.remove()
    if (revoked === 'foreign-root') host.replaceChildren(doc.createElement('div'))
    if (revoked === 'disposed') r.c.dispose()
    if (revoked === 'currentDay') r.setDay('2026-11-06')
    foreign.focus(); const before = r.count()
    assert.equal(cleanup.openFoodLog(), false)
    assert.equal(!!manual.open, false); assert.equal(doc.activeElement, foreign); assert.deepEqual(r.count(), before)
  })
}

test('public cleanup: pending/load-error/readonly and same-host replacement cannot acquire a different form', async t => {
  const gate = deferred(), r = await direct(t, { contracts: { load: () => gate.promise } })
  assert.equal(r.cleanup.openFoodLog(), false)
  gate.resolve([]); await flush(); assert.equal(r.cleanup.openFoodLog(), true)
  const newer = createNutritionController({ enabled: true, athlete: { id: 'synthetic-new-owner' }, date, foods,
    currentDay: () => date, contracts: { load: async () => [] } })
  const second = mountNutrition(r.host, newer, { clock: () => new Date(date + 'T12:00:00Z') }); t.after(second); await flush()
  // Existing view preserves the old disclosure state on a host redraw.
  // Close the new owner's fold explicitly before exercising the stale method.
  const fold = key(r.host, 'log-form'); fold.open = false
  assert.equal(!!fold.open, false)
  assert.equal(r.cleanup.openFoodLog(), false); assert.equal(!!fold.open, false)
  assert.equal(second.openFoodLog(), false) // no existing writer
})

test('legacy direct mountKost retains cleanup/updateWeight and uses the same view entry', async t => {
  const doc = sessionReactDocument(), host = doc.createElement('div'); doc.body.append(host)
  t.mock.timers.enable({ apis: ['Date'], now: new Date(date + 'T12:00:00Z') })
  const f = fixture(), cleanup = mountKost(host, { athlete: { id: athleteId }, date, client: f.client, foods,
    storage: f.storage }, { current: { currentDay: () => date } })
  t.after(cleanup); await flush()
  assert.equal(typeof cleanup, 'function'); assert.equal(typeof cleanup.updateWeight, 'function')
  assert.equal(cleanup.openFoodLog(), true)
  assert.equal(doc.activeElement, key(host, 'food-search'))
  cleanup(); assert.equal(cleanup.openFoodLog(), false)
})


test('normal route: explicit Frida source fold and portion survive entry and prop updates', async t => {
  const r = await route(t), { host } = r
  await r.press()
  await act(async () => {
    key(host, 'enable-frida-log').dispatch('click')
    for (let i = 0; i < 40 && key(host, 'enable-frida-log')?.disabled; i++) await flush()
  })
  assert.equal(key(host, 'enable-frida-log'), undefined)
  const option = [...key(host, 'food-choice').querySelectorAll('option')].find(n => n.textContent.includes('frida55:1)'))
  assert.ok(option)
  enter(host, 'food-choice', option.value, 'change'); enter(host, 'field-Mængde', '31,75')
  enter(host, 'food-search', 'Jordbær')
  const source = key(host, 'frida-source-frida55:1'); source.open = true
  enter(host, manualKeys[0], 'Bevar kladde')
  const before = draft(host), counts = r.count(), manual = key(host, 'log-form')
  await r.press(); await r.press()
  assert.equal(key(host, 'log-form'), manual); assert.equal(key(host, 'frida-source-frida55:1'), source)
  assert.deepEqual(draft(host), before); assert.equal(source.open, true)
  r.props.weightInput = '72'; await r.show()
  assert.deepEqual(draft(host), before); assert.equal(key(host, 'frida-source-frida55:1').open, true)
  assert.deepEqual(r.count(), counts)
})

test('public cleanup: original JSON scope ownership is checked on every explicit call', async t => {
  const owner = {}, other = {}
  let reference = { owner, athleteId, date, state: 'ready', source: 'profile' }
  const dayTargets = { owner, athleteId, date, snapshot: () => reference }
  const r = await direct(t, { contracts: { dayTargets } })
  assert.equal(r.cleanup.openFoodLog(), true)
  const fold = key(r.host, 'log-form'); fold.open = false
  reference = { ...reference, owner: other }
  const foreign = r.doc.createElement('input'); r.doc.body.append(foreign); foreign.focus()
  assert.equal(r.cleanup.openFoodLog(), false)
  assert.equal(fold.open, false); assert.equal(r.doc.activeElement, foreign)
})


test('normal route: throwing day provider blocks entry without replacing the water/tracker drafts; explicit recovery', async t => {
  const r = await route(t), { host, doc } = r
  let throwing = false
  r.props.currentDay = () => { if (throwing) throw Error('Synthetic entry day unavailable'); return date }
  await r.show()
  enter(host, manualKeys[0], 'Bevar kladde ved dagfejl'); enter(host, 'field-Mængde', '27,5')
  const water = [...host.querySelectorAll('details')].find(n => n.children[0]?.textContent === 'Ret dagens vand')
  // U9: portionsknapperne i folden er fjernet (glasset har + 250 / + 500). Det syntetiske dokument kan ikke skrive i
  // Reacts styrede felt, så vandfeltet prøves her kun for, at det bliver stående og ikke erstattes.
  const waterInput = [...water.querySelectorAll('input')].find(n => n.getAttribute('aria-label') === 'Drukket vand i milliliter')
  const retained = buttons(host)[0], fold = outer(host), manual = key(host, 'log-form')
  const search = key(host, 'food-search'), saved = draft(host), forms = [...host.querySelectorAll('form')]
  const foreign = doc.createElement('input'); doc.body.append(foreign); foreign.focus()
  manual.open = false; fold.open = false
  throwing = true
  const before = r.count()
  await r.press(retained) // Provider failure is also checked before any rerender.
  assert.equal(manual.open, false); assert.equal(fold.open, false); assert.equal(doc.activeElement, foreign)
  await r.show()
  assert.equal(buttons(host).length, 0); assert.match(host.textContent, /Ret dagens vand/)
  await r.press(retained)
  assert.equal(manual.open, false); assert.equal(fold.open, false); assert.equal(doc.activeElement, foreign)
  assert.equal(key(host, 'log-form'), manual); assert.equal(key(host, 'food-search'), search)
  assert.deepEqual([...host.querySelectorAll('form')], forms); assert.deepEqual(draft(host), saved)
  assert.equal(waterInput.value, ''); assert.equal(waterInput.isConnected, true)
  assert.deepEqual(r.count(), before)
  throwing = false; await r.show()
  assert.equal(buttons(host).length, 1); assert.notEqual(buttons(host)[0], retained)
  await r.press(retained); assert.equal(manual.open, false); assert.equal(doc.activeElement, foreign)
  await r.press()
  assert.equal(manual.open, true); assert.equal(fold.open, true); assert.equal(doc.activeElement, search)
  assert.equal(key(host, 'log-form'), manual); assert.deepEqual(draft(host), saved)
  assert.equal(waterInput.value, ''); assert.equal(waterInput.isConnected, true)
  assert.deepEqual(r.count(), before)
})
