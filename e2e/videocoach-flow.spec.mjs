// ORDRE 333 · commit 2: hele VideoCoach-flowet som én ubrudt prøve på 390×844,
// så det ikke kan knække stille igen:
//   1) atleten åbner VideoCoach-kortet (bag "Mere"), vælger et syntetisk klip
//      og vælger løft i sendearket ("upload og gå"-vejen),
//   2) sætter start, finder skiven og trykker "Vis mig nu": tre vinduer spores
//      og de brugbare vises (state 'done', mindst 2 af 3), hvorefter videoen
//      selv sendes til coachen (awaiting_analysis-række + objekt i mock-storage under <athlete_id>/),
//   3) coachen logger ind, ser "Afventer sporing" og åbner videoen i
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

const MOBILE = { width: 390, height: 844 }

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
  const mere = page.getByRole('button', { name: 'Mere', exact: true })
  await mere.waitFor({ state: 'visible', timeout: 15000 })
  if (await mere.getAttribute('aria-expanded') !== 'true') await mere.click()
  await page.getByText('VideoCoach', { exact: true }).click()

  const frame = page.frameLocator('iframe[title="VideoCoach"]')
  await frame.locator('body.athlete').waitFor({ state: 'attached', timeout: 10000 })
  await frame.locator('#fileInput').setInputFiles(clipPath)
  // Sendearket åbner af sig selv når metadata er klar: vælg løft, luk det, og
  // tag i stedet "Vis mig nu"-vejen (start → skive → Vis mig nu).
  await frame.locator('#athleteSubmitSheet[hidden]').waitFor({ state: 'detached', timeout: 15000 })
  await frame.locator('#liftSel').selectOption({ label: 'Squat' })
  await shot('01-atlet-sendeark')
  await frame.locator('#athleteSubmitCard .athleteSubmitClose').click()
  await frame.locator('body[data-athlete-state="ready"]').waitFor({ state: 'attached', timeout: 15000 })

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
  assert.ok(await calibrateAthlete(frame, page, canvas, box), 'skiven blev ikke fundet (Vis mig nu-flowet)')
  const previewBtn = frame.locator('#athletePreviewBtn')
  await previewBtn.waitFor({ state: 'visible', timeout: 5000 })
  await shot('02-atlet-ring-bekraeftet')

  const rowsBefore = (await readTable(mockUrl, 'video_analyses')).length
  await previewBtn.click()
  // Vis mig nu: 'analyzing' → 'done' (sporede reps vist) → upload. Falder den
  // tilbage til direkte upload (presearch < 3 vinduer, eller 0 sporede reps
  // som før ordre 333's tracking-rettelse), springes 'done' over — fejl her.
  let sawDone = false
  let status = ''
  const trace = []
  const tPoll0 = Date.now()
  for (let i = 0; i < 240 && !sawDone; i++) {
    await page.waitForTimeout(500)
    const state = await frame.locator('body').getAttribute('data-athlete-state')
    const banner = ((await frame.locator('#banner').textContent().catch(() => '')) || '').trim()
    const last = trace.at(-1)
    if (!last || last.state !== state || last.banner !== banner) trace.push({ s: +((Date.now() - tPoll0) / 1000).toFixed(1), state, banner })
    if (state === 'done') { sawDone = true; status = banner }
    if (state === 'error') break
  }
  const videoState = sawDone ? null : await frame.locator('video').evaluate(v =>
    ({ t: +v.currentTime.toFixed(2), paused: v.paused, ended: v.ended, readyState: v.readyState })).catch(() => null)
  assert.ok(sawDone, `Vis mig nu nåede aldrig tilstanden "done" (reps vist). Forløb: ${JSON.stringify(trace)} video: ${JSON.stringify(videoState)}`)
  // Tre vinduer spores (første, midt, sidste). På det syntetiske klip starter
  // presearchs sidste vindue midt i en rep (skiven er ikke ved ringen), så 2
  // af 3 er det forventede her; 0 eller 1 betyder at sporingen er brudt.
  const shown = Number((status.match(/Viser (\d+) af/) || [])[1] || 0)
  assert.ok(shown >= 2, `Vis mig nu viste ${shown} sporede reps, forventede mindst 2: "${status}"`)
  await shot('03-atlet-vis-mig-nu-tre-reps')

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
  assert.equal(rows.length, rowsBefore + 1, `Vis mig nu skulle give præcis én ny række: ${JSON.stringify(rows.map(r => [r.id, r.analysis_state, r.client_analysis_id]))}`)
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
  await page.getByRole('button', { name: /Testatlet.*Uge/ }).click({ timeout: 15000 })
  await page.getByRole('button', { name: /Mere/ }).click()
  await page.getByRole('button', { name: /Analyse$/ }).click()
  await page.getByText('Afventer sporing').first().waitFor({ state: 'visible', timeout: 10000 })
  await shot('05-coach-afventer-sporing')
  await page.getByRole('button', { name: /Spor nu/ }).first().click()
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

  async function withPage(fn) {
    const page = await browser.newPage({ viewport: MOBILE })
    page.on('pageerror', err => errors.push(`pageerror: ${err.message}`))
    page.on('console', msg => { if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`) })
    page.on('response', res => { if (res.status() >= 400) failedRequests.push(`${res.status()} ${res.request().method()} ${res.url()}`) })
    const shot = name => page.screenshot({ path: join(outDir, `videocoach-flow-${name}.png`), fullPage: true })
    try { return await fn(page, shot) } finally { await page.close() }
  }

  try {
    const { row, status } = await withPage((page, shot) => runAthleteVisMigNu(page, { appUrl: APP_URL, mockUrl, clipPath, shot }))
    await withPage((page, shot) => runCoachOpens(page, { appUrl: APP_URL, shot }))
    assert.deepEqual(errors, [], `browser-fejl: ${JSON.stringify(errors)}`)
    assert.deepEqual(failedRequests, [], `fejlede netværkskald: ${JSON.stringify(failedRequests)}`)
    console.log(`\nGRØN: VideoCoach ende til ende på 390×844 — upload, Vis mig nu (${status || 'tre reps vist'}), række ${row.analysis_state}, coachen åbnede videoen. ${((Date.now() - t0) / 1000).toFixed(1)}s.`)
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
