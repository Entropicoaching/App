// ORDRE 2344: atletvisningen i en runtime uden Object.hasOwn, Array.prototype.at og structuredClone (iOS 15.3 og ældre).
// Egne porte: E2E_VITE_PORT, E2E_MOCK_PORT og VITE_SUPABASE_URL sættes af kalderen.
// Kør: node e2e/gammel-ios-2344.skaerm.mjs <billedmappe> [praefiks]
// Afslutter med kode 1, hvis "Noget gik galt" vises, eller Hjem eller Mobilitet ikke kan ses.
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { ATHLETE_USER, buildSeed } from './fixtures.mjs'

const OUT = process.argv[2] || 'outputs/_seneste/2344'
const PREFIX = process.argv[3] || 'efter'
mkdirSync(OUT, { recursive: true })

function fjernNyereApier() {
  delete Object.hasOwn
  delete Array.prototype.at
  delete String.prototype.at
  delete Array.prototype.findLast
  delete Array.prototype.findLastIndex
  delete Array.prototype.toReversed
  delete globalThis.structuredClone
  try { Object.defineProperty(Notification, 'permission', { get: () => 'default' }) } catch {}
}

async function main() {
  const { createMockSupabase } = await import('./mock-supabase.mjs')
  const { startVite, launchBrowser, APP_URL, MOCK_PORT } = await import('./harness.mjs')
  const vite = await startVite(); const browser = await launchBrowser()
  const mock = createMockSupabase(buildSeed({ withLogs: true }))
  await mock.listen(MOCK_PORT)
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true })
  const fund = []
  try {
    const page = await ctx.newPage()
    page.on('pageerror', err => { console.error('[pageerror]', err.message); fund.push('pageerror: ' + err.message) })
    await page.addInitScript(fjernNyereApier)
    await page.goto(APP_URL)
    const tomt = await page.evaluate(() => [typeof Object.hasOwn, typeof [].at, typeof structuredClone].join(','))
    console.log('API-status efter indlæsning (uden polyfill: undefined,undefined,undefined):', tomt)
    await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
    await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
    await page.getByRole('button', { name: 'Log ind' }).click()
    const hjem = page.getByRole('button', { name: /Start dagens pas|Start næste pas/ }).first()
    const ok = await hjem.waitFor({ state: 'visible', timeout: 15000 }).then(() => true, () => false)
    await page.waitForTimeout(700)
    const galt = async () => (await page.getByText('Noget gik galt').count()) > 0
    await page.screenshot({ path: join(OUT, `${PREFIX}-hjem-390.png`), fullPage: false })
    if (!ok) fund.push('Hjem vises ikke')
    if (await galt()) fund.push('Hjem: Noget gik galt')
    const skip = page.getByRole('button', { name: /Spring over/ })
    if (await skip.count()) { await skip.first().evaluate(el => el.click()); await page.waitForTimeout(400) }
    if (ok) {
      await page.locator('[data-entropi2-bundnav] summary').first().click(); await page.waitForTimeout(400)
      await page.getByRole('button', { name: 'Mobilitet', exact: true }).first().click(); await page.waitForTimeout(1500)
      await page.screenshot({ path: join(OUT, `${PREFIX}-mobilitet-390.png`), fullPage: false })
      if (await galt()) fund.push('Mobilitet: Noget gik galt')
      if (!(await page.getByText(/Mobilitet/).count())) fund.push('Mobilitet vises ikke')
    }
  } finally { await ctx.close(); await mock.close().catch(() => {}); await browser.close().catch(() => {}); await vite.stop().catch(() => {}) }
  console.log(fund.length ? 'FUND: ' + fund.join(' | ') : 'OK: Hjem og Mobilitet vises uden "Noget gik galt"')
  process.exit(fund.length ? 1 : 0)
}
main().catch(err => { console.error(err); process.exit(1) })
