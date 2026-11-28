// ORDRE 2482m: Mere, Mobilitet aabner den guidede visning (Hvad har du brug for, Varm op, din session med timer), ikke tekstlisten (390 px).
// Kor: E2E_VITE_PORT=5482 E2E_MOCK_PORT=8982 VITE_SUPABASE_URL=http://127.0.0.1:8982 node e2e/atlet-mobilitet-2482m.spec.mjs
import { join } from 'node:path'
import { ATHLETE_USER, buildSeed, kostPakkeTilAtlet } from './fixtures.mjs'

const { createMockSupabase } = await import('./mock-supabase.mjs')
const { startVite, launchBrowser, APP_URL, MOCK_PORT, OUT_DIR } = await import('./harness.mjs')
const s = buildSeed({ withLogs: true }); kostPakkeTilAtlet(s.tables)
const mock = createMockSupabase(s); await mock.listen(MOCK_PORT)
const vite = await startVite(); const browser = await launchBrowser()
let fejl = 0
const kraev = (ok, tekst) => { console.log(ok ? 'OK  ' : 'FEJL', tekst); if (!ok) fejl++ }
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
  const page = await ctx.newPage()
  const konsol = []
  page.on('pageerror', e => konsol.push(e.message))
  // Safari/iOS giver ikke en trykket knap fokus (2454a): bevar rettelsen i beviset.
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
  const body = () => page.locator('body').innerText()
  const shot = n => page.screenshot({ path: join(OUT_DIR, `2482m-${n}.png`) })
  await nav.locator('details summary').tap()
  await nav.locator('details button', { hasText: 'Mobilitet' }).first().tap()
  await page.waitForTimeout(1200)
  let t = await body()
  kraev(/Hvad har du brug for/.test(t) && /Varm op/.test(t) && /Byg en session/.test(t), 'Mere, Mobilitet viser Hvad har du brug for med Varm op og Byg en session')
  kraev(!/Find øvelser efter problematik/.test(t), 'den gamle tekstliste Find øvelser efter problematik er væk')
  kraev(await nav.locator('details button[aria-current="page"]', { hasText: 'Mobilitet' }).count() === 1, 'Mere peger paa Mobilitet')
  await shot('hub')
  await page.getByRole('button', { name: /Byg en session/ }).tap()
  await page.waitForTimeout(800)
  t = await body()
  kraev(/DIN SESSION/i.test(t) && /start →/i.test(t) && /fjern/.test(t), 'Byg en session viser Din session med øvelsesvalg og Start')
  await shot('session')
  await page.getByRole('button', { name: /^‹ Mobilitet/ }).tap()
  await page.waitForTimeout(600)
  kraev(/Hvad har du brug for/.test(await body()), 'tilbage fra sessionen virker (hub igen)')
  await page.getByRole('button', { name: /Byg en session/ }).tap()
  await page.getByRole('button', { name: /Start →/ }).tap()
  await page.waitForTimeout(900)
  t = await body()
  kraev(/næste øvelse/i.test(t) && /afslut/i.test(t), 'Start aabner vejledningen med Næste øvelse og Afslut')
  await shot('vejledning')
  await page.getByRole('button', { name: /✕ Afslut/ }).tap()
  await page.waitForTimeout(600)
  kraev(/din session/i.test(await body()), 'Afslut i vejledningen giver sessionen igen')
  await page.getByRole('button', { name: /Start →/ }).tap()
  for (let i = 0; i < 12; i++) {
    const naeste = page.getByRole('button', { name: /Næste øvelse/ })
    if (!await naeste.count()) break
    await naeste.tap(); await page.waitForTimeout(250)
  }
  await page.getByRole('button', { name: /Afslut ✓/ }).tap()
  await page.waitForTimeout(600)
  await shot('faerdig')
  kraev(/✓/.test(await body()), 'sidste øvelse viser faerdig-skærmen')
  await page.getByRole('button', { name: /Til mobilitet/ }).tap()
  await page.waitForTimeout(600)
  kraev(/Hvad har du brug for/.test(await body()), 'Til mobilitet giver hub igen')
  await page.getByRole('button', { name: /Varm op/ }).first().tap()
  await page.waitForTimeout(800)
  kraev(!/Hvad har du brug for/.test(await body()), 'Varm op aabner en egen visning')
  await shot('varm-op')
  console.log('konsolfejl:', JSON.stringify(konsol.slice(0, 5)))
  kraev(konsol.length === 0, 'ingen sidefejl')
} finally { await browser.close().catch(() => {}); await mock.close().catch(() => {}); await vite.stop?.() }
if (fejl) { console.error(`FEJL: ${fejl}`); process.exit(1) }
console.log('OK: Mere, Mobilitet er den gode visning')
