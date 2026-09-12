// ORDRE 139 · commit 1: bygger et REALISTISK syntetisk 4-reps-klip fra Marcs
// eneste rigtige rep (test-clips\marc-doedloeft-270.mov) - rettelsen af den
// unøjagtighed ordre 121 · commit 3 lavede (se RAPPORT-134/139): dengang blev
// blot det FØRSTE sekund af klippet skåret ud som "rep", uden hensyn til
// hvor den rigtige bevægelse faktisk lå - det gav et 0,56s rep-vindue, hverken
// den fulde analyses egen rep-detektion eller en rigtig atlets tempo, og
// testen blev derfor RØD på et klip der ikke lignede virkeligheden.
//
// Denne gang:
//   1) Det REELLE rep-vindue (0,00-2,55s) - fundet af app'ens EGEN presearch,
//      samme kilde "Vis mig nu" selv bruger. Efterprøvet 2026-09-12 ved at
//      lægge KUN marc-doedloeft-270.mov i test-clips\ og køre
//      `node scripts/verify-videocoach-clip.mjs`: linjen "gentagelse(r)
//      fundet automatisk (presearch ...)" skrev "0.00-2.55s, 2.25-3.84s" -
//      kun det FØRSTE, ikke-overlappende vindue bruges som kilde-rep her.
//   2) Det vindue STRÆKKES til REP_TARGET_S sekunder (inden for ordrens
//      2,5-3,5s-krav) VED AT GENTAGE FRAMES (ffmpeg setpts+fps) - IKKE ved at
//      afspille langsommere: setpts flytter blot de EKSISTERENDE frames'
//      visningstidspunkter længere fra hinanden, og den efterfølgende
//      fps=30 resampler til fast 30fps ved at GENTAGE (uden minterpolate)
//      nærmeste frame i de nye mellemrum. Resultatet er et LÆNGERE klip med
//      FLERE fysiske frames at spore (samme bane, realistisk frame-tæthed) -
//      ikke det samme antal frames spillet i slowmotion (som ville give
//      FÆRRE frames pr. reelt sekund, og dermed underdrive trackerens
//      pr.-frame-arbejde i netop det scenarie testen skal måle).
//   3) Et REALISTISK ophold (PAUSE_S sekunder, stille stang) mellem hver af
//      de 4 reps - sidste frame frosset via tpad, samme teknik som ordre
//      121 · commit 3 (dengang kun 0,8s; her 3-5s som en rigtig atlet).
//
// Kørsel: node scripts/make-realistic-test-clip.mjs
// Kræver test-clips\marc-doedloeft-270.mov (Marcs eget klip, git-ignoreret).
// Output (begge git-ignorerede, ligesom resten af test-clips\):
//   test-clips\vis-mig-nu-4-reps-realistisk.mp4
//   test-clips\vis-mig-nu-4-reps-realistisk.meta.json

import { existsSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import ffmpegPath from 'ffmpeg-static'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const testClipsDir = join(root, 'test-clips')
const srcPath = join(testClipsDir, 'marc-doedloeft-270.mov')
const outPath = join(testClipsDir, 'vis-mig-nu-4-reps-realistisk.mp4')
const metaPath = join(testClipsDir, 'vis-mig-nu-4-reps-realistisk.meta.json')

if (!existsSync(srcPath)) {
  console.error(`make-realistic-test-clip: ${srcPath} findes ikke - læg Marcs eget dødløft-klip (marc-doedloeft-270.mov) i test-clips\\ først.`)
  process.exit(1)
}

const SRC_WINDOW_START_S = 0.00
const SRC_WINDOW_END_S = 2.55
const REP_TARGET_S = 3.00   // inden for ordrens 2,5-3,5s
const PAUSE_S = 4.00        // inden for ordrens 3-5s, stille stang
const REPS = 4

function run(args, label) {
  const res = spawnSync(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'inherit'] })
  if (res.status !== 0) throw new Error(`make-realistic-test-clip: ffmpeg fejlede ved ${label}`)
}

const tmp = mkdtempSync(join(tmpdir(), 'vc-realistisk-'))
try {
  const repRaw = join(tmp, 'rep-raw.mp4')
  const repStretched = join(tmp, 'rep-stretched.mp4')
  const unit = join(tmp, 'unit.mp4')
  const listFile = join(tmp, 'concat.txt')

  const srcWindowS = SRC_WINDOW_END_S - SRC_WINDOW_START_S
  const stretchFactor = REP_TARGET_S / srcWindowS

  // 1) Klip det rigtige rep-vindue ud - ingen lyd (ikke brugt af trackeren).
  run(['-y', '-ss', String(SRC_WINDOW_START_S), '-i', srcPath, '-t', String(srcWindowS),
    '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', repRaw], 'trim af rep-vindue')

  // 2) Tidsstrækning ved frame-gentagelse (se toptekst).
  run(['-y', '-i', repRaw, '-vf', `setpts=${stretchFactor}*PTS,fps=30`,
    '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', repStretched], 'tidsstrækning')

  // 3) Frys sidste frame i PAUSE_S sekunder (stille stang).
  run(['-y', '-i', repStretched, '-vf', `tpad=stop_mode=clone:stop_duration=${PAUSE_S}`,
    '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', unit], 'pause-tilføjelse')

  // 4) Lim REPS identiske kopier sammen (concat-demuxer).
  writeFileSync(listFile, Array(REPS).fill(`file '${unit.replace(/\\/g, '/')}'`).join('\n'))
  run(['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', outPath], 'sammenlimning')

  const cycleS = REP_TARGET_S + PAUSE_S
  const windows = Array.from({ length: REPS }, (_, i) => ({
    start: +(i * cycleS).toFixed(2),
    end: +(i * cycleS + REP_TARGET_S).toFixed(2),
  }))
  writeFileSync(metaPath, JSON.stringify({ lift: 'deadlift', windows, repeatedIdenticalWindows: true }, null, 2) + '\n')

  console.log(`Bygget ${outPath.replace(root + '\\', '')} (${REPS} reps a ${REP_TARGET_S}s, ${PAUSE_S}s pause, kilde-vindue ${SRC_WINDOW_START_S}-${SRC_WINDOW_END_S}s strukket ${stretchFactor.toFixed(3)}x).`)
  console.log(`Vinduer (til manifest/rapport): ${windows.map(w => `${w.start}-${w.end}s`).join(', ')}`)
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
