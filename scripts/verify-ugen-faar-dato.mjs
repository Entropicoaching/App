#!/usr/bin/env node
// ORDRE 204 · commit 2 — "Sæt datoer": ét tryk udfylder manglende start_date
// på eksisterende uger, ud fra den første daterede uge i programmet (frem og
// tilbage i 7-dages-spring), viser resultatet før det gemmes, og rører aldrig
// en uge der allerede har en dato.
//
// Kører den ÆGTE, uændrede Dashboard.jsx/ProgramTab.jsx mod e2e-mocken (samme
// harness som e2e/coach.spec.mjs bruger), med to atleter der hver har ét
// program med én daterede og én udaterede uge — én til 1280px-tjekket, én til
// 390px-tjekket, så de to viewports kan køre uafhængigt af hinanden i samme
// mock uden at én kørsel forurener den anden. Assertions mod mockens
// tabeller (mock.table('weeks')), ikke kun DOM-tekst — se mock-supabase.mjs's
// egen kommentar om dette princip.
//
// Kørsel: npm run verify:ugen-faar-dato

import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createMockSupabase } from '../e2e/mock-supabase.mjs'
import { buildSeed, COACH_USER, ATHLETE_ID, WEEK_ID } from '../e2e/fixtures.mjs'
import { startVite, launchBrowser, APP_URL, MOCK_PORT } from '../e2e/harness.mjs'

const ROOT = join(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), '..')
const OUT_DIR = join(ROOT, 'outputs', 'ugen-faar-dato')
mkdirSync(OUT_DIR, { recursive: true })

const MOBILE_ATHLETE_ID = '99999999-9999-4999-8999-999999999999'
const MOBILE_WEEK1_ID = '99999999-9999-4999-8999-999999999901'
const MOBILE_WEEK2_ID = '99999999-9999-4999-8999-999999999902'
const DESKTOP_WEEK2_ID = '44444444-4444-4444-8444-444444444445'

const CASES = [
  {
    tag: '1280px', viewport: { width: 1280, height: 900 },
    athleteName: 'Testatlet', athleteId: ATHLETE_ID,
    week1Id: WEEK_ID, week2Id: DESKTOP_WEEK2_ID,
    week1Start: '2026-09-07', expectedWeek2Start: '2026-09-14', // +7 dage, samme måned
  },
  {
    tag: '390px', viewport: { width: 390, height: 844 },
    athleteName: 'Testatlet Mobil', athleteId: MOBILE_ATHLETE_ID,
    week1Id: MOBILE_WEEK1_ID, week2Id: MOBILE_WEEK2_ID,
    week1Start: '2026-09-28', expectedWeek2Start: '2026-10-05', // +7 dage, hen over månedsskift
  },
]

function buildFillSeed() {
  const seed = buildSeed({})
  const week1 = seed.tables.weeks.find(w => w.id === WEEK_ID)
  week1.start_date = CASES[0].week1Start
  seed.tables.weeks.push({ id: DESKTOP_WEEK2_ID, athlete_id: ATHLETE_ID, week_number: 2, block_name: 'Base', start_date: null })

  seed.tables.athletes.push({
    id: MOBILE_ATHLETE_ID, user_id: null, name: 'Testatlet Mobil', email: null,
    status: 'active', hidden: false, snooze_until: null, competition_date: null,
    onboarding_completed_at: new Date().toISOString(),
  })
  seed.tables.weeks.push(
    { id: MOBILE_WEEK1_ID, athlete_id: MOBILE_ATHLETE_ID, week_number: 1, block_name: 'Base', start_date: CASES[1].week1Start },
    { id: MOBILE_WEEK2_ID, athlete_id: MOBILE_ATHLETE_ID, week_number: 2, block_name: 'Base', start_date: null },
  )
  return seed
}

async function runCase(browser, testCase) {
  const page = await browser.newPage({ viewport: testCase.viewport })
  const pageErrors = []
  page.on('pageerror', err => pageErrors.push(err))

  await page.goto(APP_URL)
  await page.locator('#athlete-auth-email').fill(COACH_USER.email)
  await page.locator('#athlete-auth-password').fill(COACH_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()

  await page.getByText(testCase.athleteName, { exact: true }).first().click()
  await page.getByRole('button', { name: /Program$/ }).click()

  const fillBtn = page.getByRole('button', { name: 'Sæt datoer' })
  await fillBtn.waitFor({ state: 'visible', timeout: 15000 })

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
  assert.equal(overflow, false, `${testCase.tag}: vandret scroll på program-fanen`)

  await page.screenshot({ path: join(OUT_DIR, `${testCase.tag}-01-foer.png`), fullPage: true })

  await fillBtn.click()
  await page.getByText('1 uge mangler en dato').waitFor({ state: 'visible', timeout: 5000 })
  await page.screenshot({ path: join(OUT_DIR, `${testCase.tag}-02-preview.png`), fullPage: true })

  await page.getByRole('button', { name: 'Gem 1 dato' }).click()
  await fillBtn.waitFor({ state: 'hidden', timeout: 10000 })
  await page.screenshot({ path: join(OUT_DIR, `${testCase.tag}-03-efter.png`), fullPage: true })

  const crashed = await page.getByText('Ups — noget gik galt.').count()
  assert.equal(crashed, 0, `${testCase.tag}: ErrorBoundary-fallbacken ramt`)
  assert.equal(pageErrors.length, 0, `${testCase.tag}: ${pageErrors.length} browser-fejl: ${pageErrors.map(e => e.message).join('; ')}`)

  await page.close()
}

async function main() {
  const mock = createMockSupabase(buildFillSeed())
  await mock.listen(MOCK_PORT)
  const vite = await startVite()
  const browser = await launchBrowser()
  try {
    for (const testCase of CASES) await runCase(browser, testCase)

    // Assertions mod mockens tabeller: den udaterede uge fik den rigtige dato,
    // den allerede-daterede uge er urørt.
    const weeks = mock.table('weeks')
    for (const testCase of CASES) {
      const week1 = weeks.find(w => w.id === testCase.week1Id)
      const week2 = weeks.find(w => w.id === testCase.week2Id)
      assert.equal(week1.start_date, testCase.week1Start, `${testCase.tag}: uge 1's dato blev ændret`)
      assert.equal(week2.start_date, testCase.expectedWeek2Start, `${testCase.tag}: uge 2 fik ikke den forventede dato`)
    }

    console.log('\nGRØN: "Sæt datoer" udfylder kun manglende start_date, viser preview før gem, virker ved 1280px og 390px uden vandret scroll eller fejl.')
    process.exitCode = 0
  } catch (err) {
    console.error('\nFEJL:', err.message)
    process.exitCode = 1
  } finally {
    await browser.close()
    await vite.stop()
    await mock.close()
  }
}

main()
