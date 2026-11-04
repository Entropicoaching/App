import test from 'node:test'
import assert from 'node:assert/strict'
import { createCoachPlan } from './controller.mjs'
import { NAMESPACE, freeze } from './model.mjs'
import { syntheticInput } from './syntheticFixture.mjs'

function setup(overrides) {
  const f = syntheticInput(overrides)
  return { ...f, model: createCoachPlan(f.options) }
}
function deferred() {
  let resolve, reject
  const promise = new Promise((a, b) => { resolve = a; reject = b })
  return { promise, resolve, reject }
}

test('strict OFF reads no data and invokes no dependencies, including methods', async () => {
  for (const enabled of [undefined, false, 0, 1, 'true', null]) {
    const model = createCoachPlan({ enabled, get athlete() { throw Error('OFF athlete') },
      get saveDraft() { throw Error('OFF write') } })
    assert.equal(model.snapshot(), null); assert.equal(model.generate(), false)
    assert.equal(model.set('goal', 'bulk'), false); assert.equal(await model.save(), false)
    assert.equal(await model.activate(), false)
  }
})

test('generation and edits never write; only scoped save then activate publish a plan', async () => {
  const { model, calls } = setup()
  assert.equal(model.generate(), true); assert.deepEqual(calls, [])
  assert.equal(await model.activate(), false)
  model.editGrams(1, 0, '200,5'); model.editFood(1, 1, 'oats')
  assert.deepEqual(calls, []); assert.equal(model.snapshot().totals.kcal > 0, true)
  assert.equal(await model.save(), true)
  const saved = model.snapshot().saved
  assert.equal(saved.status, 'draft'); assert.equal(model.snapshot().dirty, false)
  assert.equal(calls[0].request.namespace, NAMESPACE)
  assert.equal(calls[0].request.athleteId, 'synthetic-athlete-a')
  assert.equal(calls[0].request.plan.meals[1].items[0].grams, 200.5)
  assert.equal(await model.activate(), true)
  assert.equal(model.snapshot().saved.status, 'active')
  assert.equal(model.snapshot().history.plans[0].status, 'active')
  assert.equal(calls[1].request.revision, saved.revision)
  assert.equal(await model.activate(), false)
  assert.equal(await model.save(), false)
  assert.equal(calls.length, 2)
})

test('edits invalidate saved activation; next save updates draft with revision, active edits create new draft', async () => {
  const f = setup(), m = f.model
  m.generate(); await m.save(); const saved = m.snapshot().saved
  m.editGrams(0, 0, '100'); assert.equal(await m.activate(), false)
  assert.equal(await m.save(), true)
  assert.equal(f.calls[1].request.planId, saved.planId)
  assert.equal(f.calls[1].request.revision, saved.revision)
  assert.equal(await m.activate(), true)
  m.editFood(0, 0, 'rice')
  // An adapter must allocate a fresh ID for a fresh draft after activation.
  const next = setup({ history: m.snapshot().history,
    saveDraft: async request => { f.calls.push({ operation: 'new', request }); return { ...f.ack(request, 'draft'), planId: 'synthetic-second' } } })
  next.model.generate(); assert.equal(await next.model.save(), true)
  assert.equal(f.calls.at(-1).request.planId, null)
  assert.equal(next.model.snapshot().history.plans.find(row => row.id === saved.planId).status, 'active')
})

test('editing an active plan in the same workspace creates a fresh draft and preserves active meals until activation', async () => {
  const f = syntheticInput()
  let draftCount = 0
  const m = createCoachPlan({ ...f.options, saveDraft: async request => {
    f.calls.push({ operation: 'save', request })
    return { ...f.ack(request, 'draft'), planId: request.planId ?? `synthetic-draft-${++draftCount}` }
  } })
  m.generate(); await m.save(); await m.activate()
  const original = structuredClone(m.snapshot().history.plans[0])
  m.editGrams(0, 0, '150'); assert.equal(await m.activate(), false)
  await m.save()
  assert.equal(f.calls.at(-1).request.planId, null)
  assert.deepEqual(m.snapshot().history.plans.find(row => row.id === original.id), original)
  assert.equal(m.snapshot().saved.planId, 'synthetic-draft-2')
  await m.activate()
  assert.equal(m.snapshot().history.plans.find(row => row.id === original.id).status, 'archived')
  assert.equal(m.snapshot().history.plans.filter(row => row.status === 'active').length, 1)
})

test('target edits require regeneration; malformed grams and unknown foods cannot persist', async () => {
  const { model: m, calls } = setup()
  m.generate(); await m.save()
  m.set('goal', 'cut'); assert.equal(m.snapshot().planTargets, null)
  assert.equal(await m.save(), false); assert.equal(await m.activate(), false)
  m.set('intensity', 15); m.generate(); assert.equal(m.snapshot().planTargets.kcal, 2040)
  const previous = m.snapshot()
  assert.equal(m.editFood(0, 0, 'missing'), false); assert.equal(m.snapshot(), previous)
  for (const value of ['', 'no', '-2', '0', '10001']) {
    m.editGrams(0, 0, value); assert.equal(m.snapshot().totals, null)
    assert.equal(await m.save(), false)
  }
  assert.equal(calls.length, 1)
  m.editGrams(0, 0, '100'); assert.equal(await m.save(), true)
})

test('pending writes lock all edits and duplicate actions; save failure retains corrections and retry', async () => {
  const pending = deferred(), requests = []
  const f = setup({ saveDraft: request => { requests.push(request); return pending.promise } }), m = f.model
  m.generate(); m.editGrams(0, 0, '123')
  const save = m.save(); assert.equal(m.snapshot().busy, 'save')
  assert.equal(m.generate(), false); assert.equal(m.set('goal', 'cut'), false)
  assert.equal(m.editGrams(0, 0, '999'), false); assert.equal(m.editFood(0, 0, 'rice'), false)
  assert.equal(await m.save(), false); assert.equal(await m.activate(), false)
  pending.reject(Error('synthetic failure')); assert.equal(await save, false)
  assert.equal(requests.length, 1); assert.equal(m.snapshot().busy, null)
  assert.equal(m.snapshot().meals[0].items[0].grams, '123')
  assert.match(m.snapshot().error, /ikke bekræftet gemt/)
  // An already-rejected promise fails again honestly; no fake success.
  assert.equal(await m.save(), false); assert.equal(m.snapshot().saved, null)
})

test('unconfirmed, cross-athlete, cross-day, stale and false save receipts never enable activation', async () => {
  const mutations = [() => undefined, () => false, r => ({ ...r, ok: false }),
    r => ({ ...r, athleteId: 'foreign' }), r => ({ ...r, date: '2026-11-03' }),
    r => ({ ...r, clientVersion: r.clientVersion - 1 }), r => ({ ...r, namespace: 'foreign' }),
    r => ({ ...r, planId: '' }), r => ({ ...r, revision: '' }), r => ({ ...r, status: 'active' })]
  for (const mutate of mutations) {
    const f = syntheticInput()
    const m = createCoachPlan({ ...f.options, saveDraft: async request => mutate(f.ack(request, 'draft')) })
    m.generate(); assert.equal(await m.save(), false); assert.equal(await m.activate(), false)
    assert.equal(m.snapshot().saved, null); assert.equal(m.snapshot().history.plans.length, 0)
  }
})

test('failed activation keeps draft and existing active plan; successful retry archives only same-day plan', async () => {
  const first = setup(); first.model.generate(); await first.model.save(); await first.model.activate()
  const history = structuredClone(first.model.snapshot().history)
  history.plans.push({ ...structuredClone(history.plans[0]), id: 'synthetic-yesterday', date: '2026-11-03' })
  let fail = true
  const f = syntheticInput({ history })
  const m = createCoachPlan({ ...f.options,
    saveDraft: async request => ({ ...f.ack(request, 'draft'), planId: 'synthetic-next' }),
    activatePlan: async request => fail ? false : f.ack(request, 'active') })
  m.generate(); await m.save()
  assert.equal(await m.activate(), false); assert.equal(m.snapshot().saved.status, 'draft')
  assert.equal(m.snapshot().history.plans.filter(row => row.status === 'active').length, 2)
  fail = false; assert.equal(await m.activate(), true)
  assert.equal(m.snapshot().history.plans.find(row => row.id === 'synthetic-plan-new').status, 'archived')
  assert.equal(m.snapshot().history.plans.find(row => row.id === 'synthetic-yesterday').status, 'active')
})

test('activation requires a new matching revision and never trusts wrong-plan receipts', async () => {
  for (const change of [r => ({ ...r, planId: 'foreign' }), (r, q) => ({ ...r, revision: q.revision }),
    r => ({ ...r, athleteId: 'foreign' }), r => ({ ...r, clientVersion: 999 })]) {
    const f = syntheticInput()
    const m = createCoachPlan({ ...f.options, activatePlan: async request => change(f.ack(request, 'active'), request) })
    m.generate(); await m.save(); assert.equal(await m.activate(), false)
    assert.equal(m.snapshot().saved.status, 'draft')
  }
})

test('pending activation blocks duplicate activation, saving, generation and editing until scoped acknowledgment', async () => {
  const pending = deferred(), f = syntheticInput()
  let request
  const m = createCoachPlan({ ...f.options, activatePlan: r => { request = r; return pending.promise } })
  m.generate(); await m.save(); const activating = m.activate()
  assert.equal(m.snapshot().busy, 'activate')
  assert.equal(await m.activate(), false); assert.equal(await m.save(), false)
  assert.equal(m.generate(), false); assert.equal(m.editGrams(0, 0, '42'), false)
  assert.equal(m.set('protein', '200'), false)
  pending.resolve(f.ack(request, 'active')); assert.equal(await activating, true)
  assert.equal(m.snapshot().saved.status, 'active')
})

test('a save retry can succeed after a failure; stale update revisions and ID collisions remain rejected', async () => {
  const f = syntheticInput(); let fail = true, stale = false
  const m = createCoachPlan({ ...f.options, saveDraft: async r => fail ? false
    : stale ? { ...f.ack(r, 'draft'), revision: r.revision } : f.ack(r, 'draft') })
  m.generate(); assert.equal(await m.save(), false)
  fail = false; assert.equal(await m.save(), true)
  const saved = m.snapshot().saved
  m.editGrams(0, 0, '150'); stale = true
  assert.equal(await m.save(), false); assert.deepEqual(m.snapshot().saved, saved)
  stale = false; assert.equal(await m.save(), true); await m.activate()
  m.editGrams(0, 0, '151')
  assert.equal(await m.save(), false) // fixture reuses the active plan ID for a new draft
  assert.equal(m.snapshot().history.plans.length, 1)
  assert.equal(m.snapshot().history.plans[0].status, 'active')
})

test('snapshot stability, subscriptions, immutable input copies and hostile adapter mutations', async () => {
  const f = syntheticInput(); freeze(f.options.catalog); freeze(f.options.template); freeze(f.options.basis)
  const m = createCoachPlan({ ...f.options, saveDraft: async request => {
    const response = f.ack(request, 'draft'); request.plan.meals[0].items[0].food.name = 'mutated'; return response
  } })
  let updates = 0
  const unsubscribe = m.subscribe(() => { updates++ })
  assert.equal(m.snapshot(), m.snapshot()); assert.ok(Object.isFrozen(m.snapshot().form))
  m.generate(); const old = m.snapshot()
  m.editGrams(0, 0, '200'); assert.notEqual(m.snapshot(), old)
  assert.notEqual(old.meals[0].items[0].grams, '200')
  await m.save(); assert.notEqual(m.snapshot().meals[0].items[0].food.name, 'mutated')
  assert.equal(updates, 4); unsubscribe(); m.set('goal', 'cut'); assert.equal(updates, 4)
})

test('missing or foreign basis stays empty; missing adapters and invalid identities are explicit', async () => {
  for (const basis of [undefined, { athleteId: 'foreign', date: '2026-11-04', maintenanceKcal: 2400 },
    { athleteId: 'synthetic-athlete-a', date: '2026-11-03', maintenanceKcal: 2400 }]) {
    const { model: m } = setup({ basis })
    assert.equal(m.snapshot().suggestion, null); assert.equal(m.generate(), false)
    assert.equal(m.snapshot().form.maintenanceKcal, '')
  }
  const { model: m } = setup({ saveDraft: undefined, activatePlan: undefined })
  m.generate(); assert.equal(await m.save(), false); assert.match(m.snapshot().error, /ikke tilgængelig/)
  for (const options of [{ athlete: null }, { date: '2026-02-30' }])
    assert.throws(() => setup(options), /Vælg en atlet/)
})

test('late save for a previous athlete cannot populate another controller or activate automatically', async () => {
  const pending = deferred(), f = syntheticInput()
  let request
  const a = createCoachPlan({ ...f.options, saveDraft: r => { request = r; return pending.promise } })
  a.generate(); const saving = a.save()
  const b = createCoachPlan({ ...f.options, athlete: { id: 'synthetic-athlete-b' }, basis: undefined,
    history: { athleteId: 'synthetic-athlete-b', state: 'ready', plans: [], responses: [] } })
  pending.resolve(f.ack(request, 'draft')); assert.equal(await saving, true)
  assert.equal(b.snapshot().saved, null); assert.equal(b.snapshot().history.plans.length, 0)
  assert.deepEqual(f.calls, [])
})
