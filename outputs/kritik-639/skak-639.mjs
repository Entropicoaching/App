// Kritik 639, blok 2: skakken efter Chaturangas 623 og 629 (begge merget; main), hentet med git archive; skak-traeet
// roeres ikke. Som elev paa 12 aar (360 og 390 med touch, 1280 med mus) og som laerer (laerer.html), headless, uden net,
// paa Playwrights falske ur. Alt elevens er spillet i appen med tryk (gaaderne og stormene loeses ved at slaa stillingen
// op i banken); kun lageret fra foer 629 (del T), temastatistikken (del H) og et gemt parti (del H) er lagt ind.
//   S  som 628: ugesaetningen med alle fire slags og S7 (Find feltet) i to uger; skal staa som foer.
//   T  Stormen efter 623 og 629 over to uger: en elev fra foer 629, temaets rekord, "nogensinde", Stop, "Ny rekord"
//      oven i, ny uge, dagens storm med tema, Blandet, og S10 (een linje paa startkortet) paa 360, 390 og 1280.
//   H  Haardt mellemrum foer % paa 360 og 390 med mange data: "Oev et tema" med alle temaer, Mit bibliotek og analysen
//      efter et langt parti mod computeren.
//   L  Laerersiden med 25 koder paa 360, 390 og 1280, ogsaa % med alle folder aabne.
//   node outputs/kritik-639/skak-639.mjs     -> skak-639.json og S-*.png her.
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
const REF = process.env.SKAK_REF || 'main'
const SHA = execSync(`git -C ${SKAK} rev-parse --short ${REF}`).toString().trim()
const MAIN = execSync(`git -C ${SKAK} rev-parse --short main`).toString().trim()
const erMerget = (b) => execSync(`git -C ${SKAK} merge-base --is-ancestor refs/heads/${b} main && echo ja || echo nej`).toString().trim()
const MERGET623 = erMerget('ordre-623'), MERGET629 = erMerget('ordre-629')
const dir = mkdtempSync(path.join(tmpdir(), 'k639-skak-'))
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
  for (let i = 0; i < 20 && !g; i++) { await tid(S, 300); await S.page.waitForTimeout(60); fen = await fenNu(S); g = iBank.get(fenNoegle(fen)) } // 639: ogsaa aegte tid, appen venter paa mere end timere
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
  if (bredde === 360) { await S.page.evaluate(() => document.getElementById('mit-uge-tekst')?.scrollIntoView({ block: 'center' })); await tid(S, 300); await S.page.screenshot({ path: path.join(HERE, 'S-360-639-uge1-fire-slags.png') }) }
  await S.page.clock.setSystemTime(U2)
  await findFeltet(S, 20, 2)
  await aabning(S, 'italiensk', false)
  await kendtParti(S, KENDTE_PARTIER[1], false)
  R.bib2 = await bibliotek(S)
  if (bredde === 390) { await S.page.evaluate(() => document.querySelector('#mit-bibliotek-grupper li[data-art="koordinat"][data-id="find"]')?.scrollIntoView({ block: 'center' })); await tid(S, 300); await S.page.screenshot({ path: path.join(HERE, 'S-390-639-uge2-find.png') }) }
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

// ------------------------------------------------------------ T: stormen efter 623 og 629 over to uger
// En elev fra foer 629: rekorden over alle temaer 9, 623's Gafler-post med bedst 4 en dag og 7 i sidste uge, ingen
// temarekord. Saa stormer eleven i appen paa det falske ur.
const STORM_LINJER = { rekord: '#storm-rekord', tema: '#storm-tema-perioder' }
const SLUT_LINJER = { overskrift: '#storm-resultat-overskrift', nyRekord: '#storm-ny-rekord', nyPeriode: '#storm-ny-periode', rekord: '#storm-resultat-rekord', perioder: '#storm-resultat-perioder', tema: '#storm-resultat-tema-perioder' }
async function linjer(S, L) { const o = {}; for (const [k, sel] of Object.entries(L)) o[k] = await tekst(S, sel); return o }
const KORT = () => {
  const k = document.getElementById('storm-start-kort'), l = document.getElementById('storm-tema-perioder'), seg = document.getElementById('segment-storm-tema')
  const r = (e) => e.getBoundingClientRect()
  const lh = parseFloat(getComputedStyle(l).lineHeight) || 20
  const valgt = seg.querySelector('[aria-pressed="true"], [aria-checked="true"], .aktiv, .valgt') || seg
  return { hoejde: Math.round(r(k).height), linjeLinjer: l.textContent.trim() ? Math.round(r(l).height / lh) : 0, linjeUnderSegment: Math.round(r(l).top - r(seg).bottom), linjeUnderValgt: Math.round(r(l).top - r(valgt).bottom), linjeISkaerm: r(l).top >= 0 && r(l).bottom <= innerHeight, segmentISkaerm: r(seg).top >= 0 && r(seg).bottom <= innerHeight, startKnapTop: Math.round(r(document.getElementById('knap-storm-start')).top - r(k).top), vandret: document.documentElement.scrollWidth - document.documentElement.clientWidth, over: [...k.querySelectorAll('p, div')].filter((e) => e.checkVisibility() && r(e).bottom <= r(seg).top && e.textContent.trim() && !e.children.length).map((e) => e.textContent.trim().slice(0, 50)) }
}
async function stormStart(S, tema) {
  await hjem(S, 'gaader')
  await S.page.locator(`#segment-storm-tema [data-value="${tema}"]`).scrollIntoViewIfNeeded()
  await tryk(S, `#segment-storm-tema [data-value="${tema}"]`); await tid(S, 200)
  return linjer(S, STORM_LINJER)
}
async function storm(S, { tema, loes, stop = false, dagens = false }) {
  const start = await stormStart(S, tema)
  const knap = dagens ? '#knap-storm-dagens' : '#knap-storm-start'
  for (let i = 0; i < 100 && (await S.page.locator(knap).isDisabled()); i++) { await tid(S, 200); await S.page.waitForTimeout(30) }
  await tryk(S, knap); await tid(S, 500)
  const loest = []
  // Appens egen taeller (#storm-loeste) bestemmer, hvornaar eleven holder op (i 639's foerste koersel talte mit script
  // 10 paa 390, mens appen talte 9: en gaade blev ikke faerdig).
  const appTal = async () => +(await S.page.textContent('#storm-loeste') || 0)
  for (let n = 0; n < loes + 4 && (await appTal()) < loes; n++) {
    const foer = await fenNu(S)
    const r = await loesGaade(S); loest.push(r.tema ?? null); if (!r.fundet) { await tid(S, 500); continue } // stillingen er ikke kommet endnu: proev igen
    for (let i = 0; i < 10 && (await fenNu(S)) === foer; i++) await tid(S, 200) // vent paa en ny stilling (Chaturangas 629)
    await tid(S, 300)
  }
  if (stop) { await tryk(S, '#knap-storm-stop'); await tid(S, 500) } else { await tid(S, 200000) }
  await tid(S, 500)
  const app = +((await tekst(S, '#storm-resultat-overskrift')).match(/løste (?:alle )?(\d+)/) || [0, -1])[1]
  const slut = await linjer(S, SLUT_LINJER)
  const L = await lager(S)
  return { start, loest, app, slut, lager: { tema: L['skak-gaade-storm-perioder-tema-v1'] ?? null, temaRekord: L['skak-gaade-storm-rekord-tema-v1'] ?? null, rekord: L['skak-gaade-storm-rekord-v1'] ?? null } }
}
const dag = (d, h, m = 0) => new Date(2026, 8, d, h, m) // sep. 2026; 5. okt. = 35. sep.
const UGE_NU = KO.ugeNummer(dag(28, 9))
const FOER629 = {
  'skak-gaade-storm-rekord-v1': JSON.stringify({ loeste: 9, kombo: 4, dato: '2026-09-01' }),
  'skak-gaade-storm-perioder-tema-v1': JSON.stringify({ gaffel: { dag: { dato: '2026-09-24', loeste: 4 }, uge: { uge: UGE_NU - 1, loeste: 7 } } }),
}
const PLAN = [
  ['r0 man 28/9 09:00 startkortet', dag(28, 9), null],
  ['r1 man 10:00 Gafler, 3', dag(28, 10), { tema: 'gaffel', loes: 3 }],
  ['r2 man 11:00 Gafler, 8', dag(28, 11), { tema: 'gaffel', loes: 8 }],
  ['r3 man 12:00 Gafler, 9 og Stop', dag(28, 12), { tema: 'gaffel', loes: 9, stop: true }],
  ['r4 tir 29/9 10:00 Gafler, 10', dag(29, 10), { tema: 'gaffel', loes: 10 }],
  ['r5 man 5/10 00:30 startkortet', dag(35, 0, 30), null],
  ['r6 man 5/10 10:00 Gafler, 2', dag(35, 10), { tema: 'gaffel', loes: 2 }],
  ['r7 man 5/10 11:00 dagens storm med Gafler valgt, 11', dag(35, 11), { tema: 'gaffel', loes: 11, dagens: true }],
  ['r8 man 5/10 12:00 Blandet, 3', dag(35, 12), { tema: 'blandet', loes: 3 }],
]
const T = {}
for (const bredde of [360, 390, 1280]) {
  const S = await nySide(bredde, PLAN[0][1])
  await S.page.addInitScript((l) => { if (sessionStorage.getItem('lagt')) return; sessionStorage.setItem('lagt', '1'); for (const [k, v] of Object.entries(l)) localStorage.setItem(k, v) }, FOER629)
  T[bredde] = {}
  for (const [navn, tidspunkt, opt] of PLAN) {
    await S.page.clock.setSystemTime(tidspunkt)
    if (opt) T[bredde][navn] = await storm(S, opt)
    else {
      const blandet = await stormStart(S, 'blandet'); const kortBlandet = await S.page.evaluate(KORT)
      if (bredde === 360 && navn.startsWith('r0')) { await S.page.locator('#storm-start-kort').scrollIntoViewIfNeeded(); await tid(S, 300); await S.page.screenshot({ path: path.join(HERE, 'S-360-639-startkort-blandet.png') }) }
      await tryk(S, '#segment-storm-tema [data-value="gaffel"]'); await tid(S, 200)
      const gaffel = await linjer(S, STORM_LINJER); const kortGaffel = await S.page.evaluate(KORT)
      if (bredde === 360 && navn.startsWith('r0')) { await S.page.screenshot({ path: path.join(HERE, 'S-360-639-startkort-gafler.png') }) }
      T[bredde][navn] = { blandet, gaffel, kortBlandet, kortGaffel }
    }
    if (bredde === 360 && /^r[24]/.test(navn)) { await S.page.locator('#storm-resultat').scrollIntoViewIfNeeded(); await tid(S, 300); await S.page.screenshot({ path: path.join(HERE, `S-360-639-slutkort-${navn.slice(0, 2)}.png`) }) }
  }
  T[bredde].net = S.net.length; T[bredde].fejl = S.fejl; T[bredde].dialoger = S.dialoger
  await S.ctx.close()
}
const t = T[360], P = (n) => PLAN.find((p) => p[0].startsWith(n))[0]
const alle = (fn) => [360, 390, 1280].every((b) => fn(T[b]))
const ANDRE = ['r1', 'r2', 'r3', 'r4', 'r6', 'r7']
ok('T0 stormene er spillet i appen: alle gaader i Gafler-stormene er gafler, og appen talte det planlagte antal loeste', alle((x) => ANDRE.every((n) => x[P(n)].loest.filter(Boolean).every((tm) => tm === 'fork') && x[P(n)].app === PLAN.find((p) => p[0] === P(n))[2].loes)), [360, 390, 1280].map((b) => Object.fromEntries(ANDRE.map((n) => [n, `app ${T[b][P(n)].app}, forsoeg ${T[b][P(n)].loest.length} ${[...new Set(T[b][P(n)].loest)]}`]))))
ok('T1 en elev fra foer 629 (623: bedst 4 en dag, 7 i sidste uge): startkortet med Gafler siger med det samme "Gafler: rekord 7." og under Blandet ingen linje', alle((x) => x[P('r0')].gaffel.tema === 'Gafler: rekord 7.' && x[P('r0')].blandet.tema === ''), { gaffel: t[P('r0')].gaffel, blandet: t[P('r0')].blandet })
ok('T2 r1 ugens foerste Gafler-storm (3): ingen ros; "Gafler: bedst 3 i dag · bedst 3 denne uge · rekord 7."; lageret {"gaffel":7}', alle((x) => !x[P('r1')].slut.nyPeriode && x[P('r1')].slut.tema === 'Gafler: bedst 3 i dag · bedst 3 denne uge · rekord 7.' && x[P('r1')].lager.temaRekord === '{"gaffel":7}'), { slut: t[P('r1')].slut, lager: t[P('r1')].lager.temaRekord })
ok('T3 r2 8 slaar 623\'s 7: "Din bedste Gafler-storm nogensinde!" (ikke "denne uge"), ingen "Ny rekord" (over alle er 9), "· rekord 8."', alle((x) => x[P('r2')].slut.nyPeriode === 'Din bedste Gafler-storm nogensinde!' && !x[P('r2')].slut.nyRekord && /· rekord 8\.$/.test(x[P('r2')].slut.tema) && x[P('r2')].lager.temaRekord === '{"gaffel":8}'), t[P('r2')].slut)
ok('T4 r3 en stoppet storm med 9 loeste taeller ikke: ingen ros, lageret uaendret', alle((x) => !x[P('r3')].slut.nyPeriode && !x[P('r3')].slut.nyRekord && x[P('r3')].lager.temaRekord === x[P('r2')].lager.temaRekord && x[P('r3')].lager.tema === x[P('r2')].lager.tema), { slut: t[P('r3')].slut, lager: t[P('r3')].lager })
ok('T5 r4 tirsdag 10 slaar baade Gaflers 8 og rekorden over alle (9): "Ny rekord paa denne enhed!" alene, ingen "Din bedste Gafler-storm nogensinde!" oven i; "· rekord 10."', alle((x) => x[P('r4')].slut.nyRekord && !x[P('r4')].slut.nyPeriode && /· rekord 10\.$/.test(x[P('r4')].slut.tema) && x[P('r4')].lager.temaRekord === '{"gaffel":10}'), t[P('r4')].slut)
ok('T6 r5 ny uge (mandag 5/10 00:30): startkortet med Gafler siger "Gafler: rekord 10.", under Blandet ingen linje', alle((x) => x[P('r5')].gaffel.tema === 'Gafler: rekord 10.' && x[P('r5')].blandet.tema === ''), { gaffel: t[P('r5')].gaffel, blandet: t[P('r5')].blandet })
ok('T7 r6 ugens foerste (2): ingen ros; "Gafler: bedst 2 i dag · bedst 2 denne uge · rekord 10."', alle((x) => !x[P('r6')].slut.nyPeriode && x[P('r6')].slut.tema === 'Gafler: bedst 2 i dag · bedst 2 denne uge · rekord 10.'), t[P('r6')].slut)
ok('T8 r7 dagens storm med Gafler valgt (11) taeller med i Gaflers linje og rekord, og i rekorden over alle', true, { slut: t[P('r7')].slut, lager: t[P('r7')].lager, loest: t[P('r7')].loest.length })
ok('T9 r8 Blandet (3): slutkortet har "I alt: ..." og ingen temalinje; startkortet under Blandet siger "I alt: bedst ... i dag · bedst ... denne uge." (S10)', alle((x) => /^I alt: bedst \d+ i dag · bedst \d+ denne uge\.$/.test(x[P('r8')].slut.perioder) && !x[P('r8')].slut.tema && /^I alt: bedst \d+ i dag · bedst \d+ denne uge\.$/.test(x[P('r8')].start.tema)), { start: t[P('r8')].start, slut: t[P('r8')].slut })
ok('T10 S10 startkortet: een linje under temavalget (ingen over), hoejden med Blandet og Gafler, og hvor linjen staar, naar man trykker paa Gafler', alle((x) => x[P('r5')].kortGaffel.linjeLinjer === 1 && x[P('r5')].kortGaffel.linjeUnderSegment >= 0), [360, 390, 1280].map((b) => ({ b, blandet: T[b][P('r0')].kortBlandet, gaffel: T[b][P('r5')].kortGaffel })))
ok('T11 0 netkald, 0 JS-fejl, 0 dialoger, ingen vandret rulning', alle((x) => !x.net && !x.fejl.length && !x.dialoger.length && x[P('r5')].kortGaffel.vandret <= 0), [360, 390, 1280].map((b) => ({ b, net: T[b].net, fejl: T[b].fejl.slice(0, 2) })))

// ------------------------------------------------------------ H: haardt mellemrum foer % med mange data paa 360
const maalProcent = (S, rodSel) => S.page.evaluate((rodSel) => {
  const ud = { alle: 0, almindeligt: 0, brudt: [] }
  for (const rod of document.querySelectorAll(rodSel)) {
    const gaa = document.createTreeWalker(rod, NodeFilter.SHOW_TEXT)
    for (let n = gaa.nextNode(); n; n = gaa.nextNode()) {
      if (!n.parentElement.checkVisibility()) continue
      for (const m of n.nodeValue.matchAll(/(\d+)([  ])%/g)) {
        ud.alle++; if (m[2] === ' ') ud.almindeligt++
        const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length)
        if (new Set([...r.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top))).size > 1) ud.brudt.push(n.nodeValue.trim().slice(0, 60))
      }
    }
  }
  return ud
}, rodSel)
const H = {}
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
// "Det evige parti" (Anderssen 1852, 24 traek, mat), spillet som hvid mod computeren niveau 1.
const LANGT = 'e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Ba5 d4 exd4 O-O d3 Qb3 Qf6 e5 Qg6 Re1 Nge7 Ba3 b5 Qxb5 Rb8 Qa4 Bb6 Nbd2 Bb7 Ne4 Qf5 Bxd3 Qh5 Nf6+ gxf6 exf6 Rg8 Rad1 Qxf3 Rxe7+ Nxe7 Qxd7+ Kxd7 Bf5+ Ke8 Bd7+ Kf8 Bxe7#'.split(' ')
{ const c = new Chess(START_FEN); for (const m of LANGT) c.move(m); H.partiMat = c.isCheckmate() }
{
  const uge = KO.ugeNummer(U2)
  const temaer = KK.KODE_KOMPETENCER.filter((k) => k.art === 'tema')
  const stat = Object.fromEntries(temaer.map((k, i) => { const f = 3 + (i % 5), r = 1 + (i % 3); return [k.id, { loest: 90 + i * 7, fejlet: 2 + (i % 11), sidste: '1011010', uger: { [uge]: [f, r], [uge - 1]: [4 + (i % 2), 3] } }] }))
  H.temaer = temaer.length
  for (const bredde of [360, 390]) {
    const S = await nySide(bredde, U2)
    await S.page.addInitScript((st) => { if (sessionStorage.getItem('lagt')) return; sessionStorage.setItem('lagt', '1'); localStorage.setItem('skak-gaade-fremgang-v1', JSON.stringify({ temaStatistik: st })) }, stat)
    await findFeltet(S, 17, 1)
    await hjem(S, 'gaader')
    await aabnFold(S, 'fold-gaade-temaer').catch(() => {})
    H[bredde] = { temaer: await maalProcent(S, '#gaade-temaer'), knapper: await S.page.locator('#gaade-temaer .gaade-tema-knap').count() }
    if (bredde === 360) { await S.page.locator('#gaade-temaer').scrollIntoViewIfNeeded(); await tid(S, 300); await S.page.screenshot({ path: path.join(HERE, 'S-360-639-oev-et-tema-17.png'), fullPage: false }) }
    await aabnFold(S, 'fold-mit-bibliotek')
    H[bredde].bib = await maalProcent(S, '#fold-mit-bibliotek')
    H[bredde].net = S.net.length; H[bredde].fejl = S.fejl
    await S.ctx.close()
    // Analysen efter et langt parti mod computeren.
    const S2 = await nySide(bredde, U2)
    const parti = JSON.stringify({ grundFen: START_FEN, traekSan: LANGT, spilModstander: { computerFarve: 'b', niveau: '1', farveValg: 'w' }, orientering: 'hvid', resignation: null })
    await S2.page.addInitScript((p) => { if (sessionStorage.getItem('lagt')) return; sessionStorage.setItem('lagt', '1'); localStorage.setItem('skak-spil-parti-v1', p) }, parti)
    await S2.page.goto(pathToFileURL(path.join(dir, 'skak.html')).href)
    await S2.page.waitForSelector('#braet .felt')
    await tid(S2, 500)
    await tryk(S2, '#fane-spil'); await tid(S2, 300)
    let klar = false
    for (let i = 0; i < 300 && !klar; i++) { await tid(S2, 200); await S2.page.waitForTimeout(40); klar = await S2.page.evaluate(() => { const e = document.getElementById('partital-indhold'); return !!e && !e.hidden }) }
    H[bredde].analyse = klar ? await maalProcent(S2, '#partital') : null
    H[bredde].analyseVandret = await S2.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    if (bredde === 360 && klar) { await S2.page.locator('#partital').scrollIntoViewIfNeeded(); await tid(S2, 300); await S2.page.screenshot({ path: path.join(HERE, 'S-360-639-analyse-langt-parti.png') }) }
    H[bredde].net += S2.net.length; H[bredde].fejl = [...H[bredde].fejl, ...S2.fejl]
    await S2.ctx.close()
  }
}
ok(`H1 "Oev et tema" med alle ${H.temaer} temaer paa 360 og 390: hvert "tal %" har haardt mellemrum, og intet er brudt`, [360, 390].every((b) => H[b].knapper >= H.temaer && H[b].temaer.alle >= H.temaer && H[b].temaer.almindeligt === 0 && !H[b].temaer.brudt.length), { 360: H[360].temaer, knapper: H[360].knapper })
ok('H2 Mit bibliotek med alle temaer og Find feltet paa 360 og 390: samme', [360, 390].every((b) => H[b].bib.alle >= 12 && H[b].bib.almindeligt === 0 && !H[b].bib.brudt.length), { 360: H[360].bib })
ok(`H3 analysen efter et langt parti mod computeren (${LANGT.length} halvtraek, mat: ${H.partiMat}) paa 360 og 390: hvert "tal %" samlet, ingen vandret rulning`, H.partiMat && [360, 390].every((b) => H[b].analyse && H[b].analyse.alle >= 2 && H[b].analyse.almindeligt === 0 && !H[b].analyse.brudt.length && H[b].analyseVandret <= 0), { 360: H[360].analyse, 390: H[390].analyse })
ok('H4 0 netkald og 0 JS-fejl', [360, 390].every((b) => !H[b].net && !H[b].fejl.length), [360, 390].map((b) => ({ b, net: H[b].net, fejl: H[b].fejl.slice(0, 2) })))

// ------------------------------------------------------------ L: laerersiden som Marc (som i 610 og 628)
const L = {}
const alle25 = [...KL.syntetiskeKoder(20, 639), ...[11, 8, 6, 4, 1].map((c, i) => KK.lavKode(Array.from({ length: 18 }, (_, j) => (j + i) % 3 === 0 ? 0 : c), 1))]
for (const bredde of [360, 390, 1280]) {
  const S = await nySide(bredde, U2)
  await S.page.goto(pathToFileURL(path.join(dir, 'laerer.html')).href)
  await tryk(S, '#fane-knap-koder'); await tid(S, 200)
  await S.page.locator('#koder-felt').fill(alle25.join('\n')); await tid(S, 400)
  L[bredde] = await S.page.evaluate(() => ({ status: document.getElementById('koder-status')?.textContent.trim(), hoejde: document.documentElement.scrollHeight, skaerm: innerHeight, summary: document.querySelector('#koder-faa-boks summary')?.textContent.replace(/\s+/g, ' ').trim(), svagest: document.querySelectorAll('#koder-svagest > li').length, vandret: document.documentElement.scrollWidth - document.documentElement.clientWidth }))
  // Aabn alle folder, saa alle procenttal er synlige.
  await S.page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true })); await tid(S, 300)
  L[bredde].procent = await maalProcent(S, 'body')
  if (bredde === 360) { await S.page.locator('#koder-svagest').scrollIntoViewIfNeeded().catch(() => {}); await tid(S, 300); await S.page.screenshot({ path: path.join(HERE, 'S-360-639-laerer-koder.png') }) }
  L[bredde].net = S.net.length; L[bredde].fejl = S.fejl
  await S.ctx.close()
}
ok('L1 laerer.html: 25 koder laest paa 360, 390 og 1280, "Svagest foerst" og folden som i 610, 0 netkald, 0 JS-fejl, ingen vandret rulning', [360, 390, 1280].every((b) => /^25 koder læst/.test(L[b].status ?? '') && L[b].svagest > 0 && /\(\d+ kompetencer?\)/.test(L[b].summary ?? '') && !L[b].net && !L[b].fejl.length && L[b].vandret <= 0), [360, 390, 1280].map((b) => ({ b, s: L[b].summary, h: `${L[b].hoejde} px (${(L[b].hoejde / L[b].skaerm).toFixed(1)} skaerme)` })))
ok('L2 laerersiden med alle folder aabne: hvert "tal %" har haardt mellemrum, og intet er brudt (360, 390, 1280)', [360, 390, 1280].every((b) => L[b].procent.alle >= 25 && L[b].procent.almindeligt === 0 && !L[b].procent.brudt.length), [360, 390, 1280].map((b) => ({ b, ...L[b].procent, brudt: L[b].procent.brudt.slice(0, 3) })))

await browser.close()
rmSync(path.join(dir, 'node_modules'))
writeFileSync(path.join(HERE, 'skak-639.json'), JSON.stringify({ skak: SHA, ref: REF, main: MAIN, merget623: MERGET623, merget629: MERGET629, S: Sres, T, H, L, tjek }, null, 1))
const roede = tjek.filter((x) => !x.ok)
console.log(`\nskak-639: ${tjek.length - roede.length}/${tjek.length} tjek groenne (skak ${REF} ${SHA})`)
process.exit(roede.length ? 1 : 0)
