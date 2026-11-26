#!/usr/bin/env node
// Ordre 1537a: node scripts/kostplan/lav-uge.mjs <uge-ind.json> --ud ugeplan.json
// Bygger en ugeplan til skriv-forslag.mjs med generatoren (samme mønster som u10e-toer.test.mjs)
// og skriver ugen som læsbar tekst til chatten. Med --fri <0 til 30> viser teksten også de skalerede gram, atleten ser (2385). Ingen database, nøgler eller net.
// uge-ind.json: { athleteId, goal, intensity, rationale, basisAsOf, calculationBasis?,
//   targets: { kcal, protein, as_of }, carb, fat, start: 'ÅÅÅÅ-MM-DD',
//   dagtyper: [[{ name, items: ['Havregryn', ...] }, ...], ...] }  (dag i bruger dagtyper[i % antal])
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { generateGramPlan } from '../../src/entropi2/kostplan/generator/index.mjs'
import { DANSKE_DAGLIGVARER, MAKRO_TOLERANCE } from '../../src/entropi2/kostplan/realisme.mjs'
import { FOODS } from '../../src/entropi2/kostplan/foedevarer/index.mjs'
import { skalerMaaltider, fordelDag } from '../../src/entropi2/kostplan/friPulje.mjs'
import { ForslagFejl, friProcent, tjekUgeplan } from './forslag.mjs'

const stop = message => { throw new ForslagFejl(message) }
const plusDage = (value, n) => new Date(Date.parse(value + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10)
const foodBy = new Map(FOODS.map(f => [f.id, f]))
const navnPaa = foodId => decodeURIComponent(foodId.replace(/^local:/, ''))

// Lofter, så atleten kan spise måltidet (2378): højst 300 g pr. vare (drikke 500 g), 15 g olie og 450 g pr. måltid.
export const MAX_VARE_GRAM = 300
export const MAX_DRIKKE_GRAM = 500
export const MAX_OLIE_GRAM = 15
export const MAX_MAALTID_GRAM = 450
const erDrikke = name => /mælk/i.test(name)
const erOlie = name => /olie/i.test(name)

function vare(name, sted) {
  const v = DANSKE_DAGLIGVARER[name]
  if (!v) stop(`${sted}: ${name} findes ikke blandt appens dagligvarer.`)
  const loft = erOlie(name) ? MAX_OLIE_GRAM : erDrikke(name) ? MAX_DRIKKE_GRAM : MAX_VARE_GRAM
  const minGrams = Math.max(5, Math.ceil(v.minGram / 5) * 5)
  const maxGrams = Math.max(minGrams, Math.floor(Math.min(v.maxGram, loft) / 5) * 5)
  return { foodId: 'local:' + encodeURIComponent(name), minGrams, maxGrams }
}

// Fordel måltidets loft jævnt: ingen vare får mere end niveauet, før alle andre har fået deres del.
function begraensMaaltid(items, sted) {
  const sumMin = items.reduce((s, i) => s + i.minGrams, 0)
  if (sumMin > MAX_MAALTID_GRAM) stop(`${sted}: mindstemængderne giver ${sumMin} g, over loftet på ${MAX_MAALTID_GRAM} g pr. måltid. Fjern en vare fra måltidet.`)
  if (items.reduce((s, i) => s + i.maxGrams, 0) <= MAX_MAALTID_GRAM) return items
  let niveau = MAX_MAALTID_GRAM
  const sum = n => items.reduce((s, i) => s + Math.max(i.minGrams, Math.min(i.maxGrams, Math.floor(n / 5) * 5)), 0)
  while (niveau > 5 && sum(niveau) > MAX_MAALTID_GRAM) niveau -= 5
  return items.map(i => ({ ...i, maxGrams: Math.max(i.minGrams, Math.min(i.maxGrams, Math.floor(niveau / 5) * 5)) }))
}


// Når lofterne gør, at dagen ikke kan nå kcal og protein inden for 5 %, siges det højt (ikke stille overskridelse).
function tjekDagMod(date, meals, plan, maal) {
  const sum = key => plan.meals.reduce((s, m) => s + m.items.reduce((t, i) => t + i.grams * (foodBy.get(i.foodId)?.nutrientsPer100g?.[key] ?? 0) / 100, 0), 0)
  const mangler = []
  for (const [navn, key, mal] of [['kcal', 'energyKcal', maal.kcal], ['protein', 'proteinG', maal.protein]]) {
    const faktisk = sum(key)
    if (Math.abs(faktisk - mal) > mal * MAKRO_TOLERANCE.procent / 100) mangler.push(`${Math.round(faktisk)} af ${mal} ${navn === 'kcal' ? 'kcal' : 'g protein'}`)
  }
  if (!mangler.length) return
  const fyldt = plan.meals.map((m, j) => ({ navn: m.name, fyldt: m.items.every((i, k) => i.grams >= meals[j].items[k].maxGrams) })).filter(m => m.fyldt).map(m => m.navn)
  // 2392: kcal-hullet fordelt på de fyldte måltider (ellers alle), rundet til 5 kcal, så Claude kan se, hvor meget en tæt vare skal give.
  const hul = maal.kcal - sum('energyKcal'), antal = fyldt.length || plan.meals.length
  const pr = hul > 0 ? ` (ca. ${Math.max(5, Math.round(hul / antal / 5) * 5)} kcal)` : ''
  stop(`${date}: dagen når kun ${mangler.join(' og ')} med lofterne (højst ${MAX_VARE_GRAM} g pr. vare, ${MAX_OLIE_GRAM} g olie og ${MAX_MAALTID_GRAM} g pr. måltid). ` +
    (fyldt.length ? `Måltid der mangler en tættere vare (fx nødder, olie, mejeri, kød): ${fyldt.map(n => n + pr).join(', ')}.` : `Tilføj en energi- eller proteintæt vare til et måltid${pr ? ' (ca. ' + Math.max(5, Math.round(hul / antal / 5) * 5) + ' kcal pr. måltid)' : ''}.`))
}

// Ordre 2385: med --fri skalerer atletens Kost i dag måltiderne til basen (skalerMaaltider, afrundet til 5 g).
// Udskriften viser både de byggede og de skalerede gram, så Marc godkender de tal, atleten ser.
function skalerDag(day, fri) {
  const meals = day.meals.map((m, j) => ({ id: 'm' + j, name: m.name, foods: m.portions.map(p => {
    const n = foodBy.get(p.foodId).nutrientsPer100g
    return { id: p.foodId, name: navnPaa(p.foodId), grams: p.grams, kcal100: n.energyKcal, protein100: n.proteinG }
  }) }))
  const skaleret = skalerMaaltider(meals, fri).meals
  const sum = (list, key) => Math.round(list.reduce((s, m) => s + m.foods.reduce((t, f) => t + f[key] * f.grams / 100, 0), 0))
  return { meals: skaleret, dag: { kcal: sum(meals, 'kcal100'), protein: sum(meals, 'protein100') }, base: { kcal: sum(skaleret, 'kcal100'), protein: sum(skaleret, 'protein100') } }
}

export function lavUge(ind, { fri = 0 } = {}) {
  const { dagtyper, start, carb, fat, ...felter } = ind ?? {}
  if (!Array.isArray(dagtyper) || !dagtyper.length || dagtyper.some(d => !Array.isArray(d))) stop('dagtyper skal være en liste af dage med måltider.')
  if (!(carb >= 0) || !(fat >= 0)) stop('carb og fat skal være tal i gram.')
  const maal = { kcal: felter.targets?.kcal, protein: felter.targets?.protein, carb, fat }
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = plusDage(start, i)
    const type = dagtyper[i % dagtyper.length]
    const meals = type.map((m, j) => ({ id: 'm' + j, name: m.name, items: begraensMaaltid(m.items.map(n => vare(n, `${date}, ${m.name}`)), `${date}, ${m.name}`) }))
    const plan = generateGramPlan({ targets: maal, mealCount: meals.length, meals })
    if (!plan.meals?.length) stop(`${date}: generatoren gav ingen gramplan (${plan.message ?? plan.status}).`)
    tjekDagMod(date, meals, plan, maal)
    return { date, meals: plan.meals.map(m => ({ name: m.name,
      portions: m.items.map(item => ({ foodId: item.foodId, grams: item.grams })) })) }
  })
  const ugeplan = { ...felter, days }
  // Samme prøver som skriv-forslag: realisme, kontrakt og 5 %-grænsen.
  const tjekket = tjekUgeplan(ugeplan)
  const pct = friProcent(fri)
  const tekst = tjekket.days.map((d, i) => {
    if (!pct) return [`${d.date}: ${Math.round(d.kcal)} kcal, ${Math.round(d.protein)} g protein`,
      ...days[i].meals.map(m => `  ${m.name}: ${m.portions.map(p => `${navnPaa(p.foodId)} ${p.grams} g`).join(', ')}`)].join('\n')
    const s = skalerDag(days[i], pct)
    return [`${d.date}: basen ${s.base.kcal} kcal, ${s.base.protein} g protein; hele dagen ${s.dag.kcal} kcal, ${s.dag.protein} g protein (fri pulje ${pct} %, ${fordelDag({ kcal: s.dag.kcal, protein: s.dag.protein }, pct).friKcal} kcal)`,
      ...s.meals.map((m, j) => `  ${m.name}: ${m.foods.map((f, k) => `${f.name} ${days[i].meals[j].portions[k].grams} g, atleten får ${f.grams} g`).join('; ')}`)].join('\n')
  }).join('\n')
  return { ugeplan, tekst }
}

async function main(argv) {
  const file = argv.find((arg, i) => !arg.startsWith('--') && argv[i - 1] !== '--ud' && argv[i - 1] !== '--fri')
  const ud = argv[argv.indexOf('--ud') + 1]
  const fri = argv.includes('--fri') ? friProcent(argv[argv.indexOf('--fri') + 1]) : 0
  if (!file || !argv.includes('--ud') || !ud) stop('Brug: node scripts/kostplan/lav-uge.mjs <uge-ind.json> --ud ugeplan.json [--fri <0 til 30>]')
  const { ugeplan, tekst } = lavUge(JSON.parse(readFileSync(file, 'utf8')), { fri })
  writeFileSync(ud, JSON.stringify(ugeplan, null, 1))
  process.stdout.write(tekst + '\n')
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).catch(error => {
    process.stderr.write(`Stop: ${error.message}\n`)
    process.exitCode = 1
  })
}
