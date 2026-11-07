import test from 'node:test'
import assert from 'node:assert/strict'
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import Entropi2Kost from '../Entropi2Kost.mjs'
import { fixture, athleteId, date } from '../kostplan/atlet/daySession.fixture.mjs'
import { createNutritionController } from './controller.mjs'
import { mountNutrition } from './view.mjs'
import { mountNutritionScreen } from './index.mjs'
import { all, byKey, propsOf, tick, button, hostFixture } from './diaryTemplate.fixture.mjs'

const meal = { meal: 'Enkel morgenmad', kcal: 400, protein: 20, carb: 60, fat: 9 }
const row = { ...meal, id: 'single-real-identity', athlete_id: athleteId, date }
const actionLabel = 'Gem som skabelon: ' + meal.meal
const click = async (host, label) => {
  const node = button(host, label); assert.ok(node, label)
  await act(async () => { node.click(); await tick() })
}
const enter = (host, key, value) => {
  const node = byKey(host, key); assert.ok(node, key)
  node.value = value; node.dispatch('input', { target: node })
}

async function route(t, options = {}) {
  const f = fixture(options), dom = hostFixture(), calls = []
  f.rows.push({ ...row })
  dom.globals({ localStorage: f.storage, navigator: { clipboard: { writeText(text) { calls.push(text); return Promise.resolve() } } } })
  const root = createRoot(dom.host), props = { enabled: true, athlete: { id: athleteId }, date, client: f.client, foods: [],
    weightLogs: [], weightStatus: { athleteId, state: 'ready' } }
  const render = async () => act(async () => { root.render(h(Entropi2Kost, props)); await tick() })
  t.after(async () => { try { await act(async () => root.unmount()) } finally { dom.restore() } })
  await render()
  return { ...dom, f, props, render, root, calls }
}

test('actual mounted React route and lazy week: one diary row -> explicit template -> ingredients -> repeated occurrences -> real copy', async t => {
  const f = await route(t)
  const nodes = f.host.querySelectorAll('button')
  assert.equal(Object.prototype.toString.call(nodes), '[object NodeList]')
  assert.equal(nodes.includes, undefined); assert.equal(nodes.find, undefined); assert.ok(nodes.item(0))
  assert.equal(f.f.writes.length, 0)
  const originalRows = structuredClone(f.f.rows)
  const old = button(f.host, actionLabel)
  assert.ok(old)
  await click(f.host, actionLabel)
  assert.match(f.host.textContent, /Gemt i Skabeloner/)
  assert.ok(all(f.host, 'summary').some(n => n.textContent === 'Skabeloner'))
  assert.ok(all(f.host, 'summary').some(n => n.textContent === 'Ingredienser: Enkel morgenmad · mangler'))
  assert.equal(f.f.writes.length, 1)
  await act(async () => old.dispatch('click')); assert.equal(f.f.writes.length, 1)
  await click(f.host, actionLabel)
  assert.match(f.host.textContent, /Findes allerede i Skabeloner/); assert.equal(f.f.writes.length, 1)
  await click(f.host, 'Tilføj ingrediens')
  for (const [key, value] of Object.entries({ name: 'Havre', quantity: '75', unit: 'g', source: 'Syntetisk brugeroplysning' })) {
    enter(f.host, 'template-ingredients-0-0-' + key, value)
  }
  await click(f.host, 'Gem ingredienser')
  assert.match(f.host.textContent, /Ingredienser: Enkel morgenmad/)
  await act(async () => { const fold = byKey(f.host, 'week-plan'); fold.open = true; fold.dispatch('toggle'); await tick() })
  for (let i = 0; i < 100 && !byKey(f.host, 'week-plan-add-0'); i++) {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)) })
  }
  const templateKey = 'entropi2:nutrition:skabeloner:v1:' + encodeURIComponent(athleteId)
  const template = JSON.parse(f.f.values.get(templateKey)).templates[0]
  for (const day of [0, 0, 2]) {
    const select = byKey(f.host, 'week-plan-add-' + day); assert.ok(select)
    await act(async () => propsOf(select).onChange({ currentTarget: { value: template.id } }))
  }
  assert.match(f.host.textContent, /Havre: 225 g/)
  const beforeCopy = [...f.f.values], count = f.f.writes.length
  await act(async () => { await propsOf(button(f.host, 'Kopiér indkøbsliste')).onClick() })
  assert.equal(f.calls.length, 1); assert.match(f.calls[0], /Havre: 225 g/)
  assert.match(f.host.textContent, /Kopieret/)
  assert.deepEqual([...f.f.values], beforeCopy); assert.equal(f.f.writes.length, count)
  assert.deepEqual(f.f.rows, originalRows)
  assert.equal(f.f.calls.filter(c => c.action !== 'select').length, 0)
  assert.equal(f.f.plan.writes().length, 0, 'never approves a plan')
  assert.ok(f.f.writes.every(k => k.includes(':skabeloner:v1:') || k.includes(':ugeplan:v1:')))
  // Dispose the nested React island through the existing screen update before
  // unmounting its outer React root. The inherited synchronous nested-root
  // cleanup otherwise defers unmount until after the synthetic tree is cleared.
  byKey(f.host, 'week-plan').open = false
  enter(f.host, 'template-ingredients-0-0-quantity', '76')
  await click(f.host, 'Gem ingredienser')
})

test('same visible action retries local write/read failure and preserves manual/ingredient inputs', async t => {
  const f = await route(t), save = f.f.storage.setItem, read = f.f.storage.getItem
  byKey(f.host, 'log-form').open = true
  enter(f.host, 'field-Måltid', 'Ufærdig kladde'); enter(f.host, 'field-Protein (g)', '12,5')
  f.f.storage.setItem = () => { throw Error('synthetic quota') }
  await click(f.host, actionLabel)
  assert.match(f.host.textContent, /Skabeloner blev ikke gemt/)
  assert.doesNotMatch(f.host.textContent, /Gemt i Skabeloner/)
  assert.ok(all(f.host, '[role="alert"]').length)
  assert.equal(byKey(f.host, 'field-Måltid').value, 'Ufærdig kladde')
  assert.equal(byKey(f.host, 'field-Protein (g)').value, '12,5')
  assert.equal(f.f.writes.length, 0)
  f.f.storage.setItem = save
  await click(f.host, actionLabel); assert.match(f.host.textContent, /Gemt i Skabeloner/)
  await click(f.host, 'Tilføj ingrediens'); enter(f.host, 'template-ingredients-0-0-name', 'Ugemt ingrediens')
  const before = [...f.f.values], count = f.f.writes.length
  f.f.storage.getItem = key => { if (key.includes(':skabeloner:')) throw Error('synthetic read'); return read(key) }
  await click(f.host, actionLabel)
  assert.match(f.host.textContent, /Skabeloner kunne ikke læses/)
  assert.doesNotMatch(f.host.textContent, /Findes allerede|Gemt i Skabeloner/)
  assert.equal(byKey(f.host, 'template-ingredients-0-0-name').value, 'Ugemt ingrediens')
  f.f.storage.getItem = read
  await click(f.host, actionLabel); assert.match(f.host.textContent, /Findes allerede/)
  assert.equal(byKey(f.host, 'template-ingredients-0-0-name').value, 'Ugemt ingrediens')
  assert.equal(byKey(f.host, 'field-Måltid').value, 'Ufærdig kladde')
  assert.deepEqual([...f.f.values], before); assert.equal(f.f.writes.length, count)
  assert.equal(f.f.rows.length, 1)
})

for (const changed of ['athlete', 'date', 'enabled']) test('real React context switch ' + changed + ' invalidates detached diary action', async t => {
  const f = await route(t), old = button(f.host, actionLabel)
  assert.ok(old)
  if (changed === 'athlete') f.props.athlete = { id: 'synthetic-other' }
  else if (changed === 'date') f.props.date = '2026-11-06'
  else f.props.enabled = false
  await f.render()
  await act(async () => old.dispatch('click'))
  assert.equal(f.f.writes.length, 0); assert.equal(f.f.rows.length, 1)
  assert.doesNotMatch(f.host.textContent, /Gemt i Skabeloner/)
})

test('pending log and diary refresh detach old action; disposal blocks late load and old form/click', async t => {
  const dom = hostFixture(), data = new Map(), writes = []; let resolveLog, resolveLoad
  const storage = { getItem: k => data.get(k) ?? null, setItem(k, v) { writes.push(k); data.set(k, v) } }
  let first = true
  const controller = createNutritionController({ enabled: true, athlete: { id: athleteId }, date, storage,
    contracts: { load: () => first ? (first = false, Promise.resolve([row])) : new Promise(resolve => { resolveLoad = resolve }),
      save: () => new Promise(resolve => { resolveLog = resolve }) } })
  let dispose
  t.after(async () => { try { await act(async () => dispose?.()) } finally { dom.restore() } })
  await act(async () => { dispose = mountNutrition(dom.host, controller); await tick() })
  const old = button(dom.host, actionLabel), oldForm = byKey(dom.host, 'field-Måltid').parentElement.parentElement
  let pending
  await act(async () => { pending = controller.log(meal, 'pending-test') })
  assert.equal(button(dom.host, actionLabel).disabled, true)
  await act(async () => old.dispatch('click')); assert.equal(writes.length, 0)
  await act(async () => { resolveLog(false); await pending })
  await act(async () => old.dispatch('click')); assert.equal(writes.length, 0)
  const staleBeforeLoad = button(dom.host, actionLabel)
  let loading
  await act(async () => { loading = controller.load() })
  await act(async () => staleBeforeLoad.dispatch('click')); assert.equal(writes.length, 0)
  await act(async () => dispose()); dispose = null
  await act(async () => { resolveLoad([row]); await loading; old.dispatch('click'); oldForm.dispatch('submit') })
  assert.equal(writes.length, 0); assert.equal(dom.host.textContent, '')
})

test('actual screen OFF leaves synthetic host unchanged and touches no dependency', () => {
  const dom = hostFixture()
  try {
    const poison = new Proxy({}, { get() { throw Error('OFF touched') } })
    for (const entropi2 of [undefined, false, 0, 1, 'true']) {
      dom.host.textContent = 'Bevar eksisterende'
      mountNutritionScreen(dom.host, { entropi2, client: poison, storage: poison })()
      assert.equal(dom.host.textContent, 'Bevar eksisterende')
    }
  } finally { dom.restore() }
})
