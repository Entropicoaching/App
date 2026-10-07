// ORDRE 1502 (D3, Marcs V10 3A): en smerte-note standser appens stigningsforslag.
// To koersler paa 390: uden smerte staar "Forslag: X kg" i Dagens pas; med en
// smerte-note i en seneste uge er forslaget vaek. Coachens egen anbefaling er uroert.
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { ATHLETE_ID, ATHLETE_USER, buildSeed } from './fixtures.mjs'

const id = n => `99999999-9999-4999-8999-9999999999${n}`
const isoDaysAgo = days => { const d = new Date(); d.setUTCDate(d.getUTCDate() - days); return d.toISOString() }

function seed(kommentar) {
  const s = buildSeed()
  s.tables.exercises[0].recommended_weight = null // appens eget forslag skal frem
  s.tables.weeks.unshift({ id: id(41), athlete_id: ATHLETE_ID, week_number: 0, block_name: 'Forrige', start_date: isoDaysAgo(14).slice(0, 10) })
  s.tables.sessions.push({ id: id(42), week_id: id(41), title: 'Dag 1 — Squat', session_order: 1, weekday: 0, athlete_rating: null, athlete_comment: kommentar })
  s.tables.exercises.push({ id: id(43), session_id: id(42), name: 'Squat', sets: 1, reps: '5', intensity: 'RPE 8', note: null, exercise_order: 1, recommended_weight: 100 })
  s.tables.exercise_logs.push({ id: id(44), exercise_id: id(43), athlete_id: ATHLETE_ID, set_number: 1, weight: 100, reps_completed: 5, note: null, rpe_actual: 7, rpe_planned: 8, skipped: false, logged_at: isoDaysAgo(3) })
  return s
}

async function koer(kommentar, navn, forventForslag) {
  const { createMockSupabase } = await import('./mock-supabase.mjs')
  const { startVite, launchBrowser, MOCK_PORT, OUT_DIR } = await import('./harness.mjs')
  const mock = createMockSupabase(seed(kommentar))
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
    await page.screenshot({ path: join(OUT_DIR, `smerte-stop-1502-${navn}.png`), fullPage: true })
    assert.equal(antal > 0, forventForslag, `${navn}: Forslag-linjer = ${antal}`)
    console.log(`${navn}: Forslag-linjer ${antal} (forventet ${forventForslag ? '>0' : '0'})`)
  } finally {
    await browser.close(); await vite.stop(); await mock.close()
  }
}

async function main() {
  try {
    await koer('Godt pas, ingen smerter', '1-uden-smerte', true)
    await koer('Det gjorde ondt i knaeet', '2-med-smerte', false)
    console.log('GROEN: smerte-note standser stigningsforslaget, uden smerte staar forslaget')
  } catch (err) { console.error('\nFEJL:', err.message); process.exitCode = 1 }
}
if (process.argv[1] && process.argv[1].endsWith('smerte-stop-1502.spec.mjs')) main()
