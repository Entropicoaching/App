// ORDRE 2487: mail-knappen hedder Gem mail, og sidemenuen skiller to ens fornavne (390 og 1280, mock, syntetiske navne).
// Egen koersel: `node e2e/coach-smaa-ting-2487.spec.mjs` (kraever VITE_SUPABASE_URL til mockens port).
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { COACH_USER, buildSeed } from './fixtures.mjs'

async function main() {
  const { createMockSupabase } = await import('./mock-supabase.mjs')
  const { startVite, launchBrowser, APP_URL, MOCK_PORT, OUT_DIR } = await import('./harness.mjs')
  const seed = buildSeed(); const t = seed.tables
  const base = t.athletes[0]
  const ny = (id, name) => ({ ...base, id, name, user_id: null, email: null })
  t.athletes = [ny('00000000-0000-4000-8000-0000000024a1', 'Testa Alfa'), ny('00000000-0000-4000-8000-0000000024a2', 'Testa Beta'), ny('00000000-0000-4000-8000-0000000024a3', 'Soli Gamma')]
  t.weeks = []; t.sessions = []; t.exercises = []
  const vite = await startVite()
  const browser = await launchBrowser()
  const mock = createMockSupabase(seed)
  await mock.listen(MOCK_PORT)
  const fejl = []
  try {
    for (const [w, h] of [[390, 844], [1280, 800]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h } })
      const page = await ctx.newPage()
      page.on('pageerror', e => fejl.push(String(e)))
      await page.goto(APP_URL)
      await page.locator('#athlete-auth-email').fill(COACH_USER.email)
      await page.locator('#athlete-auth-password').fill(COACH_USER.password)
      await page.getByRole('button', { name: 'Log ind' }).click()
      await page.getByText('Testa A.').first().waitFor({ state: 'attached', timeout: 15000 })
      const sidetekst = await page.locator('body').innerText()
      assert.ok(sidetekst.includes('Testa A.') || (await page.content()).includes('Testa A.'))
      assert.ok((await page.content()).includes('Testa B.'))
      assert.ok(!(await page.content()).includes('Soli G.'), 'unikt fornavn faar ikke forbogstav')
      await page.getByRole('button', { name: /Åbn programmet for Testa Alfa|Testa Alfa/ }).first().click().catch(() => {})
      await page.getByRole('button', { name: 'Gem mail', exact: true }).waitFor({ state: 'visible', timeout: 10000 })
      assert.equal(await page.getByRole('button', { name: 'Gem', exact: true }).count(), 0, 'ingen knap hedder bare Gem paa profilen uden formular')
      await page.screenshot({ path: join(OUT_DIR, `2487-${w}.png`), fullPage: false })
      await ctx.close()
    }
    assert.deepEqual(fejl, [])
    console.log('2487 e2e PASS')
  } finally { await browser.close(); await mock.close?.(); await vite.stop?.() }
}
main().catch(e => { console.error(e); process.exit(1) })
