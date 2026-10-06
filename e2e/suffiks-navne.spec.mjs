// ORDRE 1420 (QA 1418 fund 1-4) — eet loeft = eet navn, ogsaa naar programmet har
// suffiks-navne ("Squat - topsæt", "Squat - backoff", "Squat (comp)", "Bænkpres topsæt").
// Seed har flere suffiks-navne for samme loeft; tjekker Dagens pas (mens et saet logges
// og pausen koerer), Program (saettaeller maa aldrig overstige planen) og Fremgang
// (1RM: eet "Squat", eet "Bænkpres"). Skaermbilleder i outputs/1420 (390x844).
// Egen kørsel: `node e2e/suffiks-navne.spec.mjs`.
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { ATHLETE_USER, ATHLETE_ID, SESSION_ID, EXERCISE_ID, WEEK_ID, buildSeed } from './fixtures.mjs'

const OUT_DIR = join(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), '..', 'outputs', '1420')
mkdirSync(OUT_DIR, { recursive: true })
const uuid = (a, n) => `${a}${String(n).padStart(7, '0')}-${a}${a}${a}${a}-4${a}${a}${a}-8${a}${a}${a}-${a}${a}${a}${a}${a}${a}${a}${a}${a}${a}${a}${a}`
const DAY = 864e5
const FORBUDT = /(squat|bænkpres|baenkpres|dødløft|doedloeft)\s*(?:[-–]\s*|\()?\s*(top\s?s(?:æ|ae)t|back-?off|comp)/i

function seedMedSuffikser() {
  const seed = buildSeed()
  // Denne uges pas: samme loeft under tre navne + bænk med suffiks.
  seed.tables.exercises = [
    { id: EXERCISE_ID, session_id: SESSION_ID, name: 'Squat - topsæt', sets: 1, reps: '4', intensity: 'RPE 8', note: null, exercise_order: 1, recommended_weight: 100 },
    { id: uuid('a', 1), session_id: SESSION_ID, name: 'Squat - backoff', sets: 3, reps: '6', intensity: 'RPE 7', note: null, exercise_order: 2, recommended_weight: 90 },
    { id: uuid('a', 2), session_id: SESSION_ID, name: 'Bænkpres topsæt', sets: 2, reps: '5', intensity: 'RPE 8', note: null, exercise_order: 3, recommended_weight: 70 },
  ]
  // Tidligere uge med andre suffiks-navne for samme loeft.
  const PAST_WEEK = uuid('b', 1), PAST_SESSION = uuid('b', 2)
  const hist = [[uuid('c', 1), 'Squat (comp)'], [uuid('c', 2), 'Squat topsæt'], [uuid('c', 3), 'Bænkpres - backoff']]
  seed.tables.weeks.push({ id: PAST_WEEK, athlete_id: ATHLETE_ID, week_number: 0, block_name: 'Base' })
  seed.tables.sessions.push({ id: PAST_SESSION, week_id: PAST_WEEK, title: 'Dag 1 — forrige uge', session_order: 1, weekday: 0, athlete_rating: null, athlete_comment: null })
  hist.forEach(([id, name], i) => seed.tables.exercises.push({ id, session_id: PAST_SESSION, name, sets: 1, reps: '5', intensity: 'RPE 8', note: null, exercise_order: i + 1, recommended_weight: 80 }))
  const w = [[uuid('c', 1), 110, 5], [uuid('c', 2), 105, 5], [uuid('c', 3), 75, 5]]
  seed.tables.exercise_logs = w.map(([exId, kg, reps], i) => ({
    id: uuid('d', i + 1), exercise_id: exId, athlete_id: ATHLETE_ID, set_number: 1, weight: kg, reps_completed: reps,
    note: null, rpe_actual: null, rpe_planned: null, skipped: false, logged_at: new Date(Date.now() - (9 + i) * DAY).toISOString(),
  }))
  return seed
}

async function main() {
  const { createMockSupabase } = await import('./mock-supabase.mjs')
  const { startVite, launchBrowser, APP_URL, MOCK_PORT } = await import('./harness.mjs')
  const vite = await startVite(); const browser = await launchBrowser()
  const mock = createMockSupabase(seedMedSuffikser()); await mock.listen(MOCK_PORT)
  try {
    const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
    page.on('pageerror', err => console.error('[browser pageerror]', err))
    const shot = (n, full = false) => page.screenshot({ path: join(OUT_DIR, `${n}.png`), fullPage: full })
    const tekst = () => page.evaluate(() => document.body.innerText)
    await page.goto(APP_URL)
    await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
    await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
    await page.getByRole('button', { name: 'Log ind' }).click()
    await page.getByText('Dagens pas', { exact: true }).waitFor({ state: 'visible', timeout: 15000 })
    await page.waitForTimeout(1200)

    // 1) Dagens pas: log et saet -> pause -> pop-up. Ingen suffiks-navne som oevelsesnavn.
    assert.ok(!FORBUDT.test(await tekst()), 'Dagens pas viser suffiks-navn som oevelse')
    await page.getByRole('button', { name: 'Godkendt', exact: true }).click()
    const open = page.getByTestId('rest-pause-open')
    await open.waitFor({ state: 'visible', timeout: 5000 })
    await shot('dagens-pas-saet-logget-pause')
    assert.ok(!FORBUDT.test(await tekst()), 'Hvilepause-linjen viser suffiks-navn')
    await open.click()
    const popup = page.getByTestId('rest-pause-popup'); await popup.waitFor({ state: 'visible', timeout: 3000 })
    await shot('dagens-pas-timer-popup')
    assert.match(await popup.innerText(), /s(?:æ|ae)t 2\/4/i, 'pop-up "Næste" skal taelle i hele loeftet (2/4), som kortet')
    assert.ok(!FORBUDT.test(await popup.innerText()), 'Pop-up viser suffiks-navn')
    // 2) Pop-up daekker bundnavigationen: et tryk paa nav-omraadet rammer baggrunden, ikke en fane.
    const hit = await page.evaluate(() => {
      const nav = document.querySelector('nav'); const r = nav.getBoundingClientRect()
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      return { insideNav: nav.contains(el), insidePopup: !!el?.closest('[data-testid="rest-pause-popup"]') || el?.getAttribute('data-testid') === 'rest-pause-backdrop' || true }
    })
    assert.equal(hit.insideNav, false, 'bundnavigationen er klikbar under pop-up')
    await page.getByTestId('rest-pause-close').click()

    // 3) Program: saettaeller <= plan, eet navn pr. loeft.
    await page.getByText('Program', { exact: true }).last().click(); await page.waitForTimeout(1500)
    const prog = await tekst()
    assert.ok(!FORBUDT.test(prog), 'Program viser suffiks-navn som oevelse')
    for (const m of prog.matchAll(/(\d+)\s*\/\s*(\d+)\s*s(?:æ|ae)t logget/gi)) assert.ok(+m[1] <= +m[2], `saettaeller ${m[0]} over plan`)
    await shot('program-suffiks', true)

    // 4) Fremgang: eet "Squat", eet "Bænkpres".
    await page.getByText('Fremgang', { exact: true }).last().click(); await page.waitForTimeout(2000)
    const fr = await tekst()
    assert.ok(!FORBUDT.test(fr), 'Fremgang viser suffiks-navn som oevelse')
    await shot('fremgang-1rm-suffiks', true)
    const rows = await page.evaluate(() => [...document.querySelectorAll('select option, button, [role=tab]')].map(e => e.textContent.trim()))
    const squat = rows.filter(t => /^squat$/i.test(t)).length
    assert.ok(squat <= 1, `"Squat" vises ${squat} gange i oevelsesvaelgeren`)
    const sw = await page.evaluate(() => document.documentElement.scrollWidth)
    assert.ok(sw <= 390, `vandret overflow ${sw}`)
    console.log('\nGRØN: suffiks-navne foldes paa Dagens pas, pause-pop-up, Program og Fremgang; saettaeller <= plan; nav daekket af pop-up.')
  } catch (err) { console.error('\nFEJL:', err.message); process.exitCode = 1 }
  finally { await browser.close(); await mock.close(); await vite.stop() }
}
main()
