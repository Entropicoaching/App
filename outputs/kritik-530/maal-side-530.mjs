// KRITIK 530 blok 1: "Maal dit billede" og foer/efter efter Yantras 522 (B13, E7, E8, E3-rest)
// med Min krop udfyldt, paa 360, 375 og 390 px med touch (og 1280 med mus som kontrol).
//   node outputs/kritik-530/maal-side-530.mjs
// Siden er entropi-loeftmodel-dhruva main @ c9950e0 (522 merget), hentet med git archive til en
// midlertidig mappe; intet trae roeres. Headless Chromium uden net.
// Min krop = gennemsnitlige proportioner for 183 cm og 120 kg (462) under Min krops egen noegle,
// som i 517: det tilfaelde, der gav B13.
// Billeder:
//   - SYNTETISK: modellens egen stilling med Min krops laengder i alle seks faser (som 517), og
//     doedloeft ved gulvet med stangen flyttet 10,7 cm (det lange minus-tal).
//   - Marcs to billeder fra 462 med mine klik fra 494 (B12's maerke).
//   - Foer/efter: Marcs gulvbillede som foer; efter = samme stilling 10 grader skraat (517's
//     "Stang -8,5 cm"), og 514's tegnede efter-billede med Marcs SKOENNEDE fjerne nav (E7, E8).
//   - E3-rest: modellens squat i sticking point (178 cm, uden Min krop) i mine fire
//     pinhole-kamerapladser fra 521, tegnet, uden og med det fjerne nav.
// Skriver outputs/kritik-530/maal-side-530.json og M-*.png.
import path from 'node:path'
import { tmpdir } from 'node:os'
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { chromium } from '../../e2e/harness.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DHRUVA = 'C:/Users/Entropi/Desktop/entropi-loeftmodel-dhruva'
const REF = process.argv[2] || 'c9950e0'
const SHA = execSync(`git -C ${DHRUVA} rev-parse --short ${REF}`).toString().trim()
const MODEL = path.join(tmpdir(), `kritik-530-loeftmodel-${SHA}`)
if (!existsSync(path.join(MODEL, 'dist', 'maal-billede', 'index.html'))) {
  rmSync(MODEL, { recursive: true, force: true }); mkdirSync(MODEL, { recursive: true })
  execSync(`git -C ${DHRUVA} archive ${SHA} src dist scripts kroppe test outputs/videomaal outputs/507 outputs/514 package.json | tar -x -C "${MODEL.replace(/\\/g, '/')}"`, { shell: 'bash' })
}
const imp = (f) => import(pathToFileURL(`${MODEL}/${f}`).href)
const MB = await imp('src/maalBillede.js')
const MM = await imp('src/maalBilledeModel.js')
const MK = await imp('src/minKrop.js')
const S507 = await imp('scripts/ordre-507-skaermbilleder.mjs')
const S514 = await imp('scripts/ordre-514-skaermbilleder.mjs')
const SIDE = pathToFileURL(`${MODEL}/dist/maal-billede/index.html`).href
const MARC = (n) => `${MODEL}/outputs/videomaal/marc-doedloeft-270-${n}.png`
const MIN_KROP = MK.gennemsnitsMaal(183, 120)
const IDS = ['stang', 'midtfod', 'ankel', 'knae', 'hofte', 'skulder']
const FASER = MB.FASER.map((f) => f.id)
const MOBIL = [360, 375, 390]

const tjek = []
const paastaa = (hvad, ok, data) => { tjek.push({ hvad, ok: !!ok, data }); console.log(`${ok ? 'ok ' : 'NEJ'} ${hvad}${data !== undefined ? ' ' + JSON.stringify(data).slice(0, 400) : ''}`) }

// --- Syntetiske billeder: modellens stilling med Min krop, uden perspektiv (som 517) --------------
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
// Det lange minus-tal: doedloeft ved gulvet med stangen flyttet +10,7 og -13,7 cm (grundstillingen staar +3,0 cm, saa minus giver "Stang -10,7 cm").
const flyt = (b, cm) => { const dx = cm * b.pxPrCm; return { ...b, stang: { x: b.stang.x + dx, y: b.stang.y }, skalaA: { x: b.skalaA.x + dx, y: b.skalaA.y }, skalaB: { x: b.skalaB.x + dx, y: b.skalaB.y } } }
const LANG = { plus: flyt(SYN['dl-gulv'], 10.7), minus: flyt(SYN['dl-gulv'], -13.7) }

// --- Pinhole (som 511/521) -------------------------------------------------------------------------
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x })
const norm = (a) => { const n = Math.sqrt(dot(a, a)); return { x: a.x / n, y: a.y / n, z: a.z / n } }
function kamera({ afstand = 300, hoejde = 75, skraa = 0, sigte = 'vandret', maal: mp = { x: 0, y: 75, z: 0 } }) {
  const s = (skraa * Math.PI) / 180
  const C = { x: afstand * Math.sin(s), y: hoejde, z: -afstand * Math.cos(s) }
  const T = sigte === 'vandret' ? { x: 0, y: hoejde, z: 0 } : mp
  const fwd = norm(sub(T, C)), right = norm(cross({ x: 0, y: 1, z: 0 }, fwd)), up = cross(fwd, right)
  return (P) => { const d = sub(P, C); const zc = dot(d, fwd); return { x: 1000 * (dot(d, right) / zc), y: -1000 * (dot(d, up) / zc) } }
}
// Foer/efter som 517: Marcs klik som figur, fotograferet 10 grader skraat.
const Kd = MM.kroppe('doedloeft', null, { hoejde: '183', vaegt: '120', stangKg: 270 })
const FIG = MB.maal(S507.MARC_GULV, { fase: 'dl-gulv', cmPrPx: MB.skalaFraKrop(S507.MARC_GULV, MM.modelFase('dl-gulv', Kd.snit).L) }).model
const DYBDE_DL = { stang: -75, midtfod: -12, ankel: -14, knae: -13, hofte: -18, skulder: -20 }
function fotoDl({ afstand = 300, hoejde = 75, skraa = 0 }) {
  const k = kamera({ afstand, hoejde, skraa })
  const P3 = {}
  for (const id of IDS) P3[id] = { x: FIG[id].x, y: FIG[id].y, z: DYBDE_DL[id] }
  P3.skalaA = { x: FIG.stang.x, y: FIG.stang.y + 22.5, z: DYBDE_DL.stang }
  const raa = Object.fromEntries(Object.entries(P3).map(([id, p]) => [id, k(p)]))
  return Object.fromEntries(Object.entries(raa).map(([id, p]) => [id, { x: 450 + (p.x - raa.midtfod.x), y: 1080 + (p.y - raa.midtfod.y) }]))
}
// E3-rest: modellens squat i sticking point (178 cm), mine fire kamerapladser fra 521.
const KS = MM.kroppe('squat', null, { hoejde: '178', stangKg: 140 })
const mfS = MM.modelFase('squat-midt', KS.snit)
const DYBDE_SQ = { stang: -70, midtfod: -15, ankel: -16, knae: -18, hofte: -18, skulder: -20 }
const KAM_SQ = [
  { id: 'ref', k: { afstand: 300, hoejde: 80 } },
  { id: 'op30vip', k: { afstand: 300, hoejde: 110, sigte: 'maal', maal: { x: mfS.punkter.hofte.x, y: mfS.punkter.hofte.y, z: 0 } } },
  { id: 'lav60', k: { afstand: 300, hoejde: 60 } },
  { id: 'skraa10', k: { afstand: 300, hoejde: 80, skraa: 10 } },
]
function fotoSq(c) {
  const k = kamera(c.k), F = mfS.punkter
  const P3 = {}
  for (const id of IDS) P3[id] = { x: F[id].x, y: F[id].y, z: DYBDE_SQ[id] }
  P3.stangFjern = { x: F.stang.x, y: F.stang.y, z: -DYBDE_SQ.stang }
  P3.skalaA = { x: F.stang.x, y: F.stang.y + 22.5, z: DYBDE_SQ.stang }
  const raa = Object.fromEntries(Object.entries(P3).map(([id, p]) => [id, k(p)]))
  return Object.fromEntries(Object.entries(raa).map(([id, p]) => [id, { x: 600 + (p.x - raa.midtfod.x), y: 1250 + (p.y - raa.midtfod.y) }]))
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
async function tegnFigur(klik, tekst, { w = 900, h = 1200 } = {}) {
  const page = await browser.newPage()
  const url = await page.evaluate(([P, tekst, w, h]) => {
    const k = document.createElement('canvas'); k.width = w; k.height = h
    const x = k.getContext('2d')
    x.fillStyle = '#30343a'; x.fillRect(0, 0, w, h); x.fillStyle = '#4a4238'; x.fillRect(0, P.midtfod.y, w, h - P.midtfod.y)
    x.lineCap = 'round'; x.strokeStyle = '#d8c8b0'; x.lineWidth = 12
    const l = (...ids) => { x.beginPath(); ids.forEach((id, i) => { const p = P[id]; i ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y) }); x.stroke() }
    l('ankel', 'knae', 'hofte', 'skulder'); x.lineWidth = 8; l('skulder', 'stang')
    const r = Math.hypot(P.skalaA.x - P.stang.x, P.skalaA.y - P.stang.y)
    for (const id of ['stangFjern', 'stang']) { if (!P[id]) continue; x.strokeStyle = id === 'stang' ? '#8a2a22' : '#5c1f1a'; x.lineWidth = 14; x.beginPath(); x.arc(P[id].x, P[id].y, r - 8, 0, 7); x.stroke() }
    x.fillStyle = '#fff'; x.font = '600 34px system-ui'; x.fillText('SYNTETISK', 24, 52); x.font = '22px system-ui'; x.fillText(tekst, 24, 84)
    return k.toDataURL('image/png')
  }, [klik, tekst, w, h])
  await page.close()
  return url
}

async function aabn(bredde, { minKrop = true } = {}) {
  const mobil = bredde < 500
  const ctx = await browser.newContext({ viewport: { width: bredde, height: mobil ? 844 : 900 }, deviceScaleFactor: mobil ? 3 : 1, isMobile: mobil, hasTouch: mobil })
  const page = await ctx.newPage()
  const net = [], fejl = []
  page.on('pageerror', (e) => fejl.push(e.message))
  await page.route('**/*', (r) => { const u = r.request().url(); if (/^(file|data|blob):/.test(u)) return r.continue(); net.push(u); return r.abort() })
  if (minKrop) await page.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, v) }, [MM.MIN_KROP_LAGER, JSON.stringify(MIN_KROP)])
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
  const linje = q('[data-tallinje]')
  const spans = linje ? [...linje.querySelectorAll(':scope > span')].map((x) => x.getBoundingClientRect()) : []
  const m = q('[data-knaefasemaerke]')
  return {
    side: document.documentElement.scrollWidth, klient: document.documentElement.clientWidth,
    tabel: q('[data-sammenligning]') ? Math.round(q('[data-sammenligning]').getBoundingClientRect().width) : null,
    tallinje: linje?.textContent || null,
    tallinjeHoejre: spans.length ? Math.round(Math.max(...spans.map((x) => x.right))) : null,
    tallinjeLinjer: new Set(spans.map((x) => Math.round(x.top))).size,
    tallinjeBredde: linje ? Math.round(linje.getBoundingClientRect().width) : null,
    maerke: m ? { tekst: m.textContent, dom: m.dataset.knaefasemaerke } : null,
    knaefase: q('[data-knaefase]')?.textContent.trim() || null,
    forBrede: [...document.querySelectorAll('body *')].filter((el) => el.getBoundingClientRect().right > document.documentElement.clientWidth + 0.5 && !el.closest('[hidden]')).slice(0, 5).map((el) => `${el.tagName.toLowerCase()} ${Object.keys(el.dataset).join(',')} ${Math.round(el.getBoundingClientRect().right)}`),
  }
}
// Mellemrum mellem tallene: intet grad-/cm-/tankestregstegn direkte foer et stort bogstav.
const udenMellemrum = (t) => /[°m—][A-ZÆØÅ]/.test(t || '')
const ud = { ref: SHA, minKrop: 'gennemsnitsMaal(183, 120)', faser: {}, lang: {}, marc: {}, foerEfter: {}, e7: {}, e3: {} }

// --- A. B13: alle seks faser med Min krop og stangens vaegt, og det lange minus-tal --------------
for (const bredde of [...MOBIL, 1280]) {
  const S = await aabn(bredde)
  for (const f of FASER) {
    const b = SYN[f]
    const png = await tegn(b, `modellen, dine maal, ${f}`)
    await maalFase(S, png, `syn-${f}.png`, f, Object.fromEntries(IDS.map((id) => [id, b[id]])), 270)
    ud.faser[`${bredde}-${f}`] = await S.page.evaluate(LAES)
    if (bredde === 360 && f === 'squat-bund') {
      await S.page.evaluate(() => { const c = document.querySelector('canvas[data-billede]').getBoundingClientRect(); window.scrollBy(0, c.bottom - innerHeight + 140) })
      await S.page.screenshot({ path: path.join(HERE, 'M-360-squat-tallinje-min-krop.png') })
    }
  }
  for (const [n, b] of Object.entries(LANG)) {
    await maalFase(S, await tegn(b, `stangen 10,7 cm ${n}`), `syn-lang-${n}.png`, 'dl-gulv', Object.fromEntries(IDS.map((id) => [id, b[id]])), 270)
    ud.lang[`${bredde}-${n}`] = await S.page.evaluate(LAES)
    if (bredde === 360 && /−1\d,\d cm/.test(ud.lang[`${bredde}-${n}`].tallinje)) await S.page.locator('[data-tallinje]').screenshot({ path: path.join(HERE, 'M-360-tallinje-lang.png') })
  }
  ud.faser[`${bredde}-net`] = S.net; ud.faser[`${bredde}-fejl`] = S.fejl
  await S.ctx.close()
}
const fa = Object.entries(ud.faser).filter(([k]) => !/net|fejl/.test(k))
for (const w of MOBIL) {
  const mine = fa.filter(([k]) => k.startsWith(`${w}-`))
  paastaa(`B13 ${w} px med Min krop og stangens vaegt: siden <= ${w} og tallinjens hoejre kant <= ${w} i alle seks faser`, mine.length === 6 && mine.every(([, r]) => r.side <= w && r.tallinjeHoejre <= w), Object.fromEntries(mine.map(([k, r]) => [k.slice(4), [r.side, r.tallinjeHoejre, r.tallinjeLinjer]])))
}
paastaa('B13: mellemrum mellem tallinjens tal i alle faser og bredder', fa.every(([, r]) => r.tallinje && !udenMellemrum(r.tallinje)), fa.map(([, r]) => r.tallinje).slice(0, 2))
{
  const L = Object.entries(ud.lang)
  const minus = L.filter(([, r]) => /Stang −1\d,\d cm/.test(r.tallinje))
  paastaa('B13 med det lange minus-tal ("Stang -10,x cm"): siden <= bredden paa 360, 375 og 390', minus.length >= 3 && L.every(([k, r]) => r.side <= +k.split('-')[0] && r.tallinjeHoejre <= +k.split('-')[0]), Object.fromEntries(L.map(([k, r]) => [k, [r.side, r.tallinjeHoejre, r.tallinje]])))
}
paastaa('1280: siden er 1280 i alle faser', fa.filter(([k]) => k.startsWith('1280-')).every(([, r]) => r.side === 1280))
paastaa('A: intet net og ingen JS-fejl', [...MOBIL, 1280].every((w) => ud.faser[`${w}-net`].length === 0 && ud.faser[`${w}-fejl`].length === 0))

// --- B. B12 holder: Marcs knaehoejde-billede med Min krop ----------------------------------------
for (const bredde of [360, 390]) {
  const S = await aabn(bredde)
  for (const n of ['knaehoejde', 'start']) {
    const png = pathToFileURL(MARC(n)).href
    await maalFase(S, png, `marc-${n}.png`, n === 'start' ? 'dl-gulv' : 'dl-knae', MINE[n], 270)
    ud.marc[`${bredde}-${n}`] = await S.page.evaluate(LAES)
    // Kun et udsnit af tallinjen: Marcs klip har andre mennesker i baggrunden.
    if (n === 'knaehoejde') await S.page.locator('[data-tallinje]').screenshot({ path: path.join(HERE, `M-${bredde}-marc-tallinje.png`) })
  }
  ud.marc[`${bredde}-fejl`] = S.fejl; ud.marc[`${bredde}-net`] = S.net
  await S.ctx.close()
}
paastaa('B12 holder efter B13: maerket i tallinjen paa Marcs knaehoejde-billede, samme cm som beskeden, og siden <= bredden (360, 390)', [360, 390].every((w) => { const r = ud.marc[`${w}-knaehoejde`]; return r.maerke?.dom === 'under' && r.knaefase?.includes(r.maerke.tekst.match(/\d+ cm/)[0]) && r.side <= w && !udenMellemrum(r.tallinje) }), [360, 390].map((w) => [ud.marc[`${w}-knaehoejde`].tallinje, ud.marc[`${w}-knaehoejde`].side]))
paastaa('B13 i Marcs gulvbillede: 360 holder nu (517: 385 px)', [360, 390].every((w) => ud.marc[`${w}-start`].side <= w), [360, 390].map((w) => ud.marc[`${w}-start`].side))

// --- C. Foer/efter: E6/B13 med "Stang -8,5 cm", og E7/E8 med Marcs skoennede nav -----------------
const LAES_FE = () => {
  const q = (s) => document.querySelector(s)
  const t = q('[data-foerefter-tabel]')
  const boks = q('[data-navskoennetboks]')
  const g = (id) => { const r = t?.querySelector(`tr[data-id="${id}"]`); return r ? [...r.querySelectorAll('td.tal')].map((d) => d.textContent.trim()) : null }
  const linje = q('[data-tallinje]')
  return {
    side: document.documentElement.scrollWidth,
    tallinje: linje?.textContent || null,
    saetning: q('[data-saetning]')?.textContent.trim() || null,
    note: q('[data-foereftertaerskel]')?.textContent.trim() || null,
    raekker: q('[data-saetningsraekker]')?.textContent.trim() || null,
    boks: boks ? { synlig: !boks.hidden && boks.getBoundingClientRect().height > 0, h: Math.round(boks.getBoundingClientRect().height), hoejre: Math.round(boks.getBoundingClientRect().right), tekst: boks.textContent.trim(), krydset: q('[data-navskoennet]').checked } : null,
    stang: g('stangFraMidtfod'), stangHofte: g('stangHofte'),
    vejledning: [...document.querySelectorAll('.mb-vejl, [data-vejledning], .mb-note')].map((e) => e.textContent).join(' | ').slice(0, 3000),
    lager: Object.keys(localStorage),
  }
}
if (!existsSync(`${MODEL}/outputs/507/syntetisk-efter.png`)) {
  mkdirSync(`${MODEL}/outputs/507`, { recursive: true })
  writeFileSync(`${MODEL}/outputs/507/syntetisk-efter.png`, execSync(`git -C ${DHRUVA} show ${SHA}:outputs/507/syntetisk-efter.png`, { maxBuffer: 1 << 26 }))
}
const SKRAA = fotoDl({ skraa: 10 })
const { klik: EK514 } = S514.efterKlik514()
for (const bredde of [...MOBIL, 1280]) {
  // C1: 517's sag, efter 10 grader skraat uden nav: "Stang -8,5 cm" i efter-billedets tallinje.
  {
    const S = await aabn(bredde)
    await maalFase(S, pathToFileURL(MARC('start')).href, 'marc-start.png', 'dl-gulv', S507.MARC_GULV, 270)
    await S.page.evaluate(() => window.maalBillede.saetSammen(true))
    await S.page.evaluate(([b]) => window.maalBillede.laesBillede(b, 'efter.png'), [await tegnFigur(SKRAA, 'samme stilling, kameraet 10 grader skraat')])
    await S.page.evaluate(([p]) => window.maalBillede.saetPunkter(p), [SKRAA])
    await vent(S)
    ud.foerEfter[`${bredde}-skraa10`] = { ...(await S.page.evaluate(LAES_FE)), net: S.net, fejl: S.fejl }
    await S.ctx.close()
  }
  // C2: E7 og E8. Foer = Marcs gulvbillede med det skoennede fjerne nav (514), efter = 514's tegnede efter-billede.
  {
    const S = await aabn(bredde)
    await maalFase(S, pathToFileURL(MARC('start')).href, 'marc-start.png', 'dl-gulv', { ...S507.MARC_GULV, stangFjern: S514.FJERNT_NAV }, 270)
    await S.page.evaluate(() => window.maalBillede.saetSammen(true))
    await S.page.evaluate(([b]) => window.maalBillede.laesBillede(b, 'efter.png'), [pathToFileURL(`${MODEL}/outputs/514/syntetisk-efter-514.png`).href])
    await S.page.evaluate(([p]) => window.maalBillede.saetPunkter(p), [EK514])
    await vent(S)
    const uden = await S.page.evaluate(LAES_FE)
    if (bredde < 500) await S.page.locator('[data-navskoennetboks]').scrollIntoViewIfNeeded()
    // Tryk paa teksten (ikke boksen), som en tommelfinger.
    const boks = S.page.locator('[data-navskoennetboks]')
    if (bredde < 500) await boks.tap({ position: { x: 200, y: 20 } }); else await boks.click({ position: { x: 300, y: 20 } })
    await vent(S)
    const med = await S.page.evaluate(LAES_FE)
    if (bredde === 390 || bredde === 360) {
      await S.page.locator('[data-foerefterstatus]').scrollIntoViewIfNeeded()
      await S.page.screenshot({ path: path.join(HERE, `M-${bredde}-e7-krydset.png`) })
    }
    // Skift fase og tilbage: huskes krydset?
    await S.page.click('[data-fase="dl-knae"]'); await vent(S)
    await S.page.click('[data-fase="dl-gulv"]'); await vent(S)
    const efterFaseskift = await S.page.evaluate(() => ({ krydset: document.querySelector('[data-navskoennet]').checked, tilstand: window.maalBillede.tilstand().navSkoennet }))
    ud.e7[bredde] = { uden, med, efterFaseskift, net: S.net, fejl: S.fejl }
    await S.ctx.close()
  }
}
const fe = ud.foerEfter
for (const w of MOBIL) console.log(w, 'skraa10 |', fe[`${w}-skraa10`].tallinje, '| side', fe[`${w}-skraa10`].side)
paastaa('E6/B13 i foer/efter: "Stang -8,5 cm" i efter-billedet, siden <= bredden paa 360, 375 og 390 (517: 385-395)', MOBIL.every((w) => fe[`${w}-skraa10`].side <= w && /Stang −8,\d cm/.test(fe[`${w}-skraa10`].tallinje) && !udenMellemrum(fe[`${w}-skraa10`].tallinje)), MOBIL.map((w) => fe[`${w}-skraa10`].side))
const e7 = ud.e7
paastaa('E7: afkrydsningen staar, naar begge billeder har navet, er >= 44 px hoej og inden for skaermen (360, 375, 390)', MOBIL.every((w) => e7[w].uden.boks?.synlig && e7[w].uden.boks.h >= 44 && e7[w].uden.boks.hoejre <= w && e7[w].uden.side <= w), MOBIL.map((w) => e7[w].uden.boks))
paastaa('E7: et tryk paa teksten saetter krydset, og stangens graense gaar fra 3,0 til 6,0 cm (360, 375, 390, 1280)', [...MOBIL, 1280].every((w) => !e7[w].uden.boks.krydset && e7[w].med.boks.krydset && /grænse 3,0 cm/.test(e7[w].uden.stang?.[2]) && /grænse 6,0 cm/.test(e7[w].med.stang?.[2])), [e7[390].uden.stang, e7[390].med.stang])
paastaa('E7: noten siger "Klik kun et nav, du kan se", og med krydset hvorfor graenserne er fordoblet', /Klik kun et nav, du kan se/.test(e7[390].uden.note) && /ganget med 2/.test(e7[390].med.note), e7[390].med.note.slice(-420))
paastaa('E7: afkrydsningen staar ikke uden nav (517-sagen)', MOBIL.every((w) => !fe[`${w}-skraa10`].boks?.synlig))
paastaa('E8: noten siger, hvor mange raekker saetningen laeser, og hvor ofte en falsk forskel kommer', MOBIL.every((w) => /Sætningen læser 8 rækker/.test(e7[w].uden.raekker) && /ca\. hvert fjerde/.test(e7[w].uden.raekker)) && /Sætningen læser 5 rækker.*ca\. hvert sjette/.test(fe['390-skraa10'].raekker || ''), [e7[390].uden.raekker, fe['390-skraa10'].raekker])
paastaa('Foer/efter: intet net, ingen JS-fejl, intet gemt ud over Min krop', [...Object.values(fe), ...Object.values(e7)].every((r) => r.net.length === 0 && r.fejl.length === 0) && Object.values(e7).every((r) => r.med.lager.every((k) => k === MM.MIN_KROP_LAGER)))
console.log('E7 krydset efter faseskift', JSON.stringify(Object.fromEntries(Object.entries(e7).map(([w, r]) => [w, r.efterFaseskift]))))

// --- D. E3-rest paa siden: squat sticking point, mine fire kamerapladser, uden og med navet ---------
for (const bredde of [360, 390]) {
  const S = await aabn(bredde, { minKrop: false })
  await S.page.evaluate(() => window.maalBillede.saetKrop({ hoejde: '178' }))
  for (const c of KAM_SQ) {
    const alle = fotoSq(c)
    const { stangFjern, ...uden } = alle
    for (const [nav, klik] of [[false, uden], [true, alle]]) {
      await maalFase(S, await tegnFigur(klik, `squat, kamera ${c.id}`, { w: 1200, h: 1400 }), `sq-${c.id}.png`, 'squat-midt', klik, 140)
      const r = await S.page.evaluate(() => { const p = document.querySelector('[data-fasehoejde]'); return p ? { dom: p.dataset.fasehoejde, hint: p.dataset.hint || null, tekst: p.textContent.trim(), side: document.documentElement.scrollWidth } : null })
      ud.e3[`${bredde}-${c.id}-${nav ? 'nav' : 'udenNav'}`] = r
      if (bredde === 390 && c.id === 'lav60') await S.page.locator('[data-fasehoejde]').screenshot({ path: path.join(HERE, `M-390-squat-lav60-${nav ? 'nav' : 'uden-nav'}.png`) })
    }
  }
  ud.e3[`${bredde}-fejl`] = S.fejl; ud.e3[`${bredde}-net`] = S.net
  await S.ctx.close()
}
const e3 = ud.e3
for (const [k, r] of Object.entries(e3)) if (r && r.dom) console.log('E3', k, r.dom, r.hint, r.side)
paastaa('E3-rest: uden navet siger de to forkerte kamerapladser (30 cm hoejere, 60 cm lavt) "lavere"/"hoejere" som et hint, ikke en dom (360, 390)', [360, 390].every((w) => e3[`${w}-op30vip-udenNav`]?.dom === 'lavere' && e3[`${w}-op30vip-udenNav`].hint === '1' && e3[`${w}-lav60-udenNav`]?.dom === 'hoejere' && e3[`${w}-lav60-udenNav`].hint === '1' && /kun et hint, ikke en dom/.test(e3[`${w}-lav60-udenNav`].tekst)), e3['390-lav60-udenNav']?.tekst)
paastaa('E3-rest: med navet er alle fire kamerapladser "ok" uden hint', [360, 390].every((w) => KAM_SQ.every((c) => e3[`${w}-${c.id}-nav`]?.dom === 'ok' && !e3[`${w}-${c.id}-nav`].hint)))
paastaa('E3-rest: siden <= bredden og ingen JS-fejl', [360, 390].every((w) => KAM_SQ.every((c) => ['nav', 'udenNav'].every((n) => e3[`${w}-${c.id}-${n}`]?.side <= w)) && e3[`${w}-fejl`].length === 0 && e3[`${w}-net`].length === 0))

ud.tjek = tjek
writeFileSync(path.join(HERE, 'maal-side-530.json'), JSON.stringify(ud, null, 1))
await browser.close()
const nej = tjek.filter((x) => !x.ok).length
console.log(`${tjek.length - nej}/${tjek.length} tjek groenne (dhruva ${SHA})`)
if (nej) process.exitCode = 1
