// Real React/StrictMode, actual mounted route and adapters, synthetic data only.
import test from 'node:test'
import assert from 'node:assert/strict'
import { act, createElement as h, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Entropi2Kost from '../../Entropi2Kost.mjs'
import { createKostDaySession } from './daySession.mjs'
import { fixture, athleteId, date, flush } from './daySession.fixture.mjs'
import { createWeekPlan } from '../../nutrition/ugeplan/model.mjs'
import { lifecycleFixture, list, focus, propsOf, deferred } from '../../nutrition/ugeplan/lifecycle.fixture.mjs'

const template = { id: JSON.stringify(['Syntetisk skabelon', 100, 5, 10, 2]), name: 'Syntetisk skabelon',
  meal: { meal: 'Syntetisk skabelon', kcal: 100, protein: 5, carb: 10, fat: 2 },
  ingredients: [{ name: 'Linser', quantity: 100, unit: 'g', preparation: 'rå' }] }
const foods = [{ id: 'status-food', name: 'Syntetisk mad', isCustom: true,
  unit_label: 'skål', unit_grams: 80, kcal100: 100, protein100: 5, carb100: 10, fat100: 2 }]
const status = host => list(host, 'section').find(n => n.getAttribute('aria-label') === 'Kostplan fra din coach')
const retry = host => list(status(host), 'button').find(n => n.textContent === 'Hent kostplan igen')
function input(host, key, value, event = 'input') {
  const node = focus(host, key); assert.ok(node, key)
  node.value = value; node.dispatch(event, { target: node })
}
async function mounted(t, options, strict = true) {
  const data = fixture(options)
  data.values.set('entropi2:nutrition:skabeloner:v1:' + encodeURIComponent(athleteId),
    JSON.stringify({ version: 1, templates: [template] }))
  const week = createWeekPlan({ enabled: true, athleteId, date, templates: [template], storage: data.storage })
  assert.equal(week.add(0, template.id), true)
  data.writes.length = 0
  const f = lifecycleFixture(t, data.storage), root = createRoot(f.host)
  f.cleanup(() => root.unmount())
  let props = { enabled: true, athlete: { id: athleteId }, date, client: data.client, foods, weightLogs: [] }
  const render = async change => {
    props = { ...props, ...change }
    await act(async () => { root.render(strict ? h(StrictMode, null, h(Entropi2Kost, props)) : h(Entropi2Kost, props)); await flush() })
  }
  await render()
  const clickRetry = async () => {
    const button = retry(f.host); assert.ok(button, 'a real available retry button')
    await act(async () => {
      f.host.dispatch('click', { type: 'click', target: button, button: 0, bubbles: true, stopPropagation() {} })
      await flush()
    })
  }
  return { ...data, ...f, render, clickRetry }
}

for (const strict of [false, true]) test(`mounted status, StrictMode=${strict}: unavailable -> loading -> empty -> approved -> error preserves all tracker drafts and nested week`, { timeout: 5000 }, async t => {
  const options = { missing: true }, f = await mounted(t, options, strict)
  assert.match(status(f.host).textContent, /kunne ikke hentes/)
  assert.doesNotMatch(status(f.host).textContent, /Du har ingen aktiv/)
  const tracker = f.host.querySelector('[data-entropi2-kost]'), content = tracker.firstChild
  assert.equal(tracker.parentElement.tagName, 'DETAILS')
  // Populate the actual manual, search, ingredient and nested React consumers.
  focus(f.host, 'log-form').open = true
  input(f.host, 'field-Måltid', 'Ufærdigt måltid')
  input(f.host, 'field-Energi (kcal)', '125,5')
  input(f.host, 'food-search', 'syntetisk')
  input(f.host, 'unit-choice', '1', 'change')
  input(f.host, 'field-Mængde', '1,25')
  input(f.host, 'template-ingredients-0-0-quantity', '12,')
  const fold = focus(f.host, 'week-plan')
  await act(async () => { fold.open = true; fold.dispatch('toggle'); await import('../../nutrition/ugeplan/reactMount.mjs'); await flush() })
  const islandSelect = focus(f.host, 'week-plan-add-0'); assert.ok(islandSelect)
  const portion = list(f.host, 'input').find(n => n.name === 'portions'); assert.ok(portion)
  portion.value = '2,'
  const source = [...f.values], writes = f.writes.length
  const unchanged = () => {
    assert.equal(f.host.querySelector('[data-entropi2-kost]'), tracker)
    assert.equal(tracker.firstChild, content)
    assert.equal(focus(f.host, 'field-Måltid').value, 'Ufærdigt måltid')
    assert.equal(focus(f.host, 'field-Energi (kcal)').value, '125,5')
    assert.equal(focus(f.host, 'food-search').value, 'syntetisk')
    assert.equal(focus(f.host, 'unit-choice').value, '1')
    assert.equal(focus(f.host, 'field-Mængde').value, '1,25')
    assert.equal(focus(f.host, 'template-ingredients-0-0-quantity').value, '12,')
    assert.equal(focus(f.host, 'week-plan').open, true)
    assert.equal(focus(f.host, 'week-plan-add-0'), islandSelect)
    assert.equal(list(f.host, 'input').find(n => n.name === 'portions'), portion)
    assert.equal(portion.value, '2,')
    assert.deepEqual([...f.values], source); assert.equal(f.writes.length, writes)
    assert.equal(f.rows.length, 0); assert.equal(f.plan.writes().length, 0)
    assert.ok(f.calls.every(c => c.action === 'select'))
  }
  unchanged()
  const gate = deferred(); t.after(() => gate.resolve()); options.before = () => gate.promise; options.missing = false
  const beforeCalls = f.plan.calls.length
  await f.clickRetry()
  assert.ok(f.plan.calls.length > beforeCalls, 'click issues a fresh query on the same underlying client')
  assert.match(status(f.host).textContent, /Henter din kostplan…/)
  assert.match(status(f.host).textContent, /indkøbsliste/)
  assert.doesNotMatch(f.host.textContent, /\ufffd|Ã|Â/)
  assert.equal(retry(f.host), undefined, 'no extra enabled retry while loading')
  unchanged()
  options.before = undefined
  await act(async () => { gate.resolve(); await flush() })
  assert.match(status(f.host).textContent, /Du har ingen aktiv kostplan.*Bed din coach/)
  assert.doesNotMatch(status(f.host).textContent, /tre|3 log|opret.*skabelon/i)
  assert.equal(list(status(f.host), 'button').length, 1, 'instruction plus real retry, no draft-losing navigation')
  unchanged()
  f.approve(); await f.clickRetry()
  assert.match(status(f.host).textContent, /godkendte kostplan/)
  assert.match(f.host.textContent, /Frokost <syntetisk>.*200 g.*Spist som planlagt/)
  unchanged()
  options.error = '42501'; await f.clickRetry()
  assert.match(status(f.host).textContent, /kunne ikke hentes/)
  assert.doesNotMatch(status(f.host).textContent, /Du har ingen aktiv/)
  unchanged()
  delete options.error; await f.clickRetry()
  assert.match(status(f.host).textContent, /godkendte kostplan/)
  unchanged()
  f.plan.data.kostplan_v1_plans.length = 0; await f.clickRetry()
  assert.match(status(f.host).textContent, /Du har ingen aktiv kostplan/)
  unchanged()
  // Local shopping still works without any coach plan, on an explicit user save.
  const form = portion.parentElement.parentElement
  await act(async () => propsOf(form).onSubmit({ preventDefault() {}, currentTarget: { elements: { portions: { value: '2' } } } }))
  assert.match(f.host.textContent, /Linser: 200 g/)
  assert.ok(f.writes.length > writes)
  assert.equal(f.plan.writes().length, 0); assert.equal(f.rows.length, 0)
})

test('actual day session: permission/transport/data failures remain errors; explicit retry reprobes every table and diary errors never become empty', async t => {
  for (const error of ['42501', 'XX000']) {
    const options = { error }, f = fixture(options)
    const s = createKostDaySession({ enabled: true, athleteId, date, client: f.client, storage: f.storage }); t.after(s.dispose)
    assert.equal(await s.controller.load(), false)
    assert.equal(s.controller.snapshot().phase, 'load-error')
    delete options.error; assert.equal(await s.controller.load(), true)
    assert.equal(s.controller.snapshot().mode, 'tracker')
    f.approve(); options.logError = true
    assert.equal(await s.controller.load(), false)
    assert.equal(s.controller.snapshot().mode, null)
    options.logError = false; assert.equal(await s.controller.load(), true)
    assert.equal(s.controller.snapshot().mode, 'plan')
    options.missing = true
    assert.equal(await s.controller.load(), false, 'formerly available schema is not cached as available')
    assert.equal(s.controller.snapshot().phase, 'load-error')
    assert.equal(f.rows.length, 0); assert.equal(f.plan.writes().length, 0); assert.deepEqual(f.writes, [])
  }
})

for (const switchTo of ['athlete', 'date', 'OFF']) test(`mounted StrictMode: delayed retry cannot publish after ${switchTo}`, { timeout: 5000 }, async t => {
  const options = { missing: true }, f = await mounted(t, options)
  const staleRetry = propsOf(retry(f.host)).onClick
  const gate = deferred(); t.after(() => gate.resolve()); options.before = () => gate.promise; options.missing = false; f.approve()
  await f.clickRetry()
  options.before = undefined
  const change = switchTo === 'athlete' ? { athlete: { id: 'status-other' } } : switchTo === 'date' ? { date: '2026-11-04' } : { enabled: false }
  await f.render(change)
  await act(async () => { gate.resolve(); await flush() })
  assert.doesNotMatch(f.host.textContent, /Dagens kostplan|Frokost <syntetisk>/)
  const calls = f.plan.calls.length
  await act(async () => { assert.equal(await staleRetry(), false); await flush() })
  assert.equal(f.plan.calls.length, calls, 'disposed retry performs no fresh reads')
  assert.equal(f.rows.length, 0); assert.equal(f.plan.writes().length, 0); assert.deepEqual(f.writes, [])
})
