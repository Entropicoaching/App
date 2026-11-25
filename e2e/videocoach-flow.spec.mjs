// ORDRE 333 · commit 2: hele VideoCoach-flowet som én ubrudt prøve på 390×844,
// så det ikke kan knække stille igen:
//   1) atleten åbner "Film et sæt til videocoach" (bag "Mere i dag"), vælger et syntetisk klip
//      og vælger løft,
//   2) sætter start, finder skiven og kører hele sporingen (#allBtn): reps spores
//      og resultatpanelet viser dem (state 'done', mindst 2), hvorefter atleten trykker Send
//      (athleteInstantSaveBtn) (awaiting_analysis-række + objekt i mock-storage under <athlete_id>/),
//   3) coachen logger ind, ser "Sporet af atleten" og åbner videoen i
//      VideoCoach (signeret URL, videoen loader).
//
// Klippet er scripts/make-test-clip.mjs's 'glat'-variant (syntetisk skive,
// ingen rigtig krop, aldrig committet). Egen mock-instans.
//
// Prøven fanger også ordre 333's anden fejl: vcAthletePreviewThree satte
// aldrig `tracking = true`, så hvert vindue stoppede ved første frame og
// "Vis mig nu" altid faldt tilbage til ren upload (ingen 'done').
//
// ÆRLIG GRÆNSE: mocken simulerer ikke storage-policies. Fejlen der faktisk
// brød produktionen (foldername(name) bundet til athletes.name) fanges af
// src/storagePolicySql.test.js, ikke her. Denne prøve fanger resten af
// kæden: kort, iframe-bro, sti-konvention, række, coachens åbning.
//
// Kørsel: node e2e/videocoach-flow.spec.mjs [--out <mappe>]

import assert from 'node:assert/strict'
import { join, resolve } from 'node:path'
import { mkdirSync } from 'node:fs'
import { createMockSupabase } from './mock-supabase.mjs'
import { buildSeed, ATHLETE_USER, ATHLETE_ID, COACH_USER } from './fixtures.mjs'
import { startVite, launchBrowser, APP_URL, MOCK_PORT, OUT_DIR, ROOT, ensureCoachSporingClip } from './harness.mjs'
import { calibrateAthlete, CLICK_AT_S } from './athlete-film-et-saet.mjs'
import { N_REPS } from '../scripts/make-test-clip.mjs'

const MOBILE = { width: Number(process.env.E2E_VW || 390), height: 844 }

async function readTable(mockUrl, name) {
  const res = await fetch(`${mockUrl}/__e2e/table?name=${encodeURIComponent(name)}`)
  return res.json()
}
async function readStorageKeys(mockUrl) {
  const res = await fetch(`${mockUrl}/__e2e/storage-keys`)
  return res.json()
}

export async function runAthleteVisMigNu(page, { appUrl, mockUrl, clipPath, shot }) {
  await page.goto(appUrl)
  await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
  await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  // Forsiden samler det sekundære bag folden "Mere i dag" (ordre 1541); "Film et sæt til videocoach" ligger derinde.
  const mere = page.getByText('Mere i dag', { exact: true })
  await mere.waitFor({ state: 'visible', timeout: 15000 })
  if (!(await page.getByRole('button', { name: 'Film et sæt til videocoach' }).isVisible())) await mere.click()
  await page.getByRole('button', { name: 'Film et sæt til videocoach' }).click()

  const frame = page.frameLocator('iframe[title="VideoCoach"]')
  await frame.locator('body.athlete').waitFor({ state: 'attached', timeout: 10000 })
  await frame.locator('#fileInput').setInputFiles(clipPath)
  // "Film et sæt" er atletens vej ind (ordre 1890v): ingen sendeark, men løftvalget #vcAthleteLift
  // står i selve visningen, og afsendelsen sker fra resultatpanelet efter sporingen.
  await frame.locator('body[data-athlete-state="ready"]').waitFor({ state: 'attached', timeout: 15000 })
  await frame.locator('#vcAthleteLift').selectOption({ label: 'Squat' })
  await shot('01-atlet-valgt-loeft')

  await frame.locator('video').evaluate(
    (v, t) => new Promise(done => {
      if (Math.abs(v.currentTime - t) < 0.001) { done(); return }
      v.addEventListener('seeked', done, { once: true })
      v.currentTime = t
    }),
    CLICK_AT_S,
  )
  await frame.locator('#athleteMarkStartBtn').click()
  const canvas = frame.locator('#canvas')
  await canvas.waitFor({ state: 'visible', timeout: 10000 })
  const box = await canvas.boundingBox()
  assert.ok(box, 'canvas har ingen synlig boks')
  await page.waitForTimeout(300)
  assert.ok(await calibrateAthlete(frame, page, canvas, box), 'skiven blev ikke fundet (Film et sæt-flowet)')
  await shot('02-atlet-ring-bekraeftet')

  const rowsBefore = (await readTable(mockUrl, 'video_analyses')).length
  // "Vis mig nu" (tre udvalgte reps) er skjult i "Film et sæt" (VC_ATHLETE_INSTANT, videocoach.html);
  // atletens vej er i stedet hele sporingen (#allBtn) med resultatpanelet, og derfra "Send".
  await frame.locator('body[data-athlete-state="done"]').waitFor({ state: 'attached', timeout: 90000 })
  const panel = frame.locator('#athleteInstantResult')
  await panel.waitFor({ state: 'visible', timeout: 5000 })
  const status = ((await frame.locator('#athleteInstantResult .athInstantHead').textContent()) || '').trim()
  // Klippet har N_REPS reps; panelet skal finde dem og må ikke påstå flere.
  const shown = Number((status.match(/^(\d+) reps? fundet$/) || [])[1] || 0)
  assert.ok(shown >= 2 && shown <= N_REPS, `sporingen fandt ${shown} reps, forventede mindst 2 og højst ${N_REPS}: "${status}"`)
  await shot('03-atlet-resultat')
  await frame.locator('#athleteInstantSaveBtn').click()

  // Poll fra node, ikke page.waitForFunction: en async-funktion dér giver et
  // Promise, som Playwright tæller som sandt med det samme.
  let rows = []
  for (let i = 0; i < 60; i++) {
    rows = await readTable(mockUrl, 'video_analyses')
    if (rows.some(r => r.athlete_id === ATHLETE_ID && r.analysis_state === 'awaiting_analysis')) break
    await page.waitForTimeout(500)
  }
  await frame.locator('body[data-athlete-state="sent"]').waitFor({ state: 'attached', timeout: 15000 })
  await shot('04-atlet-sendt')
  assert.equal(rows.length, rowsBefore + 1, `Afsendelsen skulle give præcis én ny række: ${JSON.stringify(rows.map(r => [r.id, r.analysis_state, r.client_analysis_id]))}`)
  const row = rows.find(r => r.athlete_id === ATHLETE_ID && r.analysis_state === 'awaiting_analysis')
  assert.equal(row.source_mode, 'athlete_submission')
  assert.ok(row.video_path.startsWith(`${ATHLETE_ID}/`),
    `stien skal starte med atletens id (storage-policyernes første mappe), fik ${row.video_path}`)
  const keys = await readStorageKeys(mockUrl)
  assert.ok(keys.includes(`videocoach-uploads/${row.video_path}`), 'videoen ligger ikke i mock-storage')
  return { row, status: status.trim() }
}

export async function runCoachOpens(page, { appUrl, shot }) {
  await page.goto(appUrl)
  await page.locator('#athlete-auth-email').fill(COACH_USER.email)
  await page.locator('#athlete-auth-password').fill(COACH_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  await page.getByRole('button', { name: /Åbn programmet for Testatlet/ }).click({ timeout: 15000 })
  await page.getByRole('button', { name: /Mere/ }).click()
  await page.getByRole('button', { name: /Analyse$/ }).click()
  // U9 (Marc 11. nov.): har atleten selv sporet sættet, står rækken som "Sporet af atleten" med knappen
  // "Åbn video" i stedet for "Afventer sporing" / "Spor nu" (AnalyseTab.jsx).
  await page.getByText('Sporet af atleten').first().waitFor({ state: 'visible', timeout: 10000 })
  await shot('05-coach-sporet-af-atleten')
  await page.getByRole('button', { name: /Åbn video/ }).first().click()
  await page.frameLocator('iframe[title="VideoCoach"]').locator('video').waitFor({ state: 'attached', timeout: 10000 })
  await page.waitForFunction(() => {
    const video = document.querySelector('iframe[title="VideoCoach"]')?.contentDocument?.querySelector('video')
    return !!video && video.videoWidth > 0
  }, null, { timeout: 15000 })
  await shot('06-coach-video-aabnet')
}

async function main() {
  const outArg = process.argv.indexOf('--out')
  const outDir = outArg > 0 ? resolve(ROOT, process.argv[outArg + 1]) : OUT_DIR
  mkdirSync(outDir, { recursive: true })
  const { path: clipPath } = ensureCoachSporingClip('glat')
  const t0 = Date.now()

  const mock = createMockSupabase(buildSeed({}))
  await mock.listen(MOCK_PORT)
  const mockUrl = `http://127.0.0.1:${MOCK_PORT}`
  const vite = await startVite()
  const browser = await launchBrowser()
  const errors = []
  const failedRequests = []
  let ignored404 = 0

  async function withPage(fn) {
    const page = await browser.newPage({ viewport: MOBILE, colorScheme: process.env.E2E_SCHEME || 'light' })
    page.on('pageerror', err => errors.push(`pageerror: ${err.message}`))
    page.on('console', msg => { if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`) })
    page.on('response', res => {
      if (res.status() < 400) return
      // Forsidens påmindelseskort (U8 PushCard bag "Mere i dag") kalder edge-funktionen u8-push, som mocken ikke har
      // (404, ikke et videoflow-fund). Hverken kaldet eller browserens tilhørende 404-linje tæller med.
      if (res.status() === 404 && new URL(res.url()).pathname === '/functions/v1/u8-push') { ignored404++; return }
      failedRequests.push(`${res.status()} ${res.request().method()} ${res.url()}`)
    })
    const shot = name => page.screenshot({ path: join(outDir, `videocoach-flow-${name}.png`), fullPage: true })
    try { return await fn(page, shot) } finally { await page.close() }
  }

  try {
    const { row, status } = await withPage((page, shot) => runAthleteVisMigNu(page, { appUrl: APP_URL, mockUrl, clipPath, shot }))
    await withPage((page, shot) => runCoachOpens(page, { appUrl: APP_URL, shot }))
    for (let i = 0; i < ignored404; i++) {
      const at = errors.indexOf('console.error: Failed to load resource: the server responded with a status of 404 (Not Found)')
      if (at >= 0) errors.splice(at, 1)
    }
    assert.deepEqual(errors, [], `browser-fejl: ${JSON.stringify(errors)}`)
    assert.deepEqual(failedRequests, [], `fejlede netværkskald: ${JSON.stringify(failedRequests)}`)
    console.log(`\nGRØN: VideoCoach ende til ende på 390×844 — upload, sporing (${status}), række ${row.analysis_state}, coachen åbnede videoen. ${((Date.now() - t0) / 1000).toFixed(1)}s.`)
    process.exitCode = 0
  } catch (err) {
    console.error('\nFEJL:', err.message)
    if (errors.length) console.error('browser-fejl:', errors.join(' | '))
    if (failedRequests.length) console.error('netværk:', failedRequests.join(' | '))
    process.exitCode = 1
  } finally {
    await browser.close().catch(() => {})
    await vite.stop().catch(() => {})
    await mock.close().catch(() => {})
  }
}

if (process.argv[1] && process.argv[1].endsWith('videocoach-flow.spec.mjs')) main()
