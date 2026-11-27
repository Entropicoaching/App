// ORDRE 2454a: hvert punkt under "Mere" i atletens bundmenu skal aabne en visning (390 px).
// Kor: E2E_VITE_PORT=5454 E2E_MOCK_PORT=8954 VITE_SUPABASE_URL=http://127.0.0.1:8954 node e2e/atlet-mere-2454.spec.mjs
import { ATHLETE_USER, buildSeed, kostPakkeTilAtlet } from './fixtures.mjs'

const { createMockSupabase } = await import('./mock-supabase.mjs')
const { startVite, launchBrowser, APP_URL, MOCK_PORT } = await import('./harness.mjs')
const s = buildSeed({ withLogs: true }); kostPakkeTilAtlet(s.tables)
const mock = createMockSupabase(s); await mock.listen(MOCK_PORT)
const vite = await startVite(); const browser = await launchBrowser()
const res = []; let fejl = 0
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
  const page = await ctx.newPage()
  const konsol = []
  page.on('pageerror', e => konsol.push(e.message))
  page.on('console', m => { if (m.type() === 'error') konsol.push(m.text()) })
  // Safari/iOS giver ikke en trykket knap fokus: fokus forlader summary uden relatedTarget.
  // Emuler det ved at tage fokus fra det aktive element, naar et tryk starter paa en knap i menuen.
  await page.addInitScript(() => {
    document.addEventListener('mousedown', e => {
      if (!e.defaultPrevented && e.target.closest?.('[data-entropi2-bundnav] details button')) document.activeElement?.blur?.()
    })
  })
  await page.addInitScript(() => { try { Object.defineProperty(Notification, 'permission', { get: () => 'default' }) } catch {} })
  await page.goto(APP_URL)
  await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
  await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  await page.getByRole('button', { name: 'Hjem', exact: true }).first().waitFor({ state: 'attached', timeout: 25000 })
  await page.waitForTimeout(1500)
  const skip = page.getByRole('button', { name: /Spring over/ })
  if (await skip.count()) { await skip.first().evaluate(el => el.click()); await page.waitForTimeout(400) }
  const nav = page.locator('[data-entropi2-bundnav]')
  const punkter = await nav.locator('details button').evaluateAll(b => b.map(x => x.textContent.trim()))
  console.log('Mere-punkter:', JSON.stringify(punkter))
  for (const navn of punkter) {
    await page.getByRole('button', { name: 'Hjem', exact: true }).last().evaluate(el => el.click())
    await page.waitForTimeout(600)
    const foer = await page.locator('main, body').first().innerText()
    await nav.locator('details summary').tap()
    await nav.locator('details button', { hasText: navn }).first().tap()
    await page.waitForTimeout(1500)
    const aktiv = await nav.locator('details button[aria-current="page"]', { hasText: navn }).count()
    const tekst = await page.locator('body').innerText()
    const aaben = aktiv > 0 && tekst !== foer && tekst.trim().length > 40
    res.push({ navn, aktiv, aaben, tegn: tekst.length })
    if (!aaben) fejl++
  }
  console.log(JSON.stringify(res)); console.log(JSON.stringify((await page.locator('body').innerText()).slice(0, 300))); console.log('konsolfejl:', JSON.stringify(konsol.slice(0, 5)))
} finally { await browser.close().catch(() => {}); await mock.close().catch(() => {}); await vite.stop?.() }
if (fejl) { console.error(`FEJL: ${fejl} Mere-punkter aabner intet`); process.exit(1) }
console.log('OK: alle Mere-punkter aabner en visning')
