// Ordre 2387 (de tre niveau 3 stop fra 2384): Alt fra i går med andre retter end planen, det faste mål i headeren og hele kcal i Tilbage i dag.
// Kostklient med sendt kostuge (Frokost 450 kcal / 30 g, Aftensmad 600 kcal / 40 g), 390 px, lys og mørk, dag 1 (ingen rækker i går) og dag 2 (andre retter i går). Kun syntetiske data.
// Kør: E2E_VITE_PORT=5387 E2E_MOCK_PORT=8387 VITE_SUPABASE_URL=http://127.0.0.1:8387 node e2e/kost-tre-smaa-stop-2387.spec.mjs
import { createMockSupabase } from './mock-supabase.mjs'
import { ATHLETE_USER, ATHLETE_ID } from './fixtures.mjs'
import { startVite, launchBrowser, MOCK_PORT, APP_URL } from './harness.mjs'
import { seed as ugeSeed } from './kost-set-paa-main.spec.mjs'

const MOBILE = { width: 390, height: 844 }
const krav = (ok, tekst) => { if (!ok) throw new Error(tekst) }
const igaarDato = today => new Date(Date.parse(today + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10)
function seedKlient(dag2) {
  const s = ugeSeed()
  s.tables.weeks = []; s.tables.sessions = []; s.tables.exercises = []; s.tables.exercise_logs = []
  const igaar = igaarDato(s.today)
  const raekke = (i, meal, kcal, protein) => ({ id: `e7000000-0000-4000-8000-00000000238${i}`, athlete_id: ATHLETE_ID, date: igaar, meal, kcal, protein, carb: 40, fat: 10, created_at: `${igaar}T12:0${i}:00.000Z` })
  if (dag2) s.tables.meal_logs.push(raekke(1, 'Frokost', 900, 60), raekke(2, 'Aftensmad', 300, 20))
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
  for (const [sc, dag2] of [['light', false], ['dark', true], ['light', true]]) {
    const s = seedKlient(dag2)
    const mock = createMockSupabase({ users: s.users, tables: structuredClone(s.tables) }); await mock.listen(MOCK_PORT)
    const ctx = await browser.newContext({ viewport: MOBILE, colorScheme: sc }); const page = await ctx.newPage()
    const navn = `${sc}${dag2 ? ' dag 2' : ' dag 1'}`
    page.on('pageerror', err => errors.push(`${navn}: ${err.message}`))
    page.on('response', r => { if (r.status() === 404) console.log('404 ' + r.url().split('?')[0]) })
    page.on('console', m => { if (m.type() === 'error' && !/on_conflict|409|400|404/.test(m.text())) errors.push(`${navn}: konsol ${m.text()}`) })
    const dagens = () => mock.table('meal_logs').filter(r => r.athlete_id === ATHLETE_ID && r.date === s.today)
    try {
      await login(page)
      await page.getByRole('button', { name: 'Kost', exact: true }).first().click({ timeout: 20000 })
      const kort = page.getByRole('region', { name: 'Kost i dag' })
      await kort.waitFor({ state: 'visible', timeout: 20000 })
      await tema(page, sc)
      await kort.getByRole('button', { name: 'Frokost: spist som planlagt', exact: true }).waitFor({ timeout: 20000 })
      const tekst = await kort.innerText()
      console.log(`${navn} header: ${tekst.split('\n').slice(0, 6).join(' | ')}`)
      krav(/Mål [\d.]+ kcal/.test(tekst) || !/Dagens plan/.test(tekst), 'mål mangler')
      krav(!/af 1\.050 kcal/.test(tekst), 'dagens plan står stadig som mål')
      await ingenScroll(page, 'Kost i dag')
      if (dag2) {
        const knap = kort.getByRole('button', { name: 'Spis som i går (andre retter end planen)', exact: true })
        await knap.waitFor({ timeout: 20000 }); await knap.scrollIntoViewIfNeeded()
        if (process.env.UD_MAPPE && sc === 'dark') await page.screenshot({ path: `${process.env.UD_MAPPE}/2387-dag2-foer-moerk.png` })
        await knap.click()
        await kort.getByText('logget som andre retter end planen').first().waitFor({ timeout: 20000 })
        const navne = dagens().map(r => `${r.meal} ${r.kcal}`)
        krav(JSON.stringify(navne) === JSON.stringify(['Frokost 900', 'Aftensmad 300']), `andre rækker end før: ${navne.join(', ')}`)
        krav(/Planen: /.test(await kort.innerText()), 'planens linje forsvandt')
        await ingenScroll(page, 'efter Spis som i går')
        if (process.env.UD_MAPPE) { await kort.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${process.env.UD_MAPPE}/2387-dag2-${sc === 'light' ? 'lys' : 'moerk'}.png` }) }
      } else if (process.env.UD_MAPPE) await page.screenshot({ path: `${process.env.UD_MAPPE}/2387-dag1-lys.png` })
      // Vis detaljer: Tilbage i dag uden decimal.
      const detaljer = page.getByRole('button', { name: /Vis detaljer/ }).first()
      if (await detaljer.count()) await detaljer.click()
      const body = await page.innerText('body')
      const tilbage = body.match(/Tilbage i dag: [^\n]*/g) ?? []
      console.log(`${navn} tilbage: ${tilbage.join(' / ') || '(ikke vist)'}`)
      krav(tilbage.every(t => !/\d,\d+ kcal/.test(t)), 'decimal i Tilbage i dag')
      console.log(`OK ${navn}`)
    } catch (e) { try { await page.screenshot({ path: `${process.env.TEMP}/2387-fejl-${sc}.png` }) } catch { /* ignoreret */ } throw new Error(`${navn}: ${e.message}`) }
    finally { await ctx.close(); await mock.close() }
  }
  krav(!errors.length, 'fejl i browseren: ' + errors.join(' | '))
} catch (err) { fejl = err } finally { await browser.close(); await vite.stop() }
if (fejl) { console.error('FEJL:', fejl.message); process.exit(1) }
console.log('2387 e2e grøn')
