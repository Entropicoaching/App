// ORDRE 153 · commit 2 — atletens rejse igennem den ÆGTE, ubuildede app
// (npm run dev, ikke en harness) mod den lokale mock-backend.
// Kørsel alene: `npm run e2e:atlet` (starter sin egen mock + vite).
// Kørt fra `npm run e2e` (se e2e/run-all.mjs) deler den mock+vite med
// coach.spec.mjs, så coachen efterfølgende ser PRÆCIS det atleten lige logged.
//
// Assertions er bevidst mod mockens tabeller (via dens /__e2e/table-endpoint),
// ikke kun mod DOM-tekst — jf. ordrens "assertions mod mockens tabeller".

import assert from 'node:assert/strict'
import { join } from 'node:path'
import { ATHLETE_USER, EXERCISE_ID } from './fixtures.mjs'

async function readTable(mockUrl, name) {
  const res = await fetch(`${mockUrl}/__e2e/table?name=${encodeURIComponent(name)}`)
  return res.json()
}

// ORDRE 267 · commit 1: rating-knapperne fik et aria-label ("<felt>: <værdi>",
// se AthleteView.jsx) til at kunne slå en forudfyldt værdi op i e2e uden en
// mountet komponent — matcher direkte på det i stedet for xpath-scoping.
function ratingButton(page, fieldLabel, value) {
  return page.getByRole('button', { name: `${fieldLabel}: ${value}`, exact: true })
}

/** Kører hele atlet-rejsen. `page` er en frisk Playwright-side, `appUrl` og
 * `mockUrl` peger på den kørende vite-server hhv. mock-backend. */
export async function runAtletJourney(page, { appUrl, mockUrl, outDir }) {
  const shot = (name) => page.screenshot({ path: join(outDir, `atlet-${name}.png`), fullPage: true })

  await page.goto(appUrl)
  await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
  await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
  await shot('01-login')
  await page.getByRole('button', { name: 'Log ind' }).click()

  // Dagens pas — sessionskortet på "Hjem" (mærket "Næste").
  await page.getByText('Mit program').waitFor({ state: 'visible', timeout: 15000 })
  await page.getByText('Næste', { exact: true }).waitFor({ state: 'visible' })
  await shot('02-hjem-dagens-pas')

  await page.getByText('Dag 1 — Squat').click()

  // Opvarmning vises for øvelsen (Squat har recommended_weight >= 20, se fixtures.mjs).
  await page.getByText('Opvarmningssæt —').waitFor({ state: 'visible', timeout: 10000 })
  await shot('03-program-opvarmning')

  // Log tre sæt med interval-reps (4, 5, 6) — reps-feltet er redigerbart fordi
  // øvelsen har en interval-ordination ("4-6"), se src/repsPrescription.js.
  const repsPerSet = [4, 5, 6]
  for (let i = 0; i < 3; i++) {
    const setNum = i + 1
    await page.getByLabel(`Vægt, sæt ${setNum}`).fill('80')
    await page.getByLabel(`Reps, sæt ${setNum}`).fill(String(repsPerSet[i]))
    // Ikke nth(i): et allerede logget sæts knap skifter tekst til "✓", så
    // "Log"-knappen for det NÆSTE ulogget sæt altid er den første tilbage.
    await page.getByRole('button', { name: 'Log', exact: true }).first().click()
    // Vent på at skrivningen er landet i mocken, før næste sæt logges —
    // undgår at ramme knappen mens den forrige optimistiske skrivning
    // stadig er i baggrundskøen (se queueWrite i src/supabase.js).
    await page.waitForFunction(
      async ([url, expected]) => {
        const res = await fetch(`${url}/__e2e/table?name=exercise_logs`)
        const rows = await res.json()
        return rows.filter(r => !r.skipped).length >= expected
      },
      [mockUrl, setNum],
      { timeout: 10000 },
    )
  }
  await shot('04-tre-saet-logget')

  const logs = await readTable(mockUrl, 'exercise_logs')
  const loggedReps = logs
    .filter(l => l.exercise_id === EXERCISE_ID && !l.skipped)
    .sort((a, b) => a.set_number - b.set_number)
    .map(l => l.reps_completed)
  assert.deepEqual(loggedReps, [4, 5, 6], `forventede reps_completed [4,5,6] i mockens exercise_logs, fik ${JSON.stringify(loggedReps)}`)

  // VOLUMEN — atletens egen fane (ordre 259). Squat er kortlagt med
  // Knæ-strækkere som PRIMÆR gruppe (muskelkort.js), så de tre lige
  // gennemførte sæt skal give "3/3" (direkte/ialt) for den gruppe.
  await page.getByRole('button', { name: 'Volumen', exact: true }).click()
  await page.getByText('Knæ-strækkere').waitFor({ state: 'visible', timeout: 10000 })
  await shot('04b-volumen-denne-uge')
  const kneeRow = page.locator('xpath=//span[normalize-space(text())="Knæ-strækkere"]/parent::div')
  const kneeRowText = await kneeRow.textContent()
  assert.ok(kneeRowText.includes('3/3'), `forventede "3/3" for Knæ-strækkere i Volumen-fanen, fik "${kneeRowText}"`)

  // Check-in (parathed) — tilbage til Hjem.
  await page.getByRole('button', { name: 'Hjem', exact: true }).click()
  await page.locator('input[placeholder="timer"]').fill('8')
  await ratingButton(page, 'Energiniveau', 4).click()
  await ratingButton(page, 'Motivation', 4).click()
  await ratingButton(page, 'Stress', 2).click()
  await ratingButton(page, 'Muskelømhed', 2).click()
  await shot('05-checkin-udfyldt')
  await page.getByRole('button', { name: 'Log parathed' }).click()
  await page.waitForFunction(
    async (url) => {
      const res = await fetch(`${url}/__e2e/table?name=readiness_logs`)
      const rows = await res.json()
      return rows.length >= 1
    },
    mockUrl,
    { timeout: 10000 },
  )
  const readiness = await readTable(mockUrl, 'readiness_logs')
  assert.equal(readiness.length, 1, `forventede én readiness_logs-række, fik ${readiness.length}`)
  await shot('06-checkin-gemt')

  // VideoCoach-forsiden åbner uden video — kun at den loader, ingen upload.
  await page.getByText('VideoCoach', { exact: true }).click()
  const vcFrame = page.locator('iframe[title="VideoCoach"]')
  await vcFrame.waitFor({ state: 'visible', timeout: 10000 })
  await page.frameLocator('iframe[title="VideoCoach"]').locator('#closeBtn').waitFor({ state: 'visible', timeout: 10000 })
  await shot('07-videocoach-aabnet')
  await page.frameLocator('iframe[title="VideoCoach"]').locator('#closeBtn').click()
  await vcFrame.waitFor({ state: 'hidden', timeout: 10000 })

  // Logout.
  await page.getByRole('button', { name: 'Konto' }).click()
  await page.getByRole('button', { name: 'Log ud', exact: true }).click()
  await page.getByRole('button', { name: 'Bekræft' }).click()
  await page.locator('#athlete-auth-email').waitFor({ state: 'visible', timeout: 10000 })
  await shot('08-logget-ud')
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
    await runAtletJourney(page, { appUrl: APP_URL, mockUrl: `http://127.0.0.1:${MOCK_PORT}`, outDir: OUT_DIR })
    console.log('\nGRØN: atletens rejse (login → dagens pas → opvarmning → tre sæt interval-reps → volumen-fanen → check-in → videocoach → logout) er gennemført mod den ægte app + mock-backend.')
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

if (process.argv[1] && process.argv[1].endsWith('atlet.spec.mjs')) main()
