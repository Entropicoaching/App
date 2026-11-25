// Ordre 2345 (Marc 24. nov. kl. 19:11: "hvordan vi ebdst sikre ate atleterne rent faktisk følger planerne"): Hjem siger ikke
// "Alt er logget" efter ét logget måltid af en kostplan med flere. Kostklient uden træning, 390 px, lys og mørk. Kun syntetiske data.
// Kør: E2E_VITE_PORT=5345 E2E_MOCK_PORT=8945 VITE_SUPABASE_URL=http://127.0.0.1:8945 node e2e/hjem-mad-delvis-2345.spec.mjs
import { createMockSupabase } from './mock-supabase.mjs'
import { ATHLETE_USER, ATHLETE_ID } from './fixtures.mjs'
import { startVite, launchBrowser, MOCK_PORT, APP_URL } from './harness.mjs'
import { seed as ugeSeed } from './kost-set-paa-main.spec.mjs'

const MOBILE = { width: 390, height: 844 }
const krav = (ok, tekst) => { if (!ok) throw new Error(tekst) }
function seedKlient(loggede) {
  const s = ugeSeed()
  s.tables.weeks = []; s.tables.sessions = []; s.tables.exercises = []; s.tables.exercise_logs = []
  const maaltider = s.tables.kostplan_v1_versions[0].meals
  const antal = maaltider.length
  for (const [i, m] of maaltider.slice(0, loggede ?? antal).entries())
    s.tables.meal_logs.push({ id: `e5000000-0000-4000-8000-00000000000${i + 1}`, athlete_id: ATHLETE_ID, date: s.today, meal: m.name, kcal: 300, protein: 20, carb: 30, fat: 8, created_at: `${s.today}T1${i}:00:00Z` })
  return { s, antal }
}
async function login(page) {
  await page.goto(APP_URL); await page.evaluate(() => { try { localStorage.clear() } catch { /* ignoreret */ } }); await page.goto(APP_URL)
  await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email); await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
}
const hjem = page => page.locator('[data-u5-today]').first()
const ingenScroll = async (page, hvor) => krav(await page.evaluate(() => document.documentElement.scrollWidth) <= MOBILE.width + 1, `Vandret scroll på 390 px: ${hvor}`)
const tema = (page, navn) => page.evaluate(v => (v === 'light' ? document.documentElement.setAttribute('data-tema', 'lys') : document.documentElement.removeAttribute('data-tema')), navn)
let scheme = 'light'
const trin = [
  ['ét måltid logget: Mad mangler stadig, tæller og Åbn kost', 1, async (page, antal) => {
    await hjem(page).waitFor({ timeout: 20000 })
    await page.waitForFunction(n => document.querySelector('[data-u5-today]')?.textContent.includes(`1 af ${n} logget.`), antal, { timeout: 20000 })
    const tekst = await hjem(page).innerText()
    krav(!tekst.includes('Alt er logget i dag'), 'Hjem siger "Alt er logget i dag" med åbne planmåltider')
    krav(/Mangler i dag:.*mad/.test(tekst), `Overskriften mangler "mad": ${tekst.slice(0, 120)}`)
    // Ordre 2370: kostklientens Hjem har Åbn kost i kortet over; Log mad-vejviseren er skjult.
    krav(await page.getByRole('button', { name: 'Åbn kost', exact: true }).count() > 0, 'Åbn kost mangler')
    await ingenScroll(page, 'delvis')
  }],
  ['alle måltider loggede: Mad er klaret', null, async (page, antal) => {
    await hjem(page).waitFor({ timeout: 20000 })
    await page.waitForTimeout(2000)
    const tekst = await hjem(page).innerText()
    krav(!/Mangler i dag:.*mad/.test(tekst), `Mad mangler efter alle ${antal} måltider: ${tekst.slice(0, 120)}`)
    krav(!tekst.includes(`af ${antal} logget`), 'tæller må ikke stå, når alt er logget')
    await ingenScroll(page, 'alle')
  }],
]
const vite = await startVite(), browser = await launchBrowser(), errors = []
let fejl = null
try {
  for (const sc of ['light', 'dark']) for (const [navn, loggede, run] of trin) {
    scheme = sc; const { s, antal } = seedKlient(loggede); krav(antal > 1, 'seeden skal have mindst to planmåltider')
    const mock = createMockSupabase({ users: s.users, tables: structuredClone(s.tables) }); await mock.listen(MOCK_PORT)
    const ctx = await browser.newContext({ viewport: MOBILE, colorScheme: sc }); const page = await ctx.newPage()
    page.on('pageerror', err => errors.push(`${navn} ${sc}: ${err.message}`))
    try { await login(page); await hjem(page).waitFor({ timeout: 20000 }); await tema(page, sc); await run(page, antal); console.log(`OK ${navn} ${sc}`)
      if (process.env.UD_MAPPE && loggede === 1) await page.screenshot({ path: `${process.env.UD_MAPPE}/2345-hjem-delvis-${sc}.png` }) }
    catch (e) { try { await page.screenshot({ path: `${process.env.TEMP}/2345-fejl-${sc}.png` }) } catch { /* ignoreret */ } throw new Error(`${navn} ${sc}: ${e.message}`) }
    finally { await ctx.close(); await mock.close() }
  }
  krav(!errors.length, 'pageerror: ' + errors.join(' | '))
} catch (err) { fejl = err } finally { await browser.close(); await vite.stop() }
if (fejl) { console.error('FEJL:', fejl.message); process.exit(1) }
console.log('2345 e2e grøn')
