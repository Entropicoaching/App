// Separate adversarial checks: independent fixture and hand-computed oracle,
// with no use of the producer's test helpers or nutrition calculation helper.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createAthleteDay } from './dayModel.mjs'

const athleteId = 'review-athlete', date = '2028-02-29'
function day() {
  return { plan: { active: true, athlete_id: athleteId, date, id: 'review-plan', revision: 'v2',
    targets: { kcal: '2000', protein: '100' }, meals: [{ id: 'dinner', name: 'Aftensmad', foods: [
      { id: 'a', name: 'A', grams: '150,5', kcal100: 100, protein100: 10, carb100: 20, fat100: 1 },
      { id: 'b', name: 'B', grams: 25, kcal100: 80, protein100: 4, carb100: 0, fat100: 8 },
    ] }] }, logs: [], eaten: [] }
}
const model = (value, extra = {}) => createAthleteDay({ enabled: true, athleteId, date,
  loadDay: async () => value, saveMeal: async () => true, ...extra })

test('review oracle: hand-computed gram scaling, one final rounding and no invented goals', async () => {
  const m = model(day()); await m.load()
  // Energy = 150.5 + 20 = 170.5; protein = 15.05 + 1 = 16.05;
  // carbs = 30.1 + 0; fat = 1.505 + 2 = 3.505.
  assert.deepEqual(m.snapshot().meals[0].values, { kcal: 171, protein: 16, carb: 30, fat: 4 })
  assert.deepEqual(m.snapshot().targets, { kcal: 2000, protein: 100, carb: null, fat: null })
  await m.markEaten('dinner')
  assert.deepEqual(m.snapshot().totals, { kcal: 171, protein: 16, carb: 30, fat: 4 })
})

test('review: idempotency identity changes with athlete/day/plan/revision, never with gram edits', async () => {
  const keys = []
  for (const change of [v => v, v => { v.plan.id = 'other'; return v }, v => { v.plan.revision = 'v3'; return v }]) {
    const m = model(change(day()), { saveMeal: async payload => { keys.push(payload.key); return true } })
    await m.load(); await m.markEaten('dinner')
  }
  assert.equal(new Set(keys).size, 3)
  const payloads = []
  const m = model(day(), { saveMeal: async payload => { payloads.push(payload); return false } })
  await m.load(); await m.markEaten('dinner'); m.setGrams('dinner', 'a', '200'); await m.markEaten('dinner')
  assert.equal(payloads[0].key, payloads[1].key)
  assert.notDeepEqual(payloads[0].foods, payloads[1].foods)
  assert.deepEqual(Object.keys(payloads[0]).sort(), ['namespace', 'key', 'athlete_id', 'date', 'plan_id', 'plan_revision', 'meal_id', 'foods', 'log'].sort())
})

test('review: foreign revision receipts and one log reused for two meals cannot mark meals eaten', async () => {
  for (const kind of ['foreign-revision', 'reused-log']) {
    const value = day(), meal = value.plan.meals[0]
    value.logs.push({ id: 'log', athlete_id: athleteId, date, meal: meal.name, kcal: 171, protein: 16, carb: 30, fat: 4 })
    value.eaten.push({ key: JSON.stringify(['entropi2:kostplan:atlet:v1', athleteId, date, value.plan.id,
      kind === 'foreign-revision' ? 'v1' : 'v2', meal.id]), log_id: 'log', meal_id: meal.id,
      foods: [{ id: 'a', grams: 150.5 }, { id: 'b', grams: 25 }] })
    if (kind === 'reused-log') {
      value.plan.meals.push({ ...meal, id: 'second' })
      value.eaten.push({ ...value.eaten[0], meal_id: 'second',
        key: JSON.stringify(['entropi2:kostplan:atlet:v1', athleteId, date, value.plan.id, 'v2', 'second']) })
    }
    const m = model(value)
    assert.equal(await m.load(), false); assert.equal(m.snapshot().mode, null)
    assert.equal(await m.markEaten('dinner'), false)
  }
})

test('review: delayed load after disposal cannot publish data; subscribers can unsubscribe', async () => {
  let resolve
  const m = model(null, { loadDay: () => new Promise(done => { resolve = done }) })
  let events = 0; const unsubscribe = m.subscribe(() => events++)
  const loading = m.load(); assert.equal(events, 1); unsubscribe(); m.dispose()
  resolve(day()); assert.equal(await loading, false); assert.equal(events, 1)
})

test('review: reserved day-confirmation names cannot become plan meal logs', async () => {
  for (const label of ['[appData2-day-v1]reserved', '  [appData2-day-v1]reserved']) {
    const value = day(); value.plan.meals[0].name = label
    let saves = 0
    const m = model(value, { saveMeal: async () => { saves++; return true } })
    assert.equal(await m.load(), false); assert.equal(await m.markEaten('dinner'), false)
    assert.equal(saves, 0)
  }
})
