// Kritik 632, blok 1: Maal dit billede efter Yantras 627 (M18, Gem ugerne med tallene) og 630 (M19: guld kraever to
// uger i traek; M20: "forskel fra" i den faste celle). Yantras punkter under "Bhishak boer tjekke" i dag 95 og 96:
//   1) M18's ordlyd: omvendt -> Byt, Byt tilbage, rigtig -> Byt;
//   2) Uger paa 390 og 1280: en enkelt uge over graensen (uden guld, uden ≈), guld i to uger i traek, den nyeste uge
//      alene, "forskel fra 3. aug. 2026" i den faste celle, ogsaa rullet helt ud;
//   3) det gemte PNG: hoejde med 8 og 12 uger, samme guld som siden, ingen maaling i filen, hvor stor skriften er paa
//      en telefon, der viser billedet i fuld bredde;
//   4) M19 med min egen Monte Carlo (fra 628) gennem sidens ugeTabel med den nye regel, og tjekket mod siden.
//   node outputs/kritik-632/maal-632.mjs     -> maal-632.json og M-*.png
// Loeftmodellen (main) og sitet (vaerktoejer) hentes med `git archive`; intet trae roeres. Siden maales i sitets kopi
// med main's dist/maal-billede/ lagt oven i (det, Setus kopi vil give). Google Chrome (den installerede) headless,
// 390 touch og 1280 mus, alt net uden for den lokale server afbrudt. Kun syntetiske maalinger og grå flader.
import path, { join } from 'node:path'
import { tmpdir } from 'node:os'
import { writeFileSync, readFileSync, mkdtempSync, existsSync, statSync, mkdirSync, rmSync, cpSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { createServer } from 'node:http'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from '../../e2e/harness.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SITE = 'C:/Users/Entropi/Desktop/entropi-coaching-site-wt2'
const LM = 'C:/Users/Entropi/Desktop/entropi-loeftmodel-dhruva'
const GREN = 'refs/heads/vaerktoejer'
const K628 = '287210d' // det, jeg sagde ja til i 628
const MC_N = +(process.env.MC_N || 2000)
const sh = (c) => execSync(c, { maxBuffer: 1 << 26 }).toString()
const rev = (repo, r) => sh(`git -C "${repo}" rev-parse --short ${r}`).trim()
const ver = { main: rev(LM, 'main'), site: rev(SITE, GREN), k628: K628 }
const erIMain = (b) => sh(`git -C "${LM}" merge-base --is-ancestor refs/heads/${b} main && echo ja || echo nej`).trim()
ver.o627Merget = erIMain('ordre-627'); ver.o630Merget = erIMain('ordre-630')
ver.mainSiden628 = sh(`git -C "${LM}" log --first-parent --format=%h%x20%s ${K628}..main`).trim().split(/\r?\n/).filter(Boolean)
ver.rapporter = sh(`git -C "${LM}" ls-tree --name-only main docs/`).split(/\r?\n/).filter((f) => /RAPPORT-dag-9[56]\.md$/.test(f))
const dir = mkdtempSync(join(tmpdir(), 'k632-'))
const hent = (repo, ref, hvor, stier = '') => { mkdirSync(hvor, { recursive: true }); execSync(`git -c core.autocrlf=false -C "${repo}" archive -o "${join(hvor, 'a.tar')}" ${ref} ${stier}`); execSync('tar -xf a.tar', { cwd: hvor }); rmSync(join(hvor, 'a.tar')) }
const lmMain = join(dir, '_main'), web = join(dir, 'web')
hent(LM, 'main', lmMain, 'dist src kroppe package.json')
hent(SITE, GREN, web)
const tjek = []
const paastaa = (hvad, ok, data) => { tjek.push({ hvad, ok: !!ok, data }); console.log(`${ok ? 'ok ' : 'NEJ'} ${hvad}${data !== undefined ? ' ' + JSON.stringify(data).slice(0, 900) : ''}`) }
const ud = { ver, kopi: {}, m18: [], ui: [], png: {}, mc: {}, andet: {} }

// --- 0) Hvad er nyt, og hvad skal Setu kopiere ----------------------------------------------------------------
const blobs = (repo, ref, d) => Object.fromEntries(sh(`git -C "${repo}" ls-tree -r ${ref} -- ${d}/`).split('\n').filter(Boolean).map((l) => { const [meta, f] = l.split('\t'); return [f.slice(d.length + 1), meta.split(' ')[2]] }))
const forskelle = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((f) => a[f] !== b[f])
for (const m of ['maal-billede', 'baenk-figurer', 'tre-loeft', 'min-krop']) {
  const site = blobs(SITE, GREN, `assets/vaerktoejer/${m}`)
  ud.kopi[m] = { siteModMain: forskelle(blobs(LM, 'main', `dist/${m}`), site), siteMod4ca: forskelle(blobs(LM, '4ca0c63', `dist/${m}`), site) }
}
ud.kopi.distSiden628 = sh(`git -C "${LM}" diff --name-only ${K628} main -- dist`).trim().split(/\r?\n/).filter(Boolean)
ud.kopi.distSiden4ca = sh(`git -C "${LM}" diff --name-only 4ca0c63 main -- dist`).trim().split(/\r?\n/).filter(Boolean)
paastaa(`627 og 630 er merget (main ${ver.main}), rapport dag 95 og 96 ligger paa main; i dist er kun maal-billede.js og index.html aendret siden 628 (${K628}) og siden sitets 4ca0c63`, ver.o627Merget === 'ja' && ver.o630Merget === 'ja' && ver.rapporter.length === 2 && ud.kopi.distSiden628.join() === 'dist/maal-billede/index.html,dist/maal-billede/maal-billede.js' && ud.kopi.distSiden4ca.join() === ud.kopi.distSiden628.join(), { nye: ver.mainSiden628, dist: ud.kopi.distSiden628 })
paastaa(`sitet (${ver.site}) er stadig blob for blob 4ca0c63 i alle fire mapper (Setus 625 er ikke committet); mod main er kun de to filer anderledes`, Object.values(ud.kopi).filter((k) => k.siteMod4ca).every((k) => !k.siteMod4ca.length) && ud.kopi['maal-billede'].siteModMain.sort().join() === 'index.html,maal-billede.js' && ['tre-loeft', 'min-krop', 'baenk-figurer'].every((m) => !ud.kopi[m].siteModMain.length), { site: ver.site, maal: ud.kopi['maal-billede'].siteModMain })

// --- Server: sitets kopi med main's maal-billede lagt oven i ----------------------------------------------------
const S = (w, m) => join(w, 'assets', 'vaerktoejer', m)
rmSync(S(web, 'maal-billede'), { recursive: true }); cpSync(join(lmMain, 'dist', 'maal-billede'), S(web, 'maal-billede'), { recursive: true })
const typer = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.json': 'application/json', '.ico': 'image/x-icon', '.woff2': 'font/woff2' }
const server = createServer((req, res) => {
  let f = join(web, decodeURIComponent(req.url.split('?')[0].split('#')[0]))
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html')
  if (!existsSync(f)) { res.writeHead(404); return res.end() }
  res.writeHead(200, { 'content-type': typer[path.extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f))
}).listen(0)
const BASE = `http://127.0.0.1:${server.address().port}`
const V = '/assets/vaerktoejer'
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
ud.chrome = browser.version()
const eksterne = new Set()
async function side(bredde) {
  const mobil = bredde < 500
  const ctx = await browser.newContext({ viewport: { width: bredde, height: mobil ? 844 : 900 }, deviceScaleFactor: mobil ? 3 : 1, isMobile: mobil, hasTouch: mobil, acceptDownloads: true })
  const page = await ctx.newPage()
  const T = { ctx, page, mobil, bredde, fejl: [] }
  page.on('pageerror', (e) => T.fejl.push(e.message))
  await page.route('**/*', (r) => { const u = r.request().url(); if (u.startsWith(BASE) || /^(data|blob):/.test(u)) return r.continue(); eksterne.add(u.split('?')[0]); return r.abort() })
  await page.goto(`${BASE}${V}/maal-billede/index.html`, { waitUntil: 'load' })
  await page.waitForSelector('[data-klar]')
  return T
}
async function tryk(T, sel) { const l = T.page.locator(sel).first(); await l.scrollIntoViewIfNeeded(); if (T.mobil) await l.tap(); else await l.click() }

// --- Modellen og een fil gemt af siden selv (som 628) -------------------------------------------------------------
const imp = (f) => import(pathToFileURL(join(lmMain, 'src', f)).href)
const { PUNKTER, SKIVE_CM, maal, skalaFraKrop } = await imp('maalBillede.js')
const { kroppe, modelFase } = await imp('maalBilledeModel.js')
const { ugeTabel } = await imp('maalUger.js')
const { ugerTabelTekst, OVER_LINJE, UGER_PR_BLOK } = await imp('maalEksport.js')
const PX = 3 // px pr. cm i billedet
const iBillede = (P, { x0 = 600, y0 = 1300, dy = 0 } = {}) => { const o = {}; for (const { id } of PUNKTER) o[id] = { x: x0 + P[id].x * PX, y: y0 - P[id].y * PX - (id === 'hofte' ? dy : 0) }; o.skalaA = { x: o.stang.x, y: o.stang.y - (SKIVE_CM / 2) * PX }; return o }
const MP = modelFase('dl-gulv', kroppe('doedloeft', null, { hoejde: '180', stangKg: 200 }).snit)
const Q0 = iBillede(MP.punkter)
let basis
{
  const T = await side(1280)
  await T.page.evaluate(async () => {
    const k = document.createElement('canvas'); k.width = 1000; k.height = 1400; const x = k.getContext('2d'); x.fillStyle = '#556'; x.fillRect(0, 0, 1000, 1400)
    const url = URL.createObjectURL(await new Promise((ok) => k.toBlob(ok, 'image/png')))
    return window.maalBillede.laesBillede(url, 'IMG_4411.jpg', true)
  })
  await T.page.evaluate((Q) => { const m = window.maalBillede; m.saetKrop({ hoejde: '180', vaegt: '90' }); m.saetStangKg(200); m.saetFase('dl-gulv'); m.saetPunkter(Q) }, Q0)
  await T.page.waitForTimeout(300)
  const [dl] = await Promise.all([T.page.waitForEvent('download'), tryk(T, '[data-gem]')])
  basis = readFileSync(await dl.path())
  await T.ctx.close()
}
// Min egen PNG-laeser og -skriver (uafhaengig af maalGemt.js), som i 610 og 628.
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 } return (b) => { let c = 0xffffffff; for (const x of b) c = t[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 } })()
function dele(buf) { const b = Buffer.from(buf); const r = []; let i = 8; while (i + 12 <= b.length) { const n = b.readUInt32BE(i); const type = b.toString('latin1', i + 4, i + 8); if (i + 12 + n > b.length) break; r.push({ type, n, raa: b.subarray(i, i + 12 + n) }); i += 12 + n; if (type === 'IEND') break } return r }
const lavDel = (type, data) => { const b = Buffer.alloc(12 + data.length); b.writeUInt32BE(data.length, 0); b.write(type, 4, 'latin1'); data.copy(b, 8); b.writeUInt32BE(CRC(b.subarray(4, 8 + data.length)), 8 + data.length); return b }
const SIG = Buffer.from('89504e470d0a1a0a', 'hex')
function medMeta(buf, fn) {
  const D = dele(buf), d = D.find((x) => x.type === 'enTr'); const data = d.raa.subarray(8, 8 + d.n)
  const jl = data.readUInt32BE(21); const meta = JSON.parse(data.toString('utf8', 25, 25 + jl)); fn(meta)
  const json = Buffer.from(JSON.stringify(meta), 'utf8'); const hoved = Buffer.from(data.subarray(0, 25)); hoved.writeUInt32BE(json.length, 21)
  return Buffer.concat([SIG, ...D.map((x) => x === d ? lavDel('enTr', Buffer.concat([hoved, json, data.subarray(25 + jl)])) : x.raa)])
}
const ihdr = (buf) => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) })

const KLIK_SD = { stang: 0.5, midtfod: 1.0, ankel: 1.0, knae: 1.0, hofte: 1.5, skulder: 1.5 }
function rng(seed) { let a = seed >>> 0; const u = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }; return () => Math.sqrt(-2 * Math.log(u() + 1e-12)) * Math.cos(2 * Math.PI * u()) }
const klikket = (Q, g) => { const o = JSON.parse(JSON.stringify(Q)); for (const [id, sd] of Object.entries(KLIK_SD)) { o[id].x += g() * sd * PX; o[id].y += g() * sd * PX } o.skalaA = { x: o.stang.x, y: o.stang.y - (SKIVE_CM / 2) * PX }; return o }
const mandag = (k) => new Date(Date.UTC(2026, 7, 3 + 7 * k)).toISOString().slice(0, 10) // uge 1 = 3. aug. 2026
function ugeFil(k, { dy = 0, runder = 1, g = null, hoejde = '180', gemt = mandag(k), navn = `IMG_${4411 + k}.jpg`, faseId = 'dl-gulv' } = {}) {
  const Q = iBillede(MP.punkter, { dy })
  const R = Array.from({ length: runder }, () => (g ? klikket(Q, g) : Q))
  return { runder: R, buf: medMeta(basis, (m) => { if (gemt) m.gemt = gemt; else delete m.gemt; m.faelles.hoejde = hoejde; m.faelles.faseId = faseId; m.pladser[0].navn = navn; m.pladser[0].punkter = R[R.length - 1]; m.pladser[0].runder = R.slice(0, -1) }) }
}
async function vaelgUger(T, filer) {
  await T.page.setInputFiles('[data-ugefiler]', filer.map((f) => ({ name: f.name, mimeType: f.mimeType ?? 'image/png', buffer: f.buf })))
  await T.page.waitForFunction(() => document.querySelector('[data-ugestatus]').textContent.length > 0, null, { timeout: 30000 })
  await T.page.waitForTimeout(250)
}
const UGE_DOM = () => {
  const r = (e) => e.getBoundingClientRect()
  const tekst = (e) => (e ? e.textContent.replace(/\s+/g, ' ').trim() : null)
  const sek = [...document.querySelectorAll('[data-ugefase]')].map((s) => {
    const t = s.querySelector('[data-ugetabel]'), rul = s.querySelector('.mb-ugerul'), fra = t.querySelector('[data-ugefra]')
    return {
      fase: s.dataset.ugefase,
      hoved: [...t.querySelectorAll('thead th')].map(tekst),
      fra: tekst(fra), fraSmaa: fra.querySelector('small') ? parseFloat(getComputedStyle(fra.querySelector('small')).fontSize) : null,
      raekker: [...t.querySelectorAll('tbody tr')].map((tr) => ({ id: tr.dataset.id, navn: tekst(tr.children[0]), celler: [...tr.children].slice(1).map((td) => ({ tekst: tekst(td), guld: !!td.querySelector('[data-guld]'), over: !!td.querySelector('[data-over]'), inden: /≈/.test(td.textContent), farve: td.querySelector('[data-over]') ? getComputedStyle(td.querySelector('[data-over]')).color : null, vaegt: td.querySelector('[data-over]') ? getComputedStyle(td.querySelector('[data-over]')).fontWeight : null })) })),
      guld: t.querySelectorAll('[data-guld]').length, over: t.querySelectorAll('[data-over]').length,
      saetning: tekst(s.querySelector('[data-ugesaetning]')),
      rul: { klient: rul.clientWidth, fuld: rul.scrollWidth, hoejde: Math.round(r(rul).height) },
    }
  })
  return { status: tekst(document.querySelector('[data-ugestatus]')), sek, forklaring: tekst(document.querySelector('[data-ugeforklaring]')), sideRul: document.scrollingElement.scrollWidth - innerWidth, gemKnap: !document.querySelector('[data-gemuger]')?.closest('[hidden]') && document.querySelector('[data-gemuger]')?.offsetParent !== null }
}

// --- 1) M18: noten over billedet efter Byt --------------------------------------------------------------------------
const NOTE = () => { const n = document.querySelector('[data-gemtnote]'); return n.hidden ? null : n.textContent.replace(/\s+/g, ' ').trim() }
const ADVARSEL = () => [...document.querySelectorAll('main *')].filter((e) => e.offsetParent !== null && !e.closest('[data-gemtnote]') && /før er det nyeste billede/.test(e.textContent) && ![...e.children].some((c) => /før er det nyeste billede/.test(c.textContent))).map((e) => e.textContent.replace(/\s+/g, ' ').trim()).join(' | ') || null
for (const bredde of [390, 1280]) for (const orden of ['omvendt', 'rigtig']) {
  const T = await side(bredde)
  const aabn = async (buf, name) => { await T.page.setInputFiles('[data-fil]', { name, mimeType: 'image/png', buffer: buf }); await T.page.waitForTimeout(800) }
  const [a, b] = orden === 'omvendt' ? [ugeFil(7, { dy: 18 }).buf, ugeFil(0).buf] : [ugeFil(0).buf, ugeFil(7, { dy: 18 }).buf]
  await aabn(a, 'a.png')
  await tryk(T, '[data-sammenlign]'); await T.page.waitForTimeout(300)
  await tryk(T, '[data-plads="efter"]'); await T.page.waitForTimeout(200)
  await aabn(b, 'b.png')
  const r = { bredde, orden, foer: { note: await T.page.evaluate(NOTE), advarsel: await T.page.evaluate(ADVARSEL) } }
  await tryk(T, '[data-byt]'); await T.page.waitForTimeout(400)
  r.byt1 = { note: await T.page.evaluate(NOTE), advarsel: await T.page.evaluate(ADVARSEL) }
  if (bredde === 390 && orden === 'omvendt') { await T.page.locator('[data-gemtnote]').scrollIntoViewIfNeeded().catch(() => {}); await T.page.screenshot({ path: join(HERE, 'M-390-632-m18-byttet.png') }) }
  await tryk(T, '[data-byt]'); await T.page.waitForTimeout(400)
  r.byt2 = { note: await T.page.evaluate(NOTE), advarsel: await T.page.evaluate(ADVARSEL) }
  r.jsFejl = T.fejl
  ud.m18.push(r)
  await T.ctx.close()
}
const hale = (n) => (n || '').replace(/^.*?Træk i et punkt for at flytte det\.\s*/, '')
const tBYT = /gemt senere end efter; tryk Byt/, tBYTTET = /Før og efter er byttet, så det ældste billede nu er før\./
paastaa('M18 lukket (390 og 1280): omvendt -> noten og advarslen siger "tryk Byt"; efter Byt siger noten "Foer og efter er byttet, saa det aeldste billede nu er foer." og advarslen er vaek; Byt tilbage -> "tryk Byt" igen', ud.m18.filter((r) => r.orden === 'omvendt').every((r) => tBYT.test(r.foer.note) && r.foer.advarsel && tBYTTET.test(r.byt1.note) && !tBYT.test(r.byt1.note) && !r.byt1.advarsel && tBYT.test(r.byt2.note) && r.byt2.advarsel && !r.jsFejl.length), ud.m18.filter((r) => r.orden === 'omvendt' && r.bredde === 390).map((r) => ({ foer: hale(r.foer.note), byt1: hale(r.byt1.note), byt2: hale(r.byt2.note), advarsel: [r.foer.advarsel, r.byt1.advarsel, r.byt2.advarsel] })))
paastaa('M18: rigtig raekkefoelge -> ingen "Byt" i noten; traeneren trykker Byt ved en fejl -> noten og advarslen siger nu "gemt senere end efter; tryk Byt"; tilbage -> "Foer og efter er byttet, saa det aeldste billede nu er foer" (sandt) og ingen advarsel', ud.m18.filter((r) => r.orden === 'rigtig').every((r) => !/Byt|byttet/.test(r.foer.note) && !r.foer.advarsel && tBYT.test(r.byt1.note) && r.byt1.advarsel && !tBYT.test(r.byt2.note || '') && !r.byt2.advarsel && !r.jsFejl.length), ud.m18.filter((r) => r.orden === 'rigtig' && r.bredde === 390).map((r) => ({ foer: hale(r.foer.note), byt1: hale(r.byt1.note), byt2: hale(r.byt2.note) })))
ud.andet.m18Laengde = ud.m18.find((r) => r.orden === 'omvendt' && r.bredde === 390).byt1.note.length

// --- 2) Uger paa 390 og 1280 --------------------------------------------------------------------------------------------
// Otte uger fra 3. aug., 1 runde uden klikfejl (som Yantras skaermbilleder): hoften 40 px (13 cm) op i uge 3 alene og i
// uge 6-8. Og den nyeste uge alene.
const SCEN = {
  enkelt: [0, 0, 40, 0, 0, 40, 40, 40],
  nyeste: [0, 0, 0, 0, 0, 0, 0, 40],
}
const pngFra = {}
for (const [navn, DY] of Object.entries(SCEN)) for (const bredde of [390, 1280]) {
  const T = await side(bredde)
  await vaelgUger(T, DY.map((dy, k) => ({ name: `maal-dl-gulv-${k}.png`, buf: ugeFil(k, { dy }).buf })))
  const d = await T.page.evaluate(UGE_DOM)
  const rullet = await T.page.evaluate(() => {
    const rul = document.querySelector('.mb-ugerul'); rul.scrollIntoView({ block: 'start' }); rul.scrollLeft = rul.scrollWidth
    const r = (e) => e.getBoundingClientRect(); const fra = rul.querySelector('[data-ugefra]')
    const synlige = [...rul.querySelectorAll('thead th[data-uge]')].filter((th) => { const b = r(th); return b.right > r(fra).right + 2 && b.left < r(rul).right - 2 }).map((th) => th.textContent.replace(/\s+/g, ' ').trim().slice(0, 14))
    return { fraVenstre: Math.round(r(fra).left - r(rul).left), fraTekst: fra.textContent.replace(/\s+/g, ' ').trim(), fraBredde: Math.round(r(fra).width), synlige, aeldsteSes: synlige.some((s) => s.startsWith('3. aug')) }
  })
  await T.page.waitForTimeout(200)
  if (bredde === 390) await T.page.screenshot({ path: join(HERE, `M-390-632-${navn}-rullet.png`) })
  await T.page.evaluate(() => { document.querySelector('.mb-ugerul').scrollLeft = 0; document.querySelector('[data-ugefase]').scrollIntoView({ block: 'start' }) })
  await T.page.waitForTimeout(200)
  await T.page.screenshot({ path: join(HERE, `M-${bredde}-632-${navn}.png`) })
  // Gem ugerne med tallene: filen fra siden.
  let png = null
  if (d.gemKnap) {
    const [dl] = await Promise.all([T.page.waitForEvent('download', { timeout: 30000 }), tryk(T, '[data-gemuger]')])
    const buf = readFileSync(await dl.path()); png = { navn: dl.suggestedFilename(), ...ihdr(buf), bytes: buf.length, enTr: dele(buf).some((x) => x.type === 'enTr'), buf }
  }
  const data = await T.page.evaluate(() => window.maalBillede.ugeData())
  ud.ui.push({ navn, bredde, ...d, rullet, png: png && { ...png, buf: undefined }, jsFejl: T.fejl })
  if (bredde === 390) pngFra[navn] = { png, data }
  await T.ctx.close()
}
const U = (n, b) => ud.ui.find((u) => u.navn === n && u.bredde === b)
const hofte = (u, id = 'hofteHoejde') => u.sek[0].raekker.find((r) => r.id === id)
const E390 = U('enkelt', 390)
ud.andet.enkeltCeller = { hoftensHoejde: hofte(E390).celler.map((c) => `${c.tekst}${c.guld ? ' [guld]' : c.over ? ' [over]' : ''}`), hoftevinkel: E390.sek[0].raekker.find((r) => /^Hoftevinkel/.test(r.navn))?.celler.map((c) => `${c.tekst}${c.guld ? ' [guld]' : c.over ? ' [over]' : ''}`) }
paastaa('Uger (390 og 1280): uge 3 alene over graensen staar uden guld og uden ≈ (data-over), uge 6-8 staar i guld (data-guld); ingen celle i uge 2, 4, 5 er over', ['enkelt'].every((n) => [390, 1280].every((b) => { const r = hofte(U(n, b)).celler; return r[2].over && !r[2].guld && !r[2].inden && [5, 6, 7].every((i) => r[i].guld) && [1, 3, 4].every((i) => !r[i].over) && !U(n, b).jsFejl.length })), ud.andet.enkeltCeller)
ud.andet.enkeltStil = { over: hofte(E390).celler[2], guld: hofte(E390).celler[5], inden: hofte(E390).celler[1] }
paastaa('fund: en enkelt uge over graensen skilles fra "inden for maalefejlen" kun ved at ≈ mangler; tallet har samme farve og vaegt som en celle inden for (ingen egen markering), og 13 cm hoften op i een uge staar lige saa stille som 0 cm', !ud.andet.enkeltStil.over.guld && ud.andet.enkeltStil.over.vaegt !== ud.andet.enkeltStil.guld.vaegt, { over: ud.andet.enkeltStil.over, guld: ud.andet.enkeltStil.guld, inden: ud.andet.enkeltStil.inden })
paastaa('M20 lukket (390 og 1280): den faste celle siger "Maal forskel fra 3. aug. 2026", og rullet helt ud paa 390 staar den stadig til venstre, mens den aeldste kolonne er ude af syne', ud.ui.every((u) => /^Mål\s*forskel fra 3\. aug\. 2026$/.test(u.sek[0].fra)) && Math.abs(E390.rullet.fraVenstre) <= 1 && !E390.rullet.aeldsteSes && /forskel fra 3\. aug\. 2026/.test(E390.rullet.fraTekst), { fra: E390.sek[0].fra, skrift: E390.sek[0].fraSmaa, rullet: E390.rullet })
const N390 = U('nyeste', 390)
ud.andet.nyeste = { saetning: N390.sek[0].saetning, sidste: hofte(N390).celler.at(-1), guld: N390.sek[0].guld, over: N390.sek[0].over }
paastaa('den nyeste uge alene (13 cm): saetningen over tabellen siger "hoften hoejere", men cellen staar uden guld, og tabellen har 0 guld; de to siger forskelligt om samme uge', /hoften højere/.test(N390.sek[0].saetning) && !hofte(N390).celler.at(-1).guld && hofte(N390).celler.at(-1).over && N390.sek[0].guld === 0, ud.andet.nyeste)
paastaa('Uger: siden ruller ikke sidelaens (390 og 1280) og 0 JS-fejl', ud.ui.every((u) => u.sideRul <= 0 && !u.jsFejl.length), ud.ui.map((u) => `${u.navn} ${u.bredde}: rul ${u.sideRul}, tabel ${u.sek[0].rul.fuld}/${u.sek[0].rul.klient} x ${u.sek[0].rul.hoejde}`))

// --- 3) Det gemte PNG --------------------------------------------------------------------------------------------------
{
  // 12 uger (3 blokke) og een uge i to faser, fra 390.
  const T = await side(390)
  await vaelgUger(T, Array.from({ length: 12 }, (_, k) => ({ name: `u${k}.png`, buf: ugeFil(k, { dy: k >= 6 ? 40 : 0 }).buf })))
  const [dl] = await Promise.all([T.page.waitForEvent('download', { timeout: 30000 }), tryk(T, '[data-gemuger]')])
  const buf = readFileSync(await dl.path())
  ud.png.tolv = { navn: dl.suggestedFilename(), ...ihdr(buf), enTr: dele(buf).some((x) => x.type === 'enTr') }
  // Hvordan ser det ud paa en telefon, der viser billedet i fuld bredde (390 css-px)?
  const E = pngFra.enkelt.png
  writeFileSync(join(dir, 'uger8.png'), E.buf); writeFileSync(join(HERE, 'M-632-uger-gemt-8.png'), E.buf)
  await T.page.setContent(`<body style="margin:0;background:#000"><img src="data:image/png;base64,${E.buf.toString('base64')}" style="width:100%;display:block"></body>`)
  await T.page.waitForTimeout(400)
  await T.page.screenshot({ path: join(HERE, 'M-390-632-uger-gemt-paa-telefon.png') })
  ud.png.telefon = await T.page.evaluate(() => { const i = document.images[0]; return { cssBredde: i.getBoundingClientRect().width, cssHoejde: Math.round(i.getBoundingClientRect().height), skaerme: +(i.getBoundingClientRect().height / innerHeight).toFixed(2) } })
  ud.png.jsFejl = T.fejl
  await T.ctx.close()
}
{
  // Samme guld i filen som paa siden: sidens egne ugeData gennem eksportens ugerTabelTekst (det tegnEksport tegner).
  const { data, png } = pngFra.enkelt
  const blokke = data.flatMap((t) => ugerTabelTekst(t, 'x'))
  const iFil = blokke.reduce((a, b) => a + b.raekker.flat().filter((c) => c.includes(OVER_LINJE)).length, 0)
  const paaSide = U('enkelt', 390).sek[0].guld
  ud.png.otte = { navn: png.navn, w: png.w, h: png.h, enTr: png.enTr, blokke: blokke.length, overLinjer: iFil, sidensGuld: paaSide, fraKolonne: blokke.map((b) => b.kolonner[0]) }
}
const P8 = ud.png.otte, P12 = ud.png.tolv
const skala = ud.png.telefon.cssBredde / 1200
ud.png.skrift = { celle: +(24 * skala).toFixed(1), noter: +(21 * skala).toFixed(1), titel: +(34 * skala).toFixed(1), sidensMindste: 11.7 }
paastaa(`det gemte PNG: 8 uger = ${P8.w}x${P8.h} i ${P8.blokke} blokke, 12 uger = ${P12.w}x${P12.h}; ingen maaling i filen; samme guld som siden (${P8.overLinjer} = ${P8.sidensGuld}); hver blok siger "forskel fra 3. aug. 2026"`, P8.w === 1200 && P8.blokke === 2 && !P8.enTr && !P12.enTr && P8.overLinjer === P8.sidensGuld && P8.fraKolonne.every((k) => /forskel fra 3\. aug\. 2026/.test(k)) && UGER_PR_BLOK === 4, { otte: P8, tolv: P12 })
paastaa(`fund: vist i fuld bredde paa en telefon (390) er PNG'et ${ud.png.telefon.cssHoejde} css-px hoejt (${ud.png.telefon.skaerme} skaerme), cellernes tal ${ud.png.skrift.celle} px og noterne ${ud.png.skrift.noter} px (sidens mindste er 11,7); man skal zoome ca. 1,5-2x for at laese tallene`, ud.png.skrift.celle < 10 && !ud.png.jsFejl.length, { telefon: ud.png.telefon, skrift: ud.png.skrift })

// --- 4) M19: Monte Carlo gennem sidens ugeTabel (med markerGuld) ---------------------------------------------------------
const L = modelFase('dl-gulv', kroppe('doedloeft', null, { hoejde: '180', vaegt: '90', stangKg: 200 }).snit).L
const maalRunde = (q) => maal(q, { fase: 'dl-gulv', skala: null, retning: null, cmPrPx: skalaFraKrop(q, L) })
// dy: fast, eller en funktion af ugen (k) -> px.
function forsoeg(g, { uger, runder, dyAf = () => 0 }) {
  const poster = Array.from({ length: uger }, (_, k) => {
    const Q = iBillede(MP.punkter, { dy: dyAf(k) })
    return { navn: `u${k}`, gemt: mandag(k), faseId: 'dl-gulv', maal: Array.from({ length: runder }, () => maalRunde(klikket(Q, g))) }
  })
  return ugeTabel(poster)
}
function taelTabel(T) {
  const n = T.kolonner.length
  let guld = 0, over = 0, guldHofte = false, overHofte = false
  for (const r of T.raekker) {
    const gi = r.celler.filter((c) => c.guld).length; guld += gi; over += r.celler.filter((c) => c.over).length
    if (r.id === 'hofteHoejde' && gi) guldHofte = true
    if (r.id === 'hofteHoejde' && r.celler.some((c) => c.over)) overHofte = true
  }
  const celler = T.raekker.reduce((a, r) => a + r.celler.slice(1).filter((c) => c.forskel !== null && !c.kameraKrav).length, 0)
  const nyesteGuld = T.raekker.some((r) => r.celler[n - 1].guld)
  const nyesteOver = T.raekker.some((r) => r.celler[n - 1].over)
  const hh = T.raekker.find((r) => r.id === 'hofteHoejde').celler
  return { guld, over, celler, noget: guld > 0, overUdenGuld: over > guld, guldHofte, overHofte, nyesteGuld, nyesteOver, hofteNyesteGuld: hh[n - 1].guld, hofteNyesteOver: hh[n - 1].over, saetning: !/ingen forskel over målefejlen/.test(T.saetning), saetningHofte: /hoften højere/.test(T.saetning), fraBase: T.raekker.some((r) => r.celler.filter((c) => c.guld).length >= 3 && new Set(r.celler.filter((c) => c.guld).map((c) => Math.sign(c.forskel))).size === 1) }
}
function mc(navn, opt, seed) {
  const g = rng(seed); const R = []
  for (let i = 0; i < MC_N; i++) R.push(taelTabel(forsoeg(g, opt)))
  const andel = (k) => +(100 * R.filter((r) => r[k]).length / R.length).toFixed(1)
  const mid = (k) => +(R.reduce((a, r) => a + r[k], 0) / R.length).toFixed(2)
  ud.mc[navn] = { uger: opt.uger, runder: opt.runder, n: MC_N, celler: R[0].celler, guldMiddel: mid('guld'), overMiddel: mid('over'), overAndelAfCeller: +(100 * mid('over') / R[0].celler).toFixed(1), nogetGuld: andel('noget'), overUdenGuld: andel('overUdenGuld'), guldHofte: andel('guldHofte'), overHofte: andel('overHofte'), nyesteGuld: andel('nyesteGuld'), hofteNyesteGuld: andel('hofteNyesteGuld'), hofteNyesteOver: andel('hofteNyesteOver'), saetning: andel('saetning'), saetningHofte: andel('saetningHofte'), guld3iRaekke: andel('fraBase') }
  console.log('mc', navn, JSON.stringify(ud.mc[navn]))
}
for (const [uger, runder] of [[2, 1], [2, 3], [8, 1], [8, 3], [12, 1], [12, 3]]) mc(`nul-${uger}u-${runder}r`, { uger, runder }, 1000 + uger * 10 + runder) // samme frø som 628
for (const [uger, runder] of [[8, 3], [12, 3], [12, 1]]) mc(`hofte5-fra-u5-${uger}u-${runder}r`, { uger, runder, dyAf: (k) => (k >= 4 ? 15 : 0) }, 2000 + uger * 10 + runder)
mc('hofte5-kun-nyeste-12u-3r', { uger: 12, runder: 3, dyAf: (k) => (k === 11 ? 15 : 0) }, 3123)
mc('hofte5-de-to-nyeste-12u-3r', { uger: 12, runder: 3, dyAf: (k) => (k >= 10 ? 15 : 0) }, 3223)
mc('hofte5-een-uge-midt-12u-3r', { uger: 12, runder: 3, dyAf: (k) => (k === 6 ? 15 : 0) }, 3323)
mc('hofte-glidende-0-5-12u-3r', { uger: 12, runder: 3, dyAf: (k) => (15 * k) / 11 }, 3423)
const MC = ud.mc
paastaa(`M19 lukket (min Monte Carlo, ${MC_N} forsoeg, sidens krop som skala, samme frø som 628): SAMME stilling alle uger giver guld et sted i ${MC['nul-8u-3r'].nogetGuld} % (8 uger) og ${MC['nul-12u-3r'].nogetGuld} % (12 uger) med 3 runder, ${MC['nul-8u-1r'].nogetGuld} % og ${MC['nul-12u-1r'].nogetGuld} % med 1 runde (628: 41-59 %); 2 uger ${MC['nul-2u-3r'].nogetGuld} %`, MC['nul-12u-1r'].nogetGuld <= 12 && MC['nul-12u-3r'].nogetGuld <= 12 && MC['nul-2u-3r'].nogetGuld === 0, { nul8: MC['nul-8u-3r'], nul12: MC['nul-12u-3r'], nul12r1: MC['nul-12u-1r'] })
paastaa(`M19: hoften 5 cm op fra uge 5 findes stadig: guld et sted ${MC['hofte5-fra-u5-12u-3r'].nogetGuld} % og i hoftens egen raekke ${MC['hofte5-fra-u5-12u-3r'].guldHofte} % (12 uger, 3 runder); 8 uger ${MC['hofte5-fra-u5-8u-3r'].guldHofte} %; 12 uger 1 runde ${MC['hofte5-fra-u5-12u-1r'].guldHofte} %`, MC['hofte5-fra-u5-12u-3r'].nogetGuld >= 90, { h12: MC['hofte5-fra-u5-12u-3r'], h8: MC['hofte5-fra-u5-8u-3r'], h12r1: MC['hofte5-fra-u5-12u-1r'] })
paastaa(`den nyeste uge: 5 cm kun i den nyeste giver hoftens celle over graensen i ${MC['hofte5-kun-nyeste-12u-3r'].hofteNyesteOver} % og i guld i ${MC['hofte5-kun-nyeste-12u-3r'].hofteNyesteGuld} %, mens saetningen siger "hoften hoejere" i ${MC['hofte5-kun-nyeste-12u-3r'].saetningHofte} %; de to nyeste: guld i ${MC['hofte5-de-to-nyeste-12u-3r'].hofteNyesteGuld} %`, MC['hofte5-kun-nyeste-12u-3r'].hofteNyesteGuld < 5, { kunNyeste: MC['hofte5-kun-nyeste-12u-3r'], deTo: MC['hofte5-de-to-nyeste-12u-3r'] })
paastaa(`resten af tabellen uden aendring: over graensen uden guld (en enkelt uge) staar et sted i ${MC['nul-12u-3r'].overUdenGuld} % af tabellerne (12 uger, 3 runder); ${MC['nul-12u-3r'].overAndelAfCeller} % af cellerne er over (siden siger "ca. 5 %"); af den falske guld er ${MC['nul-12u-3r'].guld3iRaekke} % af tabellerne en raekke med 3+ guld i samme retning (den aeldstes klikfejl)`, true, { nul12: MC['nul-12u-3r'], nul12r1: MC['nul-12u-1r'], glidende: MC['hofte-glidende-0-5-12u-3r'], eenMidt: MC['hofte5-een-uge-midt-12u-3r'] })

// Er node's regning sidens? Tre forsoeg (12 uger, 3 runder) som filer i siden: samme antal guld og over.
{
  const T = await side(1280)
  await T.page.evaluate(() => { const m = window.maalBillede; m.saetKrop({ hoejde: '180', vaegt: '90' }); m.saetStangKg(200); m.saetFase('dl-gulv') })
  ud.mcSide = []
  for (const seed of [11, 12, 13, 14, 15]) {
    const g = rng(seed), g2 = rng(seed)
    const dyAf = (k) => (seed >= 14 && k >= 6 ? 15 : 0)
    const filer = Array.from({ length: 12 }, (_, k) => ({ name: `u${k}.png`, buf: ugeFil(k, { runder: 3, g, dy: dyAf(k) }).buf }))
    const node = taelTabel(forsoeg(g2, { uger: 12, runder: 3, dyAf }))
    await vaelgUger(T, filer)
    const d = await T.page.evaluate(UGE_DOM)
    ud.mcSide.push({ seed, node: [node.guld, node.over], side: [d.sek[0].guld, d.sek[0].over] })
  }
  await T.ctx.close()
}
paastaa('node-regningen er sidens: fem forsoeg (12 uger, 3 runder med klikfejl, to med hoften op fra uge 7) givet siden som filer har samme antal guld og over', ud.mcSide.every((x) => x.node.join() === x.side.join()), ud.mcSide.map((x) => `${x.seed}: node ${x.node}, side ${x.side}`))

// --- 5) Kanter: ingen datoer, 15 uger, M21 og M22 staar -------------------------------------------------------------------
{
  const T = await side(390)
  await vaelgUger(T, [0, 1, 2].map((k) => ({ name: `u${k}.png`, buf: ugeFil(k, { gemt: null, dy: 3 * k }).buf })))
  ud.andet.udenDato = (await T.page.evaluate(UGE_DOM)).sek[0].fra
  await T.ctx.close()
  const T2 = await side(390)
  await T2.page.evaluate(() => window.maalBillede.saetKrop({ hoejde: '165', vaegt: '60' }))
  await vaelgUger(T2, [0, 1, 2].map((k) => ({ name: `u${k}.png`, buf: ugeFil(k, { dy: 3 * k }).buf })))
  const d = await T2.page.evaluate(UGE_DOM)
  ud.andet.m21 = { status: d.status, kamera: d.sek[0].raekker.map((r) => r.celler[1]?.tekst).find((t) => /kameraplads/.test(t || '')) ?? null }
  await T2.ctx.close()
}
paastaa('M20 uden datoer: den faste celle siger "forskel fra den aeldste"', /forskel fra den ældste/.test(ud.andet.udenDato || ''), ud.andet.udenDato)
paastaa('M21 og M22 staar (kun oplysning, Yantra valgte dem fra): 165 cm paa siden naevnes ikke i status; stangens celler siger stadig "samme kameraplads"', true, ud.andet.m21)

ud.eksterne = [...eksterne]
paastaa('alt, siderne proevede at hente udefra, er afbrudt og var kun skrifttypen', [...eksterne].every((u) => /fonts\.(googleapis|gstatic)\.com/.test(u)), [...eksterne])
await browser.close(); server.close()
rmSync(dir, { recursive: true, force: true })
writeFileSync(join(HERE, 'maal-632.json'), JSON.stringify({ ...ud, tjek }, null, 1))
const roede = tjek.filter((t) => !t.ok)
console.log(`\nmaal-632: ${tjek.length - roede.length}/${tjek.length} tjek groenne (${ud.chrome})`)
process.exit(roede.length ? 1 : 0)
