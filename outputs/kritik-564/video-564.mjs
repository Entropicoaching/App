// Kritik 564, blok 1: "Maal dit billede" fra en video (Yantras 560, entropi-loeftmodel-dhruva main,
// hentet med git archive; intet trae roeres). Headless paa 360 og 390 med touch og 1280 med mus, og 390
// med 4x langsommere CPU (en aeldre telefon). Kun mine syntetiske klip fra klip-564.mjs.
//   node outputs/kritik-564/video-564.mjs [ref]
// Maaler: aabne et 30 s klip (tid), skyderen (finger/mus), et billede frem/tilbage (hvor mange billeder
// flytter et tryk, 44 px), "Brug dette billede" (er fotoet det viste billede, tid), fase-hjaelpen, "Hop til
// laveste punkt" paa fem squats med kendt bund, "Luk videoen", netkald efter siden er hentet, hukommelse
// (JS-heap, browserens processer, objekt-URL'er der ikke er frigivet), MOV, 60 og 25 billeder/s, HEVC og 4K.
// Skriver video-564.json og V-*.png.
import path from 'node:path'
import { tmpdir } from 'node:os'
import { writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { chromium } from '../../e2e/harness.mjs'
import { lavKlip, REPS, TOP, DYBDE, NAV_X, navY, bund } from './klip-564.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DHRUVA = 'C:/Users/Entropi/Desktop/entropi-loeftmodel-dhruva'
const SHA = execSync(`git -C ${DHRUVA} rev-parse --short ${process.argv[2] || 'main'}`).toString().trim()
const LM = path.join(tmpdir(), `kritik-564-loeftmodel-${SHA}`)
if (!existsSync(path.join(LM, 'dist', 'maal-billede', 'index.html'))) {
  mkdirSync(LM, { recursive: true })
  execSync(`git -C ${DHRUVA} archive ${SHA} src dist/maal-billede scripts test/maalVideo560.test.js package.json | tar -x -C "${LM.replace(/\\/g, '/')}"`, { shell: 'bash' })
}
const { lavestePunkt, BILLEDE_S, OEJEBLIK } = await import(pathToFileURL(path.join(LM, 'src/maalVideo.js')).href)
const SIDE = pathToFileURL(`${LM}/dist/maal-billede/index.html`).href
const { filer: KLIP, info: KLIPINFO } = await lavKlip()

const tjek = []
const paastaa = (hvad, ok, data) => { tjek.push({ hvad, ok: !!ok, data }); console.log(`${ok ? 'ok ' : 'NEJ'} ${hvad}${data !== undefined ? ' ' + JSON.stringify(data).slice(0, 600) : ''}`) }
const r1 = (x) => Math.round(x * 10) / 10, r3 = (x) => Math.round(x * 1000) / 1000

// --- i siden -------------------------------------------------------------------------------------
// Objekt-URL'er taelles (bytes, der ikke er frigivet), og hvert tryk og hver faerdig soegning faar et tidsstempel.
const INIT = () => {
  const c = URL.createObjectURL.bind(URL), r = URL.revokeObjectURL.bind(URL)
  window.__blob = new Map()
  URL.createObjectURL = (b) => { const u = c(b); window.__blob.set(u, (b && b.size) || 0); return u }
  URL.revokeObjectURL = (u) => { window.__blob.delete(u); r(u) }
  window.__tryk = []; window.__soegt = []
  addEventListener('pointerdown', (e) => { const m = e.target?.closest?.('[data-frem],[data-tilbage],[data-brug],[data-hop],[data-skyder],[data-navklik],[data-lukvideo],[data-videoramme]'); window.__tryk.push({ t: performance.now(), mal: m ? [...m.attributes].find((a) => a.name.startsWith('data-'))?.name : 'andet', type: e.pointerType }) }, true)
  document.addEventListener('seeked', () => window.__soegt.push(performance.now()), true)
}
// Billedets nummer laest i de 11 blokke oeverst (virker paa videoen og paa klik-trinnets foto).
const NUMMER = (hvad) => {
  const src = hvad === 'video' ? window.maalBillede.video : window.maalBillede.tilstand().billede
  if (!src) return null
  const w = src.videoWidth || src.naturalWidth || src.width, s = w / 1080
  const k = document.createElement('canvas'); k.width = w; k.height = Math.ceil(110 * s)
  const x = k.getContext('2d', { willReadFrequently: true }); x.drawImage(src, 0, 0)
  let n = 0
  for (let i = 0; i < 11; i++) { const d = x.getImageData(Math.round((80 + i * 90) * s), Math.round(60 * s), 1, 1).data; if (d[0] > 128) n |= 1 << i }
  return n
}
const TILSTAND = () => {
  const v = window.maalBillede.video, q = (s) => document.querySelector(s)
  const boks = q('[data-videoboks]')
  return {
    boks: !boks.hidden, t: v.currentTime, varighed: v.duration, vw: v.videoWidth, vh: v.videoHeight, rs: v.readyState, soeger: v.seeking,
    tid: q('[data-tid]').textContent, skyderMax: q('[data-skyder]').max, navn: q('[data-videonavn]').textContent, billedNavn: window.maalBillede.tilstand().navn,
    blobs: window.__blob.size, blobMB: [...window.__blob.values()].reduce((a, b) => a + b, 0) / 1e6,
    frem: q('[data-frem]').disabled, tilbage: q('[data-tilbage]').disabled,
  }
}

const browser = await chromium.launch({ headless: true })
const bcdp = await browser.newBrowserCDPSession()
async function procesMB() {
  const { processInfo } = await bcdp.send('SystemInfo.getProcessInfo')
  const ids = processInfo.map((p) => p.id).filter(Boolean)
  const ud = execSync(`powershell -NoProfile -Command "Get-Process -Id ${ids.join(',')} -ErrorAction SilentlyContinue | Measure-Object -Property PrivateMemorySize64 -Sum | % Sum"`).toString().trim()
  return Math.round(Number(ud) / 1e6)
}

async function aabn(bredde, { cpu = 1 } = {}) {
  const mobil = bredde < 500
  const ctx = await browser.newContext({ viewport: { width: bredde, height: mobil ? 780 : 900 }, deviceScaleFactor: mobil ? 3 : 1, isMobile: mobil, hasTouch: mobil })
  const page = await ctx.newPage()
  await page.addInitScript(INIT)
  const S = { ctx, page, mobil, bredde, net: [], efter: [], fejl: [], hentet: false }
  page.on('pageerror', (e) => S.fejl.push(e.message))
  page.on('request', (r) => { const u = r.url(); if (/^(data|blob):/.test(u)) return; (S.hentet ? S.efter : S.net).push(u.slice(0, 120)) })
  await page.route('**/*', (r) => (/^(file|data|blob):/.test(r.request().url()) ? r.continue() : r.abort()))
  S.cdp = await ctx.newCDPSession(page)
  await S.cdp.send('Performance.enable')
  if (cpu > 1) await S.cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })
  const t0 = Date.now()
  await page.goto(SIDE)
  await page.waitForSelector('[data-klar]')
  S.sideMs = Date.now() - t0
  await page.waitForTimeout(300)
  S.hentet = true
  return S
}
const heapMB = async (S) => { const { metrics } = await S.cdp.send('Performance.getMetrics'); return Math.round(metrics.find((m) => m.name === 'JSHeapUsedSize').value / 1e5) / 10 }
const tilst = (S) => S.page.evaluate(TILSTAND)
const nummer = (S, hvad = 'video') => S.page.evaluate(NUMMER, hvad)
async function tryk(S, sel) {
  const l = S.page.locator(sel)
  await l.scrollIntoViewIfNeeded()
  if (S.mobil) await l.tap(); else await l.click()
}
// Venter til soegningen efter et tryk er faerdig; returnerer ms fra fingeren/musen til 'seeked'.
async function ventSoeg(S, foer) {
  await S.page.waitForFunction((n) => window.__soegt.length > n && !window.maalBillede.video.seeking, foer, { timeout: 60000 })
  await S.page.evaluate(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))))
  return S.page.evaluate(() => Math.round(window.__soegt[window.__soegt.length - 1] - window.__tryk[window.__tryk.length - 1].t))
}
async function vaelgVideo(S, fil) {
  const t0 = Date.now()
  await S.page.setInputFiles('[data-videofil]', fil)
  const ok = await S.page.waitForFunction(() => { const v = window.maalBillede.video; return (v.readyState >= 2 && document.querySelector('[data-skyder]').max !== '0' && !v.seeking) || /kunne ikke læses/.test(document.querySelector('[data-videonavn]').textContent) }, null, { timeout: 60000 }).then(() => true, () => false)
  return { ms: Date.now() - t0, ok, ...(await tilst(S)) }
}
async function soeg(S, t) { await S.page.evaluate((t) => window.maalBillede.saetVideoTid(t), t); await S.page.evaluate(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)))) }
// Skyderen trukket med en finger (CDP-touch) eller musen fra venstre kant til andelen `a`.
async function traekSkyder(S, a) {
  await S.page.locator('[data-skyder]').scrollIntoViewIfNeeded()
  const r = await S.page.evaluate(() => { const e = document.querySelector('[data-skyder]').getBoundingClientRect(); return { x: e.left, y: e.top + e.height / 2, w: e.width } })
  const foer = await S.page.evaluate(() => window.__soegt.length)
  const x0 = r.x + 8, x1 = r.x + 8 + (r.w - 16) * a
  if (S.mobil) {
    const tp = (x) => [{ x, y: r.y, id: 1 }]
    await S.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(x0) })
    for (let i = 1; i <= 10; i++) await S.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(x0 + ((x1 - x0) * i) / 10) })
    await S.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  } else {
    await S.page.mouse.move(x0, r.y); await S.page.mouse.down()
    for (let i = 1; i <= 10; i++) await S.page.mouse.move(x0 + ((x1 - x0) * i) / 10, r.y)
    await S.page.mouse.up()
  }
  await S.page.waitForFunction((n) => window.__soegt.length > n && !window.maalBillede.video.seeking, foer, { timeout: 60000 }).catch(() => {})
  await S.page.waitForTimeout(200)
  return { ...(await tilst(S)), bredde: Math.round(r.w), sPrPx: r3(30 / (r.w - 16)) }
}
// Tryk paa navet i videoen, hvor klippet tegnede det (videoens pixels -> skaermen, object-fit: contain).
async function trykNav(S) {
  await tryk(S, '[data-navklik]')
  // Staar navet uden for skaermen, efter knappen er trykket? Saa ruller brugeren op til det (det goer jeg ogsaa).
  const pos = () => S.page.evaluate(([NX]) => {
    const v = window.maalBillede.video, r = v.getBoundingClientRect(), d = Math.min(r.width / v.videoWidth, r.height / v.videoHeight)
    const ox = (r.width - v.videoWidth * d) / 2, oy = (r.height - v.videoHeight * d) / 2
    return { x: r.left + ox + NX * v.videoWidth * d, top: r.top + oy, d, vh: v.videoHeight, skaerm: innerHeight }
  }, [NAV_X])
  const t = await S.page.evaluate(() => window.maalBillede.video.currentTime)
  const yv = navY(Math.floor(t * S.fps + 1e-6) / S.fps)
  let p = await pos()
  let y = p.top + yv * p.vh * p.d
  const udenfor = y < 0 || y > p.skaerm
  if (udenfor) {
    await S.page.evaluate((dy) => window.scrollBy(0, dy), y - p.skaerm / 2)
    await S.page.waitForTimeout(100)
    p = await pos(); y = p.top + yv * p.vh * p.d
  }
  if (S.mobil) await S.page.touchscreen.tap(p.x, y); else await S.page.mouse.click(p.x, y)
  await S.page.waitForTimeout(80)
  return udenfor
}
async function skud(S, navn, sel) {
  if (sel) await S.page.locator(sel).scrollIntoViewIfNeeded().catch(() => {})
  await S.page.screenshot({ path: path.join(HERE, `V-${S.bredde}${S.cpu > 1 ? 'x4' : ''}-${navn}.png`) })
}
// Hvad ses paa skaermen, mens man trykker "1 billede": naar knapperne staar nederst, hvor meget af videoen er synlig?
const LAYOUT = () => {
  const q = (s) => document.querySelector(s).getBoundingClientRect()
  const b = [...document.querySelectorAll('[data-videoboks] button, [data-videoboks] input')].filter((e) => !e.hidden && e.getBoundingClientRect().height > 0 && !e.closest('[hidden]'))
  const v = q('[data-video]'), fr = q('[data-frem]'), br = q('[data-brug]')
  const top = fr.bottom - innerHeight // rul saa "1 billede" staar nederst
  const synlig = Math.max(0, Math.min(v.bottom - top, innerHeight) - Math.max(v.top - top, 0))
  return {
    knapper: b.map((e) => ({ hvad: (e.getAttribute('aria-label') || e.textContent || e.type).trim().slice(0, 28), h: Math.round(e.getBoundingClientRect().height), w: Math.round(e.getBoundingClientRect().width) })),
    video: { w: Math.round(v.width), h: Math.round(v.height) }, skaerm: innerHeight,
    videoSynligVedKnapper: Math.round((100 * synlig) / v.height), brugUnderFrem: Math.round(br.bottom - fr.bottom),
    // Fra videoens top til knappen "Klik navet i videoen": kan man se navet og knappen paa een skaerm?
    videoTilNavknap: document.querySelector('[data-hopboks]').hidden ? null : Math.round(q('[data-navklik]').bottom - v.top),
    videoTilHop: document.querySelector('[data-hopboks]').hidden ? null : Math.round(q('[data-hop]').bottom - v.top),
    // Navet i bunden af en squat staar 68 % nede i mit klip: kan man se det og "Klik navet i videoen" paa een skaerm?
    navTilNavknap: document.querySelector('[data-hopboks]').hidden ? null : Math.round(q('[data-navklik]').bottom - (v.top + 0.68 * v.height)),
    side: document.documentElement.scrollWidth, klient: document.documentElement.clientWidth,
  }
}

const ud = { ref: SHA, klip: KLIPINFO, reps: REPS.map((r) => ({ ...r, bund: bund(r) })), sider: {} }

async function fuldRunde(bredde, cpu = 1) {
  const S = await aabn(bredde, { cpu })
  S.cpu = cpu; S.fps = 30
  const r = (ud.sider[`${bredde}${cpu > 1 ? 'x4' : ''}`] = { mobil: S.mobil, cpu, sideMs: S.sideMs })
  r.mem = { tom: { heap: await heapMB(S), proces: await procesMB() } }
  // Aabn 30 s MP4.
  r.aabn = await vaelgVideo(S, KLIP['sq30.mp4'])
  r.aabn.nummer = await nummer(S)
  r.mem.aaben = { heap: await heapMB(S), proces: await procesMB(), blobMB: r.aabn.blobMB }
  await tryk(S, '[data-fase="squat-bund"]')
  r.layout = await S.page.evaluate(LAYOUT)
  if (cpu === 1) await skud(S, '1-aabnet', '[data-videoboks]')
  // Skyderen: til 50 % og 90 %.
  r.skyder = [await traekSkyder(S, 0.5), await traekSkyder(S, 0.9)].map((x) => ({ t: r3(x.t), tid: x.tid, bredde: x.bredde, sPrPx: x.sPrPx }))
  r.skyderNummer = await nummer(S)
  // Et billede frem og tilbage: 20 tryk frem fra 0 og fra skyderens sted, 20 tilbage. Hvor mange billeder pr. tryk?
  r.trin = {}
  for (const [navn, start, retning] of [['frem fra 0', 0, 'frem'], ['frem fra skyderen', null, 'frem'], ['tilbage', null, 'tilbage']]) {
    if (start !== null) await soeg(S, start)
    let n0 = await nummer(S)
    const spring = [], ms = []
    for (let i = 0; i < 20; i++) {
      const foer = await S.page.evaluate(() => window.__soegt.length)
      await tryk(S, `[data-${retning}]`)
      ms.push(await ventSoeg(S, foer))
      const n = await nummer(S)
      spring.push(n - n0); n0 = n
    }
    r.trin[navn] = { spring, ms: { median: ms.sort((a, b) => a - b)[10], max: ms[19] } }
  }
  // Tiden ved siden af knapperne passer med billedet? (tidstekst mod billedets nummer)
  const tt = await tilst(S)
  r.tidMod = { tid: tt.tid, nummer: await nummer(S), t: r3(tt.t) }
  // Brug dette billede: fotoet i klik-trinnet er det viste billede?
  r.brug = []
  for (const t of [3.2, 8.5, 24.8]) {
    await soeg(S, t)
    const vist = await nummer(S)
    const prev = await S.page.evaluate(() => { window.__prevBillede = window.maalBillede.tilstand().billede; return true })
    void prev
    const t0 = Date.now()
    await tryk(S, '[data-brug]')
    await S.page.waitForFunction(() => window.maalBillede.tilstand().billede && window.maalBillede.tilstand().billede !== window.__prevBillede, null, { timeout: 60000 })
    const ms = await S.page.evaluate(() => Math.round(performance.now() - window.__tryk[window.__tryk.length - 1].t))
    const foto = await nummer(S, 'foto')
    const st = await S.page.evaluate(() => { const b = window.maalBillede.tilstand().billede; const bb = document.querySelector('[data-billedeboks]').getBoundingClientRect(); return { w: b.naturalWidth, h: b.naturalHeight, navn: window.maalBillede.tilstand().navn, boksSynlig: bb.top < innerHeight && bb.bottom > 0 } })
    r.brug.push({ t, vist, foto, ms, wall: Date.now() - t0, ...st })
  }
  if (cpu === 1) await skud(S, '3-brugt')
  r.mem.brugt3 = { heap: await heapMB(S), proces: await procesMB(), blobMB: (await tilst(S)).blobMB, blobs: (await tilst(S)).blobs }
  // Fase-hjaelpen: saetningen og om hop-boksen vises, for hver af de seks faser.
  r.faser = {}
  for (const f of Object.keys(OEJEBLIK)) {
    await tryk(S, `[data-fase="${f}"]`)
    r.faser[f] = await S.page.evaluate(() => ({ tekst: document.querySelector('[data-oejeblik]').textContent.trim(), hop: !document.querySelector('[data-hopboks]').hidden, liste: document.querySelector('[data-navklikliste]').hidden ? '' : document.querySelector('[data-navklikliste]').textContent.trim() }))
  }
  // Hop til laveste punkt, fem squats: navet klikket i billedet paa vej ned og op i 15 % af dybden over bunden.
  await tryk(S, '[data-fase="squat-bund"]')
  r.hop = []
  for (const rep of REPS) {
    if (await S.page.locator('[data-glemnav]').isVisible()) await tryk(S, '[data-glemnav]')
    const b = bund(rep)
    const maal = TOP + DYBDE * 0.85
    const ned = nearest(rep.start, rep.start + rep.ned, maal), op = nearest(b.til, b.til + rep.op, maal)
    await soeg(S, ned / 30 + 0.5 / 30); const u1 = await trykNav(S)
    await soeg(S, op / 30 + 0.5 / 30); const u2 = await trykNav(S)
    const maerker = await S.page.evaluate(() => window.maalBillede.navMaerker())
    const tekst = await S.page.evaluate(() => document.querySelector('[data-navklikliste]').textContent.trim())
    const foer = await S.page.evaluate(() => window.__soegt.length)
    if (await S.page.locator('[data-hop]').isDisabled()) { r.hop.push({ rep: rep.navn, fejlet: 'Hop til er ikke aktiv', maerker }); continue }
    await tryk(S, '[data-hop]')
    await ventSoeg(S, foer).catch(() => null)
    const n = await nummer(S)
    const fra = Math.round(b.fra * 30), til = Math.round(b.til * 30)
    r.hop.push({ rep: rep.navn, klikBilleder: [ned, op], maerker: maerker.map((m) => ({ t: r3(m.t), y: Math.round(m.y) })), navUdenforSkaermen: u1 || u2, landet: n, bund: [fra, til], fejl: n < fra ? n - fra : n > til ? n - til : 0, tekst })
    if (cpu === 1 && rep.navn === 'hurtig op') await skud(S, '4-hop', '[data-videoramme]')
  }
  // Luk videoen: boksen vaek, videoens objekt-URL frigivet, fotoet bliver.
  await tryk(S, '[data-lukvideo]')
  await S.page.waitForTimeout(300)
  r.luk = { ...(await tilst(S)), fotoStaar: await S.page.evaluate(() => !!window.maalBillede.tilstand().billede) }
  r.mem.lukket = { heap: await heapMB(S), proces: await procesMB(), blobMB: r.luk.blobMB }
  // Samme fil igen efter luk (feltet nulstilles).
  r.igen = await vaelgVideo(S, KLIP['sq30.mp4'])
  r.net = S.net; r.efterHentet = S.efter; r.jsFejl = S.fejl
  await S.ctx.close()
}
function nearest(t0, t1, y) {
  let best = null
  for (let n = Math.ceil(t0 * 30); n <= Math.floor(t1 * 30); n++) { const d = Math.abs(navY(n / 30) - y); if (!best || d < best.d) best = { n, d } }
  return best.n
}

const KUN = process.env.KUN ? Number(process.env.KUN) : null // kun til fejlsoegning: een bredde, ingen andre klip
for (const [b, c] of KUN ? [[KUN, 1]] : [[360, 1], [390, 1], [1280, 1], [390, 4]]) { console.log('runde', b, c); await fuldRunde(b, c) }

// Den synlige hoejde i en telefonbrowser (adresselinje og knapper fratrukket): 360 x 640 og 390 x 664.
ud.telefonHoejde = {}
for (const [b, h] of [[360, 640], [390, 664]]) {
  const ctx = await browser.newContext({ viewport: { width: b, height: h }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
  const page = await ctx.newPage(); await page.addInitScript(INIT)
  await page.route('**/*', (r) => (/^(file|data|blob):/.test(r.request().url()) ? r.continue() : r.abort()))
  await page.goto(SIDE); await page.waitForSelector('[data-klar]')
  const S = { page, mobil: true, bredde: b, cpu: 1, fps: 30 }
  await vaelgVideo(S, KLIP['sq30.mp4'])
  await tryk(S, '[data-fase="squat-bund"]')
  ud.telefonHoejde[`${b}x${h}`] = await page.evaluate(LAYOUT)
  await page.locator('[data-navklik]').scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(HERE, `V-${b}x${h}-navknap.png`) })
  await ctx.close()
}

// Andre klip paa 390 (touch) og 390 med 4x CPU: MOV, VP9, 60 og 25 billeder/s, HEVC, 4K.
ud.andre = {}
for (const cpu of KUN ? [] : [1, 4]) {
  for (const [navn, fps] of [['sq30.mov', 30], ['sq30.webm', 30], ['sq30-60.mp4', 60], ['sq30-25.mp4', 25], ['sq30-hevc.mp4', 30], ['sq5-4k.mp4', 30]]) {
    if (cpu === 4 && !/mov|4k|hevc/.test(navn)) continue
    const S = await aabn(390, { cpu }); S.fps = fps; S.cpu = cpu
    const x = (ud.andre[`${navn}${cpu > 1 ? ' x4' : ''}`] = {})
    x.aabn = await vaelgVideo(S, KLIP[navn])
    x.besked = x.aabn.navn
    if (x.aabn.vw) {
      await soeg(S, 2.0)
      let n0 = await nummer(S)
      x.spring = []
      for (let i = 0; i < 12; i++) { const f = await S.page.evaluate(() => window.__soegt.length); await tryk(S, '[data-frem]'); await ventSoeg(S, f); const n = await nummer(S); x.spring.push(n - n0); n0 = n }
      const t0 = Date.now()
      await S.page.evaluate(() => { window.__prevBillede = window.maalBillede.tilstand().billede })
      await tryk(S, '[data-brug]')
      await S.page.waitForFunction(() => window.maalBillede.tilstand().billede && window.maalBillede.tilstand().billede !== window.__prevBillede, null, { timeout: 60000 })
      x.brugMs = Date.now() - t0
      x.brugRigtigt = (await nummer(S, 'foto')) === n0
      x.mem = { heap: await heapMB(S), proces: await procesMB(), blobMB: (await tilst(S)).blobMB }
      await tryk(S, '[data-lukvideo]'); await S.page.waitForTimeout(300)
      x.memLukket = { heap: await heapMB(S), proces: await procesMB(), blobMB: (await tilst(S)).blobMB }
    }
    if (navn === 'sq30-hevc.mp4' && cpu === 1) await skud(S, 'hevc', '[data-videoboks]')
    x.efterHentet = S.efter; x.jsFejl = S.fejl
    await S.ctx.close()
  }
}
await browser.close()

// --- Hop til laveste punkt regnet for mange klik (Yantras egen lavestePunkt, mine fem squats) --------
// Klikhoejder 5-40 % af dybden over bunden, og brugerens valg af "samme hoejde" +-1 billede paa hver side.
ud.hopRegnet = REPS.map((rep) => {
  const b = bund(rep), fra = Math.round(b.fra * 30), til = Math.round(b.til * 30)
  const fejl = [], raad = []
  for (const h of [0.05, 0.1, 0.15, 0.2, 0.3, 0.4]) {
    const y = TOP + DYBDE * (1 - h)
    const ned = nearest(rep.start, rep.start + rep.ned, y), op = nearest(b.til, b.til + rep.op, y)
    for (const dn of [-1, 0, 1]) for (const dp of [-1, 0, 1]) {
      const lp = lavestePunkt([{ t: (ned + dn) / 30, y: navY((ned + dn) / 30) }, { t: (op + dp) / 30, y: navY((op + dp) / 30) }])
      const n = Math.floor(lp.t * 30 + 1e-6)
      const f = (m) => (m < fra ? m - fra : m > til ? m - til : 0)
      fejl.push(f(n))
      // Sidens raad efter to klik: "gaa et billede eller to tilbage". Hjaelper det (|fejl| mindre efter 1 eller 2 tilbage)?
      raad.push(Math.min(Math.abs(f(n - 1)), Math.abs(f(n - 2))) < Math.abs(f(n)) ? 1 : Math.abs(f(n)) === 0 ? 0 : -1)
    }
  }
  // Tre klik (20 % ned, 10 % op, 20 % op) og fem klik (30, 15 % ned; 10, 20, 30 % op): Yantras parabel.
  const hk = (lst) => { const lp = lavestePunkt(lst.map(([t0, t1, h]) => { const n = nearest(t0, t1, TOP + DYBDE * (1 - h)); return { t: n / 30, y: navY(n / 30) } })); const n = Math.floor(lp.t * 30 + 1e-6); return n < fra ? n - fra : n > til ? n - til : 0 }
  const N = [rep.start, rep.start + rep.ned], O = [b.til, b.til + rep.op]
  const parabel3 = hk([[...N, 0.2], [...O, 0.1], [...O, 0.2]]), parabel5 = hk([[...N, 0.3], [...N, 0.15], [...O, 0.1], [...O, 0.2], [...O, 0.3]])
  fejl.sort((a, c) => a - c)
  const retning = fejl.filter((f) => f !== 0).length ? (fejl.filter((f) => f < 0).length > fejl.filter((f) => f > 0).length ? 'foer bunden' : 'efter bunden') : 'i bunden'
  return { rep: rep.navn, nedOp: `${rep.ned}/${rep.op}`, median: fejl[Math.floor(fejl.length / 2)], min: fejl[0], max: fejl[fejl.length - 1], retning, ramt: Math.round((100 * fejl.filter((f) => Math.abs(f) <= 1).length) / fejl.length), raadHjaelper: Math.round((100 * raad.filter((x) => x === 1).length) / raad.length), raadSkader: Math.round((100 * raad.filter((x) => x === -1).length) / raad.length), parabel3, parabel5 }
})

if (KUN) { writeFileSync(path.join(tmpdir(), 'video-564-kun.json'), JSON.stringify(ud, null, 1)); process.exit(0) }

// --- tjek ------------------------------------------------------------------------------------------
const B = ['360', '390', '1280', '390x4'], sd = ud.sider
const alle = (f) => B.every((w) => f(sd[w], w))
paastaa('Aabn 30 s MP4 (1080 x 1920, 57 MB): videoen vises med varighed og skyder paa alle fire', alle((s) => s.aabn.ok && s.aabn.boks && s.aabn.vw === 1080 && Math.abs(s.aabn.varighed - 30) < 0.1 && s.aabn.nummer === 0), B.map((w) => [w, sd[w].aabn.ms]))
paastaa('Skyderen med finger/mus: 50 % og 90 % rammer 15 s og 27 s (+-0,5 s)', alle((s) => Math.abs(s.skyder[0].t - 15) < 0.5 && Math.abs(s.skyder[1].t - 27) < 0.5), B.map((w) => [w, sd[w].skyder]))
paastaa('Et billede frem fra skyderens sted: hvert tryk flytter praecis 1 billede (30 billeder/s)', alle((s) => s.trin['frem fra skyderen'].spring.every((x) => x === 1)), B.map((w) => [w, sd[w].trin['frem fra skyderen'].spring.join('')]))
paastaa('Et billede tilbage: hvert tryk flytter praecis 1 billede', alle((s) => s.trin.tilbage.spring.every((x) => x === -1)), B.map((w) => [w, sd[w].trin.tilbage.spring.join(',')]))
paastaa('Et billede frem fra 0 s: foerste tryk flytter 0 billeder (0,033 s er foer billede 1 ved 1/30 s), derefter 1 pr. tryk', alle((s) => s.trin['frem fra 0'].spring[0] === 0 && s.trin['frem fra 0'].spring.slice(1).every((x) => x === 1)), B.map((w) => [w, sd[w].trin['frem fra 0'].spring.join('')]))
paastaa('Alle synlige knapper og skyderen i videoboksen er mindst 44 px hoeje', alle((s) => s.layout.knapper.every((k) => k.h >= 44)), B.map((w) => [w, sd[w].layout.knapper.map((k) => `${k.hvad}:${k.w}x${k.h}`)]))
paastaa('Brug dette billede: fotoet er praecis det viste billede, i videoens egne pixels', alle((s) => s.brug.every((b) => b.foto === b.vist && b.w === 1080 && b.h === 1920)), B.map((w) => [w, sd[w].brug.map((b) => `${b.vist}->${b.foto} ${b.ms}ms`)]))
paastaa('Fase-hjaelpen: seks saetninger; hop kun i squat og baenk', alle((s) => Object.entries(s.faser).every(([f, x]) => x.tekst.includes(OEJEBLIK[f]) && x.hop === !f.startsWith('dl-'))), sd['390'].faser)
paastaa('Hop til laveste punkt (to klik i 15 % hoejde): -1, -4, +6, 0 og +4 billeder fra bunden i de fem squats, ens paa alle fire', alle((s) => s.hop.map((h) => h.fejl).join() === '-1,-4,6,0,4'), B.map((w) => [w, sd[w].hop.map((h) => `${h.rep}:${h.fejl}`)]))
paastaa('Hop-teksten siger "gaa et billede eller to tilbage" efter to klik; regnet over 54 klikpar skader raadet i "jaevn" og "hurtig op" (opturen hurtigst) og hjaelper kun, naar opturen er langsomst', ud.hopRegnet[1].raadSkader === 100 && ud.hopRegnet[0].raadSkader > 50 && ud.hopRegnet[2].raadHjaelper === 100 && /opturen er tit hurtigere end nedturen, så gå et billede eller to tilbage/.test(sd['390'].hop[0].tekst), ud.hopRegnet.map((h) => [h.rep, h.nedOp, h.median, h.raadHjaelper, h.raadSkader]))
paastaa('Parabel med tre eller fem klik hjaelper ikke paa "hurtig op" og "grind" (klik i samme hoejder)', ud.hopRegnet[1].parabel3 <= -4 && ud.hopRegnet[2].parabel3 >= 6, ud.hopRegnet.map((h) => [h.rep, h.parabel3, h.parabel5]))
paastaa('Luk videoen: boksen vaek, videoens objekt-URL frigivet, fotoet bliver', alle((s) => !s.luk.boks && s.luk.blobMB < 1 && s.luk.fotoStaar), B.map((w) => [w, sd[w].luk.blobs, r1(sd[w].luk.blobMB)]))
paastaa('Samme fil kan aabnes igen efter Luk videoen', alle((s) => s.igen.ok && s.igen.boks))
paastaa('Ingen netkald efter siden er hentet (heller ikke naar videoen aabnes, spoles og bruges); ingen JS-fejl', alle((s) => s.efterHentet.length === 0 && s.jsFejl.length === 0) && Object.values(ud.andre).every((x) => x.efterHentet.length === 0 && x.jsFejl.length === 0), B.map((w) => [w, sd[w].net.length, sd[w].efterHentet]))
paastaa('Ingen vandret rulning med videoen aaben', alle((s) => s.layout.side <= s.layout.klient))
paastaa('MOV (QuickTime-beholder, H.264) aabnes og bruges', ud.andre['sq30.mov']?.aabn.vw === 1080 && ud.andre['sq30.mov'].brugRigtigt, ud.andre['sq30.mov']?.aabn.ms)
paastaa('60 billeder/s: 2 billeder pr. tryk; 25 billeder/s: nogle tryk flytter 0; skyderen er 0,09-0,10 s pr. px paa telefonen (3 billeder ved 30/s)', ud.andre['sq30-60.mp4'].spring.slice(1).every((x) => x === 2) && ud.andre['sq30-25.mp4'].spring.filter((x) => x === 0).length >= 2 && sd['390'].skyder[0].sPrPx > 0.09, [ud.andre['sq30-60.mp4'].spring.join(''), ud.andre['sq30-25.mp4'].spring.join(''), sd['360'].skyder[0].sPrPx, sd['390'].skyder[0].sPrPx])
paastaa('HEVC: beskeden kommer foerst efter 15 s (siden venter paa loadedmetadata til tiden er gaaet)', ud.andre['sq30-hevc.mp4'].aabn.ms > 14000, ud.andre['sq30-hevc.mp4'].aabn.ms)
paastaa('HEVC som Chrome ikke kan afkode: siden siger det og raader til MP4/MOV eller skaermbillede', /kunne ikke læses/.test(ud.andre['sq30-hevc.mp4'].besked), [ud.andre['sq30-hevc.mp4'].aabn.ms, ud.andre['sq30-hevc.mp4'].besked])
paastaa('4K (2160 x 3840): aabnes og Brug dette billede giver det rigtige billede', ud.andre['sq5-4k.mp4'].aabn.vw === 2160 && ud.andre['sq5-4k.mp4'].brugRigtigt, [ud.andre['sq5-4k.mp4'].brugMs, ud.andre['sq5-4k.mp4'].mem])
paastaa('Aeldre telefon (4x CPU): aabn under 5 s, et tryk under 1 s, Brug dette billede under 3 s', sd['390x4'].aabn.ms < 5000 && sd['390x4'].trin['frem fra skyderen'].ms.max < 1000 && sd['390x4'].brug.every((b) => b.ms < 3000), [sd['390x4'].aabn.ms, sd['390x4'].trin['frem fra skyderen'].ms, sd['390x4'].brug.map((b) => b.ms)])
ud.tjek = tjek
writeFileSync(path.join(HERE, 'video-564.json'), JSON.stringify(ud, null, 1))
const nej = tjek.filter((t) => !t.ok).length
console.log(`${tjek.length - nej}/${tjek.length} tjek groenne (dhruva ${SHA})`)
console.log(JSON.stringify(ud.hopRegnet))
