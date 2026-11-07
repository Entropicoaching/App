// Actual saved-draft restore/controller/activation and mounted host; synthetic
// storage, DOM and table transport only. SQL compatibility is a separate HOLD.
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import CoachKostMaal from '../../kostMaalKobling.mjs'
import { openPortalPlan, draftKey } from './portalModel.mjs'
import { startPlanActivation } from './activation.mjs'
import { syntheticTables, tableNames, flush } from './activation.fixture.mjs'
import { memoryStorage } from './portal.fixture.mjs'
import { sessionReactDocument } from '../../session/sessionQuickSetReactDom.mjs'

const date = '2026-11-05', coachId = 'basis-coach'
const profile = { id: 'basis-athlete', age: 28, bodyweight: 80, goal: 'cut',
  training: { volume: 'high', intensity: 'moderate' } }
const changed = { ...profile, training: { volume: 'high', intensity: 'high' } }
const template = ['Morgenmad', 'Frokost', 'Aftensmad'].map((name, i) => ({ id: `basis-${i}`, name, items: [] }))
const key = draftKey(coachId, profile.id, date)
const scope = { athleteId: profile.id, date }
const settle = async () => { await flush(); await flush() }
const open = (storage, athlete = profile, patch = {}) => openPortalPlan({ enabled: true,
  coachId, athlete, date, template, storage: () => storage, ...patch })
async function saved(storage) {
  const c = open(storage).controller
  assert.equal(c.set('maintenanceKcal', '1600'), true)
  assert.equal(c.set('intensity', 15), true)
  assert.equal(c.generate(), true); assert.equal(await c.save(), true)
  return c
}
async function connect(c, f) {
  const stop = startPlanActivation({ controller: c, ...scope, client: f.client })
  await settle(); return stop
}
async function reserved(lost = tableNames[1]) {
  const storage = memoryStorage(), c = await saved(storage), f = syntheticTables({ lost })
  const stop = await connect(c, f)
  try { assert.equal(await c.activate(), false) } finally { stop() }
  assert.equal(c.snapshot().activationPending, true)
  assert.equal(JSON.parse(storage.data.get(key)).activationPending, true)
  return { storage, c, f }
}
function locked(c) {
  assert.equal(c.snapshot().planTargets, null)
  assert.equal(c.snapshot().activationPending, true)
  assert.equal(c.set('goal', 'maintain'), false)
  assert.equal(c.editGrams(0, 0, 225), false)
  assert.equal(c.editFood(0, 0, c.snapshot().foods[0].id), false)
  assert.equal(c.editBounds(0, 0, 'maxGrams', 250), false)
  assert.equal(c.generate(), false)
}
function samePayload(before, after) {
  const a = JSON.parse(before), b = JSON.parse(after)
  delete a.activationPending; delete b.activationPending
  assert.deepEqual(b, a)
}

test('pending and unreserved restores invalidate equal floors, changed numbers and unknown profile without writes', async () => {
  const variants = [changed, { ...changed, bodyweight: 75 }, { ...changed, age: undefined },
    { ...changed, age: 17 }, { ...changed, bodyweight: null }, { ...changed, goal: 'unknown' },
    { ...changed, training: undefined }, { ...changed, training: { volume: 'high' } }]
  for (const pending of [false, true]) for (const athlete of variants) {
    const storage = memoryStorage(), first = await saved(storage)
    if (pending) {
      const f = syntheticTables({ lost: tableNames[0] }), stop = await connect(first, f)
      try { assert.equal(await first.activate(), false) } finally { stop() }
    }
    const bytes = [...storage.data], sets = storage.calls.filter(c => c[0] === 'set').length
    const restored = open(storage, athlete), c = restored.controller
    assert.equal(restored.loadError, null); assert.equal(restored.restored, true)
    if (athlete === changed) assert.deepEqual(c.snapshot().suggestion, first.snapshot().planTargets)
    if (athlete.bodyweight === 75) assert.notDeepEqual(c.snapshot().suggestion, first.snapshot().planTargets)
    assert.equal(c.snapshot().planTargets, null)
    assert.deepEqual(c.snapshot().meals, first.snapshot().meals)
    assert.deepEqual(c.snapshot().saved, first.snapshot().saved)
    assert.equal(await c.save(), false); assert.equal(await c.activate(), false)
    if (pending) locked(c)
    assert.deepEqual([...storage.data], bytes)
    assert.equal(storage.calls.filter(c => c[0] === 'set').length, sets)
  }
})

test('unchanged explicit basis keeps reservation semantics; nonpending changed basis requires generation and save', async () => {
  const r = await reserved(), prior = r.storage.data.get(key), c = open(r.storage).controller
  assert.deepEqual(c.snapshot().planTargets, r.c.snapshot().planTargets)
  assert.deepEqual(c.snapshot().saved, r.c.snapshot().saved)
  assert.equal(c.snapshot().version, r.c.snapshot().version)
  const stop = await connect(c, r.f)
  try {
    assert.equal(c.snapshot().activationPending, true); assert.equal(c.snapshot().canPublish, false)
    assert.equal(await c.activate(), false); assert.equal(await c.save(), false)
    assert.equal(r.storage.data.get(key), prior)
  } finally { stop() }
  const storage = memoryStorage(); await saved(storage)
  const next = open(storage, changed).controller, bytes = storage.data.get(key)
  assert.equal(await next.save(), false)
  assert.equal(next.generate(), true); assert.equal(storage.data.get(key), bytes)
  assert.equal(await next.save(), true)
  assert.deepEqual(open(storage, changed).controller.snapshot().planTargets, next.snapshot().planTargets)
})

test('changed-basis reopen preserves partial operation bytes and IDs while original session can retry', async () => {
  for (const lost of tableNames.slice(0, 2)) for (const athlete of [changed, { ...changed, bodyweight: 75 }]) {
    const { storage, c: original, f } = await reserved(lost)
    const bytes = storage.data.get(key), payloads = f.writes().map(c => structuredClone(c.payload))
    const next = open(storage, athlete).controller, count = f.writes().length
    const stopNext = await connect(next, f)
    try {
      locked(next); assert.equal(await next.save(), false); assert.equal(await next.activate(), false)
      assert.equal(await next.checkActivation(), true); locked(next)
      assert.equal(storage.data.get(key), bytes); assert.equal(f.writes().length, count)
      const stopOriginal = await connect(original, f)
      try { assert.equal(await original.activate(), true) } finally { stopOriginal() }
      for (let i = 0; i < payloads.length; i++) assert.deepEqual(f.data[tableNames[i]][0], {
        ...payloads[i], ...(i === 0 ? { status: 'godkendt' } : {}),
      })
      for (const table of tableNames) assert.equal(f.data[table].length, 1)
      const writes = f.writes().length
      assert.equal(await next.checkActivation(), true)
      assert.equal(next.snapshot().activationPending, false)
      assert.equal(next.snapshot().publishedVersion, null)
      assert.equal(next.snapshot().planTargets, null)
      assert.match(next.snapshot().message, /oprindelige aktivering.*grundlaget er ændret/)
      assert.equal(await next.activate(), false); assert.equal(await next.save(), false)
      samePayload(bytes, storage.data.get(key)); assert.equal(f.writes().length, writes)
    } finally { stopNext() }
  }
})

test('lost success reconciles original payload despite equal, numeric or invalid current basis; explicit recalculation precedes a new activation', async () => {
  for (const athlete of [changed, { ...changed, bodyweight: 75 }, { ...changed, age: undefined }]) {
    const { storage, f } = await reserved(tableNames[2]), bytes = storage.data.get(key), writes = f.writes().length
    f.options.error = '42501'
    const c = open(storage, athlete).controller, stop = await connect(c, f)
    try {
      locked(c); assert.equal(c.snapshot().activationState, 'error')
      assert.equal(c.snapshot().publishedVersion, null); assert.equal(await c.activate(), false)
      assert.equal(storage.data.get(key), bytes); assert.equal(f.writes().length, writes)
      delete f.options.error
      assert.equal(await c.checkActivation(), true)
      assert.equal(c.snapshot().activationPending, false); assert.equal(c.snapshot().planTargets, null)
      assert.equal(c.snapshot().publishedVersion, null)
      assert.equal(c.snapshot().activePlan.revision, f.data[tableNames[1]][0].id)
      samePayload(bytes, storage.data.get(key)); assert.equal(f.writes().length, writes)
      assert.equal(await c.activate(), false); assert.equal(await c.save(), false)
      if (athlete.age !== undefined) {
        // A portion edit alone cannot bless targets on the new basis.
        assert.equal(c.editGrams(0, 0, 125), true); assert.equal(await c.save(), false)
        assert.equal(c.generate(), true, c.snapshot().error); assert.equal(await c.activate(), false)
        assert.equal(c.editGrams(0, 0, 125), true)
        assert.equal(await c.save(), true)
        const regenerated = JSON.parse(storage.data.get(key))
        assert.deepEqual(regenerated.calculation.training, athlete.training)
        assert.equal(await c.activate(), true)
        assert.equal(f.data[tableNames[2]].length, 2)
        assert.notEqual(f.data[tableNames[1]][0].id, f.data[tableNames[1]][1].id)
      } else {
        assert.equal(c.generate(), false); assert.equal(await c.activate(), false)
        assert.equal(f.writes().length, writes)
      }
    } finally { stop() }
  }
})

test('a different active payload or effective scope cannot reconcile the frozen reservation', async () => {
  for (const change of ['goal', 'intensity', 'grams', 'effective_from', 'athlete_id']) {
    const { storage, f } = await reserved(tableNames[2]), bytes = storage.data.get(key), writes = f.writes().length
    const v = f.data[tableNames[1]][0]
    if (change === 'goal') v.goal = 'bulk'
    if (change === 'intensity') v.intensity = 0.2
    if (change === 'grams') v.meals[0].portions[0].grams += 5
    if (change === 'effective_from') v.effective_from = '2026-11-04'
    if (change === 'athlete_id') f.data[tableNames[0]][0].athlete_id = 'other-athlete'
    const c = open(storage, changed).controller, stop = await connect(c, f)
    try {
      locked(c); assert.equal(await c.activate(), false)
      assert.equal(c.snapshot().publishedVersion, null)
      assert.equal(storage.data.get(key), bytes); assert.equal(f.writes().length, writes)
    } finally { stop() }
  }
})

test('coach, athlete and date keys isolate pending drafts; invalid dates and corrupt stored basis never write', async () => {
  const { storage } = await reserved(), bytes = [...storage.data]
  for (const patch of [{ coachId: 'other-coach' }, { athlete: { ...changed, id: 'other-athlete' } }, { date: '2026-11-06' }]) {
    const o = open(storage, changed, patch)
    assert.equal(o.restored, false); assert.equal(o.loadError, null)
    assert.equal(o.controller.snapshot().activationPending, false)
    assert.equal(o.controller.snapshot().planTargets, null)
  }
  for (const bad of [undefined, '', '2026-02-30', 'not-a-date']) assert.throws(() => open(storage, changed, { date: bad }), TypeError)
  assert.deepEqual([...storage.data], bytes)
  const original = storage.data.get(key)
  for (const patch of [{ calculation: { date, adult: true } }, { date: '2026-11-04' }, { coachId: 'other-coach' }, { activationPending: 'true' }]) {
    const bad = JSON.stringify({ ...JSON.parse(original), ...patch }); storage.data.set(key, bad)
    const o = open(storage, changed)
    assert.ok(o.loadError); assert.equal(o.restored, false)
    assert.equal(await o.controller.save(), false); assert.equal(storage.data.get(key), bad)
  }
})

test('failed local marker cleanup retains pending bytes and still requires current-basis generation after confirmed success', async () => {
  const { storage, f } = await reserved(tableNames[2]), bytes = storage.data.get(key), writes = f.writes().length
  const c = open(storage, changed).controller, originalSet = storage.setItem
  storage.setItem = () => { throw Error('Synthetic denied local write') }
  const stop = await connect(c, f)
  try {
    assert.equal(c.snapshot().activationPending, false); assert.equal(c.snapshot().planTargets, null)
    assert.equal(c.snapshot().publishedVersion, null)
    assert.equal(storage.data.get(key), bytes); assert.equal(await c.activate(), false)
    assert.equal(f.writes().length, writes)
  } finally { stop(); storage.setItem = originalSet }
  const next = open(storage, changed).controller, stopNext = await connect(next, f)
  try {
    assert.equal(next.snapshot().activationPending, false); assert.equal(next.snapshot().planTargets, null)
    samePayload(bytes, storage.data.get(key)); assert.equal(f.writes().length, writes)
  } finally { stopNext() }
})

test('actual mounted CoachKostMaal invalidates equal-floor basis on remount, preserves lock and rechecks the original success', async () => {
  const { storage, f } = await reserved(tableNames[2]), bytes = storage.data.get(key), writes = f.writes().length
  // Hold the read first so the mounted editor exposes the unresolved state.
  f.options.error = '42501'
  const doc = sessionReactDocument(), host = doc.createElement('div'); doc.body.append(host)
  const create = doc.createElement
  doc.createElement = tag => {
    const n = create(tag)
    if (tag === 'select') Object.defineProperty(n, 'options', { get: () => n.querySelectorAll('option') })
    if (tag === 'option') Object.defineProperty(n, 'value', { get: () => n.getAttribute('value') ?? n.textContent,
      set: v => { n.setAttribute('value', v) } })
    return n
  }
  const replacements = { window: doc.defaultView, localStorage: storage, IS_REACT_ACT_ENVIRONMENT: true, __pendingBasisClient: f.client }
  const originals = new Map(Object.keys(replacements).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]))
  for (const [k, value] of Object.entries(replacements)) Object.defineProperty(globalThis, k, { configurable: true, value })
  const activationURL = new URL('./activation.mjs', import.meta.url).href
  const hook = registerHooks({ resolve(specifier, context, next) {
    if (context.parentURL === activationURL && specifier === '../../../supabase.js')
      return { shortCircuit: true, url: 'data:text/javascript,export const supabase={from:(...args)=>globalThis.__pendingBasisClient.from(...args)}' }
    assert.ok(!specifier.endsWith('supabase.js'), 'No live client import')
    return next(specifier, context)
  } })
  const root = createRoot(host)
  const props = { enabled: true, athlete: profile, today: date, session: { user: { id: coachId } },
    weightStatus: { athleteId: profile.id, state: 'ready', rows: [] },
    nutritionRead: { coachId, ...scope, state: 'ready', complete: true, mealLogs: [], weightLogs: [] } }
  const render = () => act(async () => { root.render(h(CoachKostMaal, props)); await settle() })
  const click = node => host.dispatch('click', { target: node, button: 0, bubbles: true })
  try {
    await render()
    const details = host.querySelectorAll('details').find(n => n.querySelector('summary')?.textContent === 'Kostplan')
    await act(async () => { details.open = true; details.dispatch('toggle', { target: details }); await settle() })
    assert.ok(host.querySelectorAll('caption').some(n => n.textContent === 'Dagens plan og mål'))
    props.athlete = changed; await render()
    assert.match(host.textContent, /Beregningsgrundlaget er ændret/)
    assert.match(host.textContent, /aktivering er uafklaret/)
    assert.ok(!host.querySelectorAll('caption').some(n => n.textContent === 'Dagens plan og mål'))
    assert.ok(host.querySelectorAll('fieldset').some(n => n.getAttribute('disabled') !== null))
    assert.equal(storage.data.get(key), bytes); assert.equal(f.writes().length, writes)
    delete f.options.error
    const recheck = host.querySelectorAll('button').find(n => n.textContent === 'Kontrollér aktivering igen')
    assert.ok(recheck)
    await act(async () => { click(recheck); await settle() })
    assert.doesNotMatch(host.textContent, /aktivering er uafklaret|gemte kladde svarer til atletens bekræftede aktive plan/)
    assert.match(host.textContent, /oprindelige aktivering er bekræftet.*generér igen og gennemgå/)
    assert.ok(!host.querySelectorAll('caption').some(n => n.textContent === 'Dagens plan og mål'))
    const activate = host.querySelectorAll('button').find(n => n.textContent === 'Aktivér for atleten')
    assert.ok(activate); assert.notEqual(activate.getAttribute('disabled'), null)
    samePayload(bytes, storage.data.get(key)); assert.equal(f.writes().length, writes)
    props.enabled = false; await render(); assert.equal(host.textContent, '')
  } finally {
    try { await act(async () => root.unmount()) } finally {
      hook.deregister()
      for (const [k, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, k, descriptor)
        else delete globalThis[k]
      }
    }
  }
})
