// ORDRE 2417 · coachens forside har én liste "Kræver dig i dag": smerte først, så ingen log i 3 dage; tom liste siger én rolig linje.
// Kun syntetiske data (Testatlet), Chromium, 390x844. Kun fast tekst står i DOM, aldrig notens tekst.
// Koersel: E2E_VITE_PORT=5417 E2E_MOCK_PORT=8917 VITE_SUPABASE_URL=http://127.0.0.1:8917 node e2e/coach-i-dag-2417.spec.mjs
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { COACH_USER, ATHLETE_ID, EXERCISE_ID, buildSeed } from './fixtures.mjs'

const NOTE = 'Syntetisk note: knæet gør ondt helt nede i bunden af sidste sæt'
const dagsiden = n => new Date(Date.now() - n * 864e5).toISOString()

function seedMed(scenarie) {
  const data = buildSeed(), t = data.tables
  t.exercise_logs = t.exercise_logs ?? []
  const log = (ago, note) => t.exercise_logs.push({ id: 'cc000000-0000-4000-8000-000000000017', exercise_id: EXERCISE_ID, athlete_id: ATHLETE_ID,
    set_number: 1, weight: 100, reps_completed: 5, note, rpe_actual: 7, rpe_planned: null, skipped: false, logged_at: dagsiden(ago) })
  if (scenarie === 'smerte') log(1, NOTE)
  if (scenarie === 'ingen-log') log(5, null)
  if (scenarie === 'rolig') {
    log(0, null)
    // Fixturens uge starter mandag og ville faa programmet til at slutte inden for 2 dage fra fredag; en uge mere holder listen tom alle ugedage.
    const w1 = t.weeks[0], start = new Date(w1.start_date + 'T00:00:00Z'); start.setUTCDate(start.getUTCDate() + 14)
    t.weeks.push({ ...w1, id: 'dd000000-0000-4000-8000-000000000017', week_number: 3, start_date: start.toISOString().slice(0, 10) })
    t.sessions.push({ ...t.sessions[0], id: 'dd000000-0000-4000-8000-000000000018', week_id: 'dd000000-0000-4000-8000-000000000017' })
    t.exercises.push({ ...t.exercises[0], id: 'dd000000-0000-4000-8000-000000000019', session_id: 'dd000000-0000-4000-8000-000000000018' })
  }
  return data
}

async function loeb(browser, { createMockSupabase, MOCK_PORT, APP_URL, OUT_DIR }, scenarie) {
  const mock = createMockSupabase(seedMed(scenarie))
  await mock.listen(MOCK_PORT)
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const fejl = []
  try {
    const page = await ctx.newPage()
    page.on('pageerror', err => fejl.push(err.message))
    await page.addInitScript(() => { try { Object.defineProperty(Notification, 'permission', { get: () => 'default' }) } catch {} })
    await page.goto(APP_URL)
    await page.locator('#athlete-auth-email').fill(COACH_USER.email)
    await page.locator('#athlete-auth-password').fill(COACH_USER.password)
    await page.getByRole('button', { name: 'Log ind' }).click()
    const liste = page.locator('[data-coach-idag]')
    await liste.waitFor({ state: 'visible', timeout: 15000 })
    await page.getByRole('heading', { name: 'Kræver dig i dag' }).waitFor({ state: 'visible' })
    const raekker = liste.locator('[data-coach-action]')
    if (scenarie === 'rolig') {
      await page.getByText('Ingen kræver dig i dag.').waitFor({ state: 'visible', timeout: 15000 })
      assert.equal(await raekker.count(), 0)
    } else {
      const forventet = scenarie === 'smerte' ? /Smerte nævnt/ : /Ingen log i 5 dage/
      await raekker.first().waitFor({ state: 'visible', timeout: 15000 })
      await page.waitForFunction(re => document.querySelector('[data-coach-idag]')?.innerText.match(new RegExp(re)), forventet.source, { timeout: 15000 })
      assert.ok(await raekker.count() <= 5)
      assert.match((await raekker.first().innerText()).replace(/\s+/g, ' '), forventet)
      await page.screenshot({ path: join(OUT_DIR, `coach-i-dag-2417-${scenarie}-390.png`), fullPage: false })
      await raekker.first().click()
      await page.waitForFunction(() => !document.querySelector('[data-coach-idag]'), null, { timeout: 15000 })
    }
    const krop = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    assert.ok(!krop.includes(NOTE), 'notens tekst maa ikke staa i DOM')
    const bredde = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    assert.ok(bredde, 'ingen vandret scroll ved 390 px')
    assert.deepEqual(fejl, [], `browser-fejl: ${fejl.join(' | ')}`)
  } finally { await ctx.close().catch(() => {}); await mock.close().catch(() => {}) }
}

async function main() {
  const { createMockSupabase } = await import('./mock-supabase.mjs')
  const { startVite, launchBrowser, APP_URL, MOCK_PORT, OUT_DIR } = await import('./harness.mjs')
  const vite = await startVite(); const browser = await launchBrowser()
  try {
    for (const s of ['smerte', 'ingen-log', 'rolig']) {
      await loeb(browser, { createMockSupabase, MOCK_PORT, APP_URL, OUT_DIR }, s)
      console.log(`GRØN: ${s} ved 390 px`)
    }
  } catch (err) { console.error('\nFEJL:', err.message); process.exitCode = 1 }
  finally { await browser.close().catch(() => {}); await vite.stop().catch(() => {}) }
}
if (process.argv[1] && process.argv[1].endsWith('coach-i-dag-2417.spec.mjs')) main()
