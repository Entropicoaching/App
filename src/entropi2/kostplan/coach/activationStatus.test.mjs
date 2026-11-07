// Actual controller, local draft store, activation bridge and namespace adapter.
// Only the table transport and localStorage are synthetic; no business substitutes.
import test from 'node:test'
import assert from 'node:assert/strict'
import { openPortalPlan } from './portalModel.mjs'
import { startPlanActivation, readActivationState } from './activation.mjs'
import { createPlanAdapter } from '../planAdapter.mjs'
import { syntheticTables, tableNames, flush } from './activation.fixture.mjs'
import { memoryStorage } from './portal.fixture.mjs'
import { FOODS } from '../foedevarer/index.mjs'

const scope = { athleteId: 'synthetic-athlete', date: '2026-11-05' }
const settle = async () => { await flush(); await flush() }
function editor(storage = memoryStorage(), patch = {}) {
  const s = { ...scope, ...patch }
  const controller = openPortalPlan({ enabled: true, coachId: 'synthetic-coach',
    athlete: { id: s.athleteId, protein_target: 120 }, date: s.date, storage: () => storage,
    template: [{ id: 'meal', name: 'Synthetic meal', items: [{ foodId: FOODS[0].id, grams: 100 }] }] }).controller
  return { controller, storage, scope: s }
}
async function saved(e) {
  const c = e.controller
  c.set('maintenanceKcal', 2400); c.set('fat', 70)
  assert.equal(c.generate(), true); assert.equal(await c.save(), true)
}
async function connect(f, e) {
  const stop = startPlanActivation({ controller: e.controller, ...e.scope, client: f.client })
  await settle(); return stop
}
const approvals = f => f.data[tableNames[2]].length

test('unchanged saved draft reopens with server-confirmed version; no approval or implicit activation', async () => {
  const f = syntheticTables(), e = editor(); await saved(e)
  const stop = await connect(f, e)
  assert.equal(approvals(f), 0)
  assert.equal(await e.controller.activate(), true); stop()
  const reopened = editor(e.storage), before = f.writes().length
  const stop2 = await connect(f, reopened)
  try {
    assert.equal(reopened.controller.snapshot().publishedVersion, reopened.controller.snapshot().version)
    assert.equal(await reopened.controller.activate(), false)
    assert.equal(approvals(f), 1); assert.equal(f.writes().length, before)
    assert.equal(JSON.parse([...e.storage.data.values()][0]).plan.status, 'draft')
  } finally { stop2() }
})

test('different grams or immutable goal/intensity require explicit new activation', async () => {
  for (const change of ['grams', 'goal', 'intensity']) {
    const f = syntheticTables(), e = editor(); await saved(e)
    const stop = await connect(f, e); await e.controller.activate(); stop()
    // A previously approved version with equal totals but different settings
    // must not be mistaken for this saved draft.
    if (change !== 'grams') f.data[tableNames[1]][0][change] = change === 'goal' ? 'bulk' : 0.2
    const reopened = editor(e.storage)
    if (change === 'grams') { reopened.controller.editGrams(0, 0, 123.5); await reopened.controller.save() }
    const stop2 = await connect(f, reopened)
    try {
      assert.equal(reopened.controller.snapshot().publishedVersion, null)
      assert.equal(approvals(f), 1)
      assert.equal(await reopened.controller.activate(), true); assert.equal(approvals(f), 2)
    } finally { stop2() }
  }
})

test('another athlete or effective date cannot inherit confirmation from identical portions', async () => {
  const f = syntheticTables(), e = editor(); await saved(e)
  const stop = await connect(f, e); await e.controller.activate(); stop()
  for (const patch of [{ athleteId: 'synthetic-other' }, { date: '2026-11-06' }]) {
    const next = editor(e.storage, patch); await saved(next)
    const stop2 = await connect(f, next)
    try {
      assert.equal(next.controller.snapshot().publishedVersion, null)
      const before = approvals(f)
      assert.equal(await next.controller.activate(), true); assert.equal(approvals(f), before + 1)
      const approval = f.data[tableNames[2]].at(-1), version = f.data[tableNames[1]].at(-1)
      assert.equal(approval.athlete_id, next.scope.athleteId)
      assert.equal(version.effective_from, next.scope.date)
    } finally { stop2() }
  }
})

test('approval lost after commit reconciles on reopen without another write', async () => {
  const f = syntheticTables({ lost: tableNames[2] }), e = editor(); await saved(e)
  const stop = await connect(f, e)
  assert.equal(await e.controller.activate(), false); assert.equal(approvals(f), 1)
  assert.equal(e.controller.snapshot().activationPending, true)
  assert.equal(e.controller.editGrams(0, 0, 200), false)
  assert.equal(JSON.parse([...e.storage.data.values()][0]).activationPending, true)
  stop()
  const reopened = editor(e.storage), count = f.writes().length, stop2 = await connect(f, reopened)
  try {
    assert.equal(reopened.controller.snapshot().activationPending, false)
    assert.equal(reopened.controller.snapshot().publishedVersion, reopened.controller.snapshot().version)
    assert.equal(await reopened.controller.activate(), false)
    assert.equal(f.writes().length, count); assert.equal(approvals(f), 1)
  } finally { stop2() }
})

test('partial commit keeps original adapter operation across recheck; reopen never blindly retries', async () => {
  for (const lost of tableNames.slice(0, 2)) {
    const f = syntheticTables({ lost }), e = editor(); await saved(e)
    const stop = await connect(f, e)
    assert.equal(await e.controller.activate(), false); stop()
    const reopened = editor(e.storage), before = f.writes().length
    const stopOther = await connect(f, reopened)
    assert.equal(reopened.controller.snapshot().activationPending, true)
    assert.equal(reopened.controller.snapshot().canPublish, false)
    assert.equal(await reopened.controller.activate(), false)
    assert.equal(await reopened.controller.save(), false)
    assert.equal(reopened.controller.generate(), false)
    assert.equal(f.writes().length, before); stopOther()
    // Return to the original controller and transport. Read retry must retain
    // the same plan/version IDs owned by its actual adapter.
    const stop2 = await connect(f, e)
    try {
      assert.equal(await e.controller.activate(), true)
      for (const table of tableNames) assert.equal(f.data[table].length, 1)
      assert.equal(e.controller.snapshot().activationPending, false)
    } finally { stop2() }
  }
})

test('confirmed read after lost approval frees obsolete operation IDs for a later explicit correction', async () => {
  const f = syntheticTables({ lost: tableNames[2] }), e = editor(); await saved(e)
  const stop = await connect(f, e)
  try {
    assert.equal(await e.controller.activate(), false)
    assert.equal(approvals(f), 1)
    const count = f.writes().length
    assert.equal(await e.controller.checkActivation(), true)
    assert.equal(f.writes().length, count)
    assert.equal(e.controller.editGrams(0, 0, 123.5), true)
    assert.equal(await e.controller.save(), true)
    assert.equal(await e.controller.activate(), true)
    assert.equal(approvals(f), 2)
    assert.equal(e.controller.snapshot().activePlan.revision, f.data[tableNames[1]][1].id)
    assert.notEqual(f.data[tableNames[1]][0].id, f.data[tableNames[1]][1].id)
  } finally { stop() }
})

test('failed reads cannot confirm a local reservation or authorize new writes; explicit recheck recovers', async () => {
  const f = syntheticTables({ lost: tableNames[2] }), e = editor(); await saved(e)
  const stop = await connect(f, e); await e.controller.activate(); stop()
  f.options.error = '42501'
  const reopened = editor(e.storage), count = f.writes().length, stop2 = await connect(f, reopened)
  try {
    assert.equal(reopened.controller.snapshot().publishedVersion, null)
    assert.equal(reopened.controller.snapshot().activationState, 'error')
    assert.equal(reopened.controller.snapshot().activationPending, true)
    assert.equal(await reopened.controller.activate(), false)
    assert.equal(f.writes().length, count)
    delete f.options.error
    assert.equal(await reopened.controller.checkActivation(), true)
    assert.equal(reopened.controller.snapshot().activationPending, false)
    assert.equal(reopened.controller.snapshot().error, null)
    assert.equal(reopened.controller.snapshot().publishedVersion, reopened.controller.snapshot().version)
    assert.equal(f.writes().length, count)
  } finally { stop2() }
})

test('unavailable schema is explicit and rechecked on the same client without the negative cache', async () => {
  const f = syntheticTables({ missing: tableNames[1] }), e = editor(); await saved(e)
  const stop = await connect(f, e)
  try {
    assert.equal(e.controller.snapshot().activationState, 'unavailable')
    assert.match(e.controller.snapshot().activationError, /tabeller mangler/)
    assert.equal(await e.controller.activate(), false); assert.equal(f.writes().length, 0)
    // Populate the actual adapter's negative loadActive cache, then recover.
    assert.equal(await createPlanAdapter({ enabled: true, ...scope, client: f.client }).loadActive(), null)
    delete f.options.missing
    assert.equal(await e.controller.checkActivation(), true)
    assert.equal(e.controller.snapshot().canPublish, true)
    assert.equal(f.writes().length, 0)
    assert.equal(await e.controller.activate(), true); assert.equal(approvals(f), 1)
  } finally { stop() }
})

test('read failure at activation preflight and local reservation failure both prevent all remote writes', async () => {
  for (const mode of ['read', 'storage']) {
    const f = syntheticTables(), e = editor(); await saved(e)
    const stop = await connect(f, e)
    if (mode === 'read') f.options.error = '42501'
    else e.storage.setItem = () => { throw Error('Synthetic unavailable storage') }
    try {
      assert.equal(await e.controller.activate(), false)
      assert.equal(f.writes().length, 0)
      assert.equal(e.controller.snapshot().publishedVersion, null)
    } finally { stop() }
  }
})

test('a changed active version after the initial check is re-read before an explicit activation', async () => {
  const f = syntheticTables(), e = editor(); await saved(e)
  const stop = await connect(f, e)
  const c = e.controller, s = c.snapshot()
  await createPlanAdapter({ enabled: true, ...scope, client: f.client }).activate({ ...scope,
    goal: s.form.goal, intensity: s.form.intensity, meals: s.meals })
  const before = f.writes().length
  try {
    assert.equal(await c.activate(), false)
    assert.equal(c.snapshot().publishedVersion, c.snapshot().version)
    assert.equal(f.writes().length, before); assert.equal(approvals(f), 1)
  } finally { stop() }
})

test('foreign or malformed full-version read fails closed and cleanup suppresses delayed confirmation', async () => {
  const f = syntheticTables(), e = editor(); await saved(e)
  const stop = await connect(f, e); await e.controller.activate(); stop()
  f.options.response = (call, found) => call.table === tableNames[1] && call.limit === 2
    ? { data: found.map(v => ({ ...v, plan_id: 'foreign-plan' })), error: null } : undefined
  await assert.rejects(readActivationState({ ...scope, client: f.client }))
  delete f.options.response
  let release; const held = new Promise(resolve => { release = resolve })
  f.options.before = () => held
  const reopened = editor(e.storage)
  const stop2 = startPlanActivation({ controller: reopened.controller, ...scope, client: f.client })
  await flush(); stop2(); release(); await settle()
  assert.equal(reopened.controller.snapshot().canPublish, false)
  assert.equal(reopened.controller.snapshot().publishedVersion, null)
  assert.equal(approvals(f), 1)
})
