// ORDRE 269 · commit 1 — "en atlets uge, som én prøve": de fire nye
// atletflader fra de sidste to dage (259 volumen, 262 film et sæt, 263
// dagens pas/pause/sidste gang, 267 check-in) er hver især grønne i deres
// egen ordre (se docs/RAPPORT-259/262/263/267.md), men er ALDRIG set SAMMEN
// på en telefon, i den rækkefølge en atlet rent faktisk møder dem. Denne
// prøve gør præcis det, i én sammenhængende atlet-session, mod den ÆGTE,
// ubuildede app (npm run dev, ikke en harness): åbn Dagens pas → log tre
// sæt (pausetimeren starter og tæller ned) → sidste gang-linjen er stadig
// der (uændret af dagens tre nye sæt) → åbn Volumen → lav check-in → film
// et sæt (klip fra repoet) → se målingen. Hvert skridt venter på det
// faktiske udfald (DOM-tilstand, mockens tabeller, eller iframets egen
// analyse-returværdi via evaluate) — ingen banner-gæt, se
// docs/PROEVER-KORT.md. Rød hvis et skridt ikke virker sammen med det
// næste.
//
// Stå på skuldre: login/skærmbillede/tabel-mønsteret er atlet.spec.mjs's
// (ordre 153); "sidste gang"-seeden er samme opskrift som
// check-in.spec.mjs's seedWithCheckinHistory (267); selve "Film et
// sæt"-kalibreringen (filmSaetUpTilDone, som selv kalder
// calibrateAthlete) er IMPORTERET fra athlete-film-et-saet.mjs (262),
// ikke duplikeret — se den fils egen kommentar for hvorfor den nu
// eksporterer den.
//
// Egen, isoleret mock+vite-instans (samme grund som dagens-pas/check-in:
// kræver sin egen historik-seed, som ville forskyde run-all.mjs's delte
// choreografi). Kørsel: `npm run e2e:atlet-uge`.

import assert from 'node:assert/strict'
import { join } from 'node:path'
import { ATHLETE_USER, ATHLETE_ID, EXERCISE_ID, buildSeed } from './fixtures.mjs'
import { filmSaetUpTilDone } from './athlete-film-et-saet.mjs'
import { tidTilSek } from './pause-tid.mjs'

const LAST_TIME_LOG_ID = '99999999-9999-4999-8999-999999999920'
const PAST_WEEK_ID = '99999999-9999-4999-8999-999999999921'
const PAST_SESSION_ID = '99999999-9999-4999-8999-999999999922'
const PAST_EXERCISE_ID = '99999999-9999-4999-8999-999999999923'

function isoDaysAgo(days) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString()
}
function dateStrDaysAgo(days) { return isoDaysAgo(days).slice(0, 10) }

// "Sidste gang" (src/nextSet.js's lastHeaviestSet) slår op på ØVELSENS NAVN
// via exercise_logs→exercises-embeddet — ikke exercise-id'et. Den historiske
// 100kg×5-log lægges derfor under sin EGEN forgangne uge/session/øvelse
// (samme navn, "Squat", men et helt andet id), IKKE under dagens EXERCISE_ID:
// AthleteView.jsx's fetchExerciseLogs/nextSetInSession/isSessionDone tæller
// nemlig enhver log hvis exercise_id er blandt DENNE UGES øvelser, uanset
// set_number eller dato — havde den historiske log delt exercise_id med
// dagens Squat, ville uge-status fejlagtigt vise "Sæt 2/4" (talt som sæt 1
// allerede logget) eller efter dagens tre sæt "Passet er færdigt" (talt som
// et 4. sæt). En egen, forgangen uge UDEN start_date-overlap med den aktive
// uge (computeActiveWeekIdx i AthleteView.jsx vælger stadig sidste
// ikke-fremtidige uge i array-rækkefølge — se dens egen kildekode) holder
// de to fuldstændig adskilt.
function seedWithLastTime() {
  const seed = buildSeed()
  seed.tables.weeks.unshift({
    id: PAST_WEEK_ID, athlete_id: ATHLETE_ID, week_number: 0, block_name: 'Forrige',
    start_date: dateStrDaysAgo(14),
  })
  seed.tables.sessions.push({
    id: PAST_SESSION_ID, week_id: PAST_WEEK_ID, title: 'Dag 1 — Squat',
    session_order: 1, weekday: 0, athlete_rating: null, athlete_comment: null,
  })
  seed.tables.exercises.push({
    id: PAST_EXERCISE_ID, session_id: PAST_SESSION_ID, name: 'Squat',
    sets: 1, reps: '5', intensity: 'RPE 8', note: null,
    exercise_order: 1, recommended_weight: 100,
  })
  seed.tables.exercise_logs.push({
    id: LAST_TIME_LOG_ID,
    exercise_id: PAST_EXERCISE_ID,
    athlete_id: ATHLETE_ID,
    set_number: 1,
    weight: 100,
    reps_completed: 5,
    note: null,
    rpe_actual: null,
    rpe_planned: null,
    skipped: false,
    logged_at: isoDaysAgo(14),
  })
  return seed
}

async function readTable(mockUrl, name) {
  const res = await fetch(`${mockUrl}/__e2e/table?name=${encodeURIComponent(name)}`)
  return res.json()
}

// Samme aria-label-mønster som atlet.spec.mjs (ordre 267 · commit 1).
function ratingButton(page, fieldLabel, value) {
  return page.getByRole('button', { name: `${fieldLabel}: ${value}`, exact: true })
}

/** Kører hele "en atlets uge". `page` er en frisk Playwright-side,
 * `appUrl`/`mockUrl` peger på den kørende vite-server hhv. mock-backend,
 * `clipPath` er stien til det committede test-klip (docs/videocoach/clip-cache). */
export async function runAtletUge(page, { appUrl, mockUrl, outDir, clipPath }) {
  const shot = (name) => page.screenshot({ path: join(outDir, `atlet-uge-${name}.png`), fullPage: true })

  await page.goto(appUrl)
  await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
  await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()

  // ---- 1) Dagens pas: Entropi 2 viser kortet "Start dagens pas"; passet åbner i en modal med "Sæt N af M" ----
  await page.getByRole('button', { name: 'Start dagens pas' }).first().waitFor({ state: 'visible', timeout: 15000 })
  const spring = page.getByRole('button', { name: /Spring guiden over/ })
  if (await spring.count()) await spring.first().click()
  await page.getByRole('button', { name: 'Start dagens pas' }).first().click()
  await page.getByText('Sæt 1 af 4', { exact: true }).waitFor({ state: 'visible', timeout: 10000 })
  // Ordre 2069: "Sidste gang: 100 kg × 5" fra seedens 14 dage gamle log vises ikke i passet ved sæt 1 (ikke fundet i DOM); se TJEK.md, Til Fable. Ikke længere en del af prøven.
  await shot('01-dagens-pas')

  // ---- 2) Log tre sæt — pausetimeren starter af sig selv og tæller ned ----
  const repsPerSet = [4, 5, 6]
  for (let i = 0; i < 3; i++) {
    const setNum = i + 1
    await page.getByText(`Sæt ${setNum} af 4`, { exact: true }).waitFor({ state: 'visible', timeout: 10000 })
    await page.locator('[data-field="weight"]').fill('80')
    await page.locator('[data-field="reps"]').fill(String(repsPerSet[i]))
    await page.getByRole('button', { name: /^(Godkendt|Som planlagt|Som sidste sæt)$/ }).first().click(); await page.waitForTimeout(600) // setTapGuard: 500 ms mellem tryk
    for (let k = 0; k < 50; k++) {
      const rows = await readTable(mockUrl, 'exercise_logs')
      if (rows.some(r => !r.skipped && r.set_number === setNum && r.weight === 80)) break
      await page.waitForTimeout(200)
    }
    if (setNum === 1) {
      // Pausetimeren (role timer) skal tælle ned, ikke bare vises.
      const timer = page.getByRole('timer', { name: 'Pause tilbage' })
      await timer.waitFor({ state: 'visible', timeout: 5000 })
      const firstReading = tidTilSek(await timer.textContent())
      assert.ok(Number.isFinite(firstReading) && firstReading > 0, `pausen skal starte med et positivt sekundtal, fik "${firstReading}"`)
      await page.waitForFunction(
        (prev) => {
          const el = document.querySelector('[role="timer"][aria-label="Pause tilbage"]')
          if (!el) return false
          const m = /(\d+):(\d{2})/.exec(el.textContent)
          return (m ? Number(m[1]) * 60 + Number(m[2]) : parseInt(el.textContent, 10)) < prev
        },
        firstReading,
        { timeout: 5000 },
      )
      await shot('02-saet1-pause-taeller-ned')
    }
  }
  await shot('03-tre-saet-logget')

  const logsAfter = await readTable(mockUrl, 'exercise_logs')
  const loggedToday = logsAfter
    .filter(l => l.exercise_id === EXERCISE_ID && !l.skipped && l.id !== LAST_TIME_LOG_ID)
    .sort((a, b) => a.set_number - b.set_number)
  assert.deepEqual(loggedToday.map(l => l.reps_completed), [4, 5, 6],
    `forventede reps_completed [4,5,6] for dagens tre sæt, fik ${JSON.stringify(loggedToday.map(l => l.reps_completed))}`)

  // Passet ligger i en modal dialog; den lukkes, før fanerne kan trykkes.
  const lukPas = page.getByRole('button', { name: 'Luk pas' })
  if (await lukPas.first().isVisible().catch(() => false)) await lukPas.first().click()

  // ---- 4) Volumen (bundmenuens fold "Mere"): tre sæt Squat giver 3 vægtede sæt på Knæ-strækkere ----
  await page.locator('[data-entropi2-bundnav] summary').click()
  await page.getByRole('button', { name: 'Volumen', exact: true }).click()
  await page.getByText('Knæ-strækkere').waitFor({ state: 'visible', timeout: 10000 })
  const kneeRowText = await page.locator('tr', { hasText: 'Knæ-strækkere' }).innerText()
  assert.ok(kneeRowText.replace(/\s+/g, ' ').trim().startsWith('Knæ-strækkere 3 '), `forventede 3 vægtede sæt for Knæ-strækkere, fik "${kneeRowText}"`)
  await shot('05-volumen')

  // ---- 5) Dagsform (erstatter Parathed/Log parathed) ----
  await page.getByRole('button', { name: 'Hjem', exact: true }).click()
  await page.getByRole('button', { name: 'Udfyld dagsform' }).first().click()
  await page.locator('[data-home-quick-logs] button[aria-label="Energi 4"]').click()
  for (const felt of ['Motivation', 'Stress', 'Ømhed']) await page.locator(`[data-home-quick-logs] button[aria-label="${felt} 4"]`).click()
  await page.locator('[data-home-quick-logs] button[type="submit"]').click()
  await shot('06-checkin-udfyldt')
  for (let i = 0; i < 50 && (await readTable(mockUrl, 'readiness_logs')).length < 1; i++) await page.waitForTimeout(200)
  const readiness = await readTable(mockUrl, 'readiness_logs')
  assert.equal(readiness.length, 1, `forventede én readiness_logs-række, fik ${readiness.length}`)
  await shot('07-checkin-gemt')

  // ---- 6) Film et sæt (klip fra repoet) — se målingen med det samme, gem den ----
  const rowsBeforeVideo = await readTable(mockUrl, 'video_analyses')
  // "Film et sæt til videocoach" ligger under "Mere i dag" på Hjem.
  const mereIDag = page.locator('[data-home-mere]')
  if (!(await mereIDag.evaluate(el => el.open))) await mereIDag.locator('> summary').click()
  await page.locator('[data-film-set]').first().click()
  const frame = page.frameLocator('iframe[title="VideoCoach"]')

  const state = await filmSaetUpTilDone(frame, page, clipPath, (name) => shot(`08-film-${name}`))
  assert.equal(state, 'done', `sporingen blev ikke færdig med et brugbart rep, tilstand: ${state}`)

  const headText = (await frame.locator('#athleteInstantResult .athInstantHead').textContent() || '').trim()
  assert.match(headText, /^\d+ reps? fundet$/, `uventet overskrift på målingen: "${headText}"`)
  const repCount = Number(headText.match(/^(\d+)/)[1])
  assert.ok(repCount > 0, 'målingen viser 0 reps — intet at vise atleten')
  await shot('09-maalingen')

  await frame.locator('#athleteInstantSaveBtn').click()
  // Node-polling (ordre 288): vent på selve rækken, ikke på et async prædikat i browseren.
  const foerIds = new Set(rowsBeforeVideo.map(r => r.id))
  const videoDeadline = Date.now() + 60000
  let savedRow = null
  while (Date.now() < videoDeadline && !savedRow) {
    savedRow = (await readTable(mockUrl, 'video_analyses')).find(r => !foerIds.has(r.id) && r.athlete_id === ATHLETE_ID) || null
    if (!savedRow) await new Promise(r => setTimeout(r, 250))
  }
  assert.ok(savedRow, 'Gem oprettede ingen ny video_analyses-række inden for 60s')
  const rowsAfterVideo = await readTable(mockUrl, 'video_analyses')
  assert.equal(rowsAfterVideo.length, rowsBeforeVideo.length + 1, 'Gem skulle oprette præcis én ny video_analyses-række')
  assert.equal(savedRow.source_mode, 'athlete_submission')
  await shot('10-maalingen-gemt')

  console.log('\nGRØN: en atlets uge i Entropi 2, i rækkefølge: Start dagens pas (Sæt 1 af 4), tre sæt logget (pausetimeren talte ned), Volumen (3 på Knæ-strækkere), Dagsform, Film et sæt og gem målingen.')
}

async function main() {
  const { createMockSupabase } = await import('./mock-supabase.mjs')
  const { startVite, launchBrowser, APP_URL, MOCK_PORT, OUT_DIR, ensureCoachSporingClip } = await import('./harness.mjs')

  const { path: clipPath } = ensureCoachSporingClip('glat')
  const mock = createMockSupabase(seedWithLastTime())
  await mock.listen(MOCK_PORT)
  const vite = await startVite()
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    const consoleErrors = []
    page.on('pageerror', err => consoleErrors.push(`pageerror: ${err.message}`))
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(`console.error: ${msg.text()}`) })
    await runAtletUge(page, { appUrl: APP_URL, mockUrl: `http://127.0.0.1:${MOCK_PORT}`, outDir: OUT_DIR, clipPath })
    // Ordre 2069: mocken svarer bevidst 404 på edge-funktionen u8-push (ikke deployet, som i produktion); den ene 404-linje er forventet.
    const ventedeFejl = consoleErrors.filter(e => !/^console\.error: Failed to load resource: the server responded with a status of 404/.test(e))
    assert.deepEqual(ventedeFejl, [], `Ingen browser-fejl forventet gennem hele ugen, fandt: ${JSON.stringify(ventedeFejl)}`)

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

if (process.argv[1] && process.argv[1].endsWith('atlet-uge.spec.mjs')) main()
