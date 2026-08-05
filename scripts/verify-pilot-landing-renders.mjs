#!/usr/bin/env node
// Renderer forsiden med PRAECIS de props pilot-skallen giver den.
//
// Baggrund, 5. august 2026: SUB-FLAG blev taendt for at Mitch kunne teste om
// morgenen. Alle otte deploy-porte var groenne — men ingen af dem renderer en
// komponent. En runtime-fejl i Landing ville foerst vise sig som en hvid skaerm
// hos ham, og det er praecis den fejltype der ramte SubscriptionApp: build,
// tests, separation og lint var groenne om en komponent ingen kunne naa.
//
// Denne port kalder den kodesti flaget aabner, og fejler hvis den kaster.
//
//   npm run verify:pilot-landing
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import Landing from '../src/subscription/screens/Landing.jsx'
import Onboarding from '../src/subscription/screens/Onboarding.jsx'
import { PILOT_GUIDE, PILOT_LANDING, PILOT_PRICING } from '../src/subscription/featureFlags.js'
import { PRICE } from '../src/subscription/pricing.js'

const fejl = []
const proev = (navn, fn) => {
  try { fn(); console.log(`  OK  ${navn}`) }
  catch (e) { fejl.push(`${navn}: ${e.message}`); console.log(`  FEJL ${navn}`) }
}

// Props kopieret fra PilotSubscriptionApp.jsx. Driver de fra hinanden, tester
// denne fil noget andet end det Mitch faktisk moeder.
let forside = ''
proev('forsiden renderer med pilot-skallens props', () => {
  forside = renderToStaticMarkup(createElement(Landing, {
    indlejret: true,
    harProfil: true,
    entitlement: 'free',
    visPris: PILOT_PRICING,
    onStart: () => {},
  }))
  assert.ok(forside.length > 200, 'forsiden gav naesten ingen markup')
})

proev('forsiden har en knap Mitch kan trykke paa', () => {
  assert.match(forside, /<button/i, 'ingen knap — forsiden ville vaere en blindgyde')
})

// Kun det Mitch kan LAESE. Foerste udgave soegte i den raa markup og faldt over
// `width:100%` i en style-attribut — den meldte at prisen 100 stod paa siden,
// hvor der i virkeligheden stod "Medlemskab". Et pris-tjek der raaber falsk
// alarm bliver slaaet fra, og saa beskytter det ingenting.
const synligTekst = (html) => html
  .replace(/<style[\s\S]*?<\/style>/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#x27;/g, "'")
  .replace(/\s+/g, ' ')
  .trim()

proev('prisen staar ikke paa forsiden naar PILOT_PRICING er slukket', () => {
  // Marc, 5. august: Mitch er i et gratis forloeb; et beloeb ville stille noget
  // i udsigt der ikke kan koebes.
  if (PILOT_PRICING) return
  const tekst = synligTekst(forside)
  assert.ok(!new RegExp(`\\b${PRICE.amount}\\b`).test(tekst), `beloebet ${PRICE.amount} kunne laeses paa siden`)
  assert.ok(!/kr\.?\s*\/\s*md/i.test(tekst), 'en maanedspris kunne laeses paa siden')
  // Og soejlen skal stadig sige NOGET — en tom overskrift ville ogsaa bestaa ovenstaaende.
  assert.match(tekst, /Medlemskab/, 'medlems-soejlen mistede sin overskrift da prisen blev skjult')
})

proev('guiden renderer med pilot-skallens props', () => {
  const guide = renderToStaticMarkup(createElement(Onboarding, {
    springNavn: true,
    slutKnap: 'Tilbage til mit program',
    slutNote: 'Det her er kun et overblik. Dit nuværende program er uændret, og intet er gemt.',
    onCreate: () => {},
  }))
  assert.ok(guide.length > 200, 'guiden gav naesten ingen markup')
})

console.log('')
if (fejl.length) {
  console.log('FAIL pilot landing render:')
  for (const f of fejl) console.log('  ' + f)
  process.exit(1)
}
const taendte = [PILOT_LANDING && 'PILOT_LANDING', PILOT_GUIDE && 'PILOT_GUIDE'].filter(Boolean)
console.log(`PASS pilot landing render (${taendte.length ? taendte.join(' + ') + ' taendt' : 'flag slukkede — stien testet alligevel'})\n`)
