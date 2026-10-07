// ORDRE 1545 · coachens soendags-gennemgang paa 1280 med 5 syntetiske atleter.
// Beviser de fem rettelser fra fase A og set-note-smerten (fase B, D3/3A):
//   1. Coach Briefing viser alle aabne opgaver uden klik (ikke kun den foerste).
//   2. Forsiden viser aldrig "-Nd siden".
//   3. Fremgangslinjen paa profilen har tal pr. hovedloeft naar alt stiger.
//   4. Smerte staar ikke to gange (Aktuel opgave + fremgangslinjen) over atletens navn.
//   5. Hjem siger "2 af 4", ligesom forsiden.
//   6. Smerte skrevet kun paa et saet (ingen pas-kommentar) standser stigning i linjen.
// Syntetiske data (outputs/428/coach-faelles.mjs). Ingen prod, ingen atletdata.
//
// Kørsel: node e2e/soendag-1545.spec.mjs (npm run e2e:soendag-1545)
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { createMockSupabase } from './mock-supabase.mjs'
import { buildSeed, COACH_USER } from './fixtures.mjs'
import { startVite, launchBrowser, APP_URL, MOCK_PORT, OUT_DIR } from './harness.mjs'
import { bygCoachSeed, signalerFraSeed, ATLETER } from '../outputs/428/coach-faelles.mjs'

// Historik (uge -10..-2): 5 reps tunge saet pr. loeft, saa Fremgang har en tendens.
const FORLOEB = { Alfa: [92, 1.4], Bravo: [90, 1.2], Charlie: [100, 0], Delta: [100, -0.8], Echo: [85, 2] }

export function bygSoendagSeed() {
  ATLETER.length = 5 // Alfa..Echo
  const { seed } = bygCoachSeed(buildSeed, { COACH_USER })
  const T = seed.tables
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
  // Echo skriver smerte kun paa et saet (ingen pas-kommentar).
  const echo = T.athletes.find(a => a.name.startsWith('Echo'))
  const iDag = new Date().toISOString().slice(0, 10)
  const saet = T.exercise_logs.filter(l => l.athlete_id === echo.id && l.logged_at.slice(0, 10) <= iDag && !l.skipped).sort((x, y) => y.logged_at.localeCompare(x.logged_at))[0]
  saet.note = 'Skarp smerte i venstre skulder'
  return { seed }
}

export async function runSoendag(page, { appUrl, outDir, seed }) {
  const shot = (name) => page.screenshot({ path: join(outDir, `soendag-1545-${name}.png`), fullPage: true })
  const signaler = await signalerFraSeed(seed)
  await page.route('**/rest/v1/rpc/entropi_training_signals_v1', r => r.fulfill({ json: signaler }))
  await page.goto(appUrl)
  await page.locator('#athlete-auth-email').fill(COACH_USER.email)
  await page.locator('#athlete-auth-password').fill(COACH_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  await page.getByText('Alfa Testsen').first().waitFor({ timeout: 30000 })
  await page.getByText(/åbne ting/).first().waitFor({ timeout: 15000 })
  await page.waitForTimeout(1200)

  // 2. aldrig negative dage paa forsiden
  const forside = await page.evaluate(() => document.body.innerText)
  assert.ok(!/-\d+d siden/.test(forside), 'forsiden maa ikke vise "-Nd siden"')
  await shot('01-forside')

  // 1. briefing: alle aabne opgaver synlige uden klik
  const antal = Number((await page.getByText(/åbne ting/).first().innerText()).match(/(\d+) åbne/)[1])
  await page.getByText('Kræver dit blik').first().click()
  await page.getByText('Næste opgave').first().waitFor({ timeout: 10000 })
  assert.ok(antal >= 3 && antal <= 6, `forventede 3-6 aabne opgaver, fik ${antal}`)
  await page.getByText(/øvrige opgave/).first().waitFor({ state: 'visible' })
  const oevrige = await page.locator('details[open] > div > div').count()
  assert.equal(oevrige, antal - 1, `de ${antal - 1} oevrige opgaver skal vaere foldet ud uden klik (fandt ${oevrige} raekker)`)
  await shot('02-briefing')

  // 4. smerte ikke dobbelt: aabn Bravo fra koeen
  await page.locator('button', { hasText: /melder ondt i knæet/ }).first().click()
  await page.getByText('Aktuel opgave').first().waitFor({ timeout: 10000 })
  const bravo = await page.evaluate(() => document.body.innerText)
  assert.equal((bravo.match(/nævnt i pas-kommentar/g) || []).length, 0, 'smerte-kilden maa ikke staa oven i Aktuel opgave')
  assert.equal((bravo.match(/Ingen stigning, før du har talt med atleten/g) || []).length, 1, 'reglen staar praecis een gang')
  assert.equal((bravo.match(/melder ondt i knæet/g) || []).length, 1, 'smerte-overskriften staar een gang')
  // 5. Hjem: "2 af 4"
  await page.getByRole('button', { name: /^.{0,3}Hjem/i }).first().click()
  await page.getByText('Træninger denne uge').first().waitFor({ timeout: 10000 })
  assert.match(await page.evaluate(() => document.body.innerText), /Træninger denne uge\s*\n\s*2 af 4/i, 'Hjem skal sige "2 af 4"')
  await shot('03-bravo-hjem')
  await page.goto(appUrl)
  await page.getByText('Echo Testsen').first().waitFor({ timeout: 30000 })
  await page.waitForTimeout(800)

  // 3. fremgangslinje med tal (Alfa stiger)
  await page.locator('[role="button"]', { hasText: 'Alfa Testsen' }).first().click()
  await page.getByText('Hvad gør atleten stærkere nu', { exact: false }).first().waitFor({ timeout: 10000 })
  const alfa = await page.evaluate(() => document.body.innerText)
  assert.match(alfa, /Alle hovedløft stiger eller holder \(e1RM mod 1-3 mdr\. før: Squat [+-]?\d+(,\d)? %, Bænkpres [+-]?\d+(,\d)? %\)/, 'Alfas linje skal have tal pr. hovedloeft')
  await shot('04-alfa-fremgang')
  await page.goto(appUrl)
  await page.getByText('Echo Testsen').first().waitFor({ timeout: 30000 })
  await page.waitForTimeout(800)

  // 6. Echo: smerte kun paa et saet
  await page.locator('[role="button"]', { hasText: 'Echo Testsen' }).first().click()
  await page.getByText('Hvad gør atleten stærkere nu', { exact: false }).first().waitFor({ timeout: 10000 })
  const echo = await page.evaluate(() => document.body.innerText)
  assert.match(echo, /Smerte: skulderen nævnt i sæt-note \d+\. \w+( \([^)]+\))?\. Ingen stigning, før du har talt med atleten/, 'Echos linje skal stoppe stigning paa saet-noten')
  assert.ok(!echo.includes('Skarp smerte'), 'noten maa ikke citeres')
  await shot('05-echo-saetnote')

  console.log('\nGRØN: søndags-gennemgang — briefing viser alle, ingen -Nd, Hjem 2 af 4, ingen dobbelt smerte, tal i fremgang, sæt-note-smerte standser stigning.')
}

async function main() {
  const { seed } = bygSoendagSeed()
  const mock = createMockSupabase(seed)
  await mock.listen(MOCK_PORT)
  const vite = await startVite()
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    const fejl = []
    page.on('pageerror', err => fejl.push(`pageerror: ${err.message}`))
    page.on('console', msg => { if (msg.type() === 'error') fejl.push(`console.error: ${msg.text()}`) })
    await runSoendag(page, { appUrl: APP_URL, outDir: OUT_DIR, seed })
    assert.deepEqual(fejl, [], `Ingen browser-fejl forventet, fandt: ${JSON.stringify(fejl)}`)
    process.exitCode = 0
  } catch (err) {
    console.error('\nFEJL:', err.message)
    process.exitCode = 1
  } finally {
    await browser.close().catch(() => {})
    await vite.stop().catch(() => {})
    await mock.close().catch(() => {})
  }
}

if (process.argv[1] && process.argv[1].endsWith('soendag-1545.spec.mjs')) main()
