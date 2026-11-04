import test from 'node:test'
import assert from 'node:assert/strict'
import { LOCAL_FOODS } from '../../../athlete/lokaleFoedevarer.js'
import { createFood, FOODS, NUTRIENTS, PRIORITIES, SOURCES } from './index.mjs'

test('reuses every existing food and exact macro values without changing the source', () => {
  const before = structuredClone(LOCAL_FOODS)
  assert.equal(FOODS.length, LOCAL_FOODS.length)
  assert.equal(new Set(FOODS.map(food => food.id)).size, FOODS.length)
  for (const [index, food] of FOODS.entries()) {
    const original = LOCAL_FOODS[index]
    assert.equal(food.name, original.name)
    assert.equal(food.basisGrams, 100)
    for (const [key, legacy] of Object.entries({
      energyKcal: 'kcal100', proteinG: 'protein100', carbohydrateG: 'carb100', fatG: 'fat100',
    })) assert.equal(food.nutrientsPer100g[key], original[legacy])
    for (const key of Object.keys(NUTRIENTS).slice(4)) assert.equal(food.nutrientsPer100g[key], null)
    assert.equal(food.source.verification, 'kilde skal verificeres')
  }
  assert.deepEqual(LOCAL_FOODS, before)
  assert.notEqual(FOODS[0], LOCAL_FOODS[0])
  assert.throws(() => { FOODS[0].nutrientsPer100g.proteinG = 999 }, TypeError)
  assert.throws(() => { FOODS[0].source.verification = 'verified' }, TypeError)
  assert.throws(() => { FOODS.push(FOODS[0]) }, TypeError)
  assert.deepEqual(LOCAL_FOODS, before)
})

test('explicit units cover minerals, vitamins, fibre and leucine; raw and cooked stay distinct', () => {
  assert.equal(NUTRIENTS.energyKcal.unit, 'kcal')
  assert.equal(NUTRIENTS.fibreG.unit, 'g')
  for (const key of ['ironMg', 'calciumMg', 'magnesiumMg', 'zincMg', 'potassiumMg', 'sodiumMg']) {
    assert.equal(NUTRIENTS[key].unit, 'mg')
  }
  for (const key of ['vitaminDUg', 'vitaminB12Ug', 'folateUg']) assert.equal(NUTRIENTS[key].unit, 'µg')
  assert.equal(NUTRIENTS.leucineG.unit, 'g')
  assert.equal(FOODS.find(food => food.name === 'Ris tør').nutrientsPer100g.energyKcal, 361)
  assert.equal(FOODS.find(food => food.name === 'Ris kogt').nutrientsPer100g.energyKcal, 130)
  assert.match(FOODS.find(food => food.name === 'Kyllingebryst').preparation, /unspecified/)
})

test('new food validates values and provenance, copies input, preserves true zero', () => {
  const input = { id: 'synthetic', name: 'Syntetisk produkt', preparation: 'cooked',
    nutrientsPer100g: { fibreG: 0, calciumMg: 120, vitaminDUg: 2.5 },
    source: { citation: 'synthetic fixture', verification: 'synthetic' } }
  const food = createFood(input)
  input.nutrientsPer100g.calciumMg = 0
  input.source.citation = 'changed'
  assert.equal(food.nutrientsPer100g.calciumMg, 120)
  assert.equal(food.nutrientsPer100g.fibreG, 0)
  assert.equal(food.nutrientsPer100g.energyKcal, null)
  assert.equal(food.source.citation, 'synthetic fixture')
  for (const bad of [-1, NaN, Infinity, '12', '', true, {}]) {
    assert.throws(() => createFood({ ...input, nutrientsPer100g: { fibreG: bad } }), TypeError)
  }
  for (const bad of [{}, { ...input, id: '' }, { ...input, source: null },
    { ...input, nutrientsPer100g: [] }, { ...input, nutrientsPer100g: { calciumG: 1 } }]) {
    assert.throws(() => createFood(bad), TypeError)
  }
})

test('priorities have bounded evidence claims, real citation identifiers and resolvable examples', () => {
  assert.deepEqual(PRIORITIES.map(entry => entry.order), [1, 2, 3, 4])
  assert.deepEqual(PRIORITIES.map(entry => entry.id), ['protein', 'carbohydrate', 'plants', 'calcium-protein'])
  const sources = new Set(SOURCES.map(source => source.id)), foods = new Set(FOODS.map(food => food.id))
  for (const entry of PRIORITIES) {
    assert.ok(['high', 'moderate', 'limited'].includes(entry.evidence))
    assert.ok(entry.scope && entry.caveat && entry.rationale)
    assert.equal(entry.verification, 'kilde skal verificeres')
    assert.ok(entry.sourceIds.length && entry.sourceIds.every(id => sources.has(id)))
    assert.ok(entry.foodIds.length && entry.foodIds.every(id => foods.has(id)))
    assert.throws(() => entry.foodIds.push('invented'), TypeError)
  }
  for (const source of SOURCES) {
    assert.match(source.doi, /^10\./)
    assert.equal(source.verification, 'kilde skal verificeres')
  }
})
