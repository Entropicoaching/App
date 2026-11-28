// ORDRE 2486 · atlethovedet over fanerne fylder mindre paa 390 px, saa indholdet kommer op paa skaermen.
// Maaler hoejden fra toppen til fanelinjen for en atlet med login, uden login og med kopieret invitation.
// Koersel: E2E_VITE_PORT=5486 E2E_MOCK_PORT=8986 VITE_SUPABASE_URL=http://127.0.0.1:8986 node e2e/coach-hoved-kompakt-2486.spec.mjs [billedmappe]
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { COACH_USER, buildSeed } from './fixtures.mjs'
import { createMockSupabase } from './mock-supabase.mjs'
import { startVite, launchBrowser, APP_URL, MOCK_PORT } from './harness.mjs'
const UD = process.argv[2]; if (UD) mkdirSync(UD, { recursive: true })
const seed = buildSeed()
const nu = new Date().toISOString()
const ny = (id, navn, email, user_id) => ({ id, user_id, name: navn, coach_id: COACH_USER.id, email, status: 'active', hidden: false, snooze_until: null, competition_date: null, onboarding_completed_at: nu })
seed.tables.athletes.push(ny('00000000-0000-4000-8000-000000002486', 'Atlet Invitation', 'invitation@e2e.test', null))
const mock = createMockSupabase(seed); await mock.listen(MOCK_PORT)
const vite = await startVite(), browser = await launchBrowser()
const hoved = async page => page.evaluate(() => {
  const fane = [...document.querySelectorAll('button')].find(b => /^\s*\S*\s*Program/i.test(b.textContent) && b.parentElement.style.borderBottom)
  return fane ? Math.round(fane.parentElement.getBoundingClientRect().bottom + window.scrollY) : null
})
const resultat = {}
try {
  for (const tema of ['dark', 'light']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: tema }); const page = await ctx.newPage()
    await page.goto(APP_URL); await page.locator('#athlete-auth-email').fill(COACH_USER.email); await page.locator('#athlete-auth-password').fill(COACH_USER.password)
    await page.getByRole('button', { name: 'Log ind' }).click(); await page.locator('[data-coach-idag]').waitFor({ timeout: 20000 })
    // atlet med login
    await page.getByRole('button', { name: 'Åbn programmet for Testatlet' }).first().click()
    await page.getByRole('button', { name: 'Rediger Squat' }).waitFor({ timeout: 8000 })
    resultat[tema + '-login'] = await hoved(page)
    if (UD) await page.screenshot({ path: `${UD}/hoved-login-${tema}.png` })
    // atlet uden login
    await page.getByRole('button', { name: /Tilbage til/i }).click()
    await page.getByText('Atlet Invitation').first().click().catch(() => {})
    let mailFelt = page.locator('#atlet-login-mail')
    if (!(await mailFelt.count())) {
      await page.getByRole('button', { name: /Åbn programmet for Atlet Invitation/ }).first().click()
      mailFelt = page.locator('#atlet-login-mail')
    }
    await mailFelt.waitFor({ timeout: 8000 })
    await page.getByRole('button', { name: 'Kopiér invitation' }).waitFor({ timeout: 8000 })
    resultat[tema + '-uden-login'] = await hoved(page)
    if (UD) await page.screenshot({ path: `${UD}/hoved-uden-login-${tema}.png` })
    await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => {} }, configurable: true }) })
    await page.getByRole('button', { name: 'Kopiér invitation' }).click(); await page.waitForTimeout(500)
    resultat[tema + '-efter-kopi'] = await hoved(page)
    if (UD) await page.screenshot({ path: `${UD}/hoved-efter-kopi-${tema}.png` })
    const bred = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    assert.ok(bred <= 0, 'intet vandret overloeb')
    await ctx.close()
  }
  console.log(JSON.stringify(resultat))
  if (process.env.MAAL_KUN !== '1') {
    for (const t of ['dark', 'light']) {
      assert.ok(resultat[t + '-efter-kopi'] <= 360, `efter kopi: hovedet er højst 360 px (${resultat[t + '-efter-kopi']})`)
      assert.ok(resultat[t + '-efter-kopi'] < resultat[t + '-uden-login'], 'hovedet skrumper, naar invitationen er kopieret')
      assert.ok(resultat[t + '-uden-login'] <= 440 && resultat[t + '-login'] <= 300, 'Mere ligger paa samme linje som faner: login højst 300, uden login højst 440')
    }
    console.log('coach-hoved-kompakt-2486: OK')
  }
} catch (e) { console.error(e); process.exitCode = 1 } finally { await browser.close().catch(() => {}); await vite.stop().catch(() => {}); await mock.close().catch(() => {}) }
