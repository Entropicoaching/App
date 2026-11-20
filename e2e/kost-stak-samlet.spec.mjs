// 1925: hele kost-stakken (1916, 1921, 1923, 1924) i ét forløb med tryk på 390 px mod mocken.
// Kun syntetisk atlet og syntetisk kostplan. Kør: node e2e/kost-stak-samlet.spec.mjs
import { join } from 'node:path'
import { writeFileSync } from 'node:fs'
import { createMockSupabase } from './mock-supabase.mjs'
import { buildSeed, ATHLETE_USER, ATHLETE_ID } from './fixtures.mjs'
import { startVite, launchBrowser, chromium, APP_URL, MOCK_PORT, OUT_DIR } from './harness.mjs'
import { createPlanSnapshot } from '../src/entropi2/kostplan/planSnapshot.mjs'

const MOBILE = { width: 390, height: 844 }
const uuid = n => `30000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const plus = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)

const food = (id, name) => ({ id, name, preparation: 'syntetisk', basisGrams: 100,
  nutrientsPer100g: { energyKcal: 150, proteinG: 10, carbohydrateG: 15, fatG: 4 },
  source: { citation: 'syntetisk fixture', verification: 'syntetisk' } })
const snapshot = () => createPlanSnapshot({ goal: 'vedligehold', intensity: 0, meals: [
  { name: 'Frokost', portions: [{ grams: 300, food: food('syn:frokost', 'Syntetisk frokostret') }] },
  { name: 'Aftensmad', portions: [{ grams: 400, food: food('syn:aften', 'Syntetisk aftensret') }] }] })

export function seed(now = new Date()) {
  const s = buildSeed({ now })
  const t = s.tables
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen' }).format(now)
  for (const name of ['weight_logs', 'meal_logs', 'kostplan_v1_plans', 'kostplan_v1_versions', 'kostplan_v1_approvals']) t[name] = t[name] ?? []
  // Aktiv uge (godkendt, sendt) og en ny uge, der starter om to dage.
  // Scene 1: kun en sendt uge, der starter om to dage (1916 viser kun linjen uden planmåltider i dag).
  const ny = { id: uuid(2), athlete_id: ATHLETE_ID, valid_from: plus(today, 2), status: 'godkendt' }
  t.kostplan_v1_plans.push(ny)
  t.kostplan_v1_versions.push({ id: uuid(11), plan_id: ny.id, version_no: 1, effective_from: ny.valid_from, portion_guidance: null, ...structuredClone(snapshot()) })
  t.kostplan_v1_approvals.push({ version_id: uuid(11), plan_id: ny.id, athlete_id: ATHLETE_ID, approved_at: plus(today, -3) + 'T10:00:00.000001Z', approval_kind: 'coach' })
  t.meal_logs.push({ id: uuid(100), athlete_id: ATHLETE_ID, date: today, meal: 'Havregryn · 60 g', kcal: 222, protein: 8, carb: 38, fat: 4, created_at: `${today}T06:30:00Z` })
  return { ...s, today }
}

async function login(page, user) {
  await page.goto(APP_URL)
  await page.locator('#athlete-auth-email').fill(user.email)
  await page.locator('#athlete-auth-password').fill(user.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
}

export async function runStak(page, mock, today, outDir = OUT_DIR) {
  const rapport = []
  // Tæller rigtige brugerhandlinger: klik (isTrusted) og tastede felter (første input pr. felt og handling).
  await page.addInitScript(() => {
    window.__tryk = { klik: 0, felter: 0 }
    document.addEventListener('click', e => { if (e.isTrusted) window.__tryk.klik++ }, true)
    document.addEventListener('input', e => { if (e.isTrusted) window.__tryk.felter++ }, true)
  })
  const tryk = () => page.evaluate(() => ({ ...window.__tryk }))
  const handling = async (navn, fn) => {
    const foer = await tryk()
    await fn()
    const efter = await tryk()
    const klik = efter.klik - foer.klik
    const felter = efter.felter > foer.felter ? 1 : 0
    rapport.push({ navn, klik, felter, tryk: klik + felter })
  }
  const kost = page.getByRole('region', { name: 'Kost i dag' })
  const tal = () => kost.locator('[data-kost-i-dag-tal]').innerText()
  const noKontrol = async () => { if (/skal kontrolleres/.test(await kost.innerText())) throw new Error('"skal kontrolleres" står i Kost i dag') }

  await login(page, ATHLETE_USER)
  await handling('Åbn Kost (kost i dag)', async () => {
    await page.getByRole('button', { name: 'Kost', exact: true }).first().click({ timeout: 20000 })
    await kost.waitFor({ state: 'visible', timeout: 20000 })
  })
  // Scene 1, 1916: ny uge synlig uden tryk; Se planen er ét tryk (set-trinnet er taget ud i 1927).
  await kost.locator('[data-kost-ny-plan]').waitFor({ timeout: 10000 })
  rapport.push({ navn: 'Ny kostplan-linjen står uden tryk (1916)', klik: 0, felter: 0, tryk: 0 })
  await handling('Se planen (1916)', async () => {
    await kost.getByRole('button', { name: 'Se planen' }).click()
  })
  await page.screenshot({ path: join(outDir, `1925-ny-uge-moerk.png`), fullPage: true })
  // Scene 2: dagen ugen træder i kraft. Samme mock, samme atlet; planens start flyttes til i dag.
  mock.table('kostplan_v1_plans')[0].valid_from = today
  mock.table('kostplan_v1_versions')[0].effective_from = today
  await page.reload()
  await page.getByRole('button', { name: 'Kost', exact: true }).first().click({ timeout: 20000 })
  await kost.waitFor({ state: 'visible', timeout: 20000 })
  await kost.getByRole('button', { name: 'Frokost: spist som planlagt' }).waitFor({ timeout: 15000 })
  for (let i = 0; i < 20; i++) await page.waitForTimeout(250)
  rapport.push({ navn: `Planmåltiderne vises (set-trinnet er ude)`, klik: 0, felter: 0, tryk: 0 })

  const foerTal = await tal()
  await handling('Frokost som planlagt', async () => {
    await kost.getByRole('button', { name: 'Frokost: spist som planlagt' }).click()
    await kost.getByRole('button', { name: 'Ret mængde: Frokost' }).waitFor({ timeout: 10000 })
  })
  await handling('Ret Frokost 300 g til 450 g (1924)', async () => {
    await kost.getByRole('button', { name: 'Ret mængde: Frokost' }).first().click()
    await kost.getByLabel('Ny mængde Frokost').fill('450')
    await kost.getByRole('button', { name: 'Gem Frokost' }).click()
    await kost.getByText(/Frokost · 450 g gemt/).waitFor({ timeout: 10000 })
  })
  const frokostRaekker = mock.table('meal_logs').filter(r => r.meal === 'Frokost')
  if (frokostRaekker.length !== 1 || Math.round(frokostRaekker[0].kcal) !== 675) throw new Error('1924: Frokost skulle være én række på 675 kcal: ' + JSON.stringify(frokostRaekker))
  await noKontrol()

  await handling('Log fødevare (skyr, standardmængde)', async () => {
    await kost.getByLabel('Nyt måltid').fill('skyr')
    await kost.getByRole('button', { name: /^Vælg / }).first().click()
    await kost.getByRole('button', { name: /^Log / }).click()
    await kost.getByRole('button', { name: /^Ret mængde: .*[Ss]kyr/ }).waitFor({ timeout: 10000 })
  })
  const skyrNavn = (mock.table('meal_logs').find(r => /skyr/i.test(r.meal)) || {}).meal
  if (!skyrNavn) throw new Error('Skyr blev ikke logget i meal_logs')
  const foerSkyr = structuredClone(mock.table('meal_logs').find(r => r.meal === skyrNavn))
  await handling('Ret fødevaren til 250 g (1923)', async () => {
    await kost.getByRole('button', { name: `Ret mængde: ${skyrNavn}` }).click()
    await kost.getByLabel(/^Ny mængde .*[Ss]kyr/).fill('250')
    await kost.getByRole('button', { name: /^Gem .*[Ss]kyr/ }).click()
    for (let i = 0; i < 40 && mock.table('meal_logs').find(r => r.id === foerSkyr.id)?.kcal === foerSkyr.kcal; i++) await page.waitForTimeout(250)
  })
  const efterSkyr = mock.table('meal_logs').filter(r => /skyr/i.test(r.meal))
  if (efterSkyr.length !== 1 || efterSkyr[0].id !== foerSkyr.id || !(efterSkyr[0].kcal > foerSkyr.kcal)) throw new Error('1923: rettelsen skulle ændre samme række: ' + JSON.stringify({ foerSkyr, efterSkyr }))

  await handling('Vand 500 ml', async () => {
    await page.getByRole('button', { name: 'Drukket 500 ml vand' }).first().scrollIntoViewIfNeeded()
    await page.getByRole('button', { name: 'Drukket 500 ml vand' }).first().click()
    await page.waitForFunction(() => Object.keys(localStorage).some(k => k.startsWith('entropi2:water-intake:v1:') && /500/.test(localStorage.getItem(k))), null, { timeout: 5000 })
  })
  await handling('Vægt 82,4 kg', async () => {
    await kost.getByLabel('Vægt i kg').fill('82,4')
    await kost.getByRole('button', { name: 'Gem vægt' }).click()
    await kost.getByText('Vægt gemt: 82.4 kg.').or(kost.getByText(/Vægt gemt/)).waitFor({ timeout: 10000 })
  })
  if (!mock.table('weight_logs').some(r => Number(r.weight) === 82.4)) throw new Error('Vægt 82,4 ikke i weight_logs')

  // Tal stemmer: dagens kcal i mocken mod linjen i Kost i dag.
  const sum = Math.round(mock.table('meal_logs').filter(r => r.date === today).reduce((s, r) => s + Number(r.kcal), 0))
  const linje = await tal()
  const fmt = n => n.toLocaleString('da-DK')
  if (!linje.includes(fmt(sum)) && !linje.includes(String(sum))) throw new Error(`Tallet stemmer ikke: mock ${sum} kcal, visning "${linje}"`)
  await noKontrol()
  if (!(await kost.innerText()).includes('Logget i dag')) throw new Error('"Logget i dag" mangler')
  const bredde = await page.evaluate(() => document.documentElement.scrollWidth)
  if (bredde > MOBILE.width + 1) throw new Error(`Vandret scroll på 390 px: ${bredde}px`)
  for (const t of ['lys', 'moerk']) {
    await page.evaluate(v => (v === 'lys' ? document.documentElement.setAttribute('data-tema', 'lys') : document.documentElement.removeAttribute('data-tema')), t)
    await page.screenshot({ path: join(outDir, `1925-stak-${t}.png`), fullPage: true })
  }
  return { foerTal, linje, sum, rapport }
}

async function main() {
  const s = seed()
  const mock = createMockSupabase({ users: s.users, tables: s.tables })
  await mock.listen(MOCK_PORT)
  const vite = await startVite()
  const browser = await launchBrowser().catch(() => chromium.launch({ headless: true, channel: 'msedge' }))
  let fejl = null
  try {
    const page = await browser.newPage({ viewport: MOBILE })
    const errors = []
    page.on('pageerror', err => errors.push(err.message))
    try {
      const r = await runStak(page, mock, s.today)
      if (errors.length) throw new Error('browserfejl: ' + errors.join('; '))
      console.log('GRØN: kost-stak samlet på 390 px')
      console.table(r.rapport)
      console.log(JSON.stringify({ foer: r.foerTal, efter: r.linje, kcalMock: r.sum }))
      writeFileSync(join(OUT_DIR, '1925-rapport.json'), JSON.stringify(r, null, 1))
    } finally { await page.close() }
  } catch (e) { fejl = e } finally {
    await browser.close(); await vite.stop(); await mock.close?.()
  }
  if (fejl) throw fejl
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) main().catch(err => { console.error(err); process.exitCode = 1 })
