import test from 'node:test'
import assert from 'node:assert/strict'
import { profileCalculation, generateCoachGrams } from './gramPlan.mjs'
import { openPortalPlan, draftKey } from './portalModel.mjs'
import { catalogFoods } from './model.mjs'
import { memoryStorage } from './portal.fixture.mjs'
import { FOODS } from '../foedevarer/index.mjs'
import { calculateNutrition } from '../beregning.mjs'
import { generateGramPlan } from '../generator/index.mjs'
import { strengthDays, selection } from '../generator/days.fixture.mjs'

const date = '2026-11-05'
const athlete = { id: 'synthetic-adult', age: 30, bodyweight: 80, goal: 'maintain', kcal_target: 9999, protein_target: 999 }
const scope = { enabled: true, coachId: 'synthetic-coach', athlete, date }
const choices = () => strengthDays()[2].input.meals
const setup = (storage = memoryStorage(), extra = {}) => ({ storage,
  ...openPortalPlan({ ...scope, storage: () => storage, ...extra }) })
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`)

test('generator eligibility uses existing age, weight, goal and date; missing evidence stays hidden', () => {
  assert.deepEqual(profileCalculation(athlete, date), { date, adult: true, weightKg: 80, profileEstimate: true })
  for (const patch of [{ age: undefined }, { age: null }, { age: 17 }, { age: 30.5 }, { age: 121 },
    { bodyweight: '' }, { bodyweight: 24 }, { bodyweight: 351 }, { bodyweight: Infinity }, { goal: undefined }, { goal: 'unknown' }]) {
    assert.equal(profileCalculation({ ...athlete, ...patch }, date), null)
    assert.equal(setup(undefined, { athlete: { ...athlete, ...patch } }).controller.snapshot().gramGenerator, false)
  }
  for (const invalid of ['2026-02-30', '1899-12-31', '9999-12-25']) assert.equal(profileCalculation(athlete, invalid), null)
})

test('actual calculation and generator populate only selected foods with bounded grams and live deviations', async () => {
  const { controller: c, storage } = setup(), chosen = choices(), before = structuredClone(chosen)
  const expectedTargets = calculateNutrition({ date, adult: true, weightKg: 80, goal: 'maintain' }).targets
  const expected = generateGramPlan({ targets: expectedTargets, mealCount: chosen.length, meals: chosen })
  assert.equal(c.snapshot().calculated, true); assert.equal(c.snapshot().form.maintenanceKcal, '')
  assert.equal(c.generate(chosen), true)
  const s = c.snapshot()
  assert.deepEqual(s.planTargets, expectedTargets)
  assert.equal(s.proposal.maintenanceSource, 'weight-estimate')
  assert.ok(s.proposal.warnings.some(w => /Foreløbigt vægtbaseret/.test(w)))
  assert.equal(s.generation.status, expected.status)
  for (let mi = 0; mi < chosen.length; mi++) {
    assert.deepEqual(s.meals[mi].items.map(i => i.food.id), chosen[mi].items.map(i => i.foodId))
    assert.deepEqual(s.meals[mi].items.map(i => i.grams), expected.meals[mi].items.map(i => i.grams))
  }
  for (const key of ['kcal', 'protein', 'carb', 'fat']) {
    close(s.totals[key], expected.totals[key])
    close(s.gramFeedback.deviation[key], s.totals[key] - expectedTargets[key])
  }
  assert.deepEqual(chosen, before); assert.equal(storage.data.size, 0)
  const foodBefore = s.meals[0].items[0].food
  c.editGrams(0, 0, '123,5')
  assert.equal(c.snapshot().generation, null)
  close(c.snapshot().gramFeedback.deviation.protein, c.snapshot().totals.protein - expectedTargets.protein)
  assert.equal(await c.save(), true)
  assert.deepEqual([...storage.data.keys()], [draftKey(scope.coachId, athlete.id, date)])
  const stored = JSON.parse([...storage.data.values()][0])
  assert.equal(stored.plan.status, 'draft'); assert.equal(stored.plan.meals[0].items[0].grams, 123.5)
  assert.deepEqual(stored.plan.meals[0].items[0].food.nutrition, foodBefore.nutrition)
  const restored = setup(storage)
  assert.equal(restored.restored, true); assert.equal(restored.controller.snapshot().meals[0].items[0].grams, 123.5)
  assert.deepEqual(restored.controller.snapshot().planTargets, expectedTargets)
  assert.equal(restored.controller.generate(), true) // saved portions retain explicit bounds
  assert.equal(restored.controller.snapshot().meals[0].items[0].grams % 5, 0)
})

test('coach target edits use the real floors, invalidate stale plans and refuse manual macro overrides', async () => {
  const { controller: c } = setup()
  c.generate(choices()); c.set('goal', 'cut'); c.set('intensity', 15); c.set('maintenanceKcal', '2000')
  assert.equal(c.snapshot().planTargets, null); assert.equal(await c.save(), false)
  assert.equal(c.set('protein', '1'), false); assert.equal(c.set('fat', '1'), false)
  assert.equal(c.generate(), true)
  assert.deepEqual(c.snapshot().planTargets, calculateNutrition({ date, adult: true, weightKg: 80,
    goal: 'cut', intensity: 'aggressive', maintenanceKcal: 2000 }).targets)
  assert.ok(c.snapshot().planTargets.kcal > 2000 * 0.85)
  assert.equal(c.snapshot().proposal.maintenanceSource, 'coach-estimate')
})

test('infeasible and unmet statuses remain honest; manual edits update feedback without an obsolete proof', () => {
  const { controller: c } = setup()
  assert.equal(c.generate([{ id: 'm', name: 'Syntetisk', items: [selection('Kyllingebryst', 50, 200)] }]), true)
  assert.equal(c.snapshot().generation.status, 'infeasible')
  assert.match(c.snapshot().gramFeedback.message, /kan ikke nås/)
  assert.equal(c.snapshot().totals.carb, 0)
  c.editGrams(0, 0, 100)
  assert.doesNotMatch(c.snapshot().gramFeedback.message, /kan ikke nås/)
  assert.match(c.snapshot().gramFeedback.message, /rettede portioner/)
  const result = generateCoachGrams([{ id: 'm', name: 'Syntetisk', items: [selection('Ris kogt', 100, 300)] }],
    { kcal: 130, protein: 9, carb: 84, fat: 0 }, catalogFoods(FOODS))
  assert.equal(result.result.status, 'unmet'); assert.match(result.result.message, /beviser ikke/)
})

test('invalid choices keep current meals, cannot fabricate food macros or save changed bounds', async () => {
  const { controller: c, storage } = setup(); c.generate(choices())
  const before = c.snapshot().meals
  for (const items of [[selection('unknown', 5, 50)], [selection('Ris kogt', 0, 100)],
    [selection('Ris kogt', 5, 53)], [selection('Ris kogt', 100, 50)],
    [selection('Ris kogt', 5, 50), selection('Ris kogt', 5, 50)]]) {
    assert.equal(c.generate([{ id: 'm', name: 'Syntetisk', items }]), false)
    assert.deepEqual(c.snapshot().meals, before)
  }
  const catalog = structuredClone(catalogFoods(FOODS)); catalog[0].per100g.protein += 1
  assert.throws(() => generateCoachGrams([{ id: 'm', name: 'Syntetisk', items: [{ foodId: catalog[0].id, minGrams: 5, maxGrams: 50 }] }],
    c.snapshot().planTargets, catalog), /katalog/)
  assert.equal(c.editBounds(0, 0, 'minGrams', '45'), true)
  assert.equal(c.snapshot().planTargets, null); assert.equal(await c.save(), false)
  assert.equal(c.generate(), true); assert.equal(c.snapshot().meals[0].items[0].minGrams, 45)
  c.editGrams(0, 0, ''); assert.equal(c.snapshot().gramFeedback, null); assert.equal(await c.save(), false)
  assert.equal(storage.data.size, 0)
})

test('restored calculated drafts require regeneration after changed profile evidence; corrupt metadata fails closed', async () => {
  const { controller: c, storage } = setup(); c.generate(choices()); await c.save()
  const key = [...storage.data.keys()][0], valid = storage.data.get(key)
  const next = setup(storage, { athlete: { ...athlete, bodyweight: 90 } })
  assert.equal(next.restored, true); assert.equal(next.controller.snapshot().planTargets, null)
  assert.equal(await next.controller.save(), false); assert.equal(storage.data.get(key), valid)
  assert.equal(next.controller.generate(), true)
  assert.equal(next.controller.snapshot().planTargets.protein, 180)
  for (const patch of [{ adult: false }, { date: '2026-11-04' }, { weightKg: null }, { invented: true }]) {
    const bad = JSON.parse(valid); Object.assign(bad.calculation, patch); storage.data.set(key, JSON.stringify(bad))
    const corrupt = setup(storage); assert.equal(corrupt.restored, false); assert.ok(corrupt.loadError)
    corrupt.controller.generate(choices()); assert.equal(await corrupt.controller.save(), false)
  }
})

test('pending local writes lock generation and bounds; failed writes preserve the actual proposal and corrections', async () => {
  let finish
  const storage = memoryStorage(), { controller: c } = setup(storage)
  c.generate(choices())
  const original = storage.setItem
  storage.setItem = (...args) => { original(...args); throw Error('Synthetic write failure') }
  assert.equal(await c.save(), false); assert.ok(c.snapshot().meals.length); assert.equal(c.snapshot().saved, null)
  // The adapter's conflict check rejects a partially failed write as well.
  assert.equal(await c.save(), false)
  const { createCoachPlan } = await import('./controller.mjs')
  const pending = createCoachPlan({ enabled: true, gramGenerator: true, athlete, date, catalog: FOODS,
    basis: { athleteId: athlete.id, date, calculation: profileCalculation(athlete, date) },
    saveDraft: () => new Promise(resolve => { finish = resolve }) })
  pending.generate(choices()); const saving = pending.save()
  assert.equal(pending.generate(choices()), false); assert.equal(pending.editBounds(0, 0, 'minGrams', '50'), false)
  finish(false); assert.equal(await saving, false)
})

test('empty coach meals use only matching available catalogue data and save as ordinary namespaced drafts', async () => {
  const { controller: c, storage } = setup()
  const manual = { id: 'manual', name: 'Coachens valg', items: [selection('Sukker', 25, 25)] }
  const empty = { id: 'empty', name: 'Syntetisk forslag', items: [] }
  assert.equal(c.generate([manual, empty]), true)
  assert.deepEqual(c.snapshot().meals[0].items.map(item => [item.food.id, item.grams]), [[selection('Sukker').foodId, 25]])
  for (const item of c.snapshot().meals[1].items) {
    const food = FOODS.find(food => food.id === item.food.id)
    assert.equal(item.food.nutrition.prioritetBegrundelse, food.prioritetBegrundelse)
  }
  assert.equal(storage.calls.filter(call => call[0] === 'set').length, 0)
  assert.equal(await c.save(), true)
  assert.deepEqual([...storage.data.keys()], [draftKey(scope.coachId, athlete.id, date)])
  const restored = setup(storage).controller
  assert.deepEqual(restored.snapshot().meals, c.snapshot().meals)
  const ids = restored.snapshot().meals.map(meal => meal.items.map(item => item.food.id))
  assert.equal(restored.generate(), true)
  assert.deepEqual(restored.snapshot().meals.map(meal => meal.items.map(item => item.food.id)), ids)
  const available = catalogFoods(FOODS).filter(food => food.name === 'Ris kogt')
  const generated = generateCoachGrams([empty], c.snapshot().planTargets, available)
  assert.deepEqual(generated.meals[0].items.map(item => item.food.id), [available[0].id])
  available[0].per100g.carb += 1
  assert.throws(() => generateCoachGrams([empty], c.snapshot().planTargets, available), /ingen tilgængelige/)
})

test('four named coach meals retain variation through scoped save, restore and regeneration', async () => {
  const { controller: c, storage } = setup()
  const template = ['Morgenmad', 'Frokost', 'Aftensmad', 'Mellemmåltid'].map((name, i) =>
    ({ id: `synthetic-${i}`, name, items: [] }))
  assert.equal(c.generate(template), true)
  const selected = c.snapshot().meals.map(meal => meal.items.map(item => item.food.name))
  assert.deepEqual(selected, [['Skyr naturel', 'Havregryn'], ['Kyllingebryst', 'Ris kogt', 'Broccoli'],
    ['Laks fersk', 'Linser kogte', 'Broccoli'], ['Skyr naturel']])
  assert.equal(storage.data.size, 0)
  assert.equal(await c.save(), true)
  assert.deepEqual([...storage.data.keys()], [draftKey(scope.coachId, athlete.id, date)])
  const restored = setup(storage).controller
  assert.equal(restored.generate(), true)
  assert.deepEqual(restored.snapshot().meals.map(meal => meal.items.map(item => item.food.name)), selected)
  assert.equal(JSON.parse([...storage.data.values()][0]).plan.status, 'draft')
})
