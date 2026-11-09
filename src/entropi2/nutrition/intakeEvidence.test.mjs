import test from 'node:test'
import assert from 'node:assert/strict'
import { createFood } from '../kostplan/foedevarer/catalog.mjs'
import { createIntakeEvidenceRequest, readIntakeEvidence, summarizeIntakeEvidence } from './intakeEvidence.mjs'
import { createNutritionController, foodPortion } from './controller.mjs'
import { nutritionContracts } from './contracts.mjs'

const athleteId = '00000000-0000-4000-8000-000000000001'
const requestId = '00000000-0000-4000-8000-000000000002'
const date = '2026-11-09', scope = { athleteId, date }
const food = createFood({ id: 'synthetic:raw:v1', name: 'Syntetisk reference', preparation: 'raw',
  nutrientsPer100g: { energyKcal: 123.4, proteinG: 10, carbohydrateG: 12, fatG: 0,
    ironMg: 2, calciumMg: 0, vitaminDUg: 0.8, fibreG: 3, leucineG: null },
  source: { citation: 'Synthetic fixture v1; no real food measurement', verification: 'user supplied, unverified' } })
const input = (overrides = {}) => ({ athleteId, date, requestId, food, grams: 125.25, meal: 'Syntetisk mad · 125 g', ...overrides })
const freeze = v => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v) } return v }
function pair(overrides = {}) {
  const r = createIntakeEvidenceRequest(input(overrides))
  const p = foodPortion({ name: r.food.name, kcal100: 123.4, protein100: 10, carb100: 12, fat100: 0 }, r.grams)
  const values = { kcal: p.kcal, protein: p.protein, carb: p.carb, fat: p.fat }
  const parent = { id: r.requestId, athlete_id: r.athleteId, date: r.date, meal: r.meal, ...values }
  const evidence = { meal_log_id: r.requestId, request_id: r.requestId, athlete_id: r.athleteId, date: r.date,
    version: 1, food: r.food, grams: r.grams, meal: r.meal, ...values, created_at: '2026-11-09T12:00:00Z' }
  return { parent, evidence }
}

test('pinned lead: original controller + real contract persist seven macro fields, no food/grams/reference', async () => {
  const inserts = []
  const client = { from(table) { assert.equal(table, 'meal_logs'); return {
    select() { return { eq() { return { gte() { return { lte() { return { order: async () => ({ data: [], error: null }) } } } } } } } },
    insert(row) { inserts.push(row); return { select: async () => ({ data: [{ id: requestId }], error: null }) } },
  } } }
  const c = createNutritionController({ enabled: true, athlete: { id: athleteId }, date,
    contracts: nutritionContracts({ client }), foods: [{ id: food.id, name: food.name,
      kcal100: 123.4, protein100: 10, carb100: 12, fat100: 0 }] })
  try {
    assert.equal(await c.load(), true)
    assert.equal(await c.logFood(0, 125.25, 0, 'synthetic-click'), true)
    assert.deepEqual(Object.keys(inserts[0]).sort(), ['athlete_id', 'date', 'meal', 'kcal', 'protein', 'carb', 'fat'].sort())
    assert.equal(readIntakeEvidence({ ...inserts[0], id: requestId }, null, scope), null)
    assert.equal(summarizeIntakeEvidence({ ...scope, mealLogs: [{ ...inserts[0], id: requestId }], evidenceRows: [] }).nutrients.ironMg.total, null)
  } finally { c.dispose() }
})

test('original snapshot validation, exact decimal grams, nine micros, source and genuine zero; frozen inputs unchanged', () => {
  const raw = freeze(input()), before = JSON.stringify(raw)
  const r = createIntakeEvidenceRequest(raw)
  assert.equal(r.grams, 125.25)
  assert.equal(Object.keys(r.food.nutrientsPer100g).length, 15)
  assert.equal(r.food.nutrientsPer100g.leucineG, null)
  const { parent, evidence } = pair()
  const result = readIntakeEvidence(freeze(parent), freeze(evidence), scope)
  assert.equal(result.nutrients.ironMg, 2.505)
  assert.equal(result.nutrients.calciumMg, 0)
  assert.equal(result.nutrients.magnesiumMg, null)
  assert.equal(Object.keys(result.nutrients).length, 9)
  assert.equal(result.food.preparation, 'raw')
  assert.deepEqual(result.food.source, food.source)
  assert.equal(result.referenceKind, 'user-reported-reference')
  assert.equal(JSON.stringify(raw), before)
  assert.ok(Object.isFrozen(result.food.nutrientsPer100g))
})

test('strict bounds/types/unknown keys, no NaN, strings or inferred macros', () => {
  for (const grams of [0, -1, NaN, Infinity, '125.25', 100000.000001, 0.0000001])
    assert.throws(() => createIntakeEvidenceRequest(input({ grams })), TypeError, String(grams))
  for (const bad of [{ extra: 1 }, { date: '2026-02-30' }, { date: '1899-12-31' }, { athleteId: 'owner' },
    { requestId: null }, { meal: '[appData2-day-v1]synthetic' }, { meal: 'x'.repeat(513) }, { meal: '\nfood' }])
    assert.throws(() => createIntakeEvidenceRequest({ ...input(), ...bad }), TypeError)
  for (const change of [f => { f.extra = 1 }, f => { f.source.extra = 1 }, f => { f.source.citation = '' },
    f => { f.name = 'x'.repeat(257) }, f => { f.nutrientsPer100g.ironMg = '2' },
    f => { f.nutrientsPer100g.ironMg = -1 }, f => { f.nutrientsPer100g.energyKcal = null },
    f => { f.nutrientsPer100g.energyKcal = 1e12 }, f => { f.nutrientsPer100g.folateUg = Infinity }]) {
    const f = structuredClone(food); change(f)
    assert.throws(() => createIntakeEvidenceRequest(input({ food: f })), TypeError)
  }
})

test('missing, malformed, mismatched, and stale parent edits remain unknown', () => {
  const { parent, evidence } = pair()
  for (const key of ['id', 'athlete_id', 'date', 'meal', 'kcal', 'protein', 'carb', 'fat']) {
    const changed = { ...parent, [key]: typeof parent[key] === 'number' ? parent[key] + 1 : 'changed' }
    assert.equal(readIntakeEvidence(changed, evidence, scope), null, key)
  }
  for (const change of [e => { e.version = 2 }, e => { e.grams = '125.25' }, e => { e.extra = 0 },
    e => { e.request_id = athleteId }, e => { e.created_at = null }, e => { e.created_at = '2026' },
    e => { e.created_at = '2026-02-30T12:00:00Z' }, e => { e.food.nutrientsPer100g.extra = 0 },
    e => { e.kcal++ }, e => { e.food = { ...e.food, preparation: null } }]) {
    const e = structuredClone(evidence); change(e)
    assert.equal(readIntakeEvidence(parent, e, scope), null)
  }
  assert.equal(readIntakeEvidence(parent, null, scope), null)
})

test('mixed legacy/evidence subtotal, per-nutrient unknown counts, no receipts/plans/foreign owner or day, no mutation', () => {
  const { parent, evidence } = pair()
  const legacy = { ...parent, id: '00000000-0000-4000-8000-000000000003', meal: 'Legacy manual' }
  const mealLogs = freeze([parent, legacy, { ...parent, athlete_id: requestId }, { ...parent, date: '2026-11-08' },
    { ...parent, meal: '[appData2-day-v1]receipt' }])
  const evidenceRows = freeze([evidence, { ...evidence, athlete_id: requestId }, { ...evidence, date: '2026-11-08' }])
  const before = JSON.stringify([mealLogs, evidenceRows])
  const sum = summarizeIntakeEvidence({ ...scope, mealLogs, evidenceRows, knownRows: 999, complete: true })
  assert.equal(sum.recordedRows, 2)
  assert.deepEqual(sum.nutrients.ironMg, { unit: 'mg', state: 'incomplete', complete: false,
    knownRows: 1, unknownRows: 1, knownSubtotal: 2.505, total: null })
  assert.equal(sum.nutrients.magnesiumMg.unknownRows, 2)
  assert.equal(sum.nutrients.magnesiumMg.knownSubtotal, null)
  const complete = summarizeIntakeEvidence({ ...scope, mealLogs: [parent], evidenceRows: [evidence] })
  assert.equal(complete.nutrients.calciumMg.total, 0)
  assert.equal(complete.nutrients.calciumMg.complete, true)
  assert.equal(complete.nutrients.magnesiumMg.complete, false)
  const empty = summarizeIntakeEvidence({ ...scope, mealLogs: [], evidenceRows: [evidence] })
  assert.equal(empty.nutrients.ironMg.state, 'no-recorded-food')
  assert.equal(empty.nutrients.ironMg.complete, false)
  assert.equal(empty.nutrients.ironMg.total, null)
  assert.equal(empty.nutrients.ironMg.knownSubtotal, null)
  for (const [logs, refs] of [[[parent, parent], [evidence]], [[parent], [evidence, evidence]]])
    assert.equal(summarizeIntakeEvidence({ ...scope, mealLogs: logs, evidenceRows: refs }).nutrients.ironMg.knownRows, 0)
  assert.equal(JSON.stringify([mealLogs, evidenceRows]), before)
})

test('raw/cooked references retain their own ID, preparation, source and per100g; no current catalogue lookup', () => {
  const cooked = createFood({ ...food, id: 'synthetic:cooked:v2', preparation: 'cooked',
    source: { citation: 'Different synthetic source v2', verification: 'unverified' },
    nutrientsPer100g: { ...food.nutrientsPer100g, ironMg: 1 } })
  const raw = pair(), cook = pair({ food: cooked })
  assert.equal(readIntakeEvidence(raw.parent, raw.evidence, scope).nutrients.ironMg, 2.505)
  const r = readIntakeEvidence(cook.parent, cook.evidence, scope)
  assert.equal(r.nutrients.ironMg, 1.2525)
  assert.equal(r.food.preparation, 'cooked')
  assert.equal(r.food.id, cooked.id)
  assert.deepEqual(r.food.source, cooked.source)
})
