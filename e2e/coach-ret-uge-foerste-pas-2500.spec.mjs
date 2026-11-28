// ORDRE 2500 · efter "Kopiér seneste uge" staar foerste pas i den nye uge aabent, saa foerste ret (vaegt paa hovedloeft) er 4 tryk fra atletlisten.
// Koersel: E2E_VITE_PORT=5500 E2E_MOCK_PORT=8900 VITE_SUPABASE_URL=http://127.0.0.1:8900 node e2e/coach-ret-uge-foerste-pas-2500.spec.mjs
import assert from 'node:assert/strict'
import { COACH_USER, WEEK_ID } from './fixtures.mjs'
import { createMockSupabase } from './mock-supabase.mjs'
import { startVite, launchBrowser, APP_URL, MOCK_PORT } from './harness.mjs'
import { seed } from './coach-ret-uge-maal-2500.mjs'
const s = seed(); const mock = createMockSupabase({ users: s.users, tables: structuredClone(s.tables) }); await mock.listen(MOCK_PORT)
const vite = await startVite(), browser = await launchBrowser()
try {
  for (const [bredde, hoejde, tema] of [[390, 844, 'lys'], [390, 844, 'moerk'], [1280, 800, 'lys'], [1280, 800, 'moerk']]) {
    for (const t of mock.table('weeks').filter(w => w.id !== WEEK_ID)) mock.table('weeks').splice(mock.table('weeks').indexOf(t), 1)
    const ctx = await browser.newContext({ viewport: { width: bredde, height: hoejde } }); const page = await ctx.newPage()
    await page.goto(APP_URL); await page.evaluate(() => { try { localStorage.clear() } catch {} }); await page.goto(APP_URL)
    await page.locator('#athlete-auth-email').fill(COACH_USER.email); await page.locator('#athlete-auth-password').fill(COACH_USER.password)
    await page.getByRole('button', { name: 'Log ind' }).click(); await page.locator('[data-coach-idag]').waitFor({ timeout: 20000 })
    await page.evaluate(v => (v === 'lys' ? document.documentElement.setAttribute('data-tema', 'lys') : document.documentElement.removeAttribute('data-tema')), tema)
    let tryk = 0; const klik = async l => { tryk++; await l.click({ timeout: 15000 }) }
    await klik(page.getByRole('button', { name: 'Åbn programmet for Testatlet' }).first())
    await klik(page.getByRole('button', { name: /Kopiér seneste uge/ }))
    const ny = page.getByRole('button', { name: 'Rediger anbefalet vægt for Squat' })
    await ny.first().waitFor({ timeout: 8000 })
    await klik(ny.last()); await page.getByLabel('Anbefalet vægt (kg)').fill('105'); await klik(page.getByRole('button', { name: 'Gem', exact: true }).last()); await page.waitForTimeout(800)
    assert.equal(tryk, 4, `${bredde} ${tema}: 4 tryk fra atletlisten til rettet vægt (ikke 5)`)
    const nyUge = mock.table('weeks').find(w => w.id !== WEEK_ID)
    const nyPas = mock.table('sessions').filter(x => x.week_id === nyUge.id).sort((a, b) => a.session_order - b.session_order)[0]
    assert.equal(mock.table('exercises').find(e => e.session_id === nyPas.id && e.name === 'Squat').recommended_weight, 105)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'ingen vandret overløb')
    await ctx.close()
  }
  console.log('coach-ret-uge-foerste-pas-2500: OK, 4 tryk fra atletlisten til rettet vægt i ny uge (390 og 1280, lys og mørk)')
} catch (e) { console.error(e); process.exitCode = 1 } finally { await browser.close().catch(() => {}); await vite.stop().catch(() => {}); await mock.close().catch(() => {}) }
