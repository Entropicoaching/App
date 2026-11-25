// Ordre 2369 (Marc 25. nov. kl. 18:26: "atleten følger den i appen uden at spørge"): under hvert åbent planmåltid i Kost i dag står varer og gram. 390 px, lys. Kun syntetisk "Atlet W".
// Kør: E2E_VITE_PORT=5371 E2E_MOCK_PORT=8971 VITE_SUPABASE_URL=http://127.0.0.1:8971 UD_MAPPE=<mappe> node e2e/kost-varer-2369.spec.mjs
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { createMockSupabase } from './mock-supabase.mjs'
import { ATHLETE_USER, ATHLETE_ID } from './fixtures.mjs'
import { startVite, launchBrowser, MOCK_PORT, APP_URL } from './harness.mjs'
import { seed as ugeSeed } from './kost-set-paa-main.spec.mjs'

const MOBILE = { width: 390, height: 844 }
const UD = process.env.UD_MAPPE || join(import.meta.dirname, '..', 'plan', '2369')
mkdirSync(UD, { recursive: true })
const krav = (ok, tekst) => { if (!ok) throw new Error(tekst) }

const s = ugeSeed()
s.tables.meal_logs = (s.tables.meal_logs ?? []).filter(r => r.athlete_id !== ATHLETE_ID)
const vite = await startVite(), browser = await launchBrowser(), errors = []
let fejl = null
const mock = createMockSupabase({ users: s.users, tables: structuredClone(s.tables) }); await mock.listen(MOCK_PORT)
try {
  const ctx = await browser.newContext({ viewport: MOBILE, colorScheme: 'light' }), page = await ctx.newPage()
  page.on('pageerror', err => errors.push(err.message))
  await page.goto(APP_URL); await page.evaluate(() => { try { localStorage.clear(); localStorage.setItem('entropi:tema', 'lys') } catch { /* ignoreret */ } }); await page.goto(APP_URL)
  await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email); await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  await page.getByRole('button', { name: 'Kost', exact: true }).first().click({ timeout: 20000 })
  const kost = page.getByRole('region', { name: 'Kost i dag' })
  await kost.waitFor({ state: 'visible', timeout: 20000 })
  const knapper = kost.getByRole('button', { name: /: spist som planlagt$/ })
  await knapper.first().waitFor({ timeout: 15000 })
  const antal = await knapper.count()
  const linjer = await kost.locator('small').allTextContents()
  const varer = linjer.filter(t => / \d+(,\d)? g/.test(t))
  krav(antal > 0 && varer.length === antal, `forventede én varelinje pr. åbent planmåltid (${antal}), fandt ${varer.length}: ${JSON.stringify(varer)}`)
  krav(await page.evaluate(() => document.documentElement.getAttribute('data-tema')) !== 'moerk', 'temaet skal være lyst')
  krav(await page.evaluate(() => document.documentElement.scrollWidth) <= MOBILE.width + 1, 'vandret scroll på 390 px')
  await kost.scrollIntoViewIfNeeded()
  await page.screenshot({ path: join(UD, '2369-varer-lys.png') })
  console.log(JSON.stringify({ aabneMaaltider: antal, varelinjer: varer }))
  await ctx.close()
  if (errors.length) throw new Error('browserfejl: ' + errors.join('; '))
} catch (e) { fejl = e } finally { await mock.close?.(); await browser.close(); await vite.stop() }
if (fejl) { console.error(fejl); process.exitCode = 1 }
