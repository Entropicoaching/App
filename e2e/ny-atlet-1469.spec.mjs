// ORDRE 1469 fase C: en NY atlet (mock, 390x844) gaar en hel traening igennem uden hjaelp:
// finder pausetimeren paa saet-kortet, logger alle saet, ser Fremgang og rekorder.
// Egen koersel: `npm run e2e:ny-atlet-1469`. Billeder: UDMAPPE=<sti> (aldrig i repoet).
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { ATHLETE_USER, buildSeed } from './fixtures.mjs'

const OUT_DIR = process.env.UDMAPPE || ''
if (OUT_DIR) mkdirSync(OUT_DIR, { recursive: true })

async function main() {
  const { createMockSupabase } = await import('./mock-supabase.mjs')
  const { startVite, launchBrowser, APP_URL, MOCK_PORT } = await import('./harness.mjs')
  const vite = await startVite()
  const browser = await launchBrowser()
  const mock = createMockSupabase(buildSeed())
  await mock.listen(MOCK_PORT)
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const page = await context.newPage()
    page.on('pageerror', err => console.error('[browser pageerror]', err))
    const shot = async (navn, fullPage = false) => { if (OUT_DIR) await page.screenshot({ path: join(OUT_DIR, `${navn}.png`), fullPage }) }

    await page.goto(APP_URL)
    await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
    await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
    await page.getByRole('button', { name: 'Log ind' }).click()
    await page.getByText('Dagens pas', { exact: true }).waitFor({ state: 'visible', timeout: 15000 })
    await shot('c1-forside')

    // 1) Timeren kan findes uden hjaelp: linjen staar paa saet-kortet, foer noget er logget.
    const linje = page.getByTestId('pause-start-linje')
    await linje.waitFor({ state: 'visible', timeout: 5000 })
    await linje.scrollIntoViewIfNeeded()
    await shot('c2-pauselinje-paa-kortet')
    await linje.click()
    const popup = page.getByTestId('rest-pause-popup')
    await popup.waitFor({ state: 'visible', timeout: 3000 })
    const popTxt = await popup.innerText()
    assert.match(popTxt, /Første sæt/); assert.doesNotMatch(popTxt, /Næste:/)
    await shot('c3-popup-foer-foerste-saet')
    await page.getByTestId('rest-pause-close').click()

    // 2) Log hele passet med kun "Godkendt".
    let antal = 0
    for (let i = 0; i < 12; i++) {
      const knap = page.getByRole('button', { name: 'Godkendt', exact: true })
      if (await knap.count() === 0) break
      await knap.first().click(); antal++
      await page.waitForTimeout(700)
      if (antal === 1) await shot('c4-efter-foerste-saet')
    }
    assert.ok(antal >= 2, `loggede kun ${antal} saet`)
    await shot('c5-efter-traening')
    console.log(`Loggede ${antal} saet med Godkendt.`)

    // 3) Fremgang og rekorder.
    await page.getByText('Fremgang', { exact: true }).last().click()
    await page.getByText('Dine rekorder', { exact: false }).waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(800)
    await shot('c6-fremgang', true)
    const txt = await page.evaluate(() => document.body.innerText)
    assert.ok(/rekord/i.test(txt), 'Fremgang viser rekord-afsnit')
    const sw = await page.evaluate(() => document.documentElement.scrollWidth)
    assert.ok(sw <= 390, `vandret overflow ${sw}`)
    console.log('GRØN: ny atlet fandt timeren, loggede passet og så Fremgang + rekorder uden overflow.')
  } catch (err) {
    console.error('\nFEJL:', err.message)
    process.exitCode = 1
  } finally {
    await browser.close(); await mock.close(); await vite.stop()
  }
}
main()
