// ORDRE 267 · commit 4 — beviser check-in-skærmens tre forbedringer klikket
// igennem i den ÆGTE, ubuildede app (npm run dev) mod den lokale mock, samme
// mønster som dagens-pas.spec.mjs:
// (1) formularen forudfyldes fra sidste log, og ét tryk er nok at sende den
// (2) skærmen efter afsendelse viser "hvad coachen ser" og — når det findes i
//     data — "hvad der ændrede sig sidst"
// (3) mangler ugens check-in, og ugen er ved at være slut, viser Dagens pas
//     en rolig linje med et link, som forsvinder igen efter afsendelse
//
// Egen, isoleret mock+vite-instans (ikke i e2e/run-all.mjs's delte sekvens):
// kræver sin egen seed (uge-datoer + parathedshistorik), som ville forstyrre
// den delte sekvens' choreografi. Egen kørsel: `npm run e2e:check-in`.

import assert from 'node:assert/strict'
import { join } from 'node:path'
import { ATHLETE_USER, ATHLETE_ID, buildSeed } from './fixtures.mjs'

function shiftDate(str, days) {
  const d = new Date(str + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
function todayStr() { return new Date().toISOString().slice(0, 10) }

const DELOAD_WEEK_ID = '99999999-9999-4999-8999-999999999901'
const PREV_LOG_ID = '99999999-9999-4999-8999-999999999902'
const LOW_LOG_ID = '99999999-9999-4999-8999-999999999903'

// Tre stykker check-in-historik lagt ind i seeden på forhånd:
// - den aktive uge (uge 2, "Base", allerede med sessioner/øvelser fra
//   buildSeed()) får en startdato der gør at ugen SLUTTER I DAG, via en
//   ankeruge (uge 1, "Deload") 7 dage før — weekStartDate() ekstrapolerer
//   altid fra den tidligst daterede uge, se AthleteView.jsx.
// - et log for 8 dage siden bliver "sidste log" → afprøver forudfyldning.
// - et LAVT log (score 20) for 16 dage siden, 3 dage før Deload-ugens egen
//   startdato og med en coach-note → afprøver "hvad ændrede sig sidst".
function seedWithCheckinHistory() {
  const seed = buildSeed()
  const { tables } = seed
  tables.weeks[0].week_number = 2
  tables.weeks.unshift({
    id: DELOAD_WEEK_ID, athlete_id: ATHLETE_ID, week_number: 1, block_name: 'Deload',
    coach_note: 'Skruet ned for volumen efter din tilbagemelding.',
    start_date: shiftDate(todayStr(), -13),
  })
  tables.readiness_logs = [
    {
      id: PREV_LOG_ID, athlete_id: ATHLETE_ID, logged_date: shiftDate(todayStr(), -8),
      sleep_hours: 6.5, energy: 3, motivation: 2, stress: 4, soreness_level: 3,
      sore_zones: ['Ben'], readiness_score: 50,
    },
    {
      id: LOW_LOG_ID, athlete_id: ATHLETE_ID, logged_date: shiftDate(todayStr(), -16),
      sleep_hours: 4, energy: 1, motivation: 1, stress: 5, soreness_level: 5,
      sore_zones: ['Ryg'], readiness_score: 20,
    },
  ]
  return seed
}

async function readTable(mockUrl, name) {
  const res = await fetch(`${mockUrl}/__e2e/table?name=${encodeURIComponent(name)}`)
  return res.json()
}

async function assertPressed(page, label) {
  const pressed = await page.getByRole('button', { name: label, exact: true }).getAttribute('aria-pressed')
  assert.equal(pressed, 'true', `"${label}" skulle være forudfyldt (aria-pressed=true)`)
}

/** `page` er en frisk Playwright-side, `appUrl`/`mockUrl` peger på den
 * kørende vite-server hhv. mock-backend. */
export async function runCheckIn(page, { appUrl, mockUrl, outDir }) {
  const shot = (name) => page.screenshot({ path: join(outDir, `check-in-${name}.png`), fullPage: true })

  await page.goto(appUrl)
  await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
  await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()

  // (3) Ugens check-in mangler, og ugen er ved at være slut → rolig linje
  // øverst i Dagens pas, med et link.
  await page.getByText('Dagens pas', { exact: true }).waitFor({ state: 'visible', timeout: 15000 })
  await page.getByText('Ugens check-in mangler stadig.', { exact: true }).waitFor({ state: 'visible', timeout: 5000 })
  await shot('01-nudge')
  await page.getByText('Log den →', { exact: true }).click()

  // (1) Formularen forudfyldes automatisk fra logget for 8 dage siden —
  // intet felt er tomt, alt kan stadig rettes.
  await page.getByText('Dagens parathed', { exact: true }).waitFor({ state: 'visible' })
  await assertPressed(page, 'Energiniveau: 3')
  await assertPressed(page, 'Motivation: 2')
  await assertPressed(page, 'Stress: 4')
  await assertPressed(page, 'Muskelømhed: 3')
  assert.equal(await page.getByLabel('Søvn, timer').inputValue(), '6.5', 'søvnfeltet skal være forudfyldt fra sidste log')
  assert.equal(await page.getByRole('button', { name: 'Ben', exact: true }).getAttribute('aria-pressed'), 'true', 'lokal ømhed (Ben) skal være forudfyldt')
  await shot('02-forudfyldt')

  // Ét tryk er nok — ingen felter rettes først.
  await page.getByRole('button', { name: 'Log parathed', exact: true }).click()

  await page.waitForFunction(
    async (url) => {
      const res = await fetch(`${url}/__e2e/table?name=readiness_logs`)
      const rows = await res.json()
      return rows.length >= 3
    },
    mockUrl,
    { timeout: 10000 },
  )
  const logs = await readTable(mockUrl, 'readiness_logs')
  const todaysLog = logs.find(l => l.logged_date === todayStr())
  assert.ok(todaysLog, 'dagens check-in skal være gemt i mockens readiness_logs')
  assert.equal(todaysLog.sleep_hours, 6.5)
  assert.equal(todaysLog.energy, 3)
  assert.equal(todaysLog.motivation, 2)
  assert.equal(todaysLog.stress, 4)
  assert.equal(todaysLog.soreness_level, 3)
  assert.deepEqual(todaysLog.sore_zones, ['Ben'])

  // (2) Efter afsendelse: "hvad coachen ser" (ægte regnet ud fra historikken
  // + dagens log) og "hvad der ændrede sig sidst" (den lave score for 16
  // dage siden + Deload-ugens coach-note, 3 dage efter — inden for vinduet).
  await page.getByText('Det din coach ser', { exact: true }).waitFor({ state: 'visible' })
  await page.getByText('gns. søvn 5,7 timer', { exact: false }).waitFor({ state: 'visible' })
  await page.getByText('oftest øm: Ben', { exact: false }).waitFor({ state: 'visible' })
  await page.getByText('Sidst det gjorde en forskel', { exact: true }).waitFor({ state: 'visible' })
  await page.getByText('Skruet ned for volumen efter din tilbagemelding.', { exact: false }).waitFor({ state: 'visible' })
  await shot('03-efter-afsendelse')

  // (3) Nudgen er væk igen — dagens check-in dækker ugen nu.
  assert.equal(await page.getByText('Ugens check-in mangler stadig.', { exact: true }).count(), 0,
    'nudge-linjen skal forsvinde, når ugens check-in er logget')

  console.log('GRØN: check-in forudfyldes fra sidste log og sendes med ét tryk, viser bagefter hvad coachen ser og hvad et tidligere check-in ændrede, og ugens påmindelse forsvinder igen.')
}

async function main() {
  const { createMockSupabase } = await import('./mock-supabase.mjs')
  const { startVite, launchBrowser, APP_URL, MOCK_PORT, OUT_DIR } = await import('./harness.mjs')

  const mock = createMockSupabase(seedWithCheckinHistory())
  await mock.listen(MOCK_PORT)
  const vite = await startVite()
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    page.on('pageerror', err => console.error('[browser pageerror]', err))
    page.on('console', msg => { if (msg.type() === 'error') console.error('[console.error]', msg.text()) })
    await runCheckIn(page, { appUrl: APP_URL, mockUrl: `http://127.0.0.1:${MOCK_PORT}`, outDir: OUT_DIR })
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

if (process.argv[1] && process.argv[1].endsWith('check-in.spec.mjs')) main()
