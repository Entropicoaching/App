// Ordre 2356 (Marc 24. nov. kl. 19:11: "hvordan vi ebdst sikre ate atleterne rent faktisk følger planerne"): Kostvane-kortets
// "Jeg spiste som i går" (Kost, Vis detaljer) gemmer med dagens plannavne og kan fortrydes som én gruppe.
// Kostklient med sendt kostuge, gårsdagens måltider under egne navne, 390 px, lys og mørk. Kun syntetiske data.
// Kør: E2E_VITE_PORT=5356 E2E_MOCK_PORT=8956 VITE_SUPABASE_URL=http://127.0.0.1:8956 node e2e/kost-kostvane-igaar-2356.spec.mjs
import { createMockSupabase } from './mock-supabase.mjs'
import { ATHLETE_USER, ATHLETE_ID } from './fixtures.mjs'
import { startVite, launchBrowser, MOCK_PORT, APP_URL } from './harness.mjs'
import { seed as ugeSeed } from './kost-set-paa-main.spec.mjs'

const MOBILE = { width: 390, height: 844 }
const krav = (ok, tekst) => { if (!ok) throw new Error(tekst) }
const igaarDato = today => new Date(Date.parse(today + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10)
function seedKlient() {
  const s = ugeSeed()
  s.tables.weeks = []; s.tables.sessions = []; s.tables.exercises = []; s.tables.exercise_logs = []
  const planNavne = s.tables.kostplan_v1_versions[0].meals.map(m => m.name)
  const egne = ['Havregrød med bær', 'Kylling og ris', 'Laks og kartofler']
  const igaar = igaarDato(s.today)
  for (const [i] of planNavne.entries())
    s.tables.meal_logs.push({ id: `e6000000-0000-4000-8000-00000000236${i}`, athlete_id: ATHLETE_ID, date: igaar, meal: egne[i % egne.length], kcal: 400, protein: 25, carb: 40, fat: 10, created_at: `${igaar}T12:0${i}:00.000Z` })
  return { s, planNavne }
}
async function login(page) {
  await page.goto(APP_URL); await page.evaluate(() => { try { localStorage.clear() } catch { /* ignoreret */ } }); await page.goto(APP_URL)
  await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email); await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
}
const ingenScroll = async (page, hvor) => krav(await page.evaluate(() => document.documentElement.scrollWidth) <= MOBILE.width + 1, `Vandret scroll på 390 px: ${hvor}`)
const tema = (page, navn) => page.evaluate(v => (v === 'light' ? document.documentElement.setAttribute('data-tema', 'lys') : document.documentElement.removeAttribute('data-tema')), navn)
const vite = await startVite(), browser = await launchBrowser(), errors = []
let fejl = null
try {
  for (const sc of ['light', 'dark']) {
    const { s, planNavne } = seedKlient(); krav(planNavne.length > 1, 'seeden skal have mindst to planmåltider')
    const mock = createMockSupabase({ users: s.users, tables: structuredClone(s.tables) }); await mock.listen(MOCK_PORT)
    const ctx = await browser.newContext({ viewport: MOBILE, colorScheme: sc }); const page = await ctx.newPage()
    page.on('pageerror', err => errors.push(`${sc}: ${err.message}`))
    const dagens = () => mock.table('meal_logs').filter(r => r.athlete_id === ATHLETE_ID && r.date === s.today)
    try {
      await login(page)
      await page.getByRole('button', { name: 'Kost', exact: true }).first().click({ timeout: 20000 })
      await page.getByRole('region', { name: 'Kost i dag' }).waitFor({ state: 'visible', timeout: 20000 })
      await tema(page, sc)
      await page.getByRole('button', { name: 'Vis detaljer' }).click()
      const kort = page.getByRole('region', { name: 'Dagens kostvane' })
      await kort.waitFor({ state: 'visible', timeout: 20000 })
      const knap = kort.getByRole('button', { name: `Jeg spiste som i går (${planNavne.length} måltider)`, exact: true })
      await knap.waitFor({ timeout: 20000 }); await knap.scrollIntoViewIfNeeded(); await knap.click()
      await kort.getByText(`${planNavne.length} måltider logget i dag.`).waitFor({ timeout: 20000 })
      const navne = dagens().map(r => r.meal).sort()
      krav(JSON.stringify(navne) === JSON.stringify([...planNavne].sort()), `kopien har ikke plannavne: ${navne.join(', ')}`)
      const fortryd = kort.getByRole('button', { name: 'Fortryd', exact: true })
      krav(await fortryd.count() === 1, 'Fortryd mangler i Kostvane-kortet')
      await ingenScroll(page, 'efter kopi')
      const boks = await fortryd.boundingBox()
      krav(boks && boks.height >= 44, `Fortryd er for lille: ${JSON.stringify(boks)}`)
      if (process.env.UD_MAPPE) { await kort.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${process.env.UD_MAPPE}/2356-kostvane-igaar-${sc === 'light' ? 'lys' : 'moerk'}.png` }) }
      await fortryd.click()
      await knap.waitFor({ timeout: 20000 })
      krav(dagens().length === 0, `Fortryd efterlod ${dagens().length} rækker`)
      await ingenScroll(page, 'efter Fortryd')
      console.log(`OK ${sc}`)
    } catch (e) { try { await page.screenshot({ path: `${process.env.TEMP}/2356-fejl-${sc}.png` }) } catch { /* ignoreret */ } throw new Error(`${sc}: ${e.message}`) }
    finally { await ctx.close(); await mock.close() }
  }
  krav(!errors.length, 'pageerror: ' + errors.join(' | '))
} catch (err) { fejl = err } finally { await browser.close(); await vite.stop() }
if (fejl) { console.error('FEJL:', fejl.message); process.exit(1) }
console.log('2356 e2e grøn')
