#!/usr/bin/env node
// ORDRE 218, commit 4: "samme kæde", nu på Marcs frontsquat-klip
// (IMG_0838.MOV). SAMME opbygning som extract.mjs (se dens egen toptekst
// for hele begrundelsen: transkodering, seek-pr-billede, egen
// package.json/node_modules) — kun tre forskelle:
//
// 1. Klippet ligger i `Downloads\`, IKKE i `test-clips\` og kopieres ALDRIG
//    ind i repoet (ordrens egen grænse) — stien er absolut og læses
//    direkte derfra.
// 2. Kun de første ~172 billeder transkoderes (`-frames:v`), ikke hele det
//    28 sekunder lange klip — banen (squat_bane.py's egne standardværdier,
//    FRAME_TOP_FOER=58/FRAME_TOP_EFTER=166) plus ét nabobillede i hver
//    ende til usikkerhedsensemblet når kun til billede 167. At transkodere
//    og pose-ekstrahere resten af klippets ~838 billeder ville koste
//    minutter for data denne prøve aldrig bruger.
// 3. Ingen skivedetektion (skipSkive: true til harness.html) — frontsquat
//    har intet `stang`-felt (samme begrundelse som løftmodellens egen
//    squat_bane.py, se matematik.mjs's beregnKontraktPunktSquat()).

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startStaticServer } from './server.mjs'
import { pickSide, measureFrame, robustFloorReference, beregnKontraktPunktSquat } from './matematik.mjs'
import { angleUsikkerhed, hoftehoejdeUsikkerhed } from './usikkerhed.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const APP_ROOT = join(HERE, '..', '..')
const SRC_CLIP = 'C:\\Users\\Entropi\\Downloads\\IMG_0838.MOV' // ALDRIG kopieret ind i repoet
const TMP_DIR = join(HERE, 'tmp')
const MP4_PATH = join(TMP_DIR, 'marc-frontsquat-0838.mp4')
const MODELS_DIR = join(HERE, 'models')
const MODEL_PATH = join(MODELS_DIR, 'pose_landmarker_full.task')
const OUT_DIR = join(APP_ROOT, 'outputs', 'pose-proeve')
const FFMPEG_PATH = join(APP_ROOT, 'node_modules', 'ffmpeg-static', 'ffmpeg.exe')

const NOMINAL_FPS = 30 // kildens egen container-rate (ffprobe: "30 tbr")
const FRAME_TOP_FOER = 58 // squat_bane.py's FRAME_TOP_FOER_DEFAULT
const FRAME_TOP_EFTER = 166 // squat_bane.py's FRAME_TOP_EFTER_DEFAULT
const FRAMES_TO_KEEP = FRAME_TOP_EFTER + 6 // lidt luft ud over +1-naboen til usikkerhed

function ensureModel() {
  mkdirSync(MODELS_DIR, { recursive: true })
  if (!existsSync(MODEL_PATH)) {
    throw new Error(`${MODEL_PATH} findes ikke — kør extract.mjs først (henter/kopierer modellen).`)
  }
}

function transcode() {
  if (!existsSync(SRC_CLIP)) {
    throw new Error(`${SRC_CLIP} findes ikke.`)
  }
  mkdirSync(TMP_DIR, { recursive: true })
  // SAMME setpts-begrundelse som extract.mjs — plus `-frames:v` for kun at
  // afkode de billeder banen rent faktisk bruger (se filens egen toptekst).
  const args = ['-y', '-i', SRC_CLIP, '-frames:v', String(FRAMES_TO_KEEP), '-vf', `setpts=N/(${NOMINAL_FPS}*TB)`, '-an',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-bf', '0', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', MP4_PATH]
  const res = spawnSync(FFMPEG_PATH, args, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf-8' })
  const log = (res.stderr || '') + (res.stdout || '')
  if (res.status !== 0) { console.error(log); throw new Error('ffmpeg-transkodering fejlede.') }
  const frameMatches = [...log.matchAll(/frame=\s*(\d+)/g)]
  const frameCount = frameMatches.length ? Number(frameMatches[frameMatches.length - 1][1]) : null
  if (!frameCount) throw new Error('Kunne ikke læse billedtal af ffmpegs output.')
  console.log(`Transkoderet ${SRC_CLIP} -> ${MP4_PATH} (libx264, første ${frameCount} billeder, se kommentar for hvorfor kun disse).`)
  return frameCount
}

async function launchBrowser() {
  const runtimeModules = join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules')
  const require = createRequire(import.meta.url)
  const { chromium } = require(join(runtimeModules, 'playwright'))
  return chromium.launch({ headless: true })
}

async function main() {
  const t0 = Date.now()
  ensureModel()
  const frameCount = transcode()

  const { server, url } = await startStaticServer(HERE)
  const browser = await launchBrowser()
  let raw
  try {
    const page = await browser.newPage()
    const pageErrors = []
    page.on('pageerror', err => pageErrors.push(err))
    await page.goto(`${url}/harness.html`)
    raw = await page.evaluate(({ videoUrl, modelUrl, frameCount, fps }) =>
      window.runPoseExtraction({ videoUrl, modelUrl, frameCount, fps, skipSkive: true }),
      { videoUrl: '/tmp/marc-frontsquat-0838.mp4', modelUrl: '/models/pose_landmarker_full.task', frameCount, fps: NOMINAL_FPS })
    if (pageErrors.length) throw new Error(`Browser-fejl under ekstraktion: ${pageErrors.map(e => e.message).join('; ')}`)
    await page.close()
  } finally {
    await browser.close()
    server.close()
  }

  const t1 = Date.now()
  if (raw.frames.length !== frameCount) {
    throw new Error(`Fangede ${raw.frames.length} billeder, forventede ${frameCount}.`)
  }
  const rawLandmarks = raw.frames.map(f => f.landmarks)
  const { chosen: side, avg: sideAvg } = pickSide(rawLandmarks)
  const otherSide = side === 'right' ? 'left' : 'right'
  const measured = rawLandmarks.map(lm => measureFrame(lm, side, raw.width, raw.height))
  const measuredOther = rawLandmarks.map(lm => measureFrame(lm, otherSide, raw.width, raw.height))
  const ref = robustFloorReference(measured)

  if (raw.frames.length <= FRAME_TOP_EFTER) {
    throw new Error(`Kun ${raw.frames.length} billeder fanget — færre end FRAME_TOP_EFTER (${FRAME_TOP_EFTER}).`)
  }

  const maalinger = []
  const sprungetOver = []
  for (let idx = FRAME_TOP_FOER; idx <= FRAME_TOP_EFTER; idx++) {
    const m = measured[idx]
    if (!m) { sprungetOver.push({ billedeIndex: idx, aarsag: 'ingen krop fundet' }); continue }
    const tidspunktMs = (idx - FRAME_TOP_FOER) / NOMINAL_FPS * 1000
    const punkt = beregnKontraktPunktSquat(idx, tidspunktMs, m, ref)
    punkt.usikkerhed = {
      ...angleUsikkerhed(idx, measured, measuredOther, ref),
      ...hoftehoejdeUsikkerhed(idx, measured, measuredOther, ref),
    }
    maalinger.push(punkt)
  }

  mkdirSync(OUT_DIR, { recursive: true })
  const outPath = join(OUT_DIR, 'marc-frontsquat-0838-bane.json')
  writeFileSync(outPath, JSON.stringify(maalinger, null, 2) + '\n', 'utf-8')

  const nFundet = measured.filter(Boolean).length
  const refPath = join(OUT_DIR, 'marc-frontsquat-0838-bane-reference.json')
  writeFileSync(refPath, JSON.stringify({
    video_kilde: SRC_CLIP + ' (Downloads — ALDRIG committet, se extract-squat.mjs)',
    video_transkodering: `ffmpeg libx264, kun de første ${frameCount} billeder (-frames:v), setpts=N/(${NOMINAL_FPS}*TB)`,
    billede_bredde_px: raw.width,
    billede_hoejde_px: raw.height,
    billeder_transkoderet: raw.frames.length,
    billeder_med_fundet_krop: nFundet,
    billede_top_foer: FRAME_TOP_FOER,
    billede_top_efter: FRAME_TOP_EFTER,
    huller: sprungetOver,
    side_valgt: side,
    side_valgt_gennemsnit_visibility: sideAvg,
    gulv_og_skala_reference: ref,
    model: 'pose_landmarker_full (float16), @mediapipe/tasks-vision, delegate=CPU, runningMode=IMAGE, numPoses=1',
    tidsmaaling: { ekstraktion_ms: raw.extractionMs, total_ms_inkl_transkodering_og_browseropstart: t1 - t0 },
    note: 'IKKE en del af docs/MAALING-KONTRAKT.md\'s format (som er dødløft-specifikt) — regnskabet bag skala/gulv/fortegn i marc-frontsquat-0838-bane.json. Se matematik.mjs\'s beregnKontraktPunktSquat() og squat_bane.py.',
  }, null, 2) + '\n', 'utf-8')

  console.log(`\nSkrev ${outPath} (${maalinger.length} målinger, ${sprungetOver.length} huller) og ${refPath}.`)
  console.log(`Side valgt: ${side} (venstre=${sideAvg.left.toFixed(3)}, højre=${sideAvg.right.toFixed(3)})`)
  console.log(`${nFundet}/${raw.frames.length} transkoderede billeder med fundet krop.`)
  console.log(`Tid: ekstraktion ${(raw.extractionMs / 1000).toFixed(1)}s, total ${((t1 - t0) / 1000).toFixed(1)}s.`)
}

main().catch(err => { console.error('FEJL:', err.message); process.exit(1) })
