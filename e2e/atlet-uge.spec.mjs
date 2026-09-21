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

  // ---- 1) Dagens pas: næste sæt vises øverst, med det samme ----
  await page.getByText('Dagens pas', { exact: true }).waitFor({ state: 'visible', timeout: 15000 })
  await page.getByText('Squat', { exact: true }).waitFor({ state: 'visible' })
  await page.getByText('Sæt 1/4', { exact: true }).waitFor({ state: 'visible' })
  await shot('01-dagens-pas')

  // ---- 2) Log tre sæt fra Dagens pas-kortet — pausetimeren starter af sig selv og tæller ned ----
  const repsPerSet = [4, 5, 6]
  for (let i = 0; i < 3; i++) {
    const setNum = i + 1
    await page.getByLabel(`Vægt, sæt ${setNum}`).fill('80')
    await page.getByLabel(`Reps, sæt ${setNum}`).fill(String(repsPerSet[i]))
    await page.getByRole('button', { name: 'Godkendt', exact: true }).click()
    await page.waitForFunction(
      async ([url, expectedSetNum]) => {
        const res = await fetch(`${url}/__e2e/table?name=exercise_logs`)
        const rows = await res.json()
        return rows.some(r => !r.skipped && r.set_number === expectedSetNum && r.weight === 80)
      },
      [mockUrl, setNum],
      { timeout: 10000 },
    )
    if (setNum === 1) {
      // Beviser at pausen rent faktisk TÆLLER NED (ikke bare vises) —
      // samme metode som dagens-pas.spec.mjs (ordre 263 · commit 4).
      await page.getByText('Pause', { exact: false }).waitFor({ state: 'visible', timeout: 5000 })
      const secondsText = () => page.getByText(/^\d+s$/).first().textContent()
      const firstReading = parseInt(await secondsText(), 10)
      assert.ok(Number.isFinite(firstReading) && firstReading > 0, `pausen skal starte med et positivt sekundtal, fik "${firstReading}"`)
      await page.waitForFunction(
        (prev) => {
          const el = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && /^\d+s$/.test(e.textContent || ''))
          if (!el) return false
          return parseInt(el.textContent, 10) < prev
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

  // ---- 3) "Sidste gang"-linjen: stadig 100kg × 5 (14 dage tilbage) — ikke
  // forvekslet med de tre sæt der lige blev logget i dag ----
  await page.getByText('Sidste gang: 100kg × 5', { exact: false }).waitFor({ state: 'visible', timeout: 5000 })
  await shot('04-sidste-gang')

  // ---- 4) Volumen-fanen — samme assertion mod et beregnet tal som atlet.spec.mjs (ordre 259) ----
  await page.getByRole('button', { name: 'Volumen', exact: true }).click()
  await page.getByText('Knæ-strækkere').waitFor({ state: 'visible', timeout: 10000 })
  const kneeRow = page.locator('xpath=//span[normalize-space(text())="Knæ-strækkere"]/parent::div')
  const kneeRowText = await kneeRow.textContent()
  assert.ok(kneeRowText.includes('3/3'), `forventede "3/3" for Knæ-strækkere i Volumen-fanen, fik "${kneeRowText}"`)
  await shot('05-volumen')

  // ---- 5) Check-in (parathed) ----
  await page.getByRole('button', { name: 'Hjem', exact: true }).click()
  await page.locator('input[placeholder="timer"]').fill('8')
  await ratingButton(page, 'Energiniveau', 4).click()
  await ratingButton(page, 'Motivation', 4).click()
  await ratingButton(page, 'Stress', 2).click()
  await ratingButton(page, 'Muskelømhed', 2).click()
  await shot('06-checkin-udfyldt')
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
  await shot('07-checkin-gemt')

  // ---- 6) Film et sæt (klip fra repoet) — se målingen med det samme, gem den ----
  const rowsBeforeVideo = await readTable(mockUrl, 'video_analyses')
  // "Film et sæt" er sit eget kort på Hjem, ved siden af (ikke inde i) det
  // almindelige "VideoCoach"-kort — ingen tab-navigation nødvendig, se
  // athlete-film-et-saet.mjs.
  await page.getByText('Film et sæt', { exact: true }).click()
  const frame = page.frameLocator('iframe[title="VideoCoach"]')

  const state = await filmSaetUpTilDone(frame, page, clipPath, (name) => shot(`08-film-${name}`))
  assert.equal(state, 'done', `sporingen blev ikke færdig med et brugbart rep, tilstand: ${state}`)

  const headText = (await frame.locator('#athleteInstantResult .athInstantHead').textContent() || '').trim()
  assert.match(headText, /^\d+ reps? fundet$/, `uventet overskrift på målingen: "${headText}"`)
  const repCount = Number(headText.match(/^(\d+)/)[1])
  assert.ok(repCount > 0, 'målingen viser 0 reps — intet at vise atleten')
  await shot('09-maalingen')

  await frame.locator('#athleteInstantSaveBtn').click()
  // ORDRE 280 · commit 5 — fundet ved at rette denne prøves egen
  // "Log sæt"→"Godkendt"-selector (se blok 2): den nåede aldrig hertil før,
  // så denne 20s-grænse er aldrig testet under en fuld `npm run proever`
  // (mange tunge video-prøver kørt lige før, se docs/PROEVER-KORT.md) — der
  // tager uploaden reelt længere end 20s, ikke fordi noget er i stykker.
  // Gem-flowet selv er urørt af ordre 280 (se e2e/athlete-film-et-saet.mjs,
  // som er grøn i alle kørsler).
  // Poll fra Node-siden i stedet for page.waitForFunction med en async prædikat:
  // målt i ordre 288 kom den tilbage ~12 ms efter klikket med en TOM tabel, så
  // næste assert læste tabellen før uploaden var færdig (rækken kom først
  // bagefter, appen er i orden). Node-polling venter på selve rækken.
  const videoDeadline = Date.now() + 60000
  let videoSaved = false
  while (Date.now() < videoDeadline) {
    const rows = await readTable(mockUrl, 'video_analyses')
    if (rows.some(r => r.athlete_id === ATHLETE_ID && r.analysis_state === 'awaiting_analysis')) { videoSaved = true; break }
    await new Promise(r => setTimeout(r, 250))
  }
  assert.ok(videoSaved, 'Gem oprettede ingen awaiting_analysis-række inden for 60s')
  const rowsAfterVideo = await readTable(mockUrl, 'video_analyses')
  assert.equal(rowsAfterVideo.length, rowsBeforeVideo.length + 1, 'Gem skulle oprette præcis én ny video_analyses-række')
  const savedRow = rowsAfterVideo.find(r => r.athlete_id === ATHLETE_ID && r.analysis_state === 'awaiting_analysis')
  assert.ok(savedRow, 'målingen blev ikke gemt via den eksisterende video-vej')
  assert.equal(savedRow.source_mode, 'athlete_submission')
  await shot('10-maalingen-gemt')

  console.log(`\nGRØN: en atlets uge, i rækkefølge — Dagens pas (Sæt 1/4) → tre sæt logget (pausetimeren talte ned) → "Sidste gang: 100kg × 5" uændret → Volumen (3/3 Knæ-strækkere) → check-in gemt → Film et sæt (${repCount} rep(s) målt) → målingen gemt (video_analyses-række ${savedRow.id}).`)
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
    assert.deepEqual(consoleErrors, [], `Ingen browser-fejl forventet gennem hele ugen, fandt: ${JSON.stringify(consoleErrors)}`)
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
