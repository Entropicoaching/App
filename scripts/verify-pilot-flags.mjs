// Port: intet pilot-flag må være tændt ved et uheld.
//
// CT-033: det nye bygges ind hos Mitch bag flag der er SLUKKET ved deploy.
// Hele værdien af den metode hviler på at flagene faktisk ER slukkede når
// koden sendes ud — ellers ændrer hans oplevelse sig uden at nogen har kigget.
//
// Kør den før ethvert deploy:
//   node scripts/verify-pilot-flags.mjs
//
// Skal et flag tændes, er det en bevidst handling af Marc: sæt det i
// featureFlags.js OG opdatér den forventede liste herunder i samme commit.
// To steder med vilje — så et tændt flag aldrig kan smutte igennem som en
// sidegevinst ved en anden ændring.

import { FLAGS, enabledFlags } from '../src/subscription/featureFlags.js'

// Flag som Marc bevidst har tændt. Tom = alt er slukket, som ved første deploy.
const GODKENDT_TAENDT = []

const taendt = enabledFlags()
const uventet = taendt.filter(f => !GODKENDT_TAENDT.includes(f))
const manglende = GODKENDT_TAENDT.filter(f => !taendt.includes(f))

console.log('\nPILOT-FLAG\n')
for (const [navn, vaerdi] of Object.entries(FLAGS)) {
  const maerkat = vaerdi ? 'TAENDT' : 'slukket'
  const ok = vaerdi === GODKENDT_TAENDT.includes(navn)
  console.log(`  ${navn.padEnd(16)} ${maerkat.padEnd(9)}${ok ? '' : '  <-- ikke som forventet'}`)
}
console.log('')

if (uventet.length) {
  console.log('FAIL: flag er taendt uden at vaere godkendt:')
  for (const f of uventet) console.log(`  - ${f}`)
  console.log('\n  Er det med vilje, saa tilfoej det til GODKENDT_TAENDT i denne fil')
  console.log('  i SAMME commit. Ellers sluk det igen.\n')
  process.exit(1)
}

if (manglende.length) {
  console.log('FAIL: flag er godkendt taendt, men staar slukket i koden:')
  for (const f of manglende) console.log(`  - ${f}`)
  console.log('')
  process.exit(1)
}

console.log(
  taendt.length
    ? `PASS pilot flags guard (${taendt.length} taendt, alle godkendte)\n`
    : `PASS pilot flags guard (alle ${Object.keys(FLAGS).length} slukket — Mitchs floew er uaendret)\n`,
)
