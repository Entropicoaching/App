// ORDRE 1459, fulgt med Entropi 2 i ordre 2067. Pausetimeren i dagens pas (mock, 390x844):
// 1) Ingen pause før første sæt (Entropi 2 har ingen pauselinje).
// 2) Pausetimeren starter af sig selv efter første godkendte sæt.
// 3) Den kan stoppes (Pause/Fortsæt) og nulstilles.
// 4) Næste sæt starter pausen igen.
// 5) Skærmlås: tiden regnes fra tidspunktet (Date.now +40 s og visibilitychange).
// Egen kørsel: `npm run e2e:timer-1459`. Billeder: UDMAPPE=<sti> (ingen i repoet).
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
    const shot = async (name) => { if (OUT_DIR) await page.screenshot({ path: join(OUT_DIR, `efter-${name}.png`) }) }

    await page.goto(APP_URL)
    await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
    await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
    await page.getByRole('button', { name: 'Log ind' }).click()
    // Entropi 2: Hjem har "Start dagens pas"; guiden for en ny atlet kan springes over.
    await page.getByRole('button', { name: 'Start dagens pas' }).first().waitFor({ state: 'visible', timeout: 15000 })
    const spring = page.getByRole('button', { name: /Spring guiden over/ })
    if (await spring.count()) await spring.first().click()
    await page.getByRole('button', { name: 'Start dagens pas' }).first().click()
    const godkend = page.getByRole('button', { name: 'Som planlagt', exact: true })
    await godkend.first().waitFor({ state: 'visible', timeout: 10000 })
    await shot('1-foerste-saet')

    // 1) Før første sæt er der ingen pause (der er ingen pauselinje i Entropi 2).
    const pause = page.getByLabel('Pause mellem sæt').filter({ has: page.getByRole('timer') }).first()
    assert.equal(await page.locator('.e2-rest:not([hidden])').count(), 0, 'ingen pause foer foerste saet')

    // 2) Pausetimeren starter af sig selv, når første sæt er godkendt, på programmets pause (90 eller 120 s).
    await godkend.first().click()
    await pause.waitFor({ state: 'visible', timeout: 5000 })
    const ur = pause.getByRole('timer')
    const sek = async () => {
      const m = (await ur.innerText()).trim().match(/^(\d+):(\d\d)$/)
      assert.ok(m, 'uret viser m:ss')
      return Number(m[1]) * 60 + Number(m[2])
    }
    const a = await sek()
    assert.ok(a > 80 && a <= 120, `pausen starter paa 90 eller 120 s, fik ${a}`)
    await shot('2-pause-koerer')

    // 3) Pausen kan stoppes: Pause står stille, Fortsæt tager den op igen, Nulstil starter forfra.
    const stopKnap = pause.getByRole('button', { name: 'Pause', exact: true })
    assert.ok((await stopKnap.boundingBox()).height >= 44, 'Pause-knappen er mindst 44 px høj')
    await stopKnap.click()
    await pause.getByRole('button', { name: 'Fortsæt', exact: true }).waitFor({ state: 'visible', timeout: 3000 })
    assert.match(await pause.innerText(), /sat på pause/i, 'uret siger, at det er sat paa pause')
    const stoppet = await sek()
    await page.waitForTimeout(1600)
    assert.equal(await sek(), stoppet, 'uret staar stille, mens pausen er stoppet')
    await shot('3-pause-stoppet')
    await pause.getByRole('button', { name: 'Fortsæt', exact: true }).click()
    await page.waitForTimeout(1300)
    assert.ok(await sek() < stoppet, 'uret taeller ned igen efter Fortsaet')
    await pause.getByRole('button', { name: 'Nulstil', exact: true }).click()
    const nulstillet = await sek()
    assert.ok(nulstillet >= a - 3 && nulstillet <= 120, `Nulstil starter pausen forfra, fik ${nulstillet} (var ${a})`)

    // 4) Næste godkendte sæt starter pausen igen.
    await page.waitForTimeout(3000)
    const foerNaeste = await sek()
    await page.getByRole('button', { name: /^Som (planlagt|sidste sæt)$/ }).first().click()
    await page.waitForTimeout(800)
    const c = await sek()
    assert.ok(c > foerNaeste, `naeste saet starter pausen forfra, fik ${c} (var ${foerNaeste})`)

    // 5) Skærmlås: tiden regnes fra tidspunktet. Date.now skubbes 40 s frem + visibilitychange (som at låse op).
    await page.evaluate(() => {
      const orig = Date.now
      Date.now = () => orig() + 40000
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await page.waitForTimeout(600)
    const b = await sek()
    assert.ok(b <= c - 38 && b >= c - 42, `efter 40 s "i lommen" skal der mangle ca. 40 s, fik ${b} (var ${c})`)
    await shot('4-efter-skaermlaas-40s')

    const sw = await page.evaluate(() => document.documentElement.scrollWidth)
    assert.ok(sw <= 390, `vandret overflow ${sw}`)
    console.log(`\nGRØN: timer-1459 (Entropi 2): ingen pause før første sæt, pausen starter af sig selv (${a} s), kan stoppes og fortsættes, Nulstil, skærmlås +40 s giver ${b} s, næste sæt starter pausen igen (${c} s), ingen overflow.`)
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
