import test from 'node:test'
import assert from 'node:assert/strict'
import { NAMESPACE, number, day, catalogFoods, targets, totals, generateMeals, historyReceipt, normalizePlan, freeze } from './model.mjs'
import { syntheticInput } from './syntheticFixture.mjs'

const form = { goal: 'maintain', intensity: 10, maintenanceKcal: 2400, protein: 150, fat: 70 }
const record = () => {
  const { options: o } = syntheticInput()
  return { namespace: NAMESPACE, athleteId: o.athlete.id, id: 'synthetic-old', revision: 'r1', date: o.date,
    status: 'active', goal: 'maintain', intensity: 10, targets: targets(form), meals: generateMeals(o.template, o.catalog, 2400) }
}

test('bulk, maintenance and cut use explicit intensity and preserve coach macro targets', () => {
  for (const intensity of [5, 10, 15]) {
    for (const [goal, sign] of [['bulk', 1], ['maintain', 0], ['cut', -1]]) {
      const result = targets({ ...form, intensity, goal })
      assert.equal(result.kcal, 2400 * (1 + sign * intensity / 100))
      assert.equal(result.protein, 150); assert.equal(result.fat, 70)
      assert.equal(result.carb * 4 + 150 * 4 + 70 * 9, result.kcal)
    }
  }
  assert.equal(targets({ ...form, goal: 'prototype' }), null)
  assert.equal(targets({ ...form, intensity: 20 }), null)
  assert.equal(targets({ ...form, maintenanceKcal: 100 }), null)
  assert.equal(targets({ ...form, protein: 0 }), null)
})

test('strict numeric and calendar inputs retain commas and reject false zero and malformed dates', () => {
  assert.equal(number('12,5'), 12.5); assert.equal(number(0), 0)
  for (const v of ['', ' ', null, undefined, true, false, {}, [], NaN, Infinity, -1, '1e2', '5 g', '0x10', 100001])
    assert.equal(number(v), null, String(v))
  for (const d of ['2026-02-30', '2026-11-04T00:00:00Z', '', null]) assert.equal(day(d), false)
  assert.equal(day('2028-02-29'), true)
})

test('200 g rice, 100 g chicken and 50 g vegetables sum independently, including zero carbs', () => {
  const { options: o } = syntheticInput()
  const meals = generateMeals([o.template[1]], o.catalog, 440)
  assert.deepEqual(meals[0].items.map(item => item.grams), [200, 100, 50])
  const sum = totals(meals)
  assert.equal(sum.kcal, 440); assert.equal(sum.protein, 37.4)
  assert.equal(sum.carb, 58); assert.ok(Math.abs(sum.fat - 4.4) < 1e-10)
})

test('template scaling uses copied gram foods, bounded inputs and no mutation', () => {
  const { options: o } = syntheticInput(); freeze(o.catalog); freeze(o.template)
  const meals = generateMeals(o.template, o.catalog, 2400)
  assert.equal(meals.length, 3)
  assert.ok(Math.abs(totals(meals).kcal - 2400) < 10)
  meals[0].items[0].food.name = 'Edited copy'
  assert.notEqual(o.catalog[3].name, 'Edited copy')
  for (const change of [null, [], [{ ...o.catalog[0], per100g: { kcal: 1 } }], [o.catalog[0], o.catalog[0]]])
    assert.equal(catalogFoods(change), null)
  for (const t of [[], [{ ...o.template[0], items: [{ foodId: 'unknown', grams: 50 }] }], [o.template[0], o.template[0]]])
    assert.equal(generateMeals(t, o.catalog, 2400), null)
  for (const grams of ['', 'bad', 0, -5, 10001, Infinity]) {
    const invalid = structuredClone(meals); invalid[0].items[0].grams = grams
    assert.equal(totals(invalid), null)
  }
})

test('history validates athlete, calendar, unique plans, active dates and linked responses as one receipt', () => {
  const plan = record(), athleteId = plan.athleteId
  const valid = { state: 'ready', athleteId, plans: [plan], responses: [{ athleteId, planId: plan.id, date: plan.date, text: 'Syntetisk respons' }] }
  assert.equal(historyReceipt(valid, athleteId).state, 'ready')
  assert.equal(historyReceipt(undefined, athleteId).state, 'loading')
  const mutations = [
    r => { r.athleteId = 'foreign' }, r => { r.plans[0].athleteId = 'foreign' },
    r => { r.responses[0].athleteId = 'foreign' }, r => { r.responses[0].planId = 'foreign' },
    r => { r.responses[0].text = '' }, r => { r.plans[0].date = '2026-02-30' },
    r => { r.plans.push(structuredClone(plan)) }, r => { r.plans.push({ ...structuredClone(plan), id: 'another' }) },
    r => { r.plans[0].meals[0].items[0].food.per100g.kcal = null },
  ]
  for (const mutate of mutations) {
    const r = structuredClone(valid); mutate(r)
    assert.deepEqual(historyReceipt(r, athleteId), { athleteId, state: 'error', plans: [], responses: [] })
  }
  const clean = normalizePlan({ ...plan, privateExtra: 'not retained' }, athleteId)
  assert.equal(clean.privateExtra, undefined)
  assert.equal(normalizePlan({ ...plan, namespace: 'wrong' }, athleteId), null)
})
