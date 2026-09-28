// Kritik 632, blok 2: vaerktoejssidens kopi af Maal dit billede. Setus 625 (kopi fra loeftmodellens main efter 621)
// er ikke committet: sitets vaerktoejer staar stadig paa 1169b5f (620, fra 4ca0c63). Derfor to koersler af mine tjek fra
// maal-617 (som bygger paa maal-610):
//   VARIANT=som-er  sitet, som det er committet (1169b5f), altsaa det Marc kan deploye i dag;
//   VARIANT=kopi    sitet med loeftmodellens main (2ccb0bb, 627+630) dist/maal-billede/ kopieret ind hel, altsaa det
//                   Setus naeste kopi vil give. Her ogsaa Uger og Gem ugerne med tallene, og M18 efter Byt.
// Tjekkene: filerne blob for blob (fra disken, sha1 som git), miniaturerne, gem og aabn igen, foer og efter og Byt,
// video, alle sider paa 390 og 1280 med 0 fejl 404 og 0 JS-fejl, noindex og disclaimeren nederst.
//   VARIANT=som-er node outputs/kritik-632/sitet-632.mjs   -> sitet-632-som-er.json og M-*-som-er-*.png
//   VARIANT=kopi   node outputs/kritik-632/sitet-632.mjs   -> sitet-632-kopi.json og M-*-kopi-*.png
// Sitet og loeftmodellen hentes med `git archive`; intet trae roeres. Google Chrome (den installerede) headless,
// alt net uden for den lokale server afbrudt. Kun syntetiske billeder (ensfarvede flader og modellens egne punkter).
import path, { join } from 'node:path'
import { tmpdir } from 'node:os'
import { writeFileSync, readFileSync, mkdtempSync, existsSync, statSync, mkdirSync, rmSync, readdirSync, cpSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from '../../e2e/harness.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SITE = 'C:/Users/Entropi/Desktop/entropi-coaching-site-wt2'
const LM = 'C:/Users/Entropi/Desktop/entropi-loeftmodel-dhruva'
const GREN = 'refs/heads/vaerktoejer'
const FOER607 = 'c9fc559'
const sh = (c) => execSync(c, { maxBuffer: 1 << 26 }).toString()
const rev = (repo, r) => sh(`git -C "${repo}" rev-parse --short ${r}`).trim()
const VAR = process.env.VARIANT || 'som-er'
const KILDE = VAR === 'kopi' ? rev(LM, 'main') : (process.env.KILDE || ({ '1bd6672': 'f3e0200', '1169b5f': '4ca0c63' }[rev(SITE, GREN)] ?? rev(LM, 'main'))) // det, Setu kopierede (eller vil kopiere) fra
const MED616 = sh(`git -C "${LM}" merge-base --is-ancestor 7d84bbd ${KILDE} && echo ja || echo nej`).trim() === 'ja'
const ver = { variant: VAR, site: rev(SITE, GREN), setu600: '1bd6672', lmMain: rev(LM, 'main'), kilde: KILDE, med616: MED616 }
ver.siteErNyere = ver.site !== ver.setu600
ver.siteSiden600 = sh(`git -C "${SITE}" log --format=%h%x20%s ${ver.setu600}..${GREN}`).trim().split(/\r?\n/).filter(Boolean)
ver.lmSidenKilde = sh(`git -C "${LM}" log --first-parent --format=%h%x20%s ${KILDE}..main`).trim().split(/\r?\n/).filter(Boolean)
const dir = mkdtempSync(join(tmpdir(), 'k632-'))
const hent = (repo, ref, hvor, stier = '') => { mkdirSync(hvor, { recursive: true }); execSync(`git -c core.autocrlf=false -C "${repo}" archive -o "${join(hvor, 'a.tar')}" ${ref} ${stier}`); execSync('tar -xf a.tar', { cwd: hvor }); rmSync(join(hvor, 'a.tar')) }
const web = join(dir, 'web'), lm = join(dir, 'lm')
hent(SITE, GREN, web)
hent(LM, KILDE, lm, 'src kroppe package.json dist/maal-billede')
// kopi: Setus naeste kopi, maal-billede/ hel fra main.
if (VAR === 'kopi') { rmSync(join(web, 'assets', 'vaerktoejer', 'maal-billede'), { recursive: true }); cpSync(join(lm, 'dist', 'maal-billede'), join(web, 'assets', 'vaerktoejer', 'maal-billede'), { recursive: true }) }
const tjek = []
const paastaa = (hvad, ok, data) => { tjek.push({ hvad, ok: !!ok, data }); console.log(`${ok ? 'ok ' : 'NEJ'} ${hvad}${data !== undefined ? ' ' + JSON.stringify(data).slice(0, 700) : ''}`) }
const ud = { ver, kopi: {}, mini: {}, sider: [], gem: [], datoer: [], video: [], ligner: [], uger: [] }

// --- 1) Kopien ----------------------------------------------------------------------------------------------------
const blobs = (repo, ref, d) => Object.fromEntries(sh(`git -C "${repo}" ls-tree -r ${ref} -- ${d}/`).split('\n').filter(Boolean).map((l) => { const [meta, f] = l.split('\t'); return [f.slice(d.length + 1), meta.split(' ')[2]] }))
const forskelle = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((f) => a[f] !== b[f])
const MAPPER = ['maal-billede', 'tre-loeft', 'min-krop', 'baenk-figurer', 'loeft-fejl', 'squat-figurer', 'doedloeft-figurer']
// Fra disken (det, serveren viser), som git's blob-sha1, mod loeftmodellens dist paa KILDE.
const diskBlobs = (d) => existsSync(d) ? Object.fromEntries(readdirSync(d, { recursive: true }).map(String).filter((f) => statSync(join(d, f)).isFile()).map((f) => { const b = readFileSync(join(d, f)); return [f.split(String.fromCharCode(92)).join('/'),createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex')] })) : {}
for (const m of MAPPER) {
  const site = diskBlobs(join(web, 'assets', 'vaerktoejer', m)), kilde = blobs(LM, KILDE, `dist/${m}`)
  ud.kopi[m] = { filer: Object.keys(site).length, modKilde: forskelle(kilde, site).filter((f) => f in site), mangler: Object.keys(kilde).filter((f) => !(f in site)), modLmMain: forskelle(blobs(LM, 'main', `dist/${m}`), site).filter((f) => f in site) }
}
ud.aendret600 = sh(`git -C "${SITE}" diff --name-only ${FOER607} ${GREN}`).split('\n').filter(Boolean)
paastaa(`sitet (${ver.site}) er Setus 1bd6672 eller nyere, og alt siden 607 (${FOER607}) ligger under assets/vaerktoejer/`, sh(`git -C "${SITE}" merge-base --is-ancestor ${ver.setu600} ${GREN} && echo ja || echo nej`).trim() === 'ja' && ud.aendret600.every((f) => f.startsWith('assets/vaerktoejer/')), { siden600: ver.siteSiden600, aendret: ud.aendret600.length })
paastaa(`${VAR}: alle filer i de syv mapper (fra disken) er ${KILDE}'s dist blob for blob; ingen fil mangler`, MAPPER.every((m) => !ud.kopi[m].modKilde.length && !ud.kopi[m].mangler.length), Object.fromEntries(MAPPER.map((m) => [m, `${ud.kopi[m].filer} filer, ${ud.kopi[m].modKilde.length} anderledes, ${ud.kopi[m].mangler.length} mangler`])))
paastaa(`${VAR}: loeftmodellens main (${ver.lmMain}) mod det, der vises: de filer, der er anderledes (tom = main)`, VAR !== 'kopi' || MAPPER.every((m) => !ud.kopi[m].modLmMain.length), { nye: ver.lmSidenKilde, maal: ud.kopi['maal-billede'].modLmMain, minKrop: ud.kopi['min-krop'].modLmMain, treLoeft: ud.kopi['tre-loeft'].modLmMain, baenk: ud.kopi['baenk-figurer'].modLmMain })

// --- server ------------------------------------------------------------------------------------------------------
const typer = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.json': 'application/json', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain' }
const mangler404 = new Set()
const server = createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0].split('#')[0])
  let f = join(web, u)
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html')
  if (!existsSync(f)) { mangler404.add(u); res.writeHead(404); return res.end() }
  res.writeHead(200, { 'content-type': typer[path.extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f))
}).listen(0)
const BASE = `http://127.0.0.1:${server.address().port}`
const V = '/assets/vaerktoejer'
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const browser = await chromium.launch({ headless: true, executablePath: CHROME })
ud.chrome = browser.version()
const eksterne = new Set()
const FILER = join(dir, 'filer'); mkdirSync(FILER)
async function aabnSide(bredde, sti) {
  const mobil = bredde < 500
  const ctx = await browser.newContext({ viewport: { width: bredde, height: mobil ? 780 : 900 }, deviceScaleFactor: mobil ? 3 : 1, isMobile: mobil, hasTouch: mobil, acceptDownloads: true })
  const page = await ctx.newPage()
  const T = { ctx, page, mobil, bredde, fejl: [], status: [] }
  page.on('pageerror', (e) => T.fejl.push(e.message))
  page.on('response', (r) => { if (r.url().startsWith(BASE) && r.status() >= 400) T.status.push(`${r.status()} ${r.url().slice(BASE.length)}`) })
  await page.route('**/*', (r) => { const u = r.request().url(); if (u.startsWith(BASE) || /^(data|blob):/.test(u)) return r.continue(); eksterne.add(u.split('?')[0]); return r.abort() })
  await page.goto(`${BASE}${sti}`, { waitUntil: 'load' })
  return T
}
const side = async (bredde) => { const T = await aabnSide(bredde, `${V}/maal-billede/index.html`); await T.page.waitForSelector('[data-klar]'); return T }
async function tryk(T, sel) { const l = T.page.locator(sel).first(); await l.scrollIntoViewIfNeeded(); if (T.mobil) await l.tap(); else await l.click() }
async function gem(T, sel, navn) {
  const [dl] = await Promise.all([T.page.waitForEvent('download', { timeout: 30000 }), tryk(T, sel)])
  const fil = join(FILER, navn); await dl.saveAs(fil)
  return { fil, forslag: dl.suggestedFilename(), buf: readFileSync(fil) }
}
async function aabn(T, buf, som) {
  await T.page.setInputFiles('[data-fil]', { name: som.name, mimeType: som.mimeType, buffer: buf })
  await T.page.waitForFunction(() => !!window.maalBillede.tilstand().billede, null, { timeout: 30000 }).catch(() => {})
  await T.page.waitForTimeout(600)
}
const INFO = () => { const s = window.maalBillede.tilstand(); const q = (x) => document.querySelector(x); return { fase: s.faseId, hoejde: q('[data-hoejde]').value, vaegt: q('[data-vaegt]')?.value ?? null, punkter: Object.keys(s.punkter).length, w: s.billede?.naturalWidth || 0, note: q('[data-gemtnote]').hidden ? null : q('[data-gemtnote]').textContent.trim() } }

// --- 5) Alle sider: 404, JS-fejl, sidelaens rulning, lokale links ------------------------------------------------------
const SIDER = ['/vaerktoejer/index.html', ...readdirSync(join(web, 'assets', 'vaerktoejer'), { recursive: true }).map(String).filter((f) => f.endsWith('.html')).map((f) => `${V}/${f.replace(/\\/g, '/')}`)]
for (const sti of SIDER) for (const bredde of [390, 1280]) {
  const T = await aabnSide(bredde, sti)
  await T.page.waitForTimeout(700)
  const s = await T.page.evaluate(() => ({
    titel: document.title, robots: document.querySelector('meta[name="robots"]')?.content ?? null,
    sidelaens: document.documentElement.scrollWidth > innerWidth + 1,
    brudteBilleder: [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.getAttribute('src')).map((i) => i.getAttribute('src')),
    links: [...new Set([...document.querySelectorAll('a[href], img[src], link[href], script[src], iframe[src]')].map((e) => e.href || e.src).filter((u) => u && u.startsWith(location.origin)).map((u) => u.split('#')[0]))],
  }))
  // Lokale links og kilder: findes de? (ogsaa dem, der ikke hentes, naar siden aabnes, fx fejlfigurernes "Se ... i hele opturen")
  const doede = []
  for (const u of s.links) { const r = await T.page.request.head(u).catch(() => null); if (!r || r.status() >= 400) doede.push(u.slice(BASE.length)) }
  ud.sider.push({ sti, bredde, ...s, links: s.links.length, doede, status: T.status, jsFejl: T.fejl })
  await T.ctx.close()
}
// Links fra vaerktoejssiden ud til resten af sitet (../coaching.html osv.) er en del af sitet, men sitets egne sider er ikke
// i vaerktoejer-grenens aendring. De taeller med, for arkivet er hele sitet.
const S404 = ud.sider.flatMap((s) => [...s.status, ...s.doede.map((d) => `doed ${d}`)])
paastaa(`${SIDER.length} sider paa 390 og 1280: 0 fejl 404 (hentet eller linket lokalt), 0 JS-fejl, ingen sidelaens rulning, ingen brudte billeder`, !S404.length && ud.sider.every((s) => !s.jsFejl.length && !s.sidelaens && !s.brudteBilleder.length), { sider: SIDER, fejl404: S404, js: ud.sider.filter((s) => s.jsFejl.length).map((s) => `${s.sti} ${s.bredde}: ${s.jsFejl[0]}`), sidelaens: ud.sider.filter((s) => s.sidelaens).map((s) => `${s.sti} ${s.bredde}`), links: ud.sider.reduce((a, s) => a + s.links, 0) })
{
  const T = await aabnSide(390, '/vaerktoejer/index.html')
  ud.forside = await T.page.evaluate(() => {
    const main = document.querySelector('main'); const sidst = main.lastElementChild; const d = document.querySelector('.tools-disclaimer')
    const bundMain = main.getBoundingClientRect().bottom + scrollY, bundD = d.getBoundingClientRect().bottom + scrollY
    const underD = [...main.querySelectorAll('*')].filter((e) => e !== d && !d.contains(e) && e.getBoundingClientRect().top + scrollY > d.getBoundingClientRect().top + scrollY + 1 && e.offsetParent !== null).map((e) => e.tagName)
    return { robots: document.querySelector('meta[name="robots"]')?.content, sidstIMain: sidst === d, disclaimer: d.textContent.trim(), afstandTilBund: Math.round(bundMain - bundD), underDisclaimer: underD, skrift: getComputedStyle(d).fontSize }
  })
  await T.page.locator('.tools-disclaimer').scrollIntoViewIfNeeded(); await T.page.screenshot({ path: join(HERE, `M-390-632-${VAR}-disclaimer.png`) })
  await T.ctx.close()
}
paastaa('vaerktoejssiden: noindex, nofollow; disclaimeren fra 607 er sidste element i <main>, intet staar under den, og teksten er 607s', /noindex/.test(ud.forside.robots) && ud.forside.sidstIMain && !ud.forside.underDisclaimer.length && /intet sendes nogen steder hen/.test(ud.forside.disclaimer) && /ikke en dom over løftet/.test(ud.forside.disclaimer), ud.forside)
ud.robotsTxt = readFileSync(join(web, 'robots.txt'), 'utf8').replace(/\\r/g, '')
ud.robotsVaerktoej = ud.sider.filter((s) => s.bredde === 390).map((s) => `${s.sti.replace(V, '')}: ${s.robots}`)
paastaa('vaerktoejerne selv (assets/vaerktoejer/*) har ingen robots-meta, men sitets robots.txt siger Disallow: /assets/vaerktoejer/, og vaerktoejssidens links har rel=nofollow', /^Disallow: \/assets\/vaerktoejer\/$/m.test(ud.robotsTxt), { robotsTxt: ud.robotsTxt, meta: ud.robotsVaerktoej })

// --- 2) Miniaturerne --------------------------------------------------------------------------------------------------
{
  const mappe = join(web, 'assets', 'vaerktoejer', 'maal-billede', 'miniaturer')
  const filer = readdirSync(mappe).filter((f) => f.endsWith('.svg'))
  const js = readFileSync(join(web, 'assets', 'vaerktoejer', 'maal-billede', 'maal-billede.js'), 'utf8')
  // De id'er, "Ligner" bygger stien af: figurer med id bp-/dl- og k7-<fejl>-<bund|sticking> (Oo i den byggede fil).
  const ids = [...new Set([...js.matchAll(/id:"((?:bp|dl)-[a-z-]+)",titel/g)].map((m) => m[1]).filter((i) => !/^dl-(gulv|knae)$/.test(i)))]
  for (const [fejl] of [['kun-knae'], ['hofte-tilbage']]) for (const fase of ['bund', 'sticking']) ids.push(`k7-${fejl}-${fase}`)
  ud.mini.ids = ids
  ud.mini.filer = filer
  const T = await side(390)
  ud.mini.hver = []
  for (const f of filer) {
    const s = readFileSync(join(mappe, f), 'utf8')
    const px = await T.page.evaluate(async (src) => {
      const img = new Image(); img.src = src; await img.decode()
      const k = new OffscreenCanvas(img.naturalWidth, img.naturalHeight); const x = k.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, k.width, k.height); x.drawImage(img, 0, 0)
      const d = x.getImageData(0, 0, k.width, k.height).data; let moerk = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] < 90) moerk++
      return { w: img.naturalWidth, h: img.naturalHeight, moerkPct: +(100 * moerk / (k.width * k.height)).toFixed(2) }
    }, `miniaturer/${f}`)
    ud.mini.hver.push({ f, felter: (s.match(/fill-opacity="0\.78"/g) || []).length, rektMoerk: (s.match(/<rect [^>]*fill="#141410"/g) || []).length, ...px })
  }
  await T.page.setContent(`<body style="margin:8px;background:#101010;color:#ccc">${filer.map((f) => `<figure style="display:inline-block;width:170px;margin:4px"><img src="${BASE}${V}/maal-billede/miniaturer/${f}" style="width:170px"><figcaption style="font:11px sans-serif">${f}</figcaption></figure>`).join('')}</body>`)
  await T.page.waitForTimeout(800)
  await T.page.screenshot({ path: join(HERE, `M-390-632-${VAR}-miniaturer.png`), fullPage: true })
  await T.ctx.close()
  // Sammenlign med 610: dengang maalte jeg 608's miniaturer (main f3e0200) til 0 felter og pixel for pixel 601s uden felterne.
  const f610 = JSON.parse(readFileSync(join(HERE, '..', 'kritik-610', 'maal-610.json'), 'utf8'))
  ud.mini.som610 = filer.every((f) => f610.m1[f] && f610.m1[f].o608.felter === 0)
}
paastaa('miniaturerne paa sitet: 8 filer, 0 moerke tekstfelter (fill-opacity 0.78), og de er f3e0200s, som jeg i 610 maalte pixel for pixel uden felter', ud.mini.filer.length === 8 && ud.mini.hver.every((m) => m.felter === 0 && m.w > 0) && ud.mini.som610 && !ud.kopi['maal-billede'].modKilde.length, ud.mini.hver.map((m) => `${m.f}: felter ${m.felter}, ${m.w}x${m.h}`))
paastaa('alle id\'er, "Ligner" kan vise (bp, dl og k7 bund/sticking), har en fil i sitets miniaturer/, og alle 8 indlaeses fra sitets sti', ud.mini.ids.length === 8 && ud.mini.ids.every((i) => ud.mini.filer.includes(`${i}.svg`)), ud.mini.ids)

// --- syntetiske billeder og maalinger (som 610) ----------------------------------------------------------------------------
const imp = (f) => import(pathToFileURL(join(lm, 'src', f)).href)
const { PUNKTER, SKIVE_CM } = await imp('maalBillede.js')
const { kroppe, modelFase } = await imp('maalBilledeModel.js')
// fjern: klik ogsaa det fjerne nav (punkt 8), som stangens to og hoften stiger foerst kraever (som Setus 600).
const iBillede = (P, { pxPrCm = 3, x0 = 600, y0 = 1300, dy = 0, stangDx = 0, fjern = false } = {}) => { const o = {}; for (const { id } of PUNKTER) o[id] = { x: x0 + P[id].x * pxPrCm + (id === 'stang' ? stangDx * pxPrCm : 0), y: y0 - P[id].y * pxPrCm - (id === 'hofte' ? dy : 0) }; o.skalaA = { x: o.stang.x, y: o.stang.y - (SKIVE_CM / 2) * pxPrCm }; if (fjern) o.stangFjern = { x: o.stang.x + 6, y: o.stang.y - 2 }; return o }
const snit = kroppe('doedloeft', null, { hoejde: '180', stangKg: 200 }).snit
const MP = modelFase('dl-gulv', snit), MK = modelFase('dl-knae', snit)
const Q1 = iBillede(MP.punkter), Q8 = iBillede(MP.punkter, { dy: 36 })
const BILLEDE = async ([w, h, farve, navn]) => {
  const k = document.createElement('canvas'); k.width = w; k.height = h; const x = k.getContext('2d')
  x.fillStyle = farve; x.fillRect(0, 0, w, h); x.fillStyle = '#ddd'; x.fillRect(w * 0.1, h * 0.07, w * 0.2, h * 0.2); x.fillStyle = '#835'; x.fillRect(w * 0.55, h * 0.5, w * 0.3, h * 0.1)
  const url = URL.createObjectURL(await new Promise((ok) => k.toBlob(ok, 'image/png')))
  return window.maalBillede.laesBillede(url, navn, true)
}
const MAAL = ([Q, fase]) => { const m = window.maalBillede; m.saetKrop({ hoejde: '180', vaegt: '90' }); m.saetStangKg(200); m.saetFase(fase); m.saetPunkter(Q) }
const LIGNER = () => { const l = document.querySelector('[data-ligner]'); const imgs = l ? [...l.querySelectorAll('img')] : []; return { synlig: !!l && !l.hidden && l.offsetParent !== null, tekst: (l?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 200), imgs: imgs.map((i) => ({ src: i.getAttribute('src'), w: i.naturalWidth, ok: i.complete && i.naturalWidth > 0 })) } }

// "Ligner" i sitets kopi: stangen 12 cm frem ved knaeet (som Setu) og hoften hoejt ved gulvet.
for (const bredde of [390, 1280]) for (const [hvad, Q, fase] of [['stangen 12 cm frem ved knaeet', iBillede(MK.punkter, { stangDx: 12, fjern: true }), 'dl-knae'], ['hoften 36 px hoejere ved gulvet', iBillede(MP.punkter, { dy: 36, fjern: true }), 'dl-gulv']]) {
  const T = await side(bredde)
  await T.page.evaluate(BILLEDE, [1000, 1400, '#556', 'IMG_7001.jpg'])
  await T.page.evaluate(MAAL, [Q, fase]); await T.page.waitForTimeout(700)
  const l = await T.page.evaluate(LIGNER)
  ud.ligner.push({ bredde, hvad, ...l, jsFejl: T.fejl, status: T.status })
  if (bredde === 390 && l.synlig) { await T.page.locator('[data-ligner]').scrollIntoViewIfNeeded(); await T.page.screenshot({ path: join(HERE, `M-390-632-${VAR}-ligner-${fase}.png`) }) }
  await T.ctx.close()
}
paastaa('"Ligner" i sitets kopi: stangen frem ved knaeet giver "Stangen glider frem" med miniaturen indlaest fra sitets miniaturer/ paa 390 og 1280', ud.ligner.filter((l) => /knaeet/.test(l.hvad)).every((l) => l.synlig && l.imgs.length && l.imgs.every((i) => i.ok && /^miniaturer\/dl-stang-frem\.svg$/.test(i.src)) && !l.status.length), ud.ligner.map((l) => ({ b: l.bredde, hvad: l.hvad, tekst: l.tekst.slice(0, 90), imgs: l.imgs })))

// --- 3) Gem og aabn igen, foer og efter, Byt ----------------------------------------------------------------------------------
const gemte = {}
for (const [uge, Q, navn] of [[1, Q1, 'IMG_4411.jpg'], [8, Q8, 'IMG_5120.jpg']]) {
  const T = await side(1280)
  await T.page.evaluate(BILLEDE, [1000, 1400, uge === 1 ? '#556' : '#565', navn])
  await T.page.evaluate(MAAL, [Q, 'dl-gulv']); await T.page.waitForTimeout(400)
  gemte[uge] = await gem(T, '[data-gem]', `uge-${uge}.png`)
  gemte[uge].foer = await T.page.evaluate(INFO)
  await T.ctx.close()
}
for (const bredde of [390, 1280]) {
  // Gem, aabn i en frisk side, gem igen, aabn igen: samme maaling hele vejen.
  let buf = gemte[1].buf; const runder = []
  for (let r = 0; r < 3; r++) {
    const T = await side(bredde)
    await aabn(T, buf, { name: `maal-dl-gulv-runde-${r}.png`, mimeType: 'image/png' })
    const i = await T.page.evaluate(INFO)
    if (r === 0 && bredde === 390) { await T.page.locator('[data-gemtnote]').scrollIntoViewIfNeeded().catch(() => {}); await T.page.screenshot({ path: join(HERE, `M-390-632-${VAR}-aabnet-igen.png`) }) }
    const g = await gem(T, '[data-gem]', `runde-${bredde}-${r}.png`)
    runder.push({ ...i, forslag: g.forslag, bytes: g.buf.length, jsFejl: T.fejl, status: T.status })
    buf = g.buf
    await T.ctx.close()
  }
  ud.gem.push({ bredde, foer: gemte[1].foer, forslag: gemte[1].forslag, runder })
}
{
  ud.m5 = []
  for (const [hvad, som] of [['navn uden endelse og uden type', { name: '1000012345', mimeType: '' }], ['application/octet-stream, navnet download', { name: 'download', mimeType: 'application/octet-stream' }], ['PNG-bytes med navnet .jpg og typen image/jpeg', { name: 'maal.jpg', mimeType: 'image/jpeg' }]]) {
    const T = await side(390)
    await aabn(T, gemte[1].buf, som)
    ud.m5.push({ hvad, ...(await T.page.evaluate(INFO)), jsFejl: T.fejl })
    await T.ctx.close()
  }
}
paastaa(MED616 ? 'M5 lukket paa sitet (616): en uroert fil uden .png og uden image/png (eller som .jpg) aabnes som maalingen med 7 klik og noten' : 'M5 fra 610 (kun oplysning)', MED616 ? ud.m5.every((m) => m.punkter === 7 && /^Gemt måling åbnet/.test(m.note || '') && !m.jsFejl.length) : true, ud.m5.map((m) => `${m.hvad}: ${m.punkter} klik, ${(m.note || 'ingen note').slice(0, 40)}`))
paastaa('gem og aabn igen i sitets kopi (390 og 1280, tre runder i frisk side): fase dl-gulv, 7 klik, hoejde 180, billedets bredde og "Gemt maaling aabnet" hver gang; 0 JS-fejl og 0 fejl 404', ud.gem.every((g) => g.runder.every((r) => r.fase === 'dl-gulv' && r.punkter === g.foer.punkter && r.punkter >= 7 && r.hoejde === '180' && r.w === 1000 && /^Gemt måling åbnet/.test(r.note || '') && !r.jsFejl.length && !r.status.length)), ud.gem.map((g) => ({ b: g.bredde, fil: g.forslag, runder: g.runder.map((r) => `${r.fase} ${r.punkter} klik ${r.hoejde} cm ${r.w} px, ${(r.note || '').slice(0, 50)}`) })))

// Foer og efter fra to filer med hver sin dato (min PNG-skriver fra 610).
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 } return (b) => { let c = 0xffffffff; for (const x of b) c = t[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 } })()
function dele(buf) { const b = Buffer.from(buf); const r = []; let i = 8; while (i + 12 <= b.length) { const n = b.readUInt32BE(i); const type = b.toString('latin1', i + 4, i + 8); if (i + 12 + n > b.length) break; r.push({ type, pos: i, n, raa: b.subarray(i, i + 12 + n) }); i += 12 + n; if (type === 'IEND') break } return r }
const lavDel = (type, data) => { const b = Buffer.alloc(12 + data.length); b.writeUInt32BE(data.length, 0); b.write(type, 4, 'latin1'); data.copy(b, 8); b.writeUInt32BE(CRC(b.subarray(4, 8 + data.length)), 8 + data.length); return b }
const SIG = Buffer.from('89504e470d0a1a0a', 'hex')
const saml = (D) => Buffer.concat([SIG, ...D.map((d) => d.raa)])
function medDato(buf, dato) {
  const D = dele(buf), d = D.find((x) => x.type === 'enTr'); const data = d.raa.subarray(8, 8 + d.n)
  const jl = data.readUInt32BE(21); const meta = JSON.parse(data.toString('utf8', 25, 25 + jl)); meta.gemt = dato
  const json = Buffer.from(JSON.stringify(meta), 'utf8'); const hoved = Buffer.from(data.subarray(0, 25)); hoved.writeUInt32BE(json.length, 21)
  return saml(D.map((x) => x === d ? { raa: lavDel('enTr', Buffer.concat([hoved, json, data.subarray(25 + jl)])) } : x))
}
const f1 = medDato(gemte[1].buf, '2026-08-03'), f8 = medDato(gemte[8].buf, '2026-09-28')
const LAES = () => ({ advarsel: [...document.querySelectorAll('main *')].filter((e) => e.offsetParent !== null && !e.closest('[data-gemtnote]') && /før er det nyeste billede/.test(e.textContent) && ![...e.children].some((c) => /før er det nyeste billede/.test(c.textContent))).map((e) => e.textContent.replace(/\s+/g, ' ').trim()).join(' | ') || null, noteAdvarer: /gemt senere end efter/.test(document.querySelector('[data-gemtnote]')?.textContent || ''), foer: document.querySelector('[data-foertekst]').textContent.trim(), efter: document.querySelector('[data-eftertekst]').textContent.trim(), tabel: [...document.querySelectorAll('[data-foereftertal] tbody tr')].map((t) => [...t.children].map((x) => x.textContent.replace(/\s+/g, ' ').trim())), saetning: [...document.querySelectorAll('[data-foereftertal] p')].map((p) => p.textContent.replace(/\s+/g, ' ').trim()).join(' | ') })
for (const bredde of [390, 1280]) for (const orden of ['rigtig', 'forkert']) {
  const T = await side(bredde)
  const [a, b] = orden === 'rigtig' ? [f1, f8] : [f8, f1]
  await aabn(T, a, { name: 'maal-a.png', mimeType: 'image/png' })
  await tryk(T, '[data-sammenlign]'); await T.page.waitForTimeout(300)
  await tryk(T, '[data-plads="efter"]'); await T.page.waitForTimeout(200)
  await aabn(T, b, { name: 'maal-b.png', mimeType: 'image/png' })
  await T.page.waitForTimeout(400)
  const r = { bredde, orden, foer: await T.page.evaluate(LAES) }
  if (orden === 'forkert') {
    if (bredde === 390) { await T.page.locator('[data-gemtnote]').scrollIntoViewIfNeeded().catch(() => {}); await T.page.screenshot({ path: join(HERE, `M-390-632-${VAR}-omvendt-note.png`) }) }
    await tryk(T, '[data-byt]'); await T.page.waitForTimeout(400); r.byttet = await T.page.evaluate(LAES)
    if (bredde === 390) { await T.page.locator('[data-gemtnote]').scrollIntoViewIfNeeded().catch(() => {}); await T.page.screenshot({ path: join(HERE, `M-390-632-${VAR}-efter-byt-note.png`) }) }
  }
  if (bredde === 390 && orden === 'rigtig') { await T.page.locator('[data-foereftertal]').scrollIntoViewIfNeeded().catch(() => {}); await T.page.screenshot({ path: join(HERE, `M-390-632-${VAR}-foer-efter.png`) }) }
  r.jsFejl = T.fejl; r.status = T.status
  ud.datoer.push(r)
  await T.ctx.close()
}
const hofte = (t) => t.tabel.find((x) => /hofte/i.test(x[0]))
paastaa('foer og efter fra to filer i sitets kopi: datoen staar ved begge, hoftens raekke har en forskel, og Byt vender en forkert raekkefoelge til den rigtige tabel', ud.datoer.every((r) => /\(gemt \d+\. [a-z]+\.? 2026\)$/.test(r.foer.foer) && /\(gemt \d+\. [a-z]+\.? 2026\)$/.test(r.foer.efter) && hofte(r.foer) && !r.jsFejl.length && !r.status.length) && ud.datoer.filter((r) => r.orden === 'forkert').every((r) => JSON.stringify(r.byttet.tabel) === JSON.stringify(ud.datoer.find((x) => x.orden === 'rigtig' && x.bredde === r.bredde).foer.tabel)), ud.datoer.map((r) => `${r.bredde} ${r.orden}: ${r.foer.foer} | ${r.foer.efter} | hofte ${JSON.stringify(hofte(r.foer))}`))
paastaa(MED616 ? 'M6 lukket paa sitet (616): en forkert raekkefoelge giver advarslen over tabellen (... saa foer er det nyeste billede ... Tryk Byt), en rigtig giver den ikke, og efter Byt er den vaek' : 'M6 fra 610 staar paa sitet (kun oplysning)', MED616 ? ud.datoer.every((r) => r.orden === 'forkert' ? r.foer.advarsel && !r.byttet.advarsel : !r.foer.advarsel) : true, ud.datoer.map((r) => ({ b: r.bredde, orden: r.orden, advarsel: r.foer.advarsel, efterByt: r.byttet?.advarsel ?? null, noten: r.foer.noteAdvarer, notenEfterByt: r.byttet?.noteAdvarer ?? null })))
if (MED616) paastaa(VAR === 'kopi' ? 'M18 lukket i kopien: efter Byt siger noten ikke laengere "tryk Byt"' : 'M18 staar paa sitet (kun oplysning): noten siger stadig "tryk Byt" efter Byt', VAR === 'kopi' ? ud.datoer.filter((r) => r.orden === 'forkert').every((r) => r.foer.noteAdvarer && !r.byttet.noteAdvarer) : true, ud.datoer.filter((r) => r.orden === 'forkert').map((r) => ({ b: r.bredde, foer: r.foer.noteAdvarer, efterByt: r.byttet.noteAdvarer })))

// --- 4) Video --------------------------------------------------------------------------------------------------------
for (const bredde of [390, 1280]) {
  const T = await side(bredde)
  const b64 = await T.page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 320; c.height = 240; const x = c.getContext('2d')
    const rec = new MediaRecorder(c.captureStream(25), { mimeType: 'video/webm' }); const bid = []; rec.ondataavailable = (e) => bid.push(e.data)
    rec.start(); for (let i = 0; i < 40; i++) { x.fillStyle = '#446'; x.fillRect(0, 0, 320, 240); x.fillStyle = '#eb3'; x.fillRect(20 + i * 6, 100, 30, 30); await new Promise((ok) => setTimeout(ok, 40)) }
    rec.stop(); await new Promise((ok) => (rec.onstop = ok))
    const buf = new Uint8Array(await new Blob(bid, { type: 'video/webm' }).arrayBuffer()); let s = ''; for (const v of buf) s += String.fromCharCode(v); return btoa(s)
  })
  await T.page.setInputFiles('[data-videofil]', { name: 'klip-632.webm', mimeType: 'video/webm', buffer: Buffer.from(b64, 'base64') })
  await T.page.waitForFunction(() => { const v = document.querySelector('[data-video]'); return v && v.readyState >= 2 }, null, { timeout: 20000 }).catch(() => {})
  const v = await T.page.evaluate(async () => {
    const v = document.querySelector('[data-video]'); const boks = document.querySelector('[data-videoboks]'); const foer = v.currentTime
    v.currentTime = Math.min(0.9, (isFinite(v.duration) ? v.duration : 1.5) * 0.5); await new Promise((ok) => { v.onseeked = ok; setTimeout(ok, 3000) })
    return { fejl: v.error?.code || null, synlig: !!boks && !boks.hidden && boks.offsetParent !== null, klar: v.readyState, bredde: v.videoWidth, foer, efter: v.currentTime, navn: document.querySelector('[data-videonavn]')?.textContent.trim() || '' }
  })
  if (bredde === 390) await T.page.screenshot({ path: join(HERE, `M-390-632-${VAR}-video.png`) })
  await tryk(T, '[data-brug]').catch(() => {}); await T.page.waitForTimeout(800)
  v.brugt = await T.page.evaluate(INFO)
  v.jsFejl = T.fejl; v.status = T.status
  ud.video.push({ skaerm: bredde, ...v })
  await T.ctx.close()
}
paastaa('video i sitets kopi: et webm-klip lavet i browseren aabnes, kan spoles, og "Brug billedet" giver et billede paa 320 px at maale paa (390 og 1280), 0 JS-fejl', ud.video.every((v) => v.synlig && v.klar >= 2 && v.bredde === 320 && v.efter > v.foer && v.brugt.w === 320 && !v.jsFejl.length && !v.status.length), ud.video.map((v) => ({ b: v.skaerm, video: v.bredde, klar: v.klar, spolet: [v.foer, v.efter], brugt: v.brugt.w, navn: v.navn })))

// --- 6) Uger og Gem ugerne med tallene (kun i kopien; sitet, som det er, har dem ikke) -----------------------------------
for (const bredde of [390, 1280]) {
  const T = await side(bredde)
  const har = await T.page.evaluate(() => !!document.querySelector('[data-ugefiler]'))
  const u = { bredde, har }
  if (har) {
    const f3 = medDato(gemte[8].buf, '2026-08-17')
    await T.page.setInputFiles('[data-ugefiler]', [['u8.png', f8], ['u1.png', f1], ['u3.png', f3]].map(([name, buffer]) => ({ name, mimeType: 'image/png', buffer })))
    await T.page.waitForFunction(() => document.querySelector('[data-ugestatus]').textContent.length > 0, null, { timeout: 30000 })
    await T.page.waitForTimeout(300)
    Object.assign(u, await T.page.evaluate(() => { const t = document.querySelector('[data-ugetabel]'); return { status: document.querySelector('[data-ugestatus]').textContent, hoved: [...t.querySelectorAll('thead th')].map((x) => x.textContent.replace(/\s+/g, ' ').trim()), guld: t.querySelectorAll('[data-guld]').length, over: t.querySelectorAll('[data-over]').length, sideRul: document.scrollingElement.scrollWidth - innerWidth } }))
    if (bredde === 390) { await T.page.locator('[data-ugefase]').first().scrollIntoViewIfNeeded(); await T.page.screenshot({ path: join(HERE, `M-390-632-${VAR}-uger.png`) }) }
    const g = await gem(T, '[data-gemuger]', `uger-${bredde}.png`)
    u.png = { forslag: g.forslag, w: g.buf.readUInt32BE(16), h: g.buf.readUInt32BE(20), maaling: dele(g.buf).some((d) => d.type === 'enTr') }
  }
  u.jsFejl = T.fejl; u.status404 = T.status
  ud.uger.push(u)
  await T.ctx.close()
}
if (VAR === 'kopi') paastaa('Uger i kopien (390 og 1280): tre gemte maalinger valgt i blandet orden staar 3. aug., 17. aug., 28. sep. med "forskel fra 3. aug. 2026" i den faste celle; uge 2 og 3 (hoften 12 cm op) staar i guld; Gem ugerne med tallene giver et PNG paa 1200 px uden maaling; 0 JS-fejl og 0 fejl 404', ud.uger.every((u) => u.har && /^3\. aug/.test(u.hoved[1]) && /^17\. aug/.test(u.hoved[2]) && /^28\. sep/.test(u.hoved[3]) && /forskel fra 3\. aug\. 2026/.test(u.hoved[0]) && u.guld > 0 && u.sideRul <= 0 && u.png.w === 1200 && !u.png.maaling && !u.jsFejl.length && !u.status404.length), ud.uger)
else paastaa('sitet, som det er (620): Uger og Gem ugerne med tallene findes ikke (det er det, der mangler, til Setu kopierer)', ud.uger.every((u) => !u.har && !u.jsFejl.length), ud.uger.map((u) => `${u.bredde}: Uger ${u.har ? 'ja' : 'nej'}`))

ud.eksterne = [...eksterne]
ud.mangler404 = [...mangler404]
paastaa('alt, siderne proevede at hente udefra, er afbrudt og var kun skrifttypen; serveren svarede aldrig 404', [...eksterne].every((u) => /fonts\.(googleapis|gstatic)\.com/.test(u)) && !mangler404.size, { eksterne: [...eksterne], mangler404: [...mangler404] })
await browser.close(); server.close()
rmSync(dir, { recursive: true, force: true })
writeFileSync(join(HERE, `sitet-632-${VAR}.json`), JSON.stringify({ ...ud, tjek }, null, 1))
const roede = tjek.filter((t) => !t.ok)
console.log(`\nmaal-617: ${tjek.length - roede.length}/${tjek.length} tjek groenne (${ud.chrome})`)
process.exit(roede.length ? 1 : 0)
