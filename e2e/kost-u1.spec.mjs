// U1 kost: headless gennemgang på 390 px mod den ægte app og mock-backenden.
// Kun syntetiske testkonti og data fra fixtures.mjs. Kør: node e2e/kost-u1.spec.mjs
import { join } from 'node:path'
import { createMockSupabase } from './mock-supabase.mjs'
import { buildSeed, ATHLETE_USER, COACH_USER } from './fixtures.mjs'
import { startVite, launchBrowser, chromium, APP_URL, MOCK_PORT, OUT_DIR } from './harness.mjs'

const MOBILE = { width: 390, height: 844 }

async function login(page, user) {
  await page.goto(APP_URL)
  await page.locator('#athlete-auth-email').fill(user.email)
  await page.locator('#athlete-auth-password').fill(user.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
}

export async function runKostU1(page, outDir = OUT_DIR) {
  const shot = name => page.screenshot({ path: join(outDir, `kost-u1-${name}.png`), fullPage: true })
  await login(page, ATHLETE_USER)
  await page.getByRole('button', { name: 'Kost', exact: true }).first().click({ timeout: 20000 })
  const card = page.getByRole('region', { name: 'Dagens kostvane' })
  await card.waitFor({ state: 'visible', timeout: 20000 })
  await card.getByText(/kostdage i denne uge|Ugens mål er nået/).waitFor({ timeout: 10000 })
  await shot('01-kostvane')
  // Kortet er det første på siden og passer i bredden.
  const box = await card.boundingBox()
  if (!box || box.width > MOBILE.width) throw new Error('Kostvanekortet er bredere end telefonen')
  const scroll = await page.evaluate(() => document.documentElement.scrollWidth)
  if (scroll > MOBILE.width + 1) throw new Error(`Vandret scroll på 390 px: ${scroll}px`)

  // Væskemål med figur.
  const goal = page.getByRole('region', { name: 'Væskemål' })
  await goal.scrollIntoViewIfNeeded()
  await goal.getByLabel('Dagens væskemål i milliliter').fill('2000')
  await goal.getByRole('button', { name: 'Gem mål' }).click()
  await goal.getByText('0 af 2.000 ml').waitFor({ timeout: 5000 })
  await goal.getByRole('button', { name: 'Drukket 500 ml vand' }).click()
  await goal.getByText('500 af 2.000 ml').waitFor({ timeout: 5000 })
  const fill = await goal.locator('svg').getAttribute('data-water-fill')
  if (fill !== '25') throw new Error(`Glasset viser ${fill} %, forventede 25 %`)
  await goal.screenshot({ path: join(outDir, 'kost-u1-02-vaeskemaal.png') })
  for (let i = 0; i < 3; i++) await goal.getByRole('button', { name: 'Drukket 500 ml vand' }).click()
  await goal.getByText('Mål nået (2.000 ml).').waitFor({ timeout: 5000 })
  await goal.screenshot({ path: join(outDir, 'kost-u1-03-maal-naaet.png') })

  // Log et måltid gennem den almindelige "Log mad", så dagen tæller.
  await page.getByRole('button', { name: 'Log mad', exact: true }).click()
  await page.waitForTimeout(300)
  await shot('04-log-mad-aaben')
  return { fill }
}

export async function runCoachKostTal(page, outDir = OUT_DIR) {
  await login(page, COACH_USER)
  const fold = page.locator('[data-coach-fold="kost"]')
  await fold.waitFor({ state: 'attached', timeout: 20000 })
  const heading = await fold.locator('summary').innerText()
  if (!/Kost · \d+ af \d+ logger 4\+ dage/.test(heading)) throw new Error('Coachens kostoverblik mangler tallet: ' + heading)
  await fold.locator('summary').click()
  await page.locator('[data-coach-kostvane]').waitFor({ state: 'visible', timeout: 5000 })
  await fold.screenshot({ path: join(outDir, 'kost-u1-05-coach-kostdage.png') })
  return { heading }
}

async function main() {
  const mock = createMockSupabase(buildSeed())
  await mock.listen(MOCK_PORT)
  const vite = await startVite()
  // Uden hentet Playwright-Chromium bruges den installerede Edge, stadig headless.
  const browser = await launchBrowser().catch(() => chromium.launch({ headless: true, channel: 'msedge' }))
  const step = async (name, fn) => {
    const page = await browser.newPage({ viewport: MOBILE })
    const errors = []
    page.on('pageerror', err => errors.push(err.message))
    try {
      const result = await fn(page)
      if (errors.length) throw new Error(`${name}: browserfejl: ${errors.join('; ')}`)
      console.log(`GRØN: ${name}`, JSON.stringify(result))
    } finally { await page.close() }
  }
  try {
    await step('atlet, kost U1 på 390 px', page => runKostU1(page))
    await step('coach, kostdage på 390 px', page => runCoachKostTal(page))
  } finally {
    await browser.close(); await vite.stop(); await mock.close?.()
  }
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) main().catch(err => { console.error(err); process.exitCode = 1 })
