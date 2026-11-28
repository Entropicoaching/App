// ORDRE 2490: "Ret denne dag" aabner kostplan-editoren paa en sendt dag med dagens maaltider udfyldt.
// Foer: Ret, Aaben kostplan og alle maaltider tastet forfra (4 tryk, 6 felter, tom editor). Efter: 5 tryk, 1 felt.
// Ukendt foedevare i dagen giver tom editor som foer. 390 og 1280 px, lys og moerk.
// Koersel: E2E_VITE_PORT=5490 E2E_MOCK_PORT=8990 VITE_SUPABASE_URL=http://127.0.0.1:8990 node e2e/coach-ret-dag-2490.spec.mjs
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { createMockSupabase } from './mock-supabase.mjs'
import { COACH_USER } from './fixtures.mjs'
import { startVite, launchBrowser, APP_URL, MOCK_PORT } from './harness.mjs'
import { seed as ugeSeed } from './kost-set-paa-main.spec.mjs'
import { createPlanSnapshot } from '../src/entropi2/kostplan/planSnapshot.mjs'
import { FOODS } from '../src/entropi2/kostplan/foedevarer/index.mjs'
const BILLEDER = process.env.BILLED_MAPPE
const food = (f) => ({ id: f.id, name: f.name, preparation: 'syntetisk', basisGrams: 100,
  nutrientsPer100g: { energyKcal: 150, proteinG: 10, carbohydrateG: 15, fatG: 4 }, source: { citation: 'syntetisk fixture', verification: 'syntetisk' } })
const snap = ukendt => createPlanSnapshot({ goal: 'vedligehold', intensity: 0, meals: [
  { name: 'Morgenmad', portions: [{ grams: 200, food: food(FOODS[0]) }, { grams: 50, food: food(FOODS[1]) }] },
  { name: 'Frokost', portions: [{ grams: 300, food: ukendt ? { ...food(FOODS[2]), id: 'syn:ukendt' } : food(FOODS[2]) }] },
  { name: 'Aftensmad', portions: [{ grams: 400, food: food(FOODS[3]) }] }] })
function seed(ukendt) {
  const s = ugeSeed()
  const nyt = snap(ukendt)
  for (const v of s.tables.kostplan_v1_versions) { const { id, plan_id, version_no, effective_from, portion_guidance, basis_as_of, rationale } = v; for (const k of Object.keys(v)) delete v[k]; Object.assign(v, { id, plan_id, version_no, effective_from, portion_guidance, basis_as_of, rationale }, structuredClone(nyt)) }
  return s
}
const tema = (p, n) => p.evaluate(v => (v === 'lys' ? document.documentElement.setAttribute('data-tema', 'lys') : document.documentElement.removeAttribute('data-tema')), n)
const vite = await startVite(), browser = await launchBrowser(); const fejl = []
try {
  for (const [b, h] of [[390, 844], [1280, 800]]) for (const navn of ['lys', 'moerk']) for (const ukendt of [false, true]) {
    const s = seed(ukendt); const mock = createMockSupabase({ users: s.users, tables: structuredClone(s.tables) }); await mock.listen(MOCK_PORT)
    const ctx = await browser.newContext({ viewport: { width: b, height: h }, colorScheme: navn === 'lys' ? 'light' : 'dark' }); const p = await ctx.newPage()
    p.on('pageerror', e => fejl.push(e.message))
    try {
      await p.goto(APP_URL); await p.evaluate(() => { try { localStorage.clear() } catch {} }); await p.goto(APP_URL)
      await p.locator('#athlete-auth-email').fill(COACH_USER.email); await p.locator('#athlete-auth-password').fill(COACH_USER.password)
      await p.getByRole('button', { name: 'Log ind' }).click(); await p.locator('[data-coach-idag]').waitFor({ timeout: 20000 }); await tema(p, navn)
      let tryk = 0, felter = 0; const klik = async l => { tryk++; await l.click({ timeout: 15000 }) }
      await klik(p.getByRole('button', { name: 'Åbn programmet for Atlet W' })); await klik(p.getByRole('button', { name: /Kost & mål/ }).first())
      const dato = (await p.locator('[data-claude-week] li[data-day]').nth(1).getAttribute('data-day'))
      const li = p.locator(`li[data-day="${dato}"]`)
      await klik(li.locator('summary')); await klik(li.getByRole('button', { name: 'Ret denne dag' }))
      await p.getByText('Plandato').waitFor({ timeout: 15000 }); await p.waitForTimeout(1500)
      assert.equal(await p.locator('input[name="plan-date"]').inputValue(), dato, 'editoren staar paa den rettede dag')
      const gram = p.locator('input[name^="template-grams-"]'); const udfyldt = await gram.evaluateAll(l => l.filter(e => e.value).length)
      if (ukendt) assert.equal(udfyldt, 0, 'ukendt foedevare: tom editor som foer')
      else {
        assert.equal(udfyldt, 4, 'alle fire portioner staar udfyldt'); felter++
        await gram.nth(0).fill('250')
        await klik(p.getByRole('button', { name: /Brug måltider og generér dagsplan/ })); await p.waitForTimeout(2000)
        assert.ok(await p.getByText(/Dagsplan|Gem kladde|Aktivér/i).first().isVisible().catch(() => false), 'dagsplanen er genereret')
        assert.ok(tryk <= 5 && felter === 1, `foer 4 tryk og 6 felter foer generer; nu ${tryk} tryk og ${felter} felt`)
      }
      assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `intet vandret overloeb ved ${b} px`)
      if (BILLEDER && !ukendt && navn === 'moerk' && b === 390) { mkdirSync(BILLEDER, { recursive: true }); await p.screenshot({ path: `${BILLEDER}/ret-dag-efter-390.png` }) }
      console.log(`ret-dag-2490: ${b} px ${navn} ${ukendt ? 'ukendt foedevare' : 'forudfyldt'} OK, ${tryk} tryk, ${felter} felt`)
    } finally { await ctx.close(); await mock.close() }
  }
  assert.equal(fejl.length, 0, 'sidefejl: ' + fejl.join(' | '))
} catch (e) { console.error(e); process.exitCode = 1 } finally { await browser.close().catch(() => {}); await vite.stop().catch(() => {}) }
