// ORDRE 2490: maaler coachens kostuge i tryk og felter (mock, syntetiske atleter). Kun maaling, ingen krav.
// Koersel: E2E_VITE_PORT=5490 E2E_MOCK_PORT=8990 VITE_SUPABASE_URL=http://127.0.0.1:8990 node e2e/coach-kostuge-maal-2490.mjs
import { createMockSupabase } from './mock-supabase.mjs'
import { COACH_USER, ATHLETE_ID } from './fixtures.mjs'
import { startVite, launchBrowser, APP_URL, MOCK_PORT } from './harness.mjs'
import { seed as ugeSeed } from './kost-set-paa-main.spec.mjs'
const NY = '49000000-0000-4000-8000-000000000001', UNDER = '49000000-0000-4000-8000-000000000002'
const plus = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10)
function seed({ udkast = false } = {}) {
  const s = ugeSeed(); const t = s.tables
  t.athletes.push({ id: NY, user_id: null, name: 'Ny Kostklient', coach_id: COACH_USER.id, status: 'active', hidden: false, onboarding_completed_at: null, email: 'ny@e2e.test' })
  for (let i = 1; i <= 5; i++) for (const [m, k] of [['Frokost', 500], ['Aftensmad', 600]])
    t.meal_logs.push({ id: `49100000-0000-4000-8000-0000000${i}${m.length}0000`, athlete_id: ATHLETE_ID, date: plus(s.today, -i), meal: m, kcal: k, protein: 30, carb: 50, fat: 15, created_at: `${plus(s.today, -i)}T12:00:00Z` })
  if (udkast) { for (const a of t.athletes) if (a.id === ATHLETE_ID) Object.assign(a, { kcal_target: 1050, protein_target: 70 }); t.kostplan_v1_approvals = []; for (const p of t.kostplan_v1_plans) p.status = 'forslag' }
  return s
}
const tema = (p, n) => p.evaluate(v => (v === 'lys' ? document.documentElement.setAttribute('data-tema', 'lys') : document.documentElement.removeAttribute('data-tema')), n)
async function start(browser, bredde, hoejde, navn) {
  const ctx = await browser.newContext({ viewport: { width: bredde, height: hoejde }, colorScheme: navn === 'lys' ? 'light' : 'dark' }); const p = await ctx.newPage()
  const fejl = []; p.on('pageerror', e => fejl.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) fejl.push(m.text()) })
  await p.goto(APP_URL); await p.evaluate(() => { try { localStorage.clear() } catch {} }); await p.goto(APP_URL)
  await p.locator('#athlete-auth-email').fill(COACH_USER.email); await p.locator('#athlete-auth-password').fill(COACH_USER.password)
  await p.getByRole('button', { name: 'Log ind' }).click(); await p.locator('[data-coach-idag]').waitFor({ timeout: 20000 }); await tema(p, navn)
  const m = { tryk: 0, felter: 0 }
  m.klik = async l => { m.tryk++; await l.click({ timeout: 15000 }) }
  m.fyld = async (l, v) => { m.felter++; await l.fill(String(v), { timeout: 15000 }) }
  m.fejl = fejl; m.ctx = ctx; m.p = p
  m.overloeb = () => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
  return m
}
export async function maal(browser, bredde, hoejde, navn, tabel) {
  const ud = []
  // A: ny klient faar kostmaal
  { const s = seed(); const mock = createMockSupabase({ users: s.users, tables: structuredClone(s.tables) }); await mock.listen(MOCK_PORT)
    const m = await start(browser, bredde, hoejde, navn); const p = m.p
    try {
      await m.klik(p.getByRole('button', { name: 'Åbn programmet for Ny Kostklient' })); await m.klik(p.getByRole('button', { name: /Kost & mål/ }).first())
      await m.klik(p.getByRole('button', { name: 'Sæt kostmål', exact: true }).first())
      const tal = p.locator('input[type=number]'); const n = await tal.count()
      await m.fyld(tal.nth(n - 2), 2800); await m.fyld(tal.nth(n - 1), 170)
      await m.klik(p.getByRole('region', { name: 'Kostmål og vægtgrundlag' }).getByRole('button', { name: 'Gem', exact: true })); await p.waitForTimeout(1200)
      const rk = mock.table('athletes').find(a => a.id === NY); 0
      ud.push(['A kostmaal ny klient', m.tryk, m.felter, `kcal ${rk.kcal_target} protein ${rk.protein_target}`, await m.overloeb()])
    } finally { await m.ctx.close(); await mock.close() } if (tabel) {} }
  // B: udkast sendes
  { const s = seed({ udkast: true }); const mock = createMockSupabase({ users: s.users, tables: structuredClone(s.tables) }); await mock.listen(MOCK_PORT)
    const m = await start(browser, bredde, hoejde, navn); const p = m.p
    try {
      await m.klik(p.getByRole('button', { name: 'Åbn programmet for Atlet W' })); await m.klik(p.getByRole('button', { name: /Kost & mål/ }).first())
      await m.klik(p.getByRole('button', { name: 'Send uge til atleten' })); await p.waitForTimeout(1500)
      ud.push(['B send udkast', m.tryk, m.felter, `godkendelser ${mock.table('kostplan_v1_approvals').length}`, await m.overloeb()])
    } finally { await m.ctx.close(); await mock.close() } }
  // C: log mod plan
  { const s = seed(); const mock = createMockSupabase({ users: s.users, tables: structuredClone(s.tables) }); await mock.listen(MOCK_PORT)
    const m = await start(browser, bredde, hoejde, navn); const p = m.p
    try {
      await m.klik(p.getByRole('button', { name: 'Åbn programmet for Atlet W' })); await m.klik(p.getByRole('button', { name: /Kost & mål/ }).first()); await p.waitForTimeout(2500)
      const txt = await p.evaluate(() => document.body.innerText)
      ud.push(['C log mod plan', m.tryk, m.felter, txt.split(String.fromCharCode(10)).filter(l => /mod kostplanen|måltidslogs|logget|under|Efterlev|aktiv kostplan/i.test(l)).join(' // ').slice(0, 600), await m.overloeb()])
      ud.fejl = m.fejl
    } finally { await m.ctx.close(); await mock.close() } }
  // D: ret ét maaltid i sendt uge (til blank dagseditor)
  { const s = seed(); const mock = createMockSupabase({ users: s.users, tables: structuredClone(s.tables) }); await mock.listen(MOCK_PORT)
    const m = await start(browser, bredde, hoejde, navn); const p = m.p
    try {
      await m.klik(p.getByRole('button', { name: 'Åbn programmet for Atlet W' })); await m.klik(p.getByRole('button', { name: /Kost & mål/ }).first())
      await m.klik(p.getByText('Ret', { exact: true }).first()); await m.klik(p.getByRole('button', { name: 'Åbn kostplan med Frida-fødevarer' })); await p.waitForTimeout(2500)
      const foer = m.tryk
      const tomme = await p.evaluate(() => [...document.querySelectorAll('[id^=draft-grams-],[id^=template-grams-]')].filter(e => !e.value).length)
      ud.push(['D ret et maaltid (til tom editor)', foer, 0, `tomme gramfelter ${tomme}; intet forudfyldt fra sendt dag`, await m.overloeb()])
    } finally { await m.ctx.close(); await mock.close() } }
  return ud
}
if (process.argv[1].endsWith('coach-kostuge-maal-2490.mjs')) {
  const vite = await startVite(), browser = await launchBrowser()
  try { for (const [b, h] of [[390, 844], [1280, 800]]) for (const n of ['lys', 'moerk']) { console.log(`== ${b} ${n}`); for (const r of await maal(browser, b, h, n)) console.log(r.join(' | ')) } }
  catch (e) { console.error(e); process.exitCode = 1 } finally { await browser.close(); await vite.stop() }
}
