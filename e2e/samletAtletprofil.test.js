// Lokal browserprøve med opdigtede data. Ingen miljøfiler eller eksterne kald.
import test from 'node:test'
import assert from 'node:assert/strict'
import process from 'node:process'
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { createMockSupabase } from './mock-supabase.mjs'
import { buildSeed, ATHLETE_ID, COACH_USER, SESSION_ID, WEEK_ID } from './fixtures.mjs'
import { addCalendarDays, calendarDay } from '../src/calendarDate.js'
import { SAMLET_ATLETPROFIL_FLAG } from '../src/dashboard/samletAtletprofil.js'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))
const root = resolve(import.meta.dirname, '..')
const out = resolve(process.env.COACH_PROFILE_SCREENSHOTS || join(root, 'work/samlet-atletprofil'))
const otherId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const mockPort = 8991
const mockUrl = `http://127.0.0.1:${mockPort}`

function seed() {
  const data = buildSeed({ withLogs: true, withAnalyzedVideo: true })
  const today = calendarDay()
  const day = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7
  data.tables.weeks[0].start_date = addCalendarDays(today, -day)
  data.tables.sessions[0].title = 'Squat og bænkpres'
  data.tables.sessions[0].weekday = day
  data.tables.athletes[0].kcal_target = 2500
  data.tables.athletes[0].protein_target = 180
  data.tables.sessions.push({ id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', week_id: WEEK_ID, title: 'Dødløft', session_order: 2, weekday: (day + 1) % 7 })
  data.tables.athletes.push({ id: otherId, user_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', name: 'Tom atlet', status: 'active', hidden: false })
  data.tables.messages = [{ id: 'm1', athlete_id: ATHLETE_ID, sender_role: 'athlete', category: 'teknik', content: 'Kan du se mit seneste squat?', read_by_coach: false, created_at: new Date().toISOString() }]
  // Mere end 50 nyere kladder hos en anden atlet må ikke skjule profilens video.
  const queueAthlete = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
  data.tables.athletes.push({ id: queueAthlete, name: 'Køatlet', status: 'active', hidden: true })
  const video = data.tables.video_analyses[0]
  data.tables.video_analyses.push(...Array.from({ length: 51 }, (_, i) => ({ ...video, id: `queue-${i}`, athlete_id: queueAthlete, created_at: new Date(Date.now() + (i + 1) * 1000).toISOString() })))
  return data
}

async function appServer(baselineRef) {
  const files = ['src/Dashboard.jsx', 'src/dashboard/KostTab.jsx', 'src/dashboard/OversigtTab.jsx', 'src/dashboard/useDashboardEffekter.js']
  const old = new Map(baselineRef ? files.map(file => [join(root, file), execFileSync('git', ['show', `${baselineRef}:${file}`], { cwd: root, encoding: 'utf8' })]) : [])
  const server = await createServer({
    root, configFile: false, envDir: false,
    plugins: [{ name: 'profil-reference', enforce: 'pre', load: id => old.get(id.split('?')[0]) }, react()],
    define: { __BUILD_ID__: JSON.stringify('profil-proeve'), 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(mockUrl), 'import.meta.env.VITE_SUPABASE_KEY': JSON.stringify('local-test-key') },
    server: { host: '127.0.0.1', port: 0 },
  })
  await server.listen()
  return { server, url: server.resolvedUrls.local[0] }
}

async function login(page, url, enabled) {
  await page.addInitScript(({ enabled, key }) => { if (enabled) localStorage.setItem(key, 'true'); else localStorage.removeItem(key) }, { enabled, key: SAMLET_ATLETPROFIL_FLAG })
  await page.goto(url)
  await page.locator('#athlete-auth-email').fill(COACH_USER.email)
  await page.locator('#athlete-auth-password').fill(COACH_USER.password)
  await page.getByRole('button', { name: 'Log ind', exact: true }).click()
  await page.getByRole('button', { name: /Testatlet.*Uge/ }).waitFor()
  await page.getByRole('button', { name: /Testatlet.*Uge/ }).click()
}

test('samlet atletprofil og uændret visning med kontakten fra ved 390 px', { timeout: 120000 }, async () => {
  mkdirSync(out, { recursive: true })
  const mock = createMockSupabase(seed())
  await mock.listen(mockPort)
  const app = await appServer()
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] } : {}) })
  const errors = []
  let baseline
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Copenhagen' })
    await context.route('**/*', route => /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(route.request().url()) ? route.continue() : route.abort())
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
    const writes = []
    page.on('request', req => { if (req.url().includes('/rest/v1/') && req.method() !== 'GET' && req.method() !== 'HEAD') writes.push(new URL(req.url()).pathname) })
    await login(page, app.url, true)
    const nav = page.getByRole('navigation', { name: 'Atletens faner' })
    await nav.getByRole('button', { name: 'Program', exact: true }).waitFor()
    const status = page.getByRole('region', { name: 'Atletstatus' })
    await status.getByText('1 af 2 pas logget', { exact: true }).waitFor()
    await status.getByRole('button', { name: /Video venter/ }).waitFor()
    assert.equal(await nav.getByRole('button').count(), 4)
    assert.equal(await nav.getByRole('button', { name: 'Program', exact: true }).getAttribute('aria-current'), 'page')
    assert.equal(await page.getByRole('button', { name: 'Fjern atlet', exact: true }).count(), 0)
    assert.deepEqual(writes.filter(path => !path.endsWith('/profiles') && !path.includes('/rpc/')), [], 'Status må ikke ændre atletdata eller læsemarkere beskeder')
    await page.getByRole('heading', { name: 'Program: 1 uger', exact: true }).waitFor()
    await page.screenshot({ path: join(out, 'atletprofil-390.png'), fullPage: true })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= 390), true, 'Ingen vandret rulning')

    await status.getByRole('button', { name: /Næste pas/ }).click()
    await page.getByText('Squat og bænkpres', { exact: true }).last().waitFor()
    await status.getByRole('button', { name: /Denne uge/ }).click()
    assert.equal(await nav.getByRole('button', { name: 'Log', exact: true }).getAttribute('aria-current'), 'page')
    await status.getByRole('button', { name: /Seneste besked/ }).click()
    await page.getByRole('button', { name: /Teknik & løft/ }).waitFor()
    await page.getByText('Kan du se mit seneste squat?', { exact: true }).last().waitFor()

    await nav.getByRole('button', { name: 'Mere ▾', exact: true }).click()
    await page.getByRole('button', { name: 'Fjern atlet', exact: true }).waitFor()
    const remove = await page.getByRole('button', { name: 'Fjern atlet', exact: true }).boundingBox()
    assert.ok(remove.y >= 0 && remove.y + remove.height <= 844 - 76, 'Profiladministration skal kunne nås over mobilens bundmenu')
    await page.screenshot({ path: join(out, 'mere-390.png'), fullPage: true })
    await page.keyboard.press('Escape')
    assert.equal(await page.getByRole('button', { name: 'Fjern atlet', exact: true }).count(), 0)
    await page.getByRole('button', { name: 'Se mål', exact: true }).click()
    await page.getByRole('button', { name: 'Rediger mål', exact: true }).click()
    const calories = page.locator('input[type=number]:visible')
    assert.equal(await calories.nth(2).inputValue(), '2500')
    assert.equal(await calories.nth(3).inputValue(), '180')
    await calories.nth(2).fill('2700')
    await page.getByRole('button', { name: 'Gem', exact: true }).click()
    await page.getByRole('button', { name: 'Rediger mål', exact: true }).waitFor()
    await nav.getByRole('button', { name: 'Program', exact: true }).click()
    await page.getByText('Kostmål · 2700 kcal · 180 g protein', { exact: true }).waitFor()
    await status.getByRole('button', { name: /Video venter/ }).click()
    await page.getByRole('dialog').getByText('Gennemgå måling', { exact: true }).waitFor()
    await page.getByRole('dialog').getByRole('button', { name: 'Luk', exact: true }).click()

    await page.getByRole('button', { name: '← Tilbage til atleter', exact: true }).click()
    await page.getByRole('button', { name: /Tom atlet/ }).last().click()
    await nav.waitFor()
    await page.getByRole('heading', { name: 'Program: 0 uger', exact: true }).waitFor()
    assert.equal(await page.getByRole('region', { name: 'Atletstatus' }).count(), 0)
    assert.equal(await page.getByRole('button', { name: 'Se mål', exact: true }).count(), 0)
    await page.screenshot({ path: join(out, 'tom-atlet-390.png'), fullPage: true })
    assert.deepEqual(errors, [])
    await context.close()

    const offContext = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Copenhagen' })
    const off = await offContext.newPage()
    const offVideoReads = []
    off.on('request', req => {
      const url = new URL(req.url())
      if (url.pathname.endsWith('/video_analyses') && url.searchParams.get('limit') === '1') offVideoReads.push(url.pathname)
    })
    await login(off, app.url, false)
    await off.getByRole('button', { name: /Hjem$/ }).waitFor()
    assert.equal(await off.getByRole('navigation', { name: 'Atletens faner' }).count(), 0)
    assert.equal(await off.getByRole('region', { name: 'Atletstatus' }).count(), 0)
    await off.getByRole('button', { name: /Hjem$/ }).click()
    await off.getByText('Træninger denne uge', { exact: true }).waitFor()
    assert.deepEqual(offVideoReads, [], 'Kontakten fra må ikke tilføje statuskald')
    const profile = off.getByRole('button', { name: /Tilbage til atleter/ }).locator('../..')
    const offHtml = await profile.innerHTML()
    await off.screenshot({ path: join(out, 'kontakt-fra-390.png'), fullPage: true })

    if (process.env.PROFILE_BASE_REF) {
      baseline = await appServer(process.env.PROFILE_BASE_REF)
      const oldContext = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Copenhagen' })
      const oldPage = await oldContext.newPage()
      await login(oldPage, baseline.url, false)
      await oldPage.getByRole('button', { name: /Hjem$/ }).click()
      await oldPage.getByText('Træninger denne uge', { exact: true }).waitFor()
      const oldProfile = oldPage.getByRole('button', { name: /Tilbage til atleter/ }).locator('../..')
      assert.equal(await oldProfile.innerHTML(), offHtml, 'Profilens HTML med kontakten fra skal matche udgangspunktet')
      await oldPage.screenshot({ path: join(out, 'foer-390.png'), fullPage: true })
      assert.deepEqual(readFileSync(join(out, 'kontakt-fra-390.png')), readFileSync(join(out, 'foer-390.png')), 'Skærmbilledet med kontakten fra skal være uændret')
      await oldContext.close()
    }
    await offContext.close()
    const stored = await (await fetch(`${mockUrl}/__e2e/table?name=athletes`)).json()
    assert.equal(stored.find(a => a.id === ATHLETE_ID).kcal_target, 2700)
    const sessions = await (await fetch(`${mockUrl}/__e2e/table?name=sessions`)).json()
    assert.equal(sessions.find(s => s.id === SESSION_ID).title, 'Squat og bænkpres')
    writeFileSync(join(out, 'verifikation.json'), JSON.stringify({
      resultat: 'Grøn', bredde: 390, kunOpdigtedeData: true,
      kontrolleret: ['Tre hovedfaner', 'Genveje fra status', 'Kostmål forudfyldt og gemt ét sted', 'Videogennemgang', 'Mere og Escape', 'Tom atlet', 'Ingen vandret rulning', 'Ingen browserfejl'],
      kontaktFraSammenlignetMed: process.env.PROFILE_BASE_REF || null,
    }, null, 2) + '\n')
  } finally {
    await browser.close()
    await app.server.close()
    await baseline?.server.close()
    await mock.close()
  }
})
