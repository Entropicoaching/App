// U2 beskeder og video: headless gennemgang på 390 px mod den ægte app og mock-backenden.
// Kun syntetiske testkonti og data fra fixtures.mjs. Kør: node e2e/beskeder-video-u2.spec.mjs
import { join } from 'node:path'
import { createMockSupabase } from './mock-supabase.mjs'
import { buildSeed, ATHLETE_USER, COACH_USER, ATHLETE_ID } from './fixtures.mjs'
import { startVite, launchBrowser, chromium, APP_URL, MOCK_PORT, OUT_DIR } from './harness.mjs'

const MOBILE = { width: 390, height: 844 }
const ago = minutes => new Date(Date.now() - minutes * 60000).toISOString()
const SPOERGSMAAL = 'U2 syntetisk: Skal jeg tage samme vægt på torsdag?'
const SVAR = 'U2 syntetisk: Ja, hold vægten og fokusér på dybden.'
const ATLET_VENTER = 'U2 syntetisk: Min ryg var lidt øm efter dødløft.'

function seed() {
  const data = buildSeed()
  data.tables.messages.push(
    { id: 'b0000000-0000-4000-8000-000000000001', athlete_id: ATHLETE_ID, sender_role: 'athlete', content: SPOERGSMAAL,
      category: 'besked', created_at: ago(120), read_at: null, read_by_coach: true },
    { id: 'b0000000-0000-4000-8000-000000000002', athlete_id: ATHLETE_ID, sender_role: 'coach', content: SVAR,
      category: 'besked', created_at: ago(90), read_at: null, read_by_coach: true },
    { id: 'b0000000-0000-4000-8000-000000000003', athlete_id: ATHLETE_ID, sender_role: 'athlete', content: ATLET_VENTER,
      category: 'besked', created_at: ago(30), read_at: null, read_by_coach: false },
  )
  return data
}

async function login(page, user) {
  await page.goto(APP_URL)
  await page.locator('#athlete-auth-email').fill(user.email)
  await page.locator('#athlete-auth-password').fill(user.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
}

async function noSideScroll(page) {
  const width = await page.evaluate(() => document.documentElement.scrollWidth)
  if (width > MOBILE.width + 1) throw new Error(`Vandret scroll på 390 px: ${width}px`)
}

const keys = page => page.locator('ol > li[data-key]').evaluateAll(rows => rows.map(li => li.dataset.key))

export async function runAtletU2(page, mock, outDir = OUT_DIR) {
  const shot = name => page.screenshot({ path: join(outDir, `u2-atlet-${name}.png`), fullPage: true })
  await login(page, ATHLETE_USER)
  const dot = page.locator('[data-entropi2-unread]')
  await dot.first().waitFor({ state: 'attached', timeout: 20000 })
  await shot('01-prik-paa-beskeder')

  await page.getByRole('button', { name: /^Beskeder/ }).first().click()
  const svar = page.locator('ol > li', { hasText: SVAR.slice(0, 40) })
  await svar.waitFor({ state: 'visible', timeout: 20000 })
  // Rækkefølgen: spørgsmålet står over svaret, også når svaret er ulæst.
  const order = await keys(page)
  const q = order.indexOf('message:b0000000-0000-4000-8000-000000000001')
  const a = order.indexOf('message:b0000000-0000-4000-8000-000000000002')
  if (q < 0 || a < 0 || q > a) throw new Error('Tråden står ikke efter tidspunkt: ' + order.join(', '))
  await noSideScroll(page)
  await shot('02-traad-efter-tid')

  // Læs alt ulæst; prikken på fanen slukker uden at forlade samtalen.
  for (let i = 0; i < 10; i++) {
    const unread = page.locator('ol > li > button', { hasText: 'Ulæst' })
    if (await unread.count() === 0) break
    await unread.first().click()
    await page.waitForTimeout(400)
  }
  await dot.first().waitFor({ state: 'detached', timeout: 10000 })
  if (JSON.stringify(await keys(page)) !== JSON.stringify(order)) throw new Error('En læsning flyttede beskeder')
  await shot('03-laest-prik-slukket')

  // Liveopdatering: et nyt svar fra coachen dukker op uden genåbning.
  const nyt = 'U2 syntetisk: Nyt svar mens samtalen er åben.'
  const started = Date.now()
  mock.table('messages').push({ id: 'b0000000-0000-4000-8000-000000000009', athlete_id: ATHLETE_ID, sender_role: 'coach',
    content: nyt, category: 'besked', created_at: new Date().toISOString(), read_at: null, read_by_coach: true })
  await page.locator('ol > li', { hasText: nyt.slice(0, 30) }).waitFor({ state: 'visible', timeout: 45000 })
  const liveSeconds = Math.round((Date.now() - started) / 1000)
  await shot('04-nyt-svar-uden-genaabning')

  // Dobbelttryk på Send giver én besked.
  const tekst = 'U2 syntetisk: dobbelttryk prøve'
  const composer = page.locator('section[aria-label="Beskeder og video"] textarea').first()
  await composer.click()
  await composer.pressSequentially(tekst)
  const send = page.getByRole('button', { name: 'Send', exact: true })
  // To klik lige efter hinanden i browseren, som et hurtigt dobbelttryk på telefonen.
  await send.dblclick()
  await page.locator('ol > li', { hasText: tekst }).first().waitFor({ state: 'visible', timeout: 15000 })
  await page.waitForTimeout(1500)
  const rows = mock.table('messages').filter(row => row.content === tekst).length
  if (rows !== 1) throw new Error(`Dobbelttryk gav ${rows} rækker`)
  const shown = await page.locator('ol > li', { hasText: tekst }).count()
  if (shown !== 1) throw new Error(`Beskeden vises ${shown} gange`)
  await noSideScroll(page)
  await shot('05-dobbelttryk-en-besked')
  return { order: order.length, liveSeconds, rows, shown }
}

export async function runCoachU2(page, mock, outDir = OUT_DIR) {
  const shot = name => page.screenshot({ path: join(outDir, `u2-coach-${name}.png`), fullPage: true })
  await login(page, COACH_USER)
  await page.waitForTimeout(2500)
  await noSideScroll(page)
  await shot('01-forside-venter-paa-svar')
  await page.getByRole('button', { name: /Testatlet/ }).first().click({ timeout: 20000 })
  await page.getByRole('button', { name: /Beskeder/ }).first().click({ timeout: 20000 })
  const venter = page.locator('ol > li', { hasText: ATLET_VENTER.slice(0, 30) })
  await venter.waitFor({ state: 'visible', timeout: 20000 })
  const before = await page.locator('ol > li > button', { hasText: 'Ulæst' }).count()
  await shot('02-samtale-ulaest')
  await venter.locator('button').first().click()
  await page.waitForTimeout(800)
  const row = mock.table('messages').find(r => r.content === ATLET_VENTER)
  if (row?.read_by_coach !== true) throw new Error('Coachens læsning blev ikke gemt')
  const after = await page.locator('ol > li > button', { hasText: 'Ulæst' }).count()
  await shot('03-laest')
  const nyt = 'U2 syntetisk: Ny besked fra atleten mens coachen kigger.'
  const started = Date.now()
  mock.table('messages').push({ id: 'b0000000-0000-4000-8000-000000000010', athlete_id: ATHLETE_ID, sender_role: 'athlete',
    content: nyt, category: 'besked', created_at: new Date().toISOString(), read_at: null, read_by_coach: false })
  await page.locator('ol > li', { hasText: nyt.slice(0, 30) }).waitFor({ state: 'visible', timeout: 45000 })
  await noSideScroll(page)
  await shot('04-ny-besked-uden-genaabning')
  return { before, after, liveSeconds: Math.round((Date.now() - started) / 1000) }
}

async function main() {
  const mock = createMockSupabase(seed())
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
    await step('atlet, beskeder U2 på 390 px', page => runAtletU2(page, mock))
    await step('coach, beskeder U2 på 390 px', page => runCoachU2(page, mock))
  } finally {
    await browser.close(); await vite.stop(); await mock.close?.()
  }
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) main().catch(err => { console.error(err); process.exitCode = 1 })
