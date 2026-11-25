// Ordre 2359b (Marc 24. nov. kl. 19:11: "hvordan vi ebdst sikre ate atleterne rent faktisk følger planerne"): "Spist igen" i Kost i dag
// gemmer under planmåltidets navn, når kcal og protein ligger inden for 10 % af et åbent planmåltid, og siger "Gemt som <planmåltid>".
// Kostklient med sendt kostuge (Frokost 450 kcal / 30 g, Aftensmad 600 kcal / 40 g), 390 px, lys og mørk. Kun syntetiske data.
// Kør: E2E_VITE_PORT=5359 E2E_MOCK_PORT=8959 VITE_SUPABASE_URL=http://127.0.0.1:8959 node e2e/kost-spist-igen-plannavn-2359b.spec.mjs
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
  const igaar = igaarDato(s.today)
  const raekke = (i, meal, kcal, protein) => ({ id: `e6000000-0000-4000-8000-00000000239${i}`, athlete_id: ATHLETE_ID, date: igaar, meal, kcal, protein, carb: 40, fat: 10, created_at: `${igaar}T12:0${i}:00.000Z` })
  s.tables.meal_logs.push(raekke(1, 'Skyr med nødder', 460, 31), raekke(2, 'Pasta og kød', 800, 60))
  return s
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
    const s = seedKlient()
    const mock = createMockSupabase({ users: s.users, tables: structuredClone(s.tables) }); await mock.listen(MOCK_PORT)
    const ctx = await browser.newContext({ viewport: MOBILE, colorScheme: sc }); const page = await ctx.newPage()
    page.on('pageerror', err => errors.push(`${sc}: ${err.message}`))
    const dagens = () => mock.table('meal_logs').filter(r => r.athlete_id === ATHLETE_ID && r.date === s.today)
    try {
      await login(page)
      await page.getByRole('button', { name: 'Kost', exact: true }).first().click({ timeout: 20000 })
      const kort = page.getByRole('region', { name: 'Kost i dag' })
      await kort.waitFor({ state: 'visible', timeout: 20000 })
      await tema(page, sc)
      await kort.getByRole('button', { name: 'Frokost: spist som planlagt', exact: true }).waitFor({ timeout: 20000 })
      const knap = kort.getByRole('button', { name: 'Spist igen: Skyr med nødder', exact: true })
      await knap.waitFor({ timeout: 20000 }); await knap.scrollIntoViewIfNeeded(); await knap.click()
      await kort.getByText('Gemt som Frokost').waitFor({ timeout: 20000 })
      const navne = dagens().map(r => r.meal)
      krav(JSON.stringify(navne) === JSON.stringify(['Frokost']), `rækken har ikke planmåltidets navn: ${navne.join(', ')}`)
      krav(await kort.getByRole('button', { name: 'Frokost: spist som planlagt', exact: true }).count() === 0, 'Frokost står stadig åben som planlagt')
      await kort.getByRole('button', { name: 'Aftensmad: spist som planlagt', exact: true }).waitFor({ timeout: 20000 })
      await ingenScroll(page, 'efter Spist igen')
      const besked = await kort.getByText('Gemt som Frokost').boundingBox()
      krav(besked && besked.x >= 0 && besked.x + besked.width <= MOBILE.width, `Beskeden er afskåret: ${JSON.stringify(besked)}`)
      if (process.env.UD_MAPPE) { await kort.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${process.env.UD_MAPPE}/2359b-spist-igen-${sc === 'light' ? 'lys' : 'moerk'}.png` }) }
      // Uden for 10 %: uændret navn.
      await kort.getByRole('button', { name: 'Spist igen: Pasta og kød', exact: true }).click()
      await kort.getByText('Pasta og kød gemt.').waitFor({ timeout: 20000 })
      krav(dagens().some(r => r.meal === 'Pasta og kød'), 'rækken uden for 10 % skulle beholde sit navn')
      console.log(`OK ${sc}`)
    } catch (e) { try { await page.screenshot({ path: `${process.env.TEMP}/2359b-fejl-${sc}.png` }) } catch { /* ignoreret */ } throw new Error(`${sc}: ${e.message}`) }
    finally { await ctx.close(); await mock.close() }
  }
  krav(!errors.length, 'pageerror: ' + errors.join(' | '))
} catch (err) { fejl = err } finally { await browser.close(); await vite.stop() }
if (fejl) { console.error('FEJL:', fejl.message); process.exit(1) }
console.log('2359b e2e grøn')
