import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, extname } from 'node:path'
import { createMockSupabase } from '../e2e/mock-supabase.mjs'
import { buildSeed, ATHLETE_USER, ATHLETE_ID, EXERCISE_ID } from '../e2e/fixtures.mjs'
import { launchBrowser } from '../e2e/harness.mjs'

const root = resolve(import.meta.dirname, '..')
const out = resolve(root, 'outputs/ordre-1302')
mkdirSync(out, { recursive: true })
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' }
const server = createServer((req, res) => {
  const pathname = new URL(req.url, 'http://127.0.0.1:5230').pathname
  const file = resolve(root, 'dist', '.' + (pathname === '/' ? '/index.html' : pathname))
  if (!file.startsWith(resolve(root, 'dist') + '/') && !file.startsWith(resolve(root, 'dist') + '\\')) return res.writeHead(403).end()
  try { res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' }).end(readFileSync(file)) }
  catch { res.writeHead(404).end() }
})
await new Promise(r => server.listen(5230, '127.0.0.1', r))
const browser = await launchBrowser()
const results = []
try {
  for (const width of [390, 1280]) {
    const seed = buildSeed()
    const original = seed.tables.exercises[0]
    const ids = [EXERCISE_ID, '66666666-6666-4666-8666-666666666667', '66666666-6666-4666-8666-666666666668']
    seed.tables.exercises = [
      { ...original, name: 'Baenkpres - topsaet', sets: 1, reps: '3', recommended_weight: 100 },
      { ...original, id: ids[1], name: 'Bænkpres - backoff-sæt', sets: 2, reps: '5', recommended_weight: 80, exercise_order: 2 },
      { ...original, id: ids[2], name: 'Bænkpres', sets: 1, reps: '8', recommended_weight: 60, exercise_order: 3 },
    ]
    const oldWeekId = '44444444-4444-4444-8444-444444444445'
    const oldSessionId = '55555555-5555-4555-8555-555555555556'
    seed.tables.weeks.unshift({ ...seed.tables.weeks[0], id: oldWeekId, week_number: 0 })
    seed.tables.sessions.push({ ...seed.tables.sessions[0], id: oldSessionId, week_id: oldWeekId, title: 'Tidligere pas' })
    const oldExercises = seed.tables.exercises.map((ex, i) => ({ ...ex,
      id: `66666666-6666-4666-8666-66666666667${i}`, session_id: oldSessionId }))
    seed.tables.exercises.push(...oldExercises)
    seed.tables.exercise_logs = oldExercises.flatMap(ex => Array.from({ length: ex.sets }, (_, i) => ({
      id: `old-${ex.id}-${i}`, athlete_id: ATHLETE_ID, exercise_id: ex.id,
      set_number: i + 1, weight: ex.recommended_weight, reps_completed: Number(ex.reps),
      rpe_actual: 7, skipped: ex.id === oldExercises[1].id && i === 1,
      logged_at: new Date(Date.now() - 7 * 86400000).toISOString(), note: null,
    })))
    const mock = createMockSupabase(seed)
    await mock.listen(9230)
    const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block' })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort())
    try {
      await page.goto('http://127.0.0.1:5230')
      await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
      await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
      await page.getByRole('button', { name: 'Log ind', exact: true }).click()
      await page.getByRole('button', { name: 'Godkendt', exact: true }).waitFor()
      await page.getByText('Top 1 · Sæt 1/4', { exact: true }).waitFor()
      await page.screenshot({ path: resolve(out, `home-top-${width}.png`) })
      await page.getByRole('button', { name: 'Godkendt', exact: true }).click()
      await page.getByText('Backoff 1 · Sæt 2/4', { exact: true }).waitFor()
      await page.getByRole('button', { name: 'Program', exact: true }).click()
      await page.getByText(/Dag 1.*Squat/).click()
      assert.equal(await page.locator('[data-exercise-heading]').count(), 1)
      assert.equal(await page.locator('[data-exercise-heading]').innerText(), 'Bænkpres')
      await page.getByText('Top 1', { exact: true }).waitFor()
      await page.getByText('Backoff 1', { exact: true }).waitFor()
      await page.getByText('Backoff 2', { exact: true }).waitFor()
      await page.getByText('Sæt 1', { exact: true }).waitFor()
      // The original row IDs and per-row set numbering still reach the writer.
      await page.getByRole('button', { name: 'Log', exact: true }).first().click()
      await page.waitForTimeout(700)
      const logs = await (await fetch('http://127.0.0.1:9230/__e2e/table?name=exercise_logs')).json()
      assert.equal(logs.find(l => l.exercise_id === ids[0] && l.set_number === 1)?.weight, 100)
      assert.equal(logs.find(l => l.exercise_id === ids[1] && l.set_number === 1)?.weight, 80)
      assert.equal(logs.find(l => l.exercise_id === ids[0])?.reps_completed, 3)
      assert.equal(logs.find(l => l.exercise_id === ids[1])?.reps_completed, 5)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
      assert.equal(overflow, false)
      assert.deepEqual(errors, [])
      await page.screenshot({ path: resolve(out, `program-${width}.png`), fullPage: true })
      await page.getByRole('button', { name: '← Forrige uge', exact: true }).click()
      await page.getByText('Tidligere pas').click()
      await page.getByText('100kg × 3', { exact: true }).waitFor()
      await page.getByText('80kg × 5', { exact: true }).waitFor()
      await page.getByText('60kg × 8', { exact: true }).waitFor()
      await page.getByText('✕ Sprunget over', { exact: true }).waitFor()
      assert.equal(await page.locator('[data-exercise-heading]').count(), 1)
      assert.equal(await page.getByRole('button', { name: 'Log', exact: true }).count(), 0)
      await page.screenshot({ path: resolve(out, `historical-${width}.png`), fullPage: true })
      assert.deepEqual(errors, [])
      results.push({ width, headings: 1, topWeight: 100, backoffWeight: 80, originalIDs: true,
        historicalWeights: [100, 80, 60], historicalSkipped: true, overflow, errors })
    } finally { await context.close(); await mock.close() }
  }
} finally { await browser.close(); await new Promise(r => server.close(r)) }
writeFileSync(resolve(out, 'browser.json'), JSON.stringify(results, null, 2) + '\n')
console.log('PASS: two widths, unified Program heading, typed sets, home transition and original write IDs.')
