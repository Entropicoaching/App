// Local-only production-build audit. Never loads .env files or contacts live services.
import assert from 'node:assert/strict'
import { build } from 'vite'
import config from './local-audit.config.mjs'
import { createServer } from 'node:http'
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs'
import { resolve, extname } from 'node:path'
import { gzipSync } from 'node:zlib'
import { createMockSupabase } from '../e2e/mock-supabase.mjs'
import { buildSeed, ATHLETE_USER, EXERCISE_ID } from '../e2e/fixtures.mjs'
import { launchBrowser, ensureSyntheticClip } from '../e2e/harness.mjs'

const label = process.argv[2] || 'before'
assert.match(label, /^(before|after)$/)
const root = resolve(import.meta.dirname, '..')
const out = resolve(root, 'outputs', 'ordre-1263')
mkdirSync(out, { recursive: true })
const appUrl = 'http://127.0.0.1:5230/'
const mockUrl = 'http://127.0.0.1:9230'
await build({ ...config, configFile: false, root, mode: 'audit' })
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.mp4': 'video/mp4' }
const server = createServer((req, res) => {
  const pathname = new URL(req.url, appUrl).pathname
  const file = resolve(root, 'dist', '.' + (pathname === '/' ? '/index.html' : pathname))
  if (!file.startsWith(resolve(root, 'dist') + '/') && !file.startsWith(resolve(root, 'dist') + '\\')) { res.writeHead(403).end(); return }
  try {
    const bytes = readFileSync(file)
    const compressed = /\.(html|js|css|svg|json)$/.test(file)
    const body = compressed ? gzipSync(bytes) : bytes
    res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Content-Length': body.length,
      ...(compressed ? { 'Content-Encoding': 'gzip' } : {}), 'Cache-Control': 'no-store' }).end(body)
  } catch { res.writeHead(404).end() }
})
await new Promise(r => server.listen(5230, '127.0.0.1', r))
const browser = await launchBrowser()
const results = []
try {
  for (let run = 1; run <= 3; run++) {
    const seed = buildSeed({ withAnalyzedVideo: true })
    seed.tables.video_analyses[0].status = 'shared'
    seed.tables.video_analyses[0].athlete_feedback = { works: [{ text: 'Syntetisk feedback: god kontrol.' }], focus: [{ text: 'Syntetisk fokus: hold spaending.' }], next_set: [{ text: 'Syntetisk naeste saet: samme teknik.' }] }
    const mock = createMockSupabase(seed)
    await mock.listen(9230)
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' })
    const page = await context.newPage()
    page.setDefaultTimeout(30000)
    const errors = [], blocked = [], requests = [], timings = {}, findings = {}
    page.on('pageerror', e => errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
    page.on('request', r => requests.push({ url: r.url().replace(appUrl, '/').replace(mockUrl, '/mock'), method: r.method() }))
    await context.route('**/*', route => {
      const url = new URL(route.request().url())
      if (url.hostname === '127.0.0.1' || url.protocol === 'blob:' || url.protocol === 'data:') return route.continue()
      blocked.push(url.origin + url.pathname)
      return route.abort()
    })
    const cdp = await context.newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 })
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    async function timed(name, action, ready) {
      const t = performance.now()
      await action()
      await ready()
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
      timings[name] = Math.round(performance.now() - t)
      console.log(label, run, name, timings[name])
    }
    const table = async name => (await fetch(`${mockUrl}/__e2e/table?name=${name}`)).json()
    async function waitRows(name, predicate) {
      const deadline = Date.now() + 30000
      while (Date.now() < deadline) {
        if (predicate(await table(name))) return
        await new Promise(r => setTimeout(r, 100))
      }
      throw new Error(`Timed out waiting for mock table ${name}`)
    }
    try {
      await timed('login_first', () => page.goto(appUrl), () => page.locator('#athlete-auth-email').waitFor())
      await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
      await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
      await timed('home_first', () => page.getByRole('button', { name: 'Log ind', exact: true }).click(), () => page.getByRole('button', { name: 'Godkendt', exact: true }).waitFor())
      await page.getByLabel('Vægt, sæt 1', { exact: true }).fill('82,5')
      await page.getByLabel('Reps, sæt 1', { exact: true }).fill('6')
      await page.getByRole('button', { name: /^RPE, sæt 1:/ }).click()
      await page.getByRole('button', { name: 'RPE 7.5', exact: true }).click()
      await timed('program_first', () => page.getByRole('button', { name: 'Program', exact: true }).click(), () => page.getByText(/Dag 1 — Squat/i).waitFor())
      await page.getByText(/Dag 1 — Squat/i).click()
      assert.equal(await page.getByLabel('Vægt, sæt 1', { exact: true }).inputValue(), '82.5')
      assert.equal(await page.getByLabel('Reps, sæt 1', { exact: true }).inputValue(), '6')
      await page.getByLabel('Reps, sæt 2', { exact: true }).fill('5')
      await page.getByRole('button', { name: 'Log', exact: true }).first().click()
      findings.nextSetDraftReps = await page.getByLabel('Reps, sæt 2', { exact: true }).inputValue()
      findings.expectedNextSetDraftReps = '5'
      await waitRows('exercise_logs', rows => rows.some(r => r.exercise_id === EXERCISE_ID && r.set_number === 1))
      const row = (await table('exercise_logs')).find(r => r.set_number === 1)
      assert.equal(row.weight, 82.5); assert.equal(row.reps_completed, 6); assert.equal(row.rpe_actual, 7.5)
      await timed('home_return', () => page.getByRole('button', { name: 'Hjem', exact: true }).click(), () => page.getByLabel('Vægt, sæt 2', { exact: true }).waitFor())
      await page.getByLabel('Vægt, sæt 2', { exact: true }).fill('85')
      await page.getByLabel('Reps, sæt 2', { exact: true }).fill('5')
      await page.getByRole('button', { name: 'Godkendt', exact: true }).dblclick({ delay: 100 })
      await waitRows('exercise_logs', rows => rows.some(r => r.set_number === 2))
      // Wait for all serialized writes before asserting duplicate safety.
      await page.waitForTimeout(1500)
      findings.doubleClickRows = (await table('exercise_logs')).filter(r => r.set_number === 2).length
      findings.accidentalThirdSet = (await table('exercise_logs')).some(r => r.set_number === 3)
      assert.equal(findings.doubleClickRows, 1)
      await timed('program_return', () => page.getByRole('button', { name: 'Program', exact: true }).click(), () => page.getByLabel('Vægt, sæt 4', { exact: true }).waitFor())
      await page.getByRole('button', { name: 'Hjem', exact: true }).click()
      await timed('feedback_first', () => page.getByRole('button', { name: 'Mere', exact: true }).click(), () => page.getByText('Syntetisk fokus: hold spaending.', { exact: true }).waitFor())
      findings.calendarPrematurelyDone = await page.locator('[data-dagstrimmel] button').evaluateAll(buttons => buttons.some(b => b.getAttribute('aria-label')?.includes('klaret')))
      findings.programPrematurelyDone = await page.getByRole('button', { name: /Dag 1 — Squat/ }).last().textContent().then(text => text.includes('✓'))
      if (label === 'after') { assert.equal(findings.calendarPrematurelyDone, false); assert.equal(findings.programPrematurelyDone, false) }
      await timed('video_first', () => page.getByText('VideoCoach', { exact: true }).click(), () => page.frameLocator('iframe[title="VideoCoach"]').locator('body.athlete').waitFor({ state: 'attached' }))
      const frame = page.frameLocator('iframe[title="VideoCoach"]')
      await frame.locator('#fileInput').setInputFiles(ensureSyntheticClip())
      await frame.locator('#athleteSubmitSheet[hidden]').waitFor({ state: 'detached' })
      await frame.locator('#liftSel').selectOption({ label: 'Squat' })
      await timed('video_upload', () => frame.locator('#saveBtn').click(), () => waitRows('video_analyses', rows => rows.some(r => r.analysis_state === 'awaiting_analysis')))
      const uploads = (await table('video_analyses')).filter(r => r.analysis_state === 'awaiting_analysis')
      assert.equal(uploads.length, 1)
      const keys = await (await fetch(`${mockUrl}/__e2e/storage-keys`)).json()
      assert.ok(keys.includes(`videocoach-uploads/${uploads[0].video_path}`))
      await frame.locator('#closeBtn').click()
      await timed('video_return', () => page.getByText('VideoCoach', { exact: true }).click(), () => page.frameLocator('iframe[title="VideoCoach"]').locator('body.athlete').waitFor({ state: 'attached' }))
      await frame.locator('#closeBtn').click()
      await page.screenshot({ path: resolve(out, `${label}-${run}-390.png`), fullPage: true })
      findings.horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
      findings.exerciseWriteRequests = requests.filter(r => r.url.startsWith('/mock/rest/v1/exercise_logs') && r.method !== 'GET').length
      const nextNumber = findings.accidentalThirdSet ? 4 : 3
      await page.getByLabel(`Vægt, sæt ${nextNumber}`, { exact: true }).fill('91')
      await page.reload()
      await page.getByLabel(`Vægt, sæt ${nextNumber}`, { exact: true }).waitFor()
      findings.unloggedDraftAfterReload = await page.getByLabel(`Vægt, sæt ${nextNumber}`, { exact: true }).inputValue()
      findings.expectedDraftAfterReload = '91'
      if (label === 'after') assert.equal(findings.nextSetDraftReps, '5', 'pre-entered next-set reps must survive logging previous set')
      if (label === 'after') assert.equal(findings.accidentalThirdSet, false, 'double tap must not log the next set')
      results.push({ run, timings, findings, errors, blocked, requests })
    } catch (error) {
      results.push({ run, timings, findings, errors, blocked, requests, failure: error.message })
      await page.screenshot({ path: resolve(out, `${label}-${run}-failure.png`), fullPage: true }).catch(() => {})
      throw error
    } finally { await context.close(); await mock.close() }
  }
} finally {
  writeFileSync(resolve(out, `${label}.json`), JSON.stringify({ label, method: '390x844, cold context each run, gzip production assets, 150ms latency, 1.6Mbps down/750kbps up, CPU x4; localhost mocks; external requests blocked; click-to-ready includes Playwright actionability and two paint frames', syntheticClipBytes: statSync(ensureSyntheticClip()).size, results }, null, 2))
  await browser.close()
  await new Promise(r => server.close(r))
}
