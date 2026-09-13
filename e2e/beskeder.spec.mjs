// ORDRE 155 · commit 4 — beskeder: atlet sender → coach ser ulæst-tæller og
// svarer → atleten ser svaret. Kort, som ordren beder om. Hver funktion er en
// frisk login (samme princip som resten af ordre 155's specs) — enklere og
// mere robust end at dele browserside-tilstand på tværs af specs.

import assert from 'node:assert/strict'
import { join } from 'node:path'
import { ATHLETE_USER, COACH_USER } from './fixtures.mjs'

export async function sendAthleteMessage(page, { appUrl, outDir, text }) {
  const shot = (name) => page.screenshot({ path: join(outDir, `beskeder-${name}.png`), fullPage: true })
  await page.goto(appUrl)
  await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
  await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  await page.getByText('Mit program').waitFor({ state: 'visible', timeout: 15000 })

  await page.getByRole('button', { name: /Beskeder/ }).click()
  await page.locator('input[placeholder="Skriv en besked til din coach..."]').fill(text)
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await page.getByText(text, { exact: true }).waitFor({ state: 'visible', timeout: 10000 })
  await shot('01-atlet-sender')
}

export async function coachRepliesToMessage(page, { appUrl, outDir, athleteText, replyText }) {
  const shot = (name) => page.screenshot({ path: join(outDir, `beskeder-${name}.png`), fullPage: true })
  await page.goto(appUrl)
  await page.locator('#athlete-auth-email').fill(COACH_USER.email)
  await page.locator('#athlete-auth-password').fill(COACH_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  await page.getByRole('button', { name: /Testatlet.*Uge/ }).click()

  // Ulæst-tæller på Beskeder-fanen, FØR den åbnes.
  const badge = page.getByRole('button', { name: /Beskeder/ }).locator('span').last()
  await badge.waitFor({ state: 'visible', timeout: 10000 })
  assert.equal((await badge.textContent()).trim(), '1', 'Beskeder-fanen skal vise ulæst-tælleren 1')
  await shot('02-coach-ulaest-taeller')

  await page.getByRole('button', { name: /Beskeder/ }).click()
  await page.getByText(athleteText, { exact: true }).waitFor({ state: 'visible', timeout: 10000 })
  await page.locator('input[placeholder="Skriv en besked..."]').fill(replyText)
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await page.getByText(replyText, { exact: true }).waitFor({ state: 'visible', timeout: 10000 })
  await shot('03-coach-svarer')
}

// AthleteView.jsx henter kun beskeder når fanen ÅBNES (ingen polling/realtime,
// se useEffect på tab==='beskeder') — et frisk login+fane-åbning er derfor det
// ærlige billede af "atleten ser svaret", ikke en antagelse om live-opdatering.
export async function athleteSeesReply(page, { appUrl, outDir, replyText }) {
  const shot = (name) => page.screenshot({ path: join(outDir, `beskeder-${name}.png`), fullPage: true })
  await page.goto(appUrl)
  await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
  await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  await page.getByRole('button', { name: /Beskeder/ }).click()
  await page.getByText(replyText, { exact: true }).waitFor({ state: 'visible', timeout: 15000 })
  await shot('04-atlet-ser-svar')
}
