// 1936: et forkert logget maaltid fjernes direkte i Kost i dag (390 px, lys og moerk, mod mocken, localStorage ryddet foer hver).
// Kun syntetisk "Atlet N". Kør: node e2e/kost-fjern-maaltid.spec.mjs
import { join } from 'node:path'
import { createMockSupabase } from './mock-supabase.mjs'
import { buildSeed, ATHLETE_USER, ATHLETE_ID } from './fixtures.mjs'
import { startVite, launchBrowser, chromium, APP_URL, MOCK_PORT, OUT_DIR } from './harness.mjs'

const MOBILE = { width: 390, height: 844 }

async function login(page, user) {
  await page.goto(APP_URL)
  await page.locator('#athlete-auth-email').fill(user.email)
  await page.locator('#athlete-auth-password').fill(user.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
}

export async function runFjern(page, mock, today, outDir = OUT_DIR, tema = 'moerk') {
  await page.goto(APP_URL)
  await page.evaluate(() => { try { localStorage.clear() } catch { /* ignoreret */ } })
  await login(page, ATHLETE_USER)
  const aabn = async () => {
    await page.getByRole('button', { name: 'Kost', exact: true }).first().click({ timeout: 20000 })
    const kost = page.getByRole('region', { name: 'Kost i dag' })
    await kost.waitFor({ state: 'visible', timeout: 20000 })
    await page.evaluate(v => (v === 'lys' ? document.documentElement.setAttribute('data-tema', 'lys') : document.documentElement.removeAttribute('data-tema')), tema)
    return kost
  }
  let kost = await aabn()
  const idag = () => mock.table('meal_logs').filter(r => r.athlete_id === ATHLETE_ID && r.date === today)
  const foer = idag().length
  // Log to måltider, genindlæs, og fjern det forkerte med ét tryk uden at åbne laget.
  for (const navn of ['skyr naturel', 'banan']) {
    await kost.getByRole('searchbox').fill(navn)
    await kost.getByRole('group', { name: 'Forslag' }).getByRole('button').first().click()
    await kost.getByRole('button', { name: /^Log /, exact: false }).last().click()
    await page.waitForFunction(n => document.body.innerText.includes(n), 'gemt.', { timeout: 15000 })
  }
  if (idag().length !== foer + 2) throw new Error(`Skulle have ${foer + 2} rækker, fik ${idag().length}`)
  await page.reload()
  kost = await aabn()
  const knapper = kost.getByRole('button', { name: /^Fjern måltid:/ })
  await knapper.first().waitFor({ timeout: 15000 })
  const bredde = await page.evaluate(() => document.documentElement.scrollWidth)
  if (bredde > MOBILE.width + 1) throw new Error(`Vandret scroll på 390 px: ${bredde}px`)
  await page.screenshot({ path: join(outDir, `1936-foer-fjern-${tema}.png`), fullPage: true })
  const laget = await page.locator('[data-kost-detaljer="aaben"]').count()
  if (laget) throw new Error('Laget skulle være lukket')
  const navn = (await knapper.first().getAttribute('aria-label')).replace('Fjern måltid: ', '')
  const andre = idag().filter(r => r.meal !== navn).map(r => r.id)
  await knapper.first().click() // tryk 1
  await kost.getByText(`${navn} er fjernet.`).waitFor({ timeout: 15000 })
  if (idag().length !== foer + 1 || idag().some(r => r.meal === navn)) throw new Error('Kun den ene række skulle være væk')
  if (!andre.every(id => idag().some(r => r.id === id))) throw new Error('Andre rækker må ikke røres')
  await page.screenshot({ path: join(outDir, `1936-efter-fjern-${tema}.png`), fullPage: true })
  const fortryd = kost.getByRole('button', { name: 'Fortryd', exact: true })
  await fortryd.click()
  await kost.getByText(`${navn} er sat tilbage.`).waitFor({ timeout: 15000 })
  if (idag().length !== foer + 2) throw new Error('Fortryd skulle lægge rækken tilbage')
  // Fjern igen og genindlæs: borte for altid.
  await kost.getByRole('button', { name: `Fjern måltid: ${navn}` }).first().click()
  await kost.getByText(`${navn} er fjernet.`).waitFor({ timeout: 15000 })
  await page.reload()
  kost = await aabn()
  await kost.getByRole('button', { name: /^Fjern måltid:/ }).first().waitFor({ timeout: 15000 })
  if (idag().length !== foer + 1) throw new Error('Rækken skulle stadig være fjernet efter genindlæsning')
  return { tema, foer, efterFjern: foer + 1, tryk: 1 }
}

async function main() {
  const s = buildSeed({ now: new Date() })
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen' }).format(new Date())
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
        const r = await runFjern(page, mock, today, OUT_DIR, tema)
        if (errors.length) throw new Error('browserfejl: ' + errors.join('; '))
        console.log(JSON.stringify(r))
      } finally { await page.close(); await mock.close?.() }
    }
  } catch (e) { fejl = e } finally { await browser.close(); await vite.stop() }
  if (fejl) throw fejl
}

if (import.meta.url === `file:///${process.argv[1].split(String.fromCharCode(92)).join("/")}`) main().catch(err => { console.error(err); process.exitCode = 1 })
