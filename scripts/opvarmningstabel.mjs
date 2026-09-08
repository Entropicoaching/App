// ORDRE 105 · npm run opvarmning:tabel
// -----------------------------------------------------------------------------
// Ingen kodeændring. Skriver outputs/opvarmning/TABEL.md — én linje pr.
// kombination af løft × arbejdsvægt × planlagte reps, plus to accessories —
// så Marc kan dømme calcWarmupSets' anbefalinger mod virkeligheden ved at
// markere de forkerte linjer direkte i filen. Det er hans måling; se
// ORDRE-Vaidya.md commit 3 for hvordan markeringerne bruges.

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { calcWarmupSets } from '../src/warmup.js'

const here = dirname(fileURLToPath(import.meta.url))
const outPath = join(here, '..', 'outputs', 'opvarmning', 'TABEL.md')

const HOVEDLØFT = ['Squat', 'Bænkpres', 'Dødløft']
const ACCESSORIES = ['Lat pulldown', 'Benpres']
const VÆGTE = [40, 60, 80, 100, 120, 140, 160, 180, 200, 220, 250]
const REPS = [1, 3, 5, 8]

function linje(navn, W, n) {
  const sæt = calcWarmupSets(W, n, navn)
  const ramp = sæt.map((s) => `${s.weight}×${s.reps}`).join(', ')
  const arbejdssæt = `${W}×${n}`
  return `${navn} — ${W}kg × ${n}: ${ramp || '(ingen opvarmning)'} → ${arbejdssæt}`
}

const linjer = []
for (const navn of HOVEDLØFT) {
  for (const W of VÆGTE) {
    for (const n of REPS) linjer.push(linje(navn, W, n))
  }
}
for (const navn of ACCESSORIES) {
  for (const W of VÆGTE) {
    for (const n of REPS) linjer.push(linje(navn, W, n))
  }
}

const md = `# Opvarmningstabel — ORDRE 105

Genereret af \`npm run opvarmning:tabel\` (\`scripts/opvarmningstabel.mjs\`), ingen
kodeændring i denne commit. Marc: markér de linjer der rammer forkert (fx en
kommentar med "FORKERT:" foran linjen), så commit 3 kan rette dem uden at røre
de umarkerede.

Format: \`Øvelse — arbejdsvægt × planlagte reps: opvarmningssæt (vægt×reps, …) →
arbejdssæt\`.

## Hovedløft (squat, bænkpres, dødløft)

${linjer.slice(0, HOVEDLØFT.length * VÆGTE.length * REPS.length).map((l) => `- ${l}`).join('\n')}

## Accessories

${linjer.slice(HOVEDLØFT.length * VÆGTE.length * REPS.length).map((l) => `- ${l}`).join('\n')}
`

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, md)
console.log(`Skrev ${linjer.length} linjer til ${outPath}`)
