// ORDRE 153 · commit 3 — coachen ser det atleten lige gjorde, i den ÆGTE app
// (Dashboard.jsx, ikke en harness) mod den lokale mock-backend.
// Kørsel alene: `npm run e2e:coach` (starter sin egen mock, seedet SOM OM
// atleten allerede har logget — se fixtures.mjs's withLogs).
// Kørt fra `npm run e2e` deler den mock+vite med atlet.spec.mjs, og ser
// dermed data atlet-specen faktisk lige skrev — den egentlige "atlet → coach"-
// pointe i ordren.

import assert from 'node:assert/strict'
import { join } from 'node:path'
import { COACH_USER, ATHLETE_ID } from './fixtures.mjs'

/** Kører coachens gennemgang. `page` er en frisk Playwright-side. */
export async function runCoachReview(page, { appUrl, outDir }) {
  const shot = (name) => page.screenshot({ path: join(outDir, `coach-${name}.png`), fullPage: true })

  await page.goto(appUrl)
  await page.locator('#athlete-auth-email').fill(COACH_USER.email)
  await page.locator('#athlete-auth-password').fill(COACH_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()

  // Atletlisten viser Testatlet (rækken er selv en role="button"). Matcher på
  // "Uge" i navnet for ikke at ramme en evt. indbakke-prioritetskort med
  // samme navn (fx en afventende video, se ordre 155's video-review.spec.mjs).
  const athleteRow = page.getByRole('button', { name: /Testatlet.*Uge/ })
  await athleteRow.waitFor({ state: 'visible', timeout: 10000 })
  await shot('01-atletliste')
  await athleteRow.click()

  // Atletens uge viser de tre sæt — "Log"-fanen er den der faktisk render'er
  // hvert enkelt sæt (Program-fanen viser kun komplians/overblik).
  await page.getByRole('button', { name: /Log$/ }).click()
  await page.locator('div:text-is("Squat")').first().waitFor({ state: 'visible', timeout: 10000 })
  // Squat har 4 sæt i seeden (ordre 155 tilføjede et 4. sæt til
  // fejl.spec.mjs's offline-scenarie) — atlet.spec.mjs logger kun de tre
  // første, så "3/4 sæt", ikke "3/3".
  await page.getByText('3/4 sæt').first().waitFor({ state: 'visible', timeout: 10000 })
  await shot('02-atletens-uge-tre-saet')

  // Check-in-gennemgangen viser dagens readiness (Hjem-fanens statuslinje).
  await page.getByRole('button', { name: /Hjem$/ }).click()
  await page.getByText('Parathed i dag').waitFor({ state: 'visible', timeout: 10000 })
  await shot('03-checkin-gennemgang')

  // Videoer-fanen ("Analyse", lazy chunk) åbner uden fejl.
  const pageErrors = []
  page.on('pageerror', err => pageErrors.push(err))
  await page.getByRole('button', { name: /Mere/ }).click()
  await page.getByRole('button', { name: /Analyse$/ }).click()
  // Vent på at den lazy-loadede AnalyseTab rent faktisk har renderet noget
  // (ikke bare den tomme "Indlæser..."-tilstand appen viser under chunk-hentning).
  await page.getByText('VideoCoach', { exact: false }).first().waitFor({ state: 'visible', timeout: 15000 })
  assert.equal(pageErrors.length, 0, `Analyse-fanen kastede ${pageErrors.length} browser-fejl: ${pageErrors.map(e => e.message).join('; ')}`)
  const crashed = await page.getByText('Ups — noget gik galt.').count()
  assert.equal(crashed, 0, 'Analyse-fanen ramte ErrorBoundary-fallbacken')
  await shot('04-videoer-analyse-fane')

  // Coach Briefing (Indbakken) åbner (sidebar-punktet er en <div onClick>, ikke en <button>).
  await page.getByText('Coach Briefing', { exact: true }).first().click()
  await page.getByText('Coach Briefing', { exact: true }).first().waitFor({ state: 'visible', timeout: 10000 })
  const crashedInbox = await page.getByText('Ups — noget gik galt.').count()
  assert.equal(crashedInbox, 0, 'Coach Briefing ramte ErrorBoundary-fallbacken')
  await shot('05-indbakke')
}

// ORDRE 215 · hastefejl: "Min træning" (coachen som er atlet, se her
// Testatlet) gjorde ingenting — goToMyProfile (Dashboard.jsx) kaldte
// onPreviewAthlete korrekt, App.jsx satte previewMode/coachAthleteId
// korrekt, men skærmen forblev uændret (se docs/ordre-215-repro.md).
// Reproducerer PRÆCIS scenariet fra reprosen: entropi_my_athlete_id sat til
// en atlet der findes i den allerede indlæste athletes-liste, så
// goToMyProfile tager sin direkte vej (ingen picker involveret).
export async function runMinTraeningPreview(page, { appUrl, outDir }) {
  const shot = (name) => page.screenshot({ path: join(outDir, `coach-${name}.png`), fullPage: true })

  await page.goto(appUrl)
  await page.locator('#athlete-auth-email').fill(COACH_USER.email)
  await page.locator('#athlete-auth-password').fill(COACH_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  await page.getByRole('button', { name: /Testatlet.*Uge/ }).waitFor({ state: 'visible', timeout: 10000 })

  // entropi_my_athlete_id læses kun ved mount (useState-initializer i
  // Dashboard.jsx) — sat efter login, derfor et reload for at få den med.
  await page.evaluate((id) => { localStorage.setItem('entropi_my_athlete_id', id) }, ATHLETE_ID)
  await page.reload()
  await page.getByRole('button', { name: /Testatlet.*Uge/ }).waitFor({ state: 'visible', timeout: 10000 })

  await page.getByText('Min træning', { exact: true }).first().click()
  // "← Coach view" er den entydige markør for at Atletvisningen (ikke
  // Dashboard) rent faktisk er monteret — se AthleteView.jsx's backBtn.
  await page.getByText('← Coach view', { exact: true }).waitFor({ state: 'visible', timeout: 10000 })
  await shot('06-min-traening-preview')

  const crashed = await page.getByText('Ups — noget gik galt.').count()
  assert.equal(crashed, 0, '"Min træning" ramte ErrorBoundary-fallbacken')
}

async function main() {
  const { createMockSupabase } = await import('./mock-supabase.mjs')
  const { buildSeed } = await import('./fixtures.mjs')
  const { startVite, launchBrowser, APP_URL, MOCK_PORT, OUT_DIR } = await import('./harness.mjs')

  const mock = createMockSupabase(buildSeed({ withLogs: true }))
  await mock.listen(MOCK_PORT)
  const vite = await startVite()
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    page.on('console', msg => { if (msg.type() === 'error') console.error('[console.error]', msg.text()) })
    await runCoachReview(page, { appUrl: APP_URL, outDir: OUT_DIR })
    await runMinTraeningPreview(page, { appUrl: APP_URL, outDir: OUT_DIR })
    console.log('\nGRØN: coachen ser atletlisten, ugens tre sæt, dagens readiness, Analyse-fanen, indbakken og "Min træning" uden fejl.')
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

if (process.argv[1] && process.argv[1].endsWith('coach.spec.mjs')) main()
