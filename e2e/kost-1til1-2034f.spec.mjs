// Ordre 2034f (Marc 23. nov.: kost som 1:1-pakke, skjult for atleter uden): hele vejen i mocken.
// Scene A, atlet uden kostplan ved 390 px: ingen Kost-fane, intet Kost-link på Hjem, deep link til kost lander på Hjem.
// Scene B, atlet med sendt uge ved 390 px: Kost-fanen står, planmåltid logges med ét tryk, indkøbslisten findes.
// Scene C, coach ved 1280 px: atletens Kost & mål viser ugen fra Claude og "Seneste 7 dage mod kostplanen".
// Kun syntetiske data. Kør: node e2e/kost-1til1-2034f.spec.mjs [billedmappe]
import { join } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createMockSupabase } from './mock-supabase.mjs'
import { buildSeed, ATHLETE_USER, COACH_USER, ATHLETE_ID } from './fixtures.mjs'
import { startVite, launchBrowser, chromium, APP_URL, MOCK_PORT, OUT_DIR } from './harness.mjs'
import { seed as ugeSeed } from './kost-set-paa-main.spec.mjs'

const MOBILE = { width: 390, height: 844 }
const DESKTOP = { width: 1280, height: 900 }
const plus = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)
const uuid = n => `20340000-0000-4000-8000-${String(n).padStart(12, '0')}`

async function login(page, user) {
  await page.goto(APP_URL)
  await page.locator('#athlete-auth-email').fill(user.email)
  await page.locator('#athlete-auth-password').fill(user.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
}

function taeller(page) {
  return page.addInitScript(() => {
    window.__tryk = { klik: 0, felter: 0 }
    document.addEventListener('click', e => { if (e.isTrusted) window.__tryk.klik++ }, true)
    document.addEventListener('input', e => { if (e.isTrusted) window.__tryk.felter++ }, true)
  })
}
const tryk = page => page.evaluate(() => ({ ...window.__tryk }))
async function handling(page, rapport, navn, fn) {
  const foer = await tryk(page)
  await fn()
  const efter = await tryk(page)
  rapport.push({ navn, tryk: efter.klik - foer.klik + (efter.felter > foer.felter ? 1 : 0) })
}

// Scene A: ny atlet, ingen kostplan. Kost må ikke findes nogen steder hos atleten.
export async function runUdenPakke(page, outDir, rapport) {
  await taeller(page)
  await login(page, ATHLETE_USER)
  await page.getByRole('button', { name: /^Mere i dag/ }).or(page.getByText('Mere i dag')).first().waitFor({ timeout: 20000 })
  await page.waitForTimeout(1500)
  const fane = await page.getByRole('button', { name: 'Kost', exact: true }).count()
  if (fane !== 0) throw new Error(`Scene A: Kost-fanen står for en atlet uden kostplan (${fane})`)
  await page.getByText('Mere i dag').first().click()
  await page.waitForTimeout(300)
  const tekst = await page.locator('body').innerText()
  if (/\bKost\b/.test(tekst)) throw new Error('Scene A: ordet Kost står på Hjem for en atlet uden kostplan')
  if (/Log mad/.test(tekst)) throw new Error('Scene A: "Log mad" står på Hjem for en atlet uden kostplan')
  // Deep link til kost lander på Hjem.
  await page.goto(`${APP_URL}#kost`)
  await page.waitForTimeout(1500)
  if (await page.getByRole('region', { name: 'Kost i dag' }).count() !== 0) throw new Error('Scene A: #kost åbnede Kost i dag')
  await page.screenshot({ path: join(outDir, '2034f-atlet-uden-kost-390.png'), fullPage: false })
  rapport.push({ navn: 'A: atlet uden kostplan ser ingen Kost (fane, Hjem, deep link)', tryk: 0 })
}

// Scene B: atlet med en sendt uge. Følger dagen med ét tryk og finder indkøbslisten.
export async function runMedPakke(page, outDir, rapport) {
  await taeller(page)
  await login(page, ATHLETE_USER)
  const fane = page.getByRole('button', { name: 'Kost', exact: true }).first()
  await fane.waitFor({ timeout: 20000 })
  const kost = page.getByRole('region', { name: 'Kost i dag' })
  await handling(page, rapport, 'B: åbn Kost', async () => { await fane.click(); await kost.waitFor({ timeout: 20000 }) })
  const spist = kost.getByRole('button', { name: 'Frokost: spist som planlagt' })
  await spist.waitFor({ timeout: 15000 })
  await handling(page, rapport, 'B: log planens frokost som spist', async () => {
    await spist.click()
    await kost.getByText(/Frokost/).first().waitFor({ timeout: 15000 })
    await page.waitForTimeout(800)
  })
  await page.screenshot({ path: join(outDir, '2034f-atlet-kost-390.png'), fullPage: false })
  // Indkøbslisten ligger i laget bag "Vis detaljer" (KostIDag.mjs), ét tryk fra dagens kort.
  const indkoeb = page.getByRole('region', { name: 'Indkøb fra kostplanen' })
  await handling(page, rapport, 'B: åbn Vis detaljer og find indkøbslisten (udskriv og kopiér)', async () => {
    await page.getByRole('button', { name: 'Vis detaljer', exact: true }).click({ timeout: 15000 })
    await indkoeb.waitFor({ state: 'visible', timeout: 15000 })
    await indkoeb.getByRole('button', { name: 'Kopiér indkøbsliste' }).waitFor({ timeout: 15000 })
  })
}

// Scene C: coachen ser ugen og om planen holdes, ved 1280 px.
export async function runCoach(page, outDir, rapport) {
  await taeller(page)
  await login(page, COACH_USER)
  await page.getByText('Dine atleter (1)').waitFor({ timeout: 20000 })
  await handling(page, rapport, 'C: åbn atleten', async () => { await page.getByText('Atlet W', { exact: true }).first().click() })
  const kostFane = page.getByRole('button', { name: /Kost & mål/ }).first()
  await handling(page, rapport, 'C: åbn Kost & mål', async () => {
    if (!(await kostFane.isVisible().catch(() => false))) await page.getByRole('button', { name: /^Mere/ }).first().click({ timeout: 20000 })
    await kostFane.click({ timeout: 20000 })
  })
  const uge = page.locator('[data-claude-week="sendt"]')
  await uge.waitFor({ state: 'visible', timeout: 20000 })
  await page.getByText(/Seneste 7 dage mod kostplanen/).first().waitFor({ timeout: 20000 })
  rapport.push({ navn: 'C: ugen fra Claude står som sendt, og "Seneste 7 dage mod kostplanen" tæller dage inden for mål', tryk: 0 })
  await page.screenshot({ path: join(outDir, '2034f-coach-kost-1280.png'), fullPage: false })
}

// Loggen for Scene B og C: fem dage med måltider, så coachens linje mod kostplanen har noget at tælle.
function medLog(s) {
  const t = s.tables
  for (let i = 1; i <= 5; i++) {
    const dag = plus(s.today, -i)
    t.meal_logs.push({ id: uuid(i), athlete_id: ATHLETE_ID, date: dag, meal: 'Frokost', kcal: 450, protein: 30, carb: 45, fat: 12, created_at: `${dag}T12:00:00Z` },
      { id: uuid(10 + i), athlete_id: ATHLETE_ID, date: dag, meal: 'Aftensmad', kcal: 600, protein: 40, carb: 60, fat: 16, created_at: `${dag}T18:00:00Z` })
  }
  return s
}

async function main() {
  const outDir = process.argv[2] || OUT_DIR
  mkdirSync(outDir, { recursive: true })
  const vite = await startVite()
  const browser = await launchBrowser().catch(() => chromium.launch({ headless: true, channel: 'msedge' }))
  const rapport = []
  const errors = []
  let fejl = null
  try {
    for (const [navn, seedet, viewport, run] of [
      ['A', buildSeed(), MOBILE, runUdenPakke],
      ['B', medLog(ugeSeed()), MOBILE, runMedPakke],
      ['C', medLog(ugeSeed()), DESKTOP, runCoach],
    ]) {
      const mock = createMockSupabase({ users: seedet.users, tables: structuredClone(seedet.tables) })
      await mock.listen(MOCK_PORT)
      const context = await browser.newContext({ viewport, colorScheme: 'dark' })
      const page = await context.newPage()
      page.on('pageerror', err => errors.push(`${navn}: ${err.message}`))
      try {
        await run(page, outDir, rapport)
      } finally {
        await context.close()
        await mock.close()
      }
    }
    if (errors.length) throw new Error('pageerror: ' + errors.join(' | '))
  } catch (err) {
    fejl = err
  } finally {
    await browser.close()
    await vite.stop()
  }
  writeFileSync(join(outDir, '2034f-tryk.json'), JSON.stringify({ rapport, errors, ok: !fejl }, null, 2))
  for (const r of rapport) console.log(`${r.tryk} tryk: ${r.navn}`)
  if (fejl) { console.error('FEJL:', fejl.message); process.exit(1) }
  console.log('2034f e2e: alle tre scener grønne')
}

main()
