// Kritik 585, blok 1: vaerktoejssiden efter Setus 579 og 584 (entropi-coaching-site-wt2, grenen `vaerktoejer`,
// nyeste commit), holdt op mod loeftmodellens main (entropi-loeftmodel-dhruva) og mine fund W0-W6 fra 576.
//   node outputs/kritik-585/vaerktoejer-585.mjs     -> vaerktoejer-585.json og V-*.png
// Begge traeer hentes med `git archive` til en midlertidig mappe; ingen gren skiftes, intet trae roeres.
// 1) W0: de syv mapper blob for blob mod dist paa dhruva main. 2) noindex (meta, robots.txt, sitemap, links).
// 3) W1-W3: filmeguiden saetning for saetning mod vejledningen i Maal dit billede (main) og FILM-KLIP.html.
// 4) Siden headless i Google Chrome (den installerede) paa 360 og 390 med touch og 1280 med mus, alt net uden
//    for den lokale server afbrudt: alle sider og lokale links (404), "Ligner"/"Ligner ikke" paa modellens egne
//    tegnede stillinger (pinhole-kameraet fra main) med W4-W6, seks punkter trykket med fingeren, og videoen
//    med mine syntetiske klip fra 582 (klip-582.mjs; intet klip i repoet).
// Atletnavne: fornavnene fra appens .gitignore, ikke skrevet ud.
import path, { join } from 'node:path'
import { tmpdir } from 'node:os'
import { writeFileSync, readFileSync, mkdtempSync, existsSync, statSync, mkdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { createServer } from 'node:http'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from '../../e2e/harness.mjs'
import { lavKlip, BITS } from '../kritik-582/klip-582.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SITE = 'C:/Users/Entropi/Desktop/entropi-coaching-site-wt2'
const LM = 'C:/Users/Entropi/Desktop/entropi-loeftmodel-dhruva'
const GREN = 'refs/heads/vaerktoejer'
const MAPPER = ['maal-billede', 'loeft-fejl', 'squat-figurer', 'doedloeft-figurer', 'baenk-figurer', 'min-krop', 'tre-loeft']
const sh = (c) => execSync(c, { maxBuffer: 1 << 26 }).toString()
const top = sh(`git -C "${SITE}" rev-parse --short ${GREN}`).trim()
const lmTop = sh(`git -C "${LM}" rev-parse --short main`).trim()
const dir = mkdtempSync(join(tmpdir(), 'k585-'))
execSync(`git -C "${SITE}" archive -o "${join(dir, 'g.tar')}" ${GREN}`)
execSync('tar -xf g.tar', { cwd: dir })
const lm = join(dir, '_lm')
mkdirSync(lm)
execSync(`git -C "${LM}" archive -o "${join(lm, 'd.tar')}" main dist src kroppe package.json`)
execSync('tar -xf d.tar', { cwd: lm })
const V = '/assets/vaerktoejer'

const tjek = []
const paastaa = (hvad, ok, data) => { tjek.push({ hvad, ok: !!ok, data }); console.log(`${ok ? 'ok ' : 'NEJ'} ${hvad}${data !== undefined ? ' ' + JSON.stringify(data).slice(0, 500) : ''}`) }
const navne = [...new Set([...readFileSync(join(HERE, '..', '..', '.gitignore'), 'utf8').matchAll(/^supabase\/([a-z]+)-\*/gm)].map((m) => m[1]).filter((n) => n !== 'marc'))]
const udenNavne = (t) => navne.length > 0 && navne.every((n) => !new RegExp(`\\b${n}\\b`, 'i').test(t))
const tekstAf = (s) => s.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
const ud = { top, lmTop, log: sh(`git -C "${SITE}" log --format=%h%x20%ci%x20%s -4 ${GREN}`).trim().split(/\r?\n/), kilde: {}, noindex: {}, tekst: {}, sider: [], links: {}, ligner: [], tryk: [], video: [] }

// --- 1) W0: kilden blob for blob ----------------------------------------------------------------
const blobs = (repo, ref, d) => Object.fromEntries(sh(`git -C "${repo}" ls-tree -r ${ref} -- ${d}/`).split('\n').filter(Boolean).map((l) => { const [meta, f] = l.split('\t'); return [f.slice(d.length + 1), meta.split(' ')[2]] }))
const forskel = []
for (const m of MAPPER) {
  const a = blobs(LM, 'main', `dist/${m}`), b = blobs(SITE, GREN, `assets/vaerktoejer/${m}`)
  const alle = [...new Set([...Object.keys(a), ...Object.keys(b)])]
  const af = alle.filter((f) => a[f] !== b[f]).map((f) => ({ f: `${m}/${f}`, main: a[f]?.slice(0, 7) || 'mangler', site: b[f]?.slice(0, 7) || 'mangler' }))
  ud.kilde[m] = { filer: Object.keys(a).length, ens: af.length === 0 }
  forskel.push(...af)
}
ud.kilde.forskel = forskel
ud.kilde.filer = MAPPER.reduce((s, m) => s + ud.kilde[m].filer, 0)
paastaa(`W0 lukket: maal-billede paa ${top} er blob for blob = dist paa dhruva main ${lmTop} (index.html og maal-billede.js)`, ud.kilde['maal-billede'].ens, ud.kilde['maal-billede'])
// Min krop og De tre loeft: Setu 584 kopierede dem ikke. Hvad er forskellen?
const kunUbrugt = forskel.filter((x) => !x.f.startsWith('maal-billede/')).map((x) => {
  const f = `dist/${x.f}`
  const a = sh(`git -C "${LM}" show 37c9a27:${f}`), b = sh(`git -C "${LM}" show main:${f}`)
  const ord = (s) => s.split(/[^A-Za-z0-9_$]+/).filter((w) => w.length > 3)
  const ta = new Map(); for (const w of ord(a)) ta.set(w, (ta.get(w) || 0) + 1)
  const nye = []; const tb = new Map(); for (const w of ord(b)) tb.set(w, (tb.get(w) || 0) + 1)
  for (const [w, n] of tb) if (n > (ta.get(w) || 0)) nye.push(w)
  const siteBlob = sh(`git -C "${SITE}" rev-parse ${GREN}:assets/vaerktoejer/${x.f}`).trim().slice(0, 7)
  const gammelBlob = sh(`git -C "${LM}" rev-parse 37c9a27:${f}`).trim().slice(0, 7)
  return { ...x, siteEr37c9a27: siteBlob === gammelBlob, nyeOrd: nye, hjaelpBaenkLaest: (b.match(/hjaelpBaenk/g) || []).length > 1 }
})
ud.kilde.minKropTreLoeft = kunUbrugt
paastaa('W7 (lav): min-krop.js og tre-loeft.js paa sitet er 37c9a27-udgaven; main har kun faaet baenkens skulder-hjaelp (hjaelpBaenk) med i bundtet, og den laeses ikke dér', kunUbrugt.length === 2 && kunUbrugt.every((x) => x.siteEr37c9a27 && !x.hjaelpBaenkLaest && x.nyeOrd.includes('hjaelpBaenk')) && forskel.every((x) => x.f.startsWith('maal-billede/') ? false : true), kunUbrugt.map((x) => ({ f: x.f, nye: x.nyeOrd.slice(0, 20) })))
paastaa(`de fem andre mapper (fejlsiden og figurerne) er blob for blob = main`, ['loeft-fejl', 'squat-figurer', 'doedloeft-figurer', 'baenk-figurer'].every((m) => ud.kilde[m].ens))

// --- 2) noindex --------------------------------------------------------------------------------
const vIdx = readFileSync(join(dir, 'vaerktoejer', 'index.html'), 'utf8')
const robots = readFileSync(join(dir, 'robots.txt'), 'utf8')
const sitemap = readFileSync(join(dir, 'sitemap.xml'), 'utf8')
const htmlFiler = sh(`git -C "${SITE}" ls-tree -r --name-only ${GREN}`).split('\n').filter((f) => f.endsWith('.html'))
const linkerTil = htmlFiler.filter((f) => !f.startsWith('vaerktoejer/') && !f.startsWith('assets/vaerktoejer/') && /href="[^"]*vaerktoejer/.test(readFileSync(join(dir, f), 'utf8')))
ud.noindex = { meta: /<meta name="robots" content="noindex, nofollow">/.test(vIdx), robots: /^Disallow: \/assets\/vaerktoejer\/$/m.test(robots), sitemap: /vaerktoejer/.test(sitemap), linkerTil, nofollow: (vIdx.match(/href="\.\.\/assets\/vaerktoejer[^"]*"[^>]*/g) || []).every((a) => /rel="nofollow"/.test(a)) }
paastaa('stadig noindex: meta noindex, nofollow paa /vaerktoejer/, robots.txt udelukker /assets/vaerktoejer/, intet i sitemap, ingen side paa sitet linker til den, alle links til vaerktoejerne rel="nofollow"', ud.noindex.meta && ud.noindex.robots && !ud.noindex.sitemap && linkerTil.length === 0 && ud.noindex.nofollow, ud.noindex)

// --- 3) W1-W3: filmeguiden mod vejledningen -------------------------------------------------------
const main = vIdx.split(/<main\b/)[1]?.split(/<\/main>/)[0] || vIdx
const T = tekstAf('<main' + main)
const guide = tekstAf(vIdx.match(/<section[^>]*id="filmeguide"[\s\S]*?<\/section>/)?.[0] || main)
const vej = tekstAf(readFileSync(join(lm, 'dist', 'maal-billede', 'index.html'), 'utf8'))
const filmKlip = existsSync('C:/Users/Entropi/Desktop/FILM-KLIP.html') ? tekstAf(readFileSync('C:/Users/Entropi/Desktop/FILM-KLIP.html', 'utf8')) : ''
const saetninger = (t) => t.split(/(?<=[.!?])\s+(?=[A-ZÆØÅ"0-9])/).filter(Boolean)
ud.tekst = {
  guideSaetninger: saetninger(guide).length,
  tankestreger: (T.match(/[\u2013\u2014]/g) || []).length,
  udraab: (T.match(/!/g) || []).length,
  opfordring: T.match(/\b(prøv|kom i gang|ansøg|book|kontakt|skriv til|følg med|link i bio|tilmeld)\b/gi) || [],
  holdning: T.match(/\b(jeg|mener|synes|anbefaler|bedst|vigtigst)\b/gi) || [],
  navne: !udenNavne(T),
  fejl: saetninger(T).filter((s) => /fejl/i.test(s)),
}
// Hver paastand i filmeguiden (01-05, videoen, foer og efter) med sin kilde. ordret = saetningen staar i vejledningen.
const G = [
  { id: 'W1 baenk lodret', side: /hold telefonen lodret, også til bænkpres/, kilde: /hold telefonen lodret/.test(vej) && /bænkens højde, på højkant/.test(filmKlip), gammel: /lægges telefonen ned på siden/ },
  { id: '02 hoftehoejde, baenk i baenkens hoejde', side: /så linsen er i højde med hoften\. Til bænkpres i højde med bænken\./, kilde: /i hoftehøjde/.test(vej) && /bænkens højde/.test(filmKlip) },
  { id: 'W2 3-4 m (ordret)', side: /Jo tættere kameraet står, desto større ser skiven ud i forhold til kroppen\. Fra 3-4 m og zoomet ind er det fint\./, kilde: /Jo tættere kameraet står, desto større ser skiven ud i forhold til kroppen\. Fra 3-4 m og zoomet ind er det fint\./.test(vej), gammel: /Et par meter væk/ },
  { id: 'W2 doedloeft mindst 3 m (ordret)', side: /Dødløft filmes fra mindst 3 m: tættere på ser stangen lavere ud, end den er, og med skiven klikket stopper siden dér\./, kilde: /Film dødløftet fra mindst 3 m: tættere på ser stangen lavere ud, end den er, og med skiven klikket stopper siden dér\./.test(vej) },
  { id: 'W2 kroppen er maalestokken, skiven en kontrol', side: /Kroppens længder er målestokken, når atletens højde eller mål er skrevet ind\. Skiven er en kontrol, eller målestokken, hvis højden ikke er kendt/, kilde: /Kroppens længder er målestokken, når du har skrevet atletens højde eller mål\. Skiven \(45 cm i diameter\) er en kontrol, eller målestokken, hvis du ikke kender højden\./.test(vej), gammel: /Skiven er målestokken/ },
  { id: 'W3 videoen aabnes i Maal dit billede', side: /Videoen kan åbnes direkte i Mål dit billede: tryk Vælg video, find billedet i den fase, du vil måle, og tryk Brug dette billede\./, kilde: /Har du en video, så tryk Vælg video/.test(vej) && /tryk Brug dette billede/.test(vej), gammel: /tag et skærmbillede/ },
  { id: 'W3 faserne = vejledningens', side: /squattens bund eller sticking point, dødløftet når stangen forlader gulvet eller er i knæhøjde, bænkpresset med stangen på brystet eller midt i pressen/, kilde: /Squattens bund eller sticking point/.test(vej) && /bænkpresset med stangen på brystet eller midt i pressen/.test(vej) },
  { id: 'W3 kortet: et billede eller en video (to steder)', side: /Læg et billede eller en video fra siden ind[\s\S]*Et billede eller en video fra siden/, kilde: true, gammel: /stillbillede fra siden/ },
  { id: 'foer og efter (ordret)', side: /stativ, tape på gulvet til stativets ben, samme afstand, samme højde og samme retning\. Et kamera, der er flyttet eller drejet, flytter tallene lige så meget som en ændret teknik\./, kilde: /Film fra samme sted begge gange: stativ, tape på gulvet til stativets ben, samme afstand, samme højde og samme retning\. Et kamera, der er flyttet eller drejet, flytter tallene lige så meget som en ændret teknik\./.test(vej) },
].map((g) => ({ id: g.id, side: g.side.test(T), kilde: !!g.kilde, gammelVaek: g.gammel ? !g.gammel.test(T) : true }))
ud.tekst.guide = G
for (const g of G) paastaa(`filmeguiden: ${g.id}: staar paa siden, staar i kilden, den gamle tekst er vaek`, g.side && g.kilde && g.gammelVaek, g)
ud.tekst.stillbillede = saetninger(T).filter((s) => /stillbillede|skærmbillede/i.test(s))
paastaa('"stillbillede" staar kun i forbeholdet ("Et stillbillede viser heller ikke stangens bane eller farten"), og "skaermbillede" ingen steder', ud.tekst.stillbillede.length === 1 && /stangens bane eller farten/.test(ud.tekst.stillbillede[0]), ud.tekst.stillbillede)
// Hvad vejledningen siger, som filmeguiden ikke naevner (lav, ikke i strid)
ud.tekst.ikkeNaevnt = {
  sumo: { vejledning: /Sumo: stativ ud for stangen \(højst ca\. 20 cm til siden\)/.test(vej), side: /sumo/i.test(guide), karrusel2: true },
  haanden: { vejledning: /telefonen holdt i hånden \(ca\. 140 cm, vippet ned mod hoften\) lægger skinnebenet ca\. 3° frem/.test(vej), side: /hånden/i.test(guide) },
  stickingPoint: { vejledning: /sticking point \(en tredjedel af vejen op\)/.test(vej), side: /sticking point \(|en tredjedel/.test(guide) },
}
paastaa('W8 (lav): filmeguiden naevner ikke sumo (stativ, hoejst ca. 20 cm til siden) og telefonen i haanden (ca. 3 grader), som vejledningen og karrusel 2 goer; ikke i strid', ud.tekst.ikkeNaevnt.sumo.vejledning && !ud.tekst.ikkeNaevnt.sumo.side && ud.tekst.ikkeNaevnt.haanden.vejledning && !ud.tekst.ikkeNaevnt.haanden.side, ud.tekst.ikkeNaevnt)
paastaa('vaerktoejssidens main: 0 tankestreger, 0 udraabstegn, 0 opfordringer, 0 holdningsord, 0 atletnavne', !ud.tekst.tankestreger && !ud.tekst.udraab && !ud.tekst.opfordring.length && !ud.tekst.holdning.length && !ud.tekst.navne, { opf: ud.tekst.opfordring, hold: ud.tekst.holdning })
paastaa('"fejl" bruges kun om det, modellen viser, eller om kameraet og nav-klikket', ud.tekst.fejl.every((s) => /modellen|kamera|forkerte vinkler|nav/.test(s)), ud.tekst.fejl)

// --- 4) i browseren (Google Chrome headless) -----------------------------------------------------
const typer = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.json': 'application/json', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.mov': 'video/quicktime' }
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
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const browser = await chromium.launch({ headless: true, executablePath: CHROME })
ud.chrome = browser.version()
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
        tekst: document.body?.innerText || '',
      }
    })
    for (const l of m.links) if (l.startsWith(BASE)) alleLinks.add(l.split('#')[0])
    ud.sider.push({ url, bredde, vandret: m.sw - m.cw, fejl: S.fejl, brudte: m.brudte, billeder: m.billeder, navne: !udenNavne(m.tekst) })
    if (url === '/vaerktoejer/') {
      await S.page.screenshot({ path: join(HERE, `V-${bredde}-vaerktoejer.png`), fullPage: true })
      if (bredde === 390) { await S.page.locator('#filmeguide').scrollIntoViewIfNeeded(); await S.page.screenshot({ path: join(HERE, 'V-390-filmeguide.png'), fullPage: false }) }
    }
    await S.ctx.close()
  }
}
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
  // Det, man ser foer "Mere": innerText tager kun det synlige med
  const synligTekst = e.innerText.replace(/\s+/g, ' ').trim()
  const mere = [...e.querySelectorAll('summary,button,[role=button]')].map((m) => m.textContent.trim()).filter(Boolean)
  // Kliklisten for skulderen i den valgte fase
  const skulderHjaelp = window.maalBillede.klikTekst?.('skulder')?.lille ?? null
  return { status: e.dataset.status, fejl: e.dataset.fejl || null, tekst: e.textContent.replace(/\s+/g, ' ').trim(), synligTekst, mere, synlig: !e.hidden && b.height > 0, hoejre: Math.round(b.right), hoejde: Math.round(b.height), links: [...e.querySelectorAll('a[href],img[src]')].map((a) => a.href || a.src), skulderHjaelp, sideTekst: document.body.innerText }
}
for (const bredde of [360, 390, 1280]) {
  for (const t of TILF) {
    const S = await side(bredde, `${V}/maal-billede/index.html`)
    await S.page.waitForSelector('[data-klar]')
    const r = await S.page.evaluate(LIGNER, t)
    const linkStatus = []
    for (const l of r.links) { const u = new URL(l); const s = (await fetch(BASE + u.pathname)).status; let anker = true; if (u.hash && s === 200 && u.pathname.endsWith('.html')) anker = readFileSync(join(dir, decodeURIComponent(u.pathname)), 'utf8').includes(`id="${u.hash.slice(1)}"`); linkStatus.push({ l: u.pathname + u.hash, s, anker }) }
    const skulderBaenk = t.fase === 'baenk-bryst' ? (r.sideTekst.match(/På bænken: midt i skulderleddet[^.]*\./) || [null])[0] : null
    ud.ligner.push({ ...t, klik: undefined, bredde, ...r, sideTekst: undefined, skulderBaenk, ord: r.tekst.split(/\s+/).filter(Boolean).length, synligeOrd: r.synligTekst.split(/\s+/).filter(Boolean).length, linkStatus, vandret: await S.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), jsFejl: S.fejl })
    if (bredde === 390 && ['sq-bund-kun-knae', 'sq-bund-model', 'bp-hoejt-bryst'].includes(t.id)) { await S.page.locator('[data-ligner]').scrollIntoViewIfNeeded(); await S.page.screenshot({ path: join(HERE, `V-390-ligner-${t.id}.png`) }) }
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
const lang = L.filter((r) => r.bredde === 390 && r.status === 'ligner').map((r) => ({ id: r.id, alle: r.ord, synlige: r.synligeOrd, mere: r.mere, px: r.hoejde, skaerme: Math.round((r.hoejde / 780) * 100) / 100 }))
ud.lignerLaengde = lang
// Overskrift + saetning hoejst 50 ord (LIGNER_ORD), resten bag "Mere"; linkteksterne og "Mere" selv taelles med i det synlige
paastaa('W4 lukket: paa 390 staar "Ligner"-linjen med hoejst ca. 50 synlige ord og under en skaerm; resten staar bag "Mere" (kortere linjer har intet Mere)', lang.length > 0 && lang.every((r) => r.skaerme < 1 && r.synlige <= 65 && (r.alle === r.synlige || r.mere.some((m) => /^Mere/.test(m)))), lang)
paastaa('W5 lukket: ingen "fejlfigurenerne"; baenkens link siger "Se fejlfigurerne ... om dem", doedloeftets "Se fejlfiguren ... om den"', L.every((r) => !/fejlfigurenerne/.test(r.tekst)) && L.some((r) => r.id === 'bp-hoejt-bryst' && /Se fejlfigurerne og hvad modellen ikke kan sige om dem/.test(r.tekst)) && L.some((r) => /Se fejlfiguren og hvad modellen ikke kan sige om den/.test(r.tekst)))
const bp = L.filter((r) => r.fase === 'baenk-bryst')
paastaa('W6 lukket: paa baenken siger vejledningen over billedet "midt i skulderleddet ..., ikke knoglespidsen", og Ligner-linjen modsiger den ikke', bp.some((r) => r.skulderBaenk) && bp.every((r) => !/knoglespidsen \(acromion\)/.test(r.tekst)), bp.filter((r) => r.bredde === 390).map((r) => ({ id: r.id, skulder: r.skulderBaenk })))

// --- de seks punkter trykket med fingeren (390) og musen (1280) ---------------------------------
for (const bredde of [390, 1280]) {
  const S = await side(bredde, `${V}/maal-billede/index.html`)
  await S.page.waitForSelector('[data-klar]')
  const t = TILF.find((x) => x.id === 'sq-bund-kun-knae')
  await S.page.evaluate(async (t) => {
    const k = document.createElement('canvas'); k.width = 900; k.height = 1200
    const x = k.getContext('2d'); x.fillStyle = '#34373d'; x.fillRect(0, 0, 900, 1200)
    await window.maalBillede.laesBillede(k.toDataURL('image/png'), 'syntetisk-tryk.png')
    window.maalBillede.saetKrop({ hoejde: '183', vaegt: '120' }); window.maalBillede.saetStangKg?.(t.kg); window.maalBillede.saetFase(t.fase)
  }, t)
  const IDS = ['stang', 'midtfod', 'ankel', 'knae', 'hofte', 'skulder']
  const sel = await S.page.evaluate(() => (document.querySelector('[data-klikker]') ? '[data-klikker]' : '[data-billede]'))
  const pos = ([sel, q]) => { const e = document.querySelector(sel), r = e.getBoundingClientRect(), b = window.maalBillede.tilstand().billede; const bw = b.naturalWidth || b.width, bh = b.naturalHeight || b.height; const d = Math.min(r.width / bw, r.height / bh); const ox = (r.width - bw * d) / 2, oy = (r.height - bh * d) / 2; return { x: r.left + ox + q.x * d, y: r.top + oy + q.y * d } }
  for (const id of IDS) {
    await S.page.locator(sel).scrollIntoViewIfNeeded()
    let p = await S.page.evaluate(pos, [sel, t.klik[id]])
    if (p.y > (S.mobil ? 740 : 860) || p.y < 20) { await S.page.evaluate((dy) => window.scrollBy(0, dy), p.y - 300); p = await S.page.evaluate(pos, [sel, t.klik[id]]) }
    if (S.mobil) await S.page.touchscreen.tap(p.x, p.y); else await S.page.mouse.click(p.x, p.y)
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

// --- videoen: mine syntetiske klip fra 582, i sitets kopi -----------------------------------------
const { filer: KLIP, info: KLIPINFO } = await lavKlip()
const ulaeselig = join(tmpdir(), 'kritik-585-ulaeselig.mp4')
if (!existsSync(ulaeselig)) { const b = Buffer.alloc(2e6); let z = 585; for (let i = 0; i < b.length; i++) { z = (z * 1103515245 + 12345) >>> 0; b[i] = z >>> 24 } writeFileSync(ulaeselig, b) }
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
const rolig = (S) => S.page.waitForFunction(() => { const i = window.maalBillede.billedInfo?.(); return (!i || i.iKoe === 0) && !window.maalBillede.video.seeking }, null, { timeout: 30000 }).then(() => true, () => false)
async function tryk(S, sel) { const l = S.page.locator(sel); await l.scrollIntoViewIfNeeded(); if (S.mobil) await l.tap(); else await l.click() }
const billedeTil = (tider, t) => { let k = 0; while (k + 1 < tider.length && tider[k + 1] <= t * 1e6 + 0.5) k++; return k }
for (const [bredde, klip] of [[390, 'sq2997.mp4'], [390, 'sqvfr.mov'], [1280, 'sq2997.mp4'], [1280, 'sqvfr.mov']]) {
  const S = await side(bredde, `${V}/maal-billede/index.html`)
  await S.page.waitForSelector('[data-klar]')
  const efterHentet = eksterne.size
  const r = { bredde, klip }
  let t0 = Date.now()
  await S.page.setInputFiles('[data-videofil]', KLIP[klip])
  r.aabnet = await S.page.waitForFunction(() => { const v = window.maalBillede.video; return v.readyState >= 2 && document.querySelector('[data-skyder]').max !== '0' && !v.seeking }, null, { timeout: 60000 }).then(() => true, () => false)
  r.aabnMs = Date.now() - t0
  r.nr = [await S.page.evaluate(NUMMER, ['video', BITS])]
  for (let i = 0; i < 4; i++) { await tryk(S, '[data-frem]'); await rolig(S); await S.page.waitForTimeout(80); r.nr.push(await S.page.evaluate(NUMMER, ['video', BITS])) }
  await tryk(S, '[data-tilbage]'); await rolig(S); await S.page.waitForTimeout(80); r.nr.push(await S.page.evaluate(NUMMER, ['video', BITS]))
  await S.page.evaluate(() => window.maalBillede.saetVideoTid(13.2)); await rolig(S); await S.page.waitForTimeout(150)
  r.vist = await S.page.evaluate(NUMMER, ['video', BITS])
  r.facit = billedeTil(KLIPINFO[klip].tider, 13.2)
  t0 = Date.now()
  await tryk(S, '[data-brug]')
  await S.page.waitForFunction(() => !!window.maalBillede.tilstand().billede, null, { timeout: 10000 }).catch(() => {})
  r.brugMs = Date.now() - t0
  await S.page.waitForTimeout(150)
  r.foto = await S.page.evaluate(NUMMER, ['foto', BITS])
  r.vandret = await S.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  if (bredde === 390 && klip === 'sq2997.mp4') {
    await S.page.evaluate(() => window.maalBillede.saetVideoTid(4)); await rolig(S)
    await S.page.locator('[data-videoboks]').scrollIntoViewIfNeeded(); await S.page.screenshot({ path: join(HERE, 'V-390-video.png') })
  }
  if (klip === 'sq2997.mp4') {
    for (const [navn, fil] of [['ulaeselig', ulaeselig], ['hevc', KLIP['sqhevc.mov']]]) {
      t0 = Date.now()
      await S.page.setInputFiles('[data-videofil]', fil)
      const ok = await S.page.waitForFunction(() => /kunne ikke læses/.test(document.querySelector('[data-videonavn]').textContent) || (window.maalBillede.video.readyState >= 2 && !window.maalBillede.video.seeking && document.querySelector('[data-skyder]').max !== '0'), null, { timeout: 30000 }).then(() => true, () => false)
      r[navn] = { ok, ms: Date.now() - t0, laest: !(await S.page.evaluate(() => /kunne ikke læses/.test(document.querySelector('[data-videonavn]').textContent))) }
    }
  }
  r.eksterneEfter = eksterne.size - efterHentet
  r.fejl = S.fejl
  ud.video.push(r)
  await S.ctx.close()
}
const VD = ud.video
paastaa('videoen aabner paa 390 (touch) og 1280 (mus), H.264 MP4 i 29,97 og MOV med variabel billedrate', VD.every((r) => r.aabnet && r.nr[0] === 0), VD.map((r) => ({ b: r.bredde, k: r.klip, ms: r.aabnMs })))
paastaa('hvert tryk paa 1 billede frem/tilbage er praecis eet billede (0,1,2,3,4 og tilbage til 3)', VD.every((r) => JSON.stringify(r.nr) === '[0,1,2,3,4,3]'), VD.map((r) => `${r.bredde} ${r.klip}: ${r.nr.join(',')}`))
paastaa('"Brug dette billede" ved 13,2 s: fotoet er det viste billede, og det er billedet i filen ved 13,2 s', VD.every((r) => r.vist !== null && r.foto === r.vist && r.vist === r.facit), VD.map((r) => ({ b: r.bredde, k: r.klip, vist: r.vist, foto: r.foto, facit: r.facit, ms: r.brugMs })))
paastaa('et klip af tilfaeldige bytes giver beskeden paa under 2 s; HEVC-MOV (iPhone) aabner i Chrome', VD.filter((r) => r.ulaeselig).every((r) => r.ulaeselig.ok && !r.ulaeselig.laest && r.ulaeselig.ms < 2000 && r.hevc.ok && r.hevc.laest), VD.filter((r) => r.ulaeselig).map((r) => ({ b: r.bredde, u: r.ulaeselig, hevc: r.hevc })))
paastaa('videoen: 0 kald ud af huset, 0 JS-fejl, 0 sidelaens rulning', VD.every((r) => r.eksterneEfter === 0 && !r.fejl.length && r.vandret <= 0), VD.map((r) => ({ b: r.bredde, net: r.eksterneEfter, f: r.fejl })))
ud.eksterne = [...eksterne]
paastaa('alt, siderne proevede at hente udefra, er afbrudt og var kun skrifttypen', [...eksterne].every((u) => /fonts\.(googleapis|gstatic)\.com/.test(u)), [...eksterne])

await browser.close(); server.close()
writeFileSync(join(HERE, 'vaerktoejer-585.json'), JSON.stringify({ ...ud, tjek }, null, 1))
const roede = tjek.filter((t) => !t.ok)
console.log(`\nvaerktoejer-585: ${tjek.length - roede.length}/${tjek.length} tjek groenne (${ud.chrome})`)
process.exit(roede.length ? 1 : 0)
