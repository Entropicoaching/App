// ORDRE 2418: "Dine resultater" i Program ved blokkens sidste uge, 390x844, lys og mørk, syntetisk træningsatlet (3 ugers blok, løft og kropsvægt).
// Kør: E2E_VITE_PORT=5418 E2E_MOCK_PORT=8918 VITE_SUPABASE_URL=http://127.0.0.1:8918 node e2e/blokresultat-2418.skaerm.mjs <mappe>
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { ATHLETE_USER, ATHLETE_ID, buildSeed } from './fixtures.mjs'

const OUT = process.argv[2] || 'outputs/_seneste/2418'
mkdirSync(OUT, { recursive: true })

const day = (d, plus) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + plus); return x.toISOString().slice(0, 10) }
function seed() {
  const s = buildSeed({ withLogs: false })
  const monday = s.tables.weeks[0].start_date
  const starts = [day(monday, -14), day(monday, -7), monday]
  const lifts = [['Squat', 100], ['Bænkpres', 70]]
  s.tables.weeks = []; s.tables.sessions = []; s.tables.exercises = []; s.tables.exercise_logs = []; s.tables.weight_logs = []
  starts.forEach((start, i) => {
    s.tables.weeks.push({ id: `w-${i}`, athlete_id: ATHLETE_ID, week_number: i + 1, block_name: 'Styrke', start_date: start })
    s.tables.sessions.push({ id: `s-${i}`, week_id: `w-${i}`, title: `Dag 1 uge ${i + 1}`, session_order: 1, weekday: 0, athlete_rating: null, athlete_comment: null })
    lifts.forEach(([name, base], j) => {
      s.tables.exercises.push({ id: `e-${i}-${j}`, session_id: `s-${i}`, name, sets: 1, reps: '3', intensity: 'RPE 8', note: null, exercise_order: j + 1, recommended_weight: base })
      s.tables.exercise_logs.push({ id: `l-${i}-${j}`, exercise_id: `e-${i}-${j}`, athlete_id: ATHLETE_ID, set_number: 1,
        weight: base + i * 5, reps_completed: 3, note: null, rpe_actual: 8, rpe_planned: 8, skipped: false, logged_at: start + 'T09:00:00Z' })
    })
  })
  s.tables.weight_logs = [
    { id: 'v-1', athlete_id: ATHLETE_ID, weight: 82.4, logged_at: day(starts[0], 1) },
    { id: 'v-2', athlete_id: ATHLETE_ID, weight: 81.1, logged_at: day(starts[2], 0) },
  ]
  return { users: s.users, tables: s.tables }
}
async function kor(browser, createMockSupabase, MOCK_PORT, APP_URL, tema) {
  const mock = createMockSupabase(seed()); await mock.listen(MOCK_PORT)
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
  try {
    const page = await ctx.newPage()
    page.on('pageerror', err => console.error('[pageerror]', tema, err.message))
    await page.addInitScript(([t]) => {
      try { localStorage.setItem('entropi:tema', t) } catch {}
      try { Object.defineProperty(Notification, 'permission', { get: () => 'default' }) } catch {}
    }, [tema])
    await page.goto(APP_URL)
    await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
    await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
    await page.getByRole('button', { name: 'Log ind' }).click()
    await page.getByRole('button', { name: 'Hjem', exact: true }).first().waitFor({ state: 'attached', timeout: 25000 })
    await page.waitForTimeout(1500)
    const skip = page.getByRole('button', { name: /Spring over/ })
    if (await skip.count()) { await skip.first().evaluate(el => el.click()); await page.waitForTimeout(400) }
    await page.getByRole('button', { name: 'Program', exact: true }).first().evaluate(el => el.click())
    const kort = page.locator('details[aria-label="Dine resultater"]')
    await kort.waitFor({ state: 'attached', timeout: 15000 })
    await kort.locator('summary').first().evaluate(el => el.click())
    await page.waitForTimeout(600)
    console.log(tema, (await kort.innerText()).replace(/\s+/g, ' ').slice(0, 400))
    await kort.scrollIntoViewIfNeeded()
    await page.screenshot({ path: join(OUT, `resultat-${tema}.png`), fullPage: false })
  } finally { await ctx.close(); await mock.close().catch(() => {}) }
}
const { createMockSupabase } = await import('./mock-supabase.mjs')
const { startVite, launchBrowser, APP_URL, MOCK_PORT } = await import('./harness.mjs')
const vite = await startVite(); const browser = await launchBrowser()
try { for (const t of ['lys', 'moerk']) await kor(browser, createMockSupabase, MOCK_PORT, APP_URL, t) }
catch (e) { console.error(e); process.exitCode = 1 }
finally { await browser.close().catch(() => {}); await vite.stop().catch(() => {}) }
