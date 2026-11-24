// Ordre 2123 (Marc 24. nov.: "kost kan købes alene"): kostklientens indkøbsliste ved 390 px, lys og mørk.
// Mål: danske datoer ("tirsdag 24. nov.") og kun dage i den sendte kostuges 7 dage. Dag 1, dag 7 og dagen efter ugens slut.
// Kør: E2E_VITE_PORT=5223 E2E_MOCK_PORT=8923 VITE_SUPABASE_URL=http://127.0.0.1:8923 node e2e/kostklient-2123.spec.mjs
import { createMockSupabase } from './mock-supabase.mjs'
import { ATHLETE_USER } from './fixtures.mjs'
import { startVite, launchBrowser, MOCK_PORT, APP_URL } from './harness.mjs'
import { seed as ugeSeed } from './kost-set-paa-main.spec.mjs'

const MOBILE = { width: 390, height: 844 }
const plus = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
// Kostklient: sendt kostuge der starter `forskydning` dage før i dag, ingen uger, pas eller øvelser.
function seedDag(forskydning) {
  const s = ugeSeed()
  s.tables.weeks = []; s.tables.sessions = []; s.tables.exercises = []; s.tables.exercise_logs = []
  s.tables.kostplan_v1_plans.forEach((p, i) => { p.valid_from = plus(s.today, i - forskydning) })
  s.tables.kostplan_v1_versions.forEach((v, i) => { v.effective_from = plus(s.today, i - forskydning) })
  return s
}
const krav = (ok, tekst) => { if (!ok) throw new Error(tekst) }
const fund = []; const sjekk = (ok, tekst) => { if (!ok) fund.push(tekst) }
const knap = (page, navn) => page.getByRole('button', { name: navn, exact: true }).first()
const ISO = /\d{4}-\d{2}-\d{2}/
const DANSK = /^(mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag) \d{1,2}\. [a-zæøå]{3,9}\.?$/
async function login(page) {
  await page.goto(APP_URL); await page.evaluate(() => { try { localStorage.clear() } catch { /* ignoreret */ } }); await page.goto(APP_URL)
  await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email); await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
}
// Forskydning = dage siden ugens første dag. Dag 1 = 0, dag 7 = 6, dagen efter ugens slut = 7.
const dage = [['dag 1', 0, 4], ['dag 7', 6, 1], ['dagen efter ugens slut', 7, 0]]
const vite = await startVite(), browser = await launchBrowser(), errors = []
let fejl = null
try {
  for (const scheme of ['light', 'dark']) for (const [navn, forskydning, forventet] of dage) {
    const s = seedDag(forskydning); const mock = createMockSupabase({ users: s.users, tables: structuredClone(s.tables) }); await mock.listen(MOCK_PORT)
    const ctx = await browser.newContext({ viewport: MOBILE, colorScheme: scheme }); const page = await ctx.newPage()
    page.on('pageerror', err => errors.push(`${navn} ${scheme}: ${err.message}`))
    try {
      await login(page)
      await knap(page, 'Åbn kost').waitFor({ timeout: 20000 }); await knap(page, 'Åbn kost').click()
      await knap(page, 'Vis detaljer').waitFor({ timeout: 20000 }); await knap(page, 'Vis detaljer').click()
      await page.getByText('Indkøb fra kostplanen').first().waitFor({ timeout: 20000 })
      await page.locator('section[aria-label="Indkøb fra kostplanen"] [data-shopping-complete]').waitFor({ timeout: 20000 })
      await page.waitForFunction(() => !document.body.innerText.includes('Henter godkendte planer'), null, { timeout: 20000 })
      const boxe = await page.locator('fieldset input[type=checkbox][aria-label^="Indkøb "]').evaluateAll(els => els.map(e => e.getAttribute('aria-label').slice(7)))
      const synlig = await page.locator('section[aria-label="Indkøb fra kostplanen"]').innerText()
      console.log(`${navn} ${scheme}: afkrydsninger [${boxe.join(' | ')}]; ISO i teksten: ${ISO.test(synlig)}`)
      sjekk(!ISO.test(synlig), `${navn} ${scheme}: ISO-dato i indkøbslisten: ${synlig.match(ISO)?.[0]}`)
      sjekk(boxe.length === forventet, `${navn} ${scheme}: ${boxe.length} dage, forventet ${forventet} (${boxe.join(', ')})`)
      for (const b of boxe) sjekk(DANSK.test(b), `${navn} ${scheme}: datoen "${b}" er ikke dansk form`)
      sjekk(await page.evaluate(() => document.documentElement.scrollWidth) <= MOBILE.width + 1, `${navn} ${scheme}: vandret scroll`)
    } finally { await ctx.close(); await mock.close() }
  }
  krav(!errors.length, 'pageerror: ' + errors.join(' | '))
  krav(!fund.length, fund.join('\n'))
} catch (err) { fejl = err } finally { await browser.close(); await vite.stop() }
if (fejl) { console.error('FEJL:', fejl.message); process.exit(1) }
console.log('2123 e2e grøn')
