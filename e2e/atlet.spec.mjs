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

  // Entropi 2 (ordre 2069): Hjem har kortet "Start dagens pas"; passet åbner i en modal dialog med "Sæt N af M".
  await page.getByRole('button', { name: 'Start dagens pas' }).first().waitFor({ state: 'visible', timeout: 15000 })
  await shot('02-hjem-dagens-pas')
  const spring = page.getByRole('button', { name: /Spring guiden over/ })
  if (await spring.count()) await spring.first().click()
  await page.getByRole('button', { name: 'Start dagens pas' }).first().click()

  // Opvarmning vises for øvelsen (Squat har recommended_weight >= 20, se fixtures.mjs).
  await page.locator('h2', { hasText: 'Opvarmning' }).first().waitFor({ state: 'attached', timeout: 10000 }) // sektionen ligger i passet
  await shot('03-program-opvarmning')

  // Log tre sæt med interval-reps (4, 5, 6) — reps-feltet er redigerbart fordi
  // øvelsen har en interval-ordination ("4-6"), se src/repsPrescription.js.
  const repsPerSet = [4, 5, 6]
  for (let i = 0; i < 3; i++) {
    const setNum = i + 1
    await page.getByText(`Sæt ${setNum} af 4`, { exact: true }).waitFor({ state: 'visible', timeout: 10000 })
    await page.locator('[data-field="weight"]').fill('80')
    await page.locator('[data-field="reps"]').fill(String(repsPerSet[i]))
    // Tallene er rettet væk fra forslaget, så knappen hedder "Godkendt" (ellers "Som planlagt"/"Som sidste sæt").
    await page.getByRole('button', { name: /^(Godkendt|Som planlagt|Som sidste sæt)$/ }).first().click(); await page.waitForTimeout(600) // setTapGuard: 500 ms mellem tryk
    // Vent på at skrivningen er landet i mocken, før næste sæt logges.
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
  // Passet ligger i en modal dialog i Entropi 2; den lukkes, før fanerne kan trykkes.
  const lukPas = page.getByRole('button', { name: 'Luk pas' })
  if (await lukPas.first().isVisible().catch(() => false)) await lukPas.first().click()

  // VOLUMEN — atletens egen fane (ordre 259). Squat er kortlagt med
  // Knæ-strækkere som PRIMÆR gruppe (muskelkort.js), så de tre lige
  // gennemførte sæt skal give "3/3" (direkte/ialt) for den gruppe.
  // Volumen ligger i bundmenuens fold "Mere" (ordre 2069).
  await page.locator('[data-entropi2-bundnav] summary').click()
  await page.getByRole('button', { name: 'Volumen', exact: true }).click()
  await page.getByText('Knæ-strækkere').waitFor({ state: 'visible', timeout: 10000 })
  await shot('04b-volumen-denne-uge')
  // Entropi 2: Volumen er en tabel (Muskelgruppe / Denne uge / Sidste uge) med vægtede sæt; tre sæt Squat giver 3 på Knæ-strækkere.
  const kneeRow = page.locator('tr', { hasText: 'Knæ-strækkere' })
  const kneeRowText = await kneeRow.innerText()
  assert.ok(kneeRowText.replace(/\s+/g, ' ').trim().startsWith('Knæ-strækkere 3 '), `forventede 3 vægtede sæt for Knæ-strækkere denne uge, fik "${kneeRowText}"`)

  // Dagsform (Entropi 2: erstatter "Parathed"/"Log parathed"): Hjem er første fane; kortet "I dag" har energi 1 til 5 med ét tryk.
  await page.getByRole('button', { name: 'Hjem', exact: true }).click()
  await page.getByRole('button', { name: 'Udfyld dagsform' }).first().click()
  await page.locator('[data-home-quick-logs] button[aria-label="Energi 4"]').click()
  for (const felt of ['Motivation', 'Stress', 'Ømhed']) await page.locator(`[data-home-quick-logs] button[aria-label="${felt} 4"]`).click()
  await page.locator('[data-home-quick-logs] button[type="submit"]').click()


  await shot('05-checkin-udfyldt')
  for (let i = 0; i < 50 && (await readTable(mockUrl, 'readiness_logs')).length < 1; i++) await page.waitForTimeout(200)

  const readiness = await readTable(mockUrl, 'readiness_logs')
  assert.equal(readiness.length, 1, `forventede én readiness_logs-række, fik ${readiness.length}`)
  await shot('06-checkin-gemt')

  // Film et sæt (VideoCoach) ligger under "Mere i dag" på Hjem; kun at knappen findes, ingen upload.
  await page.locator('[data-home-mere] > summary').click()
  await page.locator('[data-film-set]').first().waitFor({ state: 'visible', timeout: 10000 })
  await shot('07-film-et-saet-knap')

  // Logout (kontomenuen ⋯).
  await page.getByRole('button', { name: 'Konto' }).click()
  await page.getByRole('button', { name: 'Log ud', exact: true }).click()
  const bekraeft = page.getByRole('button', { name: 'Bekræft' })
  if (await bekraeft.count()) await bekraeft.first().click()
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
