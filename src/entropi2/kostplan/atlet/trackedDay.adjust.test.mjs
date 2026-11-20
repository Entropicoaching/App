import test from 'node:test'
import assert from 'node:assert/strict'
import { createTrackedAthleteDay } from './trackerAdapter.mjs'
import { namespace, scaledMeal } from './dayModel.mjs'
import { nutritionContracts } from '../../nutrition/contracts.mjs'
import { athleteId, date, source } from './day.fixture.mjs'

// 1924 (Marc 19. nov.: "gøre en træls gentagelig handling lidt nemmere"): et spist
// planmåltid får ny mængde i samme række, og kvitteringen følger med.
function fixture() {
  const rows = [], values = new Map()
  let sequence = 0
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
  const contracts = nutritionContracts({ client: { from() {
    return {
      insert(row) {
        const saved = { ...row, id: 'synthetic-log-' + ++sequence }; rows.push(saved)
        return { async select() { return { data: [{ id: saved.id }], error: null } } }
      },
      select() {
        const q = { eq: () => q, gte: () => q, lte: () => q, async order() { return { data: rows.map(row => ({ ...row })), error: null } } }
        return q
      },
    }
  } } })
  const make = () => createTrackedAthleteDay({ enabled: true, athleteId, date, storage, contracts, loadPlan: async () => source().plan })
  const receipt = () => values.get(`${namespace}:${encodeURIComponent(athleteId)}:${date}`)
  // Kostloggens egen update i miniature: samme række, kun ved succes.
  const writer = mode => async (rowId, value) => {
    if (mode === 'throw') throw Error('syntetisk netfejl')
    if (mode !== 'ok') return false
    Object.assign(rows.find(row => row.id === rowId), value); return true
  }
  return { rows, values, make, receipt, writer }
}

const lunch = m => m.snapshot().meals.find(meal => meal.id === 'lunch')
const grams = meal => meal.foods.reduce((sum, food) => sum + food.grams, 0)

test('spist planmåltid: ny mængde retter samme række og kvitteringen; måltidet står stadig som spist', async t => {
  const f = fixture(), first = f.make(); t.after(first.dispose)
  assert.equal(await first.load(), true); assert.equal(await first.markEaten('lunch'), true)
  // Lige efter Spist kendes rækkens id først ved næste indlæsning.
  assert.equal(lunch(first).logId, null)
  assert.equal(await first.adjustEaten('lunch', 100, f.writer('ok')), false)
  const m = f.make(); t.after(m.dispose); assert.equal(await m.load(), true)
  const before = lunch(m), oldReceipt = f.receipt(), oldRow = { ...f.rows[0] }
  assert.equal(before.eaten, true); assert.equal(before.logId, f.rows[0].id)

  // Fejl (afvist eller kastet): gammel række, gammel kvittering, stadig spist.
  for (const mode of ['false', 'throw']) {
    assert.equal(await m.adjustEaten('lunch', grams(before) * 1.5, f.writer(mode)), false)
    assert.equal(m.snapshot().phase, 'save-error')
    assert.equal(f.receipt(), oldReceipt); assert.deepEqual(f.rows, [oldRow])
    assert.equal(lunch(m).eaten, true); assert.equal(lunch(m).blocked, false)
  }

  const next = scaledMeal(before.foods, grams(before) * 1.5)
  assert.equal(await m.adjustEaten('lunch', grams(before) * 1.5, f.writer('ok')), true)
  assert.equal(f.rows.length, 1, 'ingen ny række')
  assert.deepEqual({ ...f.rows[0] }, { ...oldRow, ...next.values })
  assert.deepEqual(lunch(m).values, next.values); assert.equal(lunch(m).eaten, true)
  // En ny session læser den nye kvittering og rækken som et spist måltid, ikke "skal kontrolleres".
  const fresh = f.make(); t.after(fresh.dispose); assert.equal(await fresh.load(), true)
  assert.equal(lunch(fresh).eaten, true); assert.equal(lunch(fresh).blocked, false)
  assert.equal(grams(lunch(fresh)), grams(before) * 1.5); assert.deepEqual(lunch(fresh).values, next.values)
  assert.deepEqual(fresh.snapshot().blockedMeals ?? [], [])
})

test('spist planmåltid: en ændring fra en anden session giver stadig "skal kontrolleres" og retter intet', async t => {
  const f = fixture(), first = f.make(); t.after(first.dispose)
  assert.equal(await first.load(), true); assert.equal(await first.markEaten('lunch'), true)
  const m = f.make(); t.after(m.dispose); assert.equal(await m.load(), true)
  // En anden session skriver kvitteringen om efter indlæsningen: ingen skrivning.
  const raw = JSON.parse(f.receipt()); raw.receipts[0].foods[0].grams += 1
  f.values.set(`${namespace}:${encodeURIComponent(athleteId)}:${date}`, JSON.stringify(raw))
  let called = false
  assert.equal(await m.adjustEaten('lunch', 50, async () => { called = true; return true }), false)
  assert.equal(called, false); assert.equal(m.snapshot().phase, 'uncertain')
  // Rækken rettet uden om kvitteringen (fx i dagbogen på en anden enhed): skal kontrolleres.
  f.values.delete(`${namespace}:${encodeURIComponent(athleteId)}:${date}`)
  const g = fixture(), a = g.make(); t.after(a.dispose)
  assert.equal(await a.load(), true); assert.equal(await a.markEaten('lunch'), true)
  g.rows[0].kcal += 10
  const b = g.make(); t.after(b.dispose); assert.equal(await b.load(), true)
  assert.equal(lunch(b).blocked, true); assert.equal(lunch(b).eaten, false)
  assert.equal(await b.adjustEaten('lunch', 50, g.writer('ok')), false)
})

test('scaledMeal: samme faktor på hver fødevare, ingen mængde under eller lig 0', () => {
  const foods = [{ id: 'a', grams: 100, kcal100: 100, protein100: 10, carb100: 10, fat100: 1 },
    { id: 'b', grams: 50, kcal100: 200, protein100: 0, carb100: 40, fat100: 2 }]
  assert.deepEqual(scaledMeal(foods, 300).foods.map(food => food.grams), [200, 100])
  assert.deepEqual(scaledMeal(foods, '300').values, { kcal: 400, protein: 20, carb: 60, fat: 4 })
  for (const bad of [0, -5, '', 'abc', null]) assert.equal(scaledMeal(foods, bad), null)
})
