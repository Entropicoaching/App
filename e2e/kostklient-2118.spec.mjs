// Ordre 2118 (Marc 24. nov.: "kost kan købes alene"): en kostklient uden træning gennem en hel uge ved 390 px, lys og mørk.
// Dag 1: Hjem, Åbn kost, måltid som planlagt, ret mængde, vand. Dag 3: vægt og Fremgang (ingen løfte- eller programtekst, Åbn kost i stedet
// for Åbn program). Dag 7: indkøbsliste. Dagen efter ugens slut: Hjem. Tryk tælles pr. trin. Kun syntetiske data.
// Kør: node e2e/kostklient-2118.spec.mjs
import { createMockSupabase } from './mock-supabase.mjs'
import { ATHLETE_USER } from './fixtures.mjs'
import { startVite, launchBrowser, MOCK_PORT, APP_URL } from './harness.mjs'
import { seed as ugeSeed } from './kost-set-paa-main.spec.mjs'

const MOBILE = { width: 390, height: 844 }
const plus = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
const FORBUDT = /gentagelser i programmet|styrke på vej|Blok for blok|Åbn program|Log vægt og gentagelser|Åbn dit program|ved at lægge dit program|Se mit program|Start dagens pas|Dit næste pas|0 af 0|Intet program/
// Kostklienten: sendt kostuge der starter `forskydning` dage før i dag, ingen uger, pas eller øvelser; evt. 10 vejninger.
export function seedDag(forskydning, medVaegt = false) {
  const s = ugeSeed()
  s.tables.weeks = []; s.tables.sessions = []; s.tables.exercises = []; s.tables.exercise_logs = []
  s.tables.kostplan_v1_plans.forEach((p, i) => { p.valid_from = plus(s.today, i - forskydning) })
  s.tables.kostplan_v1_versions.forEach((v, i) => { v.effective_from = plus(s.today, i - forskydning) })
  if (medVaegt) for (let i = 1; i <= 10; i++) s.tables.weight_logs.push({ id: `d5000000-0000-4000-8000-0000000001${String(i).padStart(2, '0')}`,
    athlete_id: s.tables.athletes[0].id, logged_at: plus(s.today, -i), weight: Math.round((82.5 + i * 0.15) * 10) / 10, created_at: `${plus(s.today, -i)}T07:00:00Z` })
  return s
}
const krav = (ok, tekst) => { if (!ok) throw new Error(tekst) }
const ingenScroll = async (page, hvor) => krav(await page.evaluate(() => document.documentElement.scrollWidth) <= MOBILE.width + 1, `Vandret scroll på 390 px: ${hvor}`)
const sidetekst = page => page.locator('body').innerText()
async function login(page) {
  await page.goto(APP_URL); await page.evaluate(() => { try { localStorage.clear() } catch { /* ignoreret */ } }); await page.goto(APP_URL)
  await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email); await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
}
const tryk = []
async function klik(page, trin, locator) { await locator.waitFor({ timeout: 20000 }); await locator.click(); tryk.push(trin) }
const ren = async (page, hvor) => { const t = await sidetekst(page); const m = t.match(FORBUDT); krav(!m, `${hvor}: trænings- eller programtekst "${m?.[0]}"`); await ingenScroll(page, hvor) }
const knap = (page, navn) => page.getByRole('button', { name: navn, exact: true }).first()

const dage = [
  ['dag 1', 0, false, async (page, mock) => {
    await page.getByText('Din kost i dag').first().waitFor({ timeout: 20000 }); await ren(page, 'dag 1 Hjem')
    await klik(page, 'Åbn kost', knap(page, 'Åbn kost'))
    await klik(page, 'Frokost som planlagt', knap(page, 'Frokost: spist som planlagt'))
    await page.getByText('Frokost gemt.').waitFor({ timeout: 15000 })
    await klik(page, 'Ret mængde', knap(page, 'Ret mængde: Frokost'))
    await page.locator('input[inputmode="decimal"], input[type="number"]').first().fill('250'); tryk.push('skriv 250 g (tastning)')
    await klik(page, 'Gem Frokost', knap(page, 'Gem Frokost'))
    await klik(page, 'Vand 250 ml', knap(page, 'Drukket 250 ml vand'))
    await page.getByText('250 ml').first().waitFor({ timeout: 15000 }); await ren(page, 'dag 1 Kost')
    krav(mock.table('meal_logs').length >= 1, 'Måltidet blev ikke gemt')
  }],
  ['dag 3', 2, true, async page => {
    await page.getByText('Din kost i dag').first().waitFor({ timeout: 20000 }); await ren(page, 'dag 3 Hjem')
    await klik(page, 'Fremgang', knap(page, 'Fremgang'))
    await page.getByText('Din analyse').first().waitFor({ timeout: 20000 })
    await page.getByText('Vægt').first().waitFor({ timeout: 20000 })
    await ren(page, 'dag 3 Fremgang')
    await klik(page, 'Åbn kost (Fremgang)', knap(page, 'Åbn kost'))
    await page.getByRole('region', { name: 'Kost i dag' }).waitFor({ timeout: 20000 })
  }],
  ['dag 7', 6, false, async page => {
    await klik(page, 'Åbn kost', knap(page, 'Åbn kost'))
    await klik(page, 'Vis detaljer', knap(page, 'Vis detaljer'))
    await page.getByText('Indkøb fra kostplanen').first().waitFor({ timeout: 20000 })
    await knap(page, 'Kopiér indkøbsliste').waitFor({ timeout: 20000 }); await ingenScroll(page, 'dag 7 indkøb')
  }],
  ['dagen efter ugens slut', 7, false, async page => {
    await page.getByText('Din kost i dag').first().waitFor({ timeout: 20000 }); await ren(page, 'dag 8 Hjem')
    await klik(page, 'Åbn kost', knap(page, 'Åbn kost'))
    await page.getByRole('region', { name: 'Kost i dag' }).waitFor({ timeout: 20000 }); await ren(page, 'dag 8 Kost')
  }],
]
const vite = await startVite(), browser = await launchBrowser(), errors = []
let fejl = null
try {
  for (const scheme of ['light', 'dark']) for (const [navn, forskydning, vaegt, run] of dage) {
    const s = seedDag(forskydning, vaegt); const mock = createMockSupabase({ users: s.users, tables: structuredClone(s.tables) }); await mock.listen(MOCK_PORT)
    const ctx = await browser.newContext({ viewport: MOBILE, colorScheme: scheme }); const page = await ctx.newPage()
    page.on('pageerror', err => errors.push(`${navn} ${scheme}: ${err.message}`))
    tryk.length = 0
    try { await login(page); await run(page, mock); console.log(`OK ${navn} ${scheme}: ${tryk.length} trin: ${tryk.join(' > ')}`) } finally { await ctx.close(); await mock.close() }
  }
  krav(!errors.length, 'pageerror: ' + errors.join(' | '))
} catch (err) { fejl = err } finally { await browser.close(); await vite.stop() }
if (fejl) { console.error('FEJL:', fejl.message); process.exit(1) }
console.log('2118 e2e grøn')
