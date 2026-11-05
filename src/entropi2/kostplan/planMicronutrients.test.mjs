import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateMeals } from './foedevarer.mjs'
import { createFood, FOODS, MICRONUTRIENTS, sumMeal, sumDay } from './foedevarer/index.mjs'
import { createDraft, transitionPlan } from './plan.mjs'
import { createPlanSnapshot, summarizePlanSnapshot } from './planSnapshot.mjs'

// Synthetic arithmetic fixtures only; none of these are food composition data.
const definitions = [
  ['iron', 'ironMg', 'mg', 2], ['calcium', 'calciumMg', 'mg', 100],
  ['magnesium', 'magnesiumMg', 'mg', 30], ['zinc', 'zincMg', 'mg', 1],
  ['potassium', 'potassiumMg', 'mg', 200], ['sodium', 'sodiumMg', 'mg', 50],
  ['vitaminD', 'vitaminDUg', 'ug', 0], ['vitaminB12', 'vitaminB12Ug', 'ug', 0.5],
  ['folate', 'folateUg', 'ug', 20],
]
const source = 'Synthetic composition fixture; no dietary reference'
const food = () => ({ name: 'Synthetic food', kcal100: 100, protein100: 10, carb100: 10, fat100: 2,
  micronutrients100: Object.fromEntries(definitions.map(([name, , unit, value]) => [name, { value, unit, source }])) })
const meal = (id, ...foods) => ({ id, name: 'Synthetic meal', items: foods.map(([food, grams]) => ({ food, grams })) })
const canonical = flat => createFood({ id: 'synthetic', name: flat.name,
  nutrientsPer100g: Object.fromEntries(definitions.map(([name, key]) => [key, flat.micronutrients100[name].value])),
  source: { citation: source, verification: 'synthetic' } })

test('all nine minerals/vitamins use explicit units and agree across actual meal/day calculators', () => {
  const flat = food(), saved = canonical(flat)
  const result = calculateMeals([meal('a', [flat, 150]), meal('b', [flat, 25], [flat, 25])])
  const day = sumDay([[{ food: saved, grams: 150 }], [{ food: saved, grams: 25 }, { food: saved, grams: 25 }]])
  for (const [name, key, unit, per100g] of definitions) {
    assert.equal(MICRONUTRIENTS[name].nutrient, key)
    assert.equal(MICRONUTRIENTS[name].unit, unit)
    assert.equal(result.meals[0].micronutrients[name].value, per100g * 1.5)
    assert.equal(result.micronutrients[name].value, per100g * 2)
    assert.equal(result.micronutrients[name].value, day.nutrients[key].value)
    assert.equal(result.micronutrients[name].status, 'complete')
    assert.deepEqual(result.micronutrients[name].sources, [source])
  }
  assert.equal(result.micronutrients.vitaminD.value, 0)
})

test('each missing value blocks only that nutrient for its meal and the entire day', () => {
  for (const [name, key] of definitions) {
    for (const missing of ['absent', null, undefined]) {
      const a = food(), b = food()
      if (missing === 'absent') delete b.micronutrients100[name]
      else b.micronutrients100[name].value = missing
      const result = calculateMeals([meal('a', [a, 100]), meal('b', [b, 50])])
      assert.equal(result.meals[0].micronutrients[name].status, 'complete')
      assert.equal(result.meals[1].micronutrients[name].value, null)
      assert.equal(result.micronutrients[name].value, null)
      assert.equal(result.micronutrients[name].status, 'insufficient-data')
      assert.equal(result.micronutrients[name].knownItems, 1)
      assert.equal(result.micronutrients[name].totalItems, 2)
      const known = canonical(a), unknown = createFood({ ...known,
        nutrientsPer100g: { ...known.nutrientsPer100g, [key]: null } })
      assert.equal(sumMeal([{ food: known, grams: 100 }, { food: unknown, grams: 50 }]).nutrients[key].value, null)
      assert.equal(sumDay([[{ food: known, grams: 100 }], [{ food: unknown, grams: 50 }]]).nutrients[key].value, null)
      assert.equal(Object.values(result.micronutrients).filter(n => n.status === 'complete').length, 8)
    }
  }
})

test('unsourced legacy values stay readable as unknown, including zero, and never contaminate a day', () => {
  for (const value of [0, 12]) for (const citation of [undefined, null, '', '   ']) {
    const a = food(), b = food()
    b.micronutrients100.iron = { value, unit: 'mg', source: citation }
    const before = structuredClone(b)
    const result = calculateMeals([meal('a', [a, 100]), meal('b', [b, 100])])
    assert.equal(result.micronutrients.iron.value, null)
    assert.equal(result.micronutrients.iron.status, 'insufficient-data')
    assert.deepEqual(result.meals[1].items[0].food.micronutrients100.iron, { value: null, unit: 'mg', source: null })
    assert.deepEqual(b, before)
  }
})

test('sources survive draft activation, archive and JSON snapshots without caller mutation', () => {
  const raw = food()
  raw.micronutrients100.iron.source = '  Synthetic alternate source  '
  const input = { id: 'synthetic-plan', athleteId: 'synthetic-athlete', coachId: 'synthetic-coach',
    createdOn: '2026-11-05', dailyTargets: { kcal: 2000, protein: 100, carb: 250, fat: 60 },
    meals: [meal('a', [raw, 150])] }
  const before = structuredClone(input), draft = createDraft(input)
  const actor = { id: 'synthetic-coach', role: 'coach' }
  const active = transitionPlan(JSON.parse(JSON.stringify(draft)), { to: 'active', actor, on: '2026-11-05' })
  const archived = transitionPlan(active, { to: 'archived', actor, on: '2026-11-06' })
  for (const plan of [draft, active, archived]) {
    assert.equal(plan.micronutrients.iron.value, 3)
    assert.deepEqual(plan.micronutrients.iron.sources, ['Synthetic alternate source'])
    assert.equal(plan.meals[0].items[0].food.micronutrients100.iron.source, 'Synthetic alternate source')
  }
  archived.meals[0].items[0].food.micronutrients100.iron.source = 'changed'
  assert.equal(active.meals[0].items[0].food.micronutrients100.iron.source, 'Synthetic alternate source')
  assert.deepEqual(input, before)
  const snapshot = createPlanSnapshot({ goal: 'vedligehold', intensity: 0.5,
    meals: [{ name: 'Synthetic meal', portions: [{ food: canonical(food()), grams: 150 }] }] })
  const roundTrip = JSON.parse(JSON.stringify(snapshot))
  assert.equal(roundTrip.meals[0].portions[0].food.source.citation, source)
  assert.equal(summarizePlanSnapshot(roundTrip).nutrients.ironMg.value, 3)
})

test('units, sources and malformed values fail explicitly; decimal comma values retain precision', () => {
  for (const [name, , unit] of definitions) {
    const bad = food()
    bad.micronutrients100[name].unit = unit === 'mg' ? 'ug' : 'mg'
    assert.throws(() => calculateMeals([meal('a', [bad, 100])]), /enheder/)
  }
  for (const citation of [42, {}, [], 'x'.repeat(201)]) {
    const bad = food(); bad.micronutrients100.iron.source = citation
    assert.throws(() => calculateMeals([meal('a', [bad, 100])]), /kilde/)
  }
  for (const value of [-1, NaN, Infinity, '', 'bad', true, 1000001]) {
    const bad = food(); bad.micronutrients100.iron.value = value
    assert.throws(() => calculateMeals([meal('a', [bad, 100])]), TypeError)
  }
  const decimal = food(); decimal.micronutrients100.iron.value = '0,25'
  const result = calculateMeals([meal('a', [decimal, 0.2]), meal('b', [decimal, 0.2])])
  assert.equal(result.micronutrients.iron.value, 0.001)
})

test('built-in foods and empty days supply no invented mineral or vitamin values', () => {
  assert.equal(FOODS.length > 20, true)
  for (const entry of FOODS) for (const [, key] of definitions) {
    assert.equal(entry.nutrientsPer100g[key], null)
  }
  for (const result of [calculateMeals([]), calculateMeals([meal('a', [{ name: 'Synthetic unsourced food',
    kcal100: 100, protein100: 10, carb100: 10, fat100: 2 }, 100])])]) {
    for (const [name, , unit] of definitions) {
      assert.equal(result.micronutrients[name].unit, unit)
      assert.equal(result.micronutrients[name].value, null)
      assert.equal(result.micronutrients[name].status, 'insufficient-data')
      assert.deepEqual(result.micronutrients[name].sources, [])
    }
  }
})
