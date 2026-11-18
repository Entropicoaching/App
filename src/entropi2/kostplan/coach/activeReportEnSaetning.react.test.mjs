// Required React/ReactDOM reconciliation against the mounted product consumer.
// Synthetic DOM and table transport only. No browser, server or dependency skips.
import test from 'node:test'
import assert from 'node:assert/strict'
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import PortalPlan from './PortalPlan.mjs'
import { openPortalPlan } from './portalModel.mjs'
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


const noPlan = /Ingen aktiv (kostplan|plan) blev fundet/g
const count = host => (host.textContent.match(noPlan) ?? []).length

test('coach Kost tab without an active plan says so once, also with the draft open (ordre 1687)', async () => {
  const f = syntheticTables(), storage = memoryStorage(), c = editor(storage)
  c.set('maintenanceKcal', 2400); c.set('fat', 70); c.generate(); await c.save()
  const doc = sessionReactDocument(), host = doc.createElement('div'); doc.body.append(host)
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
  try {
    root = createRoot(host)
    await act(async () => { root.render(h(PortalPlan, props)); await settle() })
    // Draft closed: the report carries the sentence and the recheck button.
    assert.equal(count(host), 1)
    assert.ok(host.querySelectorAll('button').some(n => n.textContent === 'Kontrollér aktivering igen'))
    const details = host.querySelectorAll('details').find(n => n.querySelector('summary')?.textContent === 'Kostplan')
    await act(async () => { details.open = true; details.dispatch('toggle', { target: details }); await settle() })
    // Draft open: Dagsplan has the sentence, the report does not repeat it.
    assert.match(host.textContent, /Dagsplan/)
    assert.equal(count(host), 1)
    assert.ok(host.querySelectorAll('button').some(n => n.textContent === 'Kontrollér aktivering igen'))
    await act(async () => { details.open = false; details.dispatch('toggle', { target: details }); await settle() })
    // Draft folded again: the sentence is back in the report, outside the folded draft.
    const inDetails = n => { for (let x = n.parentNode; x; x = x.parentNode) if (x.tagName?.toLowerCase() === 'details') return true; return false }
    const shown = host.querySelectorAll('p').filter(n => /Ingen aktiv (kostplan|plan) blev fundet/.test(n.textContent) && !inDetails(n))
    assert.equal(shown.length, 1)
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
