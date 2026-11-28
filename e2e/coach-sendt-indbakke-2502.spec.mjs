// ORDRE 2502 · med over 10 atleter staar Sendt foldet helt (kun overskrift med antal). (b) Indbakke en raekke pr. atlet er ikke lavet: den rammer de laaste proever coachListReturn og coachFront.
// Kun syntetiske atleter, Chromium, fast tid loerdag 2026-11-28. Koersel:
// E2E_VITE_PORT=5502 E2E_MOCK_PORT=8502 VITE_SUPABASE_URL=http://127.0.0.1:8502 [E2E_BREDDE=1280] [E2E_TEMA=lys] node e2e/coach-sendt-indbakke-2502.spec.mjs
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { createMockSupabase } from './mock-supabase.mjs'
import { COACH_USER } from './fixtures.mjs'
import { seed } from './coach-fuldt-hold-2491.mjs'
import { startVite, launchBrowser, APP_URL, MOCK_PORT, OUT_DIR } from './harness.mjs'

const DESKTOP = process.env.E2E_BREDDE === '1280'
const LYS = process.env.E2E_TEMA === 'lys'
const LABEL = `${DESKTOP ? 1280 : 390}${LYS ? '-lys' : '-moerk'}`
const FAST = new Date('2026-11-28T08:00:00Z')

async function main() {
  const mock = createMockSupabase(seed())
  await mock.listen(MOCK_PORT)
  const vite = await startVite(), browser = await launchBrowser()
  try {
    const page = await browser.newPage({ viewport: DESKTOP ? { width: 1280, height: 800 } : { width: 390, height: 844 }, colorScheme: LYS ? 'light' : 'dark' })
    const fejl = []
    page.on('pageerror', err => fejl.push(err.message))
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) fejl.push(m.text()) })
    await page.clock.setFixedTime(FAST)
    await page.goto(APP_URL)
    if (LYS) { await page.evaluate(() => localStorage.setItem('entropi:tema', 'lys')); await page.reload() }
    await page.locator('#athlete-auth-email').fill(COACH_USER.email)
    await page.locator('#athlete-auth-password').fill(COACH_USER.password)
    await page.getByRole('button', { name: 'Log ind' }).click()
    const idag = page.locator('[data-coach-idag]')
    await idag.locator('[data-coach-action]').first().waitFor({ state: 'visible', timeout: 30000 })
    await page.waitForTimeout(2500)
    // (a) Sendt: 15 atleter, foldet helt. Overskrift med antal er synlig, ingen raekker foer tryk.
    const sendt = page.locator('[data-coach-uge="sendt"]')
    assert.equal(await sendt.count(), 1, 'Sendt findes')
    assert.match(await sendt.locator('h2').first().innerText(), /Sendt \(\d+\)/)
    assert.equal(await sendt.locator('[data-coach-action]:visible').count(), 0, 'ingen synlige raekker i Sendt foer tryk')
    await sendt.locator('summary').first().click()
    assert.ok(await sendt.locator('[data-coach-action]:visible').count() > 0, 'raekkerne staar efter ét tryk')
    await sendt.locator('summary').first().click()
    const hoejde = await page.evaluate(() => document.documentElement.scrollHeight)
    console.log(`forsideHoejde ${LABEL}: ${hoejde}`)
    await page.screenshot({ path: join(process.env.E2E_2502_OUT || OUT_DIR, `coach-sendt-indbakke-2502-forside-${LABEL}.png`), fullPage: false })
    const bred = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    assert.ok(bred <= 0, `ingen vandret scroll, fandt ${bred}px`)
    assert.deepEqual(fejl, [], `Ingen fejl forventet: ${JSON.stringify(fejl)}`)
    console.log(`GRØN: ${LABEL}`)
  } catch (err) { console.error('\nFEJL:', err.message); process.exitCode = 1 }
  finally { await browser.close().catch(() => {}); await vite.stop().catch(() => {}); await mock.close().catch(() => {}) }
}
if (process.argv[1] && process.argv[1].endsWith('coach-sendt-indbakke-2502.spec.mjs')) main()
