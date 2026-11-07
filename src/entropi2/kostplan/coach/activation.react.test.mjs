// REQUIRED real React gate, discovered by the app's npm test. Missing installed
// dependencies are a failure, never a substitute React package or a silent skip.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h, isValidElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ActivePlan, { activePlanView } from '../atlet/ActivePlan.mjs'
import PlanActivation, { startPlanActivation } from './activation.mjs'
import { createPlanAdapter } from '../planAdapter.mjs'
import { openPortalPlan } from './portalModel.mjs'
import { coachPlanView } from './view.mjs'
import { syntheticTables, tableNames, flush } from './activation.fixture.mjs'
import { memoryStorage } from './portal.fixture.mjs'
import { FOODS } from '../foedevarer/index.mjs'

const scope = { athleteId: 'synthetic-athlete', date: '2026-11-05' }
const walk = node => !isValidElement(node) ? [] : [node, ...[node.props.children].flat(Infinity).flatMap(walk)]
function editor() {
  const storage = memoryStorage()
  const { controller } = openPortalPlan({ enabled: true, coachId: 'synthetic-coach',
    athlete: { id: scope.athleteId, protein_target: 120 }, date: scope.date, storage: () => storage,
    template: [{ id: 'synthetic-meal', name: '<synthetic meal>', items: [{ foodId: FOODS[0].id, grams: 100 }] }] })
  return controller
}

test('real React event handlers save locally, activate via adapter and render the approved athlete plan', async () => {
  const f = syntheticTables(), storage = memoryStorage()
  const { controller: c } = openPortalPlan({ enabled: true, coachId: 'synthetic-coach',
    athlete: { id: scope.athleteId, protein_target: 120 }, date: scope.date, storage: () => storage,
    template: [{ id: 'synthetic-meal', name: '<synthetic meal>', items: [{ foodId: FOODS[0].id, grams: 100 }] }] })
  c.set('maintenanceKcal', 2400); c.set('fat', 70); c.generate()
  const cleanup = startPlanActivation({ controller: c, ...scope, client: f.client }); await flush()
  const tree = () => coachPlanView(h, c.snapshot(), c)
  const button = label => walk(tree()).find(n => n.type === 'button' && n.props.children === label)
  assert.equal(button('Aktivér for atleten').props.disabled, true)
  await button('Gem som kladde').props.onClick()
  assert.equal(button('Aktivér for atleten').props.disabled, false)
  assert.equal(await button('Aktivér for atleten').props.onClick(), true)
  assert.match(renderToStaticMarkup(tree()), /Planen er aktiveret for atleten/)
  assert.equal(button('Aktivér for atleten').props.disabled, true)
  const plan = await createPlanAdapter({ enabled: true, ...scope, client: f.client }).loadActive()
  const html = renderToStaticMarkup(activePlanView(h, { plan }))
  assert.match(html, /&lt;synthetic meal&gt;/); assert.match(html, /Plan fra din coach/)
  assert.doesNotMatch(html, /<synthetic meal>|Spist:/)
  cleanup()
})

test('real React missing-table check preserves local UI; SSR and OFF do not access a client', async () => {
  const c = editor()
  for (const missing of tableNames) for (const missingCode of ['42P01', 'PGRST205']) {
    const f = syntheticTables({ missing, missingCode })
    const stop = startPlanActivation({ controller: c, ...scope, client: f.client })
    try {
      await flush()
      assert.equal(c.snapshot().canPublish, false)
      assert.match(c.snapshot().activationError, /tabeller mangler/)
      assert.doesNotMatch(renderToStaticMarkup(coachPlanView(h, c.snapshot(), c)), /Aktivér for atleten/)
      assert.equal(f.writes().length, 0)
    } finally { stop() }
  }
  assert.equal(renderToStaticMarkup(h(PlanActivation, { controller: c, ...scope,
    loadClient: () => { throw Error('SSR must not load client') } })), '')
  for (const enabled of [false, undefined, 1, 'true']) {
    assert.equal(ActivePlan({ enabled, get athleteId() { throw Error('OFF') } }), null)
    assert.equal(renderToStaticMarkup(h(ActivePlan, { enabled })), '')
  }
})
