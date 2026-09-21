// ORDRE 277 · commit 3 — "coachen ser på et blik hvem han skal skrive til":
// bevist, ikke antaget. Tre atleter i hver sin tilstand (skredet, på
// sporet, ingen plan), i den ÆGTE, ubuildede app (npm run dev) mod den
// lokale mock — coachen logger ind, sorterer atletlisten efter "Afvigelse
// denne uge", ser den skredne atlet øverst og "ingen plan" nederst (blok 1),
// klikker ind på den skredne atlet (blok 2's "et klik derhen"), og kommer
// tilbage til oversigten med sorteringen intakt (blok 2's "og tilbage").
// Hvert skridt venter på det faktiske udfald (DOM-tekst/rækkefølge), ikke
// et banner.
//
// Kørsel: node e2e/coach-afvigelse.spec.mjs (npm run e2e:coach-afvigelse)

import assert from 'node:assert/strict'
import { join } from 'node:path'
import { createMockSupabase } from './mock-supabase.mjs'
import { buildSeed, COACH_USER, ATHLETE_ID } from './fixtures.mjs'
import { startVite, launchBrowser, APP_URL, MOCK_PORT, OUT_DIR } from './harness.mjs'

const SKREDET_USER_ID = 'cccccccc-1111-4111-8111-cccccccccccc'
const SKREDET_ATHLETE_ID = 'cccccccc-2222-4222-8222-cccccccccccc'
const SKREDET_WEEK_ID = 'cccccccc-3333-4333-8333-cccccccccccc'
const SKREDET_SESSION_ID = 'cccccccc-4444-4444-8444-cccccccccccc'
const SKREDET_EXERCISE_ID = 'cccccccc-5555-4555-8555-cccccccccccc'

const INGEN_PLAN_USER_ID = 'dddddddd-1111-4111-8111-dddddddddddd'
const INGEN_PLAN_ATHLETE_ID = 'dddddddd-2222-4222-8222-dddddddddddd'

const PAA_SPORET_WEEK_ID = 'eeeeeeee-3333-4333-8333-eeeeeeeeeeee'
const PAA_SPORET_SESSION_ID = 'eeeeeeee-4444-4444-8444-eeeeeeeeeeee'
const PAA_SPORET_EXERCISE_ID = 'eeeeeeee-5555-4555-8555-eeeeeeeeeeee'

function todayStr() { return new Date().toISOString().slice(0, 10) }
function isoNow() { return new Date().toISOString() }

// Egen uge, EGET week_number (2, forskelligt fra fixtures' egen uge 1 på
// samme ATHLETE_ID) med start_date = i dag — currentWeekNo (dashboardShared.js)
// bruger den som anker og lander uundgåeligt på netop denne uge som "nu",
// uanset fixtures' egen udaterede uge 1 (se dens egen extrapolations-logik).
function ekstraUge({ weekId, athleteId, sessionId, exerciseId, weekNumber, sets, recommendedWeight }) {
  return {
    weeks: [{ id: weekId, athlete_id: athleteId, week_number: weekNumber, block_name: 'Base', start_date: todayStr() }],
    sessions: [{ id: sessionId, week_id: weekId, title: 'Dag 1 — Bænk', session_order: 1, weekday: 0, athlete_rating: null, athlete_comment: null }],
    exercises: [{ id: exerciseId, session_id: sessionId, name: 'Bænkpres', sets, reps: '5', intensity: 'RPE 8', note: null, exercise_order: 1, recommended_weight: recommendedWeight }],
  }
}

function logRaekke(id, athleteId, exerciseId, setNumber, weight, repsCompleted) {
  return {
    id, exercise_id: exerciseId, athlete_id: athleteId, set_number: setNumber,
    weight, reps_completed: repsCompleted, note: null, rpe_actual: 8, rpe_planned: 8,
    skipped: false, logged_at: isoNow(),
  }
}

function seedTreAtleterForskelligtStillet() {
  const seed = buildSeed()
  const { tables } = seed

  // ---- Athlete 1 (fixtures' egen "Testatlet", ATHLETE_ID) — PÅ SPORET:
  // planlagt 6 sæt × 100kg = 600kg, gennemført 6 sæt × 100kg = 600kg. ----
  const paaSporetUge = ekstraUge({
    weekId: PAA_SPORET_WEEK_ID, athleteId: ATHLETE_ID, sessionId: PAA_SPORET_SESSION_ID,
    exerciseId: PAA_SPORET_EXERCISE_ID, weekNumber: 2, sets: 6, recommendedWeight: 100,
  })
  tables.weeks.push(...paaSporetUge.weeks)
  tables.sessions.push(...paaSporetUge.sessions)
  tables.exercises.push(...paaSporetUge.exercises)
  for (let i = 1; i <= 6; i++) {
    tables.exercise_logs.push(logRaekke(`eeeeeeee-6666-4666-8666-eeeeeeee000${i}`, ATHLETE_ID, PAA_SPORET_EXERCISE_ID, i, 100, 1))
  }

  // ---- Athlete 2 (ny, "Skredet") — planlagt 10 sæt × 80kg = 800kg,
  // gennemført kun 2 sæt × 80kg = 160kg. ----
  tables.profiles.push({ id: SKREDET_USER_ID, role: 'athlete', email: 'skredet@e2e.test', last_seen: null })
  tables.athletes.push({
    id: SKREDET_ATHLETE_ID, user_id: SKREDET_USER_ID, name: 'Ø Skredet', email: 'skredet@e2e.test',
    status: 'active', hidden: false, snooze_until: null, competition_date: null, onboarding_completed_at: isoNow(),
  })
  const skredetUge = ekstraUge({
    weekId: SKREDET_WEEK_ID, athleteId: SKREDET_ATHLETE_ID, sessionId: SKREDET_SESSION_ID,
    exerciseId: SKREDET_EXERCISE_ID, weekNumber: 1, sets: 10, recommendedWeight: 80,
  })
  tables.weeks.push(...skredetUge.weeks)
  tables.sessions.push(...skredetUge.sessions)
  tables.exercises.push(...skredetUge.exercises)
  tables.exercise_logs.push(logRaekke('cccccccc-6666-4666-8666-cccccccccc01', SKREDET_ATHLETE_ID, SKREDET_EXERCISE_ID, 1, 80, 1))
  tables.exercise_logs.push(logRaekke('cccccccc-6666-4666-8666-cccccccccc02', SKREDET_ATHLETE_ID, SKREDET_EXERCISE_ID, 2, 80, 1))

  // ---- Athlete 3 (ny, "Ingen plan") — ingen uger, ingen sessioner. ----
  tables.profiles.push({ id: INGEN_PLAN_USER_ID, role: 'athlete', email: 'ingenplan@e2e.test', last_seen: null })
  tables.athletes.push({
    id: INGEN_PLAN_ATHLETE_ID, user_id: INGEN_PLAN_USER_ID, name: 'Ø Ingen Plan', email: 'ingenplan@e2e.test',
    status: 'active', hidden: false, snooze_until: null, competition_date: null, onboarding_completed_at: isoNow(),
  })

  return seed
}

export async function runCoachAfvigelse(page, { appUrl, outDir }) {
  const shot = (name) => page.screenshot({ path: join(outDir, `coach-afvigelse-${name}.png`), fullPage: true })

  await page.goto(appUrl)
  await page.locator('#athlete-auth-email').fill(COACH_USER.email)
  await page.locator('#athlete-auth-password').fill(COACH_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()

  // ---- Blok 1: sortér efter "Afvigelse denne uge" ----
  await page.getByRole('button', { name: /Testatlet.*Uge/ }).waitFor({ state: 'visible', timeout: 15000 })
  await page.getByRole('button', { name: /Ø Skredet/ }).waitFor({ state: 'visible' })
  await page.getByRole('button', { name: /Ø Ingen Plan/ }).waitFor({ state: 'visible' })
  await shot('01-listen-usorteret')

  await page.getByRole('button', { name: 'Afvigelse denne uge', exact: true }).click()

  // Størst afvigelse øverst: "Ø Skredet" skal stå FØR "Testatlet", som skal
  // stå FØR "Ø Ingen Plan" — læst som DOM-rækkefølge, ikke kun synlighed.
  const navneIRaekkefoelge = async () => {
    const rows = page.locator('div[role="button"]')
    const names = await rows.allTextContents()
    return ['Ø Skredet', 'Testatlet', 'Ø Ingen Plan'].map(navn => names.findIndex(t => t.includes(navn)))
  }
  await page.waitForFunction(async () => {
    const rows = [...document.querySelectorAll('div[role="button"]')].map(el => el.textContent || '')
    const iSkredet = rows.findIndex(t => t.includes('Ø Skredet'))
    const iPaaSporet = rows.findIndex(t => t.includes('Testatlet'))
    const iIngenPlan = rows.findIndex(t => t.includes('Ø Ingen Plan'))
    return iSkredet >= 0 && iPaaSporet >= 0 && iIngenPlan >= 0 && iSkredet < iPaaSporet && iPaaSporet < iIngenPlan
  }, { timeout: 10000 })
  const [iSkredet, iPaaSporet, iIngenPlan] = await navneIRaekkefoelge()
  assert.ok(iSkredet < iPaaSporet && iPaaSporet < iIngenPlan,
    `forventede rækkefølge Skredet → Testatlet (på sporet) → Ingen Plan, fik indekser ${iSkredet}/${iPaaSporet}/${iIngenPlan}`)

  // Tallene er der, ingen rød tekst, ingen procent-lignende karakter.
  await page.getByText('Planlagt 10 sæt · 800 kg', { exact: false }).waitFor({ state: 'visible' })
  await page.getByText('gennemført 2 sæt · 160 kg', { exact: false }).waitFor({ state: 'visible' })
  await page.getByText('Ingen plan', { exact: true }).waitFor({ state: 'visible' })
  const bodyText = await page.locator('body').innerText()
  assert.ok(!/%/.test(bodyText.split('Afleveret')[0] || bodyText), 'ingen procent-tal må vises i afvigelseslinjen')
  await shot('02-sorteret-efter-afvigelse')

  // ---- Blok 2: ét klik derhen og tilbage, sorteringen intakt ----
  await page.getByText('Ø Skredet', { exact: true }).first().click()
  await page.getByText('Ø Skredet', { exact: true }).first().waitFor({ state: 'visible', timeout: 10000 })
  // Atletens uge (Program-fanen, den coachvisning der findes uden 268) —
  // ugen med sessionen der gav "Planlagt 10 sæt" i listen er der.
  await page.getByText('UGE 1', { exact: false }).first().waitFor({ state: 'visible', timeout: 10000 })
  await page.getByText('1 træninger', { exact: false }).first().waitFor({ state: 'visible', timeout: 10000 })
  await shot('03-atletens-uge-aabnet')

  await page.getByText('← Tilbage til atleter', { exact: false }).click()
  await page.getByText('Ø Skredet', { exact: true }).first().waitFor({ state: 'visible', timeout: 10000 })
  // Sorteringen er STADIG "Afvigelse denne uge" (knappen viser fortsat
  // aktiv) — ingen ny visning, ingen nulstillet sortering.
  const stadigAfvigelse = await page.getByRole('button', { name: 'Afvigelse denne uge', exact: true }).getAttribute('aria-pressed')
  assert.equal(stadigAfvigelse, 'true', 'sorteringen skal stadig være "Afvigelse denne uge" efter tilbage-knappen')
  const [iSkredet2, iPaaSporet2, iIngenPlan2] = await navneIRaekkefoelge()
  assert.ok(iSkredet2 < iPaaSporet2 && iPaaSporet2 < iIngenPlan2,
    'rækkefølgen skal være uændret efter et klik derhen og tilbage')
  await shot('04-tilbage-sortering-intakt')

  console.log('\nGRØN: atletlisten sorteres efter afvigelse denne uge (skredet → på sporet → ingen plan), og et klik ind på en atlet og tilbage bevarer sorteringen.')
}

async function main() {
  const mock = createMockSupabase(seedTreAtleterForskelligtStillet())
  await mock.listen(MOCK_PORT)
  const vite = await startVite()
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    const consoleErrors = []
    page.on('pageerror', err => consoleErrors.push(`pageerror: ${err.message}`))
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(`console.error: ${msg.text()}`) })
    await runCoachAfvigelse(page, { appUrl: APP_URL, outDir: OUT_DIR })
    assert.deepEqual(consoleErrors, [], `Ingen browser-fejl forventet, fandt: ${JSON.stringify(consoleErrors)}`)
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

if (process.argv[1] && process.argv[1].endsWith('coach-afvigelse.spec.mjs')) main()
