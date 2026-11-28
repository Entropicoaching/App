// ORDRE 2491 · med 15 atleter staar alle 9, der kraever coachen, paa forsiden: 5 i Kraever dig i dag, resten under "Vis resten (n)"
// i samme liste (foer 2491 laa de 4 sidste kun bag Coach Briefing, og to af dem stod ingen steder paa forsiden).
// Hver atlet staar kun en gang. Kun syntetiske atleter, Chromium, fast tid loerdag 2026-11-28. Koersel:
// E2E_VITE_PORT=5491 E2E_MOCK_PORT=8991 VITE_SUPABASE_URL=http://127.0.0.1:8991 [E2E_BREDDE=1280] [E2E_TEMA=lys] node e2e/coach-forside-vis-resten-2491.spec.mjs
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
const KRAEVER = ['Alfa', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India']

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
    await page.waitForTimeout(2000)
    // Uden tryk: 5 rækker. Med ét tryk på "Vis resten": alle 9.
    assert.equal(await idag.locator('[data-coach-action]:visible').count(), 5)
    const fold = idag.locator('[data-coach-fold="idag-resten"]')
    assert.equal(await fold.count(), 1, 'Vis resten findes under Kræver dig i dag')
    assert.match(await fold.locator(':scope > summary').innerText(), /Vis resten \(4\)/)
    await fold.locator(':scope > summary').click()
    const navne = (await idag.locator('[data-coach-action]:visible').allInnerTexts()).join(' ')
    const mangler = KRAEVER.filter(n => !navne.includes(`Atlet ${n} ·`))
    assert.deepEqual(mangler, [], `ikke set på forsiden efter ét tryk: ${mangler}`)
    // Hver atlet én gang blandt opgaverne: Mangler ny uge er tom, og grunden står i atletens række.
    assert.equal(await page.locator('[data-coach-uge="ny-uge"] [data-coach-action]').count(), 0)
    assert.equal(await page.locator('[data-coach-uge-grund]').count(), 2)
    await page.screenshot({ path: join(process.env.E2E_2491_OUT || OUT_DIR, `coach-forside-vis-resten-2491-${LABEL}.png`), fullPage: false })
    const bred = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    assert.ok(bred <= 0, `ingen vandret scroll, fandt ${bred}px`)
    assert.deepEqual(fejl, [], `Ingen fejl forventet: ${JSON.stringify(fejl)}`)
    console.log(`GRØN: ${LABEL}`)
  } catch (err) { console.error('\nFEJL:', err.message); process.exitCode = 1 }
  finally { await browser.close().catch(() => {}); await vite.stop().catch(() => {}); await mock.close().catch(() => {}) }
}
if (process.argv[1] && process.argv[1].endsWith('coach-forside-vis-resten-2491.spec.mjs')) main()
