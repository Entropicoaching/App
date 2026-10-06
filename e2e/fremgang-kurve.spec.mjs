// ORDRE 1421 - Fremgang med realistisk syntetisk historik: syv uger, alle navnene
// (topsaet, top set, backoff, back-off, teknik single, teknik-singler, comp, volumen,
// primaer), lette saet med hoej Epley og huller. Beviser (1) eet navn pr. hovedloeft i
// vaelgeren, (2) kurven = hoejeste e1RM pr. dag fra tunge saet og falder ikke af lette
// saet, (3) den forklarende linje. Skaermbilleder i outputs/1421 (390x844).
// `node e2e/fremgang-kurve.spec.mjs` (efter) / `FREMGANG_FOER=1 ...` (kun skaermbilleder, til foer-billedet).
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { ATHLETE_USER, ATHLETE_ID, SESSION_ID, EXERCISE_ID, WEEK_ID, buildSeed } from './fixtures.mjs'

const FOER = !!process.env.FREMGANG_FOER
const OUT_DIR = join(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), '..', 'outputs', '1421')
mkdirSync(OUT_DIR, { recursive: true })
const uuid = (a, n) => `${a}${String(n).padStart(7, '0')}-${a}${a}${a}${a}-4${a}${a}${a}-8${a}${a}${a}-${a}${a}${a}${a}${a}${a}${a}${a}${a}${a}${a}${a}`
const DAY = 864e5

const NAVNE = ['Bænkpres topsæt', 'Baenkpres top set', 'Bænkpres - backoff', 'Bænkpres back-off', 'Bænkpres teknik single',
  'Bænkpres teknik-singler', 'Bænkpres (comp)', 'Bænkpres volumen', 'Bænkpres primær',
  'Squat - topsæt', 'Squat Top Set', 'Squat backoff', 'Squat volumen', 'Squat comp',
  'Dødløft topsæt', 'Dødløft - backoff']

// [dage siden, navn, kg, reps]. Tunge sæt stiger; lette sæt er lette men har høj Epley.
// Uge 4 (ca. 21-27 dage siden) mangler helt (hul).
const SAET = [
  [48, 'Bænkpres topsæt', 100, 3], [48, 'Bænkpres - backoff', 85, 8], [48, 'Bænkpres volumen', 70, 12],
  [45, 'Bænkpres teknik single', 60, 1],
  [41, 'Baenkpres top set', 102.5, 3], [41, 'Bænkpres back-off', 92, 8],
  [38, 'Bænkpres teknik-singler', 65, 1], [38, 'Bænkpres volumen', 72.5, 10],
  [34, 'Bænkpres primær', 105, 3], [34, 'Bænkpres - backoff', 88, 8],
  [20, 'Bænkpres (comp)', 105, 2], [20, 'Bænkpres teknik-singler', 70, 1], [20, 'Bænkpres - backoff', 85, 6],
  [13, 'Bænkpres topsæt', 107.5, 3], [13, 'Bænkpres volumen', 75, 12],
  [6, 'Bænkpres topsæt', 110, 3], [6, 'Bænkpres teknik single', 65, 1], [6, 'Bænkpres back-off', 95, 8],
  [47, 'Squat - topsæt', 130, 3], [47, 'Squat backoff', 110, 8],
  [40, 'Squat Top Set', 135, 3], [40, 'Squat volumen', 100, 12],
  [33, 'Squat comp', 137.5, 3], [33, 'Squat backoff', 120, 8],
  [19, 'Squat - topsæt', 140, 3], [19, 'Squat volumen', 105, 10],
  [12, 'Squat Top Set', 142.5, 3], [12, 'Squat backoff', 125, 8],
  [5, 'Squat - topsæt', 145, 3],
  [44, 'Dødløft topsæt', 160, 3], [37, 'Dødløft - backoff', 140, 8], [30, 'Dødløft topsæt', 165, 3],
]

export function seedMedHistorik() {
  const seed = buildSeed()
  const PAST_WEEK = uuid('b', 1), PAST_SESSION = uuid('b', 2)
  seed.tables.weeks.push({ id: PAST_WEEK, athlete_id: ATHLETE_ID, week_number: 0, block_name: 'Base' })
  seed.tables.sessions.push({ id: PAST_SESSION, week_id: PAST_WEEK, title: 'Historik', session_order: 1, weekday: 0, athlete_rating: null, athlete_comment: null })
  const idFor = new Map()
  NAVNE.forEach((navn, i) => {
    const id = uuid('c', i + 1); idFor.set(navn, id)
    seed.tables.exercises.push({ id, session_id: PAST_SESSION, name: navn, sets: 1, reps: '3', intensity: 'RPE 8', note: null, exercise_order: i + 1, recommended_weight: 80 })
  })
  seed.tables.exercise_logs = SAET.map(([dage, navn, kg, reps], i) => ({
    id: uuid('d', i + 1), exercise_id: idFor.get(navn), athlete_id: ATHLETE_ID, set_number: 1, weight: kg, reps_completed: reps,
    note: null, rpe_actual: null, rpe_planned: null, skipped: false,
    logged_at: new Date(Date.now() - dage * DAY + (i % 5) * 36e5).toISOString(),
  }))
  return seed
}

async function main() {
  const { createMockSupabase } = await import('./mock-supabase.mjs')
  const { startVite, launchBrowser, APP_URL, MOCK_PORT } = await import('./harness.mjs')
  const vite = await startVite(); const browser = await launchBrowser()
  const mock = createMockSupabase(seedMedHistorik()); await mock.listen(MOCK_PORT)
  try {
    const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
    page.on('pageerror', err => console.error('[browser pageerror]', err))
    const shot = (n) => page.screenshot({ path: join(OUT_DIR, `${n}.png`), fullPage: true })
    await page.goto(APP_URL)
    await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
    await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
    await page.getByRole('button', { name: 'Log ind' }).click()
    await page.getByText('Dagens pas', { exact: true }).waitFor({ state: 'visible', timeout: 15000 })
    await page.waitForTimeout(1000)
    await page.getByText('Fremgang', { exact: true }).last().click(); await page.waitForTimeout(2500)

    const udover = async (navn) => {
      await page.getByRole('button', { name: navn, exact: true }).first().click(); await page.waitForTimeout(500)
    }
    const knapper = await page.evaluate(() => [...document.querySelectorAll('button')].filter(b => !b.closest('nav')).map(b => b.textContent.trim()))
    const linjeTekst = () => page.evaluate(() => document.querySelector('[data-fremgang-linje]')?.textContent ?? null)
    const punkterAntal = () => page.evaluate(() => document.querySelectorAll('svg circle').length)
    const kurveY = () => page.evaluate(() => (document.querySelector('svg polyline')?.getAttribute('points') || '').split(' ').map(p => Number(p.split(',')[1])))

    await udover('Bænkpres')
    await shot(FOER ? 'fremgang-foer-baenk' : 'fremgang-efter-baenk')
    if (FOER) { await udover('Squat'); await shot('fremgang-foer-squat'); console.log('FOER-billeder gemt. Knapper:', knapper.join(' | ')); return }

    // 1) Eet navn pr. hovedloeft: ingen suffiks-navn som knap/valg noget sted.
    const SUFF = /(top\s?-?s(?:æ|ae)t|top set|back[ -]?off|teknik|volumen|prim(?:æ|ae)r|comp)/i
    assert.ok(!knapper.some(t => SUFF.test(t)), `suffiks-navn i vaelgeren: ${knapper.filter(t => SUFF.test(t)).join(', ')}`)
    for (const n of ['Bænkpres', 'Squat', 'Dødløft']) assert.equal(knapper.filter(t => t === n).length, 1, `${n} skal staa praecis een gang`)
    // Hele siden (rekordlisten inkl.) maa ikke have suffiks-navn; de to forklarende linjer undtaget.
    const side = await page.evaluate(() => [...document.querySelectorAll('div, span, button, option')].filter(e => !e.children.length && !e.closest('nav')).map(e => e.textContent).join('\n'))
    const udenForklaring = side.split('\n').filter(l => !/tæller ikke med|Rekorder tæller kun/.test(l)).join('\n')
    assert.ok(!SUFF.test(udenForklaring), `suffiks-navn paa Fremgang: ${udenForklaring.match(SUFF)?.[0]}`)

    // 2) Bænk: kurven. Forventet fra data (tunge saet <= 8 reps, ikke lette navne):
    //    dag -48: 100x3=110; -41: 102,5x3=113; -34: 105x3=116; -20: 105x2=112; -13: 107,5x3=118; -6: 110x3=121.
    assert.equal(await punkterAntal(), 6, 'bænk: een prik pr. tung dag (45 og 38 dage siden har kun lette saet)')
    const y = await kurveY()
    assert.equal(y.length, 6)
    const linje = await linjeTekst()
    assert.match(linje, /^Bænkpres e1RM 121 kg, \+11 kg siden \d+\. \w{3}$/, linje)
    // Lette saet haever/saenker intet: backoff 92x8 = 117 > topsaet 113 den dag, men maa ikke vises.
    const forklaring = await page.evaluate(() => document.body.innerText)
    assert.match(forklaring, /Ét punkt pr\. træningsdag/, 'forklarende linje under grafen mangler')
    assert.match(forklaring, /lette sæt aldrig trækker kurven ned/)
    await shot('fremgang-efter-baenk')

    // 3) Squat og Dødløft: samme regler.
    await udover('Squat')
    assert.equal(await punkterAntal(), 6, 'squat: seks tunge dage')
    console.log(JSON.stringify(await linjeTekst())); assert.match(await linjeTekst(), /^Squat e1RM 160 kg, \+17 kg siden/, await linjeTekst())
    await shot('fremgang-efter-squat')
    await udover('Dødløft')
    assert.match(await linjeTekst(), /^Dødløft e1RM 182 kg, \+6 kg siden/, await linjeTekst())

    const sw = await page.evaluate(() => document.documentElement.scrollWidth)
    assert.ok(sw <= 390, `vandret overflow ${sw}`)
    console.log('\nGRØN: eet navn pr. hovedloeft, kurve = hoejeste e1RM pr. dag fra tunge saet, forklarende linje.')
  } catch (err) { console.error('\nFEJL:', err.message); process.exitCode = 1 }
  finally { await browser.close(); await mock.close(); await vite.stop() }
}
main()

