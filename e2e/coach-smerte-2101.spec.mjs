// ORDRE 2101 · coachen ser atletens smerte-note fra et saet i Entropi 2 (udfald 1: ingen src-aendring).
// Marc 5. okt.: "smerte-note standser stigningsforslag"; coachen skal se smerten. I Entropi 2 staar den som
// en raekke under "Signaler fra appen" i folden Mere ("<atlet> · Smerte naevnt <dato>"). Noten citeres aldrig.
// Saet-noten er skrevet paa et saet (exercise_logs.note) for to dage siden; en anden atlet har en rolig note.
// Syntetiske data. Kørsel: node e2e/coach-smerte-2101.spec.mjs [billedmappe]. Alle fire kombinationer:
// 1280 og 390 px, lys og moerk.
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createMockSupabase } from './mock-supabase.mjs'
import { buildSeed, COACH_USER, ATHLETE_ID, EXERCISE_ID } from './fixtures.mjs'
import { startVite, launchBrowser, APP_URL, MOCK_PORT, OUT_DIR } from './harness.mjs'

const DAGE = 86400000
const iso = dage => new Date(Date.now() - dage * DAGE).toISOString()
const uuid = n => `21010000-0000-4000-8000-${String(n).padStart(12, '0')}`
const NOTE_SMERTE = 'knæet gør ondt i bunden på sidste sæt'
const NOTE_ROLIG = 'tungt men fint i dag'

export function bygSmerteSeed() {
  const seed = buildSeed()
  const t = seed.tables
  // Atlet B har en rolig note og skal ikke faa en smerterække.
  const roligId = uuid(1)
  t.athletes.push({ id: roligId, user_id: null, name: 'Atlet Rolig', email: null, coach_id: COACH_USER.id, status: 'active', hidden: false,
    snooze_until: null, competition_date: null, onboarding_completed_at: iso(60) })
  t.exercise_logs.push(
    { id: uuid(10), athlete_id: ATHLETE_ID, exercise_id: EXERCISE_ID, set_number: 3, weight: 100, reps_completed: 5, skipped: false,
      rpe_actual: 8, rpe_planned: null, note: NOTE_SMERTE, logged_at: iso(2) },
    { id: uuid(11), athlete_id: roligId, exercise_id: EXERCISE_ID, set_number: 1, weight: 100, reps_completed: 5, skipped: false,
      rpe_actual: 7, rpe_planned: null, note: NOTE_ROLIG, logged_at: iso(2) })
  return seed
}

export async function runCoachSmerte(page, { outDir, label, lys }) {
  await page.goto(APP_URL)
  if (lys) { await page.evaluate(() => localStorage.setItem('entropi:tema', 'lys')); await page.reload() }
  await page.locator('#athlete-auth-email').fill(COACH_USER.email)
  await page.locator('#athlete-auth-password').fill(COACH_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  const mere = page.locator('[data-coach-fold="mere"] > summary')
  await mere.waitFor({ state: 'visible', timeout: 30000 })
  await mere.click()
  const signaler = page.locator('section[aria-label="Signaler fra appen"]')
  await signaler.waitFor({ state: 'visible', timeout: 30000 })
  const raekke = signaler.locator('[data-coach-action]', { hasText: 'Testatlet' }).first()
  await raekke.waitFor({ state: 'visible', timeout: 30000 })
  const tekst = await raekke.innerText()
  assert.match(tekst, /Smerte nævnt \d{1,2}\.? \S+/, `raekken skal vise smerte og dato, fik: ${tekst}`)
  assert.ok(!(await signaler.innerText()).includes('Atlet Rolig'), 'en rolig note giver ingen smerterække')
  const html = await page.content()
  assert.ok(!html.includes(NOTE_SMERTE) && !html.includes('ondt i bunden'), 'noten citeres ikke i DOM')
  const bred = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  assert.ok(bred <= 0, `ingen vandret scroll, fandt ${bred}px`)
  await signaler.screenshot({ path: join(outDir, `coach-smerte-2101-${label}.png`) })
  return tekst.replace(/\s+/g, ' ')
}

async function main() {
  const outDir = process.argv[2] || OUT_DIR
  mkdirSync(outDir, { recursive: true })
  const vite = await startVite()
  const browser = await launchBrowser()
  let ok = 0
  try {
    for (const [bredde, hoejde] of [[1280, 900], [390, 844]]) {
      for (const lys of [false, true]) {
        const label = `${bredde}-${lys ? 'lys' : 'moerk'}`
        const mock = createMockSupabase(bygSmerteSeed())
        await mock.listen(MOCK_PORT)
        const page = await browser.newPage({ viewport: { width: bredde, height: hoejde }, colorScheme: lys ? 'light' : 'dark' })
        const fejl = []
        page.on('pageerror', err => fejl.push(`pageerror: ${err.message}`))
        try {
          const linje = await runCoachSmerte(page, { outDir, label, lys })
          assert.deepEqual(fejl, [], `Ingen sidefejl forventet: ${JSON.stringify(fejl)}`)
          console.log(`GRØN ${label}: ${linje}`)
          ok++
        } finally { await page.close(); await mock.close().catch(() => {}) }
      }
    }
    console.log(`\nGRØN: coachen ser smerte fra et sæt-note (${ok} af 4: 1280 og 390 px, lys og mørk).`)
  } catch (err) {
    console.error('\nFEJL:', err.message)
    process.exitCode = 1
  } finally {
    await browser.close().catch(() => {})
    await vite.stop().catch(() => {})
  }
}

if (process.argv[1] && process.argv[1].endsWith('coach-smerte-2101.spec.mjs')) main()
