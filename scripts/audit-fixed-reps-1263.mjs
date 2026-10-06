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
  for (const screen of ['home', 'program']) {
    const seed = buildSeed()
    seed.tables.exercises[0].reps = '8'
    const mock = createMockSupabase(seed)
    await mock.listen(9230)
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort())
    const table = async () => (await fetch(`${mockUrl}/__e2e/table?name=exercise_logs`)).json()
    async function logAndCheck(setNumber, expected) {
      await page.getByRole('button', { name: screen === 'home' ? 'Godkendt' : 'Log', exact: true }).first().click()
      const deadline = Date.now() + 30000
      let row
      while (Date.now() < deadline) {
        row = (await table()).find(row => row.exercise_id === EXERCISE_ID && row.set_number === setNumber)
        if (row) break
        await page.waitForTimeout(100)
      }
      assert.equal(row?.reps_completed, expected)
      await page.waitForTimeout(600)
      return row
    }
    try {
      await page.goto(appUrl)
      await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
      await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
      await page.getByRole('button', { name: 'Log ind', exact: true }).click()
      await page.getByRole('button', { name: 'Godkendt', exact: true }).waitFor()
      if (screen === 'program') {
        await page.getByRole('button', { name: 'Program', exact: true }).click()
        await page.getByText(/Dag 1.*Squat/i).click()
      }
      const field = page.getByLabel('Reps, s\u00e6t 1', { exact: true })
      const editable = await field.count() === 1
      const result = { screen, editable, errors }
      if (label === 'before') {
        assert.equal(editable, false, 'baseline must reproduce missing fixed-reps field')
        result.row = await logAndCheck(1, 8)
      } else {
        assert.equal(editable, true)
        assert.equal(await field.inputValue(), '8')
        await field.fill('3')
        result.fewerReps = await logAndCheck(1, 3)
        const next = page.getByLabel('Reps, s\u00e6t 2', { exact: true })
        assert.equal(await next.inputValue(), '8', 'next set starts at plan, not previous actual reps')
        await next.fill('0')
        result.zeroReps = await logAndCheck(2, 0)
        result.unchangedPlan = await logAndCheck(3, 8)
      }
      result.horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
      assert.equal(result.horizontalOverflow, false)
      assert.deepEqual(errors, [])
      await page.screenshot({ path: resolve(out, `${label}-${screen}-fixed-390.png`), fullPage: true })
      results.push(result)
    } finally { await context.close(); await mock.close() }
  }
} finally {
  writeFileSync(resolve(out, `fixed-${label}.json`), JSON.stringify({ label, results }, null, 2))
  await browser.close()
  await new Promise(r => server.close(r))
}
console.log(`PASS: fixed-reps ${label}, both primary screens`)