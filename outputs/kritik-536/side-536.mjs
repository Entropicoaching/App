// Kritik 536, blok 1: "Ligner" paa selve siden (dist/maal-billede, entropi-loeftmodel-dhruva main)
// headless uden net paa 360 og 390 med touch og 1280 med mus.
//   node outputs/kritik-536/side-536.mjs
// Billederne er TEGNEDE, SYNTETISKE figurer fotograferet med mit pinhole-kamera (som fejl-536.mjs),
// og Marcs eget gulvbillede fra 462 med Yantras 498-klik og mine 494-klik. Skaermbilleder af Marcs
// billede er kun udsnit af boksen/tabellen. Kroppen er sidens hoejdefelt (178 cm, 85 kg) for de
// tegnede figurer og 183 cm/120 kg for Marcs klip. Skriver side-536.json og S-*.png.
//
//   L1  doedloeft ved gulvet, modellens egen bane, stangen 12-19 cm over gulvet, kamera i hoftehoejde:
//       siger siden "Ligner: hoften stiger foerst"?
//   L2  squattens bund med knaeene 30 grader ud (bred fodstilling): staar der noget paa skaermen?
//   L3  squattens bund, high bar og skinnebenet 6 grader frem (sko med hael): "Ligner: kun knaeene"?
//   M   Marcs gulvbillede: intet "Ligner", siden inden for skaermen.
//   V   en rigtig fejlfigur (hoften skudt tilbage, bunden): boksen, figuren hentet, ingen vandret rulning.
import path from 'node:path'
import { tmpdir } from 'node:os'
import { writeFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { chromium } from '../../e2e/harness.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DHRUVA = 'C:/Users/Entropi/Desktop/entropi-loeftmodel-dhruva'
const SHA = execSync(`git -C ${DHRUVA} rev-parse --short ${process.argv[2] || 'main'}`).toString().trim()
const LM = path.join(tmpdir(), `kritik-536-loeftmodel-${SHA}`)
if (!existsSync(path.join(LM, 'dist', 'maal-billede', 'index.html'))) execSync(`node ${path.join(HERE, 'fejl-536.mjs')} ${SHA}`)
const imp = (f) => import(pathToFileURL(path.join(LM, f)).href)
const { maal, skalaFraKrop, knaeFaseTjek } = await imp('src/maalBillede.js')
const { modelFase } = await imp('src/maalBilledeModel.js')
const { indstilling } = await imp('src/minKrop.js')
const { genkendFejl } = await imp('src/maalBilledeFejl.js')
const { MARC_GULV } = await imp('scripts/ordre-507-skaermbilleder.mjs')
const SIDE = pathToFileURL(`${LM}/dist/maal-billede/index.html`).href
const IDS = ['stang', 'midtfod', 'ankel', 'knae', 'hofte', 'skulder']
const MINE_GULV = { stang: { x: 441, y: 828 }, midtfod: { x: 430, y: 948 }, ankel: { x: 400, y: 905 }, knae: { x: 447, y: 668 }, hofte: { x: 343, y: 583 }, skulder: { x: 470, y: 460 } }

const tjek = []
const paastaa = (hvad, ok, data) => { tjek.push({ hvad, ok: !!ok, data }); console.log(`${ok ? 'ok ' : 'NEJ'} ${hvad}${data !== undefined ? ' ' + JSON.stringify(data).slice(0, 300) : ''}`) }

// --- pinhole ---------------------------------------------------------------------
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }), dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x })
const norm = (a) => { const n = Math.sqrt(dot(a, a)); return { x: a.x / n, y: a.y / n, z: a.z / n } }
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }), mul = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s })
function kamera(cx, h) {
  const C = { x: cx, y: h, z: -300 }, f = norm(sub({ x: cx, y: h, z: 0 }, C)), r = norm(cross({ x: 0, y: 1, z: 0 }, f)), u = cross(f, r)
  return (P) => { const d = sub(P, C), z = dot(d, f); return { x: (1000 * dot(d, r)) / z, y: (-1000 * dot(d, u)) / z } }
}
const DYBDE = { squat: { stang: -70, midtfod: -15, ankel: -16, knae: -18, hofte: -18, skulder: -20 }, doedloeft: { stang: -75, midtfod: -12, ankel: -14, knae: -13, hofte: -18, skulder: -20 } }
// Klik i et 900 x 1200-billede med midtfoden i (450, 1080); skiven (22,5 cm) om det naere nav til tegningen.
function foto(P, loeft, h, { nav = true, knae3 = null } = {}) {
  const d = DYBDE[loeft], k = kamera(P.stang.x, h)
  const Q = {}
  for (const id of IDS) Q[id] = id === 'knae' && knae3 ? knae3 : { x: P[id].x, y: P[id].y, z: d[id] }
  Q.stangFjern = { x: P.stang.x, y: P.stang.y, z: -d.stang }
  Q.skalaA = { x: P.stang.x, y: P.stang.y + 22.5, z: d.stang }
  const raa = Object.fromEntries(Object.entries(Q).map(([id, p]) => [id, k(p)]))
  const ud = Object.fromEntries(Object.entries(raa).map(([id, p]) => [id, { x: 450 + (p.x - raa.midtfod.x), y: 1080 + (p.y - raa.midtfod.y) }]))
  if (!nav) delete ud.stangFjern
  return ud
}
const klikKun = (b) => Object.fromEntries(Object.entries(b).filter(([id]) => id !== 'skalaA'))
const ind = (l, h, v) => indstilling(l, { hoejde: h, vaegt: v }, { gennemsnit: true })
const node = (klik, f, I) => { const mf = modelFase(f, I); const m = maal(klik, { fase: f, cmPrPx: skalaFraKrop(klik, mf.L) }); return genkendFejl(m, mf.punkter, { knaeFase: knaeFaseTjek(m) }) }

// L1: modellens egen bane fra gulvet mod knaehoejde (lineaer overgang), 178 cm/85 kg, kamera i hoftehoejde (75 cm).
const Idl = ind('doedloeft', 178, 85)
const G = modelFase('dl-gulv', Idl).punkter, KN = modelFase('dl-knae', Idl).punkter
const dlVed = (cm) => { const t = cm / (KN.stang.y - G.stang.y); return Object.fromEntries(IDS.map((id) => [id, { x: G[id].x + t * (KN[id].x - G[id].x), y: G[id].y + t * (KN[id].y - G[id].y) }])) }
const L1 = []
for (let cm = 12; cm <= 20; cm += 0.5) for (const nav of [false, true]) { const b = foto(dlVed(cm), 'doedloeft', 75, { nav }); const g = node(klikKun(b), 'dl-gulv', Idl); L1.push({ cm, nav, status: g.status }) }
const l1Fund = L1.filter((x) => x.status === 'ligner')
console.log('L1 i node (uden klikfejl):', l1Fund.map((x) => `${x.cm}${x.nav ? 'n' : ''}`).join(' '))
const L1CM = l1Fund.length ? l1Fund[0].cm : 17

// L2: squattens bund, knaeene 30 grader ud om linjen hofte-ankel (178/85).
const Isq = ind('squat', 178, 85)
const SB = modelFase('squat-bund', Isq).punkter
function knaeUd(P, grader) {
  const d = DYBDE.squat, A = { x: P.ankel.x, y: P.ankel.y, z: d.ankel }, H = { x: P.hofte.x, y: P.hofte.y, z: d.hofte }, K = { x: P.knae.x, y: P.knae.y, z: d.knae }
  const k = norm(sub(H, A)), t = (grader * Math.PI) / 180, v = sub(K, A)
  const drej = (s) => add(A, add(add(mul(v, Math.cos(s)), mul(cross(k, v), Math.sin(s))), mul(k, dot(k, v) * (1 - Math.cos(s)))))
  const a = drej(t), b = drej(-t)
  return a.z < b.z ? a : b
}
// L3: high bar, skinnebenet 6 grader frem om anklen (laar og torso uaendret).
function haelVip(P, a) {
  const t = (-a * Math.PI) / 180, v = { x: P.knae.x - P.ankel.x, y: P.knae.y - P.ankel.y }
  const knae = { x: P.ankel.x + v.x * Math.cos(t) - v.y * Math.sin(t), y: P.ankel.y + v.x * Math.sin(t) + v.y * Math.cos(t) }
  const dx = knae.x - P.knae.x, dy = knae.y - P.knae.y, f = (p) => ({ x: p.x + dx, y: p.y + dy })
  return { ...P, knae, hofte: f(P.hofte), skulder: f(P.skulder), stang: f(P.stang) }
}
const HB = modelFase('squat-bund', { ...Isq, stang: 'highbar' }).punkter

const browser = await chromium.launch({ headless: true })
async function tegn(P, tekst) {
  const page = await browser.newPage()
  const url = await page.evaluate(([P, tekst]) => {
    const k = document.createElement('canvas'); k.width = 900; k.height = 1200
    const x = k.getContext('2d')
    x.fillStyle = '#30343a'; x.fillRect(0, 0, 900, 1200); x.fillStyle = '#4a4238'; x.fillRect(0, P.midtfod.y, 900, 1200 - P.midtfod.y)
    x.lineCap = 'round'; x.strokeStyle = '#d8c8b0'; x.lineWidth = 12
    const l = (...ids) => { x.beginPath(); ids.forEach((id, i) => { const p = P[id]; i ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y) }); x.stroke() }
    l('ankel', 'knae', 'hofte', 'skulder'); x.lineWidth = 8; l('skulder', 'stang')
    const r = Math.hypot(P.skalaA.x - P.stang.x, P.skalaA.y - P.stang.y)
    for (const id of ['stangFjern', 'stang']) { if (!P[id]) continue; x.strokeStyle = id === 'stang' ? '#8a2a22' : '#5c1f1a'; x.lineWidth = 14; x.beginPath(); x.arc(P[id].x, P[id].y, r - 8, 0, 7); x.stroke() }
    x.fillStyle = '#fff'; x.font = '600 34px system-ui'; x.fillText('SYNTETISK', 24, 52); x.font = '22px system-ui'; x.fillText(tekst, 24, 84)
    return k.toDataURL('image/png')
  }, [P, tekst])
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
  await page.goto(SIDE)
  await page.waitForSelector('[data-klar]')
  return { ctx, page, net, fejl }
}
const vent = (S) => S.page.evaluate(() => new Promise((ok) => requestAnimationFrame(() => setTimeout(ok, 300))))
async function maalFase(S, billede, navn, fase, klik, krop) {
  await S.page.evaluate(([k]) => window.maalBillede.saetKrop(k), [krop])
  await S.page.evaluate(([b, n]) => window.maalBillede.laesBillede(b, n), [billede, navn])
  await S.page.waitForFunction(() => window.maalBillede.tilstand().billede)
  await S.page.click(`[data-fase="${fase}"]`)
  await S.page.evaluate(([p]) => window.maalBillede.saetPunkter(p), [klik])
  await vent(S)
}
const LAES = () => {
  const b = document.querySelector('[data-ligner]')
  const r = b.getBoundingClientRect()
  const img = [...b.querySelectorAll('img')].map((i) => ({ src: i.getAttribute('src'), hentet: i.complete && i.naturalWidth > 0 }))
  // Hvad staar der paa skaermen mellem tabellen og foer/efter? (synlig tekst om "Ligner" eller at intet er tjekket)
  const synligt = [...document.querySelectorAll('.mb p, .mb h3')].filter((e) => e.offsetParent && /Ligner|ikke tjekket|usikker/i.test(e.textContent) && !e.closest('details, .mb-vejl')).map((e) => e.textContent.trim().slice(0, 160))
  return {
    status: b.dataset.status || null, fejl: b.dataset.fejl || null, vist: !b.hidden && r.height > 0,
    titel: b.querySelector('h3')?.textContent.trim() || null,
    saetning: b.querySelector('[data-lignersaetning]')?.textContent.trim() || null,
    graense: b.querySelector('[data-lignergraense]')?.textContent.trim() || null,
    hoejre: Math.round(r.right), img, synligt,
    side: document.documentElement.scrollWidth, klient: document.documentElement.clientWidth,
    lager: Object.keys(localStorage),
  }
}
const ud = { ref: SHA, L1node: L1, L1cm: L1CM, sider: {} }
const K178 = { hoejde: '178', vaegt: '85' }, K183 = { hoejde: '183', vaegt: '120' }
const MARC = pathToFileURL(`${LM}/outputs/videomaal/marc-doedloeft-270-start.png`).href

for (const bredde of [360, 390, 1280]) {
  const S = await aabn(bredde)
  const r = (ud.sider[bredde] = {})
  const skud = async (navn) => { await S.page.locator('[data-ligner]').scrollIntoViewIfNeeded().catch(() => {}); await S.page.locator('.mb').first().evaluate(() => {}); await S.page.screenshot({ path: path.join(HERE, `S-${bredde}-${navn}.png`) }) }

  // L1 uden og med det fjerne nav.
  for (const nav of [false, true]) {
    const b = foto(dlVed(L1CM), 'doedloeft', 75, { nav })
    await maalFase(S, await tegn(b, `doedloeft, stangen ${L1CM} cm over gulvet, modellens egen bane`), `l1-${nav}.png`, 'dl-gulv', klikKun(b), K178)
    r[`l1-${nav ? 'nav' : 'udenNav'}`] = await S.page.evaluate(LAES)
    if (bredde !== 1280 && !nav) await skud('l1-hoften-foerst')
  }
  // Kontrol: modellens egen stilling ved gulvet (0 cm).
  { const b = foto(dlVed(0), 'doedloeft', 75); await maalFase(S, await tegn(b, 'doedloeft ved gulvet, modellen'), 'dl0.png', 'dl-gulv', klikKun(b), K178); r['dl-0'] = await S.page.evaluate(LAES) }
  // L2
  { const b = foto(SB, 'squat', 80, { knae3: knaeUd(SB, 30) }); await maalFase(S, await tegn(b, 'squat bund, knaeene 30 grader ud'), 'l2.png', 'squat-bund', klikKun(b), K178); r.l2 = await S.page.evaluate(LAES); if (bredde === 390) { await S.page.locator('[data-sammenligning]').scrollIntoViewIfNeeded(); await S.page.screenshot({ path: path.join(HERE, `S-390-l2-intet.png`) }) } }
  // L3
  { const b = foto(haelVip(HB, 6), 'squat', 80); await maalFase(S, await tegn(b, 'squat bund, high bar, skinnebenet 6 grader frem'), 'l3.png', 'squat-bund', klikKun(b), K178); r.l3 = await S.page.evaluate(LAES); if (bredde !== 1280) await skud('l3-kun-knaeene') }
  // V: en rigtig fejlfigur (Yantras hoften tilbage i bunden, 178 cm) med samme kamera.
  {
    const FM = await imp('src/fejlgenkendelseMaaling.js')
    const P = FM.kropsBilleder({ h: 178, v: 85, pct: {} }).fejl['sq-hofte-tilbage-bund'][0].P
    const b = foto(P, 'squat', 80)
    await maalFase(S, await tegn(b, 'squat bund, hoften skudt tilbage (fejlfiguren)'), 'v.png', 'squat-bund', klikKun(b), K178)
    r.v = await S.page.evaluate(LAES)
    if (bredde !== 1280) await skud('v-hofte-tilbage')
  }
  // M: Marcs gulvbillede, Yantras og mine klik (183/120).
  for (const [n, k] of [['marc-yantra', MARC_GULV], ['marc-bhishak', MINE_GULV]]) { await maalFase(S, MARC, 'marc-start.png', 'dl-gulv', k, K183); r[n] = await S.page.evaluate(LAES) }
  r.net = S.net; r.jsFejl = S.fejl
  await S.ctx.close()
}
await browser.close()

const B = [360, 390, 1280], sd = ud.sider
paastaa(`L1: modellens egen bane ${L1CM} cm over gulvet giver "Ligner: hoften stiger foerst" paa siden uden det fjerne nav (360, 390, 1280)`, B.every((w) => sd[w]['l1-udenNav'].fejl === 'dl-hofte-foerst'), B.map((w) => sd[w]['l1-udenNav'].titel))
paastaa('L1: ogsaa med det fjerne nav klikket (fasevagten bruger det naere nav)', B.every((w) => sd[w]['l1-nav'].fejl === 'dl-hofte-foerst'), B.map((w) => sd[w]['l1-nav'].status))
paastaa('L1 kontrol: modellens egen stilling ved gulvet giver intet', B.every((w) => sd[w]['dl-0'].status === 'ingen' && !sd[w]['dl-0'].vist))
paastaa('L2: squattens bund med knaeene 30 grader ud: status usikker-fase, og intet paa skaermen siger det', B.every((w) => sd[w].l2.status === 'usikker-fase' && !sd[w].l2.vist && sd[w].l2.synligt.length === 0), B.map((w) => [sd[w].l2.status, sd[w].l2.synligt]))
paastaa('L3: high bar og skinnebenet 6 grader frem giver "Ligner: kun knaeene" med "dér letter hælen" i saetningen og hael-graensen under', B.every((w) => sd[w].l3.fejl === 'sq-kun-knae-bund' && /letter hælen/.test(sd[w].l3.saetning) && /sko med hæl/.test(sd[w].l3.graense)), sd[390].l3.saetning)
paastaa('V: fejlfiguren "hoften skudt tilbage" giver boksen, figuren er hentet, og boksen er inden for skaermen', B.every((w) => sd[w].v.fejl === 'sq-hofte-tilbage-bund' && sd[w].v.img.every((i) => i.hentet) && sd[w].v.hoejre <= w), B.map((w) => [sd[w].v.hoejre, sd[w].v.img]))
paastaa('M: Marcs gulvbillede (Yantras og mine klik) giver intet "Ligner"', B.every((w) => !sd[w]['marc-yantra'].vist && !sd[w]['marc-bhishak'].vist && sd[w]['marc-yantra'].status === 'ingen' && sd[w]['marc-bhishak'].status === 'ingen'))
paastaa('Ingen vandret rulning i nogen af tilfaeldene', B.every((w) => Object.entries(sd[w]).filter(([k]) => !/net|jsFejl/.test(k)).every(([, x]) => x.side <= w)))
paastaa('Intet net, ingen JS-fejl, intet gemt', B.every((w) => sd[w].net.length === 0 && sd[w].jsFejl.length === 0 && Object.entries(sd[w]).filter(([k]) => !/net|jsFejl/.test(k)).every(([, x]) => x.lager.length === 0)), B.map((w) => [sd[w].net, sd[w].jsFejl]))
ud.tjek = tjek
writeFileSync(path.join(HERE, 'side-536.json'), JSON.stringify(ud, null, 1))
const nej = tjek.filter((t) => !t.ok).length
console.log(`${tjek.length - nej}/${tjek.length} tjek groenne (dhruva ${SHA})`)
if (nej) process.exitCode = 1
