import test from 'node:test'
import assert from 'node:assert/strict'
import { FOODS } from '../foedevarer/index.mjs'
import { createCoachPlan } from './controller.mjs'
import { catalogFoods, totals } from './model.mjs'
import { dayMicronutrients, micronutrientsView } from './micronutrients.mjs'
import { coachPlanView } from './view.mjs'
import { element, nodes, text, syntheticInput } from './syntheticFixture.mjs'
import { microFood, microPlan, syntheticMicros } from './micronutrients.fixture.mjs'

const folds = tree => nodes(tree, n => n.type === 'details'
  && n.props.children.some(child => child?.type === 'summary' && text(child) === 'Mineraler og vitaminer'))
const render = controller => coachPlanView(element, controller.snapshot(), controller)
const values = meals => Object.fromEntries(dayMicronutrients(meals).map(row => [row.nutrient, row.value]))

test('daily micros sum all meals using retained canonical data, units and known zero', () => {
  const f = microPlan(), before = structuredClone(f.controller.snapshot())
  const rows = dayMicronutrients(before.meals)
  assert.equal(rows.length, 9)
  assert.deepEqual(Object.fromEntries(rows.map(row => [row.nutrient, row.value])),
    Object.fromEntries(Object.entries(syntheticMicros).map(([key, value]) => [key, value * 2])))
  assert.deepEqual(rows.map(row => row.unit), ['mg', 'mg', 'mg', 'mg', 'mg', 'mg', 'µg', 'µg', 'µg'])
  const section = folds(render(f.controller))[0]
  assert.equal(section.props.open, undefined)
  assert.equal(nodes(section, n => n.type === 'summary')[0].props.style.minHeight, 44)
  assert.equal(nodes(section, n => n.type === 'dt').length, 9)
  assert.match(text(section), /D-vitamin 0 µg/)
  assert.doesNotMatch(text(section), /ikke nok data|anbefal|grænse|mangel|%/i)
  assert.deepEqual(f.controller.snapshot(), before)
  assert.equal(f.calls.length, 0)
})

test('each missing value in any meal blocks only that daily nutrient, never shows a subtotal', () => {
  for (const key of Object.keys(syntheticMicros)) for (const missing of [null, undefined]) {
    const f = microPlan({ [key]: missing }), meals = f.controller.snapshot().meals
    const result = values(meals)
    assert.equal(result[key], null)
    for (const [other, per100g] of Object.entries(syntheticMicros))
      if (other !== key) assert.equal(result[other], per100g * 2)
    const section = folds(render(f.controller))[0]
    assert.equal(nodes(section, n => n.type === 'dt').length, 8)
    assert.equal(nodes(section, n => n.type === 'dd' && n.props.key === key).length, 0)
    assert.doesNotMatch(text(section), /ikke nok data/)
  }
})

test('built-in/legacy foods and empty or invalid days cannot invent micronutrient values', async () => {
  const f = syntheticInput(), c = createCoachPlan(f.options)
  assert.equal(folds(render(c)).length, 0)
  c.generate()
  for (const meals of [[], c.snapshot().meals]) {
    assert.ok(dayMicronutrients(meals).every(row => row.value === null))
    assert.equal(micronutrientsView(() => { throw Error('No empty section') }, meals), null)
  }
  assert.equal(folds(render(c)).length, 0)
  const builtIn = { ...f.options }
  builtIn.catalog = FOODS; builtIn.template = [{ id: 'meal', name: 'Syntetisk', items: [{ foodId: FOODS[0].id, grams: 100 }] }]
  const productionCatalog = createCoachPlan(builtIn); productionCatalog.generate()
  assert.ok(dayMicronutrients(productionCatalog.snapshot().meals).every(row => row.value === null))
  assert.equal(folds(render(productionCatalog)).length, 0)
  for (const controller of [c, productionCatalog]) {
    await controller.save()
    assert.equal(controller.snapshot().history.plans.length, 1)
    assert.equal(folds(render(controller)).length, 0)
  }
  for (const food of FOODS) {
    const meals = [{ id: 'meal', name: 'Syntetisk måltid', items: [{ food: catalogFoods([food])[0], grams: 100 }] }]
    assert.notEqual(totals(meals), null)
    assert.equal(micronutrientsView(element, meals), null)
  }
  for (const input of ['', 'bad', '-1', '0', '10001', '1e2', Infinity, NaN]) {
    const f = microPlan(); f.controller.editGrams(1, 0, input)
    assert.ok(dayMicronutrients(f.controller.snapshot().meals).every(row => row.value === null))
    assert.equal(folds(render(f.controller)).length, 0)
  }
})

test('a sole complete zero is visible; a known subtotal and an all-missing day stay hidden', () => {
  const unknown = Object.fromEntries(Object.keys(syntheticMicros).map(key => [key, null]))
  const meals = [{ id: 'meal', name: 'Syntetisk måltid', items: [{ food: catalogFoods([microFood('zero', { ...unknown, vitaminDUg: 0 })])[0], grams: 100 }] }]
  assert.notEqual(totals(meals), null)
  const section = micronutrientsView(element, meals)
  assert.equal(nodes(section, n => n.type === 'dt').length, 1)
  assert.match(text(section), /D-vitamin 0 µg/)
  meals[0].items.push({ food: catalogFoods([microFood('unknown', unknown)])[0], grams: 100 })
  assert.equal(micronutrientsView(element, meals), null)
})

test('actual gram and food controls refresh completeness; decimal commas and small nonzero values survive', () => {
  const f = microPlan({ ironMg: null }), c = f.controller
  const input = nodes(render(c), n => n.props.name === 'grams-0-0')[0]
  input.props.onChange({ currentTarget: { value: '125,5' } })
  assert.equal(values(c.snapshot().meals).calciumMg, 175.5)
  nodes(render(c), n => n.props.name === 'food-1-0')[0].props.onChange({ currentTarget: { value: 'a' } })
  assert.equal(values(c.snapshot().meals).ironMg, 3.51)
  const tiny = structuredClone(c.snapshot().meals)
  tiny[0].items[0].food = { id: 'tiny', name: 'Syntetisk tiny', per100g: { kcal: 100, protein: 10, carb: 10, fat: 2 },
    nutrition: microFood('tiny', { vitaminDUg: 0.001 }) }
  tiny[0].items[0].grams = '0,1'; tiny.splice(1)
  assert.match(text(micronutrientsView(element, tiny)), /0,000001 µg/)
  assert.equal(f.calls.length, 0)
})

test('history uses each saved day snapshot, never the edited draft or a different athlete', async () => {
  const f = microPlan(), c = f.controller
  await c.save(); await c.activate()
  c.editGrams(0, 0, '300')
  const sections = folds(render(c))
  assert.equal(sections.length, 2)
  assert.match(text(sections[0]), /Jern 7 mg/)
  assert.match(text(sections[1]), /Jern 4 mg/)
  assert.ok(sections.every(section => section.props.open === undefined))
  const foreign = createCoachPlan({ ...f.options, athlete: { id: 'synthetic-other' }, basis: undefined,
    history: c.snapshot().history })
  assert.equal(folds(render(foreign)).length, 0)
  const nextDate = createCoachPlan({ ...f.options, date: '2026-11-05', basis: undefined, history: c.snapshot().history })
  assert.equal(nextDate.snapshot().meals.length, 0)
  assert.equal(folds(render(nextDate)).length, 1) // explicitly dated historical plan only
  assert.match(text(folds(render(nextDate))[0]), /Jern 4 mg/)
  assert.equal(f.calls.length, 2)
})

test('local draft restore retains saved food values; rendering causes no namespace writes', async () => {
  const f = microPlan({ calciumMg: null }), c = f.controller
  await c.save()
  const saved = c.snapshot(), record = saved.history.plans[0]
  const restored = createCoachPlan({ ...f.options, localDraftOnly: true,
    restoreDraft: JSON.parse(JSON.stringify({ plan: record, form: saved.form, clientVersion: saved.version })) })
  assert.deepEqual(values(restored.snapshot().meals), values(saved.meals))
  assert.equal(folds(render(restored)).length, 1)
  assert.equal(nodes(folds(render(restored))[0], n => n.type === 'dt' && text(n) === 'Calcium').length, 0)
  assert.doesNotMatch(text(render(restored)), /ikke nok data/)
  assert.equal(f.calls.length, 1)
})

test('strict OFF never reads data or actions and emits no micronutrient section', () => {
  for (const enabled of [false, undefined, 'true', 1]) {
    const c = createCoachPlan({ enabled, get catalog() { throw Error('OFF catalog') } })
    assert.equal(coachPlanView(() => { throw Error('OFF render') }, c.snapshot(),
      new Proxy({}, { get() { throw Error('OFF action') } })), null)
  }
})
