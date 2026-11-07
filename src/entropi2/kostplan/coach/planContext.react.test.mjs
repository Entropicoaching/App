// Real React/ReactDOM, actual mounted PortalPlan and product calculation.
// Synthetic host and memory data only. Dependencies are required, never skipped.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h, act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import PortalPlan from './PortalPlan.mjs'
import { createDocument, elements, click } from '../../onboarding/firstVisitDom.mjs'
import { memoryStorage } from './portal.fixture.mjs'
import { syntheticTables, flush } from './activation.fixture.mjs'
import { calculateNutrition } from '../beregning.mjs'
import { draftKey } from './portalModel.mjs'

const props = { enabled: true, athlete: { id: 'synthetic-context-athlete', age: 26, bodyweight: 92,
  goal: 'maintain', kcal_target: 3200, protein_target: 180 }, today: '2026-11-05',
  session: { user: { id: 'synthetic-context-coach' } } }
const reactProps = node => {
  const key = Object.keys(node).find(key => key.startsWith('__reactProps$'))
  assert.ok(key, 'Expected committed actual React host props')
  return node[key]
}

async function mounted(run, initial = props) {
  const doc = createDocument(), originalCreate = doc.createElement
  doc.createElement = tag => {
    const el = originalCreate(tag)
    if (tag === 'select') Object.defineProperty(el, 'options', { get: () => el.children.filter(n => n.tagName === 'OPTION') })
    return el
  }
  const host = doc.createElement('div'), storage = memoryStorage(), f = syntheticTables({ missing: true })
  const replacements = { window: doc.defaultView, IS_REACT_ACT_ENVIRONMENT: true, localStorage: storage }
  const originals = new Map(Object.keys(replacements).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  for (const [key, value] of Object.entries(replacements)) Object.defineProperty(globalThis, key, { configurable: true, value })
  const root = createRoot(host)
  const show = next => act(async () => { root.render(h(PortalPlan, { ...next, client: f.client })); await flush() })
  const named = name => elements(host).find(n => (n.name ?? n.getAttribute('name')) === name)
  // The owned DOM has no native text-input stack. Invoke the actual committed
  // handler; state updates/reconciliation still run through real ReactDOM.
  const change = (name, value) => act(async () => reactProps(named(name)).onChange({ currentTarget: { value } }))
  const open = () => act(async () => {
    const details = elements(host).find(n => n.tagName === 'DETAILS')
    reactProps(details).onToggle({ currentTarget: { open: true } }); await flush()
  })
  const generate = () => act(async () => {
    const form = elements(host).find(n => n.tagName === 'FORM' && n.textContent.includes('Vælg måltider til forslaget'))
      ?? elements(host).find(n => n.tagName === 'FORM')
    reactProps(form).onSubmit({ preventDefault() {} })
  })
  try {
    await show(initial)
    await run({ host, storage, f, show, named, change, open, generate,
      press: label => act(async () => { click(host, label); await flush() }) })
  } finally {
    try { await act(async () => root.unmount()) } finally {
      for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor)
        else delete globalThis[key]
      }
    }
  }
}

test('mounted editor separates current coach goal, actual suggestion and portion sum; unknown load stays unknown', () => mounted(async t => {
  assert.equal(t.host.textContent, 'Kostplan'); assert.equal(t.storage.calls.length, 0)
  await t.open()
  const context = () => elements(t.host).find(n => n.getAttribute('aria-label') === 'Mål og plangrundlag')
  assert.ok(context()); assert.match(context().textContent, /Aktuelt coachmål fra profilenVedligehold · 3.200 kcal · 180 g protein/)
  assert.match(context().textContent, /Separat beregningsforslag2.760 kcal · 184 g protein/)
  assert.match(context().textContent, /Planens aktuelle portionssumukendt/)
  assert.match(context().textContent, /Træningsbelastning: ukendt/)
  assert.match(context().textContent, /antagede hviledag er ikke bekræftet træningsdata/)
  assert.equal(t.storage.data.size, 0); assert.equal(t.f.writes().length, 0)
  await t.generate()
  assert.doesNotMatch(context().textContent, /Planens aktuelle portionssumukendt/)
  await t.change('goal', 'cut')
  assert.match(context().textContent, /Aktuelt coachmål fra profilenVedligehold/)
  assert.match(context().textContent, /Mål valgt i kladdenCut/)
  const save = elements(t.host).find(n => n.tagName === 'BUTTON' && n.textContent === 'Gem som kladde')
  assert.equal(reactProps(save).disabled, true)
  assert.equal(t.storage.data.size, 0)
}))

test('mounted high/high reaches the saved draft, reopens, then changed profile training blocks stale save', () => {
  const high = { ...props, athlete: { ...props.athlete, training: { volume: 'high', intensity: 'high' } } }
  return mounted(async t => {
    await t.open()
    assert.match(t.host.textContent, /bekræftet input .*høj\/høj/)
    assert.doesNotMatch(t.host.textContent, /Træningsbelastning, dagsform og historik er ikke koblet ind/)
    await t.generate(); await t.change('grams-0-0', '123,5'); await t.press('Gem som kladde')
    const key = draftKey(props.session.user.id, props.athlete.id, props.today)
    assert.deepEqual([...t.storage.data.keys()], [key])
    const saved = JSON.parse(t.storage.data.get(key))
    assert.deepEqual(saved.calculation.training, high.athlete.training)
    assert.deepEqual(saved.plan.targets, calculateNutrition({ adult: true, date: props.today, weightKg: 92,
      goal: 'maintain', training: high.athlete.training }).targets)
    assert.equal(saved.plan.meals[0].items[0].grams, 123.5)
    await t.show({ ...high, enabled: false }); assert.equal(t.host.textContent, '')
    await t.show(high); await t.open()
    assert.equal(String(t.named('grams-0-0').value), '123.5')
    const before = t.storage.data.get(key)
    await t.show(props) // Same athlete/date, explicit training removed.
    assert.match(t.host.textContent, /Træningsbelastning: ukendt/)
    assert.equal(reactProps(elements(t.host).find(n => n.tagName === 'BUTTON' && n.textContent === 'Gem som kladde')).disabled, true)
    assert.equal(t.storage.data.get(key), before); assert.equal(t.f.writes().length, 0)
  }, high)
})

test('mounted coach notes are bounded manual constraints, do not alter generation or enter saved payload', () => mounted(async t => {
  await t.open()
  for (const [key, value] of [['preferences', '<synthetic-preference>'], ['allergies', 'synthetic-allergy'], ['budget', 'synthetic-budget']]) {
    await t.change(`plan-note-${key}`, value)
    assert.equal(t.named(`plan-note-${key}`).value, value)
  }
  assert.match(t.host.textContent, /Noterne gemmes ikke med planen/)
  assert.match(t.host.textContent, /Ingen automatisk allergikontrol/)
  assert.match(t.host.textContent, /aktuelle priser og automatisk budgetkontrol er ikke tilgængelige/)
  await t.change('plan-note-budget', 'x'.repeat(700))
  assert.equal(t.named('plan-note-budget').value.length, 600)
  await t.generate(); await t.press('Gem som kladde')
  const raw = [...t.storage.data.values()][0]
  assert.ok(raw); assert.doesNotMatch(raw, /synthetic-preference|synthetic-allergy|synthetic-budget|"notes"/)
  assert.equal(t.named('plan-note-allergies').value, 'synthetic-allergy')
  assert.equal(t.f.writes().length, 0)
  await t.show({ ...props, athlete: { ...props.athlete, id: 'synthetic-other' } }); await t.open()
  assert.equal(t.named('plan-note-allergies').value, '')
  assert.equal(t.named('grams-0-0'), undefined)
}))

test('mounted missing age exposes unknown adult evidence without a calculated suggestion', () => mounted(async t => {
  await t.open()
  assert.match(t.host.textContent, /Alder: ukendt. Voksenstatus er ikke bekræftet/)
  assert.match(t.host.textContent, /Separat beregningsforslagIkke tilgængeligt fra profilen/)
  assert.ok(t.named('protein')); assert.ok(t.named('fat'))
  assert.equal(t.storage.data.size, 0); assert.equal(t.f.writes().length, 0)
}, { ...props, athlete: { ...props.athlete, age: undefined } }))

test('actual portal OFF and invalid scope do not inspect profile context or storage', () => {
  for (const enabled of [undefined, false, 1, 'true']) {
    assert.equal(PortalPlan({ enabled, get athlete() { return assert.fail('OFF profile read') } }), null)
    assert.equal(renderToStaticMarkup(h(PortalPlan, { enabled })), '')
  }
  assert.equal(renderToStaticMarkup(h(PortalPlan, { ...props, session: null })), '')
  assert.equal(renderToStaticMarkup(h(PortalPlan, { ...props, today: '2026-02-30' })), '')
})
