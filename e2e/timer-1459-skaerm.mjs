// Hjaelper til ordre 1459: skaermbilleder af Dagens pas-flowet (mock, 390 bredde).
// Brug: node e2e/timer-1459-skaerm.mjs <udmappe> <praefiks>
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { ATHLETE_USER, buildSeed } from './fixtures.mjs'
const [,, outDir, prefix = 'foer'] = process.argv
mkdirSync(outDir, { recursive: true })
const { createMockSupabase } = await import('./mock-supabase.mjs')
const { startVite, launchBrowser, APP_URL, MOCK_PORT } = await import('./harness.mjs')
const vite = await startVite(); const browser = await launchBrowser()
const mock = createMockSupabase(buildSeed()); await mock.listen(MOCK_PORT)
try {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
  const shot = (n, full) => page.screenshot({ path: join(outDir, `${prefix}-${n}.png`), fullPage: !!full })
  await page.goto(APP_URL)
  await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
  await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  await page.getByText('Dagens pas', { exact: true }).waitFor({ state: 'visible', timeout: 15000 })
  await shot('1-dagens-pas'); await shot('1b-hele-siden', true)
  await page.getByRole('button', { name: 'Godkendt', exact: true }).click()
  await page.getByTestId('rest-pause-open').waitFor({ timeout: 5000 }).catch(() => {})
  await shot('2-efter-godkendt')
  await page.getByTestId('rest-pause-open').click().catch(() => {})
  await shot('3-popup')
} finally { await browser.close(); await mock.close(); await vite.stop() }
