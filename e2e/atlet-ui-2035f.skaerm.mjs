// ORDRE 2035f: skærmbilleder af atletens skærme ved 390 px, lys og mørk, med og uden kostpakke.
// Egne porte: E2E_VITE_PORT, E2E_MOCK_PORT og VITE_SUPABASE_URL sættes af kalderen.
// Kør: node e2e/atlet-ui-2035f.skaerm.mjs <billedmappe> [praefiks]
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { ATHLETE_USER, buildSeed, kostPakkeTilAtlet } from './fixtures.mjs'

const OUT = process.argv[2] || 'outputs/_seneste/2035f'
const PREFIX = process.argv[3] || 'foer'
mkdirSync(OUT, { recursive: true })

function seedFor(medKost) {
  const seed = buildSeed({ withLogs: true, withAnalyzedVideo: true })
  if (medKost) kostPakkeTilAtlet(seed.tables)
  return seed
}

async function shot(page, name) {
  await page.waitForTimeout(700)
  await page.screenshot({ path: join(OUT, `${PREFIX}-${name}.png`), fullPage: true })
  console.log('billede', name)
}

async function tab(page, name) {
  // Bundmenuen kan ligge under passets faste registreringskort; klik via DOM som en finger ville ramme fanen.
  await page.getByRole('button', { name, exact: true }).first().evaluate(el => el.click())
  await page.waitForTimeout(900)
}

async function kor(browser, createMockSupabase, MOCK_PORT, APP_URL, { tema, medKost }) {
  const mock = createMockSupabase(seedFor(medKost))
  await mock.listen(MOCK_PORT)
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  const tag = `${tema}-${medKost ? 'kost' : 'udenkost'}`
  try {
    const page = await ctx.newPage()
    page.on('pageerror', err => console.error('[pageerror]', tag, err.message))
    await page.addInitScript(([t]) => {
      try { localStorage.setItem('entropi:tema', t) } catch {}
      try { Object.defineProperty(Notification, 'permission', { get: () => 'default' }) } catch {}
    }, [tema])
    await page.goto(APP_URL)
    await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
    await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
    await page.getByRole('button', { name: 'Log ind' }).click()
    await page.getByRole('button', { name: /Start dagens pas|Start næste pas/ }).first().waitFor({ state: 'visible', timeout: 20000 })
    await shot(page, `${tag}-01-hjem-med-intro`)
    const skip = page.getByRole('button', { name: /Spring over/ })
    if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(400) }
    await shot(page, `${tag}-02-hjem`)
    // Mere i dag udfoldet
    const mere = page.locator('[data-home-mere] summary')
    if (await mere.count()) { await mere.first().click(); await shot(page, `${tag}-03-hjem-mere-i-dag`); await mere.first().click() }
    await tab(page, 'Program')
    await shot(page, `${tag}-04-program`)
    await tab(page, 'Hjem')
    const start = page.getByRole('button', { name: /Start dagens pas/ })
    if (await start.count()) {
      await start.first().click()
      await page.getByText(/Sæt 1 af/).first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {})
      await shot(page, `${tag}-05-pas-saet1`)
      const plan = page.getByRole('button', { name: 'Som planlagt', exact: true })
      if (await plan.count()) { await plan.first().click(); await page.waitForTimeout(900); await shot(page, `${tag}-06-pas-efter-saet`) }
    }
    await tab(page, 'Fremgang')
    await shot(page, `${tag}-07-fremgang`)
    if (medKost) {
      await tab(page, 'Kost')
      await shot(page, `${tag}-08-kost`)
    }
    await tab(page, 'Beskeder')
    await shot(page, `${tag}-09-beskeder`)
    await page.getByRole('button', { name: 'Hjem', exact: true }).first().click(); await page.waitForTimeout(500)
    await page.locator('[data-entropi2-bundnav] summary').first().click(); await page.waitForTimeout(400)
    await page.screenshot({ path: join(OUT, `${PREFIX}-${tag}-10-mere-menu.png`), fullPage: false })
    await page.getByRole('button', { name: 'Mobilitet', exact: true }).first().click(); await page.waitForTimeout(1200)
    await shot(page, `${tag}-11-mobilitet`)
    const mig = page.getByRole('button', { name: 'Mig', exact: true })
    if (await mig.count()) { await mig.first().click(); await page.waitForTimeout(800); await shot(page, `${tag}-12-mig`) }
  } finally { await ctx.close(); await mock.close().catch(() => {}) }
}

async function main() {
  const { createMockSupabase } = await import('./mock-supabase.mjs')
  const { startVite, launchBrowser, APP_URL, MOCK_PORT } = await import('./harness.mjs')
  const vite = await startVite(); const browser = await launchBrowser()
  try {
    const varianter = (process.env.SKAERM_VARIANTER || 'moerk-kost,lys-kost,moerk-udenkost,lys-udenkost').split(',')
    for (const v of varianter) {
      const [tema, k] = v.split('-')
      await kor(browser, createMockSupabase, MOCK_PORT, APP_URL, { tema, medKost: k === 'kost' })
    }
  } finally { await browser.close().catch(() => {}); await vite.stop().catch(() => {}) }
}
main().catch(err => { console.error(err); process.exit(1) })
