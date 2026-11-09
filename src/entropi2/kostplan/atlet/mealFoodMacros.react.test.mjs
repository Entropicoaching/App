// Real ReactDOM/StrictMode consumers, copied product modules, synthetic data only.
import test from 'node:test'
import assert from 'node:assert/strict'
import { act, createElement as h, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import KostplanAtlet from './KostplanAtlet.mjs'
import { createAthleteDay } from './dayModel.mjs'
import { fixture, athleteId, date } from './daySession.fixture.mjs'
import { mounted, nutrientRows } from './plannedMicronutrients.fixture.mjs'
import { tableNames } from '../coach/activation.fixture.mjs'
import { createFood } from '../foedevarer/index.mjs'
import { supportedPlanSnapshot } from '../sqlSnapshot.mjs'
import { all, propsOf, tick, button, byKey, hostFixture } from '../../nutrition/diaryTemplate.fixture.mjs'

const heading = 'Energi og makroer pr. 100 g'
const unknown = 'Ukendt – mangler data'
const literal = '<img src=x onerror="synthetic()">&<b>ordret</b>'
const name = 'Samme syntetiske navn ' + literal
const food = (id, nutrients, citation = 'Syntetisk kilde ' + id) => createFood({
  id, name, preparation: 'Syntetisk tilstand ' + literal,
  source: { citation, verification: 'Syntetisk, ikke verificeret ' + id },
  nutrientsPer100g: nutrients,
})
// Deliberately inconsistent with 4/4/9: energy must come from its own field.
const first = food('macro-A', { energyKcal: 73.125, proteinG: 0, carbohydrateG: 12.375, fatG: 0.03125, ironMg: 0 },
  'Kilde A ' + literal + ' meget-lang-kilde/'.repeat(110))
const second = food('macro-B', { energyKcal: 999, proteinG: 8.7654, carbohydrateG: 0, fatG: 2.5, calciumMg: 4 })
const legacy = food('macro-legacy', { energyKcal: 115, proteinG: 9, carbohydrateG: 17, fatG: 3 })
const expectedA = { Energi: '73,1 kcal', Protein: '0 g', Kulhydrat: '12,4 g', Fedt: '0,0313 g' }
const expectedB = { Energi: '999 kcal', Protein: '8,77 g', Kulhydrat: '0 g', Fedt: '2,5 g' }
const folds = scope => all(scope, 'details').filter(n => n.firstChild?.textContent === 'Fødevaredata for dette måltid')
const lines = scope => all(folds(scope)[0], 'h3').map(n => n.parentElement)
const section = line => all(line, 'section').find(n => n.getAttribute('aria-label') === heading)
const rows = dl => Object.fromEntries(all(dl, 'dt').map((n, i) => [n.textContent, all(dl, 'dd')[i].textContent]))
const macros = line => {
  const shown = section(line)
  assert.ok(shown, 'Actual mounted consumer must contain the named macro section')
  assert.equal(all(shown, 'h4')[0].textContent, heading)
  return rows(all(shown, 'dl')[0])
}
const source = line => all(line, 'details')[0]
const effects = f => JSON.stringify({ plans: f.plan.data, planWrites: f.plan.writes(), logs: f.rows,
  logWrites: f.calls.filter(c => c.action !== 'select'), storage: [...f.values], writes: f.writes })
const reads = f => f.calls.length + f.plan.calls.length
const toggle = async (fold, open) => act(async () => { fold.open = open; fold.dispatch('toggle'); await tick() })
const click = async (host, label) => act(async () => { await propsOf(button(host, label)).onClick(); await tick() })
function seeded() {
  const f = fixture(); f.approve()
  const snapshot = supportedPlanSnapshot({ goal: 'vedligehold', intensity: 0, meals: [
    { name: 'Makromåltid', portions: [{ food: first, grams: 17.125 }, { food: second, grams: 275.5 }] },
  ] })
  const current = { ...f.plan.data[tableNames[1]][0], ...snapshot, portion_guidance: 'Bevar råd ' + literal }
  f.plan.data[tableNames[1]][0] = current
  const next = { ...structuredClone(current), id: '30000000-0000-4000-8000-000000000018',
    version_no: 2, effective_from: '2026-11-06' }
  f.plan.data[tableNames[1]].push(next)
  f.plan.data[tableNames[2]].push({ ...f.plan.data[tableNames[2]][0], version_id: next.id })
  return f
}

test('pinned lead: actual normal Today/Future expose four source values, known zero and unchanged nine-micro scope', async t => {
  const f = seeded(), ui = await mounted(t, f)
  const daily = nutrientRows(ui.today()), original = effects(f)
  for (const day of [date, '2026-11-06']) {
    if (day !== date) await ui.choose(day)
    const scope = day === date ? ui.today() : ui.future(), fold = folds(scope)[0]
    const [a, b] = lines(scope)
    assert.equal(fold.getAttribute('open'), null)
    assert.ok(propsOf(fold.firstChild).style.minHeight >= 44)
    assert.deepEqual(macros(a), expectedA); assert.deepEqual(macros(b), expectedB)
    for (const [line, evidence] of [[a, first], [b, second]]) {
      assert.match(line.textContent, /1 af 9 stoffer har kendte værdier; 8 er ukendte/)
      assert.equal(all(all(line, 'dl')[0], 'dt').length, 9)
      assert.equal(all(line, 'h3')[0].textContent, name)
      assert.equal(source(line).getAttribute('open'), null)
      assert.deepEqual(all(source(line), 'dd').map(n => n.textContent),
        [evidence.source.citation, evidence.id, evidence.source.verification])
    }
    assert.ok(!source(b).textContent.includes(first.source.citation))
    assert.deepEqual(nutrientRows(scope), daily)
    const count = reads(f), before = effects(f)
    await toggle(fold, true)
    for (const line of [a, b]) { await toggle(source(line), true); await toggle(source(line), false) }
    await toggle(fold, false)
    assert.equal(reads(f), count); assert.equal(effects(f), before)
    assert.equal(all(fold, 'button,input,a,img,b,script').length, 0)
    if (day !== date) assert.deepEqual(all(scope, 'button').map(n => n.textContent), ['Hent planen igen'])
  }
  assert.equal(effects(f), original)
})

test('normal dirty decimal grams and receipt keep reference macros and manual draft unchanged on inspection', async t => {
  const f = seeded(), ui = await mounted(t, f), originalPlans = JSON.stringify(f.plan.data)
  const daily = nutrientRows(ui.today())
  const grams = all(ui.today(), 'input').find(n => n.getAttribute('aria-label')?.endsWith('(g)'))
  await act(async () => { propsOf(grams).onChange({ currentTarget: { value: '8,0625' } }); await tick() })
  const draft = byKey(ui.host, 'field-Måltid'); draft.value = 'Ugemt makrokladde'; draft.dispatch('input', { target: draft })
  assert.deepEqual(macros(lines(ui.today())[0]), expectedA)
  const before = effects(f), count = reads(f)
  await toggle(folds(ui.today())[0], true); await toggle(source(lines(ui.today())[0]), true)
  assert.equal(effects(f), before); assert.equal(reads(f), count)
  assert.equal(grams.value, '8,0625')
  await click(ui.today(), 'Spist med rettede gram')
  assert.equal(f.rows.length, 1)
  const stableDraft = byKey(ui.host, 'field-Måltid')
  assert.equal(stableDraft.value, 'Ugemt makrokladde')
  const confirmed = effects(f)
  assert.deepEqual(macros(lines(ui.today())[0]), expectedA)
  await ui.choose('2026-11-06'); await ui.choose(date)
  assert.deepEqual(macros(lines(ui.today())[0]), expectedA)
  assert.ok(byKey(ui.host, 'field-Måltid') === stableDraft, 'Manual field remains mounted during date browsing')
  assert.equal(stableDraft.value, 'Ugemt makrokladde')
  assert.equal(effects(f), confirmed); assert.deepEqual(nutrientRows(ui.today()), daily)
  assert.equal(JSON.stringify(f.plan.data), originalPlans)
})

for (const change of ['actor', 'date', 'client', 'OFF', 'unmount']) test('normal macro evidence retires during reload and ignores late answers: ' + change, async t => {
  const f = seeded(), other = fixture(); other.approve()
  const ui = await mounted(t, f)
  assert.deepEqual(macros(lines(ui.today())[0]), expectedA)
  let release, held = false
  const gate = new Promise(resolve => { release = resolve }); t.after(() => release())
  f.plan.options.before = c => c.table === tableNames[1] && c.limit !== 0 ? (held = true, gate) : undefined
  let pending
  await act(async () => { pending = propsOf(button(ui.host, 'Hent kostplan igen')).onClick(); await tick() })
  assert.ok(held); assert.equal(folds(ui.host).length, 0)
  if (change === 'actor') ui.props.athlete = { id: 'macro-other-actor' }
  if (change === 'date') ui.props.date = '2026-11-04'
  if (change === 'client') ui.props.client = other.client
  if (change === 'OFF') ui.props.enabled = false
  f.plan.options.before = undefined
  if (change === 'unmount') await act(async () => { ui.root.unmount(); await tick() })
  else await ui.render()
  const text = ui.host.textContent
  await act(async () => { release(); await pending; await tick() })
  assert.equal(ui.host.textContent, text)
  assert.ok(!text.includes(first.source.citation))
  assert.equal(f.writes.length + other.writes.length + f.rows.length + other.rows.length, 0)
})

// Consumer-boundary coverage: the normal adapter intentionally drops all-micro-
// unknown evidence. A supplied valid snapshot must still render honestly here;
// this test does not claim that upstream retention behavior has changed.
async function consumer(t) {
  const shown = nutrition => ({ id: 'shown-line', name, grams: 313.375,
    kcal100: 115, protein100: 9, carb100: 17, fat100: 3, nutrition })
  const plan = { id: 'macro-plan', revision: 'v1', athlete_id: athleteId, date, active: true,
    meals: [{ id: 'macro-meal', name: 'Syntetisk grænse', foods: [shown(legacy)] }], targets: {} }
  const day = createAthleteDay({ enabled: true, athleteId, date, loadDay: async () => ({ plan, logs: [], eaten: [] }) })
  assert.equal(await day.load(), true); t.after(day.dispose)
  let state = day.snapshot(), listener, calls = 0
  const controller = { snapshot: () => state, subscribe: fn => { listener = fn; return () => { listener = null } },
    load: () => { calls++ }, setGrams: () => { calls++ }, toggleEdit: () => { calls++ }, markEaten: () => { calls++ } }
  const dom = hostFixture(), root = createRoot(dom.host)
  t.after(async () => { try { await act(async () => root.unmount()) } finally { dom.restore() } })
  const render = async enabled => act(async () => { root.render(h(StrictMode, null, h(KostplanAtlet, { enabled, controller }))); await tick() })
  await render(true)
  const update = async (foods, extra = {}) => act(async () => {
    state = { ...state, ...extra, meals: [{ ...state.meals[0], foods }] }; listener(); await tick()
  })
  return { ...dom, shown, update, render, controller, calls: () => calls }
}

test('mounted original athlete: valid macro-only legacy, missing values, malformed source and unsupported amounts remain honest', async t => {
  const ui = await consumer(t)
  await ui.update([ui.shown(legacy)])
  let line = lines(ui.host)[0]
  assert.deepEqual(macros(line), { Energi: '115 kcal', Protein: '9 g', Kulhydrat: '17 g', Fedt: '3 g' })
  assert.match(line.textContent, /0 af 9 stoffer har kendte værdier; 9 er ukendte/)
  assert.deepEqual(Object.values(rows(all(line, 'dl')[0])), Array(9).fill(unknown))
  assert.ok(source(line).textContent.includes(legacy.id))
  const missing = { ...legacy, nutrientsPer100g: { energyKcal: 0, proteinG: null, fatG: null } }
  await ui.update([ui.shown(missing)])
  assert.deepEqual(macros(lines(ui.host)[0]), { Energi: '0 kcal', Protein: unknown, Kulhydrat: unknown, Fedt: unknown })
  for (const nutrition of [undefined, null, {}, { ...legacy, name: 'Fremmed navn' },
    { ...legacy, source: { citation: 'Ufuldstændig kilde' } }, { ...legacy, source: { ...legacy.source, verification: '' } },
    { ...legacy, basisGrams: 1 }, { ...legacy, extra: true },
    ...['0', -1, NaN, Infinity, 1e13, undefined].map(value => ({ ...legacy, nutrientsPer100g: { ...legacy.nutrientsPer100g, energyKcal: value } }))]) {
    await ui.update([ui.shown(nutrition)])
    line = lines(ui.host)[0]
    assert.deepEqual(Object.values(macros(line)), Array(4).fill(unknown))
    assert.match(line.textContent, /Næringsgrundlag ikke dokumenteret/)
    assert.equal(source(line), undefined)
    assert.match(line.textContent, /0 af 9 stoffer har kendte værdier/)
  }
  assert.equal(ui.calls(), 0)
})

test('mounted original athlete: exact shown receipt evidence wins, reordering/removal does not borrow equal-name sources', async t => {
  const ui = await consumer(t), a = { ...ui.shown(first), id: 'receipt-A' }, b = { ...ui.shown(second), id: 'receipt-B' }
  await ui.update([a, b], { pending: true })
  const [oldA, oldB] = lines(ui.host)
  assert.deepEqual(macros(oldA), expectedA); assert.deepEqual(macros(oldB), expectedB)
  await toggle(folds(ui.host)[0], true); await toggle(source(oldB), true)
  await ui.update([b, a])
  assert.ok(lines(ui.host)[0] === oldB, 'Reordering preserves the keyed food line')
  assert.deepEqual(macros(lines(ui.host)[0]), expectedB)
  await ui.update([b])
  assert.ok(lines(ui.host)[0] === oldB, 'Removal preserves the remaining keyed food line')
  assert.ok(!ui.host.textContent.includes(first.source.citation))
  // A currently shown receipt without evidence must not use the approved plan's
  // available snapshot or the flattened macro columns as a reference source.
  await ui.update([{ ...b, nutrition: undefined }], { eatenCount: 1 })
  assert.deepEqual(Object.values(macros(lines(ui.host)[0])), Array(4).fill(unknown))
  assert.equal(source(lines(ui.host)[0]), undefined)
  await ui.update([a])
  const html = renderToStaticMarkup(h(KostplanAtlet, { enabled: true, controller: ui.controller }))
  assert.match(html, /&lt;img/); assert.doesNotMatch(html, /<img|<b>|<script|<a /)
  assert.equal(all(ui.host, 'img,b,script,a').length, 0)
  assert.equal(ui.calls(), 0)
  await ui.render(false); assert.equal(ui.host.textContent, '')
})

// SOURCE3 additions only. All SOURCE2 imports, cases and assertions above are raw unchanged.
import { createPlanAdapter } from '../planAdapter.mjs'
import { retainedNutrition } from './plannedMicronutrients.mjs'

const planHeading = 'Planens makrogrundlag pr. 100 g'
const planNotice = 'Fødevarekilden er ikke dokumenteret i denne visning. Tallene er planens næringsværdier, ikke verificerede fødevarereferencer.'
const exactLegacy = food('macro-legacy-exact', { energyKcal: 88.875, proteinG: 3.125, carbohydrateG: 4.375, fatG: 5.625 })
const expectedLegacy = { Energi: '88,9 kcal', Protein: '3,13 g', Kulhydrat: '4,38 g', Fedt: '5,63 g' }
function planMacros(line) {
  const shown = all(line, 'section').find(n => n.getAttribute('aria-label') === planHeading)
  assert.ok(shown, 'Normal projected legacy must show explicitly labelled plan values')
  assert.equal(all(shown, 'h4')[0].textContent, planHeading)
  assert.ok(shown.textContent.includes(planNotice))
  assert.equal(section(line), undefined, 'Plan values cannot masquerade as reference values')
  assert.equal(source(line), undefined, 'Discarded citation is never recovered or borrowed')
  assert.match(line.textContent, /0 af 9 stoffer har kendte værdier; 9 er ukendte/)
  assert.deepEqual(Object.values(rows(all(line, 'dl')[0])), Array(9).fill(unknown))
  return rows(all(shown, 'dl')[0])
}
function legacySeed() {
  const f = fixture(); f.approve()
  const snapshot = supportedPlanSnapshot({ goal: 'vedligehold', intensity: 0, meals: [
    { name: 'Makromåltid', portions: [{ food: exactLegacy, grams: 812.125 }, { food: first, grams: 6.0625 }] },
  ] })
  const current = { ...f.plan.data[tableNames[1]][0], ...snapshot, portion_guidance: 'Planråd ' + literal }
  f.plan.data[tableNames[1]][0] = current
  const future = { ...structuredClone(current), id: '30000000-0000-4000-8000-000000000028',
    version_no: 2, effective_from: '2026-11-06' }
  f.plan.data[tableNames[1]].push(future)
  f.plan.data[tableNames[2]].push({ ...f.plan.data[tableNames[2]][0], version_id: future.id })
  return f
}

test('SOURCE3 exact fresh-K legacy: unmodified projection, normal Today and Future plan values, nine unknown, no citation borrowing or effects', async t => {
  const f = legacySeed(), stored = JSON.stringify(f.plan.data)
  assert.deepEqual(retainedNutrition(exactLegacy), {})
  const plan = await createPlanAdapter({ enabled: true, athleteId, date, client: f.client }).loadActive()
  const version = f.plan.data[tableNames[1]][0].id
  assert.deepEqual(plan.meals[0].foods[0], { id: `${version}:meal:0:food:0`, name, grams: 812.125,
    kcal100: 88.875, protein100: 3.125, carb100: 4.375, fat100: 5.625 })
  assert.equal('nutrition' in plan.meals[0].foods[0], false, 'No injected metadata at normal route')
  const ui = await mounted(t, f), original = effects(f), daily = nutrientRows(ui.today())
  const overview = () => all(ui.today(), 'details').find(n => n.firstChild?.textContent === 'Dagens måltider i overblik')?.textContent
  const originalOverview = overview()
  assert.ok(originalOverview)
  const draft = byKey(ui.host, 'field-Måltid'); draft.value = 'Plan-ugemt'; draft.dispatch('input', { target: draft })
  const grams = all(ui.today(), 'input').find(n => n.getAttribute('aria-label')?.endsWith('(g)'))
  await act(async () => { propsOf(grams).onChange({ currentTarget: { value: '19,0078125' } }); await tick() })
  assert.deepEqual(planMacros(lines(ui.today())[0]), expectedLegacy, 'No multiplication by dirty portion grams')
  for (const day of [date, '2026-11-06']) {
    if (day !== date) await ui.choose(day)
    const scope = day === date ? ui.today() : ui.future(), fold = folds(scope)[0]
    const [old, reference] = lines(scope)
    assert.equal(fold.getAttribute('open'), null)
    assert.ok(propsOf(fold.firstChild).style.minHeight >= 44)
    assert.equal(propsOf(fold).style.minWidth, 0)
    assert.equal(propsOf(fold).style.maxWidth, '100%')
    assert.deepEqual(planMacros(old), expectedLegacy)
    assert.deepEqual(macros(reference), expectedA)
    assert.ok(source(reference).textContent.includes(first.source.citation))
    assert.ok(!old.textContent.includes(first.source.citation))
    assert.ok(!scope.textContent.includes(exactLegacy.source.citation))
    const before = effects(f), count = reads(f)
    await toggle(fold, true); await toggle(fold, false)
    assert.equal(reads(f), count); assert.equal(effects(f), before)
    assert.deepEqual(nutrientRows(scope), daily)
    assert.equal(all(fold, 'input,button,a,img,script,b').length, 0)
  }
  await ui.choose(date)
  assert.equal(byKey(ui.host, 'field-Måltid').value, 'Plan-ugemt')
  assert.equal(effects(f), original); assert.equal(JSON.stringify(f.plan.data), stored)
  assert.equal(overview(), originalOverview, 'Overview does not change on inspecting plan values')
})

test('SOURCE3 mounted normal legacy receipt retains plan basis per100g, draft and daily micronutrients', async t => {
  const f = legacySeed(), ui = await mounted(t, f), daily = nutrientRows(ui.today())
  const stored = JSON.stringify(f.plan.data)
  const grams = all(ui.today(), 'input').find(n => n.getAttribute('aria-label')?.endsWith('(g)'))
  await act(async () => { propsOf(grams).onChange({ currentTarget: { value: '8,0625' } }); await tick() })
  const draft = byKey(ui.host, 'field-Måltid'); draft.value = 'Plan receipt kladde'; draft.dispatch('input', { target: draft })
  await click(ui.today(), 'Spist med rettede gram')
  assert.equal(f.rows.length, 1, 'Only the explicitly requested meal action writes')
  assert.deepEqual(planMacros(lines(ui.today())[0]), expectedLegacy)
  const confirmed = effects(f), count = reads(f)
  await toggle(folds(ui.today())[0], true); await toggle(folds(ui.today())[0], false)
  assert.equal(effects(f), confirmed); assert.equal(reads(f), count)
  const stableDraft = byKey(ui.host, 'field-Måltid')
  await ui.choose('2026-11-06'); await ui.choose(date)
  assert.deepEqual(planMacros(lines(ui.today())[0]), expectedLegacy)
  assert.ok(byKey(ui.host, 'field-Måltid') === stableDraft)
  assert.equal(stableDraft.value, 'Plan receipt kladde')
  assert.deepEqual(nutrientRows(ui.today()), daily)
  assert.equal(effects(f), confirmed); assert.equal(JSON.stringify(f.plan.data), stored)
})

test('SOURCE3 mounted shown-line plan fields: finite nonnegative numbers only, partial/zero, present bad reference fails closed, no borrowing', async t => {
  const ui = await consumer(t)
  const { nutrition: discarded, ...shown } = ui.shown(legacy)
  assert.ok(discarded)
  const actual = { ...shown, kcal100: 0, protein100: 17.625, carb100: 0.0028125, fat100: 7.125 }
  await ui.update([actual], { eatenCount: 1, pending: true })
  assert.deepEqual(planMacros(lines(ui.host)[0]), { Energi: '0 kcal', Protein: '17,6 g', Kulhydrat: '0,00281 g', Fedt: '7,13 g' },
    'Shown receipt line wins; neither original plan nor energy inferred from other macros')
  const fields = ['kcal100', 'protein100', 'carb100', 'fat100']
  const labels = ['Energi', 'Protein', 'Kulhydrat', 'Fedt']
  const originalValues = planMacros(lines(ui.host)[0])
  for (const [i, field] of fields.entries()) {
    for (const invalid of [null, undefined, NaN, Infinity, -Infinity, -1, '0', '12,5', true, false, {}, []]) {
      await ui.update([{ ...actual, [field]: invalid }])
      assert.deepEqual(planMacros(lines(ui.host)[0]), { ...originalValues, [labels[i]]: unknown })
    }
    const absent = { ...actual }; delete absent[field]
    await ui.update([absent])
    assert.deepEqual(planMacros(lines(ui.host)[0]), { ...originalValues, [labels[i]]: unknown })
  }
  await ui.update([{ id: 'name-only', name, grams: '100' }])
  assert.deepEqual(Object.values(planMacros(lines(ui.host)[0])), Array(4).fill(unknown))
  for (const nutrition of [undefined, null, {}, false, 'legacy', { ...first, name: 'Andet navn' },
    { ...first, source: {} }, { ...first, basisGrams: 1 }]) {
    await ui.update([{ ...actual, nutrition }])
    assert.deepEqual(Object.values(macros(lines(ui.host)[0])), Array(4).fill(unknown))
    assert.equal(all(lines(ui.host)[0], 'section').some(n => n.getAttribute('aria-label') === planHeading), false)
    assert.equal(source(lines(ui.host)[0]), undefined)
  }
  await ui.update([{ ...actual, nutrition: first }])
  assert.deepEqual(macros(lines(ui.host)[0]), expectedA, 'Valid reference remains authoritative over different flattened fields')
  await ui.update([actual])
  const html = renderToStaticMarkup(h(KostplanAtlet, { enabled: true, controller: ui.controller }))
  assert.match(html, /&lt;img/); assert.doesNotMatch(html, /<img|<b>|<script|<a /)
  assert.ok(html.includes(planNotice)); assert.ok(!html.includes(first.source.citation))
  assert.equal(ui.calls(), 0)
})

for (const change of ['actor', 'date', 'client', 'OFF', 'unmount']) test('SOURCE3 normal Future retires plan facts and ignores late old response: ' + change, async t => {
  const f = legacySeed(), other = fixture(); other.approve()
  const ui = await mounted(t, f)
  assert.deepEqual(planMacros(lines(ui.today())[0]), expectedLegacy)
  let release, held = 0
  const gate = new Promise(resolve => { release = resolve }); t.after(() => release())
  f.plan.options.before = c => c.table === tableNames[1] && c.limit !== 0 ? (held++, gate) : undefined
  await ui.choose('2026-11-06')
  assert.ok(held > 0); assert.equal(folds(ui.future()).length, 0)
  if (change === 'actor') ui.props.athlete = { id: 'plan-other-actor' }
  if (change === 'date') ui.props.date = '2026-11-04'
  if (change === 'client') ui.props.client = other.client
  if (change === 'OFF') ui.props.enabled = false
  f.plan.options.before = undefined
  if (change === 'unmount') await act(async () => { ui.root.unmount(); await tick() })
  else await ui.render()
  const text = ui.host.textContent, before = effects(f), alternate = effects(other)
  assert.ok(!text.includes(name), 'Previous shown legacy line is retired; another client may legitimately show its own plan values')
  await act(async () => { release(); await tick(); await tick() })
  assert.equal(ui.host.textContent, text)
  assert.equal(effects(f), before); assert.equal(effects(other), alternate)
  assert.equal(f.rows.length + other.rows.length + f.writes.length + other.writes.length, 0)
})
