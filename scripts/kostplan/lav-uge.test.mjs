// Ordre 2378: generatoren laver portioner, man kan spise (2362 stop 7). Lofter pr. vare, pr. måltid og for olie.
import test from 'node:test'
import assert from 'node:assert/strict'
import { FOODS } from '../../src/entropi2/kostplan/foedevarer/index.mjs'
import { lavUge } from './lav-uge.mjs'
import { skalerMaaltider } from '../../src/entropi2/kostplan/friPulje.mjs'
import { skrivForslag } from './skriv-forslag.mjs'

const byId = new Map(FOODS.map(food => [food.id, food]))
const navn = id => decodeURIComponent(id.replace(/^local:/, ''))
const type1 = [{ name: 'Morgenmad', items: ['Havregryn', 'Skyr naturel', 'Banan', 'Blåbær'] }, { name: 'Frokost', items: ['Rugbrød', 'Kyllingebryst', 'Agurk', 'Tomat'] },
  { name: 'Mellemmåltid', items: ['Skyr naturel', 'Mandler', 'Æble'] }, { name: 'Aftensmad', items: ['Ris kogt', 'Laks fersk', 'Broccoli', 'Olivenolie'] },
  { name: 'Aftensnack', items: ['Hytteost', 'Knækbrød'] }]
const type2 = [{ name: 'Morgenmad', items: ['Æg helt', 'Rugbrød', 'Ost 30+', 'Æble'] }, { name: 'Frokost', items: ['Kartofler kogte', 'Laks fersk', 'Broccoli', 'Rapsolie'] },
  { name: 'Mellemmåltid', items: ['Hytteost', 'Banan', 'Valnødder'] }, { name: 'Aftensmad', items: ['Ris kogt', 'Kyllingebryst', 'Tomat', 'Olivenolie'] },
  { name: 'Aftensnack', items: ['Skyr naturel', 'Knækbrød'] }]
const ind = (kcal = 2600, patch = {}) => ({ athleteId: '33333333-3333-4333-8333-333333333333', goal: 'vedligehold', intensity: 0.5,
  rationale: 'Syntetisk kostklient.', basisAsOf: '2026-11-25', targets: { kcal, protein: 160, as_of: '2026-11-25' },
  carb: 300, fat: 75, start: '2026-12-01', dagtyper: [type1, type2], ...patch })

test('2362 stop 7: ingen måltid over 450 g, ingen vare over 300 g, højst 15 g olie pr. måltid', () => {
  const { ugeplan } = lavUge(ind())
  assert.equal(ugeplan.days.length, 7)
  for (const day of ugeplan.days) {
    let kcal = 0, protein = 0
    for (const meal of day.meals) {
      assert.ok(meal.portions.reduce((s, p) => s + p.grams, 0) <= 450, `${day.date} ${meal.name} over 450 g`)
      assert.ok(meal.portions.filter(p => /olie/i.test(navn(p.foodId))).reduce((s, p) => s + p.grams, 0) <= 15, `${day.date} ${meal.name} olie over 15 g`)
      for (const p of meal.portions) {
        assert.ok(p.grams <= 300, `${day.date} ${navn(p.foodId)} ${p.grams} g`)
        assert.equal(p.grams % 5, 0)
        kcal += p.grams * byId.get(p.foodId).nutrientsPer100g.energyKcal / 100
        protein += p.grams * byId.get(p.foodId).nutrientsPer100g.proteinG / 100
      }
    }
    assert.ok(Math.abs(kcal - 2600) <= 130, `${day.date} ${Math.round(kcal)} kcal`)
    assert.ok(Math.abs(protein - 160) <= 8, `${day.date} ${Math.round(protein)} g protein`)
  }
})

test('kan dagen ikke nå målet med lofterne, stopper lav-uge på dansk og nævner måltiderne', () => {
  assert.throws(() => lavUge(ind(3800)), /dagen når kun .* med lofterne.*Måltid der mangler en tættere vare/s)
})

test('et måltid med for mange varer til loftet stopper med besked', () => {
  const stort = [{ name: 'Alt', items: ['Havregryn', 'Skyr naturel', 'Banan', 'Blåbær', 'Rugbrød', 'Kyllingebryst', 'Ris kogt', 'Laks fersk', 'Kartofler kogte'] }]
  assert.throws(() => lavUge(ind(2600, { dagtyper: [stort] })), /over loftet på 450 g pr\. måltid/)
})

test('ugen med lofter giver kompakt SQL med --fri 15, og databasens valid_meals godkender den', { timeout: 60000 }, async () => {
  const { ugeplan } = lavUge(ind())
  const { sql } = await skrivForslag(ugeplan, { send: false, fri: 15 })
  assert.ok(sql.length < 20000)
  assert.match(sql, /"fri_pct":\s*15/)
})

// Ordre 2385: Marc ser de gram, atleten ser. Med --fri skalerer udskriften med samme skalerMaaltider som Kost i dag.
const gramLinjer = tekst => tekst.split('\n').filter(l => l.startsWith('  ')).map(l => l.trim())

test('2385: uden fri vises kun de byggede gram', () => {
  const { tekst } = lavUge(ind())
  assert.doesNotMatch(tekst, /atleten får/)
  assert.match(tekst, /Havregryn \d+ g/)
})

test('2385: med fri 15 viser udskriften byggede og skalerede gram, samme tal som skalerMaaltider', () => {
  const { ugeplan, tekst } = lavUge(ind(), { fri: 15 })
  const dag = ugeplan.days[0]
  const meals = dag.meals.map((m, j) => ({ id: 'm' + j, name: m.name, foods: m.portions.map(p => {
    const n = byId.get(p.foodId).nutrientsPer100g
    return { id: p.foodId, name: navn(p.foodId), grams: p.grams, kcal100: n.energyKcal, protein100: n.proteinG, carb100: n.carbohydrateG, fat100: n.fatG }
  }) }))
  const skaleret = skalerMaaltider(meals, 15)
  const linjer = tekst.split('\n')
  const start = linjer.findIndex(l => l.startsWith(dag.date))
  const dagTekst = linjer.slice(start + 1, linjer.findIndex((l, i) => i > start && /^\d{4}-/.test(l)) === -1 ? undefined : linjer.findIndex((l, i) => i > start && /^\d{4}-/.test(l))).join('\n')
  meals.forEach((m, j) => m.foods.forEach((f, k) => {
    const s = skaleret.meals[j].foods[k]
    assert.ok(dagTekst.includes(`${f.name} ${f.grams} g, atleten får ${s.grams} g`), `${m.name}: ${f.name} ${f.grams} g -> ${s.grams} g mangler`)
  }))
  assert.ok(gramLinjer(tekst).some(l => /Havregryn \d+ g, atleten får \d+ g/.test(l)))
  assert.match(linjer[start], /basen \d+ kcal, \d+ g protein; hele dagen \d+ kcal, \d+ g protein/)
})
