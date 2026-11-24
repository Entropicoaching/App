// Ordre 2103 (Marc 24. nov.: "kost kan købes alene"): en kostklient har en sendt kostuge og intet program.
// Atleten ved 390 px, lys og mørk: Hjem siger Din kost i dag uden trænings-tomtilstande, Åbn kost er ét tryk,
// og planens frokost logges som spist. Coachen ved 1280 px ser "Kostklient", ikke "Intet program".
// Kun syntetiske data. Kør: node e2e/kostklient-2103.spec.mjs [billedmappe]
import { join } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createMockSupabase } from './mock-supabase.mjs'
import { ATHLETE_USER, COACH_USER } from './fixtures.mjs'
import { startVite, launchBrowser, chromium, APP_URL, MOCK_PORT, OUT_DIR } from './harness.mjs'
import { seed as ugeSeed } from './kost-set-paa-main.spec.mjs'

const MOBILE = { width: 390, height: 844 }
const DESKTOP = { width: 1280, height: 900 }
const FORBUDT = /ved at lægge dit program|Se mit program|Start dagens pas|Start næste pas|Dit næste pas|0 af 0|ikke lagt|Intet program/

// Kostklienten: sendt kostuge, men hverken uger, pas eller øvelser.
function kostklientSeed() {
  const s = ugeSeed()
  s.tables.weeks = []; s.tables.sessions = []; s.tables.exercises = []; s.tables.exercise_logs = []
  return s
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

export async function runAtlet(page, navn, outDir, rapport) {
  await login(page, ATHLETE_USER)
  await tema(page, navn)
  const hjem = page.locator('[data-u9-pas]')
  await hjem.waitFor({ timeout: 20000 })
  await page.getByText('Din kost i dag').first().waitFor({ timeout: 20000 })
  const side = await page.locator('main').first().innerText()
  if (FORBUDT.test(side)) throw new Error(`${navn}: trænings-tomtilstand på Hjem: ${side.match(FORBUDT)[0]}`)
  await ingenScroll(page)
  await page.screenshot({ path: join(outDir, `2103-hjem-${navn}-390.png`), fullPage: false })
  // Kost er ét tryk fra Hjem.
  await page.getByRole('button', { name: 'Åbn kost', exact: true }).click()
  const kost = page.getByRole('region', { name: 'Kost i dag' })
  await kost.waitFor({ timeout: 20000 })
  await tema(page, navn)
  const spist = kost.getByRole('button', { name: 'Frokost: spist som planlagt' })
  await spist.waitFor({ timeout: 15000 })
  await spist.click()
  await kost.getByText(/Frokost/).first().waitFor({ timeout: 15000 })
  await page.waitForTimeout(800)
  await ingenScroll(page)
  await page.screenshot({ path: join(outDir, `2103-kost-${navn}-390.png`), fullPage: false })
  // Program og Beskeder siger ikke, at et program mangler.
  await page.getByRole('button', { name: 'Program', exact: true }).first().click()
  await page.getByText('Du har ingen træning i appen.').first().waitFor({ timeout: 15000 })
  await ingenScroll(page)
  rapport.push({ navn: `atlet ${navn}: Hjem uden trænings-tomtilstand, Åbn kost, frokost som planlagt, Program uden mangelbesked` })
}

export async function runCoach(page, rapport) {
  await login(page, COACH_USER)
  await page.getByText('Dine atleter (1)').waitFor({ timeout: 20000 })
  const liste = await page.locator('body').innerText()
  const raekke = liste.slice(liste.indexOf('Dine atleter (1)'))
  if (!/Kostklient/.test(raekke)) throw new Error('Coach: atletkortet siger ikke Kostklient')
  if (/Intet program|Intet pas logget/.test(raekke)) throw new Error('Coach: atletkortet siger Intet program eller Intet pas logget')
  rapport.push({ navn: 'coach 1280 px: kortet siger Kostklient, ingen Intet program eller Intet pas logget' })
}

async function main() {
  const outDir = process.argv[2] || OUT_DIR
  mkdirSync(outDir, { recursive: true })
  const vite = await startVite()
  const browser = await launchBrowser().catch(() => chromium.launch({ headless: true, channel: 'msedge' }))
  const rapport = [], errors = []
  let fejl = null
  try {
    for (const [navn, viewport, scheme, run] of [
      ['moerk', MOBILE, 'dark', (page, out) => runAtlet(page, 'moerk', out, rapport)],
      ['lys', MOBILE, 'light', (page, out) => runAtlet(page, 'lys', out, rapport)],
      ['coach', DESKTOP, 'dark', page => runCoach(page, rapport)],
    ]) {
      const seedet = kostklientSeed()
      const mock = createMockSupabase({ users: seedet.users, tables: structuredClone(seedet.tables) })
      await mock.listen(MOCK_PORT)
      const context = await browser.newContext({ viewport, colorScheme: scheme })
      const page = await context.newPage()
      page.on('pageerror', err => errors.push(`${navn}: ${err.message}`))
      try { await run(page, outDir) } finally { await context.close(); await mock.close() }
    }
    if (errors.length) throw new Error('pageerror: ' + errors.join(' | '))
  } catch (err) {
    fejl = err
  } finally {
    await browser.close()
    await vite.stop()
  }
  writeFileSync(join(outDir, '2103-rapport.json'), JSON.stringify({ rapport, errors, ok: !fejl }, null, 2))
  for (const r of rapport) console.log(`OK ${r.navn}`)
  if (fejl) { console.error('FEJL:', fejl.message); process.exit(1) }
  console.log('2103 e2e: kostklient grøn ved 390 px lys og mørk, coach ved 1280 px')
}

main()
