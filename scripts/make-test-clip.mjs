// ORDRE 73 · commit 1 — et syntetisk, men RIGTIGT, videoklip til tracker-testen.
// -----------------------------------------------------------------------------
// Genererer en kort mp4 (H.264, 720p portræt, 30 fps) med en tegnet "skive" der
// bevæger sig lodret som et sæt på fem gentagelser med pause mellem hver, på en
// støjet baggrund med let kameravaklen. Ingen atletdata — skiven er tegnet, ikke
// filmet.
//
// Hvorfor disse valg:
// - Portræt (720×1280, ikke liggende 1280×720): videocoach-klip filmes i
//   praksis lodret (telefon holdt op), samme sigt som de eksisterende
//   syntetiske testriggees 480×640-scene (docs/videocoach/tracker-live-bench.mjs).
//   "720p" her betyder den korte led (bredden) er 720px, samme konvention som
//   vertikal video ofte bruger.
// - Skivens teksturmønster (kant-ring, midterring, centerprik, to roterende
//   "feature"-prikker) er 1:1 samme design som de eksisterende riggees
//   buildScene/buildFullScene — det design er allerede bevist at give
//   `mpGoodFeatures` nok kontrast (eig>350) til at initiere sporing. Skaleret
//   proportionalt til den nye PLATE_R.
// - Baggrundsstøjen er RUMLIG og deterministisk (samme hash-støj som
//   tracker-live-bench.mjs, ingen Math.random) og beregnes derfor kun ÉN gang
//   for hele billedet; kun feltet omkring skiven gentegnes pr. frame. Det er en
//   ren ydelsesoptimering af selve genereringen (loop over ~920k pixler 600
//   gange vs. loop over en lille boks 600 gange) og ændrer intet ved billedet
//   der leveres til ffmpeg. Den TIDSLIGE komprimeringsstøj (det der rent
//   faktisk adskiller denne test fra de syntetiske pixel-scener) kommer fra den
//   ægte H.264-kodning, ikke fra denne generator.
// - Kameravaklen er en lille, deterministisk sum af sinusser (ingen
//   Math.random) på både skivens x og y — nok til at flytte skiven et par
//   pixler mellem frames, ikke nok til at gøre banen ukendt: den EFTERLIGGER
//   dermed selv rystelsen i sandheden, som gemmes i sidecar-JSON'en.
//
// Kørsel: npm run test:clip  (skriver til docs/videocoach/clip-cache/, git-ignoreret)

import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ffmpegPath from 'ffmpeg-static'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'docs', 'videocoach', 'clip-cache')
mkdirSync(outDir, { recursive: true })
const outPath = join(outDir, 'synthetic-set.mp4')
const groundTruthPath = join(outDir, 'synthetic-set.ground-truth.json')

// ---------- Geometri (samme sigt som tracker-live-bench.mjs's 480×640-scene) ----------
export const W = 720, H = 1280, FPS = 30
export const CX = W / 2
export const TOP_Y = 420, BOTTOM_Y = 900
export const PLATE_R = 110
const OLD_PLATE_R = 70 // fra tracker-live-bench.mjs, teksturen er skaleret herfra
const SCALE = PLATE_R / OLD_PLATE_R

export const REP_DUR = 2.4, HOLD_DUR = 1.0, N_REPS = 5, LEAD_IN = 2.0, LEAD_OUT = 2.0
const CYCLE = REP_DUR + HOLD_DUR
const REP_PHASE_DUR = N_REPS * REP_DUR + (N_REPS - 1) * HOLD_DUR
export const DURATION = LEAD_IN + REP_PHASE_DUR + LEAD_OUT

// ---------- Sandheden: skivens centrum i "verdens"-koordinater (uden vaklen) ----------
export function worldY(t) {
  const tp = t - LEAD_IN
  if (tp < 0 || tp > REP_PHASE_DUR) return TOP_Y
  const repIndex = Math.min(N_REPS - 1, Math.floor(tp / CYCLE))
  const localT = tp - repIndex * CYCLE
  if (localT > REP_DUR) return TOP_Y // pause mellem reps
  const half = REP_DUR / 2
  const d = localT < half ? localT / half : (REP_DUR - localT) / half
  return TOP_Y + (BOTTOM_Y - TOP_Y) * Math.max(0, d)
}

// Deterministisk kameravaklen — sum af et par usammenhængende sinusser, ingen
// Math.random, så et rerun giver nøjagtig samme klip og samme facit.
export function shakeX(t) { return 3.0 * Math.sin(2 * Math.PI * 0.73 * t) + 1.4 * Math.sin(2 * Math.PI * 2.31 * t + 0.6) }
export function shakeY(t) { return 2.2 * Math.sin(2 * Math.PI * 0.91 * t + 0.3) + 1.1 * Math.sin(2 * Math.PI * 3.05 * t) }

// Den faktiske, tegnede pixel-position — det ER her skiven rent faktisk
// havner på skærmen, vaklen medregnet. Det er DENNE facit, en tracker der ser
// pixlerne skal kunne finde, og derfor den vi sammenligner sporingsresultatet
// imod i verify-videocoach-clip.mjs.
export function truePos(t) { return { x: CX + shakeX(t), y: worldY(t) + shakeY(t) } }

// Rep-vinduer (start/slut i sekunder) — bruges af verify-scriptet til at
// vælge "Vis mig nu"s tre vinduer (første, midterste, sidste rep) UDEN at
// afhænge af nogen forudsøgnings-heuristik, samme princip som rep-preview-rig.mjs.
export function repWindows() {
  const windows = []
  for (let i = 0; i < N_REPS; i++) {
    const start = LEAD_IN + i * CYCLE
    const end = start + REP_DUR
    windows.push({ start, end: Math.min(DURATION, end + 0.15) })
  }
  return windows
}

// ---------- Baggrundsstøj: rumlig, deterministisk, beregnet ÉN gang ----------
function noise2D(x, y) {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
  return (s - Math.floor(s)) * 20 - 10
}
function buildBackground() {
  const bg = new Float32Array(W * H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      bg[y * W + x] = Math.max(0, Math.min(255, 118 + noise2D(x, y) + (x / W) * 18))
    }
  }
  return bg
}

// ---------- Skivens tekstur (1:1 samme design som tracker-live-bench.mjs, skaleret) ----------
function ringBlobHit(dx, dy, r) { return Math.hypot(dx, dy) < r }
function plateValue(t, x, y, cx, cy) {
  const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy)
  if (r >= PLATE_R) return null
  let v = 42
  if (r > PLATE_R - 6 * SCALE) v = 66
  if (r > PLATE_R * 0.55 && r < PLATE_R * 0.62) v = 155
  if (r < 11 * SCALE) v = 188
  const theta = t * 2.1
  for (const phi of [0, Math.PI * 0.9]) {
    const orbit = 14 * SCALE * (phi ? 2.3 : 1)
    const bx = cx + Math.cos(theta + phi) * orbit
    const by = cy + Math.sin(theta + phi) * orbit
    if (ringBlobHit(x - bx, y - by, 6.5 * SCALE)) v = 205
  }
  return v
}

// ---------- Render én frame ind i en RGB24-buffer (genbruger den faste baggrund) ----------
function renderFrame(bg, t, outBuf) {
  // bg -> outBuf (gråtone kopieret ud i tre kanaler)
  for (let i = 0; i < W * H; i++) {
    const v = bg[i]
    const o = i * 3
    outBuf[o] = v; outBuf[o + 1] = v; outBuf[o + 2] = v
  }
  const { x: cx, y: cy } = truePos(t)
  const pad = Math.ceil(PLATE_R + 4)
  const x0 = Math.max(0, Math.floor(cx - pad)), x1 = Math.min(W - 1, Math.ceil(cx + pad))
  const y0 = Math.max(0, Math.floor(cy - pad)), y1 = Math.min(H - 1, Math.ceil(cy + pad))
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const v = plateValue(t, x, y, cx, cy)
      if (v == null) continue
      const o = (y * W + x) * 3
      outBuf[o] = v; outBuf[o + 1] = v; outBuf[o + 2] = v
    }
  }
}

async function encode() {
  const totalFrames = Math.round(DURATION * FPS)
  const args = [
    '-y',
    '-f', 'rawvideo', '-pixel_format', 'rgb24', '-video_size', `${W}x${H}`, '-framerate', String(FPS),
    '-i', 'pipe:0',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-pix_fmt', 'yuv420p',
    outPath,
  ]
  const ff = spawn(ffmpegPath, args, { stdio: ['pipe', 'ignore', 'inherit'] })
  const done = new Promise((resolve, reject) => {
    ff.on('error', reject)
    ff.on('close', code => code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`)))
  })

  const bg = buildBackground()
  const frameBuf = Buffer.alloc(W * H * 3)
  const startedAt = performance.now()
  for (let i = 0; i < totalFrames; i++) {
    const t = i / FPS
    renderFrame(bg, t, frameBuf)
    if (!ff.stdin.write(frameBuf)) await new Promise(r => ff.stdin.once('drain', r))
  }
  ff.stdin.end()
  await done
  const ms = performance.now() - startedAt
  console.log(`${totalFrames} frames renderet og kodet på ${(ms / 1000).toFixed(1)}s -> ${outPath}`)
}

function writeGroundTruth() {
  const totalFrames = Math.round(DURATION * FPS)
  const samples = []
  for (let i = 0; i < totalFrames; i++) {
    const t = i / FPS
    const p = truePos(t)
    samples.push({ t: +t.toFixed(4), x: +p.x.toFixed(3), y: +p.y.toFixed(3) })
  }
  const gt = {
    width: W, height: H, fps: FPS, plateRadius: PLATE_R, cx0: CX, duration: DURATION,
    startPoint: { x: CX, y: worldY(0) },
    repWindows: repWindows(),
    samples,
  }
  writeFileSync(groundTruthPath, JSON.stringify(gt))
  console.log(`Facit skrevet -> ${groundTruthPath}`)
}

async function main() {
  writeGroundTruth()
  await encode()
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => { console.error(err); process.exitCode = 1 })
}
