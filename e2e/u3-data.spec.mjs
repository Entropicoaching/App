// U3 data i fire perspektiver: headless på 390 px og 1280 px mod den ægte app og
// mock-backenden (port 8991). Kun syntetiske data og navne som "Atlet B".
// Viser, at ugekort, blok for blok, nye grunde og "Holdet samlet" vises med nok
// data og skjules med for lidt. Kør: node e2e/u3-data.spec.mjs [billedmappe]
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { createMockSupabase } from './mock-supabase.mjs'
import { buildSeed, ATHLETE_USER, COACH_USER, ATHLETE_ID, WEEK_ID } from './fixtures.mjs'
import { startVite, launchBrowser, chromium, APP_URL, MOCK_PORT, OUT_DIR } from './harness.mjs'

const VIEWPORTS = [{ name: '390', width: 390, height: 844 }, { name: '1280', width: 1280, height: 900 }]
const pad = n => String(n).padStart(2, '0')
const uuid = (prefix, n) => `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`

function danishToday() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date()).map(x => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}`
}
const addDays = (day, n) => { const d = new Date(`${day}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const mondayOf = day => addDays(day, -((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7))

// Nok data: Testatlet med 8 afsluttede programuger i to blokke, kost, vægt og
// readiness i 35 dage, plus fem syntetiske atleter, så gruppen har mindst 5.
export function richSeed() {
  const data = buildSeed()
  const t = data.tables
  const today = danishToday(), monday = mondayOf(today)
  Object.assign(t.athletes[0], { goal: 'cut', kcal_target: 3000, protein_target: 160 })
  for (const name of ['weight_logs', 'meal_logs']) t[name] = t[name] ?? []
  let n = 0
  function program(athleteId, { weeks = 8, current = null, squatStart = 140 } = {}) {
    for (let w = 0; w < weeks; w++) {
      const start = addDays(monday, -7 * (weeks - w)), weekId = uuid('c1000000', ++n)
      const sessionId = uuid('c2000000', n), squatId = uuid('c3000000', n), benchId = uuid('c4000000', n)
      t.weeks.push({ id: weekId, athlete_id: athleteId, week_number: w + 1, block_name: w < 4 ? 'Styrke 2' : 'Styrke 3', start_date: start })
      t.sessions.push({ id: sessionId, week_id: weekId, title: 'Dag 1', session_order: 1, weekday: 1, athlete_rating: null, athlete_comment: null })
      t.exercises.push({ id: squatId, session_id: sessionId, name: 'Squat', sets: 2, reps: '3', exercise_order: 1, recommended_weight: 140 },
        { id: benchId, session_id: sessionId, name: 'Bænkpres', sets: 1, reps: '5', exercise_order: 2, recommended_weight: 90 })
      const day = addDays(start, 1)
      for (const set of [1, 2]) t.exercise_logs.push({ id: uuid('c5000000', n * 10 + set), athlete_id: athleteId, exercise_id: squatId, set_number: set,
        weight: squatStart + w * 2.5, reps_completed: 3, skipped: false, note: null, rpe_actual: 8, logged_at: `${day}T16:0${set}:00Z` })
      t.exercise_logs.push({ id: uuid('c5000000', n * 10 + 3), athlete_id: athleteId, exercise_id: benchId, set_number: 1,
        weight: 95, reps_completed: 5, skipped: false, note: null, rpe_actual: 8, logged_at: `${day}T16:10:00Z` })
    }
    if (current) {
      t.weeks.find(w => w.id === current).week_number = weeks + 1
      t.weeks.find(w => w.id === current).block_name = 'Styrke 3'
    }
  }
  program(ATHLETE_ID, { current: WEEK_ID })
  for (let i = 1; i <= 35; i++) {
    const day = addDays(today, -i)
    t.readiness_logs.push({ id: uuid('c6000000', i), athlete_id: ATHLETE_ID, logged_date: day, readiness_score: ((i + 1) % 3 ? 76 : 66) + (i % 2), soreness_level: 2,
      sleep_hours: 8, energy: 4, motivation: 4, stress: 2, sore_zones: null })
    t.meal_logs.push({ id: uuid('c7000000', i), athlete_id: ATHLETE_ID, date: day, meal: 'Syntetisk dag', kcal: 2900, protein: i % 3 ? 165 : 140, carb: 320, fat: 90, created_at: `${day}T18:00:00Z` })
    t.weight_logs.push({ id: uuid('c8000000', i), athlete_id: ATHLETE_ID, logged_at: day, weight: Math.round((82 + i * 0.03) * 10) / 10, created_at: `${day}T07:00:00Z` })
  }
  // Fem syntetiske atleter uden login. Atlet B nævner smerte i en note.
  for (const [i, name] of ['Atlet B', 'Atlet C', 'Atlet D', 'Atlet E', 'Atlet F'].entries()) {
    const id = uuid('c9000000', i + 1)
    t.athletes.push({ id, user_id: null, name, email: null, status: 'active', hidden: false, snooze_until: null, competition_date: null,
      onboarding_completed_at: new Date().toISOString(), kcal_target: 2600, protein_target: 150 })
    program(id, { weeks: 5, squatStart: i < 2 ? 150 : 120 })
    if (i < 2) for (const log of t.exercise_logs.filter(l => l.athlete_id === id)) log.weight = 150
    for (let d = 1; d <= 5; d++) t.meal_logs.push({ id: uuid('ca000000', i * 10 + d), athlete_id: id, date: addDays(today, -d), meal: 'Syntetisk dag',
      kcal: 2400, protein: i < 3 ? 150 : 110, carb: 280, fat: 80, created_at: `${addDays(today, -d)}T18:00:00Z` })
    if (i === 0) t.exercise_logs.push({ id: uuid('cb000000', 1), athlete_id: id, exercise_id: t.exercise_logs.find(l => l.athlete_id === id).exercise_id,
      set_number: 3, weight: 100, reps_completed: 5, skipped: false, rpe_actual: 7, note: 'Syntetisk: ondt i knæet på sidste sæt', logged_at: `${addDays(today, -2)}T17:00:00Z` })
  }
  return data
}

async function login(page, user) {
  await page.goto(APP_URL)
  await page.locator('#athlete-auth-email').fill(user.email)
  await page.locator('#athlete-auth-password').fill(user.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
}

async function noSideScroll(page, width) {
  const scroll = await page.evaluate(() => document.documentElement.scrollWidth)
  if (scroll > width + 1) throw new Error(`Vandret scroll på ${width} px: ${scroll}px`)
}

async function athleteRich(page, vp, outDir) {
  const shot = name => page.screenshot({ path: join(outDir, `u3-atlet-${vp.name}-${name}.png`), fullPage: true })
  await login(page, ATHLETE_USER)
  await page.getByRole('button', { name: 'Fremgang', exact: true }).first().click({ timeout: 20000 })
  const card = page.locator('[data-u3-week-card]')
  await card.waitFor({ state: 'visible', timeout: 20000 })
  const lines = await page.locator('[data-u3-line]').evaluateAll(els => els.map(e => e.dataset.u3Line))
  for (const key of ['training', 'nutrition', 'weight', 'readiness']) if (!lines.includes(key)) throw new Error(`Ugekortet mangler ${key}: ${lines}`)
  await page.locator('[data-u3-strength]').waitFor({ state: 'visible' })
  const coupling = await page.locator('[data-u3-coupling]').textContent()
  if (!/sammenhæng, ikke et bevis/.test(coupling) || /fordi/.test(coupling)) throw new Error('Koblingssætningen mangler: ' + coupling)
  await noSideScroll(page, vp.width)
  await card.screenshot({ path: join(outDir, `u3-atlet-${vp.name}-01-min-uge-kort.png`) })
  await shot('01-min-uge')
  const fold = page.locator('[data-u3-blocks-fold="athlete"]')
  await fold.locator('summary').click()
  await page.locator('[data-u3-blocks] table').waitFor({ state: 'visible', timeout: 20000 })
  const headers = await page.locator('[data-u3-blocks] thead th').allTextContents()
  if (!headers.includes('Nu') || !headers.includes('Styrke 2')) throw new Error(`Blok for blok mangler blokke: ${headers}`)
  await noSideScroll(page, vp.width)
  await fold.screenshot({ path: join(outDir, `u3-atlet-${vp.name}-02-blok-for-blok.png`) })
  return { lines, headers, coupling }
}

async function coachRich(page, vp, outDir) {
  const shot = name => page.screenshot({ path: join(outDir, `u3-coach-${vp.name}-${name}.png`), fullPage: true })
  await login(page, COACH_USER)
  const pain = page.getByText('Smerte nævnt', { exact: false }).first()
  await pain.waitFor({ state: 'visible', timeout: 30000 })
  const html = await page.content()
  if (/ondt i knæet/.test(html)) throw new Error('Notens tekst står i DOM')
  await noSideScroll(page, vp.width)
  await page.locator('section[aria-label="Atleter der kræver handling"]').screenshot({ path: join(outDir, `u3-coach-${vp.name}-01-kraever-dit-blik.png`) })
  const team = page.locator('[data-coach-fold="holdet-samlet"]')
  await team.locator('summary').click()
  await team.getByText('logger kost', { exact: false }).waitFor({ state: 'visible', timeout: 20000 })
  const teamText = await team.textContent()
  if (/Atlet [B-F]|Testatlet/.test(teamText)) throw new Error('Navn i "Holdet samlet"')
  await team.screenshot({ path: join(outDir, `u3-coach-${vp.name}-02-holdet-samlet.png`) })
  await page.locator('[data-coach-fold="atleter"] > summary').click()
  const ws = page.locator(`[data-coach-athlete-workspace="${ATHLETE_ID}"]`)
  await ws.waitFor({ state: 'visible' })
  await ws.locator('[data-u3-blocks-fold] > summary').click()
  await ws.locator('[data-u3-blocks] table').waitFor({ state: 'visible', timeout: 20000 })
  await ws.locator('[data-u3-week-by-week-fold] > summary').click()
  await ws.locator('[data-u3-week-by-week] table').waitFor({ state: 'visible', timeout: 20000 })
  const k3 = await ws.locator('[data-u3-week-by-week]').textContent()
  if (!/mod nuværende mål/.test(k3) || /[↑↓]/.test(k3)) throw new Error('Uge for uge: forkert tekst')
  await noSideScroll(page, vp.width)
  await ws.screenshot({ path: join(outDir, `u3-coach-${vp.name}-03-arbejdsrum.png`) })
  await shot('04-hele-forsiden')
  return { teamText: teamText.slice(0, 200) }
}

async function athleteThin(page, vp, outDir) {
  await login(page, ATHLETE_USER)
  await page.getByRole('button', { name: 'Fremgang', exact: true }).first().click({ timeout: 20000 })
  await page.locator('[data-entropi2-analysis]').waitFor({ state: 'visible', timeout: 20000 })
  await page.waitForTimeout(2500)
  if (await page.locator('[data-u3-week-card]').count()) throw new Error('Ugekortet vises uden nok data')
  if (await page.locator('[data-u3-line]').count()) throw new Error('En linje under minimum vises')
  await page.screenshot({ path: join(outDir, `u3-atlet-${vp.name}-09-for-lidt-data.png`), fullPage: true })
  return { card: 0 }
}

async function coachThin(page, vp, outDir) {
  await login(page, COACH_USER)
  await page.getByText('Kræver dit blik').first().waitFor({ state: 'visible', timeout: 30000 })
  await page.waitForTimeout(2500)
  for (const text of ['Smerte nævnt', 'Readiness falder', 'Check-in stoppet']) {
    if (await page.getByText(text, { exact: false }).count()) throw new Error(`"${text}" vises uden data`)
  }
  const team = page.locator('[data-coach-fold="holdet-samlet"]')
  await team.locator('summary').click()
  await team.getByText('For få atleter', { exact: false }).waitFor({ state: 'visible', timeout: 20000 })
  if (/logger kost|rammer protein/.test(await team.textContent())) throw new Error('Gruppetal med under 5 atleter')
  await page.screenshot({ path: join(outDir, `u3-coach-${vp.name}-09-for-lidt-data.png`), fullPage: true })
  return { team: 'skjult' }
}

async function main() {
  const outDir = process.argv[2] || OUT_DIR
  mkdirSync(outDir, { recursive: true })
  const vite = await startVite()
  const browser = await launchBrowser().catch(() => chromium.launch({ headless: true, channel: 'msedge' }))
  const results = []
  try {
    for (const [label, seed, runs] of [['nok data', richSeed, [athleteRich, coachRich]], ['for lidt data', () => buildSeed(), [athleteThin, coachThin]]]) {
      for (const vp of VIEWPORTS) {
        for (const run of runs) {
          const mock = createMockSupabase(seed())
          await mock.listen(MOCK_PORT)
          const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } })
          const errors = []
          page.on('pageerror', err => errors.push(err.message))
          try {
            const result = await run(page, vp, outDir)
            if (errors.length) throw new Error(`browserfejl: ${errors.join('; ')}`)
            console.log(`GRØN: ${label}, ${run.name} på ${vp.width} px`, JSON.stringify(result))
            results.push([label, run.name, vp.width])
          } finally { await page.close(); await mock.close?.() }
        }
      }
    }
  } finally {
    await browser.close(); await vite.stop()
  }
  console.log(`U3 e2e: ${results.length} af 8 grønne`)
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) main().catch(err => { console.error(err); process.exitCode = 1 })
export { pad }
