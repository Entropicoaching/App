// ORDRE 2465 (kort: Program-kortet Dine resultater)
// ORDRE 2458: atletens og coachens hele flade efter aftenens fire push (390x844, lys og moerk, syntetisk atlet midt i en blok paa 5 uger).
// Kør: E2E_VITE_PORT=5458 E2E_MOCK_PORT=8958 VITE_SUPABASE_URL=http://127.0.0.1:8958 node e2e/efter-push-2458.skaerm.mjs <mappe>
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ATHLETE_USER, COACH_USER, ATHLETE_ID, buildSeed, kostPakkeTilAtlet } from './fixtures.mjs'

const OUT = process.argv[2] || 'outputs/_seneste/2458'
mkdirSync(OUT, { recursive: true })
const day = (d, plus) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + plus); return x.toISOString().slice(0, 10) }

function seed() {
  const s = buildSeed({ withLogs: false }); kostPakkeTilAtlet(s.tables)
  const monday = s.tables.weeks[0].start_date
  const starts = [-28, -21, -14, -7, 0].map(p => day(monday, p))
  const lifts = [['Squat', 100], ['Bænkpres', 70]]
  const t = s.tables
  t.weeks = []; t.sessions = []; t.exercises = []; t.exercise_logs = []; t.weight_logs = []
  starts.forEach((start, i) => {
    t.weeks.push({ id: `w-${i}`, athlete_id: ATHLETE_ID, week_number: i + 1, block_name: 'Styrke', start_date: start })
    t.sessions.push({ id: `s-${i}`, week_id: `w-${i}`, title: `Dag 1 uge ${i + 1}`, session_order: 1, weekday: 0, athlete_rating: null, athlete_comment: null })
    lifts.forEach(([name, base], j) => {
      t.exercises.push({ id: `e-${i}-${j}`, session_id: `s-${i}`, name, sets: 1, reps: '3', intensity: 'RPE 8', note: null, exercise_order: j + 1, recommended_weight: base })
      if (i < 4) t.exercise_logs.push({ id: `l-${i}-${j}`, exercise_id: `e-${i}-${j}`, athlete_id: ATHLETE_ID, set_number: 1,
        weight: base + i * 5, reps_completed: 3, note: null, rpe_actual: 8, rpe_planned: 8, skipped: false, logged_at: start + 'T09:00:00Z' })
    })
  })
  t.weight_logs = [
    { id: 'v-1', athlete_id: ATHLETE_ID, weight: 82.4, logged_at: day(starts[0], 1) },
    { id: 'v-2', athlete_id: ATHLETE_ID, weight: 81.1, logged_at: day(starts[4], 0) },
  ]
  const nu = new Date().toISOString()
  t.messages = [
    { id: 'b0000000-0000-4000-8000-000000000001', athlete_id: ATHLETE_ID, sender_role: 'athlete', content: 'Hvordan skal jeg tage mandagens saet?', created_at: new Date(Date.now() - 7200e3).toISOString() },
    { id: 'b0000000-0000-4000-8000-000000000002', athlete_id: ATHLETE_ID, sender_role: 'coach', content: 'Hold dig til RPE 8 og skriv, hvordan det foeltes.', created_at: nu },
  ]
  return s
}

async function klik(page, navn) {
  await page.getByRole('button', { name: new RegExp('^' + navn + '\\b') }).last().evaluate(el => el.click())
  await page.waitForTimeout(900)
}
async function atlet(browser, createMockSupabase, MOCK_PORT, APP_URL, tema, tag) {
  const mock = createMockSupabase(seed()); await mock.listen(MOCK_PORT)
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
  try {
    const page = await ctx.newPage()
    await page.addInitScript(([t]) => {
      try { if (!localStorage.getItem('entropi:tema')) localStorage.setItem('entropi:tema', t) } catch {}
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
    await klik(page, 'Program')
    const kort = page.locator('details[aria-label="Dine resultater"]')
    await kort.first().waitFor({ state: 'attached', timeout: 15000 })
    await kort.first().evaluate(el => { el.open = true; el.scrollIntoView({ block: 'center' }) }); await page.waitForTimeout(500)
    console.log(tag, tema, (await kort.first().innerText()).replace(/\s+/g, ' ').slice(0, 300))
    await page.screenshot({ path: join(OUT, `${tag}-${tema}.png`) })
  } finally { await ctx.close().catch(() => {}); await mock.close?.() }
}
const { createMockSupabase } = await import('./mock-supabase.mjs')
const { startVite, launchBrowser, APP_URL, MOCK_PORT } = await import('./harness.mjs')
const vite = await startVite(); const browser = await launchBrowser()
try { for (const t of ['lys', 'moerk']) await atlet(browser, createMockSupabase, MOCK_PORT, APP_URL, t, process.argv[3] || 'efter') }
finally { await browser.close().catch(() => {}); await vite.stop().catch(() => {}) }
