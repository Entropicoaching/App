// ORDRE 293 · blok 2 (F3) — første øvelse i Dagens pas skal forudfyldes med
// "sidste gang" når historikken ankommer, ikke kun med planens tal, og må
// aldrig overskrive noget atleten selv har gjort. Bhishaks fund: kortet viste
// "Sidste gang: 95kg × 5" men feltet stod på planens 80/4, fordi effekten kun
// kørte når øvelse/sæt skiftede, og historikken på første åbning endnu ikke
// var hentet.
//
// Hentningen af historikken (exercise_logs med limit=1500) holdes tilbage i
// browserens netværkslag, så rækkefølgen er deterministisk: først planens tal,
// så historikken. Tre kørsler efter hinanden på samme login:
//   1) urørt: feltet skifter 80/4 → 95/5 når historikken er der.
//   2) atleten trykker plus/plus før historikken kommer: 82.5/5 bliver stående.
//   3) atleten taster selv 70 før historikken kommer: 70 bliver stående.
//
// Egen, isoleret mock+vite-instans (samme grund som atlet-uge/fremgang: egen
// historik-seed forskyder ikke de andre specs). Historikken ligger under en
// forgangen uge (se atlet-uge.spec.mjs for hvorfor; ellers tæller den som et
// allerede logget sæt). Egen kørsel: `npm run e2e:dagens-pas-historik`.

import assert from 'node:assert/strict'
import { join } from 'node:path'
import { ATHLETE_USER, ATHLETE_ID, buildSeed } from './fixtures.mjs'

const PAST_LOG_ID = '99999999-9999-4999-8999-999999999930'
const PAST_WEEK_ID = '99999999-9999-4999-8999-999999999931'
const PAST_SESSION_ID = '99999999-9999-4999-8999-999999999932'
const PAST_EXERCISE_ID = '99999999-9999-4999-8999-999999999933'

function isoDaysAgo(days) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString()
}

function seedWithLastTime() {
  const seed = buildSeed()
  seed.tables.weeks.unshift({
    id: PAST_WEEK_ID, athlete_id: ATHLETE_ID, week_number: 0, block_name: 'Forrige',
    start_date: isoDaysAgo(14).slice(0, 10),
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
    id: PAST_LOG_ID, exercise_id: PAST_EXERCISE_ID, athlete_id: ATHLETE_ID, set_number: 1,
    weight: 95, reps_completed: 5, note: null, rpe_actual: null, rpe_planned: null,
    skipped: false, logged_at: isoDaysAgo(3),
  })
  return seed
}

export async function runDagensPasHistorik(page, { appUrl, outDir }) {
  const shot = (name) => page.screenshot({ path: join(outDir, `dagens-pas-historik-${name}.png`), fullPage: true })

  // Historik-hentningen (limit=1500) kan holdes tilbage og slippes.
  let gate = Promise.resolve()
  let release = () => {}
  const hold = () => { gate = new Promise(resolve => { release = resolve }) }
  await page.route('**/rest/v1/exercise_logs*', async route => {
    if (route.request().method() === 'GET' && route.request().url().includes('limit=1500')) await gate
    return route.continue()
  })

  const openHeld = async () => {
    hold()
    await page.reload()
    await page.getByText('Dagens pas', { exact: true }).waitFor({ state: 'visible', timeout: 15000 })
    await page.getByText('Sæt 1/4', { exact: true }).waitFor({ state: 'visible' })
    // Historikken er holdt tilbage: kortet står på planens tal og har ingen "Sidste gang".
    await page.waitForFunction(() => document.querySelector('[aria-label="Vægt, sæt 1"]')?.value === '80', null, { timeout: 5000 })
    assert.equal(await page.getByText('Sidste gang:', { exact: false }).count(), 0, 'historikken er holdt tilbage — ingen "Sidste gang" endnu')
  }
  const releaseAndWaitForHistory = async () => {
    release()
    await page.getByText('Sidste gang: 95kg × 5', { exact: false }).waitFor({ state: 'visible', timeout: 10000 })
  }

  await page.goto(appUrl)
  await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
  await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  await page.getByText('Dagens pas', { exact: true }).waitFor({ state: 'visible', timeout: 15000 })

  // ---- 1) Urørt: planens tal først, så sidste gang ----
  await openHeld()
  assert.equal(await page.getByLabel('Reps, sæt 1').inputValue(), '4', 'før historikken: ordinationens nederste tal')
  await shot('01-foer-historik')
  await releaseAndWaitForHistory()
  await page.waitForFunction(() => document.querySelector('[aria-label="Vægt, sæt 1"]')?.value === '95', null, { timeout: 5000 })
  assert.equal(await page.getByLabel('Vægt, sæt 1').inputValue(), '95', 'efter historikken: vægten skal være sidste gang, ikke planens 80')
  assert.equal(await page.getByLabel('Reps, sæt 1').inputValue(), '5', 'efter historikken: reps skal være sidste gang, ikke planens 4')
  await shot('02-efter-historik')

  // ---- 2) Atleten trykker plus på begge felter før historikken kommer ----
  await openHeld()
  await page.getByRole('button', { name: '2,5 kg mere', exact: true }).click()
  await page.getByRole('button', { name: '1 rep mere', exact: true }).click()
  assert.equal(await page.getByLabel('Vægt, sæt 1').inputValue(), '82.5')
  assert.equal(await page.getByLabel('Reps, sæt 1').inputValue(), '5')
  await releaseAndWaitForHistory()
  await page.waitForTimeout(500)
  assert.equal(await page.getByLabel('Vægt, sæt 1').inputValue(), '82.5', 'et trykket felt må ikke overskrives af historikken')
  assert.equal(await page.getByLabel('Reps, sæt 1').inputValue(), '5', 'trykkede reps må ikke overskrives af historikken')
  await shot('03-trykket-bevaret')

  // ---- 3) Atleten taster selv en vægt før historikken kommer ----
  await openHeld()
  await page.getByLabel('Vægt, sæt 1').fill('70')
  await releaseAndWaitForHistory()
  await page.waitForTimeout(500)
  assert.equal(await page.getByLabel('Vægt, sæt 1').inputValue(), '70', 'en tastet vægt må ikke overskrives af historikken')
  await shot('04-tastet-bevaret')

  console.log('GRØN: første øvelse forudfyldes med sidste gang (95/5) når historikken ankommer; en vægt/reps atleten har trykket (82.5/5) eller tastet (70) bliver stående.')
}

async function main() {
  const { createMockSupabase } = await import('./mock-supabase.mjs')
  const { startVite, launchBrowser, APP_URL, MOCK_PORT, OUT_DIR } = await import('./harness.mjs')

  const mock = createMockSupabase(seedWithLastTime())
  await mock.listen(MOCK_PORT)
  const vite = await startVite()
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    page.on('pageerror', err => console.error('[browser pageerror]', err))
    page.on('console', msg => { if (msg.type() === 'error') console.error('[console.error]', msg.text()) })
    await runDagensPasHistorik(page, { appUrl: APP_URL, outDir: OUT_DIR })
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

if (process.argv[1] && process.argv[1].endsWith('dagens-pas-historik.spec.mjs')) main()
