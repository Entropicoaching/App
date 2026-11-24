// ORDRE 2059: ny klient fra invitation til foerste logget saet (mock, 390x844).
// Coach: Ny atlet, Opret nu (2 tryk), Kopier invitation. Atlet: opretter sig med invitationens mail og logger foerste saet.
// Egen koersel: `npm run e2e:ny-klient-2059`.
import assert from 'node:assert/strict'
import { COACH_USER, buildSeed } from './fixtures.mjs'

async function main() {
  const { createMockSupabase } = await import('./mock-supabase.mjs')
  const { startVite, launchBrowser, APP_URL, MOCK_PORT } = await import('./harness.mjs')
  const seed = buildSeed(); const t = seed.tables
  t.athletes = []; t.weeks = []; t.sessions = []; t.exercises = []
  const vite = await startVite()
  const browser = await launchBrowser()
  const mock = createMockSupabase(seed)
  await mock.listen(MOCK_PORT)
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['clipboard-read', 'clipboard-write'] })
    const page = await ctx.newPage()
    page.on('pageerror', err => console.error('[browser pageerror]', err))
    await page.goto(APP_URL)
    await page.locator('#athlete-auth-email').fill(COACH_USER.email)
    await page.locator('#athlete-auth-password').fill(COACH_USER.password)
    await page.getByRole('button', { name: 'Log ind' }).click()
    await page.getByRole('button', { name: /Ny atlet/i }).first().waitFor({ state: 'visible', timeout: 15000 })

    // 1) Navn og mail, saa Opret nu: 2 tryk (Ny atlet, Opret nu), ingen Naeste.
    await page.getByRole('button', { name: /Ny atlet/i }).first().click()
    await page.getByPlaceholder('For- og efternavn').fill('Testklient')
    await page.getByPlaceholder('email@eksempel.dk').fill('klient@e2e.test')
    await page.getByRole('button', { name: 'Opret nu', exact: true }).click()

    // 2) Mockens nye raekke har user_id null som i Postgres, saa invitationen vises.
    const inv = page.getByRole('button', { name: 'Kopiér invitation' })
    await inv.waitFor({ state: 'visible', timeout: 10000 })
    await inv.click()
    await page.getByText('Invitation kopieret').waitFor({ state: 'visible', timeout: 10000 })
    const tekst = await page.evaluate(() => navigator.clipboard.readText())
    assert.match(tekst, /klient@e2e\.test/)

    // 3) Coachen bygger uge, pas og oevelse (som 2042).
    await page.getByRole('button', { name: 'Tilføj uge' }).click()
    await page.getByRole('button', { name: /^UGE 1/i, expanded: false }).first().click()
    await page.getByRole('button', { name: '+ Tilføj træning' }).click()
    await page.getByLabel('Titel').fill('Dag 1 Squat')
    await page.getByRole('button', { name: 'MAN' }).click()
    await page.getByRole('button', { name: 'Tilføj', exact: true }).click()
    await page.getByRole('button', { name: /Dag 1 Squat/ }).first().click()
    await page.getByRole('button', { name: /Tilføj øvelse/i }).click()
    await page.getByLabel('Navn', { exact: true }).fill('Squat')
    await page.getByLabel('Sæt', { exact: true }).fill('4')
    await page.getByLabel('Reps', { exact: true }).fill('5')
    await page.getByRole('button', { name: 'Tilføj', exact: true }).click()
    await page.getByText('Squat').first().waitFor({ state: 'visible', timeout: 10000 })

    // 4) Atleten opretter sig med mailen fra invitationen og faar sin foerste uge.
    const actx = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const ap = await actx.newPage()
    ap.on('pageerror', err => console.error('[browser pageerror]', err))
    await ap.goto(APP_URL)
    await ap.getByText('Opret her').click()
    await ap.locator('#athlete-auth-email').fill('klient@e2e.test')
    await ap.locator('#athlete-auth-password').fill('e2e-pass-klient-1')
    await ap.getByRole('button', { name: /Opret konto/ }).click()
    await ap.getByRole('button', { name: /Videre/i }).first().waitFor({ state: 'visible', timeout: 15000 })
    for (let i = 0; i < 6; i++) {
      const v = ap.getByRole('button', { name: /Videre|Se dit program/i })
      if (!(await v.count())) break
      await v.first().click(); await ap.waitForTimeout(600)
    }
    await ap.getByRole('button', { name: /^Dag 1 Squat/ }).first().click()
    await ap.getByLabel(/^Vægt · .*sæt 1$/).fill('100')
    await ap.getByRole('button', { name: /^log/i }).first().click()
    await ap.getByText('GEMT', { exact: false }).first().waitFor({ state: 'visible', timeout: 10000 })
    console.log('ny-klient-2059: OK (Opret nu 2 tryk, invitation, atlet logger foerste saet)')
    await ctx.close(); await actx.close()
  } finally {
    await mock.close().catch(() => {}); await browser.close().catch(() => {}); await vite.stop().catch(() => {})
  }
}
main().catch(err => { console.error(err); process.exit(1) })
