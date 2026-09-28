// Kritik 610, blok 1: Maal dit billede efter Yantras 601 og 608 (608 blev merget, mens jeg maalte: main f3e0200).
// Yantras punkter under "Bhishak boer tjekke" i rapport dag 90 (601) og dag 91 (608), med mine egne scripts og kun
// syntetiske billeder:
//   dag 90: 1) overlever maalingen det, en telefon eller et program goer ved filen? 2) er teksten om, hvad filen har
//           i sig, tydelig nok? 3) foer og efter fra filer: kan en traener tage fejl af ugerne, og er Byt til at finde?
//   dag 91: M1 (miniaturerne uden tekstens moerke bund), M4 (en maaling, siden ikke kan bruge, siger det), noten om
//           en nyere udgave.
//   node outputs/kritik-610/maal-610.mjs     -> maal-610.json og M-*.png
// Loeftmodellen (601 alene = 207d4ec, og main = 608) og sitet (vaerktoejer) hentes med `git archive`; intet trae
// roeres. Siden maales i sitets kopi med dist/maal-billede/ lagt oven i: /m601/ og /m608/ (main).
// Google Chrome (den installerede) headless, 390 touch og 1280 mus, alt net uden for den lokale server afbrudt.
import path, { join } from 'node:path'
import { tmpdir } from 'node:os'
import { writeFileSync, readFileSync, mkdtempSync, existsSync, statSync, mkdirSync, rmSync, cpSync, readdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { createServer } from 'node:http'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from '../../e2e/harness.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SITE = 'C:/Users/Entropi/Desktop/entropi-coaching-site-wt2'
const LM = 'C:/Users/Entropi/Desktop/entropi-loeftmodel-dhruva'
const GREN = 'refs/heads/vaerktoejer'
const O608 = 'main' // 608 er merget (f3e0200)
const FOER = '207d4ec' // 601 alene, det jeg maalte i 603
const sh = (c) => execSync(c, { maxBuffer: 1 << 26 }).toString()
const rev = (repo, r) => sh(`git -C "${repo}" rev-parse --short ${r}`).trim()
const ver = { main: rev(LM, 'main'), o608: rev(LM, 'refs/heads/ordre-608'), site: rev(SITE, GREN), kritik603: FOER, godkendt585: '291f5bf' }
ver.o608Merget = sh(`git -C "${LM}" merge-base --is-ancestor refs/heads/ordre-608 main && echo ja || echo nej`).trim()
ver.mainSiden603 = sh(`git -C "${LM}" log --format=%h%x20%s ${ver.kritik603}..main`).trim().split(/\r?\n/).filter(Boolean)
ver.rapport91 = sh(`git -C "${LM}" ls-tree --name-only main docs/`).includes('RAPPORT-dag-91.md')
const dir = mkdtempSync(join(tmpdir(), 'k610-'))
const hent = (repo, ref, hvor, stier = '') => { mkdirSync(hvor, { recursive: true }); execSync(`git -C "${repo}" archive -o "${join(hvor, 'a.tar')}" ${ref} ${stier}`); execSync('tar -xf a.tar', { cwd: hvor }); rmSync(join(hvor, 'a.tar')) }
// lmMain = 601 alene (207d4ec), lm608 = main (608 merget).
const lmMain = join(dir, '_601'), lm608 = join(dir, '_main'), web = join(dir, 'web')
hent(LM, FOER, lmMain, 'dist src kroppe package.json')
hent(LM, O608, lm608, 'dist src kroppe package.json')
hent(SITE, GREN, web)
const tjek = []
const paastaa = (hvad, ok, data) => { tjek.push({ hvad, ok: !!ok, data }); console.log(`${ok ? 'ok ' : 'NEJ'} ${hvad}${data !== undefined ? ' ' + JSON.stringify(data).slice(0, 700) : ''}`) }
const ud = { ver, kopi: {}, m1: {}, tele: [], tekst: {}, datoer: [], byt: [] }

// --- 1) Hvad er nyt, og hvad skal Setu kopiere ---------------------------------------------------------
const blobs = (repo, ref, d) => Object.fromEntries(sh(`git -C "${repo}" ls-tree -r ${ref} -- ${d}/`).split('\n').filter(Boolean).map((l) => { const [meta, f] = l.split('\t'); return [f.slice(d.length + 1), meta.split(' ')[2]] }))
const forskelle = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((f) => a[f] !== b[f])
for (const m of ['maal-billede', 'baenk-figurer', 'tre-loeft', 'min-krop', 'loeft-fejl', 'squat-figurer', 'doedloeft-figurer']) {
  const site = blobs(SITE, GREN, `assets/vaerktoejer/${m}`)
  ud.kopi[m] = {
    siteMod291: forskelle(blobs(LM, ver.godkendt585, `dist/${m}`), site),
    siteModMain: forskelle(blobs(LM, 'main', `dist/${m}`), site),
    mainMod603: forskelle(blobs(LM, ver.kritik603, `dist/${m}`), blobs(LM, 'main', `dist/${m}`)),
    o608ModMain: forskelle(blobs(LM, 'main', `dist/${m}`), blobs(LM, O608, `dist/${m}`)),
  }
}
paastaa(`608 er merget: main (${ver.main}) = 207d4ec + ordre-608 (${ver.o608}); rapport dag 91 ligger paa main; i dist er kun maal-billede.js og de fire miniaturer i baenken og doedloeftet aendret siden 603`, ver.o608Merget === 'ja' && ver.rapport91 && Object.entries(ud.kopi).every(([m, k]) => m === 'maal-billede' ? k.mainMod603.filter((f) => /^miniaturer\/(bp|dl)-/.test(f)).length === 4 && k.mainMod603.every((f) => /^miniaturer\/(bp|dl)-/.test(f) || f === 'maal-billede.js') : !k.mainMod603.length), { nye: ver.mainSiden603, maal: ud.kopi['maal-billede'].mainMod603 })
paastaa(`sitets maal-billede (${ver.site}) er stadig 580-udgaven (291f5bf); tre-loeft, min-krop og baenk-figurer er stadig ikke kopieret`, !ud.kopi['maal-billede'].siteMod291.length, { maal: ud.kopi['maal-billede'].siteModMain, treLoeft: ud.kopi['tre-loeft'].siteModMain, minKrop: ud.kopi['min-krop'].siteModMain, baenk: ud.kopi['baenk-figurer'].siteModMain })

// --- 2) Sitets kopi med main og med main + 608 lagt oven i -------------------------------------------------
const S = (w, m) => join(w, 'assets', 'vaerktoejer', m)
const webMain = join(dir, 'webMain'), web608 = join(dir, 'web608')
for (const [w, rod] of [[webMain, lmMain], [web608, lm608]]) {
  cpSync(web, w, { recursive: true })
  rmSync(S(w, 'maal-billede'), { recursive: true }); cpSync(join(rod, 'dist', 'maal-billede'), S(w, 'maal-billede'), { recursive: true })
}
const typer = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.json': 'application/json', '.ico': 'image/x-icon', '.woff2': 'font/woff2' }
const server = createServer((req, res) => {
  const [, rod, ...rest] = decodeURIComponent(req.url.split('?')[0].split('#')[0]).split('/')
  const base = rod === 'm608' ? web608 : webMain
  let f = join(base, '/' + rest.join('/'))
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html')
  if (!existsSync(f)) { res.writeHead(404); return res.end() }
  res.writeHead(200, { 'content-type': typer[path.extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f))
}).listen(0)
const BASE = `http://127.0.0.1:${server.address().port}`
const V = '/assets/vaerktoejer'
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const browser = await chromium.launch({ headless: true, executablePath: CHROME })
ud.chrome = browser.version()
const eksterne = new Set()
const FILER = join(dir, 'filer'); mkdirSync(FILER)
async function side(bredde, rod = 'm608') {
  const mobil = bredde < 500
  const ctx = await browser.newContext({ viewport: { width: bredde, height: mobil ? 780 : 900 }, deviceScaleFactor: mobil ? 3 : 1, isMobile: mobil, hasTouch: mobil, acceptDownloads: true })
  const page = await ctx.newPage()
  const T = { ctx, page, mobil, bredde, fejl: [] }
  page.on('pageerror', (e) => T.fejl.push(e.message))
  await page.route('**/*', (r) => { const u = r.request().url(); if (u.startsWith(BASE) || /^(data|blob):/.test(u)) return r.continue(); eksterne.add(u.split('?')[0]); return r.abort() })
  await page.goto(`${BASE}/${rod}${V}/maal-billede/index.html`, { waitUntil: 'load' })
  await page.waitForSelector('[data-klar]')
  return T
}
async function tryk(T, sel) { const l = T.page.locator(sel).first(); await l.scrollIntoViewIfNeeded(); if (T.mobil) await l.tap(); else await l.click() }
async function gem(T, sel, navn) {
  const [dl] = await Promise.all([T.page.waitForEvent('download', { timeout: 30000 }), tryk(T, sel)])
  const fil = join(FILER, navn); await dl.saveAs(fil)
  return { fil, forslag: dl.suggestedFilename(), buf: readFileSync(fil) }
}
// Aabn med den rigtige filvaelger. `som` = { name, mimeType } efterligner, hvad telefonens vaelger giver siden.
async function aabn(T, buf, som) {
  await T.page.setInputFiles('[data-fil]', { name: som.name, mimeType: som.mimeType, buffer: buf })
  await T.page.waitForFunction(() => !!window.maalBillede.tilstand().billede, null, { timeout: 30000 }).catch(() => {})
  await T.page.waitForTimeout(600)
}
const INFO = () => { const s = window.maalBillede.tilstand(); const q = (x) => document.querySelector(x); return { fase: s.faseId, hoejde: q('[data-hoejde]').value, punkter: Object.keys(s.punkter).length, w: s.billede?.naturalWidth || 0, note: q('[data-gemtnote]').hidden ? null : q('[data-gemtnote]').textContent, navn: q('[data-navn]').textContent } }

// --- 3) M1 paa ordre-608: miniaturerne ------------------------------------------------------------------------
{
  const mini = (rod) => join(rod, 'dist', 'maal-billede', 'miniaturer')
  const filer = readdirSync(mini(lmMain)).filter((f) => f.endsWith('.svg'))
  const T = await side(1280)
  for (const f of filer) {
    const a = readFileSync(join(mini(lmMain), f), 'utf8'), b = readFileSync(join(mini(lm608), f), 'utf8')
    const taeller = (s) => ({ felter: (s.match(/fill-opacity="0\.78"/g) || []).length, tekster: (s.match(/<text[\s>]/g) || []).length, linjer: s.split('\n').length })
    // Er 608 = main uden de tre felter? (Kun svg-hovedet og baggrunden maa ellers vaere anderledes: viewBox strammes, naar et felt ved kanten er vaek.)
    const al = a.split(/\r?\n/).filter((l) => !/fill-opacity="0\.78"/.test(l)), bl = b.split(/\r?\n/) // git archive giver CRLF her
    const andre = al.map((l, k) => [l, bl[k]]).filter(([x, y]) => x !== y).map(([x, y]) => ({ main: x.slice(0, 120), o608: (y || '').slice(0, 120) }))
    const vb = (s) => s.match(/viewBox="([^"]+)"/)[1]
    // Tegn begge i Chrome paa hvid bund, og maal hvor mange pixels 608 har aendret (felterne er de eneste, der skal vaek).
    const egen = al.map((l, k) => (/^<svg |^<rect [^>]*fill="#141410"\/>$/.test(l) ? bl[k] : l)).join('\n') // 601 uden felter, med 608's hoved
    const px = await T.page.evaluate(async ([A, B, C]) => {
      const tegn = async (s) => { const img = new Image(); img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(s))); await img.decode(); const k = new OffscreenCanvas(img.naturalWidth || 300, img.naturalHeight || 300); const x = k.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, k.width, k.height); x.drawImage(img, 0, 0); return { w: k.width, h: k.height, d: x.getImageData(0, 0, k.width, k.height).data } }
      const p = await tegn(A), q = await tegn(B); let aendret = 0, moerkt = 0
      for (let i = 0; i < p.d.length; i += 4) { const da = p.d[i] + p.d[i + 1] + p.d[i + 2], db = q.d[i] + q.d[i + 1] + q.d[i + 2]; if (Math.abs(da - db) > 30) { aendret++; if (db > da) moerkt++ } }
      const c = await tegn(C); let egenForskel = 0
      for (let i = 0; i < q.d.length; i += 4) if (Math.abs(q.d[i] - c.d[i]) + Math.abs(q.d[i + 1] - c.d[i + 1]) + Math.abs(q.d[i + 2] - c.d[i + 2]) > 0) egenForskel++
      return { w: p.w, h: p.h, aendret: +(100 * aendret / (p.w * p.h)).toFixed(2), lysereI608: aendret ? +(100 * moerkt / aendret).toFixed(1) : null, egenForskel }
    }, [a, b, egen])
    ud.m1[f] = { main: taeller(a), o608: taeller(b), ens: a === b, px, kunFelterVaek: al.length === bl.length && andre.every((d) => /^<svg |^<rect [^>]*fill="#141410"\/>$/.test(d.main)), viewBox: [vb(a), vb(b)], andre: andre.length }
  }
  // Se dem: de otte fra 608 i Chrome paa 390-bredde (to pr. raekke, som "Ligner").
  const P = await side(390, 'm608')
  await P.page.setContent(`<body style="margin:8px;background:#101010;color:#ccc">${filer.map((f) => `<figure style="display:inline-block;width:170px;margin:4px"><img src="${BASE}/m608${V}/maal-billede/miniaturer/${f}" style="width:170px"><figcaption style="font:11px sans-serif">${f}</figcaption></figure>`).join('')}</body>`)
  await P.page.waitForTimeout(800)
  await P.page.screenshot({ path: join(HERE, 'M-390-608-miniaturer.png'), fullPage: true })
  await P.ctx.close(); await T.ctx.close()
}
const M1 = Object.entries(ud.m1)
paastaa('M1 lukket paa main (608): 0 moerke tekstfelter i alle otte; baenkens og doedloeftets fire er aendret, squattens fire er byte for byte de samme', M1.every(([, m]) => m.o608.felter === 0) && M1.filter(([f]) => /^(bp|dl)-/.test(f)).every(([, m]) => m.main.felter === 3 && !m.ens) && M1.filter(([f]) => /^sq-/.test(f)).every(([, m]) => m.ens), M1.map(([f, m]) => `${f}: felter ${m.main.felter}->${m.o608.felter}, aendret ${m.px.aendret}%`))
paastaa('608: miniaturerne er 601s uden de tre felter, linje for linje, og tegnet pixel for pixel de samme som 601s uden felterne (0 pixels forskel, altsaa 0 % daekket); kun svg-hovedet og baggrunden er ellers anderledes (baenkens viewBox flyttet 3,19 enheder, ca. 1,2 px ved 150 px, fordi feltet ved kanten er vaek); doedloeftets aendrede pixels er alle blevet lysere', M1.every(([, m]) => m.kunFelterVaek && m.px.egenForskel === 0) && M1.filter(([f]) => /^dl-/.test(f)).every(([, m]) => m.px.lysereI608 === 100), M1.map(([f, m]) => `${f}: viewBox ${m.viewBox.join(' -> ')}, andre linjer ${m.andre}, egen forskel ${m.px.egenForskel} px, lysere ${m.px.lysereI608}%`))

// --- 4) Syntetiske billeder og to gemte filer (uge 1 og uge 8) ----------------------------------------------------
const imp = (rod, f) => import(pathToFileURL(join(rod, 'src', f)).href)
const { PUNKTER, SKIVE_CM } = await imp(lmMain, 'maalBillede.js')
const { kroppe, modelFase } = await imp(lmMain, 'maalBilledeModel.js')
const iBillede = (P, { pxPrCm = 3, x0 = 600, y0 = 1300, dy = 0 } = {}) => { const o = {}; for (const { id } of PUNKTER) o[id] = { x: x0 + P[id].x * pxPrCm, y: y0 - P[id].y * pxPrCm - (id === 'hofte' ? dy : 0) }; o.skalaA = { x: o.stang.x, y: o.stang.y - (SKIVE_CM / 2) * pxPrCm }; return o }
const MP = modelFase('dl-gulv', kroppe('doedloeft', null, { hoejde: '180', stangKg: 200 }).snit)
const Q1 = iBillede(MP.punkter), Q8 = iBillede(MP.punkter, { dy: 36 })
const BILLEDE = async ([w, h, farve, navn]) => {
  const k = document.createElement('canvas'); k.width = w; k.height = h; const x = k.getContext('2d')
  x.fillStyle = farve; x.fillRect(0, 0, w, h); x.fillStyle = '#ddd'; x.fillRect(w * 0.1, h * 0.07, w * 0.2, h * 0.2); x.fillStyle = '#835'; x.fillRect(w * 0.55, h * 0.5, w * 0.3, h * 0.1)
  const url = URL.createObjectURL(await new Promise((ok) => k.toBlob(ok, 'image/png')))
  return window.maalBillede.laesBillede(url, navn, true)
}
const MAAL = ([Q]) => { const m = window.maalBillede; m.saetKrop({ hoejde: '180', vaegt: '90' }); m.saetStangKg(200); m.saetFase('dl-gulv'); m.saetPunkter(Q) }
const gemte = {}
for (const [uge, Q, navn] of [[1, Q1, 'IMG_4411.jpg'], [8, Q8, 'IMG_5120.jpg']]) {
  const T = await side(1280)
  await T.page.evaluate(BILLEDE, [1000, 1400, uge === 1 ? '#556' : '#565', navn])
  await T.page.evaluate(MAAL, [Q]); await T.page.waitForTimeout(400)
  gemte[uge] = await gem(T, '[data-gem]', `uge-${uge}.png`)
  await T.ctx.close()
}

// Min egen PNG-laeser og -skriver (uafhaengig af maalGemt.js).
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 } return (b) => { let c = 0xffffffff; for (const x of b) c = t[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 } })()
function dele(buf) { const b = Buffer.from(buf); const ud = []; let i = 8; while (i + 12 <= b.length) { const n = b.readUInt32BE(i); const type = b.toString('latin1', i + 4, i + 8); if (i + 12 + n > b.length) break; ud.push({ type, pos: i, n, raa: b.subarray(i, i + 12 + n) }); i += 12 + n; if (type === 'IEND') break } return ud }
const lavDel = (type, data) => { const b = Buffer.alloc(12 + data.length); b.writeUInt32BE(data.length, 0); b.write(type, 4, 'latin1'); data.copy(b, 8); b.writeUInt32BE(CRC(b.subarray(4, 8 + data.length)), 8 + data.length); return b }
const SIG = Buffer.from('89504e470d0a1a0a', 'hex')
const saml = (D) => Buffer.concat([SIG, ...D.map((d) => d.raa)])
const medDato = (buf, dato) => medMeta(buf, (m) => { m.gemt = dato }) // som en fil gemt en anden dag
function medMeta(buf, fn) { // skriv enTr's meta om (rigtig CRC)
  const D = dele(buf), d = D.find((x) => x.type === 'enTr'); const data = d.raa.subarray(8, 8 + d.n)
  const jl = data.readUInt32BE(21); const meta = JSON.parse(data.toString('utf8', 25, 25 + jl)); fn(meta)
  const json = Buffer.from(JSON.stringify(meta), 'utf8'); const hoved = Buffer.from(data.subarray(0, 25)); hoved.writeUInt32BE(json.length, 21)
  const ny = lavDel('enTr', Buffer.concat([hoved, json, data.subarray(25 + jl)]))
  return saml(D.map((x) => x === d ? { raa: ny } : x))
}

// --- 5) Punkt 1: det, en telefon eller et program kan goere ved filen ---------------------------------------------
{
  const org = gemte[1].buf, D = dele(org)
  const kritiske = D.filter((d) => ['IHDR', 'PLTE', 'IDAT', 'IEND'].includes(d.type))
  const idat = D.findIndex((d) => d.type === 'IDAT')
  const enTrDel = D.find((d) => d.type === 'enTr')
  // Metadata, som Fotos/Arkiver eller et andet program kan laegge i et PNG (eXIf, iTXt med XMP, iDOT fra Apple, tEXt, tIME).
  const meta = [lavDel('eXIf', Buffer.from('MM\0*\0\0\0\x08\0\0', 'latin1')), lavDel('iTXt', Buffer.from('XML:com.adobe.xmp\0\0\0\0\0<x:xmpmeta/>', 'latin1')), lavDel('iDOT', Buffer.alloc(28)), lavDel('tEXt', Buffer.from('Software\0Fotos', 'latin1')), lavDel('tIME', Buffer.from([7, 234, 9, 28, 12, 0, 0]))].map((raa) => ({ raa }))
  const T0 = await side(390)
  const jpegB64 = await T0.page.evaluate(async (b64) => { const b = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); const bm = await createImageBitmap(new Blob([b], { type: 'image/png' })); const k = new OffscreenCanvas(bm.width, bm.height); k.getContext('2d').drawImage(bm, 0, 0); const j = await k.convertToBlob({ type: 'image/jpeg', quality: 0.8 }); const p = await k.convertToBlob({ type: 'image/png' }); const t = async (x) => btoa(Array.from(new Uint8Array(await x.arrayBuffer()), (c) => String.fromCharCode(c)).join('')); return [await t(j), await t(p)] }, org.toString('base64'))
  await T0.ctx.close()
  const varianter = [
    ['uroert fil', org, { name: 'maal-dl-gulv-img-4411.png', mimeType: 'image/png' }],
    ['kun billedets egne dele (et program, der "optimerer" eller skriver PNG\'et om)', saml(kritiske), { name: 'maal-dl-gulv-img-4411.png', mimeType: 'image/png' }],
    ['tegnet om og gemt som PNG igen (redigeret, beskaaret, skaermbillede)', Buffer.from(jpegB64[1], 'base64'), { name: 'maal-dl-gulv-img-4411.png', mimeType: 'image/png' }],
    ['som JPEG (chat-app, "Mest kompatibel", HEIC->JPEG)', Buffer.from(jpegB64[0], 'base64'), { name: 'IMG_0412.JPG', mimeType: 'image/jpeg' }],
    ['med ekstra metadata foer IDAT (eXIf, XMP, iDOT, tEXt, tIME)', saml([...D.slice(0, idat), ...meta, ...D.slice(idat)]), { name: 'maal-dl-gulv-img-4411.png', mimeType: 'image/png' }],
    ['maalingen flyttet foer billedet (enTr foer IDAT)', saml([...D.slice(0, idat).filter((d) => d !== enTrDel), enTrDel, ...D.slice(idat).filter((d) => d !== enTrDel)]), { name: 'maal-dl-gulv-img-4411.png', mimeType: 'image/png' }],
    ['navnet IMG_0412.PNG uden type', org, { name: 'IMG_0412.PNG', mimeType: '' }],
    ['navn uden endelse, type image/png', org, { name: '1000012345', mimeType: 'image/png' }],
    ['navn uden endelse og uden type', org, { name: '1000012345', mimeType: '' }],
    ['application/octet-stream, navnet download', org, { name: 'download', mimeType: 'application/octet-stream' }],
    ['PNG-bytes med navnet .jpg og typen image/jpeg', org, { name: 'maal.jpg', mimeType: 'image/jpeg' }],
  ]
  // M4 fra 603 (608, commit 2): filer med en maaling, siden ikke kan bruge. Samme slags som i 603, lavet af mig med rigtig CRC.
  const m4 = [
    ['M4 oedelagt CRC', (() => { const b = Buffer.from(org); b[enTrDel.pos + 40] ^= 1; return b })()],
    ['M4 afkortet fil', org.subarray(0, Math.floor(org.length * 0.6))], // skaaret i billedet: delen er helt vaek
    ['M4 afkortet i maalingen', org.subarray(0, enTrDel.pos + 2000)],
    ['M4 version 2', medMeta(org, (m) => { m.v = 2 })],
    ['M4 ukendt fase', medMeta(org, (m) => { m.faelles.faseId = 'hop-bund' })],
    ['M4 forkert stoerrelse', medMeta(org, (m) => { m.pladser[0].w = 2000; m.pladser[0].h = 2800 })],
    ['M4 dato 2026-13-45', medMeta(org, (m) => { m.gemt = '2026-13-45' })],
  ].map(([hvad, buf]) => [hvad, buf, { name: 'maal-dl-gulv-img-4411.png', mimeType: 'image/png' }])
  for (const rod of ['m601', 'm608']) for (const [hvad, buf, som] of [...varianter, ...m4]) {
    const T = await side(390, rod)
    await aabn(T, buf, som)
    const i = await T.page.evaluate(INFO)
    ud.tele.push({ rod, hvad, som, bytes: buf.length, dele: dele(buf).map((d) => d.type).filter((t, k, a) => a.indexOf(t) === k), aabnetSomMaaling: i.punkter === 7 && /^Gemt måling åbnet/.test(i.note || ''), ...i, jsFejl: T.fejl })
    if (rod === 'm608' && hvad.startsWith('navn uden endelse og uden type')) { await T.page.locator('[data-navn]').first().scrollIntoViewIfNeeded().catch(() => {}); await T.page.screenshot({ path: join(HERE, 'M-390-610-uden-navn-og-type.png') }) }
    if (rod === 'm608' && hvad === 'M4 oedelagt CRC') { await T.page.locator('[data-gemtnote]').first().scrollIntoViewIfNeeded().catch(() => {}); await T.page.screenshot({ path: join(HERE, 'M-390-608-m4-note.png') }) }
    await T.ctx.close()
  }
  ud.accept = readFileSync(join(lmMain, 'dist', 'maal-billede', 'maal-billede.js'), 'utf8').match(/accept=\\?"image\/\*\\?" data-fil/) ? 'image/*' : '?'
}
const TE = Object.fromEntries(ud.tele.filter((t) => t.rod === 'm601').map((t) => [t.hvad.split(' (')[0], t]))
const T8 = Object.fromEntries(ud.tele.filter((t) => t.rod === 'm608').map((t) => [t.hvad.split(' (')[0], t]))
const FJERNET = ['kun billedets egne dele', 'tegnet om og gemt som PNG igen', 'som JPEG']
const uden = ['navn uden endelse og uden type', 'application/octet-stream, navnet download', 'PNG-bytes med navnet .jpg og typen image/jpeg']
paastaa('punkt 1 (main): den uroerte fil, ekstra metadata foer IDAT (eXIf, XMP, iDOT, tEXt, tIME) og maalingen flyttet foer billedet aabnes alle som maalingen (7 klik, noten); ogsaa IMG_0412.PNG uden type og et navn uden endelse med typen image/png', ['uroert fil', 'med ekstra metadata foer IDAT', 'maalingen flyttet foer billedet', 'navnet IMG_0412.PNG uden type', 'navn uden endelse, type image/png'].every((k) => T8[k].aabnetSomMaaling && TE[k].aabnetSomMaaling), ud.tele.filter((t) => t.rod === 'm608').map((t) => `${t.hvad}: ${t.aabnetSomMaaling ? 'maaling' : `billede ${t.w} px, ${t.punkter} klik${t.note ? ', note' : ''}`}`))
paastaa('punkt 1 (main): fjernes delen (kun billedets dele, tegnet om, JPEG), aabnes filen som et almindeligt billede uden klik og uden besked, ogsaa efter 608 (der er intet spor at finde)', FJERNET.every((k) => !T8[k].aabnetSomMaaling && T8[k].w > 0 && T8[k].punkter === 0 && T8[k].note === null), FJERNET.map((k) => ({ k, w: T8[k].w, note: T8[k].note })))
paastaa('fund M5 (601 og main): en uroert fil, som vaelgeren giver uden .png i navnet og uden typen image/png, aabnes som et almindeligt billede uden klik og uden note; laesFil kigger paa navn og type, ikke paa filens foerste 8 bytes', uden.every((k) => !T8[k].aabnetSomMaaling && T8[k].w > 0 && T8[k].note === null && !TE[k].aabnetSomMaaling), uden.map((k) => ({ k, klik: T8[k].punkter, note: T8[k].note })))
const M4 = ['M4 oedelagt CRC', 'M4 afkortet i maalingen', 'M4 version 2', 'M4 ukendt fase', 'M4 forkert stoerrelse']
paastaa('M4 paa 601 (som i 603): fire ubrugelige maalinger aabnes stille som et almindeligt billede, og en med forkert stoerrelse aabnes med 7 klik paa forkerte steder', M4.filter((k) => k !== 'M4 forkert stoerrelse').every((k) => TE[k].punkter === 0 && TE[k].note === null && TE[k].w > 0) && TE['M4 forkert stoerrelse'].punkter === 7, M4.map((k) => ({ k, p: TE[k].punkter, w: TE[k].w, note: (TE[k].note || '').slice(0, 40) })))
paastaa('M4 lukket paa main (608): de fem aabnes som billedet uden klik, og noten siger "Filen har en gemt maaling, som siden ikke kan laese" (version 2: "fra en nyere udgave"); datoen 2026-13-45 smides vaek, og maalingen bruges med sine 7 klik', M4.every((k) => T8[k].punkter === 0 && T8[k].w > 0 && (k === 'M4 version 2' ? /nyere udgave/.test(T8[k].note || '') : /som siden ikke kan læse/.test(T8[k].note || ''))) && T8['M4 dato 2026-13-45'].punkter === 7 && /^Gemt måling åbnet:/.test(T8['M4 dato 2026-13-45'].note || ''), [...M4, 'M4 dato 2026-13-45'].map((k) => ({ k, p: T8[k].punkter, note: (T8[k].note || '').slice(0, 110) })))
paastaa('M4: en fil, der er skaaret over i selve billedet (60 %), har intet spor af maalingen tilbage og aabnes som et halvt billede uden note, baade 601 og main', T8['M4 afkortet fil'].note === null && T8['M4 afkortet fil'].punkter === 0 && TE['M4 afkortet fil'].note === null, { main: T8['M4 afkortet fil'].dele, w: T8['M4 afkortet fil'].w })
paastaa('punkt 1: 0 JS-fejl i alle varianter (main og 608)', ud.tele.every((t) => !t.jsFejl.length), ud.tele.map((t) => t.jsFejl.length))

// --- 6) Punkt 2: teksten om, hvad filen har i sig ----------------------------------------------------------------
{
  const T = await side(390)
  await aabn(T, gemte[1].buf, { name: 'maal-dl-gulv-img-4411.png', mimeType: 'image/png' })
  ud.tekst = await T.page.evaluate(() => {
    const g = document.querySelector('[data-gemnote]'); const r = g.getBoundingClientRect()
    const intet = [...document.querySelectorAll('p, li')].find((e) => /Intet gemmes, og intet sendes/.test(e.textContent))
    return { gemnote: g.textContent.replace(/\s+/g, ' ').trim(), gemnoteSynlig: g.offsetParent !== null, gemnoteBredde: Math.round(r.width), intet: intet?.textContent.replace(/\s+/g, ' ').trim(), knap: document.querySelector('[data-gem]').textContent.trim() }
  })
  await T.ctx.close()
  const f603 = JSON.parse(readFileSync(join(HERE, '..', 'kritik-603', 'maal-603.json'), 'utf8'))
  ud.tekst.gemnoteSomI603 = f603.gem?.find((g) => g.rod === 'm601')?.knap?.note === ud.tekst.gemnote
}
paastaa('punkt 2: noten under Gem siger, at filen har billedet, klikkene, fasen, hoejden og vaegten, og at en chat-app smider maalingen vaek; "Intet gemmes" siger det samme; teksten er den, jeg vurderede i 603', /billedet, klikkene, fasen, højden og vægten/.test(ud.tekst.gemnote) && /chat-app/.test(ud.tekst.gemnote) && /måling/.test(ud.tekst.intet || '') && ud.tekst.gemnoteSomI603, ud.tekst)

// --- 7) Punkt 3: foer og efter fra to filer med hver sin dato ----------------------------------------------------------
const f1 = medDato(gemte[1].buf, '2026-08-03'), f8 = medDato(gemte[8].buf, '2026-09-28')
const LAES = () => ({ foer: document.querySelector('[data-foertekst]').textContent, efter: document.querySelector('[data-eftertekst]').textContent, note: document.querySelector('[data-gemtnote]').hidden ? null : document.querySelector('[data-gemtnote]').textContent, tabel: [...document.querySelectorAll('[data-foereftertal] tbody tr')].map((t) => [...t.children].map((x) => x.textContent.replace(/\s+/g, ' ').trim())), saetning: [...document.querySelectorAll('[data-foereftertal] p')].map((p) => p.textContent.replace(/\s+/g, ' ').trim()).join(' | '), advarer: /nyere|ældre|senere|tidligere|omvendt|byt/i.test([...document.querySelectorAll('[data-foereftertal] p, [data-gemtnote], [data-foertekst], [data-eftertekst]')].map((e) => e.textContent).join(' ')) })
for (const [rod, bredde] of [['m608', 390], ['m608', 1280], ['m601', 390]]) for (const orden of ['rigtig', 'forkert']) {
  const T = await side(bredde, rod)
  const [a, b] = orden === 'rigtig' ? [f1, f8] : [f8, f1]
  await aabn(T, a, { name: orden === 'rigtig' ? 'maal-dl-gulv-img-4411.png' : 'maal-dl-gulv-img-5120.png', mimeType: 'image/png' })
  await tryk(T, '[data-sammenlign]'); await T.page.waitForTimeout(300)
  await tryk(T, '[data-plads="efter"]'); await T.page.waitForTimeout(200)
  await aabn(T, b, { name: orden === 'rigtig' ? 'maal-dl-gulv-img-5120.png' : 'maal-dl-gulv-img-4411.png', mimeType: 'image/png' })
  await T.page.waitForTimeout(400)
  const r = { rod, bredde, orden, foer: await T.page.evaluate(LAES) }
  // Er Byt til at finde? Hvor staar den i forhold til Foer og Efter, og er den i skaermen, naar forskellen er?
  r.bytPlads = await T.page.evaluate(() => { const q = (s) => document.querySelector(s).getBoundingClientRect(); const b = q('[data-byt]'), e = q('[data-plads="efter"]'); const t = document.querySelector('[data-foereftertal]'); t.scrollIntoView({ block: 'start' }); const b2 = q('[data-byt]'); return { hoejde: Math.round(b.height), bredde: Math.round(b.width), afstandTilEfter: Math.round(Math.hypot(b.left - e.right, b.top - e.top)), samme_linje: Math.abs(b.top - e.top) < 4, synligVedTallene: b2.bottom > 0 && b2.top < innerHeight, aktiv: !document.querySelector('[data-byt]').disabled } })
  if (orden === 'forkert') {
    await T.page.locator('[data-foertekst]').first().scrollIntoViewIfNeeded().catch(() => {}); await T.page.waitForTimeout(150)
    if (rod === 'm608') await T.page.screenshot({ path: join(HERE, `M-${bredde}-610-forkert-orden.png`) })
    await tryk(T, '[data-byt]'); await T.page.waitForTimeout(400)
    r.byttet = await T.page.evaluate(LAES)
  }
  r.jsFejl = T.fejl
  ud.datoer.push(r)
  await T.ctx.close()
}
const DA = ud.datoer, hofte = (t) => t.tabel.find((x) => /hofte/i.test(x[0]))
const rig = DA.filter((r) => r.orden === 'rigtig'), fork = DA.filter((r) => r.orden === 'forkert')
paastaa('punkt 3: begge billeder fra filer: datoen staar ved begge ("Foer: ... (gemt 3. aug. 2026)", "Efter: ... (gemt 28. sep. 2026)")', DA.every((r) => /\(gemt \d+\. [a-z]+\.? 2026\)$/.test(r.foer.foer) && /\(gemt \d+\. [a-z]+\.? 2026\)$/.test(r.foer.efter)), DA.map((r) => `${r.rod} ${r.bredde} ${r.orden}: ${r.foer.foer} | ${r.foer.efter}`))
paastaa('punkt 3, fund M6: aabnes uge 8 under Foer og uge 1 under Efter, staar datoerne baglaens (28. sep. foer 3. aug.) uden et ord fra siden; forskellen og saetningen er vendt; Byt retter det', fork.every((r) => !r.foer.advarer && hofte(r.foer)?.[3] && hofte(r.foer)[3] !== hofte(rig.find((x) => x.bredde === r.bredde && x.rod === r.rod).foer)[3] && r.byttet && JSON.stringify(r.byttet.tabel) === JSON.stringify(rig.find((x) => x.bredde === r.bredde && x.rod === r.rod).foer.tabel)), fork.map((r) => ({ rod: r.rod, b: r.bredde, foer: r.foer.foer, efter: r.foer.efter, hofteForkert: hofte(r.foer), hofteRigtig: hofte(rig.find((x) => x.bredde === r.bredde && x.rod === r.rod).foer), saetning: r.foer.saetning.slice(0, 200) })))
paastaa('punkt 3: Byt staar paa linje med Foer og Efter, 8 px fra Efter, er slaaet til og 44 px hoej; den er ikke i skaermen, naar tallene er (man ruller op til den)', DA.every((r) => r.bytPlads.samme_linje && r.bytPlads.aktiv) && DA.filter((r) => r.bredde === 390).every((r) => r.bytPlads.hoejde >= 40), DA.map((r) => ({ rod: r.rod, b: r.bredde, o: r.orden, ...r.bytPlads })))
paastaa('punkt 3: 0 JS-fejl', DA.every((r) => !r.jsFejl.length))

ud.eksterne = [...eksterne]
paastaa('alt, siderne proevede at hente udefra, er afbrudt og var kun skrifttypen', [...eksterne].every((u) => /fonts\.(googleapis|gstatic)\.com/.test(u)), [...eksterne])
await browser.close(); server.close()
rmSync(dir, { recursive: true, force: true })
writeFileSync(join(HERE, 'maal-610.json'), JSON.stringify({ ...ud, tjek }, null, 1))
const roede = tjek.filter((t) => !t.ok)
console.log(`\nmaal-610: ${tjek.length - roede.length}/${tjek.length} tjek groenne (${ud.chrome})`)
process.exit(roede.length ? 1 : 0)
