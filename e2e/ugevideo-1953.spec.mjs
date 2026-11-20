// 1953: coachen lægger en ugevideo til én atlet for næste uge, atleten ser den øverst på Hjem med ét tryk,
// og coachen ser, at den er set. 390 px mod mocken; kun den syntetiske "Testatlet", ingen rigtig video.
// Kør: node e2e/ugevideo-1953.spec.mjs (egne porte: E2E_VITE_PORT, E2E_MOCK_PORT og VITE_SUPABASE_URL).
import { join } from 'node:path'
import { createMockSupabase } from './mock-supabase.mjs'
import { buildSeed, ATHLETE_USER, COACH_USER, ATHLETE_ID } from './fixtures.mjs'
import { startVite, launchBrowser, chromium, APP_URL, MOCK_PORT, OUT_DIR } from './harness.mjs'

const MOBILE = { width: 390, height: 844 }
// Et par syntetiske bytes som "video"; afspilning prøves ikke, kun adressen og "set".
const KLIP = { name: 'uge.mp4', mimeType: 'video/mp4', buffer: Buffer.from('000000186674797069736f6d0000020069736f6d69736f32', 'hex') }

async function login(page, user) {
  await page.goto(APP_URL)
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear() } catch { /* ignoreret */ } })
  await page.reload()
  await page.locator('#athlete-auth-email').fill(user.email)
  await page.locator('#athlete-auth-password').fill(user.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
}

async function ingenVandretScroll(page, hvor) {
  const bredde = await page.evaluate(() => document.documentElement.scrollWidth)
  if (bredde > MOBILE.width + 1) throw new Error(`Vandret scroll på 390 px (${hvor}): ${bredde}px`)
}

async function coachAabnerSamtale(page) {
  await login(page, COACH_USER)
  await page.getByRole('button', { name: /Åbn programmet for (Testatlet|Atlet W)/ }).first().click({ timeout: 20000 })
  const beskeder = page.getByRole('button', { name: /Beskeder/ }).first()
  if (!(await beskeder.isVisible().catch(() => false))) await page.getByRole('button', { name: /Mere/ }).first().click().catch(() => {})
  await beskeder.click({ timeout: 20000 })
  const kort = page.getByRole('region', { name: 'Ugevideo' })
  await kort.waitFor({ state: 'visible', timeout: 20000 })
  return kort
}

export async function runUgevideo(page, mock, outDir = OUT_DIR) {
  const raekker = () => mock.table('coach_week_videos')
  // Coachen: vælg video, læg den (ugen er forvalgt).
  let kort = await coachAabnerSamtale(page)
  await kort.locator('input[type=file]').setInputFiles(KLIP) // tryk 1 og 2: Vælg video, vælg klippet
  await kort.getByRole('button', { name: 'Læg ugevideo' }).click() // tryk 3
  await kort.getByText('Ugevideoen er lagt. Atleten ser den øverst på Hjem.').waitFor({ timeout: 20000 })
  if (raekker().length !== 1) throw new Error(`Skulle have 1 ugevideo, fik ${raekker().length}`)
  const r = raekker()[0]
  if (r.athlete_id !== ATHLETE_ID || !r.video_path.startsWith(`${ATHLETE_ID}/`)) throw new Error('Rækken skal ligge på den valgte atlet og i hendes mappe')
  if (r.athlete_seen_at) throw new Error('Ny video må ikke være set')
  await kort.getByText(/Ikke set endnu/).waitFor({ timeout: 10000 })
  await ingenVandretScroll(page, 'coach')
  await page.screenshot({ path: join(outDir, '1953-1-coach-lagt.png'), fullPage: false })

  // Atleten: kortet øverst på Hjem, ét tryk.
  await login(page, ATHLETE_USER)
  const atlet = page.getByRole('region', { name: 'Ugevideo fra din coach' })
  await atlet.waitFor({ state: 'visible', timeout: 20000 })
  const top = await atlet.boundingBox()
  if (!top || top.y > 400) throw new Error(`Kortet skal stå øverst på Hjem, står ved y=${top?.y}`)
  await ingenVandretScroll(page, 'atlet')
  await atlet.getByRole('button', { name: 'Se ugevideo' }).click() // ét tryk
  const video = atlet.locator('video')
  await video.waitFor({ state: 'attached', timeout: 20000 }).catch(async () => { throw new Error(`Ingen video efter tryk: ${await atlet.innerText()}`) })
  const src = await video.getAttribute('src')
  if (!src || !src.includes(r.video_path)) throw new Error(`Videoen skal pege på klippet, fik ${src}`)
  for (let i = 0; i < 50 && !raekker()[0].athlete_seen_at; i++) await page.waitForTimeout(100)
  if (!raekker()[0].athlete_seen_at) throw new Error('Rækken skulle være markeret set')
  await page.screenshot({ path: join(outDir, '1953-2-atlet-hjem.png'), fullPage: false })

  // Coachen ser "Set".
  kort = await coachAabnerSamtale(page)
  await kort.getByText(/: Set \d/).waitFor({ timeout: 20000 })
  await page.screenshot({ path: join(outDir, '1953-3-coach-set.png'), fullPage: false })
  return { raekker: raekker().length, sti: r.video_path.replace(ATHLETE_ID, '<atlet>'), uge: r.week_start, set: true, trykCoach: 3, trykAtlet: 1 }
}

async function main() {
  const s = buildSeed({ now: new Date() })
  const vite = await startVite()
  const browser = await launchBrowser().catch(() => chromium.launch({ headless: true, channel: 'msedge' }))
  const mock = createMockSupabase({ users: s.users, tables: structuredClone(s.tables) })
  await mock.listen(MOCK_PORT)
  let fejl = null
  try {
    const page = await browser.newPage({ viewport: MOBILE })
    const errors = []
    page.on('pageerror', err => errors.push(err.message))
    const r = await runUgevideo(page, mock)
    if (errors.length) throw new Error('browserfejl: ' + errors.join('; '))
    console.log(JSON.stringify(r))
  } catch (e) { fejl = e } finally { await browser.close(); await mock.close?.(); await vite.stop() }
  if (fejl) throw fejl
}

if (import.meta.url === `file:///${process.argv[1].split(String.fromCharCode(92)).join("/")}`) main().catch(err => { console.error(err); process.exitCode = 1 })
