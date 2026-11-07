import test from 'node:test'
import assert from 'node:assert/strict'
import { supportedFoodSnapshot, supportedPlanSnapshot } from './sqlSnapshot.mjs'
import { activationSnapshot, createPlanAdapter } from './planAdapter.mjs'
import { FOODS } from './foedevarer/catalog.mjs'
import { catalogFoods } from './coach/model.mjs'
import { syntheticTables, tableNames } from './coach/activation.fixture.mjs'

const raw = () => structuredClone(FOODS.find(f => f.prioritet))
const plan = food => ({ athleteId: 'snapshot-athlete', date: '2026-11-07', goal: 'maintain', intensity: 10,
  meals: [{ id: 'meal', name: 'Synthetic meal', items: [{ grams: 125.5, food: catalogFoods([food])[0] }] }] })

test('SQL boundary retains every supported value, known zero, null and provenance without mutating catalogue metadata', () => {
  const input = raw(), before = structuredClone(input)
  input.nutrientsPer100g.ironMg = 0
  const expected = Object.fromEntries(Object.entries(input).filter(([key]) => !['prioritet', 'prioritetBegrundelse'].includes(key)))
  const supported = supportedFoodSnapshot(input)
  assert.deepEqual(supported, expected)
  assert.equal(supported.nutrientsPer100g.ironMg, 0)
  assert.equal(supported.nutrientsPer100g.vitaminDUg, null)
  assert.equal(input.prioritet, before.prioritet)
  assert.equal(input.prioritetBegrundelse, before.prioritetBegrundelse)
  assert.ok(Object.isFrozen(supported) && Object.isFrozen(supported.source))
  const version = { goal: 'cut', intensity: 0.15, meals: [{ name: 'Synthetic', portions: [{ grams: 125.5, food: input }] }] }
  assert.deepEqual(supportedPlanSnapshot(version).meals[0].portions[0], { grams: 125.5, food: expected })
  assert.deepEqual(version.meals[0].portions[0].food, input)
})

const invalidFoods = [
  f => { f.unknown = 'never silently discarded' },
  f => { f.source.url = 'unsupported' },
  f => { f.nutrientsPer100g.proteinMg = 12 },
  ...['0', '', false, NaN, Infinity, -1, 1e12 + 1, undefined, {}].map(value => f => { f.nutrientsPer100g.ironMg = value }),
  f => { f.basisGrams = '100' }, f => { f.basisGrams = 0 },
  f => { f.id = '' }, f => { f.name = null }, f => { f.preparation = '' },
  f => { delete f.source }, f => { f.source.citation = '' },
  f => { f.source.verification = false }, f => { delete f.prioritetBegrundelse },
  f => { f.prioritet = 'unsupported' },
]

test('unsupported fields and invalid values are rejected before normalization; none becomes valid food or zero', async () => {
  const f = syntheticTables(), adapter = createPlanAdapter({ enabled: true, ...plan(raw()), client: f.client })
  for (const mutate of invalidFoods) {
    const food = raw(); mutate(food)
    assert.throws(() => supportedFoodSnapshot(food))
    const input = plan(raw()); input.meals[0].items[0].food.nutrition = food
    await assert.rejects(adapter.activate(input))
    const version = { goal: 'cut', intensity: 0.15, meals: [{ name: 'Synthetic', portions: [{ grams: 100, food }] }] }
    assert.throws(() => supportedPlanSnapshot(version))
  }
  assert.equal(f.calls.length, 0)
})

test('actual writer checks raw canonical input too, and preserves existing legacy macro bridge', () => {
  const food = raw(), input = plan(food)
  input.meals[0].items[0].food = { ...food, per100g: input.meals[0].items[0].food.per100g }
  assert.deepEqual(activationSnapshot(input).meals[0].portions[0].food, supportedFoodSnapshot(food))
  input.meals[0].items[0].food.extra = 'must reject before catalogFoods'
  assert.throws(() => activationSnapshot(input))
  input.meals[0].items[0].food = { id: 'legacy', name: 'Legacy', per100g: { kcal: 100, protein: 0, carb: 25, fat: 0 } }
  const portion = activationSnapshot(input).meals[0].portions[0]
  assert.equal(portion.grams, 125.5)
  assert.equal(portion.food.nutrientsPer100g.proteinG, 0)
  assert.equal(portion.food.source.citation, 'Coach-supplied food snapshot')
  input.meals[0].items[0].food.extra = 'must reject legacy extras too'
  assert.throws(() => activationSnapshot(input))
  input.meals[0].items[0].food = catalogFoods([food])[0]
  input.meals[0].items[0].food.extra = 'must reject wrapper extras too'
  assert.throws(() => activationSnapshot(input))
})

test('priority-only variation retains pending IDs and payload; a changed supported value cannot replace an uncertain write', async () => {
  for (const lost of tableNames) {
    const f = syntheticTables({ lost }), input = plan(raw())
    const adapter = createPlanAdapter({ enabled: true, ...input, client: f.client })
    const before = structuredClone(input)
    await assert.rejects(adapter.activate(input))
    const reserved = structuredClone(f.data), calls = f.writes().length
    const changed = structuredClone(input); changed.meals[0].items[0].grams++
    await assert.rejects(adapter.activate(changed), /uafklarede/)
    assert.equal(f.writes().length, calls)
    const varied = structuredClone(input)
    varied.meals[0].items[0].food.nutrition.prioritet = 'særlig'
    varied.meals[0].items[0].food.nutrition.prioritetBegrundelse = 'Synthetic alternative explanation'
    assert.deepEqual(activationSnapshot(varied), activationSnapshot(input))
    assert.equal((await adapter.activate(varied)).ok, true)
    for (const table of tableNames) {
      assert.equal(f.data[table].length, 1)
      for (const old of reserved[table]) {
        const actual = f.data[table][0]
        for (const [key, value] of Object.entries(old)) if (key !== 'status') assert.deepEqual(actual[key], value)
      }
    }
    assert.deepEqual(input, before)
  }
})
