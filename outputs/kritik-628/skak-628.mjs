// Kritik 628, blok 2: skakken efter Chaturangas 619 (main) og 623 (grenen ordre-623, to commits; blok 3 er ikke
// committet), hentet med git archive; skak-traeet roeres ikke. Som elev paa 12 aar (360 og 390 med touch, 1280 med mus)
// og som laerer (laerer.html), headless, uden net, paa Playwrights falske ur. Alt elevens er spillet i appen med tryk
// (gaaderne og stormene loeses ved at slaa stillingen op i banken), undtagen del H, hvor 12 gaadetemaer er lagt i lageret.
//   S  S7 fra 610 (eleven ser sit fremskridt): uge 1 Find feltet 10/10, uge 2 20 rigtige og 2 forkerte. Og 619 blok 1:
//      ugesaetningen med alle fire slags i uge 1 (2 gaader, Find feltet, en aabning, et kendt parti). Hvor lang paa 360?
//   T  Stormen over otte dage (619 blok 2 og 623 blok 1): Blandet og Gafler, en stoppet storm, midnat, mandag, dagens storm.
//   H  Haardt mellemrum foer % (623 blok 2) paa 360 og 390 med 12 temaer, og uden for Mit bibliotek (#30).
//   L  Laerersiden med 25 koder, som i 610.
//   node outputs/kritik-628/skak-628.mjs     -> skak-628.json og S-*.png her. SKAK_REF=main koerer paa main (619).
import path from 'node:path'
import { writeFileSync, readFileSync, mkdtempSync, symlinkSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('C:/Users/Entropi/Desktop/skak/node_modules/playwright')
const HERE = path.dirname(fileURLToPath(import.meta.url))
const SKAK = 'C:/Users/Entropi/Desktop/skak'
const REF = process.env.SKAK_REF || 'refs/heads/ordre-623'
const SHA = execSync(`git -C ${SKAK} rev-parse --short ${REF}`).toString().trim()
const MAIN = execSync(`git -C ${SKAK} rev-parse --short main`).toString().trim()
const MERGET623 = execSync(`git -C ${SKAK} merge-base --is-ancestor refs/heads/ordre-623 main && echo ja || echo nej`).toString().trim()
const HAR623 = REF !== 'main' || MERGET623 === 'ja'
const dir = mkdtempSync(path.join(tmpdir(), 'k628-skak-'))
execSync(`git -C "${SKAK}" archive -o "${path.join(dir, 's.tar')}" ${REF}`)
execSync('tar -xf s.tar', { cwd: dir })
symlinkSync(path.join(SKAK, 'node_modules'), path.join(dir, 'node_modules'), 'junction') // kun saa chess.js findes for de rene moduler
const imp = (f) => import(pathToFileURL(path.join(dir, f)).href)
const KK = await imp('src/kompetencekode.js')
const KL = await imp('src/klassekoder.js')
const KO = await imp('src/kompetencer.js')
const AB = await imp('src/aabningsbog.js')
const { KENDTE_PARTIER, kendtPartiOpgave } = await imp('src/kendtepartier.js')
const { Chess } = await import(pathToFileURL(path.join(SKAK, 'node_modules/chess.js/dist/esm/chess.js')).href)
const { GAADEBANK_STOR_GZIP_BASE64 } = await imp('src/gaadebank-stor.js')
const { afkodGaadebankStor } = await imp('src/gaadedata.js')
const bank = (await afkodGaadebankStor(GAADEBANK_STOR_GZIP_BASE64)).concat(['gaader.json', 'gaader-lette.json'].flatMap((f) => JSON.parse(readFileSync(path.join(dir, 'data', f), 'utf8'))))
const fenNoegle = (fen) => fen.split(' ').slice(0, 2).join(' ')
const iBank = new Map(); for (const g of bank) if (!iBank.has(fenNoegle(g.fen))) iBank.set(fenNoegle(g.fen), g)

const tjek = []
const ok = (hvad, b, data) => { tjek.push({ hvad, ok: !!b, data }); console.log(`${b ? 'OK  ' : 'ROED'} ${hvad}${data !== undefined ? ' ' + JSON.stringify(data).slice(0, 700) : ''}`) }

const browser = await chromium.launch({ headless: true })
const tekst = (S, sel) => S.page.evaluate((sel) => { const e = document.querySelector(sel); return e && !e.hidden && e.checkVisibility() ? e.textContent.replace(/\s+/g, ' ').trim() : '' }, sel)
async function tryk(S, sel) { const l = S.page.locator(sel).first(); await l.scrollIntoViewIfNeeded(); if (S.mobil) await l.tap(); else await l.click() }
const tid = (S, ms) => S.page.clock.runFor(ms)
async function nySide(bredde, start) {
  const mobil = bredde < 500
  const ctx = await browser.newContext({ viewport: { width: bredde, height: bredde === 360 ? 780 : mobil ? 844 : 800 }, isMobile: mobil, hasTouch: mobil, deviceScaleFactor: mobil ? 2 : 1 })
  const S = { ctx, mobil, bredde, net: [], fejl: [], dialoger: [] }
  const page = await ctx.newPage()
  page.on('pageerror', (e) => S.fejl.push(e.message))
  page.on('dialog', (d) => { S.dialoger.push(d.message()); d.accept() })
  await page.route('**/*', (r) => { const u = r.request().url(); if (/^(file|data|blob):/.test(u)) return r.continue(); S.net.push(u); return r.abort() })
  S.page = page
  await page.clock.install({ time: start })
  return S
}
async function aabnFold(S, id) {
  await S.page.locator(`#${id} > summary`).scrollIntoViewIfNeeded()
  if (!(await S.page.locator(`#${id}`).evaluate((d) => d.open))) await tryk(S, `#${id} > summary`)
  await tid(S, 300)
}
async function hjem(S, fane) {
  await S.page.goto(pathToFileURL(path.join(dir, 'skak.html')).href)
  await S.page.waitForSelector('#braet .felt')
  await tid(S, 500)
  await tryk(S, `#fane-${fane}`); await tid(S, 400)
  if (fane === 'gaader') { for (let i = 0; i < 150 && !(await S.page.evaluate(() => document.getElementById('gaade-indlaeser').hidden)); i++) { await tid(S, 200); await S.page.waitForTimeout(50) } }
}
const lager = (S) => S.page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)])))
const fenNu = (S) => S.page.inputValue('#fen-tekst')
// Loes gaaden paa #braet ved at slaa stillingen op i banken (elevens traek med tryk, modstanderens svar paa uret).
async function loesGaade(S) {
  let fen = await fenNu(S), g = iBank.get(fenNoegle(fen))
  for (let i = 0; i < 10 && !g; i++) { await tid(S, 300); fen = await fenNu(S); g = iBank.get(fenNoegle(fen)) }
  if (!g) return { fen, fundet: false }
  for (let i = 0; i < g.solutionUci.length; i += 2) {
    const u = g.solutionUci[i]
    await tryk(S, `#braet .felt[data-square="${u.slice(0, 2)}"]`); await tid(S, 60)
    await tryk(S, `#braet .felt[data-square="${u.slice(2, 4)}"]`); await tid(S, 60)
    if (u[4]) { await tryk(S, `#forvandling-valg button:nth-child(${'qrbn'.indexOf(u[4]) + 1})`); await tid(S, 60) }
    await tid(S, 900)
  }
  await tid(S, 400)
  return { fen, fundet: true, tema: g.tema, traek: g.solutionUci.length }
}

// "Find feltet": `rigtige` tryk paa det sagte felt og `forkerte` paa et andet, saa loeber de 30 s ud.
async function findFeltet(S, rigtige, forkerte) {
  await hjem(S, 'spil')
  await aabnFold(S, 'fold-koordinater')
  await tryk(S, '#segment-koordinat-tilstand .segment-knap[data-value="find"]'); await tid(S, 200)
  await tryk(S, '#knap-koordinat-start'); await tid(S, 300)
  const plan = [...Array(rigtige).fill(true), ...Array(forkerte).fill(false)]
  for (let i = 0; i < plan.length; i++) {
    const spurgt = (await tekst(S, '#koordinat-felt')) ?? ''
    const felt = plan[i] ? spurgt : (spurgt === 'a1' ? 'h8' : 'a1')
    await tryk(S, `#koordinat-braet .felt[data-square="${felt}"]`); await tid(S, 80)
  }
  await tid(S, 31000); await S.page.waitForTimeout(100)
}
async function aabning(S, id, fejlFoerst) {
  await hjem(S, 'spil')
  await aabnFold(S, 'fold-aabningsoevelse')
  if (!(await S.page.locator(`.aabningsoevelse-valg[data-id="${id}"]`).first().isVisible())) { if (await S.page.locator('#knap-aabningsoevelse-liste').isVisible()) await tryk(S, '#knap-aabningsoevelse-liste'); await tid(S, 200) }
  await tryk(S, `.aabningsoevelse-valg[data-id="${id}"]`); await tid(S, 300)
  const o = AB.AABNINGSOEVELSER.find((x) => x.id === id)
  const n = AB.linjeTraek(o).length
  const feltTryk = async (sq) => { await tryk(S, `#aabningsoevelse-braet .felt[data-square="${sq}"]`); await tid(S, 120) }
  for (let ply = 0; ply < n; ply++) {
    if (!AB.erElevensTraek(o, ply)) { await tid(S, 600); continue }
    if (fejlFoerst && ply === 0) { await feltTryk('g1'); await feltTryk('f3') }
    const u = AB.forventetTraek(o, ply).uci
    await feltTryk(u.slice(0, 2)); await feltTryk(u.slice(2, 4))
    await tid(S, 200)
  }
  await tid(S, 800)
}
async function kendtParti(S, parti, fejlFoerst) {
  await hjem(S, 'gaader')
  await aabnFold(S, 'fold-kendte-partier')
  await tryk(S, `.kendt-parti-knap[data-parti="${parti.id}"]`); await tid(S, 1500)
  const o = kendtPartiOpgave(parti)
  const uci = async (u) => { await tryk(S, `#braet .felt[data-square="${u.slice(0, 2)}"]`); await tid(S, 100); await tryk(S, `#braet .felt[data-square="${u.slice(2, 4)}"]`); await tid(S, 1200) }
  if (fejlFoerst) {
    const c = new Chess(o.fen)
    const m = c.moves({ verbose: true }).find((x) => x.from + x.to !== o.solutionUci[0].slice(0, 4) && !x.promotion)
    await uci(m.from + m.to)
    if (await S.page.locator('#knap-gaade-fortryd').isVisible()) { await tryk(S, '#knap-gaade-fortryd'); await tid(S, 600) }
  }
  for (let i = 0; i < o.solutionUci.length; i += 2) await uci(o.solutionUci[i])
  await tid(S, 1500)
}
// To almindelige gaader i Gaader-fanen: den, der staar, og den naeste.
async function gaader(S, antal) {
  await hjem(S, 'gaader')
  const ud = []
  for (let k = 0; k < antal; k++) {
    const foer = await fenNu(S)
    let r = await loesGaade(S)
    if (!r.fundet && (await S.page.locator('#knap-gaade-spring-over').isVisible().catch(() => false))) { ud.push(r); await tryk(S, '#knap-gaade-spring-over'); await tid(S, 800); r = await loesGaade(S) }
    ud.push(r)
    for (let i = 0; i < 20 && (await fenNu(S)) === foer; i++) { await tid(S, 500) }
    if ((await fenNu(S)) === foer) { for (const sel of ['#naeste-klik', '#knap-gaade-spring-over']) if (await S.page.locator(sel).first().isVisible().catch(() => false)) { await tryk(S, sel); await tid(S, 800); break } }
  }
  return ud
}
async function bibliotek(S) {
  await hjem(S, 'gaader')
  await aabnFold(S, 'fold-mit-bibliotek')
  return S.page.evaluate(() => {
    const e = document.getElementById('mit-uge-tekst')
    const lh = e ? parseFloat(getComputedStyle(e).lineHeight) || parseFloat(getComputedStyle(e).fontSize) * 1.4 : 1
    const find = document.querySelector('#mit-bibliotek-grupper li[data-art="koordinat"][data-id="find"]')
    return {
      saetning: e?.textContent.trim() ?? null, saetningLinjer: e ? Math.round(e.getBoundingClientRect().height / lh) : 0,
      find: find?.querySelector('.mit-bib-uge')?.textContent.replace(/\s+/g, ' ').trim() ?? null,
      findKlasse: find?.querySelector('.mit-bib-uge')?.className ?? null,
      findRaekke: find?.innerText.replace(/\s+/g, ' ').trim() ?? null,
      vandret: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }
  })
}

// ------------------------------------------------------------ S: S7 og ugesaetningen med alle fire slags
const U1 = new Date(2026, 8, 21, 10), U2 = new Date(2026, 8, 28, 10)
const Sres = {}
for (const bredde of [360, 390, 1280]) {
  const R = (Sres[bredde] = {})
  const S = await nySide(bredde, U1)
  R.gaader1 = await gaader(S, 2)
  await findFeltet(S, 10, 0)
  await aabning(S, 'italiensk', true)
  await kendtParti(S, KENDTE_PARTIER[0], true)
  R.bib1 = await bibliotek(S)
  if (bredde === 360) { await S.page.evaluate(() => document.getElementById('mit-uge-tekst')?.scrollIntoView({ block: 'center' })); await tid(S, 300); await S.page.screenshot({ path: path.join(HERE, 'S-360-628-uge1-fire-slags.png') }) }
  await S.page.clock.setSystemTime(U2)
  await findFeltet(S, 20, 2)
  await aabning(S, 'italiensk', false)
  await kendtParti(S, KENDTE_PARTIER[1], false)
  R.bib2 = await bibliotek(S)
  if (bredde === 390) { await S.page.evaluate(() => document.querySelector('#mit-bibliotek-grupper li[data-art="koordinat"][data-id="find"]')?.scrollIntoView({ block: 'center' })); await tid(S, 300); await S.page.screenshot({ path: path.join(HERE, 'S-390-628-uge2-find.png') }) }
  const L = await lager(S)
  R.koord = JSON.parse(L['skak-koordinater-statistik-v1'] ?? 'null')?.find ?? null
  R.net = S.net.length; R.fejl = S.fejl
  await S.ctx.close()
}
const s390 = Sres[390]
ok('S1 uge 1 i appen: 2 gaader loest fra banken (en gaade uden for banken springes over), Find feltet 10/10, Italiensk med eet forkert traek, et kendt parti med eet forkert traek', [360, 390, 1280].every((b) => Sres[b].gaader1.filter((g) => g.fundet).length === 2), [360, 390, 1280].map((b) => Sres[b].gaader1.map((g) => g.tema)))
ok('S2 619 blok 1: ugesaetningen i uge 1 naevner alle fire slags hver for sig, uden "forsoeg" og uden "koordinatoevelse"', [360, 390, 1280].every((b) => /tema(er)? \(2 gåder\), "Find feltet", 1 åbning \(1 gang\) og 1 kendt parti\.$/.test(Sres[b].bib1.saetning ?? '') && !/forsøg|koordinatøvelse/.test(Sres[b].bib1.saetning)), { saetning: s390.bib1.saetning })
ok('S3 hvor lang er den? linjer paa 360, 390 og 1280', true, [360, 390, 1280].map((b) => `${b}: ${Sres[b].bib1.saetningLinjer} linjer, ${Sres[b].bib1.saetning.split(/\s+/).length} ord`))
ok('S4 S7 lukket: uge 2 med 20 rigtige og 2 forkerte mod 10/10 i uge 1: Find feltet viser antallet ("bedst 20 felter (91 %) · sidste uge: bedst 10 felter (100 %)") med pil op, og saetningen siger "hurtigere til "Find feltet": 20 felter paa 30 s mod 10 sidste uge", ikke "gik lidt ned"', [360, 390, 1280].every((b) => { const x = Sres[b].bib2; return /bedst 20 felter \(91\s%\)/.test(x.find ?? '') && /sidste uge: bedst 10 felter \(100\s%\)/.test(x.find ?? '') && /\bop\b/.test(x.findKlasse ?? '') && /hurtigere til "Find feltet": 20 felter på 30 s mod 10 sidste uge/.test(x.saetning ?? '') && !/gik lidt ned/.test(x.saetning) }), { find: s390.bib2.find, klasse: s390.bib2.findKlasse, saetning: s390.bib2.saetning, lager: s390.koord })
ok('S5 0 netkald, 0 JS-fejl, ingen vandret rulning i Mit bibliotek (360, 390, 1280)', [360, 390, 1280].every((b) => !Sres[b].net && !Sres[b].fejl.length && Sres[b].bib1.vandret <= 0 && Sres[b].bib2.vandret <= 0), [360, 390, 1280].map((b) => ({ b, net: Sres[b].net, fejl: Sres[b].fejl.slice(0, 2) })))

// ------------------------------------------------------------ T: stormen over otte dage
const STORM_LINJER = { rekord: '#storm-rekord', perioder: '#storm-rekord-perioder', tema: '#storm-tema-perioder' }
const SLUT_LINJER = { overskrift: '#storm-resultat-overskrift', nyRekord: '#storm-ny-rekord', nyPeriode: '#storm-ny-periode', rekord: '#storm-resultat-rekord', perioder: '#storm-resultat-perioder', tema: '#storm-resultat-tema-perioder' }
async function linjer(S, L) { const o = {}; for (const [k, sel] of Object.entries(L)) o[k] = await tekst(S, sel); return o }
async function stormStart(S, tema) {
  await hjem(S, 'gaader')
  await S.page.locator(`#segment-storm-tema [data-value="${tema}"]`).scrollIntoViewIfNeeded()
  await tryk(S, `#segment-storm-tema [data-value="${tema}"]`); await tid(S, 200)
  return linjer(S, STORM_LINJER)
}
async function storm(S, { tema, loes, stop = false, dagens = false }) {
  const start = await stormStart(S, tema)
  if (tema !== 'blandet' && HAR623) { await tryk(S, '#segment-storm-tema [data-value="blandet"]'); await tid(S, 150); start.temaVedBlandet = await tekst(S, STORM_LINJER.tema); await tryk(S, `#segment-storm-tema [data-value="${tema}"]`); await tid(S, 150) }
  const knap = dagens ? '#knap-storm-dagens' : '#knap-storm-start'
  for (let i = 0; i < 100 && (await S.page.locator(knap).isDisabled()); i++) { await tid(S, 200); await S.page.waitForTimeout(30) }
  await tryk(S, knap); await tid(S, 500)
  const loest = []
  for (let n = 0; n < loes; n++) { const r = await loesGaade(S); loest.push(r.tema ?? null); if (!r.fundet) break; await tid(S, 300) }
  if (stop) { await tryk(S, '#knap-storm-stop'); await tid(S, 500) } else { await tid(S, 200000) }
  await tid(S, 500)
  const slut = await linjer(S, SLUT_LINJER)
  if (!slut.nyRekord) slut.nyRekord = ''
  const L = await lager(S)
  return { start, loest, slut, lager: { perioder: L['skak-gaade-storm-perioder-v1'] ?? null, tema: L['skak-gaade-storm-perioder-tema-v1'] ?? null, rekord: L['skak-gaade-storm-rekord-v1'] ?? null } }
}
const dag = (d, h, m = 0) => new Date(2026, 8, d, h, m) // sep. 2026; 5. okt. = 35. sep.
const PLAN = [
  ['s1 man 28/9 09:00 Blandet, 4 loeste', dag(28, 9), { tema: 'blandet', loes: 4 }],
  ['s2 man 10:00 Gafler, 2', dag(28, 10), { tema: 'gaffel', loes: 2 }],
  ['s3 man 11:00 Gafler, 3', dag(28, 11), { tema: 'gaffel', loes: 3 }],
  ['s4 man 12:00 Gafler, 5 og Stop', dag(28, 12), { tema: 'gaffel', loes: 5, stop: true }],
  ['s5 tir 29/9 00:30 startkortet', dag(29, 0, 30), null],
  ['s6 tir 10:00 Gafler, 1', dag(29, 10), { tema: 'gaffel', loes: 1 }],
  ['s7 tir 11:00 Gafler, 2', dag(29, 11), { tema: 'gaffel', loes: 2 }],
  ['s8 man 5/10 00:30 startkortet', dag(35, 0, 30), null],
  ['s9 man 5/10 10:00 dagens storm med Gafler valgt, 2', dag(35, 10), { tema: 'gaffel', loes: 2, dagens: true }],
]
const T = {}
for (const bredde of [360, 390, 1280]) {
  const S = await nySide(bredde, PLAN[0][1])
  T[bredde] = {}
  for (const [navn, tidspunkt, opt] of PLAN) {
    await S.page.clock.setSystemTime(tidspunkt)
    if (opt) T[bredde][navn] = await storm(S, opt)
    else {
      const g = await stormStart(S, 'gaffel')
      if (navn.startsWith('s5')) T[bredde].kort = await S.page.evaluate(() => { const k = document.getElementById('storm-start-kort'); const r = k.getBoundingClientRect(); const lin = (id) => { const e = document.getElementById(id); if (!e || e.hidden || !e.textContent.trim()) return 0; return Math.round(e.getBoundingClientRect().height / (parseFloat(getComputedStyle(e).lineHeight) || 20)) }; const st = document.getElementById('knap-storm-start').getBoundingClientRect(); return { hoejde: Math.round(r.height), skaerm: innerHeight, startKnapTopIKortet: Math.round(st.top - r.top), linjer: { rekord: lin('storm-rekord'), perioder: lin('storm-rekord-perioder'), tema: lin('storm-tema-perioder') }, vandret: document.documentElement.scrollWidth - document.documentElement.clientWidth } })
      await tryk(S, '#segment-storm-tema [data-value="blandet"]'); await tid(S, 150); T[bredde][navn] = { start: g, blandet: await linjer(S, STORM_LINJER) }
    }
    if (bredde === 360 && navn.startsWith('s5')) { await tryk(S, '#segment-storm-tema [data-value="gaffel"]'); await tid(S, 150); await S.page.locator('#storm-start-kort').scrollIntoViewIfNeeded(); await tid(S, 300); await S.page.screenshot({ path: path.join(HERE, 'S-360-628-storm-startkort.png') }) }
    if (bredde === 360 && navn.startsWith('s3')) { await S.page.locator('#storm-resultat').scrollIntoViewIfNeeded(); await tid(S, 300); await S.page.screenshot({ path: path.join(HERE, 'S-360-628-storm-slutkort.png') }) }
  }
  T[bredde].net = S.net.length; T[bredde].fejl = S.fejl; T[bredde].dialoger = S.dialoger
  await S.ctx.close()
}
const t = T[390], P = (n) => PLAN.find((p) => p[0].startsWith(n))[0]
const alle = (fn) => [360, 390, 1280].every((b) => fn(T[b]))
ok('T0 stormene er spillet i appen: alle gaader i Gafler-stormene er gafler', alle((x) => ['s2', 's3', 's4', 's6', 's7', 's9'].every((n) => x[P(n)].loest.every((tm) => tm === 'fork'))), Object.fromEntries(['s1', 's2', 's3', 's4', 's6', 's7', 's9'].map((n) => [n, t[P(n)].loest])))
ok('T1 s1 den foerste storm nogensinde (4): ingen "bedste", linjen "I dag: 4 gaader · denne uge: 4 gaader."', alle((x) => !x[P('s1')].slut.nyPeriode && x[P('s1')].slut.perioder === 'I dag: 4 gåder · denne uge: 4 gåder.'), t[P('s1')].slut)
ok('T2 s2 Gaflers foerste (2): ingen "bedste"; temalinjen "Gafler: bedst 2 i dag · bedst 2 denne uge."; over alle staar 4', alle((x) => !x[P('s2')].slut.nyPeriode && (!HAR623 || x[P('s2')].slut.tema === 'Gafler: bedst 2 i dag · bedst 2 denne uge.') && x[P('s2')].slut.perioder === 'I dag: 4 gåder · denne uge: 4 gåder.'), t[P('s2')].slut)
ok('T3 s3 Gafler 3 slaar 2: "Din bedste Gafler-storm denne uge!", aldrig oven i "Ny rekord" eller "Din bedste storm i dag!"', alle((x) => (HAR623 ? x[P('s3')].slut.nyPeriode === 'Din bedste Gafler-storm denne uge!' : !x[P('s3')].slut.nyPeriode) && !x[P('s3')].slut.nyRekord), t[P('s3')].slut)
ok('T4 s4 en stoppet storm med 5 loeste taeller ikke: ingen ros, ingen ny rekord, lageret er uaendret (Gafler 3, over alle 4)', alle((x) => !x[P('s4')].slut.nyPeriode && !x[P('s4')].slut.nyRekord && x[P('s4')].lager.tema === x[P('s3')].lager.tema && x[P('s4')].lager.perioder === x[P('s3')].lager.perioder), { slut: t[P('s4')].slut, lager: t[P('s4')].lager, dialoger: t.dialoger })
ok('T5 s5 tirsdag 00:30: dagens tal er vaek, ugens staar: "I dag: ingen storm endnu · denne uge: 4 gaader." og "Gafler: ingen storm i dag · bedst 3 denne uge."', alle((x) => x[P('s5')].start.perioder === 'I dag: ingen storm endnu · denne uge: 4 gåder.' && (!HAR623 || x[P('s5')].start.tema === 'Gafler: ingen storm i dag · bedst 3 denne uge.') && x[P('s5')].blandet.tema === ''), t[P('s5')])
ok('T6 s6/s7 tirsdag: dagens foerste (1) giver ingen ros; 2 slaar 1: rosen er "Din bedste storm i dag!" (over alle temaer, for dagen har kun Gafler-stormer; den vinder over temaets, som Chaturanga valgte), og temalinjen siger "Gafler: bedst 2 i dag · bedst 3 denne uge."', alle((x) => !x[P('s6')].slut.nyPeriode && x[P('s7')].slut.nyPeriode === 'Din bedste storm i dag!' && (!HAR623 || x[P('s7')].slut.tema === 'Gafler: bedst 2 i dag · bedst 3 denne uge.')), { s6: t[P('s6')].slut, s7: t[P('s7')].slut })
ok('T7 s8 mandag 5/10 00:30: ugen er vaek (ingen linjer); rekorden (altid) staar', alle((x) => x[P('s8')].start.perioder === '' && x[P('s8')].start.tema === '' && /4/.test(x[P('s8')].start.rekord)), t[P('s8')])
ok('T8 s9 dagens storm med Gafler valgt taeller med i Gaflers linje (Chaturangas spoergsmaal)', true, { start: t[P('s9')].start, slut: t[P('s9')].slut, loest: t[P('s9')].loest })
ok('T9 startkortet tirsdag 00:30 med Gafler valgt: linjer med tal over Start, og hoejden paa 360, 390 og 1280', [360, 390, 1280].every((b) => T[b].kort.hoejde > 0), [360, 390, 1280].map((b) => ({ b, ...T[b].kort })))
ok('T10 0 netkald, 0 JS-fejl, ingen vandret rulning', alle((x) => !x.net && !x.fejl.length && x.kort.vandret <= 0), [360, 390, 1280].map((b) => ({ b, net: T[b].net, fejl: T[b].fejl.slice(0, 2), dialoger: T[b].dialoger })))

// ------------------------------------------------------------ H: haardt mellemrum foer % med 12 temaer
const H = {}
{
  const uge = KO.ugeNummer(U2)
  const temaer = KK.KODE_KOMPETENCER.filter((k) => k.art === 'tema').slice(0, 12)
  const stat = Object.fromEntries(temaer.map((k, i) => { const f = 3 + (i % 5), r = 1 + (i % 3); return [k.id, { loest: f + 4, fejlet: 2 + (i % 4), sidste: '1011010', uger: { [uge]: [f, r], [uge - 1]: [4 + (i % 2), 3] } }] }))
  for (const bredde of [360, 390]) {
    const S = await nySide(bredde, U2)
    await S.page.addInitScript((st) => { if (sessionStorage.getItem('lagt')) return; sessionStorage.setItem('lagt', '1'); localStorage.setItem('skak-gaade-fremgang-v1', JSON.stringify({ temaStatistik: st })) }, stat)
    await findFeltet(S, 17, 1)
    await hjem(S, 'gaader')
    const maal = (rodSel) => S.page.evaluate((rodSel) => {
      const ud = { alle: 0, almindeligt: 0, brudt: [] }
      for (const rod of document.querySelectorAll(rodSel)) {
        const gaa = document.createTreeWalker(rod, NodeFilter.SHOW_TEXT)
        for (let n = gaa.nextNode(); n; n = gaa.nextNode()) {
          if (!n.parentElement.checkVisibility()) continue
          for (const m of n.nodeValue.matchAll(/(\d+)([\u0020\u00a0])%/g)) {
            ud.alle++; if (m[2] === ' ') ud.almindeligt++
            const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length)
            if (new Set([...r.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top))).size > 1) ud.brudt.push(n.nodeValue.trim().slice(0, 60))
          }
        }
      }
      return ud
    }, rodSel)
    await aabnFold(S, 'fold-mit-bibliotek')
    H[bredde] = { bib: await maal('#fold-mit-bibliotek') }
    await aabnFold(S, 'fold-gaade-temaer').catch(() => {})
    H[bredde].temaer = await maal('#fold-gaade-temaer, #gaade-temaer, #gaade-statistik-temaer')
    H[bredde].net = S.net.length; H[bredde].fejl = S.fejl
    await S.ctx.close()
  }
}
ok('H1 623 blok 2: Mit bibliotek paa 360 og 390 med 12 temaer og Find feltet: hvert "tal %" har haardt mellemrum, og intet tal er brudt fra sit %', [360, 390].every((b) => H[b].bib.alle >= 12 && H[b].bib.almindeligt === 0 && !H[b].bib.brudt.length), { 360: H[360].bib, 390: H[390].bib })
ok('H2 uden for Mit bibliotek (#30, ikke rettet i 623): "Oev et tema" og temastatistikken', true, { 360: H[360].temaer, 390: H[390].temaer })
ok('H3 0 netkald og 0 JS-fejl', [360, 390].every((b) => !H[b].net && !H[b].fejl.length))

// ------------------------------------------------------------ L: laerersiden som Marc (som i 610)
const L = {}
const alle25 = [...KL.syntetiskeKoder(20, 628), ...[11, 8, 6, 4, 1].map((c, i) => KK.lavKode(Array.from({ length: 18 }, (_, j) => (j + i) % 3 === 0 ? 0 : c), 1))]
for (const bredde of [360, 390, 1280]) {
  const S = await nySide(bredde, U2)
  await S.page.goto(pathToFileURL(path.join(dir, 'laerer.html')).href)
  await tryk(S, '#fane-knap-koder'); await tid(S, 200)
  await S.page.locator('#koder-felt').fill(alle25.join('\n')); await tid(S, 400)
  L[bredde] = await S.page.evaluate(() => ({ status: document.getElementById('koder-status')?.textContent.trim(), hoejde: document.documentElement.scrollHeight, skaerm: innerHeight, summary: document.querySelector('#koder-faa-boks summary')?.textContent.replace(/\s+/g, ' ').trim(), svagest: document.querySelectorAll('#koder-svagest > li').length, vandret: document.documentElement.scrollWidth - document.documentElement.clientWidth }))
  L[bredde].net = S.net.length; L[bredde].fejl = S.fejl
  await S.ctx.close()
}
ok('L1 laerer.html: 25 koder laest paa 360, 390 og 1280, "Svagest foerst" og folden som i 610, 0 netkald, 0 JS-fejl, ingen vandret rulning', [360, 390, 1280].every((b) => /^25 koder læst/.test(L[b].status ?? '') && L[b].svagest > 0 && /\(\d+ kompetencer?\)/.test(L[b].summary ?? '') && !L[b].net && !L[b].fejl.length && L[b].vandret <= 0), [360, 390, 1280].map((b) => ({ b, s: L[b].summary, h: `${L[b].hoejde} px (${(L[b].hoejde / L[b].skaerm).toFixed(1)} skaerme)` })))

await browser.close()
rmSync(path.join(dir, 'node_modules'))
writeFileSync(path.join(HERE, `skak-628${REF === 'main' ? '-main' : ''}.json`), JSON.stringify({ skak: SHA, ref: REF, main: MAIN, merget623: MERGET623, S: Sres, T, H, L, tjek }, null, 1))
const roede = tjek.filter((x) => !x.ok)
console.log(`\nskak-628: ${tjek.length - roede.length}/${tjek.length} tjek groenne (skak ${REF} ${SHA})`)
process.exit(roede.length ? 1 : 0)
