// Kritik 582, blok 2: videoen i "Maal dit billede" efter Yantras 571 (entropi-loeftmodel-dhruva main, hentet med
// git archive; intet trae roeres), med MINE syntetiske H.264 MP4/MOV-klip fra klip-582.mjs. Yantras punkter
// under "Bhishak boer tjekke" i dag 84:
//   A) trinene i H.264 MP4 og MOV i 29,97 og variabel billedrate: gaar et tryk praecis eet billede?
//      390 med touch og 1280 med mus; 24 tryk frem fra 0, 8 frem og 6 tilbage fra skyderen (over et tabt
//      billede og i stykket i 24/s), tiden under videoen, og fotoet fra "Brug dette billede".
//   B) "Hop til laveste punkt" med to buer paa mine fem squats, med mine klikhoejder, i browseren (390 touch
//      og 1280 mus), og regnet (sidens egen lavestePunkt) for en traener, der foelger teksten.
//   C) de foerste tryk paa en telefon: 390 med 4 gange langsommere CPU (Chromes CPU-bremse).
//   D) 4K (H.264 2160 x 3840): aabning, linjen i videoboksen, trin, fotoet, hukommelse; med og uden bremse.
//   E) HEVC i en MOV (iPhones standard) i samme browser.
// Browseren er Google Chrome (headless, den installerede, som en coach har den), ikke Playwrights Chromium-build:
// Chromium-buildet kan ikke vise alle billeder i en H.264 med B-billeder og variabel billedrate (F, maalt og
// sammenlignet her). Kun headless paa Windows, ingen OS-mus, intet net (alt andet end file/data/blob afvises og taelles).
//   node outputs/kritik-582/video-582.mjs     -> video-582.json og V-*.png
import path from 'node:path'
import { tmpdir } from 'node:os'
import { writeFileSync, mkdtempSync, mkdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { chromium } from '../../e2e/harness.mjs'
import { lavKlip, REPS, DYBDE, NAV_X, navY, bund, BITS } from './klip-582.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DHRUVA = 'C:/Users/Entropi/Desktop/entropi-loeftmodel-dhruva'
const SHA = execSync(`git -C ${DHRUVA} rev-parse --short main`).toString().trim()
const LM = mkdtempSync(path.join(tmpdir(), 'k582-lm-'))
execSync(`git -C ${DHRUVA} archive main src dist/maal-billede package.json | tar -x -C "${LM.replace(/\\/g, '/')}"`, { shell: 'bash' })
const { lavestePunkt, tidTekst } = await import(pathToFileURL(path.join(LM, 'src/maalVideo.js')).href)
const SIDE = pathToFileURL(`${LM}/dist/maal-billede/index.html`).href
const { filer: KLIP, info: KLIPINFO } = await lavKlip()
const TIDER = Object.fromEntries(Object.entries(KLIPINFO).map(([k, v]) => [k, v.tider]))

const tjek = []
const paastaa = (hvad, ok, data) => { tjek.push({ hvad, ok: !!ok, data }); console.log(`${ok ? 'ok ' : 'NEJ'} ${hvad}${data !== undefined ? ' ' + JSON.stringify(data).slice(0, 700) : ''}`) }
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : null }
const kvantil = (a, p) => [...a].sort((x, y) => x - y)[Math.floor(p * (a.length - 1))]
const r1 = (x) => Math.round(x * 10) / 10
/** Det billede, der vises til tiden t (s): det sidste, der starter ved eller foer t. */
const billedeTil = (tider, t) => { let k = 0; while (k + 1 < tider.length && tider[k + 1] <= t * 1e6 + 0.5) k++; return k }
const naermest = (tider, t) => tider.reduce((b, x, i) => (Math.abs(x / 1e6 - t) < Math.abs(tider[b] / 1e6 - t) ? i : b), 0)

// --- i siden -------------------------------------------------------------------------------------
// Hvert tryk paa frem/tilbage/hop/brug maales i siden: fra pointerdown til siden har vist det nye billede
// (en faerdig handling mere, koeen tom, ingen soegning i gang), polled hvert skaermbillede (rAF).
const INIT = () => {
  window.__maal = null
  window.__net = 0
  addEventListener('pointerdown', (e) => {
    if (!e.target?.closest?.('[data-frem],[data-tilbage],[data-hop],[data-brug]') || !window.maalBillede) return
    const f0 = window.maalBillede.billedInfo().faerdige, b0 = window.maalBillede.tilstand().billede
    const m = (window.__maal = { t0: performance.now(), t1: null, hvad: e.target.closest('[data-frem],[data-tilbage],[data-hop],[data-brug]').getAttributeNames().find((a) => a.startsWith('data-')) })
    const loop = () => {
      const i = window.maalBillede.billedInfo(), v = window.maalBillede.video
      const faerdig = m.hvad === 'data-brug' ? window.maalBillede.tilstand().billede && window.maalBillede.tilstand().billede !== b0 : i.faerdige > f0 && i.iKoe === 0 && !v.seeking
      if (faerdig) m.t1 = performance.now(); else requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
  }, true)
}
// Billedets nummer i de 12 blokke oeverst (paa videoen eller paa klik-trinnets foto).
const NUMMER = ([hvad, BITS]) => {
  const src = hvad === 'video' ? window.maalBillede.video : window.maalBillede.tilstand().billede
  if (!src) return null
  const w = src.videoWidth || src.naturalWidth || src.width, s = w / 1080
  const k = document.createElement('canvas'); k.width = w; k.height = Math.ceil(110 * s)
  const x = k.getContext('2d', { willReadFrequently: true }); x.drawImage(src, 0, 0)
  let n = 0
  for (let i = 0; i < BITS; i++) { const d = x.getImageData(Math.round((52 + i * 88) * s), Math.round(60 * s), 1, 1).data; if (d[0] > 128) n |= 1 << i }
  return n
}
const TEKST = () => {
  const q = (s) => document.querySelector(s)
  const vis = (s) => (q(s) && !q(s).hidden && !q(s).closest('[hidden]') ? q(s).textContent.replace(/\s+/g, ' ').trim() : '')
  return { tid: vis('[data-tid]'), trinnote: vis('[data-trinnote]'), videostor: vis('[data-videostor]'), navn: vis('[data-videonavn]'), liste: vis('[data-navklikliste]'), billedNavn: vis('[data-navn]') }
}

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const browser = await chromium.launch({ headless: true, executablePath: CHROME })
const chromeVersion = browser.version()
const bcdp = await browser.newBrowserCDPSession()
async function procesMB() {
  const { processInfo } = await bcdp.send('SystemInfo.getProcessInfo')
  const ids = processInfo.map((p) => p.id).filter(Boolean)
  const ud = execSync(`powershell -NoProfile -Command "Get-Process -Id ${ids.join(',')} -ErrorAction SilentlyContinue | Measure-Object -Property PrivateMemorySize64 -Sum | % Sum"`).toString().trim()
  return Math.round(Number(ud) / 1e6)
}
let NET = 0
async function aabn(bredde, { cpu = 1, b = browser } = {}) {
  const mobil = bredde < 500
  const ctx = await b.newContext({ viewport: { width: bredde, height: mobil ? 844 : 900 }, deviceScaleFactor: mobil ? 3 : 1, isMobile: mobil, hasTouch: mobil })
  const page = await ctx.newPage()
  await page.addInitScript(INIT)
  const S = { ctx, page, mobil, bredde, cpu, fejl: [] }
  page.on('pageerror', (e) => S.fejl.push(e.message))
  await page.route('**/*', (r) => (/^(file|data|blob):/.test(r.request().url()) ? r.continue() : (NET++, r.abort())))
  S.cdp = await ctx.newCDPSession(page)
  if (cpu > 1) await S.cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })
  await page.goto(SIDE)
  await page.waitForSelector('[data-klar]')
  await page.waitForTimeout(200)
  return S
}
const nummer = (S, hvad = 'video') => S.page.evaluate(NUMMER, [hvad, BITS])
const tekst = (S) => S.page.evaluate(TEKST)
const info = (S) => S.page.evaluate(() => ({ ...window.maalBillede.billedInfo(), gab: undefined, t: window.maalBillede.video.currentTime }))
const rolig = (S) => S.page.waitForFunction(() => { const i = window.maalBillede.billedInfo(); return i.iKoe === 0 && !window.maalBillede.video.seeking && i.pts !== null }, null, { timeout: 60000 })
async function tryk(S, sel) {
  const l = S.page.locator(sel).first()
  await l.scrollIntoViewIfNeeded()
  if (S.mobil) await l.tap(); else await l.click()
}
// Et tryk, der maales i siden (ms fra fingeren til det nye billede er vist), og billedets nummer bagefter.
async function maaltTryk(S, sel) {
  await S.page.evaluate(() => { window.__maal = null })
  await tryk(S, sel)
  await S.page.waitForFunction(() => window.__maal && window.__maal.t1 !== null, null, { timeout: 60000 })
  await S.page.evaluate(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))))
  const ms = await S.page.evaluate(() => Math.round(window.__maal.t1 - window.__maal.t0))
  return { ms, n: await nummer(S) }
}
async function vaelg(S, fil) {
  const t0 = Date.now()
  await S.page.setInputFiles('[data-videofil]', fil)
  const ok = await S.page.waitForFunction(() => { const v = window.maalBillede.video; return (v.readyState >= 2 && document.querySelector('[data-skyder]').max !== '0' && !v.seeking && window.maalBillede.billedInfo().pts !== null) || /kunne ikke læses/.test(document.querySelector('[data-videonavn]').textContent) }, null, { timeout: 60000 }).then(() => true, () => false)
  const ms = Date.now() - t0
  const v = await S.page.evaluate(() => ({ w: window.maalBillede.video.videoWidth, h: window.maalBillede.video.videoHeight, rs: window.maalBillede.video.readyState }))
  return { ms, ok: ok && v.rs >= 2 && v.w > 0, ...v, ...(await tekst(S)) }
}
async function saetTid(S, t) { await S.page.evaluate((t) => window.maalBillede.saetVideoTid(t), t); await rolig(S) }
// Tryk paa navet i videoen, hvor klippet tegnede det i det viste billede (videoens pixels -> skaermen, contain).
async function trykNav(S, yAndel) {
  await tryk(S, '[data-navklik]')
  const pos = () => S.page.evaluate(([NX]) => {
    const v = window.maalBillede.video, r = v.getBoundingClientRect(), d = Math.min(r.width / v.videoWidth, r.height / v.videoHeight)
    return { x: r.left + (r.width - v.videoWidth * d) / 2 + NX * v.videoWidth * d, top: r.top + (r.height - v.videoHeight * d) / 2, h: v.videoHeight * d, skaerm: innerHeight }
  }, [NAV_X])
  let p = await pos(), y = p.top + yAndel * p.h
  if (y < 10 || y > p.skaerm - 10) { await S.page.evaluate((dy) => window.scrollBy(0, dy), y - p.skaerm / 2); await S.page.waitForTimeout(80); p = await pos(); y = p.top + yAndel * p.h }
  if (S.mobil) await S.page.touchscreen.tap(p.x, y); else await S.page.mouse.click(p.x, y)
  await S.page.waitForTimeout(60)
}
const skud = async (S, navn, sel) => { if (sel) await S.page.locator(sel).first().scrollIntoViewIfNeeded().catch(() => {}); await S.page.screenshot({ path: path.join(HERE, `V-${S.bredde}${S.cpu > 1 ? 'x4' : ''}-${navn}.png`) }) }

const ud = { loeftmodel: SHA, klip: Object.fromEntries(Object.entries(KLIPINFO).map(([k, v]) => [k, { mb: v.mb, billeder: v.billeder, codec: v.codec, mellemrumUs: [Math.min(...v.tider.slice(1).map((x, i) => x - v.tider[i])), Math.max(...v.tider.slice(1).map((x, i) => x - v.tider[i]))] }])), reps: REPS.map((r) => ({ ...r, bund: bund(r) })), A: {}, B: {}, C: {}, D: {}, E: {} }

// --- A) trinene ------------------------------------------------------------------------------------
async function trin(S, klip) {
  const tider = TIDER[klip]
  const r = { aabn: await vaelg(S, KLIP[klip]) }
  r.foerste = await nummer(S)
  r.tilbageSlaaetFra = await S.page.evaluate(() => document.querySelector('[data-tilbage]').disabled)
  r.frem = []
  for (let i = 0; i < 24; i++) r.frem.push(await maaltTryk(S, '[data-frem]'))
  const k = r.frem[r.frem.length - 1].n
  r.tid = { vist: (await tekst(S)).tid, facit: tidTekst(tider[k] / 1e6) }
  // Fra skyderen: to steder midt i et billede (+3 ms). 290 (tabt billede mellem 296 og 297 i vfr) og 250 (24/s i vfr).
  r.skyder = []
  for (const k0 of [290, 250]) {
    const ts = (tider[k0] + tider[k0 + 1]) / 2e6 + 0.003
    await saetTid(S, ts)
    const start = await nummer(S)
    const frem = [], tilbage = []
    for (let i = 0; i < 8; i++) frem.push(await maaltTryk(S, '[data-frem]'))
    for (let i = 0; i < 6; i++) tilbage.push(await maaltTryk(S, '[data-tilbage]'))
    r.skyder.push({ k0, facitStart: billedeTil(tider, ts), start, frem: frem.map((x) => x.n), tilbage: tilbage.map((x) => x.n), ms: [...frem, ...tilbage].map((x) => x.ms), mellemrumMs: frem.map((x, i) => r1((tider[x.n] - tider[i ? frem[i - 1].n : start]) / 1000)) })
  }
  // Brug dette billede: fotoet er det viste billede.
  const vist = await nummer(S)
  const b = await maaltTryk(S, '[data-brug]')
  r.brug = { vist, foto: await nummer(S, 'foto'), ms: b.ms, navn: (await tekst(S)).billedNavn }
  await S.page.evaluate(() => window.scrollTo(0, 0))
  return r
}
const trinOk = (r) => r.aabn.ok && r.foerste === 0 && r.tilbageSlaaetFra && r.frem.map((x) => x.n).join() === Array.from({ length: 24 }, (_, i) => i + 1).join() && r.tid.vist === r.tid.facit &&
  r.skyder.every((s) => s.start === s.facitStart && s.frem.join() === Array.from({ length: 8 }, (_, i) => s.start + i + 1).join() && s.tilbage.join() === Array.from({ length: 6 }, (_, i) => s.start + 7 - i).join()) && r.brug.vist === r.brug.foto
for (const bredde of [390, 1280]) {
  for (const klip of ['sq2997.mp4', 'sq2997.mov', 'sqvfr.mp4', 'sqvfr.mov']) {
    const S = await aabn(bredde)
    const r = (ud.A[`${bredde} ${klip}`] = await trin(S, klip))
    r.fejl = S.fejl
    if (bredde === 390 && klip === 'sqvfr.mov') await skud(S, 'trin-vfr-mov', '[data-trinnote]')
    if (bredde === 1280 && klip === 'sq2997.mp4') await skud(S, 'trin-2997', '[data-videoboks]')
    const f = r.frem.map((x) => x.ms)
    paastaa(`A ${bredde} ${klip}: 24 tryk frem = billede 1-24, fra skyderen 8 frem og 6 tilbage (${r.skyder.map((s) => s.k0).join(' og ')}) eet billede pr. tryk, tiden er billedets egen, fotoet = det viste`, trinOk(r) && !S.fejl.length,
      { note: r.aabn.trinnote.slice(0, 60), frem: r.frem.map((x) => x.n).join(','), sky: r.skyder.map((s) => [s.start, s.facitStart, s.frem.join(','), s.tilbage.join(','), s.mellemrumMs.join('/')]), tid: r.tid, brug: r.brug, ms: { foerste3: f.slice(0, 3), median: median(f.slice(3)), maks: Math.max(...f.slice(3)) } })
    await S.ctx.close()
  }
}

// --- B) Hop til med to buer paa mine fem squats ------------------------------------------------------
// Klikhoejder som andel af dybden over bunden, paa vej ned (-1) og op (+1).
const SCENARIER = {
  'to klik 10 %': [[0.10, -1], [0.10, 1]],
  'tekstens raad: 10 % og 30 % paa hver side': [[0.30, -1], [0.10, -1], [0.10, 1], [0.30, 1]],
  'en traener: 3 % og 40 % ned, 8 % og 25 % op': [[0.40, -1], [0.03, -1], [0.08, 1], [0.25, 1]],
  'tre klik: 10 % ned, 10 % og 30 % op': [[0.10, -1], [0.10, 1], [0.30, 1]],
}
const tidVed = (r, h, side) => (side < 0 ? r.start + (r.ned * Math.asin(1 - h)) / (Math.PI / 2) : r.start + r.ned + r.pause + (r.op * Math.acos(1 - h)) / (Math.PI / 2))
function fejlBilleder(tider, r, n) {
  const b = bund(r), fra = naermest(tider, b.fra), til = naermest(tider, b.til)
  return n < fra ? n - fra : n > til ? n - til : 0
}
async function hop(S, klip, r, klik) {
  const tider = TIDER[klip]
  if (!(await S.page.locator('[data-glemnav]').isHidden())) await tryk(S, '[data-glemnav]')
  const klikket = []
  for (const [h, side] of klik) {
    const k = billedeTil(tider, tidVed(r, h, side))
    await saetTid(S, (tider[k] + tider[k + 1]) / 2e6)
    const vist = await nummer(S)
    await trykNav(S, navY(tider[vist] / 1e6))
    klikket.push(vist)
  }
  const maerker = await S.page.evaluate(() => window.maalBillede.navMaerker())
  const h = await maaltTryk(S, '[data-hop]')
  const metode = (await S.page.evaluate(() => window.maalBillede.hopTil()))?.metode
  return { klikket, maerker: maerker.length, n: h.n, fejl: fejlBilleder(tider, r, h.n), metode, ms: h.ms, liste: (await tekst(S)).liste.slice(0, 400) }
}
for (const [bredde, klip, scen] of [[390, 'sq2997.mp4', Object.keys(SCENARIER)], [390, 'sqvfr.mov', Object.keys(SCENARIER)], [1280, 'sq2997.mp4', ['tekstens raad: 10 % og 30 % paa hver side', 'to klik 10 %']]]) {
  const S = await aabn(bredde)
  await vaelg(S, KLIP[klip])
  await tryk(S, '[data-fase="squat-bund"]')
  const res = (ud.B[`${bredde} ${klip}`] = {})
  for (const sc of scen) {
    res[sc] = {}
    for (const r of REPS) res[sc][r.navn] = await hop(S, klip, r, SCENARIER[sc])
    if (bredde === 390 && klip === 'sq2997.mp4' && sc.startsWith('tekstens')) await skud(S, 'hop-to-buer', '[data-navklikliste]')
    if (bredde === 390 && klip === 'sq2997.mp4' && sc.startsWith('tre klik')) await skud(S, 'hop-tre-klik', '[data-navklikliste]')
  }
  const f = (sc) => Object.values(res[sc]).map((x) => x.fejl)
  const m = (sc) => Object.values(res[sc]).map((x) => x.metode)
  paastaa(`B ${bredde} ${klip}: alle klik landede (${Object.values(res).flatMap((x) => Object.values(x)).length} hop), to buer med tekstens raad i alle fem squats, og de rammer inden for 1 billede`, S.fejl.length === 0 && Object.values(res).every((x) => Object.values(x).every((y) => y.maerker === y.klikket.length)) && m('tekstens raad: 10 % og 30 % paa hver side').every((x) => x === 'to-buer') && f('tekstens raad: 10 % og 30 % paa hver side').every((x) => Math.abs(x) <= 1),
    Object.fromEntries(scen.map((sc) => [sc.slice(0, 20), REPS.map((r) => `${r.navn}:${res[sc][r.navn].fejl}/${res[sc][r.navn].metode}`).join(' ')])))
  await S.ctx.close()
}
const b390 = ud.B['390 sq2997.mp4']
const traener = Object.values(b390['en traener: 3 % og 40 % ned, 8 % og 25 % op'])
paastaa('B: med tekstens raad er to buer bedre end to klik i "hurtig op", "grind" og "dyk" (390, 29,97)', ['hurtig op', 'grind', 'dyk'].every((n) => Math.abs(b390['tekstens raad: 10 % og 30 % paa hver side'][n].fejl) < Math.abs(b390['to klik 10 %'][n].fejl)), REPS.map((r) => [r.navn, b390['to klik 10 %'][r.navn].fejl, b390['tekstens raad: 10 % og 30 % paa hver side'][r.navn].fejl]))
paastaa('B: tre klik siger "rammer ikke bedre end to klik" og beder om to paa hver side', /rammer ikke bedre end to klik/.test(b390['tre klik: 10 % ned, 10 % og 30 % op'].jaevn.liste) && /Klik to billeder på hver side af bunden, ét tæt på bunden og ét højere oppe/.test(b390['tre klik: 10 % ned, 10 % og 30 % op'].jaevn.liste), b390['tre klik: 10 % ned, 10 % og 30 % op'].jaevn.liste)
ud.B.traenerMetoder = traener.map((x) => x.metode)

// Regnet med sidens egen lavestePunkt: en traener, der foelger teksten ("et taet paa bunden og et hoejere oppe"),
// paa hver side: "taet paa" 2-12 %, "hoejere oppe" 15-50 %, klikstoej +-1 % og +-2 % af dybden (8 og 16 px i
// mit klip; en finger paa 390 er ca. 3 px paa skaermen = 9 videopixels). Og Yantras tilfaeldige 5-40 %.
{
  let s = 582
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647
  const tider = TIDER['sq2997.mp4']
  const sim = { }
  for (const [navn, lav, hoej, stoej] of [['tekst +-1 %', [0.02, 0.12], [0.15, 0.5], 0.01], ['tekst +-2 %', [0.02, 0.12], [0.15, 0.5], 0.02], ['tilfaeldig 5-40 % +-1 %', [0.05, 0.4], [0.05, 0.4], 0.01]]) {
    sim[navn] = {}
    for (const r of REPS) {
      const fejl = [], fejlTo = []
      let brugt = 0, forTaet = 0
      for (let n = 0; n < 500; n++) {
        const hs = [[lav, -1], [hoej, -1], [lav, 1], [hoej, 1]].map(([[a, b], side]) => [a + (b - a) * rnd(), side])
        const k = hs.map(([h, side]) => { const i = billedeTil(tider, tidVed(r, h, side)); const t = tider[i] / 1e6; return { t, y: (navY(t) + (rnd() - 0.5) * 2 * stoej * DYBDE) * 1920 } })
        const lp = lavestePunkt(k)
        const to = lavestePunkt([k[1], k[2]])
        fejlTo.push(Math.abs(fejlBilleder(tider, r, naermest(tider, to.t))))
        if (lp.metode !== 'to-buer') { if (lp.forTaet) forTaet++; continue }
        brugt++
        fejl.push(Math.abs(fejlBilleder(tider, r, naermest(tider, lp.t))))
      }
      sim[navn][r.navn] = { brugtPct: Math.round(brugt / 5), forTaetPct: Math.round(forTaet / 5), median: median(fejl), p90: kvantil(fejl, 0.9), maks: Math.max(...fejl), toKlikMedian: median(fejlTo), toKlikP90: kvantil(fejlTo, 0.9) }
    }
  }
  ud.B.regnet = sim
  const t1 = Object.values(sim['tekst +-1 %'])
  paastaa('B regnet: en traener, der foelger teksten (+-1 %), faar to buer i mindst 80 % af forsoegene i alle fem squats, median hoejst 1 billede', t1.every((x) => x.brugtPct >= 80 && x.median <= 1), Object.fromEntries(Object.entries(sim).map(([k, v]) => [k, Object.entries(v).map(([n, x]) => `${n}:${x.brugtPct}%/${x.median}/${x.p90}/${x.maks} (2 klik ${x.toKlikMedian}/${x.toKlikP90})`).join(' ')])))
}

// --- C) de foerste tryk paa en telefon, 4 gange langsommere CPU ---------------------------------------
for (const cpu of [1, 4]) {
  const S = await aabn(390, { cpu })
  const r = (ud.C[`390 x${cpu}`] = { aabn: await vaelg(S, KLIP['sq2997.mp4']) })
  r.frem = []
  for (let i = 0; i < 24; i++) r.frem.push(await maaltTryk(S, '[data-frem]'))
  r.tilbage = []
  for (let i = 0; i < 6; i++) r.tilbage.push(await maaltTryk(S, '[data-tilbage]'))
  await tryk(S, '[data-fase="squat-bund"]')
  r.hop = await hop(S, 'sq2997.mp4', REPS[1], SCENARIER['tekstens raad: 10 % og 30 % paa hver side'])
  r.brug = await maaltTryk(S, '[data-brug]')
  const f = r.frem.map((x) => x.ms), t = r.tilbage.map((x) => x.ms)
  r.opsummering = { aabnMs: r.aabn.ms, foerste5: f.slice(0, 5), senereMedian: median(f.slice(5)), senereMaks: Math.max(...f.slice(5)), tilbageMedian: median(t), hopMs: r.hop.ms, brugMs: r.brug.ms }
  paastaa(`C 390 x${cpu}: 24 frem og 6 tilbage er eet billede pr. tryk; hoppet og fotoet virker`, r.frem.map((x) => x.n).join() === Array.from({ length: 24 }, (_, i) => i + 1).join() && r.tilbage.map((x) => x.n).join() === [23, 22, 21, 20, 19, 18].join() && r.hop.metode === 'to-buer' && Math.abs(r.hop.fejl) <= 1 && !S.fejl.length, r.opsummering)
  await S.ctx.close()
}

// --- D) 4K ------------------------------------------------------------------------------------------
for (const cpu of [1, 4]) {
  const S = await aabn(390, { cpu })
  const r = (ud.D[`390 x${cpu}`] = {})
  r.mem = { tom: await procesMB() }
  r.aabn = await vaelg(S, KLIP['sq4k.mp4'])
  r.mem.aaben = await procesMB()
  r.frem = []
  for (let i = 0; i < 10; i++) r.frem.push(await maaltTryk(S, '[data-frem]'))
  r.brug = []
  for (const k of [30, 90, 150]) {
    await saetTid(S, (TIDER['sq4k.mp4'][k] + TIDER['sq4k.mp4'][k + 1]) / 2e6)
    const vist = await nummer(S)
    const b = await maaltTryk(S, '[data-brug]')
    const dim = await S.page.evaluate(() => { const b = window.maalBillede.tilstand().billede; return [b.naturalWidth || b.width, b.naturalHeight || b.height] })
    r.brug.push({ vist, foto: await nummer(S, 'foto'), ms: b.ms, dim })
    await S.page.evaluate(() => window.scrollTo(0, 0))
  }
  r.mem.efterBrug = await procesMB()
  if (cpu === 4) await skud(S, '4k', '[data-videostor]')
  await tryk(S, '[data-lukvideo]').catch(() => {})
  await S.page.waitForTimeout(800)
  r.mem.efterLuk = await procesMB()
  const f = r.frem.map((x) => x.ms)
  r.opsummering = { aabnMs: r.aabn.ms, foerste3: f.slice(0, 3), senereMedian: median(f.slice(3)), brugMs: r.brug.map((x) => x.ms), mem: r.mem }
  paastaa(`D 4K 390 x${cpu}: aabner, linjen siger 1080 x 1920, 10 tryk = billede 1-10, fotoet er 1080 x 1920 og det viste billede`, r.aabn.ok && r.aabn.w === 2160 && /Videoen er 2160 × 3840\. Billedet til klik-trinnet tages ned til 1080 × 1920/.test(r.aabn.videostor) && r.frem.map((x) => x.n).join() === Array.from({ length: 10 }, (_, i) => i + 1).join() && r.brug.every((b) => b.vist === b.foto && b.dim.join() === '1080,1920') && !S.fejl.length, { ...r.opsummering, linje: r.aabn.videostor })
  await S.ctx.close()
}

// --- E) HEVC i en MOV -----------------------------------------------------------------------------
{
  const S = await aabn(390)
  const r = (ud.E['390 sqhevc.mov'] = await vaelg(S, KLIP['sqhevc.mov']))
  if (r.ok) { r.frem = []; for (let i = 0; i < 5; i++) r.frem.push((await maaltTryk(S, '[data-frem]')).n) }
  await skud(S, 'hevc', '[data-videoboks]')
  paastaa(`E HEVC-MOV 390: ${r.ok ? 'aabner og trinene gaar eet billede' : `kan ikke afkodes; beskeden kommer efter ${r.ms} ms`}`, r.ok ? r.frem.join() === '1,2,3,4,5' : r.ms < 5000 && /kunne ikke læses/.test(r.navn), { ms: r.ms, navn: r.navn })
  await S.ctx.close()
}

// --- F) Playwrights Chromium-build mod Google Chrome, samme VFR-MP4 (H.264 med B-billeder) ----------------
{
  const cb = await chromium.launch({ headless: true })
  const PROBE = async (S, ts) => S.page.evaluate(async ([ts, BITS]) => {
    const ud = []
    for (const t of ts) {
      const v = document.createElement('video'); v.muted = true; v.src = window.maalBillede.video.src
      await new Promise((o) => { v.onloadeddata = o })
      v.currentTime = t; await new Promise((o) => { v.onseeked = o }); await new Promise((o) => setTimeout(o, 80))
      const k = document.createElement('canvas'); k.width = 1080; k.height = 110; const x = k.getContext('2d'); x.drawImage(v, 0, 0)
      let n = 0; for (let i = 0; i < BITS; i++) if (x.getImageData(52 + i * 88, 60, 1, 1).data[0] > 128) n |= 1 << i
      ud.push(n)
    }
    return ud
  }, [ts, BITS])
  const tider = TIDER['sqvfr.mp4']
  const ts = [18, 19, 20].flatMap((k) => [tider[k] / 1e6 + 0.001, (tider[k] + tider[k + 1]) / 2e6])
  const r = (ud.F = { versionChromium: cb.version(), versionChrome: chromeVersion, soeg: ts.map((t) => +t.toFixed(4)) })
  for (const [navn, b] of [['chrome', browser], ['chromium', cb]]) {
    const S = await aabn(390, { b })
    await vaelg(S, KLIP['sqvfr.mp4'])
    r[navn] = { vist: await PROBE(S, ts), frem: [] }
    for (let i = 0; i < 24; i++) r[navn].frem.push((await maaltTryk(S, '[data-frem]')).n)
    await S.ctx.close()
  }
  await cb.close()
  paastaa(`F: i Playwrights Chromium ${r.versionChromium} vises billede 19 i VFR-MP4'en aldrig (heller ikke ved en soegning midt i det), saa et tryk gaar 18 -> 20; i Chrome ${r.versionChrome} vises det, og trykket gaar 18 -> 19`, r.chrome.vist.join() === '18,18,19,19,20,20' && !r.chromium.vist.includes(19) && r.chromium.frem.includes(20) && !r.chromium.frem.includes(19) && r.chrome.frem.join() === Array.from({ length: 24 }, (_, i) => i + 1).join(), { chrome: r.chrome.vist, chromium: r.chromium.vist, chromiumFrem: r.chromium.frem.slice(15, 20) })
}

ud.chrome = chromeVersion
ud.net = NET
paastaa('ingen netkald (alt andet end file/data/blob afvist og talt)', NET === 0, NET)
await browser.close()
ud.tjek = tjek
writeFileSync(path.join(HERE, 'video-582.json'), JSON.stringify(ud, null, 1))
const roede = tjek.filter((x) => !x.ok).length
console.log(`video-582: ${tjek.length - roede}/${tjek.length} (loeftmodel main ${SHA})`)
process.exit(roede ? 1 : 0)
