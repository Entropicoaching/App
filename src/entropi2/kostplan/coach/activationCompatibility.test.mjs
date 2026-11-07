// Round 2 producer regression cases: actual modules, synthetic data only.
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import CoachKostMaal from '../../kostMaalKobling.mjs'
import { sessionReactDocument } from '../../session/sessionQuickSetReactDom.mjs'
import { openPortalPlan } from './portalModel.mjs'
import { startPlanActivation } from './activation.mjs'
import { syntheticTables, tableNames, flush } from './activation.fixture.mjs'
import { memoryStorage } from './portal.fixture.mjs'
import { FOODS } from '../foedevarer/index.mjs'

const coachId = 'round2-coach', athlete = { id: 'round2-athlete', protein_target: 130 }
const date = '2026-11-07', scope = { athleteId: athlete.id, date }
const settle = async () => { await flush(); await flush() }
const open = storage => openPortalPlan({ enabled: true, coachId, athlete, date, storage: () => storage,
  template: [{ id: 'round2-meal', name: 'Round 2 meal', items: [{ foodId: FOODS[1].id, grams: 125 }] }] })
async function saved(storage) {
  const { controller: c } = open(storage)
  c.set('maintenanceKcal', 2350); c.set('fat', 75)
  assert.equal(c.generate(), true); assert.equal(await c.save(), true)
  return c
}
async function connect(c, f) {
  const stop = startPlanActivation({ controller: c, ...scope, client: f.client })
  await settle()
  return stop
}

test('R2: every missing table/code denies activation without changing saved bytes, IDs or portions', async () => {
  for (const missing of tableNames) for (const missingCode of ['42P01', 'PGRST205']) {
    const storage = memoryStorage(), c = await saved(storage)
    const bytes = [...storage.data.entries()], before = c.snapshot()
    const f = syntheticTables({ missing, missingCode }), stop = await connect(c, f)
    try {
      assert.equal(c.snapshot().activationState, 'unavailable')
      assert.match(c.snapshot().activationError, /tabeller mangler.*lokale kladde er bevaret/)
      assert.equal(c.snapshot().canPublish, false)
      assert.equal(await c.activate(), false); assert.equal(await c.activate(), false)
      assert.equal(c.snapshot().publishedVersion, null)
      assert.equal(c.snapshot().activationPending, false)
      assert.deepEqual(c.snapshot().saved, before.saved)
      assert.deepEqual(c.snapshot().meals, before.meals)
      assert.deepEqual([...storage.data.entries()], bytes)
      const reopened = open(storage)
      assert.equal(reopened.restored, true)
      assert.deepEqual(reopened.controller.snapshot().saved, before.saved)
      assert.deepEqual(reopened.controller.snapshot().meals, before.meals)
      assert.equal(f.writes().length, 0)
      // Local editing and explicit saving remain usable while sharing is unavailable.
      assert.equal(c.editGrams(0, 0, 177), true)
      assert.equal(await c.save(), true)
      assert.equal(await c.activate(), false)
      assert.equal(f.writes().length, 0)
    } finally { stop() }
  }
})

test('R2: denied reads and schema loss at activation preflight never become successful activation', async () => {
  for (const code of ['42501', 'XX000']) {
    const f = syntheticTables({ error: code }), c = await saved(memoryStorage()), stop = await connect(c, f)
    try {
      assert.equal(c.snapshot().activationState, 'error')
      assert.match(c.snapshot().activationError, /kunne ikke kontrolleres/)
      assert.equal(await c.activate(), false); assert.equal(f.writes().length, 0)
      delete f.options.error
      assert.equal(await c.checkActivation(), true)
      assert.equal(c.snapshot().activationState, 'ready')
      f.options.missing = tableNames[2]
      assert.equal(await c.activate(), false)
      assert.equal(c.snapshot().activationState, 'unavailable')
      assert.equal(c.snapshot().publishedVersion, null)
      assert.equal(f.writes().length, 0)
    } finally { stop() }
  }
})

test('R2: schema loss during an unresolved operation cannot release its local reservation', async () => {
  const storage = memoryStorage(), c = await saved(storage)
  const f = syntheticTables({ lost: tableNames[1] }), stop = await connect(c, f)
  assert.equal(await c.activate(), false); stop()
  assert.equal(c.snapshot().activationPending, true)
  const priorRows = structuredClone(f.data), priorBytes = [...storage.data.entries()]
  const count = f.writes().length
  f.options.missing = tableNames[2]
  const reopened = open(storage).controller, stop2 = await connect(reopened, f)
  try {
    assert.equal(reopened.snapshot().activationState, 'unavailable')
    assert.equal(reopened.snapshot().activationPending, true)
    assert.equal(reopened.snapshot().canPublish, false)
    assert.equal(reopened.snapshot().publishedVersion, null)
    assert.equal(await reopened.activate(), false); assert.equal(await reopened.save(), false)
    assert.equal(reopened.editGrams(0, 0, 222), false); assert.equal(reopened.generate(), false)
    assert.deepEqual([...storage.data.entries()], priorBytes)
    assert.deepEqual(f.data, priorRows); assert.equal(f.writes().length, count)
    delete f.options.missing
    assert.equal(await reopened.checkActivation(), true)
    assert.equal(reopened.snapshot().canPublish, false)
    assert.equal(await reopened.activate(), false)
    assert.equal(f.writes().length, count)
  } finally { stop2() }
})

test('R2: real React mounted CoachKostMaal shows early unavailable status and only rechecks on retry', async () => {
  const storage = memoryStorage(), c = await saved(storage)
  let bytes = [...storage.data.entries()]
  const f = syntheticTables({ missing: tableNames[0] })
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
  const replacements = { window: doc.defaultView, IS_REACT_ACT_ENVIRONMENT: true, localStorage: storage,
    __round2SyntheticClient: f.client }
  const originals = new Map(Object.keys(replacements).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  for (const [key, value] of Object.entries(replacements)) Object.defineProperty(globalThis, key, { configurable: true, value })
  // Substitute only the existing client boundary. Never import auth/env or the live client.
  const activationURL = new URL('./activation.mjs', import.meta.url).href
  const hooks = registerHooks({ resolve(specifier, context, next) {
    if (context.parentURL === activationURL && specifier === '../../../supabase.js')
      return { shortCircuit: true, url: 'data:text/javascript,export const supabase = globalThis.__round2SyntheticClient' }
    return next(specifier, context)
  } })
  const props = { enabled: true, athlete, today: date, session: { user: { id: coachId } },
    weightStatus: { athleteId: athlete.id, state: 'ready', rows: [] },
    nutritionRead: { coachId, ...scope, state: 'ready', complete: true, mealLogs: [], weightLogs: [] } }
  let root
  const render = () => act(async () => { root.render(h(CoachKostMaal, props)); await settle() })
  const buttons = label => host.querySelectorAll('button').filter(n => n.textContent === label)
  try {
    root = createRoot(host); await render()
    assert.match(host.textContent, /tabeller mangler/)
    assert.equal(props.nutritionRead.mealLogs.length, 0)
    const details = host.querySelectorAll('details').find(n => n.querySelector('summary')?.textContent === 'Kostplan')
    assert.ok(details)
    await act(async () => { details.open = true; details.dispatch('toggle', { target: details }); await settle() })
    assert.match(host.textContent, /Kladden er kun lokal/)
    assert.equal(buttons('Aktivér for atleten').length, 0)
    assert.equal(buttons('Markér lokal kladde som klar').length, 0)
    assert.equal(buttons('Gem som kladde').length, 1)
    assert.equal(buttons('Gem som kladde')[0].disabled, false)
    await act(async () => {
      host.dispatch('click', { target: buttons('Gem som kladde')[0], button: 0, bubbles: true })
      await settle()
    })
    assert.match(host.textContent, /Lokal kladde gemt/)
    assert.notDeepEqual([...storage.data.entries()], bytes)
    bytes = [...storage.data.entries()]
    assert.equal(JSON.parse(bytes[0][1]).plan.status, 'draft')
    assert.equal(f.writes().length, 0)
    const retry = buttons('Kontrollér aktivering igen').at(-1)
    assert.ok(retry)
    await act(async () => { host.dispatch('click', { target: retry, button: 0, bubbles: true }); await settle() })
    assert.match(host.textContent, /tabeller mangler/)
    assert.equal(f.writes().length, 0)
    assert.deepEqual([...storage.data.entries()], bytes)
    delete f.options.missing
    await act(async () => { host.dispatch('click', { target: buttons('Kontrollér aktivering igen').at(-1), button: 0, bubbles: true }); await settle() })
    assert.equal(buttons('Aktivér for atleten').length, 1)
    assert.equal(buttons('Aktivér for atleten')[0].disabled, false)
    assert.equal(c.snapshot().saved.status, 'draft')
    assert.equal(f.writes().length, 0)
    assert.deepEqual([...storage.data.entries()], bytes)
    props.athlete = { ...athlete, id: 'round2-other' }
    await render()
    assert.doesNotMatch(host.textContent, /Round 2 meal|gemte kladde svarer/)
    const count = f.calls.length
    props.enabled = false; await render()
    assert.equal(host.textContent, ''); assert.equal(f.calls.length, count)
  } finally {
    try { if (root) await act(async () => root.unmount()) }
    finally {
      hooks.deregister()
      for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor)
        else delete globalThis[key]
      }
    }
  }
})
