// ORDRE 2370: før/efter-billeder af Hjem, Program, Kost og Beskeder ved 390x844, lys og mørk, træningsatlet med kostpakke og kostklient.
// Kør: E2E_VITE_PORT=5370 E2E_MOCK_PORT=8970 VITE_SUPABASE_URL=http://127.0.0.1:8970 node e2e/atlet-ui-2370.skaerm.mjs <mappe> <foer|efter>
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { ATHLETE_USER, buildSeed, kostPakkeTilAtlet } from './fixtures.mjs'
import { seed as ugeSeed } from './kost-set-paa-main.spec.mjs'

const OUT = process.argv[2] || 'outputs/_seneste/2370'
const PREFIX = process.argv[3] || 'foer'
mkdirSync(OUT, { recursive: true })

function seedFor(persona) {
  if (persona === 'tr') { const s = buildSeed({ withLogs: true }); kostPakkeTilAtlet(s.tables); return s }
  const s = ugeSeed()
  s.tables.weeks = []; s.tables.sessions = []; s.tables.exercises = []; s.tables.exercise_logs = []
  return { users: s.users, tables: structuredClone(s.tables) }
}
const faner = { tr: ['Hjem', 'Program', 'Kost', 'Beskeder'], kk: ['Hjem', 'Kost', 'Beskeder'] }
async function tab(page, name) {
  await page.getByRole('button', { name, exact: true }).first().evaluate(el => el.click())
  await page.waitForTimeout(1000)
}
async function kor(browser, createMockSupabase, MOCK_PORT, APP_URL, persona, tema) {
  const mock = createMockSupabase(seedFor(persona)); await mock.listen(MOCK_PORT)
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
  try {
    const page = await ctx.newPage()
    page.on('pageerror', err => console.error('[pageerror]', persona, tema, err.message))
    await page.addInitScript(([t]) => {
      try { localStorage.setItem('entropi:tema', t) } catch {}
      try { Object.defineProperty(Notification, 'permission', { get: () => 'default' }) } catch {}
    }, [tema])
    await page.goto(APP_URL)
    await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
    await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
    await page.getByRole('button', { name: 'Log ind' }).click()
    await page.getByRole('button', { name: 'Hjem', exact: true }).first().waitFor({ state: 'attached', timeout: 25000 })
    await page.waitForTimeout(1500)
    const skip = page.getByRole('button', { name: /Spring over/ })
    if (await skip.count()) { await skip.first().evaluate(el => el.click()); await page.waitForTimeout(400) }
    for (const f of faner[persona]) {
      await tab(page, f)
      await page.screenshot({ path: join(OUT, `${PREFIX}-${persona}-${tema}-${f.toLowerCase()}.png`), fullPage: true })
      console.log('billede', persona, tema, f)
    }
  } finally { await ctx.close(); await mock.close().catch(() => {}) }
}
const { createMockSupabase } = await import('./mock-supabase.mjs')
const { startVite, launchBrowser, APP_URL, MOCK_PORT } = await import('./harness.mjs')
const vite = await startVite(); const browser = await launchBrowser()
try { for (const p of ['tr', 'kk']) for (const t of ['lys', 'moerk']) await kor(browser, createMockSupabase, MOCK_PORT, APP_URL, p, t) }
catch (e) { console.error(e); process.exitCode = 1 }
finally { await browser.close().catch(() => {}); await vite.stop().catch(() => {}) }
