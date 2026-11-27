// Ordre 2461: ingen tom "Planens råd" og intet "0 af ... kcal"-blink hos kostklienten. 390 px, Chromium, mock med forsinket svar. Kun syntetiske data.
// Kør: E2E_VITE_PORT=5461 E2E_MOCK_PORT=8461 VITE_SUPABASE_URL=http://127.0.0.1:8461 node e2e/kost-tomt-raad-kcal-blink-2461.spec.mjs
import { createMockSupabase } from './mock-supabase.mjs'
import { ATHLETE_USER } from './fixtures.mjs'
import { startVite, launchBrowser, MOCK_PORT, APP_URL } from './harness.mjs'
import { seed as ugeSeed } from './kost-set-paa-main.spec.mjs'

const MOBILE = { width: 390, height: 844 }
const krav = (ok, tekst) => { if (!ok) throw new Error(tekst) }
const RAAD = 'Spis langsomt og drik vand til maden.'
async function login(page) {
  await page.goto(APP_URL); await page.evaluate(() => { try { localStorage.clear() } catch { /* ignoreret */ } }); await page.goto(APP_URL)
  await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email); await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
}
const vite = await startVite(), browser = await launchBrowser(), errors = []
let fejl = null
try {
  for (const medRaad of [false, true]) {
    const s = ugeSeed()
    for (const v of s.tables.kostplan_v1_versions) v.portion_guidance = medRaad ? RAAD : null
    const mock = createMockSupabase({ users: s.users, tables: structuredClone(s.tables) }); await mock.listen(MOCK_PORT)
    const ctx = await browser.newContext({ viewport: MOBILE }); const page = await ctx.newPage()
    const navn = medRaad ? 'med råd' : 'uden råd'
    page.on('pageerror', err => errors.push(`${navn}: ${err.message}`))
    // Forsinket mock-svar på kostdata, så pladsholderen kan ses.
    await page.route(/\/rest\/v1\/(kostplan|meal_logs)/, async route => { await new Promise(r => setTimeout(r, 1500)); await route.continue() })
    try {
      await login(page)
      await page.getByRole('button', { name: 'Kost', exact: true }).first().click({ timeout: 20000 })
      await page.evaluate(() => {
        window.__blink = []
        const tag = () => {
          const kort = document.querySelector('[data-kost-i-dag]'); if (!kort) return
          const t = kort.textContent
          if (/I dag [\d.]+ (af|kcal)/.test(t) && !/spist som planlagt|Alt som planlagt|Logget/.test(t)) window.__blink.push(t.slice(0, 80))
          if (kort.hasAttribute('data-kost-i-dag-henter')) window.__henter = true
        }
        new MutationObserver(tag).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true }); tag()
      })
      const kort = page.getByRole('region', { name: 'Kost i dag' })
      await kort.waitFor({ state: 'visible', timeout: 20000 })
      await kort.getByRole('button', { name: /spist som planlagt/ }).first().waitFor({ timeout: 25000 })
      const { blink, henter } = await page.evaluate(() => ({ blink: window.__blink, henter: window.__henter === true }))
      console.log(`${navn}: pladsholder set ${henter}; tal uden planmåltider: ${blink.length}`)
      krav(blink.length === 0, `tal vist før planmåltiderne: ${blink[0]}`)
      krav(henter, 'pladsholderen "Henter dagens kost" blev aldrig vist')
      const body = await page.evaluate(() => document.body.textContent)
      krav(!/ikke tilføjet råd/.test(body), 'den tomme rådtekst står stadig')
      if (medRaad) krav(body.includes(RAAD) && /Planens råd/.test(body), 'rådet skulle vises uændret')
      else krav(!/Planens råd/.test(body), 'Planens råd skulle være skjult uden råd')
      if (process.env.UD_MAPPE) { await page.screenshot({ path: `${process.env.UD_MAPPE}/2461-${medRaad ? 'med' : 'uden'}-raad.png` }) }
      console.log(`OK ${navn}`)
    } catch (e) { try { await page.screenshot({ path: `${process.env.TEMP}/2461-fejl.png` }) } catch { /* ignoreret */ } throw new Error(`${navn}: ${e.message}`) }
    finally { await ctx.close(); await mock.close() }
  }
  krav(!errors.length, 'fejl i browseren: ' + errors.join(' | '))
} catch (err) { fejl = err } finally { await browser.close(); await vite.stop() }
if (fejl) { console.error('FEJL:', fejl.message); process.exit(1) }
console.log('2461 e2e grøn')
