// Order 1146: real App -> Dashboard -> saved review, local mock only.
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { homedir } from 'node:os'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { createMockSupabase } from '../e2e/mock-supabase.mjs'
import { buildSeed, COACH_USER, MEASURED_VIDEO_ID, ANALYZED_VIDEO_ID } from '../e2e/fixtures.mjs'

const require = createRequire(import.meta.url)
const { chromium } = require(join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))
const out = resolve('outputs/1146')
mkdirSync(out, { recursive: true })
const preserved = ['src/dashboard/VideoReviewModal.jsx', 'src/dashboard/AnalysePakkeReview.jsx', 'src/dashboard/analysePakke.js', 'src/dashboard/analysePakke.test.js', 'scripts/verify-analyse-pakke-review.mjs', 'scripts/byg-analyse-pakke-fixture.mjs', 'test/analyse-pakke/index.html', 'test/analyse-pakke/main.jsx', 'test/analyse-pakke/review.jsx', 'test/fixtures/analyse-pakke/syntetisk.json', 'docs/ANALYSE-PAKKE-REVIEW.md']
const hashes = () => Object.fromEntries(preserved.map(p => [p, createHash('sha256').update(readFileSync(p)).digest('hex')]))
const beforeHashes = hashes()
const fixture = JSON.parse(readFileSync('test/fixtures/analyse-pakke/syntetisk.json', 'utf8'))
const appOrigin = 'http://127.0.0.1:5196'
const mockOrigin = 'http://127.0.0.1:8996'
// Resolve before Vite can read src/supabase.js. No env/config/credential files.
const transport = {
  name: 'synthetic-local-transport', enforce: 'pre',
  resolveId(source, importer) {
    if (/^(?:\.\.\/|\.\/)+supabase(?:\.js)?$/.test(source) && importer?.replaceAll('\\', '/').includes('/src/'))
      return resolve('test/analyse-pakke-dashboard/supabase-mock.js')
  },
  load(id) {
    if (id.replaceAll('\\', '/').endsWith('/src/supabase.js')) throw new Error('Forbidden production transport load')
  },
}
const vite = await createServer({ configFile: false, envDir: false, root: process.cwd(), plugins: [transport, react()], optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', '@supabase/auth-js', '@supabase/postgrest-js', '@supabase/storage-js'] }, resolve: { dedupe: ['react', 'react-dom'] }, server: { host: '127.0.0.1', port: 5196, strictPort: true, watch: { ignored: ['**/outputs/**'] } } })
const browser = await chromium.launch({ headless: true })
const results = []
try {
  await vite.listen()
  for (const width of [1280, 390]) {
    const seed = buildSeed({ withMeasuredVideo: true, withAnalyzedVideo: true })
    const original = seed.tables.video_analyses.find(r => r.id === MEASURED_VIDEO_ID)
    // Different saved reps than the package; no video/storage path is required.
    original.reps_count = 1
    original.rep_details = original.rep_details.slice(0, 1)
    for (const row of seed.tables.video_analyses) row.video_path = null
    const initialRows = structuredClone(seed.tables.video_analyses)
    const mock = createMockSupabase(seed)
    const calls = []
    mock.server.prependListener('request', req => {
      const call = { method: req.method, path: req.url, body: '' }
      calls.push(call)
      req.on('data', chunk => { call.body += chunk.toString() })
    })
    await mock.listen(8996)
    const context = await browser.newContext({ viewport: { width, height: 1000 }, serviceWorkers: 'block' })
    const errors = [], external = []
    // Installed BEFORE opening App. No external request may reach the network.
    await context.route('**/*', route => {
      const origin = new URL(route.request().url()).origin
      if (![appOrigin, mockOrigin].includes(origin)) {
        external.push({ origin, method: route.request().method() })
        return route.abort('blockedbyclient')
      }
      return route.continue()
    })
    const page = await context.newPage()
    page.on('pageerror', e => errors.push(e.message))
    page.setDefaultTimeout(15000)
    const mutations = () => calls.filter(c => c.path.startsWith('/rest/') && !['GET', 'HEAD', 'OPTIONS'].includes(c.method))
    const table = () => structuredClone(mock.table('video_analyses'))
    const checks = []
    const check = (name, fn) => { fn(); checks.push(name) }
    try {
      await page.goto(appOrigin, { timeout: 30000 })
      await page.locator('#athlete-auth-email').fill(COACH_USER.email)
      await page.locator('#athlete-auth-password').fill(COACH_USER.password)
      await page.getByRole('button', { name: 'Log ind', exact: true }).click()
      const entry = page.locator('button[aria-label^="\u00c5bn gemt m\u00e5ling"]')
      await entry.waitFor()
      await page.screenshot({ path: join(out, `dashboard-${width}.png`), fullPage: true })
      await entry.click()
      const dialog = page.getByRole('dialog')
      await dialog.waitFor()
      const section = dialog.getByRole('region', { name: 'Lokal analyse-pakke' })
      await section.waitFor()
      check('real-dashboard-entry', () => assert.equal(table().find(r => r.id === MEASURED_VIDEO_ID).reps_count, 1))
      const localCallsStart = mutations().length
      const allWrites = () => calls.filter(c => !['GET', 'HEAD', 'OPTIONS'].includes(c.method))
      const localAllWritesStart = allWrites().length
      const storageSnapshot = () => page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))
      const storageBefore = await storageSnapshot()
      const load = async (p = fixture) => {
        await section.locator('input[type=file]').setInputFiles({ name: 'syntetisk.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(p)) })
        await section.locator('table').waitFor()
      }
      await load()
      const text = await section.innerText()
      check('reps-and-set-loss', () => { assert.match(text, /3 reps/); assert.match(text, /15,0 %/); assert.match(text, /0,600/); assert.match(text, /0,900/) })
      check('findings-and-limits', () => { for (const f of fixture.fund) assert.ok(text.includes(f.linje)); assert.match(text, /Ikke regnet/); assert.match(text, /R\u00e5 skala/) })
      const nullCells = await section.locator('tbody tr').nth(1).locator('td').allTextContents()
      check('null-and-zero', () => assert.deepEqual(nullCells, ['-', '-', '-']))
      check('measured-zero', () => assert.match(text, /0,0/))
      const noOverflow = await dialog.evaluate(e => [...e.querySelectorAll('*'), e].every(x => x.clientWidth === 0 || x.scrollWidth <= x.clientWidth + 1))
      check('dialog-no-horizontal-overflow', () => assert.equal(noOverflow, true))
      await section.screenshot({ path: join(out, `pakke-${width}.png`) })
      await dialog.screenshot({ path: join(out, `review-${width}.png`) })
      const multi = structuredClone(fixture)
      multi.saet.push({ reps: [4], tabPct: null })
      await load(multi)
      await section.getByText('S\u00e6ttab 2 (reps 4): -', { exact: true }).waitFor()
      check('all-sets', () => assert.equal(multi.saet.length, 2))
      await section.getByRole('button', { name: 'Fjern lokal pakke' }).click()
      const remainingTables = await section.locator('table').count()
      check('remove-clears', () => assert.equal(remainingTables, 0))
      await load()
      await dialog.getByRole('button', { name: 'Luk', exact: true }).click()
      await dialog.waitFor({ state: 'detached' })
      // The compact Dashboard entry already selected the real Analyse tab.
      const reviewButtons = page.getByRole('button', { name: 'Gennemg\u00e5 m\u00e5ling', exact: true })
      assert.equal(await reviewButtons.count(), 2)
      await reviewButtons.nth(1).click()
      await section.waitFor()
      assert.equal(await section.locator('table').count(), 0)
      await load()
      await dialog.getByRole('button', { name: 'Luk', exact: true }).click()
      await dialog.waitFor({ state: 'detached' })
      await reviewButtons.first().click()
      await section.waitFor()
      assert.equal(await section.locator('table').count(), 0)
      await dialog.getByRole('button', { name: 'Luk', exact: true }).click()
      await dialog.waitFor({ state: 'detached' })
      await reviewButtons.nth(1).click()
      await section.waitFor()
      assert.equal(await section.locator('table').count(), 0)
      check('switch-close-reopen-clears', () => assert.deepEqual(table(), initialRows))
      check('local-actions-no-mutations', () => assert.equal(mutations().length, localCallsStart))
      check('local-actions-no-http-writes', () => assert.equal(allWrites().length, localAllWritesStart))
      const storageAfter = await storageSnapshot()
      check('local-actions-no-storage-changes', () => assert.deepEqual(storageAfter, storageBefore))
      // The other row is used for real feedback/status actions; identify it from
      // the actual review GET rather than assuming the queue sort order.
      const reviewGet = [...calls].reverse().find(c => c.method === 'GET' && c.path.includes('/rest/v1/video_analyses?') && c.path.includes('id=eq.'))
      const activeId = new URL(reviewGet.path, mockOrigin).searchParams.get('id').slice(3)
      assert.ok([MEASURED_VIDEO_ID, ANALYZED_VIDEO_ID].includes(activeId))
      const savedBefore = table().find(r => r.id === activeId)
      await load()
      const feedback = { works: 'Stangen holdes roligt gennem hele saettet.', focus: 'Hold spaendet i bunden af naeste squat.', next_set: 'Tag luft og spaend maven foer hver gentagelse.' }
      for (const [key, label] of [['works', 'Det fungerer'], ['focus', 'Atletens fokus'], ['next_set', 'N\u00e6ste gang']]) await dialog.getByLabel(label).fill(feedback[key])
      await dialog.getByRole('button', { name: 'Gem feedback', exact: true }).click()
      await page.getByText('Feedback gemt', { exact: true }).waitFor()
      await dialog.getByRole('button', { name: 'Godkend til baseline', exact: true }).click()
      await dialog.getByRole('button', { name: 'Del feedback med atlet', exact: true }).click()
      await dialog.getByRole('button', { name: 'Skjul og udelad m\u00e5ling', exact: true }).waitFor()
      const after = table().find(r => r.id === activeId)
      check('real-review-saved-original-measurement', () => {
        for (const field of ['reps_count', 'metrics', 'findings', 'rep_details', 'bar_path', 'session_context']) assert.deepEqual(after[field], savedBefore[field])
        assert.equal(after.status, 'shared')
        assert.equal(after.athlete_feedback.works[0].text, feedback.works)
        assert.equal(after.athlete_feedback.focus[0].text, feedback.focus)
        assert.equal(after.athlete_feedback.next_set[0].text, feedback.next_set)
      })
      const reviewWrites = mutations().slice(localCallsStart)
      check('review-payloads-exclude-package', () => {
        assert.equal(reviewWrites.length, 3)
        assert.deepEqual(reviewWrites.map(c => JSON.parse(c.body).status).filter(Boolean), ['coach_approved', 'shared'])
        for (const c of reviewWrites) {
          assert.equal(c.method, 'PATCH')
          const body = JSON.parse(c.body)
          assert.ok(Object.keys(body).every(k => ['athlete_feedback', 'feedback_version', 'status'].includes(k)))
          for (const f of fixture.fund) assert.ok(!c.body.includes(f.linje))
          assert.ok(!('reps' in body) && !('metrics' in body) && !('findings' in body))
        }
      })
      check('untouched-other-row', () => assert.deepEqual(table().find(r => r.id !== activeId), initialRows.find(r => r.id !== activeId)))
      check('no-js-errors', () => assert.deepEqual(errors, []))
      check('no-external-attempts', () => assert.deepEqual(external, []))
      writeFileSync(join(out, `mock-calls-${width}.json`), JSON.stringify(calls.filter(c => !c.path.startsWith('/auth/')), null, 2) + '\n')
      results.push({ width, checks, mutationsDuringLocalActions: 0, httpWritesDuringLocalActions: 0, storageChangedDuringLocalActions: false, reviewWrites: 3, errors, external, originalMeasurementPreserved: true })
      console.log(`PASS ${width}: ${checks.length} checks`)
    } catch (error) {
      await page.screenshot({ path: join(out, `failure-${width}.png`), fullPage: true }).catch(() => {})
      writeFileSync(join(out, 'failure.json'), JSON.stringify({ width, error: error.message, errors, external, checks }, null, 2))
      throw error
    } finally {
      await context.close()
      await mock.close()
    }
  }
  assert.deepEqual(hashes(), beforeHashes)
  writeFileSync(join(out, 'preserved-1139.json'), JSON.stringify(beforeHashes, null, 2) + '\n')
  writeFileSync(join(out, 'browser.json'), JSON.stringify(results, null, 2) + '\n')
} finally {
  await browser.close()
  await vite.close()
}
