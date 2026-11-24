// ORDRE 155 · commit 3 — "det der går galt". To scenarier fra
// STILLE-FEJL-5 (G14-G16) og ordre 41's skrive-kø, klikket igennem i den
// ægte app: et sæt logget uden net (aldrig dobbelt-række), og en afvist
// videoupload (prøv igen virker). Fejlene injiceres i mocken
// (e2e/mock-supabase.mjs's /__e2e/fault), ikke i appen.

import assert from 'node:assert/strict'
import { join } from 'node:path'
import { ATHLETE_USER, ATHLETE_ID, EXERCISE_ID } from './fixtures.mjs'
import { ensureCoachSporingClip } from './harness.mjs'
import { filmSaetUpTilDone } from './athlete-film-et-saet.mjs'

async function loginAsAthlete(page, appUrl) {
  await page.goto(appUrl)
  await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
  await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  // Entropi 2 (ordre 2069): Hjem har "Start dagens pas" og "Mere i dag" i stedet for "Mere"/"Mit program".
  await page.locator('[data-home-mere] > summary').waitFor({ state: 'visible', timeout: 15000 })
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
  const spring = page.getByRole('button', { name: /Spring guiden over/ })
  if (await spring.count()) await spring.first().click()
  await page.getByRole('button', { name: /^Start (dagens|næste) pas$/ }).first().click()
  await page.getByText(`Sæt ${setNum} af 4`, { exact: true }).waitFor({ state: 'visible', timeout: 10000 })

  // Uden net lander sættet i den lokale kø (localStorage) og må ikke gå tabt; med net igen sendes det præcis én gang.
  const queueKey = `entropi_offline_sets:${ATHLETE_ID}`
  await page.context().setOffline(true)
  await page.locator('[data-field="weight"]').fill('80')
  await page.locator('[data-field="reps"]').fill('4')
  await page.getByRole('button', { name: /^(Godkendt|Som planlagt|Som sidste sæt)$/ }).first().click()
  await page.waitForFunction(k => Object.keys(JSON.parse(localStorage.getItem(k) || '{}')).length > 0, queueKey, { timeout: 15000 })
  await shot('01-offline-fejl')

  await page.context().setOffline(false)
  await page.reload()
  await page.locator('[data-home-mere] > summary').waitFor({ state: 'visible', timeout: 15000 })
  for (let i = 0; i < 75; i++) {
    const rows = await readTable(mockUrl, 'exercise_logs')
    if (rows.filter(r => r.exercise_id === EXERCISE_ID && r.set_number === 4).length >= 1) break
    await page.waitForTimeout(200)
  }
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
  const clipPath = ensureCoachSporingClip('glat').path

  await loginAsAthlete(page, appUrl)
  await injectFault(mockUrl, { pathPrefix: '/rest/v1/video_analyses', method: 'POST', mode: '500', times: 1 })

  // Entropi 2: "Film et sæt til videocoach" ligger under "Mere i dag" på Hjem.
  const mereIDag = page.locator('[data-home-mere]')
  if (!(await mereIDag.evaluate(el => el.open))) await mereIDag.locator('> summary').click()
  await page.locator('[data-film-set]').first().click()

  const frame = page.frameLocator('iframe[title="VideoCoach"]')
  // Entropi 2: film-vejen analyserer klippet og sender med "Send video til coach"; afvisningen vises i #vcUploadRetryStatus med "Prøv igen".
  const state = await filmSaetUpTilDone(frame, page, clipPath, name => shot(`film-${name}`))
  assert.equal(state, 'done', 'analysen blev ikke færdig: ' + state)
  await frame.locator('#athleteInstantSaveBtn').click()

  const panel = frame.locator('#vcUploadRetryStatus')
  await panel.getByText(/^Ikke sendt/).waitFor({ state: 'visible', timeout: 30000 })
  await shot('03-upload-afvist')

  const beforeRetryCount = (await readTable(mockUrl, 'video_analyses'))
    .filter(r => r.athlete_id === ATHLETE_ID).length

  await panel.getByRole('button', { name: 'Prøv igen' }).click()

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
