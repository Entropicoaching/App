// Ordre 2373 (Marc 25. nov. kl. 18:26: "atleten følger den i appen uden at spørge"): indkøbslisten tager hele ugen (7 dage fra i dag) med de samme gram som dagen. 390 px, lys. Kun syntetisk "Atlet W".
// Kør: E2E_VITE_PORT=5373 E2E_MOCK_PORT=8973 VITE_SUPABASE_URL=http://127.0.0.1:8973 UD_MAPPE=<mappe> node e2e/kost-indkoeb-uge-2373.spec.mjs
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { createMockSupabase } from './mock-supabase.mjs'
import { ATHLETE_USER, ATHLETE_ID } from './fixtures.mjs'
import { startVite, launchBrowser, MOCK_PORT, APP_URL } from './harness.mjs'
import { seed as ugeSeed } from './kost-set-paa-main.spec.mjs'

const MOBILE = { width: 390, height: 844 }
const UD = process.env.UD_MAPPE || join(import.meta.dirname, '..', 'plan', '2373')
mkdirSync(UD, { recursive: true })
const krav = (ok, tekst) => { if (!ok) throw new Error(tekst) }
const plus = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }

// Sendt uge der starter i dag: 7 dagsplaner, i dag er dag 1.
const s = ugeSeed()
s.tables.meal_logs = (s.tables.meal_logs ?? []).filter(r => r.athlete_id !== ATHLETE_ID)
s.tables.kostplan_v1_plans.forEach((p, i) => { p.valid_from = plus(s.today, i) })
s.tables.kostplan_v1_versions.forEach((v, i) => { v.effective_from = plus(s.today, i) })
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
  await kost.getByRole('button', { name: /: spist som planlagt$/ }).first().waitFor({ timeout: 15000 })
  // Dagens varelinjer (2369): gram efter skalering, som dagen viser dem.
  const dagLinjer = (await kost.locator('small').allTextContents()).filter(t => / \d+(,\d)? g/.test(t))
  krav(dagLinjer.length > 0, 'ingen varelinjer i dag')
  await page.getByRole('button', { name: 'Vis detaljer', exact: true }).first().click({ timeout: 20000 })
  const indkoeb = page.getByRole('region', { name: 'Indkøb fra kostplanen' })
  await indkoeb.waitFor({ state: 'visible', timeout: 20000 })
  await indkoeb.getByRole('button', { name: 'Hele ugen', exact: true }).click({ timeout: 20000 })
  const liste = indkoeb.getByRole('list', { name: 'Samlet bruttobehov' })
  await liste.waitFor({ state: 'visible', timeout: 20000 })
  await page.waitForFunction(() => /Valgte dage:[^]*?Hent indkøbsgrundlag/.test(document.body.innerText) && document.body.innerText.split('Valgte dage:')[1].split('Hent indkøbsgrundlag')[0].split(',').length === 7, null, { timeout: 20000 })
  const valgte = (await indkoeb.innerText()).split('Valgte dage:')[1].split('Hent indkøbsgrundlag')[0]
  krav(valgte.split(',').length === 7, 'forventede 7 valgte dage: ' + valgte)
  const raekker = (await liste.locator('li > div > span').allTextContents()).map(t => t.trim())
  krav(raekker.length > 0, 'ingen rækker i indkøbslisten')
  // Hver vare i dagens linje findes i listen med mindst dagens gram og hele 5 g (7 dage af hele 5 g).
  const tal = t => Number(t.match(/(\d+(?:,\d+)?) g/)[1].replace(',', '.'))
  for (const linje of dagLinjer) for (const del of linje.split('·').map(x => x.trim()).filter(Boolean)) {
    const navn = del.replace(/\s+\d+(,\d+)? g.*$/, '').trim(), dag = tal(del)
    const række = raekker.find(r => r.startsWith(navn + ':'))
    krav(række, `varen ${navn} mangler i indkøbslisten`)
    krav(tal(række) >= dag && tal(række) % 5 === 0, `listen skal tage hele ugen og hele 5 g: ${række} mod dagens ${del}`)
  }
  krav(await page.evaluate(() => document.documentElement.getAttribute('data-tema')) !== 'moerk', 'temaet skal være lyst')
  krav(await page.evaluate(() => document.documentElement.scrollWidth) <= MOBILE.width + 1, 'vandret scroll på 390 px')
  await indkoeb.scrollIntoViewIfNeeded()
  await page.screenshot({ path: join(UD, '2373-indkoeb-hele-ugen-lys.png') })
  console.log(JSON.stringify({ valgteDage: valgte.trim(), varer: raekker.length, foerste: raekker.slice(0, 3) }))
  await ctx.close()
  if (errors.length) throw new Error('browserfejl: ' + errors.join('; '))
} catch (e) { fejl = e } finally { await mock.close?.(); await browser.close(); await vite.stop() }
if (fejl) { console.error(fejl); process.exitCode = 1 }
