// Actual product imports and real ReactDOM/StrictMode on the existing synthetic host.
import test from 'node:test'
import assert from 'node:assert/strict'
import { act, createElement as h, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import MealDayOverview from './MealDayOverview.mjs'
import KostplanAtlet from './KostplanAtlet.mjs'
import { consumed, source, setup } from './day.fixture.mjs'
import { seeded, mounted, date } from './plannedMicronutrients.fixture.mjs'
import { all, propsOf, hostFixture, tick } from '../../nutrition/diaryTemplate.fixture.mjs'

const title = 'Dagens måltider i overblik'
const overview = scope => all(scope, 'details').find(n => all(n, 'summary')[0]?.textContent === title)
const progress = scope => all(overview(scope).parentNode, 'p').find(n => n.getAttribute('role') === 'status')
const rows = scope => all(overview(scope), 'li').map(n => all(n, 'span').map(s => s.textContent))
const text = (eaten, unregistered, uncertain) =>
  `Registreringer · Spist: ${eaten} · Ikke registreret: ${unregistered} · Registrering uafklaret: ${uncertain}`
const meals = () => Array.from({ length: 6 }, (_, i) => ({ id: 'synthetic-' + i, name: 'Måltid ' + i }))
const toggle = async (fold, open) => act(async () => { fold.open = open; fold.dispatch('toggle'); await tick() })
const effects = f => JSON.stringify({ writes: f.writes, rows: f.rows, storage: [...f.values],
  planWrites: f.plan.writes(), calls: f.calls, planCalls: f.plan.calls })

async function renderComponent(t, Component, initial) {
  const dom = hostFixture(), root = createRoot(dom.host)
  let props = initial
  const render = async patch => act(async () => {
    props = { ...props, ...patch }
    root.render(h(StrictMode, null, h(Component, props)))
    await tick()
  })
  t.after(async () => { try { await act(async () => root.unmount()) } finally { dom.restore() } })
  await render()
  return { ...dom, render }
}

test('six projected meals: visible counts follow row precedence, update while closed and preserve native open/focus', async t => {
  const list = meals()
  list[0].eaten = true
  list[1].eaten = true; list[1].blocked = true
  list[2].blocked = true
  const ui = await renderComponent(t, MealDayOverview, { meals: list })
  const fold = overview(ui.host), summary = all(fold, 'summary')[0], status = progress(ui.host)
  assert.equal(fold.getAttribute('open'), null)
  assert.equal(summary.textContent, title)
  assert.equal(status.textContent, text(2, 3, 1))
  assert.equal(status.parentNode, fold.parentNode)
  assert.equal(all(fold, '[role="status"]').length, 0, 'counts outside the closed disclosure')
  assert.equal(status.getAttribute('hidden'), null)
  assert.equal(status.getAttribute('aria-hidden'), null)
  assert.deepEqual(rows(ui.host).map(r => r[1]), ['Spist', 'Spist', 'Registrering uafklaret',
    'Ikke registreret', 'Ikke registreret', 'Ikke registreret'])
  assert.ok(propsOf(summary).style.minHeight >= 44)
  assert.equal(propsOf(summary).style.whiteSpace, 'normal')
  assert.equal(propsOf(fold.parentNode).style.maxWidth, '100%')
  assert.equal(propsOf(fold.parentNode).style.minWidth, 0)
  assert.equal(propsOf(fold.parentNode).style.overflowWrap, 'anywhere')
  assert.equal(propsOf(status).style.whiteSpace, 'normal')
  for (const key of ['open', 'onToggle']) assert.equal(propsOf(fold)[key], undefined)
  for (const key of ['role', 'tabIndex', 'onClick', 'onKeyDown', 'aria-expanded']) assert.equal(propsOf(summary)[key], undefined)
  summary.focus()
  await toggle(fold, true)
  await ui.render({ uncertain: true, meals: list.map(meal => ({ ...meal })) })
  assert.equal(overview(ui.host), fold); assert.equal(fold.open, true)
  assert.equal(ui.doc.activeElement, summary); assert.equal(progress(ui.host), status)
  assert.equal(status.textContent, text(2, 0, 4))
  assert.deepEqual(rows(ui.host).map(r => r[1]), ['Spist', 'Spist', ...Array(4).fill('Registrering uafklaret')])
  await toggle(fold, false)
  await ui.render({ uncertain: false, meals: list.map(meal => ({ ...meal, eaten: false, blocked: false })) })
  assert.equal(overview(ui.host), fold); assert.equal(fold.open, false)
  assert.equal(status.textContent, text(0, 6, 0)); assert.equal(ui.doc.activeElement, summary)
  await ui.render({ meals: list.map(meal => ({ ...meal, eaten: true, blocked: true })) })
  assert.equal(status.textContent, text(6, 0, 0))
  assert.deepEqual(rows(ui.host).map(r => r[1]), Array(6).fill('Spist'))
  assert.equal(all(ui.host, 'button,input,form,a,time,progress').length, 0)
})

test('future/readOnly overrides stale eaten and blocked data, including uncertain session', async t => {
  const list = meals().map(meal => ({ ...meal, eaten: true, blocked: true }))
  const ui = await renderComponent(t, MealDayOverview, { meals: list, readOnly: true, uncertain: true })
  const fold = overview(ui.host)
  assert.equal(fold.getAttribute('open'), null)
  assert.equal(progress(ui.host).textContent, '6 planlagte måltider · kun læsning')
  assert.deepEqual(rows(ui.host).map(r => r[1]), Array(6).fill('Planlagt · kun læsning'))
  assert.doesNotMatch(progress(ui.host).textContent, /Spist|registreret|%|kcal/)
  await ui.render({ meals: list.slice(0, 1) })
  assert.equal(progress(ui.host).textContent, '1 planlagt måltid · kun læsning')
  await ui.render({ readOnly: false })
  assert.equal(progress(ui.host).textContent, text(1, 0, 0))
  assert.equal(overview(ui.host), fold)
})

test('absent and empty meals preserve null without a fabricated zero-day summary', async t => {
  const ui = await renderComponent(t, MealDayOverview, {})
  for (const value of [undefined, null, []]) {
    await ui.render({ meals: value })
    assert.equal(ui.host.textContent, '')
    assert.equal(all(ui.host, 'details,p,[role="status"]').length, 0)
    assert.equal(renderToStaticMarkup(h(MealDayOverview, { meals: value })), '')
  }
  await ui.render({ meals: meals() })
  assert.equal(progress(ui.host).textContent, text(0, 6, 0))
  await ui.render({ meals: [] })
  assert.equal(ui.host.textContent, '')
})

test('30 rows keep literal HTML, newlines, long names and supplied order through state updates', async t => {
  const list = Array.from({ length: 30 }, (_, i) => ({ id: String(i),
    name: `${30 - i} · Kl. ${i % 2 ? '07' : '23'}.15 <img src=x> & <script>tekst</script>\n${'Langt dansk måltidsnavn '.repeat(20)}` }))
  const ui = await renderComponent(t, MealDayOverview, { meals: list })
  const fold = overview(ui.host), nodes = all(fold, 'li')
  assert.equal(progress(ui.host).textContent, text(0, 30, 0))
  assert.deepEqual(rows(ui.host).map(r => r[0]), list.map(meal => meal.name))
  for (const row of nodes) assert.equal(propsOf(all(row, 'span')[0]).style.whiteSpace, 'pre-wrap')
  assert.equal(all(ui.host, 'img,script,time').length, 0)
  const html = renderToStaticMarkup(h(MealDayOverview, { meals: list }))
  assert.match(html, /&lt;img src=x&gt;/); assert.match(html, /&lt;script&gt;/)
  assert.match(html, /overflow-wrap:anywhere/); assert.doesNotMatch(html, /<img|<script/)
  await toggle(fold, true)
  await ui.render({ meals: list.map((meal, i) => ({ ...meal, eaten: i % 2 === 0 })) })
  assert.equal(progress(ui.host).textContent, text(15, 15, 0)); assert.equal(fold.open, true)
  assert.deepEqual(rows(ui.host).map(r => r[0]), list.map(meal => meal.name))
  assert.deepEqual(all(fold, 'li'), nodes, 'existing keyed rows retain identity')
})

test('standalone progress rendering and disclosure updates never access callbacks, storage or transport', async t => {
  const calls = []
  const poison = new Proxy({}, { get(_target, key) { calls.push(String(key)); throw Error('Unexpected storage access') } })
  const callback = () => { calls.push('callback'); throw Error('Unexpected callback') }
  const ui = await renderComponent(t, MealDayOverview, { meals: meals(), onChange: callback,
    onEaten: callback, onToggle: callback })
  ui.globals({ localStorage: poison, sessionStorage: poison, fetch: callback, XMLHttpRequest: callback })
  const list = meals().map(Object.freeze)
  Object.freeze(list)
  await ui.render({ meals: list, uncertain: true })
  const fold = overview(ui.host)
  await toggle(fold, true); await toggle(fold, false)
  await ui.render({ readOnly: true })
  assert.equal(progress(ui.host).textContent, '6 planlagte måltider · kun læsning')
  assert.deepEqual(calls, [])
  assert.equal(all(ui.host, 'button,input,form').length, 0)
})

test('actual current controller: six mixed meals, uncertain save, native fold and focused gram draft survive', async t => {
  const value = consumed(), template = value.plan.meals[0]
  for (let i = 0; i < 4; i++) value.plan.meals.push({ ...structuredClone(template), id: 'extra-' + i, name: 'Ekstra ' + i })
  value.blockedMeals = ['lunch', 'extra-0']
  let writes = 0
  const f = setup({ value, saveMeal: async () => { writes++; throw Error('Synthetic missing acknowledgement') } })
  t.after(f.model.dispose); assert.equal(await f.model.load(), true)
  const ui = await renderComponent(t, KostplanAtlet, { enabled: true, controller: f.model })
  const fold = overview(ui.host), status = progress(ui.host)
  assert.equal(status.textContent, text(1, 3, 2))
  assert.equal(fold.getAttribute('open'), null)
  const grams = all(ui.host, 'input').find(n => n.getAttribute('aria-label')?.startsWith('Ekstra 3:'))
  assert.ok(grams)
  await act(async () => { propsOf(grams).onChange({ currentTarget: { value: '123,5' } }); await tick() })
  grams.focus()
  await toggle(fold, true)
  await ui.render({})
  assert.equal(status.textContent, text(1, 3, 2)); assert.equal(writes, 0)
  assert.equal(ui.doc.activeElement, grams); assert.equal(propsOf(grams).value, '123,5')
  await act(async () => { await f.model.markEaten('extra-3'); await tick() })
  assert.equal(f.model.snapshot().phase, 'uncertain')
  assert.equal(progress(ui.host), status); assert.equal(status.textContent, text(1, 0, 5))
  assert.equal(overview(ui.host), fold); assert.equal(fold.open, true)
  assert.equal(ui.doc.activeElement, grams); assert.equal(propsOf(grams).value, '123,5')
  await toggle(fold, false)
  assert.equal(status.textContent, text(1, 0, 5)); assert.equal(writes, 1)
})

test('actual Today/Future/Today route: visible status and user drafts retain caller identities without passive writes', async t => {
  const f = seeded(), ui = await mounted(t, f)
  const fold = overview(ui.today()), status = progress(ui.today())
  assert.equal(status.textContent, text(0, 2, 0))
  const grams = all(ui.today(), 'input').find(n => n.getAttribute('aria-label')?.endsWith('(g)'))
  await act(async () => { propsOf(grams).onChange({ currentTarget: { value: '123,5' } }); await tick() })
  await toggle(fold, true)
  grams.focus()
  const unchanged = effects(f)
  await ui.render()
  assert.equal(ui.doc.activeElement, grams); assert.equal(propsOf(grams).value, '123,5')
  assert.equal(overview(ui.today()), fold); assert.equal(progress(ui.today()), status)
  assert.equal(fold.open, true); assert.equal(effects(f), unchanged)
  await toggle(fold, false)
  assert.equal(status.textContent, text(0, 2, 0))
  await ui.choose('2026-11-06')
  const future = overview(ui.future()), futureStatus = progress(ui.future())
  assert.equal(future.getAttribute('open'), null)
  assert.equal(futureStatus.textContent, '2 planlagte måltider · kun læsning')
  const futureUnchanged = effects(f)
  await toggle(future, true); await toggle(future, false); await ui.render()
  assert.equal(progress(ui.future()), futureStatus); assert.equal(effects(f), futureUnchanged)
  await ui.choose(date)
  assert.equal(overview(ui.today()), fold); assert.equal(progress(ui.today()), status)
  assert.equal(fold.open, false); assert.equal(propsOf(grams).value, '123,5')
  assert.equal(f.rows.length + f.writes.length + f.plan.writes().length, 0)
})

test('actual caller key: new plan revision retires progress and native state, old controller cannot relabel it', async t => {
  const first = setup(); t.after(first.model.dispose); await first.model.load()
  const ui = await renderComponent(t, KostplanAtlet, { enabled: true, controller: first.model })
  const oldFold = overview(ui.host), oldStatus = progress(ui.host)
  await toggle(oldFold, true)
  const value = source(); value.plan.revision = 'r2'; value.plan.meals = value.plan.meals.slice(0, 1)
  const next = setup({ value }); t.after(next.model.dispose); await next.model.load()
  await ui.render({ controller: next.model })
  const current = overview(ui.host), currentStatus = progress(ui.host)
  assert.notEqual(current, oldFold); assert.notEqual(currentStatus, oldStatus)
  assert.equal(current.getAttribute('open'), null); assert.equal(currentStatus.textContent, text(0, 1, 0))
  await act(async () => { first.model.setGrams('lunch', 'rice', '999'); await tick() })
  assert.equal(overview(ui.host), current); assert.equal(progress(ui.host), currentStatus)
  assert.equal(currentStatus.textContent, text(0, 1, 0))
  assert.equal(first.calls.length + next.calls.length, 0)
})
