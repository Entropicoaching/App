import test from 'node:test'
import assert from 'node:assert/strict'
import { recipeChoices, recipeItems, proteinDistribution, portalNutritionReport } from './connections.mjs'
import { createCoachPlan } from './controller.mjs'
import { catalogFoods, totals } from './model.mjs'
import { coachPlanView } from './view.mjs'
import { FOODS } from '../foedevarer/index.mjs'
import { RECIPES, sumRecipe } from '../opskrifter/index.mjs'
import { planProteinDistribution } from '../protein/model.mjs'
import { buildNutritionReport } from '../rapport/nutritionReport.mjs'
import { input, coach, athleteId, meal, activePlan } from '../rapport/reportFixture.mjs'
import { syntheticInput, element, nodes, text } from './syntheticFixture.mjs'

const foods = catalogFoods(FOODS)
function editor(overrides = {}) {
  const f = syntheticInput({ catalog: FOODS, template: RECIPES.slice(0, 3).map((recipe, i) => ({
    id: `synthetic-${i}`, name: `Syntetisk ${i}`, items: recipeItems(recipe.id, foods),
  })), ...overrides })
  f.options.athlete.bodyweight = 80
  const controller = createCoachPlan(f.options)
  assert.equal(controller.generate(), true)
  return { ...f, controller }
}
const receipt = overrides => ({ ...input(), coachId: coach.id, state: 'ready', complete: true, ...overrides })
const report = read => portalNutritionReport({ enabled: true, coachId: coach.id, athleteId, date: '2026-11-08', receipt: read })

test('recipes use the real catalogue and scale the requested meal; unavailable or altered foods cannot masquerade as a recipe', () => {
  assert.equal(recipeChoices(foods).length, RECIPES.length)
  assert.deepEqual(recipeItems(RECIPES[0].id, foods), RECIPES[0].ingredients)
  const kcal = 432.5, items = recipeItems(RECIPES[0].id, foods, kcal)
  const scaled = { ...RECIPES[0], ingredients: items }
  assert.ok(Math.abs(sumRecipe(scaled).nutrients.energyKcal.value - kcal) < 1e-8)
  assert.equal(recipeItems('foreign-recipe', foods), null)
  assert.equal(recipeItems(RECIPES[0].id, [], kcal), null)
  assert.equal(recipeItems(RECIPES[0].id, foods, 1e8), null)
  const altered = structuredClone(foods)
  altered.find(food => food.id === RECIPES[0].ingredients[0].foodId).per100g.protein = 999
  assert.equal(recipeItems(RECIPES[0].id, altered), null)
})

test('actual controller replaces one meal without persistence, preserves kcal and targets, and requires saving the edited version', async () => {
  const { controller: c, calls } = editor()
  await c.save()
  const before = c.snapshot(), kcal = totals([before.meals[1]]).kcal
  assert.equal(c.chooseRecipe(1, 'tofu-ris'), true)
  const after = c.snapshot()
  assert.deepEqual(after.meals[0], before.meals[0]); assert.deepEqual(after.meals[2], before.meals[2])
  assert.deepEqual(after.planTargets, before.planTargets)
  assert.ok(Math.abs(totals([after.meals[1]]).kcal - kcal) < 1e-8)
  assert.deepEqual(after.meals[1].items.map(item => item.food.id), RECIPES.find(recipe => recipe.id === 'tofu-ris').ingredients.map(item => item.foodId))
  assert.equal(after.version, before.version + 1); assert.equal(after.dirty, true)
  assert.equal(calls.length, 1); assert.equal(await c.activate(), false)
  await c.save(); assert.equal(await c.activate(), true)
  assert.equal(c.chooseRecipe(0, 'skyr-aeble'), true)
  await c.save()
  assert.equal(calls.at(-1).request.planId, null) // edits of active plans start a new draft
})

test('busy and OFF reject recipe actions; invalid grams or recipes produce an honest error without altering meals', async () => {
  assert.equal(createCoachPlan({ enabled: false, get athlete() { throw Error('OFF data') } }).chooseRecipe(0, 'x'), false)
  let resolve
  const { controller: c, ack } = editor({ saveDraft: request => new Promise(done => { resolve = () => done(ack(request, 'draft')) }) })
  const saving = c.save(), before = c.snapshot()
  assert.equal(c.chooseRecipe(0, 'tofu-ris'), false); assert.equal(c.snapshot(), before)
  resolve(); await saving
  assert.equal(c.chooseRecipe(-1, 'tofu-ris'), false)
  const meals = c.snapshot().meals
  assert.equal(c.chooseRecipe(0, 'foreign'), false); assert.deepEqual(c.snapshot().meals, meals)
  assert.match(c.snapshot().error, /kunne ikke erstattes/)
  c.editGrams(0, 0, '')
  assert.equal(c.chooseRecipe(0, 'tofu-ris'), false)
  assert.equal(c.snapshot().meals[0].items[0].grams, '')
})

test('protein marks use the copied protein model and recalculate edits; missing data stays unknown or hidden', () => {
  const { controller: c } = editor()
  const s = c.snapshot(), actual = s.proteinDistribution
  const expected = planProteinDistribution({ weightKg: 80, dailyProteinG: s.planTargets.protein, allowedFoodIds: [],
    meals: s.meals.map(m => ({ id: m.id, name: m.name, timing: 'daytime', proteinG: totals([m]).protein })) })
  assert.deepEqual(actual, expected)
  const amounts = s.meals[0].items.map(() => '1')
  amounts.forEach((grams, i) => c.editGrams(0, i, grams))
  assert.equal(c.snapshot().proteinDistribution.meals[0].belowThreshold, true)
  let tree = coachPlanView(element, c.snapshot(), c)
  assert.equal(nodes(tree, n => n.type === 'small').length, 3)
  assert.match(text(tree), /Proteinfordeling: under pejlemærke/)
  c.editGrams(0, 0, '')
  assert.equal(c.snapshot().proteinDistribution.meals[0].proteinG, null)
  tree = coachPlanView(element, c.snapshot(), c)
  assert.match(text(tree), /Proteinfordeling: ukendt/)
  assert.equal(proteinDistribution(s.meals, s.planTargets, null), null)
  assert.equal(proteinDistribution(s.meals, s.planTargets, 351), null)
  assert.equal(proteinDistribution(s.meals.slice(0, 2), s.planTargets, 80), null)
  c.set('protein', 160); assert.equal(c.snapshot().proteinDistribution, null)
})

test('scoped complete reports use actual day/week model and real historical targets; drafts never become report plans', () => {
  const read = receipt(), connected = report(read)
  assert.deepEqual(connected, { state: 'ready', report: buildNutritionReport(input()) })
  assert.equal(connected.report.week.loggedDays, 2)
  const unavailable = report(receipt({ planHistory: 'unavailable', plans: undefined }))
  assert.equal(unavailable.report.week.metrics.kcal.target, null)
  const missing = report(receipt({ plans: undefined }))
  assert.deepEqual(missing, { state: 'error' })
  const overlapping = report(receipt({ plans: [activePlan(), activePlan({ id: 'synthetic-overlap' })] }))
  assert.equal(overlapping.report.week.conflictDays, 7)
  assert.equal(overlapping.report.week.metrics.kcal.percent, null)
  const unknown = report(receipt({ mealLogs: [meal('2026-11-04', 'unknown', { carb: undefined, fat: undefined })] }))
  assert.equal(unknown.report.week.metrics.carb.actual, null)
  assert.equal(unknown.report.week.metrics.kcal.actual, 1000)
})

test('reports hide OFF, incomplete, stale, foreign, receipt-only and out-of-week data; malformed complete reads fail visibly', () => {
  assert.equal(portalNutritionReport({ enabled: false, get receipt() { throw Error('OFF read') } }), null)
  for (const read of [undefined, receipt({ state: 'error' }), receipt({ state: 'loading' }), receipt({ complete: false }),
    receipt({ coachId: 'foreign' }), receipt({ athleteId: 'foreign' }), receipt({ date: '2026-11-07' }),
    receipt({ mealLogs: [] }), receipt({ mealLogs: [meal('2026-11-01', 'old')] }),
    receipt({ mealLogs: [meal('2026-11-09', 'future')] }),
    receipt({ mealLogs: [meal('2026-11-04', 'receipt', { meal: '  [appData2-day-v1] completed' })] }),
    receipt({ mealLogs: [meal('2026-11-04', 'foreign', { athlete_id: 'foreign' })] })]) assert.equal(report(read), null)
  assert.deepEqual(report(receipt({ weightLogs: undefined })), { state: 'error' })
  const duplicate = meal('2026-11-04', 'same')
  assert.deepEqual(report(receipt({ mealLogs: [duplicate, duplicate] })), { state: 'error' })
})
