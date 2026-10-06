// Order 1210: real App -> Dashboard -> saved review, local mock only.
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
const out = resolve('outputs/1210')
mkdirSync(out, { recursive: true })
const preserved = ['src/dashboard/VideoReviewModal.jsx', 'src/dashboard/AnalysePakkeReview.jsx', 'src/dashboard/analysePakke.js', 'src/dashboard/analysePakke.test.js', 'scripts/verify-analyse-pakke-review.mjs', 'scripts/byg-analyse-pakke-fixture.mjs', 'test/analyse-pakke/index.html', 'test/analyse-pakke/main.jsx', 'test/analyse-pakke/review.jsx', 'test/fixtures/analyse-pakke/syntetisk.json', 'docs/ANALYSE-PAKKE-REVIEW.md']
const hashes = () => Object.fromEntries(preserved.map(p => [p, createHash('sha256').update(readFileSync(p)).digest('hex')]))
const beforeHashes = hashes()
const fixture = JSON.parse(readFileSync('test/fixtures/analyse-pakke/syntetisk.json', 'utf8'))
const appOrigin = 'http://127.0.0.1:5210'
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
const vite = await createServer({ configFile: false, envDir: false, root: process.cwd(), plugins: [transport, react()], optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', '@supabase/auth-js', '@supabase/postgrest-js', '@supabase/storage-js'] }, resolve: { dedupe: ['react', 'react-dom'] }, server: { host: '127.0.0.1', port: 5210, strictPort: true, watch: { ignored: ['**/outputs/**'] } } })
const browser = await chromium.launch({ headless: true })
const isBaselineGet = (method, url) => {
  if (method !== 'GET') return false
  const u = new URL(url)
  if (u.origin !== mockOrigin || u.pathname !== '/rest/v1/video_analyses') return false
  const keys = [...u.searchParams.keys()].sort().join(',')
  return keys === 'athlete_id,limit,order,select' &&
    u.searchParams.get('select') === 'session_context,created_at' &&
    u.searchParams.get('order') === 'created_at.desc' &&
    u.searchParams.get('limit') === '20' &&
    /^eq\.[0-9a-f-]+$/i.test(u.searchParams.get('athlete_id') || '')
}
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
      const athleteField = section.getByLabel('Atlet (lokalt)', { exact: true })
      const kgField = section.getByLabel('Kg (lokalt)', { exact: true })
      check('manual-context-starts-empty', () => {})
      assert.equal(await athleteField.inputValue(), '')
      assert.equal(await kgField.inputValue(), '')
      const chooserPromise = page.waitForEvent('filechooser')
      await section.getByRole('button', { name: 'Hent analyse', exact: true }).click()
      const chooser = await chooserPromise
      await chooser.setFiles({ name: 'syntetisk.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)) })
      await section.locator('table').waitFor()
      await athleteField.fill('Syntetisk testatlet 1210')
      await kgField.fill('82.5')
      check('manual-athlete-and-decimal-kg', () => {})
      assert.equal(await athleteField.inputValue(), 'Syntetisk testatlet 1210')
      assert.equal(await kgField.inputValue(), '82.5')
      check('explicit-ephemeral-message', () => {})
      assert.match(await section.innerText(), /genindl\u00e6ser siden/)
      // Block every request during local re-import and context edits.
      // Marcs valg 1 (6. okt 2026, domme/MARCS-DOMME-coaching.md): appen goer ved sidens opstart den
      // kendte basislinje-GET af session_context (laesning, ingen skrivning). Testen tillader netop den
      // (metode, sti, select, limit og parametre matchet stramt); alt andet er stadig forbudt.
      const localNetwork = [], baselineSeen = []
      const denyLocal = route => {
        const req = route.request()
        if (isBaselineGet(req.method(), req.url())) { baselineSeen.push(req.url()); return route.continue() }
        localNetwork.push(req.url())
        return route.abort()
      }
      await context.route('**/*', denyLocal)
      await load()
      assert.equal(await athleteField.inputValue(), '')
      assert.equal(await kgField.inputValue(), '')
      check('new-file-clears-manual-context', () => {})
      await kgField.fill('85')
      await athleteField.fill('Syntetisk testatlet 1210')
      await context.unroute('**/*', denyLocal)
      check('local-context-and-import-no-network', () => assert.deepEqual(localNetwork, []))
      // Negativ test: undtagelsen er smal. Samme afgoerelse skal afvise alt andet end basislinje-GET'en.
      const baseUrl = `${mockOrigin}/rest/v1/video_analyses?select=session_context%2Ccreated_at&athlete_id=eq.33333333-3333-4333-8333-333333333333&order=created_at.desc&limit=20`
      check('baseline-exception-is-narrow', () => {
        assert.equal(isBaselineGet('GET', baseUrl), true)
        const forbidden = [
          ['POST', baseUrl], ['PATCH', baseUrl], ['DELETE', baseUrl], ['HEAD', baseUrl],
          ['GET', baseUrl.replace('session_context%2Ccreated_at', '*')],
          ['GET', baseUrl.replace('session_context%2Ccreated_at', 'session_context%2Ccreated_at%2Cathlete_id')],
          ['GET', baseUrl.replace('limit=20', 'limit=21')],
          ['GET', baseUrl + '&extra=1'],
          ['GET', baseUrl.replace('/video_analyses', '/athletes')],
          ['GET', baseUrl.replace('/rest/v1/', '/storage/v1/')],
          ['GET', baseUrl.replace(mockOrigin, 'https://example.com')],
        ]
        for (const [m, u] of forbidden) assert.equal(isBaselineGet(m, u), false, `${m} ${u}`)
      })
      // Samme afvisning i selve browseren: en sonde med anden metode/select naar aldrig mocken.
      const probeDeny = []
      const probeRoute = route => {
        const req = route.request()
        if (isBaselineGet(req.method(), req.url())) return route.continue()
        probeDeny.push(req.method() + ' ' + req.url())
        return route.abort()
      }
      await context.route('**/*', probeRoute)
      const probeCallsBefore = calls.length
      await page.evaluate(async base => {
        await fetch(base.replace('session_context%2Ccreated_at', '*')).catch(() => {})
        await fetch(base, { method: 'POST', body: '{}' }).catch(() => {})
      }, baseUrl)
      await context.unroute('**/*', probeRoute)
      check('other-requests-still-forbidden', () => {
        assert.equal(probeDeny.length, 2)
        assert.equal(calls.length, probeCallsBefore)
      })
      const text = await section.innerText()
      check('reps-and-set-loss', () => { assert.match(text, /3 reps/); assert.match(text, /15,0 %/); assert.match(text, /0,600/); assert.match(text, /0,900/) })
      check('findings-and-limits', () => { for (const f of fixture.fund) assert.ok(text.includes(f.linje)); assert.match(text, /Ikke regnet/); assert.match(text, /R\u00e5 skala/) })
      const nullCells = await section.locator('tbody tr').nth(1).locator('td').allTextContents()
      check('null-and-zero', () => assert.deepEqual(nullCells, ['-', '-', '-']))
      check('measured-zero', () => assert.match(text, /0,0/))
      const noOverflow = await dialog.evaluate(e => [...e.querySelectorAll('*'), e].every(x => {
        if (x.clientWidth === 0) return true
        // Long editable values scroll inside inputs; their boxes must fit.
        if (['INPUT', 'TEXTAREA'].includes(x.tagName)) {
          const box = x.getBoundingClientRect(), outer = e.getBoundingClientRect()
          return box.left >= outer.left - 1 && box.right <= outer.right + 1
        }
        return x.scrollWidth <= x.clientWidth + 1
      }))
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
      assert.equal(await athleteField.inputValue(), '')
      assert.equal(await kgField.inputValue(), '')
      check('remove-clears-manual-context', () => {})
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
      assert.equal(await athleteField.inputValue(), '')
      assert.equal(await kgField.inputValue(), '')
      check('switch-close-reopen-clears-context', () => {})
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
      await athleteField.fill('Syntetisk testatlet 1210')
      await kgField.fill('82.5')
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
          assert.ok(!c.body.includes('Syntetisk testatlet 1210'))
          assert.ok(!c.body.includes('82.5'))
          const body = JSON.parse(c.body)
          assert.ok(Object.keys(body).every(k => ['athlete_feedback', 'feedback_version', 'status'].includes(k)))
          for (const f of fixture.fund) assert.ok(!c.body.includes(f.linje))
          assert.ok(!('reps' in body) && !('metrics' in body) && !('findings' in body))
        }
      })
      check('untouched-other-row', () => assert.deepEqual(table().find(r => r.id !== activeId), initialRows.find(r => r.id !== activeId)))
      // Reload must discard the package AND both manually entered fields.
      await page.reload()
      await page.locator('#athlete-auth-email').fill(COACH_USER.email)
      await page.locator('#athlete-auth-password').fill(COACH_USER.password)
      await page.getByRole('button', { name: 'Log ind', exact: true }).click()
      await page.locator('button[aria-label^="\u00c5bn gemt m\u00e5ling"]').waitFor()
      await page.locator('button[aria-label^="\u00c5bn gemt m\u00e5ling"]').click()
      await section.waitFor()
      assert.equal(await section.locator('table').count(), 0)
      assert.equal(await athleteField.inputValue(), '')
      assert.equal(await kgField.inputValue(), '')
      check('reload-clears-package-athlete-and-kg', () => {})
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
