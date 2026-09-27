// Kritik 548, blok 1: "Ligner" og den stille linje paa selve siden (dist/maal-billede,
// entropi-loeftmodel-dhruva main) headless uden net paa 360 og 390 med touch og 1280 med mus.
//   node outputs/kritik-548/side-548.mjs
// Som side-536.mjs: TEGNEDE, SYNTETISKE figurer fotograferet med mit pinhole-kamera og Marcs eget
// gulvbillede fra 462 (Yantras 498-klik og mine 494-klik; kun udsnit af boksen). Kroppen er sidens
// hoejdefelt (178 cm, 85 kg) for de tegnede figurer og 183/120 for Marcs klip. Skriver side-548.json
// og S-*.png.
//
//   L1  doedloeftets egen bane 16,5 cm over gulvet: intet "Ligner", men en linje om hvorfor
//   L2  squattens bund med knaeene 30 grader ud: linjen "kan ikke tjekkes ... (taeerne ud ...)"
//   L3  high bar og skinnebenet 6 grader frem: feltet paa 0 og paa 2
//   L4  saetningen uden Min krop: "gennemsnittet for din hoejde"
//   L6  "kun knaeene" i sko med 2 cm hael og feltet paa 2: linjen "Ligner ingen ..."
//   L7  kameraet 50 cm forskudt uden at dreje: hintet "Filmet mere end 5 grader skraat"
//   L9  fladt fodtoej i billedet, feltet paa 2: "Ligner: hoften skudt for langt tilbage"?
//   M   Marcs gulvbillede
import path from 'node:path'
import { tmpdir } from 'node:os'
import { writeFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { chromium } from '../../e2e/harness.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DHRUVA = 'C:/Users/Entropi/Desktop/entropi-loeftmodel-dhruva'
const SHA = execSync(`git -C ${DHRUVA} rev-parse --short ${process.argv[2] || 'main'}`).toString().trim()
const LM = path.join(tmpdir(), `kritik-548-loeftmodel-${SHA}`)
if (!existsSync(path.join(LM, 'dist', 'maal-billede', 'index.html'))) execSync(`node ${path.join(HERE, 'fejl-548.mjs')} ${SHA}`)
const imp = (f) => import(pathToFileURL(path.join(LM, f)).href)
const { maal, skalaFraKrop, knaeFaseTjek } = await imp('src/maalBillede.js')
const { modelFase } = await imp('src/maalBilledeModel.js')
const { indstilling } = await imp('src/minKrop.js')
const { genkendFejl } = await imp('src/maalBilledeFejl.js')
const FM = await imp('src/fejlgenkendelseMaaling.js')
const { MARC_GULV } = await imp('scripts/ordre-507-skaermbilleder.mjs')
const SIDE = pathToFileURL(`${LM}/dist/maal-billede/index.html`).href
const IDS = ['stang', 'midtfod', 'ankel', 'knae', 'hofte', 'skulder']
const MINE_GULV = { stang: { x: 441, y: 828 }, midtfod: { x: 430, y: 948 }, ankel: { x: 400, y: 905 }, knae: { x: 447, y: 668 }, hofte: { x: 343, y: 583 }, skulder: { x: 470, y: 460 } }

const tjek = []
const paastaa = (hvad, ok, data) => { tjek.push({ hvad, ok: !!ok, data }); console.log(`${ok ? 'ok ' : 'NEJ'} ${hvad}${data !== undefined ? ' ' + JSON.stringify(data).slice(0, 400) : ''}`) }

// --- pinhole ---------------------------------------------------------------------
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }), dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x })
const norm = (a) => { const n = Math.sqrt(dot(a, a)); return { x: a.x / n, y: a.y / n, z: a.z / n } }
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }), mul = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s })
// Kameraet 3 m ude, i hoejden h, ud for x = cx; `skraa` drejer det om stangens punkt, `forskudt` flytter det uden at dreje.
function kamera(cx, h, { skraa = 0, forskudt = 0 } = {}) {
  const s = (skraa * Math.PI) / 180
  const C = { x: cx + 300 * Math.sin(s) - forskudt, y: h, z: -300 * Math.cos(s) }
  const T = { x: cx - forskudt * (skraa ? 0 : 1), y: h, z: 0 }
  const f = norm(sub(T, C)), r = norm(cross({ x: 0, y: 1, z: 0 }, f)), u = cross(f, r)
  return (P) => { const d = sub(P, C), z = dot(d, f); return { x: (1000 * dot(d, r)) / z, y: (-1000 * dot(d, u)) / z } }
}
const DYBDE = { squat: { stang: -70, midtfod: -15, ankel: -16, knae: -18, hofte: -18, skulder: -20 }, doedloeft: { stang: -75, midtfod: -12, ankel: -14, knae: -13, hofte: -18, skulder: -20 } }
function foto(P, loeft, h, { nav = true, knae3 = null, skraa = 0, forskudt = 0 } = {}) {
  const d = DYBDE[loeft], k = kamera(P.stang.x, h, { skraa, forskudt })
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

const Idl = ind('doedloeft', 178, 85)
const G = modelFase('dl-gulv', Idl).punkter, KN = modelFase('dl-knae', Idl).punkter
const dlVed = (cm) => { const t = cm / (KN.stang.y - G.stang.y); return Object.fromEntries(IDS.map((id) => [id, { x: G[id].x + t * (KN[id].x - G[id].x), y: G[id].y + t * (KN[id].y - G[id].y) }])) }
const Isq = ind('squat', 178, 85)
const SB = modelFase('squat-bund', Isq).punkter
function knaeUd(P, grader) {
  const d = DYBDE.squat, A = { x: P.ankel.x, y: P.ankel.y, z: d.ankel }, H = { x: P.hofte.x, y: P.hofte.y, z: d.hofte }, K = { x: P.knae.x, y: P.knae.y, z: d.knae }
  const k = norm(sub(H, A)), t = (grader * Math.PI) / 180, v = sub(K, A)
  const drej = (s) => add(A, add(add(mul(v, Math.cos(s)), mul(cross(k, v), Math.sin(s))), mul(k, dot(k, v) * (1 - Math.cos(s)))))
  const a = drej(t), b = drej(-t)
  return a.z < b.z ? a : b
}
function haelVip(P, a) {
  const t = (-a * Math.PI) / 180, v = { x: P.knae.x - P.ankel.x, y: P.knae.y - P.ankel.y }
  const knae = { x: P.ankel.x + v.x * Math.cos(t) - v.y * Math.sin(t), y: P.ankel.y + v.x * Math.sin(t) + v.y * Math.cos(t) }
  const dx = knae.x - P.knae.x, dy = knae.y - P.knae.y, f = (p) => ({ x: p.x + dx, y: p.y + dy })
  return { ...P, knae, hofte: f(P.hofte), skulder: f(P.skulder), stang: f(P.stang) }
}
const HB = modelFase('squat-bund', { ...Isq, stang: 'highbar' }).punkter
// Sko med 2 cm hael: modellens bund og "kun knaeene"-figuren (178 cm) med samme hael.
const S2 = FM.squatBilleder(Isq, undefined, { haele: 2 })
const KK2 = S2.fejl['sq-kun-knae-bund'][0].P
const S3 = FM.squatBilleder(Isq, undefined, { haele: 3 })
// L9: fladt fodtoej i billedet (modellens egen bund); feltet siger 2 og 3 cm. Hvilken giver "Ligner" uden klikfejl?
const L9node = [2, 2.5, 3].map((hc) => { const b = foto(SB, 'squat', 80); const g = node(klikKun(b), 'squat-bund', { ...Isq, haele: hc }); return { hc, status: g.status, fejl: g.regel?.id } })
console.log('L9 i node:', JSON.stringify(L9node))
const L9HC = (L9node.find((x) => x.fejl === 'sq-hofte-tilbage-bund' && x.status === 'ligner') || { hc: 3 }).hc

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
async function maalFase(S, billede, navn, fase, klik, krop, haele = 0) {
  await S.page.evaluate(([k]) => window.maalBillede.saetKrop(k), [krop])
  await S.page.evaluate(([b, n]) => window.maalBillede.laesBillede(b, n), [billede, navn])
  await S.page.waitForFunction(() => window.maalBillede.tilstand().billede)
  await S.page.click(`[data-fase="${fase}"]`)
  await S.page.evaluate(([h]) => window.maalBillede.saetHaele(h), [haele])
  await S.page.evaluate(([p]) => window.maalBillede.saetPunkter(p), [klik])
  await vent(S)
}
const LAES = () => {
  const b = document.querySelector('[data-ligner]')
  const r = b.getBoundingClientRect()
  const img = [...b.querySelectorAll('img')].map((i) => ({ src: i.getAttribute('src'), hentet: i.complete && i.naturalWidth > 0 }))
  const stille = b.querySelector('[data-lignerstille]')
  const hint = document.querySelector('[data-skraahint]')
  const haeleTekst = document.querySelector('[data-haeletekst]')
  return {
    status: b.dataset.status || null, fejl: b.dataset.fejl || null, vist: !b.hidden && r.height > 0,
    titel: b.querySelector('h3')?.textContent.trim() || null,
    saetning: b.querySelector('[data-lignersaetning]')?.textContent.trim() || null,
    graense: b.querySelector('[data-lignergraense]')?.textContent.trim() || null,
    linje: stille ? stille.textContent.trim() : null,
    linjePx: stille ? parseFloat(getComputedStyle(stille).fontSize) : null,
    hint: hint && !hint.hidden ? hint.textContent.trim() : null, hintGrader: hint?.dataset.grader || null,
    haeleTekst: haeleTekst && !haeleTekst.hidden ? haeleTekst.textContent.trim() : null,
    hoejre: Math.round(r.right), img,
    side: document.documentElement.scrollWidth, klient: document.documentElement.clientWidth,
    lager: Object.keys(localStorage),
  }
}
const ud = { ref: SHA, L9node, L9HC, sider: {} }
const K178 = { hoejde: '178', vaegt: '85' }, K183 = { hoejde: '183', vaegt: '120' }
const MARC = pathToFileURL(`${LM}/outputs/videomaal/marc-doedloeft-270-start.png`).href

for (const bredde of [360, 390, 1280]) {
  const S = await aabn(bredde)
  const r = (ud.sider[bredde] = {})
  const skud = async (navn) => { await S.page.locator('[data-ligner]').scrollIntoViewIfNeeded().catch(() => {}); await S.page.screenshot({ path: path.join(HERE, `S-${bredde}-${navn}.png`) }) }
  const mobil = bredde !== 1280

  // L1: 16,5 cm over gulvet, med og uden det fjerne nav.
  for (const nav of [true, false]) {
    const b = foto(dlVed(16.5), 'doedloeft', 75, { nav })
    await maalFase(S, await tegn(b, 'doedloeft, stangen 16,5 cm over gulvet, modellens egen bane'), `l1-${nav}.png`, 'dl-gulv', klikKun(b), K178)
    r[`l1-${nav ? 'nav' : 'udenNav'}`] = await S.page.evaluate(LAES)
    if (mobil && nav) await skud('l1-for-hoejt')
  }
  { const b = foto(dlVed(0), 'doedloeft', 75); await maalFase(S, await tegn(b, 'doedloeft ved gulvet, modellen'), 'dl0.png', 'dl-gulv', klikKun(b), K178); r['dl-0'] = await S.page.evaluate(LAES) }
  // L2
  { const b = foto(SB, 'squat', 80, { knae3: knaeUd(SB, 30) }); await maalFase(S, await tegn(b, 'squat bund, knaeene 30 grader ud'), 'l2.png', 'squat-bund', klikKun(b), K178); r.l2 = await S.page.evaluate(LAES); if (mobil) await skud('l2-linje') }
  // L3: high bar og skinnebenet 6 grader frem, feltet paa 0 og 2.
  for (const felt of [0, 2]) { const b = foto(haelVip(HB, 6), 'squat', 80); await maalFase(S, await tegn(b, 'squat bund, high bar, skinnebenet 6 grader frem'), `l3-${felt}.png`, 'squat-bund', klikKun(b), K178, felt); r[`l3-${felt}`] = await S.page.evaluate(LAES); if (mobil && felt === 0) await skud('l3-hael-0') }
  // L4: fejlfiguren "hoften tilbage" i bunden uden Min krop.
  {
    const P = FM.kropsBilleder({ h: 178, v: 85, pct: {} }).fejl['sq-hofte-tilbage-bund'][0].P
    const b = foto(P, 'squat', 80)
    await maalFase(S, await tegn(b, 'squat bund, hoften skudt tilbage (fejlfiguren)'), 'v.png', 'squat-bund', klikKun(b), K178)
    r.l4 = await S.page.evaluate(LAES)
  }
  // L6: "kun knaeene" i sko med 2 cm hael, feltet paa 2; og modellens egen bund med 2 cm hael, feltet paa 0 og 2.
  { const b = foto(KK2, 'squat', 80); await maalFase(S, await tegn(b, 'squat bund, 2 cm hael, KUN KNAEENE (fejlfiguren)'), 'l6.png', 'squat-bund', klikKun(b), K178, 2); r.l6 = await S.page.evaluate(LAES); if (mobil) await skud('l6-ligner-ingen') }
  for (const felt of [0, 3]) { const b = foto(S3.normal['squat-bund'][0].P, 'squat', 80); await maalFase(S, await tegn(b, 'squat bund, 3 cm hael, modellen'), `h3-${felt}.png`, 'squat-bund', klikKun(b), K178, felt); r[`hael3-felt${felt}`] = await S.page.evaluate(LAES) }
  // L7: kameraet 50 cm forskudt uden at dreje, og 10 grader drejet.
  { const b = foto(SB, 'squat', 80, { forskudt: 50 }); await maalFase(S, await tegn(b, 'squat bund, kameraet 50 cm forskudt, ikke drejet'), 'l7.png', 'squat-bund', klikKun(b), K178); r.l7 = await S.page.evaluate(LAES); if (mobil) { await S.page.locator('[data-skraahint]').scrollIntoViewIfNeeded(); await S.page.screenshot({ path: path.join(HERE, `S-${bredde}-l7-forskudt-hint.png`) }) } }
  { const b = foto(SB, 'squat', 80, { skraa: 10 }); await maalFase(S, await tegn(b, 'squat bund, kameraet 10 grader skraat'), 'k10.png', 'squat-bund', klikKun(b), K178); r.skraa10 = await S.page.evaluate(LAES) }
  // L9: fladt fodtoej i billedet, feltet paa L9HC.
  { const b = foto(SB, 'squat', 80); await maalFase(S, await tegn(b, 'squat bund, fladt fodtoej, modellen'), 'l9.png', 'squat-bund', klikKun(b), K178, L9HC); r.l9 = await S.page.evaluate(LAES); if (mobil) await skud('l9-hofte-tilbage') }
  // M: Marcs gulvbillede.
  for (const [n, k] of [['marc-yantra', MARC_GULV], ['marc-bhishak', MINE_GULV]]) { await maalFase(S, MARC, 'marc-start.png', 'dl-gulv', k, K183); r[n] = await S.page.evaluate(LAES) }
  r.net = S.net; r.jsFejl = S.fejl
  await S.ctx.close()
}
await browser.close()

const B = [360, 390, 1280], sd = ud.sider
const alle = (f) => B.every((w) => f(sd[w], w))
paastaa('L1 lukket: modellens bane 16,5 cm oppe med det fjerne nav giver intet "Ligner", men "kan ikke tjekkes ... stangen står for højt"', alle((s) => s['l1-nav'].status !== 'ligner' && /stangen står for højt/.test(s['l1-nav'].linje || '')), sd[390]['l1-nav'].linje)
paastaa('L1: uden det fjerne nav "kræver det fjerne nav"', alle((s) => /kræver det fjerne nav/.test(s['l1-udenNav'].linje || '')), sd[390]['l1-udenNav'].linje)
paastaa('L1 kontrol: modellens egen stilling ved gulvet giver "Ligner ingen ..."', alle((s) => s['dl-0'].status === 'ingen' && /^Ligner ingen/.test(s['dl-0'].linje || '')), sd[390]['dl-0'].linje)
paastaa('L2 lukket: knaeene 30 grader ud giver en synlig linje med grunden og taeerne', alle((s) => s.l2.vist && /kan ikke tjekkes/.test(s.l2.linje || '') && /tæerne ud/.test(s.l2.linje || '')), sd[390].l2.linje)
paastaa('L3 aaben: high bar + 6 grader, feltet paa 0: "Ligner: kun knaeene" med "dér letter hælen"', alle((s) => s['l3-0'].fejl === 'sq-kun-knae-bund' && /letter hælen/.test(s['l3-0'].saetning || '')), sd[390]['l3-0'].saetning)
paastaa('L3: feltet paa 2 cm fjerner det', alle((s) => s['l3-2'].status !== 'ligner'), B.map((w) => sd[w]['l3-2'].status))
paastaa('L4 lukket: uden Min krop siger saetningen "gennemsnittet for din højde"', alle((s) => s.l4.fejl === 'sq-hofte-tilbage-bund' && /gennemsnittet for din højde/.test(s.l4.saetning || '')), sd[390].l4.saetning)
paastaa('L5 lukket: graensen naevner telefonen i haanden', alle((s) => /i hånden/.test(s.l4.graense || '')))
paastaa('L6: fejlfiguren "kun knaeene" i sko med 2 cm hael og feltet paa 2 faar "Ligner ingen af modellens fejlfigurer over målefejlen."', alle((s) => s.l6.status === 'ingen' && /^Ligner ingen af modellens fejlfigurer/.test(s.l6.linje || '')), sd[390].l6.linje)
paastaa('Hael: modellens bund i 3 cm hael, feltet paa 0 = "Ligner: kun knaeene", feltet paa 3 = "Ligner ingen"', alle((s) => s['hael3-felt0'].fejl === 'sq-kun-knae-bund' && s['hael3-felt3'].status === 'ingen'), B.map((w) => [sd[w]['hael3-felt0'].status, sd[w]['hael3-felt3'].status]))
paastaa('L7: kameraet 50 cm forskudt uden at dreje giver hintet "Filmet mere end 5° skråt"', alle((s) => /Filmet mere end 5° skråt/.test(s.l7.hint || '')), [sd[390].l7.hintGrader, sd[390].l7.hint])
paastaa('Hintet ved 10 grader drejet skoenner under 10', alle((s) => s.skraa10.hint && Number(s.skraa10.hintGrader) < 10), B.map((w) => sd[w].skraa10.hintGrader))
paastaa(`L9: fladt fodtoej i billedet og feltet paa ${L9HC} cm giver "Ligner: hoften skudt for langt tilbage"`, alle((s) => s.l9.fejl === 'sq-hofte-tilbage-bund'), [sd[390].l9.status, sd[390].l9.saetning])
paastaa('M: Marcs gulvbillede: "kan ikke tjekkes ... kræver det fjerne nav" med begge klik', alle((s) => /kræver det fjerne nav/.test(s['marc-yantra'].linje || '') && /kræver det fjerne nav/.test(s['marc-bhishak'].linje || '')))
paastaa('Linjen og boksen inden for skaermen, ingen vandret rulning', alle((s, w) => Object.entries(s).filter(([k]) => !/net|jsFejl/.test(k)).every(([, x]) => x.side <= w && (!x.vist || x.hoejre <= w))))
paastaa('Intet net, ingen JS-fejl, intet gemt', alle((s) => s.net.length === 0 && s.jsFejl.length === 0 && Object.entries(s).filter(([k]) => !/net|jsFejl/.test(k)).every(([, x]) => x.lager.length === 0)), B.map((w) => [sd[w].net, sd[w].jsFejl]))
ud.tjek = tjek
writeFileSync(path.join(HERE, 'side-548.json'), JSON.stringify(ud, null, 1))
const nej = tjek.filter((t) => !t.ok).length
console.log(`${tjek.length - nej}/${tjek.length} tjek groenne (dhruva ${SHA})`)
if (nej) process.exitCode = 1
