// ORDRE 2471: coachens "Tilføj og næste" i øvelsesformularen (mock, 390x844, lys og mørk).
// Måler tryk for tre øvelser med Tilføj og med Tilføj og næste, tjekker fokus, tom formular og at en fejlet gemning bevarer indtastningen.
// Egen kørsel: `node e2e/tilfoej-naeste-2471.spec.mjs` (E2E_VITE_PORT og E2E_MOCK_PORT kan sættes; E2E_OUT = mappe til billeder).
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
  const out = process.env.E2E_OUT
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light' })
    const page = await ctx.newPage()
    page.on('pageerror', err => console.error('[browser pageerror]', err))
    await page.goto(APP_URL)
    await page.locator('#athlete-auth-email').fill(COACH_USER.email)
    await page.locator('#athlete-auth-password').fill(COACH_USER.password)
    await page.getByRole('button', { name: 'Log ind' }).click()
    await page.getByRole('button', { name: /Ny atlet/i }).first().click()
    await page.getByPlaceholder('For- og efternavn').fill('Testklient')
    await page.getByPlaceholder('email@eksempel.dk').fill('klient@e2e.test')
    await page.getByRole('button', { name: 'Opret nu', exact: true }).click()
    await page.getByRole('button', { name: 'Kopiér invitation' }).waitFor({ state: 'visible', timeout: 10000 })
    await page.getByRole('button', { name: 'Tilføj uge' }).click()
    await page.getByRole('button', { name: /^UGE 1/i, expanded: false }).first().click()
    await page.getByRole('button', { name: '+ Tilføj træning' }).click()
    await page.getByLabel('Titel').fill('Dag 1 Squat')
    await page.getByRole('button', { name: 'MAN' }).click()
    await page.getByRole('button', { name: 'Tilføj', exact: true }).click()
    await page.getByRole('button', { name: /Dag 1 Squat/ }).first().click()

    let tryk = 0
    const klik = async loc => { tryk++; await loc.click() }
    const felt = (n, s, r) => async () => {
      await page.getByLabel('Navn', { exact: true }).fill(n)
      await page.getByLabel('Sæt', { exact: true }).fill(s)
      await page.getByLabel('Reps', { exact: true }).fill(r)
    }
    const antal = () => page.locator('[aria-label^="Rediger "]').count()

    // Før: Tilføj-vejen, tre øvelser (hver Tilføj øvelse + Tilføj).
    for (const [n, s, r] of [['Squat', '4', '5'], ['Pause squat', '3', '3'], ['Bænkpres', '3', '8']]) {
      await klik(page.getByRole('button', { name: /Tilføj øvelse/i }))
      await felt(n, s, r)()
      await klik(page.getByRole('button', { name: 'Tilføj', exact: true }))
      await page.getByRole('button', { name: `Rediger ${n}` }).waitFor({ state: 'visible', timeout: 10000 })
    }
    const foer = tryk
    assert.equal(await antal(), 3)

    // Efter: Tilføj og næste, tre øvelser (Tilføj øvelse én gang, så to gange Tilføj og næste og til sidst Tilføj).
    tryk = 0
    await klik(page.getByRole('button', { name: /Tilføj øvelse/i }))
    const navn = page.getByLabel('Navn', { exact: true })
    for (const [n, s, r] of [['Dødløft', '3', '5'], ['Stiv dødløft', '3', '8']]) {
      await felt(n, s, r)()
      await klik(page.getByRole('button', { name: 'Tilføj og næste', exact: true }))
      await page.getByRole('button', { name: `Rediger ${n}` }).waitFor({ state: 'visible', timeout: 10000 })
      await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Navn')
      assert.equal(await navn.inputValue(), '', 'formularen skal være tom')
      assert.equal(await page.getByLabel('Sæt', { exact: true }).inputValue(), '')
      assert.equal(await page.getByLabel('Reps', { exact: true }).inputValue(), '')
    }
    await felt('Rygbøjning', '3', '10')()
    await klik(page.getByRole('button', { name: 'Tilføj', exact: true }))
    await page.getByRole('button', { name: 'Rediger Rygbøjning' }).waitFor({ state: 'visible', timeout: 10000 })
    const efter = tryk
    assert.equal(await antal(), 6)
    assert.equal(await page.getByRole('button', { name: 'Tilføj og næste' }).count(), 0, 'Tilføj lukker formularen')

    // Fejlet gem: formularen bevarer det indtastede og viser fejlen.
    await page.route('**/rest/v1/exercises*', r => r.request().method() === 'POST' ? r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'skrivning afvist' }) }) : r.continue())
    await page.getByRole('button', { name: /Tilføj øvelse/i }).click()
    await felt('Mavebøjning', '2', '12')()
    await page.getByRole('button', { name: 'Tilføj og næste', exact: true }).click()
    await page.waitForTimeout(800)
    assert.equal(await navn.inputValue(), 'Mavebøjning')
    assert.equal(await page.getByLabel('Sæt', { exact: true }).inputValue(), '2')
    assert.equal(await page.getByLabel('Reps', { exact: true }).inputValue(), '12')
    assert.equal(await antal(), 6, 'fejlet gem må ikke give en øvelse')
    await page.unroute('**/rest/v1/exercises*')

    // Billeder: formularen med begge knapper, lys og mørk.
    await felt('Hip thrust', '3', '10')()
    if (out) {
      await page.getByText('Øvelsen blev ikke gemt').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {})
      await page.getByRole('button', { name: 'Tilføj og næste', exact: true }).scrollIntoViewIfNeeded()
      await page.screenshot({ path: `${out}/lys.png` })
      await page.emulateMedia({ colorScheme: 'dark' })
      await page.waitForTimeout(400)
      await page.screenshot({ path: `${out}/moerk.png` })
    }
    const bredde = await page.evaluate(() => document.documentElement.scrollWidth)
    assert.ok(bredde <= 390, `vandret overløb ${bredde}`)
    console.log(`tilfoej-naeste-2471: OK foer=${foer} tryk, efter=${efter} tryk (tre oevelser)`)
    await ctx.close()
  } finally {
    await mock.close().catch(() => {}); await browser.close().catch(() => {}); await vite.stop().catch(() => {})
  }
}
main().catch(err => { console.error(err); process.exit(1) })
