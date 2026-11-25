// Ordre 2380 (Marc 25. nov.: kostklienten "følger den i appen uden at spørge"): stop 8 (detaljer-siden) og stop 9 (Dagsform gemt med det samme).
// Måler i mocken ved 390 px med den syntetiske kostklient fra 2145. MAAL=foer|efter; kravene tjekkes kun med MAAL=efter.
// Kør: E2E_VITE_PORT=5280 E2E_MOCK_PORT=8980 VITE_SUPABASE_URL=http://127.0.0.1:8980 E2E_SKAERM=<mappe> MAAL=efter node e2e/kost-detaljer-dagsform-2380.spec.mjs
import { readFileSync } from 'node:fs'
import { createMockSupabase } from './mock-supabase.mjs'
import { ATHLETE_USER } from './fixtures.mjs'
import { startVite, launchBrowser, MOCK_PORT, APP_URL } from './harness.mjs'
import { seed as ugeSeed } from './kost-set-paa-main.spec.mjs'

const MOBILE = { width: 390, height: 844 }
const MAAL = process.env.MAAL === 'efter' ? 'efter' : 'foer'
const plus = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
function seedAtlet(forskydning) {
  const s = ugeSeed()
  s.tables.weeks = []; s.tables.sessions = []; s.tables.exercises = []; s.tables.exercise_logs = []
  s.tables.kostplan_v1_plans.forEach((p, i) => { p.valid_from = plus(s.today, i - forskydning) })
  s.tables.kostplan_v1_versions.forEach((v, i) => { v.effective_from = plus(s.today, i - forskydning) })
  return s
}
const krav = (ok, tekst) => { if (!ok) throw new Error(tekst) }
const knap = (page, navn) => page.getByRole('button', { name: navn, exact: true }).first()
const sidetekst = page => page.locator('body').innerText()
async function login(page, scheme) {
  await page.goto(APP_URL); await page.evaluate(lys => { try { localStorage.clear(); if (lys) localStorage.setItem('entropi:tema', 'lys') } catch { /* ignoreret */ } }, scheme === 'light'); await page.goto(APP_URL)
  await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email); await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
}
const skaerm = async (page, navn) => { if (process.env.E2E_SKAERM) await page.screenshot({ path: `${process.env.E2E_SKAERM}/${navn}.png`, fullPage: false }) }

// Stop 8: detaljer-siden. Tæller blokke og kilde-linjer foran Kopiér i dokumentets rækkefølge.
async function detaljer(page, scheme) {
  await knap(page, 'Åbn kost').click(); await knap(page, 'Vis detaljer').click()
  await page.getByText('Indkøb fra kostplanen').first().waitFor({ timeout: 20000 })
  await knap(page, 'Hele ugen').click()
  await page.getByText(/Mangler at købe: \d+ af \d+ varer/).first().waitFor({ timeout: 20000 })
  const m = await page.evaluate(() => {
    const synlig = el => el.getClientRects().length > 0
    const kopier = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Kopiér indkøbsliste')
    const alle = [...document.querySelectorAll('summary')]
    const kilde = alle.filter(s => s.textContent.trim() === 'Kilde og varegrundlag')
    const foer = el => Boolean(kopier.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING)
    const kilder = alle.filter(s => s.textContent.trim() === 'Kilder')
    return { kopierY: Math.round(kopier.getBoundingClientRect().top + window.scrollY), dokumentHoejde: document.documentElement.scrollHeight,
      kildeLinjerIDom: kilde.length, kildeLinjerForKopier: kilde.filter(foer).length, kildeLinjerSynlige: kilde.filter(synlig).length,
      kilderOverskrifter: kilder.length, kilderLukket: kilder.every(s => !s.parentElement.open),
      overskrifterForKopier: [...document.querySelectorAll('h2, h3')].filter(foer).map(e => e.textContent.trim()),
      summariesForKopier: alle.filter(foer).map(e => e.textContent.trim().slice(0, 40)),
      varer: document.querySelectorAll('ul[aria-label="Samlet bruttobehov"] > li').length }
  })
  const t = await sidetekst(page)
  for (const del of ['Dagens kostvane', 'Færdig for i dag', 'Vælg plandato']) m['har ' + del] = t.includes(del)
  await page.getByRole('button', { name: 'Kopiér indkøbsliste', exact: true }).scrollIntoViewIfNeeded()
  await page.evaluate(() => window.scrollBy(0, -60))
  await skaerm(page, `detaljer-${scheme}`)
  return m
}

// Stop 9: Dagsform. Tid fra tryk på Gem til "Gemt" med Fortryd, og om Hjem stadig siger "Mangler i dag: ... dagsform".
async function dagsform(page, mock, scheme, fejl) {
  if (fejl) await page.route('**/rest/v1/readiness_logs*', route => route.request().method() === 'POST'
    ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'XX000', message: 'syntetisk fejl' }) }) : route.fallback())
  await page.getByText('Din kost i dag').first().waitFor({ timeout: 20000 })
  await page.getByText(/Mangler i dag:.*dagsform/).first().waitFor({ timeout: 20000 })
  await knap(page, 'Udfyld dagsform').click()
  await page.getByLabel('Energi 4', { exact: true }).first().click()
  await page.getByLabel('Søvn (timer, valgfrit)').fill('7,5')
  await knap(page, 'Gem').click()
  const start = Date.now(); let gemtMs = null, fortryd = false, raekkeMs = null, kvitteringMs = null
  while (Date.now() - start < 9000) {
    const t = await sidetekst(page)
    if (raekkeMs === null && mock.table('readiness_logs').length) raekkeMs = Date.now() - start
    if (kvitteringMs === null && /logget i dag/i.test(t)) kvitteringMs = Date.now() - start
    if (gemtMs === null && /\bGemt\b/.test(t)) { gemtMs = Date.now() - start; fortryd = await knap(page, 'Fortryd').count() > 0 }
    if (fejl && /Kunne ikke gemme/.test(t)) break
    if (gemtMs !== null && raekkeMs !== null && kvitteringMs !== null) break
    await page.waitForTimeout(50)
  }
  const efter = await sidetekst(page)
  const r = { gemtMs, raekkeMs, kvitteringMs, fortrydVises: fortryd, hjemMangler: /Mangler i dag:.*dagsform/.test(efter), raekker: mock.table('readiness_logs').length,
    ventedeTekst: /Gemmer om 5 sekunder/.test(efter), fejlTekst: (efter.match(/Kunne ikke[^.\n]*\./) ?? [null])[0] }
  if (!fejl) await skaerm(page, `dagsform-${scheme}`)
  return r
}

async function fortrydTrin(page, mock) {
  await knap(page, 'Fortryd').click()
  for (let i = 0; i < 40 && mock.table('readiness_logs').length; i++) await page.waitForTimeout(100)
  await page.waitForTimeout(300)
  const t = await sidetekst(page)
  return { raekkerEfterFortryd: mock.table('readiness_logs').length, hjemMangler: /Mangler i dag:.*dagsform/.test(t), formularTilbage: await knap(page, 'Gem').count() > 0 }
}

const vite = await startVite(), browser = await launchBrowser(), errors = [], ud = { maal: MAAL }
let fejlen = null
try {
  for (const scheme of ['light', 'dark']) {
    for (const [navn, forskydning] of [['detaljer', 6], ['dagsform', 3], ['dagsformFejl', 3]]) {
      if (scheme === 'dark' && navn === 'dagsformFejl') continue
      const s = seedAtlet(forskydning); const mock = createMockSupabase({ users: s.users, tables: structuredClone(s.tables) }); await mock.listen(MOCK_PORT)
      const ctx = await browser.newContext({ viewport: MOBILE, colorScheme: scheme }); const page = await ctx.newPage()
      page.on('pageerror', err => errors.push(`${navn} ${scheme}: ${err.message}`))
      try {
        await login(page, scheme)
        if (navn === 'detaljer') ud[`detaljer-${scheme}`] = await detaljer(page, scheme)
        else {
          ud[`${navn}-${scheme}`] = await dagsform(page, mock, scheme, navn === 'dagsformFejl')
          if (MAAL === 'efter' && navn === 'dagsform' && ud[`${navn}-${scheme}`].fortrydVises) ud[`fortryd-${scheme}`] = await fortrydTrin(page, mock)
        }
      } finally { await ctx.close(); await mock.close() }
    }
  }
  console.log(JSON.stringify(ud, null, 1))
  // Lys og mørk Dagsform ved siden af hinanden i ét billede (højst 3 billeder i planmappen).
  if (process.env.E2E_SKAERM) {
    const png = n => `data:image/png;base64,${readFileSync(`${process.env.E2E_SKAERM}/${n}.png`).toString('base64')}`
    const samlet = await browser.newPage({ viewport: { width: MOBILE.width * 2 + 10, height: MOBILE.height } })
    await samlet.setContent(`<body style="margin:0;display:flex;gap:10px;background:#888"><img src="${png('dagsform-light')}"><img src="${png('dagsform-dark')}"></body>`)
    await samlet.screenshot({ path: `${process.env.E2E_SKAERM}/dagsform-lys-moerk.png` }); await samlet.close()
  }
  if (MAAL === 'efter') {
    for (const scheme of ['light', 'dark']) {
      const d = ud[`detaljer-${scheme}`], g = ud[`dagsform-${scheme}`]
      krav(d.kildeLinjerForKopier === 0, `${scheme}: ${d.kildeLinjerForKopier} kilde-linjer står stadig før Kopiér`)
      krav(d.kilderOverskrifter === 1 && d.kilderLukket, `${scheme}: forventede ét lukket "Kilder"`)
      krav(g.gemtMs !== null && g.gemtMs < 1500 && g.fortrydVises && !g.ventedeTekst, `${scheme}: Gemt med Fortryd kom ikke straks (${JSON.stringify(g)})`)
      krav(!g.hjemMangler && g.raekker === 1, `${scheme}: Hjem siger stadig mangler dagsform eller rækken blev ikke skrevet`)
      const f = ud[`fortryd-${scheme}`]
      krav(f && f.raekkerEfterFortryd === 0 && f.hjemMangler && f.formularTilbage, `${scheme}: Fortryd gendanner ikke (${JSON.stringify(f)})`)
    }
    const fe = ud['dagsformFejl-light']
    krav(fe.fejlTekst && fe.raekker === 0 && fe.gemtMs === null, `skrivefejl skal vise en dansk fejl (${JSON.stringify(fe)})`)
  }
  krav(!errors.length, 'pageerror: ' + errors.join(' | '))
} catch (err) { fejlen = err } finally { await browser.close(); await vite.stop() }
if (fejlen) { console.error('FEJL:', fejlen.message); process.exit(1) }
console.log('2380 e2e færdig', MAAL)
