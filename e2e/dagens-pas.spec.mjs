// ORDRE 263 · commit 4 — beviser de to første commits klikket igennem i den
// ÆGTE, ubuildede app (npm run dev, ikke en harness) mod den lokale
// mock-backend, samme mønster som atlet.spec.mjs/fejl.spec.mjs: Dagens pas
// (Hjem-fanen) viser næste sæt direkte — log det derfra, uden at åbne
// Program-fanen — og pausetimeren starter af sig selv og tæller ned.
//
// Egen, isoleret mock+vite-instans (ikke wired ind i e2e/run-all.mjs's delte
// sekvens): den delte sekvens logger bevidst kun 3 af Squats 4 sæt (sæt 4 er
// reserveret til fejl.spec.mjs's offline-test, se fixtures.mjs) — at logge
// sæt 1 her via Dagens pas ville forskyde den choreografi. Egen kørsel:
// `npm run e2e:dagens-pas`.

import assert from 'node:assert/strict'
import { join } from 'node:path'
import { ATHLETE_USER, EXERCISE_ID } from './fixtures.mjs'

async function readTable(mockUrl, name) {
  const res = await fetch(`${mockUrl}/__e2e/table?name=${encodeURIComponent(name)}`)
  return res.json()
}

/** `page` er en frisk Playwright-side, `appUrl`/`mockUrl` peger på den
 * kørende vite-server hhv. mock-backend. */
export async function runDagensPasPause(page, { appUrl, mockUrl, outDir }) {
  const shot = (name) => page.screenshot({ path: join(outDir, `dagens-pas-${name}.png`), fullPage: true })

  await page.goto(appUrl)
  await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
  await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()

  // Dagens pas: næste sæt vises øverst på Hjem, med det samme — ingen
  // navigation til Program-fanen nødvendig.
  await page.getByText('Dagens pas', { exact: true }).waitFor({ state: 'visible', timeout: 15000 })
  await page.getByText('Squat', { exact: true }).waitFor({ state: 'visible' })
  await page.getByText('Sæt 1/4', { exact: true }).waitFor({ state: 'visible' })
  // Ingen pause før noget er logget.
  assert.equal(await page.getByText('Pause', { exact: false }).count(), 0, 'ingen pausetimer må vises før et sæt er logget')
  await shot('01-naeste-saet')

  await page.getByLabel('Vægt, sæt 1').fill('80')
  await page.getByLabel('Reps, sæt 1').fill('5')
  await page.getByRole('button', { name: 'Godkendt', exact: true }).click()

  await page.waitForFunction(
    async (url) => {
      const res = await fetch(`${url}/__e2e/table?name=exercise_logs`)
      const rows = await res.json()
      return rows.filter(r => !r.skipped).length >= 1
    },
    mockUrl,
    { timeout: 10000 },
  )
  const logs = await readTable(mockUrl, 'exercise_logs')
  const set1 = logs.find(l => l.exercise_id === EXERCISE_ID && l.set_number === 1)
  assert.ok(set1, 'sæt 1 skal være logget i mockens exercise_logs')
  assert.equal(set1.weight, 80)
  assert.equal(set1.reps_completed, 5)

  // Pausetimeren starter automatisk — synlig med det samme, ingen navigation.
  // (teksten er "Pause · Squat" — øvelsesnavnet står med i samme span, se
  // RestPauseFooter i AthleteView.jsx — deraf exact: false.)
  await page.getByText('Pause', { exact: false }).waitFor({ state: 'visible', timeout: 5000 })
  const secondsText = () => page.getByText(/^\d+s$/).first().textContent()
  const firstReading = parseInt(await secondsText(), 10)
  assert.ok(Number.isFinite(firstReading) && firstReading > 0 && firstReading <= 90,
    `pausen skal starte med et positivt sekundtal (≤ 90s standard), fik "${firstReading}"`)
  await shot('02-pause-startet')

  // Den skal faktisk tælle ned (ikke stå stille) — vent til uret har rykket sig.
  await page.waitForFunction(
    (prev) => {
      const el = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && /^\d+s$/.test(e.textContent || ''))
      if (!el) return false
      return parseInt(el.textContent, 10) < prev
    },
    firstReading,
    { timeout: 5000 },
  )
  await shot('03-pause-taeller-ned')

  console.log(`GRØN: Dagens pas viser næste sæt (Squat, sæt 1/4), logger det direkte fra Hjem, og pausetimeren starter automatisk og tæller ned (${firstReading}s → lavere).`)
}

async function main() {
  const { createMockSupabase } = await import('./mock-supabase.mjs')
  const { buildSeed } = await import('./fixtures.mjs')
  const { startVite, launchBrowser, APP_URL, MOCK_PORT, OUT_DIR } = await import('./harness.mjs')

  const mock = createMockSupabase(buildSeed())
  await mock.listen(MOCK_PORT)
  const vite = await startVite()
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    page.on('pageerror', err => console.error('[browser pageerror]', err))
    page.on('console', msg => { if (msg.type() === 'error') console.error('[console.error]', msg.text()) })
    await runDagensPasPause(page, { appUrl: APP_URL, mockUrl: `http://127.0.0.1:${MOCK_PORT}`, outDir: OUT_DIR })
    process.exitCode = 0
  } catch (err) {
    console.error('\nFEJL:', err.message)
    process.exitCode = 1
  } finally {
    await browser.close()
    await vite.stop()
    await mock.close()
  }
}

if (process.argv[1] && process.argv[1].endsWith('dagens-pas.spec.mjs')) main()
