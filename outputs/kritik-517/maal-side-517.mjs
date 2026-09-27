// KRITIK 517 blok 1: "Maal dit billede" efter Yantras 510 (B11, B12) med Min krop udfyldt.
//   node outputs/kritik-517/maal-side-517.mjs
// Siden er entropi-loeftmodel-dhruva @ 7f604f7 (510 merget), hentet med git archive til en
// midlertidig mappe; intet trae roeres. Headless Chromium uden net: 360 og 390 px med touch,
// 1280 med mus. Min krop = gennemsnitlige proportioner for 183 cm og 120 kg (462), lagt i
// lageret under Min krops egen noegle, som Yantra goer i 510.
// Billeder:
//   - SYNTETISK: modellens egen stilling med Min krops laengder i alle seks faser, tegnet uden
//     perspektiv. Billede = model, saa HVER raekke faar tegnet for "inden for maalefejlen":
//     det bredeste tilfaelde for B11.
//   - Marcs to billeder fra 462 (dhruva outputs/videomaal, kun laest) med MINE klik fra 494.
//   - Foer/efter: Marcs gulvbillede som foer; efter = tegnet figur af SAMME stilling fotograferet
//     10 grader skraat og 30 cm hoejere (som i 511), og 507's egen syntetiske aendring.
// Skriver outputs/kritik-517/maal-side-517.json og M-*.png.
import path from 'node:path'
import { tmpdir } from 'node:os'
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { chromium } from '../../e2e/harness.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DHRUVA = 'C:/Users/Entropi/Desktop/entropi-loeftmodel-dhruva'
const REF = process.argv[2] || '7f604f7'
const SHA = execSync(`git -C ${DHRUVA} rev-parse --short ${REF}`).toString().trim()
const MODEL = path.join(tmpdir(), `kritik-517-loeftmodel-${SHA}`)
if (!existsSync(path.join(MODEL, 'dist', 'maal-billede', 'index.html'))) {
  rmSync(MODEL, { recursive: true, force: true }); mkdirSync(MODEL, { recursive: true })
  execSync(`git -C ${DHRUVA} archive ${SHA} src dist scripts kroppe outputs/videomaal outputs/507 package.json | tar -x -C "${MODEL.replace(/\\/g, '/')}"`, { shell: 'bash' })
}
const imp = (f) => import(pathToFileURL(`${MODEL}/${f}`).href)
const MB = await imp('src/maalBillede.js')
const MM = await imp('src/maalBilledeModel.js')
const MK = await imp('src/minKrop.js')
const S507 = await imp('scripts/ordre-507-skaermbilleder.mjs')
const SIDE = pathToFileURL(`${MODEL}/dist/maal-billede/index.html`).href
const MARC = (n) => `${MODEL}/outputs/videomaal/marc-doedloeft-270-${n}.png`
const MIN_KROP = MK.gennemsnitsMaal(183, 120)
const IDS = ['stang', 'midtfod', 'ankel', 'knae', 'hofte', 'skulder']
const FASER = MB.FASER.map((f) => f.id)

const tjek = []
const paastaa = (hvad, ok, data) => { tjek.push({ hvad, ok: !!ok, data }); console.log(`${ok ? 'ok ' : 'NEJ'} ${hvad}${data !== undefined ? ' ' + JSON.stringify(data).slice(0, 400) : ''}`) }

// --- Syntetiske billeder: modellens stilling med Min krop, uden perspektiv ------------------------
function billedeAf(P) {
  const pk = {}
  for (const id of IDS) pk[id] = { x: P[id].x, y: -P[id].y }
  const d = { x: P.skulder.x - P.hofte.x, y: P.skulder.y - P.hofte.y }, n = Math.hypot(d.x, d.y)
  pk.hoved = { x: P.skulder.x + d.x / n * 17, y: -(P.skulder.y + d.y / n * 17) }
  pk.skalaA = { x: P.stang.x, y: -(P.stang.y + 22.5) }
  pk.skalaB = { x: P.stang.x, y: -(P.stang.y - 22.5) }
  const ys = Object.values(pk).map((p) => p.y), xs = Object.values(pk).map((p) => p.x)
  const k = 1000 / (Math.max(...ys) - Math.min(...ys) + 60), ox = 540 - k * (Math.max(...xs) + Math.min(...xs)) / 2, oy = 1300 - k * Math.max(...ys)
  const ud = {}
  for (const [id, p] of Object.entries(pk)) ud[id] = { x: ox + k * p.x, y: oy + k * p.y }
  ud.pxPrCm = k
  return ud
}
const SYN = {}
for (const f of FASER) {
  const K = MM.kroppe(MB.fase(f).loeft, MIN_KROP)
  SYN[f] = billedeAf(MM.modelFase(f, K.dig || K.snit).punkter)
}

// Foer/efter som i 511: samme stilling (Marcs klik som figur), andet kamera.
const Kd = MM.kroppe('doedloeft', null, { hoejde: '183', vaegt: '120', stangKg: 270 })
const FIG = MB.maal(S507.MARC_GULV, { fase: 'dl-gulv', cmPrPx: MB.skalaFraKrop(S507.MARC_GULV, MM.modelFase('dl-gulv', Kd.snit).L) }).model
const DYBDE = { stang: -75, midtfod: -12, ankel: -14, knae: -13, hofte: -18, skulder: -20 }
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x })
const norm = (a) => { const n = Math.sqrt(dot(a, a)); return { x: a.x / n, y: a.y / n, z: a.z / n } }
function foto({ afstand = 300, hoejde = 75, skraa = 0 }) {
  const s = (skraa * Math.PI) / 180
  const C = { x: afstand * Math.sin(s), y: hoejde, z: -afstand * Math.cos(s) }
  const fwd = norm(sub({ x: 0, y: hoejde, z: 0 }, C)), right = norm(cross({ x: 0, y: 1, z: 0 }, fwd)), up = cross(fwd, right)
  const P3 = {}
  for (const id of IDS) P3[id] = { x: FIG[id].x, y: FIG[id].y, z: DYBDE[id] }
  P3.skalaA = { x: FIG.stang.x, y: FIG.stang.y + 22.5, z: DYBDE.stang }
  const raa = {}
  for (const [id, p] of Object.entries(P3)) { const d = sub(p, C), zc = dot(d, fwd); raa[id] = { x: 1000 * (dot(d, right) / zc), y: -1000 * (dot(d, up) / zc) } }
  const ud = {}
  for (const [id, p] of Object.entries(raa)) ud[id] = { x: 450 + (p.x - raa.midtfod.x), y: 1080 + (p.y - raa.midtfod.y) }
  return ud
}
// Mine klik fra 494 paa Marcs billeder.
const MINE = {
  start: { stang: { x: 441, y: 828 }, midtfod: { x: 430, y: 948 }, ankel: { x: 400, y: 905 }, knae: { x: 447, y: 668 }, hofte: { x: 343, y: 583 }, skulder: { x: 470, y: 460 } },
  knaehoejde: { stang: { x: 434, y: 768 }, midtfod: { x: 427, y: 942 }, ankel: { x: 398, y: 905 }, knae: { x: 445, y: 640 }, hofte: { x: 340, y: 553 }, skulder: { x: 460, y: 418 } },
}

const browser = await chromium.launch({ headless: true })
async function tegn(b, tekst) {
  const page = await browser.newPage()
  const url = await page.evaluate(([b, tekst]) => {
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1440
    const x = c.getContext('2d')
    x.fillStyle = '#9a968c'; x.fillRect(0, 0, 1080, 1440)
    x.fillStyle = '#6f6a60'; x.fillRect(0, b.midtfod.y, 1080, 1440 - b.midtfod.y)
    const w = b.pxPrCm || 3
    const l = (a, c2, lw, f) => { x.strokeStyle = f; x.lineWidth = lw; x.lineCap = 'round'; x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(c2.x, c2.y); x.stroke() }
    l(b.ankel, b.knae, 11 * w, '#c89b7b'); l(b.knae, b.hofte, 16 * w, '#2e3a4a'); l(b.hofte, b.skulder, 24 * w, '#3a3a3a')
    x.fillStyle = '#c89b7b'; x.beginPath(); x.arc(b.hoved.x, b.hoved.y, 11 * w, 0, 7); x.fill()
    x.fillStyle = 'rgba(150,20,20,0.9)'; x.beginPath(); x.arc(b.stang.x, b.stang.y, 22.5 * w, 0, 7); x.fill()
    l(b.skulder, b.stang, 8 * w, '#c89b7b')
    x.fillStyle = '#fff'; x.font = '600 40px system-ui'; x.fillText('SYNTETISK', 30, 60); x.font = '26px system-ui'; x.fillText(tekst, 30, 100)
    return c.toDataURL('image/png')
  }, [b, tekst])
  await page.close()
  return url
}
async function tegnEfter(klik, tekst) {
  const page = await browser.newPage()
  const url = await page.evaluate(([P, tekst]) => {
    const k = document.createElement('canvas'); k.width = 900; k.height = 1200
    const x = k.getContext('2d')
    x.fillStyle = '#30343a'; x.fillRect(0, 0, 900, 1200); x.fillStyle = '#4a4238'; x.fillRect(0, P.midtfod.y, 900, 1200 - P.midtfod.y)
    x.lineCap = 'round'; x.strokeStyle = '#d8c8b0'; x.lineWidth = 12
    const l = (...ids) => { x.beginPath(); ids.forEach((id, i) => { const p = P[id]; i ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y) }); x.stroke() }
    l('ankel', 'knae', 'hofte', 'skulder'); x.lineWidth = 8; l('skulder', 'stang')
    const r = Math.hypot(P.skalaA.x - P.stang.x, P.skalaA.y - P.stang.y)
    x.strokeStyle = '#8a2a22'; x.lineWidth = 14; x.beginPath(); x.arc(P.stang.x, P.stang.y, r - 8, 0, 7); x.stroke()
    x.fillStyle = '#fff'; x.font = '600 34px system-ui'; x.fillText('SYNTETISK', 24, 52); x.font = '22px system-ui'; x.fillText(tekst, 24, 84)
    return k.toDataURL('image/png')
  }, [klik, tekst])
  await page.close()
  return url
}

async function aabn(bredde) {
  const mobil = bredde < 500
  const ctx = await browser.newContext({ viewport: { width: bredde, height: mobil ? 844 : 900 }, deviceScaleFactor: mobil ? 3 : 1, isMobile: mobil, hasTouch: mobil })
  const page = await ctx.newPage()
  const net = [], fejl = []
  page.on('pageerror', (e) => fejl.push(e.message))
  await page.route('**/*', (r) => { const u = r.request().url(); if (/^(file|data|blob):/.test(u)) return r.continue(); net.push(u); return r.abort() })
  await page.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, v) }, [MM.MIN_KROP_LAGER, JSON.stringify(MIN_KROP)])
  await page.goto(SIDE)
  await page.waitForSelector('[data-klar]')
  return { ctx, page, net, fejl, bredde }
}
const vent = (S) => S.page.evaluate(() => new Promise((ok) => requestAnimationFrame(() => setTimeout(ok, 250))))
async function maalFase(S, billede, navn, fase, klik, kg) {
  await S.page.evaluate(([b, n]) => window.maalBillede.laesBillede(b, n), [billede, navn])
  await S.page.waitForFunction(() => window.maalBillede.tilstand().billede)
  await S.page.click(`[data-fase="${fase}"]`)
  await S.page.evaluate(([p, kg]) => { if (kg) window.maalBillede.saetStangKg(kg); window.maalBillede.saetPunkter(p) }, [klik, kg])
  await vent(S)
}
const LAES = () => {
  const q = (s) => document.querySelector(s)
  const rect = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top + scrollY), bund: Math.round(b.bottom + scrollY), w: Math.round(b.width), h: Math.round(b.height), right: Math.round(b.right) } }
  const t = q('[data-sammenligning]')
  const inden = [...document.querySelectorAll('[data-sammenligning] abbr.mb-inden')]
  const cs = inden[0] ? getComputedStyle(inden[0]) : null
  const m = q('[data-knaefasemaerke]')
  const knaeSpan = q('[data-tallinje] span[data-id="knae"]')
  const linje = q('[data-tallinje]')
  const lh = linje ? parseFloat(getComputedStyle(linje).lineHeight) || 1.4 * parseFloat(getComputedStyle(linje).fontSize) : null
  return {
    side: document.documentElement.scrollWidth, klient: document.documentElement.clientWidth,
    tabel: t ? Math.round(t.getBoundingClientRect().width) : null,
    kolonner: t ? [...t.querySelectorAll('thead th')].map((h) => h.textContent.trim()) : [],
    raekker: t ? Object.fromEntries([...t.querySelectorAll('tbody tr')].map((r) => [r.dataset.id, [...r.querySelectorAll('td.tal')].map((d) => d.textContent.trim())])) : {},
    indenAntal: inden.length, indenRaekker: document.querySelectorAll('[data-sammenligning] tr[data-inden]').length,
    indenStil: cs ? { fontPx: parseFloat(cs.fontSize), farve: cs.color, bredde: Math.round(inden[0].getBoundingClientRect().width * 10) / 10, title: inden[0].getAttribute('title'), aria: inden[0].getAttribute('aria-label') } : null,
    taerskel: q('[data-taerskel]')?.textContent.trim() || null,
    taerskelFontPx: q('[data-taerskel]') ? parseFloat(getComputedStyle(q('[data-taerskel]')).fontSize) : null,
    tabelRect: rect(t), taerskelRect: rect(q('[data-taerskel]')),
    tallinje: linje?.textContent.trim() || null, tallinjeRect: rect(linje), tallinjeLinjer: linje && lh ? Math.round(linje.getBoundingClientRect().height / lh) : null,
    billedeRect: rect(q('canvas[data-billede]')),
    maerke: m ? { tekst: m.textContent, dom: m.dataset.knaefasemaerke, stykker: m.getClientRects().length, farve: getComputedStyle(m).color, knaeStykker: knaeSpan.getClientRects().length, knaeTekst: knaeSpan.textContent } : null,
    knaefase: q('[data-knaefase]')?.textContent.trim() || null, knaefaseRect: rect(q('[data-knaefase]')),
    forBrede: [...document.querySelectorAll('body *')].filter((el) => el.getBoundingClientRect().right > document.documentElement.clientWidth + 0.5 && !el.closest('[hidden]')).slice(0, 5).map((el) => `${el.tagName.toLowerCase()} ${Object.keys(el.dataset).join(',')} ${Math.round(el.getBoundingClientRect().right)}`),
    lager: Object.keys(localStorage), vindueH: innerHeight,
  }
}
const ud = { ref: SHA, minKrop: 'gennemsnitsMaal(183, 120)', faser: {}, marc: {}, foerEfter: {} }

// --- A. B11: alle seks faser med Min krop, hver raekke "inden for" (worst case) -------------------
for (const bredde of [360, 375, 390, 1280]) {
  const S = await aabn(bredde)
  for (const f of FASER) {
    const b = SYN[f]
    const png = await tegn(b, `modellen, dine maal, ${f}`)
    const klik = Object.fromEntries(IDS.map((id) => [id, b[id]]))
    for (const kg of [null, 270]) {
      await maalFase(S, png, `syn-${f}.png`, f, klik, kg)
      const r = await S.page.evaluate(LAES)
      ud.faser[`${bredde}-${f}-${kg ? 'kg' : 'udenKg'}`] = r
      if (bredde === 360 && kg && f === 'squat-bund') {
        await S.page.evaluate(() => { const c = document.querySelector('canvas[data-billede]').getBoundingClientRect(); window.scrollBy(0, c.bottom - innerHeight + 140) })
        await S.page.screenshot({ path: path.join(HERE, 'M-360-squat-tallinje-min-krop.png') })
      }
      if (bredde === 390 && kg && (f === 'dl-gulv' || f === 'baenk-bryst')) {
        await S.page.evaluate(() => document.querySelector('[data-sammentabel]').scrollIntoView())
        await S.page.screenshot({ path: path.join(HERE, `M-390-tabel-${f}.png`) })
      }
    }
  }
  ud.faser[`${bredde}-net`] = S.net; ud.faser[`${bredde}-fejl`] = S.fejl
  await S.ctx.close()
}
const fa = Object.entries(ud.faser).filter(([k]) => !/net|fejl/.test(k))
{
  const mine = fa.filter(([k]) => k.startsWith('390-'))
  paastaa('B11 390 px: alle seks faser, med og uden stangens vaegt, tre talkolonner: siden <= 390 og tabellen <= 390', mine.length === 12 && mine.every(([, r]) => r.side <= 390 && r.tabel <= 390 && r.kolonner.length === 4), Object.fromEntries(mine.map(([k, r]) => [k.slice(4), [r.side, r.tabel]])))
  const m360 = fa.filter(([k]) => k.startsWith('360-')), m375 = fa.filter(([k]) => k.startsWith('375-'))
  paastaa('B11 360/375: tabellen holder sig (328/343 px) i alle seks faser', m360.every(([, r]) => r.tabel <= 328) && m375.every(([, r]) => r.tabel <= 343), [m360[0][1].tabel, m375[0][1].tabel])
  const brede = (m, w) => m.filter(([k, r]) => k.endsWith('-kg') && r.side > w).map(([k, r]) => [k, r.side, r.forBrede.find((x) => x.startsWith('p tallinje'))])
  ud.b13fund = { 360: brede(m360, 360), 375: brede(m375, 375) }
  paastaa('Nyt fund B13: paa 360 og 375 er siden bredere end skaermen i squat (begge) og doedloeft (begge), fordi tallinjen ikke kan bryde; baenk holder', ud.b13fund[360].length === 4 && ud.b13fund[375].length === 4 && ud.b13fund[360].every((x) => x[2]) && m360.filter(([k]) => /baenk/.test(k)).every(([, r]) => r.side <= 360), ud.b13fund)
}
paastaa('B11: tegnet foran tallet i hver raekke inden for maalefejlen, og forklaringen under tabellen', fa.every(([, r]) => r.indenAntal === r.indenRaekker && (r.indenAntal === 0 || /≈ ved billedets tal/.test(r.taerskel))), fa.map(([k, r]) => [k, r.indenAntal]).slice(0, 6))
{ const r = ud.faser['390-dl-gulv-kg']; ud.b13 = Object.fromEntries(fa.filter(([k]) => k.endsWith('-kg')).map(([k, r]) => [k, { side: r.side, tabel: r.tabel, tallinje: r.tallinje, tallinjeBredde: r.tallinjeRect?.w, forBrede: r.forBrede }]))
paastaa('B11 390: tegnet ≈ er guld og samme skrift som tallet (ca. 15 px); ordene ligger i title/aria-label', r.indenStil && r.indenStil.fontPx >= 14 && r.indenStil.title === 'inden for målefejlen', r.indenStil) }
paastaa('1280: uaendret, tabellen fylder bredden og siden er 1280', fa.filter(([k]) => k.startsWith('1280-')).every(([, r]) => r.side === 1280))
paastaa('360/390/1280: intet net og ingen JS-fejl', [360, 390, 1280].every((w) => ud.faser[`${w}-net`].length === 0 && ud.faser[`${w}-fejl`].length === 0))

// --- B. B12 og Marcs klip med Min krop -----------------------------------------------------------
for (const bredde of [360, 390, 1280]) {
  const S = await aabn(bredde)
  for (const n of ['knaehoejde', 'start']) {
    const png = await S.page.evaluate(async (u) => u, pathToFileURL(MARC(n)).href)
    await maalFase(S, png, `marc-${n}.png`, n === 'start' ? 'dl-gulv' : 'dl-knae', MINE[n], 270)
    // Rul som en coach: billedets bund i bunden af skaermen. Er tallinjen (med maerket) paa skaermen?
    await S.page.evaluate(() => { const c = document.querySelector('canvas[data-billede]').getBoundingClientRect(); window.scrollBy(0, c.bottom - innerHeight + 90) })
    const r = await S.page.evaluate(LAES)
    r.synlig = await S.page.evaluate(() => { const l = document.querySelector('[data-tallinje]').getBoundingClientRect(); const c = document.querySelector('canvas[data-billede]').getBoundingClientRect(); return { linjeBund: Math.round(l.bottom), billedeBund: Math.round(c.bottom), vindueH: innerHeight } })
    ud.marc[`${bredde}-${n}`] = r
    // Kun et udsnit af tallinjen og tabellen: Marcs klip har andre mennesker i baggrunden.
    if (n === 'knaehoejde' && bredde < 500) await S.page.locator('[data-tallinje]').screenshot({ path: path.join(HERE, `M-${bredde}-marc-tallinje.png`) })
    if (n === 'knaehoejde' && bredde === 390) await S.page.locator('[data-sammentabel]').screenshot({ path: path.join(HERE, 'M-390-marc-knaehoejde-tabel.png') })
  }
  // Et billede der ER fra knaehoejde (syntetisk, modellens stilling): intet maerke.
  const b = SYN['dl-knae']
  await maalFase(S, await tegn(b, 'knaehoejde'), 'syn-dl-knae.png', 'dl-knae', Object.fromEntries(IDS.map((id) => [id, b[id]])), 270)
  ud.marc[`${bredde}-synKnae`] = await S.page.evaluate(LAES)
  ud.marc[`${bredde}-net`] = S.net; ud.marc[`${bredde}-fejl`] = S.fejl
  await S.ctx.close()
}
const mk = ud.marc
paastaa('B12: Marcs "knaehoejde" (mine klik) faar maerket i tallinjen paa 360, 390 og 1280, med samme cm som beskeden', [360, 390, 1280].every((w) => mk[`${w}-knaehoejde`].maerke?.dom === 'under' && mk[`${w}-knaehoejde`].knaefase?.includes(mk[`${w}-knaehoejde`].maerke.tekst.match(/\d+ cm/)[0])), mk['390-knaehoejde'].maerke)
paastaa('B12: maerket er paa skaermen sammen med billedets bund og tallinjen (390)', mk['390-knaehoejde'].synlig.linjeBund <= mk['390-knaehoejde'].synlig.vindueH, mk['390-knaehoejde'].synlig)
paastaa('B12: intet maerke i gulvbilledet og i et billede der er fra knaehoejde', [360, 390, 1280].every((w) => !mk[`${w}-start`].maerke && !mk[`${w}-synKnae`].maerke))
paastaa('B11 med Marcs knaebillede og Min krop: siden <= bredden paa 360 og 390 (maerket kan bryde)', [360, 390].every((w) => mk[`${w}-knaehoejde`].side <= w), [360, 390].map((w) => [mk[`${w}-knaehoejde`].side, mk[`${w}-knaehoejde`].tabel]))
paastaa('B13 i Marcs gulvbillede: 390 holder, 360 er for bred', mk['390-start'].side <= 390 && mk['360-start'].side > 360, [mk['390-start'].side, mk['360-start'].side, mk['360-start'].tallinje])
ud.maerkeBrud = Object.fromEntries([360, 390, 1280].map((w) => [w, { stykker: mk[`${w}-knaehoejde`].maerke.stykker, knaeStykker: mk[`${w}-knaehoejde`].maerke.knaeStykker, linjer: mk[`${w}-knaehoejde`].tallinjeLinjer, tekst: mk[`${w}-knaehoejde`].tallinje }]))
console.log('maerkets brud', JSON.stringify(ud.maerkeBrud))
paastaa('Marcs klip: intet net og ingen JS-fejl', [360, 390, 1280].every((w) => mk[`${w}-net`].length === 0 && mk[`${w}-fejl`].length === 0))

// --- C. Foer/efter med Min krop (E1, E2, E5, E6 fra 511) ------------------------------------------
const { klik: EK507 } = S507.efterKlik()
const EFTER = [
  { id: 'skraa10', tekst: 'samme stilling, kameraet 10 grader skraat', klik: foto({ skraa: 10 }) },
  { id: 'op30', tekst: 'samme stilling, kameraet 30 cm hoejere', klik: foto({ hoejde: 105 }) },
  { id: 'aendring507', tekst: '507: hoften 5 cm lavere, stangen 2 cm ind', fil: `${MODEL}/outputs/507/syntetisk-efter.png`, klik: EK507 },
]
const LAES_FE = () => {
  const q = (s) => document.querySelector(s)
  const t = q('[data-foerefter-tabel]')
  return {
    side: document.documentElement.scrollWidth, tabel: t ? Math.round(t.getBoundingClientRect().width) : null,
    status: q('[data-foerefterstatus]')?.textContent.trim() || null, saetning: q('[data-saetning]')?.textContent.trim() || null,
    taerskel: q('[data-foereftertaerskel]')?.textContent.trim() || null,
    raekker: t ? Object.fromEntries([...t.querySelectorAll('tr[data-id]')].map((r) => [r.dataset.id, [...r.querySelectorAll('td.tal')].map((d) => d.textContent.trim())])) : {},
    forBrede: [...document.querySelectorAll('body *')].filter((el) => el.getBoundingClientRect().right > document.documentElement.clientWidth + 0.5 && !el.closest('[hidden]')).slice(0, 5).map((el) => `${el.tagName.toLowerCase()} ${Object.keys(el.dataset).join(',')} ${(el.textContent || '').trim().slice(0, 40)} ${Math.round(el.getBoundingClientRect().right)}`),
  }
}
if (!existsSync(`${MODEL}/outputs/507/syntetisk-efter.png`)) {
  mkdirSync(`${MODEL}/outputs/507`, { recursive: true })
  writeFileSync(`${MODEL}/outputs/507/syntetisk-efter.png`, execSync(`git -C ${DHRUVA} show ${SHA}:outputs/507/syntetisk-efter.png`, { maxBuffer: 1 << 26 }))
}
for (const bredde of [360, 390, 1280]) {
  for (const e of EFTER) {
    const S = await aabn(bredde)
    await maalFase(S, pathToFileURL(MARC('start')).href, 'marc-start.png', 'dl-gulv', S507.MARC_GULV, 270)
    await S.page.evaluate(() => window.maalBillede.saetSammen(true))
    const png = e.fil ? pathToFileURL(e.fil).href : await tegnEfter(e.klik, e.tekst)
    await S.page.evaluate(([b]) => window.maalBillede.laesBillede(b, 'efter.png'), [png])
    await S.page.evaluate(([p]) => window.maalBillede.saetPunkter(p), [e.klik])
    await vent(S)
    const r = await S.page.evaluate(LAES_FE)
    ud.foerEfter[`${bredde}-${e.id}`] = { ...r, net: S.net, fejl: S.fejl }
    if (bredde === 390) { await S.page.locator('[data-foerefterstatus]').scrollIntoViewIfNeeded(); await S.page.locator('[data-foerefterstatus]').screenshot({ path: path.join(HERE, `M-390-saetning-${e.id}.png`) }) }
    await S.ctx.close()
  }
}
const fe = ud.foerEfter
for (const e of EFTER) console.log(e.id, '|', fe[`390-${e.id}`].saetning, '| side', [360, 390, 1280].map((w) => fe[`${w}-${e.id}`].side).join('/'))
paastaa('E6 fra 511 stadig aaben (samme aarsag som B13): paa 390 er siden 395 px med skraa10; paa 360 er alle tre for brede', fe['390-skraa10'].side === 395 && fe['390-op30'].side === 390 && EFTER.every((e) => fe[`360-${e.id}`].side > 360), Object.fromEntries(EFTER.map((e) => [e.id, [360, 390].map((w) => fe[`${w}-${e.id}`].side)])))
paastaa('E5: saetningen siger retningen i ord (507-aendringen)', /knæet mere bøjet/.test(fe['390-aendring507'].saetning) && /torsoen mere oprejst/.test(fe['390-aendring507'].saetning), fe['390-aendring507'].saetning)
paastaa('E2 stadig aaben: samme stilling, kameraet 10 grader skraat, giver en "stoerste forskel" i ord', !/Ingen forskel/.test(fe['390-skraa10'].saetning), fe['390-skraa10'].saetning)
paastaa('E2: 30 cm hoejere giver ingen forskel', /Ingen forskel/.test(fe['390-op30'].saetning), fe['390-op30'].saetning)
paastaa('E1 stadig aaben: taersklen er 4 grader / 3 cm pr. raekke (uaendret siden 507)', /4° eller 3 cm/.test(fe['390-op30'].taerskel), fe['390-op30'].taerskel)
paastaa('Foer/efter: intet net og ingen JS-fejl', Object.values(fe).every((r) => r.net.length === 0 && r.fejl.length === 0))

// --- D. B13 uden Min krop: 360 px, samme syntetiske billeder, ingen Min krop ---------------------
{
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  await page.route('**/*', (r) => (/^(file|data|blob):/.test(r.request().url()) ? r.continue() : r.abort()))
  await page.goto(SIDE); await page.waitForSelector('[data-klar]')
  const S = { page }
  ud.udenMinKrop360 = {}
  for (const f of ['squat-bund', 'dl-gulv', 'dl-knae']) {
    const b = SYN[f]
    await maalFase(S, await tegn(b, f), `syn-${f}.png`, f, Object.fromEntries(IDS.map((id) => [id, b[id]])), 270)
    const r = await page.evaluate(LAES)
    ud.udenMinKrop360[f] = { side: r.side, kolonner: r.kolonner.length, tallinje: r.tallinje }
  }
  await ctx.close()
}
paastaa('B13 kraever en kendt skala: uden Min krop og uden hoejde staar stangen som "—", og 360 holder', Object.values(ud.udenMinKrop360).every((r) => r.side <= 360 && /Stang —/.test(r.tallinje)), ud.udenMinKrop360)

ud.tjek = tjek
writeFileSync(path.join(HERE, 'maal-side-517.json'), JSON.stringify(ud, null, 1))
await browser.close()
const nej = tjek.filter((x) => !x.ok).length
console.log(`${tjek.length - nej}/${tjek.length} tjek groenne (dhruva ${SHA})`)
