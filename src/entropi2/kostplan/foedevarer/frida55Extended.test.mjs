import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import * as general from './index.mjs'
import { createFood, NUTRIENTS, FOODS, sumDay } from './index.mjs'
import { COACH_FOODS, FRIDA_FOODS } from './frida55.mjs'
import { FRIDA_ROWS } from './frida55.data.mjs'
import { ADDITIONAL_FRIDA_ROWS } from './frida55Extended.data.mjs'
import { ADDITIONAL_FRIDA_FOODS, EXTENDED_COACH_FOODS } from './frida55Extended.mjs'
import { supportedFoodSnapshot } from '../sqlSnapshot.mjs'
import { catalogFoods, totals } from '../coach/model.mjs'
import { searchFoods } from '../coach/foodSearch.mjs'
import { openPortalPlan } from '../coach/portalModel.mjs'

const read = name => readFileSync(new URL(name, import.meta.url))
const json = name => JSON.parse(read(name))
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const assertUnchangedBaseFile = (raw, expected, name) => {
  const text = raw.toString('utf8')
  assert.deepEqual(Buffer.from(text, 'utf8'), raw, `${name}: lossless UTF-8`)
  const bytes = Buffer.from(text.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n'), 'utf8')
  assert.equal(hash(bytes), expected.sha256, name)
  assert.equal(bytes.length, expected.bytes, name)
}
const sources = json('./frida55Extended.sources.json')
const parts = [1, 2].map(n => json(`./frida55Extended.provenance-0${n}.json`))
const records = parts.flatMap(p => p.foods)
const mapping = sources.parameterMapping
const keys = Object.keys(NUTRIENTS)
const oldProvenance = json('./frida55.provenance.json')
const byId = id => ADDITIONAL_FRIDA_FOODS.find(f => f.id === `frida55:${id}`)
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}
freeze(records)

test('exactly 80 additive official IDs; old 40/600, bytes, identities, order and default stay fixed', () => {
  assert.equal(ADDITIONAL_FRIDA_FOODS.length, 80)
  assert.equal(records.length, 80)
  assert.equal(FRIDA_FOODS.length, 40)
  assert.equal(EXTENDED_COACH_FOODS.length, FOODS.length + 120)
  assert.equal(general.FOODS, FOODS)
  assert.equal('ADDITIONAL_FRIDA_FOODS' in general, false)
  assert.equal('EXTENDED_COACH_FOODS' in general, false)
  COACH_FOODS.forEach((food, i) => assert.equal(EXTENDED_COACH_FOODS[i], food))
  FOODS.forEach((food, i) => assert.equal(COACH_FOODS[i], food))
  FRIDA_FOODS.forEach((food, i) => {
    assert.equal(COACH_FOODS[FOODS.length + i], food)
    assert.equal(food.id, `frida55:${oldProvenance.foods[i].foodId}`)
    assert.equal(food.name, oldProvenance.foods[i].name)
    assert.deepEqual(food.nutrientsPer100g, FRIDA_ROWS[i].values)
    oldProvenance.foods[i].cells.forEach(c => assert.equal(food.nutrientsPer100g[c.nutrient], c.value))
  })
  for (const [name, expected] of Object.entries(sources.unchangedBaseFiles)) {
    assertUnchangedBaseFile(read(name), expected, name)
  }
  assert.deepEqual(ADDITIONAL_FRIDA_ROWS.map(r => r.foodId), sources.foods.map(f => f.foodId))
  assert.equal(new Set(EXTENDED_COACH_FOODS.map(f => f.id)).size, EXTENDED_COACH_FOODS.length)
  const old = new Set(FRIDA_FOODS.map(f => f.id))
  for (const food of ADDITIONAL_FRIDA_FOODS) assert.equal(old.has(food.id), false)
})

test('all 1200 projected cells retain exact names, mapping, original units, zeros, nulls and per-field tuples', () => {
  assert.deepEqual(Object.keys(mapping), keys)
  assert.deepEqual(Object.values(mapping).map(m => m.parameterId), [359,317,318,141,168,162,108,184,274,165,201,126,38,143,180])
  let count = 0, unknown = 0, zero = 0
  for (const [i, record] of records.entries()) {
    const food = byId(record.foodId), row = ADDITIONAL_FRIDA_ROWS[i]
    assert.equal(food.name, record.name)
    assert.equal(food.name, record.officialFoodRow['FødevareNavn'])
    assert.equal(food.preparation, `Som navngivet: ${food.name}`)
    assert.equal(record.foodGroupID, record.officialFoodRow.FoodGroupID)
    assert.equal(record.foodGroupDa, record.officialFoodRow['FødevareGruppe'])
    assert.equal(record.cells.length, 15)
    assert.deepEqual(Object.keys(food.nutrientsPer100g), keys)
    const references = []
    for (const [j, cell] of record.cells.entries()) {
      const [parameterId, normalizedRow, original, originalXml, wide, projected, status] = cell
      const key = keys[j], m = mapping[key]
      assert.equal(parameterId, m.parameterId)
      assert.equal(m.sourceUnit, m.metadata.Unit)
      assert.equal(m.metadata.ParameterID, parameterId)
      assert.equal(m.targetUnit, NUTRIENTS[key].unit)
      assert.equal(m.divideBy, key === 'leucineG' ? 1000 : 1)
      assert.equal(food.nutrientsPer100g[key], projected)
      assert.equal(row.values[key], projected)
      const raw = original?.[0] ?? null
      const valid = typeof raw === 'number' && Number.isFinite(raw) && raw >= 0
      assert.equal(projected, valid ? raw / m.divideBy : null)
      if (original === null) {
        assert.equal(normalizedRow, null)
        assert.equal(originalXml, null)
        assert.equal(status, 'missing-normalized-row')
        assert.ok(wide === null || wide[3] === null || wide[3] === 'NULL')
        unknown++
      } else {
        assert.equal(original.length, 7)
        assert.ok(Number.isInteger(normalizedRow) && normalizedRow > 1)
        assert.equal(wide[3], raw)
        assert.equal(originalXml[0], 'n')
        assert.equal(Number(originalXml[1]), raw)
        assert.equal(Number(wide[2]), raw)
        assert.equal(status, 'known')
        references.push([parameterId, String(original[5]), String(original[6])])
      }
      if (projected === 0) zero++
      count++
    }
    assert.deepEqual(row.references, references)
    assert.deepEqual(JSON.parse(food.source.citation.split('[ParameterID,Source,SourceFood]=')[1]), references)
    assert.match(food.source.citation, new RegExp(`FoodID=${record.foodId};`))
    assert.match(food.source.citation, /10\.11583\/DTU\.29500682\.v8/)
    assert.match(food.source.citation, /Marija Langwagen, Jette Jacobsen, Tue Christensen and Anders Poulsen/)
    assert.match(food.source.citation, /CC BY 4\.0/)
    assert.equal(food.source.verification, FRIDA_FOODS[0].source.verification)
    for (const key of keys.slice(0, 4)) assert.equal(typeof food.nutrientsPer100g[key], 'number')
  }
  assert.equal(count, 1200)
  assert.equal(unknown, 12)
  assert.equal(zero, 173)
  assert.deepEqual([NUTRIENTS.ironMg.unit, NUTRIENTS.folateUg.unit, NUTRIENTS.leucineG.unit], ['mg', 'µg', 'g'])
})

test('both bounded provenance parts, actual source uncertainty and acyclic content bindings are retained', () => {
  for (const [name, binding] of Object.entries(sources.bindings)) {
    const bytes = read('./' + name)
    assert.equal(bytes.length, binding.bytes)
    assert.equal(hash(bytes), binding.sha256)
    assert.ok(bytes.length <= 500000)
  }
  assert.equal(sources.foods.length, 80)
  assert.equal(sources.originalWorkbook.sha256, '6b1952a35df3c0d4d7b2699ae0a3e377add42b231108309329b40256ef600e5e')
  assert.equal(sources.originalWorkbook.bytes, 12298422)
  assert.equal(sources.originalWorkbook.officialMD5, 'b553eed6805e3cd8856663421de0f1fe')
  const unresolved = new Set()
  for (const part of parts) {
    assert.match(part.sources['1003'].TitleOriginal, /beregnet/)
    if (part.sources['1001']) assert.match(part.sources['1001'].TitleOriginal, /Anslået/)
    part.unresolvedSourceFoodIDs.forEach(id => unresolved.add(id))
    for (const record of part.foods) for (const cell of record.cells) {
      const original = cell[2]
      if (!original) continue
      if (original[5] !== 'NULL') for (const id of String(original[5]).split(',')) assert.ok(part.sources[id.trim()])
      if (original[6] !== 'NULL') for (const id of String(original[6]).split(',')) {
        assert.ok(part.borrowedSourceFoods[id.trim()] || part.unresolvedSourceFoodIDs.includes(Number(id.trim())))
      }
    }
  }
  assert.deepEqual([...unresolved].sort((a, b) => a - b), [7, 690, 826])
  assert.deepEqual(records.filter(r => !r.groupLabelsAgree).map(r => r.foodId), [1690, 1702])
  assert.equal(Object.keys(sources.bindings).some(name => name.endsWith('.sources.json')), false)
})

test('arrays, rows, nested reference tuples, nutrients and supported source objects are immutable', () => {
  for (const array of [ADDITIONAL_FRIDA_FOODS, EXTENDED_COACH_FOODS, ADDITIONAL_FRIDA_ROWS]) {
    assert.ok(Object.isFrozen(array))
    assert.throws(() => array.push(array[0]), TypeError)
  }
  for (const [i, food] of ADDITIONAL_FRIDA_FOODS.entries()) {
    const row = ADDITIONAL_FRIDA_ROWS[i]
    for (const object of [food, food.source, food.nutrientsPer100g, row, row.values, row.references, ...row.references]) assert.ok(Object.isFrozen(object))
    assert.throws(() => { food.source.citation = 'changed' }, TypeError)
    assert.throws(() => { food.nutrientsPer100g.energyKcal = 0 }, TypeError)
    assert.throws(() => { row.references[0][1] = 'invented' }, TypeError)
  }
})

test('real createFood rejects signed, nonfinite, textual and NULL countercases derived from original cells', () => {
  const food = byId(60), raw = records.find(r => r.foodId === 60).cells[0][2][0]
  assert.ok(raw > 0)
  for (const value of [-raw, NaN, Infinity, -Infinity, String(raw), 'NULL', {}, true]) {
    const input = freeze({ ...food, nutrientsPer100g: { ...food.nutrientsPer100g, energyKcal: value } })
    assert.throws(() => createFood(input), TypeError)
  }
  const unknown = byId(11)
  assert.equal(unknown.nutrientsPer100g.leucineG, null)
  assert.equal(createFood(freeze(structuredClone(unknown))).nutrientsPer100g.leucineG, null)
  const zero = ADDITIONAL_FRIDA_FOODS.find(f => f.nutrientsPer100g.vitaminDUg === 0)
  assert.ok(zero)
  assert.equal(sumDay([[freeze({ food: zero, grams: 123.125 })]]).nutrients.vitaminDUg.value, 0)
  assert.equal(sumDay([[freeze({ food: unknown, grams: 12.5 })]]).nutrients.leucineG.value, null)
})

test('all 80 exact foods roundtrip through the actual strict supported snapshot functions', () => {
  for (const food of ADDITIONAL_FRIDA_FOODS) {
    const snapshot = supportedFoodSnapshot(food)
    assert.deepEqual(snapshot, food)
    assert.deepEqual(supportedFoodSnapshot(freeze(JSON.parse(JSON.stringify(snapshot)))), food)
    assert.throws(() => supportedFoodSnapshot({ ...food, foodGroup: 'new taxonomy' }), TypeError)
    assert.throws(() => supportedFoodSnapshot({ ...food, source: { ...food.source, verified: true } }), TypeError)
    assert.throws(() => supportedFoodSnapshot({ ...food, nutrientsPer100g: { ...food.nutrientsPer100g, energyKcal: '10' } }), TypeError)
  }
})

test('actual bounded consumer accepts the 80 additions; existing 300-choice guard and raw/cooked IDs stay intact', () => {
  assert.equal(EXTENDED_COACH_FOODS.length, 320)
  // This data-stage entry point is not mounted. Ordinary integration must
  // resolve the existing 300-choice limit without silently truncating foods.
  assert.equal(catalogFoods(EXTENDED_COACH_FOODS), null)
  for (const food of EXTENDED_COACH_FOODS) assert.ok(catalogFoods([food]))
  const catalog = catalogFoods(ADDITIONAL_FRIDA_FOODS)
  assert.ok(catalog)
  assert.equal(catalog.length, 80)
  assert.equal(byId(1803).name, 'Kikærter, tørrede, rå')
  assert.equal(byId(1812).name, 'Kikærter, lyse, kogte, konserves')
  assert.notDeepEqual(byId(1803).nutrientsPer100g, byId(1812).nutrientsPer100g)
  const found = searchFoods(catalog, 'kikaerter', '')
  assert.ok(found.foods.some(f => f.id === 'frida55:1803'))
  assert.ok(found.foods.some(f => f.id === 'frida55:1812'))
  const ingredients = freeze([1803, 1812, 1693].map((id, i) => ({ food: catalog.find(f => f.id === `frida55:${id}`), grams: [23.125, 137.5, 82.25][i] })))
  const before = JSON.stringify(ingredients)
  const actual = totals(freeze([{ id: 'synthetic-meal', name: 'Syntetisk måltid', items: ingredients }]))
  const canonical = sumDay([ingredients.map(item => ({ grams: item.grams, food: item.food.nutrition }))])
  assert.deepEqual(actual, Object.fromEntries([['kcal','energyKcal'],['protein','proteinG'],['carb','carbohydrateG'],['fat','fatG']].map(([a,b]) => [a,canonical.nutrients[b].value])))
  assert.equal(JSON.stringify(ingredients), before)
  assert.equal(sumDay([[{ food: byId(1693), grams: 100 }]]).nutrients.energyKcal.value, byId(1693).nutrientsPer100g.energyKcal)
  assert.equal(openPortalPlan({ enabled: false, get athlete() { throw Error('OFF guard must remain first') } }), null)
})

test('all 11 pinned original byte bindings accept LF/CRLF and reject content mutations and invalid UTF-8', () => {
  assert.equal(Object.keys(sources.unchangedBaseFiles).length, 11)
  for (const [name, expected] of Object.entries(sources.unchangedBaseFiles)) {
    const raw = read(name)
    const lf = Buffer.from(raw.toString('utf8').replace(/\r\n/g, '\n'), 'utf8')
    const crlf = Buffer.from(lf.toString('utf8').replace(/\n/g, '\r\n'), 'utf8')
    for (const bytes of [lf, crlf]) {
      assertUnchangedBaseFile(bytes, expected, name)
      const mutated = Buffer.from(bytes)
      const index = mutated.findIndex(value => value >= 0x20 && value <= 0x7e)
      assert.ok(index >= 0)
      mutated[index] ^= 1
      assert.equal(mutated.length, bytes.length)
      assert.throws(() => assertUnchangedBaseFile(mutated, expected, name), {
        code: 'ERR_ASSERTION', expected: expected.sha256,
      })
      assert.throws(() => assertUnchangedBaseFile(Buffer.concat([bytes, Buffer.from([0xff])]), expected, name), /lossless UTF-8/)
      assert.throws(() => assertUnchangedBaseFile(bytes, { ...expected, bytes: expected.bytes + 1 }, name), {
        code: 'ERR_ASSERTION', actual: expected.bytes, expected: expected.bytes + 1,
      })
    }
  }
})
