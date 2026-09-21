// ORDRE 285 · commit 3 — "mandagsrunden som én prøve": bevist, ikke antaget.
// Coachen sorterer en LANG atletliste (20 atleter, kræver reel rulning ved
// 390×844) efter "Afvigelse denne uge", går ind på de tre øverste én ad
// gangen og tilbage — og PRØVEN venter på det faktiske DOM-udfald for både
// sorteringen (uændret rækkefølge, samme princip som e2e/coach-afvigelse.
// spec.mjs) OG rullepositionen (samme scrollY før klik-ind som efter
// tilbage-klik, målt i pixels, ikke antaget).
//
// Kørsel: node e2e/coach-mandagsrunden.spec.mjs (npm run e2e:mandagsrunden)

import assert from 'node:assert/strict'
import { join } from 'node:path'
import { createMockSupabase } from './mock-supabase.mjs'
import { buildSeed, COACH_USER } from './fixtures.mjs'
import { startVite, launchBrowser, APP_URL, MOCK_PORT, OUT_DIR } from './harness.mjs'

function isoNow() { return new Date().toISOString() }
function todayWeekdayIdx() {
  const jsDay = new Date().getDay()
  return jsDay === 0 ? 6 : jsDay - 1
}

// Tre øverste med STRENGT faldende afvigelse-score (se
// src/dashboard/afvigelse.js), resten (mix af skredet/på sporet/ingen plan)
// holdt under top-3's laveste score — listen skal være lang nok (20
// atleter) til at kræve reel rulning ved 390×844.
const TOP_TRE = [
  { navn: 'Ø Topafvigelse Ét', planlagt: 20, gennemfoert: 0 },
  { navn: 'Ø Topafvigelse To', planlagt: 20, gennemfoert: 2 },
  { navn: 'Ø Topafvigelse Tre', planlagt: 20, gennemfoert: 5 },
]
const ATHLETE_COUNT = 20

function buildLangListe() {
  const seed = buildSeed()
  const { tables } = seed
  tables.athletes = [] // ingen af fixtures' egen "Testatlet" i denne prøve
  tables.weeks = []; tables.sessions = []; tables.exercises = []; tables.exercise_logs = []

  function tilfoej(i, navn, group) {
    const userId = `12300000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`
    const athleteId = `12311111-1111-4111-8111-${String(i + 1).padStart(12, '0')}`
    tables.profiles.push({ id: userId, role: 'athlete', email: `mandag${i + 1}@e2e.test`, last_seen: null })
    tables.athletes.push({
      id: athleteId, user_id: userId, name: navn, email: `mandag${i + 1}@e2e.test`,
      status: 'active', hidden: false, snooze_until: null, competition_date: null, onboarding_completed_at: isoNow(),
    })
    if (group === 'ingen plan') return athleteId
    const weekId = `12322222-2222-4222-8222-${String(i + 1).padStart(12, '0')}`
    const sessionId = `12333333-3333-4333-8333-${String(i + 1).padStart(12, '0')}`
    const exerciseId = `12344444-4444-4444-8444-${String(i + 1).padStart(12, '0')}`
    const planlagt = group === 'top' ? TOP_TRE[i].planlagt : 20
    const gennemfoert = group === 'top' ? TOP_TRE[i].gennemfoert : 10 // score 1.0, altid under top-3's laveste (1.5)
    tables.weeks.push({ id: weekId, athlete_id: athleteId, week_number: 1, block_name: 'Base', start_date: new Date().toISOString().slice(0, 10) })
    tables.sessions.push({ id: sessionId, week_id: weekId, title: 'Dag 1 — Squat', session_order: 1, weekday: todayWeekdayIdx(), athlete_rating: null, athlete_comment: null })
    tables.exercises.push({ id: exerciseId, session_id: sessionId, name: 'Squat', sets: planlagt, reps: '5', intensity: 'RPE 8', note: null, exercise_order: 1, recommended_weight: 100 })
    for (let s = 1; s <= gennemfoert; s++) {
      tables.exercise_logs.push({
        id: `12355555-${String(i + 1).padStart(4, '0')}-4555-8555-${String(s).padStart(12, '0')}`,
        exercise_id: exerciseId, athlete_id: athleteId, set_number: s, weight: 100,
        reps_completed: 1, note: null, rpe_actual: 8, rpe_planned: 8, skipped: false, logged_at: isoNow(),
      })
    }
    return athleteId
  }

  for (let i = 0; i < TOP_TRE.length; i++) tilfoej(i, TOP_TRE[i].navn, 'top')
  for (let i = TOP_TRE.length; i < ATHLETE_COUNT; i++) {
    const group = (i - TOP_TRE.length) % 2 === 0 ? 'paa sporet' : 'ingen plan'
    tilfoej(i, `Ø Fylder ${String(i + 1).padStart(2, '0')}`, group)
  }
  return seed
}

export async function runCoachMandagsrunden(page, { appUrl, outDir }) {
  const shot = (name) => page.screenshot({ path: join(outDir, `coach-mandagsrunden-${name}.png`), fullPage: false })

  await page.goto(appUrl)
  await page.locator('#athlete-auth-email').fill(COACH_USER.email)
  await page.locator('#athlete-auth-password').fill(COACH_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  await page.getByRole('button', { name: /Ø Topafvigelse Ét/ }).waitFor({ state: 'visible', timeout: 15000 })

  await page.getByRole('button', { name: 'Afvigelse denne uge', exact: true }).click()

  const rowNames = async () => {
    const rows = [...(await page.locator('div[role="button"]').allTextContents())]
    return TOP_TRE.map(t => rows.findIndex(text => text.includes(t.navn)))
  }
  await page.waitForFunction((navne) => {
    const rows = [...document.querySelectorAll('div[role="button"]')].map(el => el.textContent || '')
    const idx = navne.map(n => rows.findIndex(t => t.includes(n)))
    return idx.every(i => i >= 0) && idx[0] < idx[1] && idx[1] < idx[2]
  }, TOP_TRE.map(t => t.navn), { timeout: 10000 })
  const [i1, i2, i3] = await rowNames()
  assert.ok(i1 < i2 && i2 < i3, `forventede rækkefølge Ét → To → Tre, fik indekser ${i1}/${i2}/${i3}`)
  await shot('01-sorteret')

  // Listen skal reelt kunne rulles ved 20 atleter/390×844 — ellers beviser
  // rullepositions-tjekket nedenfor ingenting.
  const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)
  assert.ok(scrollHeight > 50, `listen skulle kunne rulles reelt (>50px), fandt kun ${scrollHeight}px — prøven beviser intet uden det`)

  // ---- Gå ind på de tre øverste, én ad gangen, fra HVER SIN rulleposition ----
  const rulleOffsets = [40, 160, 90]
  for (let n = 0; n < TOP_TRE.length; n++) {
    const navn = TOP_TRE[n].navn
    await page.evaluate((y) => window.scrollTo(0, y), rulleOffsets[n])
    await page.waitForTimeout(50) // lad scroll-eventet slå igennem før vi måler
    const scrollFoer = await page.evaluate(() => window.scrollY)

    await page.getByText(navn, { exact: true }).first().click()
    await page.getByText(navn, { exact: true }).first().waitFor({ state: 'visible', timeout: 10000 })
    await page.getByText('← Tilbage til atleter', { exact: false }).waitFor({ state: 'visible', timeout: 10000 })
    await shot(`0${n + 2}-atlet-${n + 1}-aabnet`)

    await page.getByText('← Tilbage til atleter', { exact: false }).click()
    await page.getByRole('button', { name: new RegExp(navn) }).waitFor({ state: 'visible', timeout: 10000 })
    await page.waitForTimeout(50)
    const scrollEfter = await page.evaluate(() => window.scrollY)

    // Sorteringen (aria-pressed + DOM-rækkefølge) skal stadig stå ved "Afvigelse denne uge".
    const stadigAfvigelse = await page.getByRole('button', { name: 'Afvigelse denne uge', exact: true }).getAttribute('aria-pressed')
    assert.equal(stadigAfvigelse, 'true', `sorteringen skal stadig være "Afvigelse denne uge" efter tilbage fra ${navn}`)
    const [j1, j2, j3] = await rowNames()
    assert.ok(j1 < j2 && j2 < j3, `rækkefølgen skal være uændret efter tilbage fra ${navn}, fik ${j1}/${j2}/${j3}`)

    // Rullepositionen: samme scrollY før klik-ind som efter tilbage-klik.
    assert.equal(scrollEfter, scrollFoer, `rullepositionen skal holde efter tilbage fra ${navn}: var ${scrollFoer}px før, ${scrollEfter}px efter`)
  }
  await shot('05-alle-tre-besoegt')

  console.log('\nGRØN: mandagsrunden — sorterer 20 atleter efter afvigelse, går ind på de tre øverste én ad gangen og tilbage, sorteringen og rullepositionen holder hele vejen.')
}

async function main() {
  const mock = createMockSupabase(buildLangListe())
  await mock.listen(MOCK_PORT)
  const vite = await startVite()
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    const consoleErrors = []
    page.on('pageerror', err => consoleErrors.push(`pageerror: ${err.message}`))
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(`console.error: ${msg.text()}`) })
    await runCoachMandagsrunden(page, { appUrl: APP_URL, outDir: OUT_DIR })
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

if (process.argv[1] && process.argv[1].endsWith('coach-mandagsrunden.spec.mjs')) main()
