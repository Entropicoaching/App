// Real ReactDOM/StrictMode and copied product controllers. Synthetic data only.
import test from 'node:test'
import assert from 'node:assert/strict'
import { act, createElement as h, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import KostplanAtlet from './KostplanAtlet.mjs'
import UpcomingPlan from './UpcomingPlan.mjs'
import { createAthleteDay } from './dayModel.mjs'
import { source, consumed, setup, deferred, athleteId as directAthlete, date as directDate } from './day.fixture.mjs'
import { fixture, athleteId, date } from './daySession.fixture.mjs'
import { mounted, seeded } from './plannedMicronutrients.fixture.mjs'
import { tableNames } from '../coach/activation.fixture.mjs'
import { all, propsOf, tick, button, hostFixture } from '../../nutrition/diaryTemplate.fixture.mjs'

const title = 'Dagens måltider i overblik'
const names = ['Kl. 07.15 · Morgenmad', 'Før træning <img src=x>', 'Efter træning & restitution',
  'Frokost uden klokkeslæt', 'Kl. 18:30 · Aftensmad', 'Aftenmåltid med et meget langt dansk måltidsnavn '.repeat(3).trimEnd()]
const overview = scope => scope && all(scope, 'details').find(n => all(n, 'summary')[0]?.textContent === title)
const rows = scope => all(overview(scope), 'li').map(n => all(n, 'span').map(s => s.textContent))
const toggle = async (fold, open) => act(async () => { fold.open = open; fold.dispatch('toggle'); await tick() })
const click = async (scope, label) => act(async () => {
  const action = button(scope, label); assert.ok(action, label)
  await propsOf(action).onClick(); await tick()
})
const effects = f => JSON.stringify({ plan: f.plan.writes(), diary: f.calls.filter(c => c.action !== 'select'),
  rows: f.rows, writes: f.writes, bytes: [...f.values] })
function sixMeals() {
  const f = fixture(); f.approve()
  const v = f.plan.data[tableNames[1]][0], food = v.meals[0]
  v.meals = names.map(name => ({ ...structuredClone(food), name }))
  const future = { ...structuredClone(v), id: '30000000-0000-4000-8000-000000000099',
    version_no: 2, effective_from: '2026-11-06' }
  f.plan.data[tableNames[1]].push(future)
  f.plan.data[tableNames[2]].push({ ...f.plan.data[tableNames[2]][0], version_id: future.id })
  return f
}
async function direct(t, controller) {
  const dom = hostFixture(), root = createRoot(dom.host)
  let props = { enabled: true, controller }, alive = true
  const render = async patch => act(async () => {
    props = { ...props, ...patch }; root.render(h(StrictMode, null, h(KostplanAtlet, props))); await tick()
  })
  const unmount = async () => { if (alive) { alive = false; await act(async () => { root.unmount(); await tick() }) } }
  t.after(async () => { try { await unmount() } finally { dom.restore() } })
  await render()
  return { ...dom, render, unmount }
}

test('normal six-card Today/Future: native closed ordered list above cards, exact coach names, read-only future and no side effects', async t => {
  const f = sixMeals(), ui = await mounted(t, f), stored = JSON.stringify(f.plan.data)
  for (const day of [date, '2026-11-06']) {
    if (day !== date) await ui.choose(day)
    const scope = day === date ? ui.today() : ui.future(), fold = overview(scope)
    assert.ok(fold); assert.equal(fold.getAttribute('open'), null)
    const summary = all(fold, 'summary')[0]
    assert.equal(fold.firstChild, summary); assert.equal(summary.textContent, title)
    assert.ok(propsOf(summary).style.minHeight >= 44)
    assert.equal(propsOf(fold).style.minWidth, 0)
    assert.equal(propsOf(fold).style.overflowWrap, 'anywhere')
    for (const key of ['role', 'tabIndex', 'onClick', 'onKeyDown', 'aria-expanded']) assert.equal(propsOf(summary)[key], undefined)
    for (const key of ['open', 'onToggle']) assert.equal(propsOf(fold)[key], undefined)
    assert.equal(all(fold, 'ol').length, 1); assert.equal(all(fold, 'li').length, 6)
    assert.deepEqual(rows(scope), names.map(name => [name, day === date ? 'Ikke registreret' : 'Planlagt · kun læsning']))
    const mealSections = all(scope, 'section').filter(n => names.includes(n.getAttribute('aria-label')))
    assert.deepEqual(mealSections.map(n => all(n, 'h2')[0].textContent), names)
    const ordered = all(scope, 'details,section')
    assert.ok(ordered.indexOf(fold) < ordered.indexOf(mealSections[0]))
    assert.equal(all(fold, 'button,input,form,a,time,dl,table,img,script').length, 0)
    const unchanged = effects(f), reads = f.plan.calls.length + f.calls.length
    summary.focus(); await toggle(fold, true); await toggle(fold, false)
    assert.equal(ui.doc.activeElement, summary); assert.equal(effects(f), unchanged)
    assert.equal(f.plan.calls.length + f.calls.length, reads)
    if (day !== date) {
      assert.deepEqual(all(scope, 'button').map(n => n.textContent), ['Hent planen igen'])
      assert.equal(all(scope, 'input').length, 0)
    }
  }
  assert.equal(JSON.stringify(f.plan.data), stored)
  assert.equal(f.rows.length + f.writes.length + f.plan.writes().length, 0)
})

test('real controller distinguishes confirmed, blocked and unregistered; dirty grams do not imply eaten; uncertain save stays unconfirmed', async t => {
  const value = consumed(), extra = structuredClone(value.plan.meals[0])
  extra.id = 'unregistered'; extra.name = 'Kl. 16.00 · Mellemmåltid'
  value.plan.meals.push(extra); value.blockedMeals = ['lunch']
  const f = setup({ value, saveMeal: async () => { throw Error('Synthetic lost acknowledgement') } })
  t.after(f.model.dispose); assert.equal(await f.model.load(), true)
  const ui = await direct(t, f.model)
  assert.deepEqual(rows(ui.host), [['Frokost <test>', 'Registrering uafklaret'], ['Mellemmåltid', 'Spist'], [extra.name, 'Ikke registreret']])
  await act(async () => { f.model.setGrams(extra.id, 'rice', '125,5'); await tick() })
  assert.equal(rows(ui.host)[2][1], 'Ikke registreret')
  assert.match(ui.host.textContent, /1 af 3 måltider spist/)
  const before = f.model.snapshot().totals
  await act(async () => { await f.model.markEaten(extra.id); await tick() })
  assert.equal(f.model.snapshot().phase, 'uncertain')
  assert.deepEqual(rows(ui.host).map(r => r[1]), ['Registrering uafklaret', 'Spist', 'Registrering uafklaret'])
  assert.deepEqual(f.model.snapshot().totals, before)
  assert.equal(f.model.snapshot().eatenCount, 1)
})

test('normal route: overview toggles preserve focused dirty grams, food/source folds, macros and Today/Future/Today identities', async t => {
  const f = seeded(), ui = await mounted(t, f)
  const today = ui.today(), fold = overview(today)
  const food = all(today, 'details').find(n => all(n, 'summary')[0]?.textContent === 'Fødevaredata for dette måltid')
  const sourceFold = all(food, 'details')[0]
  assert.ok(sourceFold)
  await toggle(food, true); await toggle(sourceFold, true)
  const grams = all(today, 'input').find(n => n.getAttribute('aria-label')?.endsWith('(g)'))
  await act(async () => { propsOf(grams).onChange({ currentTarget: { value: '123,5' } }); await tick() })
  const ret = all(today, 'details').find(n => all(n, 'summary')[0]?.textContent.startsWith('Ret gram:'))
  await toggle(ret, true)
  const unchanged = effects(f), reads = f.plan.calls.length + f.calls.length
  const status = all(today, 'section').find(n => n.getAttribute('aria-label') === 'Dagens status').textContent
  grams.focus()
  await toggle(fold, true); await toggle(fold, false); await ui.render()
  assert.equal(ui.doc.activeElement, grams); assert.equal(propsOf(grams).value, '123,5')
  assert.equal(overview(ui.today()), fold); assert.ok(all(ui.today(), 'details').includes(food))
  assert.equal(food.open, true); assert.equal(sourceFold.open, true); assert.equal(ret.open, true)
  assert.equal(all(ui.today(), 'section').find(n => n.getAttribute('aria-label') === 'Dagens status').textContent, status)
  assert.equal(effects(f), unchanged); assert.equal(f.plan.calls.length + f.calls.length, reads)
  await ui.choose('2026-11-06'); assert.ok(overview(ui.future())); await ui.choose(date)
  assert.equal(overview(ui.today()), fold); assert.equal(propsOf(grams).value, '123,5')
  assert.equal(food.open, true); assert.equal(sourceFold.open, true); assert.equal(ret.open, true)
  assert.equal(effects(f), unchanged)
  await click(ui.today(), 'Spist med rettede gram')
  assert.equal(rows(ui.today())[0][1], 'Spist'); assert.equal(rows(ui.today())[1][1], 'Ikke registreret')
  assert.match(ui.today().textContent, /1 af 2 måltider spist/); assert.equal(f.rows.length, 1)
  const confirmed = effects(f)
  await toggle(overview(ui.today()), true); await toggle(overview(ui.today()), false)
  assert.equal(effects(f), confirmed)
})

for (const changed of ['athlete', 'date', 'revision', 'controller']) test('current overview retires scope and late prior response on ' + changed, async t => {
  const first = setup(); t.after(first.model.dispose); await first.model.load()
  const ui = await direct(t, first.model), old = overview(ui.host)
  await toggle(old, true)
  const gate = deferred(), value = source()
  const actor = changed === 'athlete' ? 'another-synthetic-athlete' : directAthlete
  const day = changed === 'date' ? '2026-11-05' : directDate
  value.plan.athlete_id = actor; value.plan.date = day
  if (changed === 'revision') value.plan.revision = 'r2'
  value.plan.meals[0].name = 'Ny plan uden opfundet tidspunkt'
  const next = createAthleteDay({ enabled: true, athleteId: actor, date: day, loadDay: () => gate.promise })
  t.after(next.dispose)
  const loading = next.load(); await ui.render({ controller: next })
  assert.equal(overview(ui.host), undefined); assert.ok(!ui.host.textContent.includes('Frokost'))
  await act(async () => { gate.resolve(value); await loading; await tick() })
  const current = overview(ui.host); assert.ok(current); assert.notEqual(current, old)
  assert.equal(current.getAttribute('open'), null); assert.equal(rows(ui.host)[0][0], value.plan.meals[0].name)
  await act(async () => { first.model.setGrams('lunch', 'rice', '999'); await tick() })
  assert.equal(overview(ui.host), current); assert.equal(rows(ui.host)[0][0], value.plan.meals[0].name)
  await ui.unmount(); assert.equal(all(ui.host, 'details').length, 0)
})

test('no fabricated list during loading, failed reads, empty plan, tracker or OFF; accepted 30-meal plan is not truncated', async t => {
  const f = setup(), ui = await direct(t, f.model); t.after(f.model.dispose)
  assert.equal(overview(ui.host), undefined)
  const values = [{ plan: null }, { ...source(), plan: { ...source().plan, meals: [] } }]
  for (const value of values) {
    const next = setup({ value }); t.after(next.model.dispose); await next.model.load()
    await ui.render({ controller: next.model }); assert.equal(overview(ui.host), undefined)
  }
  const failed = setup({ loadDay: async () => { throw Error('Synthetic') } })
  t.after(failed.model.dispose); await failed.model.load(); await ui.render({ controller: failed.model })
  assert.equal(overview(ui.host), undefined)
  const value = source(), meal = value.plan.meals[0]
  value.plan.meals = Array.from({ length: 30 }, (_, i) => ({ ...structuredClone(meal), id: 'meal-' + i, name: `${i + 1} · ${names[5]} <test>` }))
  const full = setup({ value }); t.after(full.model.dispose); assert.equal(await full.model.load(), true)
  await ui.render({ controller: full.model }); assert.equal(rows(ui.host).length, 30)
  assert.deepEqual(rows(ui.host).map(r => r[0]), value.plan.meals.map(m => m.name))
  const html = renderToStaticMarkup(h(KostplanAtlet, { enabled: true, controller: full.model }))
  assert.match(html, /&lt;test&gt;/); assert.doesNotMatch(html, /<test>|<img|<script/)
  const poison = new Proxy({}, { get() { throw Error('OFF dependency accessed') } })
  assert.equal(renderToStaticMarkup(h(KostplanAtlet, { enabled: false, controller: poison })), '')
  await ui.render({ enabled: false }); assert.equal(ui.host.textContent, '')
})

for (const changed of ['athlete', 'date', 'client', 'unmount']) test('future overview removes old scope and ignores delayed prior reload on ' + changed, async t => {
  const f = sixMeals(), other = sixMeals(), dom = hostFixture(), root = createRoot(dom.host)
  const future = structuredClone(f.plan.data[tableNames[1]][1])
  future.id = '30000000-0000-4000-8000-000000000098'; future.version_no = 3; future.effective_from = '2026-11-07'
  future.meals[0].name = 'Ny fremtidsdato'
  f.plan.data[tableNames[1]].push(future)
  f.plan.data[tableNames[2]].push({ ...f.plan.data[tableNames[2]][0], version_id: future.id })
  const props = { athleteId, today: date, date: '2026-11-06', client: f.client }
  let alive = true
  const gate = deferred()
  const render = async () => act(async () => { root.render(h(StrictMode, null, h(UpcomingPlan, props))); await tick() })
  t.after(async () => { try { gate.resolve(); if (alive) await act(async () => root.unmount()) } finally { dom.restore() } })
  await render(); const old = overview(dom.host); assert.ok(old); await toggle(old, true)
  f.plan.options.before = call => call.table === tableNames[1] && call.limit !== 0 ? gate.promise : undefined
  let pending
  await act(async () => { pending = propsOf(button(dom.host, 'Hent planen igen')).onClick(); await tick() })
  assert.equal(overview(dom.host), undefined)
  if (changed === 'athlete') props.athleteId = 'other-synthetic'
  if (changed === 'date') props.date = '2026-11-07'
  if (changed === 'client') props.client = other.client
  f.plan.options.before = undefined
  if (changed === 'unmount') { alive = false; await act(async () => root.unmount()) } else await render()
  const text = dom.host.textContent, current = overview(dom.host)
  assert.notEqual(current, old)
  if (current) { assert.equal(current.getAttribute('open'), null); assert.ok(rows(dom.host).every(r => r[1] === 'Planlagt · kun læsning')) }
  if (changed === 'date') assert.equal(rows(dom.host)[0][0], future.meals[0].name)
  await act(async () => { gate.resolve(); await pending; await tick() })
  assert.equal(dom.host.textContent, text); assert.equal(overview(dom.host), current)
  assert.equal(f.writes.length + other.writes.length + f.rows.length + other.rows.length, 0)
})
