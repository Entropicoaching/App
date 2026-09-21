// ORDRE 284 · commit 3 — Fremgang-fanen klikket igennem i den ÆGTE,
// ubuildede app (npm run dev) mod den lokale mock, på en 360px telefon: åbn
// fanen (Squat vises automatisk, kurven har to uger), skift til en anden
// øvelse der ikke er logget endnu ("Ingen logninger endnu."), kom tilbage
// til Squat og se kurven stå der uændret.
//
// Egen, isoleret mock+vite-instans (samme grund som dagens-pas/check-in/
// atlet-uge: kræver sin egen exercise_logs-historik i to forskellige
// kalenderuger, som ville forstyrre run-all.mjs's delte choreografi). Egen
// kørsel: `npm run e2e:fremgang`.

import assert from 'node:assert/strict'
import { join } from 'node:path'
import { ATHLETE_USER, ATHLETE_ID, SESSION_ID, EXERCISE_ID, buildSeed } from './fixtures.mjs'

const BICEP_EXERCISE_ID = '99999999-9999-4999-8999-999999999941'
const OLD_SQUAT_LOG_ID = '99999999-9999-4999-8999-999999999942'
const NEW_SQUAT_LOG_ID = '99999999-9999-4999-8999-999999999943'

function isoDaysAgo(days) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString()
}

// To Squat-logs 14 dage fra hinanden — garanteret to forskellige
// kalenderuger (ugenoegle() i src/volume/beregn.js) — plus én ulogget
// øvelse ("Bicep curl", hverken squat/bænk/dødløft) til "skift til en tom
// øvelse".
function seedWithProgressHistory() {
  const seed = buildSeed()
  const { tables } = seed
  tables.exercises.push({
    id: BICEP_EXERCISE_ID, session_id: SESSION_ID, name: 'Bicep curl',
    sets: 3, reps: '10', intensity: 'RPE 7', note: null,
    exercise_order: 2, recommended_weight: 15,
  })
  tables.exercise_logs = [
    {
      id: OLD_SQUAT_LOG_ID, exercise_id: EXERCISE_ID, athlete_id: ATHLETE_ID, set_number: 1,
      weight: 80, reps_completed: 5, note: null, rpe_actual: null, rpe_planned: null,
      skipped: false, logged_at: isoDaysAgo(14),
    },
    {
      id: NEW_SQUAT_LOG_ID, exercise_id: EXERCISE_ID, athlete_id: ATHLETE_ID, set_number: 1,
      weight: 85, reps_completed: 5, note: null, rpe_actual: null, rpe_planned: null,
      skipped: false, logged_at: isoDaysAgo(0),
    },
  ]
  return seed
}

/** `page` er en frisk Playwright-side, `appUrl`/`mockUrl` peger på den
 * kørende vite-server hhv. mock-backend. */
export async function runFremgang(page, { appUrl, outDir }) {
  const shot = (name) => page.screenshot({ path: join(outDir, `fremgang-${name}.png`), fullPage: true })

  await page.goto(appUrl)
  await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
  await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  await page.getByText('Dagens pas', { exact: true }).waitFor({ state: 'visible', timeout: 15000 })

  // ---- 1) Åbn Fremgang — Squat er den eneste øvelse med logs, vælges automatisk ----
  await page.getByRole('button', { name: 'Fremgang', exact: true }).click()
  await page.getByText('Bliver du stærkere?', { exact: true }).waitFor({ state: 'visible', timeout: 10000 })
  await page.getByRole('button', { name: 'Squat', exact: true }).waitFor({ state: 'visible' })
  await page.getByText(/kg e1RM/, { exact: false }).waitFor({ state: 'visible', timeout: 5000 })
  await page.getByText('85×5', { exact: false }).waitFor({ state: 'visible' })
  await shot('01-squat-kurve')

  // ---- 2) Skift til en øvelse uden logs — "Ingen logninger endnu." ----
  await page.locator('select').selectOption({ label: 'Bicep curl' })
  await page.getByText('Ingen logninger endnu.', { exact: true }).waitFor({ state: 'visible', timeout: 5000 })
  assert.equal(await page.getByText(/kg e1RM/, { exact: false }).count(), 0, 'en tom øvelse skal ikke vise en kurve')
  await shot('02-tom-oevelse')

  // ---- 3) Kom tilbage til Squat — kurven er der stadig, uændret ----
  await page.getByRole('button', { name: 'Squat', exact: true }).click()
  await page.getByText(/kg e1RM/, { exact: false }).waitFor({ state: 'visible', timeout: 5000 })
  await page.getByText('85×5', { exact: false }).waitFor({ state: 'visible' })
  assert.equal(await page.getByText('Ingen logninger endnu.', { exact: true }).count(), 0, 'Squats kurve skal være tilbage, ikke tomtilstanden')
  await shot('03-tilbage-til-squat')

  console.log('GRØN: Fremgang-fanen på 360px — Squat-kurven vises automatisk, skift til en tom øvelse viser "Ingen logninger endnu.", og at komme tilbage viser Squats kurve igen, uændret.')
}

async function main() {
  const { createMockSupabase } = await import('./mock-supabase.mjs')
  const { startVite, launchBrowser, APP_URL, MOCK_PORT, OUT_DIR } = await import('./harness.mjs')

  const mock = createMockSupabase(seedWithProgressHistory())
  await mock.listen(MOCK_PORT)
  const vite = await startVite()
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage({ viewport: { width: 360, height: 780 } })
    page.on('pageerror', err => console.error('[browser pageerror]', err))
    page.on('console', msg => { if (msg.type() === 'error') console.error('[console.error]', msg.text()) })
    await runFremgang(page, { appUrl: APP_URL, mockUrl: `http://127.0.0.1:${MOCK_PORT}`, outDir: OUT_DIR })
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

if (process.argv[1] && process.argv[1].endsWith('fremgang.spec.mjs')) main()
