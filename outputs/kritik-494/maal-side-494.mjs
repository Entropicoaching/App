// KRITIK 494 blok 1, siden: Bhishak bruger "Maal dit billede" (Yantra 484) som coach,
// headless Chromium uden net, 390 px med touch og 1280 px med mus.
//   node outputs/kritik-494/maal-side-494.mjs      (efter maal-regning-494.mjs)
// Billeder:
//   syntetiske: modellens egne stillinger (dhruva main), tegnet som en simpel figur med
//     skive, set med et pinhole-kamera 3 m fra loefteren i hoftehoejde (samme kamera som
//     maal-regning-494.mjs) eller uden perspektiv. Skrevet til outputs/kritik-494/syn-*.png.
//   Marcs klip fra 462: outputs/videomaal/marc-doedloeft-270-start.png og -knaehoejde.png i
//     dhruva (kun laest; intet nyt billede fra klippet i dette repo).
// Punkterne saettes med touch (390) og mus (1280) paa billedets pixels omregnet til skaermen,
// ogsaa bevidst forkert (hoften ved baeltet, skulderen midt i leddet, 2 cm fingerfejl).
// Skriver outputs/kritik-494/maal-side-494.json og M-*.png.
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'
import path from 'node:path'
import { writeFileSync, readFileSync } from 'node:fs'
import { pathToFileURL, fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const MODEL = 'C:/Users/Entropi/Desktop/entropi-loeftmodel-dhruva'
const imp = (f) => import(pathToFileURL(`${MODEL}/src/${f}`).href)
const MB = await imp('maalBillede.js')
const MM = await imp('maalBilledeModel.js')
const MK = await imp('minKrop.js')
const SIDE = pathToFileURL(`${MODEL}/dist/maal-billede/index.html`).href
const MARC = (n) => `${MODEL}/outputs/videomaal/marc-doedloeft-270-${n}.png`

const r1 = (x) => (x === null || x === undefined || !Number.isFinite(x) ? null : Math.round(x * 10) / 10)
const tjek = []
const paastaa = (hvad, ok, data) => { tjek.push({ hvad, ok: !!ok, data }); console.log(`${ok ? 'ok ' : 'NEJ'} ${hvad}${data !== undefined ? ' ' + JSON.stringify(data).slice(0, 600) : ''}`) }

function krop(h, v, pct = {}) {
  const o = { hoejde: h, vaegt: v }
  for (const id of MK.SEGMENT_MAAL) o[id] = r1(MK.gennemsnitCm(id, h) * (pct[id] ?? 100) / 100)
  return o
}
const KROP_A = krop(180, 90, { laar: 108, skinneben: 98, torso: 94 })
const KROP_B = krop(170, 75, { laar: 93, skinneben: 102, torso: 106, overarm: 95, underarm: 95 })

// --- Syntetiske billeder --------------------------------------------------------------
const SIDE_CM = { stang: 69, midtfod: 10, ankel: 10, knae: 11, hofte: 17, skulder: 19 }
const IDS = ['stang', 'midtfod', 'ankel', 'knae', 'hofte', 'skulder']
// Verden (cm, x frem, y op, z mod kameraet) -> billede (px, y ned), 1080x1440.
function kamera(P, h, D) {
  const kh = P.hofte.y, kx = P.stang.x
  const raa = (p, z) => (D ? { x: (p.x - kx) / (D - z) * 300, y: -(p.y - kh) / (D - z) * 300 } : { x: p.x, y: -p.y })
  const zz = (id) => (id === 'stang' ? SIDE_CM.stang : SIDE_CM[id] * h / 178)
  const pk = {}
  for (const id of IDS) pk[id] = raa(P[id], zz(id))
  pk.skalaA = raa({ x: P.stang.x, y: P.stang.y + 22.5 }, SIDE_CM.stang)
  pk.skalaB = raa({ x: P.stang.x, y: P.stang.y - 22.5 }, SIDE_CM.stang)
  // Tegnepunkter (hoved, hael, taa) paa kroppens dybde.
  const t = MMfig(P)
  pk.hoved = raa(t.hoved, zz('skulder')); pk.hael = raa({ x: P.midtfod.x - 13 * h / 178, y: 0 }, zz('midtfod')); pk.taa = raa({ x: P.midtfod.x + 13 * h / 178, y: 0 }, zz('midtfod'))
  // Skaler til billedet: kroppen fylder ca. 70 % af hoejden.
  const ys = Object.values(pk).map((p) => p.y), xs = Object.values(pk).map((p) => p.x)
  const k = 1000 / (Math.max(...ys) - Math.min(...ys) + 60), ox = 540 - k * (Math.max(...xs) + Math.min(...xs)) / 2, oy = 1300 - k * Math.max(...ys)
  const ud = {}
  for (const [id, p] of Object.entries(pk)) ud[id] = { x: ox + k * p.x, y: oy + k * p.y }
  return ud
}
function MMfig(P) {
  const d = { x: P.skulder.x - P.hofte.x, y: P.skulder.y - P.hofte.y }, n = Math.hypot(d.x, d.y)
  return { hoved: { x: P.skulder.x + d.x / n * 17, y: P.skulder.y + d.y / n * 17 } }
}

const require = createRequire(import.meta.url)
const { chromium } = require(join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright'))
const browser = await chromium.launch({ headless: true })

async function tegnPng(b, fil, { arm = true } = {}) {
  const page = await browser.newPage()
  const url = await page.evaluate(({ b, arm }) => {
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1440
    const x = c.getContext('2d')
    x.fillStyle = '#9a968c'; x.fillRect(0, 0, 1080, 1440)
    x.fillStyle = '#6f6a60'; x.fillRect(0, b.midtfod.y, 1080, 1440 - b.midtfod.y)
    const linje = (a, c2, w, f) => { x.strokeStyle = f; x.lineWidth = w; x.lineCap = 'round'; x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(c2.x, c2.y); x.stroke() }
    const w = Math.hypot(b.skalaA.x - b.skalaB.x, b.skalaA.y - b.skalaB.y) / 45 // px pr. cm ved skiven
    x.fillStyle = '#222'; x.beginPath(); x.moveTo(b.hael.x, b.midtfod.y); x.lineTo(b.taa.x, b.midtfod.y); x.lineTo(b.ankel.x + 3 * w, b.ankel.y); x.lineTo(b.ankel.x - 4 * w, b.ankel.y); x.closePath(); x.fill()
    linje(b.ankel, b.knae, 11 * w, '#c89b7b'); linje(b.knae, b.hofte, 16 * w, '#2e3a4a'); linje(b.hofte, b.skulder, 26 * w, '#3a3a3a')
    x.fillStyle = '#c89b7b'; x.beginPath(); x.arc(b.hoved.x, b.hoved.y, 11 * w, 0, 7); x.fill()
    const r = Math.hypot(b.skalaA.x - b.skalaB.x, b.skalaA.y - b.skalaB.y) / 2
    x.fillStyle = 'rgba(150,20,20,0.92)'; x.beginPath(); x.arc(b.stang.x, b.stang.y, r, 0, 7); x.fill()
    x.fillStyle = '#ccc'; x.beginPath(); x.arc(b.stang.x, b.stang.y, 2.5 * w, 0, 7); x.fill()
    if (arm) linje(b.skulder, b.stang, 8 * w, '#c89b7b')
    return c.toDataURL('image/png')
  }, { b, arm })
  writeFileSync(join(HERE, fil), Buffer.from(url.split(',')[1], 'base64'))
  await page.close()
}

function stilling(faseId, felter) {
  const f = MB.fase(faseId)
  const K = MM.kroppe(f.loeft, felter)
  return MM.modelFase(faseId, K.dig || K.snit)
}
const SYN = {
  'dl-gulv-3m': { fase: 'dl-gulv', felter: null, D: 300 },
  'squat-A-3m': { fase: 'squat-bund', felter: KROP_A, D: 300 },
  'dl-knae-B': { fase: 'dl-knae', felter: KROP_B, D: 0 },
}
for (const [n, s] of Object.entries(SYN)) {
  const m = stilling(s.fase, s.felter)
  s.billede = kamera(m.punkter, s.felter?.hoejde ?? 178, s.D)
  s.fil = `syn-${n}.png`
  s.cmPrPx = 45 / Math.hypot(s.billede.skalaA.x - s.billede.skalaB.x, s.billede.skalaA.y - s.billede.skalaB.y)
  await tegnPng(s.billede, s.fil)
}

// --- Siden -------------------------------------------------------------------------
async function aabn(bredde, { minKrop = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: bredde, height: bredde === 390 ? 844 : 900 }, deviceScaleFactor: bredde === 390 ? 3 : 1, isMobile: bredde === 390, hasTouch: bredde === 390 })
  const page = await ctx.newPage()
  const eksterne = []
  await page.route('**/*', (route) => { const u = route.request().url(); if (!u.startsWith('file:') && !u.startsWith('blob:') && !u.startsWith('data:')) { eksterne.push(u); return route.abort() } return route.continue() })
  await page.addInitScript((mk) => {
    if (mk && !localStorage.getItem('loeftmodel-min-krop-468')) localStorage.setItem('loeftmodel-min-krop-468', JSON.stringify(mk))
    window.__skriv = 0
    const o = Storage.prototype.setItem
    Storage.prototype.setItem = function (...a) { window.__skriv++; return o.apply(this, a) }
  }, minKrop)
  await page.goto(SIDE)
  await page.waitForSelector('[data-klar]')
  const cdp = bredde === 390 ? await ctx.newCDPSession(page) : null
  return { ctx, page, eksterne, cdp, bredde }
}
async function laesFil(S, fil) {
  await S.page.setInputFiles('[data-fil]', fil)
  await S.page.waitForFunction(() => window.maalBillede.tilstand().billede)
}
async function vaelgFase(S, id) { await S.page.click(`[data-fase="${id}"]`) }
// Billedpixel -> skaermpunkt (viewport), efter at canvas er rullet ind.
async function skaerm(S, p) {
  return S.page.evaluate((p) => {
    const cv = document.querySelector('[data-billede]')
    const d = window.maalBillede.tilstand().visning.d
    const r = cv.getBoundingClientRect()
    return { x: r.left + p.x * d, y: r.top + p.y * d }
  }, p)
}
async function rulTilCanvas(S) {
  await S.page.evaluate(() => { const r = document.querySelector('[data-billede]').getBoundingClientRect(); window.scrollBy(0, r.top - 8) })
}
async function tryk(S, p) {
  const q = await skaerm(S, p)
  if (S.bredde === 390) await S.page.touchscreen.tap(q.x, q.y)
  else await S.page.mouse.click(q.x, q.y)
  return q
}
async function traek(S, fra, til) {
  const a = await skaerm(S, fra), b = await skaerm(S, til)
  if (S.cdp) {
    const tp = (p) => [{ x: p.x, y: p.y, id: 1, radiusX: 8, radiusY: 8, force: 1 }]
    await S.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(a) })
    for (let i = 1; i <= 8; i++) await S.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp({ x: a.x + (b.x - a.x) * i / 8, y: a.y + (b.y - a.y) * i / 8 }) })
    await S.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  } else {
    await S.page.mouse.move(a.x, a.y); await S.page.mouse.down()
    for (let i = 1; i <= 8; i++) await S.page.mouse.move(a.x + (b.x - a.x) * i / 8, a.y + (b.y - a.y) * i / 8)
    await S.page.mouse.up()
  }
}
async function saetAlle(S, b) {
  await rulTilCanvas(S)
  for (const id of [...IDS, 'skalaA', 'skalaB']) await tryk(S, b[id])
}
async function tal(S) {
  return S.page.evaluate(() => {
    const rk = (sel) => Object.fromEntries([...document.querySelectorAll(`${sel} tbody tr`)].map((tr) => [tr.dataset.id, [...tr.querySelectorAll('td.tal')].map((td) => td.textContent.trim())]))
    const t = window.maalBillede.tilstand()
    return {
      maaling: rk('[data-maaling]'), sammen: rk('[data-sammenligning]'),
      advarsel: document.querySelector('[data-skalaadvarsel]')?.textContent.trim() || null,
      vejl: document.querySelector('[data-vejl]')?.textContent.trim(),
      kolonner: [...document.querySelectorAll('[data-sammenligning] thead th')].map((th) => th.textContent.trim()),
      punkter: Object.keys(t.punkter), traek: t.traek,
    }
  })
}
const tal1 = (s) => (s == null ? null : Number(String(s).replace('−', '-').replace(',', '.').replace(/[^\d.-]/g, '')))
async function layout(S) {
  return S.page.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); if (!e || e.hidden) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top + scrollY), bund: Math.round(b.bottom + scrollY), h: Math.round(b.height), w: Math.round(b.width) } }
    return { vandretRul: document.documentElement.scrollWidth > innerWidth, sideH: document.documentElement.scrollHeight, vindueH: innerHeight, vejl: r('[data-vejl]'), billede: r('[data-billede]'), model: r('[data-modelboks]'), resultat: r('[data-resultat]'), tabel: r('[data-sammenligning]'), advarsel: r('[data-skalaadvarsel]'), udenskala: r('[data-udenskala]') }
  })
}
async function skud(S, fil, fuld = false) { await S.page.screenshot({ path: join(HERE, fil), fullPage: fuld }) }
const ud = {}

// --- 1. 390 touch: syntetisk doedloeft ved gulvet, 3 m, uden Min krop ----------------------
{
  const s = SYN['dl-gulv-3m']
  const S = await aabn(390)
  await laesFil(S, join(HERE, s.fil))
  await vaelgFase(S, 'dl-gulv')
  const foer = await layout(S)
  await saetAlle(S, s.billede)
  const t1 = await tal(S)
  const lay = await layout(S)
  await skud(S, 'M-390-dl-gulv-3m-klikket.png')
  // Afstanden paa skaermen mellem de punkter, en finger skal skelne, naar alle er sat.
  const d = await S.page.evaluate(() => window.maalBillede.tilstand().visning.d)
  const px = (a, b) => r1(Math.hypot(s.billede[a].x - s.billede[b].x, s.billede[a].y - s.billede[b].y) * d)
  const afst = { 'midtfod-skalaB': px('midtfod', 'skalaB'), 'midtfod-ankel': px('midtfod', 'ankel'), 'knae-skalaA': px('knae', 'skalaA'), 'stang-knae': px('stang', 'knae'), cmPrCssPx: r1(s.cmPrPx / d) }
  // Proev at traekke midtfoden 2 cm frem (skoens midte): hvilket punkt flytter?
  const frem = { x: s.billede.midtfod.x + 2 / s.cmPrPx, y: s.billede.midtfod.y }
  const foerP = await S.page.evaluate(() => JSON.parse(JSON.stringify(window.maalBillede.tilstand().punkter)))
  await traek(S, s.billede.midtfod, frem)
  const efterP = await S.page.evaluate(() => JSON.parse(JSON.stringify(window.maalBillede.tilstand().punkter)))
  const flyttet = Object.keys(efterP).filter((k) => Math.hypot(efterP[k].x - foerP[k].x, efterP[k].y - foerP[k].y) > 0.5)
  await S.page.click('[data-forfra]')
  // Bevidst forkert: hoften ved baeltet (8 cm op) og skulderen midt i leddet (4 cm ned).
  const forkert = JSON.parse(JSON.stringify(s.billede))
  forkert.hofte.y -= 8 / s.cmPrPx
  forkert.skulder.y += 4 / s.cmPrPx
  await saetAlle(S, forkert)
  const t2 = await tal(S)
  // Kroppens skala.
  await S.page.click('[data-udenskala]')
  const t3 = await tal(S)
  await S.page.click('[data-udenskala]')
  // Stangens vaegt: 100 kg i stedet for 270.
  await S.page.fill('[data-kg]', '100'); await S.page.dispatchEvent('[data-kg]', 'change')
  const t4 = await tal(S)
  ud.syn390 = { foer, lay, t1, afst, flyttet, forkert: t2, kroppensSkala: t3, kg100: t4, net: S.eksterne, skriv: await S.page.evaluate(() => window.__skriv) }
  await S.ctx.close()
}
const a = ud.syn390
paastaa('390: 8 tryk med touch saetter alle punkter, og tabellen "billede mod model" kommer', a.t1.punkter.length === 8 && Object.keys(a.t1.sammen).length === 5, a.t1.punkter)
paastaa('390: skiven 3 m fra kameraet giver skala-advarslen (som regnet)', !!a.t1.advarsel, a.t1.advarsel?.slice(0, 160))
paastaa('390: vinklerne i siden er modellens (torso inden for 1 grad af 61,5)', Math.abs(tal1(a.t1.sammen.torso[0]) - tal1(a.t1.sammen.torso[1])) < 1.5, a.t1.sammen.torso)
paastaa('390: naar alle punkter er sat, flytter et traek fra midtfoden kun midtfoden (naermeste punkt vinder)', a.flyttet.length === 1 && a.flyttet[0] === 'midtfod', { afst: a.afst, flyttet: a.flyttet })
paastaa('390: "Brug kroppens laengder" frem og tilbage sletter skivens to punkter; tabellen siger "kraever skala" igen', a.kg100.punkter.length === 6 && a.kg100.maaling.stangFraMidtfod[0] === 'kræver skala', a.kg100.punkter)
paastaa('390: hoften ved baeltet + skulderen midt i leddet giver torso ca. 12 grader mere vandret end sandt (regningen: 8,4 + 4,1)', tal1(a.forkert.sammen.torso[0]) - tal1(a.t1.sammen.torso[0]) >= 9, { rigtigt: a.t1.sammen.torso[0], forkert: a.forkert.sammen.torso[0] })
paastaa('390: stangens vaegt 100 kg flytter modellens balancepunkt ved gulvet ca. 2,5 cm', Math.abs(tal1(a.kg100.sammen.balanceStang[1]) - tal1(a.t1.sammen.balanceStang[1])) >= 2, { kg270: a.t1.sammen.balanceStang, kg100: a.kg100.sammen.balanceStang })
paastaa('390: ingen vandret rulning, intet net, intet skrevet til lageret', !a.lay.vandretRul && a.net.length === 0 && a.skriv === 0, { net: a.net, skriv: a.skriv })
paastaa('390: billedet og vejledningen kan ikke ses samtidig med tabellen (coachen ruller efter hvert traek)', a.lay.tabel.top > a.lay.billede.top + a.lay.vindueH, { billede: a.lay.billede, tabel: a.lay.tabel, vindueH: a.lay.vindueH })

// --- 2. 1280 mus: syntetisk squat, krop A i Min krop, 3 m ---------------------------------
{
  const s = SYN['squat-A-3m']
  const S = await aabn(1280, { minKrop: KROP_A })
  await laesFil(S, join(HERE, s.fil))
  await vaelgFase(S, 'squat-bund')
  await saetAlle(S, s.billede)
  const t1 = await tal(S)
  const lay = await layout(S)
  await skud(S, 'M-1280-squat-A-3m.png', true)
  // 2 cm fingerfejl paa hvert punkt (fast moenster).
  await S.page.click('[data-forfra]')
  const ryst = JSON.parse(JSON.stringify(s.billede))
  const moenster = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1.4, 0], [0, -1.4]]
  IDS.forEach((id, i) => { ryst[id].x += moenster[i][0] * 1.41 / s.cmPrPx; ryst[id].y += moenster[i][1] * 1.41 / s.cmPrPx })
  await saetAlle(S, ryst)
  const t2 = await tal(S)
  await S.page.click('[data-udenskala]')
  const t3 = await tal(S)
  ud.squat1280 = { t1, lay, ryst: t2, kroppensSkala: t3, net: S.eksterne, skriv: await S.page.evaluate(() => window.__skriv) }
  await S.ctx.close()
}
const b = ud.squat1280
paastaa('1280: med Min krop (krop A) har tabellen kolonnen "Model, dine mål", og modellen staar ved siden af billedet', b.t1.kolonner.includes('Model, dine mål') && b.lay.model && b.lay.model.top < b.lay.billede.bund, b.t1.kolonner)
paastaa('1280: squattens stang-hofte med skiven er flere cm kortere end med kroppens skala (3 m)', tal1(b.kroppensSkala.maaling.stangHofte[0]) - tal1(b.t1.maaling.stangHofte[0]) >= 2, { skive: b.t1.maaling.stangHofte, krop: b.kroppensSkala.maaling.stangHofte })
paastaa('1280: 2 cm fingerfejl flytter squattens vinkler faa grader', ['torso', 'hofte', 'knae'].every((k) => Math.abs(tal1(b.ryst.maaling[k][0]) - tal1(b.t1.maaling[k][0])) <= 5), Object.fromEntries(['torso', 'hofte', 'knae'].map((k) => [k, [b.t1.maaling[k][0], b.ryst.maaling[k][0]]])))

// --- 3. 390: doedloeft i knaehoejde, krop B, uden perspektiv ---------------------------------
{
  const s = SYN['dl-knae-B']
  const S = await aabn(390, { minKrop: KROP_B })
  await laesFil(S, join(HERE, s.fil))
  await vaelgFase(S, 'dl-knae')
  await saetAlle(S, s.billede)
  const t1 = await tal(S)
  ud.knaeB390 = { t1 }
  await S.ctx.close()
}
paastaa('390: krop B i knaehoejde uden perspektiv: billedets vinkler = modellens med dine maal, ingen advarsel', !ud.knaeB390.t1.advarsel && Math.abs(tal1(ud.knaeB390.t1.sammen.knae[0]) - tal1(ud.knaeB390.t1.sammen.knae[2])) < 1, ud.knaeB390.t1.sammen)

// --- 4. Marcs klip fra 462: mine egne klik, 390 touch og 1280 mus -------------------------------
// Mine klik i 900x1200 (sat efter billederne; foden er skjult bag skiven i startbilledet,
// saa jeg gaetter midtfoden og anklen under skiven, som en coach ville, uden trick).
const MINE = {
  start: { stang: { x: 441, y: 828 }, midtfod: { x: 430, y: 948 }, ankel: { x: 400, y: 905 }, knae: { x: 447, y: 668 }, hofte: { x: 343, y: 583 }, skulder: { x: 470, y: 460 }, skalaA: { x: 441, y: 702 }, skalaB: { x: 441, y: 955 } },
  knaehoejde: { stang: { x: 434, y: 768 }, midtfod: { x: 427, y: 942 }, ankel: { x: 398, y: 905 }, knae: { x: 445, y: 640 }, hofte: { x: 340, y: 553 }, skulder: { x: 460, y: 418 }, skalaA: { x: 434, y: 650 }, skalaB: { x: 434, y: 890 } },
}
// Samme billeder, hoften ved baeltet/hoftekammen (ca. 40 px op) - den hyppige fejl.
const BAELTE = { start: { ...MINE.start, hofte: { x: 343, y: 543 } }, knaehoejde: { ...MINE.knaehoejde, hofte: { x: 340, y: 513 } } }
ud.marc = {}
for (const bredde of [390, 1280]) {
  const S = await aabn(bredde, { minKrop: MK.gennemsnitsMaal(183, 120) })
  for (const n of ['start', 'knaehoejde']) {
    await laesFil(S, MARC(n))
    await vaelgFase(S, n === 'start' ? 'dl-gulv' : 'dl-knae')
    await saetAlle(S, MINE[n])
    const t1 = await tal(S)
    const lay = await layout(S)
    await skud(S, `M-${bredde}-marc-${n}.png`, bredde === 1280)
    // Midtfoden (punkt 2) og skivens nederste kant (punkt 8) ligger taet: et traek, der
    // starter 3 CSS-px fra midtfoden mod skivens kant, 2 cm frem.
    const dd = await S.page.evaluate(() => window.maalBillede.tilstand().visning.d)
    const mf = MINE[n].midtfod, sb = MINE[n].skalaB, L = Math.hypot(sb.x - mf.x, sb.y - mf.y)
    const start = { x: mf.x + (sb.x - mf.x) / L * 3 / dd, y: mf.y + (sb.y - mf.y) / L * 3 / dd }
    const foerP = await S.page.evaluate(() => JSON.parse(JSON.stringify(window.maalBillede.tilstand().punkter)))
    await traek(S, start, { x: start.x + 10, y: start.y })
    const efterP = await S.page.evaluate(() => JSON.parse(JSON.stringify(window.maalBillede.tilstand().punkter)))
    const flyttet = Object.keys(efterP).filter((k) => Math.hypot(efterP[k].x - foerP[k].x, efterP[k].y - foerP[k].y) > 0.5)
    const overlap = { cssPx: r1(L * dd), flyttet }
    await S.page.click('[data-forfra]')
    await saetAlle(S, MINE[n])
    await S.page.click('[data-udenskala]')
    const t2 = await tal(S)
    await S.page.click('[data-udenskala]')
    await S.page.click('[data-forfra]')
    await saetAlle(S, BAELTE[n])
    const t3 = await tal(S)
    await S.page.click('[data-forfra]')
    ud.marc[`${bredde}-${n}`] = { t1, kroppensSkala: t2, baelte: t3, lay, overlap }
  }
  ud.marc[`${bredde}-net`] = S.eksterne
  await S.ctx.close()
}
const m = ud.marc
paastaa('Marc: mine klik paa 390 og 1280 giver samme tal (inden for 0,5 grad)', ['torso', 'hofte', 'knae'].every((k) => Math.abs(tal1(m['390-start'].t1.maaling[k][0]) - tal1(m['1280-start'].t1.maaling[k][0])) <= 0.5), { 390: m['390-start'].t1.maaling.torso, 1280: m['1280-start'].t1.maaling.torso })
paastaa('Marc: mine klik ligger inden for 3 grader af Yantras paa torsoen (48,5 og 43,8)', Math.abs(tal1(m['390-start'].t1.maaling.torso[0]) - 48.5) <= 3 && Math.abs(tal1(m['390-knaehoejde'].t1.maaling.torso[0]) - 43.8) <= 3, { start: m['390-start'].t1.maaling.torso, knae: m['390-knaehoejde'].t1.maaling.torso })
paastaa('Marc: siden advarer om skalaen paa begge billeder', !!m['390-start'].t1.advarsel && !!m['390-knaehoejde'].t1.advarsel, [m['390-start'].t1.advarsel?.match(/\(\d+ %\)/)?.[0], m['390-knaehoejde'].t1.advarsel?.match(/\(\d+ %\)/)?.[0]])
paastaa('Marc: "knaehoejde"-billedet giver knaevinkel ca. 120 grader mod modellens ca. 146, og siden siger intet om, at stangen staar under knaeet', tal1(m['390-knaehoejde'].t1.sammen.knae[1]) - tal1(m['390-knaehoejde'].t1.sammen.knae[0]) > 15 && !/under knæ/i.test(JSON.stringify(m['390-knaehoejde'].t1)), m['390-knaehoejde'].t1.sammen.knae)
paastaa('Marc: hoften ved baeltet flytter torsoen og knaeet flere grader i klippet', Math.abs(tal1(m['390-start'].baelte.maaling.torso[0]) - tal1(m['390-start'].t1.maaling.torso[0])) >= 4, { rigtig: m['390-start'].t1.maaling, baelte: m['390-start'].baelte.maaling })
paastaa('Marc paa 390: midtfoden og skivens nederste kant ligger under 10 CSS-px fra hinanden, og et traek 3 px ved siden af midtfoden flytter skivens kant', m['390-start'].overlap.cssPx < 10 && m['390-start'].overlap.flyttet.includes('skalaB'), m['390-start'].overlap)
paastaa('Marc: intet net paa 390 og 1280', m['390-net'].length === 0 && m['1280-net'].length === 0)

ud.tjek = tjek
writeFileSync(join(HERE, 'maal-side-494.json'), JSON.stringify(ud, null, 1))
await browser.close()
const nej = tjek.filter((t) => !t.ok).length
console.log(`${tjek.length - nej}/${tjek.length} tjek groenne`)
