// ORDRE 1469 fase C: en NY atlet (mock, 390x844) gaar en hel traening igennem uden hjaelp:
// starter passet, ser pausetimeren efter foerste saet, logger alle saet, ser Fremgang og rekorder.
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
    // Entropi 2: Hjem har "Start dagens pas"; guiden for en ny atlet kan springes over.
    await page.getByRole('button', { name: 'Start dagens pas' }).first().waitFor({ state: 'visible', timeout: 15000 })
    await shot('c1-forside')
    const spring = page.getByRole('button', { name: /Spring guiden over/ })
    if (await spring.count()) await spring.first().click()
    await page.getByRole('button', { name: 'Start dagens pas' }).first().click()
    const godkend = page.getByRole('button', { name: 'Som planlagt', exact: true })
    await godkend.first().waitFor({ state: 'visible', timeout: 10000 })
    await shot('c2-foerste-saet')

    // 1) Pausetimeren startes af sig selv, naar foerste saet er godkendt (der er ingen pauselinje foer).
    assert.equal(await page.locator('.e2-rest:not([hidden])').count(), 0, 'ingen pause foer foerste saet')
    await godkend.first().click()
    const pause = page.getByLabel('Pause mellem sæt').filter({ has: page.getByRole('timer') }).first()
    await pause.waitFor({ state: 'visible', timeout: 5000 })
    assert.match(await pause.innerText(), /\d+:\d\d/, 'pausetimeren viser tid efter foerste saet')
    await shot('c3-pause-efter-foerste-saet')

    // 2) Log resten af passet med et tryk pr. saet.
    let antal = 1
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(700)
      const knap = page.getByRole('button', { name: /^Som (planlagt|sidste sæt)$/ })
      if (await knap.count() === 0) break
      await knap.first().click(); antal++
    }
    assert.ok(antal >= 2, `loggede kun ${antal} saet`)
    await shot('c5-efter-traening')
    console.log(`Loggede ${antal} saet med et tryk pr. saet.`)

    // 3) Fremgang og rekorder.
    // Passet ligger i en modal dialog i Entropi 2; den lukkes, foer fanerne kan trykkes.
    const luk = page.getByRole('button', { name: 'Luk pas' })
    if (await luk.first().isVisible()) await luk.first().click()
    await page.getByRole('button', { name: 'Fremgang', exact: true }).last().click()
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
