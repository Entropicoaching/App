// ORDRE 285 · commit 2 — "de tilstande der ikke er den pæne" for
// afvigelseslisten (ordre 281): ingen atleter, én atlet, atleter uden plan,
// en atlet der ikke har logget i tre uger, meget lange navne, og en uge hvor
// intet er logget af nogen. I den ÆGTE, ubuildede app mod den lokale mock —
// samme mønster som scripts/verify-atletens-uge-holder.mjs (ordre 276).
// Hver tilstand skal sige noget brugbart, ingen af dem må ligne en fejl
// (blank liste uden tekst, "undefined"/"NaN" i teksten, eller vandret
// rulning på telefon-bredde).
//
// Egen, minimal seed pr. scenarie (ikke e2e/fixtures.mjs's buildSeed), samme
// id-mønster (faste, opdigtede UUID'er) som fixtures.mjs/276's script.

import { join } from 'node:path'

const COACH_USER = { id: '11111111-1111-4111-8111-111111111285', email: 'coach-285@e2e.test', password: 'e2e-pass-coach', role: 'coach' }

function isoNow() { return new Date().toISOString() }
function daysAgoIso(n) { return new Date(Date.now() - n * 86400000).toISOString() }
function todayWeekdayIdx() {
  const jsDay = new Date().getDay()
  return jsDay === 0 ? 6 : jsDay - 1
}

function grundSeed() {
  return {
    users: [COACH_USER],
    tables: {
      profiles: [{ id: COACH_USER.id, role: 'coach', email: COACH_USER.email, last_seen: null }],
      athletes: [], weeks: [], sessions: [], exercises: [], exercise_logs: [],
      readiness_logs: [], personal_records: [], messages: [], video_analyses: [],
    },
  }
}

function athlete(id, name) {
  return {
    id, user_id: null, name, email: null, status: 'active', hidden: false,
    snooze_until: null, competition_date: null, onboarding_completed_at: isoNow(),
  }
}

function planUge({ weekId, athleteId, sessionId, exerciseId, weekNumber, startDate, sets, recommendedWeight }) {
  return {
    weeks: [{ id: weekId, athlete_id: athleteId, week_number: weekNumber, block_name: 'Base', start_date: startDate }],
    sessions: [{ id: sessionId, week_id: weekId, title: 'Dag 1 — Squat', session_order: 1, weekday: todayWeekdayIdx(), athlete_rating: null, athlete_comment: null }],
    exercises: [{ id: exerciseId, session_id: sessionId, name: 'Squat', sets, reps: '5', intensity: 'RPE 8', note: null, exercise_order: 1, recommended_weight: recommendedWeight }],
  }
}

function logRaekke(id, athleteId, exerciseId, setNumber, weight, loggedAtIso) {
  return { id, exercise_id: exerciseId, athlete_id: athleteId, set_number: setNumber, weight, reps_completed: 1, note: null, rpe_actual: 8, rpe_planned: 8, skipped: false, logged_at: loggedAtIso }
}

// ---- Scenarie A: ingen atleter overhovedet ----
function seedIngenAtleter() { return grundSeed() }

// ---- Scenarie B: én atlet, med plan, på sporet ----
function seedEnAtlet() {
  const seed = grundSeed()
  const id = 'a0000000-0000-4000-8000-000000000001'
  seed.tables.athletes = [athlete(id, 'Ø Ene Atlet')]
  const uge = planUge({ weekId: 'a0000001', athleteId: id, sessionId: 'a0000002', exerciseId: 'a0000003', weekNumber: 1, startDate: new Date().toISOString().slice(0, 10), sets: 4, recommendedWeight: 80 })
  seed.tables.weeks.push(...uge.weeks); seed.tables.sessions.push(...uge.sessions); seed.tables.exercises.push(...uge.exercises)
  for (let i = 1; i <= 4; i++) seed.tables.exercise_logs.push(logRaekke(`a000000${i}-log`, id, 'a0000003', i, 80, isoNow()))
  return { seed, athleteId: id }
}

// ---- Scenarie C: to atleter, ingen af dem har en plan ----
function seedUdenPlan() {
  const seed = grundSeed()
  const id1 = 'b0000000-0000-4000-8000-000000000001'
  const id2 = 'b0000000-0000-4000-8000-000000000002'
  seed.tables.athletes = [athlete(id1, 'Ø Uden Plan Én'), athlete(id2, 'Ø Uden Plan To')]
  return { seed, id1, id2 }
}

// ---- Scenarie D: én atlet med plan denne uge (0 gennemført), men som
// SENEST loggede for tre uger siden (en tidligere, afsluttet uge). ----
function seedIkkeLoggetTreUger() {
  const seed = grundSeed()
  const id = 'c0000000-0000-4000-8000-000000000001'
  seed.tables.athletes = [athlete(id, 'Ø Stille Atlet')]
  // Uge 1 (afsluttet, for tre uger siden): fuldt logget dengang. INGEN
  // start_date her — currentWeekNo (dashboardShared.js) bruger kun den
  // FØRSTE uge (i week_number-orden) med en start_date som anker og
  // ekstrapolerer alle andre ugers datoer derfra; sætter vi en start_date
  // på BÅDE uge 1 og uge 3, "vinder" uge 1 som anker og uge 3's egen dato
  // ignoreres. Kun uge 3 (denne uge) skal ankre "nu".
  const gammelUge = planUge({ weekId: 'c0000001', athleteId: id, sessionId: 'c0000002', exerciseId: 'c0000003', weekNumber: 1, startDate: null, sets: 3, recommendedWeight: 60 })
  seed.tables.weeks.push(...gammelUge.weeks); seed.tables.sessions.push(...gammelUge.sessions); seed.tables.exercises.push(...gammelUge.exercises)
  for (let i = 1; i <= 3; i++) seed.tables.exercise_logs.push(logRaekke(`c000000${i}-old`, id, 'c0000003', i, 60, daysAgoIso(21)))
  // Uge 3 (denne uge, ulogget): planlagt, intet gennemført.
  const nyUge = planUge({ weekId: 'c0000004', athleteId: id, sessionId: 'c0000005', exerciseId: 'c0000006', weekNumber: 3, startDate: new Date().toISOString().slice(0, 10), sets: 5, recommendedWeight: 90 })
  seed.tables.weeks.push(...nyUge.weeks); seed.tables.sessions.push(...nyUge.sessions); seed.tables.exercises.push(...nyUge.exercises)
  return { seed, athleteId: id }
}

// ---- Scenarie E: meget lang navn ----
function seedLangtNavn() {
  const seed = grundSeed()
  const id = 'd0000000-0000-4000-8000-000000000001'
  const langtNavn = 'Ø Kristoffer-Alexander Skovgaard-Rasmussen-Andersen-Bertelsen-Nedergaard'
  seed.tables.athletes = [athlete(id, langtNavn)]
  const uge = planUge({ weekId: 'd0000001', athleteId: id, sessionId: 'd0000002', exerciseId: 'd0000003', weekNumber: 1, startDate: new Date().toISOString().slice(0, 10), sets: 4, recommendedWeight: 80 })
  seed.tables.weeks.push(...uge.weeks); seed.tables.sessions.push(...uge.sessions); seed.tables.exercises.push(...uge.exercises)
  return { seed, langtNavn }
}

// ---- Scenarie F: tre atleter med plan, INGEN har logget noget denne uge ----
function seedIntetLoggetAfNogen() {
  const seed = grundSeed()
  const ids = ['e0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000003']
  const navne = ['Ø Ingen Log Én', 'Ø Ingen Log To', 'Ø Ingen Log Tre']
  ids.forEach((id, i) => {
    seed.tables.athletes.push(athlete(id, navne[i]))
    const uge = planUge({ weekId: `e000000${i}1`, athleteId: id, sessionId: `e000000${i}2`, exerciseId: `e000000${i}3`, weekNumber: 1, startDate: new Date().toISOString().slice(0, 10), sets: 4 + i, recommendedWeight: 80 })
    seed.tables.weeks.push(...uge.weeks); seed.tables.sessions.push(...uge.sessions); seed.tables.exercises.push(...uge.exercises)
  })
  return { seed, navne }
}

async function loginSomCoach(page, appUrl) {
  await page.goto(appUrl)
  await page.locator('#athlete-auth-email').fill(COACH_USER.email)
  await page.locator('#athlete-auth-password').fill(COACH_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
}

async function assertIngenVandretRulning(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  if (overflow > 1) throw new Error(`${label}: vandret rulning opdaget (scrollWidth - clientWidth = ${overflow}px)`)
}

async function assertIngenRaaVaerdier(page, label) {
  const bodyText = await page.locator('body').innerText()
  if (/undefined|NaN/.test(bodyText)) throw new Error(`${label}: "undefined"/"NaN" fundet i sideteksten — ligner en fejl`)
}

async function koerScenarier() {
  const { createMockSupabase } = await import('../e2e/mock-supabase.mjs')
  const { startVite, launchBrowser, APP_URL, MOCK_PORT, OUT_DIR } = await import('../e2e/harness.mjs')

  async function medOpsaetning(seed, fn) {
    const mock = createMockSupabase(seed)
    await mock.listen(MOCK_PORT)
    const vite = await startVite()
    const browser = await launchBrowser()
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
      page.on('pageerror', err => console.error('[browser pageerror]', err))
      await fn(page)
    } finally {
      await browser.close()
      await vite.stop()
      await mock.close()
    }
  }

  // ---- A: ingen atleter ----
  await medOpsaetning(seedIngenAtleter(), async page => {
    await loginSomCoach(page, APP_URL)
    await page.getByText('Ingen aktive atleter', { exact: true }).waitFor({ state: 'visible', timeout: 15000 })
    await assertIngenVandretRulning(page, 'Ingen atleter')
    await page.screenshot({ path: join(OUT_DIR, 'mandagsrunden-tilstande-01-ingen-atleter.png'), fullPage: true })
    console.log('GRØN (A): ingen atleter siger "Ingen aktive atleter" — ikke en blank eller fejlende side.')
  })

  // ---- B: én atlet ----
  {
    const { seed } = seedEnAtlet()
    await medOpsaetning(seed, async page => {
      await loginSomCoach(page, APP_URL)
      await page.getByText('Ø Ene Atlet', { exact: true }).waitFor({ state: 'visible', timeout: 15000 })
      await page.getByRole('button', { name: 'Afvigelse denne uge', exact: true }).click()
      await page.getByText('Planlagt 4 sæt', { exact: false }).waitFor({ state: 'visible', timeout: 10000 })
      await assertIngenVandretRulning(page, 'Én atlet')
      await assertIngenRaaVaerdier(page, 'Én atlet')
      await page.screenshot({ path: join(OUT_DIR, 'mandagsrunden-tilstande-02-en-atlet.png'), fullPage: true })
      console.log('GRØN (B): én atlet sorteres og vises uden at listen (eller sorteringen) forudsætter flere end én række.')
    })
  }

  // ---- C: atleter uden plan ----
  {
    const { seed } = seedUdenPlan()
    await medOpsaetning(seed, async page => {
      await loginSomCoach(page, APP_URL)
      await page.getByText('Ø Uden Plan Én', { exact: true }).waitFor({ state: 'visible', timeout: 15000 })
      // 'navn'-sort (standard): "Intet aktivt program", ikke en fejltekst.
      await page.getByText('Intet aktivt program', { exact: true }).first().waitFor({ state: 'visible', timeout: 10000 })
      await page.getByRole('button', { name: 'Afvigelse denne uge', exact: true }).click()
      // 'afvigelse'-sort: begge "Ingen plan", ikke talt som en afvigelse.
      const antalIngenPlan = await page.getByText('Ingen plan', { exact: true }).count()
      if (antalIngenPlan !== 2) throw new Error(`Uden plan: forventede 2× "Ingen plan", fandt ${antalIngenPlan}`)
      await assertIngenVandretRulning(page, 'Uden plan')
      await assertIngenRaaVaerdier(page, 'Uden plan')
      await page.screenshot({ path: join(OUT_DIR, 'mandagsrunden-tilstande-03-uden-plan.png'), fullPage: true })
      console.log('GRØN (C): atleter uden plan viser "Intet aktivt program" (navn-sort) og "Ingen plan" × 2 (afvigelse-sort) — ingen af dem talt som en afvigelse.')
    })
  }

  // ---- D: ikke logget i tre uger ----
  {
    const { seed } = seedIkkeLoggetTreUger()
    await medOpsaetning(seed, async page => {
      await loginSomCoach(page, APP_URL)
      await page.getByText('Ø Stille Atlet', { exact: true }).waitFor({ state: 'visible', timeout: 15000 })
      await page.getByRole('button', { name: 'Afvigelse denne uge', exact: true }).click()
      // Denne uges plan (5 sæt) vist, 0 gennemført, og et reelt dagetal
      // siden sidste log (~20-21d, afhængig af klokkeslæt) — ikke "Ingen
      // logs" (de HAR jo logget, bare ikke for nylig).
      await page.getByText('Planlagt 5 sæt', { exact: false }).waitFor({ state: 'visible', timeout: 10000 })
      await page.getByText('gennemført 0 sæt', { exact: false }).waitFor({ state: 'visible', timeout: 10000 })
      const bodyText = await page.locator('body').innerText()
      if (!/\b(19|20|21|22)d siden\b/.test(bodyText)) throw new Error(`Ikke logget i tre uger: forventede "~19-22d siden" i sideteksten, fandt ikke det mønster (uddrag: ${bodyText.slice(0, 400)})`)
      if (/Ingen logs/.test(bodyText)) throw new Error('Ikke logget i tre uger: viste "Ingen logs" — atleten HAR jo logget, bare ikke for nylig')
      await assertIngenVandretRulning(page, 'Ikke logget i tre uger')
      await assertIngenRaaVaerdier(page, 'Ikke logget i tre uger')
      await page.screenshot({ path: join(OUT_DIR, 'mandagsrunden-tilstande-04-ikke-logget-tre-uger.png'), fullPage: true })
      console.log('GRØN (D): en atlet der ikke har logget i tre uger viser et reelt dagetal ("~3 uger siden", ikke "Ingen logs") ved siden af denne uges reelle afvigelse.')
    })
  }

  // ---- E: meget lang navn ----
  {
    const { seed, langtNavn } = seedLangtNavn()
    await medOpsaetning(seed, async page => {
      await loginSomCoach(page, APP_URL)
      const naevnSpan = page.getByText(langtNavn, { exact: true })
      await naevnSpan.waitFor({ state: 'visible', timeout: 15000 })
      const { scrollW, clientW } = await naevnSpan.evaluate(el => ({ scrollW: el.scrollWidth, clientW: el.clientWidth }))
      if (scrollW <= clientW) throw new Error('Langt navn: forventede at navnet reelt var bredere end sin boks (ellipse-tjekket ville ellers ikke bevise noget)')
      await assertIngenVandretRulning(page, 'Langt navn')
      await page.screenshot({ path: join(OUT_DIR, 'mandagsrunden-tilstande-05-langt-navn.png'), fullPage: true })
      console.log(`GRØN (E): "${langtNavn}" (${langtNavn.length} tegn) klippes med ellipse i sin egen boks — siden ruller ikke vandret på 390px.`)
    })
  }

  // ---- F: en uge hvor intet er logget af nogen ----
  {
    const { seed, navne } = seedIntetLoggetAfNogen()
    await medOpsaetning(seed, async page => {
      await loginSomCoach(page, APP_URL)
      await page.getByText(navne[0], { exact: true }).waitFor({ state: 'visible', timeout: 15000 })
      await page.getByRole('button', { name: 'Afvigelse denne uge', exact: true }).click()
      for (const navn of navne) {
        await page.getByText(navn, { exact: true }).waitFor({ state: 'visible', timeout: 10000 })
      }
      const antalGennemfoertNul = await page.getByText('gennemført 0 sæt', { exact: false }).count()
      if (antalGennemfoertNul !== 3) throw new Error(`Ingen logget denne uge: forventede 3× "gennemført 0 sæt", fandt ${antalGennemfoertNul}`)
      await assertIngenVandretRulning(page, 'Ingen logget denne uge')
      await assertIngenRaaVaerdier(page, 'Ingen logget denne uge')
      await page.screenshot({ path: join(OUT_DIR, 'mandagsrunden-tilstande-06-ingen-logget.png'), fullPage: true })
      console.log('GRØN (F): en uge hvor ingen af de tre atleter har logget noget viser alle tre, hver med sin egen reelle afvigelse — ingen ser ud som en fejl.')
    })
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

if (process.argv[1] && process.argv[1].endsWith('verify-mandagsrunden-tilstande.mjs')) main()
