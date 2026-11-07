// Required React/ReactDOM reconciliation against the mounted product consumer.
// Synthetic DOM and table transport only. No browser, server or dependency skips.
import test from 'node:test'
import assert from 'node:assert/strict'
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import PortalPlan from './PortalPlan.mjs'
import { openPortalPlan } from './portalModel.mjs'
import { coachPlanView } from './view.mjs'
import { startPlanActivation } from './activation.mjs'
import { sessionReactDocument } from '../../session/sessionQuickSetReactDom.mjs'
import { syntheticTables, tableNames, flush } from './activation.fixture.mjs'
import { memoryStorage } from './portal.fixture.mjs'
import { FOODS } from '../foedevarer/index.mjs'

const scope = { coachId: 'synthetic-coach', athleteId: 'synthetic-athlete', date: '2026-11-05' }
const athlete = { id: scope.athleteId, protein_target: 120 }
const settle = async () => { await flush(); await flush() }
function editor(storage) {
  return openPortalPlan({ enabled: true, coachId: scope.coachId, athlete, date: scope.date, storage: () => storage,
    template: [{ id: 'meal', name: 'Synthetic meal', items: [{ foodId: FOODS[0].id, grams: 100 }] }] }).controller
}

test('real mounted portal shows schema/active state before first meal log and confirms a reopened draft', async () => {
  const f = syntheticTables({ missing: tableNames[1] }), storage = memoryStorage(), c = editor(storage)
  c.set('maintenanceKcal', 2400); c.set('fat', 70); c.generate(); await c.save()
  const doc = sessionReactDocument(), host = doc.createElement('div'); doc.body.append(host)
  // The shared DOM fixture needs the standard select/option host properties
  // for the real coach form. This adds DOM surface, never React/product logic.
  const create = doc.createElement
  doc.createElement = tag => {
    const node = create(tag)
    if (tag === 'select') Object.defineProperty(node, 'options', { get: () => node.querySelectorAll('option') })
    if (tag === 'option') Object.defineProperty(node, 'value', {
      get: () => node.getAttribute('value') ?? node.textContent,
      set: value => { node.setAttribute('value', value) },
    })
    return node
  }
  const replacements = { window: doc.defaultView, IS_REACT_ACT_ENVIRONMENT: true, localStorage: storage }
  const originals = new Map(Object.keys(replacements).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  for (const [key, value] of Object.entries(replacements)) Object.defineProperty(globalThis, key, { configurable: true, value })
  const props = { enabled: true, coachId: scope.coachId, athlete, date: scope.date, today: scope.date,
    session: { user: { id: scope.coachId } }, client: f.client,
    nutritionRead: { ...scope, state: 'ready', complete: true, mealLogs: [], weightLogs: [] } }
  let root
  const show = () => act(async () => { root.render(h(PortalPlan, props)); await settle() })
  const button = label => host.querySelectorAll('button').find(n => n.textContent === label)
  const click = node => host.dispatch('click', { target: node, button: 0, bubbles: true })
  const open = async () => {
    const details = host.querySelectorAll('details').find(n => n.querySelector('summary')?.textContent === 'Kostplan')
    assert.ok(details)
    await act(async () => { details.open = true; details.dispatch('toggle', { target: details }); await settle() })
  }
  try {
    root = createRoot(host); await show()
    assert.match(host.textContent, /tabeller mangler/)
    assert.doesNotMatch(host.textContent, /Dagsplan til gennemgang/)
    assert.equal(f.writes().length, 0)
    delete f.options.missing
    await act(async () => { click(button('Kontrollér aktivering igen')); await settle() })
    assert.match(host.textContent, /Ingen aktiv kostplan/)
    await open()
    const activate = button('Aktivér for atleten'); assert.ok(activate); assert.equal(activate.disabled, false)
    await act(async () => { click(activate); await settle() })
    assert.equal(f.data[tableNames[2]].length, 1)
    assert.match(host.textContent, /bekræftet aktiv kostplan/)
    assert.equal(props.nutritionRead.mealLogs.length, 0)
    const count = f.writes().length
    await act(async () => root.unmount())
    root = createRoot(host); await show(); await open()
    assert.match(host.textContent, /gemte kladde svarer til atletens bekræftede aktive plan/)
    assert.notEqual(button('Aktivér for atleten').getAttribute('disabled'), null)
    assert.equal(f.writes().length, count)
    // Receipt and owner guards still hide all stale evidence synchronously.
    props.athlete = { id: 'synthetic-other', protein_target: 120 }; await show()
    assert.doesNotMatch(host.textContent, /bekræftet aktiv kostplan|gemte kladde svarer/)
    const beforeOff = f.calls.length
    props.enabled = false; await show()
    assert.equal(host.textContent, ''); assert.equal(f.calls.length, beforeOff)
  } finally {
    try { if (root) await act(async () => root.unmount()) }
    finally {
      for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor)
        else delete globalThis[key]
      }
    }
  }
})

test('real React keeps unresolved edits disabled and exposes an explicit status recheck', async () => {
  const storage = memoryStorage(), c = editor(storage), f = syntheticTables({ lost: tableNames[1] })
  c.set('maintenanceKcal', 2400); c.set('fat', 70); c.generate(); await c.save()
  const stop = startPlanActivation({ controller: c, ...scope, client: f.client }); await settle()
  try {
    assert.equal(await c.activate(), false)
    const html = renderToStaticMarkup(coachPlanView(h, c.snapshot(), c))
    assert.match(html, /aktivering er uafklaret/)
    assert.match(html, /<fieldset disabled=""/)
    assert.doesNotMatch(html, /Planen er aktiveret|bekræftede aktive plan/)
  } finally { stop() }
})
