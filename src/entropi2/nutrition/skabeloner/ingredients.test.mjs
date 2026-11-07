import test from 'node:test'
import assert from 'node:assert/strict'
import { createMealTemplates, recurringMeals } from './model.mjs'
const athleteId = 'synthetic:r6', date = '2026-11-04'
const ingredients = [{ foodId: 'synthetic:lentils', name: 'Linser', source: { citation: 'synthetic', verification: 'test' }, preparation: 'kogt', quantity: 200, unit: 'g' },
  { foodId: 'synthetic:rice', name: 'Ris', preparation: 'tør', source: 'synthetic', quantity: 75, unit: 'g' }]
const rows = ['a','b','c'].map(id => ({ id, athlete_id: athleteId, date, meal: 'Synthetic bowl', kcal: 400, protein: 20, carb: 60, fat: 10, ingredients: structuredClone(ingredients) }))
function fixture() {
  const data = new Map(), writes = []
  const storage = { getItem: k => data.get(k) ?? null, setItem(k,v) { data.set(k,v); writes.push(k) } }
  const options = { enabled: true, athleteId, date, rows: structuredClone(rows), storage }
  const model = createMealTemplates(options)
  const id = model.snapshot().suggestions[0].id
  return { data, writes, storage, options, model, id }
}

test('R6: real accept and scoped reload retain all explicit ingredient facts with the original stable meal ID', () => {
  const f = fixture(), original = structuredClone(f.options.rows)
  assert.deepEqual(f.model.snapshot().suggestions[0].ingredients, ingredients)
  assert.equal(f.model.accept(f.id), true)
  assert.deepEqual(f.model.snapshot().templates[0].ingredients, ingredients)
  const loaded = createMealTemplates({ ...f.options, rows: [] })
  assert.deepEqual(loaded.snapshot().templates[0].ingredients, ingredients)
  assert.equal(loaded.snapshot().templates[0].id, JSON.stringify(['Synthetic bowl',400,20,60,10]))
  const snap = loaded.snapshot(); snap.templates[0].ingredients[0].source.citation = 'mutation'
  assert.deepEqual(loaded.snapshot().templates[0].ingredients, ingredients)
  assert.deepEqual(f.options.rows, original)
  assert.equal(f.writes.length, 1)
  // Logging payload remains the existing macro-only backend contract.
  assert.equal(loaded.useTemplate(f.id).ingredients, undefined)
})

test('R6: ambiguous recipes with identical macros never select arbitrary ingredients, including reordered histories', () => {
  for (const change of [{ quantity: 201 }, { preparation: 'rå' }, { source: 'another source' }, { foodId: 'other' }]) {
    const history = structuredClone(rows)
    Object.assign(history[1].ingredients[0], change)
    for (const input of [history, [...history].reverse()]) {
      assert.equal(recurringMeals(input, { athleteId, date })[0].ingredients, undefined)
    }
  }
  const history = structuredClone(rows); delete history[1].ingredients
  assert.equal(recurringMeals(history, { athleteId, date })[0].ingredients, undefined)
  const conflicting = [...structuredClone(rows), { ...structuredClone(rows[0]), ingredients: [] }]
  assert.deepEqual(recurringMeals(conflicting, { athleteId, date }), [])
})

test('R6: explicit editing preserves ID/macros, retries storage failure and removes ingredients without inventing them', () => {
  const f = fixture(); f.model.accept(f.id)
  const save = f.storage.setItem
  const updated = [{ ...ingredients[0], quantity: 250 }]
  f.storage.setItem = () => { throw Error('synthetic quota') }
  assert.equal(f.model.setIngredients(f.id, updated), false)
  assert.deepEqual(f.model.snapshot().templates[0].ingredients, ingredients)
  f.storage.setItem = save
  assert.equal(f.model.setIngredients(f.id, updated), true)
  updated[0].quantity = 999
  assert.equal(f.model.snapshot().templates[0].ingredients[0].quantity, 250)
  assert.equal(f.model.snapshot().templates[0].id, f.id)
  assert.equal(f.model.snapshot().templates[0].meal.kcal, 400)
  assert.equal(f.model.setIngredients(f.id, [{ name: 'Ris', quantity: -1, unit: 'g' }]), false)
  assert.equal(f.model.snapshot().templates[0].ingredients[0].quantity, 250)
  assert.equal(f.model.setIngredients('foreign-id', []), false)
  assert.equal(f.model.setIngredients(f.id, []), true)
  assert.deepEqual(createMealTemplates(f.options).snapshot().templates[0].ingredients, [])
})

test('R6: legacy storage remains readable and unchanged on reads; corrupt ingredient payload cannot be overwritten', () => {
  const f = fixture(); f.model.accept(f.id)
  const key = f.writes[0], payload = JSON.parse(f.data.get(key))
  delete payload.templates[0].ingredients
  f.data.set(key, JSON.stringify(payload))
  const before = f.data.get(key), writes = f.writes.length
  assert.equal(createMealTemplates(f.options).snapshot().templates[0].ingredients, undefined)
  assert.equal(f.data.get(key), before); assert.equal(f.writes.length, writes)
  payload.templates[0].ingredients = [{ name: 'Ris', unit: 'g', quantity: -1 }]
  f.data.set(key, JSON.stringify(payload))
  const bad = createMealTemplates(f.options), raw = f.data.get(key)
  assert.match(bad.snapshot().error, /ikke læses/)
  assert.equal(bad.accept(f.id), false)
  assert.equal(f.data.get(key), raw); assert.equal(f.writes.length, writes)
})
