// Separate same-engine Codex review cases. Independent synthetic examples and
// arithmetic, exact product/controller/UI/SQL imports; no producer test helpers.
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import * as vm from 'node:vm'
if (!vm.SourceTextModule) {
 test('same-engine Codex separate review gate', { timeout: 90000 }, () => {
  const run = spawnSync(process.execPath, ['--experimental-vm-modules', '--test', '--test-concurrency=1', fileURLToPath(import.meta.url)], { env: {}, encoding: 'utf8', timeout: 80000 })
  assert.equal(run.status, 0, run.stdout + run.stderr)
  assert.match(run.stdout, /tests 3/); assert.match(run.stdout, /pass 3/)
 })
} else {
 const { FOODS } = await import('../foedevarer/index.mjs')
 const { createFood } = await import('../foedevarer/catalog.mjs')
 const { parseMealDraft } = await import('./mealDraft.mjs')
 const { openPortalPlan, draftKey } = await import('./portalModel.mjs')
 const { memoryStorage } = await import('./portal.fixture.mjs')
 const { mountMealPortal } = await import('./mealDraftReact.fixture.mjs')
 const scope = { coachId: 'review-coach', athleteId: 'review-athlete', date: '2026-12-02' }
 const example = () => ({ schema: 'entropi2:meal-draft:v1', ...scope, meals: [{ id: 'early', name: '06:15 <synthetic> 🍚', items: [{ foodId: 'review-food', grams: 37.125 }] }] })
 test('review independent known zero/unknown snapshot arithmetic and escaped plain-data meal name', () => {
  const food = createFood({ id: 'review-food', name: 'Review cooked food', preparation: 'cooked', nutrientsPer100g: { energyKcal: 200, proteinG: 10, carbohydrateG: 0, fatG: 5, ironMg: null }, source: { citation: 'Synthetic review', verification: 'synthetic' } })
  const result = parseMealDraft(JSON.stringify(example()), scope, [food])
  assert.equal(result[0].name, example().meals[0].name); assert.equal(result[0].items[0].grams, 37.125)
  assert.equal(result[0].items[0].food.per100g.carb, 0)
  assert.equal(result[0].items[0].food.nutrition.nutrientsPer100g.ironMg, null)
  for (const raw of [JSON.stringify(example()).replace('37.125', '"37.125"'), JSON.stringify(example()).replace('"id":"early"', '"id":"early","id":"late"'), JSON.stringify(example()).replace('"grams":37.125', '"grams":37.125,"constructor":{}')]) assert.throws(() => parseMealDraft(raw, scope, [food]))
 })
 test('review independent maximum 100 lines saves through existing local model and preserves exact totals, then rejects 101', async () => {
  const storage = memoryStorage(), athlete = { id: scope.athleteId, age: 44, bodyweight: 73, goal: 'bulk' }
  const c = openPortalPlan({ enabled: true, ...scope, athlete, storage: () => storage }).controller
  const source = { schema: 'entropi2:meal-draft:v1', ...scope, meals: Array.from({ length: 10 }, (_, mi) => ({ id: `r-${mi}`, name: `Review ${mi}`, items: FOODS.slice(10, 20).map((f, ii) => ({ foodId: f.id, grams: 10 + mi + ii / 8 })) })) }
  const expected = { kcal: 0, protein: 0, carb: 0, fat: 0 }, keys = { kcal: 'energyKcal', protein: 'proteinG', carb: 'carbohydrateG', fat: 'fatG' }
  for (const meal of source.meals) for (const item of meal.items) {
   const nutrients = FOODS.find(f => f.id === item.foodId).nutrientsPer100g
   for (const [key, nutrient] of Object.entries(keys)) expected[key] += nutrients[nutrient] * item.grams / 100
  }
  const form = c.snapshot().form
  assert.equal(c.importMealDraft(JSON.stringify(source), c.snapshot().version), true)
  for (const key of Object.keys(keys)) assert.ok(Math.abs(c.snapshot().totals[key] - expected[key]) < 1e-8)
  assert.deepEqual(c.snapshot().form, form); assert.equal(storage.data.size, 0)
  assert.equal(await c.save(), true)
  const saved = JSON.parse(storage.data.get(draftKey(scope.coachId, scope.athleteId, scope.date)))
  assert.equal(saved.manualImport, true); assert.equal(saved.plan.meals.flatMap(m => m.items).length, 100)
  const bytes = [...storage.data], meals = c.snapshot().meals
  source.meals[0].items.push({ foodId: FOODS[20].id, grams: 10 })
  assert.equal(c.importMealDraft(JSON.stringify(source), c.snapshot().version), false)
  assert.deepEqual(c.snapshot().meals, meals); assert.deepEqual([...storage.data], bytes)
 })
 test('review actual mounted maximum 12 named meals, old text callback rejection, validation error corrected by identical reimport', async () => {
  const storage = memoryStorage(), props = { enabled: true, athlete: { id: scope.athleteId, age: 44, bodyweight: 73, goal: 'bulk' }, today: scope.date, session: { user: { id: scope.coachId } }, client: { from() { throw Error('Review synthetic unavailable') } } }
  await mountMealPortal(storage, props, async ui => {
   await ui.open()
   const source = { schema: 'entropi2:meal-draft:v1', ...scope, meals: Array.from({ length: 12 }, (_, i) => ({ id: `t-${i}`, name: `${i + 6}:00 Review <${i}>`, items: [{ foodId: FOODS[100].id, grams: 50.03125 + i }] })) }
   const form = () => ui.host.querySelectorAll('form').find(n => n.textContent.includes('Manuel måltidskladde'))
   await ui.input('meal-draft-json', JSON.stringify(source))
   const old = ui.handler(form(), 'onSubmit')
   await ui.input('meal-draft-json', '{')
   await old({ preventDefault() {} })
   assert.equal(ui.host.querySelectorAll('input').filter(n => n.name?.startsWith('grams-')).length, 0)
   await ui.submit('Manuel måltidskladde'); assert.match(ui.host.textContent, /Ugyldig måltidskladde/)
   await ui.input('meal-draft-json', JSON.stringify(source)); await ui.submit('Manuel måltidskladde')
   const grams = ui.host.querySelectorAll('input').filter(n => n.name?.startsWith('grams-'))
   assert.equal(grams.length, 12); assert.deepEqual(grams.map(n => Number(n.value)), source.meals.map(m => m.items[0].grams))
   assert.equal(ui.host.querySelectorAll('legend').filter(n => n.textContent.includes('Review <')).length, 12)
   await ui.input('meal-draft-json', '{'); await ui.submit('Manuel måltidskladde')
   assert.match(ui.host.textContent, /Ugyldig måltidskladde/)
   await ui.input('meal-draft-json', JSON.stringify(source)); await ui.submit('Manuel måltidskladde')
   assert.ok(!ui.host.textContent.includes('Ugyldig måltidskladde')); assert.equal(storage.data.size, 0)
  })
 })
}
