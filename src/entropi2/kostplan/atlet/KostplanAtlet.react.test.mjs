// Real React, directly discovered by npm test. No fixture loader, no skip or
// replacement. A missing dependency is a visible failed integration gate.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h, isValidElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import KostplanAtlet, { KostplanAtletView } from './KostplanAtlet.mjs'
import { createTrackedAthleteDay } from './trackerAdapter.mjs'
import { athleteId, date, setup, source } from './day.fixture.mjs'

const nodes = node => !isValidElement(node) ? []
  : [node, ...[node.props.children].flat(Infinity).flatMap(nodes)]
const render = model => renderToStaticMarkup(h(KostplanAtlet, { enabled: true, controller: model }))
const view = model => KostplanAtletView({ enabled: true, snapshot: model.snapshot(),
  onEaten: model.markEaten, onEdit: model.toggleEdit, onGrams: model.setGrams, onRetry: model.load })

test('real React: literal true gate and no OFF dependency access', () => {
  const poison = new Proxy({}, { get() { throw Error('OFF read') } })
  for (const enabled of [undefined, false, 'true', 1, null]) {
    assert.equal(renderToStaticMarkup(h(KostplanAtlet, { enabled, controller: poison, trackerOptions: poison })), '')
    assert.equal(renderToStaticMarkup(h(KostplanAtletView, { enabled, snapshot: poison })), '')
  }
})

test('real React: hook wrapper, grams/macros, escaped names, status, native disclosure and mobile controls', async () => {
  const { model } = setup(); await model.load()
  const html = render(model)
  for (const expected of ['200 g', '100 g', '50 g', '420 kcal', '37 g protein', '58 g kulhydrat',
    '3 g fedt', '0 af 2 måltider spist', 'Frokost &lt;test&gt;', 'min-height:44px']) assert.ok(html.includes(expected), expected)
  assert.match(html, /<details><summary/); assert.doesNotMatch(html, /<details open/)
  assert.match(html, /Tilbage i dag: 2.200 kcal · 140 g protein/)
  assert.match(html, /Spist som planlagt/)
  assert.doesNotMatch(html, /NaN|Infinity|undefined|<test>/)
  assert.equal(nodes(view(model)).filter(n => n.type === 'input').length, 4)
})

test('real React: actual gram-change and one-tap handlers persist and rerender confirmed status', async () => {
  const f = setup(); await f.model.load()
  nodes(view(f.model)).find(n => n.type === 'input').props.onChange({ currentTarget: { value: '125,5' } })
  assert.match(render(f.model), /323 kcal/)
  const save = nodes(view(f.model)).find(n => n.type === 'button')
  await save.props.onClick()
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0].foods[0].grams, 125.5)
  assert.match(render(f.model), /1 af 2 måltider spist/)
  assert.match(render(f.model), /Tilbage i dag: 1.877 kcal · 105 g protein/)
  await save.props.onClick(); assert.equal(f.calls.length, 1)
})

test('real React: failed load, active empty plan, unknown nutrients, missing goals and explicit fallback slot', async () => {
  const failure = setup({ loadDay: async () => { throw Error('synthetic') } }); await failure.model.load()
  assert.match(render(failure.model), /role="alert"/); assert.match(render(failure.model), /Hent dagen igen/)
  const value = source(); value.plan.meals = []
  const empty = setup({ value }); await empty.model.load()
  assert.match(render(empty.model), /ingen måltider i dagens aktive plan/)
  const unknownValue = source(); unknownValue.plan.meals[0].foods[0].kcal100 = null; unknownValue.plan.targets = {}
  const unknown = setup({ value: unknownValue }); await unknown.model.load()
  assert.match(render(unknown.model), /Næringsdata mangler/); assert.match(render(unknown.model), /mål mangler/)
  const noPlan = setup({ value: { plan: null } }); await noPlan.model.load()
  const html = renderToStaticMarkup(h(KostplanAtletView, { enabled: true, snapshot: noPlan.model.snapshot(),
    tracker: h('div', { 'data-existing-tracker': '' }, 'Eksisterende kcal-tracker') }))
  assert.match(html, /data-existing-tracker/); assert.doesNotMatch(html, /Dagens kostplan/)
})

test('real React: planned action uses tracker adapter, confirms remaining intake and restores its receipt', async t => {
  const values = new Map(), rows = []
  const options = { enabled: true, athleteId, date, loadPlan: async () => source().plan,
    storage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
    // Like the real meal_logs read, each load returns a fresh array (no alias to later inserts).
    contracts: { load: async () => [...rows], async saveWithIdentity(row) {
      rows.push({ ...row, id: 'synthetic-react-log' }); return { ok: true, id: 'synthetic-react-log' }
    } } }
  const model = createTrackedAthleteDay(options); t.after(model.dispose); await model.load()
  assert.equal(rows.length, 0); assert.equal(values.size, 0)
  const action = nodes(view(model)).find(n => n.type === 'button' && n.props['aria-label'] === 'Frokost <test>: Spist som planlagt')
  await action.props.onClick()
  assert.equal(rows.length, 1); assert.match(render(model), /Tilbage i dag: 1.780 kcal · 103 g protein/)
  const again = createTrackedAthleteDay(options); t.after(again.dispose); await again.load()
  assert.match(render(again), /1 af 2 måltider spist/)
  assert.equal(await again.markEaten('lunch'), false); assert.equal(rows.length, 1)
})
