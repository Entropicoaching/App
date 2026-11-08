import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { FOODS, createFood, sumDay } from './index.mjs'
import { FRIDA_FOODS, COACH_FOODS } from './frida55.mjs'
import { FRIDA_ROWS } from './frida55.data.mjs'
import { supportedFoodSnapshot } from '../sqlSnapshot.mjs'
import { openPortalPlan } from '../coach/portalModel.mjs'
import { memoryStorage } from '../coach/portal.fixture.mjs'
import { generateCoachGrams } from '../coach/gramPlan.mjs'
import { catalogFoods } from '../coach/model.mjs'
const provenance = JSON.parse(readFileSync(new URL('./frida55.provenance.json', import.meta.url)))
const food = id => FRIDA_FOODS.find(f => f.id === `frida55:${id}`)

test('bounded coach extension preserves every legacy object, order and general index', () => {
  assert.equal(FRIDA_FOODS.length, 40)
  assert.equal(COACH_FOODS.length, FOODS.length + 40)
  FOODS.forEach((f, i) => assert.equal(COACH_FOODS[i], f))
  assert.equal(new Set(COACH_FOODS.map(f => f.id)).size, COACH_FOODS.length)
  assert.ok(catalogFoods(COACH_FOODS))
  assert.ok(Buffer.byteLength(JSON.stringify(FRIDA_FOODS)) < 80000)
  assert.ok(readFileSync(new URL('./frida55.data.mjs', import.meta.url)).length < 35000)
  for (const f of FRIDA_FOODS) {
    assert.equal(Object.isFrozen(f.nutrientsPer100g), true)
    assert.deepEqual(supportedFoodSnapshot(f), f)
    assert.equal(f.basisGrams, 100)
    assert.equal(f.preparation, `Som navngivet: ${f.name}`)
    assert.match(f.source.verification, /referencegennemsnit/)
  }
})

test('all 600 values and original provenance tuples retain labelling mapping and precision', () => {
  assert.deepEqual(provenance.mapping.map(m => m[1]), [359,317,318,141,168,162,108,184,274,165,201,126,38,143,180])
  for (const record of provenance.foods) {
    const f = food(record.foodId), row = FRIDA_ROWS.find(r => r.foodId === record.foodId)
    assert.equal(f.name, record.name)
    assert.equal(record.cells.length, 15)
    for (const c of record.cells) {
      assert.equal(f.nutrientsPer100g[c.nutrient], c.value)
      assert.equal(c.rawResVal, c.wideRaw)
      assert.equal(c.value, c.rawResVal === null ? null : Number(c.rawResVal) / c.divisor)
      if (c.normalizedRow === null) {
        assert.equal(c.value, null)
        assert.equal(row.references.some(r => r[0] === c.parameterId), false)
      } else {
        const refs = JSON.parse(f.source.citation.split('[ParameterID,Source,SourceFood]=')[1])
        assert.deepEqual(refs.find(r => r[0] === c.parameterId), [c.parameterId, c.source, c.sourceFood])
      }
    }
  }
  const leucine = provenance.foods.find(r => r.foodId === 1).cells.find(c => c.nutrient === 'leucineG')
  assert.equal(food(1).nutrientsPer100g.leucineG, Number(leucine.rawResVal) / 1000)
  assert.equal(food(1).nutrientsPer100g.vitaminDUg, 0)
  assert.ok(provenance.unknownExamples.length > 0)
  assert.equal(provenance.license.name, 'CC BY 4.0')
  assert.match(provenance.sources['1001'].E, /Anslået/)
  assert.match(provenance.sources['1003'].E, /beregnet/)
})

test('exact grams and real unknowns survive canonical snapshots and actual sumDay', () => {
  const f = food(provenance.unknownExamples[0][0])
  const unknownKey = provenance.mapping.find(m => m[1] === provenance.unknownExamples[0][1])[0]
  const day = sumDay([[{ food: food(1), grams: 123.123456789 }, { food: f, grams: 52.25 }]])
  assert.equal(day.nutrients[unknownKey].value, null)
  assert.equal(sumDay([[{ food: food(1), grams: 123.123456789 }]]).nutrients.vitaminDUg.value, 0)
  for (const bad of [-1, NaN, Infinity, '1', {}]) {
    assert.throws(() => createFood({ ...food(1), nutrientsPer100g: { energyKcal: bad } }))
  }
})

test('actual controller receives extension, preserves legacy draft bytes and legacy generation', async () => {
  const storage = memoryStorage(), options = { catalog: COACH_FOODS, enabled: true, coachId: 'synthetic-coach',
    athlete: { id: 'synthetic-athlete', age: 33, bodyweight: 80, goal: 'cut' }, date: '2026-11-08', storage: () => storage }
  const c = openPortalPlan(options).controller
  assert.equal(c.snapshot().foods.length, COACH_FOODS.length)
  assert.equal(storage.data.size, 0)
  assert.equal(c.generate([{ id: 'm', name: 'Morgenmad', items: [] }]), true)
  assert.equal(await c.save(), true)
  const bytes = [...storage.data.values()][0]
  assert.equal(openPortalPlan(options).restored, true)
  assert.equal([...storage.data.values()][0], bytes)
  const result = generateCoachGrams([{ id: 'm', name: 'Morgenmad', items: [] }], c.snapshot().suggestion, catalogFoods(COACH_FOODS))
  assert.ok(result.meals.length)
  assert.equal(result.meals.every(m => m.items.every(i => i.food.id.startsWith('local:'))), true)
  assert.equal(openPortalPlan({ enabled: false, get athlete() { throw Error('OFF') } }), null)
})
