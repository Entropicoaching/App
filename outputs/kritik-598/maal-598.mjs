// Kritik 598, blok 1: Maal dit billede efter Yantras 586 (V7), 593 (miniaturerne, BA1) og 595 (DA7, klip efter
// klip; committet paa ordre-595, ikke merget), maalt med mine egne scripts og klip.
//   node outputs/kritik-598/maal-598.mjs     -> maal-598.json og M-*.png
// Loeftmodellen (entropi-loeftmodel-dhruva: main og ordre-595) og sitet (entropi-coaching-site-wt2, grenen
// vaerktoejer) hentes med `git archive` til en midlertidig mappe; ingen gren skiftes, intet trae roeres.
// Siden maales, som den staar paa sitet, naar Setu har kopieret den nye udgave: sitets kopi med
// dist/maal-billede/ og dist/baenk-figurer/ fra main lagt oven i (og tre-loeft/min-krop fra ordre-595).
// Google Chrome (den installerede) headless paa 360 og 390 med touch og 1280 med mus; alt net uden for den
// lokale server afbrudt. Kun syntetiske punkter (modellens egne tegnede stillinger) og mine klip fra 582.
import path, { join } from 'node:path'
import { tmpdir } from 'node:os'
import { writeFileSync, readFileSync, mkdtempSync, existsSync, statSync, mkdirSync, rmSync, cpSync, readdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { createServer } from 'node:http'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from '../../e2e/harness.mjs'
import { lavKlip, BITS } from '../kritik-582/klip-582.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SITE = 'C:/Users/Entropi/Desktop/entropi-coaching-site-wt2'
const LM = 'C:/Users/Entropi/Desktop/entropi-loeftmodel-dhruva'
const GREN = 'refs/heads/vaerktoejer'
const sh = (c) => execSync(c, { maxBuffer: 1 << 26 }).toString()
const rev = (repo, r) => sh(`git -C "${repo}" rev-parse --short ${r}`).trim()
const ver = { main: rev(LM, 'main'), o595: rev(LM, 'refs/heads/ordre-595'), site: rev(SITE, GREN), godkendt585: '291f5bf' }
const dir = mkdtempSync(join(tmpdir(), 'k598-'))
const hent = (repo, ref, hvor, stier = '') => { mkdirSync(hvor, { recursive: true }); execSync(`git -C "${repo}" archive -o "${join(hvor, 'a.tar')}" ${ref} ${stier}`); execSync('tar -xf a.tar', { cwd: hvor }); rmSync(join(hvor, 'a.tar')) }
const lmMain = join(dir, '_main'), lm595 = join(dir, '_595'), web = join(dir, 'web'), web2 = join(dir, 'web2')
hent(LM, 'main', lmMain, 'dist src kroppe package.json docs/RAPPORT-dag-86.md docs/RAPPORT-dag-87.md docs/RAPPORT-dag-88.md')
hent(LM, 'refs/heads/ordre-595', lm595, 'dist src kroppe package.json')
hent(SITE, GREN, web)
const V = '/assets/vaerktoejer'
const tjek = []
const paastaa = (hvad, ok, data) => { tjek.push({ hvad, ok: !!ok, data }); console.log(`${ok ? 'ok ' : 'NEJ'} ${hvad}${data !== undefined ? ' ' + JSON.stringify(data).slice(0, 600) : ''}`) }
const ud = { ver, kopi: {}, mini: [], ligner: [], toFiler: [], figurside: {}, da7: {}, klip: {}, v7: {} }

// --- 1) Hvad er nyt, og hvad skal Setu kopiere ------------------------------------------------------
const blobs = (repo, ref, d) => Object.fromEntries(sh(`git -C "${repo}" ls-tree -r ${ref} -- ${d}/`).split('\n').filter(Boolean).map((l) => { const [meta, f] = l.split('\t'); return [f.slice(d.length + 1), meta.split(' ')[2]] }))
const forskelle = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((f) => a[f] !== b[f])
for (const m of ['maal-billede', 'baenk-figurer', 'tre-loeft', 'min-krop', 'loeft-fejl', 'squat-figurer', 'doedloeft-figurer']) {
  const site = blobs(SITE, GREN, `assets/vaerktoejer/${m}`)
  ud.kopi[m] = {
    siteMod291: forskelle(blobs(LM, ver.godkendt585, `dist/${m}`), site),
    siteModMain: forskelle(blobs(LM, 'main', `dist/${m}`), site),
    mainMod595: forskelle(blobs(LM, 'main', `dist/${m}`), blobs(LM, 'refs/heads/ordre-595', `dist/${m}`)),
  }
}
ud.kopi.maalVideoUaendret = sh(`git -C "${LM}" diff --stat ${ver.godkendt585} main -- src/maalVideo.js`).trim() === ''
console.log(JSON.stringify(ud.kopi))
paastaa(`sitets maal-billede (${ver.site}) er stadig 580-udgaven (291f5bf, godkendt i 585); main har ny maal-billede.js og 8 miniaturer, som Setu skal kopiere`, ud.kopi['maal-billede'].siteMod291.length === 0 && ud.kopi['maal-billede'].siteModMain.includes('maal-billede.js') && ud.kopi['maal-billede'].siteModMain.filter((f) => f.startsWith('miniaturer/')).length === 8, ud.kopi['maal-billede'].siteModMain)
ud.kopi.o595Merget = sh(`git -C "${LM}" merge-base --is-ancestor refs/heads/ordre-595 main && echo ja || echo nej`).trim()
ud.kopi.fra593 = Object.fromEntries(['maal-billede', 'baenk-figurer', 'tre-loeft', 'min-krop', 'loeft-fejl'].map((m) => [m, forskelle(blobs(LM, 'ed41442', `dist/${m}`), blobs(LM, 'main', `dist/${m}`))]))
ud.kopi.nyeSiden595 = sh(`git -C "${LM}" log --format=%h%x20%s af745da..main`).trim().split(/\r?\n/).filter(Boolean)
ud.kopi.fra595 = Object.fromEntries(['maal-billede', 'baenk-figurer', 'tre-loeft', 'min-krop', 'loeft-fejl'].map((m) => [m, forskelle(blobs(LM, 'af745da', `dist/${m}`), blobs(LM, 'main', `dist/${m}`))]))
paastaa(`595 er merget undervejs (dist paa main = ordre-595 undtagen det, der kom efter), og 595 aendrede kun tre-loeft.js og min-krop.js; maal-billede, baenk-figurer og fejlsiderne er 593's`, ud.kopi.o595Merget === 'ja' && ud.kopi.fra593['baenk-figurer'].length === 0 && ud.kopi.fra593['loeft-fejl'].length === 0 && ud.kopi.fra593['tre-loeft'].join() === 'tre-loeft.js' && ud.kopi.fra593['min-krop'].join() === 'min-krop.js' && ud.kopi.fra593['maal-billede'].every((f) => ud.kopi.fra595['maal-billede'].includes(f)), { fra593: ud.kopi.fra593, fra595: ud.kopi.fra595 })
paastaa(`efter 595 er main flyttet igen (${ver.main}): ${ud.kopi.nyeSiden595.length} commits; de aendrer kun maal-billede.js og index.html, ikke miniaturerne (ikke vurderet i denne ordre)`, ud.kopi.fra595['maal-billede'].every((f) => ['maal-billede.js', 'index.html'].includes(f)) && ['baenk-figurer', 'tre-loeft', 'min-krop', 'loeft-fejl'].every((m) => ud.kopi.fra595[m].length === 0), { nye: ud.kopi.nyeSiden595, maal: ud.kopi.fra595['maal-billede'] })
paastaa('videoens kode (src/maalVideo.js) er uaendret siden 291f5bf', ud.kopi.maalVideoUaendret)

// Sitet, som det bliver efter Setus kopi (hele mapper), og en kopi, hvor kun de to filer er kopieret.
const S = (w, m) => join(w, 'assets', 'vaerktoejer', m)
cpSync(web, web2, { recursive: true })
for (const m of ['maal-billede', 'baenk-figurer']) { rmSync(S(web, m), { recursive: true }); cpSync(join(lmMain, 'dist', m), S(web, m), { recursive: true }) }
for (const m of ['tre-loeft', 'min-krop']) { rmSync(S(web, m), { recursive: true }); cpSync(join(lm595, 'dist', m), S(web, m), { recursive: true }) }
for (const f of ['index.html', 'maal-billede.js']) cpSync(join(lmMain, 'dist', 'maal-billede', f), join(S(web2, 'maal-billede'), f))

// --- 2) Miniaturerne som filer ---------------------------------------------------------------------
const MINI = join(lmMain, 'dist', 'maal-billede', 'miniaturer')
const miniFiler = readdirSync(MINI).filter((f) => f.endsWith('.svg')).sort()
const cirkler = (svg) => [...svg.matchAll(/<path d="M(-?[\d.]+) (-?[\d.]+)a([\d.]+) [\d.]+ 0 1 0 [\d.]+ 0[^"]*"([^>]*)\/>/g)].map((m) => ({ cx: +m[1] + +m[3], cy: +m[2], r: +m[3], spoegelse: /(fill|stroke)-opacity="0\.2/.test(m[4]) }))
for (const f of miniFiler) {
  const svg = readFileSync(join(MINI, f), 'utf8')
  const [, w, h] = svg.match(/<svg[^>]*width="(\d+)" height="(\d+)"/)
  const vb = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number)
  const pxPrEnhed = Math.min(+w / vb[2], +h / vb[3])
  const felter = [...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" fill="#141410" fill-opacity="0\.78"\/>/g)].map((m) => m.slice(1).map(Number))
  // Fejlfigurens led og skiver mod modellens udfoerelse (samme radius): hvor langt flytter de sig paa skaermen?
  const C = cirkler(svg), sp = C.filter((c) => c.spoegelse), fe = C.filter((c) => !c.spoegelse)
  const flyt = fe.map((c) => { const g = sp.find((s) => Math.abs(s.r - c.r) < 0.02); return g ? Math.hypot(c.cx - g.cx, c.cy - g.cy) * pxPrEnhed : null }).filter((x) => x !== null)
  ud.mini.push({ f, w: +w, h: +h, tekst: /<text\b/.test(svg), pxPrEnhed: +pxPrEnhed.toFixed(3), tekstfelter: felter.length, maksFlytPx: +(Math.max(0, ...flyt)).toFixed(1), flytPx: flyt.map((x) => +x.toFixed(1)) })
}
paastaa('8 miniaturer, ingen <text>, staaende 96 x 130 og baenkens liggende 150 x 118', miniFiler.length === 8 && ud.mini.every((m) => !m.tekst && ((m.f.startsWith('bp-') && m.w === 150 && m.h === 118) || (!m.f.startsWith('bp-') && m.w === 96 && m.h === 130))), ud.mini.map((m) => `${m.f} ${m.w}x${m.h}`))
paastaa('fejlen flytter et led eller en skive mindst 4 CSS-px fra modellens udfoerelse i hver miniature (fejlen kan ses i tegningen)', ud.mini.every((m) => m.maksFlytPx >= 4), ud.mini.map((m) => `${m.f}: ${m.maksFlytPx} px`))
ud.miniFelter = ud.mini.filter((m) => m.tekstfelter > 0).map((m) => `${m.f}: ${m.tekstfelter}`)

// --- 3) I browseren ----------------------------------------------------------------------------------
const typer = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.json': 'application/json', '.ico': 'image/x-icon', '.woff2': 'font/woff2' }
const status = new Map()
const server = createServer((req, res) => {
  const [, rod, ...rest] = decodeURIComponent(req.url.split('?')[0].split('#')[0]).split('/')
  const u = '/' + rest.join('/')
  let f = join(rod === 'to' ? web2 : rod === 'mini' ? MINI : web, u)
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html')
  if (!existsSync(f)) { status.set(`/${rod}${u}`, 404); res.writeHead(404); return res.end() }
  res.writeHead(200, { 'content-type': typer[path.extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f))
}).listen(0)
const BASE = `http://127.0.0.1:${server.address().port}`
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const browser = await chromium.launch({ headless: true, executablePath: CHROME })
ud.chrome = browser.version()
const eksterne = new Set()
async function side(br, bredde, url, b = br) {
  const mobil = bredde < 500
  const ctx = await b.newContext({ viewport: { width: bredde, height: mobil ? 780 : 900 }, deviceScaleFactor: mobil ? 3 : 1, isMobile: mobil, hasTouch: mobil })
  const page = await ctx.newPage()
  const T = { ctx, page, mobil, bredde, fejl: [] }
  page.on('pageerror', (e) => T.fejl.push(e.message))
  await page.route('**/*', (r) => { const u = r.request().url(); if (u.startsWith(BASE) || /^(data|blob):/.test(u)) return r.continue(); eksterne.add(u.split('?')[0]); return r.abort() })
  if (url) { await page.goto(BASE + url, { waitUntil: 'load' }); await page.waitForTimeout(250) }
  return T
}

// 3a) Hvor meget af figuren skjuler tekstens tilbageblevne baggrundsfelter? (tegnet i 3x, som paa telefonen)
{
  const T = await side(browser, 390, `/ny${V}/maal-billede/index.html`)
  for (const m of ud.mini) {
    const svg = readFileSync(join(MINI, m.f), 'utf8')
    const uden = svg.replace(/<rect [^>]*fill-opacity="0\.78"\/>/g, '')
    m.skjult = await T.page.evaluate(async ([a, b, w, h]) => {
      const tegn = async (s) => { const i = new Image(); i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s); await i.decode(); const k = document.createElement('canvas'); k.width = w * 3; k.height = h * 3; const x = k.getContext('2d'); x.drawImage(i, 0, 0, k.width, k.height); return x.getImageData(0, 0, k.width, k.height).data }
      const A = await tegn(a), B = await tegn(b)
      let figur = 0, skjult = 0
      for (let p = 0; p < B.length; p += 4) {
        const bg = Math.abs(B[p] - 0x14) + Math.abs(B[p + 1] - 0x14) + Math.abs(B[p + 2] - 0x10) > 36
        if (!bg) continue
        figur++
        if (Math.abs(A[p] - B[p]) + Math.abs(A[p + 1] - B[p + 1]) + Math.abs(A[p + 2] - B[p + 2]) > 60) skjult++
      }
      return { figur, skjult, andel: +(skjult / figur * 100).toFixed(1), cssPx2: Math.round(skjult / 9) }
    }, [svg, uden, m.w, m.h])
    if (m.tekstfelter) {
      for (const [navn, s] of [['med', svg], ['uden', uden]]) {
        await T.page.setContent(`<body style="margin:0;background:#101010"><img src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(s)}" width="${m.w * 3}" height="${m.h * 3}"></body>`)
        await T.page.waitForTimeout(80)
        await T.page.locator('img').screenshot({ path: join(HERE, `M-mini-${m.f.replace('.svg', '')}-${navn}-felter.png`) })
      }
    }
  }
  await T.ctx.close()
}
const medFelter = ud.mini.filter((m) => m.tekstfelter > 0)
paastaa('teksten er taget ud, men tekstens moerke baggrundsfelter (fill-opacity 0,78) er ikke: hvor mange miniaturer har dem, og hvor meget af figuren skjuler de?', true, ud.mini.map((m) => `${m.f}: ${m.tekstfelter} felter, ${m.skjult.andel} % af figuren skjult (${m.skjult.cssPx2} CSS-px2)`))
ud.skjultMaks = Math.max(...ud.mini.map((m) => m.skjult.andel))
paastaa('M1 (fund): i doedloeftets og baenkens miniaturer skjuler de tilbageblevne tekstfelter en del af figuren', medFelter.length > 0 && medFelter.every((m) => m.skjult.skjult > 0), medFelter.map((m) => `${m.f}: ${m.skjult.andel} %`))

// 3b) "Ligner" paa modellens egne tegnede stillinger, i sitets kopi med den nye maal-billede
const imp = (f) => import(pathToFileURL(join(lmMain, 'src', f)).href)
const { KROPPE, squatBilleder } = await imp('fejlgenkendelseMaaling.js')
const { KAMHOEJDE, foto, kamera, i3D, KAMERAER } = await imp('fejlPinhole.js')
const { KAMERAER_BAENK, KAMERAER_SUMO, baenkBilleder, dlBilleder } = await imp('loeftVirkelighed.js')
const { indstilling } = await imp('minKrop.js')
const K = KROPPE.find((k) => k.h === 183 && k.v === 120 && !Object.keys(k.pct).length)
const tilKlik = (Q, P, kam, loeft, x0 = 470) => {
  const F = foto(Q, kamera(kam.k(KAMHOEJDE[loeft], P)))
  const dx = x0 - F.midtfod.x, dy = 1080 - F.midtfod.y
  return Object.fromEntries(Object.entries(F).map(([id, q]) => [id, { x: q.x + dx, y: q.y + dy }]))
}
const vink = KAMERAER.find((k) => k.id === 'vinkelret')
const sq = squatBilleder({ ...indstilling('squat', { hoejde: 183, vaegt: 120 }, { gennemsnit: true }) })
const sqKlik = (b) => tilKlik(i3D(b.P, 'squat'), b.P, vink, 'squat')
const konv = dlBilleder(K, 'konventionel', 'konventionel'), sumo = dlBilleder(K, 'sumo', 'sumo')
const dlVink = KAMERAER_SUMO.find((k) => k.id === 'vinkelret')
const dlKlik = (b) => tilKlik(b.Q, b.P, dlVink, 'doedloeft')
const kamB = KAMERAER_BAENK.find((k) => k.id === 'baenkhoejde')
const bpFejl = baenkBilleder(K, 0).fejl['bp-hoejt-bryst'][0]
const TILF = [
  { id: 'sq-bund-kun-knae', fase: 'squat-bund', sumo: false, kg: 140, klik: sqKlik(sq.fejl['sq-kun-knae-bund'][0]) },
  { id: 'sq-bund-hofte-tilbage', fase: 'squat-bund', sumo: false, kg: 140, klik: sqKlik(sq.fejl['sq-hofte-tilbage-bund'][0]) },
  { id: 'sq-midt-kun-knae', fase: 'squat-midt', sumo: false, kg: 140, klik: sqKlik(sq.fejl['sq-kun-knae-midt'][0]) },
  ...(sq.fejl['sq-hofte-tilbage-midt'] ? [{ id: 'sq-midt-hofte-tilbage', fase: 'squat-midt', sumo: false, kg: 140, klik: sqKlik(sq.fejl['sq-hofte-tilbage-midt'][0]) }] : []),
  { id: 'dl-hofte-foerst', fase: 'dl-gulv', sumo: false, kg: 200, klik: dlKlik(konv.fejl['dl-hofte-foerst'][0]) },
  { id: 'dl-stang-frem', fase: 'dl-knae', sumo: false, kg: 200, klik: dlKlik(konv.fejl['dl-stang-frem'][0]) },
  { id: 'sumo-stang-frem', fase: 'dl-knae', sumo: true, kg: 200, klik: dlKlik(sumo.fejl['dl-stang-frem'][0]) },
  { id: 'bp-hoejt-bryst', fase: 'baenk-bryst', sumo: false, kg: 100, klik: tilKlik(bpFejl.Q, bpFejl.P, kamB, 'baenk', 700) },
]
const LIGNER = async (t) => {
  const k = document.createElement('canvas'); k.width = 900; k.height = 1200
  const x = k.getContext('2d'); x.fillStyle = '#34373d'; x.fillRect(0, 0, 900, 1200)
  await window.maalBillede.laesBillede(k.toDataURL('image/png'), `syntetisk-${t.id}.png`)
  window.maalBillede.saetKrop({ hoejde: '183', vaegt: '120' })
  window.maalBillede.saetStangKg?.(t.kg)
  window.maalBillede.saetFase(t.fase)
  window.maalBillede.saetSumo(t.sumo)
  window.maalBillede.saetPunkter(t.klik)
  await new Promise((ok) => requestAnimationFrame(() => setTimeout(ok, 400)))
  const e = document.querySelector('[data-ligner]'), b = e.getBoundingClientRect()
  const imgs = [...e.querySelectorAll('.mb-ligner-figurer img')].map((i) => { const r = i.getBoundingClientRect(); return { src: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 0, alt: i.alt, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), href: i.closest('a')?.href } })
  return { status: e.dataset.status, fejl: e.dataset.fejl || null, tekst: e.textContent.replace(/\s+/g, ' ').trim().slice(0, 160), boks: { l: Math.round(b.left), r: Math.round(b.right) }, imgs, vandret: document.documentElement.scrollWidth - document.documentElement.clientWidth }
}
for (const [rod, liste] of [['ny', ud.ligner], ['to', ud.toFiler]]) {
  for (const bredde of rod === 'ny' ? [360, 390, 1280] : [390]) {
    for (const t of TILF) {
      const T = await side(browser, bredde, `/${rod}${V}/maal-billede/index.html`)
      await T.page.waitForSelector('[data-klar]')
      const r = await T.page.evaluate(LIGNER, t)
      for (const i of r.imgs) { const u = new URL(i.href); i.linkStatus = (await fetch(BASE + u.pathname)).status }
      liste.push({ id: t.id, bredde, ...r, jsFejl: T.fejl })
      if ((bredde === 390 || bredde === 360) && rod === 'ny' && ['bp-hoejt-bryst', 'dl-stang-frem', 'sq-bund-kun-knae'].includes(t.id)) { await T.page.locator('[data-ligner]').scrollIntoViewIfNeeded(); await T.page.locator('[data-ligner]').screenshot({ path: join(HERE, `M-${bredde}-ligner-${t.id}.png`) }) }
      if (bredde === 1280 && t.id === 'bp-hoejt-bryst') { await T.page.locator('[data-ligner]').scrollIntoViewIfNeeded(); await T.page.locator('[data-ligner]').screenshot({ path: join(HERE, `M-1280-ligner-${t.id}.png`) }) }
      if (rod === 'to' && t.id === 'bp-hoejt-bryst') { await T.page.locator('[data-ligner]').scrollIntoViewIfNeeded(); await T.page.locator('[data-ligner]').screenshot({ path: join(HERE, 'M-390-ligner-kun-to-filer.png') }) }
      await T.ctx.close()
    }
  }
}
const L = ud.ligner
const lAfvig = L.filter((r) => r.status !== 'ligner' || !r.imgs.length || r.imgs.some((i) => !i.ok || !/^miniaturer\/[\w-]+\.svg$/.test(i.src) || i.x < r.boks.l || i.x + i.w > r.boks.r || i.linkStatus !== 200) || r.vandret > 0 || r.jsFejl.length)
paastaa(`${TILF.length} fejlstillinger x 3 bredder i sitets kopi: Ligner, hver miniature hentet fra miniaturer/, inden for boksen, link til den hele figur 200, 0 vandret rul, 0 JS-fejl`, lAfvig.length === 0, lAfvig.map((r) => ({ id: r.id, b: r.bredde, st: r.status, imgs: r.imgs })))
const bp = L.filter((r) => r.id === 'bp-hoejt-bryst')
ud.baenkPar = bp.map((r) => ({ b: r.bredde, imgs: r.imgs.map((i) => `${i.src.split('/')[1]} ${i.w}x${i.h} @${i.x},${i.y}`) }))
paastaa('baenkens to miniaturer staar side om side (samme top) paa 360, 390 og 1280; bredde i CSS-px', bp.every((r) => r.imgs.length === 2 && r.imgs[0].y === r.imgs[1].y), ud.baenkPar)
ud.baenkBredde360 = bp.find((r) => r.bredde === 360)?.imgs.map((i) => i.w)
const to = ud.toFiler
paastaa('kopieres kun index.html og maal-billede.js (uden miniaturer/), er alle miniaturer brudte: kun alt-teksten staar', to.every((r) => r.imgs.length && r.imgs.every((i) => !i.ok)), to.map((r) => ({ id: r.id, brudt: r.imgs.filter((i) => !i.ok).length, alt: r.imgs[0]?.alt })))

// --- 4) Baenkens figurside (BA1) mod figurernes egne tal ------------------------------------------------
const tekstAf = (s) => s.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
const BF = join(S(web, 'baenk-figurer'))
const fs = tekstAf(readFileSync(join(BF, 'index.html'), 'utf8'))
const labels = (f) => [...readFileSync(join(BF, f), 'utf8').matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1])
const tal = (s) => Number(s.replace(',', '.'))
const figTal = (f) => { const l = labels(f).join(' | '); return { skulder: tal(l.match(/\bskulder ([\d,]+) cm/)[1]), albue: tal(l.match(/\balbue ([\d,]+) cm/)[1]), vej: tal(l.match(/vej ([\d,]+) cm/)[1]), iAltSkulder: tal(l.match(/momentarm i alt: skulder ([\d,]+)/)[1]), iAltAlbue: tal(l.match(/momentarm i alt: skulder [\d,]+ · albue ([\d,]+)/)[1]) } }
const F = Object.fromEntries(['bue-lille', 'bue-middel', 'bue-stor', 'greb-smal', 'greb-middel', 'greb-bred'].map((n) => [n, figTal(`baenk-${n}.svg`)]))
const s1 = fs.match(/Stangen rører brystets højeste punkt i alle tre\.[^.]*\.[^.]*?\d,\d cm nærmere halsen[^.]*\./)?.[0] || fs.match(/Stangen rører brystets højeste punkt[^]*?fra middel til stor\./)?.[0]
const s2 = fs.match(/Fra lille til stor bue \(middel greb\)[^.]*\d,\d cm [^.]*\./)?.[0]
const s2b = fs.match(/Fra smalt til bredt greb \(middel bue\)[^]*?kortere\./)?.[0]
const r1 = (x) => Math.round(x * 10) / 10
const f1 = (x) => r1(x).toFixed(1).replace('.', ',')
const s2tal = s2 && { vej: tal(s2.match(/vejen ([\d,]+) cm kortere/)[1]), msk: tal(s2.match(/momentarm ([\d,]+) cm længere/)[1]), fod: tal(s2.match(/rører ([\d,]+) cm længere mod fødderne/)[1]) }
const s2btal = s2b && { vej: tal(s2b.match(/vejen ([\d,]+) cm kortere/)[1]), msk: tal(s2b.match(/momentarm ([\d,]+) cm længere/)[1]), alb: tal(s2b.match(/albuens ([\d,]+) cm kortere/)[1]) }
const vist = {
  bueVej: r1(F['bue-lille'].vej - F['bue-stor'].vej), bueMsk: r1(F['bue-stor'].iAltSkulder - F['bue-lille'].iAltSkulder), bueFod: r1(F['bue-stor'].skulder - F['bue-lille'].skulder),
  grebVej: r1(F['greb-smal'].vej - F['greb-bred'].vej), grebMsk: r1(F['greb-bred'].iAltSkulder - F['greb-smal'].iAltSkulder), grebAlb: r1(F['greb-smal'].iAltAlbue - F['greb-bred'].iAltAlbue),
}
ud.figurside = { s1, s1ord: s1?.split(/\s+/).length, s2, s2b, s2tal, s2btal, figurer: F, vist }
paastaa('BA1 lukket: foerste saetning har figurernes tal (22,1 / 25,1 / 24,1 cm fra skulderleddet) og de to skridt regnet af de viste tal (3,0 og 1,0), ikke "laengere mod foedderne" hele vejen', s1 && s1.includes(`${f1(F['bue-lille'].skulder)}, ${f1(F['bue-middel'].skulder)} og ${f1(F['bue-stor'].skulder)} cm`) && s1.includes(`${f1(F['bue-middel'].skulder - F['bue-lille'].skulder)} cm længere mod fødderne fra lille til middel`) && s1.includes(`${f1(F['bue-middel'].skulder - F['bue-stor'].skulder)} cm nærmere halsen fra middel til stor`) && /men ikke hele vejen længere mod fødderne/.test(s1), { s1, ord: ud.figurside.s1ord })
paastaa('M2 (fund, DA7-slags): naeste saetning paa figursiden regner forskellene af urundede tal og passer ikke med figurernes viste tal', s2tal && (s2tal.vej !== vist.bueVej || s2tal.msk !== vist.bueMsk || (s2btal && (s2btal.vej !== vist.grebVej || s2btal.msk !== vist.grebMsk || s2btal.alb !== vist.grebAlb))), { siger: { bue: s2tal, greb: s2btal }, figurerneGiver: vist })

// --- 5) DA7 paa ordre-595: tre-loefts linje, alle kropstyper og mine egne skruede kroppe -----------------
const TL = await import(pathToFileURL(join(lm595, 'src', 'treLoeft.js')).href)
const tjekLinje = (tekst) => {
  const m = tekst.match(/(\d+|\d+,\d) ?(°|%| cm) (mere|mindre|længere|kortere)?[^()]*?\((−?[\d,]+)°? → (−?[\d,]+)°?( Nm| cm)?\)/) || tekst.match(/(stiger|falder) (\d+) % [^()]*\((−?\d+) → (−?\d+) Nm\)/)
  if (/næsten intet|udgangspunktet|ingen mulig/.test(tekst)) return { ok: true, tom: true }
  const n = (s) => Number(String(s).replace('−', '-').replace(',', '.'))
  let r = tekst.match(/(\w+) (bøjer|hælder) (\d+)° (mere|mindre) [^()]*\((−?\d+)° → (−?\d+)°\)/)
  if (r) { const [, led, verb, d, ord, a, b] = r; const f = n(b) - n(a); const ret = led === 'torsoen' ? (f > 0 ? 'mere' : 'mindre') : (f < 0 ? 'mere' : 'mindre'); return { ok: Math.abs(f) === n(d) && ret === ord && n(d) > 0, d: n(d), f } }
  r = tekst.match(/moment (stiger|falder) (\d+) % [^()]*\((−?\d+) → (−?\d+) Nm\)/)
  if (r) { const [, ord, p, a, b] = r; const pp = Math.round(Math.abs(n(b) - n(a)) / Math.abs(n(a)) * 100); return { ok: pp === n(p) && (Math.abs(n(b)) > Math.abs(n(a)) ? 'stiger' : 'falder') === ord && n(p) > 0, p: n(p), pp } }
  r = tekst.match(/stangens vej bliver ([\d,]+) cm (længere|kortere) \((−?[\d,]+) → (−?[\d,]+) cm\)/)
  if (r) { const [, d, ord, a, b] = r; const f = r1(n(b) - n(a)); return { ok: Math.abs(f) === n(d) && (f > 0 ? 'længere' : 'kortere') === ord && n(d) > 0, d: n(d), f } }
  if (/stangens vej er næsten den samme \((−?[\d,]+) → \1 cm\)/.test(tekst)) return { ok: true }
  return { ok: false, ukendt: true }
}
const da7 = []
let z = 598
const tilf = () => { z = (z * 1103515245 + 12345) >>> 0; return z / 2 ** 32 }
for (const loeft of ['squat', 'doedloeft', 'baenk']) {
  const kroppe = TL.forudindstillingerFor(loeft).map((f) => ({ navn: f.id, ind: TL.forudindstilling(loeft, f.id) }))
  for (let i = 0; i < 40; i++) {
    const ind = { ...TL.standardIndstilling(loeft, 'gennemsnit'), hoejde: 158 + Math.round(tilf() * 40), vaegt: 60 + Math.round(tilf() * 85) }
    for (const p of TL.PROPORTIONER) if (tilf() < 0.6) ind[p] = 89 + Math.round(tilf() * 22)
    if (loeft === 'doedloeft' && tilf() < 0.4) ind.stil = 'sumo'
    if (loeft === 'baenk') { ind.bue = ['lille', 'middel', 'stor'][Math.floor(tilf() * 3)]; ind.greb = ['smal', 'middel', 'bred'][Math.floor(tilf() * 3)] }
    kroppe.push({ navn: `skruet-${i}`, ind })
  }
  for (const k of kroppe) for (const s of TL.STILLINGER_FOR[loeft]) {
    let tekst
    try { tekst = TL.aendringsLinje(loeft, k.ind, s.id).tekst } catch (e) { tekst = 'FEJL ' + e.message }
    da7.push({ loeft, krop: k.navn, stilling: s.id, tekst, ...tjekLinje(tekst) })
  }
}
const da7Fejl = da7.filter((x) => !x.ok)
ud.da7 = { linjer: da7.length, medTal: da7.filter((x) => !x.tom).length, fejl: da7Fejl.slice(0, 20), eksempler: da7.filter((x) => ['lange-arme', 'korte-laar'].includes(x.krop) && x.loeft === 'doedloeft' && x.stilling === 'opstilling').map((x) => x.tekst) }
paastaa(`DA7 lukket paa ordre-595: ${da7.length} linjer (alle kropstyper og 120 af mine skruede kroppe i alle stillinger): tallet er forskellen af parentesens viste tal, og ordet har samme retning`, da7Fejl.length === 0 && ud.da7.medTal > 200, { medTal: ud.da7.medTal, fejl: da7Fejl.slice(0, 5), eks: ud.da7.eksempler })
paastaa('DA7: de to saetninger fra 582 siger nu 9 og 7 grader', ud.da7.eksempler.some((t) => /hoften bøjer 9° mindre ved opstillingen \(51° → 60°\)/.test(t)) && ud.da7.eksempler.some((t) => /torsoen hælder 7° mindre ved opstillingen \(62° → 55°\)/.test(t)), ud.da7.eksempler)
// deadliftAnimation (Yantras egen nabo-saetning): ikke paa sitet, men regnes den ens?
const DA = await import(pathToFileURL(join(lm595, 'src', 'embed', 'deadliftAnimation.js')).href).catch((e) => ({ fejl: e.message }))
if (DA.computeStyleComparisonLines) {
  const res = []
  for (const bodyType of Object.keys(DA.LENGTHS_BY_PRESET || { balanceret: 1, 'lange-ben': 1, 'lang-torso': 1 })) for (const tibiaAngleDeg of [4, 8, 12, 16, 20, 24]) for (const standbredde of [1.4, 1.8, 2.2]) {
    let lines
    try { lines = DA.computeStyleComparisonLines({ bodyType, tibiaAngleDeg, standbredde }).lines } catch { continue }
    for (const l of lines) {
      const m = l.match(/(−?-?[\d.]+) cm kortere stangvej .*\(([\d.]+) cm mod ([\d.]+) cm\)/) || l.match(/hælder (−?-?[\d.]+)° mindre .*\(([\d.]+)° mod ([\d.]+)°\)/)
      if (m) { const vistF = r1(Number(m[3]) - Number(m[2])); res.push({ l: l.slice(0, 60), siger: Number(m[1]), vist: /stangvej/.test(l) ? vistF : r1(Number(m[3]) - Number(m[2])), neg: Number(m[1]) < 0 }) }
    }
  }
  ud.da7.animation = { n: res.length, afvig: res.filter((x) => x.siger !== x.vist).length, negativ: res.filter((x) => x.neg).length, eks: res.filter((x) => x.siger !== x.vist || x.neg).slice(0, 4) }
  paastaa('DA7-nabo (lav, ikke paa sitet): dist/deadlift-animation.js regner "Sumo giver X cm kortere" og "hælder X° mindre" af urundede tal; hvor ofte afviger det fra parentesen, og vender fortegnet?', true, ud.da7.animation)
} else ud.da7.animation = DA

// Tre-loeft i sitets kopi med 595: linjen i browseren for doedloeft, laengere arme, opstilling
{
  const T = await side(browser, 390, `/ny${V}/tre-loeft/indlejret.html`)
  ud.da7.side = await T.page.evaluate(() => ({ tekst: document.body.innerText.replace(/\s+/g, ' ').slice(0, 3000), knapper: [...document.querySelectorAll('button,[role=tab],label,select')].map((b) => b.tagName + ':' + b.textContent.trim().slice(0, 30)).slice(0, 80) }))
  const lin = []
  for (const [forud, stilling, forvent] of [['lange-arme', 'opstilling', /hoften bøjer 9° mindre ved opstillingen \(51° → 60°\)/], ['korte-laar', 'opstilling', /torsoen hælder 7° mindre ved opstillingen \(62° → 55°\)/]]) {
    for (const sel of ['[data-loeft=doedloeft]', `[data-forud=${forud}]`, `[data-stilling=${stilling}]`]) {
      await T.page.waitForSelector(sel, { state: 'attached', timeout: 15000 })
      const l = T.page.locator(sel).first()
      if (await l.isVisible()) await l.tap(); else await l.evaluate((e) => e.click())
      await T.page.waitForTimeout(400)
    }
    const l = (await T.page.evaluate(() => document.body.innerText)).split('\n').find((x) => /^(Længere arme|Kortere lårben): /.test(x)) || null
    lin.push({ forud, l, ok: forvent.test(l || '') })
  }
  ud.da7.sideLinje = lin
  ud.da7.sideFejl = T.fejl
  await T.page.screenshot({ path: join(HERE, 'M-390-tre-loeft-da7.png') })
  await T.ctx.close()
}
paastaa('i browseren (390, touch, sitets kopi med 595): Dødløft, Lange arme / Korte lårben, Opstilling viser 9 og 7 grader, 0 JS-fejl', ud.da7.sideLinje.every((x) => x.ok) && !ud.da7.sideFejl.length, { linje: ud.da7.sideLinje, fejl: ud.da7.sideFejl })
delete ud.da7.side

// --- 6) Klip efter klip i samme fane (595), med mine klip fra 582: MOV, 4K, HEVC og variabel billedrate ----
const { filer: KLIP, info: KLIPINFO } = await lavKlip()
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
const rolig = (T) => T.page.waitForFunction(() => { const i = window.maalBillede.billedInfo?.(); return (!i || i.iKoe === 0) && !window.maalBillede.video.seeking }, null, { timeout: 30000 }).then(() => true, () => false)
async function tryk(T, sel) { const l = T.page.locator(sel); await l.scrollIntoViewIfNeeded(); if (T.mobil) await l.tap(); else await l.click() }
const TAELLER = () => {
  const levende = new Set(); window.__blob = { levende, lavet: 0 }
  const c = URL.createObjectURL.bind(URL), r = URL.revokeObjectURL.bind(URL)
  URL.createObjectURL = (o) => { const u = c(o); if (o instanceof Blob && (o.type || '').startsWith('video') || o instanceof File) { levende.add(u); window.__blob.lavet++ } return u }
  URL.revokeObjectURL = (u) => { levende.delete(u); return r(u) }
}
const RAEKKE = ['sqvfr.mov', 'sq4k.mp4', 'sqhevc.mov', 'sq2997.mp4', 'sqvfr.mp4', 'sq2997.mov']
for (const [bredde, medLuk] of [[390, true], [390, false], [1280, true]]) {
  const T = await side(browser, bredde, null)
  await T.page.addInitScript(TAELLER)
  await T.page.goto(`${BASE}/ny${V}/maal-billede/index.html`, { waitUntil: 'load' })
  await T.page.waitForSelector('[data-klar]')
  const net0 = eksterne.size
  const runder = []
  for (let i = 0; i < 12; i++) {
    const klip = RAEKKE[i % RAEKKE.length]
    await T.page.setInputFiles('[data-videofil]', KLIP[klip])
    const aabnet = await T.page.waitForFunction(() => { const v = window.maalBillede.video; return v.readyState >= 2 && document.querySelector('[data-skyder]').max !== '0' && !v.seeking }, null, { timeout: 60000 }).then(() => true, () => false)
    await rolig(T)
    const nr = [await T.page.evaluate(NUMMER, ['video', BITS])]
    for (let j = 0; j < 3; j++) { await tryk(T, '[data-frem]'); await rolig(T); await T.page.waitForTimeout(60); nr.push(await T.page.evaluate(NUMMER, ['video', BITS])) }
    await tryk(T, '[data-brug]')
    await T.page.waitForFunction(() => !!window.maalBillede.tilstand().billede, null, { timeout: 10000 }).catch(() => {})
    await T.page.waitForTimeout(150)
    const foto = await T.page.evaluate(NUMMER, ['foto', BITS])
    if (medLuk) { await tryk(T, '[data-lukvideo]'); await T.page.waitForTimeout(150) }
    const m = await T.page.evaluate(() => { const v = window.maalBillede.video; return { blob: window.__blob.levende.size, lavet: window.__blob.lavet, src: !!v.getAttribute('src') || !!v.currentSrc && v.readyState > 0, readyState: v.readyState, videoer: document.querySelectorAll('video').length, knuder: document.getElementsByTagName('*').length, heapMB: +(performance.memory?.usedJSHeapSize / 1e6).toFixed(2) } })
    runder.push({ i: i + 1, klip, aabnet, nr, foto, ...m })
  }
  ud.klip[`${bredde}-${medLuk ? 'luk' : 'uden-luk'}`] = { runder, net: eksterne.size - net0, fejl: T.fejl }
  if (bredde === 390 && medLuk) await T.page.screenshot({ path: join(HERE, 'M-390-12-klip.png') })
  await T.ctx.close()
}
const KL = Object.entries(ud.klip)
paastaa('12 klip efter hinanden i samme fane (VFR-MOV, 4K, HEVC, 29,97, VFR-MP4, MOV), 390 og 1280: hvert klip aabner, 3 tryk er 0,1,2,3, fotoet er det viste billede', KL.every(([, k]) => k.runder.every((r) => r.aabnet && JSON.stringify(r.nr) === '[0,1,2,3]' && r.foto === 3)), KL.map(([n, k]) => `${n}: ${k.runder.map((r) => r.nr.join('') + '/' + r.foto).join(' ')}`))
paastaa('med Luk videoen: 0 levende video-blob-URL\'er og readyState 0 efter hver runde; uden Luk: hoejst 1 (det aabne klip); altid 1 video', KL.every(([n, k]) => k.runder.every((r) => r.videoer === 1 && (!n.includes('uden') ? r.blob === 0 && r.readyState === 0 : r.blob <= 1))), KL.map(([n, k]) => `${n}: blob ${k.runder.map((r) => r.blob).join('')}, rs ${k.runder.map((r) => r.readyState).join('')}`))
paastaa('DOM-knuder staar stille fra runde 2 til 12, og JS-heapen vokser under 1 MB fra runde 2 til 12', KL.every(([, k]) => k.runder[11].knuder - k.runder[1].knuder <= 2 && k.runder[11].heapMB - k.runder[1].heapMB < 1), KL.map(([n, k]) => `${n}: knuder ${k.runder[1].knuder}->${k.runder[11].knuder}, heap ${k.runder[1].heapMB}->${k.runder[11].heapMB} MB`))
paastaa('klip efter klip: 0 netkald, 0 JS-fejl', KL.every(([, k]) => k.net === 0 && !k.fejl.length), KL.map(([n, k]) => ({ n, net: k.net, f: k.fejl })))

// --- 7) V7 igen: min VFR-MP4 i Chromium 151 og Chrome 154, med den nye maal-billede ---------------------
const CH151 = join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium-1234', 'chrome-win64', 'chrome.exe')
for (const [navn, sti] of [['Chrome 154', CHROME], ['Chromium 151', existsSync(CH151) ? CH151 : null]]) {
  if (!sti) { ud.v7[navn] = 'findes ikke'; continue }
  const b = sti === CHROME ? browser : await chromium.launch({ headless: true, executablePath: sti })
  const T = await side(b, 390, `/ny${V}/maal-billede/index.html`, b)
  await T.page.waitForSelector('[data-klar]')
  await T.page.setInputFiles('[data-videofil]', KLIP['sqvfr.mp4'])
  await T.page.waitForFunction(() => { const v = window.maalBillede.video; return v.readyState >= 2 && document.querySelector('[data-skyder]').max !== '0' && !v.seeking }, null, { timeout: 60000 })
  await rolig(T)
  const nr = [await T.page.evaluate(NUMMER, ['video', BITS])]
  for (let j = 0; j < 24; j++) { await tryk(T, '[data-frem]'); await rolig(T); await T.page.waitForTimeout(40); nr.push(await T.page.evaluate(NUMMER, ['video', BITS])) }
  ud.v7[navn] = { version: b.version(), nr, spring: nr.slice(1).map((n, i) => n - nr[i]).filter((d) => d !== 1).length }
  await T.ctx.close()
  if (b !== browser) await b.close()
}
paastaa('V7: i Chrome 154 er 24 tryk frem i min VFR-MP4 praecis 0-24 med den nye maal-billede; i Chromium 151 springer et tryk stadig (browserens afkoder, som i 582)', ud.v7['Chrome 154']?.spring === 0 && (typeof ud.v7['Chromium 151'] === 'string' || ud.v7['Chromium 151'].spring >= 1), { c154: ud.v7['Chrome 154']?.nr?.join(','), c151: ud.v7['Chromium 151']?.nr?.join?.(',') })

ud.eksterne = [...eksterne]
paastaa('alt, siderne proevede at hente udefra, er afbrudt og var kun skrifttypen', [...eksterne].every((u) => /fonts\.(googleapis|gstatic)\.com/.test(u)), [...eksterne])
await browser.close(); server.close()
writeFileSync(join(HERE, 'maal-598.json'), JSON.stringify({ ...ud, tjek }, null, 1))
const roede = tjek.filter((t) => !t.ok)
console.log(`\nmaal-598: ${tjek.length - roede.length}/${tjek.length} tjek groenne (${ud.chrome})`)
process.exit(roede.length ? 1 : 0)
