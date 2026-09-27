// ORDRE 464, blok 2: Marcs kaeldertest (docs/RAPPORT-456.md, "Hvad er naeste",
// punkt 1-8) koert headless, som Marc vil goere det. Syntetisk Testatlet (130
// uger historik, e2e/fixtures.mjs) paa en aeldre telefon (Slow 4G + 4x CPU, 390
// px), e2e-mocken, ingen prod og ingen atletdata.
//
// Det, Marc har, foer han trykker push: telefonen har prod-versionen (dc39052,
// origin/main) med dens service worker. "Push" = serveren skifter til main
// (e5089f7) paa samme adresse. Serveren sender "cache-control: no-cache" (GitHub
// Pages sender max-age=600; no-cache er det strengeste: kun service workeren kan
// hjaelpe uden net) og 404 for et manglende /assets/-filnavn, som GitHub Pages.
//
// To varianter af punkt 2 ("vent paa Dagens pas"):
//   straks: Marc gaar i kaelderen 3 s efter, Dagens pas kan bruges
//   vent:   Marc venter, til rekord-indekset er bygget (kan ikke ses i appen)
// Punkt 3-7 er ens i begge. Punkt 8 (revert) tjekkes i git uden at aendre noget
// (git apply --check af den omvendte aendring), se kaelder-464-revert.txt.
//
// Koersel: node outputs/kritik-464/kaelder-464.mjs [--no-build] -> kaelder-464.json + K-*.png
import { createServer } from 'node:http'
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { ROOT, UD, BYG, DIST, MOCK_PORT, MOCK_URL, byg, hentChromium, bygSeed, nyTelefon, logIndAtlet, brugbart, drosl, tabel, PAS } from './faelles-464.mjs'

const PROD = 'dc39052'
const srcProd = path.join(BYG, 'src-prod')
const distProd = path.join(BYG, 'dist-prod')
if (!process.argv.includes('--no-build')) {
  mkdirSync(BYG, { recursive: true })
  if (!existsSync(path.join(srcProd, 'package.json'))) {
    mkdirSync(srcProd, { recursive: true })
    const tar = path.join(BYG, 'prod.tar')
    execSync(`git archive --format=tar -o "${tar}" ${PROD}`, { cwd: ROOT })
    execSync(`tar -xf "${tar}" -C "${srcProd}"`)
  }
  if (!existsSync(path.join(srcProd, 'node_modules'))) execSync(`cmd /c mklink /J "${path.join(srcProd, 'node_modules')}" "${path.join(ROOT, 'node_modules')}"`)
  byg(srcProd, distProd)
  byg(ROOT, DIST)
}

const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.mp4': 'video/mp4', '.wasm': 'application/wasm' }
const vaert = { dist: distProd }
function skiftServer() {
  const server = createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0])
    const fil = path.join(vaert.dist, urlPath === '/' ? '/index.html' : urlPath)
    const hdr = (t) => ({ 'content-type': t, 'cache-control': 'no-cache' })
    try {
      const data = readFileSync(fil)
      res.writeHead(200, hdr(MIME[path.extname(fil).toLowerCase()] || 'application/octet-stream')); res.end(data)
    } catch {
      if (urlPath.startsWith('/assets/') || /\.(js|css|json)$/.test(urlPath)) { res.writeHead(404, hdr('text/plain')); res.end('404'); return }
      res.writeHead(200, hdr('text/html')); res.end(readFileSync(path.join(vaert.dist, 'index.html')))
    }
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })))
}
const bundt = (dist) => (readFileSync(path.join(dist, 'index.html'), 'utf8').match(/\/assets\/index-[^"]+\.js/) || [])[0]

const { createMockSupabase } = await import('../../e2e/mock-supabase.mjs')
const fx = await import('../../e2e/fixtures.mjs')
const browser = await hentChromium().launch({ headless: true })
const MDR = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
const iDag = (() => { const d = new Date(); return `${d.getDate()}. ${MDR[d.getMonth()]} ${d.getFullYear()}` })()
const resultat = { prodBundt: bundt(distProd), mainBundt: bundt(DIST), iDag, varianter: {} }

async function koer(variant) {
  const r = { punkter: {}, tjek: [], loads: [], konsolFejl: [], fejringer: [] }
  resultat.varianter[variant] = r
  const tjek = (pkt, navn, ok, detalje) => { r.tjek.push({ pkt, navn, ok: !!ok, detalje }); console.log(`  [${variant}] ${ok ? 'OK  ' : 'FUND'} ${pkt}: ${navn}${detalje ? `: ${String(detalje).slice(0, 300)}` : ''}`) }
  const { seed } = bygSeed(fx.buildSeed, fx, { uger: 130 })
  const mock = createMockSupabase(seed)
  await mock.listen(MOCK_PORT)
  vaert.dist = distProd
  const { server, port } = await skiftServer()
  const URL0 = `http://127.0.0.1:${port}/`
  const { context, page: p0 } = await nyTelefon(browser)
  await context.exposeBinding('__k464', (_s, hvad, data) => {
    if (hvad === 'load') r.loads.push({ ...data, t: Date.now() })
    if (hvad === 'fejring') r.fejringer.push({ ...data, t: Date.now() })
  })
  await context.addInitScript(() => {
    let sidste = null
    addEventListener('DOMContentLoaded', () => {
      window.__k464('load', { bundt: (document.querySelector('script[type=module][src*="/assets/index-"]')?.getAttribute('src') || null), styret: !!navigator.serviceWorker?.controller })
      new MutationObserver(() => {
        const e = document.querySelector('[data-rekord-fejring]')
        const k = e && e.getAttribute('data-rekord-fejring')
        if (k && k !== sidste) window.__k464('fejring', { key: k, tekst: e.textContent.trim() })
        sidste = k
      }).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true })
    })
  })
  const lyt = (page) => {
    page.on('pageerror', e => r.konsolFejl.push(String(e).slice(0, 300)))
    page.on('console', m => { if (m.type() === 'error' && !/ERR_INTERNET_DISCONNECTED|Failed to load resource|Failed to fetch|ERR_NETWORK_CHANGED/.test(m.text())) r.konsolFejl.push(m.text().slice(0, 300)) })
  }
  lyt(p0)
  const shot = (page, navn) => page.screenshot({ path: path.join(UD, `K-${variant}-${navn}.png`) })

  // ---- Foer pushet: Marc har brugt prod-appen paa telefonen ----
  await logIndAtlet(p0, port, fx)
  await p0.evaluate(async () => { await navigator.serviceWorker.ready })
  await p0.reload()
  await p0.getByText('Dagens pas', { exact: true }).waitFor({ state: 'visible', timeout: 60000 })
  await p0.waitForTimeout(2000)
  r.foerPush = { bundt: r.loads.at(-1)?.bundt, styret: r.loads.at(-1)?.styret }
  await p0.close()

  // ---- Punkt 1: push (serveren skifter til main) ----
  vaert.dist = DIST
  // ---- Punkt 2: aabn appen med net og vent paa Dagens pas ----
  let page = await context.newPage(); lyt(page)
  let d = await drosl(page)
  const nLoad = r.loads.length
  let t0 = Date.now()
  await page.goto(URL0)
  await brugbart(page)
  r.punkter[2] = { brugbartMs: Date.now() - t0 }
  await page.waitForTimeout(3000)
  r.punkter[2].loads = r.loads.slice(nLoad).map(l => `${l.bundt} styret=${l.styret}`)
  r.punkter[2].bundt = r.loads.at(-1)?.bundt
  const indeksBygget = () => page.evaluate((k) => { try { return !!JSON.parse(localStorage.getItem(k))?.bygget } catch { return false } }, `entropi_rekord_indeks:${fx.ATHLETE_USER.id}`)
  if (variant === 'vent') {
    await page.waitForFunction((k) => { try { return !!JSON.parse(localStorage.getItem(k))?.bygget } catch { return false } }, `entropi_rekord_indeks:${fx.ATHLETE_USER.id}`, { timeout: 120000 }).catch(() => {})
    r.punkter[2].ventetTilIndeksMs = Date.now() - t0
  }
  r.punkter[2].indeksByggetVedKaelder = await indeksBygget()
  // Et genload (ny service worker tager over) kan komme lidt efter; vent op til 3 s mere.
  r.punkter[2].assetsICache = await page.waitForFunction(async (b) => { const c = await caches.open('entropi-assets-v1'); return !!(await c.match(b)) }, r.punkter[2].bundt, { timeout: 3000, polling: 250 }).then(() => true, () => false)
  await brugbart(page).catch(() => {})
  r.punkter[2].loads = r.loads.slice(nLoad).map(l => `${l.bundt} styret=${l.styret}`)
  tjek(2, 'appen koerer main efter pushet (nyt bundt)', r.punkter[2].bundt === resultat.mainBundt, JSON.stringify(r.punkter[2].loads))
  tjek(2, 'main-bundtet ligger i service workerens cache, foer nettet forsvinder', r.punkter[2].assetsICache, r.punkter[2].bundt)
  await shot(page, '2-dagens-pas')

  // ---- Punkt 3: kaelderen (flytilstand), log et pas, spring et saet over ----
  await d.offline(true)
  await page.evaluate(() => window.dispatchEvent(new Event('offline')))
  const godkendt = () => page.getByRole('button', { name: 'Godkendt', exact: true })
  const kortet = () => page.evaluate(() => {
    const v = document.querySelector('input[aria-label^="Vægt, sæt"]')
    let card = v; while (card && !(card.innerText || '').includes('Dagens pas')) card = card.parentElement
    const tekst = card?.innerText || document.body.innerText
    const anb = tekst.match(/Anbefalet: ([\d.,]+) ?kg/)
    return { tekst, vaegt: v?.value ?? null, saet: Number((tekst.match(/Sæt (\d+)\//) || [])[1] || 0), anbefalet: anb ? Number(anb[1].replace(',', '.')) : null }
  })
  const venter = (navn, n) => page.waitForFunction(([navn, n]) => { const t = document.body.innerText; return t.includes(`Sæt ${n}/`) && t.includes(navn) && !!document.querySelector('input[aria-label^="Vægt, sæt"]') }, [navn, n], { timeout: 30000 })
  const logget = []
  async function logSaet(navn, n) {
    await venter(navn, n)
    await page.waitForTimeout(400)
    const k = await kortet()
    if (k.anbefalet != null) for (let i = 0; i < 60; i++) {
      const v = Number(((await kortet()).vaegt || '0').replace(',', '.'))
      if (v === k.anbefalet) break
      await page.getByRole('button', { name: v < k.anbefalet ? '2,5 kg mere' : '2,5 kg mindre', exact: true }).click()
    }
    logget.push(`${navn} ${n}: ${(await kortet()).vaegt}`)
    await godkendt().click()
    await page.waitForFunction(([navn, n]) => { const t = document.body.innerText; return !(t.includes(`Sæt ${n}/`) && t.includes(navn)) || t.includes('er klaret') }, [navn, n], { timeout: 30000 }).catch(() => {})
  }
  const pas = PAS[0]
  for (let n = 1; n <= 4; n++) await logSaet('Squat', n)
  await logSaet('Bænkpres', 1)
  await venter('Bænkpres', 2)
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: 'Spring over', exact: true }).click()
  await page.waitForTimeout(3000)
  const efterSpring = await kortet()
  tjek(3, 'Spring over uden net flytter kortet videre (Baenkpres saet 3)', efterSpring.saet === 3 && /Bænkpres/.test(efterSpring.tekst), efterSpring.tekst.match(/[^\n]*\n?Sæt \d+\/\d+/)?.[0])
  await logSaet('Bænkpres', 3)
  await shot(page, '3-kaelderen')

  // ---- Punkt 4: luk appen helt midt i passet, aabn igen uden net ----
  await d.cdp.detach().catch(() => {})
  await page.close()
  page = await context.newPage(); lyt(page)
  d = await drosl(page)
  await d.offline(true)
  t0 = Date.now()
  const aabnet = await page.goto(URL0).then(() => true, (e) => { r.punkter[4] = { fejl: String(e.message).slice(0, 200) }; return false })
  const kortVist = aabnet && await godkendt().waitFor({ state: 'visible', timeout: 45000 }).then(() => true, () => false)
  await page.waitForTimeout(1500)
  const k4 = kortVist ? await kortet() : { tekst: await page.evaluate(() => document.body.innerText.slice(0, 200)).catch(() => '') }
  r.punkter[4] = { ...(r.punkter[4] || {}), ms: Date.now() - t0, kortVist, tekst: (k4.tekst || '').slice(0, 200), vaegt: k4.vaegt, login: await page.locator('#athlete-auth-email').count() }
  await shot(page, '4-genaabnet-uden-net')
  tjek(4, 'appen aabner uden net paa Dagens pas (ingen login-skaerm)', kortVist && !r.punkter[4].login, `${r.punkter[4].ms} ms: ${JSON.stringify(r.punkter[4].tekst.slice(0, 120))}`)
  tjek(4, 'vaegtfeltet er udfyldt', kortVist && !!k4.vaegt, `${k4.vaegt} (${(k4.tekst || '').match(/Bulgarsk[^\n]*|Sæt \d+\/\d+/)?.[0] || ''})`)
  if (kortVist) {
    const bulg = pas.oevelser.find(o => /Bulgarsk/.test(o.navn))
    for (let n = 1; n <= bulg.saet; n++) await logSaet(bulg.navn, n)
    const linje = page.locator('[data-vurder-pas]')
    r.punkter[3] = { vurderingVist: await linje.waitFor({ state: 'visible', timeout: 15000 }).then(() => true, () => false) }
    if (r.punkter[3].vurderingVist) { await page.getByRole('button', { name: 'Passet gik: 4 af 5', exact: true }).click(); await page.waitForTimeout(4000) }
    r.punkter[3].flash = await page.locator('[role="alert"], [role="status"]').allInnerTexts().catch(() => [])
    tjek(3, 'vurderingen kan gives uden net', r.punkter[3].vurderingVist && !r.punkter[3].flash.some(t => /ikke gemt/.test(t)), JSON.stringify(r.punkter[3].flash))
  }
  r.punkter[3] = { ...(r.punkter[3] || {}), logget, gemtLokalt: await page.getByText(/gemt lokalt/).first().innerText().catch(() => null) }
  await shot(page, '4-pas-klaret-uden-net')

  // ---- Punkt 5: nettet tilbage, "gemt lokalt" forsvinder ----
  await d.offline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  t0 = Date.now()
  const vaek = await page.getByText(/gemt lokalt/).first().waitFor({ state: 'detached', timeout: 120000 }).then(() => true, () => false)
  r.punkter[5] = { vaek, sekunder: Math.round((Date.now() - t0) / 100) / 10, foer: r.punkter[3].gemtLokalt }
  await page.waitForTimeout(8000)
  r.punkter[5].koe = await page.evaluate((k) => Object.keys(JSON.parse(localStorage.getItem(k) || '{}')).length, `entropi_offline_sets:${fx.ATHLETE_ID}`)
  tjek(5, '"gemt lokalt"-linjen var der og forsvinder, koeen er tom', !!r.punkter[3].gemtLokalt && vaek && r.punkter[5].koe === 0, JSON.stringify(r.punkter[5]))
  await shot(page, '5-net-igen')
  // Hvad ligger i mocken nu (kun ugens pas 1)?
  const ugensEx = new Set(seed.tables.exercises.filter(e => seed.tables.sessions.find(s => s.id === e.session_id && s.week_id === seed.tables.weeks.at(-1).id && s.session_order === 1)).map(e => e.id))
  const logs = (await tabel('exercise_logs')).filter(l => ugensEx.has(l.exercise_id))
  const exNavn = Object.fromEntries(seed.tables.exercises.map(e => [e.id, e.name]))
  r.mock = { saet: logs.map(l => `${exNavn[l.exercise_id]} ${l.set_number}: ${l.skipped ? 'sprunget over' : `${l.weight}x${l.reps_completed}`}`).sort(), vurdering: (await tabel('sessions')).find(s => s.week_id === seed.tables.weeks.at(-1).id && s.session_order === 1)?.athlete_rating ?? null, personalRecords: (await tabel('personal_records')).map(p => `${p.exercise_name} ${p.weight}x${p.reps}`) }
  r.fejretIalt = r.fejringer.map(f => f.tekst)
  const noegler = logs.map(l => `${l.exercise_id}_${l.set_number}`)
  tjek(5, 'hvert saet een gang i databasen, springet som sprunget over', noegler.length === new Set(noegler).size && logs.length === 10 && logs.filter(l => l.skipped).length === 1, JSON.stringify(r.mock.saet))
  tjek(5, 'vurderingen naaede frem', r.mock.vurdering === 4, String(r.mock.vurdering))
  tjek(5, 'fejrede rekorder = raekker i personal_records', r.fejretIalt.length === r.mock.personalRecords.length, `fejret ${JSON.stringify(r.fejretIalt)}; personal_records ${JSON.stringify(r.mock.personalRecords)}`)
  await d.cdp.detach().catch(() => {})
  await context.close()

  // ---- Punkt 6-7: som coach paa telefonen ----
  const coach = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const cp = await coach.newPage()
  cp.on('pageerror', e => r.konsolFejl.push(`coach: ${String(e).slice(0, 300)}`))
  await drosl(cp)
  await cp.goto(URL0)
  await cp.locator('#athlete-auth-email').fill(fx.COACH_USER.email)
  await cp.locator('#athlete-auth-password').fill(fx.COACH_USER.password)
  await cp.getByRole('button', { name: 'Log ind' }).click()
  await cp.getByText('Testatlet').first().waitFor({ timeout: 60000 })
  await cp.waitForTimeout(6000)
  await cp.locator('[role="button"]', { hasText: 'Testatlet' }).last().click()
  await cp.waitForTimeout(1500)
  await cp.getByRole('button', { name: /Log$/ }).first().click()
  await cp.getByText('Dag 1 — Squat').first().waitFor({ timeout: 120000 }).catch(() => {})
  await cp.waitForTimeout(2000)
  const logTekst = await cp.evaluate(() => document.body.innerText)
  const i1 = logTekst.indexOf('Dag 1 — Squat')
  const dag1 = i1 < 0 ? '' : logTekst.slice(Math.max(0, i1 - 60), i1 + 900)
  r.punkter[6] = { dag1: dag1.replace(/\n+/g, ' | ').slice(0, 700) }
  const sLinjer = (dag1.match(/S\d+ [^\n]*/g) || [])
  await cp.getByText('Dag 1 — Squat').first().scrollIntoViewIfNeeded().catch(() => {})
  await cp.screenshot({ path: path.join(UD, `K-${variant}-6-coach-log.png`) })
  tjek(6, 'Log: pas 1 har 9/10 saet og "1 sprunget over"', /9\/10 SÆT/i.test(dag1) && /1 sprunget over/i.test(dag1), r.punkter[6].dag1.slice(0, 200))
  tjek(6, 'Log: vurderingen staar (4 af 5)', /★★★★☆/.test(dag1), (dag1.match(/★+☆*/) || [''])[0])
  tjek(6, `Log: datoen er i dag paa dansk (${iDag})`, dag1.toLowerCase().includes(iDag.toLowerCase()) && !/\d{4}-\d{2}-\d{2}/.test(dag1), (dag1.match(/\d{1,2}\. [A-Za-zæøå]{3} \d{4}/) || [''])[0])
  r.punkter[6].saetLinjer = sLinjer.length

  // PR-tidslinjen
  const analyse = cp.getByRole('button', { name: /Analyse/ }).first()
  if (!(await analyse.isVisible().catch(() => false))) { await cp.getByRole('button', { name: /Mere/ }).first().click(); await cp.waitForTimeout(500) }
  await cp.getByRole('button', { name: /Analyse/ }).first().click()
  await cp.getByText('PR-tidslinje').first().waitFor({ timeout: 30000 }).catch(() => {})
  await cp.waitForTimeout(1500)
  const pr = await cp.evaluate(() => { const h = [...document.querySelectorAll('div')].find(e => e.textContent.trim() === 'PR-tidslinje'); return (h?.parentElement?.innerText || '').replace(/\n+/g, ' | ') })
  r.punkter[7] = { prTidslinje: pr.slice(0, 600), iDagRaekker: (pr.match(new RegExp(`[\\d.,]+ kg × \\d+ \\| ${new Date().getDate()} ${MDR[new Date().getMonth()]} \\d{4}`, 'g')) || []) }
  await cp.getByText('PR-tidslinje').first().scrollIntoViewIfNeeded().catch(() => {})
  await cp.screenshot({ path: path.join(UD, `K-${variant}-7-pr-tidslinje.png`) })
  const forventet = r.mock.personalRecords.length
  tjek(7, 'PR-tidslinjen har kaelderens rekorder een gang hver', forventet > 0 && r.punkter[7].iDagRaekker.length === forventet && new Set(r.punkter[7].iDagRaekker).size === forventet, `${r.punkter[7].iDagRaekker.length} i dag: ${JSON.stringify(r.punkter[7].iDagRaekker)}`)

  // Dobbelttryk paa "Kopier seneste uge", og slet den nye uge bagefter.
  const ugerFoer = (await tabel('weeks')).filter(w => w.athlete_id === fx.ATHLETE_ID)
  await cp.getByRole('button', { name: /Program$/ }).first().click()
  const kopi = cp.getByRole('button', { name: /Kopiér seneste uge/ })
  await kopi.waitFor({ timeout: 30000 })
  const b = await kopi.boundingBox()
  await cp.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
  await cp.waitForTimeout(150)
  await cp.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
  await cp.waitForFunction(() => [...document.querySelectorAll('button')].some(x => /Kopiér seneste uge/.test(x.textContent) && !x.disabled), null, { timeout: 90000 }).catch(() => {})
  await cp.waitForTimeout(3000)
  const nye = (await tabel('weeks')).filter(w => w.athlete_id === fx.ATHLETE_ID && !ugerFoer.some(u => u.id === w.id))
  r.punkter[7].nyeUger = nye.map(w => w.week_number)
  tjek(7, 'dobbelttryk (150 ms) paa "Kopier seneste uge" giver een uge', nye.length === 1, JSON.stringify(r.punkter[7].nyeUger))
  // Slet den nye uge i appen (Slet -> Bekraeft), som Marc skal.
  if (nye.length) {
    const ny = nye.at(-1)
    const raekke = cp.locator('div', { hasText: new RegExp(`^Uge ${ny.week_number}`) }).filter({ has: cp.getByRole('button', { name: 'Slet', exact: true }) }).last()
    await raekke.getByRole('button', { name: 'Slet', exact: true }).last().click().catch(() => {})
    await cp.getByRole('button', { name: 'Bekræft', exact: true }).click({ timeout: 10000 }).catch(() => {})
    await cp.waitForTimeout(4000)
  }
  const ugerEfter = (await tabel('weeks')).filter(w => w.athlete_id === fx.ATHLETE_ID)
  r.punkter[7].slettet = { foer: ugerFoer.length, efter: ugerEfter.length, rigtigUgeSlettet: ugerEfter.every(w => ugerFoer.some(u => u.id === w.id)) && ugerEfter.length === ugerFoer.length }
  await cp.screenshot({ path: path.join(UD, `K-${variant}-7-kopi-slettet.png`) })
  tjek(7, 'den kopierede uge kan slettes i appen (og kun den)', r.punkter[7].slettet.rigtigUgeSlettet, JSON.stringify(r.punkter[7].slettet))
  tjek('-', 'ingen konsolfejl', !r.konsolFejl.length, r.konsolFejl.join(' | '))
  await coach.close()
  server.close(); await mock.close()
}

try {
  for (const v of ['straks', 'vent']) await koer(v)
} catch (e) {
  resultat.fejl = String(e?.stack || e)
  console.error(e)
  process.exitCode = 1
} finally {
  writeFileSync(path.join(UD, 'kaelder-464.json'), JSON.stringify(resultat, null, 2) + '\n')
  await browser.close()
  void MOCK_URL
  process.exit(process.exitCode || 0)
}
