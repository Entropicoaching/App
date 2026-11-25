// Ordre 2145 (Marc 24. nov.: "1 ja til alle tre"): kostklient uden træning ved 390 px, lys og mørk.
// Ordre 2164: b og c. Ordre 2172: a) kort Dagsform (søvn, energi, sult; vægt i egen række), med og uden kolonnen hunger. b) dagen efter ugens slut: "Ny kostuge er på vej fra Marc";
// c) indkøb over Kostlog. En atlet med træning ser Dagsform (fuld) og Kost som før. Kun syntetiske data, ingen Date.now i prøven.
// Kør: E2E_VITE_PORT=5245 E2E_MOCK_PORT=8945 VITE_SUPABASE_URL=http://127.0.0.1:8945 node e2e/kostklient-2145.spec.mjs
import { createMockSupabase } from './mock-supabase.mjs'
import { ATHLETE_USER } from './fixtures.mjs'
import { startVite, launchBrowser, MOCK_PORT, APP_URL } from './harness.mjs'
import { seed as ugeSeed } from './kost-set-paa-main.spec.mjs'

const MOBILE = { width: 390, height: 844 }
const plus = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
const NY_UGE = 'Ny kostuge er på vej fra Marc'
// Kostuge med 7 dagsplaner: første plan starter `forskydning` dage før i dag. 6 = sidste dag er i dag; 7 = dagen efter ugens slut.
function seedAtlet({ forskydning, traening }) {
  const s = ugeSeed()
  if (!traening) { s.tables.weeks = []; s.tables.sessions = []; s.tables.exercises = []; s.tables.exercise_logs = [] }
  s.tables.kostplan_v1_plans.forEach((p, i) => { p.valid_from = plus(s.today, i - forskydning) })
  s.tables.kostplan_v1_versions.forEach((v, i) => { v.effective_from = plus(s.today, i - forskydning) })
  return s
}
const krav = (ok, tekst) => { if (!ok) throw new Error(tekst) }
const knap = (page, navn) => page.getByRole('button', { name: navn, exact: true }).first()
const sidetekst = page => page.locator('body').innerText()
const ingenScroll = async (page, hvor) => krav(await page.evaluate(() => document.documentElement.scrollWidth) <= MOBILE.width + 1, `Vandret scroll på 390 px: ${hvor}`)
async function login(page) {
  await page.goto(APP_URL); await page.evaluate(() => { try { localStorage.clear() } catch { /* ignoreret */ } }); await page.goto(APP_URL)
  await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email); await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
}
// Toppen af indkøbsafsnittet og af "Kostlog og vejning" i dokumentet, når begge findes.
async function indkoebOgLog(page) {
  await page.getByText('Indkøb fra kostplanen').first().waitFor({ timeout: 20000 })
  await page.waitForFunction(() => document.querySelector('section[aria-label="Indkøb fra kostplanen"]') &&
    [...document.querySelectorAll('summary')].some(s => s.textContent.includes('Kostlog og vejning')), null, { timeout: 20000 })
  return page.evaluate(() => [document.querySelector('section[aria-label="Indkøb fra kostplanen"]').getBoundingClientRect().top + window.scrollY,
    [...document.querySelectorAll('summary')].find(s => s.textContent.includes('Kostlog og vejning')).getBoundingClientRect().top + window.scrollY])
}

// Ordre 2172: a) kort Dagsform (søvn, energi og sult; vægt i egen række), ingen træningsspørgsmål.
// udenKolonne: mocken svarer som produktionen før migrationen (PGRST204 når hunger er med).
const dagsformTrin = udenKolonne => async (page, mock, scheme) => {
  let afvist = 0
  if (udenKolonne) await page.route('**/rest/v1/readiness_logs*', async route => {
    if (route.request().method() === 'POST' && 'hunger' in (route.request().postDataJSON() ?? {})) {
      afvist++
      return route.fulfill({ status: 400, contentType: 'application/json',
        body: JSON.stringify({ code: 'PGRST204', message: "Could not find the 'hunger' column of 'readiness_logs' in the schema cache", details: null, hint: null }) })
    }
    return route.fallback()
  })
  await page.getByText('Din kost i dag').first().waitFor({ timeout: 20000 })
  await page.getByText(/Mangler i dag:.*dagsform/).first().waitFor({ timeout: 20000 })
  await knap(page, 'Udfyld dagsform').waitFor({ timeout: 20000 }); await knap(page, 'Udfyld dagsform').click()
  await page.getByLabel('Sult 2', { exact: true }).first().waitFor({ timeout: 20000 })
  const t = await sidetekst(page)
  for (const forbudt of ['Motivation', 'Stress', 'Ømhed', 'Smerte', 'Søvnkvalitet']) krav(!t.includes(forbudt), `kort Dagsform viser træningsspørgsmålet "${forbudt}"`)
  krav(t.includes('Vægt'), 'vægt mangler på Hjem')
  await page.getByLabel('Energi 4', { exact: true }).first().click()
  await page.getByLabel('Sult 2', { exact: true }).first().click()
  await page.getByLabel('Søvn (timer, valgfrit)').fill('7,5')
  if (!udenKolonne && process.env.E2E_SKAERM) await page.screenshot({ path: `${process.env.E2E_SKAERM}/kostklient-dagsform-${scheme}.png`, fullPage: false })
  await knap(page, 'Gem').click()
  for (let i = 0; i < 40 && !mock.table('readiness_logs').length; i++) await page.waitForTimeout(500)
  const rk = mock.table('readiness_logs')
  krav(rk.length === 1, `forventede 1 gemt dagsform, fik ${rk.length}`)
  krav(rk[0].energy === 4 && rk[0].sleep_hours === 7.5, `energi/søvn forkert: ${JSON.stringify(rk[0])}`)
  krav(rk[0].motivation == null && rk[0].stress == null && rk[0].soreness_level == null, 'motivation, stress og ømhed skal være tomme')
  if (udenKolonne) krav(afvist === 1 && !('hunger' in rk[0]), `uden kolonnen: forventede ét afvist forsøg og en række uden sult (${afvist}, ${JSON.stringify(rk[0])})`)
  else krav(rk[0].hunger === 2, `sult skal være gemt som 2: ${JSON.stringify(rk[0])}`)
  await page.getByText(/logget i dag/i).first().waitFor({ timeout: 20000 })
  krav(!(await sidetekst(page)).includes('Kunne ikke gemme'), 'atleten ser en gem-fejl')
  await ingenScroll(page, 'a')
}

const trin = [
  ['a: kort Dagsform med sult, kostklient (kolonnen findes)', { forskydning: 3, traening: false }, dagsformTrin(false)],
  ['a: kort Dagsform uden kolonnen (live i dag)', { forskydning: 3, traening: false }, dagsformTrin(true)],
  ['b: dagen efter ugens slut, Hjem og Kost', { forskydning: 7, traening: false }, async page => {
    await page.getByText(NY_UGE).first().waitFor({ timeout: 20000 }); await ingenScroll(page, 'b Hjem')
    await knap(page, 'Åbn kost').click()
    await page.locator('[data-ny-kostuge]').first().waitFor({ timeout: 20000 })
    krav((await sidetekst(page)).includes(NY_UGE), 'Kost viser ikke "Ny kostuge er på vej fra Marc"')
    await ingenScroll(page, 'b Kost')
  }],
  ['b: ingen tekst på sidste dag', { forskydning: 6, traening: false }, async page => {
    await page.getByText('Din kost i dag').first().waitFor({ timeout: 20000 })
    await page.waitForTimeout(1500)
    krav(!(await sidetekst(page)).includes(NY_UGE), 'teksten må ikke stå, mens en plan gælder i dag')
  }],
  ['c: indkøb over Kostlog, kostklient', { forskydning: 6, traening: false }, async page => {
    await knap(page, 'Åbn kost').click(); await knap(page, 'Vis detaljer').click()
    await indkoebOgLog(page)
    // Kostklient-afgørelsen læses asynkront; placeringen skifter, når den er svaret.
    await page.waitForFunction(() => document.querySelector('section[aria-label="Indkøb fra kostplanen"]').getBoundingClientRect().top <
      [...document.querySelectorAll('summary')].find(s => s.textContent.includes('Kostlog og vejning')).getBoundingClientRect().top, null, { timeout: 10000 }).catch(() => {})
    const [indkoeb, log] = await indkoebOgLog(page)
    krav(indkoeb < log, `indkøb (${indkoeb}) skal stå over Kostlog (${log}) for en kostklient`)
    await ingenScroll(page, 'c')
  }],
  ['atlet med træning: Dagsform og Kost som før', { forskydning: 6, traening: true }, async page => {
    await knap(page, 'Udfyld dagsform').waitFor({ timeout: 20000 }); await knap(page, 'Udfyld dagsform').click()
    await page.getByLabel('Motivation 3', { exact: true }).first().waitFor({ timeout: 20000 })
    for (const felt of ['Energi 3', 'Stress 3', 'Ømhed 3']) krav(await page.getByLabel(felt, { exact: true }).count() > 0, `fuld Dagsform mangler ${felt}`)
    krav(await page.getByLabel('Sult 3', { exact: true }).count() === 0, 'fuld Dagsform må ikke have sult')
    krav(!(await sidetekst(page)).includes(NY_UGE), 'træningsatlet må ikke se "ny kostuge"')
    await page.getByRole('button', { name: 'Kost', exact: true }).first().click(); await knap(page, 'Vis detaljer').click()
    const [indkoeb, log] = await indkoebOgLog(page)
    krav(indkoeb > log, `for en atlet med træning skal indkøb stå efter Kostlog (${indkoeb} mod ${log})`)
  }],
]
const vite = await startVite(), browser = await launchBrowser(), errors = []
let fejl = null
try {
  for (const scheme of ['light', 'dark']) for (const [navn, opsaet, run] of trin) {
    const s = seedAtlet(opsaet); const mock = createMockSupabase({ users: s.users, tables: structuredClone(s.tables) }); await mock.listen(MOCK_PORT)
    const ctx = await browser.newContext({ viewport: MOBILE, colorScheme: scheme }); const page = await ctx.newPage()
    page.on('pageerror', err => errors.push(`${navn} ${scheme}: ${err.message}`))
    try { await login(page); await run(page, mock, scheme); console.log(`OK ${navn} ${scheme}`) }
    catch (e) { try { await page.screenshot({ path: `${process.env.TEMP}/2145-fejl-${scheme}.png` }) } catch { /* ignoreret */ } throw new Error(`${navn} ${scheme}: ${e.message}`) }
    finally { await ctx.close(); await mock.close() }
  }
  krav(!errors.length, 'pageerror: ' + errors.join(' | '))
} catch (err) { fejl = err } finally { await browser.close(); await vite.stop() }
if (fejl) { console.error('FEJL:', fejl.message); process.exit(1) }
console.log('2145 e2e grøn')
