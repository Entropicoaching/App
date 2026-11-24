// ORDRE 2140 (kontrol 2135 forbehold B): når skiven foreslås fra sidste gang (vcPriorSetup, plateConfirm.suggested),
// starter analysen ikke af sig selv i "Film et sæt"; atleten kan rette ringen og trykker selv Start. Uden forslag
// starter den stadig selv (se video-send-2120). Syntetisk klip, mock, ingen nøgler.
//
// Kørsel: node e2e/video-forslag-2140.spec.mjs  (VITE_SUPABASE_URL=http://127.0.0.1:8991 på egne porte)

import assert from 'node:assert/strict'
import { createMockSupabase } from './mock-supabase.mjs'
import { buildSeed, ATHLETE_USER } from './fixtures.mjs'
import { startVite, launchBrowser, APP_URL, MOCK_PORT, ensureCoachSporingClip } from './harness.mjs'
import { CLICK_AT_S } from './athlete-film-et-saet.mjs'
import { truePos, W as VIDEO_W, H as VIDEO_H } from '../scripts/make-test-clip.mjs'

async function main() {
  const { path: clipPath } = ensureCoachSporingClip('glat')
  const mock = createMockSupabase(buildSeed({}))
  await mock.listen(MOCK_PORT)
  const vite = await startVite()
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await page.goto(APP_URL)
    await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
    await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
    await page.getByRole('button', { name: 'Log ind' }).click()
    await page.getByText('Mere i dag', { exact: true }).click()
    await page.getByText('Film et sæt til videocoach', { exact: true }).click()
    const frame = page.frameLocator('iframe[title="VideoCoach"]')
    await frame.locator('body.athlete').waitFor({ state: 'attached', timeout: 10000 })
    await frame.locator('#fileInput').setInputFiles(clipPath)
    await frame.locator('body[data-athlete-state="ready"]').waitFor({ state: 'attached', timeout: 15000 })
    await frame.locator('#vcAthleteLift').selectOption({ label: 'Squat' })
    await frame.locator('video').first().evaluate((v, t) => new Promise(resolve => {
      v.addEventListener('seeked', resolve, { once: true }); v.currentTime = t
    }), CLICK_AT_S)
    await frame.locator('#athleteMarkStartBtn').click()
    const canvas = frame.locator('#canvas')
    await canvas.waitFor({ state: 'visible', timeout: 10000 })
    await page.waitForTimeout(800)
    // Et forslag fra sidste analyse af samme atlet og løft (hentes ellers via bridgen).
    await frame.locator('body').evaluate(() => { vcPriorSetup = { cmPerPx: 0.05 } })
    const box = await canvas.boundingBox()
    const target = truePos(CLICK_AT_S)
    await canvas.click({ position: { x: target.x * box.width / VIDEO_W, y: target.y * box.height / VIDEO_H } })
    await page.waitForTimeout(3000)
    const state = await frame.locator('body').getAttribute('data-athlete-state')
    assert.equal(state, 'confirm', `forslag fra sidste gang skal vente på atletens Start, tilstand: ${state}`)

    await frame.locator('#allBtn').click()
    let after = null
    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(1000)
      after = await frame.locator('body').getAttribute('data-athlete-state')
      if (after === 'done' || after === 'error') break
    }
    assert.notEqual(after, 'confirm', 'Start efter forslaget skulle køre analysen')
    console.log(`\nGRØN: forslag fra sidste gang venter i 'confirm'; Start kører analysen (tilstand bagefter: ${after}).`)
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

if (process.argv[1] && process.argv[1].endsWith('video-forslag-2140.spec.mjs')) main()
