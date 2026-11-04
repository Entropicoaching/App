import test from 'node:test'
import assert from 'node:assert/strict'
import { createAthleteDay, mealValues, namespace } from './dayModel.mjs'
import { athleteId, date, source, setup, persisted, consumed, deferred } from './day.fixture.mjs'

test('strict OFF is inert; scoped identity and real calendar dates required', () => {
  const poison = new Proxy({}, { get() { throw Error('OFF read') } })
  assert.equal(createAthleteDay(), null)
  for (const enabled of [false, undefined, 'true', 1, null]) {
    assert.equal(createAthleteDay({ enabled, athleteId: poison, date: poison, loadDay: poison }), null)
  }
  for (const bad of [{ athleteId: '' }, { date: '2026-02-30' }, { loadDay: null }]) {
    assert.throws(() => createAthleteDay({ enabled: true, athleteId, date, loadDay() {}, ...bad }))
  }
})

test('load exact scope, stable frozen snapshots; plan is never counted as intake', async () => {
  const { model, calls, loads, value } = setup()
  assert.equal(model.snapshot().phase, 'idle')
  assert.equal(await model.load(), true)
  assert.deepEqual(loads, [{ athleteId, date }]); assert.equal(calls.length, 0)
  const s = model.snapshot()
  assert.strictEqual(s, model.snapshot()); assert.ok(Object.isFrozen(s.meals[0].foods))
  assert.deepEqual(s.meals[0].values, { kcal: 420, protein: 37, carb: 58, fat: 3 })
  assert.deepEqual(s.totals, { kcal: 0, protein: 0, carb: 0, fat: 0 })
  assert.equal(s.eatenCount, 0)
  value.plan.meals[0].foods[0].grams = 999
  assert.equal(model.snapshot().meals[0].foods[0].grams, 200)
  assert.throws(() => { s.meals[0].foods[0].grams = 999 })
})

test('only explicit no-plan or inactive scoped plan selects existing tracker', async () => {
  for (const value of [{ plan: null }, { plan: { active: false, athlete_id: athleteId, date } }]) {
    const { model, calls } = setup({ value }); assert.equal(await model.load(), true)
    assert.equal(model.snapshot().mode, 'tracker'); assert.equal(await model.markEaten('lunch'), false)
    assert.equal(calls.length, 0)
  }
  for (const value of [undefined, {}, { plan: undefined }, { plan: { active: false, athlete_id: 'other', date } }]) {
    const { model } = setup({ loadDay: async () => value }); assert.equal(await model.load(), false)
    assert.equal(model.snapshot().phase, 'load-error'); assert.equal(model.snapshot().mode, null)
  }
})

test('one tap writes exact rounded meal and scope only after acknowledgement; replay and double tap deduplicated', async () => {
  const gate = deferred(), calls = []
  const { model } = setup({ saveMeal: payload => { calls.push(payload); return gate.promise } })
  await model.load()
  const pending = model.markEaten('lunch')
  assert.equal(await model.markEaten('lunch'), false); assert.equal(await model.markEaten('snack'), false)
  assert.equal(await model.load(), false); assert.equal(model.setGrams('lunch', 'rice', '10'), false)
  assert.equal(model.snapshot().totals.kcal, 0); assert.equal(model.snapshot().pending, true)
  assert.equal(calls.length, 1)
  const p = calls[0]
  assert.equal(p.namespace, namespace)
  assert.deepEqual(JSON.parse(p.key), [namespace, athleteId, date, 'synthetic-plan', 'r1', 'lunch'])
  assert.deepEqual(p.log, { meal: 'Frokost <test>', kcal: 420, protein: 37, carb: 58, fat: 3 })
  assert.deepEqual(p.foods.map(f => f.grams), [200, 100, 50]); assert.ok(Object.isFrozen(p.foods[0]))
  gate.resolve(true); assert.equal(await pending, true)
  assert.equal(model.snapshot().totals.kcal, 420); assert.equal(model.snapshot().eatenCount, 1)
  assert.equal(model.snapshot().meals[0].eaten, true)
  assert.equal(await model.markEaten('lunch'), false); assert.equal(calls.length, 1)
})

test('comma grams recalculates and persists actual portions; invalid/missing amounts never save', async () => {
  const f = setup(); await f.model.load()
  f.model.toggleEdit('lunch'); assert.equal(f.model.snapshot().meals[0].editing, true)
  for (const value of ['', '-1', 'Infinity', 'NaN', '1.2.3']) {
    f.model.setGrams('lunch', 'rice', value)
    assert.equal(f.model.snapshot().meals[0].values, null)
    assert.equal(await f.model.markEaten('lunch'), false)
  }
  assert.equal(f.calls.length, 0)
  f.model.setGrams('lunch', 'rice', '125,5')
  assert.equal(f.model.snapshot().meals[0].values.kcal, 323)
  assert.equal(await f.model.markEaten('lunch'), true)
  assert.equal(f.calls[0].foods[0].grams, 125.5)
  assert.equal(f.model.snapshot().meals[0].foods[0].grams, 125.5)
  assert.equal(f.model.snapshot().meals[0].editing, false)
})

test('known zeros allowed per food, all-zero meal or unknown macro stays unavailable; overflow never escapes', async () => {
  const f = setup(); await f.model.load()
  f.model.setGrams('lunch', 'rice', 0)
  assert.equal(f.model.snapshot().meals[0].values.kcal, 160)
  f.model.setGrams('lunch', 'chicken', 0); f.model.setGrams('lunch', 'veg', 0)
  assert.equal(await f.model.markEaten('lunch'), false)
  for (const missing of [null, undefined, '', -1, Infinity]) {
    const value = source(); value.plan.meals[0].foods[0].protein100 = missing
    const { model } = setup({ value }); await model.load()
    assert.equal(model.snapshot().meals[0].values, null)
    assert.equal(await model.markEaten('lunch'), false)
  }
  assert.equal(mealValues([{ grams: Number.MAX_VALUE, kcal100: Number.MAX_VALUE }]), null)
})

test('explicit rejected save preserves draft, totals and ability to retry; truthy is not confirmation', async () => {
  for (const result of [false, undefined, { ok: true }]) {
    let attempt = 0
    const f = setup({ saveMeal: async () => ++attempt === 1 ? result : true }); await f.model.load()
    f.model.setGrams('lunch', 'rice', '150')
    assert.equal(await f.model.markEaten('lunch'), false)
    assert.equal(f.model.snapshot().phase, 'save-error'); assert.equal(f.model.snapshot().totals.kcal, 0)
    assert.equal(f.model.snapshot().meals[0].foods[0].grams, '150')
    assert.equal(await f.model.markEaten('lunch'), true); assert.equal(attempt, 2)
  }
})

test('uncertain write cannot be repeated before canonical reload; confirmed receipt restores without double count', async () => {
  const value = source(); let calls = 0
  const { model } = setup({ value, saveMeal: async payload => {
    calls++; const saved = persisted(payload); value.logs.push(saved.log); value.eaten.push(saved.receipt)
    throw Error('synthetic lost response')
  } })
  await model.load(); assert.equal(await model.markEaten('lunch'), false)
  assert.equal(model.snapshot().phase, 'uncertain'); assert.equal(model.snapshot().totals.kcal, 0)
  assert.equal(await model.markEaten('lunch'), false); assert.equal(model.setGrams('lunch', 'rice', 50), false)
  assert.equal(await model.load(), true)
  assert.equal(model.snapshot().eatenCount, 1); assert.equal(model.snapshot().totals.kcal, 420)
  assert.equal(await model.markEaten('lunch'), false); assert.equal(calls, 1)
})

test('reload eaten portions, normal logs and reserved receipts do not double count', async () => {
  const f = setup(); await f.model.load(); f.model.setGrams('lunch', 'rice', '150'); await f.model.markEaten('lunch')
  const saved = persisted(f.calls[0]), value = consumed()
  value.logs.push(saved.log, { id: 'extra', athlete_id: athleteId, date, meal: 'Ekstra', kcal: 100, protein: 0, carb: 0, fat: 0 },
    { id: 'receipt', athlete_id: athleteId, date, meal: '[appData2-day-v1]receipt', kcal: 99999 })
  value.eaten.push(saved.receipt)
  const again = setup({ value }).model; await again.load()
  assert.equal(again.snapshot().eatenCount, 2); assert.equal(again.snapshot().totals.kcal, 505)
  assert.equal(again.snapshot().loggedCount, 3); assert.equal(again.snapshot().meals[0].foods[0].grams, 150)
  assert.equal(await again.markEaten('lunch'), false)
})

test('foreign, malformed, duplicate or mismatched data fails closed without tracker or writes', async () => {
  const mutations = [
    v => { v.plan.athlete_id = 'other' }, v => { v.plan.date = '2026-11-03' },
    v => { v.plan.active = 'true' }, v => { v.plan.revision = '' },
    v => { v.plan.meals.push(v.plan.meals[0]) }, v => { v.plan.meals[0].foods.push(v.plan.meals[0].foods[0]) },
    v => { v.logs = null }, v => { v.eaten = null },
    v => { v.logs[0].athlete_id = 'other' }, v => { v.logs[0].date = '2026-11-05' },
    v => { v.logs.push(v.logs[0]) }, v => { v.eaten[0].key = 'wrong' },
    v => { v.eaten[0].log_id = 'missing' }, v => { v.eaten[0].foods[0].grams = 200 },
    v => { v.eaten.push(v.eaten[0]) },
  ]
  for (const change of mutations) {
    const value = consumed(); change(value)
    const f = setup({ value }); assert.equal(await f.model.load(), false)
    assert.equal(f.model.snapshot().mode, null); assert.equal(await f.model.markEaten('lunch'), false)
    assert.equal(f.calls.length, 0)
  }
})

test('missing targets and unknown intake remain unknown; unrelated dates are excluded', async () => {
  const value = source(); value.plan.targets = { kcal: 0, protein: -1 }
  value.logs.push({ id: 'old', athlete_id: athleteId, date: '2026-11-03', meal: 'Old', kcal: 900 },
    { id: 'now', athlete_id: athleteId, date, meal: 'Unknown', kcal: '', protein: 0, carb: 1, fat: 0 })
  const f = setup({ value }); await f.model.load()
  assert.deepEqual(f.model.snapshot().targets, { kcal: null, protein: null, carb: null, fat: null })
  assert.equal(f.model.snapshot().totals.kcal, null); assert.equal(f.model.snapshot().totals.protein, 0)
  await f.model.markEaten('snack'); assert.equal(f.model.snapshot().totals.kcal, null)
})

test('day boundary guard and missing save adapter cannot produce writes', async () => {
  for (const currentDay of [() => '2026-11-05', () => { throw Error('synthetic clock failure') }]) {
    const f = setup({ currentDay }); await f.model.load()
    assert.equal(await f.model.markEaten('lunch'), false); assert.equal(f.calls.length, 0)
    assert.match(f.model.snapshot().message, /Dagen er skiftet|Datoen kunne ikke/)
  }
  const f = setup({ saveMeal: undefined }); await f.model.load()
  assert.equal(f.model.snapshot().canSave, false); assert.equal(await f.model.markEaten('lunch'), false)
})

test('stale loads and disposal suppress late responses and old session writes', async () => {
  const a = deferred(), b = deferred(); let attempt = 0
  const f = setup({ loadDay: () => ++attempt === 1 ? a.promise : b.promise })
  const first = f.model.load(), second = f.model.load()
  b.resolve({ plan: null }); await second; a.resolve(source()); assert.equal(await first, false)
  assert.equal(f.model.snapshot().mode, 'tracker')
  const gate = deferred(), g = setup({ saveMeal: () => gate.promise }); await g.model.load()
  let events = 0; g.model.subscribe(() => events++)
  const write = g.model.markEaten('lunch'); const count = events; g.model.dispose(); gate.resolve(true)
  assert.equal(await write, false); assert.equal(events, count)
  assert.equal(await g.model.markEaten('snack'), false); assert.equal(await g.model.load(), false)
})
