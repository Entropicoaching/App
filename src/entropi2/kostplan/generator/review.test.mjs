// Independent arithmetic/oracles: do not import solver, fixtures or its scoring.
import test from 'node:test'
import assert from 'node:assert/strict'
import { LOCAL_FOODS } from '../../../athlete/lokaleFoedevarer.js'
import { generateGramPlan } from './index.mjs'

const keys = ['kcal', 'protein', 'carb', 'fat']
const id = name => 'local:' + encodeURIComponent(name)
const limits = { kcal: 50, protein: 5, carb: 10, fat: 3 }
const foods = names => names.map(name => {
  const food = LOCAL_FOODS.find(value => value.name === name)
  assert.ok(food)
  return food
})
const totals = (list, grams) => Object.fromEntries(keys.map(key => [key,
  list.reduce((sum, food, i) => sum + food[key + '100'] * grams[i] / 100, 0)]))
const request = (list, targets, minGrams = 25, maxGrams = 75) => ({ targets, mealCount: 1,
  meals: [{ id: 'review', name: 'Kontrol', items: list.map(food => ({ foodId: id(food.name), minGrams, maxGrams })) }] })
const error = (actual, target) => keys.reduce((sum, key) =>
  sum + ((actual[key] - target[key]) / Math.max(limits[key], target[key] * 0.05)) ** 2, 0)

test('independent catalog-wide portion arithmetic and status audit', () => {
  for (const food of LOCAL_FOODS.filter(food => food.kcal100 > 0)) {
    const input = request([food], totals([food], [15]), 5, 25)
    const result = generateGramPlan(input)
    const actual = totals([food], [result.meals[0].items[0].grams])
    for (const key of keys) {
      assert.ok(Math.abs(actual[key] - result.totals[key]) < 1e-9)
      assert.equal(result.deviation[key].withinTolerance,
        Math.abs(actual[key] - input.targets[key]) <= Math.max(limits[key], input.targets[key] * 0.05) + 1e-9)
    }
    assert.equal(result.status, 'matched', food.name)
    // In one dimension, the bounded lattice minimum can be fully enumerated.
    const best = Math.min(...[5, 10, 15, 20, 25].map(g => error(totals([food], [g]), input.targets)))
    assert.ok(error(actual, input.targets) <= best + 1e-9, food.name)
  }
})

test('exhaustive 2-food lattice oracle checks feasible and conflicting targets', () => {
  for (const names of [['Ris kogt', 'Kyllingebryst'], ['Havregryn', 'Skyr naturel'],
    ['Olivenolie', 'Broccoli'], ['Mælk minimælk', 'Hytteost']]) {
    const list = foods(names)
    for (const wantedGrams of [[25, 75], [43, 57], [75, 25]]) {
      for (const conflict of [false, true]) {
        const target = totals(list, wantedGrams)
        // Deliberately inconsistent targets exercise honest failure statuses.
        if (conflict) { target.protein += 25; target.carb += 35 }
        const input = request(list, target)
        const result = generateGramPlan(input)
        let best = Infinity, feasible = false
        for (let a = 25; a <= 75; a += 5) for (let b = 25; b <= 75; b += 5) {
          const actual = totals(list, [a, b])
          best = Math.min(best, error(actual, target))
          if (keys.every(key => Math.abs(actual[key] - target[key]) <= Math.max(limits[key], target[key] * 0.05))) feasible = true
        }
        const actual = totals(list, result.meals[0].items.map(item => item.grams))
        assert.ok(error(actual, target) <= best + 1e-8, `${names}: lattice score`)
        if (result.status === 'matched') assert.ok(feasible)
        if (result.status === 'infeasible') assert.equal(feasible, false)
        if (feasible) assert.equal(result.status, 'matched')
      }
    }
  }
})

test('independent three-food enumeration checks quantized recovery', () => {
  const list = foods(['Ris kogt', 'Kyllingebryst', 'Olivenolie'])
  const targets = totals(list, [60, 40, 30]), input = request(list, targets)
  const result = generateGramPlan(input)
  let best = Infinity
  for (let a = 25; a <= 75; a += 5) for (let b = 25; b <= 75; b += 5) for (let c = 25; c <= 75; c += 5) {
    best = Math.min(best, error(totals(list, [a, b, c]), targets))
  }
  assert.ok(error(result.totals, targets) <= best + 1e-9)
  assert.equal(result.status, 'matched')
})
