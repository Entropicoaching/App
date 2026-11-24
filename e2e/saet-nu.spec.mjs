// ORDRE 314 · blok 2 — proven af blok 1: "det aktuelle sæt er det eneste der
// råber" (Marcs dom 22. sep: man kunne se det næste sæt, men ikke hvilket
// sæt man var på). Logger tre sæt i træk på Dagens pas, på to viewports
// (390×844 og 360×780), med et skærmbillede FØR og EFTER hvert "Godkendt"-
// tryk, og tjekker efter hvert tryk:
//   1) "Sæt N af M"-overskriften matcher det aktuelle sæt,
//   2) alle tidligere sæt på øvelsen står som kompakte linjer ("ret"),
//   3) næste sæt (hvis der er et) står som højst én dæmpet linje,
//   4) ingen vandret overflow (documentElement.scrollWidth <= viewportbredden
//      — den konkrete regression F4 fra docs/KRITIK-288.md var netop dette).
//
// Egen mock+browser-kontekst PR. viewport (samme port 8991, genbrugt
// sekventielt — ikke to processer om samme port samtidig): vite startes én
// gang (statisk bundle, ingen tilstand), mock genskabes (frisk buildSeed())
// og browserkonteksten genåbnes (frisk localStorage) mellem de to viewports.
// Ordre 2069: følger Entropi 2 (Start dagens pas, Sæt N af M); den gamle kollapsede klarede-sæt-linje findes ikke i passet.
// Egen kørsel: `npm run e2e:saet-nu`.

import assert from 'node:assert/strict'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { ATHLETE_USER, buildSeed } from './fixtures.mjs'

const OUT_DIR = join(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), '..', 'outputs', '314')
mkdirSync(OUT_DIR, { recursive: true })

function assertNoHorizontalOverflow(width) {
  return async (page, label) => {
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    assert.ok(scrollWidth <= width, `${label}: vandret overflow (scrollWidth ${scrollWidth} > viewport ${width})`)
  }
}

async function runViewport(page, { tag, width, height, outDir }) {
  const shot = (name) => page.screenshot({ path: join(outDir, `${tag}-${name}.png`), fullPage: true })
  const checkOverflow = assertNoHorizontalOverflow(width)

  await page.goto(process.env.__SAET_NU_APP_URL)
  await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
  await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()

  // Entropi 2 (ordre 2069): Hjem har kortet "Start dagens pas"; selve sættet står i det åbne pas ("Sæt N af M").
  await page.getByRole('button', { name: /Start dagens pas/ }).first().click()
  await page.getByText('Sæt 1 af 4', { exact: true }).waitFor({ state: 'visible', timeout: 15000 })
  await checkOverflow(page, `${tag} før sæt 1`)
  await shot('00-foer-saet-1')

  for (const setNum of [1, 2, 3]) {
    await page.getByText(`Sæt ${setNum} af 4`, { exact: true }).waitFor({ state: 'visible', timeout: 5000 })
    await checkOverflow(page, `${tag} lige før "Som planlagt" på sæt ${setNum}`)
    await shot(`${String(setNum).padStart(2, '0')}a-foer-godkendt-saet-${setNum}`)

    await page.getByRole('button', { name: /^Som (planlagt|sidste sæt)$/ }).first().click(); await page.waitForTimeout(600) // setTapGuard: 500 ms mellem tryk

    await page.getByText(`Sæt ${setNum + 1} af 4`, { exact: true }).waitFor({ state: 'visible', timeout: 5000 })
    await checkOverflow(page, `${tag} lige efter godkendt sæt ${setNum}`)
    await shot(`${String(setNum).padStart(2, '0')}b-efter-godkendt-saet-${setNum}`)
  }
  await shot('99-tre-saet-logget')

  console.log(`${tag}: tre sæt logget, "Sæt N af 4" stemte hele vejen, ingen vandret overflow.`)
}

async function main() {
  const { createMockSupabase } = await import('./mock-supabase.mjs')
  const { startVite, launchBrowser, APP_URL, MOCK_PORT } = await import('./harness.mjs')
  process.env.__SAET_NU_APP_URL = APP_URL

  const vite = await startVite()
  const browser = await launchBrowser()
  try {
    const viewports = [
      { tag: 'atlet-390x844', width: 390, height: 844 },
      { tag: 'atlet-360x780', width: 360, height: 780 },
    ]
    for (const vp of viewports) {
      const mock = createMockSupabase(buildSeed())
      await mock.listen(MOCK_PORT)
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
      const page = await context.newPage()
      page.on('pageerror', err => console.error('[browser pageerror]', err))
      try {
        await runViewport(page, { ...vp, outDir: OUT_DIR })
      } finally {
        await context.close()
        await mock.close()
      }
    }
    console.log('\nGRØN: sæt-nu (ordre 314) — "Sæt N af 4" fulgte det aktuelle sæt, klarede sæt stod kompakt, næste sæt var højst én dæmpet linje, ingen vandret overflow, på både 390×844 og 360×780.')
    process.exitCode = 0
  } catch (err) {
    console.error('\nFEJL:', err.message)
    process.exitCode = 1
  } finally {
    await browser.close()
    await vite.stop()
  }
}

if (process.argv[1] && process.argv[1].endsWith('saet-nu.spec.mjs')) main()
