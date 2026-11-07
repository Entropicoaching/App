// Separate same-engine Codex review phase: independent synthetic countercases.
// This is local artifact review, not a fresh native K ticket or integration gate.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createFood } from './foedevarer/catalog.mjs'
import { catalogFoods } from './coach/model.mjs'
import { activationSnapshot, createPlanAdapter } from './planAdapter.mjs'
import { readActivationState } from './coach/activation.mjs'
import { syntheticTables, tableNames } from './coach/activation.fixture.mjs'
import { withDatabase, scope, names } from './coach/generatorSql.fixture.mjs'

const plan = () => ({ athleteId: 'review-athlete', date: '2026-11-07', goal: 'maintain', intensity: 10,
  meals: [{ id: 'review-meal', name: 'Review meal', items: [{ grams: 12.5, food: catalogFoods([createFood({
    id: 'review-zero', name: 'Known zero', preparation: 'synthetic',
    source: { citation: 'Independent synthetic review data', verification: 'synthetic' },
    nutrientsPer100g: { energyKcal: 0, proteinG: 0, carbohydrateG: 0, fatG: 0, calciumMg: 0, ironMg: null },
    prioritet: 'basis', prioritetBegrundelse: 'Review editorial metadata',
  })])[0] }] }] })

test('review: exact original SQL accepts known zero and unknown micro separately, with no priority or source loss', { timeout: 60000 }, async () => withDatabase(async f => {
  const input = { ...plan(), athleteId: scope.athleteId, date: scope.date }
  const expectedFood = structuredClone(input.meals[0].items[0].food.nutrition)
  delete expectedFood.prioritet; delete expectedFood.prioritetBegrundelse
  const adapter = createPlanAdapter({ enabled: true, client: f.client, ...scope })
  await adapter.activate(input)
  const stored = (await f.db.query('select meals from public.kostplan_v1_versions')).rows[0].meals
  assert.deepEqual(stored, [{ name: 'Review meal', portions: [{ grams: 12.5, food: expectedFood }] }])
  assert.equal(stored[0].portions[0].food.nutrientsPer100g.calciumMg, 0)
  assert.equal(stored[0].portions[0].food.nutrientsPer100g.ironMg, null)
  assert.deepEqual((await adapter.loadActive()).targets, { kcal: 0, protein: 0, carb: 0, fat: 0 })
  assert.equal(f.calls.filter(c => c.payload && c.table === names[2]).length, 1)
}))

test('review: equality ignores only valid editorial pair; supported identity/provenance/nutrients/portions/settings remain significant', async () => {
  const input = plan(), f = syntheticTables(), adapter = createPlanAdapter({ enabled: true, ...input, client: f.client })
  await adapter.activate(input)
  const state = await readActivationState({ client: f.client, ...input })
  const fingerprint = p => JSON.stringify(activationSnapshot(p))
  assert.equal(state.fingerprint, fingerprint(input))
  const metadata = structuredClone(input)
  metadata.meals[0].items[0].food.nutrition.prioritet = 'særlig'
  metadata.meals[0].items[0].food.nutrition.prioritetBegrundelse = 'Different valid editorial reason'
  assert.equal(state.fingerprint, fingerprint(metadata))
  for (const change of [
    p => { p.meals[0].items[0].food.nutrition.source.citation += ' changed' },
    p => { p.meals[0].items[0].food.nutrition.preparation = 'changed' },
    p => { p.meals[0].items[0].food.nutrition.nutrientsPer100g.calciumMg = null },
    p => { p.meals[0].items[0].grams = 25 },
    p => { p.goal = 'cut' }, p => { p.intensity = 15 },
  ]) {
    const changed = structuredClone(input); change(changed)
    assert.notEqual(state.fingerprint, fingerprint(changed))
  }
  const writes = f.writes().length
  const row = f.data[tableNames[1]][0], saved = structuredClone(row)
  row.meals[0].portions[0].food.source.unrecognized = 'must reject read too'
  await assert.rejects(readActivationState({ client: f.client, ...input }))
  f.data[tableNames[1]][0] = saved
  assert.equal((await readActivationState({ client: f.client, ...input })).fingerprint, state.fingerprint)
  assert.equal(f.writes().length, writes)
})

test('review: malformed canonical and wrapper fields never reserve IDs or reach transport', async () => {
  const f = syntheticTables(), input = plan(), adapter = createPlanAdapter({ enabled: true, ...input, client: f.client })
  for (const change of [
    p => { p.meals[0].items[0].food.nutrition.nutrientsPer100g.calciumMg = '0' },
    p => { p.meals[0].items[0].food.nutrition.source = [] },
    p => { p.meals[0].items[0].food.per100g.unknown = 0 },
    p => { p.meals[0].items[0].food.nutrition.unknown = 0 },
    p => { p.meals[0].items[0].food.nutrition.prioritetBegrundelse = '' },
    p => { p.meals[0].items[0].grams = NaN },
  ]) {
    const invalid = structuredClone(input); change(invalid)
    await assert.rejects(adapter.activate(invalid))
  }
  assert.equal(f.calls.length, 0)
  assert.equal((await adapter.activate(input)).ok, true)
  assert.deepEqual(tableNames.map(t => f.data[t].length), [1, 1, 1])
})
