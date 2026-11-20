// 1933: "Alt fra i går" i Kost i dag kan fortrydes med ét tryk (390 px, lys og mørk, mod mocken).
// Kun syntetisk "Atlet N" med to måltider i går og intet i dag. Kør: node e2e/kost-fortryd-alt-fra-i-gaar.spec.mjs
import { join } from 'node:path'
import { createMockSupabase } from './mock-supabase.mjs'
import { buildSeed, ATHLETE_USER, ATHLETE_ID } from './fixtures.mjs'
import { startVite, launchBrowser, chromium, APP_URL, MOCK_PORT, OUT_DIR } from './harness.mjs'

const MOBILE = { width: 390, height: 844 }
const uuid = n => `33000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const plus = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)

export function seed(now = new Date()) {
  const s = buildSeed({ now })
  const t = s.tables
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen' }).format(now)
  t.meal_logs = (t.meal_logs ?? []).filter(r => r.athlete_id !== ATHLETE_ID || r.date < plus(today, -1))
  const gaar = plus(today, -1)
  t.meal_logs.push({ id: uuid(1), athlete_id: ATHLETE_ID, date: gaar, meal: 'Syntetisk morgenmad', kcal: 520, protein: 32, carb: 70, fat: 12, created_at: `${gaar}T07:00:00Z` },
    { id: uuid(2), athlete_id: ATHLETE_ID, date: gaar, meal: 'Syntetisk frokost', kcal: 710, protein: 48, carb: 80, fat: 18, created_at: `${gaar}T12:00:00Z` })
  return { ...s, today, gaar }
}

async function login(page, user) {
  await page.goto(APP_URL)
  await page.locator('#athlete-auth-email').fill(user.email)
  await page.locator('#athlete-auth-password').fill(user.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
}

export async function runFortrydAltFraIGaar(page, mock, today, outDir = OUT_DIR, tema = 'moerk') {
  await page.addInitScript(() => { try { localStorage.clear() } catch { /* ignoreret */ } })
  await login(page, ATHLETE_USER)
  await page.getByRole('button', { name: 'Kost', exact: true }).first().click({ timeout: 20000 })
  const kost = page.getByRole('region', { name: 'Kost i dag' })
  await kost.waitFor({ state: 'visible', timeout: 20000 })
  await page.evaluate(v => (v === 'lys' ? document.documentElement.setAttribute('data-tema', 'lys') : document.documentElement.removeAttribute('data-tema')), tema)
  const idag = () => mock.table('meal_logs').filter(r => r.athlete_id === ATHLETE_ID && r.date === today)
  const alt = kost.getByRole('button', { name: /^Alt fra i går \(2\)$/ })
  await alt.waitFor({ timeout: 15000 })
  if (idag().length !== 0) throw new Error('Der skulle intet være i dag ved start: ' + idag().length)
  await alt.click()
  await kost.getByText('2 måltider fra i går gemt.').waitFor({ timeout: 15000 })
  const rige = idag().length
  const fortryd = kost.getByRole('button', { name: 'Fortryd', exact: true })
  const synlig = await fortryd.isVisible().catch(() => false)
  await page.screenshot({ path: join(outDir, `1933-efter-alt-${tema}.png`), fullPage: true })
  if (!synlig) return { tema, raekkerEfterAlt: rige, fortrydSynlig: false, raekkerEfterFortryd: rige }
  const bredde = await page.evaluate(() => document.documentElement.scrollWidth)
  if (bredde > MOBILE.width + 1) throw new Error(`Vandret scroll på 390 px: ${bredde}px`)
  await fortryd.click()
  await kost.getByText('2 måltider fra i går er fortrudt.').waitFor({ timeout: 10000 })
  const efter = idag().length
  if (efter !== 0) throw new Error(`Fortryd skulle fjerne begge rækker, ${efter} står tilbage`)
  if (mock.table('meal_logs').filter(r => r.date < today).length < 2) throw new Error('Gårsdagens rækker må ikke røres')
  await alt.waitFor({ timeout: 10000 })
  await page.screenshot({ path: join(outDir, `1933-efter-fortryd-${tema}.png`), fullPage: true })
  return { tema, raekkerEfterAlt: rige, fortrydSynlig: true, raekkerEfterFortryd: efter }
}

async function main() {
  const s = seed()
  const vite = await startVite()
  const browser = await launchBrowser().catch(() => chromium.launch({ headless: true, channel: 'msedge' }))
  let fejl = null
  try {
    for (const tema of ['lys', 'moerk']) {
      const mock = createMockSupabase({ users: s.users, tables: structuredClone(s.tables) })
      await mock.listen(MOCK_PORT)
      const page = await browser.newPage({ viewport: MOBILE })
      const errors = []
      page.on('pageerror', err => errors.push(err.message))
      try {
        const r = await runFortrydAltFraIGaar(page, mock, s.today, OUT_DIR, tema)
        if (errors.length) throw new Error('browserfejl: ' + errors.join('; '))
        console.log(JSON.stringify(r))
        if (!r.fortrydSynlig) throw new Error('Fortryd vises ikke efter Alt fra i går')
      } finally { await page.close(); await mock.close?.() }
    }
  } catch (e) { fejl = e } finally { await browser.close(); await vite.stop() }
  if (fejl) throw fejl
}

if (import.meta.url === `file:///${process.argv[1].split(String.fromCharCode(92)).join("/")}`) main().catch(err => { console.error(err); process.exitCode = 1 })
