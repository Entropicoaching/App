// Ordre 2132 (Marc 24. nov.: "kost kan købes alene"): en kostklient uden træning ser ingen træningsknapper i Beskeder, ved 390 px lys og mørk.
// Kontrol: en atlet med uger og pas ser "Send video" og "Del et sæt fra passet" som før. Kun syntetiske data.
// Kør: node e2e/kostklient-2132.spec.mjs
import { createMockSupabase } from './mock-supabase.mjs'
import { ATHLETE_USER } from './fixtures.mjs'
import { startVite, launchBrowser, MOCK_PORT, APP_URL } from './harness.mjs'
import { seed as ugeSeed } from './kost-set-paa-main.spec.mjs'

const MOBILE = { width: 390, height: 844 }
const krav = (ok, tekst) => { if (!ok) throw new Error(tekst) }
function seed(kostklient) {
  const s = ugeSeed()
  if (kostklient) { s.tables.weeks = []; s.tables.sessions = []; s.tables.exercises = []; s.tables.exercise_logs = [] }
  return s
}
async function login(page) {
  await page.goto(APP_URL); await page.evaluate(() => { try { localStorage.clear() } catch { /* ignoreret */ } }); await page.goto(APP_URL)
  await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email); await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
}
const antal = (page, navn) => page.getByText(navn, { exact: true }).count()
const vite = await startVite(), browser = await launchBrowser(), errors = []
let fejl = null
try {
  for (const scheme of ['light', 'dark']) for (const [navn, kostklient] of [['kostklient', true], ['atlet med program', false]]) {
    const s = seed(kostklient); const mock = createMockSupabase({ users: s.users, tables: structuredClone(s.tables) }); await mock.listen(MOCK_PORT)
    const ctx = await browser.newContext({ viewport: MOBILE, colorScheme: scheme }); const page = await ctx.newPage()
    page.on('pageerror', err => errors.push(`${navn} ${scheme}: ${err.message}`))
    try {
      await login(page)
      const beskeder = page.getByRole('button', { name: 'Beskeder' }).first()
      await beskeder.waitFor({ timeout: 20000 }); await beskeder.click()
      await page.getByRole('button', { name: 'Send', exact: true }).first().waitFor({ timeout: 20000 })
      await page.waitForTimeout(2500) // læsningen af uger og historik er færdig
      const video = await antal(page, 'Send video'), saet = await antal(page, 'Del et sæt fra passet')
      console.log(`${navn} ${scheme}: Send video ${video}, Del et sæt fra passet ${saet}, Send ${await page.getByRole('button', { name: 'Send', exact: true }).count()}, 1 tryk (Beskeder)`)
      krav(video === (kostklient ? 0 : 1) && saet === (kostklient ? 0 : 1), `${navn} ${scheme}: forkert antal træningsknapper (${video}/${saet})`)
      krav(await page.evaluate(() => document.documentElement.scrollWidth) <= MOBILE.width + 1, 'Vandret scroll på 390 px')
    } finally { await ctx.close(); await mock.close() }
  }
  krav(!errors.length, 'pageerror: ' + errors.join(' | '))
} catch (err) { fejl = err } finally { await browser.close(); await vite.stop() }
if (fejl) { console.error('FEJL:', fejl.message); process.exit(1) }
console.log('2132 e2e grøn')
