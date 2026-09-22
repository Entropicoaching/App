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

  await page.getByText('Dagens pas', { exact: true }).waitFor({ state: 'visible', timeout: 15000 })
  await page.getByText('Sæt 1/4', { exact: true }).waitFor({ state: 'visible' })
  await checkOverflow(page, `${tag} før sæt 1`)
  await shot('00-foer-saet-1')

  // Før noget er logget: ingen "klarede sæt"-linje, og "næste sæt" (dæmpet,
  // ingen felter) peger på sæt 2. Eksakt tekst (ikke exact:false), fordi
  // RestPauseFooter's "Næste: <øvelse> · sæt N/M" (efter et Godkendt-tryk)
  // ellers også matcher en løs "Næste:"-søgning.
  const NEXT_SET_PREVIEW_TEXT = 'Næste: 4 reps @ 80 kg'
  assert.equal(await page.getByText('Sæt 1:', { exact: false }).count(), 0, `${tag}: intet klaret sæt endnu, "Sæt 1:"-linjen må ikke stå der`)
  await page.getByText(NEXT_SET_PREVIEW_TEXT, { exact: true }).waitFor({ state: 'visible', timeout: 5000 })

  for (const setNum of [1, 2, 3]) {
    await page.getByText(`Sæt ${setNum}/4`, { exact: true }).waitFor({ state: 'visible', timeout: 5000 })
    await checkOverflow(page, `${tag} lige før "Godkendt" på sæt ${setNum}`)
    await shot(`${String(setNum).padStart(2, '0')}a-foer-godkendt-saet-${setNum}`)

    await page.getByRole('button', { name: 'Godkendt', exact: true }).click()

    if (setNum < 4) {
      await page.getByText(`Sæt ${setNum + 1}/4`, { exact: true }).waitFor({ state: 'visible', timeout: 5000 })
    }
    await checkOverflow(page, `${tag} lige efter "Godkendt" på sæt ${setNum}`)
    await shot(`${String(setNum).padStart(2, '0')}b-efter-godkendt-saet-${setNum}`)

    // Alle sæt 1..setNum skal nu stå som kompakte "klarede sæt"-linjer.
    for (let n = 1; n <= setNum; n++) {
      await page.getByText(`Sæt ${n}:`, { exact: false }).waitFor({ state: 'visible', timeout: 5000 })
    }
    // Det aktuelle sæt (setNum+1, hvis der er et) må IKKE selv stå som en
    // klaret linje — kun de sæt der ligger FØR det.
    if (setNum + 1 <= 4) {
      assert.equal(await page.getByText(`Sæt ${setNum + 1}:`, { exact: false }).count(), 0,
        `${tag}: det aktuelle sæt (${setNum + 1}) må ikke selv stå som en klaret linje`)
      if (setNum + 2 <= 4) {
        await page.getByText(NEXT_SET_PREVIEW_TEXT, { exact: true }).waitFor({ state: 'visible', timeout: 5000 })
      }
    }
  }
  await shot('99-tre-saet-logget')

  console.log(`${tag}: tre sæt logget, "Sæt N af 4" stemte hele vejen, ingen vandret overflow, ${3} klarede-sæt-linjer stod korrekt.`)
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
