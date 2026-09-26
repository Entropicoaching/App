// ORDRE 406: kopi af outputs/kritik-403/scenarier.mjs (Bhishak, ordre 403), koert mod grenen
// dagens-pas-offline-3. AEndret: build-mappen, hvor resultaterne lander (her: outputs/406/),
// log-ud proever ogsaa at logge ind uden net (O3), og et tiende scenarie o2-anden-telefon (O2).
// Original-hovedet foelger.
// ORDRE 403 blok 1: atleten i kaelderen.
// Ret intet: scriptet koerer appen, som den staar paa main, og noterer hvad der sker.
//
// Headless Chromium 390x844 (mobil, DSF 2) mod e2e-mocken (e2e/mock-supabase.mjs,
// aldrig prod). Appen bygges til en midlertidig mappe (ikke dist/), serveres
// lokalt med public/sw.js som i prod. Seed = e2e/fixtures.mjs + en ekstra oevelse
// (Baenkpres, 2 saet), saa der kan logges 5 saet; skift-atlet faar en fiktiv atlet B.
//
// Scenarier (node outputs/kritik-403/scenarier.mjs [navn ...], uden navn: alle):
//   kaelder       aabn online, aabn igen uden net, log 3 saet, luk appen midt i
//                 saet 4, aabn igen uden net, log saet 5, gaa online
//   online-start  appen aabnet MED net (det almindelige), saet 1 online, genaabnet,
//                 saet 2 online, nettet vaek, saet 3, nettet tilbage ('online')
//   aabn-med-net  3 saet uden net, appen lukket og aabnet igen hjemme med net
//   haenger       wifi uden internet efter aabning med net; nettet kommer igen
//                 uden 'online'-event
//   to-faner      to faner paa samme telefon, begge uden net, begge logger
//   log-ud        log ud mens koeen har 2 saet, log ind igen med net
//   skift-atlet   atlet A har 2 saet i koeen, logger ud; atlet B logger ind paa samme telefon
//   sw-opdatering ny service worker + ny build mens koeen har 2 saet
//   forkert-ur    telefonens ur 7 dage bagud
//
// Resultat: outputs/kritik-403/<navn>/*.png og outputs/kritik-403/resultat-<navn>.json.
// Scriptet fejler kun, hvis selve koerslen gaar i stykker; hvad appen goer, er data
// (verify-kritik-403.mjs holder dataene op mod fundene i KRITIK-offline-pas.md).
import { createServer } from 'node:http'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const HERE = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const ROOT = path.join(HERE, '..', '..')
const BUILD = path.join(tmpdir(), 'ordre-406-dist')
const MOCK_PORT = Number(process.env.KRITIK403_MOCK_PORT || 8997)
const MOCK_URL = `http://127.0.0.1:${MOCK_PORT}`
const MOCK_KEY = 'mock-anon-key-kritik-403'
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' }

const BENCH_ID = 'cccccccc-0403-4403-8403-cccccccccccc'
// Fiktiv atlet B (skift-atlet). Ingen rigtige personer.
const B_USER = { id: 'dddddddd-0403-4403-8403-dddddddddddd', email: 'atlet-b@e2e.test', password: 'e2e-pass-atlet-b', role: 'athlete' }
const B_ATHLETE = 'eeeeeeee-0403-4403-8403-eeeeeeeeeeee'
const B_WEEK = 'ffffffff-0403-4403-8403-ffffffffffff'
const B_SESSION = 'abababab-0403-4403-8403-abababababab'
const B_EXERCISE = 'cdcdcdcd-0403-4403-8403-cdcdcdcdcdcd'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function lavSeed(fx, { atletB = false } = {}) {
  const s = fx.buildSeed()
  s.tables.exercises.push({ id: BENCH_ID, session_id: fx.SESSION_ID, name: 'Baenkpres', sets: 2, reps: '6', intensity: 'RPE 7', note: null, exercise_order: 2, recommended_weight: 60 })
  if (atletB) {
    const wd = (() => { const d = new Date().getDay(); return d === 0 ? 6 : d - 1 })()
    s.users.push(B_USER)
    s.tables.profiles.push({ id: B_USER.id, role: 'athlete', email: B_USER.email, last_seen: null })
    s.tables.athletes.push({ id: B_ATHLETE, user_id: B_USER.id, name: 'Testatlet B', email: B_USER.email, status: 'active', hidden: false, snooze_until: null, competition_date: null, onboarding_completed_at: new Date().toISOString() })
    s.tables.weeks.push({ id: B_WEEK, athlete_id: B_ATHLETE, week_number: 1, block_name: 'Base' })
    s.tables.sessions.push({ id: B_SESSION, week_id: B_WEEK, title: 'Dag 1 - Dødløft', session_order: 1, weekday: wd, athlete_rating: null, athlete_comment: null })
    s.tables.exercises.push({ id: B_EXERCISE, session_id: B_SESSION, name: 'Dødløft', sets: 3, reps: '5', intensity: 'RPE 7', note: null, exercise_order: 1, recommended_weight: 100 })
  }
  return s
}

function startStaticServer(overrides) {
  const server = createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0])
    if (overrides[urlPath]) {
      res.writeHead(200, { 'content-type': MIME[path.extname(urlPath)] || 'text/plain', 'cache-control': 'no-store' })
      res.end(overrides[urlPath]); return
    }
    let filePath = path.join(BUILD, urlPath === '/' ? '/index.html' : urlPath)
    if (!filePath.startsWith(BUILD)) { res.writeHead(403); res.end(); return }
    try {
      const data = readFileSync(filePath)
      res.writeHead(200, { 'content-type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' })
      res.end(data)
    } catch {
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end(readFileSync(path.join(BUILD, 'index.html')))
    }
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })))
}

// ---- hjaelpere ---------------------------------------------------------------
const koeNoegle = (athleteId) => `entropi_offline_sets:${athleteId}`

async function koe(page, athleteId) {
  return page.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k) || '{}') } catch { return {} } }, koeNoegle(athleteId))
}

async function raekker(athleteId) {
  const rows = await (await fetch(`${MOCK_URL}/__e2e/table?name=exercise_logs`)).json()
  return rows.filter((r) => r.athlete_id === athleteId && !r.skipped)
}

function taelPrSaet(rows, exId, n) {
  return Array.from({ length: n }, (_, i) => rows.filter((r) => r.exercise_id === exId && r.set_number === i + 1).length)
}

// Det atleten ser: naeste saet i Dagens pas og de linjer der handler om net/koe.
async function skaerm(page) {
  return page.evaluate(() => {
    const t = document.body.innerText
    const saet = (t.match(/Sæt \d+\/\d+/g) || [])[0] || null
    const linjer = t.split('\n').map((l) => l.trim()).filter((l) =>
      /gemt lokalt|sendes når|Ingen forbindelse|Forbindelsen er svag|kunne ikke sendes|Passet er færdigt|Log ind|Kunne ikke/.test(l))
    return { naesteSaet: saet, linjer: [...new Set(linjer)].slice(0, 8), godkendtKnap: !!Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Godkendt' && !b.getAttribute('aria-label')?.includes('ret sæt')) }
  }).catch(() => ({ naesteSaet: null, linjer: [], godkendtKnap: false }))
}

async function vent(fn, ms, trinMs = 250) {
  const slut = Date.now() + ms
  while (Date.now() < slut) {
    try { if (await fn()) return true } catch { /* side under navigation */ }
    await sleep(trinMs)
  }
  return false
}

async function logInd(page, user) {
  await page.goto(page.__origin)
  await page.locator('#athlete-auth-email').fill(user.email)
  await page.locator('#athlete-auth-password').fill(user.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  await page.getByText('Dagens pas', { exact: true }).waitFor({ state: 'visible', timeout: 30000 })
}

// Log ind, lad service workeren tage kontrol (reload), og vent til
// oejebliksbilledet af ugen er gemt (saa appen kan aabne uden net).
async function logIndOgVarm(page, user) {
  await logInd(page, user)
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await page.getByText('Dagens pas', { exact: true }).waitFor({ state: 'visible', timeout: 30000 })
  await page.getByText(/Sæt \d+\/\d+/).first().waitFor({ state: 'visible', timeout: 15000 })
  await vent(() => page.evaluate(() => {
    const k = Object.keys(localStorage).find((x) => x.startsWith('entropi_offline_pas:'))
    const s = k && JSON.parse(localStorage.getItem(k))
    return !!(s && s.week)
  }), 15000)
}

// Et tryk paa "Godkendt" i Dagens pas. Returnerer det saet der stod, og hvornaar.
async function godkend(page) {
  const foer = (await skaerm(page)).naesteSaet
  const kl = await page.evaluate(() => Date.now())
  await page.getByRole('button', { name: 'Godkendt', exact: true }).click()
  await vent(async () => (await skaerm(page)).naesteSaet !== foer, 3000, 100)
  await sleep(300)
  return { saet: foer, kl }
}

async function nyKontekst(browser, { initScript } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: MOBILE_UA })
  if (initScript) await context.addInitScript(initScript)
  return context
}

async function nySide(context, origin, konsol) {
  const page = await context.newPage()
  page.__origin = origin
  page.on('pageerror', (e) => konsol.push(String(e).slice(0, 300)))
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_INTERNET_DISCONNECTED|ERR_FAILED|Failed to fetch|AbortError|signal is aborted|409|Failed to load resource/.test(m.text())) konsol.push(m.text().slice(0, 300)) })
  return page
}

// ---- scenarier ---------------------------------------------------------------

async function kaelder({ browser, origin, fx, trin, shot, r, konsol }) {
  const context = await nyKontekst(browser)
  let page = await nySide(context, origin, konsol)
  await logIndOgVarm(page, fx.ATHLETE_USER)
  trin('online: logget ind, service worker styrer siden, ugen gemt paa telefonen')
  await shot(page, '01-online')

  await context.setOffline(true)
  const t0 = Date.now()
  await page.reload()
  await page.getByText(/Sæt \d+\/\d+/).first().waitFor({ state: 'visible', timeout: 20000 })
  r.aabnUdenNetMs = Date.now() - t0
  r.skaermVedAabning = await skaerm(page)
  trin(`uden net: appen aabnet paa ${r.aabnUdenNetMs} ms, viser ${r.skaermVedAabning.naesteSaet}`)
  await shot(page, '02-aabnet-uden-net')

  const godkendt = {}
  for (let i = 0; i < 3; i++) { const g = await godkend(page); godkendt[g.saet + ' Squat'] = g.kl; await sleep(700) }
  r.skaermEfter3 = await skaerm(page)
  r.koeEfter3 = Object.keys(await koe(page, fx.ATHLETE_ID)).length
  trin(`3 saet logget uden net; koeen har ${r.koeEfter3}; skaermen: ${JSON.stringify(r.skaermEfter3.linjer)}`)
  await shot(page, '03-tre-saet-uden-net')

  // Saet 4: tryk, og luk appen straks (telefonen draeber den / atleten swiper den vaek).
  const s4 = (await skaerm(page)).naesteSaet
  godkendt[s4 + ' Squat'] = await page.evaluate(() => Date.now())
  await page.getByRole('button', { name: 'Godkendt', exact: true }).click()
  await page.close({ runBeforeUnload: false })
  trin(`${s4}: "Godkendt" trykket, appen lukket med det samme`)

  page = await nySide(context, origin, konsol)
  await page.goto(origin)
  await page.getByText(/Sæt \d+\/\d+/).first().waitFor({ state: 'visible', timeout: 20000 })
  r.skaermGenaabnet = await skaerm(page)
  r.koeGenaabnet = Object.keys(await koe(page, fx.ATHLETE_ID)).length
  trin(`genaabnet uden net: koeen har ${r.koeGenaabnet} saet, skaermen viser ${r.skaermGenaabnet.naesteSaet} ${JSON.stringify(r.skaermGenaabnet.linjer)}`)
  await shot(page, '04-genaabnet-uden-net')

  const g5 = await godkend(page)
  godkendt[g5.saet + ' Baenkpres'] = g5.kl
  r.skaermEfter5 = await skaerm(page)
  const k = await koe(page, fx.ATHLETE_ID)
  r.koeEfter5 = Object.keys(k).length
  trin(`5. saet (${g5.saet}) logget; koeen har ${r.koeEfter5}; ${JSON.stringify(r.skaermEfter5.linjer)}`)
  await shot(page, '05-fem-saet-venter')

  await sleep(3000)
  const online = Date.now()
  await context.setOffline(false)
  r.koeTomt = await vent(async () => Object.keys(await koe(page, fx.ATHLETE_ID)).length === 0, 60000)
  r.sendtEfterMs = Date.now() - online
  await sleep(2500)
  r.skaermEfterSendt = await skaerm(page)
  await shot(page, '06-online-sendt')
  const rows = await raekker(fx.ATHLETE_ID)
  r.squatPrSaet = taelPrSaet(rows, fx.EXERCISE_ID, 4)
  r.baenkPrSaet = taelPrSaet(rows, BENCH_ID, 2)
  r.tidRigtig = Object.values(k).every((e) => rows.some((row) => row.id === e.clientId && row.logged_at === e.payload.logged_at))
  r.forsinkelseMin = Math.min(...rows.map((row) => online - Date.parse(row.logged_at)))
  trin(`online: koeen tom=${r.koeTomt} efter ${r.sendtEfterMs} ms; raekker squat ${JSON.stringify(r.squatPrSaet)} baenk ${JSON.stringify(r.baenkPrSaet)}; tid fra "Godkendt" bevaret=${r.tidRigtig}; skaermen viser nu ${r.skaermEfterSendt.naesteSaet} ${JSON.stringify(r.skaermEfterSendt.linjer)}`)
  await context.close()
}

// Det almindelige: appen er aabnet MED net (hjemme, i omklaedningsrummet), og nettet
// forsvinder foerst i kaelderen. Saet 1 er logget i en tidligere aabning af appen.
async function onlineStart({ browser, origin, fx, trin, shot, r, konsol }) {
  const context = await nyKontekst(browser)
  const page = await nySide(context, origin, konsol)
  await logIndOgVarm(page, fx.ATHLETE_USER)
  await godkend(page)
  await vent(async () => (await raekker(fx.ATHLETE_ID)).length >= 1, 10000)
  trin('online: saet 1 logget og gemt')
  await page.reload()
  await page.getByText('Sæt 2/4', { exact: true }).waitFor({ state: 'visible', timeout: 20000 })
  await godkend(page)
  await vent(async () => (await raekker(fx.ATHLETE_ID)).length >= 2, 10000)
  trin('appen genaabnet med net; saet 2 logget og gemt')
  await shot(page, '01-online-to-saet')

  await context.setOffline(true)
  await sleep(500)
  const g3 = await godkend(page)
  r.skaermUdenNet = await skaerm(page)
  trin(`nettet vaek (ingen genaabning): ${g3.saet} logget; ${JSON.stringify(r.skaermUdenNet.linjer)}`)
  await shot(page, '02-uden-net-saet-3')

  await sleep(2000)
  await context.setOffline(false)
  r.koeTomt = await vent(async () => Object.keys(await koe(page, fx.ATHLETE_ID)).length === 0, 60000)
  await sleep(3000)
  r.skaermEfterSendt = await skaerm(page)
  r.raekkerEfterSendt = taelPrSaet(await raekker(fx.ATHLETE_ID), fx.EXERCISE_ID, 4)
  trin(`nettet tilbage: koeen tom=${r.koeTomt}; mocken ${JSON.stringify(r.raekkerEfterSendt)}; Dagens pas viser nu "${r.skaermEfterSendt.naesteSaet}" (rigtigt ville vaere Sæt 4/4)`)
  await shot(page, '03-online-igen-hvad-ser-atleten')

  // Hvad goer en atlet, der ser "Sæt 1/4" igen? Trykker "Godkendt" (tallene staar der).
  if (r.skaermEfterSendt.naesteSaet && r.skaermEfterSendt.naesteSaet !== 'Sæt 4/4') {
    const g = await godkend(page)
    await sleep(3000)
    const rows = await raekker(fx.ATHLETE_ID)
    r.atletTrykkerIgen = { saet: g.saet, raekker: taelPrSaet(rows, fx.EXERCISE_ID, 4), skaerm: await skaerm(page) }
    trin(`atleten trykker "Godkendt" paa ${g.saet}: mocken ${JSON.stringify(r.atletTrykkerIgen.raekker)}; skaermen viser nu ${r.atletTrykkerIgen.skaerm.naesteSaet}`)
    await shot(page, '04-atleten-trykker-igen')
  }
  await context.close()
}

// Kaelderen og saa hjem: saet logget uden net, appen lukket, aabnet igen med net.
async function aabnMedNet({ browser, origin, fx, trin, shot, r, konsol }) {
  const context = await nyKontekst(browser)
  let page = await nySide(context, origin, konsol)
  await logIndOgVarm(page, fx.ATHLETE_USER)
  await context.setOffline(true)
  await sleep(500)
  await godkend(page); await godkend(page); await godkend(page)
  r.koeFoer = Object.keys(await koe(page, fx.ATHLETE_ID)).length
  trin(`uden net: ${r.koeFoer} saet i koeen; appen lukkes`)
  await page.close({ runBeforeUnload: false })
  await context.setOffline(false)
  page = await nySide(context, origin, konsol)
  await page.goto(origin)
  await page.getByText(/Sæt \d+\/\d+/).first().waitFor({ state: 'visible', timeout: 20000 })
  r.koeTomt = await vent(async () => Object.keys(await koe(page, fx.ATHLETE_ID)).length === 0, 30000)
  await sleep(3000)
  r.raekker = taelPrSaet(await raekker(fx.ATHLETE_ID), fx.EXERCISE_ID, 4)
  r.skaermEfter3s = await skaerm(page)
  const tid1 = async () => (await raekker(fx.ATHLETE_ID)).find((x) => x.exercise_id === fx.EXERCISE_ID && x.set_number === 1)?.logged_at
  r.saet1TidFoer = await tid1()
  trin(`aabnet med net: koeen tom=${r.koeTomt}; mocken ${JSON.stringify(r.raekker)}; Dagens pas viser "${r.skaermEfter3s.naesteSaet}" (rigtigt: Sæt 4/4)`)
  await shot(page, '01-aabnet-med-net')
  await sleep(25000)
  r.skaermEfter28s = await skaerm(page)
  trin(`28 s senere: Dagens pas viser stadig "${r.skaermEfter28s.naesteSaet}"`)
  if (r.skaermEfter28s.naesteSaet === 'Sæt 1/4') {
    const g = await godkend(page)
    await sleep(3000)
    r.atletTrykkerIgen = { saet: g.saet, raekker: taelPrSaet(await raekker(fx.ATHLETE_ID), fx.EXERCISE_ID, 4), skaerm: await skaerm(page) }
    r.saet1TidEfter = await tid1()
    r.saet1TidFlyttetS = Math.round((Date.parse(r.saet1TidEfter) - Date.parse(r.saet1TidFoer)) / 1000)
    trin(`atleten trykker "Godkendt" paa ${g.saet}: mocken ${JSON.stringify(r.atletTrykkerIgen.raekker)}; saet 1's tid flyttet ${r.saet1TidFlyttetS} s frem (fra kaelder-tiden til nu); skaermen viser nu ${r.atletTrykkerIgen.skaerm.naesteSaet}`)
    await shot(page, '02-atleten-trykker-igen')
  }
  await context.close()
}

async function haenger({ browser, origin, fx, trin, shot, r, konsol }) {
  const context = await nyKontekst(browser)
  const page = await nySide(context, origin, konsol)
  await logIndOgVarm(page, fx.ATHLETE_USER)
  await godkend(page)
  await vent(async () => (await raekker(fx.ATHLETE_ID)).length >= 1, 10000)
  trin('online: saet 1 logget')

  let haeng = true
  let slip
  const sluppet = new Promise((res) => { slip = res })
  await context.route(`${MOCK_URL}/**`, async (route) => {
    if (!haeng) return route.continue().catch(() => {})
    await sluppet
    return route.abort('failed').catch(() => {})
  })
  const g2 = await godkend(page)
  await page.getByText('1 sæt gemt lokalt', { exact: false }).waitFor({ state: 'visible', timeout: 20000 }).catch(() => {})
  r.markering2Ms = Date.now() - g2.kl
  await godkend(page)
  await sleep(800)
  r.skaermHaenger = await skaerm(page)
  trin(`wifi uden internet: saet 2 markeret efter ${r.markering2Ms} ms; ${JSON.stringify(r.skaermHaenger.linjer)}`)
  await shot(page, '01-haenger-to-venter')

  haeng = false
  slip()
  const tilbage = Date.now()
  r.koeTomt = await vent(async () => Object.keys(await koe(page, fx.ATHLETE_ID)).length === 0, 60000)
  r.sendtEfterMs = Date.now() - tilbage
  await context.unroute(`${MOCK_URL}/**`)
  await sleep(3000)
  r.skaermEfterSendt = await skaerm(page)
  r.raekker = taelPrSaet(await raekker(fx.ATHLETE_ID), fx.EXERCISE_ID, 4)
  trin(`nettet virker igen: koeen tom=${r.koeTomt} efter ${r.sendtEfterMs} ms; mocken ${JSON.stringify(r.raekker)}; Dagens pas viser ${r.skaermEfterSendt.naesteSaet}`)
  await shot(page, '02-haenger-sendt')
  await context.close()
}

async function toFaner({ browser, origin, fx, trin, shot, r, konsol }) {
  const context = await nyKontekst(browser)
  const a = await nySide(context, origin, konsol)
  await logIndOgVarm(a, fx.ATHLETE_USER)
  const b = await nySide(context, origin, konsol)
  await b.goto(origin)
  await b.getByText(/Sæt \d+\/\d+/).first().waitFor({ state: 'visible', timeout: 20000 })
  trin('to faner aabne, begge logget ind, begge viser Sæt 1/4')

  await context.setOffline(true)
  await sleep(500)
  await godkend(a); await godkend(a)
  r.fanebFoer = await skaerm(b)
  trin(`uden net: fane A har logget saet 1 og 2; fane B viser stadig ${r.fanebFoer.naesteSaet}`)
  await shot(b, '01-fane-b-ved-ikke-noget')
  const gb = await godkend(b)
  r.fanebLoggede = gb.saet
  r.koe = Object.keys(await koe(a, fx.ATHLETE_ID)).length
  trin(`fane B trykker "Godkendt" paa ${gb.saet}; koeen har ${r.koe} poster`)

  await context.setOffline(false)
  r.koeTomt = await vent(async () => Object.keys(await koe(a, fx.ATHLETE_ID)).length === 0, 60000)
  await sleep(3000)
  r.raekker = taelPrSaet(await raekker(fx.ATHLETE_ID), fx.EXERCISE_ID, 4)
  r.skaermA = await skaerm(a)
  r.skaermB = await skaerm(b)
  trin(`online: koeen tom=${r.koeTomt}; mocken ${JSON.stringify(r.raekker)}; fane A viser ${r.skaermA.naesteSaet}, fane B viser ${r.skaermB.naesteSaet}`)
  await shot(a, '02-fane-a-efter')
  await shot(b, '03-fane-b-efter')
  await context.close()
}

async function logUd(page) {
  await page.getByRole('button', { name: 'Konto' }).click()
  await page.getByRole('button', { name: 'Log ud' }).click()
  const tekst = await page.evaluate(() => document.body.innerText.split('\n').find((l) => /Log ud af Entropi/.test(l)) || null)
  await page.getByRole('button', { name: 'Bekræft' }).click()
  return tekst
}

async function logUdScenarie({ browser, origin, fx, trin, shot, r, konsol }) {
  const context = await nyKontekst(browser)
  const page = await nySide(context, origin, konsol)
  await logIndOgVarm(page, fx.ATHLETE_USER)
  await context.setOffline(true)
  await sleep(500)
  await godkend(page); await godkend(page)
  trin('uden net: 2 saet i koeen')
  await page.getByRole('button', { name: 'Konto' }).click()
  await page.getByRole('button', { name: 'Log ud' }).click()
  r.bekraeftTekst = await page.evaluate(() => document.body.innerText.split('\n').find((l) => /Log ud af Entropi/.test(l)) || null)
  await shot(page, '01-log-ud-spoergsmaal')
  const t0 = Date.now()
  await page.getByRole('button', { name: 'Bekræft' }).click()
  await page.locator('#athlete-auth-email').waitFor({ state: 'visible', timeout: 20000 }).catch(() => {})
  r.logUdMs = Date.now() - t0
  r.skaermEfterLogUd = await skaerm(page)
  r.koeEfterLogUd = Object.keys(await koe(page, fx.ATHLETE_ID)).length
  trin(`log ud uden net: spoergsmaalet var "${r.bekraeftTekst}"; login-skaerm efter ${r.logUdMs} ms; koeen ligger stadig paa telefonen: ${r.koeEfterLogUd}`)
  await shot(page, '02-login-uden-net')
  // ORDRE 406: atleten proever at logge ind igen uden net.
  await page.locator('#athlete-auth-email').fill(fx.ATHLETE_USER.email).catch(() => {})
  await page.locator('#athlete-auth-password').fill(fx.ATHLETE_USER.password).catch(() => {})
  await page.getByRole('button', { name: 'Log ind' }).click().catch(() => {})
  await sleep(1500)
  r.loginUdenNetTekst = await page.evaluate(() => document.body.innerText.split('\n').find((l) => /forbindelse|Tjek oplysningerne|forkert/i.test(l)) || null)
  trin(`log ind uden net: "${r.loginUdenNetTekst}"`)
  await shot(page, '02b-log-ind-uden-net')

  await context.setOffline(false)
  await logInd(page, fx.ATHLETE_USER)
  r.koeTomt = await vent(async () => Object.keys(await koe(page, fx.ATHLETE_ID)).length === 0, 30000)
  await sleep(2000)
  r.raekker = taelPrSaet(await raekker(fx.ATHLETE_ID), fx.EXERCISE_ID, 4)
  r.skaermEfterLogInd = await skaerm(page)
  trin(`logget ind igen med net: koeen tom=${r.koeTomt}; mocken ${JSON.stringify(r.raekker)}; ${r.skaermEfterLogInd.naesteSaet}`)
  await shot(page, '03-logget-ind-igen')
  await context.close()
}

// ORDRE 406 (O2): telefon A er aabnet med net og viser "Sæt 1/4". Saet 1 logges
// fra telefon B. A ved det ikke og trykker "Godkendt": der maa ikke komme en
// dublet, og saet 1 skal beholde B's tid.
async function o2AndenTelefon({ browser, origin, fx, trin, shot, r }) {
  const ctxA = await nyKontekst(browser)
  const a = await nySide(ctxA, origin, [])
  await logIndOgVarm(a, fx.ATHLETE_USER)
  r.aSkaermFoer = await skaerm(a)
  const ctxB = await nyKontekst(browser)
  const b = await nySide(ctxB, origin, [])
  await logInd(b, fx.ATHLETE_USER)
  await b.getByText(/Sæt \d+\/\d+/).first().waitFor({ state: 'visible', timeout: 15000 })
  await godkend(b)
  await vent(async () => (await raekker(fx.ATHLETE_ID)).length >= 1, 10000)
  const bRow = (await raekker(fx.ATHLETE_ID)).find((x) => x.set_number === 1)
  r.bTid = bRow?.logged_at || null
  trin(`telefon B loggede saet 1 (${r.bTid}); telefon A viser stadig "${r.aSkaermFoer.naesteSaet}"`)
  await sleep(1500)
  const g = await godkend(a)
  await sleep(3000)
  const rows = await raekker(fx.ATHLETE_ID)
  r.raekker = taelPrSaet(rows, fx.EXERCISE_ID, 4)
  r.saet1Tid = rows.find((x) => x.exercise_id === fx.EXERCISE_ID && x.set_number === 1)?.logged_at || null
  r.koeTomt = Object.keys(await koe(a, fx.ATHLETE_ID)).length === 0
  r.aSkaermEfter = await skaerm(a)
  trin(`telefon A trykker "Godkendt" paa ${g.saet}: mocken ${JSON.stringify(r.raekker)}; saet 1's tid ${r.saet1Tid === r.bTid ? 'uaendret' : 'flyttet til ' + r.saet1Tid}; koeen tom=${r.koeTomt}; A viser ${r.aSkaermEfter.naesteSaet}`)
  await shot(a, '01-telefon-a-efter-godkendt')
  await ctxA.close(); await ctxB.close()
}

async function skiftAtlet({ browser, origin, fx, trin, shot, r, konsol }) {
  const context = await nyKontekst(browser)
  const page = await nySide(context, origin, konsol)
  await logIndOgVarm(page, fx.ATHLETE_USER)
  await context.setOffline(true)
  await sleep(500)
  await godkend(page); await godkend(page)
  trin('atlet A uden net: 2 saet i koeen')
  await logUd(page)
  await page.locator('#athlete-auth-email').waitFor({ state: 'visible', timeout: 20000 }).catch(() => {})
  await context.setOffline(false)
  await logInd(page, B_USER)
  await page.getByText(/Sæt \d+\/\d+/).first().waitFor({ state: 'visible', timeout: 20000 })
  await sleep(4000)
  r.aRaekkerMensB = (await raekker(fx.ATHLETE_ID)).length
  r.aKoeMensB = Object.keys(await koe(page, fx.ATHLETE_ID)).length
  r.skaermB = await skaerm(page)
  r.bSerAsSaet = r.skaermB.linjer.some((l) => /gemt lokalt|sendes/.test(l))
  r.bRaekker = (await raekker(B_ATHLETE)).length
  r.oejebliksbilleder = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('entropi_offline_pas:')).length)
  trin(`atlet B logget ind med net: A's saet i mocken=${r.aRaekkerMensB}, A's koe paa telefonen=${r.aKoeMensB}, B ser A's ventende saet=${r.bSerAsSaet}, B viser ${r.skaermB.naesteSaet}`)
  await shot(page, '01-atlet-b-logget-ind')
  await logUd(page)
  await page.locator('#athlete-auth-email').waitFor({ state: 'visible', timeout: 20000 })
  await logInd(page, fx.ATHLETE_USER)
  r.koeTomt = await vent(async () => Object.keys(await koe(page, fx.ATHLETE_ID)).length === 0, 30000)
  await sleep(2000)
  r.aRaekker = taelPrSaet(await raekker(fx.ATHLETE_ID), fx.EXERCISE_ID, 4)
  r.bRaekkerEfter = (await raekker(B_ATHLETE)).length
  trin(`atlet A logget ind igen: koeen tom=${r.koeTomt}; A's raekker ${JSON.stringify(r.aRaekker)}; B's raekker ${r.bRaekkerEfter}`)
  await shot(page, '02-atlet-a-igen')
  await context.close()
}

async function swOpdatering({ browser, origin, fx, trin, shot, r, konsol, overrides }) {
  const context = await nyKontekst(browser)
  const page = await nySide(context, origin, konsol)
  let navigationer = 0
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) navigationer++ })
  await logIndOgVarm(page, fx.ATHLETE_USER)
  await context.setOffline(true)
  await sleep(500)
  await godkend(page); await godkend(page)
  trin('uden net: 2 saet i koeen')
  // Et nyt deploy ligger klar: ny sw.js og ny version.json.
  overrides['/sw.js'] = readFileSync(path.join(BUILD, 'sw.js'), 'utf8') + '\n// kritik-403: ny version\n'
  overrides['/version.json'] = JSON.stringify({ buildId: 'kritik-403-ny-build' })
  const navFoer = navigationer
  await context.setOffline(false)
  r.koeTomt = await vent(async () => Object.keys(await koe(page, fx.ATHLETE_ID)).length === 0, 60000)
  await sleep(4000)
  r.genindlaesninger = navigationer - navFoer
  r.raekker = taelPrSaet(await raekker(fx.ATHLETE_ID), fx.EXERCISE_ID, 4)
  r.skaerm = await skaerm(page)
  trin(`online med ny build: siden genindlaest ${r.genindlaesninger} gang(e); koeen tom=${r.koeTomt}; mocken ${JSON.stringify(r.raekker)}; ${r.skaerm.naesteSaet}`)
  await shot(page, '01-efter-opdatering')
  delete overrides['/sw.js']; delete overrides['/version.json']
  await context.close()
}

async function forkertUr({ browser, origin, fx, trin, shot, r, konsol }) {
  const SKEW = -7 * 86400000
  const context = await nyKontekst(browser, {
    initScript: `(() => { const S = ${SKEW}; const R = Date; const N = R.now.bind(R);
      class D extends R { constructor(...a) { if (a.length) super(...a); else super(N() + S) } static now() { return N() + S } }
      globalThis.Date = D })()`,
  })
  const page = await nySide(context, origin, konsol)
  await logIndOgVarm(page, fx.ATHLETE_USER)
  r.telefonensDato = await page.evaluate(() => new Date().toISOString())
  await context.setOffline(true)
  await sleep(500)
  const g1 = await godkend(page); await godkend(page)
  await context.setOffline(false)
  r.koeTomt = await vent(async () => Object.keys(await koe(page, fx.ATHLETE_ID)).length === 0, 60000)
  const rows = await raekker(fx.ATHLETE_ID)
  r.loggedAt = rows.map((x) => x.logged_at).sort()
  r.afvigelseDage = Math.round((Date.now() - Date.parse(r.loggedAt[0])) / 86400000)
  r.godkendtKl = new Date(g1.kl).toISOString()
  trin(`telefonens ur 7 dage bagud: raekkerne staar med logged_at ${JSON.stringify(r.loggedAt)} (${r.afvigelseDage} dage foer serverens nu)`)
  await shot(page, '01-forkert-ur')
  await context.close()
}

const SCENARIER = {
  kaelder, 'online-start': onlineStart, 'aabn-med-net': aabnMedNet, haenger, 'to-faner': toFaner,
  'log-ud': logUdScenarie, 'skift-atlet': skiftAtlet, 'sw-opdatering': swOpdatering, 'forkert-ur': forkertUr,
  'o2-anden-telefon': o2AndenTelefon,
}

async function koer(navn, { chromium, createMockSupabase, fx }) {
  const mock = createMockSupabase(lavSeed(fx, { atletB: navn === 'skift-atlet' }))
  await mock.listen(MOCK_PORT)
  const overrides = {}
  const { server, port } = await startStaticServer(overrides)
  const browser = await chromium.launch({ headless: true })
  const out = path.join(HERE, navn)
  rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })
  const shot = (page, name) => page.screenshot({ path: path.join(out, `${name}.png`) }).catch(() => {})
  const log = []
  const trin = (t) => { console.log(`  [${navn}] ${t}`); log.push(t) }
  const r = {}
  const konsol = []
  let fejl = null
  try {
    await SCENARIER[navn]({ browser, origin: `http://127.0.0.1:${port}/`, fx, trin, shot, r, konsol, overrides })
  } catch (e) {
    fejl = String(e?.stack || e).slice(0, 1500)
    console.log(`  [${navn}] KOERSEL FEJLEDE: ${fejl.split('\n')[0]}`)
  } finally {
    await browser.close()
    server.close()
    await mock.close()
  }
  writeFileSync(path.join(HERE, `resultat-${navn}.json`), JSON.stringify({ scenarie: navn, koerselOk: !fejl, fejl, trin: log, ...r, konsolFejl: konsol.slice(0, 12) }, null, 2) + '\n')
  return !fejl
}

async function main() {
  const valgt = process.argv.slice(2).filter((a) => a in SCENARIER)
  const disse = valgt.length ? valgt : Object.keys(SCENARIER)
  const { createRequire } = await import('node:module')
  const { homedir } = await import('node:os')
  const require = createRequire(import.meta.url)
  let chromium
  try { ({ chromium } = require('playwright')) } catch {
    ({ chromium } = require(path.join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright')))
  }
  const { createMockSupabase } = await import('../../e2e/mock-supabase.mjs')
  const fx = await import('../../e2e/fixtures.mjs')
  if (!process.env.KRITIK403_SKIP_BUILD) {
    console.log(`Bygger mod mocken til ${BUILD} ...`)
    const build = spawnSync(`npx vite build --outDir "${BUILD}" --emptyOutDir`, { cwd: ROOT, stdio: 'ignore', shell: true, env: { ...process.env, VITE_SUPABASE_URL: MOCK_URL, VITE_SUPABASE_KEY: MOCK_KEY } })
    if (build.status !== 0) throw new Error('build fejlede')
  }
  let alleOk = true
  for (const navn of disse) alleOk = (await koer(navn, { chromium, createMockSupabase, fx })) && alleOk
  if (!alleOk) process.exit(1)
}

main().catch((e) => { console.error(e); process.exit(1) })
