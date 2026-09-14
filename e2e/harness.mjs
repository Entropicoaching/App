// ORDRE 153 — delt opstart/nedlukning for e2e-specsne: Chromium (fra den delte
// codex-runtime — samme kilde og begrundelse som scripts/maal-app.mjs allerede
// bruger: intet lokalt node_modules/playwright, og ingen grund til at
// tilføje puppeteer #2 i dette repo, jf. ordrens "ingen ny runtime-afhængighed"),
// og en rigtig `vite`-dev-server der peger på .env.e2e.

import { spawn, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { existsSync, mkdirSync, copyFileSync } from 'node:fs'
import ffmpegPath from 'ffmpeg-static'

const require = createRequire(import.meta.url)
const runtimeModules = join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules')
export const { chromium } = require(join(runtimeModules, 'playwright'))

export const ROOT = join(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), '..')
export const OUT_DIR = join(ROOT, 'outputs', 'e2e')
mkdirSync(OUT_DIR, { recursive: true })

export const VITE_PORT = Number(process.env.E2E_VITE_PORT || 5185)
export const MOCK_PORT = Number(process.env.E2E_MOCK_PORT || 8991)
export const APP_URL = `http://127.0.0.1:${VITE_PORT}/`

function waitForHttp(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      fetch(url).then(() => resolve()).catch(() => {
        if (Date.now() > deadline) reject(new Error(`Timeout: ${url} svarede aldrig`))
        else setTimeout(tryOnce, 200)
      })
    }
    tryOnce()
  })
}

// Starter `vite` i e2e-mode (læser .env.e2e, se vite's egen env-mode-regel)
// på en fast port, så .env.e2e kan pege på en kendt VITE_SUPABASE_URL.
export async function startVite() {
  // Kør vites egen JS-indgang direkte med node (i stedet for .bin/vite.cmd) —
  // undgår både "spawn EINVAL" for .cmd-shims på Windows og den uescaperede
  // shell:true-advarsel det ellers kræver.
  const viteJs = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js')
  const child = spawn(process.execPath, [viteJs, '--mode', 'e2e', '--port', String(VITE_PORT), '--strictPort', '--host', '127.0.0.1'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let out = ''
  child.stdout.on('data', d => { out += d })
  child.stderr.on('data', d => { out += d })
  try {
    await waitForHttp(APP_URL, 30000)
  } catch (err) {
    child.kill()
    throw new Error(`vite dev-server startede ikke: ${err.message}\n${out}`)
  }
  return {
    child,
    async stop() {
      child.kill()
      await new Promise(resolve => child.once('exit', resolve))
    },
  }
}

export async function launchBrowser() {
  return chromium.launch({ headless: true })
}

// ORDRE 155 · commit 1 — testklippet ordren peger på
// (test-clips/vis-mig-nu-4-reps-realistisk.mp4) findes ikke i dette repo
// (test-clips/ er git-ignoreret, personoptagelse — kun marc-doedloeft-270.mov
// ligger lokalt). Faldet tilbage til ordrens eget alternativ: "et 2 s
// syntetisk klip lavet i testen". Standardvejen (se videocoach.html's
// vcAthleteUploadAndGo) kræver INGEN sporbar stangbane — kun en video Chromium
// kan afspille metadata for (video.videoWidth > 0) — så et rent ffmpeg-
// testsrc-mønster er nok; ingen tegnet skive nødvendig (til forskel fra
// scripts/make-test-clip.mjs, som findes til selve TRACKER-testen).
const CLIP_PATH = join(tmpdir(), 'entropi-e2e-synthetic-clip.mp4')
export function ensureSyntheticClip() {
  if (existsSync(CLIP_PATH)) return CLIP_PATH
  const result = spawnSync(ffmpegPath, [
    '-y', '-f', 'lavfi', '-i', 'testsrc=duration=2:size=480x854:rate=10',
    '-pix_fmt', 'yuv420p', CLIP_PATH,
  ])
  if (result.status !== 0) throw new Error(`ffmpeg kunne ikke lave testklippet: ${result.stderr}`)
  return CLIP_PATH
}

// ORDRE 200 — coach-sporing.spec.mjs's eget, sporbare klip (en tegnet skive
// med ægte kontrast, ikke bare testsrc-mønsteret ovenfor). ORDRE 190 så det
// FULDE, urørte klip fra scripts/make-test-clip.mjs (alle 5 reps, ~20s)
// lykkes to gange, mens et beskåret udsnit under 300 KB konsekvent fejlede
// — men ORDRE 200's egen, langt mere systematiske 10x-afprøvning af det
// FULDE klip viste 0/10 (se docs/RAPPORT-200.md) — "det fulde klip virker
// pålideligt" er IKKE bekræftet, snarere modbevist. Klippet genereres
// alligevel her (ikke committet — for stort, og "ingen commit af
// videofiler" er en hård grænse denne gang), da selve genererings-
// infrastrukturen er uafhængig af sporings-pålideligheden og nyttig for et
// fremtidigt forsøg — genbruges på tværs af kørsler i samme arbejdstræ.
const COACH_SPORING_CLIP_PATH = join(ROOT, 'test-clips', '_e2e', 'coach-sporing-full.mp4')
export function ensureCoachSporingClip() {
  if (existsSync(COACH_SPORING_CLIP_PATH)) return { path: COACH_SPORING_CLIP_PATH, generatedMs: null }
  mkdirSync(join(ROOT, 'test-clips', '_e2e'), { recursive: true })
  const t0 = Date.now()
  const result = spawnSync(process.execPath, ['scripts/make-test-clip.mjs'], { cwd: ROOT, stdio: 'inherit' })
  if (result.status !== 0) throw new Error('scripts/make-test-clip.mjs fejlede ved generering af coach-sporing-klippet')
  const generatedMs = Date.now() - t0
  copyFileSync(join(ROOT, 'docs', 'videocoach', 'clip-cache', 'synthetic-set.mp4'), COACH_SPORING_CLIP_PATH)
  return { path: COACH_SPORING_CLIP_PATH, generatedMs }
}
