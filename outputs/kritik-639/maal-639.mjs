// Kritik 639, blok 1: Maal dit billede efter Yantras 634 (M21: skalaens maal i status og en anden hoejde i filerne
// siges; M23: "1 uge" i graa under en forskel alene over graensen, "over graensen, 1 uge" i PNG'et; M24: saetningen
// siger det, naar den nyeste uge ikke er i guld). Yantras punkter under "Bhishak boer tjekke" i dag 97:
//   1) M21: 165 paa siden, filer fra een atlet gemt med 180, paa 390 og 1280; er saetningen klar, og er det rigtigt,
//      at siden ikke selv tager filernes hoejde;
//   2) M21 med Min krop: Min krop udfyldt og filer gemt med en skrevet hoejde; filer gemt med Min krop;
//   3) M23: er "1 uge" svagt nok og tydeligt nok (min Monte Carlo fra 628/632: hvor ofte staar det uden aendring);
//   4) M23 i PNG'et: brydes "over graensen, 1 uge" i to linjer, og hvor hoejt er PNG'et nu (M26);
//   5) M24: er saetningen klar, og er listen over raekker rigtig, naar kun nogle af den nyestes forskelle er i guld.
//   node outputs/kritik-639/maal-639.mjs     -> maal-639.json og M-*.png
// Loeftmodellen (main) og sitet (vaerktoejer) hentes med `git archive`; intet trae roeres. Siden maales i sitets kopi
// med main's dist/maal-billede/ lagt oven i (det, Setus kopi vil give). Google Chrome (den installerede) headless,
// 390 touch og 1280 mus, alt net uden for den lokale server afbrudt. Kun syntetiske maalinger og graa flader.
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
const K632 = '2ccb0bb' // det, jeg sagde ja til i 632
const MC_N = +(process.env.MC_N || 2000)
const sh = (c) => execSync(c, { maxBuffer: 1 << 26 }).toString()
const rev = (repo, r) => sh(`git -C "${repo}" rev-parse --short ${r}`).trim()
const ver = { main: rev(LM, 'main'), site: rev(SITE, GREN), k632: K632 }
const erIMain = (b) => sh(`git -C "${LM}" merge-base --is-ancestor refs/heads/${b} main && echo ja || echo nej`).trim()
ver.o634Merget = erIMain('ordre-634')
ver.mainSiden632 = sh(`git -C "${LM}" log --first-parent --format=%h%x20%s ${K632}..main`).trim().split(/\r?\n/).filter(Boolean)
ver.rapporter = sh(`git -C "${LM}" ls-tree --name-only main docs/`).split(/\r?\n/).filter((f) => /RAPPORT-dag-97\.md$/.test(f))
const dir = mkdtempSync(join(tmpdir(), 'k639-'))
const hent = (repo, ref, hvor, stier = '') => { mkdirSync(hvor, { recursive: true }); execSync(`git -c core.autocrlf=false -C "${repo}" archive -o "${join(hvor, 'a.tar')}" ${ref} ${stier}`); execSync('tar -xf a.tar', { cwd: hvor }); rmSync(join(hvor, 'a.tar')) }
const lmMain = join(dir, '_main'), web = join(dir, 'web')
hent(LM, 'main', lmMain, 'dist src kroppe package.json')
hent(SITE, GREN, web)
const tjek = []
const paastaa = (hvad, ok, data) => { tjek.push({ hvad, ok: !!ok, data }); console.log(`${ok ? 'ok ' : 'NEJ'} ${hvad}${data !== undefined ? ' ' + JSON.stringify(data).slice(0, 900) : ''}`) }
const ud = { ver, kopi: {}, m21: {}, minKrop: {}, m23: {}, png: {}, m24: {}, mc: {}, andet: {} }

// --- 0) Hvad er nyt, og hvad skal Setu kopiere ----------------------------------------------------------------
const blobs = (repo, ref, d) => Object.fromEntries(sh(`git -C "${repo}" ls-tree -r ${ref} -- ${d}/`).split('\n').filter(Boolean).map((l) => { const [meta, f] = l.split('\t'); return [f.slice(d.length + 1), meta.split(' ')[2]] }))
const forskelle = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((f) => a[f] !== b[f])
for (const m of ['maal-billede', 'baenk-figurer', 'tre-loeft', 'min-krop']) {
  const site = blobs(SITE, GREN, `assets/vaerktoejer/${m}`)
  ud.kopi[m] = { siteModMain: forskelle(blobs(LM, 'main', `dist/${m}`), site), siteMod4ca: forskelle(blobs(LM, '4ca0c63', `dist/${m}`), site) }
}
ud.kopi.distSiden632 = sh(`git -C "${LM}" diff --name-only ${K632} main -- dist`).trim().split(/\r?\n/).filter(Boolean)
paastaa(`634 er merget (main ${ver.main}), rapport dag 97 ligger paa main; i dist er kun maal-billede.js og index.html aendret siden 632 (${K632})`, ver.o634Merget === 'ja' && ver.rapporter.length === 1 && ud.kopi.distSiden632.join() === 'dist/maal-billede/index.html,dist/maal-billede/maal-billede.js', { nye: ver.mainSiden632, dist: ud.kopi.distSiden632 })
paastaa(`sitet (${ver.site}) er stadig blob for blob 4ca0c63 i alle fire mapper (Setu har ikke kopieret 630); mod main er kun maal-billede's to filer anderledes`, Object.values(ud.kopi).filter((k) => k.siteMod4ca).every((k) => !k.siteMod4ca.length) && ud.kopi['maal-billede'].siteModMain.sort().join() === 'index.html,maal-billede.js' && ['tre-loeft', 'min-krop', 'baenk-figurer'].every((m) => !ud.kopi[m].siteModMain.length), { site: ver.site, maal: ud.kopi['maal-billede'].siteModMain })

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
const imp = (f) => import(pathToFileURL(join(lmMain, 'src', f)).href)
const { PUNKTER, SKIVE_CM, maal, skalaFraKrop } = await imp('maalBillede.js')
const { kroppe, modelFase, MIN_KROP_LAGER } = await imp('maalBilledeModel.js')
const { gennemsnitsMaal } = await imp('minKrop.js')
const { ugeTabel } = await imp('maalUger.js')
const { OVER_LINJE, ALENE_LINJE, UGER_PR_BLOK } = await imp('maalEksport.js')
// En syntetisk Min krop: gennemsnittet for 178 cm og 85 kg med 10 % laengere laar (som Yantras 510-test).
const snit178 = gennemsnitsMaal(178, 85)
const MIN_KROP = { ...snit178, laar: Math.round(snit178.laar * 1.1 * 10) / 10 }
async function side(bredde, { minKrop = null } = {}) {
  const mobil = bredde < 500
  const ctx = await browser.newContext({ viewport: { width: bredde, height: mobil ? 844 : 900 }, deviceScaleFactor: mobil ? 3 : 1, isMobile: mobil, hasTouch: mobil, acceptDownloads: true })
  if (minKrop) await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v) } catch {} }, [MIN_KROP_LAGER, JSON.stringify(minKrop)])
  const page = await ctx.newPage()
  const T = { ctx, page, mobil, bredde, fejl: [] }
  page.on('pageerror', (e) => T.fejl.push(e.message))
  await page.route('**/*', (r) => { const u = r.request().url(); if (u.startsWith(BASE) || /^(data|blob):/.test(u)) return r.continue(); eksterne.add(u.split('?')[0]); return r.abort() })
  await page.goto(`${BASE}${V}/maal-billede/index.html`, { waitUntil: 'load' })
  await page.waitForSelector('[data-klar]')
  return T
}
async function tryk(T, sel) { const l = T.page.locator(sel).first(); await l.scrollIntoViewIfNeeded(); if (T.mobil) await l.tap(); else await l.click() }
async function skriv(T, sel, v) { const l = T.page.locator(sel).first(); await l.scrollIntoViewIfNeeded(); await l.fill(v); await T.page.waitForTimeout(400) }

// --- Modellen og een fil gemt af siden selv (som 628 og 632) --------------------------------------------------------
const PX = 3 // px pr. cm i billedet
const iBillede = (P, { x0 = 600, y0 = 1300, dy = 0, dkx = 0 } = {}) => { const o = {}; for (const { id } of PUNKTER) o[id] = { x: x0 + P[id].x * PX + (id === 'knae' ? dkx : 0), y: y0 - P[id].y * PX - (id === 'hofte' ? dy : 0) }; o.skalaA = { x: o.stang.x, y: o.stang.y - (SKIVE_CM / 2) * PX }; return o }
const MP = modelFase('dl-gulv', kroppe('doedloeft', null, { hoejde: '180', stangKg: 200 }).snit)
const Q0 = iBillede(MP.punkter)
const graaFlade = async (T) => T.page.evaluate(async () => {
  const k = document.createElement('canvas'); k.width = 1000; k.height = 1400; const x = k.getContext('2d'); x.fillStyle = '#556'; x.fillRect(0, 0, 1000, 1400)
  const url = URL.createObjectURL(await new Promise((ok) => k.toBlob(ok, 'image/png')))
  return window.maalBillede.laesBillede(url, 'IMG_4411.jpg', true)
})
async function gemEn(T, krop) {
  await graaFlade(T)
  await T.page.evaluate(([Q, krop]) => { const m = window.maalBillede; if (krop) m.saetKrop(krop); m.saetStangKg(200); m.saetFase('dl-gulv'); m.saetPunkter(Q) }, [Q0, krop])
  await T.page.waitForTimeout(300)
  const [dl] = await Promise.all([T.page.waitForEvent('download'), tryk(T, '[data-gem]')])
  return readFileSync(await dl.path())
}
let basis, basisMinKrop
{ const T = await side(1280); basis = await gemEn(T, { hoejde: '180', vaegt: '90' }); await T.ctx.close() }
// Min PNG-laeser og -skriver (uafhaengig af maalGemt.js), som i 610, 628 og 632.
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 } return (b) => { let c = 0xffffffff; for (const x of b) c = t[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 } })()
function dele(buf) { const b = Buffer.from(buf); const r = []; let i = 8; while (i + 12 <= b.length) { const n = b.readUInt32BE(i); const type = b.toString('latin1', i + 4, i + 8); if (i + 12 + n > b.length) break; r.push({ type, n, raa: b.subarray(i, i + 12 + n) }); i += 12 + n; if (type === 'IEND') break } return r }
const lavDel = (type, data) => { const b = Buffer.alloc(12 + data.length); b.writeUInt32BE(data.length, 0); b.write(type, 4, 'latin1'); data.copy(b, 8); b.writeUInt32BE(CRC(b.subarray(4, 8 + data.length)), 8 + data.length); return b }
const SIG = Buffer.from('89504e470d0a1a0a', 'hex')
const laesMeta = (buf) => { const d = dele(buf).find((x) => x.type === 'enTr'); const data = d.raa.subarray(8, 8 + d.n); const jl = data.readUInt32BE(21); return JSON.parse(data.toString('utf8', 25, 25 + jl)) }
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
function ugeFil(k, { dy = 0, dkx = 0, runder = 1, g = null, hoejde = '180', gemt = mandag(k), navn = `IMG_${4411 + k}.jpg`, fra = basis } = {}) {
  const Q = iBillede(MP.punkter, { dy, dkx })
  const R = Array.from({ length: runder }, () => (g ? klikket(Q, g) : Q))
  return { runder: R, buf: medMeta(fra, (m) => { if (gemt) m.gemt = gemt; else delete m.gemt; if (hoejde !== null) m.faelles.hoejde = hoejde; m.faelles.faseId = 'dl-gulv'; m.pladser[0].navn = navn; m.pladser[0].punkter = R[R.length - 1]; m.pladser[0].runder = R.slice(0, -1) }) }
}
async function vaelgUger(T, filer) {
  await T.page.setInputFiles('[data-ugefiler]', filer.map((f, k) => ({ name: f.name ?? `maal-dl-gulv-${k}.png`, mimeType: 'image/png', buffer: f.buf })))
  await T.page.waitForFunction(() => document.querySelector('[data-ugestatus]').textContent.length > 0, null, { timeout: 30000 })
  await T.page.waitForTimeout(300)
}
const UGE_DOM = () => {
  const tekst = (e) => (e ? e.textContent.replace(/\s+/g, ' ').trim() : null)
  const stil = (e) => { if (!e) return null; const s = getComputedStyle(e); return { farve: s.color, str: parseFloat(s.fontSize), vaegt: s.fontWeight } }
  const st = document.querySelector('[data-ugestatus]')
  const sek = [...document.querySelectorAll('[data-ugefase]')].map((s) => {
    const t = s.querySelector('[data-ugetabel]'), rul = s.querySelector('.mb-ugerul')
    return {
      raekker: [...t.querySelectorAll('tbody tr')].map((tr) => ({ id: tr.dataset.id, navn: tekst(tr.children[0]), celler: [...tr.children].slice(1).map((td) => ({ tekst: tekst(td), guld: !!td.querySelector('[data-guld]'), over: !!td.querySelector('[data-over]'), alene: !!td.querySelector('[data-alene]'), inden: /≈/.test(td.textContent), hoejde: Math.round(td.getBoundingClientRect().height) })) })),
      stil: { tal: stil(t.querySelector('tbody td:nth-child(3)')), alene: stil(t.querySelector('[data-alene]')), over: stil(t.querySelector('[data-over]:not([data-guld])')), guld: stil(t.querySelector('[data-guld]')), inden: stil([...t.querySelectorAll('tbody td small')].find((e) => /≈/.test(e.textContent))), navnSmaa: stil(t.querySelector('tbody th small, tbody td:first-child small')) },
      guld: t.querySelectorAll('[data-guld]').length, over: t.querySelectorAll('[data-over]').length, alene: t.querySelectorAll('[data-alene]').length,
      saetning: tekst(s.querySelector('[data-ugesaetning]')),
      rul: { klient: rul.clientWidth, fuld: rul.scrollWidth, hoejde: Math.round(rul.getBoundingClientRect().height) },
    }
  })
  const lh = parseFloat(getComputedStyle(st).lineHeight) || parseFloat(getComputedStyle(st).fontSize) * 1.4
  return { status: tekst(st), afvig: st.hasAttribute('data-ugeafvig'), statusLinjer: Math.round(st.getBoundingClientRect().height / lh), statusStil: stil(st), sek, forklaring: tekst(document.querySelector('[data-ugeforklaring]')), sideRul: document.scrollingElement.scrollWidth - innerWidth, hoejdeFelt: document.querySelector('[data-hoejde]').value, kropFelterSkjult: !!document.querySelector('[data-kropfelter]')?.hidden, bg: getComputedStyle(document.body).backgroundColor }
}
const hofte = (d, id = 'hofteHoejde') => d.sek[0].raekker.find((r) => r.id === id)
const cmRaekker = (d) => d.sek[0].raekker.filter((r) => / cm/.test(r.celler[0].tekst || '')).map((r) => ({ id: r.id, v: r.celler.map((c) => parseFloat((c.tekst.match(/^-?[\d,]+/) || ['NaN'])[0].replace(',', '.'))) }))
// Gem ugerne med tallene: filen og hver tekst, eksporten tegner (fillText fanges i siden, mens der gemmes).
async function gemUger(T) {
  await T.page.evaluate(() => { window.__tekster = []; const f = CanvasRenderingContext2D.prototype.fillText; if (!window.__fanget) { window.__fanget = true; CanvasRenderingContext2D.prototype.fillText = function (t, x, y, ...r) { window.__tekster.push({ t: String(t), x, y, farve: this.fillStyle, font: this.font }); return f.call(this, t, x, y, ...r) } } })
  const [dl] = await Promise.all([T.page.waitForEvent('download', { timeout: 30000 }), tryk(T, '[data-gemuger]')])
  const buf = readFileSync(await dl.path())
  const tekster = await T.page.evaluate(() => window.__tekster)
  return { navn: dl.suggestedFilename(), ...ihdr(buf), enTr: dele(buf).some((x) => x.type === 'enTr'), buf, tekster }
}

// --- 1) M21: 165 paa siden, filer fra een atlet gemt med 180 (390 og 1280) ---------------------------------------------
// Otte uger fra 3. aug., 1 runde uden klikfejl (som Yantras skaermbilleder): hoften 40 px (13 cm) op i uge 3 alene,
// i uge 5-6 og i den nyeste alene.
const DY = [0, 0, 40, 0, 40, 40, 0, 40]
const FILER = DY.map((dy, k) => ({ buf: ugeFil(k, { dy }).buf }))
for (const bredde of [390, 1280]) {
  const T = await side(bredde)
  await skriv(T, '[data-hoejde]', '165')
  await vaelgUger(T, FILER)
  const f165 = await T.page.evaluate(UGE_DOM)
  await T.page.locator('[data-ugestatus]').scrollIntoViewIfNeeded(); await T.page.evaluate(() => scrollBy(0, -40)); await T.page.waitForTimeout(200)
  await T.page.screenshot({ path: join(HERE, `M-${bredde}-639-m21-165.png`) })
  const png165 = bredde === 390 ? await gemUger(T) : null
  await skriv(T, '[data-hoejde]', '180')
  const f180 = await T.page.evaluate(UGE_DOM)
  await T.page.locator('[data-ugestatus]').scrollIntoViewIfNeeded(); await T.page.evaluate(() => scrollBy(0, -40)); await T.page.waitForTimeout(200)
  await T.page.screenshot({ path: join(HERE, `M-${bredde}-639-m21-180.png`) })
  ud.m21[bredde] = { f165: { status: f165.status, afvig: f165.afvig, linjer: f165.statusLinjer, hoejdeFelt: f165.hoejdeFelt, cm: cmRaekker(f165) }, f180: { status: f180.status, afvig: f180.afvig, linjer: f180.statusLinjer, cm: cmRaekker(f180) }, sideRul: [f165.sideRul, f180.sideRul], jsFejl: T.fejl }
  if (png165) { ud.m21.png165 = { w: png165.w, h: png165.h, enTr: png165.enTr, afvigINoten: png165.tekster.map((x) => x.t).join(' ').replace(/\s+/g, ' ').includes('siden bruger 165 cm') }; }
  await T.ctx.close()
}
{
  // Tom hoejde paa siden: siden tager den aeldstes 180 (som foer 634), og tallene er de samme som efter 180 i feltet.
  const T = await side(390)
  await vaelgUger(T, FILER)
  const d = await T.page.evaluate(UGE_DOM)
  ud.m21.tom = { status: d.status, afvig: d.afvig, hoejdeFelt: d.hoejdeFelt, cm: cmRaekker(d) }
  // Blandet: uge 1-4 gemt med 180, uge 5-8 med 165 (to atleter i samme mappe eller en rettet hoejde); siden har 180.
  await vaelgUger(T, DY.map((dy, k) => ({ buf: ugeFil(k, { dy, hoejde: k < 4 ? '180' : '165' }).buf })))
  const b = await T.page.evaluate(UGE_DOM)
  ud.m21.blandet = { status: b.status, afvig: b.afvig }
  // Filer uden gyldig hoejde (tomt felt, som gemt med Min krop) med 165 paa siden: intet siges.
  await skriv(T, '[data-hoejde]', '165')
  await vaelgUger(T, DY.map((dy, k) => ({ buf: ugeFil(k, { dy, hoejde: '' }).buf })))
  const u = await T.page.evaluate(UGE_DOM)
  ud.m21.udenHoejde = { status: u.status, afvig: u.afvig }
  ud.m21.jsFejlTom = T.fejl
  await T.ctx.close()
}
{
  const M = ud.m21, v = (x, id) => x.cm.find((r) => r.id === id)
  const kol = (x) => x.cm[0].v
  ud.m21.forhold = +(M[390].f180.cm.reduce((a, r) => a + r.v.reduce((s, y) => s + (Number.isFinite(y) ? y : 0), 0), 0) / M[390].f165.cm.reduce((a, r) => a + r.v.reduce((s, y) => s + (Number.isFinite(y) ? y : 0), 0), 0)).toFixed(3)
  ud.m21.statusTegn = M[390].f165.status.length
  paastaa(`M21 (390 og 1280): 165 paa siden og filer gemt med 180 -> status siger "kroppens laengder (165 cm fra siden)" og "Filerne er gemt med hoejden 180 cm; siden bruger 165 cm ... skriv den i hoejdefeltet" (${M[390].f165.linjer} linjer paa 390); 180 i feltet -> saetningen er vaek, og cm-raekkerne er ${M.forhold} gange stoerre`, [390, 1280].every((b) => /kroppens længder \(165 cm fra siden\)/.test(M[b].f165.status) && /Filerne er gemt med højden 180 cm; siden bruger 165 cm, og alle uger er regnet med sidens\. Er filernes højde den rigtige, så skriv den i højdefeltet\./.test(M[b].f165.status) && M[b].f165.afvig && !M[b].f180.afvig && /\(180 cm fra siden\)/.test(M[b].f180.status) && !/Filerne er gemt/.test(M[b].f180.status) && !M[b].jsFejl.length) && M.forhold > 1.05, { status390: M[390].f165.status, efter180: M[390].f180.status, linjer: [M[390].f165.linjer, M[1280].f165.linjer] })
  paastaa('M21: 180 skrevet i feltet giver de samme tal som en tom side, der tager den aeldstes 180 (og den tomme side siger intet om en anden hoejde)', JSON.stringify(M[390].f180.cm) === JSON.stringify(M.tom.cm) && !M.tom.afvig && M.tom.hoejdeFelt === '180', { tom: M.tom.status })
  paastaa('M21 i det gemte PNG: noten siger "siden bruger 165 cm" (390); ingen maaling i filen', M.png165 && M.png165.afvigINoten && !M.png165.enTr, M.png165)
  paastaa(`fund (lav): blandede filer (4 med 180, 4 med 165) og 180 paa siden -> "${(M.blandet.status.match(/Filerne er gemt[^.]*\./) || [''])[0]}"; saetningen siger "Filerne", men kun halvdelen er gemt med 165, og ikke hvilke uger`, M.blandet.afvig && /Filerne er gemt med højden 165 cm/.test(M.blandet.status), M.blandet)
  paastaa('graense (som Yantra siger): filer uden gyldig hoejde (tomt felt) og 165 paa siden -> intet siges', !M.udenHoejde.afvig && !/Filerne er gemt/.test(M.udenHoejde.status), M.udenHoejde)
}

// --- 2) M21 med Min krop ---------------------------------------------------------------------------------------------
{
  const T = await side(390, { minKrop: MIN_KROP })
  await vaelgUger(T, FILER)
  const d = await T.page.evaluate(UGE_DOM)
  await T.page.locator('[data-ugestatus]').scrollIntoViewIfNeeded(); await T.page.evaluate(() => scrollBy(0, -40)); await T.page.waitForTimeout(200)
  await T.page.screenshot({ path: join(HERE, 'M-390-639-minkrop.png') })
  ud.minKrop.med180 = { status: d.status, afvig: d.afvig, kropFelterSkjult: d.kropFelterSkjult, hoejdeFelt: d.hoejdeFelt, minKropLink: await T.page.evaluate(() => !!document.querySelector('[data-ugestatus] a')) }
  // En maaling gemt paa siden med Min krop (hoejdefeltet er skjult): hvad staar der i filen?
  const T2 = await side(1280, { minKrop: MIN_KROP })
  basisMinKrop = await gemEn(T2, null)
  ud.minKrop.gemtFaelles = (({ hoejde, vaegt }) => ({ hoejde, vaegt }))(laesMeta(basisMinKrop).faelles)
  ud.minKrop.gemtNoegler = Object.keys(laesMeta(basisMinKrop)).concat(Object.keys(laesMeta(basisMinKrop).faelles).map((k) => `faelles.${k}`))
  await T2.ctx.close()
  // Filer gemt med Min krop (178) aabnet paa en side med 165 skrevet (en anden browser, en anden atlet): intet siges.
  const T3 = await side(390)
  await skriv(T3, '[data-hoejde]', '165')
  await vaelgUger(T3, DY.map((dy, k) => ({ buf: ugeFil(k, { dy, hoejde: null, fra: basisMinKrop }).buf })))
  const e = await T3.page.evaluate(UGE_DOM)
  ud.minKrop.filerMedMinKrop165 = { status: e.status, afvig: e.afvig }
  ud.minKrop.jsFejl = [...T.fejl, ...T2.fejl, ...T3.fejl]
  await T3.ctx.close(); await T.ctx.close()
}
paastaa('M21 med Min krop (390): status siger "kroppens laengder (Min krop, 178 cm)" og "Filerne er gemt med hoejden 180 cm; siden bruger 178 cm fra Min krop ... saa ret Min krop"; hoejdefeltet er skjult', /kroppens længder \(Min krop, 178 cm\)/.test(ud.minKrop.med180.status) && /siden bruger 178 cm fra Min krop.*ret Min krop\./.test(ud.minKrop.med180.status) && ud.minKrop.med180.kropFelterSkjult && !ud.minKrop.jsFejl.length, ud.minKrop.med180)
paastaa(`fund (lav): en maaling gemt med Min krop har hoejden "${ud.minKrop.gemtFaelles.hoejde}" i filen (178 cm fra Min krop gemmes ikke); aabnes filerne paa en side med 165, siges intet, og alle uger regnes med 165`, ud.minKrop.gemtFaelles.hoejde === '' && !ud.minKrop.filerMedMinKrop165.afvig, { gemt: ud.minKrop.gemtFaelles, side165: ud.minKrop.filerMedMinKrop165.status })

// --- 3) M23 paa siden ------------------------------------------------------------------------------------------------
const kontrast = (a, b) => { const L = (s) => { const [r, g, bb] = s.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }); return 0.2126 * r + 0.7152 * g + 0.0722 * bb }; const [x, y] = [L(a), L(b)].sort((p, q) => q - p); return +((x + 0.05) / (y + 0.05)).toFixed(2) }
for (const bredde of [390, 1280]) {
  const T = await side(bredde)
  await vaelgUger(T, FILER)
  const d = await T.page.evaluate(UGE_DOM)
  const bg = await T.page.evaluate(() => { let e = document.querySelector('[data-ugetabel] td'); while (e) { const c = getComputedStyle(e).backgroundColor; if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c; e = e.parentElement } return getComputedStyle(document.body).backgroundColor })
  await T.page.evaluate(() => document.querySelector('[data-ugetabel] tr[data-id="hofteHoejde"]').scrollIntoView({ block: 'center' })); await T.page.waitForTimeout(200)
  await T.page.screenshot({ path: join(HERE, `M-${bredde}-639-m23-1uge.png`) })
  if (bredde === 390) { await T.page.evaluate(() => { const r = document.querySelector('.mb-ugerul'); r.scrollLeft = r.scrollWidth }); await T.page.waitForTimeout(200); await T.page.screenshot({ path: join(HERE, 'M-390-639-m23-1uge-rullet.png') }) }
  const h = hofte(d).celler
  ud.m23[bredde] = { hofte: h.map((c) => `${c.tekst}${c.guld ? ' [guld]' : c.alene ? ' [1 uge]' : ''}`), stil: d.sek[0].stil, bg, guld: d.sek[0].guld, over: d.sek[0].over, alene: d.sek[0].alene, cellehoejde: { alene: h[2].hoejde, guld: h[4].hoejde, inden: h[1].hoejde }, forklaring: d.forklaring, sideRul: d.sideRul, jsFejl: T.fejl }
  ud.m23[bredde].kontrast = { alene: kontrast(d.sek[0].stil.alene.farve, bg), inden: d.sek[0].stil.inden ? kontrast(d.sek[0].stil.inden.farve, bg) : null, tal: kontrast(d.sek[0].stil.tal.farve, bg) }
  await T.ctx.close()
}
{
  const A = ud.m23[390]
  paastaa(`M23 (390 og 1280): uge 3 og uge 8 alene har "1 uge" (data-alene), uge 5-6 guld, ingen "1 uge" ved ≈ eller guld; siden har ${A.alene} "1 uge" og ${A.guld} guld`, [390, 1280].every((b) => { const h = ud.m23[b].hofte; return /\[1 uge\]$/.test(h[2]) && /\[1 uge\]$/.test(h[7]) && /\[guld\]$/.test(h[4]) && /\[guld\]$/.test(h[5]) && !/1 uge.*1 uge/.test(h.join('|').split('|').filter((c) => /≈/.test(c)).join()) && ud.m23[b].alene === ud.m23[b].over - ud.m23[b].guld && !ud.m23[b].jsFejl.length }), A.hofte)
  paastaa(`M23 stil: "1 uge" er ${A.stil.alene.str} px ${A.stil.alene.farve} (kontrast ${A.kontrast.alene}:1 mod ${A.bg}), tallet over den ${A.stil.over.str} px ${A.stil.over.farve}, ≈-cellens forskel ${A.stil.inden?.str} px ${A.stil.inden?.farve}, guld ${A.stil.guld.farve} vaegt ${A.stil.guld.vaegt}; cellen med "1 uge" er ${A.cellehoejde.alene} px hoej mod ${A.cellehoejde.inden} (≈)`, A.stil.alene.str < A.stil.over.str && A.stil.alene.farve !== A.stil.guld.farve && A.kontrast.alene >= 4.5, { stil: A.stil, kontrast: A.kontrast, cellehoejde: A.cellehoejde })
}

// --- 4) M23 i det gemte PNG og M26 ---------------------------------------------------------------------------------
async function pngFor(dyer, bredde = 390) {
  const T = await side(bredde)
  await vaelgUger(T, dyer.map((dy, k) => ({ buf: ugeFil(k, { dy }).buf })))
  const d = await T.page.evaluate(UGE_DOM)
  const p = await gemUger(T)
  await T.ctx.close()
  const linjer = p.tekster.map((x) => x.t)
  // "over graensen, 1 uge" hel paa een linje, eller brudt i "over graensen, 1" + "uge" (eller andre brud).
  const hel = linjer.filter((l) => l === ALENE_LINJE).length
  const brudt = linjer.filter((l, i) => ALENE_LINJE.startsWith(l) && l !== ALENE_LINJE && l.length > 3 && ALENE_LINJE === `${l} ${linjer[i + 1]}`).length
  const guldHel = linjer.filter((l) => l === OVER_LINJE).length
  const guldBrudt = linjer.filter((l, i) => OVER_LINJE.startsWith(l) && l !== OVER_LINJE && l.length > 3 && OVER_LINJE === `${l} ${linjer[i + 1]}`).length
  const graa = p.tekster.filter((x) => x.t === ALENE_LINJE || (ALENE_LINJE.startsWith(x.t) && x.t.length > 3)).map((x) => x.farve)
  return { w: p.w, h: p.h, enTr: p.enTr, hel, brudt, guldHel, guldBrudt, sideAlene: d.sek[0].alene, sideGuld: d.sek[0].guld, graa: [...new Set(graa)], m24: linjer.join(' ').replace(/\s+/g, ' ').includes('Den nyeste uge står ikke i guld'), buf: p.buf }
}
ud.png.otte = await pngFor(DY)
ud.png.tolv = await pngFor([...DY, 0, 40, 40, 0])
ud.png.otteUden = await pngFor(DY.map(() => 0)) // ingen aendring, uden klikfejl: ingen over
writeFileSync(join(HERE, 'M-639-uger-gemt-8.png'), ud.png.otte.buf)
{
  // Hvordan ser det ud paa en telefon, der viser billedet i fuld bredde (390 css-px)?
  const T = await side(390)
  await T.page.setContent(`<body style="margin:0;background:#000"><img src="data:image/png;base64,${ud.png.otte.buf.toString('base64')}" style="width:100%;display:block"></body>`)
  await T.page.waitForTimeout(400)
  ud.png.telefon = await T.page.evaluate(() => { const i = document.images[0]; return { cssBredde: i.getBoundingClientRect().width, cssHoejde: Math.round(i.getBoundingClientRect().height), skaerme: +(i.getBoundingClientRect().height / innerHeight).toFixed(2) } })
  await T.page.evaluate(() => scrollTo(0, document.images[0].getBoundingClientRect().height * 0.25)); await T.page.waitForTimeout(200)
  await T.page.screenshot({ path: join(HERE, 'M-390-639-uger-gemt-paa-telefon.png') })
  await T.ctx.close()
}
for (const k of ['otte', 'tolv', 'otteUden']) delete ud.png[k].buf
{
  const P = ud.png
  paastaa(`M23 i PNG'et: hver "1 uge" paa siden har "over graensen, 1 uge" i filen (8 uger: ${P.otte.hel + P.otte.brudt} = ${P.otte.sideAlene}; 12 uger: ${P.tolv.hel + P.tolv.brudt} = ${P.tolv.sideAlene}), i graa (${P.otte.graa.join(', ')}); guld det samme (${P.otte.guldHel + P.otte.guldBrudt} = ${P.otte.sideGuld}); ingen maaling i filen`, P.otte.hel + P.otte.brudt === P.otte.sideAlene && P.tolv.hel + P.tolv.brudt === P.tolv.sideAlene && P.otte.guldHel + P.otte.guldBrudt === P.otte.sideGuld && P.otte.graa.length === 1 && !P.otte.enTr && !P.tolv.enTr, { otte: P.otte, tolv: P.tolv })
  paastaa(`M23/M26 i PNG'et: "over graensen, 1 uge" brydes i to linjer i ${P.otte.brudt} af ${P.otte.brudt + P.otte.hel} celler (guldlinjen i ${P.otte.guldBrudt} af ${P.otte.guldBrudt + P.otte.guldHel}); 8 uger er ${P.otte.w} x ${P.otte.h} (632: 1200 x 2648), 12 uger ${P.tolv.w} x ${P.tolv.h} (632: 1200 x 3714), uden nogen over ${P.otteUden.w} x ${P.otteUden.h}; paa en telefon i fuld bredde ${P.telefon.skaerme} skaerme`, P.otte.w === 1200 && UGER_PR_BLOK === 4, { otte: [P.otte.w, P.otte.h], tolv: [P.tolv.w, P.tolv.h], uden: [P.otteUden.w, P.otteUden.h], telefon: P.telefon })
}

// --- 5) M24: den nyeste uge -------------------------------------------------------------------------------------------
const M24_SCEN = {
  kunNyeste: { dy: [0, 0, 0, 0, 0, 0, 0, 40], dkx: [0, 0, 0, 0, 0, 0, 0, 0] },
  guldOgAlene: { dy: [0, 0, 0, 0, 0, 0, 40, 40], dkx: [0, 0, 0, 0, 0, 0, 0, 24] }, // hoften op i uge 7-8 (guld), knaeet 8 cm frem kun i uge 8
  kunGuld: { dy: [0, 0, 0, 0, 0, 0, 40, 40], dkx: [0, 0, 0, 0, 0, 0, 0, 0] },
  modsat: { dy: [0, 0, 0, 0, 0, 0, 40, -40], dkx: [0, 0, 0, 0, 0, 0, 0, 0] }, // op i uge 7, ned i uge 8
}
for (const [navn, s] of Object.entries(M24_SCEN)) for (const bredde of navn === 'guldOgAlene' ? [390, 1280] : [390]) {
  const T = await side(bredde)
  await vaelgUger(T, s.dy.map((dy, k) => ({ buf: ugeFil(k, { dy, dkx: s.dkx[k] }).buf })))
  const d = await T.page.evaluate(UGE_DOM)
  const sidste = d.sek[0].raekker.map((r) => ({ navn: r.navn, c: r.celler.at(-1) }))
  const data = await T.page.evaluate(() => window.maalBillede.ugeData().map((t) => ({ saetning: t.saetning, nyesteAlene: t.nyesteAlene, raekker: t.raekker.map((r) => ({ navn: r.navn, over: r.celler.at(-1).over, guld: r.celler.at(-1).guld })) })))
  if (navn === 'guldOgAlene') { await T.page.evaluate(() => document.querySelector('[data-ugesaetning]').scrollIntoView({ block: 'start' })); await T.page.waitForTimeout(200); await T.page.screenshot({ path: join(HERE, `M-${bredde}-639-m24-guld-og-alene.png`) }) }
  let pngM24 = null
  if (bredde === 390 && navn !== 'kunGuld') { const p = await gemUger(T); pngM24 = p.tekster.map((x) => x.t).join(' ').replace(/\s+/g, ' ').includes(data[0].nyesteAlene.slice(0, 40)) }
  ud.m24[`${navn}-${bredde}`] = { saetning: d.sek[0].saetning, nyesteAlene: data[0].nyesteAlene, aleneSide: sidste.filter((x) => x.c.alene).map((x) => x.navn), guldSide: sidste.filter((x) => x.c.guld).map((x) => x.navn), aleneData: data[0].raekker.filter((r) => r.over && !r.guld).map((r) => r.navn), pngM24, jsFejl: T.fejl }
  await T.ctx.close()
}
{
  const M = ud.m24, lc = (s) => s.charAt(0).toLowerCase() + s.slice(1)
  const G = M['guldOgAlene-390']
  paastaa('M24: kun den nyeste uge (hoften 13 cm) -> saetningen slutter "Den nyeste uge staar ikke i guld: kun een uge over graensen indtil videre."; ogsaa i PNG\'et', /Den nyeste uge står ikke i guld: kun én uge over grænsen indtil videre\.$/.test(M['kunNyeste-390'].saetning) && M['kunNyeste-390'].pngM24, M['kunNyeste-390'].saetning)
  paastaa(`M24: hoften i guld i uge 7-8 og knaeet frem kun i uge 8 -> rækkerne i saetningen (${G.aleneData.length}) er praecis de raekker, der har "1 uge" i den nyeste kolonne paa siden (${G.aleneSide.length}); guld: ${G.guldSide.length} raekker; ogsaa 1280 og i PNG'et`, G.aleneSide.length > 0 && G.guldSide.length > 0 && JSON.stringify(G.aleneSide) === JSON.stringify(G.aleneData) && G.aleneSide.every((n) => G.nyesteAlene.includes(lc(n))) && JSON.stringify(M['guldOgAlene-1280'].aleneSide) === JSON.stringify(G.aleneSide) && G.pngM24, { saetning: G.saetning, alene: G.aleneSide, guld: G.guldSide })
  paastaa('M24: den nyeste i guld alene (uge 7-8) -> ingen M24-saetning', !M['kunGuld-390'].nyesteAlene && !/står ikke i guld/.test(M['kunGuld-390'].saetning), M['kunGuld-390'].saetning)
  paastaa(`M24: op i uge 7 og ned i uge 8 (begge alene) -> "${(M['modsat-390'].nyesteAlene || '').slice(0, 80)}"`, /Den nyeste uge står ikke i guld/.test(M['modsat-390'].saetning), { saetning: M['modsat-390'].saetning, alene: M['modsat-390'].aleneSide })
  paastaa('M24 og M23: 0 JS-fejl, siden ruller ikke sidelaens (390 og 1280)', Object.values(M).every((x) => !x.jsFejl.length) && [390, 1280].every((b) => ud.m23[b].sideRul <= 0 && ud.m21[b].sideRul.every((r) => r <= 0)), null)
}

// --- 6) Monte Carlo gennem sidens ugeTabel: hvor ofte "1 uge" og M24 uden aendring -------------------------------------
const L = modelFase('dl-gulv', kroppe('doedloeft', null, { hoejde: '180', vaegt: '90', stangKg: 200 }).snit).L
const maalRunde = (q) => maal(q, { fase: 'dl-gulv', skala: null, retning: null, cmPrPx: skalaFraKrop(q, L) })
function forsoeg(g, { uger, runder, dyAf = () => 0 }) {
  const poster = Array.from({ length: uger }, (_, k) => {
    const Q = iBillede(MP.punkter, { dy: dyAf(k) })
    return { navn: `u${k}`, gemt: mandag(k), faseId: 'dl-gulv', maal: Array.from({ length: runder }, () => maalRunde(klikket(Q, g))) }
  })
  return ugeTabel(poster)
}
function taelTabel(T) {
  let guld = 0, over = 0, alene = 0
  for (const r of T.raekker) for (const c of r.celler) { if (c.guld) guld++; if (c.over) over++; if (c.over && !c.guld) alene++ }
  const celler = T.raekker.reduce((a, r) => a + r.celler.slice(1).filter((c) => c.forskel !== null && !c.kameraKrav).length, 0)
  const hh = T.raekker.find((r) => r.id === 'hofteHoejde').celler, n = hh.length
  return { guld, over, alene, celler, nogetAlene: alene > 0, nogetGuld: guld > 0, m24: !!T.nyesteAlene, hofteGuld: hh.some((c) => c.guld), hofteNyesteGuld: hh[n - 1].guld, hofteNyesteAlene: hh[n - 1].over && !hh[n - 1].guld }
}
function mc(navn, opt, seed) {
  const g = rng(seed); const R = []
  for (let i = 0; i < MC_N; i++) R.push(taelTabel(forsoeg(g, opt)))
  const andel = (k) => +(100 * R.filter((r) => r[k]).length / R.length).toFixed(1)
  const mid = (k) => +(R.reduce((a, r) => a + r[k], 0) / R.length).toFixed(2)
  ud.mc[navn] = { uger: opt.uger, runder: opt.runder, n: MC_N, celler: R[0].celler, aleneMiddel: mid('alene'), guldMiddel: mid('guld'), nogetAlene: andel('nogetAlene'), nogetGuld: andel('nogetGuld'), m24: andel('m24'), hofteGuld: andel('hofteGuld'), hofteNyesteGuld: andel('hofteNyesteGuld'), hofteNyesteAlene: andel('hofteNyesteAlene') }
  console.log('mc', navn, JSON.stringify(ud.mc[navn]))
}
for (const [uger, runder] of [[8, 1], [8, 3], [12, 1], [12, 3]]) mc(`nul-${uger}u-${runder}r`, { uger, runder }, 1000 + uger * 10 + runder) // samme froe som 628 og 632
mc('hofte5-fra-u5-12u-3r', { uger: 12, runder: 3, dyAf: (k) => (k >= 4 ? 15 : 0) }, 2000 + 12 * 10 + 3)
mc('hofte5-kun-nyeste-12u-3r', { uger: 12, runder: 3, dyAf: (k) => (k === 11 ? 15 : 0) }, 3123)
const MC = ud.mc
paastaa(`M23 uden aendring (min Monte Carlo, ${MC_N} forsoeg, samme froe som 632): "1 uge" et sted i ${MC['nul-8u-1r'].nogetAlene}/${MC['nul-12u-1r'].nogetAlene} % (8/12 uger, 1 runde) og ${MC['nul-8u-3r'].nogetAlene}/${MC['nul-12u-3r'].nogetAlene} % (3 runder), i snit ${MC['nul-12u-3r'].aleneMiddel} celler af ${MC['nul-12u-3r'].celler}; guld ${MC['nul-8u-3r'].nogetGuld}/${MC['nul-12u-3r'].nogetGuld} % som i 632; M24-saetningen staar i ${MC['nul-8u-1r'].m24}/${MC['nul-12u-3r'].m24} %`, MC['nul-12u-3r'].nogetGuld <= 12 && MC['nul-12u-1r'].nogetGuld <= 12, { n8r1: MC['nul-8u-1r'], n12r3: MC['nul-12u-3r'] })
paastaa(`M24 naar hoften gaar 5 cm op kun i den nyeste (12 uger, 3 runder): hoftens nyeste celle har "1 uge" i ${MC['hofte5-kun-nyeste-12u-3r'].hofteNyesteAlene} %, og M24-saetningen staar i ${MC['hofte5-kun-nyeste-12u-3r'].m24} %; hoften 5 cm fra uge 5 i guld i sin raekke ${MC['hofte5-fra-u5-12u-3r'].hofteGuld} % (632: 77,5)`, MC['hofte5-fra-u5-12u-3r'].hofteGuld >= 70, { nyeste: MC['hofte5-kun-nyeste-12u-3r'], fra5: MC['hofte5-fra-u5-12u-3r'] })

// Er node's regning sidens? Et forsoeg uden aendring (12 uger, 3 runder med klikfejl) givet siden som filer: samme antal
// guld og "1 uge"; og skaermbilledet af hvordan tabellen ser ud uden nogen aendring.
{
  const T = await side(390)
  await T.page.evaluate(() => { const m = window.maalBillede; m.saetKrop({ hoejde: '180', vaegt: '90' }); m.saetStangKg(200); m.saetFase('dl-gulv') })
  ud.mcSide = []
  for (const seed of [11, 12, 13]) {
    const g = rng(seed), g2 = rng(seed)
    const filer = Array.from({ length: 12 }, (_, k) => ({ buf: ugeFil(k, { runder: 3, g }).buf }))
    const node = taelTabel(forsoeg(g2, { uger: 12, runder: 3 }))
    await vaelgUger(T, filer)
    const d = await T.page.evaluate(UGE_DOM)
    ud.mcSide.push({ seed, node: [node.guld, node.alene], side: [d.sek[0].guld, d.sek[0].alene], m24: [node.m24, / står ikke i guld/.test(d.sek[0].saetning)] })
    if (seed === 11) { await T.page.evaluate(() => document.querySelector('[data-ugefase]').scrollIntoView({ block: 'start' })); await T.page.waitForTimeout(200); await T.page.screenshot({ path: join(HERE, 'M-390-639-uden-aendring-12u.png') }) }
  }
  await T.ctx.close()
}
paastaa('node-regningen er sidens: tre forsoeg uden aendring (12 uger, 3 runder med klikfejl) givet siden som filer har samme antal guld, "1 uge" og M24', ud.mcSide.every((x) => x.node.join() === x.side.join() && x.m24[0] === x.m24[1]), ud.mcSide.map((x) => `${x.seed}: node ${x.node} ${x.m24[0]}, side ${x.side} ${x.m24[1]}`))

ud.eksterne = [...eksterne]
paastaa('alt, siderne proevede at hente udefra, er afbrudt og var kun skrifttypen', [...eksterne].every((u) => /fonts\.(googleapis|gstatic)\.com/.test(u)), [...eksterne])
await browser.close(); server.close()
rmSync(dir, { recursive: true, force: true })
writeFileSync(join(HERE, 'maal-639.json'), JSON.stringify({ ...ud, tjek }, null, 1))
const roede = tjek.filter((t) => !t.ok)
console.log(`\nmaal-639: ${tjek.length - roede.length}/${tjek.length} tjek groenne (${ud.chrome})`)
process.exit(roede.length ? 1 : 0)
