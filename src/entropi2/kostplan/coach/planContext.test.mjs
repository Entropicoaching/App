import test from 'node:test'
import assert from 'node:assert/strict'
import { profileCalculation, profileTraining } from './gramPlan.mjs'
import { openPortalPlan, draftKey } from './portalModel.mjs'
import { memoryStorage } from './portal.fixture.mjs'
import { calculateNutrition } from '../beregning.mjs'

const date = '2026-11-05', coachId = 'synthetic-context-coach'
const athlete = { id: 'synthetic-context-adult', age: 26, bodyweight: 92, goal: 'maintain',
  kcal_target: 3200, protein_target: 180 }
const meals = ['Morgenmad', 'Frokost', 'Aftensmad'].map((name, i) => ({ id: `meal-${i}`, name, items: [] }))
const open = (storage, patch = {}) => openPortalPlan({ enabled: true, coachId, date,
  athlete: { ...athlete, ...patch }, storage: () => storage, template: meals })

test('explicit training contract reaches the actual calculation and generator without mutating input', () => {
  for (const volume of ['rest', 'light', 'moderate', 'high']) for (const intensity of ['light', 'moderate', 'high']) {
    if (volume === 'rest' && intensity !== 'light') continue
    const profile = { ...athlete, training: { volume, intensity }, allergies: ['synthetic-note'], budget: 'low' }
    const before = structuredClone(profile), basis = profileCalculation(profile, date)
    assert.deepEqual(basis.training, profile.training)
    assert.notEqual(basis.training, profile.training)
    assert.deepEqual(Object.keys(basis).sort(), ['adult', 'date', 'profileEstimate', 'training', 'weightKg'])
    const { controller } = open(memoryStorage(), profile)
    const expected = calculateNutrition({ ...basis, goal: athlete.goal }).targets
    assert.deepEqual(controller.snapshot().suggestion, expected)
    assert.equal(controller.generate(meals), true)
    assert.deepEqual(controller.snapshot().planTargets, expected)
    assert.deepEqual(profile, before)
  }
  const normal = open(memoryStorage()).controller.snapshot().suggestion
  const high = open(memoryStorage(), { training: { volume: 'high', intensity: 'high' } }).controller.snapshot().suggestion
  assert.ok(high.kcal > normal.kcal)
  assert.equal(high.protein, 184) // Existing model, separate from coach's 180.
})

test('absent, partial, invalid and unrelated training stays unknown; missing age never becomes adult', () => {
  for (const training of [undefined, null, {}, { volume: 'high' }, { intensity: 'high' },
    { volume: 'rest', intensity: 'high' }, { volume: 'HIGH', intensity: 'high' }, 'high', 0]) {
    assert.equal(profileTraining(training), null)
    assert.equal(Object.hasOwn(profileCalculation({ ...athlete, training }, date), 'training'), false)
  }
  const profile = { ...athlete, training_load: 'high', readiness: { energy: 1, hunger: 5 } }
  assert.equal(Object.hasOwn(profileCalculation(profile, date), 'training'), false)
  for (const age of [undefined, null, '', 17, 30.5, 121]) {
    assert.equal(profileCalculation({ ...profile, age, training: { volume: 'high', intensity: 'high' } }, date), null)
    assert.equal(open(memoryStorage(), { age }).controller.snapshot().calculated, false)
  }
})

test('old four-field drafts and explicit training drafts reuse the same save path and reopen', async () => {
  for (const training of [undefined, { volume: 'high', intensity: 'high' }, { volume: 'rest', intensity: 'light' }]) {
    const storage = memoryStorage(), patch = { training }, first = open(storage, patch).controller
    assert.equal(first.generate(meals), true); assert.equal(storage.data.size, 0)
    assert.equal(await first.save(), true)
    assert.deepEqual([...storage.data.keys()], [draftKey(coachId, athlete.id, date)])
    const saved = JSON.parse([...storage.data.values()][0])
    assert.equal(saved.plan.status, 'draft'); assert.deepEqual(saved.calculation.training, training)
    assert.deepEqual(Object.keys(saved).sort(), ['calculation', 'clientVersion', 'coachId', 'date', 'form', 'plan', 'schema', 'sequence'])
    const next = open(storage, patch)
    assert.equal(next.loadError, null); assert.equal(next.restored, true)
    assert.deepEqual(next.controller.snapshot().planTargets, first.snapshot().planTargets)
    assert.deepEqual(next.controller.snapshot().meals, first.snapshot().meals)
  }
})

test('changed training invalidates saved generation even when existing floors yield identical targets', async () => {
  const storage = memoryStorage(), patch = { bodyweight: 80, goal: 'cut', training: { volume: 'high', intensity: 'moderate' } }
  const first = open(storage, patch).controller
  first.set('maintenanceKcal', '1600'); first.set('intensity', 15)
  assert.equal(first.generate(meals), true); assert.equal(await first.save(), true)
  const previous = [...storage.data.values()][0]
  const next = open(storage, { ...patch, training: { volume: 'high', intensity: 'high' } })
  assert.equal(next.loadError, null); assert.equal(next.restored, true)
  assert.deepEqual(next.controller.snapshot().suggestion, first.snapshot().planTargets)
  assert.equal(next.controller.snapshot().planTargets, null)
  assert.equal(await next.controller.save(), false)
  assert.equal([...storage.data.values()][0], previous)
  assert.deepEqual(next.controller.snapshot().meals, first.snapshot().meals)
  assert.equal(next.controller.generate(), true); assert.equal(await next.controller.save(), true)
})

test('corrupt stored training metadata fails closed without weakening local draft guards', async () => {
  const storage = memoryStorage(), c = open(storage).controller
  c.generate(meals); await c.save()
  const key = draftKey(coachId, athlete.id, date), original = storage.data.get(key)
  for (const training of [null, {}, { volume: 'rest', intensity: 'high' },
    { volume: 'high', intensity: 'high', invented: true }]) {
    const saved = JSON.parse(original); saved.calculation.training = training
    storage.data.set(key, JSON.stringify(saved))
    const next = open(storage)
    assert.ok(next.loadError); assert.equal(next.restored, false)
    next.controller.generate(meals)
    assert.equal(await next.controller.save(), false)
    assert.equal(storage.data.get(key), JSON.stringify(saved))
  }
})
