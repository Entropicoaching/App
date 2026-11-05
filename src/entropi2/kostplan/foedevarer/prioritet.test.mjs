import test from 'node:test'
import assert from 'node:assert/strict'
import { LOCAL_FOODS } from '../../../athlete/lokaleFoedevarer.js'
import { createFood, FOODS, sumMeal, sumDay } from './index.mjs'

const fixture = () => ({ id: 'synthetic:priority', name: 'Syntetisk vare',
  nutrientsPer100g: { energyKcal: 150, proteinG: 12, carbohydrateG: 20, fatG: 2 },
  source: { citation: 'synthetic fixture only', verification: 'synthetic' } })
const withoutPriority = ({ prioritet, prioritetBegrundelse, ...food }) => food

test('optional priority leaves legacy/custom foods unmarked and preserves their exact shape', () => {
  const input = fixture(), food = createFood(input)
  assert.deepEqual(Object.keys(food).sort(),
    ['id', 'name', 'preparation', 'basisGrams', 'nutrientsPer100g', 'source'].sort())
  for (const name of ['Skyr naturel', 'Laks fersk', 'Ukendt syntetisk vare']) {
    assert.equal(Object.hasOwn(createFood({ ...input, name }), 'prioritet'), false)
  }
  assert.equal(Object.hasOwn(FOODS.find(food => food.name === 'Sukker'), 'prioritet'), false)
})

test('each allowed priority requires a reason, survives reconstruction and cannot mutate', () => {
  for (const prioritet of ['basis', 'god', 'særlig']) {
    const input = { ...fixture(), prioritet, prioritetBegrundelse: ' Syntetisk begrundelse ' }
    const food = createFood(input)
    input.prioritet = 'changed'; input.prioritetBegrundelse = 'changed'
    assert.equal(food.prioritet, prioritet)
    assert.equal(food.prioritetBegrundelse, 'Syntetisk begrundelse')
    assert.deepEqual(createFood(food), food)
    assert.throws(() => { food.prioritet = 'god' }, TypeError)
    assert.throws(() => { food.prioritetBegrundelse = 'changed' }, TypeError)
  }
})

test('malformed or incomplete priority metadata fails explicitly', () => {
  for (const prioritet of [null, '', 'Basis', 'høj', 1, true, {}, ['basis']]) {
    assert.throws(() => createFood({ ...fixture(), prioritet, prioritetBegrundelse: 'Syntetisk' }), TypeError)
  }
  for (const prioritetBegrundelse of [undefined, null, '', '  ', 0, true, {}, []]) {
    assert.throws(() => createFood({ ...fixture(), prioritet: 'basis', prioritetBegrundelse }), TypeError)
  }
  assert.throws(() => createFood({ ...fixture(), prioritetBegrundelse: 'Uden niveau' }), TypeError)
  assert.throws(() => createFood({ ...fixture(), prioritet: null }), TypeError)
})

test('only explicit existing catalog examples are marked; data, order and unknowns remain intact', () => {
  const expected = new Map([
    ['Skyr naturel', 'basis'], ['Kyllingebryst', 'god'], ['Tofu fast', 'god'],
    ['Havregryn', 'basis'], ['Linser kogte', 'basis'], ['Ris kogt', 'god'],
    ['Broccoli', 'basis'], ['Laks fersk', 'særlig'], ['Hakket oksekød 8%', 'særlig'],
  ])
  assert.equal(FOODS.filter(food => food.prioritet !== undefined).length, expected.size)
  assert.deepEqual(FOODS.map(food => food.name), LOCAL_FOODS.map(food => food.name))
  for (const food of FOODS) {
    assert.equal(food.prioritet, expected.get(food.name))
    assert.equal(Object.hasOwn(food, 'prioritetBegrundelse'), expected.has(food.name))
    if (expected.has(food.name)) assert.ok(food.prioritetBegrundelse.trim().length > 30)
    assert.deepEqual(withoutPriority(food), createFood(withoutPriority(food)))
    for (const key of ['leucineG', 'ironMg', 'vitaminDUg', 'fibreG']) {
      assert.equal(food.nutrientsPer100g[key], null)
    }
    assert.equal(food.source.verification, 'kilde skal verificeres')
  }
})

test('editorial labels never change meal or day nutrition, including unknown coverage', () => {
  const marked = FOODS.filter(food => food.prioritet).map((food, index) => ({ food, grams: 10.5 + index }))
  const plain = marked.map(portion => ({ ...portion, food: withoutPriority(portion.food) }))
  assert.deepEqual(sumMeal(marked), sumMeal(plain))
  assert.deepEqual(sumDay([marked, []]), sumDay([plain, []]))
  assert.equal(sumDay([marked]).nutrients.ironMg.value, null)
  assert.equal(sumDay([marked]).nutrients.vitaminDUg.value, null)
})
