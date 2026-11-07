// Independent combined cases in a separate same-engine Codex review phase.
// The supplied fixture translates queries only; actual React/product/SQL run.
import test from 'node:test'
import assert from 'node:assert/strict'
import { withDatabase, mounted, scope, profile, names, date, coachId, athleteId } from './generatorSql.fixture.mjs'
import { memoryStorage } from './portal.fixture.mjs'
import { openPortalPlan, draftKey } from './portalModel.mjs'
import { startPlanActivation } from './activation.mjs'
import { createPlanAdapter } from '../planAdapter.mjs'
import { supportedFoodSnapshot } from '../sqlSnapshot.mjs'

const template = ['Morgenmad', 'Frokost', 'Aftensmad'].map((name, i) => ({ id: `combined-${i}`, name, items: [] }))
const key = draftKey(coachId, athleteId, date)
const open = (storage, athlete = profile) => openPortalPlan({ enabled: true, ...scope, athlete, template, storage: () => storage }).controller
const writes = f => f.calls.filter(call => call.payload)
const counts = async f => {
  const result = []
  for (const name of names) result.push(Number((await f.db.query(`select count(*) n from public.${name}`)).rows[0].n))
  return result
}
async function connect(c, f) {
  const stop = startPlanActivation({ controller: c, ...scope, client: f.client })
  try {
    for (let i = 0; i < 500 && c.snapshot().activationState === 'checking'; i++) await new Promise(resolve => setImmediate(resolve))
    assert.equal(c.snapshot().activationState, 'ready')
    return stop
  } catch (error) { stop(); throw error }
}
async function generated(storage) {
  const c = open(storage)
  assert.equal(c.set('maintenanceKcal', '1600'), true)
  assert.equal(c.set('intensity', 15), true)
  assert.equal(c.generate(template), true)
  assert.equal(await c.save(), true)
  const row = JSON.parse(storage.data.get(key))
  assert.ok(row.plan.meals.some(m => m.items.some(i => i.food.nutrition.prioritet)))
  return c
}
// Expected immutable SQL content is built independently from the saved UI row.
const sqlMeals = meals => meals.map(m => ({ name: m.name, portions: m.items.map(i => ({ grams: i.grams,
  food: Object.fromEntries(['id', 'name', 'preparation', 'basisGrams', 'nutrientsPer100g', 'source'].map(k => [k, i.food.nutrition[k]])),
})) }))
const withoutMarker = raw => { const row = JSON.parse(raw); delete row.activationPending; return row }

for (const [label, athlete] of [
  ['equal macro floors', { ...profile, training: { volume: 'high', intensity: 'high' } }],
  ['different numeric targets', { ...profile, bodyweight: 75 }],
  ['unknown adult basis', { ...profile, age: undefined }],
]) test(`combined original SQL approval loss + ${label}: mounted reconciliation preserves immutable payload and hides stale targets`, { timeout: 60000 }, async () => withDatabase(async f => {
  const storage = memoryStorage(), original = await generated(storage)
  const saved = storage.data.get(key), oldTargets = original.snapshot().planTargets
  const stop = await connect(original, f)
  try { assert.equal(await original.activate(), false) } finally { stop() }
  assert.equal(original.snapshot().activationPending, true)
  assert.deepEqual(await counts(f), [1, 1, 1])
  const pending = storage.data.get(key), beforeCalls = structuredClone(writes(f))
  assert.deepEqual(withoutMarker(pending), withoutMarker(saved))
  const version = (await f.db.query('select * from public.kostplan_v1_versions')).rows[0]
  const approval = (await f.db.query('select * from public.kostplan_v1_approvals')).rows[0]
  assert.deepEqual(version.meals, sqlMeals(JSON.parse(saved).plan.meals))
  assert.equal(version.id, beforeCalls.find(c => c.table === names[1]).payload.id)
  assert.equal(approval.version_id, version.id)
  assert.equal(version.plan_id, beforeCalls.find(c => c.table === names[0]).payload.id)
  const restored = open(storage, athlete)
  assert.equal(restored.snapshot().planTargets, null)
  assert.equal(restored.snapshot().publishedVersion, null)
  assert.deepEqual(restored.snapshot().meals, original.snapshot().meals)
  if (label === 'equal macro floors') assert.deepEqual(restored.snapshot().suggestion, oldTargets)
  assert.equal(await restored.save(), false)
  assert.equal(await restored.activate(), false)
  assert.equal(storage.data.get(key), pending)
  await mounted(f.client, storage, async ui => {
    await ui.open()
    await ui.wait(() => ui.host.textContent.includes('oprindelige aktivering er bekræftet'))
    assert.ok(!ui.host.querySelectorAll('caption').some(n => n.textContent === 'Dagens plan og mål'))
    const activate = ui.host.querySelectorAll('button').find(n => n.textContent === 'Aktivér for atleten')
    assert.ok(activate)
    assert.notEqual(activate.getAttribute('disabled'), null)
    assert.doesNotMatch(ui.host.textContent, /gemte kladde svarer til atletens bekræftede aktive plan|kcal registreret/)
    assert.equal(writes(f).length, beforeCalls.length)
  }, { athlete })
  assert.equal(JSON.parse(storage.data.get(key)).activationPending, false)
  assert.deepEqual(withoutMarker(storage.data.get(key)), withoutMarker(pending))
  assert.deepEqual((await f.db.query('select * from public.kostplan_v1_versions')).rows[0], version)
  assert.deepEqual((await f.db.query('select * from public.kostplan_v1_approvals')).rows[0], approval)
  assert.deepEqual(writes(f), beforeCalls)
  const next = open(storage, athlete), stopNext = await connect(next, f)
  try {
    assert.equal(next.snapshot().planTargets, null)
    assert.equal(next.snapshot().publishedVersion, null)
    assert.equal(await next.activate(), false)
    assert.equal(await next.save(), false)
  } finally { stopNext() }
  // Original unchanged basis still recognizes the exact approved canonical content.
  await mounted(f.client, storage, async ui => {
    await ui.open()
    await ui.wait(() => ui.host.textContent.includes('gemte kladde svarer til atletens bekræftede aktive plan'))
    assert.ok(ui.host.querySelectorAll('caption').some(n => n.textContent === 'Dagens plan og mål'))
    assert.ok(!ui.host.querySelectorAll('button').some(n => n.textContent === 'Aktivér for atleten' && n.getAttribute('disabled') === null))
  })
  assert.deepEqual(await counts(f), [1, 1, 1])
  assert.deepEqual(writes(f), beforeCalls)
}, { lost: names[2] }))

test('combined partial original SQL write: changed-basis reopen stays locked while original session reconciles the same IDs', { timeout: 60000 }, async () => withDatabase(async f => {
  const storage = memoryStorage(), first = await generated(storage), stopFirst = await connect(first, f)
  const changed = { ...profile, training: { volume: 'high', intensity: 'high' } }
  let stopNext
  try {
    assert.equal(await first.activate(), false)
    assert.deepEqual(await counts(f), [1, 1, 0])
    const pending = storage.data.get(key), attempted = structuredClone(writes(f))
    const next = open(storage, changed)
    stopNext = await connect(next, f)
    assert.equal(next.snapshot().activationPending, true)
    assert.equal(next.snapshot().planTargets, null)
    assert.equal(next.set('goal', 'bulk'), false)
    assert.equal(next.editGrams(0, 0, 250), false)
    assert.equal(next.generate(template), false)
    assert.equal(await next.activate(), false)
    assert.equal(await next.save(), false)
    assert.deepEqual(writes(f), attempted)
    assert.equal(storage.data.get(key), pending)
    assert.equal(await first.checkActivation(), true)
    assert.equal(await first.activate(), true)
    assert.deepEqual(await counts(f), [1, 1, 1])
    const version = (await f.db.query('select * from public.kostplan_v1_versions')).rows[0]
    assert.equal(version.id, attempted.find(c => c.table === names[1]).payload.id)
    assert.deepEqual(version.meals, attempted.find(c => c.table === names[1]).payload.meals)
    const count = writes(f).length
    assert.equal(await next.checkActivation(), true)
    assert.equal(next.snapshot().activationPending, false)
    assert.equal(next.snapshot().planTargets, null)
    assert.equal(next.snapshot().publishedVersion, null)
    assert.equal(await next.activate(), false)
    assert.equal(writes(f).length, count)
    assert.deepEqual(withoutMarker(storage.data.get(key)), withoutMarker(pending))
  } finally { stopFirst(); stopNext?.() }
}, { lost: names[1] }))

test('combined supported projection retains zero/unknown and refuses unknown fields before every SQL write', { timeout: 60000 }, async () => withDatabase(async f => {
  const storage = memoryStorage(), c = await generated(storage)
  const plan = { ...scope, goal: c.snapshot().form.goal, intensity: c.snapshot().form.intensity, meals: structuredClone(c.snapshot().meals) }
  const uiFood = plan.meals[0].items[0].food.nutrition
  uiFood.nutrientsPer100g.fatG = 0
  uiFood.nutrientsPer100g.fibreG = null
  const preserved = structuredClone(uiFood), projected = supportedFoodSnapshot(uiFood)
  assert.equal(projected.nutrientsPer100g.fatG, 0)
  assert.equal(projected.nutrientsPer100g.fibreG, null)
  assert.deepEqual(Object.keys(projected).sort(), ['id', 'name', 'preparation', 'basisGrams', 'nutrientsPer100g', 'source'].sort())
  assert.deepEqual(uiFood, preserved)
  for (const mutate of [food => { food.unapprovedField = true }, food => { food.source.extra = true },
    food => { food.nutrientsPer100g.fatG = -1 }, food => { food.prioritet = 'invalid-priority' }]) {
    const invalid = structuredClone(plan)
    mutate(invalid.meals[0].items[0].food.nutrition)
    const adapter = createPlanAdapter({ enabled: true, client: f.client, ...scope })
    await assert.rejects(adapter.activate(invalid))
    assert.equal(writes(f).length, 0)
    assert.deepEqual(await counts(f), [0, 0, 0])
  }
}))
