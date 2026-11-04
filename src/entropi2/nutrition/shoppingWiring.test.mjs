import test from 'node:test'
import assert from 'node:assert/strict'
import { createNutritionController } from './controller.mjs'
import { mountNutrition } from './view.mjs'
import { syntheticHost, find, flush } from './synthetic-dom.mjs'

const shopping = host => host.querySelectorAll('details').find(n => n.getAttribute('data-focus') === 'shopping-list')
const meal = { id: 'synthetic-ingredients', meal: 'Syntetisk grød', ingredients: [{ name: 'Havre', quantity: 80, unit: 'g' }] }
function fixture(t, initial) {
  let ownMeals = initial
  const controller = createNutritionController({ enabled: true, athlete: { id: 'synthetic-shopping' }, date: '2026-11-04',
    contracts: { load: async () => [], save: async () => { throw Error('Unexpected save') } } })
  const snapshot = controller.snapshot
  // Synthetic ingredient-bearing view contract; current favorites strip ingredients.
  // The real model's hidden fallback is covered in screenWiring.test.mjs.
  controller.snapshot = () => ({ ...snapshot(), ownMeals })
  const host = syntheticHost(), cleanup = mountNutrition(host, controller)
  t.after(cleanup)
  return { host, controller, update(value) { ownMeals = value; controller.toggleHistory() } }
}

test('shopping wiring: mixed collection offers only meals with ingredients, preserves choices and disposes hidden list', async t => {
  const f = fixture(t, [{ id: 'without', meal: 'Uden ingredienser' }, meal]); await flush()
  const fold = shopping(f.host)
  assert.equal(fold.open, false)
  assert.equal(fold.parentElement.children.at(-1), fold)
  assert.equal(fold.querySelectorAll('input').length, 1)
  assert.doesNotMatch(fold.textContent, /Uden ingredienser/)
  fold.open = true
  const input = fold.querySelectorAll('input')[0]
  input.checked = true; await input.fire('change')
  assert.ok(find(fold, 'li', 'Havre: 80 g'))
  assert.doesNotMatch(fold.textContent, /ufuldstændig/)
  f.controller.toggleHistory()
  assert.equal(shopping(f.host).open, true)
  assert.equal(shopping(f.host).querySelectorAll('input')[0], input)
  assert.equal(input.checked, true)
  f.update([])
  assert.equal(shopping(f.host), undefined)
  assert.equal(input.events.change.length, 0)
  f.update([meal])
  assert.equal(shopping(f.host).open, false)
  assert.ok(!shopping(f.host).querySelectorAll('input')[0].checked)
})

test('shopping wiring: invalid ingredients show error; changed collection recovers without stale handlers', async t => {
  const f = fixture(t, [{ ...meal, ingredients: [{ name: 'Havre', quantity: -1, unit: 'g' }] }]); await flush()
  const input = shopping(f.host).querySelectorAll('input')[0]
  input.checked = true; await input.fire('change')
  assert.ok(shopping(f.host).querySelectorAll('p').some(p => p.getAttribute('role') === 'alert'))
  assert.equal(shopping(f.host).querySelectorAll('li').length, 0)
  f.update([meal])
  assert.equal(input.events.change.length, 0)
  const valid = shopping(f.host).querySelectorAll('input')[0]
  valid.checked = true; await valid.fire('change')
  assert.ok(find(shopping(f.host), 'li', 'Havre: 80 g'))
})

test('shopping wiring: duplicate IDs report mount error without a partial list', async t => {
  const f = fixture(t, [meal, meal]); await flush()
  assert.match(shopping(f.host).textContent, /Indkøbslisten kunne ikke vises/)
  assert.ok(shopping(f.host).querySelectorAll('p').some(p => p.getAttribute('role') === 'alert'))
  assert.equal(shopping(f.host).querySelectorAll('input').length, 0)
})
