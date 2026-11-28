// ORDRE 2484 · coachens forside viser hver atlet én gang blandt opgaverne: programslut i Kræver dig i dag og
// "Ingen uge sendt til næste mandag" i Mangler ny uge er samme opgave og står i atletens ene række.
// Kun syntetiske atleter, Chromium, fast tid lørdag 2026-11-28. Koersel:
// E2E_VITE_PORT=5484 E2E_MOCK_PORT=8984 VITE_SUPABASE_URL=http://127.0.0.1:8984 [E2E_BREDDE=1280] [E2E_TEMA=lys] node e2e/coach-forside-en-raekke-2484.spec.mjs
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { createMockSupabase } from './mock-supabase.mjs'
import { buildSeed, COACH_USER } from './fixtures.mjs'
import { startVite, launchBrowser, APP_URL, MOCK_PORT, OUT_DIR } from './harness.mjs'

const DESKTOP = process.env.E2E_BREDDE === '1280'
const LYS = process.env.E2E_TEMA === 'lys'
const LABEL = `${DESKTOP ? 1280 : 390}${LYS ? '-lys' : '-moerk'}`
const DAY = 86400000
const FAST_TID = '2026-11-28T08:00:00Z'
const addDays = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10)
// Lørdag: to atleters uge slutter i dag og i morgen uden uge til mandag (samme opgave to steder før), en slutter om 2 dage men dækker mandag, og én har kun en udløbet uge.
const ATLETER = [
  { navn: 'Atlet Slutter1', start: '2026-11-23' }, { navn: 'Atlet Slutter0', start: '2026-11-22' },
  { navn: 'Atlet Slutter2', start: '2026-11-24' }, { navn: 'Atlet Udløbet', start: '2026-11-09' },
  { navn: 'Atlet Fremme', start: '2026-11-23', naeste: '2026-11-30' },
]

function seed() {
  const data = buildSeed(), t = data.tables
  t.athletes = []; t.weeks = []; t.sessions = []; t.exercises = []; t.exercise_logs = []
  ATLETER.forEach((a, i) => {
    const n = String(i + 1).padStart(12, '0')
    const userId = `24840000-0000-4000-8000-${n}`, athleteId = `24841111-1111-4111-8111-${n}`
    t.profiles.push({ id: userId, role: 'athlete', email: `r${i + 1}@e2e.test`, last_seen: null })
    t.athletes.push({ id: athleteId, user_id: userId, name: a.navn, coach_id: COACH_USER.id, email: `r${i + 1}@e2e.test`,
      status: 'active', hidden: false, snooze_until: null, competition_date: null, onboarding_completed_at: '2026-09-01T08:00:00Z' })
    ;[a.start, a.naeste].filter(Boolean).forEach((start, w) => {
      const m = `${String(i + 1).padStart(2, '0')}${w + 1}`
      const weekId = `24842222-2222-4222-8222-000000000${m}`, sessionId = `24843333-3333-4333-8333-000000000${m}`
      t.weeks.push({ id: weekId, athlete_id: athleteId, week_number: w + 1, block_name: 'Base', start_date: start })
      t.sessions.push({ id: sessionId, week_id: weekId, title: 'Dag 1 · Squat', session_order: 1, weekday: 0, athlete_rating: null, athlete_comment: null })
      t.exercises.push({ id: `24844444-4444-4444-8444-000000000${m}`, session_id: sessionId, name: 'Squat', sets: 3, reps: '5', intensity: 'RPE 8', note: null, exercise_order: 1, recommended_weight: 100 })
    })
  })
  t.messages = []; t.video_analyses = []
  return data
}

async function main() {
  const mock = createMockSupabase(seed())
  await mock.listen(MOCK_PORT)
  const vite = await startVite(), browser = await launchBrowser()
  try {
    const page = await browser.newPage({ viewport: DESKTOP ? { width: 1280, height: 900 } : { width: 390, height: 844 }, colorScheme: LYS ? 'light' : 'dark' })
    const fejl = []
    page.on('pageerror', err => fejl.push(err.message))
    page.on('console', m => { if (m.type() === 'error') fejl.push(m.text()) })
    await page.clock.setFixedTime(new Date(FAST_TID))
    await page.goto(APP_URL)
    if (LYS) { await page.evaluate(() => localStorage.setItem('entropi:tema', 'lys')); await page.reload() }
    await page.locator('#athlete-auth-email').fill(COACH_USER.email)
    await page.locator('#athlete-auth-password').fill(COACH_USER.password)
    await page.getByRole('button', { name: 'Log ind' }).click()
    const idag = page.locator('[data-coach-idag]')
    await idag.locator('[data-coach-action]').first().waitFor({ state: 'visible', timeout: 20000 })
    await page.waitForTimeout(1500)
    const raekker = await idag.locator('[data-coach-action]').allInnerTexts()
    const nyUge = await page.locator('[data-coach-uge="ny-uge"] [data-coach-action]').allInnerTexts().catch(() => [])
    const navneIdag = ATLETER.map(a => a.navn).filter(n => raekker.some(r => r.includes(n)))
    const navneNyUge = ATLETER.map(a => a.navn).filter(n => nyUge.some(r => r.includes(n)))
    assert.deepEqual(navneIdag.sort(), ['Atlet Slutter0', 'Atlet Slutter1', 'Atlet Slutter2'], `Kræver dig i dag: ${raekker}`)
    assert.deepEqual(navneNyUge, ['Atlet Udløbet'], `Mangler ny uge: ${nyUge}`)
    assert.equal(navneIdag.filter(n => navneNyUge.includes(n)).length, 0)
    assert.equal(await page.locator('[data-coach-uge-grund]').count(), 2, JSON.stringify({ raekker, nyUge }))
    await page.screenshot({ path: join(process.env.E2E_2484_OUT || OUT_DIR, `coach-forside-en-raekke-2484-${LABEL}.png`), fullPage: false })
    const bred = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    assert.ok(bred <= 0, `ingen vandret scroll, fandt ${bred}px`)
    assert.deepEqual(fejl, [], `Ingen fejl forventet: ${JSON.stringify(fejl)}`)
    console.log(`GRØN: ${LABEL}`)
  } catch (err) { console.error('\nFEJL:', err.message); process.exitCode = 1 }
  finally { await browser.close().catch(() => {}); await vite.stop().catch(() => {}); await mock.close().catch(() => {}) }
}
if (process.argv[1] && process.argv[1].endsWith('coach-forside-en-raekke-2484.spec.mjs')) main()
