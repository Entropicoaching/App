// ORDRE 2485 · Oversigt (Dagsform) er en fast fane paa atletprofilen: 2 tryk fra forsiden (foer 3), 390 og 1280 px.
// Koersel: E2E_VITE_PORT=5485 E2E_MOCK_PORT=8985 VITE_SUPABASE_URL=http://127.0.0.1:8985 node e2e/dagsform-fane-2485.spec.mjs
import assert from 'node:assert/strict'
import { COACH_USER, buildSeed } from './fixtures.mjs'
import { createMockSupabase } from './mock-supabase.mjs'
import { startVite, launchBrowser, APP_URL, MOCK_PORT } from './harness.mjs'
const mock = createMockSupabase(buildSeed()); await mock.listen(MOCK_PORT)
const vite = await startVite(), browser = await launchBrowser()
try {
  for (const [bredde, hoejde] of [[390, 844], [1280, 800]]) {
    const ctx = await browser.newContext({ viewport: { width: bredde, height: hoejde } }); const page = await ctx.newPage()
    await page.goto(APP_URL); await page.locator('#athlete-auth-email').fill(COACH_USER.email); await page.locator('#athlete-auth-password').fill(COACH_USER.password)
    await page.getByRole('button', { name: 'Log ind' }).click(); await page.locator('[data-coach-idag]').waitFor({ timeout: 20000 })
    let tryk = 0; const klik = async l => { tryk++; await l.click() }
    await klik(page.getByRole('button', { name: 'Åbn programmet for Testatlet' }).first())
    await page.getByRole('button', { name: 'Rediger Squat' }).waitFor({ timeout: 8000 })
    const fane = page.getByRole('button', { name: /Oversigt/ }).first()
    await fane.waitFor({ timeout: 5000 }); await klik(fane); await page.waitForTimeout(800)
    assert.equal(tryk, 2, `Oversigt hoejst 2 tryk ved ${bredde} px`)
    assert.equal(await page.getByRole('button', { name: 'Rediger Squat' }).count(), 0, 'Oversigt har erstattet Program')
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `intet vandret overloeb ved ${bredde} px`)
    await page.screenshot({ path: `${process.env.BILLED_MAPPE || '.'}/oversigt-fane-2485-${bredde}.png` })
    console.log(`dagsform-fane-2485: ${bredde} px OK, ${tryk} tryk`); await ctx.close()
  }
} catch (e) { console.error(e); process.exitCode = 1 } finally { await browser.close().catch(() => {}); await vite.stop().catch(() => {}); await mock.close().catch(() => {}) }
