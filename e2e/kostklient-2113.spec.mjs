// Ordre 2113 (Marc 24. nov.: "kost kan købes alene"): den nye kostklients første dage, kun syntetiske data.
// (a) ny klient uden program og uden kostuge, atlet ved 390 px lys og mørk; (b) coachen ser "Mangler første kostuge" ved en kladde;
// (c) sendt kostuge, der sluttede for 16 dage siden: coachen ser "Mangler ny kostuge", atleten har stadig Kost.
// Kør: node e2e/kostklient-2113.spec.mjs
import { createMockSupabase } from './mock-supabase.mjs'
import { ATHLETE_USER, COACH_USER, buildSeed } from './fixtures.mjs'
import { startVite, launchBrowser, MOCK_PORT, APP_URL } from './harness.mjs'
import { seed as ugeSeed } from './kost-set-paa-main.spec.mjs'

const MOBILE = { width: 390, height: 844 }, DESKTOP = { width: 1280, height: 900 }
const tom = s => { s.tables.weeks = []; s.tables.sessions = []; s.tables.exercises = []; s.tables.exercise_logs = []; return s }
const plus = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
const iDag = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen' }).format(new Date())
const udenKost = () => { const s = tom(buildSeed({})); s.tables.kostplan_v1_plans = []; s.tables.kostplan_v1_versions = []; s.tables.kostplan_v1_approvals = []; return s }
const seeds = {
  ny: udenKost,
  kladde: () => { const s = udenKost(); s.tables.kostplan_v1_plans = [{ id: 'cccccccc-2113-4113-8113-cccccccccccc', athlete_id: s.tables.athletes[0].id, valid_from: plus(iDag(), 1), status: 'forslag' }]; return s },
  udloebet: () => { const s = tom(ugeSeed()); s.tables.kostplan_v1_plans.forEach((p, i) => { p.valid_from = plus(s.today, -22 + i) })
    s.tables.kostplan_v1_versions.forEach((v, i) => { v.effective_from = plus(s.today, -22 + i) }); return s },
}
async function login(page, user) {
  await page.goto(APP_URL); await page.evaluate(() => { try { localStorage.clear() } catch { /* ignoreret */ } }); await page.goto(APP_URL)
  await page.locator('#athlete-auth-email').fill(user.email); await page.locator('#athlete-auth-password').fill(user.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
}
const krav = (ok, tekst) => { if (!ok) throw new Error(tekst) }
const tekst = async (page, ventPaa) => { await page.getByText(ventPaa).first().waitFor({ timeout: 20000 }); return page.locator('body').innerText() }
const ingenScroll = async page => krav(await page.evaluate(() => document.documentElement.scrollWidth) <= MOBILE.width + 1, 'Vandret scroll på 390 px')

const kor = [
  ['atlet ny lys', 'ny', ATHLETE_USER, MOBILE, 'light', async page => { const t = await tekst(page, 'Din coach er ved at lægge dit program'); krav(!/Kost/.test(t.split('Hjem')[0]), 'Kost vises uden sendt kostuge'); await ingenScroll(page) }],
  ['atlet ny moerk', 'ny', ATHLETE_USER, MOBILE, 'dark', async page => { await tekst(page, 'Din coach er ved at lægge dit program'); await ingenScroll(page) }],
  ['atlet udloebet lys', 'udloebet', ATHLETE_USER, MOBILE, 'light', async page => { await tekst(page, 'Din kost i dag'); await ingenScroll(page) }],
  ['atlet udloebet moerk', 'udloebet', ATHLETE_USER, MOBILE, 'dark', async page => { await tekst(page, 'Din kost i dag'); await ingenScroll(page) }],
  ['coach ny: ingen kostuge-linje uden kladde', 'ny', COACH_USER, DESKTOP, 'dark', async page => { const t = await tekst(page, 'Dine atleter (1)'); krav(!/Mangler (første|ny) kostuge/.test(t), 'Kostuge-linje uden kladde') }],
  ['coach kladde: Mangler første kostuge', 'kladde', COACH_USER, DESKTOP, 'dark', async page => { const t = await tekst(page, 'Mangler første kostuge'); krav(!/Mangler ny kostuge/.test(t), 'Forkert linje') }],
  ['coach udloebet: Mangler ny kostuge', 'udloebet', COACH_USER, DESKTOP, 'dark', async page => { const t = await tekst(page, 'Mangler ny kostuge'); krav(/Kostklient/.test(t), 'Kortet siger ikke Kostklient') }],
]
const vite = await startVite(), browser = await launchBrowser(), errors = []
let fejl = null
try {
  for (const [navn, fra, user, vp, scheme, run] of kor) {
    const s = seeds[fra](); const mock = createMockSupabase({ users: s.users, tables: structuredClone(s.tables) }); await mock.listen(MOCK_PORT)
    const ctx = await browser.newContext({ viewport: vp, colorScheme: scheme }); const page = await ctx.newPage()
    page.on('pageerror', err => errors.push(`${navn}: ${err.message}`))
    try { await login(page, user); await run(page); console.log(`OK ${navn}`) } finally { await ctx.close(); await mock.close() }
  }
  krav(!errors.length, 'pageerror: ' + errors.join(' | '))
} catch (err) { fejl = err } finally { await browser.close(); await vite.stop() }
if (fejl) { console.error('FEJL:', fejl.message); process.exit(1) }
console.log('2113 e2e grøn')
