// Atletens opvarmningsflueben overlever genindlaesning samme dag (ordre 1920).
// Ægte app mod lokal mock, 390 px, kun localStorage (ingen nye serverkald).
// Egen kørsel: `node e2e/opvarm-flueben.spec.mjs`.
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { ATHLETE_USER } from './fixtures.mjs'

export async function runOpvarmFlueben(page, { appUrl, outDir }) {
  const shot = name => page.screenshot({ path: join(outDir, `opvarm-flueben-${name}.png`), fullPage: true })
  const aabn = async () => {
    await page.getByRole('button', { name: /^Program$/ }).click({ timeout: 15000 })
    await page.locator('text=/Dag 1/').filter({ visible: true }).last().click({ timeout: 15000 })
    const hoved = page.getByText('Opvarmningssæt', { exact: true })
    await hoved.waitFor({ state: 'visible', timeout: 10000 })
    await hoved.click()
  }
  const raekke = () => page.locator('div[style*="cursor: pointer"]', { hasText: /^\s*Stang|%/ }).filter({ has: page.locator('span') }).first()
  await page.goto(appUrl)
  await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
  await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  await aabn()
  const foer = page.getByText('✓')
  const antalFoer = await foer.count()
  await raekke().click()
  assert.equal(await page.getByText('✓').count(), antalFoer + 1, 'fluebenet skal vises efter tryk')
  await shot('01-afkrydset')
  await page.reload()
  await aabn()
  assert.equal(await page.getByText('✓').count(), antalFoer + 1, 'fluebenet skal staa efter genindlaesning')
  await shot('02-efter-genindlaesning')
  const nøgle = await page.evaluate(() => Object.keys(localStorage).find(k => k.startsWith('entropi_warmup_checked:')))
  assert.ok(nøgle, 'fluebenene skal ligge i lokal lagring')
  await page.evaluate(k => { const v = JSON.parse(localStorage.getItem(k)); v.date = '2020-01-01'; localStorage.setItem(k, JSON.stringify(v)) }, nøgle)
  await page.reload()
  await aabn()
  assert.equal(await page.getByText('✓').count(), antalFoer, 'ny dato rydder fluebenene')
  console.log('GRØN: opvarmningsflueben overlevede genindlæsning ved 390 px og blev ryddet ved ny dato.')
}

async function main() {
  const { createMockSupabase } = await import('./mock-supabase.mjs')
  const { buildSeed } = await import('./fixtures.mjs')
  const { startVite, launchBrowser, APP_URL, MOCK_PORT, OUT_DIR } = await import('./harness.mjs')
  const mock = createMockSupabase(buildSeed())
  await mock.listen(MOCK_PORT)
  const vite = await startVite()
  const browser = await launchBrowser()
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const page = await context.newPage()
    page.on('pageerror', err => console.error('[browser pageerror]', err))
    await runOpvarmFlueben(page, { appUrl: APP_URL, outDir: OUT_DIR })
    process.exitCode = 0
  } catch (err) {
    console.error('\nFEJL:', err.message)
    process.exitCode = 1
  } finally {
    await browser.close()
    await vite.stop()
    await mock.close()
  }
}

if (process.argv[1] && process.argv[1].endsWith('opvarm-flueben.spec.mjs')) main()
