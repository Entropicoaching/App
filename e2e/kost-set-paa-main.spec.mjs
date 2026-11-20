// 1938: set-mærket oven på main (Kost i dag med Fjern og Fortryd) ved 390 px, lys og mørk, mod mocken.
// Atleten åbner Kost, ser dagens planmåltider (laget lukket), fjerner et måltid og fortryder;
// coachen ser "Set af atleten <dato>" ved "Sendt <dato>". Kun syntetisk "Atlet W". Kør: node e2e/kost-set-paa-main.spec.mjs
// og uden tabel: E2E_HIDE_TABLES=kostplan_v1_seen node e2e/kost-set-paa-main.spec.mjs
import { join } from 'node:path'
import { createMockSupabase } from './mock-supabase.mjs'
import { buildSeed, ATHLETE_USER, COACH_USER, ATHLETE_ID } from './fixtures.mjs'
import { startVite, launchBrowser, chromium, APP_URL, MOCK_PORT, OUT_DIR } from './harness.mjs'
import { createPlanSnapshot } from '../src/entropi2/kostplan/planSnapshot.mjs'

const MOBILE = { width: 390, height: 844 }
const uuid = n => `38000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const plus = (day, n) => new Date(Date.parse(day + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10)
const food = (id, name) => ({ id, name, preparation: 'syntetisk', basisGrams: 100,
  nutrientsPer100g: { energyKcal: 150, proteinG: 10, carbohydrateG: 15, fatG: 4 },
  source: { citation: 'syntetisk fixture', verification: 'syntetisk' } })
const snapshot = () => createPlanSnapshot({ goal: 'vedligehold', intensity: 0, meals: [
  { name: 'Frokost', portions: [{ grams: 300, food: food('syn:frokost', 'Syntetisk frokostret') }] },
  { name: 'Aftensmad', portions: [{ grams: 400, food: food('syn:aften', 'Syntetisk aftensret') }] }] })

// En sendt uge på 7 dage, der står i dag (i dag minus 3 til plus 3), sendt for to dage siden.
export function seed(now = new Date()) {
  const s = buildSeed({ now })
  const t = s.tables
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen' }).format(now)
  for (const a of t.athletes ?? []) if (a.id === ATHLETE_ID) Object.assign(a, { name: 'Atlet W', kcal_target: a.kcal_target ?? 2600, protein_target: a.protein_target ?? 160 })
  for (const name of ['weight_logs', 'meal_logs', 'kostplan_v1_plans', 'kostplan_v1_versions', 'kostplan_v1_approvals', 'kostplan_v1_seen']) t[name] = t[name] ?? []
  const sendt = plus(today, -2) + 'T10:00:00.000001Z'
  for (let i = 0; i < 7; i++) {
    const plan = { id: uuid(1 + i), athlete_id: ATHLETE_ID, valid_from: plus(today, i - 3), status: 'godkendt' }
    t.kostplan_v1_plans.push(plan)
    t.kostplan_v1_versions.push({ id: uuid(11 + i), plan_id: plan.id, version_no: 1, effective_from: plan.valid_from, portion_guidance: null,
      basis_as_of: plus(today, -4), rationale: 'Syntetisk uge til 1938', ...structuredClone(snapshot()) })
    t.kostplan_v1_approvals.push({ version_id: uuid(11 + i), plan_id: plan.id, athlete_id: ATHLETE_ID, approved_at: sendt, approval_kind: 'coach' })
  }
  return { ...s, today }
}

async function login(page, user) {
  await page.goto(APP_URL)
  await page.evaluate(() => { try { localStorage.clear() } catch { /* ignoreret */ } })
  await page.goto(APP_URL)
  await page.locator('#athlete-auth-email').fill(user.email)
  await page.locator('#athlete-auth-password').fill(user.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
}
const tema = (page, navn) => page.evaluate(v => (v === 'lys' ? document.documentElement.setAttribute('data-tema', 'lys') : document.documentElement.removeAttribute('data-tema')), navn)
const ingenScroll = async page => {
  const bredde = await page.evaluate(() => document.documentElement.scrollWidth)
  if (bredde > MOBILE.width + 1) throw new Error(`Vandret scroll på 390 px: ${bredde}px`)
}

export async function runAtlet(page, mock, today, navn, outDir = OUT_DIR, { tabel = true } = {}) {
  const seen = () => (tabel ? mock.table('kostplan_v1_seen').length : 0)
  await login(page, ATHLETE_USER)
  await page.getByRole('button', { name: 'Kost', exact: true }).first().click({ timeout: 20000 })
  const kost = page.getByRole('region', { name: 'Kost i dag' })
  await kost.waitFor({ state: 'visible', timeout: 20000 })
  await tema(page, navn)
  await kost.getByRole('button', { name: 'Frokost: spist som planlagt' }).waitFor({ timeout: 15000 })
  for (let i = 0; i < 40 && tabel && seen() < 7; i++) await page.waitForTimeout(250)
  if (await page.locator('[data-kost-detaljer="aaben"]').count()) throw new Error('Laget skulle være lukket')
  if (tabel && seen() !== 7) throw new Error(`Forventede 7 set-rækker (én pr. dag i ugen), fandt ${seen()}`)
  await ingenScroll(page)
  // Log et måltid, fjern det med ét tryk, og fortryd.
  const idag = () => mock.table('meal_logs').filter(r => r.athlete_id === ATHLETE_ID && r.date === today)
  const foer = idag().length
  await kost.getByRole('searchbox').fill('banan')
  await kost.getByRole('group', { name: 'Forslag' }).getByRole('button').first().click()
  await kost.getByRole('button', { name: /^Log /, exact: false }).last().click()
  await page.waitForFunction(n => document.body.innerText.includes(n), 'gemt.', { timeout: 15000 })
  const fjern = kost.getByRole('button', { name: /^Fjern måltid:/ }).first()
  await fjern.waitFor({ timeout: 15000 })
  const maaltid = (await fjern.getAttribute('aria-label')).replace('Fjern måltid: ', '')
  await fjern.click()
  await kost.getByText(`${maaltid} er fjernet.`).waitFor({ timeout: 15000 })
  if (idag().length !== foer) throw new Error('Fjern skulle tage rækken væk')
  await kost.getByRole('button', { name: 'Fortryd', exact: true }).click()
  await kost.getByText(`${maaltid} er sat tilbage.`).waitFor({ timeout: 15000 })
  if (idag().length !== foer + 1) throw new Error('Fortryd skulle lægge rækken tilbage')
  if (tabel && seen() !== 7) throw new Error(`Set-rækkerne skal stå uændret efter Fjern og Fortryd, fandt ${seen()}`)
  if (navn === 'lys' && tabel) await page.screenshot({ path: join(outDir, '1938-atlet-kost-i-dag-lys.png'), fullPage: false })
  return { seen: seen(), maaltider: idag().length }
}

export async function runCoach(page, navn, outDir = OUT_DIR) {
  await login(page, COACH_USER)
  await tema(page, navn)
  // Dine atleter står åbent på forsiden; tryk på atletens række åbner profilen.
  await page.getByText('Dine atleter (1)').waitFor({ timeout: 20000 })
  await page.getByText('Atlet W', { exact: true }).first().click()
  // Profilen viser Hjem, Program, Log, Beskeder og Mere; Kost & mål ligger under Mere.
  await page.getByRole('button', { name: /^Mere/ }).first().click({ timeout: 20000 })
  await page.getByText('Kost & mål', { exact: false }).first().click({ timeout: 20000 })
  const uge = page.locator('[data-claude-week="sendt"]')
  await uge.waitFor({ state: 'visible', timeout: 20000 })
  await uge.getByText(/^Sendt /).waitFor({ timeout: 15000 })
  // Set-linjen læses efter ugen; uden tabel kommer den aldrig, og siden er som på main.
  await uge.getByText(/Set af atleten/).waitFor({ timeout: 5000 }).catch(() => {})
  await tema(page, navn)
  const tekst = await uge.innerText()
  await ingenScroll(page)
  await uge.scrollIntoViewIfNeeded()
  if (navn === 'moerk') await page.screenshot({ path: join(outDir, '1938-coach-set-moerk.png'), fullPage: false })
  return tekst
}

async function main() {
  const s = seed()
  const vite = await startVite()
  const browser = await launchBrowser().catch(() => chromium.launch({ headless: true, channel: 'msedge' }))
  let fejl = null
  const kvit = []
  try {
    // Uden tabel (som i produktion i dag): kør med E2E_HIDE_TABLES=kostplan_v1_seen.
    const udenTabel = (process.env.E2E_HIDE_TABLES || '').split(',').includes('kostplan_v1_seen')
    for (const [navn, tabel] of udenTabel ? [['moerk', false]] : [['lys', true], ['moerk', true]]) {
      const mock = createMockSupabase({ users: s.users, tables: structuredClone(s.tables) })
      await mock.listen(MOCK_PORT)
      const errors = []
      const side = async () => { const p = await browser.newPage({ viewport: MOBILE }); p.on('pageerror', err => errors.push(err.message)); return p }
      try {
        const atlet = await side()
        const a = await runAtlet(atlet, mock, s.today, navn, OUT_DIR, { tabel })
        await atlet.close()
        const coach = await side()
        const c = await runCoach(coach, navn)
        await coach.close()
        if (!/Sendt \d+\. \w+/.test(c)) throw new Error('Coachen ser ikke Sendt <dato>: ' + c)
        if (tabel && !/Set af atleten \d+\. \w+/.test(c)) throw new Error('Coachen ser ikke Set af atleten <dato>: ' + c)
        if (!tabel && /Set af atleten/.test(c)) throw new Error('Uden tabel må der ikke stå Set: ' + c)
        if (errors.length) throw new Error('browserfejl: ' + errors.join('; '))
        kvit.push({ tema: navn, tabel, seen: a.seen, coach: c.split('\n').filter(l => /Sendt|set af atleten/i.test(l)) })
      } finally { await mock.close?.() }
    }
  } catch (e) { fejl = e } finally { await browser.close(); await vite.stop() }
  console.log(JSON.stringify(kvit, null, 1))
  if (fejl) throw fejl
}

if (import.meta.url === `file:///${process.argv[1].split(String.fromCharCode(92)).join("/")}`) main().catch(err => { console.error(err); process.exitCode = 1 })
