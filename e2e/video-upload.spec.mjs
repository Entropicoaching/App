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
import { ensureSyntheticClip } from './harness.mjs'

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
  const clipPath = clipOverride || ensureSyntheticClip()

  if (loginNeeded) {
    await page.goto(appUrl)
    await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
    await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
    await page.getByRole('button', { name: 'Log ind' }).click()
    await page.getByRole('button', { name: 'Mere', exact: true }).waitFor({ state: 'visible', timeout: 15000 })
  }
  // VideoCoach-kortet ligger bag folden "Mere" siden ORDRE 330.
  if (await page.getByRole('button', { name: 'Mere', exact: true }).getAttribute('aria-expanded') !== 'true') {
    await page.getByRole('button', { name: 'Mere', exact: true }).click()
  }

  await page.getByText('VideoCoach', { exact: true }).click()
  const frame = page.frameLocator('iframe[title="VideoCoach"]')
  // #fileInput er attached fra selve HTML'en med det samme — men videocoach.html
  // er ét kæmpe inline-script, og onchange-lytteren først bindes når det er
  // færdigkørt. body.athlete sættes til allersidst i ATHLETE-opsætningen
  // (se public/videocoach.html), så at vente på DEN her er det pålidelige
  // signal om at fileInput's onchange rent faktisk er klar.
  await frame.locator('body.athlete').waitFor({ state: 'attached', timeout: 10000 })
  await frame.locator('#fileInput').setInputFiles(clipPath)

  // "Send videoen"-arket åbner automatisk for en atlet, når videoens metadata
  // er klar (se videocoach.html's begin()/setAthleteSubmitOpen) — ingen
  // sporing kræves på standardvejen.
  await frame.locator('#athleteSubmitSheet[hidden]').waitFor({ state: 'detached', timeout: 15000 })
  await frame.locator('#liftSel').selectOption({ label: liftLabel })
  await shot('01-sendeark')
  await frame.locator('#saveBtn').click()

  await page.waitForFunction(
    async ([url, athleteId]) => {
      const res = await fetch(`${url}/__e2e/table?name=video_analyses`)
      const rows = await res.json()
      return rows.some(r => r.athlete_id === athleteId && r.analysis_state === 'awaiting_analysis')
    },
    [mockUrl, ATHLETE_ID],
    { timeout: 20000 },
  )
  await shot('02-sendt')

  const analyses = await readTable(mockUrl, 'video_analyses')
  const row = analyses.find(r => r.athlete_id === ATHLETE_ID && r.analysis_state === 'awaiting_analysis')
  assert.ok(row, 'video_analyses mangler en awaiting_analysis-række efter upload')
  assert.equal(row.status, 'draft')
  assert.equal(row.source_mode, 'athlete_submission')

  const keys = await readStorageKeys(mockUrl)
  assert.ok(keys.includes(`videocoach-uploads/${row.video_path}`),
    `mock-storage mangler filen for ${row.video_path} (har: ${keys.join(', ')})`)

  // Tilbage i dagens pas uden at vente på selve analysen — luk VideoCoach.
  await frame.locator('#closeBtn').click()
  await page.locator('iframe[title="VideoCoach"]').waitFor({ state: 'hidden', timeout: 10000 })
  await page.getByRole('button', { name: 'Mere', exact: true }).waitFor({ state: 'visible', timeout: 10000 })
  await shot('03-tilbage-i-dagens-pas')

  return row
}
