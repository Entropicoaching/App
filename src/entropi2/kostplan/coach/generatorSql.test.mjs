import test from 'node:test'
import assert from 'node:assert/strict'
import { withDatabase, mounted, scope, profile, names, date, athleteId, coachId, owner, stranger } from './generatorSql.fixture.mjs'
import { memoryStorage } from './portal.fixture.mjs'
import { openPortalPlan, draftKey } from './portalModel.mjs'
import { startPlanActivation } from './activation.mjs'
import { activationSnapshot, createPlanAdapter } from '../planAdapter.mjs'
import { FOODS } from '../foedevarer/catalog.mjs'

const counts = async db => {
  const result = []
  for (const table of names) result.push(Number((await db.query(`select count(*) n from public.${table}`)).rows[0].n))
  return result
}
const writes = f => f.calls.filter(c => c.payload)
const template = ['Morgenmad', 'Frokost', 'Aftensmad'].map((name, i) => ({ name, id: `meal-${i}`, items: [] }))
async function generated(storage) {
  const c = openPortalPlan({ enabled: true, ...scope, athlete: profile, template, storage: () => storage }).controller
  assert.equal(c.generate(), true); assert.equal(await c.save(), true)
  return { c, plan: { ...scope, goal: c.snapshot().form.goal, intensity: c.snapshot().form.intensity, meals: c.snapshot().meals } }
}
// Independent expected SQL shape: remove only the two known editorial keys.
const expectedMeals = meals => meals.map(m => ({ name: m.name, portions: m.items.map(i => ({ grams: i.grams,
  food: Object.fromEntries(Object.entries(i.food.nutrition).filter(([key]) => !['prioritet', 'prioritetBegrundelse'].includes(key))),
})) }))

test('mounted actual generator -> explicit draft save -> adapter -> original SQL: exact approved snapshot and repeated metadata-only reopen', { timeout: 60000 }, async () => withDatabase(async f => {
  const storage = memoryStorage(), catalogue = structuredClone(FOODS)
  let draft, approved
  await mounted(f.client, storage, async ui => {
    await ui.open()
    assert.equal(storage.data.size, 0); assert.equal(writes(f).length, 0)
    await ui.submit()
    assert.match(ui.host.textContent, /Gennemgå fødevarer og portioner før gemning/)
    assert.equal(storage.data.size, 0); assert.equal(writes(f).length, 0)
    await ui.click('Gem som kladde')
    await ui.wait(() => storage.data.size === 1)
    draft = JSON.parse(storage.data.get(draftKey(coachId, athleteId, date)))
    assert.equal(draft.plan.status, 'draft')
    const foods = draft.plan.meals.flatMap(m => m.items.map(i => i.food.nutrition))
    assert.ok(foods.some(food => food.prioritet && food.prioritetBegrundelse))
    assert.ok(foods.some(food => Object.values(food.nutrientsPer100g).includes(0)))
    assert.ok(foods.every(food => food.source.citation && food.source.verification && food.basisGrams === 100))
    await ui.wait(() => ui.host.querySelectorAll('button').some(n => n.textContent === 'Aktivér for atleten' && n.getAttribute('disabled') === null))
    await ui.click('Aktivér for atleten')
    await ui.wait(() => ui.host.textContent.includes('bekræftede aktive plan'))
    assert.deepEqual(await counts(f.db), [1, 1, 1])
    approved = (await f.db.query('select * from public.kostplan_v1_versions')).rows[0]
    assert.deepEqual(approved.meals, expectedMeals(draft.plan.meals))
    assert.equal(approved.goal, draft.plan.goal === 'maintain' ? 'vedligehold' : draft.plan.goal)
    assert.equal(Number(approved.intensity), draft.plan.intensity / 100)
    assert.doesNotMatch(ui.host.textContent, /kcal registreret/)
  })
  const baselineWrites = writes(f).length
  for (let i = 0; i < 3; i++) {
    const row = JSON.parse(storage.data.get(draftKey(coachId, athleteId, date)))
    for (const meal of row.plan.meals) for (const item of meal.items) if (item.food.nutrition.prioritet) {
      item.food.nutrition.prioritet = 'god'; item.food.nutrition.prioritetBegrundelse = `Synthetic editorial revision ${i}`
    }
    storage.data.set(draftKey(coachId, athleteId, date), JSON.stringify(row))
    const bytes = [...storage.data]
    await mounted(f.client, storage, async ui => {
      await ui.open(); await ui.wait(() => ui.host.textContent.includes('bekræftede aktive plan'))
      assert.ok(!ui.host.querySelectorAll('button').some(n => n.textContent === 'Aktivér for atleten' && n.getAttribute('disabled') === null))
      assert.equal(writes(f).length, baselineWrites)
    })
    assert.deepEqual([...storage.data], bytes)
    assert.deepEqual((await f.db.query('select * from public.kostplan_v1_versions')).rows[0], approved)
  }
  assert.deepEqual(FOODS, catalogue)
  assert.deepEqual(await counts(f.db), [1, 1, 1])
  await f.login(owner)
  const active = await createPlanAdapter({ enabled: true, client: f.client, athleteId, date }).loadActive()
  assert.equal(active.revision, approved.id)
  assert.deepEqual(active.meals.map(m => m.foods.map(i => i.grams)), draft.plan.meals.map(m => m.items.map(i => i.grams)))
  await f.login(stranger)
  assert.equal(await createPlanAdapter({ enabled: true, client: f.client, athleteId, date }).loadActive(), null)
}))

test('original SQL lost replies: immutable retry retains IDs and exact payload, approval loss reconciles after reopen', { timeout: 60000 }, async () => {
  for (const lost of names) await withDatabase(async f => {
    const storage = memoryStorage(), { c, plan } = await generated(storage)
    // Direct writer uses exactly the same generated payload as the UI bridge.
    const adapter = createPlanAdapter({ enabled: true, client: f.client, ...scope })
    await assert.rejects(adapter.activate(plan))
    const attempted = structuredClone(writes(f))
    const changed = structuredClone(plan); changed.meals[0].items[0].grams += 5
    await assert.rejects(adapter.activate(changed), /uafklarede/)
    assert.equal(writes(f).length, attempted.length)
    const metadata = structuredClone(plan)
    for (const m of metadata.meals) for (const i of m.items) if (i.food.nutrition.prioritet)
      i.food.nutrition.prioritetBegrundelse = 'Synthetic pending metadata only'
    const result = await adapter.activate(metadata)
    assert.equal(result.ok, true)
    assert.deepEqual(await counts(f.db), [1, 1, 1])
    assert.equal(result.planId, attempted.find(c => c.table === names[0]).payload.id)
    assert.equal(result.versionId, writes(f).find(c => c.table === names[1]).payload.id)
    const row = (await f.db.query('select * from public.kostplan_v1_versions')).rows[0]
    assert.deepEqual(row.meals, expectedMeals(plan.meals))
    assert.deepEqual(row.meals, writes(f).find(c => c.table === names[1]).payload.meals)
    const count = writes(f).length
    const reopened = openPortalPlan({ enabled: true, ...scope, athlete: profile, storage: () => storage }).controller
    const stop = startPlanActivation({ controller: reopened, client: f.client, ...scope })
    try {
      for (let n = 0; n < 500 && reopened.snapshot().activationState !== 'ready'; n++) await new Promise(resolve => setImmediate(resolve))
      assert.equal(reopened.snapshot().activationState, 'ready')
      assert.equal(reopened.snapshot().publishedVersion, reopened.snapshot().version)
      assert.equal(await reopened.activate(), false)
      assert.equal(writes(f).length, count)
      assert.deepEqual(c.snapshot().meals, plan.meals)
    } finally { stop() }
  }, { lost })
})

test('SQL contract stays strict: unsupported metadata/fields and malformed nutrients reject; owner/day/stale scopes stay isolated', { timeout: 60000 }, async () => withDatabase(async f => {
  const { plan } = await generated(memoryStorage()), adapter = createPlanAdapter({ enabled: true, client: f.client, ...scope })
  const canonical = activationSnapshot(plan), original = structuredClone(canonical.meals)
  for (const mutate of [
    food => { food.unrecognized = 'extra' }, food => { food.source.extra = 'extra' },
    food => { food.nutrientsPer100g.energyKcal = '0' }, food => { food.nutrientsPer100g.energyKcal = false },
    food => { food.nutrientsPer100g.energyKcal = -1 }, food => { delete food.source.citation },
    food => { food.prioritet = 'god'; food.prioritetBegrundelse = 'Only SQL must reject this raw pair' },
  ]) {
    const bad = structuredClone(original); mutate(bad[0].portions[0].food)
    assert.equal((await f.db.query('select public.kostplan_v1_valid_meals($1) ok', [JSON.stringify(bad)])).rows[0].ok, false)
  }
  for (const patch of [{ athleteId: stranger }, { date: '2026-11-08' }]) await assert.rejects(adapter.activate({ ...plan, ...patch }))
  assert.equal(writes(f).length, 0)
  await f.login(stranger)
  await assert.rejects(adapter.activate(plan))
  assert.equal(writes(f).filter(c => c.table === names[2]).length, 0)
  await f.login(coachId)
  await adapter.activate(plan)
  const version = (await f.db.query('select * from public.kostplan_v1_versions')).rows[0]
  assert.equal(await createPlanAdapter({ enabled: true, client: f.client, athleteId, date: '2026-11-06' }).loadActive(), null)
  await f.db.query('update public.kostplan_v1_versions set meals=$1 where id=$2', [JSON.stringify(original), version.id]).catch(() => {})
  assert.deepEqual((await f.db.query('select * from public.kostplan_v1_versions')).rows[0], version)
}))

test('generated controller with original SQL keeps reservation on lost replies, locks edits, and reconciles committed approval on reopen', { timeout: 60000 }, async () => {
  for (const lost of names) await withDatabase(async f => {
    const storage = memoryStorage(), { c, plan } = await generated(storage)
    const connect = async controller => {
      const stop = startPlanActivation({ controller, client: f.client, ...scope })
      for (let n = 0; n < 500 && controller.snapshot().activationState !== 'ready'; n++) await new Promise(resolve => setImmediate(resolve))
      assert.equal(controller.snapshot().activationState, 'ready')
      return stop
    }
    let stop = await connect(c)
    try {
      assert.equal(await c.activate(), false)
      assert.equal(c.snapshot().activationPending, true)
      const bytes = [...storage.data], count = writes(f).length
      assert.equal(c.editGrams(0, 0, 222), false)
      assert.equal(c.generate(), false); assert.equal(await c.save(), false)
      assert.deepEqual([...storage.data], bytes)
      stop()
      const reopened = openPortalPlan({ enabled: true, ...scope, athlete: profile, storage: () => storage }).controller
      const stopReopened = await connect(reopened)
      try {
        if (lost === names[2]) {
          assert.equal(reopened.snapshot().activationPending, false)
          assert.equal(reopened.snapshot().publishedVersion, reopened.snapshot().version)
        } else {
          assert.equal(reopened.snapshot().activationPending, true)
          assert.equal(await reopened.save(), false)
          assert.deepEqual([...storage.data], bytes)
        }
        assert.equal(await reopened.activate(), false)
        assert.equal(writes(f).length, count)
      } finally { stopReopened() }
      stop = await connect(c)
      if (lost !== names[2]) assert.equal(await c.activate(), true)
      else assert.equal(c.snapshot().publishedVersion, c.snapshot().version)
      assert.deepEqual(await counts(f.db), [1, 1, 1])
      assert.deepEqual((await f.db.query('select meals from public.kostplan_v1_versions')).rows[0].meals, expectedMeals(plan.meals))
    } finally { stop() }
  }, { lost })
})
