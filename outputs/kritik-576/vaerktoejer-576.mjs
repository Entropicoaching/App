// Kritik 576, blok 1: vaerktoejssiden efter Setus 570 (entropi-coaching-site-wt2, grenen `vaerktoejer`),
// holdt op mod loeftmodellens main (entropi-loeftmodel-dhruva) og mine domme fra 558 og 564.
//   node outputs/kritik-576/vaerktoejer-576.mjs     -> vaerktoejer-576.json og V-*.png
// Begge traeer hentes med `git archive` til en midlertidig mappe; ingen gren skiftes, intet trae roeres.
// 1) Kilden: de syv mapper blob for blob mod dist paa 37c9a27 (Setus kilde) og paa main. 2) noindex (meta, robots.txt, sitemap, links).
// 3) Teksten paa vaerktoejssiden (tankestreger, opfordringer, "fejl", navne, filmeguiden mod vejledningen).
// 4) Siden headless paa 360 og 390 med touch og 1280 med mus, alt net uden for den lokale server afbrudt:
//    alle sider, alle lokale links og billeder (404), "Ligner"/"Ligner ikke" paa modellens egne tegnede
//    stillinger (pinhole-kameraet fra main), seks punkter trykket med fingeren, og videoen med mine
//    syntetiske klip fra 564 (klip-564.mjs; intet klip i repoet).
// Atletnavne: fornavnene fra appens .gitignore, ikke skrevet ud.
import path, { join } from 'node:path'
import { tmpdir } from 'node:os'
import { writeFileSync, readFileSync, mkdtempSync, existsSync, statSync, mkdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { createServer } from 'node:http'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from '../../e2e/harness.mjs'
import { lavKlip, KLIP } from '../kritik-564/klip-564.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SITE = 'C:/Users/Entropi/Desktop/entropi-coaching-site-wt2'
const LM = 'C:/Users/Entropi/Desktop/entropi-loeftmodel-dhruva'
const GREN = 'refs/heads/vaerktoejer'
const MAPPER = ['maal-billede', 'loeft-fejl', 'squat-figurer', 'doedloeft-figurer', 'baenk-figurer', 'min-krop', 'tre-loeft']
const sh = (c) => execSync(c, { maxBuffer: 1 << 26 }).toString()
const top = sh(`git -C "${SITE}" rev-parse --short ${GREN}`).trim()
const KILDE = '37c9a27' // dhruva main, da Setu kopierede (570) og da kritikken begyndte
const lmTop = sh(`git -C "${LM}" rev-parse --short main`).trim()
const dir = mkdtempSync(join(tmpdir(), 'k576-'))
execSync(`git -C "${SITE}" archive -o "${join(dir, 'g.tar')}" ${GREN}`)
execSync('tar -xf g.tar', { cwd: dir })
const lm = join(dir, '_lm')
mkdirSync(lm)
execSync(`git -C "${LM}" archive -o "${join(lm, 'd.tar')}" ${KILDE} dist src kroppe package.json`)
execSync('tar -xf d.tar', { cwd: lm })
const V = '/assets/vaerktoejer'

const tjek = []
const paastaa = (hvad, ok, data) => { tjek.push({ hvad, ok: !!ok, data }); console.log(`${ok ? 'ok ' : 'NEJ'} ${hvad}${data !== undefined ? ' ' + JSON.stringify(data).slice(0, 500) : ''}`) }
const navne = [...new Set([...readFileSync(join(HERE, '..', '..', '.gitignore'), 'utf8').matchAll(/^supabase\/([a-z]+)-\*/gm)].map((m) => m[1]).filter((n) => n !== 'marc'))]
const udenNavne = (t) => navne.length > 0 && navne.every((n) => !new RegExp(`\\b${n}\\b`, 'i').test(t))
const tekstAf = (s) => s.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
const ud = { top, lmTop, kilde: {}, noindex: {}, tekst: {}, sider: [], links: {}, ligner: [], tryk: [], video: [] }

// --- 1) kilden: blob for blob -------------------------------------------------------------------
const blobs = (repo, ref, d) => Object.fromEntries(sh(`git -C "${repo}" ls-tree -r ${ref} -- ${d}/`).split('\n').filter(Boolean).map((l) => { const [meta, f] = l.split('\t'); return [f.slice(d.length + 1), meta.split(' ')[2]] }))
const sammenlign = (ref) => {
  const af = []
  for (const m of MAPPER) {
    const a = blobs(LM, ref, `dist/${m}`), b = blobs(SITE, GREN, `assets/vaerktoejer/${m}`)
    const alle = [...new Set([...Object.keys(a), ...Object.keys(b)])]
    const forskel = alle.filter((f) => a[f] !== b[f]).map((f) => ({ f: `${m}/${f}`, dist: a[f]?.slice(0, 7) || 'mangler', site: b[f]?.slice(0, 7) || 'mangler' }))
    if (ref === KILDE) ud.kilde[m] = { filer: Object.keys(a).length, ens: forskel.length === 0 }
    af.push(...forskel)
  }
  return af
}
const afvig = sammenlign(KILDE)
paastaa(`de syv mapper paa ${top} er blob for blob = dist paa ${KILDE} (Setus kilde, ${Object.values(ud.kilde).reduce((s, x) => s + x.filer, 0)} filer)`, afvig.length === 0, afvig)
const nyMain = sammenlign('main')
ud.kilde.main = { top: lmTop, afvig: nyMain, commits: sh(`git -C "${LM}" log --format=%h%x20%ci%x20%s ${KILDE}..main`).trim().split(/\r?\n/).filter(Boolean) }
paastaa(`W0: loeftmodellens main er flyttet til ${lmTop} under kritikken (Yantra 571, merget 03:52); ${nyMain.length} filer i maal-billede er nye paa main og ikke paa grenen`, lmTop !== KILDE && nyMain.length > 0 && nyMain.every((x) => x.f.startsWith('maal-billede/')), ud.kilde.main)
const distMapper = sh(`git -C "${LM}" ls-tree --name-only ${KILDE} dist/`).split('\n').filter(Boolean).map((f) => f.slice(5))
ud.kilde.ikkeKopieret = distMapper.filter((d) => !MAPPER.includes(d))
paastaa('det eneste i dist, der ikke er kopieret, er marcs-doedloeft og de loese artikel-scripts (ingen ny mappe paa main)', ud.kilde.ikkeKopieret.every((d) => d === 'marcs-doedloeft' || d.endsWith('.js')), ud.kilde.ikkeKopieret)
const sidstMain = sh(`git -C "${LM}" log -1 --format=%h%x20%cs ${KILDE} -- dist/maal-billede dist/loeft-fejl dist/min-krop dist/tre-loeft dist/squat-figurer dist/doedloeft-figurer dist/baenk-figurer`).trim()
ud.kilde.sidsteDistCommit = sidstMain

// --- 2) noindex --------------------------------------------------------------------------------
const vIdx = readFileSync(join(dir, 'vaerktoejer', 'index.html'), 'utf8')
const robots = readFileSync(join(dir, 'robots.txt'), 'utf8')
const sitemap = readFileSync(join(dir, 'sitemap.xml'), 'utf8')
const htmlFiler = sh(`git -C "${SITE}" ls-tree -r --name-only ${GREN}`).split('\n').filter((f) => f.endsWith('.html'))
const linkerTil = htmlFiler.filter((f) => !f.startsWith('vaerktoejer/') && !f.startsWith('assets/vaerktoejer/') && /href="[^"]*vaerktoejer/.test(readFileSync(join(dir, f), 'utf8')))
ud.noindex = { meta: /<meta name="robots" content="noindex, nofollow">/.test(vIdx), robots: /^Disallow: \/assets\/vaerktoejer\/$/m.test(robots), robotsSiden: /Disallow: \/vaerktoejer/.test(robots), sitemap: /vaerktoejer/.test(sitemap), linkerTil }
paastaa('stadig noindex: meta noindex, nofollow paa /vaerktoejer/, robots.txt udelukker /assets/vaerktoejer/, intet i sitemap, ingen side paa sitet linker til den', ud.noindex.meta && ud.noindex.robots && !ud.noindex.sitemap && linkerTil.length === 0, ud.noindex)

// --- 3) teksten over vaerktoejet ----------------------------------------------------------------
const main = vIdx.split(/<main\b/)[1]?.split(/<\/main>/)[0] || vIdx
const T = tekstAf('<main' + main)
const om = tekstAf(vIdx.match(/id="om-maal-billede"[\s\S]*?<\/p>/)?.[0] || '')
const maalDist = tekstAf(readFileSync(join(lm, 'dist', 'maal-billede', 'index.html'), 'utf8'))
const filmKlip = existsSync('C:/Users/Entropi/Desktop/FILM-KLIP.html') ? tekstAf(readFileSync('C:/Users/Entropi/Desktop/FILM-KLIP.html', 'utf8')) : ''
const saetninger = (t) => t.split(/(?<=[.!?])\s+(?=[A-ZÆØÅ"0-9])/).filter(Boolean)
ud.tekst = {
  om, omSaetninger: saetninger(om).length,
  tankestreger: (T.match(/[\u2013\u2014]/g) || []).length,
  udraab: (T.match(/!/g) || []).length,
  opfordring: T.match(/\b(prøv|kom i gang|ansøg|book|kontakt|skriv til|følg med|link i bio|tilmeld)\b/gi) || [],
  fejl: saetninger(T).filter((s) => /fejl/i.test(s)),
  holdning: T.match(/\b(jeg|mener|synes|anbefaler|bedst|vigtigst)\b/gi) || [],
  navne: !udenNavne(T),
  // Filmeguiden paa vaerktoejssiden holdt op mod vejledningen i Maal dit billede (dist paa main) og FILM-KLIP.html
  guide: {
    baenkPaaSiden: { side: /Til bænkpres lægges telefonen ned på siden/.test(T), vejledning: /hold telefonen lodret/.test(maalDist), filmKlip: /bænkens højde, på højkant/.test(filmKlip) },
    afstand: { side: (T.match(/Et par meter væk[^.]*\./) || [''])[0], vejledning: /Fra 3-4 m og zoomet ind er det fint/.test(maalDist) },
    maalestok: { side: /Skiven er målestokken/.test(T), vejledning: /Kroppens længder er målestokken, når du har skrevet atletens højde eller mål\. Skiven \(45 cm i diameter\) er en kontrol/.test(maalDist) },
    skaermbillede: { side: /Stop videoen i den fase, du vil måle, og tag et skærmbillede/.test(T), vejledning: /Har du en video, så tryk Vælg video/.test(maalDist) },
    kortetUdenVideo: /Læg et stillbillede fra siden ind, klik seks punkter/.test(T) && /Et stillbillede fra siden/.test(T),
    atletSaetning: (T.match(/Sætningen fra før og efter sendes kun til en atlet[^.]*\./) || [''])[0],
  },
}
paastaa('teksten over filmeguiden (#om-maal-billede): 3 saetninger, siger hvad den maaler, at videoen bliver paa telefonen, og at "fejl" kun er det, modellen viser', ud.tekst.omSaetninger === 3 && /måler ledvinklerne og stangens afstand til midtfoden/.test(om) && /bliver på telefonen/.test(om) && /kun det, modellen viser i billedet, og ikke en dom over løftet/.test(om), om)
paastaa('vaerktoejssidens main: 0 tankestreger, 0 udraabstegn, 0 opfordringer (Ansoeg staar kun i sitets menu), 0 holdningsord, 0 atletnavne', !ud.tekst.tankestreger && !ud.tekst.udraab && !ud.tekst.opfordring.length && !ud.tekst.holdning.length && !ud.tekst.navne, { opf: ud.tekst.opfordring, hold: ud.tekst.holdning })
paastaa('"fejl" bruges kun om det, modellen viser (eller om at et flyttet kamera flytter tallene)', ud.tekst.fejl.every((s) => /modellen|kamera|forkerte vinkler/.test(s)), ud.tekst.fejl)
// Fund, ikke krav: filmeguiden er aeldre end vejledningen (W1-W3).
paastaa('W1: filmeguiden siger "Til baenkpres laegges telefonen ned paa siden"; vejledningen siger lodret og FILM-KLIP "paa hoejkant"', ud.tekst.guide.baenkPaaSiden.side && ud.tekst.guide.baenkPaaSiden.vejledning && ud.tekst.guide.baenkPaaSiden.filmKlip, ud.tekst.guide.baenkPaaSiden)
paastaa('W2: filmeguiden siger "Skiven er maalestokken" og "et par meter vaek"; vejledningen siger kroppens laengder og 3-4 m', ud.tekst.guide.maalestok.side && ud.tekst.guide.maalestok.vejledning && /Et par meter/.test(ud.tekst.guide.afstand.side) && ud.tekst.guide.afstand.vejledning, ud.tekst.guide.afstand)
paastaa('W3: filmeguiden siger "tag et skaermbillede", og kortet naevner kun stillbilleder, selv om siden nu aabner videoen', ud.tekst.guide.skaermbillede.side && ud.tekst.guide.skaermbillede.vejledning && ud.tekst.guide.kortetUdenVideo)

// --- 4) i browseren ------------------------------------------------------------------------------
const typer = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.json': 'application/json', '.ico': 'image/x-icon', '.woff2': 'font/woff2' }
const status = new Map()
const server = createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0].split('#')[0])
  let f = join(dir, u)
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html')
  if (!existsSync(f)) { status.set(u, 404); res.writeHead(404); return res.end() }
  if (!status.has(u)) status.set(u, 200)
  res.writeHead(200, { 'content-type': typer[path.extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f))
}).listen(0)
const BASE = `http://127.0.0.1:${server.address().port}`
const browser = await chromium.launch({ headless: true })
const eksterne = new Set()
async function side(bredde, url) {
  const mobil = bredde < 500
  const ctx = await browser.newContext({ viewport: { width: bredde, height: mobil ? 780 : 900 }, deviceScaleFactor: mobil ? 3 : 1, isMobile: mobil, hasTouch: mobil })
  const page = await ctx.newPage()
  const S = { ctx, page, mobil, bredde, fejl: [], konsol: [] }
  page.on('pageerror', (e) => S.fejl.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') S.konsol.push(m.text().slice(0, 160)) })
  await page.route('**/*', (r) => { const u = r.request().url(); if (u.startsWith(BASE) || /^(data|blob):/.test(u)) return r.continue(); eksterne.add(u.split('?')[0]); return r.abort() })
  await page.goto(BASE + url, { waitUntil: 'load' })
  await page.waitForTimeout(250)
  return S
}
const SIDER = ['/vaerktoejer/', `${V}/maal-billede/index.html`, `${V}/min-krop/index.html`, `${V}/min-krop/kort.html`, `${V}/min-krop/mit-kort.html`, `${V}/tre-loeft/index.html`, `${V}/tre-loeft/indlejret.html`, `${V}/loeft-fejl/index.html`, `${V}/squat-figurer/k7-kun-knae-bund.svg`, `${V}/doedloeft-figurer/index.html`, `${V}/baenk-figurer/index.html`]
const alleLinks = new Set()
for (const bredde of [360, 390, 1280]) {
  for (const url of SIDER) {
    const S = await side(bredde, url)
    const m = await S.page.evaluate(() => {
      document.querySelectorAll('details').forEach((d) => { d.open = true })
      const img = [...document.images]
      return {
        sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
        links: [...document.querySelectorAll('a[href],img[src],object[data],iframe[src],link[href],script[src]')].map((e) => e.href?.baseVal ?? e.href ?? e.src ?? e.data).filter((x) => typeof x === 'string'),
        brudte: img.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src), billeder: img.length,
        tekst: document.body?.innerText || '', robots: document.querySelector('meta[name=robots]')?.content || null,
      }
    })
    for (const l of m.links) if (l.startsWith(BASE)) alleLinks.add(l.split('#')[0])
    const r = { url, bredde, vandret: m.sw - m.cw, fejl: S.fejl, konsol: S.konsol, brudte: m.brudte, billeder: m.billeder, tankestreger: (m.tekst.match(/[\u2013\u2014]/g) || []).length, navne: !udenNavne(m.tekst), robots: m.robots }
    ud.sider.push(r)
    if (url === '/vaerktoejer/') await S.page.screenshot({ path: join(HERE, `V-${bredde}-vaerktoejer.png`), fullPage: true })
    await S.ctx.close()
  }
}
// Hvert lokalt link og billede hentet (ogsaa dem, siderne kun linker til)
for (const l of alleLinks) { const r = await fetch(l); ud.links[l.slice(BASE.length)] = r.status }
const s404 = [...status.entries()].filter(([, s]) => s === 404).map(([u]) => u)
const sideFejl = ud.sider.filter((s) => s.vandret > 0 || s.fejl.length || s.brudte.length || s.navne)
paastaa(`${SIDER.length} sider x 3 bredder: 0 sidelaens rulning, 0 JS-fejl, 0 brudte billeder, 0 atletnavne`, sideFejl.length === 0, sideFejl.map((s) => ({ url: s.url, b: s.bredde, v: s.vandret, f: s.fejl, br: s.brudte })))
paastaa(`${Object.keys(ud.links).length} lokale links og filer fulgt: 0 fejl 404 (ud over browserens egen /favicon.ico)`, Object.values(ud.links).every((s) => s === 200) && s404.every((u) => u === '/favicon.ico'), { s404, links: Object.entries(ud.links).filter(([, s]) => s !== 200) })

// --- "Ligner" / "Ligner ikke" paa modellens egne tegnede stillinger ------------------------------
const imp = (f) => import(pathToFileURL(join(lm, 'src', f)).href)
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
const bryst = (bue) => baenkBilleder(K, bue).normal['baenk-bryst'].find((x) => x.navn === 'modellens bryst')
const kamB = KAMERAER_BAENK.find((k) => k.id === 'baenkhoejde')
const TILF = [
  { id: 'sq-bund-model', fase: 'squat-bund', sumo: false, kg: 140, klik: sqKlik(sq.normal['squat-bund'][0]), forvent: 'ingen' },
  { id: 'sq-bund-kun-knae', fase: 'squat-bund', sumo: false, kg: 140, klik: sqKlik(sq.fejl['sq-kun-knae-bund'][0]), forvent: 'ligner' },
  { id: 'sq-bund-hofte-tilbage', fase: 'squat-bund', sumo: false, kg: 140, klik: sqKlik(sq.fejl['sq-hofte-tilbage-bund'][0]), forvent: 'ligner' },
  { id: 'sq-midt-model', fase: 'squat-midt', sumo: false, kg: 140, klik: sqKlik(sq.normal['squat-midt'][0]), forvent: 'ingen' },
  { id: 'sq-midt-kun-knae', fase: 'squat-midt', sumo: false, kg: 140, klik: sqKlik(sq.fejl['sq-kun-knae-midt'][0]), forvent: 'ligner' },
  { id: 'dl-gulv-model', fase: 'dl-gulv', sumo: false, kg: 200, klik: dlKlik(konv.normal['dl-gulv'][0]), forvent: 'ingen' },
  { id: 'dl-hofte-foerst', fase: 'dl-gulv', sumo: false, kg: 200, klik: dlKlik(konv.fejl['dl-hofte-foerst'][0]), forvent: 'ligner' },
  { id: 'dl-knae-model', fase: 'dl-knae', sumo: false, kg: 200, klik: dlKlik(konv.normal['dl-knae'][0]), forvent: 'ingen' },
  { id: 'dl-stang-frem', fase: 'dl-knae', sumo: false, kg: 200, klik: dlKlik(konv.fejl['dl-stang-frem'][0]), forvent: 'ligner' },
  { id: 'sumo-knae-model', fase: 'dl-knae', sumo: true, kg: 200, klik: dlKlik(sumo.normal['dl-knae'].find((x) => x.navn === 'knæhøjde 0 cm') || sumo.normal['dl-knae'][0]), forvent: 'ingen' },
  { id: 'sumo-stang-frem', fase: 'dl-knae', sumo: true, kg: 200, klik: dlKlik(sumo.fejl['dl-stang-frem'][0]), forvent: 'ligner' },
  { id: 'bp-bryst-model', fase: 'baenk-bryst', sumo: false, kg: 100, klik: tilKlik(bryst(0).Q, bryst(0).P, kamB, 'baenk', 700), forvent: 'ingen' },
  { id: 'bp-bue-75', fase: 'baenk-bryst', sumo: false, kg: 100, klik: tilKlik(bryst(7.5).Q, bryst(7.5).P, kamB, 'baenk', 700), forvent: 'usikker-fase' },
]
if (baenkBilleder(K, 0).fejl?.['bp-hoejt-bryst']?.[0]) { const b = baenkBilleder(K, 0).fejl['bp-hoejt-bryst'][0]; TILF.push({ id: 'bp-hoejt-bryst', fase: 'baenk-bryst', sumo: false, kg: 100, klik: tilKlik(b.Q, b.P, kamB, 'baenk', 700), forvent: 'ligner' }) }
const LIGNER = async (t) => {
  const k = document.createElement('canvas'); k.width = 900; k.height = 1200
  const x = k.getContext('2d'); x.fillStyle = '#34373d'; x.fillRect(0, 0, 900, 1200)
  await window.maalBillede.laesBillede(k.toDataURL('image/png'), `syntetisk-${t.id}.png`)
  window.maalBillede.saetKrop({ hoejde: '183', vaegt: '120' })
  window.maalBillede.saetStangKg?.(t.kg)
  window.maalBillede.saetFase(t.fase)
  window.maalBillede.saetSumo(t.sumo)
  window.maalBillede.saetPunkter(t.klik)
  await new Promise((ok) => requestAnimationFrame(() => setTimeout(ok, 300)))
  const e = document.querySelector('[data-ligner]'), b = e.getBoundingClientRect()
  return { status: e.dataset.status, fejl: e.dataset.fejl || null, tekst: e.textContent.replace(/\s+/g, ' ').trim(), synlig: !e.hidden && b.height > 0, hoejre: Math.round(b.right), hoejde: Math.round(b.height), links: [...e.querySelectorAll('a[href],img[src]')].map((a) => a.href || a.src) }
}
for (const bredde of [360, 390, 1280]) {
  for (const t of TILF) {
    const S = await side(bredde, `${V}/maal-billede/index.html`)
    await S.page.waitForSelector('[data-klar]')
    const r = await S.page.evaluate(LIGNER, t)
    const linkStatus = []
    for (const l of r.links) { const u = new URL(l); const s = (await fetch(BASE + u.pathname)).status; let anker = true; if (u.hash && s === 200 && u.pathname.endsWith('.html')) anker = readFileSync(join(dir, decodeURIComponent(u.pathname)), 'utf8').includes(`id="${u.hash.slice(1)}"`); linkStatus.push({ l: u.pathname + u.hash, s, anker }) }
    ud.ligner.push({ ...t, klik: undefined, bredde, ...r, ord: r.tekst.split(/\s+/).filter(Boolean).length, linkStatus, vandret: await S.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), jsFejl: S.fejl })
    if (bredde === 390 && ['sq-bund-kun-knae', 'sq-bund-model', 'dl-stang-frem'].includes(t.id)) { await S.page.locator('[data-ligner]').scrollIntoViewIfNeeded(); await S.page.screenshot({ path: join(HERE, `V-390-ligner-${t.id}.png`) }) }
    await S.ctx.close()
  }
}
const L = ud.ligner
const lAfvig = L.filter((r) => r.status !== r.forvent || !r.synlig || r.hoejre > r.bredde || r.vandret > 0 || r.jsFejl.length)
paastaa(`${TILF.length} tilfaelde x 3 bredder: linjen giver det, modellen tegnede (Ligner ved fejlfiguren, Ligner ikke ved modellens egen stilling, ikke tjekket ved stor bue), synlig og inden for skaermen`, lAfvig.length === 0, lAfvig.map((r) => ({ id: r.id, b: r.bredde, st: r.status, forvent: r.forvent, t: r.tekst.slice(0, 90) })))
const ingen = L.filter((r) => r.status === 'ingen')
paastaa('"Ligner ikke"-linjen: navngiver det tjekkede, "Det udelukker ikke fejlen", "Andre fejl tjekker siden ikke", hoejst 50 ord, ingen parentes', ingen.length > 0 && ingen.every((r) => /^Ligner ikke "/.test(r.tekst) && /Det udelukker ikke fejlen/.test(r.tekst) && /Andre fejl tjekker siden ikke/.test(r.tekst) && r.ord <= 50 && !/[()]/.test(r.tekst)), ingen.filter((r) => r.bredde === 390).map((r) => `${r.id}: ${r.ord} ord`))
const lig = L.filter((r) => r.status === 'ligner')
paastaa('"Ligner"-linjen naevner fejlen og har et link til fejlfiguren; alle fejlfigur-links giver 200 og ankeret findes (0 fejl 404)', lig.length > 0 && lig.every((r) => /^Ligner/.test(r.tekst) && r.linkStatus.length > 0) && L.every((r) => r.linkStatus.every((x) => x.s === 200 && x.anker)), lig.filter((r) => r.bredde === 390).map((r) => ({ id: r.id, links: r.linkStatus.map((x) => x.l) })))
paastaa('ingen linje siger "uden fejl", "korrekt" eller "god teknik"', L.every((r) => !/uden fejl"?\.?$|\bkorrekt\b|god teknik|perfekt/i.test(r.tekst.replace(/betyder ikke "uden fejl"/, ''))))

const lang = L.filter((r) => r.bredde === 390 && r.status === 'ligner').map((r) => ({ id: r.id, ord: r.ord, px: r.hoejde, skaerme: Math.round((r.hoejde / 780) * 10) / 10 }))
ud.lignerLaengde = lang
paastaa('W4: "Ligner"-linjerne er 42-195 ord; paa 390 fylder de laengste over en skaerm (L10 graensede kun "Ligner ikke")', lang.some((r) => r.ord > 100 && r.skaerme >= 1), lang)
const bundt = readFileSync(join(dir, 'assets/vaerktoejer/maal-billede/maal-billede.js'), 'utf8')
paastaa('W5: stavefejl "fejlfigurenerne" i baenkens Ligner-link (teksten bygges i bundtet = dist)', L.some((r) => /fejlfigurenerne/.test(r.tekst)))
paastaa('W6: baenkens Ligner-linje siger "Klik skulderleddet, ikke knoglespidsen"; vejledningens klikliste siger knoglespidsen (acromion), "ikke midt i leddet", samme punkt som i Min krop', L.some((r) => /Klik skulderleddet, ikke knoglespidsen/.test(r.tekst)) && /skulderens yderste knoglespids \(acromion\), toppen af skulderen, ikke midt i leddet/.test(maalDist))

// --- de seks punkter trykket med fingeren (390) og musen (1280) ---------------------------------
for (const bredde of [390, 1280]) {
  const S = await side(bredde, `${V}/maal-billede/index.html`)
  await S.page.waitForSelector('[data-klar]')
  const t = TILF.find((x) => x.id === 'sq-bund-kun-knae')
  await S.page.evaluate(async (t) => {
    const k = document.createElement('canvas'); k.width = 900; k.height = 1200
    const x = k.getContext('2d'); x.fillStyle = '#34373d'; x.fillRect(0, 0, 900, 1200)
    await window.maalBillede.laesBillede(k.toDataURL('image/png'), 'syntetisk-tryk.png')
    window.maalBillede.saetKrop({ hoejde: '183', vaegt: '120' }); window.maalBillede.saetFase(t.fase)
  }, t)
  const IDS = ['stang', 'midtfod', 'ankel', 'knae', 'hofte', 'skulder']
  const flade = await S.page.evaluate(() => { const e = document.querySelector('[data-klikker]') || document.querySelector('[data-billede]'); const r = e.getBoundingClientRect(); return { sel: e.dataset.klikker !== undefined ? '[data-klikker]' : '[data-billede]', w: e.width || r.width } })
  for (const id of IDS) {
    await S.page.locator(flade.sel).scrollIntoViewIfNeeded()
    const p = await S.page.evaluate(([sel, q]) => { const e = document.querySelector(sel), r = e.getBoundingClientRect(), b = window.maalBillede.tilstand().billede; const bw = b.naturalWidth || b.width, bh = b.naturalHeight || b.height; const d = Math.min(r.width / bw, r.height / bh); const ox = (r.width - bw * d) / 2, oy = (r.height - bh * d) / 2; return { x: r.left + ox + q.x * d, y: r.top + oy + q.y * d, inde: r.top + oy + q.y * d < innerHeight } }, [flade.sel, t.klik[id]])
    if (!p.inde) { await S.page.evaluate((dy) => window.scrollBy(0, dy), p.y - 300); }
    const p2 = await S.page.evaluate(([sel, q]) => { const e = document.querySelector(sel), r = e.getBoundingClientRect(), b = window.maalBillede.tilstand().billede; const bw = b.naturalWidth || b.width, bh = b.naturalHeight || b.height; const d = Math.min(r.width / bw, r.height / bh); const ox = (r.width - bw * d) / 2, oy = (r.height - bh * d) / 2; return { x: r.left + ox + q.x * d, y: r.top + oy + q.y * d } }, [flade.sel, t.klik[id]])
    if (S.mobil) await S.page.touchscreen.tap(p2.x, p2.y); else await S.page.mouse.click(p2.x, p2.y)
    await S.page.waitForTimeout(120)
  }
  await S.page.waitForTimeout(300)
  const r = await S.page.evaluate(() => { const e = document.querySelector('[data-ligner]'); const p = window.maalBillede.tilstand().punkter || {}; return { status: e.dataset.status, tekst: e.textContent.replace(/\s+/g, ' ').trim(), n: Object.keys(p).length, punkter: p } })
  const afst = Math.max(...IDS.map((id) => r.punkter[id] ? Math.hypot(r.punkter[id].x - t.klik[id].x, r.punkter[id].y - t.klik[id].y) : 999))
  ud.tryk.push({ bredde, status: r.status, tekst: r.tekst.slice(0, 120), n: r.n, maksAfstandPx: Math.round(afst * 10) / 10, fejl: S.fejl })
  if (bredde === 390) { await S.page.locator('[data-ligner]').scrollIntoViewIfNeeded(); await S.page.screenshot({ path: join(HERE, 'V-390-tryk-seks-punkter.png') }) }
  await S.ctx.close()
}
paastaa('seks punkter trykket med fingeren (390) og musen (1280) paa "kun knaeene" i bunden: 6 punkter sat inden for 3 billedpixel af tegningen, og linjen siger Ligner', ud.tryk.every((r) => r.n >= 6 && r.maksAfstandPx <= 3 && r.status === 'ligner' && !r.fejl.length), ud.tryk)

// --- videoen: mine syntetiske klip fra 564 --------------------------------------------------------
await lavKlip()
const ulaeselig = join(KLIP, 'ulaeselig-576.mp4')
if (!existsSync(ulaeselig)) { const b = Buffer.alloc(2e6); let z = 576; for (let i = 0; i < b.length; i++) { z = (z * 1103515245 + 12345) >>> 0; b[i] = z >>> 24 } writeFileSync(ulaeselig, b) }
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
const vent = (S, f, arg, ms = 60000) => S.page.waitForFunction(f, arg, { timeout: ms }).then(() => true, () => false)
async function tryk(S, sel) { const l = S.page.locator(sel); await l.scrollIntoViewIfNeeded(); if (S.mobil) await l.tap(); else await l.click() }
for (const bredde of [360, 390, 1280]) {
  const S = await side(bredde, `${V}/maal-billede/index.html`)
  await S.page.waitForSelector('[data-klar]')
  const efterHentet = eksterne.size
  const r = { bredde }
  let t0 = Date.now()
  await S.page.setInputFiles('[data-videofil]', join(KLIP, 'sq30.mp4'))
  r.aabnet = await vent(S, () => { const v = window.maalBillede.video; return v.readyState >= 2 && document.querySelector('[data-skyder]').max !== '0' && !v.seeking })
  r.aabnMs = Date.now() - t0
  r.tilbageSlaaetFra = await S.page.evaluate(() => document.querySelector('[data-tilbage]').disabled)
  r.nr0 = await S.page.evaluate(NUMMER, 'video')
  // V4: foerste tryk fra 0 s flytter eet billede
  await tryk(S, '[data-frem]')
  await vent(S, () => !window.maalBillede.video.seeking && window.maalBillede.video.currentTime > 0.001, null, 10000)
  await S.page.waitForTimeout(150)
  r.nr1 = await S.page.evaluate(NUMMER, 'video')
  for (let i = 0; i < 3; i++) { await tryk(S, '[data-frem]'); await vent(S, () => !window.maalBillede.video.seeking, null, 10000); await S.page.waitForTimeout(100) }
  r.nr4 = await S.page.evaluate(NUMMER, 'video')
  await tryk(S, '[data-tilbage]'); await vent(S, () => !window.maalBillede.video.seeking, null, 10000); await S.page.waitForTimeout(120)
  r.nr3 = await S.page.evaluate(NUMMER, 'video')
  // "Brug dette billede" ved 13,2 s: fotoet er det viste billede
  await S.page.evaluate(() => window.maalBillede.saetVideoTid(13.2))
  await vent(S, () => !window.maalBillede.video.seeking && Math.abs(window.maalBillede.video.currentTime - 13.2) < 0.05, null, 10000)
  await S.page.waitForTimeout(150)
  r.vist = await S.page.evaluate(NUMMER, 'video')
  t0 = Date.now()
  await tryk(S, '[data-brug]')
  await vent(S, () => !!window.maalBillede.tilstand().billede, null, 10000)
  r.brugMs = Date.now() - t0
  await S.page.waitForTimeout(150)
  r.foto = await S.page.evaluate(NUMMER, 'foto')
  r.tekstVideo = await S.page.evaluate(() => document.querySelector('[data-videoboks]')?.innerText.replace(/\s+/g, ' ').slice(0, 600))
  r.vandret = await S.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  if (bredde === 390) { await S.page.locator('[data-videoboks]').scrollIntoViewIfNeeded(); await S.page.screenshot({ path: join(HERE, 'V-390-video.png') }) }
  // V2: et klip, browseren ikke kan laese (tilfaeldige bytes og HEVC)
  for (const [navn, fil] of [['ulaeselig', ulaeselig], ['hevc', join(KLIP, 'sq30-hevc.mp4')]]) {
    t0 = Date.now()
    await S.page.setInputFiles('[data-videofil]', fil)
    const ok = await vent(S, () => /kunne ikke læses/.test(document.querySelector('[data-videonavn]').textContent) || (window.maalBillede.video.readyState >= 2 && !window.maalBillede.video.seeking && document.querySelector('[data-skyder]').max !== '0'), null, 30000)
    r[navn] = { ok, ms: Date.now() - t0, besked: await S.page.evaluate(() => document.querySelector('[data-videonavn]').textContent.replace(/\s+/g, ' ').slice(0, 200)) }
  }
  r.eksterneEfter = eksterne.size - efterHentet
  r.fejl = S.fejl
  ud.video.push(r)
  await S.ctx.close()
}
const VD = ud.video
paastaa('videoen aabnes paa 360, 390 og 1280; tilbage er slaaet fra ved 0 s', VD.every((r) => r.aabnet && r.tilbageSlaaetFra && r.nr0 === 0), VD.map((r) => ({ b: r.bredde, ms: r.aabnMs, nr0: r.nr0 })))
paastaa('V4 lukket: foerste tryk fra 0 s flytter eet billede; 3 tryk mere giver billede 4, eet tilbage billede 3', VD.every((r) => r.nr1 === 1 && r.nr4 === 4 && r.nr3 === 3), VD.map((r) => [r.nr1, r.nr4, r.nr3]))
paastaa('"Brug dette billede" laegger praecis det viste billede i klik-trinnet', VD.every((r) => r.vist !== null && r.foto === r.vist), VD.map((r) => ({ b: r.bredde, vist: r.vist, foto: r.foto, ms: r.brugMs })))
paastaa('V2 lukket: et klip, browseren ikke kan laese, giver beskeden paa under 2 s (tilfaeldige bytes og HEVC i headless Chromium)', VD.every((r) => r.ulaeselig.ok && /kunne ikke læses/.test(r.ulaeselig.besked) && r.ulaeselig.ms < 2000 && r.hevc.ok && (/kunne ikke læses/.test(r.hevc.besked) ? r.hevc.ms < 2000 : true)), VD.map((r) => ({ b: r.bredde, u: r.ulaeselig.ms, hevc: r.hevc.ms, hevcBesked: r.hevc.besked.slice(0, 60) })))
paastaa('V1 og V5: "et par billeder til begge sider" staar, "brug skyderen" er vaek (vejledningen og bundtet)', /Tjek derfor et par billeder til begge sider/.test(maalDist) && !/brug skyderen/i.test(maalDist + readFileSync(join(dir, 'assets/vaerktoejer/maal-billede/maal-billede.js'), 'utf8')))
paastaa('videoen: 0 kald ud af huset, 0 JS-fejl, 0 sidelaens rulning', VD.every((r) => r.eksterneEfter === 0 && !r.fejl.length && r.vandret <= 0), VD.map((r) => ({ b: r.bredde, net: r.eksterneEfter, f: r.fejl })))
ud.eksterne = [...eksterne]
paastaa('alt, siderne proevede at hente udefra, er afbrudt og var kun skrifttypen', [...eksterne].every((u) => /fonts\.(googleapis|gstatic)\.com/.test(u)), [...eksterne])

await browser.close(); server.close()
writeFileSync(join(HERE, 'vaerktoejer-576.json'), JSON.stringify({ ...ud, tjek }, null, 1))
const roede = tjek.filter((t) => !t.ok)
console.log(`\nvaerktoejer-576: ${tjek.length - roede.length}/${tjek.length} tjek groenne`)
process.exit(roede.length ? 1 : 0)
