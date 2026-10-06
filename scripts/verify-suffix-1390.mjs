import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, extname } from 'node:path'
import { createMockSupabase } from '../e2e/mock-supabase.mjs'
import { buildSeed, ATHLETE_USER, ATHLETE_ID } from '../e2e/fixtures.mjs'
import { launchBrowser } from '../e2e/harness.mjs'

// Ordre 1390: synthetiske logs med programlaegningens suffiks-navne -> eet navn pr. hovedloeft.
const root = resolve(import.meta.dirname, '..')
const phase = process.argv[2] || 'after'
const dist = resolve(root, phase === 'before' ? 'dist-1390-before' : 'dist-1390')
const out = resolve(root, 'outputs/ordre-1390')
mkdirSync(out, { recursive: true })
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' }
const server = createServer((req, res) => {
  const p = new URL(req.url, 'http://127.0.0.1:5231').pathname
  const file = resolve(dist, '.' + (p === '/' ? '/index.html' : p))
  if (!file.startsWith(dist)) return res.writeHead(403).end()
  try { res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' }).end(readFileSync(file)) }
  catch { res.writeHead(404).end() }
})
await new Promise(r => server.listen(5231, '127.0.0.1', r))
const browser = await launchBrowser()
const NAMES = [ // [navn, vaegt, reps, uge-offset i dage]
  ['Squat - volumen', 100, 5, 14], ['Squat (comp)', 120, 3, 7], ['Squat - teknik-singler', 110, 1, 1],
  ['Baenkpres - comp', 80, 5, 14], ['Baenkpres (comp)', 90, 5, 7], ['Baenkpres - primaer', 95, 3, 1],
  ['Doedloeft - primaer', 140, 3, 14], ['Doedloeft - volumen', 150, 3, 7], ['Konventionel doedloeft - comp', 160, 2, 1],
  ['Sumo doedloeft (comp)', 150, 3, 14], ['Sumo doedloeft - teknik-singler', 170, 2, 7], ['Sumo doedloeft - volumen', 160, 3, 1],
]
let result
try {
  const seed = buildSeed()
  const base = seed.tables.exercises[0], baseLog = seed.tables.exercise_logs[0]
  const sess = seed.tables.sessions[0]
  seed.tables.exercises = NAMES.map(([name, w, r], i) => ({ ...base, id: `77777777-7777-4777-8777-7777777777${String(i).padStart(2, '0')}`, name, sets: 1, reps: String(r), recommended_weight: w, exercise_order: i + 1, session_id: sess.id }))
  seed.tables.exercise_logs = NAMES.map(([name, w, r, d], i) => ({ ...baseLog, id: `sfx-${i}`, athlete_id: ATHLETE_ID, exercise_id: seed.tables.exercises[i].id, set_number: 1, weight: w, reps_completed: r, rpe_actual: 8, skipped: false, logged_at: new Date(Date.now() - d * 86400000).toISOString(), note: null }))
  seed.tables.personal_records = NAMES.map(([name, w, r], i) => ({ id: `pr-${i}`, athlete_id: ATHLETE_ID, exercise_name: name, weight: w, reps: r, created_at: new Date().toISOString() }))
  const mock = createMockSupabase(seed)
  await mock.listen(9230)
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort())
  try {
    await page.goto('http://127.0.0.1:5231')
    await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
    await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
    await page.getByRole('button', { name: 'Log ind', exact: true }).click()
    await page.getByRole('button', { name: 'Mere', exact: true }).click()
    await page.evaluate(() => { for (const el of document.querySelectorAll('*')) if (getComputedStyle(el).position === 'fixed') el.dataset.auditFixed = 'true' })
    const cropStyle = '[data-audit-fixed] { visibility: hidden !important }'
    const strength = page.getByText('Styrkeudvikling', { exact: true }).locator('..').locator('..')
    // Foer rettelsen kan blokken mangle helt (alle suffiks-navne faldt ud) - det er selve fejlen.
    const shown = await strength.waitFor({ timeout: 8000 }).then(() => true, () => false)
    const strengthText = shown ? await strength.innerText() : '(Styrkeudvikling vises ikke)'
    if (shown) await strength.screenshot({ style: cropStyle, path: resolve(out, `${phase}-1rm-390.png`) })
    else await page.screenshot({ path: resolve(out, `${phase}-1rm-390.png`) })
    await page.getByRole('button', { name: 'Fremgang', exact: true }).click()
    await page.getByRole('heading', { name: 'Bliver du stærkere?' }).waitFor()
    const text = await page.locator('body').innerText()
    const tabs = await page.locator('button').allInnerTexts()
    await page.screenshot({ path: resolve(out, `${phase}-fremgang-390.png`), fullPage: true })
    result = { phase, strengthText, tabs, text, errors, hscroll: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth) }
    if (phase === 'after') {
      for (const lift of ['Squat', 'Bænkpres', 'Dødløft', 'Sumo dødløft'])
        assert.equal(tabs.filter(t => t.trim().toLowerCase() === lift.toLowerCase()).length, 1, `tab ${lift}`)
      assert.ok(!/comp|volumen|primær|primaer|teknik/i.test(strengthText), 'ingen suffikser i 1RM-blok')
      assert.equal(result.hscroll, false)
    }
    assert.deepEqual(errors, [])
  } finally { await context.close(); await mock.close() }
} finally { await browser.close(); await new Promise(r => server.close(r)) }
writeFileSync(resolve(out, `${phase}-browser.json`), JSON.stringify(result, null, 2) + '\n')
console.log(`PASS: ${phase}\n` + result.strengthText + '\nTABS: ' + result.tabs.join(' | '))
