// ORDRE 373 — headless skærmbilleder af atletens hovedskærme på 390 px mod
// den ægte, ubyggede app (vite) og e2e-mocken (e2e/mock-supabase.mjs +
// e2e/fixtures.mjs's buildSeed, samme som e2e:rolig-forside/e2e:atlet).
// Kun seedens egne syntetiske data — ingen atletdata. Ét ekstra felt sættes
// i seeden: en stævnedato, så Stævne-fanen også kommer med.
// Kørsel (samme dag før og efter, datoen står på skærmen):
//   node outputs/373/skaermbilleder.mjs foer|efter
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { ATHLETE_USER, buildSeed } from '../../e2e/fixtures.mjs'

const FASE = process.argv[2]
if (!['foer', 'efter'].includes(FASE)) { console.error('brug: foer|efter'); process.exit(2) }
const OUT = join(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), FASE)
mkdirSync(OUT, { recursive: true })

async function settle(page) {
  await page.waitForFunction(() => !document.body.innerText.includes('Indlæser…'), null, { timeout: 15000 })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(1200)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(200)
}

async function main() {
  const { createMockSupabase } = await import('../../e2e/mock-supabase.mjs')
  const { startVite, launchBrowser, APP_URL, MOCK_PORT } = await import('../../e2e/harness.mjs')
  const seed = buildSeed({ withMeasuredVideo: true })
  seed.tables.athletes[0].competition_date = '2026-12-05'
  const mock = createMockSupabase(seed)
  await mock.listen(MOCK_PORT)
  const vite = await startVite()
  const browser = await launchBrowser()
  const errors = []
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
    const page = await context.newPage()
    page.on('pageerror', err => errors.push(String(err)))
    const shot = async (name, fullPage = false) => {
      await page.screenshot({ path: join(OUT, `${name}.png`), fullPage, animations: 'disabled', caret: 'hide' })
      console.log(`${FASE}/${name}.png`)
    }
    const nav = label => page.locator('nav button', { hasText: label }).click()

    await page.goto(APP_URL)
    await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
    await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
    await page.getByRole('button', { name: 'Log ind' }).click()
    await page.getByText('Dagens pas', { exact: true }).waitFor({ state: 'visible', timeout: 20000 })
    await settle(page)
    await shot('01-forside')
    await page.getByRole('button', { name: 'Mere', exact: true }).click()
    await settle(page)
    await shot('02-forside-mere', true)

    for (const [i, label] of [['03', 'Program'], ['04', 'Volumen'], ['05', 'Fremgang'], ['06', 'Kost'], ['07', 'Mobilitet'], ['08', 'Beskeder'], ['09', 'Stævne']]) {
      await nav(label)
      await settle(page)
      await shot(`${i}-${label.toLowerCase().replace('æ', 'ae')}`, true)
    }

    // Program med dagens session åben (samme vej som et tryk i ugestrimlen).
    await nav('Hjem')
    await settle(page)
    await page.locator('[data-dagstrimmel] button[data-vist="ja"]').click()
    await settle(page)
    await shot('10-program-session-aaben', true)

    // Onboarding-guiden (genåbnet fra kontomenuen).
    await nav('Hjem')
    await settle(page)
    await page.getByRole('button', { name: 'Konto', exact: true }).click()
    await page.getByRole('button', { name: 'Se guiden igen', exact: true }).click()
    await settle(page)
    await shot('11-guide')

    await context.close()
    if (errors.length) console.log('pageerror:', errors)
  } finally {
    await browser.close()
    await vite.stop()
    await mock.close()
  }
}

main().catch(err => { console.error('FEJL:', err.message); process.exitCode = 1 })
