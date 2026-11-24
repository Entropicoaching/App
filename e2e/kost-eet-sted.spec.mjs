// 1940: hvert logget måltid står ét sted i Kost i dag, med Ret og Fjern i samme række (390 px, lys og mørk, mod mocken, localStorage ryddet før hver).
// Kun syntetisk "Atlet N". Kør: node e2e/kost-eet-sted.spec.mjs
import { join } from 'node:path'
import { createMockSupabase } from './mock-supabase.mjs'
import { buildSeed, ATHLETE_USER, kostPakkeTilAtlet } from './fixtures.mjs'
import { startVite, launchBrowser, chromium, APP_URL, MOCK_PORT, OUT_DIR } from './harness.mjs'

const MOBILE = { width: 390, height: 844 }

export async function runEetSted(page, outDir = OUT_DIR, tema = 'moerk') {
  await page.goto(APP_URL)
  await page.evaluate(() => { try { localStorage.clear() } catch { /* ignoreret */ } })
  await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
  await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  const aabn = async () => {
    await page.getByRole('button', { name: 'Kost', exact: true }).first().click({ timeout: 20000 })
    const kost = page.getByRole('region', { name: 'Kost i dag' })
    await kost.waitFor({ state: 'visible', timeout: 20000 })
    await page.evaluate(v => (v === 'lys' ? document.documentElement.setAttribute('data-tema', 'lys') : document.documentElement.removeAttribute('data-tema')), tema)
    return kost
  }
  let kost = await aabn()
  for (const navn of ['skyr naturel', 'banan']) {
    await kost.getByRole('searchbox').fill(navn)
    await kost.getByRole('group', { name: 'Forslag' }).getByRole('button').first().click()
    await kost.getByRole('button', { name: /^Log /, exact: false }).last().click()
    await page.waitForFunction(n => document.body.innerText.includes(n), 'gemt.', { timeout: 15000 })
  }
  await page.reload()
  kost = await aabn()
  await kost.getByRole('button', { name: /^Fjern måltid:/ }).first().waitFor({ timeout: 15000 })
  const bredde = await page.evaluate(() => document.documentElement.scrollWidth)
  if (bredde > MOBILE.width + 1) throw new Error(`Vandret scroll på 390 px: ${bredde}px`)
  await page.screenshot({ path: join(outDir, `1940-efter-${tema}.png`), fullPage: true })
  const overskrifter = await kost.getByText('Logget i dag', { exact: false }).count()
  if (overskrifter !== 1) throw new Error(`Skulle have én overskrift, fik ${overskrifter}`)
  if (await kost.getByText('Fjern et forkert måltid').count()) throw new Error('Den gamle Fjern-overskrift skulle være væk')
  const raekker = kost.locator('ul li')
  const antal = await raekker.count()
  if (antal !== 2) throw new Error(`Skulle have 2 rækker, fik ${antal}`)
  for (let i = 0; i < antal; i++) {
    const fjern = await raekker.nth(i).getByRole('button', { name: /^Fjern måltid:/ }).count()
    const ret = await raekker.nth(i).getByRole('button', { name: /^Ret mængde:/ }).count()
    if (fjern !== 1 || ret !== 1) throw new Error(`Række ${i} skulle have Ret og Fjern, fik ${ret}/${fjern}`)
  }
  // Fjern og Fortryd virker som i 1936.
  const navn = (await raekker.first().getByRole('button', { name: /^Fjern måltid:/ }).getAttribute('aria-label')).replace('Fjern måltid: ', '')
  await raekker.first().getByRole('button', { name: /^Fjern måltid:/ }).click()
  await kost.getByText(`${navn} er fjernet.`).waitFor({ timeout: 15000 })
  if (await raekker.count() !== 1) throw new Error('Rækken skulle være væk')
  await kost.getByRole('button', { name: 'Fortryd', exact: true }).click()
  await kost.getByText(`${navn} er sat tilbage.`).waitFor({ timeout: 15000 })
  if (await raekker.count() !== 2) throw new Error('Fortryd skulle lægge rækken tilbage')
  return { tema, raekker: antal, overskrifter }
}

async function main() {
  const s = buildSeed({ now: new Date() })
  kostPakkeTilAtlet(s.tables) // 2034f: Kost vises kun med kostpakke
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
        const r = await runEetSted(page, OUT_DIR, tema)
        if (errors.length) throw new Error('browserfejl: ' + errors.join('; '))
        console.log(JSON.stringify(r))
      } finally { await page.close(); await mock.close?.() }
    }
  } catch (e) { fejl = e } finally { await browser.close(); await vite.stop() }
  if (fejl) throw fejl
}

if (import.meta.url === `file:///${process.argv[1].split(String.fromCharCode(92)).join("/")}`) main().catch(err => { console.error(err); process.exitCode = 1 })
