// ORDRE 155 · commit 3 — "det der går galt". To scenarier fra
// STILLE-FEJL-5 (G14-G16) og ordre 41's skrive-kø, klikket igennem i den
// ægte app: et sæt logget uden net (aldrig dobbelt-række), og en afvist
// videoupload (prøv igen virker). Fejlene injiceres i mocken
// (e2e/mock-supabase.mjs's /__e2e/fault), ikke i appen.

import assert from 'node:assert/strict'
import { join } from 'node:path'
import { ATHLETE_USER, ATHLETE_ID, EXERCISE_ID } from './fixtures.mjs'
import { ensureSyntheticClip } from './harness.mjs'

async function loginAsAthlete(page, appUrl) {
  await page.goto(appUrl)
  await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
  await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  // "Mit program" ligger bag folden "Mere" siden ORDRE 330.
  await page.getByRole('button', { name: 'Mere', exact: true }).click({ timeout: 15000 })
  await page.getByText('Mit program').waitFor({ state: 'visible', timeout: 15000 })
}

async function readTable(mockUrl, name) {
  const res = await fetch(`${mockUrl}/__e2e/table?name=${encodeURIComponent(name)}`)
  return res.json()
}
async function injectFault(mockUrl, { pathPrefix, method = 'POST', mode = '500', times = 1 }) {
  await fetch(`${mockUrl}/__e2e/fault`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pathPrefix, method, mode, times }),
  })
}

// Egen, frisk login + navigation — sæt 4 på Squat er bevidst det eneste
// ulogget sæt i seeden (se fixtures.mjs), uanset hvad andre specs har logget.
export async function runOfflineSetLog(page, { appUrl, mockUrl, outDir }) {
  const shot = (name) => page.screenshot({ path: join(outDir, `fejl-${name}.png`), fullPage: true })
  const setNum = 4

  await loginAsAthlete(page, appUrl)
  await page.getByText('Dag 1 — Squat', { exact: true }).click()
  await page.getByLabel(`Vægt, sæt ${setNum}`).waitFor({ state: 'visible', timeout: 10000 })

  await page.context().setOffline(true)
  await page.getByLabel(`Vægt, sæt ${setNum}`).fill('80')
  await page.getByLabel(`Reps, sæt ${setNum}`).fill('4')
  await page.getByRole('button', { name: 'Log', exact: true }).first().click()

  // Besked på skærmen: queueWrite's fire forsøg (se src/supabase.js) løber
  // hurtigt tør uden net — ingen kunstig 12s-ventetid nødvendig her.
  await page.getByText('Fejl — prøv igen').waitFor({ state: 'visible', timeout: 15000 })
  await shot('01-offline-fejl')

  await page.context().setOffline(false)
  await page.getByRole('button', { name: 'Log', exact: true }).first().click()
  await page.waitForFunction(
    async ([url, exId]) => {
      const res = await fetch(`${url}/__e2e/table?name=exercise_logs`)
      const rows = await res.json()
      return rows.filter(r => r.exercise_id === exId && r.set_number === 4).length >= 1
    },
    [mockUrl, EXERCISE_ID],
    { timeout: 15000 },
  )
  await shot('02-online-igen-gemt')

  const logs = await readTable(mockUrl, 'exercise_logs')
  const set4 = logs.filter(l => l.exercise_id === EXERCISE_ID && l.set_number === 4)
  assert.equal(set4.length, 1, `sæt 4 skal findes ÉN gang efter offline+retry, fandt ${set4.length}`)
  assert.equal(set4[0].reps_completed, 4)
}

// Uafhængig af ovenstående — egen video-upload med en injiceret 500 på
// video_analyses-indsættelsen (selve storage-uploaden lykkes, kun rækken
// mangler første gang, jf. kommentaren i src/AthleteView.jsx's upload-and-go).
export async function runRejectedUploadRetry(page, { appUrl, mockUrl, outDir }) {
  const shot = (name) => page.screenshot({ path: join(outDir, `fejl-${name}.png`), fullPage: true })
  const clipPath = ensureSyntheticClip()

  await loginAsAthlete(page, appUrl)
  await injectFault(mockUrl, { pathPrefix: '/rest/v1/video_analyses', method: 'POST', mode: '500', times: 1 })

  await page.getByText('VideoCoach', { exact: true }).click()
  const frame = page.frameLocator('iframe[title="VideoCoach"]')
  await frame.locator('body.athlete').waitFor({ state: 'attached', timeout: 10000 })
  await frame.locator('#fileInput').setInputFiles(clipPath)
  await frame.locator('#athleteSubmitSheet[hidden]').waitFor({ state: 'detached', timeout: 15000 })
  await frame.locator('#liftSel').selectOption({ label: 'Squat' })
  await frame.locator('#saveBtn').click()

  await frame.locator('#saveBtn', { hasText: 'Prøv at sende igen' }).waitFor({ state: 'visible', timeout: 15000 })
  await shot('03-upload-afvist')

  const beforeRetryCount = (await readTable(mockUrl, 'video_analyses'))
    .filter(r => r.athlete_id === ATHLETE_ID).length

  await frame.locator('#saveBtn').click()
  await page.waitForFunction(
    async ([url, athleteId, before]) => {
      const res = await fetch(`${url}/__e2e/table?name=video_analyses`)
      const rows = await res.json()
      return rows.filter(r => r.athlete_id === athleteId).length > before
    },
    [mockUrl, ATHLETE_ID, beforeRetryCount],
    { timeout: 15000 },
  )
  await shot('04-prov-igen-lykkedes')

  const rows = await readTable(mockUrl, 'video_analyses')
  assert.equal(rows.filter(r => r.athlete_id === ATHLETE_ID).length, beforeRetryCount + 1,
    'præcis én ny video_analyses-række skal findes efter "prøv igen" — ikke to')

  await frame.locator('#closeBtn').click()
  await page.locator('iframe[title="VideoCoach"]').waitFor({ state: 'hidden', timeout: 10000 })
}
