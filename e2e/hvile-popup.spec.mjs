// ORDRE 1402 — hvile-timeren som pop-up man klikker ind på (Marcs dom 6. okt),
// samme mønster som mobilitetsøvelserne i opvarmningen. Logger sæt 1 på Dagens
// pas (starter pausen), tjekker at linjen nederst er en knap, at et tryk åbner
// pop-up'en med nedtælling, at "Luk" lukker den uden at stoppe pausen, og at
// "Skjul pausen" fjerner timeren. Skærmbilleder i outputs/1402 (390x844).
// Egen kørsel: `npm run e2e:hvile-popup`.
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { ATHLETE_USER, buildSeed } from './fixtures.mjs'

const OUT_DIR = join(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), '..', 'outputs', '1402')
mkdirSync(OUT_DIR, { recursive: true })

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
    const shot = (name) => page.screenshot({ path: join(OUT_DIR, `${name}.png`), fullPage: false })

    await page.goto(APP_URL)
    await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
    await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
    await page.getByRole('button', { name: 'Log ind' }).click()
    await page.getByText('Dagens pas', { exact: true }).waitFor({ state: 'visible', timeout: 15000 })

    await page.getByRole('button', { name: 'Godkendt', exact: true }).click()
    const open = page.getByTestId('rest-pause-open')
    await open.waitFor({ state: 'visible', timeout: 5000 })
    assert.equal(await page.getByTestId('rest-pause-popup').count(), 0, 'pop-up må ikke stå åben fra start')
    await shot('hjem-hvilepause')

    await open.click()
    const popup = page.getByTestId('rest-pause-popup')
    await popup.waitFor({ state: 'visible', timeout: 3000 })
    const sek = async () => Number((await popup.locator('svg + div span').first().innerText()).trim())
    const a = await sek()
    assert.ok(a > 0, `nedtælling skal vise sekunder, fik ${a}`)
    await page.waitForTimeout(2200)
    const b = await sek()
    assert.ok(b < a, `nedtællingen skal løbe i pop-up'en (${a} -> ${b})`)
    assert.ok(await popup.getByText('Næste', { exact: false }).count() > 0, 'pop-up viser næste sæt')
    await shot('hjem-timer-popup')

    await page.getByTestId('rest-pause-close').click()
    await popup.waitFor({ state: 'detached', timeout: 3000 })
    assert.ok(await open.isVisible(), 'pausen skal køre videre efter Luk')

    await open.click()
    await page.getByRole('button', { name: 'Skjul pausen', exact: true }).click()
    await open.waitFor({ state: 'detached', timeout: 3000 })
    const sw = await page.evaluate(() => document.documentElement.scrollWidth)
    assert.ok(sw <= 390, `vandret overflow ${sw}`)
    console.log(`\nGRØN: hvile-popup (ordre 1402) — linje er knap, pop-up åbner/lukker, nedtælling ${a}->${b}, Skjul fjerner timeren, ingen overflow på 390.`)
  } catch (err) {
    console.error('\nFEJL:', err.message)
    process.exitCode = 1
  } finally {
    await browser.close()
    await mock.close()
    await vite.stop()
  }
}

main()
