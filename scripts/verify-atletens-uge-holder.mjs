// ORDRE 276 · commit 4 — beviser blok 1's "tilstande der ikke er den pæne"
// for "Ugen som planlagt" (ordre 268) i den ÆGTE, ubuildede app mod den
// lokale mock-backend, ved en telefon-bredde (360px): en tom uge (ingen
// sessioner overhovedet), en halv uge med et femcifret tonnage-tal, og
// (blok 2) "Sidste uge" side om side med denne. Samme grænse som ordre
// 268's egen verify-script: ligger i scripts/, ikke e2e/ — Bhishak arbejder
// i entropi-app-wt2 på prøverne (ordre 269), og ordren forbyder at røre
// e2e/ og scripts/proever.mjs. Importerer kun (læser) mock-supabase.mjs/
// harness.mjs fra e2e/ — ingen af de filer ændret.
//
// Egen, minimal seed pr. scenarie (ikke e2e/fixtures.mjs's buildSeed — den
// giver ingen nem vej til en HELT sessionsløs uge eller et bevidst
// femcifret tal), samme id-mønster (faste, opdigtede UUID'er) som
// fixtures.mjs.

import { join } from 'node:path'

const COACH_USER = { id: '11111111-1111-4111-8111-111111111112', email: 'coach-276@e2e.test', password: 'e2e-pass-coach', role: 'coach' }
const ATHLETE_USER = { id: '22222222-2222-4222-8222-222222222223', email: 'atlet-276@e2e.test', password: 'e2e-pass-atlet', role: 'athlete' }
const ATHLETE_ID = '33333333-3333-4333-8333-333333333334'
const WEEK_ID = '44444444-4444-4444-8444-444444444445'
const SESSION_ID = '55555555-5555-4555-8555-555555555556'
const EXERCISE_ID = '66666666-6666-4666-8666-666666666667'

function isoNow() { return new Date().toISOString() }

// weekday: 0=mandag..6=søndag i appens egen skala (se WEEKDAYS_LONG i
// AthleteView.jsx), sat til i dag — samme princip som fixtures.mjs's
// (ikke-eksporterede) todayWeekdayIdx().
function todayWeekdayIdx() {
  const jsDay = new Date().getDay()
  return jsDay === 0 ? 6 : jsDay - 1
}

function grundSeed() {
  return {
    users: [COACH_USER, ATHLETE_USER],
    tables: {
      profiles: [
        { id: COACH_USER.id, role: 'coach', email: COACH_USER.email, last_seen: null },
        { id: ATHLETE_USER.id, role: 'athlete', email: ATHLETE_USER.email, last_seen: null },
      ],
      athletes: [{
        id: ATHLETE_ID, user_id: ATHLETE_USER.id, name: 'Testatlet 276', email: ATHLETE_USER.email,
        status: 'active', hidden: false, snooze_until: null, competition_date: null,
        onboarding_completed_at: isoNow(),
      }],
      weeks: [],
      sessions: [],
      exercises: [],
      exercise_logs: [],
      readiness_logs: [],
      personal_records: [],
      messages: [],
      video_analyses: [],
    },
  }
}

/** Scenarie A: en helt tom uge — programmet findes, men ugen har ingen sessioner. */
function seedTomUge() {
  const seed = grundSeed()
  seed.tables.weeks = [{ id: WEEK_ID, athlete_id: ATHLETE_ID, week_number: 1, block_name: 'Base' }]
  seed.tables.sessions = [] // ingen sessioner overhovedet denne uge
  return seed
}

/** Scenarie B: halv uge, tallene vokset til fem cifre (sets:4, reps:20,
 * recommended_weight:250 → planlagt tonnage 4×20×250=20000; 2 af 4 sæt
 * logget → gennemført tonnage 2×20×250=10000). */
function seedHalvUgeStortTal() {
  const seed = grundSeed()
  seed.tables.weeks = [{ id: WEEK_ID, athlete_id: ATHLETE_ID, week_number: 1, block_name: 'Base' }]
  seed.tables.sessions = [{
    id: SESSION_ID, week_id: WEEK_ID, title: 'Tung dag', session_order: 1, weekday: todayWeekdayIdx(),
    athlete_rating: null, athlete_comment: null,
  }]
  seed.tables.exercises = [{
    id: EXERCISE_ID, session_id: SESSION_ID, name: 'Squat', sets: 4, reps: '20',
    intensity: 'RPE 7', note: null, exercise_order: 1, recommended_weight: 250,
  }]
  seed.tables.exercise_logs = [1, 2].map(setNumber => ({
    id: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa${setNumber}`,
    exercise_id: EXERCISE_ID, athlete_id: ATHLETE_ID, set_number: setNumber,
    weight: 250, reps_completed: 20, note: null, rpe_actual: 7, rpe_planned: 7,
    skipped: false, logged_at: isoNow(),
  }))
  return seed
}

/** Scenarie C (blok 2): to programuger — uge 1 (sidste, halvt logget) og
 * uge 2 (denne, fuldt logget), samme øvelse/vægt i begge, så "Sidste uge"
 * kan vises side om side med denne uges tal på samme ugedag. */
function seedSidsteUgeSideOmSide() {
  const seed = grundSeed()
  const WEEK_ID_1 = '44444444-4444-4444-8444-444444444401'
  const WEEK_ID_2 = '44444444-4444-4444-8444-444444444402'
  const SESSION_ID_1 = '55555555-5555-4555-8555-555555555501'
  const SESSION_ID_2 = '55555555-5555-4555-8555-555555555502'
  const EXERCISE_ID_1 = '66666666-6666-4666-8666-666666666601'
  const EXERCISE_ID_2 = '66666666-6666-4666-8666-666666666602'
  const weekday = todayWeekdayIdx()
  seed.tables.weeks = [
    { id: WEEK_ID_1, athlete_id: ATHLETE_ID, week_number: 1, block_name: 'Base' },
    { id: WEEK_ID_2, athlete_id: ATHLETE_ID, week_number: 2, block_name: 'Base' },
  ]
  seed.tables.sessions = [
    { id: SESSION_ID_1, week_id: WEEK_ID_1, title: 'Tung dag', session_order: 1, weekday, athlete_rating: null, athlete_comment: null },
    { id: SESSION_ID_2, week_id: WEEK_ID_2, title: 'Tung dag', session_order: 1, weekday, athlete_rating: null, athlete_comment: null },
  ]
  seed.tables.exercises = [
    { id: EXERCISE_ID_1, session_id: SESSION_ID_1, name: 'Squat', sets: 4, reps: '5', intensity: 'RPE 7', note: null, exercise_order: 1, recommended_weight: 100 },
    { id: EXERCISE_ID_2, session_id: SESSION_ID_2, name: 'Squat', sets: 4, reps: '5', intensity: 'RPE 7', note: null, exercise_order: 1, recommended_weight: 100 },
  ]
  // Uge 1 (sidste): kun 2 af 4 sæt logget. Uge 2 (denne): alle 4 logget.
  seed.tables.exercise_logs = [
    ...[1, 2].map(setNumber => ({
      id: `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb0${setNumber}`,
      exercise_id: EXERCISE_ID_1, athlete_id: ATHLETE_ID, set_number: setNumber,
      weight: 100, reps_completed: 5, note: null, rpe_actual: 7, rpe_planned: 7,
      skipped: false, logged_at: isoNow(),
    })),
    ...[1, 2, 3, 4].map(setNumber => ({
      id: `cccccccc-cccc-4ccc-8ccc-cccccccccc0${setNumber}`,
      exercise_id: EXERCISE_ID_2, athlete_id: ATHLETE_ID, set_number: setNumber,
      weight: 100, reps_completed: 5, note: null, rpe_actual: 7, rpe_planned: 7,
      skipped: false, logged_at: isoNow(),
    })),
  ]
  return seed
}

async function loginOgAabnUgensStatus(page, appUrl) {
  await page.goto(appUrl)
  await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
  await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  // "Ugen som planlagt" ligger bag folden "Mere" siden ORDRE 330.
  await page.getByRole('button', { name: 'Mere', exact: true }).click({ timeout: 15000 })
  await page.getByText('Ugen som planlagt', { exact: true }).waitFor({ state: 'visible', timeout: 15000 })
}

async function assertIngenVandretRulning(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  if (overflow > 1) throw new Error(`${label}: vandret rulning opdaget (scrollWidth - clientWidth = ${overflow}px)`)
}

async function koerScenarier() {
  const { createMockSupabase } = await import('../e2e/mock-supabase.mjs')
  const { startVite, launchBrowser, APP_URL, MOCK_PORT, OUT_DIR } = await import('../e2e/harness.mjs')

  // ---- Scenarie A: tom uge ----
  {
    const mock = createMockSupabase(seedTomUge())
    await mock.listen(MOCK_PORT)
    const vite = await startVite()
    const browser = await launchBrowser()
    try {
      const page = await browser.newPage({ viewport: { width: 360, height: 780 } })
      page.on('pageerror', err => console.error('[browser pageerror, tom uge]', err))
      await loginOgAabnUgensStatus(page, APP_URL)
      await page.getByText('Ingen træning planlagt denne uge endnu.', { exact: true }).waitFor({ state: 'visible', timeout: 10000 })
      await assertIngenVandretRulning(page, 'Tom uge (360px)')
      await page.screenshot({ path: join(OUT_DIR, 'atletens-uge-holder-01-tom-uge-360px.png'), fullPage: true })
      console.log('GRØN (A): tom uge ved 360px siger "Ingen træning planlagt denne uge endnu." — ingen vandret rulning.')
    } finally {
      await browser.close()
      await vite.stop()
      await mock.close()
    }
  }

  // ---- Scenarie B: halv uge, femcifret tonnage-tal ----
  {
    const mock = createMockSupabase(seedHalvUgeStortTal())
    await mock.listen(MOCK_PORT)
    const vite = await startVite()
    const browser = await launchBrowser()
    try {
      const page = await browser.newPage({ viewport: { width: 360, height: 780 } })
      page.on('pageerror', err => console.error('[browser pageerror, halv uge]', err))
      await loginOgAabnUgensStatus(page, APP_URL)
      await page.getByText('2/4 sæt · 10000kg / 20000kg', { exact: true }).waitFor({ state: 'visible', timeout: 10000 })
      await assertIngenVandretRulning(page, 'Halv uge, femcifret tal (360px)')
      await page.screenshot({ path: join(OUT_DIR, 'atletens-uge-holder-02-halv-uge-360px.png'), fullPage: true })
      console.log('GRØN (B): halv uge med femcifret tonnage (2/4 sæt, 10000kg/20000kg) vises fuldt ud ved 360px — ingen vandret rulning.')
    } finally {
      await browser.close()
      await vite.stop()
      await mock.close()
    }
  }

  // ---- Scenarie C (blok 2): "Sidste uge" side om side med denne ----
  {
    const mock = createMockSupabase(seedSidsteUgeSideOmSide())
    await mock.listen(MOCK_PORT)
    const vite = await startVite()
    const browser = await launchBrowser()
    try {
      const page = await browser.newPage({ viewport: { width: 360, height: 780 } })
      page.on('pageerror', err => console.error('[browser pageerror, sidste uge]', err))
      await loginOgAabnUgensStatus(page, APP_URL)
      // Denne uge (uge 2) er fuldt logget uden at åbne "Sidste uge" endnu.
      await page.getByText('4/4 sæt · 2000kg / 2000kg', { exact: true }).waitFor({ state: 'visible', timeout: 10000 })
      await page.getByRole('button', { name: 'Sidste uge', exact: true }).click()
      // Samme dags to linjer: denne uges tal øverst, sidste uges dæmpet nedenunder.
      await page.getByText('4/4 sæt · 2000kg / 2000kg', { exact: true }).waitFor({ state: 'visible', timeout: 10000 })
      await page.getByText('Sidste uge: 2/4 sæt · 1000kg / 2000kg', { exact: true }).waitFor({ state: 'visible', timeout: 10000 })
      await assertIngenVandretRulning(page, 'Sidste uge side om side (360px)')
      await page.screenshot({ path: join(OUT_DIR, 'atletens-uge-holder-03-sidste-uge-360px.png'), fullPage: true })
      console.log('GRØN (C): "Sidste uge" viser denne uges 4/4 sæt (2000kg/2000kg) og sidste uges 2/4 sæt (1000kg/2000kg) på samme dag, side om side, ved 360px — ingen vandret rulning.')
    } finally {
      await browser.close()
      await vite.stop()
      await mock.close()
    }
  }
}

async function main() {
  try {
    await koerScenarier()
    process.exitCode = 0
  } catch (err) {
    console.error('\nFEJL:', err.message)
    process.exitCode = 1
  }
}

if (process.argv[1] && process.argv[1].endsWith('verify-atletens-uge-holder.mjs')) main()
