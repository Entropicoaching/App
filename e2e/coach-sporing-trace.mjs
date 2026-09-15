// ORDRE 211 · commit 1 — instrumentér, ændr intet. Kører ordre 200's egen
// coach-sporing.spec.mjs ÉN gang med traceOut sat (se den fils kommentar),
// og skriver en pr.-frame + pr.-rep facit-sammenligning til
// outputs/_seneste/sporing-trace/. Rører ikke selve tracker- eller
// rep-detektionslogikken — kun det eksisterende, allerede guardede
// TRACKER_BENCHMARK/TRACKER_PROBE-spor tændes (?benchmark=1&trackerProbe=1),
// og ÉT nyt felt (path.analysis-uddrag) er tilføjet til det samme,
// eksisterende run-objekt i public/videocoach.html.
//
// Kørsel: node e2e/coach-sporing-trace.mjs
//   --glat            brug scripts/make-test-clip.mjs's --glat-variant
//                      (smoothstep-vending + pause i bunden, ORDRE 221 ·
//                      commit 1) i stedet for standardklippet. Sætter
//                      VC_CLIP_GLAT=1 i PROCES-env (ikke .env-filer, ikke
//                      bruger-miljøet — se CLAUDE.local.mds hårde regel om
//                      det) FØR truePos/worldY kaldes, så facit matcher det
//                      klip der rent faktisk blev sporet.
//   --max-minutes=N    ingen 120s-standardgrænse — sporingen får op til N
//                      minutter (default 40) til at blive færdig ÉN gang.
//                      progressLog (banner/procent pr. 2s) gemmes uanset
//                      udfald, så et fund overlever selv et reelt timeout.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createMockSupabase } from './mock-supabase.mjs'
import { buildSeed } from './fixtures.mjs'
import { startVite, launchBrowser, APP_URL, MOCK_PORT, OUT_DIR, ensureCoachSporingClip } from './harness.mjs'
import { runVideoUpload } from './video-upload.spec.mjs'
import { runCoachSporing } from './coach-sporing.spec.mjs'

const GLAT = process.argv.includes('--glat')
if (GLAT) process.env.VC_CLIP_GLAT = '1' // FØR make-test-clip.mjs importeres nedenfor — se toptekst
const maxMinutesArg = process.argv.find(a => a.startsWith('--max-minutes='))
const MAX_MINUTES = maxMinutesArg ? Number(maxMinutesArg.split('=')[1]) : (GLAT ? 40 : null)
const MAX_ITERATIONS = MAX_MINUTES ? Math.ceil(MAX_MINUTES * 60 / 2) : undefined

const { truePos, repWindows, DURATION } = await import('../scripts/make-test-clip.mjs')

const TRACE_DIR = join(OUT_DIR, '..', 'sporing-trace')
mkdirSync(TRACE_DIR, { recursive: true })

async function main() {
  const { path: clipPath, generatedMs } = ensureCoachSporingClip(GLAT ? 'glat' : undefined)
  console.log(`Klip klar (variant: ${GLAT ? 'glat' : 'standard'}): ${clipPath} (${generatedMs == null ? 'genbrugt' : generatedMs + 'ms'})`)
  if (MAX_MINUTES) console.log(`Ingen 120s-grænse denne kørsel: op til ${MAX_MINUTES} minutter.`)

  const mock = createMockSupabase(buildSeed({}))
  await mock.listen(MOCK_PORT)
  const mockUrl = `http://127.0.0.1:${MOCK_PORT}`
  // .env.e2e hardkoder VITE_SUPABASE_URL til port 8991 — uafhængigt af
  // E2E_MOCK_PORT. Da flere sessioner deler standardporten, overstyres den
  // her via en rigtig proces-miljøvariabel (Vite lader shell-env vinde over
  // .env-filen), så en anden E2E_MOCK_PORT rent faktisk bruges af den byggede
  // app, ikke kun af selve mock-serveren. Rører ikke .env.e2e.
  process.env.VITE_SUPABASE_URL = mockUrl
  const vite = await startVite()
  const browser = await launchBrowser()
  const opts = { appUrl: APP_URL, mockUrl, outDir: OUT_DIR }
  const traceOut = {}
  let caughtError = null

  try {
    const page1 = await browser.newPage({ viewport: { width: 390, height: 844 } })
    const awaitingRow = await runVideoUpload(page1, { ...opts, clipPath })
    await page1.close()

    const page2 = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    try {
      await runCoachSporing(page2, { ...opts, awaitingRow, clipPath, traceOut, maxIterations: MAX_ITERATIONS })
    } catch (err) {
      caughtError = err.message // FORVENTET (se docs/RAPPORT-200.md) — traceOut er alligevel udfyldt
    }
    await page2.close()
  } finally {
    await browser.close().catch(() => {})
    await vite.stop().catch(() => {})
    await mock.close().catch(() => {})
  }

  const run = traceOut.benchmarkRun
  if (!run) {
    // ORDRE 221 · commit 1 — et reelt timeout (traceOut.timedOut, kun muligt
    // med --max-minutes) publicerer aldrig window.__vcTrackerBenchmarkLast
    // (den skrives kun ved selve sporings-loopets afslutning i
    // videocoach.html). progressLog (banner/procent pr. 2s-poll fra Node-
    // siden) er stadig et ærligt fund om "hvor langt/hvor hurtigt" — skriv
    // det som sit eget, mindre facit i stedet for kun at fejle.
    if (traceOut.timedOut && traceOut.progressLog?.length) {
      const log = traceOut.progressLog
      const out = {
        variant: GLAT ? 'glat' : 'standard', timedOut: true,
        maxMinutes: MAX_MINUTES, clipDurationS: DURATION,
        sidsteBanner: traceOut.lastBanner, sidstePercent: traceOut.lastPercent,
        progressLog: log,
      }
      const outPath = join(TRACE_DIR, `run-timeout-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
      writeFileSync(outPath, JSON.stringify(out, null, 2))
      writeFileSync(join(TRACE_DIR, 'seneste.json'), JSON.stringify(out, null, 2))
      const totalS = log.at(-1).tMs / 1000
      console.log(`\nALDRIG FÆRDIG inden for ${MAX_MINUTES} min (${totalS.toFixed(1)}s ægte ventetid).`)
      console.log(`Sidste banner: "${traceOut.lastBanner}" (${traceOut.lastPercent}%)`)
      console.log(`Klippets varighed: ${DURATION}s — så ~${totalS.toFixed(1)}s ægte tid pr. ${(traceOut.lastPercent ?? 0) / 100 * DURATION | 0}s video processeret indtil videre.`)
      console.log(`\nSkrevet: ${outPath}`)
      process.exitCode = 1
      return
    }
    console.error('Intet benchmark-run fanget — instrumenteringen (?benchmark=1) nåede aldrig frem. Se traceOut:', traceOut)
    writeFileSync(join(TRACE_DIR, 'RAW-traceOut-fejlet.json'), JSON.stringify(traceOut, null, 2))
    process.exitCode = 1
    return
  }

  // ---- Pr.-frame facit-sammenligning ----
  const probeByT = new Map((run.frameProbe || []).map(p => [p.t, p]))
  const frames = run.times.map((t, i) => {
    const truth = truePos(t)
    const found = run.pts[i]
    const dist = Math.hypot(found.x - truth.x, found.y - truth.y)
    const probe = probeByT.get(t) || null
    return {
      i, t: +t.toFixed(4), foundX: +found.x.toFixed(2), foundY: +found.y.toFixed(2),
      trueX: +truth.x.toFixed(2), trueY: +truth.y.toFixed(2), distPx: +dist.toFixed(2),
      valid: run.valid[i], confidence: +((run.confidence[i] ?? 0).toFixed(3)),
      rejectGate: probe ? probe.rejectGate || null : (i === 0 ? 'anchor-frame' : 'skipped-quiet-fast-path'),
    }
  })

  // ---- Pr.-rep facit-sammenligning (ground truth = repWindows() fra generatoren) ----
  const truth = repWindows()
  const detectedReps = run.analysis ? run.analysis.reps : []
  const repRows = detectedReps.map((rep, idx) => {
    const startT = run.times[rep.start], endT = run.times[rep.end]
    // nærmeste sande rep-vindue (efter midtpunktstid), kun til rapportering.
    const midT = (startT + endT) / 2
    let nearest = 0, bestDist = Infinity
    truth.forEach((w, wi) => {
      const wMid = (w.start + w.end) / 2
      const d = Math.abs(midT - wMid)
      if (d < bestDist) { bestDist = d; nearest = wi }
    })
    const measurable = Number.isFinite(rep.mcv) && Number.isFinite(rep.romCm)
    const window = frames.slice(rep.start, rep.end + 1)
    const positiveVelocitySamples = window.filter(f => f.valid).length // grov proxy, se noten i rapporten
    return {
      detectedIndex: idx, startT: +startT.toFixed(3), endT: +endT.toFixed(3),
      naermesteSandeRep: nearest + 1, afstandTilSandtMidtpunktS: +bestDist.toFixed(3),
      mcv: rep.mcv, romCm: rep.romCm, validRatio: rep.validRatio, measurable,
      framesIVindue: window.length, gyldigeFramesIVindue: positiveVelocitySamples,
    }
  })

  // ORDRE 221 · commit 1 — aktiv-mod-springer fordeling: en frame uden
  // probe-indgang (frameProbe dækker kun det RIGTIGE match-forsøg) er enten
  // ankerframen (i===0) eller sprunget over af VC_TRACKER_FASTs
  // QUIET_NEEDED-genvej (se public/videocoach.html linje ~4742) — begge
  // allerede mærket af rejectGate-feltet ovenfor, udledt af eksisterende,
  // allerede-publicerede felter, INGEN ny instrumentering i videocoach.html.
  const skippedCount = frames.filter(f => f.rejectGate === 'skipped-quiet-fast-path').length
  const activeCount = frames.length - skippedCount
  const msPerVideoSecond = run.mediaSeconds > 0 ? run.elapsedMs / run.mediaSeconds : null

  const out = {
    variant: GLAT ? 'glat' : 'standard',
    clip: { durationS: DURATION, sandeRepVinduer: truth },
    resultat: { tracked: traceOut.tracked, lastBanner: traceOut.lastBanner, lastPercent: traceOut.lastPercent, caughtError },
    raw: { outcome: run.outcome, frames: run.pts.length, invalidFrames: run.valid.filter(v => !v).length,
      lowConf: run.lowConf, homeRecoveries: run.homeRecoveries, mediaSeconds: run.mediaSeconds,
      elapsedMs: run.elapsedMs, msPerVideoSecond: msPerVideoSecond == null ? null : +msPerVideoSecond.toFixed(0),
      activeFrames: activeCount, skippedFrames: skippedCount,
      endedAtT: run.endedAt, sluttedFoerKlippetSluttedS: +(DURATION - (run.endedAt ?? DURATION)).toFixed(3) },
    repsDetekteret: run.analysis ? run.analysis.repsDetectedCount : null,
    repRows,
    frames,
  }
  const outPath = join(TRACE_DIR, `run-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  writeFileSync(outPath, JSON.stringify(out, null, 2))
  writeFileSync(join(TRACE_DIR, 'seneste.json'), JSON.stringify(out, null, 2))

  console.log(`\nResultat (variant: ${out.variant}): tracked=${traceOut.tracked} slutprocent=${traceOut.lastPercent}% banner="${traceOut.lastBanner}"`)
  console.log(`Frames: ${run.pts.length}, ugyldige: ${run.valid.filter(v => !v).length}, sluttede ved t=${run.endedAt?.toFixed(2)}s (klip: ${DURATION}s)`)
  console.log(`Aktiv sporing: ${activeCount} frames · Sprunget over (QUIET_NEEDED): ${skippedCount} frames`)
  console.log(`Reel tid pr. sekund video: ${msPerVideoSecond == null ? 'n/a' : (msPerVideoSecond / 1000).toFixed(2) + 's/s'} (elapsedMs=${run.elapsedMs?.toFixed(0)} / mediaSeconds=${run.mediaSeconds?.toFixed(2)})`)
  console.log(`homeRecoveries: ${run.homeRecoveries}`)
  console.log(`Reps detekteret: ${out.repsDetekteret ?? 'n/a'} / 5 sande`)
  for (const r of repRows) {
    console.log(`  detekteret rep ${r.detectedIndex + 1} (≈sand rep ${r.naermesteSandeRep}): mcv=${r.mcv} romCm=${r.romCm} measurable=${r.measurable} validRatio=${r.validRatio}`)
  }
  console.log(`\nSkrevet: ${outPath}`)
}

main().catch(err => { console.error(err); process.exitCode = 1 })
