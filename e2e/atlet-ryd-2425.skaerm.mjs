// ORDRE 2425: maaling og foer/efter-billeder af Hjem og Program (traeningsatlet, 390x844, lys og moerk).
// Kør: E2E_VITE_PORT=5425 E2E_MOCK_PORT=8925 VITE_SUPABASE_URL=http://127.0.0.1:8925 node e2e/atlet-ryd-2425.skaerm.mjs <mappe> <foer|efter>
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ATHLETE_USER, buildSeed, kostPakkeTilAtlet } from './fixtures.mjs'

const OUT = process.argv[2] || 'outputs/_seneste/2425'
const PREFIX = process.argv[3] || 'foer'
mkdirSync(OUT, { recursive: true })

async function tab(page, name) {
  await page.getByRole('button', { name, exact: true }).first().evaluate(el => el.click())
  await page.waitForTimeout(1000)
}
async function kor(browser, createMockSupabase, MOCK_PORT, APP_URL, tema) {
  const s = buildSeed({ withLogs: true }); kostPakkeTilAtlet(s.tables)
  const mock = createMockSupabase(s); await mock.listen(MOCK_PORT)
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
  const maal = {}
  try {
    const page = await ctx.newPage()
    page.on('pageerror', err => console.error('[pageerror]', tema, err.message))
    await page.addInitScript(([t]) => {
      try { localStorage.setItem('entropi:tema', t) } catch {}
      try { Object.defineProperty(Notification, 'permission', { get: () => 'default' }) } catch {}
    }, [tema])
    await page.goto(APP_URL)
    await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
    await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
    await page.getByRole('button', { name: 'Log ind' }).click()
    await page.getByRole('button', { name: 'Hjem', exact: true }).first().waitFor({ state: 'attached', timeout: 25000 })
    await page.waitForTimeout(1500)
    const skip = page.getByRole('button', { name: /Spring over/ })
    if (await skip.count()) { await skip.first().evaluate(el => el.click()); await page.waitForTimeout(400) }
    for (const f of ['Hjem', 'Program']) {
      await tab(page, f)
      const tekst = await page.locator('body').innerText()
      maal[f] = f === 'Hjem'
        ? { dagensPas: /Dagens pas/.test(tekst), iDagTraening: await page.locator('[data-u5-training]').count(),
          mangler: (tekst.match(/Mangler i dag[^\n]*/) || [''])[0] }
        : { raekkefoelge: ['Uge ', 'Din blok', 'Base', 'Næste pas', 'Squat'].map(t => [t, tekst.indexOf(t)]), tekst: tekst.slice(0, 1500) }
      await page.screenshot({ path: join(OUT, `${PREFIX}-tr-${tema}-${f.toLowerCase()}.png`), fullPage: true })
      if (f === 'Program' && await page.locator('[data-program-blok-samlet]').count()) {
        await page.evaluate(() => document.querySelectorAll('[data-program-blok-samlet], [data-program-blok-samlet] details').forEach(d => { d.open = true }))
        await page.waitForTimeout(400)
        maal.blokAaben = await page.locator('[data-program-blok-samlet]').innerText()
        await page.screenshot({ path: join(OUT, `${PREFIX}-tr-${tema}-program-blok-aaben.png`), fullPage: true })
      }
    }
  } finally { await ctx.close(); await mock.close().catch(() => {}) }
  return maal
}
const { createMockSupabase } = await import('./mock-supabase.mjs')
const { startVite, launchBrowser, APP_URL, MOCK_PORT } = await import('./harness.mjs')
const vite = await startVite(); const browser = await launchBrowser()
try {
  const res = {}
  for (const t of ['lys', 'moerk']) res[t] = await kor(browser, createMockSupabase, MOCK_PORT, APP_URL, t)
  writeFileSync(join(OUT, `${PREFIX}-maal.json`), JSON.stringify(res, null, 2))
  console.log(JSON.stringify(res, null, 1))
} catch (e) { console.error(e); process.exitCode = 1 }
finally { await browser.close().catch(() => {}); await vite.stop().catch(() => {}) }
