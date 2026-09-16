// ORDRE 245 · commit 1 — den sidste blinde vinkel: det rigtige
// klik-igennem-flow (upload → ⚡ → klik skiven → ⚡ igen → send), kørt mod et
// RIGTIGT klip (ikke det syntetiske testsrc/tegnede-skive-klip andre e2e-
// specs bruger), ventende på det FAKTISKE udfald — arket åbner med et
// rep-resultat, eller "Stangen blev tabt" (225 · commit 2's ærlige loft) —
// aldrig et timeout uden begrundelse.
//
// Stå på skuldre: samme klip/klikpunkt/dimensioner som 221/225's
// e2e/coach-sporing-trace-real.mjs (KNOWN_TARGET, VIDEO_DIMS — hånd-målt,
// se den fils egen kommentar), samme flow-funktion (coach-sporing.spec.mjs's
// runCoachSporing, uændret ud over 245's egen rettelse af den manglende
// "Stangen blev tabt"-genkendelse i confirmAndWaitForTracking). Klippet
// (test-clips/marc-doedloeft-270.mov) er git-ignoreret persondata — findes
// det ikke lokalt, springer scriptet ærligt over (samme mønster som
// trace-real.mjs), det er ALDRIG en "grøn" prøve uden klippet.
//
// Kørsel:
//   node e2e/coach-sporing-rigtigt-klip.mjs            — én kørsel (exit 1 ved fejl/manglende klip)
//   node e2e/coach-sporing-rigtigt-klip.mjs --gentag=5 — N kørsler i træk, skriver facit-tabel
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createMockSupabase } from './mock-supabase.mjs'
import { buildSeed } from './fixtures.mjs'
import { startVite, launchBrowser, APP_URL, MOCK_PORT, OUT_DIR, ROOT } from './harness.mjs'
import { runVideoUpload } from './video-upload.spec.mjs'
import { runCoachSporing } from './coach-sporing.spec.mjs'

export const CLIP_FILE = 'marc-doedloeft-270.mov'
export const CLIP_PATH = join(ROOT, 'test-clips', CLIP_FILE)
// Samme hånd-målte punkt som e2e/coach-sporing-trace-real.mjs — ingen ny måling.
const CLICK_AT_S = 1.0
const CLICK_TARGET = { x: 700, y: 1230 }
const VIDEO_DIMS = { w: 1440, h: 1920 }
const LIFT_LABEL = 'Dødløft'

// ORDRE 245 · commit 1 — loftet sat FRA TALLENE, ikke gættet: 5/5 kørsler
// (efter rettelsen af sheet-allerede-åben-fejlen, se coach-sporing.spec.mjs)
// landede på 29,5-29,8s ægte tid (0,3s spredning — se
// docs/RAPPORT-245.md). 30×2s=60s giver >2x margin til den langsomste
// målte kørsel, langt strammere end runCoachSporing's egen 120s-standard
// (sat for det syntetiske ordre-200/221-klip, en anden, mere variabel
// profil uden gentagne målinger bag sig).
export const MAX_ITERATIONS = 30

export function clipAvailable() {
  return existsSync(CLIP_PATH)
}

// Én kørsel af hele klik-igennem-flowet. Returnerer { ok, ms, outcome, error }.
// ok=false med error=null betyder: flowet kørte FÆRDIGT til et ærligt,
// negativt udfald (fx "Stangen blev tabt") — ikke et hæng eller en ukendt fejl.
export async function runOnce({ maxIterations = MAX_ITERATIONS } = {}) {
  const mock = createMockSupabase(buildSeed({}))
  await mock.listen(MOCK_PORT)
  const mockUrl = `http://127.0.0.1:${MOCK_PORT}`
  process.env.VITE_SUPABASE_URL = mockUrl
  const vite = await startVite()
  const browser = await launchBrowser()
  const opts = { appUrl: APP_URL, mockUrl, outDir: OUT_DIR }
  const t0 = Date.now()
  let outcome = 'ukendt'
  let error = null
  try {
    const page1 = await browser.newPage({ viewport: { width: 390, height: 844 } })
    const awaitingRow = await runVideoUpload(page1, { ...opts, clipPath: CLIP_PATH, liftLabel: LIFT_LABEL })
    await page1.close()

    const page2 = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    try {
      const row = await runCoachSporing(page2, {
        ...opts, awaitingRow, clipPath: CLIP_PATH, maxIterations,
        clickAtS: CLICK_AT_S, clickTarget: CLICK_TARGET, videoW: VIDEO_DIMS.w, videoH: VIDEO_DIMS.h,
      })
      outcome = `arket åbnede med resultat, sendt (cm_per_px=${row.bar_path.cm_per_px.toFixed(3)})`
    } finally {
      await page2.close()
    }
  } catch (err) {
    error = err.message || String(err)
    outcome = error.includes('Stangen blev tabt') ? 'Stangen blev tabt (ærligt 10s-loft, se ordre 225)'
      : error.includes('aldrig færdig inden for') ? `IKKE færdig inden for ${maxIterations * 2}s-loftet`
      : error.includes('fandt ikke skiven') ? 'kalibrering fejlede'
      : 'anden fejl'
  } finally {
    await browser.close().catch(() => {})
    await vite.stop().catch(() => {})
    await mock.close().catch(() => {})
  }
  return { ok: !error, ms: Date.now() - t0, outcome, error }
}

async function main() {
  const gentagArg = process.argv.find(a => a.startsWith('--gentag='))
  const GENTAG = gentagArg ? Number(gentagArg.split('=')[1]) : 1

  if (!clipAvailable()) {
    console.log(`SPRUNGET OVER: ${CLIP_PATH} findes ikke lokalt (test-clips/ er git-ignoreret persondata).`)
    process.exitCode = 0
    return
  }

  const results = []
  for (let i = 1; i <= GENTAG; i++) {
    console.log(`— kørsel ${i}/${GENTAG} —`)
    const r = await runOnce()
    results.push(r)
    console.log(`  ${r.ok ? 'GRØN' : 'RØD'} · ${(r.ms / 1000).toFixed(1)}s · ${r.outcome}`)
  }

  if (GENTAG > 1) {
    const lines = []
    lines.push(`# Rigtigt klip, ${GENTAG} kørsler i træk — ordre 245`)
    lines.push('')
    lines.push(`Klip: \`${CLIP_FILE}\` · loft: ${MAX_ITERATIONS * 2}s pr. kørsel.`)
    lines.push('')
    lines.push('| # | Resultat | Varighed | Udfald |')
    lines.push('|---|---|---|---|')
    results.forEach((r, i) => lines.push(`| ${i + 1} | ${r.ok ? 'GRØN' : 'RØD'} | ${(r.ms / 1000).toFixed(1)}s | ${r.outcome} |`))
    const greenCount = results.filter(r => r.ok).length
    const times = results.map(r => r.ms / 1000)
    lines.push('')
    lines.push(`**${greenCount}/${GENTAG} grønne.** Varighed: ${Math.min(...times).toFixed(1)}s–${Math.max(...times).toFixed(1)}s.`)
    const report = lines.join('\n') + '\n'
    console.log('\n' + report)
    mkdirSync(OUT_DIR, { recursive: true })
    const outPath = join(OUT_DIR, '..', 'coach-sporing-rigtigt-klip-gentaget.md')
    writeFileSync(outPath, report)
    console.log(`Skrevet: ${outPath}`)
    process.exitCode = greenCount === GENTAG ? 0 : 1
  } else {
    process.exitCode = results[0].ok ? 0 : 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => { console.error(err); process.exitCode = 1 })
}
