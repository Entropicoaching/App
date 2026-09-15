// ORDRE 221 · commit 3 — samme instrumentering som e2e/coach-sporing-trace.mjs
// (?benchmark=1&trackerProbe=1, path.analysis-uddrag, ordre 221 · commit 1+2s
// recoveryGate), men kørt mod RIGTIGE klip (test-clips\marc-doedloeft-270.mov,
// test-clips\vis-mig-nu-4-reps-realistisk.mp4) i stedet for det syntetiske.
// Ingen facit-position findes for et rigtigt klip (ingen truePos()) — denne
// fil rapporterer derfor IKKE en distPx-sammenligning, kun rå tabsepisoder
// (sammenhængende invalid-frame-vinduer) og hvad recoveryGate (ordre 221 ·
// commit 2) fandt undervejs. Klik-punktet er MÅLT I HÅNDEN (samme metode og
// samme tal som scripts/verify-videocoach-plate-detect.mjs's KNOWN_CLIPS —
// marc-doedloeft-270.mov, cx=700,cy=1230 ved 1440×1920, ca. t=1,0s), IKKE en
// uafhængig facit. Ingen atletdata skrives til disk her eller i rapporten —
// kun tal (tidspunkter, pixel-afstande).
//
// Kørsel: node e2e/coach-sporing-trace-real.mjs
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createMockSupabase } from './mock-supabase.mjs'
import { buildSeed } from './fixtures.mjs'
import { startVite, launchBrowser, APP_URL, MOCK_PORT, OUT_DIR, ROOT } from './harness.mjs'
import { runVideoUpload } from './video-upload.spec.mjs'
import { runCoachSporing } from './coach-sporing.spec.mjs'

const TRACE_DIR = join(OUT_DIR, '..', 'sporing-trace-real')
mkdirSync(TRACE_DIR, { recursive: true })

// Klik-punktet er det SAMME hånd-målte punkt for begge klip (den realistiske
// fil er bogstaveligt Marcs egen rep, frame-gentaget/strukket — se
// scripts/make-realistic-test-clip.mjs) — ved t=1,0s i den strukkede fil
// svarer det til original-tid ≈0,85s, tæt nok på frame 30 til at
// calibrate()s egne 4 gentagelsesforsøg (med forskudte klik) kan nå ringen.
const KNOWN_TARGET = { x: 700, y: 1230 }
const VIDEO_DIMS = { w: 1440, h: 1920 }

const CLIPS = [
  { name: 'marc-doedloeft-270.mov', file: 'marc-doedloeft-270.mov', liftLabel: 'Dødløft', clickAtS: 1.0 },
  { name: 'vis-mig-nu-4-reps-realistisk.mp4', file: 'vis-mig-nu-4-reps-realistisk.mp4', liftLabel: 'Dødløft', clickAtS: 1.0 },
]

// Sammenhængende invalid-frame-vinduer ("tabsepisoder") — ingen facit-Y til
// rådighed for et rigtigt klip, så "genfundet" her betyder: sporingen blev
// gyldig igen FØR klippet sluttede (ikke at positionen er korrekt).
function findLossEpisodes(run) {
  const episodes = []
  let cur = null
  for (let i = 0; i < run.valid.length; i++) {
    if (!run.valid[i]) {
      if (!cur) cur = { startIdx: i }
    } else if (cur) {
      cur.endIdx = i - 1
      episodes.push(cur)
      cur = null
    }
  }
  if (cur) { cur.endIdx = run.valid.length - 1; cur.open = true; episodes.push(cur) }
  return episodes.map(ep => {
    const beforeIdx = Math.max(0, ep.startIdx - 1)
    const afterIdx = ep.open ? null : ep.endIdx + 1
    const before = run.pts[beforeIdx], after = afterIdx != null ? run.pts[afterIdx] : null
    const jumpPx = after ? +Math.hypot(after.x - before.x, after.y - before.y).toFixed(2) : null
    const recoveryGatesInWindow = (run.frameProbe || [])
      .filter(p => p.t >= run.times[ep.startIdx] && p.t <= run.times[ep.endIdx] && p.recoveryGate)
      .map(p => p.recoveryGate)
    return {
      startT: +run.times[ep.startIdx].toFixed(3),
      endT: +run.times[ep.endIdx].toFixed(3),
      durationS: +(run.times[ep.endIdx] - run.times[ep.startIdx]).toFixed(3),
      framesTabt: ep.endIdx - ep.startIdx + 1,
      aldrigGenfundetFoerKlipSlut: !!ep.open,
      genfundetVedT: afterIdx != null ? +run.times[afterIdx].toFixed(3) : null,
      hopVedGenfindingPx: jumpPx,
      recoveryGates: recoveryGatesInWindow,
      homeRecoveryForsoegt: recoveryGatesInWindow.length > 0,
    }
  })
}

async function runOne(clip) {
  const clipPath = join(ROOT, 'test-clips', clip.file)
  if (!existsSync(clipPath)) {
    console.log(`SPRINGER OVER ${clip.name}: findes ikke i test-clips\\ (git-ignoreret, kun lokalt).`)
    return { clip: clip.name, skipped: true }
  }

  const mock = createMockSupabase(buildSeed({}))
  await mock.listen(MOCK_PORT)
  const mockUrl = `http://127.0.0.1:${MOCK_PORT}`
  process.env.VITE_SUPABASE_URL = mockUrl
  const vite = await startVite()
  const browser = await launchBrowser()
  const opts = { appUrl: APP_URL, mockUrl, outDir: OUT_DIR }
  const traceOut = {}
  let caughtError = null

  try {
    const page1 = await browser.newPage({ viewport: { width: 390, height: 844 } })
    const awaitingRow = await runVideoUpload(page1, { ...opts, clipPath, liftLabel: clip.liftLabel })
    await page1.close()

    const page2 = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    try {
      await runCoachSporing(page2, {
        ...opts, awaitingRow, clipPath, traceOut,
        // ORDRE 221 · commit 1 fandt ~74-190s ægte tid for et 20s syntetisk
        // klip under aktiv sporing (ingen 10x-straf, se docs/SVAR-221.md) —
        // et første forsøg her med 90 (180s) viste ÆGTE fremgang (96-99%,
        // ikke fastlåst) men nåede ikke i mål. 450×2s=900s (15 min) giver
        // reel plads, samme "ro til at afprøve"-princip som commit 1.
        maxIterations: 450,
        clickAtS: clip.clickAtS, clickTarget: KNOWN_TARGET, videoW: VIDEO_DIMS.w, videoH: VIDEO_DIMS.h,
      })
    } catch (err) {
      caughtError = err.message
    }
    await page2.close()
  } finally {
    await browser.close().catch(() => {})
    await vite.stop().catch(() => {})
    await mock.close().catch(() => {})
  }

  const run = traceOut.benchmarkRun
  // progressLog holder den SIDST SETE banner pr. 2s-poll, også en tom
  // transient — find seneste IKKE-tomme indslag til diagnosen (samme
  // "seneste ægte fremgang"-behov som commit 1's timeout-gren).
  const lastRealProgress = [...(traceOut.progressLog || [])].reverse().find(p => p.banner)
  const result = { clip: clip.name, tracked: traceOut.tracked, lastBanner: traceOut.lastBanner,
    lastPercent: traceOut.lastPercent, caughtError, timedOut: !!traceOut.timedOut,
    progressLog: traceOut.progressLog || [] }
  if (!run) {
    const kalibreretOK = !!lastRealProgress // banneret nåede "Analyserer"/"Holder" -> ringen blev fundet
    console.log(`${clip.name}: intet benchmark-run fanget (kalibrering ${kalibreretOK ? 'LYKKEDES' : 'MISLYKKEDES eller ukendt'}, ` +
      `seneste ægte fremgang: "${lastRealProgress?.banner ?? 'ingen'}") — fejl: "${caughtError}"`)
    return { ...result, kalibreretOK, run: null, lossEpisodes: [] }
  }
  const lossEpisodes = findLossEpisodes(run)
  result.kalibreretOK = true
  result.raw = { outcome: run.outcome, frames: run.pts.length, invalidFrames: run.valid.filter(v => !v).length,
    homeRecoveries: run.homeRecoveries, plateIdentityUsable: run.plateIdentityUsable, trackerMode: run.trackerMode,
    mediaSeconds: run.mediaSeconds, elapsedMs: run.elapsedMs }
  result.repsDetekteret = run.analysis ? run.analysis.repsDetectedCount : null
  result.lossEpisodes = lossEpisodes
  return result
}

async function main() {
  const results = []
  for (const clip of CLIPS) results.push(await runOne(clip))

  writeFileSync(join(TRACE_DIR, 'seneste.json'), JSON.stringify(results, null, 2))

  console.log('\n=== ORDRE 221 · commit 3 — rigtige klip, sammenfatning ===\n')
  console.log('| Klip | Kalibreret | Sporet igennem | Tabsepisoder | Genfundet (alle) | homeRecoveries |')
  console.log('|---|---|---|---|---|---|')
  for (const r of results) {
    if (r.skipped) { console.log(`| ${r.clip} | - | - | SPRINGET OVER (klip mangler) | - | - |`); continue }
    const allRecovered = r.lossEpisodes.length > 0 && r.lossEpisodes.every(e => !e.aldrigGenfundetFoerKlipSlut)
    console.log(`| ${r.clip} | ${r.kalibreretOK ? 'ja' : 'nej'} | ${r.tracked ?? (r.timedOut ? 'timeout' : 'nej')} | ${r.lossEpisodes.length} | ${r.lossEpisodes.length ? allRecovered : 'n/a'} | ${r.raw?.homeRecoveries ?? '-'} |`)
  }
  console.log()
  for (const r of results) {
    if (r.skipped || !r.run) continue
    console.log(`--- ${r.clip} (plateIdentityUsable=${r.raw.plateIdentityUsable}, trackerMode=${r.raw.trackerMode}) ---`)
    if (!r.lossEpisodes.length) console.log('  Ingen tabsepisoder — sporet aldrig mistet.')
    for (const e of r.lossEpisodes) {
      console.log(`  t=${e.startT}s-${e.endT}s (${e.durationS}s, ${e.framesTabt} frames): ` +
        `${e.aldrigGenfundetFoerKlipSlut ? 'ALDRIG genfundet' : `genfundet ved t=${e.genfundetVedT}s (hop ${e.hopVedGenfindingPx}px)`}` +
        ` — home-genfinding forsøgt: ${e.homeRecoveryForsoegt} (${e.recoveryGates.join(', ') || 'ingen'})`)
    }
  }
  writeFileSync(join(TRACE_DIR, `run-${new Date().toISOString().replace(/[:.]/g, '-')}.json`), JSON.stringify(results, null, 2))
}

main().catch(err => { console.error(err); process.exitCode = 1 })
