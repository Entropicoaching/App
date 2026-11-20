// ORDRE 325 · commit 2 — "Set" på et punkt under "Kræver dit blik" (bevist,
// ikke antaget). Seeder tre punkter (to ulæste beskeder på hvert sit spor +
// en video indsendt af atleten) i mockens tabeller. I den ÆGTE, ubuildede app
// (npm run dev) mod den lokale mock logger coachen ind og:
//   1. ser alle tre punkter tælle med i menuens "Coach Briefing" og atleten
//      stå i "Kræver dit blik" på forsiden;
//   2. åbner atletens samtale (knappen på rækken) og åbner video-punktet:
//      "Ulæst" forsvinder, videoen bliver stående i samtalen (fjernes ikke),
//      og mockens coach_briefing_seen får præcis én række (coach_id + punkt-nøgle);
//   3. et helsides genindlæs (page.reload) beviser at "Set" overlever — videoen
//      er stadig sat som set, hentet fra mocken, ikke kun fra React-state.
// Forældet 20. nov. (ordre 1544/1692/1707): forsidens egen "Set"-knap og
// data-coach-briefing-point-rækkerne hører til den gamle forside (ForsideView,
// kun når entropi2 er slået fra). Entropi 2 sætter "Set" for videoen, når coachen
// åbner den i samtalen (conversationAdapters.seen -> coach_briefing_seen).
// Kørt på 390x844 og desktop, samme mønster som coach-automation-alerts.spec.mjs.
//
// Kørsel: node e2e/coach-briefing-seen.spec.mjs (npm run e2e:coach-briefing-seen)

import assert from 'node:assert/strict'
import { join } from 'node:path'
import { createMockSupabase } from './mock-supabase.mjs'
import { buildSeed, COACH_USER, ATHLETE_ID } from './fixtures.mjs'
import { startVite, launchBrowser, APP_URL, MOCK_PORT, OUT_DIR } from './harness.mjs'

const MOBILE = { width: 390, height: 844, label: 'mobil-390' }
const DESKTOP = { width: 1280, height: 900, label: 'desktop-1280' }

const VIDEO_DRAFT_ID = 'bbbbbbbb-0325-4325-8325-bbbbbbbbbbb1'
const VIDEO_POINT_KEY = `video-${VIDEO_DRAFT_ID}`

const agoIso = ms => new Date(Date.now() - ms).toISOString()
const MINUTE = 60 * 1000

function seedTrePunkter() {
  const seed = buildSeed()
  seed.tables.messages = [
    { id: 'cccccccc-0325-4325-8325-cccccccccc01', athlete_id: ATHLETE_ID, sender_role: 'athlete', content: 'Hej, hvordan gik ugen?', category: 'besked', read_by_coach: false, created_at: agoIso(90 * MINUTE) },
    { id: 'cccccccc-0325-4325-8325-cccccccccc02', athlete_id: ATHLETE_ID, sender_role: 'athlete', content: 'Kan du se på min teknik?', category: 'teknik', read_by_coach: false, created_at: agoIso(60 * MINUTE) },
  ]
  seed.tables.video_analyses = [
    { id: VIDEO_DRAFT_ID, athlete_id: ATHLETE_ID, lift: 'squat', variation: 'competition_squat', load_kg: 100, reps_count: null, status: 'draft', source_mode: 'athlete_submission', analysis_state: null, created_at: agoIso(30 * MINUTE) },
  ]
  return seed
}

async function loginPaaForsiden(page, appUrl) {
  await page.goto(appUrl)
  await page.locator('#athlete-auth-email').fill(COACH_USER.email)
  await page.locator('#athlete-auth-password').fill(COACH_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  await page.getByRole('button', { name: /Åbn programmet for Testatlet/ }).waitFor({ state: 'visible', timeout: 15000 })
}

// Atletens række i "Kræver dit blik" (knap med navn og grund), ikke den lange "Åbn programmet"-knap.
const kraeverRaekke = page => page.getByRole('button', { name: /Testatlet · / }).first()
const briefingMenu = (page, antal) => page.getByRole('button', { name: /coach briefing/i }).filter({ hasText: String(antal) }).first()
const videoKnap = page => page.getByRole('button', { name: /^Video · / })
// Første gang via rækken i "Kræver dit blik"; efter genindlæs er videoen set og rækken åbner i stedet videoreviewet
// (modal, "Video venter på feedback"), så der åbnes atletens program, og fanen Beskeder viser samtalen.
async function aabnSamtale(page, via = 'raekke') {
  if (via === 'raekke') await kraeverRaekke(page).click()
  else await page.getByRole('button', { name: /Åbn programmet for Testatlet/ }).click()
  await page.getByRole('button', { name: /Beskeder/ }).first().click()
  await videoKnap(page).waitFor({ state: 'visible', timeout: 15000 })
}

async function runCoachBriefingSeen(page, { appUrl, outDir, mock, viewport }) {
  const shot = name => page.screenshot({ path: join(outDir, `coach-briefing-seen-${viewport.label}-${name}.png`), fullPage: true })

  await loginPaaForsiden(page, appUrl)

  // ---- 1) alle tre punkter tæller med, atleten står i "Kræver dit blik", intet er sat set ----
  await page.getByRole('heading', { name: 'Kræver dit blik' }).waitFor({ state: 'visible', timeout: 15000 })
  await kraeverRaekke(page).waitFor({ state: 'visible', timeout: 10000 })
  // Menuens tæller (beskeder + video) står kun i den smalle visning; på desktop er menuen ikke knapper.
  if (viewport.width < 600) await briefingMenu(page, 3).waitFor({ state: 'visible', timeout: 10000 })
  assert.equal(mock.table('coach_briefing_seen').length, 0, 'intet punkt må være markeret set fra start')
  await shot('01-ingen-set')

  // ---- 2) videoen åbnes i samtalen: "Ulæst" væk, punktet bliver stående, én række i mocken ----
  await aabnSamtale(page)
  await page.getByRole('button', { name: /^Video · .*Ulæst/ }).click()
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => /^Video · /.test(b.innerText) && !/Ulæst/.test(b.innerText)),
    null, { timeout: 10000 })
  assert.equal(await videoKnap(page).count(), 1, 'videoen skal blive stående i samtalen, ikke fjernes')
  await page.getByRole('button', { name: 'Åbn videoreview' }).waitFor({ state: 'visible', timeout: 10000 })

  const seenRows = mock.table('coach_briefing_seen')
  assert.equal(seenRows.length, 1, 'mockens coach_briefing_seen skal have præcis én række')
  assert.equal(seenRows[0].coach_id, COACH_USER.id)
  assert.equal(seenRows[0].point_key, VIDEO_POINT_KEY)
  assert.ok(seenRows[0].seen_at, 'seen_at skal være sat')
  await shot('02-video-set')

  // ---- 3) et helsides genindlæs beviser at "Set" kommer fra mocken, ikke kun React-state ----
  await page.reload()
  await page.getByRole('heading', { name: 'Kræver dit blik' }).waitFor({ state: 'visible', timeout: 15000 })
  await aabnSamtale(page, 'program')
  assert.equal(await page.getByRole('button', { name: /^Video · .*Ulæst/ }).count(), 0, 'videoen skal stadig være set efter genindlæs')
  assert.equal(await videoKnap(page).count(), 1, 'videoen skal stadig stå i samtalen efter genindlæs')
  assert.equal(mock.table('coach_briefing_seen').length, 1, 'genindlæs må ikke skrive en ekstra række')
  await shot('03-efter-genindlaes')

  return true
}

async function med(browser, viewport, seed, fn) {
  const mock = createMockSupabase(seed)
  await mock.listen(MOCK_PORT)
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } })
  const fejl = []
  page.on('pageerror', err => fejl.push(`pageerror: ${err.message}`))
  page.on('console', msg => { if (msg.type() === 'error') fejl.push(`console.error: ${msg.text()}`) })
  try {
    const result = await fn(page, mock)
    assert.deepEqual(fejl, [], `Ingen browser-fejl forventet (${viewport.label}), fandt: ${JSON.stringify(fejl)}`)
    return result
  } finally {
    await page.close().catch(() => {})
    await mock.close().catch(() => {})
  }
}

async function main() {
  const vite = await startVite()
  const browser = await launchBrowser()
  try {
    for (const viewport of [MOBILE, DESKTOP]) {
      await med(browser, viewport, seedTrePunkter(), (page, mock) =>
        runCoachBriefingSeen(page, { appUrl: APP_URL, outDir: OUT_DIR, mock, viewport }))
    }
    console.log('\nGRØN: "Set" på video-punktet i coachens samtale (Kræver dit blik) fjerner "Ulæst", fjerner ikke videoen, og overlever et helsides genindlæs mod mocken (390x844 og desktop).')
    process.exitCode = 0
  } catch (err) {
    console.error('\nFEJL:', err.message)
    process.exitCode = 1
  } finally {
    await browser.close().catch(() => {})
    await vite.stop().catch(() => {})
  }
}

if (process.argv[1] && process.argv[1].endsWith('coach-briefing-seen.spec.mjs')) main()
