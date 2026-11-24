// Ordre 2137 (Marc 24. nov.: fast base og en fri kcal-pulje pr. dag, niveau pr. atlet): ved 390 px, lys og mørk.
// 1) Uge med 0 % ser ud som før (ingen "Fri i dag"). 2) Uge med 20 %: atleten ser puljen og logger fri mad (lille og eget kcal-tal).
// 3) Coachen ser niveauet på en sendt uge og kan sætte det på et udkast (en ny version pr. dag med fri_pct). Kun syntetisk "Atlet W".
// Kør: E2E_VITE_PORT=5237 E2E_MOCK_PORT=8937 VITE_SUPABASE_URL=http://127.0.0.1:8937 node e2e/kostklient-2137.spec.mjs
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { createMockSupabase } from './mock-supabase.mjs'
import { ATHLETE_USER, COACH_USER, ATHLETE_ID } from './fixtures.mjs'
import { startVite, launchBrowser, MOCK_PORT, APP_URL } from './harness.mjs'
import { seed as ugeSeed } from './kost-set-paa-main.spec.mjs'

const MOBILE = { width: 390, height: 844 }
const UD = process.env.UD_MAPPE || join(import.meta.dirname, '..', 'plan', '2137', 'skaermbilleder')
mkdirSync(UD, { recursive: true })
const krav = (ok, tekst) => { if (!ok) throw new Error(tekst) }
function seed({ friPct, udkast = false } = {}) {
  const s = ugeSeed()
  s.tables.weeks = []; s.tables.sessions = []; s.tables.exercises = []; s.tables.exercise_logs = []
  s.tables.kostplan_v1_seen = []
  if (friPct !== undefined) for (const v of s.tables.kostplan_v1_versions) v.calculation_basis = { fri_pct: friPct }
  if (udkast) {
    s.tables.kostplan_v1_approvals = []
    for (const p of s.tables.kostplan_v1_plans) p.status = 'forslag'
  }
  return s
}
const tema = (page, navn) => page.evaluate(v => (v === 'lys' ? document.documentElement.setAttribute('data-tema', 'lys') : document.documentElement.removeAttribute('data-tema')), navn)
const ingenScroll = async (page, hvem) => {
  const bredde = await page.evaluate(() => document.documentElement.scrollWidth)
  krav(bredde <= MOBILE.width + 1, `${hvem}: vandret scroll ${bredde}px`)
}
async function login(page, user) {
  await page.goto(APP_URL); await page.evaluate(() => { try { localStorage.clear() } catch { /* ignoreret */ } }); await page.goto(APP_URL)
  await page.locator('#athlete-auth-email').fill(user.email); await page.locator('#athlete-auth-password').fill(user.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
}
async function atletKost(page, navn) {
  await login(page, ATHLETE_USER)
  await page.getByRole('button', { name: 'Kost', exact: true }).first().click({ timeout: 20000 })
  const kost = page.getByRole('region', { name: 'Kost i dag' })
  await kost.waitFor({ state: 'visible', timeout: 20000 })
  await tema(page, navn)
  await kost.getByRole('button', { name: 'Frokost: spist som planlagt' }).waitFor({ timeout: 15000 })
  return kost
}
async function coachUge(page, navn, vaelger) {
  await login(page, COACH_USER)
  await tema(page, navn)
  await page.getByText('Dine atleter (1)').waitFor({ timeout: 20000 })
  await page.getByText('Atlet W', { exact: true }).first().click()
  const fane = page.getByRole('button', { name: /Kost & mål/ }).first()
  if (!(await fane.isVisible().catch(() => false))) await page.getByRole('button', { name: /^Mere/ }).first().click({ timeout: 20000 })
  await fane.click({ timeout: 20000 })
  const uge = page.locator(vaelger)
  await uge.waitFor({ state: 'visible', timeout: 20000 })
  await uge.getByRole('group', { name: 'Fri pulje' }).waitFor({ timeout: 15000 })
  await uge.scrollIntoViewIfNeeded()
  return uge
}

const vite = await startVite(), browser = await launchBrowser(), errors = []
let fejl = null
try {
  for (const navn of ['lys', 'moerk']) {
    const colorScheme = navn === 'lys' ? 'light' : 'dark'
    const nyside = async () => { const ctx = await browser.newContext({ viewport: MOBILE, colorScheme }); const p = await ctx.newPage(); p.on('pageerror', e => errors.push(`${navn}: ${e.message}`)); return { ctx, p } }
    // 1) 0 %: ser ud som før.
    {
      const s = seed({ friPct: 0 }); const mock = createMockSupabase({ users: s.users, tables: structuredClone(s.tables) }); await mock.listen(MOCK_PORT)
      const { ctx, p } = await nyside()
      try {
        const kost = await atletKost(p, navn)
        krav(await p.locator('[data-kost-fri]').count() === 0, `${navn}: 0 % skal ikke vise fri pulje`)
        krav(!(await kost.innerText()).includes('Fri i dag'), `${navn}: 0 % skal ikke vise "Fri i dag"`)
        await ingenScroll(p, `${navn} 0 %`)
        console.log(`${navn}: 0 % uden fri pulje, som før`)
      } finally { await ctx.close(); await mock.close() }
    }
    // 2) 20 %: puljen vises, fri mad logges som lille og som eget kcal-tal.
    {
      const s = seed({ friPct: 20 }); const mock = createMockSupabase({ users: s.users, tables: structuredClone(s.tables) }); await mock.listen(MOCK_PORT)
      const { ctx, p } = await nyside()
      try {
        const kost = await atletKost(p, navn)
        const fri = p.locator('[data-kost-fri]'); await fri.waitFor({ timeout: 15000 })
        const pulje = Number(await fri.getAttribute('data-kost-fri'))
        krav(pulje > 0, `${navn}: puljen skal være over 0`)
        krav((await fri.innerText()).includes('Fri i dag:'), `${navn}: "Fri i dag" mangler`)
        krav((await p.locator('[data-kost-fri-status]').innerText()).includes('Brugt 0 kcal'), `${navn}: puljen skulle starte ubrugt`)
        await ingenScroll(p, `${navn} 20 %`)
        if (navn === 'lys') await p.screenshot({ path: join(UD, '2137-atlet-fri-pulje-lys.png') })
        const rows = () => mock.table('meal_logs').filter(r => r.athlete_id === ATHLETE_ID && String(r.meal).startsWith('Fri: '))
        await kost.getByRole('button', { name: 'Fri mad lille, 100 kcal' }).click()
        await p.waitForFunction(() => document.body.innerText.includes('Brugt 100 kcal'), null, { timeout: 15000 })
        krav(rows().length === 1 && Number(rows()[0].kcal) === 100, `${navn}: lille fri mad skulle gemmes som 100 kcal`)
        await kost.getByRole('textbox', { name: 'Fri mad i kcal' }).fill('300')
        await kost.getByRole('button', { name: 'Log fri mad' }).click()
        await p.waitForFunction(() => document.body.innerText.includes('Brugt 400 kcal'), null, { timeout: 15000 })
        krav(rows().length === 2, `${navn}: eget kcal-tal skulle gemmes`)
        const status = await p.locator('[data-kost-fri-status]').innerText()
        krav(status.includes(`${new Intl.NumberFormat('da-DK').format(pulje - 400)} tilbage`) || status.includes('over puljen'), `${navn}: tilbage mangler: ${status}`)
        await ingenScroll(p, `${navn} 20 % efter logning`)
        if (navn === 'moerk') await p.screenshot({ path: join(UD, '2137-atlet-fri-pulje-moerk.png') })
        console.log(`${navn}: 20 %, pulje ${pulje} kcal, to fri poster logget, status "${status}"`)
      } finally { await ctx.close(); await mock.close() }
    }
    // 3) Coach: sendt uge viser niveauet; udkast kan sættes til 30 %.
    {
      const s = seed({ friPct: 20 }); const mock = createMockSupabase({ users: s.users, tables: structuredClone(s.tables) }); await mock.listen(MOCK_PORT)
      const { ctx, p } = await nyside()
      try {
        const uge = await coachUge(p, navn, '[data-claude-week="sendt"]')
        krav((await uge.innerText()).includes('Fri pulje: 20 % af dagens kcal'), `${navn}: coach skulle se 20 % på den sendte uge`)
        krav(await uge.getByRole('button', { name: '30 %' }).count() === 0, `${navn}: en sendt uge skal ikke kunne ændres`)
        await ingenScroll(p, `${navn} coach sendt`)
        if (navn === 'moerk') await p.screenshot({ path: join(UD, '2137-coach-sendt-moerk.png') })
      } finally { await ctx.close(); await mock.close() }
    }
    {
      const s = seed({ friPct: 0, udkast: true }); const mock = createMockSupabase({ users: s.users, tables: structuredClone(s.tables) }); await mock.listen(MOCK_PORT)
      const { ctx, p } = await nyside()
      try {
        const uge = await coachUge(p, navn, '[data-claude-week="udkast"]')
        krav((await uge.innerText()).includes('Fri pulje: 0 % (helt fast)'), `${navn}: udkast skulle stå på 0 %`)
        if (navn === 'lys') await p.screenshot({ path: join(UD, '2137-coach-udkast-lys.png') })
        await uge.getByRole('button', { name: '30 %' }).click()
        await p.waitForFunction(() => document.body.innerText.includes('Fri pulje: 30 % af dagens kcal'), null, { timeout: 15000 })
        const versioner = mock.table('kostplan_v1_versions')
        krav(versioner.length === 14 && versioner.filter(v => v.version_no === 2 && v.calculation_basis?.fri_pct === 30).length === 7,
          `${navn}: forventede 7 nye versioner med fri_pct 30, fandt ${versioner.length}`)
        krav(mock.table('kostplan_v1_approvals').length === 0, `${navn}: niveauet må ikke sende ugen`)
        await ingenScroll(p, `${navn} coach udkast`)
        if (navn === 'moerk') await p.screenshot({ path: join(UD, '2137-coach-udkast-moerk.png') })
        console.log(`${navn}: coach satte 30 % på udkast, 7 nye versioner, intet sendt`)
      } finally { await ctx.close(); await mock.close() }
    }
  }
  krav(!errors.length, 'pageerror: ' + errors.join(' | '))
} catch (err) { fejl = err } finally { await browser.close(); await vite.stop() }
if (fejl) { console.error('FEJL:', fejl.message); process.exit(1) }
console.log('2137 e2e grøn')
