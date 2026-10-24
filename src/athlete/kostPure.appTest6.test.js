// APP-TEST6. Kun smaa rene beregningskopier; ingen handler eller datakald koeres.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { parseInputNumber, nutritionValues, finiteTotal, calendarTime } from './kostNumbers.mjs'

const source = (real, pinned) => readFileSync(new URL(existsSync(new URL(real, import.meta.url)) ? real : pinned, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const kost = source('./kostHandlinger.js', './input-183-180-kostHandlinger.js')
const shared = source('../athleteShared.js', './input-221-218-athleteShared.js')
const weight = source('./beskederOgVaegt.jsx', './input-175-172-beskederOgVaegt.jsx')
function between(text, start, end) {
  const a = text.indexOf(start)
  assert.ok(a >= 0, `Mangler start: ${start}`)
  assert.equal(text.indexOf(start, a + start.length), -1, `Start er ikke entydig: ${start}`)
  const b = text.indexOf(end, a + start.length)
  assert.ok(b > a, `Mangler slut: ${end}`)
  return text.slice(a, b)
}
function pure(args, body) {
  assert.doesNotMatch(body, /\b(?:supabase|await|fetch|setTimeout|process)\b/)
  const names = ['parseInputNumber', 'nutritionValues', 'finiteTotal', 'calendarTime']
  const fn = new Function(...names, ...args, body)
  return (...values) => fn(parseInputNumber, nutritionValues, finiteTotal, calendarTime, ...values)
}
function copies(k = kost, s = shared, w = weight) {
  k = k.replace(/\r\n/g, '\n'); s = s.replace(/\r\n/g, '\n'); w = w.replace(/\r\n/g, '\n')
  const units = between(s, 'const PORTION_UNITS =', '\nexport const s =').replace('export function', 'function')
  const parse = between(k, '  function parseLoggedGrams(', '\n  function startEditLog(')
  const add = between(k, '  async function addFromSearch(', '\n  async function quickAddSearchFood(')
  const portion = between(add, '    const amt = parseInputNumber(amount)', '    const ok = await runGuardedWrite(')
  const payload = between(add, '        kcal: nutrients.kcal', '\n      }),')
  const customFunction = between(k, '  async function saveCustomFood(', '\n  async function deleteLog(')
  const custom = between(customFunction, '    const nutrients =', '\n    const { data } =')
  const edit = between(k, '    const parsed = parseLoggedGrams(l.meal)\n    let update', '    const ok = await runGuardedWrite(')
  const totals = between(k, '  const totKcal =', '\n  const tdeeEstimate =')
  const energy = between(k, '  const tdeeEstimate =', '\n  return {\n    fetchLogs,')
  const weightExpr = between(w, '    const weight = parseInputNumber(weightInput)', '\n    if (weight === null')
  assert.equal((w.match(/\{ weight \}/g) || []).length, 1)
  assert.equal((w.match(/weight, logged_at:/g) || []).length, 1)
  const portionFn = pure(['selectedFood', 'amount', 'unit'], portion + '\nreturn { meal: label, grams, ' + payload + '\n}')
  const customFn = pure(['createFood', 'athlete', 'shareFood'], custom + '\nreturn food')
  return {
    units: pure(['food'], units + '\nreturn unitsForFood(food)'),
    parse: pure(['meal'], parse + '\nreturn parseLoggedGrams(meal)'),
    // Rejection has no payload. Zero is the numeric sentinel for the legacy assertions.
    portion: (...args) => portionFn(...args) ?? { kcal: 0 },
    custom: (...args) => customFn(...args) ?? { kcal100: 0 },
    edit: pure(['l', 'editGrams', 'editMacros'], parse + '\n' + edit + '\nreturn update'),
    totals: pure(['logs', 'athlete'], totals + '\nreturn {totKcal,totProtein,totCarb,totFat,kcalPct,proteinPct,pLen,cLen,fLen,circ}'),
    energy: pure(['historicalMealLogs', 'weightLogs'], energy + '\nreturn tdeeEstimate'),
    weight: pure(['weightInput'], weightExpr + '\nreturn weight'),
  }
}
const f = copies()
const food = { name: 'Syntetisk vare', kcal100: 123, protein100: 11, carb100: 23, fat100: 7 }
const custom = values => f.custom({ name: '  Egen test  ', kcal100: '', protein100: '', carb100: '', fat100: '', unit_label: '', unit_grams: '', ...values }, { id: 'syntetisk' }, false)
const days = (n = 7, kcal = 2000) => Array.from({ length: n }, (_, i) => ({ date: `2026-03-${String(i + 1).padStart(2, '0')}`, kcal }))
const weights = (a = '2026-03-01', b = '2026-03-08', x = 80, y = 80) => [{ logged_at: b, weight: y }, { logged_at: a, weight: x }]

test('APP-TEST6: LF og CRLF giver samme rene kopier', () => {
  const crlf = copies(kost.replace(/\n/g, '\r\n'), shared.replace(/\n/g, '\r\n'), weight.replace(/\n/g, '\r\n'))
  assert.deepEqual(crlf.portion(food, '125', { label: 'g', grams: 1 }), f.portion(food, '125', { label: 'g', grams: 1 }))
})
test('APP-TEST6: gram og egne portionsenheder uden mutation', () => {
  const own = { ...food, isCustom: true, unit_label: 'skaal', unit_grams: '125.5' }
  const before = JSON.stringify(own)
  assert.deepEqual(f.units(null), [{ label: 'g', grams: 1 }])
  assert.deepEqual(f.units(own), [{ label: 'g', grams: 1 }, { label: 'skaal', grams: 125.5 }])
  for (const grams of [0, -1, '']) assert.equal(f.units({ ...own, unit_grams: grams }).length, 1)
  assert.equal(JSON.stringify(own), before)
  assert.equal(f.units({ name: 'Banan' })[1].grams, 120)
})
test('APP-TEST6: portioner afrunder hvert makrotal ens', () => {
  for (const amount of ['0', '0.5', '125.5', '1000000000']) {
    const result = f.portion(food, amount, { label: 'g', grams: 1 })
    for (const key of ['kcal', 'protein', 'carb', 'fat']) {
      assert.equal(result[key], Math.round(food[key + '100'] * Number(amount) / 100))
      assert.ok(Number.isFinite(result[key]))
    }
  }
  assert.equal(f.portion(food, '2', { label: 'skaal', grams: 125 }).grams, 250)
})
test('APP-TEST6: egne foedevarer trimmer navn og bevarer nul', () => {
  const result = custom({ kcal100: '0', protein100: '12.5', unit_label: ' skaal ', unit_grams: '125.5' })
  assert.deepEqual(result, { athlete_id: 'syntetisk', name: 'Egen test', kcal100: 0, protein100: 12.5, carb100: 0, fat100: 0, unit_label: 'skaal', unit_grams: 125.5, is_shared: false })
})
test('APP-TEST6: maaltidsrettelse skalerer og afviser nul samt negativ gram', () => {
  const row = { meal: 'Test · 200 g', kcal: 246, protein: 22, carb: 46, fat: 14 }
  const before = JSON.stringify(row)
  assert.deepEqual(f.edit(row, '100', {}), { meal: 'Test · 100 g', kcal: 123, protein: 11, carb: 23, fat: 7 })
  for (const grams of ['0', '-2', '']) assert.equal(f.edit(row, grams, {}), undefined)
  assert.deepEqual(f.parse('Test · 2 skaal (200 g)'), { base: 'Test', grams: 200 })
  assert.equal(f.parse('Test'), null)
  assert.equal(f.parse('Test · 0 g'), null)
  assert.deepEqual(f.edit({ meal: 'Uden gram' }, '', { kcal: '123', protein: '11', carb: '23', fat: '7' }), { kcal: 123, protein: 11, carb: 23, fat: 7 })
  assert.equal(JSON.stringify(row), before)
})
test('APP-TEST6: tomme og store maaltider giver endelige totaler', () => {
  const empty = f.totals([], null)
  for (const value of Object.values(empty)) assert.ok(Number.isFinite(value))
  assert.equal(empty.totKcal, 0)
  const rows = Array.from({ length: 100 }, () => ({ kcal: 1e9, protein: 1e6, carb: 2e6, fat: 3e6 }))
  const totals = f.totals(rows, { kcal_target: 2000, protein_target: 100 })
  assert.equal(totals.totKcal, 1e11)
  assert.equal(totals.kcalPct, 100)
  assert.ok(Math.abs(totals.pLen + totals.cLen + totals.fLen - totals.circ) < 1e-10)
})
test('APP-TEST6: energiestimat har graenser og grupperer samme dato', () => {
  assert.deepEqual(f.energy([], []), { ready: false, missingKcalDays: 7 })
  assert.deepEqual(f.energy(days(6), weights()), { ready: false, missingKcalDays: 1 })
  assert.deepEqual(f.energy(days(), []), { ready: false, missingWeight: true })
  assert.equal(f.energy(days(), weights('2026-03-01', '2026-03-07')).ready, false)
  const input = days(), ws = weights(), before = JSON.stringify([input, ws])
  assert.deepEqual(f.energy(input, ws), { ready: true, tdee: 2000, avgKcal: 2000, kcalDays: 7, daySpan: 7, confidence: 'lav' })
  assert.equal(JSON.stringify([input, ws]), before)
  assert.equal(f.energy([...days(), { date: '2026-03-01', kcal: 700 }], weights()).avgKcal, 2100)
  assert.equal(f.energy(days(10), weights('2026-03-01', '2026-03-15')).confidence, 'moderat')
  assert.equal(f.energy(days(14), weights('2026-03-01', '2026-03-22')).confidence, 'høj')
  assert.equal(f.energy(days(), weights('2026-03-01', '2026-03-08', 80, 80.7)).tdee, 1230)
})
test('APP-TEST6: datoer ved dansk sommer og vintertid bruger kalenderdage', () => {
  for (const [a, b] of [['2026-03-23', '2026-03-30'], ['2026-10-19', '2026-10-26']]) {
    const result = f.energy(days(), weights(a, b))
    assert.equal(result.ready, true)
    assert.equal(result.daySpan, 7)
    assert.equal(result.tdee, 2000)
  }
})
test('APP-TEST6 FUND1: decimalkomma skal bevares i portion, egen vare, rettelse og vaegt', () => {
  const checks = [
    ['portion', f.portion(food, '1,5', { label: 'g', grams: 1 }).grams, 1.5],
    ['egen vare', custom({ protein100: '12,5' }).protein100, 12.5],
    ['rettelse', f.edit({ meal: 'Test · 100 g', kcal: 100 }, '125,5', {}).kcal, 126],
    ['kropsvaegt', f.weight('80,5'), 80.5],
  ]
  assert.deepEqual(checks.map(([name, actual, expected]) => [name, actual === expected]), checks.map(([name]) => [name, true]))
})
test('APP-TEST6 FUND2: negative portioner og egne makrotal maa ikke blive negative', () => {
  const results = [f.portion(food, '-2', { label: 'g', grams: 1 }).kcal, custom({ kcal100: '-123' }).kcal100, f.weight('-80')]
  assert.ok(results.every(value => value >= 0), JSON.stringify(results))
})
test('APP-TEST6 FUND3: egne portionsenheder skal vaere endelige', () => {
  assert.ok(f.units({ ...food, isCustom: true, unit_label: 'test', unit_grams: Infinity }).every(unit => Number.isFinite(unit.grams)))
})
test('APP-TEST6 FUND4: meget store portioner og totaler maa ikke overloebe', () => {
  const results = [f.portion(food, '1e308', { label: 'test', grams: 100 }).kcal, f.totals([{ kcal: Number.MAX_VALUE }, { kcal: Number.MAX_VALUE }], null).totKcal]
  assert.ok(results.every(Number.isFinite), String(results))
})
test('APP-TEST6 FUND5: maaltidsrettelse maa ikke laese negativ og decimal gram som andre positive gram', () => {
  const results = ['Test · -100 g', 'Test · 12.5 g', 'Test · 12,5 g'].map(f.parse)
  assert.ok(results[0] === null && results.slice(1).every(parsed => parsed === null || parsed.grams === 12.5), JSON.stringify(results))
})
test('APP-TEST6 FUND6: ugyldige vaegtdatoer maa ikke give et klart estimat med NaN', () => {
  const result = f.energy(days(), weights('ugyldig-a', 'ugyldig-b'))
  assert.ok(!result.ready || (Number.isFinite(result.tdee) && Number.isFinite(result.daySpan)))
})
test('APP-TEST6 FUND7: direkte makrorettelse skal bruge samme afrunding som portioner', () => {
  const expected = f.portion({ ...food, kcal100: 12.9, protein100: 2.9 }, '100', { label: 'g', grams: 1 })
  const actual = f.edit({ meal: 'Uden gram' }, '', { kcal: '12.9', protein: '2.9', carb: '23', fat: '7' })
  assert.equal(actual.kcal, expected.kcal)
  assert.equal(actual.protein, expected.protein)
})
