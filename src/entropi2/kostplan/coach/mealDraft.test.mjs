import test from 'node:test'
import assert from 'node:assert/strict'
import { parseMealDraft, MEAL_DRAFT_SCHEMA, MEAL_DRAFT_MAX_LENGTH } from './mealDraft.mjs'
import { openPortalPlan } from './portalModel.mjs'
import { createCoachPlan } from './controller.mjs'
import { totals } from './model.mjs'
import { FOODS } from '../foedevarer/index.mjs'
import { memoryStorage } from './portal.fixture.mjs'
const scope = { coachId: 'synthetic-coach', athleteId: 'synthetic-athlete', date: '2026-11-07' }
const athlete = { id: scope.athleteId, age: 33, bodyweight: 80, goal: 'maintain' }
const draft = () => ({ schema: MEAL_DRAFT_SCHEMA, ...scope, meals: Array.from({ length: 6 }, (_, i) => ({ id: `meal-${i}`, name: `${String(7 + i * 2).padStart(2, '0')}:00 Syntetisk ${i}`, items: [{ foodId: FOODS[i].id, grams: 101.125 + i }] })) })
const parse = raw => parseMealDraft(JSON.stringify(raw), scope, FOODS)
const opened = storage => openPortalPlan({ enabled: true, ...scope, athlete, storage: () => storage }).controller

test('strict manual parser retains six names, IDs, decimals and canonical snapshots without changing catalogue or source', () => {
 const source = draft(), before = structuredClone(source), catalog = structuredClone(FOODS)
 const meals = parse(source)
 assert.deepEqual(meals.map(m => ({ id: m.id, name: m.name, items: m.items.map(i => ({ foodId: i.food.id, grams: i.grams })) })), source.meals)
 assert.ok(totals(meals)); assert.deepEqual(source, before); assert.deepEqual(FOODS, catalog)
 assert.ok(meals.every(m => m.items[0].food.nutrition.source.citation))
})

test('strict grammar rejects foreign scope, pollution, unknown keys, duplicates, units, nonfinite and missing IDs', () => {
 const mutations = [
  x => { x.coachId = 'foreign' }, x => { x.athleteId = 'foreign' }, x => { x.date = '2026-11-08' },
  x => { delete x.date }, x => { x.schema = 'wrong' }, x => { x.advice = 'unpublished write chain' },
  x => { x.meals[0].extra = true }, x => { x.meals[0].items[0].unit = 'g' },
  x => { x.meals[1].id = x.meals[0].id }, x => { x.meals[0].items.push(x.meals[0].items[0]) },
  x => { x.meals[0].name = '' }, x => { x.meals[0].name = ' leading' }, x => { x.meals[0].name = 'line\nbreak' },
  x => { x.meals[0].items[0].foodId = 'missing-food' }, x => { delete x.meals[0].items[0].foodId },
  ...['120', '120g', '1,5', null, true, 0, -1, 10000.1, Infinity, NaN, {}, []].map(v => x => { x.meals[0].items[0].grams = v }),
  x => { x.meals = [] }, x => { x.meals = Array(13).fill(x.meals[0]) }, x => { x.meals[0].items = [] },
 ]
 for (const mutate of mutations) { const x = draft(); mutate(x); assert.throws(() => parse(x), TypeError) }
 for (const source of ['null', '[]', '{', JSON.stringify(draft()).replace('101.125', '1e999'),
  JSON.stringify(draft()).replace('"schema":', '"__proto__":{},"schema":'),
  JSON.stringify(draft()).replace('"grams":101.125', '"grams":50,"grams":101.125'),
  ' '.repeat(MEAL_DRAFT_MAX_LENGTH + 1), '['.repeat(10000) + ']'.repeat(10000)]) assert.throws(() => parseMealDraft(source, scope, FOODS))
 assert.equal({}.polluted, undefined)
})

test('bounds accept 1..12 meals and 100 lines, reject 101 lines or 31 per meal', () => {
 const x = draft(); x.meals = x.meals.slice(0, 1); assert.equal(parse(x).length, 1)
 x.meals = Array.from({ length: 12 }, (_, i) => ({ ...x.meals[0], id: `m${i}` })); assert.equal(parse(x).length, 12)
 x.meals = x.meals.slice(0, 10).map(m => ({ ...m, items: FOODS.slice(0, 10).map(f => ({ foodId: f.id, grams: 10 })) }))
 assert.equal(parse(x).flatMap(m => m.items).length, 100)
 x.meals[0].items.push({ foodId: FOODS[10].id, grams: 10 }); assert.throws(() => parse(x))
 x.meals = [{ ...x.meals[0], items: FOODS.slice(0, 31).map(f => ({ foodId: f.id, grams: 10 })) }]; assert.throws(() => parse(x))
})

test('manual import uses live version/reservation guards, no storage writes, exact save/restore and unchanged no-op', async () => {
 const storage = memoryStorage(), c = opened(storage), source = JSON.stringify(draft()), form = c.snapshot().form
 assert.equal(c.importMealDraft(source, 0), true)
 const s = c.snapshot(); assert.equal(s.manualImport, true); assert.equal(s.version, 1)
 assert.deepEqual(s.form, form); assert.equal(storage.data.size, 0)
 assert.deepEqual(s.totals, totals(parse(draft())))
 assert.equal(c.importMealDraft(source, 0), false)
 assert.equal(c.importMealDraft(source, 1), true); assert.equal(c.snapshot().version, 1)
 assert.equal(await c.save(), true)
 const saved = c.snapshot(), bytes = [...storage.data]
 assert.equal(c.importMealDraft(source, 1), true); assert.equal(c.snapshot(), saved); assert.deepEqual([...storage.data], bytes)
 const restored = opened(storage)
 assert.equal(restored.snapshot().manualImport, true); assert.deepEqual(restored.snapshot().meals, s.meals)
 assert.equal(restored.importMealDraft(source, restored.snapshot().version), true)
 assert.equal(restored.snapshot().version, s.version)
 assert.equal(restored.editBounds(0, 0, 'minGrams', 50), false)
 assert.equal(restored.chooseRecipe(0, 'irrelevant'), false)
 // Explicit normal generation remains separate and available.
 assert.equal(restored.generate(['Morgenmad', 'Frokost', 'Aftensmad'].map((name, i) => ({ id: `auto-${i}`, name, items: [] }))), true); assert.equal(restored.snapshot().manualImport, false)
 assert.deepEqual(c.snapshot().meals, s.meals)
})

test('OFF, missing targets, invalid import and in-flight save cannot replace a draft', async () => {
 assert.equal(createCoachPlan({ enabled: false }).importMealDraft('x', 0), false)
 const storage = memoryStorage(), c = openPortalPlan({ enabled: true, ...scope, athlete: { id: scope.athleteId }, storage: () => storage }).controller
 assert.equal(c.importMealDraft(JSON.stringify(draft()), 0), false); assert.equal(c.snapshot().meals.length, 0)
 let release
 const saving = new Promise(r => { release = r })
 const d = createCoachPlan({ enabled: true, localDraftOnly: true, ...scope, athlete, basis: { athleteId: athlete.id, date: scope.date, maintenanceKcal: 2400, protein: 150, fat: 70 }, catalog: FOODS, saveDraft: () => saving })
 assert.equal(d.importMealDraft(JSON.stringify(draft()), 0), true)
 const request = d.save(), before = d.snapshot()
 assert.equal(d.importMealDraft(JSON.stringify(draft()), before.version), false); assert.equal(d.snapshot(), before)
 release({}); assert.equal(await request, false)
 const meals = d.snapshot().meals
 assert.equal(d.importMealDraft('{', d.snapshot().version), false); assert.deepEqual(d.snapshot().meals, meals)
})
