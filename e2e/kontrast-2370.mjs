// ORDRE 2370 fund 11: måler placeholder-kontrast i lys tema (Kost og Beskeder). Kør som atlet-ui-2370.skaerm.mjs.
import { ATHLETE_USER, buildSeed, kostPakkeTilAtlet } from './fixtures.mjs'
const lum = c => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return ((x + 0.05) / (y + 0.05)).toFixed(2) }
const { createMockSupabase } = await import('./mock-supabase.mjs')
const { startVite, launchBrowser, APP_URL, MOCK_PORT } = await import('./harness.mjs')
const s = buildSeed({ withLogs: true }); kostPakkeTilAtlet(s.tables)
const mock = createMockSupabase(s); await mock.listen(MOCK_PORT)
const vite = await startVite(); const browser = await launchBrowser()
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); const page = await ctx.newPage()
  await page.addInitScript(() => { try { localStorage.setItem('entropi:tema', 'lys') } catch {} ; try { Object.defineProperty(Notification, 'permission', { get: () => 'default' }) } catch {} })
  await page.goto(APP_URL)
  await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email); await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click(); await page.waitForTimeout(3000)
  const maal = async navn => {
    await page.getByRole('button', { name: navn, exact: true }).first().evaluate(el => el.click()); await page.waitForTimeout(1200)
    const r = await page.evaluate(() => [...document.querySelectorAll('input[placeholder],textarea[placeholder]')].map(el => {
      const ph = getComputedStyle(el, '::placeholder'); let bg = el, b = 'rgba(0, 0, 0, 0)'
      while (bg && /rgba\(.*, 0\)|transparent/.test(b)) { b = getComputedStyle(bg).backgroundColor; bg = bg.parentElement }
      return { ph: el.placeholder, farve: ph.color, bg: b, opacity: ph.opacity } }))
    for (const x of r) console.log(navn, JSON.stringify(x.ph), x.farve, 'på', x.bg, 'kontrast', ratio(x.farve, x.bg))
  }
  await maal('Kost'); await maal('Beskeder'); await maal('Hjem')
} finally { await browser.close(); await vite.stop(); await mock.close().catch(() => {}) }
