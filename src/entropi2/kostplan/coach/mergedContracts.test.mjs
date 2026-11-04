import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateNutrition } from '../beregning.mjs'
import { createFood, sumDay } from '../foedevarer/index.mjs'
import { createDraft, transitionPlan } from '../plan.mjs'
import { createAthleteDay } from '../atlet/dayModel.mjs'
import { catalogFoods, totals } from './model.mjs'
import { createCoachPlan } from './controller.mjs'
import { coachPlanView } from './view.mjs'
import { syntheticInput, element, nodes, text } from './syntheticFixture.mjs'

const calculation = { date: '2026-11-04', adult: true, weightKg: 80,
  training: { volume: 'high', intensity: 'high' }, readiness: { energy: 2, hunger: 4 } }

test('scoped structured basis uses actual merged calculation, floors and recovery without manual macro overrides', async () => {
  const f = syntheticInput(); f.options.basis.calculation = structuredClone(calculation)
  const m = createCoachPlan(f.options)
  m.set('goal', 'cut'); m.set('intensity', 15)
  assert.equal(m.generate(), true)
  const expected = calculateNutrition({ ...calculation, maintenanceKcal: 2400, goal: 'cut', intensity: 'aggressive' })
  assert.deepEqual(m.snapshot().planTargets, expected.targets)
  assert.deepEqual(m.snapshot().proposal, expected)
  assert.ok(m.snapshot().planTargets.kcal > 2040)
  assert.equal(m.set('protein', '1'), false); assert.equal(m.set('fat', '1'), false)
  const view = coachPlanView(element, m.snapshot(), m)
  assert.equal(nodes(view, n => ['protein', 'fat'].includes(n.props.name)).length, 0)
  for (const warning of expected.warnings) assert.ok(text(view).includes(warning))
  assert.equal(await m.save(), true); assert.equal(await m.activate(), true)
  assert.deepEqual(f.calls[0].request.plan.targets, expected.targets)
  assert.equal(f.calls.length, 2)
})

test('malformed, foreign-day and nonadult calculation fails closed instead of falling back to manual targets', () => {
  for (const value of [null, {}, { ...calculation, date: '2026-11-03' },
    { ...calculation, adult: false }, { ...calculation, weightKg: null }]) {
    const f = syntheticInput(); f.options.basis.calculation = value
    const m = createCoachPlan(f.options)
    assert.equal(m.snapshot().suggestion, null); assert.equal(m.generate(), false)
    assert.equal(m.snapshot().planTargets, null); assert.equal(f.calls.length, 0)
  }
  const f = syntheticInput(); f.options.basis.calculation = structuredClone(calculation)
  const m = createCoachPlan(f.options)
  f.options.basis.calculation.weightKg = 25
  assert.deepEqual(m.snapshot().suggestion, calculateNutrition({ ...calculation, weightKg: 80,
    maintenanceKcal: 2400, goal: 'maintain', intensity: 'moderate' }).targets)
})

test('actual merged food contract retains provenance and unknown micronutrients through save and history', async () => {
  const food = createFood({ id: 'synthetic-food', name: 'Syntetisk råvare', preparation: 'cooked',
    source: { citation: 'Synthetic fixture only', verification: 'synthetic' },
    nutrientsPer100g: { energyKcal: 150, proteinG: 12.5, carbohydrateG: 20, fatG: 2,
      ironMg: 1.25, calciumMg: null } })
  const f = syntheticInput({ catalog: [food], template: [
    { id: 'synthetic-meal', name: 'Syntetisk måltid', items: [{ foodId: food.id, grams: '125,5' }] },
  ] })
  const m = createCoachPlan(f.options); assert.equal(m.generate(), true)
  const meals = m.snapshot().meals
  const expected = sumDay(meals.map(meal => meal.items.map(item => ({ food, grams: item.grams }))))
  assert.equal(totals(meals).protein, expected.nutrients.proteinG.value)
  assert.equal(meals[0].items[0].food.nutrition.nutrientsPer100g.calciumMg, null)
  assert.deepEqual(meals[0].items[0].food.nutrition.source, food.source)
  assert.equal(await m.save(), true)
  const next = createCoachPlan({ ...f.options, history: m.snapshot().history })
  assert.deepEqual(next.snapshot().history.plans[0].meals[0].items[0].food.nutrition, food)
})

test('existing flat per-100g and delivery-one foods use merged sums; inconsistent canonical snapshots reject', () => {
  const food = { id: 'synthetic-flat', name: 'Syntetisk råvare', kcal100: '130', protein100: '2,7', carb100: 28, fat100: '0,3' }
  const normalized = catalogFoods([food])[0]
  const meals = [{ id: 'synthetic-meal', name: 'Syntetisk måltid', items: [{ food: normalized, grams: 200 }] }]
  assert.deepEqual(totals(meals), { kcal: 260, protein: 5.4, carb: 56, fat: 0.6 })
  const bad = structuredClone(meals); bad[0].items[0].food.nutrition.nutrientsPer100g.energyKcal = 1
  assert.equal(totals(bad), null)
  assert.equal(catalogFoods([{ ...food, kcal100: null }]), null)
  const duplicate = structuredClone(meals)
  duplicate[0].items.push(structuredClone(duplicate[0].items[0]))
  assert.equal(totals(duplicate), null) // athlete contract requires unique food ids
})

test('generated coach snapshots can enter the actual merged plan and athlete-day contracts without changing grams', async () => {
  const f = syntheticInput(), m = createCoachPlan(f.options)
  m.generate(); await m.save(); await m.activate()
  const record = m.snapshot().history.plans[0]
  // Synthetic adapter projection only: there is no persistence or auth here.
  const flatFood = item => ({ id: item.food.id, name: item.food.name, grams: item.grams,
    ...Object.fromEntries(Object.entries(item.food.per100g).map(([key, value]) => [key + '100', value])) })
  const meals = record.meals.map(meal => ({ ...meal,
    items: meal.items.map(item => ({ grams: item.grams, food: flatFood(item) })) }))
  const draft = createDraft({ id: record.id, athleteId: record.athleteId, coachId: 'synthetic-coach',
    createdOn: record.date, dailyTargets: record.targets, meals })
  const active = transitionPlan(draft, { to: 'active', actor: { role: 'coach', id: 'synthetic-coach' }, on: record.date })
  assert.equal(active.status, 'active')
  const plan = { id: record.id, revision: record.revision, active: true, athlete_id: record.athleteId,
    date: record.date, targets: record.targets,
    meals: record.meals.map(meal => ({ id: meal.id, name: meal.name, foods: meal.items.map(flatFood) })) }
  const athlete = createAthleteDay({ enabled: true, athleteId: record.athleteId, date: record.date,
    loadDay: async () => ({ plan, logs: [], eaten: [] }) })
  assert.equal(await athlete.load(), true)
  assert.equal(athlete.snapshot().mode, 'plan')
  assert.deepEqual(athlete.snapshot().meals.map(meal => meal.foods.map(food => food.grams)),
    record.meals.map(meal => meal.items.map(item => item.grams)))
  assert.deepEqual(athlete.snapshot().targets, record.targets)
  assert.equal(f.calls.length, 2)
})
