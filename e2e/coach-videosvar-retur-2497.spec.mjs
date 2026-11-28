// ORDRE 2497: efter et delt videosvar foerer Luk coachen tilbage til forsiden, saa naeste video er 3 tryk (aabn, send, luk).
// Foer rettelsen var det 4 (ekstra tryk paa Forside fra atletprofilen). Mock, syntetiske atleter, 390 og 1280, lys og moerk.
// Koersel: E2E_VITE_PORT=5497 E2E_MOCK_PORT=8997 VITE_SUPABASE_URL=http://127.0.0.1:8997 node e2e/coach-videosvar-retur-2497.spec.mjs [lys|moerk] [390|1280]
import assert from 'node:assert/strict'
import { createMockSupabase } from './mock-supabase.mjs'
import { COACH_USER } from './fixtures.mjs'
import { startVite, launchBrowser, APP_URL, MOCK_PORT } from './harness.mjs'
import { seed } from './coach-videosvar-maal-2497.mjs'

const MAX_TRYK = Number(process.env.E2E_MAX_TRYK_2497 || 3)
const navn = process.argv[2] || 'lys'; const bredde = Number(process.argv[3] || 390)
const s = seed(); const mock = createMockSupabase({ users: s.users, tables: structuredClone(s.tables) }); await mock.listen(MOCK_PORT)
const vite = await startVite(); const browser = await launchBrowser()
try {
  const ctx = await browser.newContext({ viewport: { width: bredde, height: bredde === 390 ? 844 : 800 }, colorScheme: navn === 'lys' ? 'light' : 'dark', hasTouch: bredde === 390, isMobile: bredde === 390 })
  const p = await ctx.newPage(); const fejl = []; p.on('pageerror', e => fejl.push(e.message))
  await p.goto(APP_URL); await p.locator('#athlete-auth-email').fill(COACH_USER.email); await p.locator('#athlete-auth-password').fill(COACH_USER.password)
  await p.getByRole('button', { name: 'Log ind' }).click(); await p.locator('[data-coach-idag]').waitFor({ timeout: 20000 })
  const opg = p.getByRole('button', { name: /Video venter på feedback/ }); await opg.first().waitFor({ timeout: 15000 })
  const foer = await opg.count(); assert.equal(foer, 4, 'fire atleter med video venter')
  for (let runde = 1; runde <= 2; runde++) {
    let tryk = 0; const klik = async l => { await l.click({ timeout: 15000 }); tryk++ }
    await klik(opg.first()); const d = p.getByRole('dialog'); await d.waitFor({ timeout: 10000 })
    for (const [l, v] of [['Det fungerer', 'god dybde'], ['Atletens fokus', 'bryst op'], ['Næste gang', 'pres gulvet']]) await d.getByLabel(l, { exact: true }).first().fill(v)
    await p.waitForFunction(() => [...document.querySelectorAll('[role=dialog] button')].some(b => /Gem, godkend og del/.test(b.textContent) && !b.disabled), null, { timeout: 10000 })
    await klik(d.getByRole('button', { name: /Gem, godkend og del feedback/ }))
    await d.getByText(/Feedback gemt, godkendt og delt|DELT MED ATLET/i).first().waitFor({ timeout: 10000 }).catch(() => {})
    await p.waitForTimeout(800)
    await klik(p.getByRole('dialog').getByRole('button', { name: 'Luk' }))
    await p.locator('[data-coach-idag]').waitFor({ timeout: 10000 })
    await p.waitForTimeout(500)
    assert.equal(await opg.count(), [4, 3][runde - 1], `runde ${runde}: forsiden viser de ventende (Testatlet har to klip)`)
    assert.ok(tryk <= MAX_TRYK, `runde ${runde}: ${tryk} tryk (graense ${MAX_TRYK})`)
    console.log(`runde ${runde}: ${tryk} tryk, forsiden viser ${await opg.count()} video venter`)
  }
  assert.deepEqual(fejl, [], 'browserfejl')
  console.log(`GROEN (${navn} ${bredde})`)
} catch (e) { console.error('FEJL:', e.message); process.exitCode = 1 } finally { await browser.close().catch(() => {}); await vite.stop().catch(() => {}); await mock.close().catch(() => {}) }
