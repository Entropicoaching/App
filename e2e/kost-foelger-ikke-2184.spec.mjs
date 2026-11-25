// Ordre 2184 (Marc 24. nov. kl. 19:11: atleterne skal "rent faktisk følge planerne"): coachen ser "Følger ikke kostplanen"
// under Signaler fra appen (U3-grundene, ordre 2005a) for en atlet med fri pulje, der kun logger 1 af 2 basemåltider.
// Ved 390 px, lys og mørk. Følger atleten planen, står der intet. Kun syntetisk "Atlet W", ingen skrivning.
// Kør: E2E_VITE_PORT=5284 E2E_MOCK_PORT=8984 VITE_SUPABASE_URL=http://127.0.0.1:8984 node e2e/kost-foelger-ikke-2184.spec.mjs
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { createMockSupabase } from './mock-supabase.mjs'
import { COACH_USER, ATHLETE_ID } from './fixtures.mjs'
import { startVite, launchBrowser, MOCK_PORT, APP_URL } from './harness.mjs'
import { seed as ugeSeed } from './kost-set-paa-main.spec.mjs'

const MOBILE = { width: 390, height: 844 }
const UD = process.env.UD_MAPPE || join(import.meta.dirname, '..', 'plan', '2184', 'skaermbilleder')
mkdirSync(UD, { recursive: true })
const GRUND = 'Følger ikke kostplanen'
const plus = (day, n) => new Date(Date.parse(day + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10)
const krav = (ok, tekst) => { if (!ok) throw new Error(tekst) }
// Planen gælder de seneste 15 dage med niveau 20 %; kost logges de seneste dage (dage = 4: 4 af 14 basemåltider fulgt; 7: alle).
function seed({ maaltider, dage = 7 }) {
  const s = ugeSeed(), t = s.tables
  t.weeks = []; t.sessions = []; t.exercises = []; t.exercise_logs = []; t.kostplan_v1_seen = []
  const [foerste, ...resten] = t.kostplan_v1_plans
  t.kostplan_v1_plans = [foerste]
  t.kostplan_v1_versions = t.kostplan_v1_versions.filter(v => v.plan_id === foerste.id)
  t.kostplan_v1_approvals = t.kostplan_v1_approvals.filter(a => a.plan_id === foerste.id)
  void resten
  foerste.valid_from = plus(s.today, -15)
  for (const v of t.kostplan_v1_versions) { v.effective_from = foerste.valid_from; v.calculation_basis = { fri_pct: 20 } }
  for (const a of t.kostplan_v1_approvals) a.approved_at = plus(s.today, -16) + 'T10:00:00.000001Z'
  t.meal_logs = []
  let n = 0
  for (let i = 1; i <= dage; i++) for (const navn of maaltider) t.meal_logs.push({ id: `39000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
    athlete_id: ATHLETE_ID, date: plus(s.today, -i), meal: navn, kcal: 700, protein: 150, carb: 60, fat: 20, created_at: `${plus(s.today, -i)}T12:00:00Z` })
  return s
}
const tema = (page, navn) => page.evaluate(v => (v === 'lys' ? document.documentElement.setAttribute('data-tema', 'lys') : document.documentElement.removeAttribute('data-tema')), navn)
async function login(page) {
  await page.goto(APP_URL); await page.evaluate(() => { try { localStorage.clear() } catch { /* ignoreret */ } }); await page.goto(APP_URL)
  await page.locator('#athlete-auth-email').fill(COACH_USER.email); await page.locator('#athlete-auth-password').fill(COACH_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  await page.getByText('Dine atleter (1)').waitFor({ timeout: 20000 })
}
async function aabnSignaler(page) {
  const mere = page.locator('[data-coach-fold="mere"] > summary')
  await mere.waitFor({ state: 'visible', timeout: 30000 })
  await mere.click()
  return page.locator('section[aria-label="Signaler fra appen"]')
}
const ingenScroll = async (page, hvor) => krav(await page.evaluate(() => document.documentElement.scrollWidth) <= MOBILE.width + 1, `Vandret scroll på 390 px: ${hvor}`)

const vite = await startVite(), browser = await launchBrowser(), errors = []
let fejl = null
try {
  for (const navn of ['lys', 'moerk']) {
    const scheme = navn === 'lys' ? 'light' : 'dark'
    for (const [tekst, opsaet, forventet] of [
      ['kun frokost på 4 af 7 dage (4 af 14 basemåltider)', { maaltider: ['Frokost'], dage: 4 }, true],
      ['følger planen (14 af 14)', { maaltider: ['Frokost', 'Aftensmad'] }, false],
    ]) {
      const s = seed(opsaet); const mock = createMockSupabase({ users: s.users, tables: structuredClone(s.tables) }); await mock.listen(MOCK_PORT)
      const ctx = await browser.newContext({ viewport: MOBILE, colorScheme: scheme }); const page = await ctx.newPage()
      page.on('pageerror', err => errors.push(`${tekst} ${navn}: ${err.message}`))
      try {
        await login(page); await tema(page, navn)
        if (forventet) {
          const sektion = await aabnSignaler(page)
          await sektion.getByText(GRUND, { exact: false }).first().waitFor({ state: 'visible', timeout: 30000 })
          const indhold = await sektion.innerText()
          krav(!/advarsel|fare|alarm|kritisk/i.test(indhold), `${tekst} ${navn}: alarmord i signalet`)
          await ingenScroll(page, `${tekst} ${navn}`)
          await sektion.evaluate(el => el.scrollIntoView({ block: 'center' }))
          await page.screenshot({ path: join(UD, `2184-signal-foelger-ikke-${navn}.png`) })
        } else {
          await aabnSignaler(page).catch(() => null)
          await page.waitForTimeout(3000)
          krav(await page.getByText(GRUND, { exact: false }).count() === 0, `${tekst} ${navn}: signalet må ikke stå`)
          await page.screenshot({ path: join(UD, `2184-ingen-signal-${navn}.png`) })
        }
        console.log(`OK ${tekst} ${navn}`)
      } catch (e) { try { await page.screenshot({ path: join(UD, `2184-fejl-${navn}.png`) }) } catch { /* ignoreret */ } throw new Error(`${tekst} ${navn}: ${e.message}`) }
      finally { await ctx.close(); await mock.close() }
    }
  }
  krav(!errors.length, 'pageerror: ' + errors.join(' | '))
} catch (err) { fejl = err } finally { await browser.close(); await vite.stop() }
if (fejl) { console.error('FEJL:', fejl.message); process.exit(1) }
console.log('2184 e2e grøn')
