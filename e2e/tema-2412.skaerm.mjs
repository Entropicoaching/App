// ORDRE 2412: billeder ved 390x844 i Chromium: temavalget under Mig, Hjem mørkt, Hjem lyst. Valget System/Mørkt/Lyst gemmes lokalt.
// Kør: E2E_VITE_PORT=5412 E2E_MOCK_PORT=8972 VITE_SUPABASE_URL=http://127.0.0.1:8972 node e2e/tema-2412.skaerm.mjs <mappe>
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { ATHLETE_USER, buildSeed } from './fixtures.mjs'

const OUT = process.argv[2] || 'outputs/_seneste/2412'
mkdirSync(OUT, { recursive: true })

const { createMockSupabase } = await import('./mock-supabase.mjs')
const { startVite, launchBrowser, APP_URL, MOCK_PORT } = await import('./harness.mjs')
const vite = await startVite(); const browser = await launchBrowser()
const mock = createMockSupabase(buildSeed({ withLogs: true })); await mock.listen(MOCK_PORT)
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, colorScheme: 'light' })
try {
  const page = await ctx.newPage()
  page.on('pageerror', err => console.error('[pageerror]', err.message))
  await page.addInitScript(() => { try { Object.defineProperty(Notification, 'permission', { get: () => 'default' }) } catch {} })
  await page.goto(APP_URL)
  await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
  await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  await page.getByRole('button', { name: 'Hjem', exact: true }).first().waitFor({ state: 'attached', timeout: 25000 })
  await page.waitForTimeout(1500)
  const skip = page.getByRole('button', { name: /Spring over/ })
  if (await skip.count()) { await skip.first().evaluate(el => el.click()); await page.waitForTimeout(400) }
  const tema = () => page.evaluate(() => ({ attr: document.documentElement.getAttribute('data-tema'), gemt: localStorage.getItem('entropi:tema') }))
  const hjemBillede = async navn => {
    await page.getByRole('button', { name: 'Hjem', exact: true }).first().evaluate(el => el.click()); await page.waitForTimeout(800)
    await page.screenshot({ path: join(OUT, navn), fullPage: false })
  }
  console.log('start (standard)', await tema())
  await page.getByRole('button', { name: 'Mig', exact: true }).first().evaluate(el => el.click()); await page.waitForTimeout(800)
  const valg = page.locator('[data-tema-valg]').first()
  await valg.scrollIntoViewIfNeeded()
  await page.screenshot({ path: join(OUT, '1-valget.png'), fullPage: false })
  await valg.locator('[data-tema-knap="moerk"]').click(); await page.waitForTimeout(300)
  console.log('moerk', await tema())
  await page.screenshot({ path: join(OUT, '1-valget-moerk.png'), fullPage: false })
  await valg.locator('[data-tema-knap="lys"]').click(); await page.waitForTimeout(300)
  console.log('lys', await tema())
  await valg.locator('[data-tema-knap="system"]').click(); await page.waitForTimeout(300)
  console.log('system (telefon lys)', await tema())
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.reload(); await page.getByRole('button', { name: 'Hjem', exact: true }).first().waitFor({ state: 'attached', timeout: 25000 })
  console.log('system efter genindlaesning (telefon moerk)', await tema())
  // Hjem mørkt og lyst
  await page.getByRole('button', { name: 'Mig', exact: true }).first().evaluate(el => el.click()); await page.waitForTimeout(800)
  await page.locator('[data-tema-knap="moerk"]').click(); await page.waitForTimeout(300)
  await page.getByRole('button', { name: /Luk|Tilbage/ }).first().evaluate(el => el.click()).catch(() => {})
  await hjemBillede('2-hjem-moerk.png')
  await page.getByRole('button', { name: 'Mig', exact: true }).first().evaluate(el => el.click()); await page.waitForTimeout(800)
  await page.locator('[data-tema-knap="lys"]').click(); await page.waitForTimeout(300)
  await page.getByRole('button', { name: /Luk|Tilbage/ }).first().evaluate(el => el.click()).catch(() => {})
  await hjemBillede('3-hjem-lys.png')
  await page.reload(); await page.waitForTimeout(1500)
  console.log('lys efter genindlaesning', await tema())
} catch (e) { console.error(e); process.exitCode = 1 }
finally { await ctx.close(); await mock.close().catch(() => {}); await browser.close().catch(() => {}); await vite.stop().catch(() => {}) }
