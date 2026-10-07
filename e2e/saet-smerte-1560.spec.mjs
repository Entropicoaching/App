// ORDRE 1560 · smerte i en saet-note (ikke kun dagens pas-kommentar).
//   Atlet 390: stigningsforslaget ("Forslag: N kg") staar paa Squat uden smerte; med smerte i en
//     saet-note paa knaeet (Squat) erstattes det af den rolige linje (V-SMERTE B); smerte i skulderen
//     paa baenkpres rammer ikke Squat.
//   Coach 1280: smerte i Echos saet-note staar oeverst under "Kræver dit blik" med loeft og dato.
// Syntetiske data. Koersel: node e2e/saet-smerte-1560.spec.mjs
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { ATHLETE_USER, ATHLETE_ID, buildSeed, COACH_USER } from './fixtures.mjs'
import { signalerFraSeed } from '../outputs/428/coach-faelles.mjs'
import { bygSoendagSeed } from './soendag-1545.spec.mjs'

const iso = (dage) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - dage); return d.toISOString() }
const LINJE = 'Ingen forslag i dag: tal med din coach om smerten'

function atletSeed(foer) {
  const seed = buildSeed()
  const T = seed.tables
  T.exercises[0].recommended_weight = null // forslaget vises kun naar coachen ikke har sat en vaegt
  T.weeks.unshift({ id: '99999999-9999-4999-8999-999999999961', athlete_id: ATHLETE_ID, week_number: 0, block_name: 'Forrige', start_date: iso(14).slice(0, 10) })
  T.sessions.push({ id: '99999999-9999-4999-8999-999999999962', week_id: '99999999-9999-4999-8999-999999999961', title: 'Dag 1 — Forrige', session_order: 1, weekday: 0, athlete_rating: null, athlete_comment: null })
  foer.forEach(({ navn, note }, i) => {
    const eid = `99999999-9999-4999-8999-99999999997${i}`
    T.exercises.push({ id: eid, session_id: '99999999-9999-4999-8999-999999999962', name: navn, sets: 1, reps: '5', intensity: 'RPE 8', note: null, exercise_order: i + 1, recommended_weight: 100 })
    T.exercise_logs.push({ id: `99999999-9999-4999-8999-99999999998${i}`, exercise_id: eid, athlete_id: ATHLETE_ID, set_number: 1, weight: 100, reps_completed: 5, note, rpe_actual: 7, rpe_planned: null, skipped: false, logged_at: iso(3) })
  })
  return seed
}

async function atletLoeb(page, { appUrl, outDir }, { foer, forventStop, billede }) {
  const { createMockSupabase } = await import('./mock-supabase.mjs')
  const { MOCK_PORT } = await import('./harness.mjs')
  const mock = createMockSupabase(atletSeed(foer))
  await mock.listen(MOCK_PORT)
  if (process.env.DBG1560) page.on('response', async r => { if (r.url().includes('exercise_logs') && r.request().method() === 'GET') console.error('[net]', r.status(), r.url().slice(-160), (await r.text().catch(() => '')).slice(0, 300)) })
  try {
    await page.goto(appUrl)
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
    await page.goto(appUrl)
    await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
    await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
    await page.getByRole('button', { name: 'Log ind' }).click()
    await page.getByText('Dagens pas', { exact: true }).waitFor({ state: 'visible', timeout: 15000 })
    await page.getByText(/Sidste gang:|Næste: \d+ reps @/).first().waitFor({ state: 'visible', timeout: 10000 })
    await page.waitForTimeout(800)
    await page.screenshot({ path: join(outDir, `saet-smerte-1560-atlet-390-${billede}.png`), fullPage: true })
    const tekst = await page.evaluate(() => document.body.innerText)
    if (forventStop) {
      assert.ok(tekst.includes(LINJE), `forventede den rolige linje, fik: ${tekst.slice(0, 400)}`)
      assert.ok(!/Forslag:\s*[\d.,]+\s*kg/.test(tekst), 'intet vaegtforslag maa vises naar smerten rammer loeftet')
    } else {
      assert.ok(/Forslag:\s*[\d.,]+\s*kg/.test(tekst), `forventede et vaegtforslag, fik: ${tekst.slice(0, 400)}`)
      assert.ok(!tekst.includes(LINJE), 'den rolige linje maa ikke vises uden smerte')
    }
  } finally { await mock.close() }
}

export async function runAtlet(page, ctx) {
  await atletLoeb(page, ctx, { foer: [{ navn: 'Squat', note: null }], forventStop: false, billede: '1-uden-smerte-forslag' })
  await atletLoeb(page, ctx, { foer: [{ navn: 'Squat', note: 'knæet gør ondt i bunden' }], forventStop: true, billede: '2-smerte-i-saetnote-ingen-forslag' })
  await atletLoeb(page, ctx, { foer: [{ navn: 'Squat', note: null }, { navn: 'Bænkpres', note: 'skulderen stikker' }], forventStop: false, billede: '3-skulder-paa-baenk-rammer-ikke-squat' })
}

export async function runCoach(page, { appUrl, outDir }) {
  const { createMockSupabase } = await import('./mock-supabase.mjs')
  const { MOCK_PORT } = await import('./harness.mjs')
  const { seed } = bygSoendagSeed()
  const mock = createMockSupabase(seed)
  await mock.listen(MOCK_PORT)
  try {
    const signaler = await signalerFraSeed(seed)
    await page.route('**/rest/v1/rpc/entropi_training_signals_v1', r => r.fulfill({ json: signaler }))
    await page.goto(appUrl)
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
    await page.goto(appUrl)
    await page.locator('#athlete-auth-email').fill(COACH_USER.email)
    await page.locator('#athlete-auth-password').fill(COACH_USER.password)
    await page.getByRole('button', { name: 'Log ind' }).click()
    await page.getByText('Alfa Testsen').first().waitFor({ timeout: 30000 })
    await page.getByText(/åbne ting/).first().waitFor({ timeout: 15000 })
    await page.waitForTimeout(1200)
    await page.getByText('Kræver dit blik').first().click()
    await page.getByText('Næste opgave').first().waitFor({ timeout: 10000 })
    const tekst = await page.evaluate(() => document.body.innerText)
    const m = tekst.match(/Echo[^\n]*melder ondt i skulderen \(([^)]*)\)/)
    assert.ok(m, `Echos saet-note-smerte skal staa under Kræver dit blik. Tekst: ${tekst.slice(0, 600)}`)
    assert.match(m[1], /sæt-note \d+\. \w+/, 'loeft/dato i linjen')
    assert.ok(tekst.includes('Ingen stigning på'), 'handlingslinjen siger at stigningen staar stille')
    assert.ok(!tekst.includes('Skarp smerte'), 'noten citeres ikke')
    const idx = tekst.search(/Echo[^\n]*melder ondt i skulderen/)
    const forFravaer = tekst.search(/mistede \d+ af \d+ pas/)
    assert.ok(forFravaer === -1 || idx < forFravaer, 'smerte staar foer fravaer')
    await page.screenshot({ path: join(outDir, 'saet-smerte-1560-coach-1280-kraever-dit-blik.png'), fullPage: true })
  } finally { await mock.close() }
}

async function main() {
  const { startVite, launchBrowser, APP_URL, OUT_DIR } = await import('./harness.mjs')
  const vite = await startVite()
  const browser = await launchBrowser()
  try {
    const fejl = []
    const atlet = await browser.newPage({ viewport: { width: 390, height: 844 } })
    atlet.on('pageerror', err => fejl.push(`pageerror: ${err.message}`))
    await runAtlet(atlet, { appUrl: APP_URL, outDir: OUT_DIR })
    await atlet.close()
    const coach = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    coach.on('pageerror', err => fejl.push(`pageerror: ${err.message}`))
    await runCoach(coach, { appUrl: APP_URL, outDir: OUT_DIR })
    assert.deepEqual(fejl, [], `Ingen browser-fejl forventet: ${JSON.stringify(fejl)}`)
    console.log('\nGRØN: sæt-note-smerte standser forslaget (atlet 390) og står øverst hos coachen (1280).')
    process.exitCode = 0
  } catch (err) {
    console.error('\nFEJL:', err.message)
    process.exitCode = 1
  } finally {
    await browser.close().catch(() => {})
    await vite.stop().catch(() => {})
  }
}

if (process.argv[1] && process.argv[1].endsWith('saet-smerte-1560.spec.mjs')) main()
