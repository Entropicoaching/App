// Kritik 590, blok 1: matematikken efter Ganitas 578 og 583 (main, hentet med git archive;
// matematik-traeet roeres ikke). Kun syntetiske elever ("Tulle", "Model", "Pip").
//   node outputs/kritik-590/matematik-590.mjs
// Del A (node): kan eleven farme point? Reglerne i src/faerdigheder.js koert paa alle forloeb.
// Del B (browser, 390 touch og 1280 mus, uden net): "Vis min kode" i spil.html, laerer.html med
// 25 syntetiske koder, en kode alene, et forsoeg paa HTML i feltet, fluebenet og elevens gemte spil
// paa samme computer. Skriver matematik-590.json og M-*.png her.
import { execSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('C:/Users/Entropi/Desktop/matematik/node_modules/playwright')
const HER = path.dirname(fileURLToPath(import.meta.url))
const MAT = 'C:/Users/Entropi/Desktop/matematik'
const REF = process.env.MAT_REF || 'main'
const SPIL = mkdtempSync(path.join(tmpdir(), 'kritik-590-mat-'))
execSync(`git -C "${MAT}" archive ${REF} | tar -x -C "${SPIL.replace(/\\/g, '/')}"`, { shell: 'bash' })
const hash = execSync(`git -C "${MAT}" rev-parse --short ${REF}`).toString().trim()
const imp = (f) => import(pathToFileURL(path.join(SPIL, f)).href)
const F = await imp('src/faerdigheder.js')
const K = await imp('src/kompetence-kode.js')
const KK = await imp('src/klassens-koder.js')

const tjek = []
const ok = (navn, b, data = null) => { tjek.push({ navn, ok: !!b, data }); console.log(b ? 'OK  ' : 'ROED', navn, data ? JSON.stringify(data).slice(0, 200) : '') }

// ---------------------------------------------------------------- Del A: farme
const A = {}
{
  // 1. Et forloeb, der ikke er klaret: 1.000 rigtige svar giver hoejst loftet (vaerdien minus 10).
  const tom = { questFremdrift: {}, questbog: { klaret: [] } }
  let alleUnder = true
  let alleBonus = true
  const eksempler = []
  for (const q of Object.keys(F.OPGAVER_I_QUEST)) for (const f of F.FAERDIGHEDER) {
    const b = F.bidrag(q, f.id)
    if (!b) continue
    let u = {}
    for (let i = 0; i < 1000; i++) u = F.laegUndervejs(u, q, f.id, 10)
    const p = F.faerdighedsPoint(tom, f.id, u)
    if (p > b - 10) alleUnder = false
    if (p >= b) alleBonus = false
    if (q === 'moellen-1' || q === 'bog:mel-til-bageren') eksempler.push({ q, f: f.id, efter1000: p, klaret: b })
  }
  ok('A1 1.000 rigtige i et forloeb, der ikke klares, giver hoejst vaerdien minus 10 (alle forloeb og quests)', alleUnder && alleBonus, eksempler)
  A.eksempler = eksempler

  // 2. Et klaret forloeb taget om: tallet vokser ikke (undervejs taeller ikke for klarede).
  const klaret = { questFremdrift: { moellen: [true, false, false, false, false, false, false, false] }, questbog: { klaret: [] } }
  const foer = F.faerdighedsPoint(klaret, 'broeker', {})
  let u = {}
  for (let i = 0; i < 1000; i++) u = F.laegUndervejs(u, 'moellen-1', 'broeker', 10)
  const efter = F.faerdighedsPoint(klaret, 'broeker', u)
  ok('A2 Moellens forloeb 1 klaret og taget om 1.000 gange: Broeker staar stille', foer === efter, { foer, efter })

  // 3. Hvor langt kan en elev naa uden at klare noget? Alle forloeb/quests til loftet paa een gang
  //    (et oevre skoen: i spillet er kun de foerste aabne, foer noget er klaret).
  const alt = {}
  for (const f of F.FAERDIGHEDER) {
    let uu = {}
    for (const q of Object.keys(F.OPGAVER_I_QUEST)) uu = F.laegUndervejs(uu, q, f.id, 99999)
    const p = F.faerdighedsPoint(tom, f.id, uu)
    alt[f.id] = { uden: p, niveauUden: F.niveauFor(f.id, p).niveauNavn, maks: F.MAKS_POINT[f.id] }
  }
  // Kun Moellens forloeb 1 (det eneste aabne i starten) til loftet:
  let u1 = F.laegUndervejs({}, 'moellen-1', 'broeker', 99999)
  const kunM1 = F.faerdighedsPoint(tom, 'broeker', u1)
  ok('A3 Kun Moellens forloeb 1 om og om igen: Broeker 50, stadig Begynder (Oevet kraever 200)', kunM1 === 50 && F.niveauFor('broeker', kunM1).niveauNavn === 'Begynder', { kunM1, graenser: F.niveauGraenser('broeker') })
  A.skoen = alt

  // 4. Et snydt gemt spil (oevePoint 99999) renses til loftet.
  const r = F.rensUndervejs(tom, { 'moellen-1|broeker': 99999, 'findes-ikke|broeker': 50, 'moellen-1|broeker|x': 5 })
  ok('A4 oevePoint 99999 i det gemte spil renses til loftet (50), ukendte noegler smides', JSON.stringify(r) === '{"moellen-1|broeker":50}', r)

  // 5. Farme mod at klare: point pr. rigtigt svar i foerste forsoeg.
  //    Den, der klarer Moellen 1 i foerste hug: 3 svar -> 60 (20 pr. svar).
  //    Den, der tager det om: loftet 50 efter 5 rigtige (+5 i andet forsoeg), og saa +10 bonus ved klaret.
  A.prSvar = { klaretFoersteHug: 60 / 3, omTagTilLoft: 50 / 5 }
  ok('A5 At klare giver flere point pr. rigtigt svar (20) end at tage om (10); om-tag kan ikke betale sig', A.prSvar.klaretFoersteHug > A.prSvar.omTagTilLoft, A.prSvar)
}

// ---------------------------------------------------------------- Del B: koden og laerer.html
const N = { moellen: 8, stenbrud: 6, marked: 6, landsby: 6, havn: 5 }
function gemt({ forloeb, klaret = [], navn = 'Tulle', niveau = 7, oevePoint = {} }) {
  const questFremdrift = Object.fromEntries(Object.entries(N).map(([id, k]) => [id, Array.from({ length: k }, (_, i) => i < (forloeb[id] ?? 0))]))
  return { figur: { navn, udseendeId: 'terra', niveau, niveauPoint: 1, erfaring: 900, hoved: 4, haand: 2, hjerte: 3 }, sted: 'moellen', questFremdrift, questbog: { klaret, hoved: null, hviler: {} }, oevePoint }
}
const ELEV = gemt({ forloeb: { moellen: 6, stenbrud: 2 }, klaret: ['mel-til-bageren', 'broed-til-alle', 'aenderne', 'melposerne', 'dragen', 'aebleskiver'], oevePoint: { 'stenbrud-3|enheder': 30 } })
const forventet = F.FAERDIGHEDER.map((f) => F.niveauFor(f.id, F.faerdighedsPoint(ELEV, f.id, ELEV.oevePoint)).niveau)

const FARLIG = /\b(fetch|XMLHttpRequest|sendBeacon|WebSocket|EventSource|RTCPeerConnection|geolocation|userAgent|navigator\.platform|deviceMemory|hardwareConcurrency|getBattery|mediaDevices|indexedDB|document\.cookie)\b/g
const B = { forventet }
for (const fil of ['spil.html', 'laerer.html']) {
  const t = readFileSync(path.join(SPIL, fil), 'utf8')
  B[fil] = { kb: Math.round(t.length / 1024), farlige: [...new Set(t.match(FARLIG) ?? [])], http: [...new Set(t.match(/https?:\/\/[^\s"'`)<]+/g) ?? [])].slice(0, 20) }
}
ok('B1 spil.html og laerer.html: ingen fetch, XHR, beacon, websocket, cookie, userAgent eller geolocation', !B['spil.html'].farlige.length && !B['laerer.html'].farlige.length, { spil: B['spil.html'].farlige, laerer: B['laerer.html'].farlige })

const browser = await chromium.launch()
const net = { n: 0, urls: [] }
async function side(bredde, { tid = Date.UTC(2026, 8, 28, 8), fil = 'spil.html', lager = null } = {}) {
  const mobil = bredde < 500
  const ctx = await browser.newContext({ viewport: { width: bredde, height: mobil ? 844 : 900 }, deviceScaleFactor: mobil ? 2 : 1, isMobile: mobil, hasTouch: mobil })
  await ctx.addInitScript((t) => { Date.now = () => t }, tid)
  await ctx.route(/^(https?|wss?):/, (r) => { net.n++; net.urls.push(r.request().url()); return r.abort() })
  const page = await ctx.newPage()
  page.fejl = []
  page.on('pageerror', (e) => page.fejl.push(e.message))
  page.on('dialog', (d) => { page.fejl.push('dialog: ' + d.message()); d.dismiss() })
  const url = pathToFileURL(path.join(SPIL, fil)).href
  await page.goto(url)
  if (lager) { await page.evaluate((l) => { for (const [k, v] of Object.entries(l)) localStorage.setItem(k, v) }, lager); await page.goto(url) }
  await page.waitForTimeout(400)
  return page
}
const lagerAf = (page) => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)])))

async function visKode(bredde, elev, tid) {
  const page = await side(bredde, { tid, lager: { 'ganita:spil': JSON.stringify(elev) } })
  await page.locator('#min-helt-knap').click()
  await page.waitForTimeout(300)
  const foer = await lagerAf(page)
  await page.locator('#min-kode-knap').scrollIntoViewIfNeeded()
  await page.locator('#min-kode-knap').click()
  await page.waitForTimeout(200)
  const kode = (await page.locator('#min-kode-tekst').innerText()).trim()
  const efter = await lagerAf(page)
  const felt = await page.evaluate(() => document.querySelector('#min-kode-felt').innerText.replace(/\s+/g, ' ').trim())
  return { page, kode, lagerUaendret: JSON.stringify(foer) === JSON.stringify(efter), felt }
}

const R = { kode: {}, laerer: {} }
for (const bredde of [390, 1280]) {
  const a = await visKode(bredde, ELEV, Date.UTC(2026, 8, 28, 8))
  await a.page.locator('#min-kode-felt').screenshot({ path: path.join(HER, `M-${bredde}-min-kode.png`) })
  const l = K.laesKode(a.kode)
  ok(`B2 ${bredde}: koden i rygsaekken laeses til rygsaekkens 7 niveauer`, l.ok && JSON.stringify(l.niveauer) === JSON.stringify(forventet), { kode: a.kode, niveauer: l.niveauer, forventet })
  ok(`B3 ${bredde}: at vise koden aendrer intet i lageret, og feltet naevner intet navn`, a.lagerUaendret && !/Tulle/.test(a.felt), { felt: a.felt.slice(0, 160) })
  // Samme fremskridt, andet navn, andet ur (en maaned senere, om aftenen): samme kode.
  const b = await visKode(bredde, { ...ELEV, figur: { ...ELEV.figur, navn: 'Pip', udseendeId: 'skov' } }, Date.UTC(2026, 9, 29, 19, 13))
  ok(`B4 ${bredde}: andet navn, anden figur og andet ur giver samme kode`, a.kode === b.kode, { a: a.kode, b: b.kode })
  R.kode[bredde] = { kode: a.kode, felt: a.felt, jsFejl: [...a.page.fejl, ...b.page.fejl] }
  await a.page.context().close(); await b.page.context().close()
}

// Unikhed: hvor mange koder er entydige i en taenkt klasse (frø 574 som Ganitas, og 590)?
for (const froe of [574, 590]) {
  const koder = KK.syntetiskeKoder(25, froe)
  const taelle = new Map()
  for (const k of koder) taelle.set(k, (taelle.get(k) ?? 0) + 1)
  R[`unik${froe}`] = { entydige: koder.filter((k) => taelle.get(k) === 1).length, forskellige: taelle.size }
}

const koder = KK.syntetiskeKoder(25, 590)
for (const bredde of [390, 1280]) {
  // Laereren paa sin egen computer, hvor en elev ogsaa har spillet (samme browser): hvad viser siden?
  const page = await side(bredde, { fil: 'laerer.html', lager: { 'ganita:spil': JSON.stringify(ELEV) } })
  const body0 = await page.evaluate(() => document.body.innerText)
  const tast = koder.map((k, i) => (i % 3 === 0 ? k.toLowerCase() : i % 3 === 1 ? k.replace('-', ' ') : k.replace(/0/g, 'O'))).join('\n')
  await page.locator('#klasse-koder').fill(tast)
  await page.waitForTimeout(250)
  const res = await page.evaluate(() => ({ status: document.querySelector('#klasse-status').innerText, resultat: document.querySelector('#klasse-resultat').innerText, raekker: document.querySelectorAll('#klasse-resultat .klasse-raekke').length, forslag: document.querySelector('#klasse-forslag')?.innerText.replace(/\s+/g, ' ').trim() }))
  const lagerUdenFlueben = await page.evaluate(() => localStorage.getItem('ganita:laerer-klassekoder'))
  const kodeIResultat = koder.filter((k) => res.resultat.includes(k) || res.resultat.includes(k.replace('-', '')))
  ok(`B5 ${bredde}: 25 syntetiske koder (smaa bogstaver, mellemrum, O for 0): "25 koder laest.", 7 raekker, ingen enkelt kode i resultatet, intet gemt uden flueben`, /^25 koder læst\./.test(res.status) && res.raekker === 7 && !kodeIResultat.length && lagerUdenFlueben === null, { status: res.status, forslag: res.forslag, kodeIResultat })
  await page.locator('#klasse').screenshot({ path: path.join(HER, `M-${bredde}-laerer-25.png`) })
  // Flueben: gemt; taget af: slettet.
  await page.locator('#klasse-husk').check(); await page.waitForTimeout(100)
  const gemtMed = await page.evaluate(() => localStorage.getItem('ganita:laerer-klassekoder'))
  await page.locator('#klasse-husk').uncheck(); await page.waitForTimeout(100)
  const efterAf = await page.evaluate(() => localStorage.getItem('ganita:laerer-klassekoder'))
  ok(`B6 ${bredde}: med flueben gemt i denne browser, taget af: slettet`, gemtMed === tast && efterAf === null)
  // HTML i feltet: vises som tekst, koeres ikke.
  await page.locator('#klasse-koder').fill(`${koder[0]}\n<img src=x onerror="window.__xss=1">\n<b>fed</b>`)
  await page.waitForTimeout(300)
  const xss = await page.evaluate(() => ({ xss: window.__xss ?? null, img: document.querySelectorAll('#klasse-status img, #klasse-resultat img').length, b: document.querySelectorAll('#klasse-status b').length, status: document.querySelector('#klasse-status').innerText }))
  ok(`B7 ${bredde}: HTML i feltet vises som tekst og koeres ikke`, xss.xss === null && xss.img === 0 && xss.b === 0, xss)
  // En kode alene: siden viser den ene elevs niveauer ("1 elev").
  await page.locator('#klasse-koder').fill(koder[3])
  await page.waitForTimeout(250)
  const en = await page.evaluate(() => ({ status: document.querySelector('#klasse-status').innerText, overskrift: document.querySelector('.klasse-overskrift')?.innerText, tal: [...document.querySelectorAll('.klasse-raekke__tal')].map((e) => e.innerText.replace(/\s+/g, ' ').trim()).slice(0, 7) }))
  ok(`B8 ${bredde}: een kode alene viser den ene elevs niveau i alle 7 (siden har ingen mindste klasse)`, /1 elev/.test(en.overskrift ?? ''), en)
  R.laerer[bredde] = { status: res.status, forslag: res.forslag, en, elevDataFoer: /Tulle/.test(body0), questbogViser: /Klaret|Kan startes nu/.test(body0), xss }
  ok(`B9 ${bredde}: elevens gemte spil paa samme computer: figurens navn staar ikke paa laerer.html`, !/Tulle/.test(body0))
  ok(`B10 ${bredde}: ingen vandret rulning, 0 JS-fejl, 0 dialoger`, (await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)) && page.fejl.length === 0, page.fejl)
  await page.context().close()
}
ok('B11 0 netkald i alle koersler', net.n === 0, net.urls.slice(0, 5))
await browser.close()

const ud = { spil: hash, ref: REF, A, B, R, net: net.n, tjek, groen: tjek.filter((t) => t.ok).length, ialt: tjek.length }
writeFileSync(path.join(HER, 'matematik-590.json'), JSON.stringify(ud, null, 1) + '\n')
console.log(`${ud.groen}/${ud.ialt} groenne`)
