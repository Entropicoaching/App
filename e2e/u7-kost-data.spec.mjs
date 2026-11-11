// U7 "Kost som data": headless mod den ægte app og mock-backenden (port 8991). Kun syntetiske data.
// Køres to gange: uden tabellerne (som før migrationen) og med en lokal simuleret backend med dem.
//   E2E_HIDE_TABLES=tracking_daily_v1,nutrition_targets_v1,kostplan_v1_plans,kostplan_v1_versions,kostplan_v1_approvals \
//     node e2e/u7-kost-data.spec.mjs uden [billedmappe] [resultat.json]
//   node e2e/u7-kost-data.spec.mjs med [billedmappe] [resultat.json]
// Uden tabellerne skal appen vise det samme som U6; spec'en gemmer også tekstudtræk til sammenligning.
import { join } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createMockSupabase } from './mock-supabase.mjs'
import { ATHLETE_USER, COACH_USER, ATHLETE_ID } from './fixtures.mjs'
import { startVite, launchBrowser, chromium, APP_URL, MOCK_PORT, OUT_DIR } from './harness.mjs'
import { u6Seed } from './u6-data.spec.mjs'

const VIEWPORTS = [{ name: '390', width: 390, height: 844 }, { name: '1280', width: 1280, height: 900 }]
const TABLES = ['tracking_daily_v1', 'nutrition_targets_v1', 'kostplan_v1_plans', 'kostplan_v1_versions', 'kostplan_v1_approvals']

function danishToday() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date()).map(x => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}`
}
const addDays = (day, n) => { const d = new Date(`${day}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const mondayOf = day => addDays(day, -((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7))
const uuid = (prefix, n) => `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`

// Oven på U6's seed. Sidste squat-pas fik et backoff med samme navn efter topsættet (85 kg),
// så "(+2,5)" kun er rigtigt, når forskellen regnes mod topsættet.
export function u7Seed(withTables) {
  const data = u6Seed()
  const t = data.tables, today = danishToday(), monday = mondayOf(today)
  Object.assign(t.athletes[0], { kcal_target: 2800, protein_target: 180 })
  t.exercise_logs.push({ id: uuid('e7000000', 1), athlete_id: ATHLETE_ID, exercise_id: 'd3000000-0000-4000-8000-000000000001',
    set_number: 2, weight: 75, reps_completed: 6, skipped: false, note: null, rpe_actual: 7, logged_at: `${addDays(today, -7)}T16:20:00Z` })
  for (const [i, [day, kcal, protein]] of [[addDays(monday, -7), 2600, 150], [addDays(monday, -6), 2900, 165], [addDays(monday, -5), 2700, 160]].entries())
    t.meal_logs.push({ id: uuid('e7100000', i + 1), athlete_id: ATHLETE_ID, date: day, meal: 'Syntetisk dag', kcal, protein, carb: 300, fat: 80, created_at: `${day}T12:00:00Z` })
  if (withTables) {
    t.tracking_daily_v1 = [
      { athlete_id: ATHLETE_ID, logged_date: addDays(today, -2), sleep_quality: 1, pain: 2, pain_location: null },
      { athlete_id: ATHLETE_ID, logged_date: addDays(today, -1), sleep_quality: 2, pain: 6, pain_location: 'venstre knæ' },
      { athlete_id: ATHLETE_ID, logged_date: today, water_ml: 750 },
    ]
    // Målet, der gjaldt sidste uge: 170 g protein. Coachens nuværende 180 g dateres af appen i dag.
    t.nutrition_targets_v1 = [
      { id: uuid('e7200000', 1), athlete_id: ATHLETE_ID, effective_from: addDays(monday, -7), kcal: 2800, protein_g: 170, water_ml: null, set_by: COACH_USER.id, created_at: `${addDays(monday, -7)}T08:00:00Z` },
      { id: uuid('e7200000', 2), athlete_id: ATHLETE_ID, effective_from: addDays(monday, -7), kcal: null, protein_g: null, water_ml: 3000, set_by: ATHLETE_USER.id, created_at: `${addDays(monday, -7)}T09:00:00Z` },
    ]
  }
  return data
}

// Telefonens gamle data fra før migrationen: vand og "færdig for i dag" i går.
async function login(page, user, phone = false) {
  await page.addInitScript(({ id, yesterday, phone }) => {
    try {
      localStorage.setItem('entropi2:onboarding:v1', '1'); localStorage.setItem(`entropi2:onboarding:v1:athlete:${encodeURIComponent(id)}`, '1')
      const key = `entropi2:water-intake:v1:${encodeURIComponent(id)}:${yesterday}`
      if (phone && !localStorage.getItem(key)) {
        localStorage.setItem(key, JSON.stringify({ schema: 'entropi2-water-day/v1', athleteId: id, date: yesterday,
          entries: [{ id: 1, ml: 1000, at: `${yesterday}T08:00:00.000Z` }, { id: 2, ml: 500, at: `${yesterday}T12:00:00.000Z` }] }))
        localStorage.setItem(`entropi2:kostvane-faerdig:v1:${encodeURIComponent(id)}:${yesterday}`, '1')
      }
    } catch { /* syntetisk */ }
  }, { id: ATHLETE_ID, yesterday: addDays(danishToday(), -1), phone })
  await page.goto(APP_URL)
  await page.locator('#athlete-auth-email').fill(user.email)
  await page.locator('#athlete-auth-password').fill(user.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
}

async function noSideScroll(page, width) {
  const scroll = await page.evaluate(() => document.documentElement.scrollWidth)
  if (scroll > width + 1) throw new Error(`Vandret scroll på ${width} px: ${scroll}px`)
}

async function edges(page, width, selector) {
  const out = await page.evaluate(({ selector, width }) => [...document.querySelectorAll(selector)].filter(el => {
    const b = el.getBoundingClientRect(); return b.width && (b.right > width + 1 || b.left < -1)
  }).map(el => el.tagName), { selector, width })
  if (out.length) throw new Error(`${out.length} elementer går ud over kanten på ${width} px: ${out.join(', ')}`)
}

const waitFor = async (check, ms = 15000) => {
  const start = Date.now()
  while (Date.now() - start < ms) { if (await check()) return true; await new Promise(r => setTimeout(r, 150)) }
  return false
}

async function athlete(page, vp, outDir, mode, mock) {
  await login(page, ATHLETE_USER, true)
  await page.locator('[data-entropi2-home]').waitFor({ state: 'visible', timeout: 30000 })
  await page.locator('[data-u5-meal]').waitFor({ state: 'visible', timeout: 20000 })
  await page.waitForTimeout(1500)
  await page.evaluate(() => window.scrollTo(0, 0))
  await noSideScroll(page, vp.width)
  const card = await page.locator('[data-u5-today]').textContent()
  if (mode !== 'foer' && !/Squat 87,5 kg \(\+2,5\)/.test(card)) throw new Error('"(+2,5)" er ikke regnet mod topsættet: ' + card)
  const feeling = page.locator('[data-u7-day-feeling]')
  const result = { mode, plan: card.match(/Squat [\d,]+ kg \([^)]*\)/)?.[0] }
  await page.screenshot({ path: join(outDir, `u7-${mode}-atlet-${vp.name}-1-forside.png`) })
  if (mode !== 'med') {
    if (await feeling.count()) throw new Error('Søvn og smerte vises uden tabellen')
    result.homeText = (await page.locator('[data-entropi2-home]').textContent()).replace(/\s+/g, ' ')
  } else {
    await feeling.waitFor({ state: 'visible', timeout: 20000 })
    await feeling.evaluate(el => el.scrollIntoView({ block: 'center' }))
    await feeling.getByRole('button', { name: 'Søvnkvalitet 4' }).click()
    await feeling.getByText('Gemt. Din coach kan se tallene.').waitFor({ timeout: 10000 })
    await feeling.getByRole('button', { name: 'Smerte 3' }).click()
    await feeling.getByLabel('Hvor sidder smerten (valgfrit)').waitFor({ timeout: 10000 })
    const row = await waitFor(() => mock.table('tracking_daily_v1').some(r => r.logged_date === danishToday() && r.sleep_quality === 4 && r.pain === 3))
    if (!row) throw new Error('Søvn og smerte blev ikke gemt: ' + JSON.stringify(mock.table('tracking_daily_v1')))
    await edges(page, vp.width, '[data-u7-day-feeling], [data-u7-day-feeling] *')
    await feeling.screenshot({ path: join(outDir, `u7-${mode}-atlet-${vp.name}-2-soevn-og-smerte.png`) })
    // Engangsflytning: gårsdagens vand og "færdig for i dag" fra telefonen ligger nu i tabellen, én række.
    const yesterday = addDays(danishToday(), -1)
    const moved = await waitFor(() => { const r = mock.table('tracking_daily_v1').filter(x => x.logged_date === yesterday); return r.length === 1 && r[0].water_ml === 1500 && r[0].kost_done_at })
    if (!moved) throw new Error('Telefonens data blev ikke flyttet op: ' + JSON.stringify(mock.table('tracking_daily_v1')))
    const y = mock.table('tracking_daily_v1').find(x => x.logged_date === yesterday)
    if (y.sleep_quality !== 2 || y.pain !== 6) throw new Error('Flytningen overskrev serverens tal')
    result.flyttet = { water_ml: y.water_ml, kost_done_at: !!y.kost_done_at, raekker: mock.table('tracking_daily_v1').length }
  }
  // Kost: vand og væskemål.
  await page.getByRole('button', { name: 'Kost', exact: true }).first().click({ timeout: 20000 })
  const goal = page.getByRole('region', { name: 'Væskemål' })
  await goal.waitFor({ state: 'visible', timeout: 20000 })
  await page.waitForTimeout(1200)
  await goal.scrollIntoViewIfNeeded()
  if (mode !== 'med') {
    result.kostText = (await page.locator('body').textContent()).replace(/\s+/g, ' ')
    if (!/Kun lokal lagring på denne enhed/.test(result.kostText)) throw new Error('Væsketeksten er ændret uden tabellen')
  } else {
    // Ny telefon: dagens 750 ml og målet 3.000 ml kommer fra databasen.
    await goal.getByText('750 af 3.000 ml').waitFor({ timeout: 15000 })
    await goal.getByRole('button', { name: 'Drukket 250 ml vand' }).click()
    await goal.getByText('1.000 af 3.000 ml').waitFor({ timeout: 5000 })
    const saved = await waitFor(() => mock.table('tracking_daily_v1').some(r => r.logged_date === danishToday() && r.water_ml === 1000))
    if (!saved) throw new Error('Vandet blev ikke gemt i tabellen')
    result.vand = 1000
  }
  await noSideScroll(page, vp.width)
  await edges(page, vp.width, '[aria-label="Væskemål"], [aria-label="Væskemål"] *')
  await goal.screenshot({ path: join(outDir, `u7-${mode}-atlet-${vp.name}-3-vand.png`) })
  return result
}

async function coach(page, vp, outDir, mode, mock) {
  await login(page, COACH_USER)
  await page.getByText('Kræver dit blik').first().waitFor({ state: 'visible', timeout: 30000 })
  await page.getByText(/readiness falder/i).first().waitFor({ state: 'visible', timeout: 30000 })
  await page.waitForTimeout(2000)
  await noSideScroll(page, vp.width)
  const section = page.locator('section[aria-label="Atleter der kræver handling"]')
  const result = { mode }
  if (mode !== 'med') {
    if (await page.locator('[data-u7-day], [data-u7-week-target]').count()) throw new Error('Coachens U7-linjer vises uden tabellerne')
    result.coachText = (await section.textContent()).replace(/\s+/g, ' ')
  } else {
    await page.locator(`[data-u7-day="${ATHLETE_ID}"]`).waitFor({ state: 'visible', timeout: 20000 })
    await page.locator(`[data-u7-week-target="${ATHLETE_ID}"]`).waitFor({ state: 'visible', timeout: 20000 })
    const text = (await section.textContent()).replace(/\s+/g, ' ')
    if (!/Smerte 6\/10 \(venstre knæ\)/.test(text)) throw new Error('Smerte som tal mangler: ' + text.slice(0, 400))
    const day = await page.locator(`[data-u7-day="${ATHLETE_ID}"]`).textContent()
    const week = await page.locator(`[data-u7-week-target="${ATHLETE_ID}"]`).textContent()
    if (!/^Søvn 1,5\/5 \(2 dage\) · Smerte 6\/10 \(venstre knæ\)/.test(day)) throw new Error('Tal-linjen er forkert: ' + day)
    if (!/^Kost sidste uge: protein 158 g mod mål 180 g, 2\.733 kcal mod 2\.800 i snit pr\. logget dag \(3 af 7 dage\)$/.test(week)) throw new Error('Ugens kostmål er forkert: ' + week)
    const dated = await waitFor(() => mock.table('nutrition_targets_v1').some(r => r.effective_from === danishToday() && r.protein_g === 180))
    if (!dated) throw new Error('Coachens nuværende mål blev ikke dateret: ' + JSON.stringify(mock.table('nutrition_targets_v1')))
    await edges(page, vp.width, '[data-u7-day], [data-u7-week-target]')
    Object.assign(result, { day, week, dateret: true })
  }
  await page.screenshot({ path: join(outDir, `u7-${mode}-coach-${vp.name}-1-forside.png`) })
  await section.screenshot({ path: join(outDir, `u7-${mode}-coach-${vp.name}-2-kraever-dit-blik.png`) })
  return result
}

async function main() {
  const mode = process.argv[2]
  // foer: samme kørsel som uden, mod U6-koden, til sammenligning af tekst og billeder.
  if (!['uden', 'med', 'foer'].includes(mode)) throw new Error('Angiv uden, med eller foer')
  const hidden = (process.env.E2E_HIDE_TABLES || '').split(',').map(s => s.trim()).filter(Boolean)
  if (mode !== 'med' && TABLES.some(t => !hidden.includes(t))) throw new Error('uden kræver E2E_HIDE_TABLES=' + TABLES.join(','))
  if (mode === 'med' && hidden.length) throw new Error('med må ikke skjule tabeller')
  const outDir = process.argv[3] || OUT_DIR
  const resultFile = process.argv[4]
  mkdirSync(outDir, { recursive: true })
  const vite = await startVite()
  const browser = await launchBrowser().catch(() => chromium.launch({ headless: true, channel: 'msedge' }))
  const results = []
  const fresh = async (vp, run) => {
    const mock = createMockSupabase(u7Seed(mode === 'med'))
    await mock.listen(MOCK_PORT)
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } })
    const errors = []
    page.on('pageerror', err => errors.push(err.message))
    try {
      const result = await run(page, mock)
      if (errors.length) throw new Error(`browserfejl: ${errors.join('; ')}`)
      return result
    } finally { await page.close(); await mock.close?.() }
  }
  try {
    for (const vp of VIEWPORTS) {
      results.push(['atlet', vp.width, await fresh(vp, (page, mock) => athlete(page, vp, outDir, mode, mock))])
      results.push(['coach', vp.width, await fresh(vp, (page, mock) => coach(page, vp, outDir, mode, mock))])
    }
    for (const r of results) console.log(`GRØN: ${r[0]} på ${r[1]} px ${JSON.stringify(r[2]).slice(0, 300)}`)
  } finally {
    await browser.close(); await vite.stop()
  }
  if (resultFile) writeFileSync(resultFile, JSON.stringify({ mode, results }, null, 2))
  console.log(`U7 e2e (${mode}): ${results.length} af 4 grønne`)
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) main().catch(err => { console.error(err); process.exitCode = 1 })
