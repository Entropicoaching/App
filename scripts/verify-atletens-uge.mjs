// ORDRE 268 · commit 3 — beviser "Ugen som planlagt" (Hjem-fanen, ordre 268
// commit 1+2) i den ÆGTE, ubuildede app (npm run dev, ikke en harness) mod
// den lokale mock-backend, samme mønster som e2e/atlet.spec.mjs/
// e2e/dagens-pas.spec.mjs. Ligger bevidst i scripts/, ikke e2e/: Bhishak
// arbejder i entropi-app-wt2 på prøverne (ordre 269) og ordren forbyder at
// røre e2e/ og scripts/proever.mjs. Importerer kun (læser) eksporterede
// hjælpere fra e2e/mock-supabase.mjs, e2e/fixtures.mjs og e2e/harness.mjs —
// ingen af de filer er ændret. proever.mjs finder dette scriptet af sig selv
// (den læser verify:*-scripts fra package.json), ingen ændring der heller.
//
// Egen, isoleret mock+vite-instans (samme port-8991-grænse som de andre),
// wired ind via package.json's `verify:atletens-uge`.

import assert from 'node:assert/strict'
import { join } from 'node:path'

/** `page` er en frisk Playwright-side, `appUrl`/`mockUrl` peger på den
 * kørende vite-server hhv. mock-backend. */
export async function verUgenSomPlanlagt(page, { appUrl, mockUrl, outDir, athleteUser }) {
  const shot = (name) => page.screenshot({ path: join(outDir, `atletens-uge-${name}.png`), fullPage: true })

  await page.goto(appUrl)
  await page.locator('#athlete-auth-email').fill(athleteUser.email)
  await page.locator('#athlete-auth-password').fill(athleteUser.password)
  await page.getByRole('button', { name: 'Log ind' }).click()

  // "Ugen som planlagt" ligger bag folden "Mere" siden ORDRE 330.
  await page.getByRole('button', { name: 'Mere', exact: true }).click({ timeout: 15000 })
  await page.getByText('Ugen som planlagt', { exact: true }).waitFor({ state: 'visible', timeout: 15000 })
  await shot('01-denne-uge')

  // Seedet (buildSeed({ withLogs: true })): Squat, sets:4, reps:'4-6',
  // recommended_weight:80, logget i dag med 3 sæt (4,5,6 reps × 80kg).
  // Planlagt sæt=4 (fra programmet), planlagt tonnage=4×4×80=1280 (laveste
  // ende af "4-6", samme konvention som DagensPasCard). Gennemført sæt=3,
  // gennemført tonnage=80×(4+5+6)=1200. Begge tal står i én linje (ordre
  // 276 · blok 2, DagLinje) — "3/4 sæt · 1200kg / 1280kg".
  await page.getByText('3/4 sæt · 1200kg / 1280kg', { exact: true }).waitFor({ state: 'visible' })

  // Kun én dag har en session i seeden — resten skal vise "ingen fejl",
  // ikke et 0-tal der ligner en glemt træning.
  await page.getByText('Ingen træning planlagt', { exact: true }).first().waitFor({ state: 'visible' })

  // Kalder mockens tabel direkte for at bevise DOM-tallet stemmer med det
  // der faktisk ligger i backend, ikke kun en statisk tekststreng.
  const logsRes = await fetch(`${mockUrl}/__e2e/table?name=exercise_logs`)
  const logs = await logsRes.json()
  const gennemfoertSaet = logs.filter(l => !l.skipped).length
  assert.equal(gennemfoertSaet, 3, `forventede 3 gennemførte sæt i mockens exercise_logs, fik ${gennemfoertSaet}`)

  // "Hele forløbet" — seedens eneste uge har ingen start_date (samme
  // bevidste valg som src/volume/planlagt.test.js's fixture), så commit 2's
  // ærlige fallback skal vise sig, ikke et opdigtet tal.
  await page.getByRole('button', { name: 'Hele forløbet', exact: true }).click()
  await page.getByText('Ingen daterede programuger endnu.', { exact: true }).waitFor({ state: 'visible', timeout: 10000 })
  await shot('02-hele-forloebet-ingen-dato')

  console.log('GRØN: "Ugen som planlagt" viser i dags planlagt/gennemført (3/4 sæt, 1200kg/1280kg tonnage, samme tal som mockens exercise_logs), dage uden session vises uden fejl, og "Hele forløbet" falder ærligt tilbage til "ingen daterede programuger" når ugen ikke har en start_date.')
}

async function main() {
  const { createMockSupabase } = await import('../e2e/mock-supabase.mjs')
  const { buildSeed, ATHLETE_USER } = await import('../e2e/fixtures.mjs')
  const { startVite, launchBrowser, APP_URL, MOCK_PORT, OUT_DIR } = await import('../e2e/harness.mjs')

  const mock = createMockSupabase(buildSeed({ withLogs: true }))
  await mock.listen(MOCK_PORT)
  const vite = await startVite()
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    page.on('pageerror', err => console.error('[browser pageerror]', err))
    page.on('console', msg => { if (msg.type() === 'error') console.error('[console.error]', msg.text()) })
    await verUgenSomPlanlagt(page, { appUrl: APP_URL, mockUrl: `http://127.0.0.1:${MOCK_PORT}`, outDir: OUT_DIR, athleteUser: ATHLETE_USER })
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

if (process.argv[1] && process.argv[1].endsWith('verify-atletens-uge.mjs')) main()
