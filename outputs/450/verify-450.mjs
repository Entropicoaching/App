// ORDRE 450: rekorderne uden at hente 4000 rækker ved hver åbning.
// Een verificeringskommando pr. blok:
//   node outputs/450/verify-450.mjs --blok 1   lint, enhedstest, måling før/efter
//                                              (outputs/450/maal.mjs, --runs N, standard 5)
//   node outputs/450/verify-450.mjs --blok 2   browsertest (samme rekorder som 439,
//                                              ingen dobbelt fejring efter genindlæsning,
//                                              offline-rekord én gang), build,
//                                              offline-bevis, VideoCoach-test
// Hvert trin skriver sin udskrift til outputs/450/koersel-*.txt.
import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { ROOT } from '../419/uge-faelles.mjs'

const blok = process.argv[process.argv.indexOf('--blok') + 1]
if (!['1', '2'].includes(blok)) { console.error('brug: --blok 1|2'); process.exit(2) }
const runs = process.argv.includes('--runs') ? process.argv[process.argv.indexOf('--runs') + 1] : '5'
const UD = path.join(ROOT, 'outputs', '450')

const ENHEDSTEST = 'node --test src/athlete/rekordIndeks.test.js src/athlete/rekorder.test.js src/athlete/dinUge.test.js src/fremgangLogs.test.js src/offlineDagensPas.test.js'
const VIDEOCOACH = ['baseline-progress', 'feedback-quality', 'labels', 'variation-migration', 'submission', 'upload', 'migrations', 'zoom', 'clip', 'upload-flow', 'buttons-layout', 'film-guide', 'plate-detect']

const TRIN = {
  1: [
    ['lint', 'npm run lint'],
    ['enhedstest', ENHEDSTEST],
    ['maaling', `node outputs/450/maal.mjs --runs ${runs}`],
  ],
  2: [
    ['lint', 'npm run lint'],
    ['enhedstest', ENHEDSTEST],
    ['build', 'npm run build'],
    ['samme-som-439', 'node outputs/439/verify-439.mjs --blok 1'],
    ['din-uge-439', 'node outputs/439/verify-439.mjs --blok 2 --no-build'],
    ['genindlaes', 'node outputs/450/genindlaes.mjs --no-build'],
    ['offline-bevis', 'node outputs/439/verify-439.mjs --blok 3 --no-build'],
    ['offline-bevis-414', 'node outputs/414/offline-bevis.mjs'],
    ['silent-fails-5', 'npm run verify:athlete-silent-fails-5'],
    ['read-failures', 'npm run verify:athlete-read-failures'],
    ['auth-logout', 'npm run verify:auth-logout-role-switch'],
    ...VIDEOCOACH.map((v) => [`videocoach-${v}`, `npm run verify:videocoach-${v}`]),
    ['build-igen', 'npm run build'],
  ],
}

const resultat = []
for (const [navn, cmd] of TRIN[blok]) {
  const t0 = Date.now()
  // Egen mock-port (kun i denne proces), så en samtidig kørsel på 419's
  // standardport (8997) ikke støder sammen med denne.
  const env = { ...process.env, UGE_MOCK_PORT: process.env.UGE_MOCK_PORT || '8987' }
  const r = spawnSync(cmd, { cwd: ROOT, shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env })
  const ud = `$ ${cmd}\n${r.stdout || ''}${r.stderr || ''}\nexit ${r.status}\n`
  writeFileSync(path.join(UD, `koersel-${navn}.txt`), ud)
  const groen = r.status === 0
  resultat.push({ navn, cmd, groen, sek: Math.round((Date.now() - t0) / 1000) })
  console.log(`${groen ? 'GRØN' : 'RØD '} ${navn} (${Math.round((Date.now() - t0) / 1000)} s)`)
}
writeFileSync(path.join(UD, `blok${blok}.json`), JSON.stringify(resultat, null, 2) + '\n')
const roede = resultat.filter((r) => !r.groen)
console.log(roede.length ? `RØD: ${roede.map((r) => r.navn).join(', ')}` : `GRØN: blok ${blok}`)
process.exitCode = roede.length ? 1 : 0
