// U4 upload med "Prøv igen": headless gennemgang mod den ægte app, den ægte videoside og mock-backenden.
// Kun syntetiske testkonti, fixtures og en syntetisk video. Kør: node e2e/upload-u4.spec.mjs
import { join } from 'node:path'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createMockSupabase } from './mock-supabase.mjs'
import { buildSeed, ATHLETE_USER, COACH_USER, ATHLETE_ID } from './fixtures.mjs'
import { startVite, launchBrowser, chromium, APP_URL, MOCK_PORT, OUT_DIR, ensureCoachSporingClip } from './harness.mjs'
import { filmSaetUpTilDone } from './athlete-film-et-saet.mjs'

const SIZES = { 390: { width: 390, height: 844 }, 1280: { width: 1280, height: 800 } }
const STORAGE_PREFIX = '/storage/v1/object/videocoach-uploads/'
const MOCK_URL = `http://127.0.0.1:${MOCK_PORT}`

async function login(page, user) {
  await page.goto(APP_URL)
  await page.locator('#athlete-auth-email').fill(user.email)
  await page.locator('#athlete-auth-password').fill(user.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
}

async function noSideScroll(page, width) {
  const scroll = await page.evaluate(() => document.documentElement.scrollWidth)
  if (scroll > width + 1) throw new Error(`Vandret scroll på ${width} px: ${scroll}px`)
}

// Det syntetiske, sporbare klip (tegnet skive, ingen krop) og samme klip med fyld bagefter, så det er over 50 MB.
const clip = () => ensureCoachSporingClip('glat').path
function oversizeClip() {
  const path = clip().replace(/\.mp4$/, '-over-50mb.mp4')
  if (!existsSync(path)) writeFileSync(path, Buffer.concat([readFileSync(clip()), Buffer.alloc(50 * 1024 * 1024 + 1024)]))
  return path
}

const ownRows = mock => mock.table('video_analyses').filter(r => r.athlete_id === ATHLETE_ID && r.analysis_state === 'awaiting_analysis')
const ownKeys = async () => (await (await fetch(`${MOCK_URL}/__e2e/storage-keys`)).json())
  .filter(key => key.startsWith(`videocoach-uploads/${ATHLETE_ID}/`))

// Atletens klikvej i Entropi 2: Film et sæt, vælg video, find skiven, analysér, Send video til coach.
async function filmAndSend(page, path, shot, beforeSend = async () => {}) {
  await login(page, ATHLETE_USER)
  const film = page.getByRole('button', { name: /Film et sæt/ }).first()
  await film.waitFor({ state: 'visible', timeout: 20000 })
  await film.click()
  const iframe = page.locator('iframe[title="VideoCoach"]')
  await iframe.waitFor({ state: 'visible', timeout: 15000 })
  const src = await iframe.getAttribute('src')
  if (!/[?&]uploadRetry=1(&|$)/.test(src)) throw new Error('Videosidens adresse mangler uploadRetry=1: ' + src)
  const frame = page.frameLocator('iframe[title="VideoCoach"]')
  const state = await filmSaetUpTilDone(frame, page, path, shot)
  if (state !== 'done') throw new Error('Analysen blev ikke færdig: ' + state)
  await beforeSend()
  await frame.locator('#athleteInstantSaveBtn').click()
  return frame
}

export async function runAtletForStor(page, mock, width, outDir = OUT_DIR) {
  const shot = name => page.screenshot({ path: join(outDir, `u4-atlet-${width}-a-${name}.png`), fullPage: true })
  const storageCalls = []
  page.on('request', req => { if (req.url().includes(STORAGE_PREFIX) && req.method() === 'POST') storageCalls.push(req.url()) })
  const rowsBefore = ownRows(mock).length
  const frame = await filmAndSend(page, oversizeClip(), shot)
  const panel = frame.locator('#vcUploadRetryStatus')
  await panel.getByText(/større end 50 MB/).waitFor({ state: 'visible', timeout: 15000 })
  if (await panel.getByRole('button', { name: 'Prøv igen' }).isVisible()) throw new Error('Prøv igen vist ved for stor fil')
  if (storageCalls.length) throw new Error('For stor fil blev sendt til lageret')
  if (ownRows(mock).length !== rowsBefore) throw new Error('Række gemt for for stor fil')
  await noSideScroll(page, width)
  await shot('04-for-stor-afvist')
  return { storageCalls: storageCalls.length }
}

export async function runAtletAfbrudt(page, mock, width, outDir = OUT_DIR) {
  const shot = name => page.screenshot({ path: join(outDir, `u4-atlet-${width}-b-${name}.png`), fullPage: true })
  const keysBefore = await ownKeys()
  const rowsBefore = ownRows(mock).length
  const storage = []
  page.on('request', req => { if (req.url().includes('/storage/v1/')) storage.push(`${req.method()} ${new URL(req.url()).pathname}`) })
  page.on('requestfailed', req => { if (req.url().includes('/storage/v1/')) storage.push(`FEJLET ${req.method()} ${req.failure()?.errorText}`) })
  // Nettet falder ud under overførslen: lagerkald afbrydes på netværksniveau (afbrudt fetch), indtil
  // atleten ser "Ikke sendt"; derefter er nettet tilbage. Mockens egen fejlinjektion bruges ikke,
  // fordi Chromium selv genforsøger en POST, når en genbrugt forbindelse nulstilles.
  let offline = true, aborted = 0
  const frame = await filmAndSend(page, clip(), shot, async () => {
    await page.route(`**${STORAGE_PREFIX}**`, route => {
      if (offline && route.request().method() === 'POST') { aborted++; return route.abort('internetdisconnected') }
      return route.continue()
    })
  })
  page.__u4storage = storage
  const panel = frame.locator('#vcUploadRetryStatus')
  await panel.getByText(/^Ikke sendt/).waitFor({ state: 'visible', timeout: 30000 })
  offline = false
  const retry = panel.getByRole('button', { name: 'Prøv igen' })
  await retry.waitFor({ state: 'visible', timeout: 5000 })
  if (await frame.locator('#saveBtn').isVisible()) throw new Error('To knapper til nyt forsøg')
  if (ownRows(mock).length !== rowsBefore) throw new Error('Række gemt trods afbrudt overførsel')
  await noSideScroll(page, width)
  await shot('04-ikke-sendt-proev-igen')

  // Prøv igen: sendt én gang, én fil og én række.
  await retry.click()
  // Efter vellykket afsendelse lukker sendearket; kvitteringen står i panelet og i banneret.
  await panel.getByText(/Sendt til Marc ✓/).waitFor({ state: 'attached', timeout: 30000 })
  await frame.locator('#athleteSubmitSheet').waitFor({ state: 'hidden', timeout: 10000 })
  const rows = ownRows(mock).slice(rowsBefore), keys = (await ownKeys()).filter(key => !keysBefore.includes(key))
  if (rows.length !== 1) throw new Error(`Forventede 1 ny række, fandt ${rows.length}`)
  if (keys.length !== 1 || keys[0] !== `videocoach-uploads/${rows[0].video_path}`) throw new Error('Forventede én fil: ' + keys.join(', '))
  await shot('05-sendt-efter-proev-igen')
  if (aborted < 1) throw new Error('Overførslen blev ikke afbrudt')
  return { aborted, rows: rows.length, files: keys.length, storage }
}

export async function runCoachU4(page, mock, width, outDir = OUT_DIR) {
  const shot = name => page.screenshot({ path: join(outDir, `u4-coach-${width}-${name}.png`), fullPage: true })
  await login(page, COACH_USER)
  // Atletens video står i coachens "Kræver dit blik".
  await page.getByText('Video venter på feedback').first().waitFor({ state: 'visible', timeout: 20000 })
  await noSideScroll(page, width)
  await shot('01-forside')
  return { rows: ownRows(mock).length }
}

async function main() {
  const outDir = process.env.U4_OUT || OUT_DIR
  const mock = createMockSupabase(buildSeed())
  await mock.listen(MOCK_PORT)
  const vite = await startVite()
  const browser = await launchBrowser().catch(() => chromium.launch({ headless: true, channel: 'msedge' }))
  const step = async (name, viewport, fn) => {
    const page = await browser.newPage({ viewport })
    const errors = []
    page.on('pageerror', err => errors.push(err.message))
    try {
      const result = await fn(page)
      if (errors.length) throw new Error(`${name}: browserfejl: ${errors.join('; ')}`)
      console.log(`GRØN: ${name}`, JSON.stringify(result))
    } catch (err) {
      console.error(`FEJL: ${name}: ${err.message}`)
      await page.screenshot({ path: join(process.env.U4_OUT || OUT_DIR, `u4-fejl-${name.replace(/[^a-z0-9]+/gi, '-')}.png`), fullPage: true }).catch(() => {})
      const panelText = await page.frameLocator('iframe[title="VideoCoach"]').locator('#vcUploadRetryStatus').textContent({ timeout: 2000 }).catch(() => null)
      console.error('Panel:', panelText, 'Lager:', JSON.stringify(page.__u4storage || []), 'Rækker:', JSON.stringify(mock.table('video_analyses').map(r => r.analysis_state)))
      throw err
    } finally { await page.close() }
  }
  try {
    for (const width of [390, 1280]) {
      await step(`atlet, for stor video på ${width} px`, SIZES[width], page => runAtletForStor(page, mock, width, outDir))
      await step(`atlet, afbrudt upload og Prøv igen på ${width} px`, SIZES[width], page => runAtletAfbrudt(page, mock, width, outDir))
      await step(`coach, upload U4 på ${width} px`, SIZES[width], page => runCoachU4(page, mock, width, outDir))
    }
  } finally {
    // Stop altid egne processer; vent højst 5 s på at vite lukker.
    await browser.close().catch(() => {})
    await Promise.race([vite.stop(), new Promise(resolve => setTimeout(resolve, 5000))])
    vite.child.kill()
    await mock.close?.()
  }
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) main().catch(err => { console.error(err); process.exitCode = 1 })
