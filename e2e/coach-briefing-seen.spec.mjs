// ORDRE 325 · commit 2 — "Set" på et punkt under "Kræver dit blik" (bevist,
// ikke antaget). Seeder tre punkter (to ulæste beskeder på hvert sit spor +
// et video-udkast) i mockens tabeller. I den ÆGTE, ubuildede app (npm run
// dev) mod den lokale mock logger coachen ind og:
//   1. ser alle tre punkter i "Kræver dit blik"-forhåndsvisningen på forsiden;
//   2. trykker "Set" på video-punktet — punktet dæmpes og synker til bunden
//      af listen (bliver stående, fjernes ikke), og mockens coach_briefing_seen
//      får præcis én række (coach_id + punkt-nøgle);
//   3. et helsides genindlæs (page.reload) beviser at "Set" overlever — punktet
//      hentes tilbage som dæmpet fra mocken, ikke kun fra React-state.
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
    { id: VIDEO_DRAFT_ID, athlete_id: ATHLETE_ID, lift: 'squat', variation: 'competition_squat', load_kg: 100, reps_count: null, status: 'draft', source_mode: 'coach_capture', analysis_state: null, created_at: agoIso(30 * MINUTE) },
  ]
  return seed
}

async function loginPaaForsiden(page, appUrl) {
  await page.goto(appUrl)
  await page.locator('#athlete-auth-email').fill(COACH_USER.email)
  await page.locator('#athlete-auth-password').fill(COACH_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  await page.getByRole('button', { name: /Testatlet.*Uge/ }).waitFor({ state: 'visible', timeout: 15000 })
}

// Rækkefølgen af data-coach-briefing-point i DOM'en — bruges til at bevise
// at det sete punkt synker til BUNDEN af forhåndsvisningen, ikke bare dæmpes
// på sin oprindelige plads.
async function punktRaekkefoelge(page) {
  return page.evaluate(() => [...document.querySelectorAll('[data-coach-briefing-point]')].map(el => ({
    key: el.getAttribute('data-coach-briefing-point'),
    seen: el.getAttribute('data-coach-briefing-seen') === 'true',
  })))
}

async function runCoachBriefingSeen(page, { appUrl, outDir, mock, viewport }) {
  const shot = name => page.screenshot({ path: join(outDir, `coach-briefing-seen-${viewport.label}-${name}.png`), fullPage: true })
  const videoRow = () => page.locator(`[data-coach-briefing-point="${VIDEO_POINT_KEY}"]`)

  await loginPaaForsiden(page, appUrl)

  // ---- 1) alle tre punkter vises, ingen er sete endnu ----
  await page.getByText('3 åbne ting', { exact: false }).first().waitFor({ state: 'visible', timeout: 15000 })
  await videoRow().waitFor({ state: 'visible', timeout: 10000 })
  const foerKlik = await punktRaekkefoelge(page)
  assert.equal(foerKlik.length, 3, 'alle tre punkter skal stå i forhåndsvisningen')
  assert.ok(foerKlik.every(p => !p.seen), 'intet punkt må være markeret set fra start')
  await shot('01-ingen-set')

  // ---- 2) "Set" på video-punktet dæmper det og sender det til bunden ----
  await videoRow().getByRole('button', { name: 'Set' }).click()
  await page.locator(`[data-coach-briefing-point="${VIDEO_POINT_KEY}"][data-coach-briefing-seen="true"]`)
    .waitFor({ state: 'visible', timeout: 10000 })
  const efterKlik = await punktRaekkefoelge(page)
  assert.equal(efterKlik.length, 3, 'punktet skal blive stående, ikke fjernes')
  assert.equal(efterKlik[efterKlik.length - 1].key, VIDEO_POINT_KEY, 'det sete punkt skal ligge nederst')
  assert.equal(efterKlik.filter(p => p.seen).length, 1, 'kun det klikkede punkt må være sat')
  await videoRow().getByText('Set ✓', { exact: true }).waitFor({ state: 'visible', timeout: 10000 })

  const seenRows = mock.table('coach_briefing_seen')
  assert.equal(seenRows.length, 1, 'mockens coach_briefing_seen skal have præcis én række')
  assert.equal(seenRows[0].coach_id, COACH_USER.id)
  assert.equal(seenRows[0].point_key, VIDEO_POINT_KEY)
  assert.ok(seenRows[0].seen_at, 'seen_at skal være sat')
  await shot('02-video-set')

  // ---- 3) et helsides genindlæs beviser at "Set" kommer fra mocken, ikke kun React-state ----
  await page.reload()
  await page.getByRole('button', { name: /Testatlet.*Uge/ }).waitFor({ state: 'visible', timeout: 15000 })
  await page.locator(`[data-coach-briefing-point="${VIDEO_POINT_KEY}"][data-coach-briefing-seen="true"]`)
    .waitFor({ state: 'visible', timeout: 10000 })
  const efterGenindlaes = await punktRaekkefoelge(page)
  assert.equal(efterGenindlaes.length, 3)
  assert.equal(efterGenindlaes[efterGenindlaes.length - 1].key, VIDEO_POINT_KEY, 'skal stadig ligge nederst efter genindlæs')
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
    console.log('\nGRØN: "Set" på et punkt under "Kræver dit blik" dæmper det og sender det til bunden (fjernes ikke), og overlever et helsides genindlæs mod mocken (390x844 og desktop).')
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
