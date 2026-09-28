// Kritik 610, blok 2: skakken efter Chaturangas 604 (main, hentet med git archive; skak-traeet roeres ikke),
// som elev paa 12 aar (360 og 390 med touch, 1280 med mus) og som laerer (laerer.html), headless, uden net.
// Det Chaturanga bad mig proeve (RAPPORT-604, "Hvad Bhishak boer proeve"):
//   U  Uger over to rigtige uger: eleven tager "Find feltet", en aabning og et kendt parti i uge 1 (man. 21. sep.
//      2026), uret skrues en uge frem, og hun goer det igen (man. 28. sep.). Alt spilles i appen med tryk, intet
//      lagt i lageret. Staar "denne uge / sidste uge" rigtigt ved alle tre, og hvad siger saetningen?
//   N  Blandede forsoeg: "i N forsoeg" laegger koordinatsvar og gaader sammen.
//   L  Laerersiden som Marc: 25 koder paa 360, 390 og 1280 med den lukkede fold.
//   node outputs/kritik-610/skak-610.mjs     -> skak-610.json og S-*.png her. Kun syntetiske data.
import path from 'node:path'
import { writeFileSync, mkdtempSync, symlinkSync, rmSync } from 'node:fs'
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
const dir = mkdtempSync(path.join(tmpdir(), 'k610-skak-'))
execSync(`git -C "${SKAK}" archive -o "${path.join(dir, 's.tar')}" ${REF}`)
execSync('tar -xf s.tar', { cwd: dir })
symlinkSync(path.join(SKAK, 'node_modules'), path.join(dir, 'node_modules'), 'junction') // kun saa chess.js findes for de rene moduler
const imp = (f) => import(pathToFileURL(path.join(dir, f)).href)
const KK = await imp('src/kompetencekode.js')
const KL = await imp('src/klassekoder.js')
const KO = await imp('src/kompetencer.js')
const AB = await imp('src/aabningsbog.js')
const { KENDTE_PARTIER, kendtPartiOpgave } = await imp('src/kendtepartier.js')

const tjek = []
const ok = (hvad, b, data) => { tjek.push({ hvad, ok: !!b, data }); console.log(`${b ? 'OK  ' : 'ROED'} ${hvad}${data !== undefined ? ' ' + JSON.stringify(data).slice(0, 500) : ''}`) }

const browser = await chromium.launch({ headless: true })
const tekst = (S, sel) => S.page.evaluate((sel) => { const e = document.querySelector(sel); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null }, sel)
async function tryk(S, sel) { const l = S.page.locator(sel).first(); await l.scrollIntoViewIfNeeded(); if (S.mobil) await l.tap(); else await l.click() }
const tid = (S, ms) => S.page.clock.runFor(ms) // appens egne setTimeout (modstanderens svar) koerer paa det falske ur
async function nySide(bredde) {
  const mobil = bredde < 500
  const ctx = await browser.newContext({ viewport: { width: bredde, height: bredde === 360 ? 780 : mobil ? 844 : 800 }, isMobile: mobil, hasTouch: mobil, deviceScaleFactor: mobil ? 2 : 1 })
  const S = { ctx, mobil, bredde, net: [], fejl: [] }
  const page = await ctx.newPage()
  page.on('pageerror', (e) => S.fejl.push(e.message))
  page.on('dialog', (d) => { S.fejl.push('dialog: ' + d.message()); d.dismiss() })
  await page.route('**/*', (r) => { const u = r.request().url(); if (/^(file|data|blob):/.test(u)) return r.continue(); S.net.push(u); return r.abort() })
  S.page = page
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
  if (fane === 'gaader') { for (let i = 0; i < 100 && !(await S.page.evaluate(() => document.getElementById('gaade-indlaeser').hidden)); i++) { await tid(S, 200); await S.page.waitForTimeout(50) } }
}
const lager = (S) => S.page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)])))

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
  return tekst(S, '#koordinat-resultat, #koordinat-status, #koordinat-fundet')
}
// En aabning fra listen i "Oev en aabning". `fejlFoerst`: eet forkert (men lovligt) traek foer det foerste rigtige.
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
    if (fejlFoerst && ply === 0) { await feltTryk('g1'); await feltTryk('f3') } // Sf3 foerst: lovligt, ikke linjen
    const u = AB.forventetTraek(o, ply).uci
    await feltTryk(u.slice(0, 2)); await feltTryk(u.slice(2, 4))
    await tid(S, 200)
  }
  await tid(S, 800)
  return tekst(S, '#aabningsoevelse-besked, #aabningsoevelse-status')
}
// Et kendt parti fra listen i Gaader. `fejlFoerst`: eet forkert traek (og Fortryd) foer loesningen.
async function kendtParti(S, parti, fejlFoerst) {
  await hjem(S, 'gaader')
  await aabnFold(S, 'fold-kendte-partier')
  await tryk(S, `.kendt-parti-knap[data-parti="${parti.id}"]`); await tid(S, 1500)
  const o = kendtPartiOpgave(parti)
  const uci = async (u) => { await tryk(S, `#braet .felt[data-square="${u.slice(0, 2)}"]`); await tid(S, 100); await tryk(S, `#braet .felt[data-square="${u.slice(2, 4)}"]`); await tid(S, 1200) }
  if (fejlFoerst) {
    const { Chess } = await import(pathToFileURL(path.join(SKAK, 'node_modules/chess.js/dist/esm/chess.js')).href)
    const c = new Chess(o.fen)
    const m = c.moves({ verbose: true }).find((x) => x.from + x.to !== o.solutionUci[0].slice(0, 4) && !x.promotion)
    await uci(m.from + m.to)
    if (await S.page.locator('#knap-gaade-fortryd').isVisible()) { await tryk(S, '#knap-gaade-fortryd'); await tid(S, 600) }
  }
  for (let i = 0; i < o.solutionUci.length; i += 2) await uci(o.solutionUci[i])
  await tid(S, 1500)
  return tekst(S, '#status')
}
async function bibliotek(S) {
  await hjem(S, 'gaader')
  await aabnFold(S, 'fold-mit-bibliotek')
  return S.page.evaluate(() => {
    const uge = (sel) => document.querySelector(`${sel} .mit-bib-uge`)?.textContent.replace(/\s+/g, ' ').trim() ?? null
    const raekke = (sel) => document.querySelector(sel)?.innerText.replace(/\s+/g, ' ').trim() ?? null
    return {
      saetning: document.getElementById('mit-uge-tekst')?.textContent.trim() ?? null,
      find: uge('#mit-bibliotek-grupper li[data-art="koordinat"][data-id="find"]'),
      findRaekke: raekke('#mit-bibliotek-grupper li[data-art="koordinat"][data-id="find"]'),
      findKlasse: document.querySelector('#mit-bibliotek-grupper li[data-id="find"] .mit-bib-uge')?.className ?? null,
      aabning: uge('#mit-bibliotek-grupper li[data-art="aabning"]'),
      aabningRaekke: raekke('#mit-bibliotek-grupper li[data-art="aabning"]'),
      kendte: uge('#mit-bibliotek-grupper li[data-art="kendte"]'),
      kendteRaekke: raekke('#mit-bibliotek-grupper li[data-art="kendte"]'),
      vandret: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }
  })
}
async function kode(S) {
  await aabnFold(S, 'fold-mit-bibliotek')
  await tryk(S, '#knap-vis-min-kode'); await tid(S, 300)
  return (await S.page.locator('#min-kode-tekst').innerText()).trim()
}

// ------------------------------------------------------------ U og N: to rigtige uger
const U1 = new Date(2026, 8, 21, 10), U2 = new Date(2026, 8, 28, 10)
const uge1 = KO.ugeNummer(U1), uge2 = KO.ugeNummer(U2)
ok('U0 ugeNummer: 21. og 28. sep. 2026 er to uger i traek, og ugerne tælles fortloebende fra 1970 (nytaar 2026/27 ogsaa: 28. dec. og 4. jan. er naboer)', uge2 === uge1 + 1 && KO.ugeNummer(new Date(2027, 0, 4)) === KO.ugeNummer(new Date(2026, 11, 28)) + 1 && KO.ugeNummer(new Date(2026, 8, 27, 23, 59)) === uge1, { uge1, uge2 })
const U = {}
for (const bredde of [360, 390, 1280]) {
  const R = (U[bredde] = {})
  const S = await nySide(bredde)
  await S.page.clock.install({ time: U1 })
  // Uge 1: en langsom runde Find feltet (8 rigtige, 0 forkerte), Italiensk parti med eet forkert traek, og Partiet i operaen med eet forkert traek.
  R.uge1 = { find: await findFeltet(S, 8, 0), aabning: await aabning(S, 'italiensk', true), kendt: await kendtParti(S, KENDTE_PARTIER[0], true) }
  R.bib1 = await bibliotek(S)
  // Uge 2: hun er blevet hurtigere (18 rigtige, 0 forkerte), Italiensk uden fejl, og et andet kendt parti uden fejl.
  await S.page.clock.setSystemTime(U2)
  R.bib2foer = await bibliotek(S)
  R.uge2 = { find: await findFeltet(S, 18, 0), aabning: await aabning(S, 'italiensk', false), kendt: await kendtParti(S, KENDTE_PARTIER[1], false) }
  R.bib2 = await bibliotek(S)
  if (bredde !== 360) {
    await S.page.locator('#mit-uge-tekst').scrollIntoViewIfNeeded(); await tid(S, 300)
    await S.page.screenshot({ path: path.join(HERE, `S-${bredde}-uge2-bibliotek.png`) })
  }
  const L = await lager(S)
  R.lager = { koord: JSON.parse(L['skak-koordinater-statistik-v1'] ?? 'null'), aab: JSON.parse(L['skak-aabningsbibliotek-v1'] ?? 'null'), kendte: JSON.parse(L['skak-kendte-partier-statistik-v1'] ?? 'null') }
  R.datoerILager = Object.values(L).join(' ').match(/20\d\d-\d\d-\d\d|\b1[6-9]\d{11}\b/g)?.length ?? 0
  R.tidsstempler = Object.entries(L).filter(([, v]) => /\b1[6-9]\d{11}\b/.test(v)).map(([k]) => k)
  // Koden: samme med og uden ugerne i de tre?
  R.kode = await kode(S)
  await S.page.evaluate(() => {
    for (const k of ['skak-koordinater-statistik-v1', 'skak-aabningsbibliotek-v1', 'skak-kendte-partier-statistik-v1']) {
      const d = JSON.parse(localStorage.getItem(k)); if (!d) continue
      const fjern = (o) => { if (o && typeof o === 'object') { delete o.uger; Object.values(o).forEach(fjern) } }
      fjern(d); localStorage.setItem(k, JSON.stringify(d))
    }
  })
  await hjem(S, 'gaader')
  R.kodeUdenUger = await kode(S)
  // Samme elev, men uge 2 med et forkert svar ekstra i Find feltet og samme fart: hvad siger saetningen? (N)
  R.net = S.net.length; R.fejl = S.fejl
  await S.ctx.close()
}
const u390 = U[390]
ok('U1 alt spillet i appen: uge 1 og uge 2 er gemt hver for sig ved Find feltet, Italiensk parti og de kendte partier (kun ugens nummer)', [360, 390, 1280].every((b) => { const L = U[b].lager; return JSON.stringify(L.koord?.find?.uger) === JSON.stringify({ [uge1]: [8, 8], [uge2]: [18, 18] }) && JSON.stringify(L.kendte?.uger) === JSON.stringify({ [uge1]: [1, 0], [uge2]: [1, 1] }) && JSON.stringify(Object.values(L.aab ?? {})[0]?.uger) === JSON.stringify({ [uge1]: [1, 0], [uge2]: [1, 1] }) }), Object.fromEntries([360, 390, 1280].map((b) => [b, { koord: U[b].lager.koord?.find, aab: Object.values(U[b].lager.aab ?? {})[0], kendte: U[b].lager.kendte }])))
ok('U2 uge 1: "denne uge" ved alle tre, "sidste uge: ikke oevet"', [360, 390, 1280].every((b) => { const x = U[b].bib1; return /^denne uge: 100 % i 8 forsøg · sidste uge: ikke øvet$/.test(x.find ?? '') && /^denne uge: 0 % i 1 forsøg · sidste uge: ikke øvet$/.test(x.aabning ?? '') && /^denne uge: 0 % i 1 forsøg · sidste uge: ikke øvet$/.test(x.kendte ?? '') }), u390.bib1)
ok('U3 mandag i uge 2, foer hun oever: uge 1 staar som "sidste uge" ved alle tre, og saetningen siger, at intet er oevet endnu', [360, 390, 1280].every((b) => { const x = U[b].bib2foer; return /denne uge: ikke øvet · sidste uge: 100 % i 8 forsøg/.test(x.find ?? '') && /sidste uge: 0 % i 1 forsøg/.test(x.aabning ?? '') && /sidste uge: 0 % i 1 forsøg/.test(x.kendte ?? '') && /ikke øvet noget denne uge/.test(x.saetning ?? '') }), u390.bib2foer)
ok('U4 uge 2: "denne uge / sidste uge" er rigtigt ved alle tre (Find feltet 100 % i 18 mod 100 % i 8, aabningen og de kendte partier 100 % i 1 mod 0 % i 1)', [360, 390, 1280].every((b) => { const x = U[b].bib2; return x.find === 'denne uge: 100 % i 18 forsøg · sidste uge: 100 % i 8 forsøg' && x.aabning === 'denne uge: 100 % i 1 forsøg · sidste uge: 0 % i 1 forsøg' && x.kendte === 'denne uge: 100 % i 1 forsøg · sidste uge: 0 % i 1 forsøg' }), u390.bib2)
ok('U5 fund S7: hun fandt 18 felter mod 8 paa samme 30 s (mere end dobbelt saa hurtig), men Find feltet siger 100 % mod 100 % uden pil, og saetningen naevner det ikke; farten, som er det, "Find feltet" oever, staar ingen steder', [360, 390, 1280].every((b) => !/\bop\b/.test(U[b].bib2.findKlasse ?? '') && !/bedre/.test(U[b].bib2.saetning ?? '')), { klasse: u390.bib2.findKlasse, saetning: u390.bib2.saetning, raekke: u390.bib2.findRaekke })
ok('N1 saetningen i uge 2 laegger 18 feltsvar, 1 aabning og 1 kendt parti sammen: "... i 20 forsoeg"; 18 af de 20 er tryk paa et felt', [360, 390, 1280].every((b) => /i 20 forsøg\.$/.test(U[b].bib2.saetning ?? '')), u390.bib2.saetning)
ok('U6 aabningen og de kendte partier: 0 % -> 100 % (et forsoeg hver uge) giver ingen pil og intet i saetningen (UGE_MIN 3)', [360, 390, 1280].every((b) => !/bedre til "(Italiensk|Kendte)/.test(U[b].bib2.saetning ?? '')), u390.bib2.saetning)
ok('U7 intet om tid i lageret ud over ugens nummer (ingen dato; tidsstempler kun hvor de var foer 604)', [360, 390, 1280].every((b) => !/20\d\d-\d\d-\d\d/.test(JSON.stringify(U[b].lager))), { tidsstempler: u390.tidsstempler })
ok('U8 koden er den samme med og uden ugerne i de tre (ugerne kommer ikke med i koden)', [360, 390, 1280].every((b) => U[b].kode === U[b].kodeUdenUger), [360, 390, 1280].map((b) => `${b}: ${U[b].kode} / ${U[b].kodeUdenUger}`))
ok('U9 skak.html: 0 netkald, 0 JS-fejl, ingen vandret rulning i Mit bibliotek (360, 390, 1280)', [360, 390, 1280].every((b) => !U[b].net && !U[b].fejl.length && U[b].bib2.vandret <= 0), [360, 390, 1280].map((b) => ({ b, net: U[b].net, fejl: U[b].fejl.slice(0, 2), v: U[b].bib2.vandret })))

// N2: hvad saetningen siger i andre almindelige uger (rene funktioner, samme som siden bruger).
{
  const k = (art, navn, u1, u2, extra = {}) => ({ art, navn, ...extra, uger: KO.temaUger({ uger: { [uge1]: u1, [uge2]: u2 } }, uge2) })
  const saet = {
    'langsom -> hurtig, samme praecision (Find feltet 8/8 -> 18/18)': KO.ugeSaetning([k('koordinat', 'Find feltet', [8, 8], [18, 18])]),
    'hurtig og sjusker lidt (10/10 -> 22/20) + gafler 3/5 -> 4/5': KO.ugeSaetning([k('koordinat', 'Find feltet', [10, 10], [22, 20]), k('tema', 'Gaffel', [5, 3], [5, 4], { flertal: 'Gafler' })]),
    'en runde Find feltet 12/13 + 3 gaader + 1 aabning': KO.ugeSaetning([k('koordinat', 'Find feltet', [0, 0], [13, 12]), k('tema', 'Gaffel', [0, 0], [3, 2], { flertal: 'Gafler' }), k('aabning', 'Italiensk parti', [0, 0], [1, 1], { farve: 'w' })]),
  }
  ok('N2 saetningen i tre almindelige uger (rene funktioner): hurtigere er ikke "bedre", og et par sjuskede feltsvar gaar foran en gaffel, der gik op', true, saet)
  U.saetninger = saet
}

// ------------------------------------------------------------ L: laerersiden som Marc
const L = {}
const nye20 = KL.syntetiskeKoder(20, 610)
const gamle5 = [11, 8, 6, 4, 1].map((c, i) => KK.lavKode(Array.from({ length: 18 }, (_, j) => (j + i) % 3 === 0 ? 0 : c), 1))
const alle25 = [...nye20, ...gamle5]
for (const bredde of [360, 390, 1280]) {
  const S = await nySide(bredde)
  await S.page.goto(pathToFileURL(path.join(dir, 'laerer.html')).href)
  await tryk(S, '#fane-knap-koder'); await S.page.waitForTimeout(200)
  await S.page.locator('#koder-felt').fill(alle25.join('\n')); await S.page.waitForTimeout(400)
  const maal = () => S.page.evaluate(() => {
    const y = (sel) => { const e = document.querySelector(sel); return e ? Math.round(e.getBoundingClientRect().top + scrollY) : null }
    const fold = document.getElementById('koder-faa-boks')
    return {
      status: document.getElementById('koder-status')?.textContent.trim(),
      hoejde: document.documentElement.scrollHeight, skaerm: innerHeight,
      summary: fold?.querySelector('summary')?.textContent.replace(/\s+/g, ' ').trim(), aaben: fold?.open,
      yFold: y('#koder-faa-boks'), ySvagest: y('#koder-svagest'), yFelt: y('#koder-felt'),
      svagest: [...document.querySelectorAll('#koder-svagest > li')].map((l) => l.textContent.replace(/\s+/g, ' ').trim().slice(0, 60)),
      faa: [...document.querySelectorAll('#koder-faa > li')].map((l) => l.textContent.replace(/\s+/g, ' ').trim().slice(0, 60)),
      overskrifter: [...document.querySelectorAll('#fane-koder h2, #fane-koder h3, #koder-resultat h2, #koder-resultat h3, #koder-resultat summary')].map((h) => h.textContent.replace(/\s+/g, ' ').trim().slice(0, 50)),
      vandret: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }
  })
  const lukket = await maal()
  const sum = await S.page.locator('#koder-faa-boks > summary').boundingBox()
  await S.page.locator('#koder-faa-boks > summary').scrollIntoViewIfNeeded()
  if (bredde === 390) await S.page.screenshot({ path: path.join(HERE, 'S-390-laerer-fold-lukket.png') })
  await tryk(S, '#koder-faa-boks > summary'); await S.page.waitForTimeout(300)
  const aaben = await maal()
  // Marc leder efter "Mat i 3" (et tema, 5 af koderne er fra foer det fandtes): hvor staar det?
  const mat3 = KK.KODE_KOMPETENCER.find((x) => x.id === 'mateIn3')?.navn ?? 'Mat i 3'
  L[bredde] = { lukket, aaben, sumH: Math.round(sum?.height ?? 0), mat3, mat3ISvagest: lukket.svagest.some((t) => t.includes(mat3)), mat3IFold: aaben.faa.some((t) => t.includes(mat3)), net: S.net.length, fejl: S.fejl }
  await S.ctx.close()
}
const l390 = L[390]
ok('L1 25 koder laest paa 360, 390 og 1280; "Oevet af under halvdelen" staar lukket med antallet i overskriften; tryk-feltet mindst 44 px', [360, 390, 1280].every((b) => /^25 koder læst/.test(L[b].lukket.status ?? '') && L[b].lukket.aaben === false && /\(\d+ kompetencer?\)/.test(L[b].lukket.summary ?? '') && L[b].sumH >= 44), [360, 390, 1280].map((b) => ({ b, s: L[b].lukket.summary, h: L[b].sumH })))
ok('L2 siden er kortere med folden lukket; hoejden i skaerme', [360, 390, 1280].every((b) => L[b].lukket.hoejde < L[b].aaben.hoejde), [360, 390, 1280].map((b) => `${b}: lukket ${L[b].lukket.hoejde} px (${(L[b].lukket.hoejde / L[b].lukket.skaerm).toFixed(1)} skaerme), aaben ${L[b].aaben.hoejde} px; folden ${L[b].lukket.yFold} px nede (${(L[b].lukket.yFold / L[b].lukket.skaerm).toFixed(1)} skaerme)`))
ok(`L3 Marc leder efter "${l390.mat3}": det staar ikke i "Svagest foerst", men i folden, som skal aabnes (overskriften siger antal, ikke hvilke)`, [360, 390, 1280].every((b) => !L[b].mat3ISvagest && L[b].mat3IFold), { svagest: l390.lukket.svagest, faa: l390.aaben.faa })
ok('L4 laerer.html: 0 netkald, 0 JS-fejl, ingen vandret rulning', [360, 390, 1280].every((b) => !L[b].net && !L[b].fejl.length && L[b].lukket.vandret <= 0 && L[b].aaben.vandret <= 0))

await browser.close()
rmSync(path.join(dir, 'node_modules'))
writeFileSync(path.join(HERE, 'skak-610.json'), JSON.stringify({ skak: SHA, U, L, tjek }, null, 1))
const roede = tjek.filter((t) => !t.ok)
console.log(`\nskak-610: ${tjek.length - roede.length}/${tjek.length} tjek groenne (skak ${SHA})`)
process.exit(roede.length ? 1 : 0)
