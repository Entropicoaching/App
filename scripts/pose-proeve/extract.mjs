#!/usr/bin/env node
// ORDRE 188, commit 1: kan appen (browser, PoseLandmarker) måle det Drishti
// måler (Python, MediaPipe)? Denne fil er PRØVEN, ikke et appfeature — se
// docs/RAPPORT-188.md og docs/videocoach/POSE-PROEVE.md.
//
// Kører HELT UDEN FOR entropi-app's egen bundle: egen package.json/node_modules
// i denne mappe (kun @mediapipe/tasks-vision), Playwright fra den delte
// codex-runtime (samme kilde som e2e/harness.mjs — "ingen ny runtime-
// afhængighed"), og ffmpeg LÅNT fra appens EGEN, allerede eksisterende
// devDependency (ffmpeg-static — appens package.json røres ikke, filen
// importeres blot direkte fra dens node_modules-sti).
//
// Trin: 1) transcodér test-clips\marc-doedloeft-270.mov -> mp4 (Chromium kan
// ikke afkode .mov, samme begrundelse som scripts/make-realistic-test-clip.mjs),
// UDEN at ændre billedtal eller -rækkefølge — kun tidsstemplerne gennumereres
// til en ren, jævn 30 fps-tidslinje (se transcode()'s egen kommentar for
// hvorfor `-fps_mode passthrough` blev forkastet undervejs), så billedeIndex N
// her er SAMME billede som Python's frame N. 2) server denne mappe statisk.
// 3) kør PoseLandmarker på hvert billede i en headless Chromium-side
// (harness.html, seek-pr-billede — se dens egen kommentar for hvorfor rVFC
// under normal afspilning IKKE var nok). 4) regn de seks kontrakt-felter for
// billede 21-48 med PRÆCIS matematik.mjs's formler (= bane.py's egne).
// 5) skriv outputs/pose-proeve/*.json.
//
// ORDRE 218, commit 1: harness.html finder nu OGSÅ skiven pr. billede
// (skive.mjs, kørt i browseren i samme seek-loop) — stangens position
// bruger skiven når den valideres, håndleddet er nu kun fallback. Se
// docs/RAPPORT-218.md og skive.mjs's egen toptekst for "stå på skuldre"-
// vurderingen.
//
// ORDRE 218, commit 2: et ægte usikkerhedsbånd (usikkerhed.mjs) pr. punkt,
// ikke Drishtis som proxy — se usikkerhed.mjs's egen toptekst.

import { existsSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startStaticServer } from './server.mjs'
import { pickSide, measureFrame, robustFloorReference, beregnKontraktPunkt, FRAME_START, FRAME_LOCKOUT } from './matematik.mjs'
import { angleUsikkerhed, stangUsikkerhed } from './usikkerhed.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const APP_ROOT = join(HERE, '..', '..')
const SRC_CLIP = join(APP_ROOT, 'test-clips', 'marc-doedloeft-270.mov')
const TMP_DIR = join(HERE, 'tmp')
const MP4_PATH = join(TMP_DIR, 'marc-doedloeft-270.mp4')
const MODELS_DIR = join(HERE, 'models')
const MODEL_PATH = join(MODELS_DIR, 'pose_landmarker_full.task')
const LOEFTMODEL_MODEL = join('C:\\Users\\Entropi\\Desktop\\entropi-loeftmodel-wt2\\tools\\videomaal\\models', 'pose_landmarker_full.task')
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task'
const OUT_DIR = join(APP_ROOT, 'outputs', 'pose-proeve')
const FFMPEG_PATH = join(APP_ROOT, 'node_modules', 'ffmpeg-static', 'ffmpeg.exe')

function ensureModel() {
  mkdirSync(MODELS_DIR, { recursive: true })
  if (existsSync(MODEL_PATH)) return
  if (existsSync(LOEFTMODEL_MODEL)) {
    copyFileSync(LOEFTMODEL_MODEL, MODEL_PATH)
    console.log(`Model kopieret fra ${LOEFTMODEL_MODEL} (samme model Drishti bruger, undgår gen-download).`)
    return
  }
  console.log(`Henter posemodel (${MODEL_URL}) ...`)
  const res = spawnSync(process.execPath, ['-e', `
    const { writeFileSync } = require('node:fs');
    fetch(process.argv[1]).then(r => r.arrayBuffer()).then(buf => {
      writeFileSync(process.argv[2], Buffer.from(buf));
    });
  `, MODEL_URL, MODEL_PATH], { stdio: 'inherit' })
  if (res.status !== 0 || !existsSync(MODEL_PATH)) throw new Error('Kunne ikke hente posemodellen.')
}

const NOMINAL_FPS = 30 // kildens egen container-rate (ffmpeg -i rapporterer "30 tbr")

function transcode() {
  if (!existsSync(SRC_CLIP)) {
    throw new Error(`${SRC_CLIP} findes ikke — læg Marcs eget dødløft-klip i test-clips\\ først (git-ignoreret, aldrig committet).`)
  }
  mkdirSync(TMP_DIR, { recursive: true })
  // FØRSTE FORSØG var `-fps_mode passthrough` (bevar kildens egne, let
  // uregelmæssige PTS'er urørt) — det viste sig at give libx264/muxeren en
  // "Non-monotonic DTS"-fejl på ÉT billede (nr. 2), som ffmpeg selv "retter"
  // til en fysisk umulig værdi (6,5s inde i et 3,86s-klip, bekræftet ved at
  // læse den transkoderede fils egne PTS'er tilbage med `-vf showinfo`).
  // Kildens EGNE PTS'er (samme showinfo-tjek kørt direkte på .mov'en) er
  // rene — fejlen opstår i selve transkoderingen, ikke i kilden.
  // LØSNING: `setpts=N/(30*TB)` giver hvert billede en NY, ren, jævnt
  // fordelt tidsstempel ud fra dets AFKODNINGSINDEKS (N) i stedet for at
  // genbruge kildens — ÆNDRER INGEN billeder, dropper/duplikerer INTET
  // (verificeret: stadig 117/117 billeder, samme antal som Python læser via
  // cv2 direkte fra .mov'en), kun tidsstemplerne er nu 0, 1/30, 2/30, ...
  // i stedet for kildens egne (ubrugte her alligevel — se harness.html,
  // som seeker på BILLEDEINDEKS, ikke på et bestemt klokkeslæt).
  const args = ['-y', '-i', SRC_CLIP, '-vf', `setpts=N/(${NOMINAL_FPS}*TB)`, '-an',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-bf', '0', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', MP4_PATH]
  const res = spawnSync(FFMPEG_PATH, args, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf-8' })
  const log = (res.stderr || '') + (res.stdout || '')
  if (res.status !== 0) { console.error(log); throw new Error('ffmpeg-transkodering fejlede.') }
  const frameMatches = [...log.matchAll(/frame=\s*(\d+)/g)]
  const frameCount = frameMatches.length ? Number(frameMatches[frameMatches.length - 1][1]) : null
  if (!frameCount) throw new Error('Kunne ikke læse billedtal af ffmpegs output.')
  console.log(`Transkoderet ${SRC_CLIP} -> ${MP4_PATH} (libx264, ${frameCount} billeder bevaret og gennumereret 0..N ved ${NOMINAL_FPS} fps, se kommentar for hvorfor -fps_mode passthrough blev forkastet).`)
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
    // KUN uncaught exceptions tæller som fejl her — MediaPipes WASM-runtime
    // logger selv rutinemæssige INFO-linjer (fx XNNPACK-delegate-opsætning)
    // via console.error, så et console-baseret filter ville fejle på støj.
    const pageErrors = []
    page.on('pageerror', err => pageErrors.push(err))
    await page.goto(`${url}/harness.html`)
    raw = await page.evaluate(({ videoUrl, modelUrl, frameCount, fps }) =>
      window.runPoseExtraction({ videoUrl, modelUrl, frameCount, fps }),
      { videoUrl: '/tmp/marc-doedloeft-270.mp4', modelUrl: '/models/pose_landmarker_full.task', frameCount, fps: NOMINAL_FPS })
    if (pageErrors.length) throw new Error(`Browser-fejl under ekstraktion: ${pageErrors.map(e => e.message).join('; ')}`)
    await page.close()
  } finally {
    await browser.close()
    server.close()
  }

  const t1 = Date.now()
  if (raw.frames.length !== frameCount) {
    throw new Error(`Fangede ${raw.frames.length} billeder, forventede ${frameCount} (fra ffmpegs transkodering).`)
  }
  const rawLandmarks = raw.frames.map(f => f.landmarks)
  const { chosen: side, avg: sideAvg } = pickSide(rawLandmarks)
  const otherSide = side === 'right' ? 'left' : 'right'
  const measured = rawLandmarks.map(lm => measureFrame(lm, side, raw.width, raw.height))
  // ORDRE 218, commit 2: "den anden side" til usikkerhedsensemblet — INGEN
  // ny MediaPipe-detektion (se usikkerhed.mjs's egen toptekst), kun samme
  // rå landmarks, andet side-indeks.
  const measuredOther = rawLandmarks.map(lm => measureFrame(lm, otherSide, raw.width, raw.height))
  const ref = robustFloorReference(measured)

  if (raw.frames.length <= FRAME_LOCKOUT) {
    throw new Error(`Kun ${raw.frames.length} billeder fanget — færre end FRAME_LOCKOUT (${FRAME_LOCKOUT}). Kan ikke bygge banen.`)
  }

  // ORDRE 218, commit 1: fysisk sandsynlighedsport — en gyldig skive-
  // detektion kan IKKE ligge over lidt mere end lockout-højden (bar-banen
  // for et dødløft går monotont fra ~gulvet til lidt over hoftehøjde
  // stående, ALDRIG højere). PLAUSIBEL_Y_MAX_FL=3.6 er en rundhåndet
  // margin over Drishtis egen lockout-værdi (~2,6 fl) — ikke hendes tal
  // genbrugt som facit, kun kroppens egen fysiske grænse. Fanget under
  // fejlsøgning: findPlate() fandt jævnligt et andet, lige så
  // veldefineret rundt objekt langt over den sande skive i de tidlige
  // billeder (spread/npair kunne ikke selv skelne det fra en rigtig
  // skive, se docs/RAPPORT-218.md) — denne port erstatter IKKE
  // visuel skelnen, den kasserer kun fysisk umulige svar til fordel for
  // håndled-fallback, samme ærlige "ingen gæt"-linje som skive.mjs's
  // egne valideringer.
  const PLAUSIBEL_Y_MIN_FL = -0.3
  const PLAUSIBEL_Y_MAX_FL = 3.6
  function plausibel(skive) {
    if (!skive) return null
    const yFl = (ref.floor_y_px - skive.y) / ref.foot_length_px
    return (yFl >= PLAUSIBEL_Y_MIN_FL && yFl <= PLAUSIBEL_Y_MAX_FL) ? skive : null
  }

  const skiveByIndex = new Map(raw.frames.map(f => [f.index, plausibel(f.skive)]))
  const maalinger = []
  for (let idx = FRAME_START; idx <= FRAME_LOCKOUT; idx++) {
    const m = measured[idx]
    if (!m) throw new Error(`Billede ${idx} har ingen fundet krop — kan ikke udfylde banen uden hul.`)
    const tidspunktMs = (idx - FRAME_START) / NOMINAL_FPS * 1000
    const punkt = beregnKontraktPunkt(idx, tidspunktMs, m, ref, skiveByIndex.get(idx) || null)
    const stangKilde = punkt.stang_kilde.startsWith('skive') ? 'skive' : 'haandled'
    punkt.usikkerhed = {
      ...angleUsikkerhed(idx, measured, measuredOther, ref),
      ...stangUsikkerhed(idx, stangKilde, { skiveByIndex, measuredChosen: measured, measuredOther, ref }),
    }
    maalinger.push(punkt)
  }
  const nSkiveFundet = maalinger.filter(m => m.stang_kilde.startsWith('skive')).length

  mkdirSync(OUT_DIR, { recursive: true })
  const outPath = join(OUT_DIR, 'marc-doedloeft-270-bane.json')
  writeFileSync(outPath, JSON.stringify(maalinger, null, 2) + '\n', 'utf-8')

  const nFundet = measured.filter(Boolean).length
  const empiriskFps = (raw.frames.length - 1) / raw.duration
  const refPath = join(OUT_DIR, 'marc-doedloeft-270-bane-reference.json')
  writeFileSync(refPath, JSON.stringify({
    video_kilde: SRC_CLIP,
    video_transkodering: `ffmpeg libx264, setpts=N/(${NOMINAL_FPS}*TB) (alle ${raw.frames.length} billeder bevaret i original rækkefølge, kun gennumereret til en ren ${NOMINAL_FPS} fps-tidslinje — se extract.mjs's egen kommentar for hvorfor -fps_mode passthrough blev forkastet), lånt ffmpeg-static fra entropi-app node_modules (allerede en devDependency)`,
    billede_bredde_px: raw.width,
    billede_hoejde_px: raw.height,
    billeder_i_alt: raw.frames.length,
    billeder_med_fundet_krop: nFundet,
    video_varighed_s: raw.duration,
    empirisk_fps: Math.round(empiriskFps * 1000) / 1000,
    billede_start: FRAME_START,
    billede_lockout: FRAME_LOCKOUT,
    side_valgt: side,
    side_valgt_gennemsnit_visibility: sideAvg,
    gulv_og_skala_reference: ref,
    model: 'pose_landmarker_full (float16), @mediapipe/tasks-vision, delegate=CPU, runningMode=IMAGE, numPoses=1',
    tidsmaaling: {
      ekstraktion_ms: raw.extractionMs,
      skivedetektion_ms: raw.skiveMs,
      total_ms_inkl_transkodering_og_browseropstart: t1 - t0,
    },
    skive: {
      billeder_med_valideret_skive: nSkiveFundet,
      billeder_i_alt_i_banen: maalinger.length,
      note: 'Se scripts/pose-proeve/skive.mjs — genbrug af videocoach.html\'s recenterOnPlate()-kantscan, ny grov gittersøgning fordi den fulde live-tracker kræver klik+kontinuitet.',
    },
    note: (
      'Denne fil er IKKE en del af docs/MAALING-KONTRAKT.md\'s format — den er ' +
      'regnskabet bag skala/gulv/fortegn/timing i marc-doedloeft-270-bane.json, ' +
      'til efterprøvning. Se scripts/pose-proeve/matematik.mjs og bane.py.'
    ),
  }, null, 2) + '\n', 'utf-8')

  console.log(`\nSkrev ${outPath} (${maalinger.length} målinger) og ${refPath}.`)
  console.log(`Side valgt: ${side} (venstre=${sideAvg.left.toFixed(3)}, højre=${sideAvg.right.toFixed(3)})`)
  console.log(`${nFundet}/${raw.frames.length} billeder med fundet krop.`)
  console.log(`${nSkiveFundet}/${maalinger.length} billeder i banen med valideret skive (resten: håndled-fallback).`)
  console.log(`Tid: ekstraktion ${(raw.extractionMs / 1000).toFixed(1)}s (heraf skivedetektion ${(raw.skiveMs / 1000).toFixed(1)}s), total ${((t1 - t0) / 1000).toFixed(1)}s (inkl. transkodering + browseropstart).`)
}

main().catch(err => { console.error('FEJL:', err.message); process.exit(1) })
