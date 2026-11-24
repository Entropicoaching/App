// ORDRE 2093 · Entropi 2-passet viser appens forslag og Marcs rolige smertelinje.
//   Atlet 390 px, lys og moerk: uden smerte staar "Appens forslag: N kg" og "Næste: N reps @ y kg";
//   med smerte-note paa knaeet (samme region, 14 dage) staar kun "Ingen forslag i dag: tal med din coach om smerten";
//   smerte i skulderen rammer ikke Squat. Syntetiske data (seed fra saet-smerte-1560).
// Koersel: E2E_VITE_PORT=5293 E2E_MOCK_PORT=8993 VITE_SUPABASE_URL=http://127.0.0.1:8993 node e2e/smerte-forslag-2093.spec.mjs
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { ATHLETE_USER } from './fixtures.mjs'
import { atletSeed } from './saet-smerte-1560.spec.mjs'

const LINJE = 'Ingen forslag i dag: tal med din coach om smerten'
const FORSLAG = /Appens forslag:\s*[\d.,]+\s*kg/
const NAESTE = /Næste:\s*[\d–-]+ reps @ [\d.,]+ kg/

async function loeb(browser, { createMockSupabase, MOCK_PORT, APP_URL, OUT_DIR }, { tema, foer, stop, billede }) {
  const mock = createMockSupabase(atletSeed(foer))
  await mock.listen(MOCK_PORT)
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  const fejl = []
  try {
    const page = await ctx.newPage()
    page.on('pageerror', err => fejl.push(err.message))
    await page.addInitScript(t => {
      try { localStorage.setItem('entropi:tema', t) } catch {}
      try { Object.defineProperty(Notification, 'permission', { get: () => 'default' }) } catch {}
    }, tema)
    await page.goto(APP_URL)
    await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
    await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
    await page.getByRole('button', { name: 'Log ind' }).click()
    const spring = page.getByRole('button', { name: /Spring guiden over/ })
    if (await spring.count()) await spring.first().click()
    await page.getByRole('button', { name: 'Start dagens pas' }).first().click()
    await page.getByText('Sæt 1 af 4', { exact: true }).waitFor({ state: 'visible', timeout: 15000 })
    await page.waitForTimeout(800)
    const tekst = await page.evaluate(() => [...document.querySelectorAll('dialog[open], [role="dialog"]')].map(n => n.innerText).join('\n') || document.body.innerText)
    if (stop) {
      assert.ok(tekst.includes(LINJE), `forventede den rolige linje (${tema}/${billede}): ${tekst.slice(0, 500)}`)
      assert.ok(!FORSLAG.test(tekst) && !NAESTE.test(tekst), 'intet forslagstal maa vises naar smerten rammer loeftet')
    } else {
      assert.ok(FORSLAG.test(tekst) && NAESTE.test(tekst), `forventede forslag og Næste (${tema}/${billede}): ${tekst.slice(0, 500)}`)
      assert.ok(!tekst.includes(LINJE), 'den rolige linje maa ikke vises uden smerte')
    }
    await page.screenshot({ path: join(OUT_DIR, `smerte-forslag-2093-${tema}-${billede}.png`), fullPage: false })
    assert.deepEqual(fejl, [], `browser-fejl: ${fejl.join(' | ')}`)
  } finally { await ctx.close().catch(() => {}); await mock.close().catch(() => {}) }
}

async function main() {
  const { createMockSupabase } = await import('./mock-supabase.mjs')
  const { startVite, launchBrowser, APP_URL, MOCK_PORT, OUT_DIR } = await import('./harness.mjs')
  const vite = await startVite(); const browser = await launchBrowser()
  try {
    for (const tema of ['lys', 'moerk']) {
      const c = { createMockSupabase, MOCK_PORT, APP_URL, OUT_DIR }
      await loeb(browser, c, { tema, foer: [{ navn: 'Squat', note: null }], stop: false, billede: '1-forslag' })
      await loeb(browser, c, { tema, foer: [{ navn: 'Squat', note: 'knæet gør ondt i bunden' }], stop: true, billede: '2-smerte' })
      await loeb(browser, c, { tema, foer: [{ navn: 'Squat', note: null }, { navn: 'Bænkpres', note: 'skulderen stikker' }], stop: false, billede: '3-skulder-paa-squat' })
    }
    console.log('\nGRØN: pas i Entropi 2 viser forslag uden smerte og den rolige linje med smerte-note, 390 px, lys og mørk.')
  } catch (err) { console.error('\nFEJL:', err.message); process.exitCode = 1 }
  finally { await browser.close().catch(() => {}); await vite.stop().catch(() => {}) }
}
if (process.argv[1] && process.argv[1].endsWith('smerte-forslag-2093.spec.mjs')) main()
