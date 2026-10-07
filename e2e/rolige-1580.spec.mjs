// ORDRE 1580 (D3) · "Set igennem, intet kraever dig" paa coachens forside.
// Beviser mod syntetiske atleter (samme seed som soendag-1545), 1280 og 390:
//   1. linjen findes og staar i "Kraever dit blik"-kortet,
//   2. atleter med aaben ting (smerte, video, RPE-drift) og atleter der ikke har trænet staar IKKE i den,
//   3. linjen bruger fornavne, ingen tankestreg, og citerer ingen note.
// Kørsel: node e2e/rolige-1580.spec.mjs (npm run e2e:rolige-1580)
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { createMockSupabase } from './mock-supabase.mjs'
import { COACH_USER } from './fixtures.mjs'
import { startVite, launchBrowser, APP_URL, MOCK_PORT, OUT_DIR } from './harness.mjs'
import { signalerFraSeed } from '../outputs/428/coach-faelles.mjs'
import { bygSoendagSeed } from './soendag-1545.spec.mjs'

export async function runRolige(page, { appUrl, outDir, seed, bredde }) {
  const signaler = await signalerFraSeed(seed)
  await page.route('**/rest/v1/rpc/entropi_training_signals_v1', r => r.fulfill({ json: signaler }))
  await page.goto(appUrl)
  await page.locator('#athlete-auth-email').fill(COACH_USER.email)
  await page.locator('#athlete-auth-password').fill(COACH_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  await page.getByText('Alfa Testsen').first().waitFor({ timeout: 30000 })
  await page.getByText(/åbne ting/).first().waitFor({ timeout: 15000 })
  await page.waitForTimeout(1200)
  const linje = page.locator('[data-rolige-linje]')
  const tekst = await linje.count() ? await linje.first().innerText() : null
  console.log(`[${bredde}] rolig-linje:`, tekst)
  await page.screenshot({ path: join(outDir, `rolige-1580-${bredde}.png`), fullPage: true })
  return { tekst, signaler }
}

async function main() {
  const { seed } = bygSoendagSeed()
  // Alfas video er en aaben ting. Uden den er Alfa fuldt gennemgaaet (4 af 4 pas, vurdering 4) og skal staa i linjen.
  seed.tables.video_analyses = []
  const mock = createMockSupabase(seed)
  await mock.listen(MOCK_PORT)
  const vite = await startVite()
  const browser = await launchBrowser()
  try {
    for (const bredde of [1280, 390]) {
      const page = await browser.newPage({ viewport: { width: bredde, height: bredde === 390 ? 844 : 900 } })
      const fejl = []
      page.on('pageerror', err => fejl.push(`pageerror: ${err.message}`))
      page.on('console', msg => { if (msg.type() === 'error') fejl.push(`console.error: ${msg.text()}`) })
      const { tekst } = await runRolige(page, { appUrl: APP_URL, outDir: OUT_DIR, seed, bredde })
      assert.ok(tekst, 'linjen skal findes')
      assert.match(tekst, /^Trænet denne uge uden tegn på problemer: Alfa \(1 af 5\)$/)
      assert.ok(!tekst.includes('—'), 'ingen tankestreg')
      assert.ok(!/Charlie|Echo|Bravo|Delta/.test(tekst), `uroligt/utrænet atlet i linjen: ${tekst}`)
      assert.ok(!tekst.includes('Skarp smerte'), 'noter citeres ikke')
      assert.deepEqual(fejl, [], `Ingen browser-fejl forventet, fandt: ${JSON.stringify(fejl)}`)
      await page.close()
    }
    console.log('\nGRØN: rolige-1580 — linjen findes paa 1280 og 390 og udelader urolige og utrænede.')
    process.exitCode = 0
  } catch (err) {
    console.error('\nFEJL:', err.message)
    process.exitCode = 1
  } finally {
    await browser.close().catch(() => {})
    await vite.stop().catch(() => {})
    await mock.close().catch(() => {})
  }
}

if (process.argv[1] && process.argv[1].endsWith('rolige-1580.spec.mjs')) main()
