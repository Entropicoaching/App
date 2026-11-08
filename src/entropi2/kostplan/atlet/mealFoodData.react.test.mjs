// Actual product consumers and ReactDOM/StrictMode, public reference snapshots
// in synthetic plans only. No live transport, browser, loader or skipped checks.
import test from 'node:test'
import assert from 'node:assert/strict'
import { act, createElement as h, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import Entropi2Kost from '../../Entropi2Kost.mjs'
import UpcomingPlan from './UpcomingPlan.mjs'
import KostplanAtlet from './KostplanAtlet.mjs'
import { createAthleteDay, mealValues, mealKey } from './dayModel.mjs'
import { fixture, athleteId, date } from './daySession.fixture.mjs'
import { mounted, nutrientRows, freeze, micros } from './plannedMicronutrients.fixture.mjs'
import { all, propsOf, tick, button, hostFixture, byKey } from '../../nutrition/diaryTemplate.fixture.mjs'
import { tableNames } from '../coach/activation.fixture.mjs'
import { supportedPlanSnapshot } from '../sqlSnapshot.mjs'
import { createFood } from '../foedevarer/index.mjs'
import { FRIDA_FOODS } from '../foedevarer/frida55.mjs'
import { withDatabase, athleteId as sqlAthlete, coachId, owner } from '../coach/generatorSql.fixture.mjs'
import { uuid } from '../dailyReference.fixture.mjs'

const title = 'Fødevaredata for dette måltid'
const missing = 'Næringsgrundlag ikke dokumenteret for denne fødevare'
const unknown = 'Ukendt – mangler data'
const reference = FRIDA_FOODS.find(f => f.id === 'frida55:1')
const literal = '<img src=x onerror="synthetic()">&<b>bogstaveligt</b>'
const citation = literal + ' lang-kilde/'.repeat(180)
const legacy = createFood({ id: 'synthetic-legacy', name: reference.name,
  source: { citation: 'Synthetic legacy only, must not be borrowed', verification: 'synthetic' },
  nutrientsPer100g: { energyKcal: 100, proteinG: 10, carbohydrateG: 12, fatG: 2 } })
const partial = createFood({ id: 'synthetic-id-' + literal, name: reference.name, preparation: 'Kogt ' + literal,
  source: { citation, verification: 'Syntetisk status ' + literal },
  nutrientsPer100g: { ...legacy.nutrientsPer100g, ...micros, ironMg: null, calciumMg: 123.45678, sodiumMg: 0 } })
const snapshot = () => supportedPlanSnapshot({ goal: 'vedligehold', intensity: 0, meals: [
  { name: 'Frokost ' + literal, portions: [reference, legacy, partial].map((food, i) => ({ food, grams: [150.5, 25.25, 12.125][i] })) },
  { name: 'Aftensmad', portions: [{ food: partial, grams: 22.75 }] },
] })
function seeded(options = {}) {
  const f = fixture(options); f.approve()
  const v = { ...structuredClone(f.plan.data[tableNames[1]][0]), ...snapshot(), portion_guidance: 'Uændrede råd ' + literal }
  f.plan.data[tableNames[1]][0] = freeze(v)
  const next = { ...structuredClone(v), id: uuid(990), version_no: 2, effective_from: '2026-11-06' }
  f.plan.data[tableNames[1]].push(freeze(next))
  f.plan.data[tableNames[2]].push({ ...f.plan.data[tableNames[2]][0], version_id: next.id })
  return f
}
const folds = scope => all(scope, 'details').filter(n => all(n, 'summary')[0]?.textContent === title)
const lines = fold => all(fold, 'h3').map(n => n.parentElement)
const rows = line => {
  const dl = all(line, 'dl')[0], dt = all(dl, 'dt'), dd = all(dl, 'dd')
  return Object.fromEntries(dt.map((n, i) => [n.textContent, dd[i].textContent]))
}
const sourceFold = line => all(line, 'details')[0]
const effects = f => JSON.stringify({ plan: f.plan.writes(), diary: f.calls.filter(c => c.action !== 'select'),
  rows: f.rows, writes: f.writes, bytes: [...f.values] })
const reads = f => f.plan.calls.length + f.calls.length
const click = async (host, label) => {
  const n = button(host, label); assert.ok(n, label)
  await act(async () => { await propsOf(n).onClick(); await tick() })
}
async function toggle(fold, open) {
  await act(async () => { fold.open = open; fold.dispatch('toggle'); await tick() })
}
function inspect(scope) {
  const mealFolds = folds(scope)
  assert.equal(mealFolds.length, 2, 'Exactly one disclosure per actual shown meal')
  for (const fold of mealFolds) {
    const summary = all(fold, 'summary')[0]
    assert.equal(fold.getAttribute('open'), null)
    assert.ok(fold.firstChild === summary, 'Native summary is the first child')
    assert.match(summary.getAttribute('aria-label'), /: Fødevaredata for dette måltid$/)
    assert.ok(propsOf(summary).style.minHeight >= 44)
    for (const key of ['role', 'tabIndex', 'onClick', 'onKeyDown', 'aria-expanded']) assert.equal(propsOf(summary)[key], undefined)
    assert.equal(propsOf(fold).onToggle, undefined, 'No application toggle handler')
    assert.match(fold.textContent, /Referenceværdier pr. 100 g/)
    assert.match(fold.textContent, /ikke en måling af din portion eller en eksakt mærkevare/)
    assert.equal(all(fold, 'button,input,form,a').length, 0)
  }
  const [official, old, incomplete] = lines(mealFolds[0])
  assert.deepEqual([official, old, incomplete].map(n => all(n, 'h3')[0].textContent), Array(3).fill(reference.name))
  assert.match(official.textContent, /9 af 9 stoffer har kendte værdier/)
  assert.equal(rows(official)['D-vitamin'], '0 µg', 'Official known zero')
  const officialSource = sourceFold(official)
  assert.ok(officialSource); assert.equal(officialSource.getAttribute('open'), null)
  assert.ok(officialSource.textContent.includes(reference.source.citation), 'Original source tuple text retained')
  assert.ok(officialSource.textContent.includes(reference.id))
  assert.ok(officialSource.textContent.includes(reference.source.verification))
  assert.match(old.textContent, new RegExp(missing))
  assert.match(old.textContent, /0 af 9 stoffer har kendte værdier; 9 er ukendte/)
  assert.deepEqual(Object.values(rows(old)), Array(9).fill(unknown))
  assert.equal(sourceFold(old), undefined, 'Same name never borrows the official source')
  assert.ok(!old.textContent.includes('Referenceværdier pr. 100 g'))
  assert.match(incomplete.textContent, /8 af 9 stoffer har kendte værdier; 1 er ukendte/)
  assert.equal(rows(incomplete).Jern, unknown)
  assert.equal(rows(incomplete).Calcium, '123 mg')
  assert.equal(rows(incomplete).B12, '0,5 µg')
  assert.equal(rows(incomplete).Natrium, '0 mg')
  assert.equal(rows(incomplete)['D-vitamin'], '0 µg')
  assert.ok(incomplete.textContent.includes('Tilberedning/tilstand: ' + partial.preparation))
  const source = sourceFold(incomplete)
  assert.equal(source.getAttribute('open'), null)
  assert.equal(all(source, 'summary')[0].textContent, 'Kilde')
  assert.ok(propsOf(all(source, 'summary')[0]).style.minHeight >= 44)
  assert.ok(!all(source, 'summary')[0].getAttribute('aria-label').includes(citation))
  assert.equal(all(source, 'dd')[0].textContent, citation)
  assert.equal(all(source, 'dd')[1].textContent, partial.id)
  assert.equal(all(source, 'dd')[2].textContent, partial.source.verification)
  assert.equal(propsOf(all(source, 'dl')[0]).style.overflowWrap, 'anywhere')
  assert.equal(all(scope, 'img,b,script').length, 0, 'Food, meal, preparation and source are literal React text')
  assert.doesNotMatch(mealFolds.map(f => f.textContent).join(''), /RDA|%|tilskud|dosis/)
  return mealFolds
}

test('actual normal Entropi2Kost Today/Future disclose each shown line, explicit sources, zero and unknown, with no read/write on opening', async t => {
  const f = seeded(), before = JSON.stringify(f.plan.data), ui = await mounted(t, f)
  const daily = nutrientRows(ui.today())
  assert.deepEqual(Object.values(daily), Array(9).fill(unknown))
  for (const day of [date, '2026-11-06']) {
    if (day !== date) await ui.choose(day)
    const scope = day === date ? ui.today() : ui.future(), current = inspect(scope)
    assert.deepEqual(nutrientRows(scope), daily, 'Daily totals remain the original unknown totals')
    const initial = effects(f), calls = reads(f)
    for (const fold of current) {
      const summary = all(fold, 'summary')[0]; summary.focus(); assert.ok(ui.doc.activeElement === summary, 'Native summary can receive focus')
      await toggle(fold, true)
      for (const source of all(fold, 'details')) { await toggle(source, true); await toggle(source, false) }
      await toggle(fold, false)
      assert.ok(ui.doc.activeElement === summary, 'Native focus survives disclosure reads')
    }
    assert.equal(effects(f), initial); assert.equal(reads(f), calls)
    if (day !== date) assert.deepEqual(all(scope, 'button').map(n => n.textContent), ['Hent planen igen'])
  }
  assert.equal(JSON.stringify(f.plan.data), before)
  assert.equal(f.writes.length, 0); assert.equal(f.rows.length, 0); assert.equal(f.plan.writes().length, 0)
})

test('actual normal route: reference values stay per100g through dirty grams, confirmed receipt, readonly future and preserved manual draft', async t => {
  const f = seeded(), ui = await mounted(t, f), original = JSON.stringify(f.plan.data)
  const daily = nutrientRows(ui.today()), per100 = rows(lines(folds(ui.today())[0])[2])
  const grams = all(ui.today(), 'input').filter(n => n.getAttribute('aria-label')?.endsWith('(g)'))
  await act(async () => { propsOf(grams[0]).onChange({ currentTarget: { value: '12,125' } }); await tick() })
  assert.deepEqual(rows(lines(folds(ui.today())[0])[2]), per100)
  assert.deepEqual(nutrientRows(ui.today()), daily)
  const field = byKey(ui.host, 'field-Måltid'); field.value = 'Ugemt ' + literal; field.dispatch('input', { target: field })
  const plan = f.plan.data[tableNames[1]][0], expectedKcal = Math.round((reference.nutrientsPer100g.energyKcal * 12.125 + 100 * 25.25 + 100 * 12.125) / 100)
  await click(ui.today(), 'Spist med rettede gram')
  assert.equal(f.rows.length, 1); assert.equal(f.rows[0].kcal, expectedKcal)
  assert.match(ui.today().textContent, /1 af 2 måltider spist/)
  const stableField = byKey(ui.host, 'field-Måltid')
  const confirmed = effects(f), calls = reads(f)
  for (const fold of folds(ui.today())) { await toggle(fold, true); await toggle(fold, false) }
  assert.equal(effects(f), confirmed); assert.equal(reads(f), calls)
  await ui.choose('2026-11-06'); inspect(ui.future()); await ui.choose(date)
  assert.ok(byKey(ui.host, 'field-Måltid') === stableField, 'Manual field survives future browsing'); assert.equal(stableField.value, 'Ugemt ' + literal)
  assert.equal(effects(f), confirmed); assert.deepEqual(nutrientRows(ui.today()), daily)
  assert.equal(JSON.stringify(f.plan.data), original)
  assert.equal(plan.meals[0].portions[0].grams, 150.5)
  await click(ui.host, 'Hent kostplan igen')
  assert.match(ui.today().textContent, /1 af 2 måltider spist/)
  assert.deepEqual(rows(lines(folds(ui.today())[0])[2]), per100)
  assert.equal(effects(f), confirmed, 'Restoring confirmed receipt adds no writes')
})

for (const changed of ['athlete', 'date', 'client', 'OFF', 'missing-athlete']) test('actual normal route retires visible source and late prior response on ' + changed, async t => {
  const f = seeded(), ui = await mounted(t, f), other = fixture(); other.approve()
  const oldFold = folds(ui.today())[0]
  await toggle(oldFold, true); await toggle(sourceFold(lines(oldFold)[2]), true)
  assert.ok(ui.today().textContent.includes(citation))
  let release, held = false
  const gate = new Promise(resolve => { release = resolve }); t.after(() => release())
  f.plan.options.before = call => call.table === tableNames[1] && call.limit !== 0 ? (held = true, gate) : undefined
  let pending
  await act(async () => { pending = propsOf(button(ui.host, 'Hent kostplan igen')).onClick(); await tick() })
  assert.ok(held); assert.equal(folds(ui.host).length, 0)
  if (changed === 'athlete') ui.props.athlete = { id: 'synthetic-other' }
  if (changed === 'date') ui.props.date = '2026-11-04'
  if (changed === 'client') ui.props.client = other.client
  if (changed === 'OFF') ui.props.enabled = false
  if (changed === 'missing-athlete') ui.props.athlete = null
  f.plan.options.before = undefined; await ui.render()
  const text = ui.host.textContent
  await act(async () => { release(); await pending; await tick() })
  assert.equal(ui.host.textContent, text); assert.ok(!text.includes(citation))
  assert.ok(!all(ui.host, 'details').includes(oldFold))
  if (changed === 'client') for (const fold of folds(ui.today())) assert.match(fold.textContent, new RegExp(missing))
  if (['OFF', 'missing-athlete'].includes(changed)) assert.equal(text, '')
  assert.equal(f.writes.length + other.writes.length, 0); assert.equal(f.rows.length + other.rows.length, 0)
})

for (const changed of ['athlete', 'date', 'client', 'unmount']) test('actual UpcomingPlan retires opened evidence and ignores old delayed reload on ' + changed, async t => {
  const f = seeded(), other = fixture(), dom = hostFixture(), root = createRoot(dom.host)
  other.approve()
  const future = { ...structuredClone(other.plan.data[tableNames[1]][0]), id: uuid(991), version_no: 3, effective_from: '2026-11-07' }
  f.plan.data[tableNames[1]].push(future)
  f.plan.data[tableNames[2]].push({ ...f.plan.data[tableNames[2]][0], version_id: future.id })
  const next = { ...structuredClone(future), effective_from: '2026-11-06' }
  other.plan.data[tableNames[1]].push(next)
  other.plan.data[tableNames[2]].push({ ...other.plan.data[tableNames[2]][0], version_id: next.id })
  let alive = true, release, holding = false
  const gate = new Promise(resolve => { release = resolve })
  f.plan.options.before = c => holding && c.table === tableNames[1] && c.limit !== 0 ? gate : undefined
  const props = { athleteId, today: date, date: '2026-11-06', client: f.client }
  const render = async () => act(async () => { root.render(h(StrictMode, null, h(UpcomingPlan, props))); await tick() })
  t.after(async () => { try { release(); if (alive) await act(async () => root.unmount()) } finally { dom.restore() } })
  await render(); inspect(dom.host)
  const old = folds(dom.host)[0]; await toggle(old, true)
  holding = true
  let pending
  await act(async () => { pending = propsOf(button(dom.host, 'Hent planen igen')).onClick(); await tick() })
  assert.equal(folds(dom.host).length, 0)
  if (changed === 'athlete') props.athleteId = 'synthetic-other'
  if (changed === 'date') props.date = '2026-11-07'
  if (changed === 'client') props.client = other.client
  holding = false
  if (changed === 'unmount') { await act(async () => root.unmount()); alive = false } else await render()
  const text = dom.host.textContent
  await act(async () => { release(); await pending; await tick() })
  assert.equal(dom.host.textContent, text); assert.ok(!text.includes(citation))
  assert.ok(!all(dom.host, 'details').includes(old))
  assert.equal(f.writes.length + other.writes.length, 0); assert.equal(f.rows.length + other.rows.length, 0)
})

test('actual mounted KostplanAtlet fails closed on unsupported evidence and receipt foods without nutrition; formatting is Danish and bounded', async t => {
  const food = { id: 'shown', name: reference.name, grams: 125, kcal100: 100, protein100: 10, carb100: 12, fat100: 2 }
  const plan = { id: 'plan', revision: 'v1', athlete_id: athleteId, date, active: true, targets: {},
    meals: [{ id: 'meal', name: 'Receipt meal', foods: [{ ...food, nutrition: partial }] }] }
  const initial = createAthleteDay({ enabled: true, athleteId, date, loadDay: async () => ({ plan, logs: [], eaten: [] }) })
  await initial.load(); t.after(initial.dispose)
  let state = initial.snapshot(), calls = 0, listener
  const controller = { snapshot: () => state, subscribe: fn => { listener = fn; return () => { listener = null } },
    load: () => { calls++ }, markEaten: () => { calls++ }, toggleEdit: () => { calls++ }, setGrams: () => { calls++ } }
  const dom = hostFixture(), root = createRoot(dom.host)
  t.after(async () => { try { await act(async () => root.unmount()) } finally { dom.restore() } })
  await act(async () => { root.render(h(StrictMode, null, h(KostplanAtlet, { enabled: true, controller }))); await tick() })
  const update = async nutrition => act(async () => {
    state = { ...state, meals: [{ ...state.meals[0], foods: [{ ...food, nutrition }] }] }; listener(); await tick()
  })
  const bad = [undefined, null, {}, [], { ...partial, basisGrams: 1 }, { ...partial, unexpected: true },
    { ...partial, name: 'Another food' }, { ...partial, source: { citation: 'Incomplete' } },
    { ...partial, nutrientsPer100g: { ...partial.nutrientsPer100g, ironMg: '0' } },
    { ...partial, nutrientsPer100g: { ...partial.nutrientsPer100g, ironMg: -1 } },
    { ...partial, nutrientsPer100g: { ...partial.nutrientsPer100g, ironMg: NaN } },
    { ...partial, nutrientsPer100g: { ...partial.nutrientsPer100g, ironMg: Infinity } },
    { ...partial, nutrientsPer100g: { ...partial.nutrientsPer100g, ironMg: 1e13 } }]
  for (const nutrition of bad) {
    await update(nutrition)
    const fold = folds(dom.host)[0], line = lines(fold)[0]
    assert.match(line.textContent, new RegExp(missing)); assert.deepEqual(Object.values(rows(line)), Array(9).fill(unknown))
    assert.equal(sourceFold(line), undefined)
    await toggle(fold, true); await toggle(fold, false)
  }
  await update({ ...partial, nutrientsPer100g: { ...partial.nutrientsPer100g, ironMg: 0.000123456789, calciumMg: 1e12 } })
  assert.equal(rows(lines(folds(dom.host)[0])[0]).Jern, '0,000123 mg')
  assert.equal(rows(lines(folds(dom.host)[0])[0]).Calcium, '1.000.000.000.000 mg')
  assert.equal(calls, 0)
  // A confirmed shown receipt without nutrition stays unknown even when the
  // approved day had evidence. No lookup of the original plan is performed.
  const values = mealValues([food])
  const receipt = createAthleteDay({ enabled: true, athleteId, date, loadDay: async () => ({ plan,
    logs: [{ id: 'log', athlete_id: athleteId, date, meal: 'Receipt meal', ...values }],
    eaten: [{ meal_id: 'meal', log_id: 'log', key: mealKey(athleteId, date, plan, 'meal'), foods: [food] }] }) })
  t.after(receipt.dispose); assert.equal(await receipt.load(), true)
  state = { ...receipt.snapshot(), meals: receipt.snapshot().meals.map(m => ({ ...m, foods: [food] })) }
  await act(async () => { listener(); await tick() })
  assert.match(dom.host.textContent, /1 af 1 måltid spist/)
  assert.match(lines(folds(dom.host)[0])[0].textContent, new RegExp(missing))
  assert.equal(all(folds(dom.host)[0], 'button,input,form').length, 0)
  const html = renderToStaticMarkup(h(KostplanAtlet, { enabled: true, controller }))
  assert.doesNotMatch(html, /<img|<script|onerror=/)
})

test('original SQL approvals and athlete RLS feed the actual normal Today/Future consumers with public Frida, same-name legacy, partial and known zero', async t => withDatabase(async f => {
  const today = '2026-11-07', future = '2026-11-08', planId = uuid(970)
  t.mock.timers.enable({ apis: ['Date'], now: new Date(today + 'T12:00:00+01:00') })
  const basis = Object.fromEntries(['weight_trend', 'training_volume', 'training_intensity', 'food_log', 'readiness', 'competition_date'].map(k => [k, null]))
  await f.db.exec('reset role')
  await f.db.query('insert into public.kostplan_v1_plans(id,athlete_id,valid_from) values($1,$2,$3)', [planId, sqlAthlete, today])
  for (const [i, day] of [today, future].entries()) {
    await f.db.exec('reset role')
    const s = snapshot(), id = uuid(971 + i)
    await f.db.query(`insert into public.kostplan_v1_versions(id,plan_id,version_no,effective_from,basis_as_of,calculation_basis,rationale,goal,intensity,meals)
      values($1,$2,$3,$4,$5,$6,'Synthetic meal disclosure',$7,$8,$9)`,
    [id, planId, i + 1, day, today, JSON.stringify(basis), s.goal, s.intensity, JSON.stringify(s.meals)])
    await f.login(coachId)
    await f.db.exec('reset role')
    await f.db.query("insert into public.kostplan_v1_approvals(version_id,approval_kind) values($1,'coach')", [id])
  }
  await f.login(owner)
  const before = (await f.db.query('select row_to_json(v) value from public.kostplan_v1_versions v order by version_no')).rows
  const dom = hostFixture(), root = createRoot(dom.host), writes = [], bytes = new Map()
  dom.globals({ localStorage: { getItem: k => bytes.get(k) ?? null, setItem(k, v) { writes.push(k); bytes.set(k, v) } } })
  const scope = label => all(dom.host, 'section').find(n => n.getAttribute('aria-label') === label)
  const wait = async predicate => {
    for (let i = 0; i < 200 && !predicate(); i++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)) })
    assert.ok(predicate(), dom.host.textContent.slice(0, 500))
  }
  try {
    await act(async () => { root.render(h(StrictMode, null, h(Entropi2Kost, { enabled: true, athlete: { id: sqlAthlete },
      date: today, client: f.client, foods: [], weightLogs: [], currentDay: () => today }))); await tick() })
    await wait(() => scope('Dagens kostplan') && folds(scope('Dagens kostplan')).length)
    inspect(scope('Dagens kostplan'))
    const daily = nutrientRows(scope('Dagens kostplan'))
    const picker = all(dom.host, 'select').find(n => n.getAttribute('aria-label') === 'Vælg plandato')
    await act(async () => { propsOf(picker).onChange({ currentTarget: { value: future } }); await tick() })
    await wait(() => scope('Kommende kostplan') && folds(scope('Kommende kostplan')).length)
    const mealFolds = inspect(scope('Kommende kostplan'))
    assert.deepEqual(nutrientRows(scope('Kommende kostplan')), daily)
    assert.deepEqual(Object.values(daily), Array(9).fill(unknown))
    assert.deepEqual(all(scope('Kommende kostplan'), 'button').map(n => n.textContent), ['Hent planen igen'])
    const count = f.calls.length
    for (const fold of mealFolds) {
      await toggle(fold, true)
      for (const source of all(fold, 'details')) { await toggle(source, true); await toggle(source, false) }
      await toggle(fold, false)
    }
    assert.equal(f.calls.length, count); assert.equal(writes.length, 0)
    assert.equal(f.calls.filter(c => c.payload).length, 0)
    assert.equal(Number((await f.db.query('select count(*) n from public.meal_logs')).rows[0].n), 0)
    assert.deepEqual((await f.db.query('select row_to_json(v) value from public.kostplan_v1_versions v order by version_no')).rows, before)
  } finally { try { await act(async () => { root.unmount(); await tick() }) } finally { dom.restore() } }
}))
