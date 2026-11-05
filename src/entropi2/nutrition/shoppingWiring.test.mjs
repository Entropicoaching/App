import test from 'node:test'
import assert from 'node:assert/strict'
import { createNutritionController } from './controller.mjs'
import { mountNutrition } from './view.mjs'
import { syntheticHost, find, flush } from './synthetic-dom.mjs'

test('shopping wiring: ingredient-bearing favorites never create a second list outside Ugeplan', async t => {
  const controller = createNutritionController({ enabled: true, athlete: { id: 'synthetic-shopping' }, date: '2026-11-04',
    contracts: { load: async () => [], save: async () => { throw Error('Unexpected save') } } })
  const snapshot = controller.snapshot
  const meal = { id: 'synthetic', meal: 'Skål', ingredients: [{ name: 'Havre', quantity: 80, unit: 'g' }] }
  controller.snapshot = () => ({ ...snapshot(), ownMeals: [meal, meal] })
  const host = syntheticHost()
  t.after(mountNutrition(host, controller))
  await flush()
  assert.equal(host.querySelectorAll('details').filter(n => n.getAttribute('data-focus') === 'shopping-list').length, 0)
  assert.doesNotMatch(host.textContent, /Indkøb fra dine favoritter/)
  const fold = find(host, 'summary', 'Ugeplan').parentElement
  assert.equal(fold.open, false)
  assert.equal(find(host, 'h2', 'Din uge'), undefined)
  assert.equal(fold.parentElement.tagName, 'SECTION')
})
