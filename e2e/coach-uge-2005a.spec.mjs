// ORDRE 2005a (Marc 20. nov.: "husk jeg er pt den eneste træner, kan vi arbejde på at optimere mit
// orkflow"): en typisk mandag med 5 syntetiske atleter. Prøven måler, hvor mange tryk coachen bruger
// fra forsiden til hvert trin i ugen, og tager skærmbilleder af forsiden.
//   A Atlet Besked: ulæst besked, uge sendt til denne og næste uge
//   B Atlet Video: video venter på feedback, uge sendt til denne og næste uge
//   C Atlet Slutter: programmet slutter søndag (mangler ny uge)
//   D Atlet Udløbet: programmet udløb for en uge siden (mangler ny uge, ingen log i sidste uge)
//   E Atlet Sendt: uge sendt til denne og næste uge, intet venter
//
// Kørsel: node e2e/coach-uge-2005a.spec.mjs. E2E_BREDDE=1280 for desktop, E2E_TEMA=lys for lyst tema.
// E2E_2005A_FOER=1 måler uden at kræve den nye forside (bruges til før-målingen på main).

import assert from 'node:assert/strict'
import { join } from 'node:path'
import { createMockSupabase } from './mock-supabase.mjs'
import { buildSeed, COACH_USER } from './fixtures.mjs'
import { startVite, launchBrowser, APP_URL, MOCK_PORT, OUT_DIR } from './harness.mjs'

const FOER = process.env.E2E_2005A_FOER === '1'
const DESKTOP = process.env.E2E_BREDDE === '1280'
const LYS = process.env.E2E_TEMA === 'lys'
const LABEL = `${FOER ? 'foer' : 'efter'}-${DESKTOP ? 1280 : 390}${LYS ? '-lys' : ''}`

const DAY = 86400000
const copenhagenToday = () => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date()).map(x => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}`
}
const addDays = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10)
const agoIso = minutes => new Date(Date.now() - minutes * 60000).toISOString()

export const ATLETER = [
  { key: 'a', navn: 'Atlet Besked', uger: [0, 7] },
  { key: 'b', navn: 'Atlet Video', uger: [0, 7] },
  { key: 'c', navn: 'Atlet Slutter', uger: [-7, 0] },
  { key: 'd', navn: 'Atlet Udløbet', uger: [-14, -7] },
  { key: 'e', navn: 'Atlet Sendt', uger: [0, 7] },
]

export function buildMandag() {
  const seed = buildSeed()
  const { tables } = seed
  const today = copenhagenToday()
  const monday = addDays(today, -((new Date(today + 'T00:00:00Z').getUTCDay() + 6) % 7))
  tables.athletes = []; tables.weeks = []; tables.sessions = []; tables.exercises = []; tables.exercise_logs = []
  const ids = {}
  ATLETER.forEach((atlet, i) => {
    const n = String(i + 1).padStart(12, '0')
    const userId = `20050000-0000-4000-8000-${n}`
    const athleteId = `20051111-1111-4111-8111-${n}`
    ids[atlet.key] = athleteId
    tables.profiles.push({ id: userId, role: 'athlete', email: `uge${i + 1}@e2e.test`, last_seen: null })
    tables.athletes.push({ id: athleteId, user_id: userId, name: atlet.navn, coach_id: COACH_USER.id, email: `uge${i + 1}@e2e.test`,
      status: 'active', hidden: false, snooze_until: null, competition_date: null, onboarding_completed_at: agoIso(60 * 24 * 30) })
    atlet.uger.forEach((offset, w) => {
      const m = `${String(i + 1).padStart(2, '0')}${w + 1}`
      const weekId = `20052222-2222-4222-8222-000000000${m}`
      const sessionId = `20053333-3333-4333-8333-000000000${m}`
      tables.weeks.push({ id: weekId, athlete_id: athleteId, week_number: w + 1, block_name: 'Base', start_date: addDays(monday, offset) })
      tables.sessions.push({ id: sessionId, week_id: weekId, title: 'Dag 1 · Squat', session_order: 1, weekday: 0, athlete_rating: null, athlete_comment: null })
      tables.exercises.push({ id: `20054444-4444-4444-8444-000000000${m}`, session_id: sessionId, name: 'Squat', sets: 3, reps: '5', intensity: 'RPE 8', note: null, exercise_order: 1, recommended_weight: 100 })
    })
  })
  tables.messages = [
    { id: '20055555-5555-4555-8555-000000000001', athlete_id: ids.a, sender_role: 'athlete', content: 'Hej coach, mandag gik fint.', category: 'besked', read_by_coach: false, created_at: agoIso(90) },
  ]
  tables.video_analyses = [
    { id: '20056666-6666-4666-8666-000000000001', athlete_id: ids.b, lift: 'squat', variation: 'competition_squat', load_kg: 100, reps_count: null, status: 'draft', source_mode: 'athlete_submission', analysis_state: null, created_at: agoIso(60) },
  ]
  return seed
}

// Ét tryk tælles for hver lukket fold, der skal åbnes, og for selve knappen.
async function tapTo(page, locator) {
  let taps = 0
  // Efter Tilbage henter forsiden igen; vent, til knappen findes, før folderne tælles.
  await locator.waitFor({ state: 'attached', timeout: 15000 })
  for (let guard = 0; guard < 4 && !(await locator.isVisible()); guard++) {
    const summary = await locator.evaluate(el => {
      const closed = []
      for (let p = el.parentElement; p; p = p.parentElement) if (p.tagName === 'DETAILS' && !p.open) closed.push(p)
      const outer = closed.at(-1)
      if (!outer) return false
      outer.querySelector(':scope > summary')?.setAttribute('data-2005a-aabn', '1')
      return true
    })
    if (!summary) break
    await page.locator('summary[data-2005a-aabn="1"]').first().click()
    await page.locator('summary[data-2005a-aabn="1"]').first().evaluate(el => el.removeAttribute('data-2005a-aabn'))
    taps++
  }
  await locator.click()
  return taps + 1
}

async function tilbage(page) {
  await page.getByText(/← Tilbage til/).first().click()
  await page.locator('[data-entropi2-coach]').waitFor({ state: 'visible', timeout: 10000 })
}

export async function runCoachUge(page, { appUrl, outDir, desktop }) {
  const shot = name => page.screenshot({ path: join(outDir, `coach-uge-2005a-${LABEL}-${name}.png`), fullPage: false })
  await page.goto(appUrl)
  if (LYS) { await page.evaluate(() => localStorage.setItem('entropi:tema', 'lys')); await page.reload() }
  await page.locator('#athlete-auth-email').fill(COACH_USER.email)
  await page.locator('#athlete-auth-password').fill(COACH_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  await page.getByRole('button', { name: /Åbn programmet for Atlet Sendt/ }).waitFor({ state: 'visible', timeout: 20000 })
  await page.waitForTimeout(1500)
  await shot('forside')
  const tryk = {}

  // 1. Hvem mangler ny uge: åbn programmet for de to atleter uden næste uge.
  tryk.nyUgeSlutter = await tapTo(page, page.locator('button', { hasText: /Atlet Slutter · Program/ }).first())
  await page.getByText(/← Tilbage til/).first().waitFor({ state: 'visible', timeout: 10000 })
  await tilbage(page)
  tryk.nyUgeUdloebet = await tapTo(page, page.locator('button', { hasText: /Atlet Udløbet · Program/ }).first())
  await page.getByText(/← Tilbage til/).first().waitFor({ state: 'visible', timeout: 10000 })
  await tilbage(page)

  // 2. Beskeder og videoer der venter.
  tryk.besked = await tapTo(page, page.locator('button', { hasText: /Atlet Besked · 1 ulæst besked/ }).first())
  await page.getByText('Hej coach, mandag gik fint.').first().waitFor({ state: 'visible', timeout: 10000 })
  await tilbage(page)
  tryk.video = await tapTo(page, page.locator('button', { hasText: /Atlet Video · Video venter/ }).first())
  // Videoen åbner gennemgangen som dialog over atletens side; Luk er ikke en del af vejen ind.
  await page.locator('[role="dialog"]').first().waitFor({ state: 'visible', timeout: 10000 })
  await page.locator('[role="dialog"] button', { hasText: /^Luk$/ }).first().click()
  await tilbage(page)

  // 3. Hvad er sendt: står det på forsiden, er det 0 tryk; ellers ét tryk ind og ét tilbage pr. atlet med sendt uge.
  const sendt = page.locator('[data-coach-uge="sendt"]')
  if (await sendt.count() && await sendt.isVisible()) {
    // Efter Tilbage henter forsiden kalenderen igen; vent på rækkerne.
    await page.waitForFunction(() => document.querySelectorAll('[data-coach-uge="sendt"] button').length >= 3, null, { timeout: 15000 })
    const tekst = await sendt.innerText()
    for (const navn of ['Atlet Besked', 'Atlet Video', 'Atlet Sendt']) assert.ok(tekst.includes(navn), `Sendt skal nævne ${navn}: ${tekst}`)
    for (const navn of ['Atlet Slutter', 'Atlet Udløbet']) assert.ok(!tekst.includes(navn), `Sendt må ikke nævne ${navn}: ${tekst}`)
    tryk.sendt = 0
  } else {
    let n = 0
    for (const navn of ['Atlet Besked', 'Atlet Video', 'Atlet Sendt']) {
      n += await tapTo(page, page.getByRole('button', { name: new RegExp(`Åbn programmet for ${navn}`), includeHidden: true }))
      await page.getByText(/← Tilbage til/).first().waitFor({ state: 'visible', timeout: 10000 })
      await tilbage(page); n++
    }
    tryk.sendt = n
  }

  // 4. Ny atlet.
  const ny = page.getByRole('button', { name: /^\+ (Ny|Tilføj) atlet$/ }).first()
  if (await ny.isVisible()) tryk.nyAtlet = await tapTo(page, ny)
  else if (!desktop) {
    await page.getByRole('button', { name: /^Menu$/ }).first().click()
    await page.getByRole('button', { name: /Tilføj atlet/ }).first().click()
    tryk.nyAtlet = 2
  } else tryk.nyAtlet = null
  if (tryk.nyAtlet !== null) await page.getByRole('button', { name: /Opret atlet|Næste|Annuller/ }).first().waitFor({ state: 'visible', timeout: 10000 })

  console.log(`TRYK ${LABEL} ${JSON.stringify(tryk)}`)
  if (!FOER) {
    assert.deepEqual(tryk, { nyUgeSlutter: 1, nyUgeUdloebet: 1, besked: 1, video: 1, sendt: 0, nyAtlet: 1 })
    console.log(`\nGRØN: coachens uge ${LABEL}: ny uge, besked og video med ét tryk, sendt på forsiden, ny atlet med ét tryk.`)
  }
  return tryk
}

async function main() {
  const mock = createMockSupabase(buildMandag())
  await mock.listen(MOCK_PORT)
  const vite = await startVite()
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage({ viewport: DESKTOP ? { width: 1280, height: 900 } : { width: 390, height: 844 },
      colorScheme: LYS ? 'light' : 'dark' })
    const errors = []
    page.on('pageerror', err => errors.push(`pageerror: ${err.message}`))
    await runCoachUge(page, { appUrl: APP_URL, outDir: process.env.E2E_2005A_OUT || OUT_DIR, desktop: DESKTOP })
    const bred = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    assert.ok(bred <= 0, `ingen vandret scroll, fandt ${bred}px`)
    assert.deepEqual(errors, [], `Ingen sidefejl forventet: ${JSON.stringify(errors)}`)
    process.exitCode = 0
  } catch (err) {
    console.error('\nFEJL:', err.message)
    process.exitCode = 1
  } finally {
    await browser.close().catch(() => {})
    await vite.stop().catch(() => {})
    await mock.close().catch(() => {})
  }
}

if (process.argv[1] && process.argv[1].endsWith('coach-uge-2005a.spec.mjs')) main()
