// Kritik 628, blok 1: Maal dit billede efter Yantras 621 (Uger). Yantras punkter under "Bhishak boer tjekke" i rapport
// dag 94, med mine egne scripts og kun syntetiske maalinger:
//   1) Uger paa 390 px: kan tabellen laeses, naar den ruller sidelaens, og er det tydeligt, at forskellen er fra den
//      aeldste uge og ikke fra ugen foer?
//   2) mange celler og maalefejlen: hvor mange guldceller giver 8 og 12 uger af SAMME stilling (Monte Carlo med
//      Yantras egen antagne klikfejl), og hvad goer andre regler (kun nyeste, to uger i traek)?
//   3) faelles krop mod filens egen: hvad sker der, naar filerne har hver sin hoejde, naar siden allerede har en anden
//      hoejde, og naar sidens fase er en anden end filernes?
//   (hop563 maales i hop-628.mjs.)
//   node outputs/kritik-628/maal-628.mjs     -> maal-628.json og M-*.png
// Loeftmodellen (main = 621, og 4ca0c63 = 616, det sitet har) og sitet (vaerktoejer) hentes med `git archive`; intet
// trae roeres. Siden maales i sitets kopi med main's dist/maal-billede/ lagt oven i (/m621/); /m616/ er sitet, som det er.
// Google Chrome (den installerede) headless, 390 touch og 1280 mus, alt net uden for den lokale server afbrudt.
// Filerne: een fil gemt med sidens egen Gem-knap, derefter skrevet om af min egen PNG-skriver (klik, dato, hoejde).
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
const FOER = '4ca0c63' // 616 merget; det sitet har (1169b5f)
const MC_N = +(process.env.MC_N || 2000)
const sh = (c) => execSync(c, { maxBuffer: 1 << 26 }).toString()
const rev = (repo, r) => sh(`git -C "${repo}" rev-parse --short ${r}`).trim()
const ver = { main: rev(LM, 'main'), site: rev(SITE, GREN), foer: FOER }
ver.o621Merget = sh(`git -C "${LM}" merge-base --is-ancestor refs/heads/ordre-621 main && echo ja || echo nej`).trim()
ver.mainSiden616 = sh(`git -C "${LM}" log --format=%h%x20%s ${FOER}..main`).trim().split(/\r?\n/).filter(Boolean)
ver.rapport95 = sh(`git -C "${LM}" ls-tree --name-only main docs/`).includes('RAPPORT-dag-95.md')
const dir = mkdtempSync(join(tmpdir(), 'k628-'))
const hent = (repo, ref, hvor, stier = '') => { mkdirSync(hvor, { recursive: true }); execSync(`git -C "${repo}" archive -o "${join(hvor, 'a.tar')}" ${ref} ${stier}`); execSync('tar -xf a.tar', { cwd: hvor }); rmSync(join(hvor, 'a.tar')) }
const lmMain = join(dir, '_main'), web = join(dir, 'web')
hent(LM, 'main', lmMain, 'dist src kroppe package.json')
hent(SITE, GREN, web)
const tjek = []
const paastaa = (hvad, ok, data) => { tjek.push({ hvad, ok: !!ok, data }); console.log(`${ok ? 'ok ' : 'NEJ'} ${hvad}${data !== undefined ? ' ' + JSON.stringify(data).slice(0, 900) : ''}`) }
const ud = { ver, kopi: {}, ui: [], mc: {}, krop: {}, andet: {} }

// --- 0) Hvad er nyt, og hvad skal Setu kopiere ----------------------------------------------------------------
const blobs = (repo, ref, d) => Object.fromEntries(sh(`git -C "${repo}" ls-tree -r ${ref} -- ${d}/`).split('\n').filter(Boolean).map((l) => { const [meta, f] = l.split('\t'); return [f.slice(d.length + 1), meta.split(' ')[2]] }))
const forskelle = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((f) => a[f] !== b[f])
for (const m of ['maal-billede', 'baenk-figurer', 'tre-loeft', 'min-krop']) {
  const site = blobs(SITE, GREN, `assets/vaerktoejer/${m}`)
  ud.kopi[m] = { siteModFoer: forskelle(blobs(LM, FOER, `dist/${m}`), site), siteModMain: forskelle(blobs(LM, 'main', `dist/${m}`), site) }
}
ud.kopi.distSiden616 = sh(`git -C "${LM}" diff --name-only ${FOER} main -- dist`).trim().split(/\r?\n/).filter(Boolean)
paastaa(`621 er merget (main ${ver.main}); sitet (${ver.site}) er blob for blob ${FOER} i alle fire mapper; i dist er kun maal-billede.js og index.html aendret siden`, ver.o621Merget === 'ja' && Object.values(ud.kopi).filter((k) => k.siteModFoer).every((k) => !k.siteModFoer.length) && ud.kopi.distSiden616.join() === 'dist/maal-billede/index.html,dist/maal-billede/maal-billede.js' && ud.kopi['maal-billede'].siteModMain.sort().join() === 'index.html,maal-billede.js', { dist: ud.kopi.distSiden616, siteModMain: ud.kopi['maal-billede'].siteModMain, rapport95: ver.rapport95 })

// --- Server: sitet som det er (/m616/) og med main's maal-billede lagt oven i (/m621/) -------------------------
const S = (w, m) => join(w, 'assets', 'vaerktoejer', m)
const web621 = join(dir, 'web621')
cpSync(web, web621, { recursive: true }); rmSync(S(web621, 'maal-billede'), { recursive: true }); cpSync(join(lmMain, 'dist', 'maal-billede'), S(web621, 'maal-billede'), { recursive: true })
const typer = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.json': 'application/json', '.ico': 'image/x-icon', '.woff2': 'font/woff2' }
const server = createServer((req, res) => {
  const [, rod, ...rest] = decodeURIComponent(req.url.split('?')[0].split('#')[0]).split('/')
  let f = join(rod === 'm621' ? web621 : web, '/' + rest.join('/'))
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html')
  if (!existsSync(f)) { res.writeHead(404); return res.end() }
  res.writeHead(200, { 'content-type': typer[path.extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f))
}).listen(0)
const BASE = `http://127.0.0.1:${server.address().port}`
const V = '/assets/vaerktoejer'
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
ud.chrome = browser.version()
const eksterne = new Set()
async function side(bredde, rod = 'm621') {
  const mobil = bredde < 500
  const ctx = await browser.newContext({ viewport: { width: bredde, height: mobil ? 844 : 900 }, deviceScaleFactor: mobil ? 3 : 1, isMobile: mobil, hasTouch: mobil, acceptDownloads: true })
  const page = await ctx.newPage()
  const T = { ctx, page, mobil, bredde, fejl: [] }
  page.on('pageerror', (e) => T.fejl.push(e.message))
  await page.route('**/*', (r) => { const u = r.request().url(); if (u.startsWith(BASE) || /^(data|blob):/.test(u)) return r.continue(); eksterne.add(u.split('?')[0]); return r.abort() })
  await page.goto(`${BASE}/${rod}${V}/maal-billede/index.html`, { waitUntil: 'load' })
  await page.waitForSelector('[data-klar]')
  return T
}
async function tryk(T, sel) { const l = T.page.locator(sel).first(); await l.scrollIntoViewIfNeeded(); if (T.mobil) await l.tap(); else await l.click() }

// --- Modellen og een fil gemt af siden selv ----------------------------------------------------------------------
const imp = (f) => import(pathToFileURL(join(lmMain, 'src', f)).href)
const { PUNKTER, SKIVE_CM, maal, skalaFraKrop, komplet } = await imp('maalBillede.js')
const { kroppe, modelFase } = await imp('maalBilledeModel.js')
const { ugeTabel } = await imp('maalUger.js')
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
// Min egen PNG-laeser og -skriver (uafhaengig af maalGemt.js), som i 610.
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
ud.basisMeta = (() => { const m = laesMeta(basis); return { v: m.v, gemt: m.gemt, faelles: m.faelles, w: m.pladser[0].w, h: m.pladser[0].h, punkter: Object.keys(m.pladser[0].punkter), runder: m.pladser[0].runder.length } })()
paastaa('sidens egen Gem gav en maaling (v1, 1000x1400, 7 punkter, dl-gulv, 180 cm)', ud.basisMeta.v === 1 && ud.basisMeta.w === 1000 && ud.basisMeta.punkter.length === 7 && ud.basisMeta.faelles.faseId === 'dl-gulv', ud.basisMeta)

// Klikfejl som Yantras taerskler antager (TAERSKEL_FOER_EFTER): een SD i hver retning, cm.
const KLIK_SD = { stang: 0.5, midtfod: 1.0, ankel: 1.0, knae: 1.0, hofte: 1.5, skulder: 1.5 }
function rng(seed) { let a = seed >>> 0; const u = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }; return () => Math.sqrt(-2 * Math.log(u() + 1e-12)) * Math.cos(2 * Math.PI * u()) }
const klikket = (Q, g) => { const o = JSON.parse(JSON.stringify(Q)); for (const [id, sd] of Object.entries(KLIK_SD)) { o[id].x += g() * sd * PX; o[id].y += g() * sd * PX } o.skalaA = { x: o.stang.x, y: o.stang.y - (SKIVE_CM / 2) * PX }; return o }
const mandag = (k) => new Date(Date.UTC(2026, 7, 3 + 7 * k)).toISOString().slice(0, 10) // uge 1 = 3. aug. 2026
// En uges fil: n runder med klikfejl om stillingen med hoften dy px hoejere.
function ugeFil(k, { dy = 0, runder = 1, g = null, hoejde = '180', gemt = mandag(k), navn = `IMG_${4411 + k}.jpg`, faseId = 'dl-gulv' } = {}) {
  const Q = iBillede(MP.punkter, { dy })
  const R = Array.from({ length: runder }, () => (g ? klikket(Q, g) : Q))
  return { runder: R, buf: medMeta(basis, (m) => { m.gemt = gemt; m.faelles.hoejde = hoejde; m.faelles.faseId = faseId; m.pladser[0].navn = navn; m.pladser[0].punkter = R[R.length - 1]; m.pladser[0].runder = R.slice(0, -1) }) }
}
async function vaelgUger(T, filer) {
  await T.page.setInputFiles('[data-ugefiler]', filer.map((f) => ({ name: f.name, mimeType: f.mimeType ?? 'image/png', buffer: f.buf })))
  await T.page.waitForFunction(() => document.querySelector('[data-ugestatus]').textContent.length > 0, null, { timeout: 30000 })
  await T.page.waitForTimeout(250)
}
const UGE_DOM = () => {
  const r = (e) => e.getBoundingClientRect()
  const sek = [...document.querySelectorAll('[data-ugefase]')].map((s) => {
    const t = s.querySelector('[data-ugetabel]'), rul = s.querySelector('.mb-ugerul')
    return {
      fase: s.dataset.ugefase, titel: s.querySelector('h3').textContent,
      hoved: [...t.querySelectorAll('thead th')].map((x) => x.textContent.replace(/\s+/g, ' ').trim()),
      raekker: [...t.querySelectorAll('tbody tr')].map((tr) => [...tr.children].map((x) => x.textContent.replace(/\s+/g, ' ').trim())),
      guld: t.querySelectorAll('[data-over]').length, kamera: t.querySelectorAll('[data-kamerakrav]').length,
      saetning: s.querySelector('[data-ugesaetning]')?.textContent.replace(/\s+/g, ' ').trim() || null,
      rul: { klient: rul.clientWidth, fuld: rul.scrollWidth, venstre: Math.round(r(rul).left), hoejde: Math.round(r(rul).height) },
      mindsteSkrift: Math.min(...[...t.querySelectorAll('td, th, small, strong')].map((e) => parseFloat(getComputedStyle(e).fontSize))),
      foersteKolonne: Math.round(r(t.querySelector('tbody td')).width),
      kolonneBredder: [...t.querySelectorAll('thead th')].map((x) => Math.round(r(x).width)),
      ude: [...s.querySelectorAll('.mb-note')].map((p) => p.textContent).join(' | '),
    }
  })
  const forkl = document.querySelector('[data-ugeforklaring]')
  return { status: document.querySelector('[data-ugestatus]').textContent, sek, forklaring: forkl?.textContent.replace(/\s+/g, ' ').trim() || null, forklaringTop: forkl ? Math.round(r(forkl).top + scrollY) : null, sideRul: document.scrollingElement.scrollWidth - innerWidth, hoejde: document.querySelector('[data-hoejde]').value, fase: window.maalBillede.tilstand().faseId }
}

// --- 1) Uger paa 390 og 1280: otte uger med en rigtig aendring, et foto og en fil uden endelse ---------------
{
  const g = rng(621)
  const DY = [0, 0, 3, 6, 9, 12, 15, 18] // hoften 0-6 cm hoejere over otte uger
  const uger = DY.map((dy, k) => ({ name: `maal-dl-gulv-img-${4411 + k}.png`, buf: ugeFil(k, { dy, runder: 3, g }).buf }))
  uger[5].name = '1000012345'; uger[5].mimeType = '' // M5: ingen endelse, ingen type
  const foto = { name: 'IMG_0001.PNG', buf: dele(basis).filter((d) => d.type !== 'enTr').reduce((a, d) => Buffer.concat([a, d.raa]), SIG) }
  const blandet = [uger[6], uger[2], foto, uger[0], uger[7], uger[4], uger[1], uger[5], uger[3]]
  for (const bredde of [390, 1280]) {
    const T = await side(bredde)
    // Knappen: hvor langt nede, og hvor hoej?
    const knap = await T.page.evaluate(() => { const l = document.querySelector('[data-ugefiler]').closest('label').getBoundingClientRect(); return { top: Math.round(l.top + scrollY), hoejde: Math.round(l.height), side: document.scrollingElement.scrollHeight } })
    await vaelgUger(T, blandet)
    const d = await T.page.evaluate(UGE_DOM)
    // Rul tabellen helt til hoejre: staar maalets navn stadig, og hvad ses?
    const rullet = await T.page.evaluate(() => {
      const rul = document.querySelector('.mb-ugerul'); rul.scrollIntoView({ block: 'start' }); rul.scrollLeft = rul.scrollWidth
      const r = (e) => e.getBoundingClientRect(); const td = rul.querySelector('tbody td'); const sidsteTh = [...rul.querySelectorAll('thead th')].at(-1)
      const synlige = [...rul.querySelectorAll('thead th')].filter((th) => { const b = r(th); return b.right > r(rul).left + r(td).width + 2 && b.left < r(rul).right - 2 }).map((th) => th.textContent.replace(/\s+/g, ' ').trim().slice(0, 16))
      return { navnVenstre: Math.round(r(td).left - r(rul).left), sidsteSes: r(sidsteTh).right <= r(rul).right + 1, synlige, foersteSes: synlige.some((s) => s.startsWith('3. aug')) }
    })
    await T.page.waitForTimeout(200)
    if (bredde === 390) await T.page.screenshot({ path: join(HERE, 'M-390-628-uger-rullet.png') })
    await T.page.evaluate(() => { const rul = document.querySelector('.mb-ugerul'); rul.scrollLeft = 0; document.querySelector('[data-uger]').scrollIntoView({ block: 'start' }) })
    await T.page.waitForTimeout(200)
    await T.page.screenshot({ path: join(HERE, `M-${bredde}-628-uger.png`), fullPage: false })
    // Hvor mange skaerme fra tabellens top til forklaringen ("forskellen fra den aeldste uge")?
    const afstand = await T.page.evaluate(() => { const r = (e) => e.getBoundingClientRect(); const t = document.querySelector('.mb-ugerul'); const f = document.querySelector('[data-ugeforklaring]'); return { tabelTopTilForklaring: Math.round(r(f).top - r(t).top), tabelHoejde: Math.round(r(t).height), skaerm: innerHeight } })
    ud.ui.push({ bredde, knap, ...d, rullet, afstand, jsFejl: T.fejl })
    await T.ctx.close()
  }
}
const U390 = ud.ui.find((u) => u.bredde === 390), U1280 = ud.ui.find((u) => u.bredde === 1280)
const datoer = (u) => u.sek[0].hoved.slice(1).map((h) => h.split(' ').slice(0, 3).join(' '))
paastaa('Uger (390 og 1280): 8 maalinger valgt i blandet orden (og et foto) staar i datoorden 3. aug. -> 21. sep.; fotoet siges ("har ingen gemt maaling"); filen uden endelse og type er med (M5)', ud.ui.every((u) => u.sek.length === 1 && u.sek[0].hoved.length === 9 && /^3\. aug/.test(u.sek[0].hoved[1]) && /^21\. sep/.test(u.sek[0].hoved[8]) && /IMG_0001\.PNG har ingen gemt måling/.test(u.status) && /^8 målinger/.test(u.status)), { datoer: datoer(U390), status: U390.status })
paastaa('Uger 390: siden ruller ikke sidelaens; tabellen ruller i sin egen boks, og maalets navn bliver staaende til venstre, naar den er rullet helt ud', ud.ui.every((u) => u.sideRul <= 0) && U390.sek[0].rul.fuld > U390.sek[0].rul.klient && Math.abs(U390.rullet.navnVenstre) <= 1 && U390.rullet.sidsteSes, { rul: U390.sek[0].rul, rullet: U390.rullet })
paastaa('Uger 390: hvor meget ses ad gangen? (maalets navn + kolonner i boksen; mindste skrift; foerste kolonnes bredde)', true, { klient: U390.sek[0].rul.klient, fuld: U390.sek[0].rul.fuld, skaermeBred: +(U390.sek[0].rul.fuld / U390.sek[0].rul.klient).toFixed(2), kolonner: U390.sek[0].kolonneBredder, mindsteSkrift: U390.sek[0].mindsteSkrift, synligeRullet: U390.rullet.synlige })
const hovedTekst = U390.sek[0].hoved.join(' | ')
paastaa('fund: "fra den aeldste" staar ikke i selve tabellen (hverken i kolonnernes hoved eller i cellerne); det staar i status over og i forklaringen under tabellen, og naar tabellen er rullet ud til de nyeste uger, er den aeldste uges kolonne ude af syne', !/ældste|uge 1|fra /i.test(hovedTekst) && /forskellen fra den ældste/.test(U390.forklaring) && !U390.rullet.foersteSes, { hoved: hovedTekst, afstand: U390.afstand, knap: U390.knap })
paastaa('Uger: saetningen over tabellen er den nyeste mod den aeldste ("Nyeste (21. sep. 2026) mod aeldste (3. aug. 2026)")', ud.ui.every((u) => /^Nyeste \(21\. sep\. 2026\) mod ældste \(3\. aug\. 2026\)/.test(u.sek[0].saetning || '')), U390.sek[0].saetning)
paastaa('Uger: 0 JS-fejl paa 390 og 1280', ud.ui.every((u) => !u.jsFejl.length))
ud.ui.forEach((u) => { u.hofteRaekke = u.sek[0].raekker.find((r) => /Hoftens højde/.test(r[0])) })
console.log('hoftens hoejde 390:', JSON.stringify(U390.hofteRaekke))

// --- 2) Mange celler og maalefejlen: Monte Carlo i node med sidens egne rene moduler -----------------------------
// Siden maaler hver runde med kroppens laengder som skala (kropsL = sidens faelles krop i sidens fase). Her samme:
// L fra kroppe('doedloeft', 180 cm, 90 kg, 200 kg) i dl-gulv. Tjekkes mod siden for tre forsoeg (se nedenfor).
const L = modelFase('dl-gulv', kroppe('doedloeft', null, { hoejde: '180', vaegt: '90', stangKg: 200 }).snit).L
const maalRunde = (q) => maal(q, { fase: 'dl-gulv', skala: null, retning: null, cmPrPx: skalaFraKrop(q, L) })
function forsoeg(g, { uger, runder, dyFra = null, dy = 0 }) {
  const poster = Array.from({ length: uger }, (_, k) => {
    const Q = iBillede(MP.punkter, { dy: dyFra !== null && k >= dyFra ? dy : 0 })
    return { navn: `u${k}`, gemt: mandag(k), faseId: 'dl-gulv', maal: Array.from({ length: runder }, () => maalRunde(klikket(Q, g))) }
  })
  return ugeTabel(poster)
}
// Hvad en celle er: over = guld (ikke kameraKrav, ikke inden for); fortegn til reglen "to uger i traek".
const over = (c) => c.forskel !== null && !c.kameraKrav && c.indenFor === false
function taelTabel(T) {
  const n = T.kolonner.length
  let guld = 0, raekkerHalvt = 0, toITraek = 0, raekkerMedGuld = 0
  for (const r of T.raekker) {
    const o = r.celler.map(over)
    const g = o.filter(Boolean).length; guld += g; if (g) raekkerMedGuld++
    if (g >= Math.ceil((n - 1) / 2) && g > 0) raekkerHalvt++
    for (let i = 2; i < n; i++) if (o[i] && o[i - 1] && Math.sign(r.celler[i].forskel) === Math.sign(r.celler[i - 1].forskel)) { toITraek++; break }
  }
  const sidste = T.raekker.some((r) => over(r.celler[n - 1]))
  const naboer = T.raekker.some((r) => { for (let i = 2; i < n; i++) if (over(r.celler[i]) && over(r.celler[i - 1]) && Math.sign(r.celler[i].forskel) === Math.sign(r.celler[i - 1].forskel)) return true; return false })
  const sidsteTo = T.raekker.some((r) => over(r.celler[n - 1]) && over(r.celler[n - 2]) && Math.sign(r.celler[n - 1].forskel) === Math.sign(r.celler[n - 2].forskel))
  const celler = T.raekker.reduce((a, r) => a + r.celler.slice(1).filter((c) => c.forskel !== null && !c.kameraKrav).length, 0)
  return { guld, celler, noget: guld > 0, raekkerMedGuld, raekkerHalvt, sidste, naboer, sidsteTo, saetningSigerForskel: !/ingen forskel over målefejlen/.test(T.saetning) }
}
function mc(navn, opt, seed) {
  const g = rng(seed); const R = []
  for (let i = 0; i < MC_N; i++) R.push(taelTabel(forsoeg(g, opt)))
  const andel = (k) => +(100 * R.filter((r) => r[k]).length / R.length).toFixed(1)
  const mid = (k) => +(R.reduce((a, r) => a + r[k], 0) / R.length).toFixed(2)
  ud.mc[navn] = { opt, n: MC_N, celler: R[0].celler, guldMiddel: mid('guld'), guldAndelAfCeller: +(100 * mid('guld') / R[0].celler).toFixed(1), nogetGuld: andel('noget'), raekkeGuldIHalvdelen: +(100 * R.filter((r) => r.raekkerHalvt > 0).length / R.length).toFixed(1), nyesteGuld: andel('sidste'), saetningSigerForskel: andel('saetningSigerForskel'), toITraekNogetSted: andel('naboer'), toITraekSidste: andel('sidsteTo') }
  console.log('mc', navn, JSON.stringify(ud.mc[navn]))
}
for (const [uger, runder] of [[2, 1], [2, 3], [8, 1], [8, 3], [12, 1], [12, 3]]) mc(`nul-${uger}u-${runder}r`, { uger, runder }, 1000 + uger * 10 + runder)
// En rigtig aendring: hoften 5 cm hoejere (15 px) fra uge 5 og frem.
for (const [uger, runder] of [[8, 3], [12, 3]]) mc(`hofte5-fra-u5-${uger}u-${runder}r`, { uger, runder, dyFra: 4, dy: 15 }, 2000 + uger * 10 + runder)
const MC = ud.mc
paastaa(`Monte Carlo (${MC_N} forsoeg pr. linje, Yantras antagne klikfejl, SAMME stilling alle uger): to uger giver en guldcelle i ${MC['nul-2u-3r'].nogetGuld} % (3 runder) og ${MC['nul-2u-1r'].nogetGuld} % (1 runde), altsaa foer og efters egen rate (her uden stangens raekker, der kraever det fjerne nav)`, MC['nul-2u-3r'].nogetGuld > 5 && MC['nul-2u-3r'].nogetGuld < 40, { to3: MC['nul-2u-3r'], to1: MC['nul-2u-1r'] })
paastaa(`fund: med 8 og 12 uger uden aendring staar der guld et sted i tabellen i ${MC['nul-8u-3r'].nogetGuld} % og ${MC['nul-12u-3r'].nogetGuld} % af forsoegene (3 runder), ${MC['nul-8u-1r'].nogetGuld} % og ${MC['nul-12u-1r'].nogetGuld} % (1 runde); i ${MC['nul-12u-3r'].raekkeGuldIHalvdelen} % (12 uger, 3 runder) lyser en hel raekke i mindst halvdelen af ugerne: guldet er spredte enkeltceller, ikke en raekke, der deler den aeldste uges klikfejl`, MC['nul-12u-3r'].nogetGuld > MC['nul-2u-3r'].nogetGuld * 1.5, { u8r3: MC['nul-8u-3r'], u12r3: MC['nul-12u-3r'], u8r1: MC['nul-8u-1r'], u12r1: MC['nul-12u-1r'] })
paastaa(`reglerne: kun nyeste mod aeldste i guld: ${MC['nul-12u-3r'].nyesteGuld} % falske (12 uger, 3 runder); guld kun naar de to nyeste uger begge er over i samme retning: ${MC['nul-12u-3r'].toITraekSidste} % falske; en hofte 5 cm hoejere fra uge 5 findes af nyeste i ${MC['hofte5-fra-u5-12u-3r'].nyesteGuld} % og af to-i-traek i ${MC['hofte5-fra-u5-12u-3r'].toITraekSidste} %`, true, { nul: { nyeste: MC['nul-12u-3r'].nyesteGuld, toSidste: MC['nul-12u-3r'].toITraekSidste, toNogetSted: MC['nul-12u-3r'].toITraekNogetSted }, hofte5: MC['hofte5-fra-u5-12u-3r'] })

// Er node's regning den samme som sidens? Tre forsoeg (12 uger, 3 runder) som filer i siden: samme guldceller og tal.
{
  const T = await side(1280)
  await T.page.evaluate(() => { const m = window.maalBillede; m.saetKrop({ hoejde: '180', vaegt: '90' }); m.saetStangKg(200); m.saetFase('dl-gulv') })
  ud.mcSide = []
  for (const seed of [11, 12, 13]) {
    const g = rng(seed), g2 = rng(seed)
    const filer = Array.from({ length: 12 }, (_, k) => ({ name: `u${k}.png`, buf: ugeFil(k, { runder: 3, g }).buf }))
    const node = taelTabel(forsoeg(g2, { uger: 12, runder: 3 }))
    await vaelgUger(T, filer)
    const d = await T.page.evaluate(UGE_DOM)
    const data = await T.page.evaluate(() => window.maalBillede.ugeData()[0].raekker.map((r) => r.celler.map((c) => c.vaerdi)))
    ud.mcSide.push({ seed, nodeGuld: node.guld, sideGuld: d.sek[0].guld, sideStatus: d.status, data0: data[0].slice(0, 3) })
  }
  await T.ctx.close()
}
paastaa('node-regningen er sidens: tre forsoeg (12 uger, 3 runder med klikfejl) givet siden som filer har det samme antal guldceller', ud.mcSide.every((x) => x.nodeGuld === x.sideGuld), ud.mcSide.map((x) => `${x.seed}: node ${x.nodeGuld}, side ${x.sideGuld}`))

// --- 3) Faelles krop mod filens egen --------------------------------------------------------------------------
{
  const K = async (opsaet, filer, bredde = 1280) => {
    const T = await side(bredde)
    if (opsaet) await T.page.evaluate(opsaet)
    await vaelgUger(T, filer)
    const d = await T.page.evaluate(UGE_DOM)
    const data = await T.page.evaluate(() => window.maalBillede.ugeData().map((t) => ({ fase: t.faseId, raekker: t.raekker.map((r) => ({ id: r.id, v: r.celler.map((c) => c.vaerdi), f: r.celler.map((c) => c.forskel) })) })))
    await T.ctx.close()
    return { status: d.status, hoejde: d.hoejde, fase: d.fase, guld: d.sek.map((s) => s.guld), data, fejl: T.fejl }
  }
  const tre = (o = {}) => [0, 1, 2].map((k) => ({ name: `u${k}.png`, buf: ugeFil(k, { dy: 3 * k, ...o, ...(o[k] || {}) }).buf }))
  const hh = (r) => r.data[0].raekker.find((x) => x.id === 'hofteHoejde')
  const torso = (r) => r.data[0].raekker.find((x) => x.id === 'torso')
  // a) frisk side, alle filer 180 cm
  const a = await K(null, tre())
  // b) uge 2 gemt med 175 (en tastefejl den uge): siden bruger den aeldstes 180
  const b = await K(null, [0, 1, 2].map((k) => ({ name: `u${k}.png`, buf: ugeFil(k, { dy: 3 * k, hoejde: k === 1 ? '175' : '180' }).buf })))
  // c) siden har allerede 165 cm staaende (forrige atlet), filerne er alle 180
  const c = await K(() => window.maalBillede.saetKrop({ hoejde: '165', vaegt: '60' }), tre())
  // d) sidens fase er squattens bund (fx fra forrige maaling), filerne er doedloeft ved gulvet
  const d = await K(() => window.maalBillede.saetFase('squat-bund'), tre())
  // e) sidens fase er dl-gulv (som filerne)
  const e = await K(() => window.maalBillede.saetFase('dl-gulv'), tre())
  // f) filer fra to loeft paa een gang: squattens bund og doedloeftet
  ud.krop = { a, b, c, d, e }
  ud.krop.tal = Object.fromEntries(Object.entries({ a, b, c, d, e }).map(([k, r]) => [k, { status: r.status, hoejde: r.hoejde, fase: r.fase, hofteHoejde: hh(r).v.map((x) => +x.toFixed(2)), hofteForskel: hh(r).f.map((x) => (x === null ? null : +x.toFixed(2))), torso: torso(r).v.map((x) => +x.toFixed(2)) }]))
  console.log('krop', JSON.stringify(ud.krop.tal))
}
const KT = ud.krop.tal
paastaa('faelles krop a/b: en fil gemt med en anden hoejde (175 i uge 2) maales med den aeldstes 180; tallene er de samme som med 180 i alle tre, og status siger intet om det', JSON.stringify(KT.a.hofteHoejde) === JSON.stringify(KT.b.hofteHoejde) && KT.b.hoejde === '180' && !/175/.test(KT.b.status), { a: KT.a, b: KT.b })
paastaa(`faelles krop c (fund): staar der allerede 165 cm paa siden, maales alle tre ugers filer (gemt med 180) med 165: hoftens hoejde ${KT.c.hofteHoejde[0]} mod ${KT.a.hofteHoejde[0]} cm, forskellen ${KT.c.hofteForskel[2]} mod ${KT.a.hofteForskel[2]} cm; vinklerne er de samme; status siger "kroppens laengder" uden hoejden, og filernes 180 naevnes ikke`, KT.c.hoejde === '165' && Math.abs(KT.c.hofteHoejde[0] - KT.a.hofteHoejde[0]) > 2 && JSON.stringify(KT.c.torso) === JSON.stringify(KT.a.torso) && !/165|180/.test(KT.c.status), { c: KT.c })
paastaa(`faelles krop d/e: sidens egen fase (squattens bund mod doedloeftets gulv) aendrer ${JSON.stringify(KT.d.hofteHoejde) === JSON.stringify(KT.e.hofteHoejde) ? 'intet' : 'tallene'} i doedloeftets ugetabel`, true, { d: KT.d.hofteHoejde, e: KT.e.hofteHoejde, frisk: KT.a.hofteHoejde, faser: [KT.a.fase, KT.d.fase, KT.e.fase] })

// --- 4) Kanter: 14 uger, en uden dato, to faser --------------------------------------------------------------------
{
  const T = await side(390)
  const filer = Array.from({ length: 14 }, (_, k) => ({ name: `u${k}.png`, buf: ugeFil(k, { dy: k }).buf }))
  filer.push({ name: 'udenDato.png', buf: medMeta(ugeFil(20).buf, (m) => { delete m.gemt }) })
  filer.push({ name: 'sq.png', buf: ugeFil(3, { faseId: 'squat-bund' }).buf })
  await vaelgUger(T, filer)
  const d = await T.page.evaluate(UGE_DOM)
  ud.andet.fjorten = { status: d.status, sek: d.sek.map((s) => ({ fase: s.fase, kolonner: s.hoved.length - 1, foerste: s.hoved[1], sidste: s.hoved.at(-1), ude: s.ude })), sideRul: d.sideRul, jsFejl: T.fejl }
  await T.ctx.close()
}
const F14 = ud.andet.fjorten
paastaa('15 doedloeftuger (en uden dato) og en squat: to tabeller; doedloeftets har 12 kolonner (den aeldste og de 11 nyeste), "uden dato" sidst, og noten siger, hvor mange der er udeladt', F14.sek.length === 2 && F14.sek[0].kolonner === 12 && /^3\. aug/.test(F14.sek[0].foerste) && /^uden dato/.test(F14.sek[0].sidste) && /3 uger .* ikke vist/.test(F14.sek[0].ude) && F14.sideRul <= 0 && !F14.jsFejl.length, F14)

// --- 5) M18 fra 617 paa 621: noten over billedet efter Byt ----------------------------------------------------------
{
  const T = await side(390)
  const aabn = async (buf, name) => { await T.page.setInputFiles('[data-fil]', { name, mimeType: 'image/png', buffer: buf }); await T.page.waitForTimeout(800) }
  await aabn(ugeFil(7, { dy: 18 }).buf, 'uge8.png')
  await tryk(T, '[data-sammenlign]'); await T.page.waitForTimeout(300)
  await tryk(T, '[data-plads="efter"]'); await T.page.waitForTimeout(200)
  await aabn(ugeFil(0).buf, 'uge1.png')
  const note = () => T.page.evaluate(() => { const n = document.querySelector('[data-gemtnote]'); return n.hidden ? null : n.textContent.replace(/\s+/g, ' ').trim() })
  const foer = await note()
  await tryk(T, '[data-byt]'); await T.page.waitForTimeout(400)
  const efter = await note()
  ud.andet.m18 = { foer, efterByt: efter, jsFejl: T.fejl }
  await T.ctx.close()
}
paastaa('M18 fra 617 staar stadig paa 621 (kun oplysning): efter Byt siger noten over billedet stadig "tryk Byt"', true, ud.andet.m18)

ud.eksterne = [...eksterne]
paastaa('alt, siderne proevede at hente udefra, er afbrudt og var kun skrifttypen', [...eksterne].every((u) => /fonts\.(googleapis|gstatic)\.com/.test(u)), [...eksterne])
await browser.close(); server.close()
rmSync(dir, { recursive: true, force: true })
writeFileSync(join(HERE, 'maal-628.json'), JSON.stringify({ ...ud, tjek }, null, 1))
const roede = tjek.filter((t) => !t.ok)
console.log(`\nmaal-628: ${tjek.length - roede.length}/${tjek.length} tjek groenne (${ud.chrome})`)
process.exit(roede.length ? 1 : 0)
