// 1934: "Prøv igen" efter delvis fejl på "Alt fra i går" logger ikke gemte rækker igen (390 px, lys og mørk, mod mocken).
// Kun syntetisk "Atlet N" med tre måltider i går og intet i dag; 2. POST til meal_logs afbrydes én gang. Kør: node e2e/kost-proev-igen-uden-dobbelte.spec.mjs
import { join } from 'node:path'
import { createMockSupabase } from './mock-supabase.mjs'
import { buildSeed, ATHLETE_USER, ATHLETE_ID, kostPakkeTilAtlet } from './fixtures.mjs'
import { startVite, launchBrowser, chromium, APP_URL, MOCK_PORT, OUT_DIR } from './harness.mjs'

const MOBILE = { width: 390, height: 844 }
const uuid = n => `34000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const plus = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)

export function seed(now = new Date()) {
  const s = buildSeed({ now })
  const t = s.tables
  kostPakkeTilAtlet(t, { now }) // 2034f: Kost vises kun med kostpakke
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen' }).format(now)
  t.meal_logs = (t.meal_logs ?? []).filter(r => r.athlete_id !== ATHLETE_ID || r.date < plus(today, -1))
  const gaar = plus(today, -1)
  t.meal_logs.push({ id: uuid(1), athlete_id: ATHLETE_ID, date: gaar, meal: 'Syntetisk morgenmad', kcal: 520, protein: 32, carb: 70, fat: 12, created_at: `${gaar}T07:00:00Z` },
    { id: uuid(2), athlete_id: ATHLETE_ID, date: gaar, meal: 'Syntetisk frokost', kcal: 710, protein: 48, carb: 80, fat: 18, created_at: `${gaar}T12:00:00Z` },
    { id: uuid(3), athlete_id: ATHLETE_ID, date: gaar, meal: 'Syntetisk aftensmad', kcal: 820, protein: 55, carb: 90, fat: 22, created_at: `${gaar}T18:00:00Z` })
  return { ...s, today, gaar }
}

async function login(page, user) {
  await page.goto(APP_URL)
  await page.locator('#athlete-auth-email').fill(user.email)
  await page.locator('#athlete-auth-password').fill(user.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
}

export async function runProevIgen(page, mock, today, outDir = OUT_DIR, tema = 'moerk') {
  await page.addInitScript(() => { try { localStorage.clear() } catch { /* ignoreret */ } })
  let posts = 0, afbryd = true
  await page.route(/\/rest\/v1\/meal_logs/, route => {
    if (route.request().method() === 'POST' && ++posts === 2 && afbryd) return route.abort('failed')
    return route.continue()
  })
  await login(page, ATHLETE_USER)
  await page.getByRole('button', { name: 'Kost', exact: true }).first().click({ timeout: 20000 })
  const kost = page.getByRole('region', { name: 'Kost i dag' })
  await kost.waitFor({ state: 'visible', timeout: 20000 })
  await page.evaluate(v => (v === 'lys' ? document.documentElement.setAttribute('data-tema', 'lys') : document.documentElement.removeAttribute('data-tema')), tema)
  const idag = () => mock.table('meal_logs').filter(r => r.athlete_id === ATHLETE_ID && r.date === today)
  const alt = kost.getByRole('button', { name: /^Alt fra i går \(3\)$/ })
  await alt.waitFor({ timeout: 15000 })
  if (idag().length !== 0) throw new Error('Der skulle intet være i dag ved start: ' + idag().length)
  await alt.click()
  const proev = kost.getByRole('button', { name: 'Prøv igen', exact: true })
  await proev.waitFor({ timeout: 20000 })
  const efterFejl = idag().length
  await page.screenshot({ path: join(outDir, `1934-efter-fejl-${tema}.png`), fullPage: true })
  const bredde = await page.evaluate(() => document.documentElement.scrollWidth)
  if (bredde > MOBILE.width + 1) throw new Error(`Vandret scroll på 390 px: ${bredde}px`)
  afbryd = false
  await proev.click()
  await kost.getByText('3 måltider fra i går gemt.').waitFor({ timeout: 20000 })
  const efterProev = idag().length
  const navne = idag().map(r => r.meal).sort()
  if (efterProev !== 3 || new Set(navne).size !== 3) throw new Error(`Skulle være 3 forskellige rækker, fik ${efterProev}: ${navne.join(', ')}`)
  const fortryd = kost.getByRole('button', { name: 'Fortryd', exact: true })
  await fortryd.waitFor({ timeout: 5000 })
  await fortryd.click()
  await kost.getByText('3 måltider fra i går er fortrudt.').waitFor({ timeout: 10000 })
  const efterFortryd = idag().length
  if (efterFortryd !== 0) throw new Error(`Fortryd skulle fjerne alle gemte rækker, ${efterFortryd} står tilbage`)
  if (mock.table('meal_logs').filter(r => r.date < today).length < 3) throw new Error('Gårsdagens rækker må ikke røres')
  await page.screenshot({ path: join(outDir, `1934-efter-fortryd-${tema}.png`), fullPage: true })
  return { tema, efterFejl, efterProev, efterFortryd }
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
        const r = await runProevIgen(page, mock, s.today, OUT_DIR, tema)
        if (errors.length) throw new Error('browserfejl: ' + errors.join('; '))
        console.log(JSON.stringify(r))
      } finally { await page.close(); await mock.close?.() }
    }
  } catch (e) { fejl = e } finally { await browser.close(); await vite.stop() }
  if (fejl) throw fejl
}

if (import.meta.url === `file:///${process.argv[1].split(String.fromCharCode(92)).join("/")}`) main().catch(err => { console.error(err); process.exitCode = 1 })
