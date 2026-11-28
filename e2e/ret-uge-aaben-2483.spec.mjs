// ORDRE 2483 · atletens aktuelle uge og dagens træning står åbne, så en øvelse rettes med 3 tryk. Lukket uge bliver lukket.
// Koersel: E2E_VITE_PORT=5483 E2E_MOCK_PORT=8983 VITE_SUPABASE_URL=http://127.0.0.1:8983 node e2e/ret-uge-aaben-2483.spec.mjs
import assert from 'node:assert/strict'
import { COACH_USER, buildSeed } from './fixtures.mjs'
import { createMockSupabase } from './mock-supabase.mjs'
import { startVite, launchBrowser, APP_URL, MOCK_PORT } from './harness.mjs'
const mock = createMockSupabase(buildSeed()); await mock.listen(MOCK_PORT)
const vite = await startVite(), browser = await launchBrowser()
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); const page = await ctx.newPage()
  await page.goto(APP_URL); await page.locator('#athlete-auth-email').fill(COACH_USER.email); await page.locator('#athlete-auth-password').fill(COACH_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click(); await page.locator('[data-coach-idag]').waitFor({ timeout: 20000 })
  let tryk = 0; const klik = async l => { tryk++; await l.click() }
  await klik(page.getByRole('button', { name: 'Åbn programmet for Testatlet' }).first())
  await page.getByRole('button', { name: 'Rediger Squat' }).waitFor({ timeout: 8000 })
  await klik(page.getByRole('button', { name: 'Rediger Squat' })); await page.getByLabel('Sæt', { exact: true }).fill('5')
  await klik(page.locator('button').filter({ hasText: /^Gem$/i }).last()); await page.waitForTimeout(800)
  assert.equal(tryk, 3); assert.equal(await page.getByLabel('Sæt', { exact: true }).count(), 0, 'formularen lukker efter Gem')
  await page.getByRole('button', { name: /^UGE 1/i, expanded: true }).first().click(); await page.waitForTimeout(800)
  assert.equal(await page.getByRole('button', { name: 'Rediger Squat' }).count(), 0, 'lukket uge åbnes ikke igen')
  console.log('ret-uge-aaben-2483: OK, 3 tryk til en rettet øvelse')
} catch (e) { console.error(e); process.exitCode = 1 } finally { await browser.close().catch(() => {}); await vite.stop().catch(() => {}); await mock.close().catch(() => {}) }
