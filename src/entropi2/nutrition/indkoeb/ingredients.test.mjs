import test from 'node:test'
import assert from 'node:assert/strict'
import { buildShoppingList } from './shoppingList.mjs'
import { readIngredients } from './ingredients.mjs'
const base = { name: 'Ris', foodId: 'synthetic:rice', preparation: 'tør', source: { citation: 'synthetic catalog', verification: 'synthetic only' }, quantity: 50, unit: 'g' }
const shopping = ingredients => buildShoppingList([{ id: 'a', ingredients }], ['a']).items

test('R6: only g/kg mass combines, preserving preparation, identity, source and incompatible units', () => {
  const input = [base, { ...base, quantity: 1, unit: 'kg' }, { ...base, preparation: 'kogt', quantity: 150 },
    { ...base, unit: 'ml' }, { ...base, unit: 'styk' }, { ...base, foodId: 'synthetic:other' },
    { ...base, source: { ...base.source, citation: 'another synthetic source' } },
    { name: 'Ris', quantity: 50, unit: 'g' }]
  const before = structuredClone(input), items = shopping(input)
  assert.equal(items.length, 7)
  assert.deepEqual(items.map(i => [i.quantity, i.unit]), [[1050, 'g'], [150, 'g'], [50, 'ml'], [50, 'styk'], [50, 'g'], [50, 'g'], [50, 'g']])
  assert.deepEqual(items[0].source, base.source)
  assert.equal(items[0].foodId, base.foodId)
  assert.equal(items[0].preparation, 'tør')
  items[0].source.citation = 'changed result'
  assert.deepEqual(input, before)
})

test('R6: same explicit identity may have a renamed display label; legacy names never merge with known identity', () => {
  const items = shopping([base, { ...base, name: 'Ris renamed', quantity: 25 }, { name: 'RIS', quantity: 1, unit: 'kg' }])
  assert.equal(items.length, 2)
  assert.equal(items[0].quantity, 75)
  assert.equal(items[1].quantity, 1000)
})

test('R6: fractional portions count without deduplicating distinct occurrences; overflow fails', () => {
  const meals = [{ id: '0:0', portions: '1,5', ingredients: [base] }, { id: '0:1', ingredients: [base] }, { id: '2:0', ingredients: [base] }]
  const result = buildShoppingList(meals, ['0:0', '0:1', '2:0', '0:0'])
  assert.equal(result.selectedCount, 3)
  assert.equal(result.items[0].quantity, 175)
  for (const portions of [0, -1, null, '', true, Infinity, 1001]) {
    assert.throws(() => buildShoppingList([{ ...meals[0], portions }], ['0:0']), TypeError)
  }
  assert.throws(() => shopping([{ ...base, quantity: Number.MAX_VALUE, unit: 'kg' }]), TypeError)
})

test('R6: invalid explicit metadata is rejected; absent metadata remains absent, without food-name guesses', () => {
  for (const extra of [{ foodId: '' }, { preparation: '' }, { source: '' }, { source: {} }, { source: { citation: 'test' } }]) {
    assert.throws(() => readIngredients([{ ...base, ...extra }]), TypeError)
  }
  assert.equal(readIngredients(undefined), undefined)
  assert.deepEqual(readIngredients([{ name: 'kogte linser', quantity: '0,2', unit: 'kg' }]), [{ name: 'kogte linser', quantity: .2, unit: 'kg' }])
})
