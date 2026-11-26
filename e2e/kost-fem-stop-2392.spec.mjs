// Ordre 2392 (de fem niveau 3 stop fra 2389): alle varer ved højst 6, ingen sum over målet under "Alt som planlagt", pulje og ugetal.
// Sendt kostuge med fri pulje 15 % (Morgenmad 3 varer, Frokost 7, Aftensmad 6), 390 px, lys og mørk, dag 1 og dag 2 (andre retter i går). Kun syntetiske data.
// Kør: E2E_VITE_PORT=5392 E2E_MOCK_PORT=8392 VITE_SUPABASE_URL=http://127.0.0.1:8392 node e2e/kost-fem-stop-2392.spec.mjs
import { createMockSupabase } from './mock-supabase.mjs'
import { ATHLETE_USER, ATHLETE_ID } from './fixtures.mjs'
import { startVite, launchBrowser, MOCK_PORT, APP_URL } from './harness.mjs'
import { seed as ugeSeed } from './kost-set-paa-main.spec.mjs'
import { createPlanSnapshot } from '../src/entropi2/kostplan/planSnapshot.mjs'
import { friKcalAf } from '../src/entropi2/kostplan/friPulje.mjs'

const MOBILE = { width: 390, height: 844 }
const krav = (ok, tekst) => { if (!ok) throw new Error(tekst) }
const igaarDato = today => new Date(Date.parse(today + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10)
const food = (id, name, kcal = 150, protein = 10) => ({ id, name, preparation: 'syntetisk', basisGrams: 100,
  nutrientsPer100g: { energyKcal: kcal, proteinG: protein, carbohydrateG: 15, fatG: 4 }, source: { citation: 'syntetisk fixture', verification: 'syntetisk' } })
const maaltid = (name, antal, grams = 60) => ({ name, portions: Array.from({ length: antal }, (_, i) => ({ grams, food: food(`syn:${name}${i}`, `${name}vare${i + 1}`) })) })
const MEALS = [maaltid('Morgenmad', 3, 100), maaltid('Frokost', 7), maaltid('Aftensmad', 6, 80)]
const PLAN_KCAL = Math.round(MEALS.flatMap(m => m.portions).reduce((n, p) => n + p.grams * 1.5, 0))
function seedKlient(dag2) {
  const s = ugeSeed()
  s.tables.weeks = []; s.tables.sessions = []; s.tables.exercises = []; s.tables.exercise_logs = []
  const snap = structuredClone(createPlanSnapshot({ goal: 'vedligehold', intensity: 0, meals: MEALS }))
  for (const v of s.tables.kostplan_v1_versions) { Object.assign(v, snap); v.calculation_basis = { fri_pct: 15 } }
  const igaar = igaarDato(s.today)
  const raekke = (i, meal, kcal, protein) => ({ id: `e7000000-0000-4000-8000-00000000239${i}`, athlete_id: ATHLETE_ID, date: igaar, meal, kcal, protein, carb: 40, fat: 10, created_at: `${igaar}T12:0${i}:00.000Z` })
  if (dag2) s.tables.meal_logs.push(raekke(1, 'Morgenmad', 900, 60), raekke(2, 'Frokost', 300, 20), raekke(3, 'Aftensmad', 200, 10))
  return s
}
async function login(page) {
  await page.goto(APP_URL); await page.evaluate(() => { try { localStorage.clear() } catch { /* ignoreret */ } }); await page.goto(APP_URL)
  await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email); await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
}
const ingenScroll = async (page, hvor) => krav(await page.evaluate(() => document.documentElement.scrollWidth) <= MOBILE.width + 1, `Vandret scroll på 390 px: ${hvor}`)
const tema = (page, navn) => page.evaluate(v => (v === 'light' ? document.documentElement.setAttribute('data-tema', 'lys') : document.documentElement.removeAttribute('data-tema')), navn)
const dk = n => String(n).replace(/(\d)(?=(\d{3})+$)/g, '$1.')
const vite = await startVite(), browser = await launchBrowser(), errors = []
let fejl = null
try {
  for (const [sc, dag2] of [['light', false], ['dark', true], ['light', true]]) {
    const s = seedKlient(dag2)
    const mock = createMockSupabase({ users: s.users, tables: structuredClone(s.tables) }); await mock.listen(MOCK_PORT)
    const ctx = await browser.newContext({ viewport: MOBILE, colorScheme: sc }); const page = await ctx.newPage()
    const navn = `${sc}${dag2 ? ' dag 2' : ' dag 1'}`
    page.on('pageerror', err => errors.push(`${navn}: ${err.message}`))
    page.on('console', m => { if (m.type() === 'error' && !/on_conflict|409|400|404/.test(m.text())) errors.push(`${navn}: konsol ${m.text()}`) })
    try {
      await login(page)
      await page.getByRole('button', { name: 'Kost', exact: true }).first().click({ timeout: 20000 })
      const kort = page.getByRole('region', { name: 'Kost i dag' })
      await kort.waitFor({ state: 'visible', timeout: 20000 })
      await tema(page, sc)
      await kort.getByRole('button', { name: 'Frokost: spist som planlagt', exact: true }).waitFor({ timeout: 20000 })
      const tekst = await kort.innerText()
      // Stop 1: Aftensmad (6 varer) viser alle; Frokost (7 varer) viser 5 og "+ 2 mere".
      krav(/Aftensmadvare6 70 g/.test(tekst) && !/Aftensmadvare[^\n]*mere/.test(tekst), 'Aftensmad skulle vise alle 6 varer')
      krav(/Frokostvare5 50 g \+ 2 mere/.test(tekst) && !/Frokostvare6/.test(tekst), 'Frokost skulle vise 5 varer og "+ 2 mere"')
      // Stop 3: den frie pulje er puljen af dagens plan, samme afrunding som skillen.
      const pulje = friKcalAf(PLAN_KCAL, 15)
      console.log(`${navn} plan ${PLAN_KCAL} kcal, forventet pulje ${pulje}; fri-tekst: ${(tekst.match(/Fri i dag[^\n]*/) ?? ['(ingen)'])[0]}`)
      krav(tekst.includes(`Fri i dag: ${dk(pulje)} kcal`), 'pulje i Kost i dag afviger fra skillens afrunding')
      await ingenScroll(page, 'Kost i dag')
      // Stop 4: noter alle summer, mens "Alt som planlagt" gemmer; ingen må overstige den sidste.
      await page.evaluate(() => {
        window.__summer = []
        const tag = () => { const n = document.querySelector('[data-kost-i-dag-tal]'); if (n) window.__summer.push(n.textContent) }
        new MutationObserver(tag).observe(document.body, { subtree: true, childList: true, characterData: true }); tag()
      })
      await kort.getByRole('button', { name: /^Alt som planlagt/ }).click()
      await kort.getByText(/planmåltider gemt som planlagt/).waitFor({ timeout: 25000 })
      await page.waitForTimeout(600)
      const summer = await page.evaluate(() => window.__summer)
      const tal = t => Number((t.match(/I dag ([\d.]+) /)?.[1] ?? '0').replace(/\./g, ''))
      const sidste = tal(summer.at(-1))
      console.log(`${navn} summer under gem: ${[...new Set(summer.map(t => t.replace(/ · .*/, '')))].join(' | ')}`)
      krav(summer.every(t => tal(t) <= sidste), 'en sum under gem lå over den gemte sum')
      if (process.env.UD_MAPPE && ((sc === 'light' && !dag2) || (sc === 'dark' && dag2))) { await kort.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${process.env.UD_MAPPE}/2392-${dag2 ? 'dag2-moerk' : 'dag1-lys'}.png` }) }
      // Stop 2: ugens tal.
      const body = await page.innerText('body')
      console.log(`${navn} ugetal: ${body.match(/Seneste 7 dage[^\n]*/)?.[0] ?? '(ikke vist)'}`)
      await ingenScroll(page, 'efter Alt som planlagt')
      console.log(`OK ${navn}`)
    } catch (e) { try { await page.screenshot({ path: `${process.env.TEMP}/2392-fejl-${sc}.png` }) } catch { /* ignoreret */ } throw new Error(`${navn}: ${e.message}`) }
    finally { await ctx.close(); await mock.close() }
  }
  krav(!errors.length, 'fejl i browseren: ' + errors.join(' | '))
} catch (err) { fejl = err } finally { await browser.close(); await vite.stop() }
if (fejl) { console.error('FEJL:', fejl.message); process.exit(1) }
console.log('2392 e2e grøn')
