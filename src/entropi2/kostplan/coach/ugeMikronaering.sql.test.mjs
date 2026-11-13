// U10d (ordre 117): mikronæring for ugen fra Claude mod den live kostplan-pakke i PGlite, med
// U10a-scriptets egen SQL og Frida-rækker via fridaKobling. Kun den syntetiske testatlet.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PostgrestClient } from '@supabase/postgrest-js'
import { ATHLETES, PEOPLE, createRehearsalDb } from '../../../../scripts/generalproeve/proeveDb.mjs'
import { listenPgRest } from '../../../../e2e/pglite-postgrest.mjs'
import { skrivForslag } from '../../../../scripts/kostplan/skriv-forslag.mjs'
import { FRIDA_KOBLING } from '../../../../scripts/kostplan/fridaKobling.mjs'
import { FOODS } from '../foedevarer/catalog.mjs'
import { EXTENDED_COACH_FOODS } from '../foedevarer/frida55Extended.mjs'
import { plannedMicronutrientsView } from '../atlet/plannedMicronutrients.mjs'
import { plusDage, readClaudeWeek, sendClaudeWeek } from './claudeWeekModel.mjs'
import { claudeWeekView } from './ClaudeWeek.mjs'

const lokal = new Map(FOODS.map(food => [food.name, food.id]))
const frida = new Map(EXTENDED_COACH_FOODS.map(food => [food.id, food]))
// U10b's syntetiske dag. Med Frida koblet ligger alt undtagen knækbrød (132 kcal) på Frida-rækker.
const DAG = [
  ['Morgenmad', [['Havregryn', 90], ['Skyr naturel', 250], ['Banan', 120], ['Blåbær', 100]]],
  ['Frokost', [['Rugbrød', 150], ['Kyllingebryst', 125], ['Agurk', 100], ['Tomat', 100]]],
  ['Mellemmåltid', [['Skyr naturel', 200], ['Mandler', 25], ['Æble', 150]]],
  ['Aftensmad', [['Ris kogt', 400], ['Laks fersk', 175], ['Broccoli', 200], ['Olivenolie', 10]]],
  ['Aftensnack', [['Hytteost', 150], ['Knækbrød', 40]]],
]
const portion = (vare, grams, medFrida) => medFrida && FRIDA_KOBLING[vare]
  ? { foodId: FRIDA_KOBLING[vare], grams, dagligvare: vare } : { foodId: lokal.get(vare), grams }
const dag = medFrida => DAG.map(([name, items]) => ({ name, portions: items.map(([vare, g]) => portion(vare, g, medFrida)) }))
const kbh = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit' })
const today = kbh.format(new Date())
// Syntetisk: kvinde 28 år, så NNR 2023 giver jern 15 mg, D-vitamin 10 µg og calcium 950 mg.
const athlete = { id: ATHLETES.mine, kcal_target: 2800, protein_target: 180, sex: 'f', age: 28 }
const ugeplan = medFrida => ({ athleteId: ATHLETES.mine, goal: 'vedligehold', intensity: 0.5,
  rationale: 'Syntetisk testuge med Frida-rækker.', basisAsOf: today, targets: { kcal: 2800, protein: 180, as_of: today },
  days: Array.from({ length: 7 }, (_, i) => ({ date: plusDage(today, i), meals: dag(medFrida) })) })

async function scene(medFrida) {
  const rehearsal = await createRehearsalDb()
  await rehearsal.db.exec((await skrivForslag(ugeplan(medFrida))).sql)
  const server = await listenPgRest(rehearsal.rest, 0)
  const rest = new PostgrestClient(`${server.url}/rest/v1`, { schema: 'public',
    headers: { apikey: 'anon-proeve', Authorization: `Bearer tok-${PEOPLE.coach.id}` } })
  return { coach: { from: table => rest.from(table) }, close: async () => { await server.close(); await rehearsal.db.close() } }
}

// Forventet, regnet direkte fra katalogets Frida-rækker uden appens summering.
function forventet(nutrient) {
  let sum = 0
  for (const [, items] of DAG) for (const [vare, g] of items) {
    const v = FRIDA_KOBLING[vare] ? frida.get(FRIDA_KOBLING[vare]).nutrientsPer100g[nutrient] : null
    sum += v === null ? 0 : v * g / 100
  }
  return sum
}

test('kendt testuge med Frida-rækker giver jern, D-vitamin og calcium som 7-dages snit mod NNR 2023', { timeout: 60000 }, async () => {
  const s = await scene(true)
  try {
    const week = await readClaudeWeek({ client: s.coach, athlete, today })
    assert.equal(week.status, 'udkast')
    assert.equal(week.mikro.status, 'klar')
    const stof = n => week.mikro.stoffer.find(x => x.nutrient === n)
    assert.equal(stof('ironMg').snit.toFixed(1), '10.7')
    assert.equal(stof('ironMg').snit.toFixed(6), forventet('ironMg').toFixed(6))
    assert.equal(Math.round(stof('calciumMg').snit), 1026)
    assert.equal(stof('vitaminDUg').snit.toFixed(1), '14.3')
    assert.deepEqual(['ironMg', 'vitaminDUg', 'calciumMg'].map(n => stof(n).procent), [71, 143, 108])
    // Knækbrød er ikke koblet: 132 kcal af ca. 2.827 mangler data, dækningen er 95 %.
    assert.equal(Math.round(stof('ironMg').daekning * 100), 95)
    const html = renderToStaticMarkup(claudeWeekView(week))
    assert.match(html, /Mikronæring, 7-dages snit: Jern 71 % · D-vitamin 143 % · Calcium 108 %/)
    assert.match(html, /Jern 10,7 mg om dagen · 71 % af 15 mg/)
    // Linjen står under ugens dage og før send-knappen.
    assert.ok(html.indexOf('data-uge-mikro') > html.lastIndexOf('data-day='))
    assert.ok(html.indexOf('data-uge-mikro') < html.indexOf('Send uge til atleten'))
    // Efter "Send uge" står tallene stadig, fra de sendte versioner.
    const { sent } = await sendClaudeWeek({ client: s.coach, athlete, today, shown: week })
    assert.equal(sent.mikro.stoffer.find(x => x.nutrient === 'ironMg').procent, 71)
  } finally { await s.close() }
})

test('en uge kun med lokale varer uden mikrotal giver "ukendt" og ingen procent', { timeout: 60000 }, async () => {
  const s = await scene(false)
  try {
    const week = await readClaudeWeek({ client: s.coach, athlete, today })
    assert.ok(week.mikro.stoffer.every(x => x.snit === null && x.procent === null))
    assert.match(renderToStaticMarkup(claudeWeekView(week)), /Mikronæring, 7-dages snit: Jern ukendt · D-vitamin ukendt · Calcium ukendt/)
  } finally { await s.close() }
})

test('ingen alarmfarve hos atleten: atletens moduler viser ikke ugens linje, og atletens mineralfold er uden farve', () => {
  const dir = new URL('../atlet/', import.meta.url)
  for (const name of readdirSync(dir).filter(n => n.endsWith('.mjs') && !n.includes('.test.')))
    assert.doesNotMatch(readFileSync(new URL(name, dir), 'utf8'), /ugeMikronaering|UgeMikronaering/i, name)
  const html = renderToStaticMarkup(plannedMicronutrientsView(h, [{ nutrient: 'ironMg', label: 'Jern', unit: 'mg', value: 1 }]))
  assert.doesNotMatch(html, /color|background|role="alert"|lavt|byt en ret/i)
})
