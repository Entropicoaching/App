import test from 'node:test'
import assert from 'node:assert/strict'
import { buildShoppingList, mountShoppingList } from './index.mjs'
import { Element } from '../synthetic-dom.mjs'

const ingredient = (name = 'Havre', quantity = 50, unit = 'g') => ({ name, quantity, unit })
const meal = (id, ingredients = [ingredient()]) => ({ id, meal: `Ret ${id}`, ingredients })
const freeze = value => { Object.freeze(value); for (const child of Object.values(value)) if (child && typeof child === 'object') freeze(child); return value }

test('selected own meals sum matching names/units, normalize g/kg and retain incompatible units and do not mutate inputs', () => {
  const meals = freeze([meal('a', [ingredient(' Havre ', '0,1', ' G '), ingredient('Mælk', 2, 'dl')]),
    meal('b', [ingredient('HAVRE', .2), ingredient('Havre', 1, 'kg')]), meal('unselected')])
  const selected = freeze(['a', 'b', 'a'])
  const result = buildShoppingList(meals, selected)
  assert.equal(result.selectedCount, 2)
  assert.equal(result.items.length, 2)
  assert.ok(Math.abs(result.items[0].quantity - 1000.3) < 1e-12)
  assert.deepEqual(result.items.slice(1), [{ name: 'Mælk', quantity: 2, unit: 'dl' }])
  result.items[0].name = 'changed'
  assert.equal(meals[0].ingredients[0].name, ' Havre ')
})

test('empty choice, missing legacy ingredients and stale or ambiguous IDs are explicit', () => {
  assert.deepEqual(buildShoppingList([], []), { items: [], missingMeals: [], selectedCount: 0 })
  const old = { id: 'old', meal: 'Gemt favorit', kcal: 300 }
  assert.deepEqual(buildShoppingList([old], ['old']).missingMeals, [{ id: 'old', meal: 'Gemt favorit' }])
  for (const args of [[null, []], [[], null], [[meal('a')], ['other']], [[meal('a'), meal('a')], []], [[meal(' ')], []]]) {
    assert.throws(() => buildShoppingList(...args), TypeError)
  }
})

test('invalid quantities and ingredients fail rather than silently omitting a selected ingredient', () => {
  for (const bad of [null, '', ' ', '1e2', '12g', '1,2.3', -1, 0, Infinity, NaN, true]) {
    assert.throws(() => buildShoppingList([meal('a', [ingredient('Ris', bad)])], ['a']), TypeError)
  }
  for (const bad of [null, {}, ingredient('', 1), ingredient('Ris', 1, '')]) {
    assert.throws(() => buildShoppingList([meal('a', [bad])], ['a']), TypeError)
  }
  assert.throws(() => buildShoppingList([meal('a', [ingredient('Ris', 1e308), ingredient('Ris', 1e308)])], ['a']), TypeError)
  // Unselected bad ingredients do not prevent choosing valid meals.
  assert.equal(buildShoppingList([meal('a'), meal('bad', [null])], ['a']).items.length, 1)
})

function hostFixture() {
  class Node extends Element {
    removeEventListener(type, fn) { this.events[type] = this.events[type].filter(item => item !== fn) }
    remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(item => item !== this) }
  }
  const doc = { createElement: tag => new Node(tag, doc) }
  return new Node('div', doc)
}

test('OFF never touches the host or reads meals', () => {
  const host = new Proxy({}, { get() { throw Error('OFF touched host') } })
  for (const enabled of [false, undefined, 1, 'true']) mountShoppingList(host, { enabled, ownMeals: null })()
})

test('actual DOM mount/change/deselect, partial-list warning, safe text and disposal', async () => {
  const host = hostFixture(), sentinel = host.ownerDocument.createElement('p')
  sentinel.textContent = 'Eksisterende indhold'; host.append(sentinel)
  const dispose = mountShoppingList(host, { enabled: true, ownMeals: [meal('a', [ingredient('<img src=x>', '0,25')]), { id: 'old', meal: 'Gammel ret' }] })
  assert.match(host.textContent, /Vælg et eller flere/)
  const [first, second] = host.querySelectorAll('input')
  first.checked = true; await first.fire('change')
  assert.match(host.textContent, /<img src=x>: 0,25 g/)
  assert.equal(host.querySelectorAll('img').length, 0)
  second.checked = true; await second.fire('change')
  assert.match(host.textContent, /Listen er ufuldstændig.*Gammel ret/)
  first.checked = false; await first.fire('change')
  assert.equal(host.querySelectorAll('li').length, 0)
  dispose(); dispose()
  assert.deepEqual(host.children, [sentinel])
  assert.equal(first.events.change.length, 0)
})

test('empty state and invalid ingredient alert leave no stale list', async () => {
  const empty = hostFixture(); mountShoppingList(empty, { enabled: true })
  assert.match(empty.textContent, /ingen egne måltider/)
  const host = hostFixture()
  mountShoppingList(host, { enabled: true, ownMeals: [meal('ok'), meal('bad', [ingredient('Ris', -1)])] })
  const inputs = host.querySelectorAll('input')
  inputs[0].checked = true; await inputs[0].fire('change')
  assert.equal(host.querySelectorAll('li').length, 1)
  inputs[1].checked = true; await inputs[1].fire('change')
  assert.equal(host.querySelectorAll('li').length, 0)
  assert.equal(host.querySelectorAll('p').some(n => n.getAttribute('role') === 'alert'), true)
  inputs[1].checked = false; await inputs[1].fire('change')
  assert.equal(host.querySelectorAll('li').length, 1)
})
