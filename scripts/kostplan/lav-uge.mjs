#!/usr/bin/env node
// Ordre 1537a: node scripts/kostplan/lav-uge.mjs <uge-ind.json> --ud ugeplan.json
// Bygger en ugeplan til skriv-forslag.mjs med generatoren (samme mønster som u10e-toer.test.mjs)
// og skriver ugen som læsbar tekst til chatten. Ingen database, nøgler eller net.
// uge-ind.json: { athleteId, goal, intensity, rationale, basisAsOf, calculationBasis?,
//   targets: { kcal, protein, as_of }, carb, fat, start: 'ÅÅÅÅ-MM-DD',
//   dagtyper: [[{ name, items: ['Havregryn', ...] }, ...], ...] }  (dag i bruger dagtyper[i % antal])
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { generateGramPlan } from '../../src/entropi2/kostplan/generator/index.mjs'
import { DANSKE_DAGLIGVARER } from '../../src/entropi2/kostplan/realisme.mjs'
import { ForslagFejl, tjekUgeplan } from './forslag.mjs'

const stop = message => { throw new ForslagFejl(message) }
const plusDage = (value, n) => new Date(Date.parse(value + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10)
const navnPaa = foodId => decodeURIComponent(foodId.replace(/^local:/, ''))

function vare(name, sted) {
  const v = DANSKE_DAGLIGVARER[name]
  if (!v) stop(`${sted}: ${name} findes ikke blandt appens dagligvarer.`)
  return { foodId: 'local:' + encodeURIComponent(name),
    minGrams: Math.max(5, Math.ceil(v.minGram / 5) * 5), maxGrams: Math.floor(v.maxGram / 5) * 5 }
}

export function lavUge(ind) {
  const { dagtyper, start, carb, fat, ...felter } = ind ?? {}
  if (!Array.isArray(dagtyper) || !dagtyper.length || dagtyper.some(d => !Array.isArray(d))) stop('dagtyper skal være en liste af dage med måltider.')
  if (!(carb >= 0) || !(fat >= 0)) stop('carb og fat skal være tal i gram.')
  const maal = { kcal: felter.targets?.kcal, protein: felter.targets?.protein, carb, fat }
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = plusDage(start, i)
    const type = dagtyper[i % dagtyper.length]
    const meals = type.map((m, j) => ({ id: 'm' + j, name: m.name, items: m.items.map(n => vare(n, `${date}, ${m.name}`)) }))
    const plan = generateGramPlan({ targets: maal, mealCount: meals.length, meals })
    if (!plan.meals?.length) stop(`${date}: generatoren gav ingen gramplan (${plan.message ?? plan.status}).`)
    return { date, meals: plan.meals.map(m => ({ name: m.name,
      portions: m.items.map(item => ({ foodId: item.foodId, grams: item.grams })) })) }
  })
  const ugeplan = { ...felter, days }
  // Samme prøver som skriv-forslag: realisme, kontrakt og 5 %-grænsen.
  const tjekket = tjekUgeplan(ugeplan)
  const tekst = tjekket.days.map((d, i) => [`${d.date}: ${Math.round(d.kcal)} kcal, ${Math.round(d.protein)} g protein`,
    ...days[i].meals.map(m => `  ${m.name}: ${m.portions.map(p => `${navnPaa(p.foodId)} ${p.grams} g`).join(', ')}`)].join('\n')).join('\n')
  return { ugeplan, tekst }
}

async function main(argv) {
  const file = argv.find((arg, i) => !arg.startsWith('--') && argv[i - 1] !== '--ud')
  const ud = argv[argv.indexOf('--ud') + 1]
  if (!file || !argv.includes('--ud') || !ud) stop('Brug: node scripts/kostplan/lav-uge.mjs <uge-ind.json> --ud ugeplan.json')
  const { ugeplan, tekst } = lavUge(JSON.parse(readFileSync(file, 'utf8')))
  writeFileSync(ud, JSON.stringify(ugeplan, null, 1))
  process.stdout.write(tekst + '\n')
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).catch(error => {
    process.stderr.write(`Stop: ${error.message}\n`)
    process.exitCode = 1
  })
}
