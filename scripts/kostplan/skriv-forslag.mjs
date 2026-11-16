#!/usr/bin/env node
// U10a: node scripts/kostplan/skriv-forslag.mjs <ugeplan.json> [--ud forslag.sql] [--send]
// Laver kun SQL-tekst med 7 kostplan-forslag (plans + versions, version 1).
// Scriptet forbinder sig ikke til nogen database. Uden --send skriver det aldrig en godkendelse;
// --send (ordre 1537a) bruges kun efter coachens ja i chatten og sender ugen som "Send uge".
// Før teksten skrives, kører realismeprøven, kontrakten, 5 %-grænsen og databasens
// egen kostplan_v1_valid_meals i en lokal PGlite.
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { ForslagFejl, lavForslagSql } from './forslag.mjs'
import { husstandTilUgeplan } from './husstand.mjs'
import { sqlAfviserMeals } from './validMealsSql.mjs'

export async function skrivForslag(ugeplan, options = {}) {
  const result = lavForslagSql(ugeplan, options)
  const afvist = await sqlAfviserMeals(result.plan.days, options)
  if (afvist.length) throw new ForslagFejl(`kostplan_v1_valid_meals afviser måltiderne for ${afvist.join(', ')}.`)
  if (!options.send && /kostplan_v1_approvals/i.test(result.sql)) throw new ForslagFejl('SQL-teksten må ikke røre godkendelser.')
  return result
}

// Fra husstandsplanen: <felter.json> --husstand PLAN-DATA.json --person <nøgle> --fra ÅÅÅÅ-MM-DD,
// hvor felter.json har alt i ugeplanen undtagen days.
async function main(argv) {
  const flag = name => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined }
  const values = new Set(['--ud', '--husstand', '--person', '--fra'].map(name => argv.indexOf(name) + 1).filter(i => i > 0))
  const file = argv.find((arg, i) => !arg.startsWith('--') && !values.has(i))
  if (!file) throw new ForslagFejl('Brug: node scripts/kostplan/skriv-forslag.mjs <ugeplan.json> [--ud forslag.sql] [--send] [--husstand PLAN-DATA.json --person <nøgle> --fra <dato>]')
  const send = argv.includes('--send')
  const read = path => JSON.parse(readFileSync(path, 'utf8'))
  const ugeplan = flag('--husstand')
    ? husstandTilUgeplan(read(flag('--husstand')), { ...read(file), person: flag('--person'), fra: flag('--fra') })
    : read(file)
  const { sql, plan } = await skrivForslag(ugeplan, { send })
  const ud = flag('--ud')
  if (ud) writeFileSync(ud, sql)
  else process.stdout.write(sql)
  const linjer = plan.days.map(d => `${d.date}: ${Math.round(d.kcal)} kcal, ${Math.round(d.protein)} g protein`)
  process.stderr.write(`7 ${send ? 'dage klar til at sende' : 'forslag klar'} (mål ${plan.targets.kcal} kcal, ${plan.targets.protein} g protein).\n${linjer.join('\n')}\n`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).catch(error => {
    process.stderr.write(`Stop: ${error.message}\n`)
    process.exitCode = 1
  })
}
