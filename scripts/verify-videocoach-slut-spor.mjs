// ORDRE 1610v (Marc 17. nov.: stangsporet "fortsatte igennem gulvet" i slutningen af klippet).
// Kører scripts/verify-videocoach-saet-bane.mjs mod klip, hvor der sker noget efter sidste rep
// (SLUT_PRESETS i scripts/videocoach-saet-klip.mjs): kameraet ryster, kameraet tages op, atleten
// går ind foran skiven, skiven forsvinder. Klippet spores til sidste billede. Krav: alle 5 reps
// findes, banen er præcis, og efter sidste rep ligger intet gyldigt punkt væk fra skiven eller
// under sættets laveste punkt.
// Brug: node scripts/verify-videocoach-slut-spor.mjs [--navn=slut-kamera]
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SLUT_PRESETS } from './videocoach-saet-klip.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const valgt = (process.argv.slice(2).find(a => a.startsWith('--navn=')) || '').split('=')[1]
const rest = process.argv.slice(2).filter(a => !a.startsWith('--navn='))
let bad = 0
for (const navn of valgt ? [valgt] : Object.keys(SLUT_PRESETS)) {
  console.log(`\n== klip ${navn} ==`)
  const r = spawnSync(process.execPath, [join(here, 'verify-videocoach-saet-bane.mjs'), `--navn=${navn}`, ...rest], { stdio: 'inherit' })
  if (r.status !== 0) bad++
}
console.log(bad ? `\nFEJL: ${bad} klip bestod ikke.` : '\nGRØN: sporet stopper eller holder sig efter sidste rep i alle klip.')
process.exit(bad ? 1 : 0)
