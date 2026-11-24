// ORDRE 155 · commit 1 — "upload og gå": atleten filmer/vælger en video i
// VideoCoach, sender den til coachen, og kommer tilbage til dagens pas uden
// at vente på selve analysen. Kører den ÆGTE public/videocoach.html (samme
// iframe-bro som src/AthleteView.jsx bruger i produktion), mod den lokale
// mock-storage (ordre 155's udvidelse af e2e/mock-supabase.mjs).
//
// Testklippet ordren peger på (test-clips/vis-mig-nu-4-reps-realistisk.mp4)
// findes ikke i dette repo (test-clips/ er git-ignoreret persondata) — faldet
// tilbage til ordrens eget alternativ, et 2s syntetisk klip lavet i testen
// (se ensureSyntheticClip i e2e/harness.mjs). Standardvejen ("Send til coach")
// kræver ingen sporbar stangbane, kun en video Chromium kan afspille metadata
// for — se docs/E2E.md.

import assert from 'node:assert/strict'
import { join } from 'node:path'
import { ATHLETE_USER, ATHLETE_ID } from './fixtures.mjs'
import { ensureCoachSporingClip } from './harness.mjs'
import { filmSaetUpTilDone } from './athlete-film-et-saet.mjs'

async function readTable(mockUrl, name) {
  const res = await fetch(`${mockUrl}/__e2e/table?name=${encodeURIComponent(name)}`)
  return res.json()
}
async function readStorageKeys(mockUrl) {
  const res = await fetch(`${mockUrl}/__e2e/storage-keys`)
  return res.json()
}

export async function runVideoUpload(page, { appUrl, mockUrl, outDir, loginNeeded = true, clipPath: clipOverride = null, liftLabel = 'Squat' }) {
  const shot = (name) => page.screenshot({ path: join(outDir, `video-upload-${name}.png`), fullPage: true })
  // ORDRE 200: coach-sporing.spec.mjs genbruger dette upload-skridt med sit
  // eget, sporbare klip (en skive med faktisk kontrast) i stedet for det
  // rene testsrc-mønster her, som ingen tracker kan finde noget i.
  const clipPath = clipOverride || ensureCoachSporingClip('glat').path // Entropi 2: film-vejen kræver et klip med en skive, der kan spores

  if (loginNeeded) {
    await page.goto(appUrl)
    await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
    await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
    await page.getByRole('button', { name: 'Log ind' }).click()
    await page.locator('[data-home-mere] > summary').waitFor({ state: 'visible', timeout: 15000 })
  }
  // Entropi 2 (ordre 2069): "Film et sæt til videocoach" ligger under "Mere i dag" på Hjem.
  const mereIDag = page.locator('[data-home-mere]')
  if (!(await mereIDag.evaluate(el => el.open))) await mereIDag.locator('> summary').click()

  await page.locator('[data-film-set]').first().click()

  const frame = page.frameLocator('iframe[title="VideoCoach"]')
  // #fileInput er attached fra selve HTML'en med det samme — men videocoach.html
  // er ét kæmpe inline-script, og onchange-lytteren først bindes når det er
  // færdigkørt. body.athlete sættes til allersidst i ATHLETE-opsætningen
  // (se public/videocoach.html), så at vente på DEN her er det pålidelige
  // signal om at fileInput's onchange rent faktisk er klar.
  // Entropi 2 (ordre 2069): film-vejen analyserer klippet i iframen og sender det med "Send video til coach" (athleteInstantSaveBtn).
  const state = await filmSaetUpTilDone(frame, page, clipPath, shot)
  assert.equal(state, 'done', 'analysen blev ikke færdig: ' + state)
  const foer = new Set((await readTable(mockUrl, 'video_analyses')).map(r => r.id))
  await frame.locator('#athleteInstantSaveBtn').click()

  let row = null
  for (let i = 0; i < 150 && !row; i++) {
    row = (await readTable(mockUrl, 'video_analyses')).find(r => !foer.has(r.id) && r.athlete_id === ATHLETE_ID) || null
    if (!row) await page.waitForTimeout(200)
  }
  await shot('02-sendt')
  assert.ok(row, 'video_analyses mangler en ny række fra atleten efter upload')

  const keys = await readStorageKeys(mockUrl)
  assert.ok(keys.includes(`videocoach-uploads/${row.video_path}`),
    `mock-storage mangler filen for ${row.video_path} (har: ${keys.join(', ')})`)

  // Tilbage i dagens pas uden at vente på selve analysen — luk VideoCoach.
  await frame.locator('#closeBtn').click()
  await page.locator('iframe[title="VideoCoach"]').waitFor({ state: 'hidden', timeout: 10000 })
  await page.locator('[data-home-mere] > summary').waitFor({ state: 'visible', timeout: 10000 })
  await shot('03-tilbage-i-dagens-pas')

  return row
}
