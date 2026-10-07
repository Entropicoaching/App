// ORDRE 1545: coachens soendags-gennemgang paa 1280 mod e2e-mocken, 5 syntetiske atleter.
//   node outputs/1545/gennemgang.mjs <udmappe> [--no-build]
// Gemmer billeder og tekstudtraek (hvad Marc ser) i udmappen. Ingen prod, ingen atletdata.
import path from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import { ROOT, MOCK_PORT, startStaticServer, byg, hentChromium, bygCoachSeed, signalerFraSeed, ATLETER } from '../428/coach-faelles.mjs'

const UD = path.resolve(process.argv[2] || path.join(ROOT, 'outputs', '_seneste', '1545'))
mkdirSync(UD, { recursive: true })
if (!process.argv.includes('--no-build')) byg()
ATLETER.length = 5 // Alfa..Echo
const { createMockSupabase } = await import('../../e2e/mock-supabase.mjs')
const fx = await import('../../e2e/fixtures.mjs')
const { seed } = bygCoachSeed(fx.buildSeed, fx)
// Historik (uge -10..-2): 5 reps tunge saet pr. loeft, saa Fremgang har en tendens at vise.
// Alfa stiger, Bravo stiger, Charlie staar stille, Delta stiger og falder, Echo stiger kraftigt.
const T = seed.tables
const FORLOEB = { Alfa: [92, 1.4], Bravo: [90, 1.2], Charlie: [100, 0], Delta: [100, -0.8], Echo: [85, 2] }
let hid = 1
const hu = (p) => `${p}-1545-4000-8000-${String(hid++).padStart(12, '0')}`
for (const a of T.athletes) {
  const [start, step] = FORLOEB[a.name.split(' ')[0]]
  for (let u = -10; u <= -2; u++) {
    const mandag = new Date(); mandag.setDate(mandag.getDate() - ((mandag.getDay() + 6) % 7) + u * 7); mandag.setHours(12, 0, 0, 0)
    const wid = hu('c1545000'), sid = hu('d1545000')
    T.weeks.push({ id: wid, athlete_id: a.id, week_number: u + 5, block_name: 'Opbygning', start_date: mandag.toISOString().slice(0, 10) })
    T.sessions.push({ id: sid, week_id: wid, title: 'Dag 1 — Squat', session_order: 1, weekday: 0, athlete_rating: 4, athlete_comment: null })
    for (const [navn, faktor] of [['Squat', 1], ['Bænkpres', 0.7]]) {
      const eid = hu('e1545000')
      const kg = Math.round((start + step * (u + 10)) * faktor * 2) / 2
      T.exercises.push({ id: eid, session_id: sid, name: navn, sets: 3, reps: '5', intensity: 'RPE 8', note: null, exercise_order: 1, recommended_weight: kg })
      for (let s = 1; s <= 3; s++) T.exercise_logs.push({ id: hu('f1545000'), exercise_id: eid, athlete_id: a.id, set_number: s, weight: kg, reps_completed: 5, note: null, rpe_actual: 8, rpe_planned: 8, skipped: false, logged_at: mandag.toISOString() })
    }
  }
}
const mock = createMockSupabase(seed)
await mock.listen(MOCK_PORT)
const { server, port } = await startStaticServer()
const browser = await hentChromium().launch({ headless: true })
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage()
const fejl = []
page.on('pageerror', e => fejl.push(String(e)))
page.on('console', m => { if (m.type() === 'error') fejl.push(m.text().slice(0, 200)) })
const signaler = await signalerFraSeed(seed)
await page.route('**/rest/v1/rpc/entropi_training_signals_v1', r => r.fulfill({ json: signaler }))
await page.goto(`http://127.0.0.1:${port}/`)
await page.locator('#athlete-auth-email').fill(fx.COACH_USER.email)
await page.locator('#athlete-auth-password').fill(fx.COACH_USER.password)
await page.getByRole('button', { name: 'Log ind' }).click()
await page.getByText('Alfa Testsen').first().waitFor({ timeout: 30000 })
await page.waitForTimeout(1500)
const txt = []
const trin = async (navn) => {
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(UD, `${navn}.png`), fullPage: true })
  txt.push(`\n===== ${navn} =====\n` + await page.evaluate(() => document.body.innerText))
}
await trin('01-forside')
await page.getByText('Kræver dit blik').first().click()
await trin('02-indbakke')
await page.goto(`http://127.0.0.1:${port}/`)
await page.getByText('Alfa Testsen').first().waitFor({ timeout: 30000 })
await page.waitForTimeout(1200)
for (const n of ['Alfa', 'Charlie', 'Delta', 'Echo']) {
  await page.locator('[role="button"]', { hasText: n + ' Testsen' }).first().click()
  await page.getByText('Tilbage til atleter', { exact: false }).first().waitFor()
  await trin('03-' + n.toLowerCase())
  await page.getByText('Tilbage til atleter', { exact: false }).first().click()
  await page.getByText('Echo Testsen').first().waitFor()
}
await page.getByRole('button', { name: /Bravo Testsen/ }).first().click()
await trin('03-bravo-program')
const faner = await page.evaluate(() => [...document.querySelectorAll('button')].map(b => b.innerText.trim()).filter(Boolean))
txt.push('\nKNAPPER: ' + JSON.stringify(faner))
for (const f of ["HJEM","PROGRAM"]) {
  await page.locator('button', { hasText: f }).first().click().catch(e => txt.push('KLIK FEJL ' + f))
  await trin('04-' + f.replace(/\W+/g, '_'))
}
await page.getByRole('button', { name: /^.{0,3}Hjem/i }).first().click({ timeout: 5000 })
await page.getByText('Grafer & belastning').first().click({ timeout: 3000 })
await trin('05-analyse')
txt.push('\nKONSOLFEJL: ' + JSON.stringify(fejl))
writeFileSync(path.join(UD, 'tekst.txt'), txt.join('\n'))
await browser.close(); server.close(); await mock.close()
console.log('ok', UD)
