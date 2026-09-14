// ORDRE 200 — kører coach-sporing.spec.mjs (den ægte klik-igennem-sporing af
// coachens eget stangbane-flow, se e2e/coach-sporing.spec.mjs's egen
// toptekst) N gange i træk med FRISK mock/browser pr. kørsel, og skriver en
// tabel (gennemført ja/nej, sporingens slutprocent, tid). Bruges til at
// afgøre om prøven er pålidelig nok til at komme ind i npm run e2e
// (ordrens egen regel: under 10/10 = IKKE i run-all.mjs). Ikke selv en del
// af npm run e2e — kør manuelt: `node e2e/coach-sporing-reliability.mjs [N]`
// (default 10).
import { createMockSupabase } from './mock-supabase.mjs'
import { buildSeed } from './fixtures.mjs'
import { startVite, launchBrowser, APP_URL, MOCK_PORT, OUT_DIR, ensureCoachSporingClip } from './harness.mjs'
import { runVideoUpload } from './video-upload.spec.mjs'
import { runCoachSporing } from './coach-sporing.spec.mjs'

const RUNS = Number(process.argv[2] || 10)

function extractPercent(message) {
  const m = /slutprocent: (\d+|null)%/.exec(message || '')
  return m ? m[1] : 'ukendt'
}

async function main() {
  const { path: clipPath, generatedMs } = ensureCoachSporingClip()
  console.log(`Klip klar: ${clipPath}`)
  console.log(`Generering: ${generatedMs == null ? 'genbrugt (allerede genereret i dette arbejdstræ)' : generatedMs + 'ms'}`)

  const rows = []
  for (let i = 1; i <= RUNS; i++) {
    const mock = createMockSupabase(buildSeed({}))
    await mock.listen(MOCK_PORT)
    const vite = await startVite()
    const browser = await launchBrowser()
    const mockUrl = `http://127.0.0.1:${MOCK_PORT}`
    const opts = { appUrl: APP_URL, mockUrl, outDir: OUT_DIR }
    const t0 = Date.now()
    const outcome = { run: i, ok: false, percent: null, seconds: null, error: null }
    try {
      const page1 = await browser.newPage({ viewport: { width: 390, height: 844 } })
      const awaitingRow = await runVideoUpload(page1, { ...opts, clipPath })
      await page1.close()

      const page2 = await browser.newPage({ viewport: { width: 1280, height: 900 } })
      await runCoachSporing(page2, { ...opts, awaitingRow, clipPath })
      await page2.close()
      outcome.ok = true
      outcome.percent = 100
    } catch (err) {
      outcome.error = err.message
      outcome.percent = extractPercent(err.message)
    } finally {
      outcome.seconds = ((Date.now() - t0) / 1000).toFixed(1)
      await browser.close().catch(() => {})
      await vite.stop().catch(() => {})
      await mock.close().catch(() => {})
    }
    rows.push(outcome)
    console.log(`RUN ${i}: ${outcome.ok ? 'OK' : 'FEJL'} · slutprocent ${outcome.percent}% · ${outcome.seconds}s${outcome.error ? ' — ' + outcome.error : ''}`)
  }

  console.log('\n--- SAMLET ---')
  const okCount = rows.filter(r => r.ok).length
  console.log(`${okCount}/${RUNS} gennemført`)
  console.log('\n| Kørsel | Gennemført | Slutprocent | Tid |')
  console.log('|---|---|---|---|')
  for (const r of rows) console.log(`| ${r.run} | ${r.ok ? 'Ja' : 'Nej'} | ${r.percent}% | ${r.seconds}s |`)
  process.exitCode = okCount === RUNS ? 0 : 1
}
main()
