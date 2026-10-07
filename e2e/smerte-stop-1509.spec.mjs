// ORDRE 1509 (fund 2 paa 1502): smerte-stoppet er region- og datobaseret.
// Tre koersler paa 390 (Squat i Dagens pas): knae-note stopper; skulder-note stopper ikke
// squat; en gammel knae-note (logget for 20 dage siden) stopper ikke.
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { ATHLETE_ID, ATHLETE_USER, buildSeed } from './fixtures.mjs'

const id = n => `99999999-9999-4999-8999-9999999999${n}`
const isoDaysAgo = days => { const d = new Date(); d.setUTCDate(d.getUTCDate() - days); return d.toISOString() }

function seed(kommentar, ugeDage = 14, logDage = 3) {
  const s = buildSeed()
  s.tables.exercises[0].recommended_weight = null // appens eget forslag skal frem
  s.tables.weeks.unshift({ id: id(41), athlete_id: ATHLETE_ID, week_number: 0, block_name: 'Forrige', start_date: isoDaysAgo(ugeDage).slice(0, 10) })
  s.tables.sessions.push({ id: id(42), week_id: id(41), title: 'Dag 1 — Squat', session_order: 1, weekday: 0, athlete_rating: null, athlete_comment: kommentar })
  s.tables.exercises.push({ id: id(43), session_id: id(42), name: 'Squat', sets: 1, reps: '5', intensity: 'RPE 8', note: null, exercise_order: 1, recommended_weight: 100 })
  s.tables.exercise_logs.push({ id: id(44), exercise_id: id(43), athlete_id: ATHLETE_ID, set_number: 1, weight: 100, reps_completed: 5, note: null, rpe_actual: 7, rpe_planned: 8, skipped: false, logged_at: isoDaysAgo(logDage) })
  return s
}

async function koer(kommentar, navn, forventForslag, ugeDage, logDage) {
  const { createMockSupabase } = await import('./mock-supabase.mjs')
  const { startVite, launchBrowser, MOCK_PORT, OUT_DIR } = await import('./harness.mjs')
  const mock = createMockSupabase(seed(kommentar, ugeDage, logDage))
  await mock.listen(MOCK_PORT)
  const vite = await startVite()
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    page.on('pageerror', err => console.error('[browser pageerror]', err))
    await page.goto(`http://127.0.0.1:${process.env.E2E_VITE_PORT || 5185}/`)
    await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
    await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
    await page.getByRole('button', { name: 'Log ind' }).click()
    await page.getByText('Dagens pas', { exact: true }).waitFor({ state: 'visible', timeout: 20000 })
    await page.getByText(/Sæt 1\/4$/).waitFor({ state: 'visible' })
    await page.getByText('Sidste gang:', { exact: false }).waitFor({ state: 'visible', timeout: 10000 })
    await page.waitForTimeout(500)
    const antal = await page.getByText(/Forslag: [\d.,]+ kg/).count()
    await page.screenshot({ path: join(OUT_DIR, `smerte-stop-1509-${navn}.png`), fullPage: true })
    assert.equal(antal > 0, forventForslag, `${navn}: Forslag-linjer = ${antal}`)
    console.log(`${navn}: Forslag-linjer ${antal} (forventet ${forventForslag ? '>0' : '0'})`)
  } finally {
    await browser.close(); await vite.stop(); await mock.close()
  }
}

async function main() {
  try {
    await koer('Det gjorde ondt i knaeet', '1-knae-stopper-squat', false)
    await koer('Det gjorde ondt i skulderen', '2-skulder-stopper-ikke-squat', true)
    await koer('Det gjorde ondt i knaeet', '3-gammel-note-stopper-ikke', true, 28, 20)
    console.log('GROEN: region og dato afgoer, om forslaget standses')
  } catch (err) { console.error('\nFEJL:', err.message); process.exitCode = 1 }
}
if (process.argv[1] && process.argv[1].endsWith('smerte-stop-1509.spec.mjs')) main()
