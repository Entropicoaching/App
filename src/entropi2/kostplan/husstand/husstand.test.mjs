import test from 'node:test'
import assert from 'node:assert/strict'
import { tjekMaaltid, DANSKE_DAGLIGVARER } from '../realisme.mjs'
import { FOODS } from '../foedevarer/index.mjs'
import { MORGENMAD, FROKOST, FOER_TRAENING, AFTENSNACK, AFTENSMAD, HUSSTAND_OPSKRIFTER } from './opskrifter.mjs'
import { bygPlan, gentagneAftensmaaltider, SLOTS, portion } from './plan.mjs'
import { bygIndkoeb, PAKNINGER, vareNoegle } from './indkoeb.mjs'
import { lavMenu14, AFTEN_14 } from './menu.mjs'
import { STYRKE_ANBEFALINGER, drikkeForslag } from './anbefalinger.mjs'
import { proteinForslag } from '../anbefalinger.mjs'

// Syntetiske løftere; ingen rigtige atletdata.
const ford = { morgenmad: [0.24, 0.20], frokost: [0.22, 0.22], 'foer-traening': [0.14, 0.14], aftensmad: [0.28, 0.24], aftensnack: [0.12, 0.20] }
const STOR = { id: 'a', kcal: { traening: 3300, hvile: 2950 }, protein: 195, fedtMinG: 66, dagtype: d => d.ugedag === 'Søndag' ? 'hvile' : 'traening', fordeling: () => ford }
const LILLE = { id: 'b', kcal: { traening: 2200, hvile: 2000 }, protein: 140, fedtMinG: 50, dagtype: d => d.ugedag === 'Søndag' ? 'hvile' : 'traening', fordeling: () => ford }
const MENU = lavMenu14(new Date(Date.UTC(2030, 0, 7)))
const PLAN = bygPlan(MENU, [STOR, LILLE])
const byId = new Map(FOODS.map(food => [food.id, food]))

test('14 forskellige aftensmåltider fra mindst 5 køkkener, og ingen gentages', () => {
  assert.equal(AFTENSMAD.length, 14)
  assert.equal(new Set(AFTEN_14).size, 14)
  assert.deepEqual(gentagneAftensmaaltider(MENU), [])
  assert.ok(new Set(AFTENSMAD.map(r => r.koekken)).size >= 5)
})

test('mindst 3 varianter af morgenmad, frokost og mellemmåltider; hverdagsaftensmad højst 30 minutter', () => {
  for (const list of [MORGENMAD, FROKOST, FOER_TRAENING, AFTENSNACK]) assert.ok(list.length >= 3)
  for (const dag of MENU) if (!['Lørdag', 'Søndag'].includes(dag.ugedag)) {
    assert.ok(AFTENSMAD.find(r => r.id === dag.menu.aftensmad).minutter <= 30, dag.menu.aftensmad)
  }
  for (const r of FROKOST) assert.equal(r.madpakke, true)
  for (const r of AFTENSMAD) assert.ok(r.holdbarDage >= 2, r.id)
})

test('alle opskrifter i grundmængde og alle planlagte portioner består realismeprøven', () => {
  for (const r of HUSSTAND_OPSKRIFTER) assert.deepEqual(tjekMaaltid({ items: r.ingredients }).problemer, [], r.id)
  for (const dag of PLAN) for (const p of Object.values(dag.personer)) for (const slot of SLOTS) {
    const m = p.maaltider[slot]
    const result = tjekMaaltid({ items: m.items, declared: m.totals })
    assert.deepEqual(result.problemer, [], `${dag.dato} ${slot} ${m.recipeId}`)
  }
})

test('hver dag rammer energi inden for 5 %, protein inden for -5/+10 % og fedtgulvet', () => {
  for (const dag of PLAN) for (const [id, p] of Object.entries(dag.personer)) {
    assert.ok(p.ok, `${dag.dato} ${id} ${JSON.stringify(p.afvigelse)} fedt ${p.total.fat}`)
  }
})

test('protein fordeles på mindst 4 måltider med mindst 0,25 g/kg-niveau (20 g) hver', () => {
  for (const dag of PLAN) for (const p of Object.values(dag.personer)) {
    const med = SLOTS.filter(slot => p.maaltider[slot].totals.protein >= 20)
    assert.ok(med.length >= 4, dag.dato)
  }
})

test('indkøbslisten dækker hver gram i hver portion, og alle varer har pakning og afdeling', () => {
  for (const uge of [1, 2]) {
    const dage = PLAN.filter(d => d.uge === uge)
    const liste = bygIndkoeb(dage)
    const behov = new Map()
    for (const dag of dage) for (const p of Object.values(dag.personer)) for (const slot of SLOTS) for (const item of p.maaltider[slot].items) {
      behov.set(vareNoegle(item), (behov.get(vareNoegle(item)) ?? 0) + item.grams)
    }
    for (const [key, gram] of behov) {
      const row = liste.find(r => r.key === key)
      assert.ok(row, key)
      assert.ok(row.daekketGram + 1e-6 >= gram, key)
      assert.ok(row.afdeling && row.afdeling !== 'Øvrige', key)
    }
  }
  for (const r of HUSSTAND_OPSKRIFTER) for (const item of r.ingredients) assert.ok(PAKNINGER[vareNoegle(item)], vareNoegle(item))
})

test('portionen skaleres op for en stor løfter uden at forlade portionsgrænserne', () => {
  const r = AFTENSMAD[0]
  const stor = portion(r, { kcal: 1000, protein: 50 })
  assert.deepEqual(stor.problemer, [])
  for (const item of stor.items) {
    const g = DANSKE_DAGLIGVARER[byId.get(item.foodId).name]
    assert.ok(item.grams >= g.minGram && item.grams <= g.maxGram)
  }
  assert.ok(Math.abs(stor.totals.kcal - 1000) / 1000 < 0.05)
})

test('anbefalingerne har kilde ved hvert tal og passer i appens format', () => {
  const a = STYRKE_ANBEFALINGER
  for (const key of ['protein', 'proteinPrMaaltid', 'proteinFoerSoevn', 'fedt', 'kulhydrat', 'vaeske']) assert.match(a[key].kilde, /doi:10\./)
  assert.match(a.energi.bulk.kilde, /doi:10\.3390\/sports7070154/)
  assert.deepEqual(proteinForslag(90, a), { minG: 144, maxG: 198, kilde: a.protein.kilde })
  assert.equal(drikkeForslag({ koen: 'mand', traeningstimer: 1.5 }).ml, 2800)
  assert.equal(drikkeForslag({ koen: 'kvinde' }).ml, 1600)
  assert.equal(drikkeForslag({}), null)
})
