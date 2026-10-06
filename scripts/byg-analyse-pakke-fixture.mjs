// Read-only use of the lift model's real package builder; synthetic numbers only.
// node scripts/byg-analyse-pakke-fixture.mjs <absolute path to video/pakke.mjs>
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
const { byg, valider } = await import(pathToFileURL(resolve(process.argv[2])).href)
const dir = resolve('outputs/1139/pakke-kilde')
mkdirSync(dir, { recursive: true })
const skriv = (navn, data) => writeFileSync(resolve(dir, navn), JSON.stringify(data, null, 2) + '\n')
skriv('bane.json', { klip: 'syntetisk', seed: { kilde: 'givet med --seed' }, billede: { billeder: 180, fpsGennemsnit: 30 }, tracker: { htmlHash16: '0123456789abcdef' } })
skriv('hastighed.json', { reps: [
  { rep: 1, mean: 0.6, peak: 0.9, tabPct: 0 },
  { rep: 2, mean: null, peak: null, tabPct: null },
  { rep: 3, mean: 0.51, peak: 0.8, tabPct: 15 },
], saetTabPct: 15 })
skriv('fund.json', { fund: [
  { type: 'sticking', billede: 90, tal: { fartCmS: 12 }, sikkerhed: 'lav', forklaring: 'Hypotese: stangen mister fart midt i rep 3.' },
  { type: 'sticking', billede: 100, tal: { fartCmS: 15 }, sikkerhed: 'middel', forklaring: 'Hypotese: sammenlign det langsomme område med rep 1.' },
], ikkeRegnet: ['Stangdrift: balancepunktet kendes ikke.', 'Hofte og dybde: ingen led i pakken.'] })
const pakke = byg(dir, { loeft: 'squat', dato: '2026-10-04', id: 'syntetisk-d5' })
if (valider(pakke).length) throw new Error('Canonical validator rejected fixture')
mkdirSync('test/fixtures/analyse-pakke', { recursive: true })
writeFileSync('test/fixtures/analyse-pakke/syntetisk.json', JSON.stringify(pakke, null, 2) + '\n')
console.log('Generated synthetic fixture using video/pakke.mjs::byg; canonical valider: 0 errors')
