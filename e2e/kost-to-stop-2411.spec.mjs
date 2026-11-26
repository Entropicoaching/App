// Ordre 2411 (to niveau 3 stop fra 2403): "Fjern" ombrydes ikke ved 390 px; Kost i dag viser ikke "Henter dagens tal…" under gem, og Hjem viser "Klaret: mad" straks efter gem.
// Sendt kostuge med fri pulje 15 %, plan med Mellemmåltid (lang række), 390 px, lys og mørk. Kun syntetiske data.
// Kør: E2E_VITE_PORT=5411 E2E_MOCK_PORT=8411 VITE_SUPABASE_URL=http://127.0.0.1:8411 node e2e/kost-to-stop-2411.spec.mjs
import { createMockSupabase } from './mock-supabase.mjs'
import { ATHLETE_USER } from './fixtures.mjs'
import { startVite, launchBrowser, MOCK_PORT, APP_URL } from './harness.mjs'
import { seed as ugeSeed } from './kost-set-paa-main.spec.mjs'
import { createPlanSnapshot } from '../src/entropi2/kostplan/planSnapshot.mjs'

const MOBILE = { width: 390, height: 844 }
const krav = (ok, tekst) => { if (!ok) throw new Error(tekst) }
const food = (id, name, kcal = 150, protein = 10) => ({ id, name, preparation: 'syntetisk', basisGrams: 100,
  nutrientsPer100g: { energyKcal: kcal, proteinG: protein, carbohydrateG: 15, fatG: 4 }, source: { citation: 'syntetisk fixture', verification: 'syntetisk' } })
const maaltid = (name, antal, grams = 60) => ({ name, portions: Array.from({ length: antal }, (_, i) => ({ grams, food: food(`syn:${name}${i}`, `${name}vare${i + 1}`) })) })
const MEALS = [maaltid('Morgenmad', 3, 100), maaltid('Frokost', 4), maaltid('Mellemmåltid sent på aftenen', 3, 148), maaltid('Aftensmad', 4, 80)]
function seedKlient() {
  const s = ugeSeed()
  s.tables.weeks = []; s.tables.sessions = []; s.tables.exercises = []; s.tables.exercise_logs = []
  const snap = structuredClone(createPlanSnapshot({ goal: 'vedligehold', intensity: 0, meals: MEALS }))
  for (const v of s.tables.kostplan_v1_versions) { Object.assign(v, snap); v.calculation_basis = { fri_pct: 15 } }
  return s
}
async function login(page) {
  await page.goto(APP_URL); await page.evaluate(() => { try { localStorage.clear() } catch { /* ignoreret */ } }); await page.goto(APP_URL)
  await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email); await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
}
const tema = (page, navn) => page.evaluate(v => (v === 'light' ? document.documentElement.setAttribute('data-tema', 'lys') : document.documentElement.removeAttribute('data-tema')), navn)
const vite = await startVite(), browser = await launchBrowser(), errors = []
let fejl = null
try {
  for (const sc of ['light', 'dark']) {
    const s = seedKlient()
    const mock = createMockSupabase({ users: s.users, tables: structuredClone(s.tables) }); await mock.listen(MOCK_PORT)
    const ctx = await browser.newContext({ viewport: MOBILE, colorScheme: sc }); const page = await ctx.newPage()
    page.on('pageerror', err => errors.push(`${sc}: ${err.message}`))
    page.on('console', m => { if (m.type() === 'error' && !/on_conflict|409|400|404/.test(m.text())) errors.push(`${sc}: konsol ${m.text()}`) })
    try {
      await login(page)
      await page.getByRole('button', { name: 'Kost', exact: true }).first().click({ timeout: 20000 })
      const kort = page.getByRole('region', { name: 'Kost i dag' })
      await kort.waitFor({ state: 'visible', timeout: 20000 })
      await tema(page, sc)
      await kort.getByRole('button', { name: 'Frokost: spist som planlagt', exact: true }).waitFor({ timeout: 20000 })
      await page.waitForFunction(() => /I dag [\d.]+ /.test(document.querySelector('[data-kost-i-dag-tal]')?.textContent ?? ''), null, { timeout: 20000 })
      // Stop 2a: efter første viste sum må headeren aldrig vise "Henter dagens tal…" igen.
      await page.evaluate(() => {
        window.__tal = []
        const tag = () => { const n = document.querySelector('[data-kost-i-dag-tal]'); if (n) window.__tal.push(n.textContent) }
        new MutationObserver(tag).observe(document.body, { subtree: true, childList: true, characterData: true }); tag()
      })
      await kort.getByRole('button', { name: /^Alt som planlagt/ }).click()
      await kort.getByText(/planmåltider gemt som planlagt/).waitFor({ timeout: 25000 })
      const tal = await page.evaluate(() => window.__tal)
      console.log(`${sc} header under gem: ${[...new Set(tal.map(t => t.replace(/ · .*/, '')))].join(' | ')}`)
      krav(!tal.some(t => /Henter dagens tal/.test(t)), 'headeren viste "Henter dagens tal…" under gem')
      // Stop 1: Fjern står på én linje og ligger inden for skærmen.
      const fjern = kort.getByRole('button', { name: /^Fjern måltid: Mellemmåltid/ })
      await fjern.waitFor({ timeout: 20000 })
      const box = await fjern.boundingBox()
      const tekstH = await fjern.evaluate(el => parseFloat(getComputedStyle(el).lineHeight) || parseFloat(getComputedStyle(el).fontSize) * 1.2)
      console.log(`${sc} Fjern ${Math.round(box.width)}x${Math.round(box.height)} px, linjehøjde ${Math.round(tekstH)}`)
      krav(box.height <= 44 + tekstH / 2 && box.x >= 0 && box.x + box.width <= MOBILE.width, 'Fjern ombrydes eller ligger uden for 390 px')
      krav(await fjern.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'Fjern-teksten er afskåret')
      krav(await page.evaluate(() => document.documentElement.scrollWidth) <= MOBILE.width + 1, 'vandret scroll på 390 px')
      if (process.env.UD_MAPPE && sc === 'light') { await kort.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${process.env.UD_MAPPE}/2411-fjern-lys.png` }) }
      // Stop 2b: straks efter gem viser Hjem "Klaret: mad".
      await page.getByRole('button', { name: 'Hjem', exact: true }).first().click()
      await page.getByText(/Mangler i dag|Alt er logget i dag/).first().waitFor({ timeout: 20000 })
      const straks = await page.innerText('body')
      const senere = await page.waitForFunction(() => /Klaret:[^\n]*mad/.test(document.body.innerText), null, { timeout: 8000 }).then(() => true, () => false)
      console.log(`${sc} Klaret kommer senere: ${senere}; Hjem-tekst: ${straks.replace(/\n+/g, ' | ').slice(0, 400)}`)
      console.log(`${sc} Hjem straks: ${straks.match(/Klaret:[^\n]*/)?.[0] ?? '(ingen Klaret-linje)'}`)
      krav(/Klaret:[^\n]*mad/.test(straks), 'Hjem mangler "Klaret: mad" straks efter gem')
      console.log(`OK ${sc}`)
    } catch (e) { try { await page.screenshot({ path: `${process.env.TEMP}/2411-fejl-${sc}.png` }) } catch { /* ignoreret */ } throw new Error(`${sc}: ${e.message}`) }
    finally { await ctx.close(); await mock.close() }
  }
  krav(!errors.length, 'fejl i browseren: ' + errors.join(' | '))
} catch (err) { fejl = err } finally { await browser.close(); await vite.stop() }
if (fejl) { console.error('FEJL:', fejl.message); process.exit(1) }
console.log('2411 e2e grøn')
