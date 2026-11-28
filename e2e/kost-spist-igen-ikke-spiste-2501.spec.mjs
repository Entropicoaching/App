// Ordre 2501 (2492 fund 4): "Spist igen" viser ikke et planmåltid, der er logget i dag. 390 px, lys og mørk. Kun syntetisk "Atlet W".
// Kør: E2E_VITE_PORT=5501 E2E_MOCK_PORT=8951 VITE_SUPABASE_URL=http://127.0.0.1:8951 node e2e/kost-spist-igen-ikke-spiste-2501.spec.mjs
import { createMockSupabase } from './mock-supabase.mjs'
import { ATHLETE_USER, ATHLETE_ID } from './fixtures.mjs'
import { startVite, launchBrowser, MOCK_PORT, APP_URL } from './harness.mjs'
import { seed as ugeSeed } from './kost-set-paa-main.spec.mjs'

const MOBILE = { width: 390, height: 844 }
const krav = (ok, tekst) => { if (!ok) throw new Error(tekst) }

function seed() {
  const s = ugeSeed()
  s.tables.meal_logs = (s.tables.meal_logs ?? []).filter(r => r.athlete_id !== ATHLETE_ID)
  const i = new Date(`${s.today}T12:00:00Z`); i.setUTCDate(i.getUTCDate() - 1)
  const igaar = i.toISOString().slice(0, 10)
  const row = (id, date, meal, kcal, protein) => ({ id, athlete_id: ATHLETE_ID, date, meal, kcal, protein, carb: 50, fat: 15, created_at: `${date}T18:00:00Z` })
  s.tables.meal_logs.push(
    row('50100000-0000-4000-8000-000000000001', igaar, 'Aftensmad', 640, 40),
    row('50100000-0000-4000-8000-000000000002', igaar, 'Snack', 220, 12),
    row('50100000-0000-4000-8000-000000000003', s.today, 'Aftensmad', 640, 40))
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
      await page.evaluate(v => (v === 'lys' ? document.documentElement.setAttribute('data-tema', 'lys') : document.documentElement.removeAttribute('data-tema')), navn)
      await kost.getByText('Logget: Aftensmad').waitFor({ timeout: 15000 })
      await kost.getByRole('button', { name: 'Spist igen: Snack' }).waitFor({ timeout: 10000 })
      krav(await kost.getByRole('button', { name: 'Spist igen: Aftensmad' }).count() === 0, `${navn}: Aftensmad er logget i dag og må ikke stå i Spist igen`)
      krav(await page.evaluate(() => document.documentElement.scrollWidth) <= MOBILE.width + 1, `${navn}: vandret scroll på 390 px`)
      krav(mock.table('meal_logs').filter(r => r.athlete_id === ATHLETE_ID && r.date === s.today).length === 1, `${navn}: intet må logges af visningen`)
      console.log(JSON.stringify({ tema: navn, ok: true }))
    } finally { await ctx.close(); await mock.close?.() }
  }
  if (errors.length) throw new Error('browserfejl: ' + errors.join('; '))
} catch (e) { fejl = e } finally { await browser.close(); await vite.stop() }
if (fejl) { console.error(fejl); process.exitCode = 1 }
