// ORDRE 1440 - regressionsrunde paa telefon-viewport (390x844) gennem hele flowet.
// Atlet: log ind (mock), Hjem, Dagens pas + pause/timer-pop-up, log et saet, Program,
// Fremgang, rekorder. Coach: oversigt, atlet, fremgang (linje + Log + rekorder), review
// med videoanalyse. Hver skaerm: ingen pageerror/console.error, intet vandret overflow,
// og viewport-skaermbillede (IKKE full-page: bundnavigationen er position:fixed, og
// et helside-billede viser den midt i indholdet; QA 1437 fund 4).
// Egen koersel: `npm run e2e:regression-1440` (billeder i outputs/1440).
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { ATHLETE_USER, COACH_USER, ATHLETE_ID, buildSeed } from './fixtures.mjs'

const OUT_DIR = process.env.E2E_OUT || join(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), '..', 'outputs', '1440')
mkdirSync(OUT_DIR, { recursive: true })
const DAY = 864e5
const W = 390, H = 844
const uuid = (n) => `${String(n).padStart(8, '0')}-1440-4440-8440-${String(n).padStart(12, '0')}`

function seed() {
  const s = buildSeed({ withAnalyzedVideo: true })
  const wk = uuid(1), se = uuid(2)
  s.tables.weeks.push({ id: wk, athlete_id: ATHLETE_ID, week_number: 0, block_name: 'Base' })
  s.tables.sessions.push({ id: se, week_id: wk, title: 'Historik', session_order: 9, weekday: 0, athlete_rating: null, athlete_comment: null })
  const hist = [[56, 'Bænkpres topsæt', 100, 3], [42, 'Bænkpres topsæt', 105, 3], [28, 'Bænkpres topsæt', 107.5, 3], [28, 'Bænkpres backoff', 90, 10],
    [14, 'Bænkpres topsæt', 110, 3], [50, 'Squat topsæt', 120, 3], [30, 'Squat topsæt', 130, 3], [8, 'Squat topsæt', 135, 3]]
  const navne = [...new Set(hist.map(h => h[1]))]
  const idFor = new Map()
  navne.forEach((n, i) => { idFor.set(n, uuid(10 + i)); s.tables.exercises.push({ id: uuid(10 + i), session_id: se, name: n, sets: 1, reps: '3', intensity: 'RPE 8', note: null, exercise_order: i + 1, recommended_weight: 80 }) })
  s.tables.exercise_logs.push(...hist.map(([d, n, kg, r], i) => ({ id: uuid(100 + i), exercise_id: idFor.get(n), athlete_id: ATHLETE_ID, set_number: i + 1, weight: kg, reps_completed: r, note: null, rpe_actual: null, rpe_planned: null, skipped: false, logged_at: new Date(Date.now() - d * DAY).toISOString() })))
  s.tables.personal_records.push({ id: uuid(200), athlete_id: ATHLETE_ID, exercise_name: 'Bænkpres topsæt', weight: 110, reps: 3, logged_at: new Date(Date.now() - 14 * DAY).toISOString(), created_at: new Date(Date.now() - 14 * DAY).toISOString() })
  return s
}

async function main() {
  const { createMockSupabase } = await import('./mock-supabase.mjs')
  const { startVite, launchBrowser, APP_URL, MOCK_PORT } = await import('./harness.mjs')
  const vite = await startVite(); const browser = await launchBrowser()
  const mock = createMockSupabase(seed()); await mock.listen(MOCK_PORT)
  const fejl = []
  const nye = (ctx, rolle) => ctx.newPage().then(p => {
    p.on('pageerror', e => fejl.push(`[${rolle}] pageerror: ${e.message}`))
    p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) fejl.push(`[${rolle}] console.error: ${m.text()}`) })
    return p
  })
  const tjek = async (page, navn) => {
    await page.waitForTimeout(400)
    const sw = await page.evaluate(() => document.documentElement.scrollWidth)
    assert.ok(sw <= W, `${navn}: vandret overflow ${sw} > ${W}`)
    await page.screenshot({ path: join(OUT_DIR, `${navn}.png`), fullPage: false })
    console.log(`  ok ${navn}`)
  }
  const logind = async (page, u) => {
    await page.goto(APP_URL)
    await page.locator('#athlete-auth-email').fill(u.email)
    await page.locator('#athlete-auth-password').fill(u.password)
    await page.getByRole('button', { name: 'Log ind' }).click()
  }
  try {
    // ---------------- ATLET
    console.log('ATLET (390)')
    const actx = await browser.newContext({ viewport: { width: W, height: H } })
    const a = await nye(actx, 'atlet')
    await logind(a, ATHLETE_USER)
    await a.getByText('Dagens pas', { exact: true }).waitFor({ state: 'visible', timeout: 15000 })
    await tjek(a, 'atlet-01-hjem-dagens-pas')
    await a.getByRole('button', { name: 'Godkendt', exact: true }).click() // log saet 1 (planens tal)
    const aaben = a.getByTestId('rest-pause-open')
    await aaben.waitFor({ state: 'visible', timeout: 5000 })
    await a.waitForFunction(async (url) => (await (await fetch(`${url}/__e2e/table?name=exercise_logs`)).json()).some(r => r.set_number === 1 && !r.skipped && r.weight === 80), `http://127.0.0.1:${MOCK_PORT}`, { timeout: 10000 })
    await tjek(a, 'atlet-02-saet-logget-pause')
    await aaben.click()
    await a.getByTestId('rest-pause-popup').waitFor({ state: 'visible', timeout: 3000 })
    await tjek(a, 'atlet-03-timer-popup')
    await a.getByTestId('rest-pause-close').click()
    await a.getByTestId('rest-pause-popup').waitFor({ state: 'detached', timeout: 3000 })
    // bundnavigationen ligger nederst i viewporten, ikke oven paa indhold
    const nav = await a.evaluate(() => {
      const n = [...document.querySelectorAll('nav,[role=navigation]')].find(e => getComputedStyle(e).position === 'fixed')
      if (!n) return null
      const r = n.getBoundingClientRect(); return { bund: Math.round(r.bottom), hoejde: innerHeight }
    })
    if (nav) assert.ok(nav.bund >= nav.hoejde - 2, `bundnavigation staar ikke nederst: ${JSON.stringify(nav)}`)
    console.log('  bundnavigation:', nav ? JSON.stringify(nav) : 'ingen fixed nav fundet')
    await a.getByRole('button', { name: 'Program', exact: true }).first().click()
    await a.waitForTimeout(1200); await tjek(a, 'atlet-04-program')
    await a.getByRole('button', { name: 'Fremgang', exact: true }).first().click()
    await a.getByText('Bliver du stærkere?', { exact: true }).waitFor({ state: 'visible', timeout: 10000 })
    await a.locator('[data-fremgang-linje]').first().waitFor({ state: 'visible', timeout: 8000 })
    await tjek(a, 'atlet-05-fremgang')
    await a.getByRole('button', { name: 'Bænkpres', exact: true }).first().click(); await a.waitForTimeout(500)
    await tjek(a, 'atlet-06-fremgang-baenk')
    await a.getByText(/Rekord/i).first().scrollIntoViewIfNeeded().catch(() => {})
    const rek = await a.evaluate(() => document.body.innerText)
    assert.ok(/Rekord/i.test(rek), 'rekorder skal kunne ses paa Fremgang')
    assert.ok(!/backoff/i.test(rek.split(/Rekord/i)[1] || ''), 'backoff i rekorder')
    await tjek(a, 'atlet-07-rekorder')
    await actx.close()

    // ---------------- COACH
    console.log('COACH (390)')
    const cctx = await browser.newContext({ viewport: { width: W, height: H } })
    const c = await nye(cctx, 'coach')
    await logind(c, COACH_USER)
    const raekke = c.getByRole('button', { name: /Testatlet.*Uge/ }).first()
    await raekke.waitFor({ state: 'visible', timeout: 15000 })
    await tjek(c, 'coach-01-oversigt')
    await raekke.click(); await c.waitForSelector('[data-styrke-linje]', { timeout: 8000 })
    await tjek(c, 'coach-02-atlet-hjem-styrkelinje')
    const tab = async (label) => {
      const k = c.getByRole('button', { name: new RegExp(`${label}$`) }).first()
      if (!(await k.isVisible().catch(() => false))) { await c.getByRole('button', { name: /Hjem$/ }).first().locator('xpath=..').locator('button').last().click({ timeout: 5000 }); await c.waitForTimeout(300) }
      await c.getByRole('button', { name: new RegExp(`${label}$`) }).first().click(); await c.waitForTimeout(1200)
    }
    await tab('Log'); await c.locator('select').first().selectOption('Bænkpres').catch(() => {}); await tjek(c, 'coach-03-fremgang-log')
    await tab('Stævne'); await tjek(c, 'coach-04-rekorder')
    await tab('Analyse'); await c.getByText(/Gennemgå måling/).first().waitFor({ state: 'visible', timeout: 10000 }); await tjek(c, 'coach-05-analyse')
    await c.getByRole('button', { name: 'Gennemgå måling' }).first().click()
    await c.getByRole('dialog').waitFor({ state: 'visible', timeout: 10000 })
    await c.getByLabel('Det fungerer').fill('Stangbanen er lodret.'); await c.getByLabel('Atletens fokus').fill('Brystet frem i bunden.'); await c.getByLabel('Næste gang').fill('Spænd overkroppen.')
    await tjek(c, 'coach-06-review-videoanalyse')
    await c.getByRole('button', { name: 'Gem feedback' }).click()
    await c.getByText('Feedback gemt ✓').waitFor({ state: 'visible', timeout: 10000 })
    await tjek(c, 'coach-07-feedback-gemt')
    await cctx.close()

    assert.deepEqual(fejl, [], 'browserfejl:\n' + fejl.join('\n'))
    console.log('\nGRØN: hele atlet- og coach-flowet paa 390 uden browserfejl eller overflow.')
  } catch (err) { console.error('\nFEJL:', err.message); process.exitCode = 1 }
  finally { await browser.close(); await mock.close(); await vite.stop() }
}
main()
