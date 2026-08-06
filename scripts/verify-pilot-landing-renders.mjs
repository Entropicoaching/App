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
import PilotProfile from '../src/subscription/screens/PilotProfile.jsx'
import { PILOT_GUIDE, PILOT_LANDING, PILOT_PRICING, PILOT_PROFIL } from '../src/subscription/featureFlags.js'
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

// Profilsiden med Mitchs FAKTISKE data fra shadow-databasen 6. august. Bruges
// fordi et tomt objekt ville rendere fint og alligevel skjule at siden ikke kan
// laese den form data rent faktisk har.
const mitch = {
  level: 'oevet',
  days_per_week: 3,
  equipment: 'gym',
  goal: 'powerlifting-foundation',
  squat_style: 'low-bar',
  deadlift_style: 'conventional',
  baselines: {
    squat: { weightKg: 130, reps: 1, rpe: 10, inputType: 'one_rm' },
    bench: { weightKg: 100, reps: 1, rpe: 10, inputType: 'one_rm' },
    deadlift: { weightKg: 165, reps: 1, rpe: 10, inputType: 'one_rm' },
  },
}

let profil = ''
proev('profilsiden renderer med en rigtig medlemsprofil', () => {
  profil = renderToStaticMarkup(createElement(PilotProfile, {
    member: mitch,
    program: { name: 'Styrkeløft 3 · Øvet · Full Gym · low-bar · conventional' },
    sessions: [],
    onLogout: () => {},
  }))
  assert.ok(profil.length > 200, 'profilsiden gav naesten ingen markup')
})

proev('profilsiden viser de tal vaegtene regnes ud fra', () => {
  const tekst = synligTekst(profil)
  for (const forventet of ['130 kg', '100 kg', '165 kg', 'Low-bar squat', 'Konventionel dødløft', 'Øvet', 'Full Gym']) {
    assert.ok(tekst.includes(forventet), `profilsiden mangler "${forventet}"`)
  }
})

proev('profilsiden taaler en profil uden baselines', () => {
  // En inviteret bruger der endnu ikke har gennemfoert setup. Uden dette ville
  // siden kaste og give hvid skaerm praecis for den nye bruger.
  const tom = renderToStaticMarkup(createElement(PilotProfile, {
    member: { level: null, baselines: null }, program: null, sessions: [], onLogout: () => {},
  }))
  assert.match(synligTekst(tom), /ikke angivet dine løft/i)
})

proev('profilsiden lover ikke at man kan rette tallene', () => {
  // Man kan ikke, og siden skal sige det aerligt frem for at lade som om.
  assert.match(synligTekst(profil), /kan ikke ændres her/i)
})

console.log('')
if (fejl.length) {
  console.log('FAIL pilot landing render:')
  for (const f of fejl) console.log('  ' + f)
  process.exit(1)
}
const taendte = [PILOT_LANDING && 'PILOT_LANDING', PILOT_GUIDE && 'PILOT_GUIDE', PILOT_PROFIL && 'PILOT_PROFIL'].filter(Boolean)
console.log(`PASS pilot landing render (${taendte.length ? taendte.join(' + ') + ' taendt' : 'flag slukkede — stien testet alligevel'})\n`)
