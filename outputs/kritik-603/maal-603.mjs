// Kritik 603, blok 1: Maal dit billede efter Yantras 599 (Gem billedet med tallene, piletasterne; merget, main)
// og 601 (den gemte fil kan aabnes igen, foer og efter fra en fil, Byt; committet paa ordre-601, ikke merget),
// og mine M1-M3 fra 598. Maalt med mine egne scripts, mine klip fra 582 og kun syntetiske billeder.
//   node outputs/kritik-603/maal-603.mjs     -> maal-603.json og M-*.png
// Loeftmodellen (entropi-loeftmodel-dhruva: main; ordre-601 fra entropi-loeftmodel) og sitet
// (entropi-coaching-site-wt2, grenen vaerktoejer) hentes med `git archive` til en midlertidig mappe; ingen gren
// skiftes, intet trae roeres. Siden maales i sitets kopi med dist/maal-billede/ fra main (/m599/) og fra ordre-601
// (/m601/) lagt oven i, som det bliver, naar Setu kopierer. Google Chrome (den installerede) headless paa 390 med
// touch og 1280 med mus; alt net uden for den lokale server afbrudt. Min egen PNG-laeser (ikke maalGemt.js)
// laeser de gemte filer.
import path, { join } from 'node:path'
import { tmpdir } from 'node:os'
import { writeFileSync, readFileSync, mkdtempSync, existsSync, statSync, mkdirSync, rmSync, cpSync, readdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { createServer } from 'node:http'
import zlib from 'node:zlib'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from '../../e2e/harness.mjs'
import { lavKlip, BITS } from '../kritik-582/klip-582.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SITE = 'C:/Users/Entropi/Desktop/entropi-coaching-site-wt2'
const LM = 'C:/Users/Entropi/Desktop/entropi-loeftmodel-dhruva'
const GREN = 'refs/heads/vaerktoejer'
const O601 = 'refs/heads/ordre-601'
const sh = (c) => execSync(c, { maxBuffer: 1 << 26 }).toString()
const rev = (repo, r) => sh(`git -C "${repo}" rev-parse --short ${r}`).trim()
const ver = { main: rev(LM, 'main'), o601: rev(LM, O601), site: rev(SITE, GREN), godkendt585: '291f5bf', kritik598: '03c929e' }
ver.o601Commits = sh(`git -C "${LM}" log --format=%h%x20%s main..${O601}`).trim().split(/\r?\n/).filter(Boolean)
ver.o601Merget = sh(`git -C "${LM}" merge-base --is-ancestor ${O601} main && echo ja || echo nej`).trim()
const dir = mkdtempSync(join(tmpdir(), 'k603-'))
const hent = (repo, ref, hvor, stier = '') => { mkdirSync(hvor, { recursive: true }); execSync(`git -C "${repo}" archive -o "${join(hvor, 'a.tar')}" ${ref} ${stier}`); execSync('tar -xf a.tar', { cwd: hvor }); rmSync(join(hvor, 'a.tar')) }
// 601 blev merget, mens jeg maalte (main 207d4ec). /m599/ er derfor 599 alene (03c929e), /m601/ er main nu.
const lm599 = join(dir, '_599'), lm601 = join(dir, '_main'), web = join(dir, 'web')
hent(LM, ver.kritik598, lm599, 'dist src kroppe package.json')
hent(LM, 'main', lm601, 'dist src kroppe package.json docs/RAPPORT-dag-89.md docs/RAPPORT-dag-90.md')
hent(SITE, GREN, web)
const V = '/assets/vaerktoejer'
const tjek = []
const paastaa = (hvad, ok, data) => { tjek.push({ hvad, ok: !!ok, data }); console.log(`${ok ? 'ok ' : 'NEJ'} ${hvad}${data !== undefined ? ' ' + JSON.stringify(data).slice(0, 700) : ''}`) }
const ud = { ver, kopi: {}, m123: {}, gem: [], aaben: [], gen: {}, exif: {}, stor: [], fjendtlig: [], foerEfter: [], taster: [], dl: {} }

// --- 1) Hvad er nyt siden 598, og hvad skal Setu kopiere -----------------------------------------------
const blobs = (repo, ref, d) => Object.fromEntries(sh(`git -C "${repo}" ls-tree -r ${ref} -- ${d}/`).split('\n').filter(Boolean).map((l) => { const [meta, f] = l.split('\t'); return [f.slice(d.length + 1), meta.split(' ')[2]] }))
const forskelle = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((f) => a[f] !== b[f])
for (const m of ['maal-billede', 'baenk-figurer', 'tre-loeft', 'min-krop', 'loeft-fejl', 'squat-figurer', 'doedloeft-figurer']) {
  const site = blobs(SITE, GREN, `assets/vaerktoejer/${m}`)
  ud.kopi[m] = {
    siteMod291: forskelle(blobs(LM, ver.godkendt585, `dist/${m}`), site),
    siteModMain: forskelle(blobs(LM, 'main', `dist/${m}`), site),
    siteMod601: forskelle(blobs(LM, O601, `dist/${m}`), site),
    mainMod598: forskelle(blobs(LM, ver.kritik598, `dist/${m}`), blobs(LM, 'main', `dist/${m}`)),
    o601ModMain: forskelle(blobs(LM, 'main', `dist/${m}`), blobs(LM, O601, `dist/${m}`)),
  }
}
ud.kopi.distMainMod601 = sh(`git -C "${LM}" diff --stat main ${O601} -- dist`).trim()
console.log(JSON.stringify(ud.kopi))
ver.nyeSiden598 = sh(`git -C "${LM}" log --format=%h%x20%s ${ver.kritik598}..main`).trim().split(/\r?\n/).filter(Boolean)
paastaa(`601 (${ver.o601}) er ${ver.o601Merget === 'ja' ? 'merget' : 'ikke merget'} paa main (${ver.main}); dist paa main = dist paa ordre-601; siden 598 (03c929e) er kun maal-billede/index.html og maal-billede.js aendret i dist`, ver.o601Merget === 'ja' && !ud.kopi.distMainMod601 && Object.entries(ud.kopi).filter(([m]) => m !== 'maal-billede' && m !== 'distMainMod601').every(([, k]) => k.mainMod598.length === 0) && ud.kopi['maal-billede'].mainMod598.every((f) => ['index.html', 'maal-billede.js'].includes(f)), { nye: ver.nyeSiden598, maal: ud.kopi['maal-billede'].mainMod598 })
paastaa(`sitets maal-billede (${ver.site}) er stadig 580-udgaven (291f5bf); tre-loeft og min-krop er stadig ikke kopieret (W7)`, ud.kopi['maal-billede'].siteMod291.length === 0, { maal: ud.kopi['maal-billede'].siteModMain, treLoeft: ud.kopi['tre-loeft'].siteModMain, minKrop: ud.kopi['min-krop'].siteModMain, baenk: ud.kopi['baenk-figurer'].siteModMain })

// M1-M3 fra 598: er de rettet paa main eller ordre-601?
for (const [navn, rod] of [['main', lm601], ['o601', lm601]]) {
  const MINI = join(rod, 'dist', 'maal-billede', 'miniaturer')
  const felter = Object.fromEntries(readdirSync(MINI).filter((f) => f.endsWith('.svg')).map((f) => [f, (readFileSync(join(MINI, f), 'utf8').match(/fill-opacity="0\.78"/g) || []).length]))
  const bf = readFileSync(join(rod, 'dist', 'baenk-figurer', 'index.html'), 'utf8').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
  ud.m123[navn] = {
    M1felter: felter,
    M1miniatureJsRoert: sh(`git -C "${LM}" diff --stat ${ver.kritik598} ${navn === 'main' ? 'main' : O601} -- src/miniature.js dist/maal-billede/miniaturer`).trim(),
    M2: { vej105: /vejen 10,5 cm kortere/.test(bf), msk17: /momentarm 1,7 cm længere/.test(bf), albue82: /albuens 8,2 cm kortere/.test(bf) },
    M3roert: sh(`git -C "${LM}" diff --stat ${ver.kritik598} ${navn === 'main' ? 'main' : O601} -- src/embed/deadliftAnimation.js dist/deadlift-animation.js`).trim(),
  }
}
const m1Aaben = (n) => Object.values(ud.m123[n].M1felter).filter((x) => x === 3).length === 4
paastaa('M1 (middel) staar: dødløftets og baenkens fire miniaturer har stadig tre moerke tekstfelter hver, paa main og paa ordre-601 (src/miniature.js og miniaturer/ uroert siden 598)', m1Aaben('main') && m1Aaben('o601') && !ud.m123.main.M1miniatureJsRoert && !ud.m123.o601.M1miniatureJsRoert, { main: ud.m123.main.M1felter, o601: ud.m123.o601.M1felter })
paastaa('M2 (lav) staar: baenkens figurside siger stadig 10,5 / 1,7 / 8,2 cm (main og ordre-601)', Object.values(ud.m123.main.M2).every(Boolean) && Object.values(ud.m123.o601.M2).every(Boolean), ud.m123.main.M2)
paastaa('M3 (lav) staar: deadlift-animation uroert siden 598', !ud.m123.main.M3roert && !ud.m123.o601.M3roert)

// Sitets kopi med main (599) og med ordre-601.
const S = (w, m) => join(w, 'assets', 'vaerktoejer', m)
const web599 = join(dir, 'web599'), web601 = join(dir, 'web601')
for (const [w, rod] of [[web599, lm599], [web601, lm601]]) {
  cpSync(web, w, { recursive: true })
  rmSync(S(w, 'maal-billede'), { recursive: true }); cpSync(join(rod, 'dist', 'maal-billede'), S(w, 'maal-billede'), { recursive: true })
}

// --- 2) Min egen PNG- og JPEG-laeser (uafhaengig af maalGemt.js) ------------------------------------------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 } return (b) => { let c = 0xffffffff; for (const x of b) c = t[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 } })()
function dele(buf) {
  const b = Buffer.from(buf); const ud = []
  if (b.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return null
  let i = 8
  while (i + 12 <= b.length) { const n = b.readUInt32BE(i); const type = b.toString('latin1', i + 4, i + 8); if (i + 12 + n > b.length) { ud.push({ type, brudt: true }); break } const crcOk = CRC(b.subarray(i + 4, i + 8 + n)) === b.readUInt32BE(i + 8 + n); ud.push({ type, pos: i, n, crcOk, data: b.subarray(i + 8, i + 8 + n) }); i += 12 + n; if (type === 'IEND') break }
  return ud
}
function enTr(buf) {
  const d = (dele(buf) || []).find((x) => x.type === 'enTr'); if (!d) return null
  const b = d.data, magi = b.toString('latin1', 0, 20)
  let i = 21; const jl = b.readUInt32BE(i); const meta = JSON.parse(b.toString('utf8', i + 4, i + 4 + jl)); i += 4 + jl
  const billeder = []
  while (i + 4 <= b.length) { const n = b.readUInt32BE(i); billeder.push(b.subarray(i + 4, i + 4 + n)); i += 4 + n }
  return { magi, crcOk: d.crcOk, meta, billeder, bytes: d.n }
}
const jpegDele = (j) => { const ud = []; let i = 2; while (i + 4 <= j.length && j[i] === 0xff) { const m = j[i + 1]; if (m === 0xda) break; const n = j.readUInt16BE(i + 2); ud.push({ m: m.toString(16), id: j.toString('latin1', i + 4, i + 10).replace(/\0/g, '.') }); i += 2 + n } return ud }
const lavDel = (type, data) => { const b = Buffer.alloc(12 + data.length); b.writeUInt32BE(data.length, 0); b.write(type, 4, 'latin1'); data.copy(b, 8); b.writeUInt32BE(CRC(b.subarray(4, 8 + data.length)), 8 + data.length); return b }
// Skriv enTr om med ny meta (og evt. nye billeder), med rigtig CRC: en fil, som kunne vaere lavet af hvem som helst.
function nyEnTr(buf, metaFn, billederFn = (x) => x) {
  const D = dele(buf), g = enTr(buf)
  const meta = metaFn(JSON.parse(JSON.stringify(g.meta))), billeder = billederFn(g.billeder)
  const json = Buffer.from(JSON.stringify(meta), 'utf8')
  const hoved = Buffer.concat([Buffer.from('entropi-maal-billede\0', 'latin1'), Buffer.alloc(4)]); hoved.writeUInt32BE(json.length, 21)
  const data = Buffer.concat([hoved, json, ...billeder.flatMap((x) => { const l = Buffer.alloc(4); l.writeUInt32BE(x.length); return [l, x] })])
  const b = Buffer.from(buf), d = D.find((x) => x.type === 'enTr')
  return Buffer.concat([b.subarray(0, d.pos), lavDel('enTr', data), b.subarray(d.pos + 12 + d.n)])
}
function graaPng(w, h, v = 0x60) { const raa = Buffer.alloc((w + 1) * h, v); for (let y = 0; y < h; y++) raa[y * (w + 1)] = 0; const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 0; return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), lavDel('IHDR', ih), lavDel('IDAT', zlib.deflateSync(raa, { level: 9 })), lavDel('IEND', Buffer.alloc(0))]) }
// Et JPEG med en EXIF-del (APP1) med en syntetisk "GPS"-tekst i ImageDescription: foelger den med ind i den gemte fil?
function medExif(jpeg, tekst) {
  const t = Buffer.from(tekst + '\0', 'latin1')
  const tiff = Buffer.alloc(8 + 2 + 12 + 4); tiff.write('MM', 0, 'latin1'); tiff.writeUInt16BE(42, 2); tiff.writeUInt32BE(8, 4); tiff.writeUInt16BE(1, 8)
  tiff.writeUInt16BE(0x010e, 10); tiff.writeUInt16BE(2, 12); tiff.writeUInt32BE(t.length, 14); tiff.writeUInt32BE(tiff.length, 18); tiff.writeUInt32BE(0, 22)
  const app = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff, t]); const hd = Buffer.alloc(4); hd[0] = 0xff; hd[1] = 0xe1; hd.writeUInt16BE(app.length + 2, 2)
  return Buffer.concat([jpeg.subarray(0, 2), hd, app, jpeg.subarray(2)])
}

// --- 3) Browseren --------------------------------------------------------------------------------------------
const typer = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.json': 'application/json', '.ico': 'image/x-icon', '.woff2': 'font/woff2' }
const server = createServer((req, res) => {
  const [, rod, ...rest] = decodeURIComponent(req.url.split('?')[0].split('#')[0]).split('/')
  let f = join(rod === 'm601' ? web601 : web599, '/' + rest.join('/'))
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html')
  if (!existsSync(f)) { res.writeHead(404); return res.end() }
  res.writeHead(200, { 'content-type': typer[path.extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f))
}).listen(0)
const BASE = `http://127.0.0.1:${server.address().port}`
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const browser = await chromium.launch({ headless: true, executablePath: CHROME })
ud.chrome = browser.version()
const eksterne = new Set()
const FILER = join(dir, 'filer'); mkdirSync(FILER)
async function side(bredde, rod) {
  const mobil = bredde < 500
  const ctx = await browser.newContext({ viewport: { width: bredde, height: mobil ? 780 : 900 }, deviceScaleFactor: mobil ? 3 : 1, isMobile: mobil, hasTouch: mobil, acceptDownloads: true })
  const page = await ctx.newPage()
  const T = { ctx, page, mobil, bredde, fejl: [], rod }
  page.on('pageerror', (e) => T.fejl.push(e.message))
  await page.route('**/*', (r) => { const u = r.request().url(); if (u.startsWith(BASE) || /^(data|blob):/.test(u)) return r.continue(); eksterne.add(u.split('?')[0]); return r.abort() })
  await page.goto(`${BASE}/${rod}${V}/maal-billede/index.html`, { waitUntil: 'load' })
  await page.waitForSelector('[data-klar]')
  return T
}
async function tryk(T, sel) { const l = T.page.locator(sel).first(); await l.scrollIntoViewIfNeeded(); if (T.mobil) await l.tap(); else await l.click() }
// Tryk paa Gem (den rigtige knap) og tag filen, som browseren henter.
async function gem(T, sel, navn) {
  const [dl] = await Promise.all([T.page.waitForEvent('download', { timeout: 30000 }), tryk(T, sel)])
  const fil = join(FILER, navn); await dl.saveAs(fil)
  return { fil, forslag: dl.suggestedFilename(), buf: readFileSync(fil) }
}
async function aabnFil(T, fil) {
  await T.page.setInputFiles('[data-fil]', fil)
  await T.page.waitForFunction(() => { const s = window.maalBillede.tilstand(); return !!s.billede }, null, { timeout: 30000 }).catch(() => {})
  await T.page.waitForTimeout(500)
}
const lager = (T) => T.page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) }))
const TABEL = () => [...document.querySelectorAll('[data-sammenligning] tbody tr')].map((t) => [...t.children].map((x) => x.textContent.replace(/\s+/g, ' ').trim()))
const FETABEL = () => [...document.querySelectorAll('[data-sammentabel] tbody tr')].map((t) => [...t.children].map((x) => x.textContent.replace(/\s+/g, ' ').trim()))
const INFO = () => { const s = window.maalBillede.tilstand(); const q = (x) => document.querySelector(x); return { fase: s.faseId, sumo: s.sumo, hoejde: q('[data-hoejde]').value, vaegt: q('[data-vaegt]').value, kg: q('[data-kg]').value, punkter: s.punkter, w: s.billede?.naturalWidth || 0, h: s.billede?.naturalHeight || 0, note: q('[data-gemtnote]').hidden ? null : q('[data-gemtnote]').textContent, navn: q('[data-navn]').textContent, rul: document.documentElement.scrollWidth - document.documentElement.clientWidth } }

// Syntetiske billeder: en flade med to lyse felter (ingen atlet), klikket med modellens egne punkter.
const imp = (rod, f) => import(pathToFileURL(join(rod, 'src', f)).href)
const { PUNKTER, SKIVE_CM } = await imp(lm601, 'maalBillede.js')
const { kroppe, modelFase } = await imp(lm601, 'maalBilledeModel.js')
const iBillede = (P, { pxPrCm = 3, x0 = 600, y0 = 1300, dy = 0 } = {}) => { const o = {}; for (const { id } of PUNKTER) o[id] = { x: x0 + P[id].x * pxPrCm, y: y0 - P[id].y * pxPrCm - (id === 'hofte' ? dy : 0) }; o.skalaA = { x: o.stang.x, y: o.stang.y - (SKIVE_CM / 2) * pxPrCm }; return o }
const MP = modelFase('dl-gulv', kroppe('doedloeft', null, { hoejde: '180', stangKg: 200 }).snit)
const MPsq = modelFase('squat-bund', kroppe('squat', null, { hoejde: '180' }).snit)
const Q1 = iBillede(MP.punkter), Q8 = iBillede(MP.punkter, { dy: 20 })
const BILLEDE = async ([w, h, farve, navn, stoej]) => {
  const k = document.createElement('canvas'); k.width = w; k.height = h; const x = k.getContext('2d')
  x.fillStyle = farve; x.fillRect(0, 0, w, h); x.fillStyle = '#ddd'; x.fillRect(w * 0.1, h * 0.07, w * 0.2, h * 0.2); x.fillStyle = '#835'; x.fillRect(w * 0.55, h * 0.5, w * 0.3, h * 0.1)
  if (stoej) { const d = x.getImageData(0, 0, w, h); let s = 603; for (let i = 0; i < d.data.length; i += 4) { s = (s * 1103515245 + 12345) >>> 0; const v = (s >>> 24) - 128; d.data[i] += v / 3; d.data[i + 1] += v / 4; d.data[i + 2] += v / 5 } x.putImageData(d, 0, 0) }
  const url = URL.createObjectURL(await new Promise((ok) => k.toBlob(ok, 'image/png')))
  return window.maalBillede.laesBillede(url, navn, true)
}
const MAAL = ([Q, fase = 'dl-gulv', hoejde = '180', vaegt = '90', kg = 200]) => { const m = window.maalBillede; m.saetKrop({ hoejde, vaegt }); if (kg) m.saetStangKg(kg); m.saetFase(fase); m.saetPunkter(Q) }

// 3a) Gem billedet med tallene (599 og 601), 390 og 1280: den rigtige knap, filen, indholdet, lageret og nettet.
let fil601 = null
for (const rod of ['m599', 'm601']) for (const bredde of [390, 1280]) {
  const T = await side(bredde, rod)
  const net0 = eksterne.size, lager0 = await lager(T)
  await T.page.evaluate(BILLEDE, [1000, 1400, '#556', 'Uge 1 dødløft.png', false])
  await T.page.evaluate(MAAL, [Q1])
  await T.page.waitForTimeout(400)
  const sidensTabel = await T.page.evaluate(TABEL)
  const ind = await T.page.evaluate(() => { const i = window.maalBillede.eksportIndhold('model'); return { filnavn: i.filnavn, titel: i.titel, kolonner: i.kolonner, raekker: i.raekker, noter: i.noter, billeder: i.billeder.map((b) => b.tekst) } })
  const knap = await T.page.evaluate(() => { const b = document.querySelector('[data-gem]'); const r = b.getBoundingClientRect(); return { tekst: b.textContent, w: Math.round(r.width), h: Math.round(r.height), note: document.querySelector('[data-gemnote]').textContent } })
  const g = await gem(T, '[data-gem]', `${rod}-${bredde}.png`)
  await T.page.waitForTimeout(300)
  const D = dele(g.buf), ihdr = D.find((d) => d.type === 'IHDR')
  const E = enTr(g.buf)
  const r = {
    rod, bredde, forslag: g.forslag, bytes: g.buf.length, bredde_px: ihdr.data.readUInt32BE(0), hoejde_px: ihdr.data.readUInt32BE(4), dele: [...new Set(D.map((d) => d.type))], alleCrcOk: D.every((d) => d.crcOk),
    knap, sidensTabel, indRaekker: ind.raekker, // Sidens foerste celle har raekkens fodnote med; tallene sammenlignes uden mellemrum (siden: "≈61,2°", filen: "≈ 61,2°").
    tabelEns: JSON.stringify(sidensTabel.map((r) => [r[1], r[2]].map((c) => c.replace(/\s/g, '')))) === JSON.stringify(ind.raekker.map((r) => [r[1], r[2]].map((c) => c.replace(/\s/g, '')))) && sidensTabel.every((r, i) => r[0].startsWith(ind.raekker[i][0])), noter: ind.noter, titel: ind.titel, billedTekster: ind.billeder,
    synligKrop: { hoejde: ind.noter.some((n) => /180,0 cm/.test(n)), vaegt: ind.noter.some((n) => /90,0 kg/.test(n)) },
    enTr: E && { magi: E.magi, crcOk: E.crcOk, bytes: E.bytes, noegler: Object.keys(E.meta), faelles: E.meta.faelles, gemt: E.meta.gemt, plads: E.meta.pladser.map((p) => ({ ...p, punkter: Object.keys(p.punkter).length })), jpeg: E.billeder.map((b) => ({ n: b.length, soi: b[0] === 0xff && b[1] === 0xd8, dele: jpegDele(b) })) },
    net: eksterne.size - net0, lagerFoer: lager0, lagerEfter: await lager(T), jsFejl: T.fejl,
  }
  ud.gem.push(r)
  if (rod === 'm601' && bredde === 1280) fil601 = g.fil
  if (rod === 'm601') {
    await T.page.locator('[data-gem]').scrollIntoViewIfNeeded(); await T.page.waitForTimeout(150)
    await T.page.screenshot({ path: join(HERE, `M-${bredde}-601-gem-knap.png`) })
    if (bredde === 1280) writeFileSync(join(HERE, 'M-601-gemt-fil-synlig-del.png'), Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), ...D.filter((d) => d.type !== 'enTr').map((d) => lavDel(d.type, d.data))]))
  }
  await T.ctx.close()
}
const G = ud.gem
paastaa('Gem (den rigtige knap) paa 390 og 1280, 599 og 601: en fil hentes, PNG 1200 px bred, navnet maal-dl-gulv-uge-1-doedloeft.png, alle PNG-deles CRC rigtig', G.every((r) => r.forslag === 'maal-dl-gulv-uge-1-doedloeft.png' && r.bredde_px === 1200 && r.alleCrcOk), G.map((r) => `${r.rod} ${r.bredde}: ${r.forslag} ${r.bredde_px}x${r.hoejde_px} ${r.bytes} B ${r.dele.join(',')}`))
paastaa('det gemte billedes tabel er sidens tabel (samme raekker og tal)', G.every((r) => r.tabelEns && r.sidensTabel.length >= 5), G.map((r) => ({ r: `${r.rod} ${r.bredde}`, ens: r.tabelEns, side: r.sidensTabel.map((x) => x.slice(0, 3).join(" | ").replace(/^[^|]*?(?=[A-ZÆØÅ][a-zæøå]+ [a-zæøå]+s*≈|≈)/, "")), fil: r.indRaekker.map((x) => x.slice(0, 3).join(" | ")) })))
paastaa('intet sendes og intet i lageret: 0 netkald, lageret tomt foer og efter Gem, 0 JS-fejl', G.every((r) => r.net === 0 && !r.lagerEfter.local.length && !r.lagerEfter.session.length && !r.jsFejl.length), G.map((r) => ({ r: r.rod, b: r.bredde, net: r.net, lager: r.lagerEfter, f: r.jsFejl })))
const g599 = G.find((r) => r.rod === 'm599'), g601 = G.find((r) => r.rod === 'm601' && r.bredde === 1280)
paastaa('599: filen har kun billedets egne dele (IHDR, IDAT, IEND), ingen maaling', !g599.enTr && g599.dele.every((d) => ['IHDR', 'IDAT', 'IEND', 'sRGB', 'pHYs'].includes(d)), g599.dele)
paastaa('601: filen har en enTr-del med maalingen (min egen laeser): fase, sumo, haele, hoejde, vaegt, stangens vaegt, skala, billedets navn, datoen og billedet som JPEG', g601.enTr && g601.enTr.crcOk && g601.enTr.faelles.hoejde === '180' && g601.enTr.faelles.vaegt === '90' && g601.enTr.plads[0].navn === 'Uge 1 dødløft.png' && g601.enTr.jpeg[0].soi, { faelles: g601.enTr?.faelles, gemt: g601.enTr?.gemt, navn: g601.enTr?.plads[0].navn, jpeg: g601.enTr?.jpeg.map((j) => j.n), enTrBytes: g601.enTr?.bytes, fil: g601.bytes })
ud.skjult = { hoejdeSynlig: g601.synligKrop.hoejde, vaegtSynlig: g601.synligKrop.vaegt, navnSynligt: g601.billedTekster.join(' ').includes('Uge 1') || g601.titel.includes('Uge 1') || g601.noter.join(' ').includes('Uge 1'), noter: g601.noter }
paastaa('hvad filen baerer, som billedet ikke viser: hoejden og vaegten staar synligt i noterne (180,0 cm og 90,0 kg); skjult er kun datoen, fotoets filnavn og fotoet uden klik', ud.skjult.hoejdeSynlig && ud.skjult.vaegtSynlig, ud.skjult)

// 3b) 601: aabn filen i en ny side med Vaelg billede (den rigtige filvaelger), 390 og 1280.
for (const bredde of [390, 1280]) {
  const T = await side(bredde, 'm601')
  await aabnFil(T, fil601)
  await T.page.waitForSelector('[data-sammenligning]', { timeout: 15000 }).catch(() => {})
  const i = await T.page.evaluate(INFO)
  const tab = await T.page.evaluate(TABEL)
  ud.aaben.push({ bredde, ...i, tabelEns: JSON.stringify(tab) === JSON.stringify(g601.sidensTabel), punkterEns: JSON.stringify(i.punkter) === JSON.stringify(Q1), jsFejl: T.fejl, lager: await lager(T) })
  if (bredde === 390) { await T.page.locator('[data-gemtnote]').scrollIntoViewIfNeeded(); await T.page.screenshot({ path: join(HERE, 'M-390-601-aabnet.png') }) }
  await T.ctx.close()
}
paastaa('601: den gemte fil aabnes igen (390 og 1280): samme klik, fase, hoejde, vaegt, stangens vaegt og samme tabel; noten siger datoen; 0 JS-fejl, lageret tomt', ud.aaben.every((a) => a.punkterEns && a.tabelEns && a.fase === 'dl-gulv' && a.hoejde === '180' && a.vaegt === '90' && a.kg === '200' && /^Gemt måling åbnet \(gemt \d+\. [a-z]+\.? 20\d\d\)/.test(a.note || '') && !a.jsFejl.length && !a.lager.local.length && a.rul === 0), ud.aaben.map((a) => ({ b: a.bredde, p: a.punkterEns, t: a.tabelEns, note: a.note })))

// 3c) 601: uge for uge. Aabn, gem, aabn den nye fil ... 8 gange: bliver billedet i filen daarligere (JPEG igen og igen)?
{
  const T = await side(1280, 'm601')
  let fil = fil601
  const gen = []
  let foerste = null
  for (let n = 1; n <= 8; n++) {
    await aabnFil(T, fil)
    const i = await T.page.evaluate(INFO)
    const g = await gem(T, '[data-gem]', `gen-${n}.png`)
    const E = enTr(g.buf)
    const px = await T.page.evaluate(async (b64) => { const b = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); const bm = await createImageBitmap(new Blob([b], { type: 'image/jpeg' })); const k = new OffscreenCanvas(bm.width, bm.height); const x = k.getContext('2d'); x.drawImage(bm, 0, 0); return Array.from(x.getImageData(0, 0, bm.width, bm.height).data.filter((_, j) => j % 4 !== 3 && j % 97 === 0)) }, Buffer.from(E.billeder[0]).toString('base64'))
    if (!foerste) foerste = px
    const afv = px.reduce((s, v, j) => s + Math.abs(v - foerste[j]), 0) / px.length
    gen.push({ n, jpeg: E.billeder[0].length, fil: g.buf.length, punkterEns: JSON.stringify(i.punkter) === JSON.stringify(Q1), afvigFraGen1: +afv.toFixed(3), maxAfvig: Math.max(...px.map((v, j) => Math.abs(v - foerste[j]))) })
    fil = g.fil
  }
  ud.gen = { gen, jsFejl: T.fejl }
  await T.ctx.close()
}
paastaa('601: 8 uger i traek (aabn og gem igen): klikkene staar, og billedet i filen bliver ikke maerkbart daarligere (middel afvigelse fra uge 1 under 2 af 255)', ud.gen.gen.every((g) => g.punkterEns) && ud.gen.gen.every((g) => g.afvigFraGen1 < 2), ud.gen.gen.map((g) => `${g.n}: jpeg ${g.jpeg} B, afvig ${g.afvigFraGen1} (maks ${g.maxAfvig})`))

// 3d) 601: et foto med EXIF (syntetisk "GPS"-tekst). Foelger EXIF med ind i den gemte fil?
{
  const T = await side(1280, 'm601')
  const jpeg = Buffer.from(await T.page.evaluate(async () => { const k = document.createElement('canvas'); k.width = 1000; k.height = 1400; const x = k.getContext('2d'); x.fillStyle = '#556'; x.fillRect(0, 0, 1000, 1400); const b = await new Promise((ok) => k.toBlob(ok, 'image/jpeg', 0.9)); return btoa(String.fromCharCode(...new Uint8Array(await b.arrayBuffer()))) }), 'base64')
  const MRK = 'SYNTETISK-GPS 55.0000N 12.0000E'
  const kilde = join(FILER, 'exif.jpg'); writeFileSync(kilde, medExif(jpeg, MRK))
  await aabnFil(T, kilde)
  await T.page.evaluate(MAAL, [Q1])
  const g = await gem(T, '[data-gem]', 'exif-gemt.png')
  const E = enTr(g.buf)
  ud.exif = { kildeHarExif: jpegDele(readFileSync(kilde)).some((d) => d.id.startsWith('Exif')), gemtJpegDele: jpegDele(E.billeder[0]), maerkeIFil: g.buf.includes(Buffer.from(MRK)), jsFejl: T.fejl }
  await T.ctx.close()
}
paastaa('601: et fotos EXIF (her en syntetisk GPS-tekst) foelger ikke med ind i den gemte fil; billedet er tegnet om', ud.exif.kildeHarExif && !ud.exif.maerkeIFil && !ud.exif.gemtJpegDele.some((d) => d.id.startsWith('Exif')), ud.exif)

// 3e) 601: store fotos (12 og 24 mio. pixels, med stoej som et rigtigt foto): filens stoerrelse, og samme tal efter aabning.
for (const [w, h] of [[4032, 3024], [6000, 4000]]) {
  const T = await side(1280, 'm601')
  await T.page.evaluate(BILLEDE, [w, h, '#556', `stor-${w}.png`, true])
  const k = w / 1000
  const Qs = Object.fromEntries(Object.entries(Q1).map(([id, q]) => [id, { x: q.x * k * 0.5, y: q.y * k * 0.5 }]))
  await T.page.evaluate(MAAL, [Qs])
  await T.page.waitForTimeout(400)
  const foer = await T.page.evaluate(TABEL)
  const t0 = Date.now()
  const g = await gem(T, '[data-gem]', `stor-${w}.png`)
  const tGem = Date.now() - t0
  const E = enTr(g.buf)
  await T.ctx.close()
  const T2 = await side(1280, 'm601')
  await aabnFil(T2, g.fil)
  await T2.page.waitForSelector('[data-sammenligning]', { timeout: 15000 }).catch(() => {})
  const efter = await T2.page.evaluate(TABEL)
  ud.stor.push({ w, h, fil: g.buf.length, jpeg: E.billeder[0].length, gemtW: E.meta.pladser[0].w, gemtH: E.meta.pladser[0].h, msGem: tGem, tabelEns: JSON.stringify(foer) === JSON.stringify(efter), foer: foer.map((r) => r.slice(0, 2).join(' ')), efter: efter.map((r) => r.slice(0, 2).join(' ')), jsFejl: [...T.fejl, ...T2.fejl] })
  await T2.ctx.close()
}
paastaa('601: store fotos: 24 mio. pixels gemmes under Safaris graense (16,7 mio.); tabellen er den samme efter aabning; filens stoerrelse', ud.stor.every((s) => s.gemtW * s.gemtH <= 16777216 && s.tabelEns && !s.jsFejl.length), ud.stor.map((s) => `${s.w}x${s.h}: gemt ${s.gemtW}x${s.gemtH}, fil ${(s.fil / 1e6).toFixed(2)} MB, ${s.msGem} ms, tabel ens ${s.tabelEns}; foer ${s.foer.join(" / ")}; efter ${s.efter.join(" / ")}`))

// 3f) 601: filer, der ikke er, som siden lavede dem (lavet af mig med rigtig CRC): siden maa ikke goere noget farligt.
{
  const base = readFileSync(fil601)
  const varianter = {
    'oedelagt-crc': (() => { const b = Buffer.from(base); const d = dele(b).find((x) => x.type === 'enTr'); b[d.pos + 40] ^= 1; return b })(),
    'afkortet': base.subarray(0, Math.floor(base.length * 0.6)),
    'navn-html': nyEnTr(base, (m) => { m.pladser[0].navn = '<img src=x onerror="window.__xss=1">"\'&amp;<b>uge 1</b>'; return m }),
    'hoejde-html': nyEnTr(base, (m) => { m.faelles.hoejde = '<svg onload=window.__xss=2>'; m.faelles.vaegt = '1e9'; return m }),
    'dato-13-45': nyEnTr(base, (m) => { m.gemt = '2026-13-45'; return m }),
    'forkert-stoerrelse': nyEnTr(base, (m) => { m.pladser[0].w = 2000; m.pladser[0].h = 2800; for (const q of Object.values(m.pladser[0].punkter)) { q.x *= 2; q.y *= 2 } return m }),
    'andet-billede-8000': nyEnTr(base, (m) => { m.pladser[0].type = 'image/png'; m.pladser[0].w = 8000; m.pladser[0].h = 8000; return m }, () => [graaPng(8000, 8000)]),
    'type-html': nyEnTr(base, (m) => { m.pladser[0].type = 'text/html'; return m }, () => [Buffer.from('<script>window.__xss=3</script>')]),
    'version-2': nyEnTr(base, (m) => { m.v = 2; return m }),
  }
  for (const [navn, buf] of Object.entries(varianter)) {
    const T = await side(390, 'm601')
    const f = join(FILER, `fjendtlig-${navn}.png`); writeFileSync(f, buf)
    await T.page.evaluate(() => { window.__skripter = document.querySelectorAll('script:not([src])').length })
    const t0 = Date.now()
    await aabnFil(T, f)
    await T.page.waitForTimeout(700)
    const r = await T.page.evaluate(() => ({ xss: window.__xss ?? null, injiceret: document.querySelectorAll('img[src="x"], svg[onload]').length + document.querySelectorAll('script:not([src])').length - window.__skripter, foertekst: document.querySelector('[data-foertekst]')?.textContent, navn: document.querySelector('[data-navn]').textContent, note: document.querySelector('[data-gemtnote]').hidden ? null : document.querySelector('[data-gemtnote]').textContent, punkter: Object.keys(window.maalBillede.tilstand().punkter).length, w: window.maalBillede.tilstand().billede?.naturalWidth ?? 0, h: window.maalBillede.tilstand().billede?.naturalHeight ?? 0, hoejde: document.querySelector('[data-hoejde]').value, vaegt: document.querySelector('[data-vaegt]').value, tabel: document.querySelectorAll('[data-sammenligning] tbody tr').length, heapMB: +(performance.memory?.usedJSHeapSize / 1e6).toFixed(1) }))
    ud.fjendtlig.push({ ...r, variant: navn, ms: Date.now() - t0, jsFejl: T.fejl })
    if (navn === 'forkert-stoerrelse') { await T.page.locator('[data-billedeboks], canvas').first().scrollIntoViewIfNeeded().catch(() => {}); await T.page.screenshot({ path: join(HERE, 'M-390-601-forkert-stoerrelse.png') }) }
    await T.ctx.close()
  }
}
const FJ = Object.fromEntries(ud.fjendtlig.map((f) => [f.variant, f]))
paastaa('601, fjendtlige filer: ingen kode koerer (0 xss), intet HTML sprøjtes ind, navnet vises som tekst uden < >, hoejden afvises', ud.fjendtlig.every((f) => f.xss === null && f.injiceret === 0) && !/[<>]/.test(FJ['navn-html'].navn) && FJ['hoejde-html'].hoejde === '', ud.fjendtlig.map((f) => ({ v: f.variant, note: f.note?.slice(0, 70), navn: f.variant === 'navn-html' ? f.navn : undefined, p: f.punkter, w: f.w, jsFejl: f.jsFejl.length })))
paastaa('601: oedelagt CRC og afkortet fil aabnes som et almindeligt billede uden klik (ingen note, ingen JS-fejl)', FJ['oedelagt-crc'].punkter === 0 && FJ['oedelagt-crc'].note === null && !FJ['oedelagt-crc'].jsFejl.length && FJ['afkortet'].punkter === 0 && !FJ['afkortet'].jsFejl.length, { crc: FJ['oedelagt-crc'], afkortet: FJ['afkortet'] })
ud.fundFil = { dato: FJ['dato-13-45'].note, stoerrelse: { note: FJ['forkert-stoerrelse'].note, w: FJ['forkert-stoerrelse'].w, h: FJ['forkert-stoerrelse'].h, punkter: FJ['forkert-stoerrelse'].punkter, tabel: FJ['forkert-stoerrelse'].tabel }, stort: { ms: FJ['andet-billede-8000'].ms, w: FJ['andet-billede-8000'].w, heap: FJ['andet-billede-8000'].heapMB, note: FJ['andet-billede-8000'].note } }
paastaa('601, laveste slags: en fil med en umulig dato eller et billede, hvis stoerrelse ikke passer med filens tal, aabnes alligevel (kun en fil lavet uden for siden)', true, ud.fundFil)

// 3g) 601: foer og efter fra en gemt fil, datoen ved billedet, Byt, Gem foer og efter og aabn den igen; en anden fase afvises.
for (const bredde of [390, 1280]) {
  const T = await side(bredde, 'm601')
  const r = { bredde }
  // Som en traener: aabn uge 1 fra filen, tryk Sammenlign (kan foerst trykkes, naar der er et billede), vaelg uge 8 under Efter.
  await aabnFil(T, fil601)
  r.foerNote = await T.page.evaluate(() => document.querySelector('[data-gemtnote]').textContent)
  await tryk(T, '[data-sammenlign]'); await T.page.waitForTimeout(300)
  await T.page.evaluate(() => window.maalBillede.saetPlads('efter'))
  await T.page.evaluate(BILLEDE, [1000, 1400, '#565', 'Uge 8 dødløft.png', false])
  await T.page.evaluate((Q) => window.maalBillede.saetPunkter(Q), Q8)
  await T.page.waitForTimeout(500)
  const las = () => T.page.evaluate(() => ({ foer: document.querySelector('[data-foertekst]').textContent, efter: document.querySelector('[data-eftertekst]').textContent, tabel: [...document.querySelectorAll('[data-foereftertal] tbody tr')].map((t) => [...t.children].map((x) => x.textContent.replace(/\s+/g, ' ').trim())), saetning: [...document.querySelectorAll('[data-foereftertal] p')].map((p) => p.textContent.replace(/\s+/g, ' ').trim()).join(' | ').slice(0, 400), byt: !document.querySelector('[data-byt]').disabled }))
  r.foer1 = await las()
  await tryk(T, '[data-byt]'); await T.page.waitForTimeout(400)
  r.byttet = await las()
  await tryk(T, '[data-byt]'); await T.page.waitForTimeout(400)
  r.tilbage = await las()
  const hofte = (t) => t.tabel.find((x) => /hofte/i.test(x[0]))
  r.hofte = { foer: hofte(r.foer1), byttet: hofte(r.byttet) }
  if (bredde === 390) { await T.page.locator('[data-foereftertal]').scrollIntoViewIfNeeded().catch(() => {}); await T.page.screenshot({ path: join(HERE, 'M-390-601-foer-efter.png') }) }
  const g = await gem(T, '[data-gemfoerefter]', `fe-${bredde}.png`)
  const E = enTr(g.buf)
  r.fil = { forslag: g.forslag, bytes: g.buf.length, pladser: E.meta.pladser.map((p) => `${p.rolle} ${p.navn} ${Object.keys(p.punkter).length}`) }
  await T.ctx.close()
  const T2 = await side(bredde, 'm601')
  await aabnFil(T2, g.fil)
  await T2.page.waitForTimeout(600)
  r.aabnet = await T2.page.evaluate(() => ({ note: document.querySelector('[data-gemtnote]').textContent, foer: document.querySelector('[data-foertekst]').textContent, efter: document.querySelector('[data-eftertekst]').textContent, tabel: [...document.querySelectorAll('[data-foereftertal] tbody tr')].map((t) => [...t.children].map((x) => x.textContent.replace(/\s+/g, ' ').trim())) }))
  r.aabnetEns = JSON.stringify(r.aabnet.tabel) === JSON.stringify(r.tilbage.tabel)
  // En gemt maaling fra en anden fase under Efter, mens Foer er squatten: afvises?
  await T2.ctx.close()
  const T3 = await side(bredde, 'm601')
  await T3.page.evaluate(BILLEDE, [1000, 1400, '#556', 'squat.png', false])
  await T3.page.evaluate(MAAL, [iBillede(MPsq.punkter), 'squat-bund', '180', '90', 140])
  await T3.page.evaluate(() => { window.maalBillede.saetSammen(true); window.maalBillede.saetPlads('efter') })
  await aabnFil(T3, fil601)
  r.andenFase = await T3.page.evaluate(() => ({ note: document.querySelector('[data-gemtnote]').textContent, fase: window.maalBillede.tilstand().faseId, efterPunkter: Object.keys(window.maalBillede.pladsInfo('efter').punkter).length, efterBillede: window.maalBillede.pladsInfo('efter').bredde }))
  r.jsFejl = [...T.fejl, ...T2.fejl, ...T3.fejl]
  await T3.ctx.close()
  ud.foerEfter.push(r)
}
const FE = ud.foerEfter
paastaa('601: uge 1 fra en gemt fil under Foer: billedteksten har datoen ("Foer: Uge 1 dødløft.png (gemt 28. sep. 2026)"), og Byt er slaaet til, naar begge er der', FE.every((r) => /^Før: Uge 1 dødløft\.png \(gemt \d+\. [a-z]+\.? 20\d\d\)$/.test(r.foer1.foer) && r.foer1.byt), FE.map((r) => `${r.bredde}: ${r.foer1.foer} | ${r.foer1.efter}`))
paastaa('601: Byt foer og efter vender billedteksterne og forskellens fortegn (hoften), og Byt igen giver det samme som foer', FE.every((r) => r.byttet.foer.startsWith('Før: Uge 8') && r.byttet.efter.startsWith('Efter: Uge 1') && r.hofte.foer && r.hofte.byttet && r.hofte.foer[3] !== r.hofte.byttet[3] && JSON.stringify(r.tilbage.tabel) === JSON.stringify(r.foer1.tabel)), FE.map((r) => ({ b: r.bredde, hofte: r.hofte })))
paastaa('601: Gem foer og efter med tallene giver een fil med begge; aabnet i en ny side staar begge med samme tabel og dato', FE.every((r) => r.fil.pladser.length === 2 && r.aabnetEns && /^Gemt før og efter åbnet \(gemt/.test(r.aabnet.note)), FE.map((r) => ({ b: r.bredde, fil: r.fil, note: r.aabnet.note, foer: r.aabnet.foer, efter: r.aabnet.efter })))
paastaa('601: en gemt maaling fra en anden fase aabnes ikke ved siden af et billede (noten siger hvorfor, Efter er uroert); 0 JS-fejl', FE.every((r) => /Fasen er fælles for de to, så målingen er ikke åbnet/.test(r.andenFase.note) && r.andenFase.fase === 'squat-bund' && r.andenFase.efterBillede === 0 && !r.jsFejl.length), FE.map((r) => r.andenFase))

// 3h) 599: piletasterne med mit VFR-klip fra 582 (main og 601), 1280 mus og 390 touch.
const { filer: KLIP } = await lavKlip()
const NUMMER = ([BITS]) => { const src = window.maalBillede.video; const w = src.videoWidth, s = w / 1080; const k = document.createElement('canvas'); k.width = w; k.height = Math.ceil(110 * s); const x = k.getContext('2d', { willReadFrequently: true }); x.drawImage(src, 0, 0); let n = 0; for (let i = 0; i < BITS; i++) { const d = x.getImageData(Math.round((52 + i * 88) * s), Math.round(60 * s), 1, 1).data; if (d[0] > 128) n |= 1 << i } return n }
const rolig = (T) => T.page.waitForFunction(() => { const i = window.maalBillede.billedInfo?.(); return (!i || i.iKoe === 0) && !window.maalBillede.video.seeking }, null, { timeout: 30000 }).then(() => true, () => false)
for (const rod of ['m599', 'm601']) for (const bredde of [1280, 390]) {
  const T = await side(bredde, rod)
  await T.page.evaluate(() => { const b = document.createElement('button'); b.textContent = 'en anden figur'; b.id = 'udenfor'; document.body.prepend(b); window.__forhindret = []; document.addEventListener('keydown', (e) => setTimeout(() => window.__forhindret.push(e.defaultPrevented)), true) })
  await T.page.setInputFiles('[data-videofil]', KLIP['sqvfr.mp4'])
  await T.page.waitForFunction(() => { const v = window.maalBillede.video; return v.readyState >= 2 && document.querySelector('[data-skyder]').max !== '0' && !v.seeking }, null, { timeout: 60000 })
  await rolig(T)
  const nr = [await T.page.evaluate(NUMMER, [BITS])]
  await T.page.evaluate(() => document.activeElement?.blur())
  for (let j = 0; j < 5; j++) { await T.page.keyboard.press('ArrowRight'); await rolig(T); await T.page.waitForTimeout(40); nr.push(await T.page.evaluate(NUMMER, [BITS])) }
  await T.page.keyboard.press('ArrowLeft'); await rolig(T); await T.page.waitForTimeout(40); nr.push(await T.page.evaluate(NUMMER, [BITS]))
  // Skyderen i fokus: ét billede, ikke 1 ms.
  await T.page.focus('[data-skyder]'); await T.page.keyboard.press('ArrowRight'); await rolig(T); await T.page.waitForTimeout(40)
  const skyder = await T.page.evaluate(NUMMER, [BITS])
  // Hoejdefeltet og en knap uden for siden: intet.
  await T.page.focus('[data-hoejde]'); await T.page.keyboard.press('ArrowRight'); await rolig(T); await T.page.waitForTimeout(60)
  const hoejdefelt = await T.page.evaluate(NUMMER, [BITS])
  await T.page.focus('#udenfor'); await T.page.keyboard.press('ArrowRight'); await rolig(T); await T.page.waitForTimeout(60)
  const udenfor = await T.page.evaluate(NUMMER, [BITS])
  await T.page.evaluate(() => document.activeElement?.blur())
  await T.page.keyboard.press('Shift+ArrowRight'); await rolig(T); await T.page.waitForTimeout(60)
  const shift = await T.page.evaluate(NUMMER, [BITS])
  // Holdt tast: 12 gentagelser (repeat) i traek; hoejst to i koe, og hvert trin et billede.
  const foerHold = shift
  await T.page.evaluate(() => { window.__maks = 0; window.__iv = setInterval(() => { const i = window.maalBillede.billedInfo(); window.__maks = Math.max(window.__maks, i.iKoe) }, 5) })
  for (let j = 0; j < 12; j++) await T.page.keyboard.down('ArrowRight')
  await T.page.keyboard.up('ArrowRight')
  await rolig(T); await T.page.waitForTimeout(80)
  const hold = { fra: foerHold, til: await T.page.evaluate(NUMMER, [BITS]), maksKoe: await T.page.evaluate(() => { clearInterval(window.__iv); return window.__maks }) }
  const noteSynlig = await T.page.evaluate(() => [...document.querySelectorAll('[data-videoboks] p, [data-videoboks] .mb-note')].filter((e) => /piletasterne/.test(e.textContent)).some((e) => e.offsetParent !== null))
  // Luk videoen: saa er piletasterne sidens egne igen (rul), ikke forhindret.
  await T.page.locator('[data-lukvideo]').first().click()
  await T.page.waitForTimeout(200)
  await T.page.evaluate(() => { document.activeElement?.blur(); window.__forhindret = [] })
  await T.page.keyboard.press('ArrowDown'); await T.page.keyboard.press('ArrowRight'); await T.page.waitForTimeout(100)
  const efterLuk = await T.page.evaluate(() => window.__forhindret)
  ud.taster.push({ rod, bredde, nr, skyder, hoejdefelt, udenfor, shift, hold, noteSynlig, efterLuk, jsFejl: T.fejl })
  if (rod === 'm601' && bredde === 1280) { await T.page.screenshot({ path: join(HERE, 'M-1280-601-efter-luk.png') }) }
  await T.ctx.close()
}
const TA = ud.taster
paastaa('599: → fem gange og ← en gang er 0,1,2,3,4,5,4 i mit VFR-klip; med skyderen i fokus et billede (5); i hoejdefeltet, paa en knap uden for siden og med Shift intet (main og 601, 1280 og 390)', TA.every((t) => JSON.stringify(t.nr) === '[0,1,2,3,4,5,4]' && t.skyder === 5 && t.hoejdefelt === 5 && t.udenfor === 5 && t.shift === 5), TA.map((t) => `${t.rod} ${t.bredde}: ${t.nr.join(',')} skyder ${t.skyder} felt ${t.hoejdefelt} ude ${t.udenfor} shift ${t.shift}`))
paastaa('599: en holdt tast (12 gentagelser) har hoejst 2 trin i koe og gaar et billede pr. trin; efter Luk er piletasterne sidens egne igen (ikke forhindret); 0 JS-fejl', TA.every((t) => t.hold.maksKoe <= 2 && t.hold.til > t.hold.fra && t.efterLuk.every((x) => x === false) && !t.jsFejl.length), TA.map((t) => ({ r: t.rod, b: t.bredde, hold: t.hold, efterLuk: t.efterLuk, note: t.noteSynlig })))

ud.eksterne = [...eksterne]
paastaa('alt, siderne proevede at hente udefra, er afbrudt og var kun skrifttypen', [...eksterne].every((u) => /fonts\.(googleapis|gstatic)\.com/.test(u)), [...eksterne])
await browser.close(); server.close()
writeFileSync(join(HERE, 'maal-603.json'), JSON.stringify({ ...ud, tjek }, null, 1))
const roede = tjek.filter((t) => !t.ok)
console.log(`\nmaal-603: ${tjek.length - roede.length}/${tjek.length} tjek groenne (${ud.chrome})`)
process.exit(roede.length ? 1 : 0)
