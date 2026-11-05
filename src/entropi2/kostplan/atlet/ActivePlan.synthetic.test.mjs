// Actual component/effect and adapter, synthetic hooks/client only. No DOM claim.
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { createElement, text } from '../coach/portal.fixture.mjs'
import { syntheticTables, tableNames, flush } from '../coach/activation.fixture.mjs'
import { createPlanAdapter } from '../planAdapter.mjs'
import { openPortalPlan } from '../coach/portalModel.mjs'
import { memoryStorage } from '../coach/portal.fixture.mjs'
import { FOODS } from '../foedevarer/index.mjs'

let current
const fixture = {
  createElement,
  useState(initial) {
    const owner = current, i = owner.cursor++
    if (!(i in owner.values)) owner.values[i] = initial
    return [owner.values[i], value => { owner.values[i] = value }]
  },
  useEffect(effect, deps) {
    const owner = current
    if (!owner.deps || deps.some((value, i) => value !== owner.deps[i])) {
      owner.deps = deps; owner.pending = effect
    }
  },
}
globalThis.__syntheticActivePlanHooks = fixture
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react' && context.parentURL?.endsWith('/atlet/ActivePlan.mjs'))
    return { url: 'data:text/javascript,' + encodeURIComponent(
      'export const { createElement, useState, useEffect } = globalThis.__syntheticActivePlanHooks'), shortCircuit: true }
  return next(specifier, context)
} })
let ActivePlan
try { ({ default: ActivePlan } = await import('./ActivePlan.mjs')) }
finally { hooks.deregister(); delete globalThis.__syntheticActivePlanHooks }

const scope = { athleteId: 'synthetic-athlete', date: '2026-11-05' }
function mount(client) {
  const owner = { values: [], cursor: 0 }
  return {
    receipt: () => owner.values[0],
    render(next = {}) {
      owner.cursor = 0; current = owner
      let tree
      try {
        const node = ActivePlan({ enabled: true, ...scope, client, ...next })
        tree = node?.type(node.props) ?? null
      } finally { current = undefined }
      if (owner.pending) { owner.cleanup?.(); owner.cleanup = owner.pending(); owner.pending = undefined }
      return tree
    },
    unmount() { owner.cleanup?.() },
  }
}

test('actual athlete component stays empty for each missing table and both exact missing codes', async () => {
  for (const missing of tableNames) for (const missingCode of ['42P01', 'PGRST205']) {
    const f = syntheticTables({ missing, missingCode }), screen = mount(f.client)
    try {
      assert.equal(screen.render(), null); await flush()
      assert.equal(screen.receipt().plan, null)
      assert.equal(screen.receipt().error, undefined)
      assert.equal(screen.render(), null)
      assert.equal(f.writes().length, 0)
    } finally { screen.unmount() }
  }
})

test('actual athlete component hides permission, session, unknown and transport errors without classifying them as missing', async () => {
  for (const error of ['42501', 'PGRST301', 'XX000', '404', '42p01', 'pgrst205']) {
    const f = syntheticTables({ error }), screen = mount(f.client)
    try {
      assert.equal(screen.render(), null); await flush()
      assert.equal(screen.receipt().error, true)
      assert.equal(screen.render(), null)
      assert.equal(f.writes().length, 0)
    } finally { screen.unmount() }
  }
  const screen = mount({ from() { throw Error('Synthetic transport failure') } })
  try {
    screen.render(); await flush()
    assert.equal(screen.receipt().error, true)
    assert.equal(screen.render(), null)
  } finally { screen.unmount() }
})

test('actual athlete component still renders an approved plan and hides stale scope immediately', async () => {
  const f = syntheticTables(), { controller } = openPortalPlan({ enabled: true, coachId: 'synthetic-coach',
    athlete: { id: scope.athleteId, protein_target: 120 }, date: scope.date, storage: () => memoryStorage(),
    template: [{ id: 'meal', name: 'Synthetic meal', items: [{ foodId: FOODS[0].id, grams: 100 }] }] })
  controller.set('maintenanceKcal', 2400); controller.set('fat', 70)
  assert.equal(controller.generate(), true)
  await createPlanAdapter({ enabled: true, ...scope, client: f.client }).activate({ ...scope,
    goal: controller.snapshot().form.goal, intensity: controller.snapshot().form.intensity, meals: controller.snapshot().meals })
  const writes = f.writes().length, screen = mount(f.client)
  try {
    assert.equal(screen.render(), null); await flush()
    assert.match(text(screen.render()), /Plan fra din coach.*Synthetic meal/)
    assert.equal(screen.render({ athleteId: 'synthetic-other' }), null)
    await flush()
    assert.equal(screen.render({ athleteId: 'synthetic-other' }), null)
    assert.equal(f.writes().length, writes)
  } finally { screen.unmount() }
})

test('athlete tab remounts and date/athlete changes share one schema check per client session', async () => {
  for (const missing of tableNames) for (const missingCode of ['42P01', 'PGRST205']) {
    const f = syntheticTables({ missing, missingCode })
    for (const next of [{}, {}, { date: '2026-11-06' }, { athleteId: 'synthetic-other' }]) {
      const screen = mount(f.client)
      try {
        assert.equal(screen.render(next), null); await flush()
        assert.equal(screen.receipt().plan, null)
        assert.equal(screen.receipt().error, undefined)
      } finally { screen.unmount() }
    }
    assert.equal(f.calls.length, tableNames.indexOf(missing) + 1)
    assert.ok(f.calls.every(call => call.limit === 0))
    assert.equal(f.writes().length, 0)
    const independent = syntheticTables({ missing, missingCode }), screen = mount(independent.client)
    try {
      screen.render(); await flush()
      assert.equal(independent.calls.length, tableNames.indexOf(missing) + 1)
    } finally { screen.unmount() }
  }
})

test('overlapping athlete mounts share the in-flight probe and cleanup still suppresses late results', async () => {
  let release
  const held = new Promise(resolve => { release = resolve })
  const f = syntheticTables({ missing: tableNames[1], before: () => held })
  const first = mount(f.client), second = mount(f.client), reopened = mount(f.client)
  try {
    first.render(); second.render(); await flush()
    first.unmount(); reopened.render(); await flush()
    assert.equal(f.calls.length, 1)
    release(); await flush()
    assert.equal(first.receipt(), null)
    assert.equal(second.receipt().plan, null)
    assert.equal(reopened.receipt().plan, null)
    assert.equal(f.calls.length, 2)
    assert.equal(f.writes().length, 0)
  } finally { release(); first.unmount(); second.unmount(); reopened.unmount() }
})

test('athlete probe errors stay errors on reentry without repeated permission or transport calls', async () => {
  for (const error of ['42501', 'PGRST301', 'XX000', '404', '42p01', 'pgrst205']) {
    const f = syntheticTables({ error })
    for (let i = 0; i < 2; i++) {
      const screen = mount(f.client)
      try {
        screen.render(); await flush()
        assert.equal(screen.receipt().error, true)
        assert.equal(screen.render(), null)
      } finally { screen.unmount() }
    }
    assert.equal(f.calls.length, 1)
    assert.equal(f.writes().length, 0)
  }
  let calls = 0
  const client = { from() { calls++; throw Error('Synthetic transport failure') } }
  for (let i = 0; i < 2; i++) {
    const screen = mount(client)
    try { screen.render(); await flush(); assert.equal(screen.receipt().error, true) }
    finally { screen.unmount() }
  }
  assert.equal(calls, 1)
})
