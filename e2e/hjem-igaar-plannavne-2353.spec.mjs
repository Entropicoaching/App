// Ordre 2353 (Marc 24. nov. kl. 19:11: "hvordan vi ebdst sikre ate atleterne rent faktisk følger planerne"): "Jeg spiste som i går"
// på Hjem kopierer for en kostklient med plannavne som Kost i dags "Alt fra i går", Hjem tæller dem, og Fortryd fjerner hele gruppen.
// Kostklient uden træning med sendt kostuge, 390 px, lys og mørk. Kun syntetiske data.
// Kør: E2E_VITE_PORT=5353 E2E_MOCK_PORT=8953 VITE_SUPABASE_URL=http://127.0.0.1:8953 node e2e/hjem-igaar-plannavne-2353.spec.mjs
import { createMockSupabase } from './mock-supabase.mjs'
import { ATHLETE_USER, ATHLETE_ID } from './fixtures.mjs'
import { startVite, launchBrowser, MOCK_PORT, APP_URL } from './harness.mjs'
import { seed as ugeSeed } from './kost-set-paa-main.spec.mjs'

const MOBILE = { width: 390, height: 844 }
const krav = (ok, tekst) => { if (!ok) throw new Error(tekst) }
const igaarDato = today => new Date(Date.parse(today + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10)
// Gårsdagens planmåltider står logget under egne navne (som en tidligere kopi uden plannavne gjorde dem).
function seedKlient() {
  const s = ugeSeed()
  s.tables.weeks = []; s.tables.sessions = []; s.tables.exercises = []; s.tables.exercise_logs = []
  const planNavne = s.tables.kostplan_v1_versions[0].meals.map(m => m.name)
  const egne = ['Havregrød med bær', 'Kylling og ris', 'Laks og kartofler', 'Skyr og müsli', 'Pasta med kødsovs', 'Rugbrød med æg']
  const igaar = igaarDato(s.today)
  for (const [i] of planNavne.entries())
    s.tables.meal_logs.push({ id: `e5000000-0000-4000-8000-00000000235${i}`, athlete_id: ATHLETE_ID, date: igaar, meal: egne[i % egne.length], kcal: 400, protein: 25, carb: 40, fat: 10, created_at: `${igaar}T1${i}:00:00Z` })
  return { s, planNavne }
}
async function login(page) {
  await page.goto(APP_URL); await page.evaluate(() => { try { localStorage.clear() } catch { /* ignoreret */ } }); await page.goto(APP_URL)
  await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email); await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
}
const hjem = page => page.locator('[data-u5-today]').first()
const ingenScroll = async (page, hvor) => krav(await page.evaluate(() => document.documentElement.scrollWidth) <= MOBILE.width + 1, `Vandret scroll på 390 px: ${hvor}`)
// Lyst tema sættes rigtigt: appen læser data-tema="lys" (2345s kontrol fandt begge billeder mørke uden).
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
      await login(page); await hjem(page).waitFor({ timeout: 20000 }); await tema(page, sc)
      if (sc === 'light') krav(await page.evaluate(() => document.documentElement.getAttribute('data-tema')) === 'lys', 'lyst tema er ikke sat')
      const knapNavn = `Jeg spiste som i går (${planNavne.length} måltider)`
      await page.getByRole('button', { name: knapNavn, exact: true }).waitFor({ timeout: 20000 })
      await page.getByRole('button', { name: knapNavn, exact: true }).click()
      await page.waitForFunction(n => document.querySelector('[data-u5-today]')?.textContent.includes(`${n} måltider fra i går gemt.`), planNavne.length, { timeout: 20000 })
        .catch(() => { throw new Error(`ingen Fortryd-linje; rækker i dag: ${dagens().map(r => r.meal).join(', ')}`) })
      const navne = dagens().map(r => r.meal).sort()
      krav(JSON.stringify(navne) === JSON.stringify([...planNavne].sort()), `kopien har ikke plannavne: ${navne.join(', ')}`)
      const tekst = await hjem(page).innerText()
      krav(!/Mangler i dag:.*mad/.test(tekst), `Mad mangler efter kopien: ${tekst.slice(0, 160)}`)
      krav(await page.getByRole('button', { name: 'Fortryd', exact: true }).count() === 1, 'Fortryd mangler')
      await ingenScroll(page, 'efter kopi')
      const fortryd = await page.getByRole('button', { name: 'Fortryd', exact: true }).boundingBox()
      krav(fortryd && fortryd.y + fortryd.height <= MOBILE.height - 80, `Fortryd ses ikke over bundmenuen: ${JSON.stringify(fortryd)}`)
      if (process.env.UD_MAPPE) await page.screenshot({ path: `${process.env.UD_MAPPE}/2353-hjem-igaar-${sc === 'light' ? 'lys' : 'moerk'}.png` })
      await page.getByRole('button', { name: 'Fortryd', exact: true }).click()
      await page.waitForFunction(n => document.querySelector('[data-u5-today]')?.textContent.includes(`${n} måltider fra i går er fortrudt.`), planNavne.length, { timeout: 20000 })
      krav(dagens().length === 0, `Fortryd efterlod ${dagens().length} rækker`)
      krav(/Mangler i dag:.*mad/.test(await hjem(page).innerText()), 'Mad står ikke som mangler efter Fortryd')
      await ingenScroll(page, 'efter Fortryd')
      console.log(`OK ${sc}`)
    } catch (e) { try { await page.screenshot({ path: `${process.env.TEMP}/2353-fejl-${sc}.png` }) } catch { /* ignoreret */ } throw new Error(`${sc}: ${e.message}`) }
    finally { await ctx.close(); await mock.close() }
  }
  krav(!errors.length, 'pageerror: ' + errors.join(' | '))
} catch (err) { fejl = err } finally { await browser.close(); await vite.stop() }
if (fejl) { console.error('FEJL:', fejl.message); process.exit(1) }
console.log('2353 e2e grøn')
