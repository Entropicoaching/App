// Ordre 2348 (Marc 24. nov. kl. 19:11: "rent faktisk følger planerne"): et planmåltid logget under plannavn (Nyt måltid, Spist igen, Hjem)
// står som "Logget", har ingen "spist som planlagt"-knap og logges ikke igen. 390 px, lys og mørk. Kun syntetisk "Atlet W".
// Kør: E2E_VITE_PORT=5348 E2E_MOCK_PORT=8948 VITE_SUPABASE_URL=http://127.0.0.1:8948 UD_MAPPE=<mappe> node e2e/kost-planmaaltid-logget-2348.spec.mjs
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { createMockSupabase } from './mock-supabase.mjs'
import { ATHLETE_USER, ATHLETE_ID } from './fixtures.mjs'
import { startVite, launchBrowser, MOCK_PORT, APP_URL } from './harness.mjs'
import { seed as ugeSeed } from './kost-set-paa-main.spec.mjs'

const MOBILE = { width: 390, height: 844 }
const UD = process.env.UD_MAPPE || join(import.meta.dirname, '..', 'plan', '2348')
mkdirSync(UD, { recursive: true })
const krav = (ok, tekst) => { if (!ok) throw new Error(tekst) }
const tema = (page, navn) => page.evaluate(v => (v === 'lys' ? document.documentElement.setAttribute('data-tema', 'lys') : document.documentElement.removeAttribute('data-tema')), navn)

function seed() {
  const s = ugeSeed()
  s.tables.meal_logs = (s.tables.meal_logs ?? []).filter(r => r.athlete_id !== ATHLETE_ID)
  // Aftensmad er logget i dag under plannavnet (som Nyt måltid eller Spist igen gør), ikke som planlagt.
  s.tables.meal_logs.push({ id: '48000000-0000-4000-8000-000000000001', athlete_id: ATHLETE_ID, date: s.today, meal: 'Aftensmad', kcal: 640, protein: 40, carb: 70, fat: 20, created_at: `${s.today}T18:00:00Z` })
  return s
}

const vite = await startVite(), browser = await launchBrowser(), errors = []
let fejl = null
try {
  for (const navn of ['lys', 'moerk']) {
    const s = seed(), mock = createMockSupabase({ users: s.users, tables: structuredClone(s.tables) }); await mock.listen(MOCK_PORT)
    const ctx = await browser.newContext({ viewport: MOBILE, colorScheme: navn === 'lys' ? 'light' : 'dark' }), page = await ctx.newPage()
    page.on('pageerror', err => errors.push(`${navn}: ${err.message}`))
    try {
      await page.goto(APP_URL); await page.evaluate(() => { try { localStorage.clear() } catch { /* ignoreret */ } }); await page.goto(APP_URL)
      await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email); await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
      await page.getByRole('button', { name: 'Log ind' }).click()
      await page.getByRole('button', { name: 'Kost', exact: true }).first().click({ timeout: 20000 })
      const kost = page.getByRole('region', { name: 'Kost i dag' })
      await kost.waitFor({ state: 'visible', timeout: 20000 })
      await tema(page, navn)
      await kost.getByText('Logget: Aftensmad').waitFor({ timeout: 15000 })
      krav(await kost.getByRole('button', { name: 'Aftensmad: spist som planlagt' }).count() === 0, `${navn}: Aftensmad må ikke kunne spises som planlagt igen`)
      krav(await kost.getByRole('button', { name: /^Alt som planlagt/ }).count() === 0, `${navn}: ét åbent måltid giver ingen samlet knap`)
      const frokost = kost.getByRole('button', { name: 'Frokost: spist som planlagt' })
      await frokost.waitFor({ timeout: 10000 })
      krav(await page.evaluate(() => document.documentElement.scrollWidth) <= MOBILE.width + 1, `${navn}: vandret scroll på 390 px`)
      await kost.scrollIntoViewIfNeeded()
      await page.screenshot({ path: join(UD, `2348-logget-${navn}.png`) })
      await frokost.click(); await frokost.waitFor({ state: 'detached', timeout: 15000 })
      const idag = mock.table('meal_logs').filter(r => r.athlete_id === ATHLETE_ID && r.date === s.today)
      krav(idag.length === 2 && idag.filter(r => r.meal === 'Aftensmad').length === 1, `${navn}: forventede Aftensmad én gang og Frokost, fandt ${idag.map(r => r.meal).join(', ')}`)
      console.log(JSON.stringify({ tema: navn, raekkerIDag: idag.map(r => r.meal) }))
    } finally { await ctx.close(); await mock.close?.() }
  }
  if (errors.length) throw new Error('browserfejl: ' + errors.join('; '))
} catch (e) { fejl = e } finally { await browser.close(); await vite.stop() }
if (fejl) { console.error(fejl); process.exitCode = 1 }
