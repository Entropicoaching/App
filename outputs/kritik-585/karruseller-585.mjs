// Kritik 585, blok 2: Setus to Instagram-karruseller (ordre 573, rettet i 579) i C:\Users\Entropi\Desktop\ordrer\kilder\setu-573\
// (kun laest; intet rettes, intet koeres i mappen). Gentjek af K1-K6 fra 576: slide 3 og 4 og billedtekst 1, og
// hele karrusel 1 og 2 igen kort mod Marcs regler, vejledningen i Maal dit billede (dhruva main, git archive),
// FILM-KLIP.html og vaerktoejssiden (grenen vaerktoejer, git archive).
//   node outputs/kritik-585/karruseller-585.mjs     -> karruseller-585.json og K*-390-*.png
// 1) Stil. 2) Laesbar paa en telefon (HTML'en bag hver PNG i 1080 x 1350). 3) Sand: hver paastand mod kilden,
//    slide 3's tabel mod Maal dit billede paa sitets kopi for samme tegnede krop, slide 4's etiket, billedteksterne
//    mod det, der ligger paa sitet efter en merge af vaerktoejer. 4) Hvilke af Setus filer er aendret siden 576.
import path, { join } from 'node:path'
import { tmpdir } from 'node:os'
import { readFileSync, writeFileSync, readdirSync, mkdtempSync, mkdirSync, existsSync, statSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from '../../e2e/harness.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const K = 'C:/Users/Entropi/Desktop/ordrer/kilder/setu-573'
const SITE = 'C:/Users/Entropi/Desktop/entropi-coaching-site-wt2'
const LM = 'C:/Users/Entropi/Desktop/entropi-loeftmodel-dhruva'
const sh = (c) => execSync(c, { maxBuffer: 1 << 26 }).toString()
const tjek = []
const paastaa = (hvad, ok, data) => { tjek.push({ hvad, ok: !!ok, data }); console.log(`${ok ? 'ok ' : 'NEJ'} ${hvad}${data !== undefined ? ' ' + JSON.stringify(data).slice(0, 500) : ''}`) }
const navne = [...new Set([...readFileSync(join(HERE, '..', '..', '.gitignore'), 'utf8').matchAll(/^supabase\/([a-z]+)-\*/gm)].map((m) => m[1]).filter((n) => n !== 'marc'))]
const udenNavne = (t) => navne.length > 0 && navne.every((n) => !new RegExp(`\\b${n}\\b`, 'i').test(t))
const tekstAf = (s) => s.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()

const dir = mkdtempSync(join(tmpdir(), 'k585b-'))
execSync(`git -C "${LM}" archive -o "${join(dir, 'd.tar')}" main dist src kroppe package.json`)
execSync('tar -xf d.tar', { cwd: dir })
const site = join(dir, '_site'); mkdirSync(site)
execSync(`git -C "${SITE}" archive -o "${join(site, 's.tar')}" refs/heads/vaerktoejer`)
execSync('tar -xf s.tar', { cwd: site })
const lmTop = sh(`git -C "${LM}" rev-parse --short main`).trim()
const siteTop = sh(`git -C "${SITE}" rev-parse --short refs/heads/vaerktoejer`).trim()
const vejl = tekstAf(readFileSync(join(dir, 'dist/maal-billede/index.html'), 'utf8'))
const film = tekstAf(readFileSync('C:/Users/Entropi/Desktop/FILM-KLIP.html', 'utf8'))
const guide = tekstAf(readFileSync(join(site, 'vaerktoejer/index.html'), 'utf8'))
const { KARRUSELLER } = await import(pathToFileURL(join(K, 'slides.mjs')).href)
const ud = { lmTop, siteTop, karruseller: {}, sandhed: [], vaerktoejet: {}, sitet: {} }

// --- 4) hvad er aendret siden 576 ------------------------------------------------------------------
const alleFiler = (d, rel = '') => readdirSync(join(d, rel), { withFileTypes: true }).flatMap((e) => e.isDirectory() ? alleFiler(d, join(rel, e.name)) : [join(rel, e.name).split(path.sep).join('/')])
ud.filer = {}
for (const f of alleFiler(K)) ud.filer[f] = createHash('sha256').update(readFileSync(join(K, f))).digest('hex')
const f576 = JSON.parse(readFileSync(join(HERE, '..', 'kritik-576', 'karruseller-576.json'), 'utf8')).filer
ud.aendret = { nye: Object.keys(ud.filer).filter((f) => !f576[f]), aendrede: Object.keys(ud.filer).filter((f) => f576[f] && f576[f] !== ud.filer[f]), uaendrede: Object.keys(ud.filer).filter((f) => f576[f] === ud.filer[f]).length, vaek: Object.keys(f576).filter((f) => !ud.filer[f]) }
paastaa('siden 576: aendret er kun karrusel 1 (slide 3 og 4 og deres HTML), billedtekst 1, slides.mjs og tegn.mjs; karrusel 2 og billedtekst 2 er uaendret', ud.aendret.aendrede.every((f) => /^(karrusel-1|billedtekst-1|slides\.mjs|tegn\.mjs)/.test(f)) && ud.aendret.aendrede.some((f) => /slide-03\.png/.test(f)) && !ud.aendret.aendrede.some((f) => /karrusel-2|billedtekst-2/.test(f)), ud.aendret)

// --- 1) stil ------------------------------------------------------------------------------------------
const OPFORDRING = /\b(prøv|kom i gang|ansøg|book|kontakt|skriv til|følg|link i bio|tilmeld|læs mere|gem (den|opslaget)|del (den|opslaget)|swipe)\b|!/i
const DRAMA = /^(forestil dig|vidste du|hemmelighed|sandheden|stop|glem|de fleste|alle tror|du gør det forkert)/i
const META = /\b(denne karrusel|dette opslag|i dag vil jeg|slide|swipe|karrusel)\b/i
const FORBEHOLD = /ingen muskler|skøn|målefejl|ikke uden fejl|i hånden/
for (const [nr, k] of Object.entries(KARRUSELLER)) {
  const bt = readFileSync(join(K, k.billedtekst), 'utf8').replace(/\r/g, '').trim()
  const html = readdirSync(join(K, k.mappe, 'html')).filter((f) => f.endsWith('.html')).sort().map((f) => tekstAf(readFileSync(join(K, k.mappe, 'html', f), 'utf8')))
  const png = readdirSync(join(K, k.mappe)).filter((f) => f.endsWith('.png')).sort().map((f) => { const b = readFileSync(join(K, k.mappe, f)); return { f, w: b.readUInt32BE(16), h: b.readUInt32BE(20) } })
  const alt = [bt, ...k.slides.map((s) => s.tekst), ...html].join(' \n ')
  const foersteRen = k.slides.findIndex((s) => s.tegning === null)
  const sidste = foersteRen >= 0 ? k.slides.slice(foersteRen) : []
  // Slidetekst i PNG'ens HTML = slides.mjs (PNG'erne er lavet efter rettelsen)
  const htmlSvarer = k.slides.every((s, i) => html[i].includes(s.tekst.replace(/\s+/g, ' ')))
  const r = {
    slides: k.slides.length, png, billedtekst: bt, bogstaver: bt.length, htmlSvarer,
    tankestreger: (alt.match(/[\u2013\u2014]/g) || []).length,
    navne: !udenNavne(alt), opfordring: [...k.slides.map((s) => s.tekst), bt].filter((t) => OPFORDRING.test(t)),
    drama: DRAMA.test(k.slides[0].tekst) || DRAMA.test(bt), meta: [...k.slides.map((s) => s.tekst), bt].filter((t) => META.test(t)),
    forbeholdNederst: sidste.length > 0 && sidste.every((s) => s.tegning === null && FORBEHOLD.test(s.tekst)) && k.slides.slice(0, foersteRen).every((s) => !FORBEHOLD.test(s.tekst)),
    slut: bt.split(/(?<=\.)\s+/).pop(),
  }
  ud.karruseller[nr] = r
  paastaa(`K${nr}: ${r.slides} slides, alle ${r.png.length} PNG 1080 x 1350, og slideteksten i hver PNG's HTML = slides.mjs`, r.png.length === r.slides && r.png.every((p) => p.w === 1080 && p.h === 1350) && r.htmlSvarer)
  paastaa(`K${nr}: 0 tankestreger, 0 atletnavne, ingen opfordring, ingen dramatisk aabning, ingen meta (slides, tegninger og billedtekst)`, !r.tankestreger && !r.navne && !r.opfordring.length && !r.drama && !r.meta.length, { opf: r.opfordring, meta: r.meta })
  paastaa(`K${nr}: forbeholdene staar paa de sidste slides og ikke foer, og billedteksten slutter neutralt ("${r.slut}")`, r.forbeholdNederst && /entropicoaching\.dk\.$/.test(bt) && !OPFORDRING.test(r.slut))
}

// --- 2) laesbar paa en telefon ---------------------------------------------------------------------
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const browser = await chromium.launch({ headless: true, executablePath: CHROME })
const MAAL = () => {
  const lum = (c) => { const m = c.match(/\d+(\.\d+)?/g).map(Number); const [r, g, b] = m.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
  const kontrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
  const bg = getComputedStyle(document.body).backgroundColor
  const ud = []
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  while (walk.nextNode()) {
    const n = walk.currentNode; if (!n.textContent.trim()) continue
    const e = n.parentElement, cs = getComputedStyle(e), rg = document.createRange(); rg.selectNodeContents(n); const r = rg.getBoundingClientRect()
    if (cs.visibility === 'hidden' || cs.display === 'none' || r.width === 0 || e.closest('style,script')) continue
    const svg = e.closest('svg')
    let px = parseFloat(cs.fontSize)
    if (svg) { const m = svg.getScreenCTM(); px *= m ? Math.hypot(m.a, m.b) : 1 }
    const farve = svg ? (cs.fill && cs.fill !== 'none' ? cs.fill : cs.color) : cs.color
    ud.push({ t: n.textContent.trim().slice(0, 40), px: Math.round(px * 10) / 10, kontrast: Math.round(kontrast(farve, bg) * 10) / 10, kant: Math.round(Math.min(r.left, r.top, 1080 - r.right, 1350 - r.bottom)) })
  }
  return ud
}
ud.laesbar = {}
for (const [nr, k] of Object.entries(KARRUSELLER)) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } })
  await page.route('**/*', (r) => (/^(file|data):/.test(r.request().url()) ? r.continue() : r.abort()))
  const pr = []
  for (const f of readdirSync(join(K, k.mappe, 'html')).filter((f) => f.endsWith('.html')).sort()) {
    await page.goto(pathToFileURL(join(K, k.mappe, 'html', f)).href)
    const m = await page.evaluate(MAAL)
    const mindst = m.reduce((a, b) => (b.px < a.px ? b : a))
    pr.push({ f, tekster: m.length, mindstePx: mindst.px, hvad: mindst.t, lavKontrast: Math.min(...m.map((x) => x.kontrast)), kant: Math.min(...m.map((x) => x.kant)) })
  }
  await page.close()
  ud.laesbar[nr] = pr
  paastaa(`K${nr}: al tekst mindst 30 px i 1080 (ca. 10,8 px paa en 390 px telefon), kontrast mindst 4,5, mindst 40 px fra kanten`, pr.every((p) => p.mindstePx >= 30 && p.lavKontrast >= 4.5 && p.kant >= 40), pr.map((p) => [p.f.slice(6, 8), p.mindstePx, p.lavKontrast, p.kant]))
}
{
  const page = await browser.newPage({ viewport: { width: 1640, height: 500 } })
  for (const [nr, k] of Object.entries(KARRUSELLER)) {
    const fs = readdirSync(join(K, k.mappe)).filter((f) => f.endsWith('.png')).sort()
    for (let i = 0; i < fs.length; i += 4) {
      const imgs = fs.slice(i, i + 4).map((f) => `<img src="data:image/png;base64,${readFileSync(join(K, k.mappe, f)).toString('base64')}" style="width:390px;height:487.5px;margin-right:10px">`).join('')
      await page.setContent(`<body style="margin:0;background:#fff;display:flex">${imgs}</body>`)
      await page.screenshot({ path: join(HERE, `K${nr}-390-slides-${i + 1}-${Math.min(i + 4, fs.length)}.png`), clip: { x: 0, y: 0, width: 400 * Math.min(4, fs.length - i), height: 488 } })
    }
  }
  await page.close()
}

// --- 3) sand ---------------------------------------------------------------------------------------
const S = (nr, i) => KARRUSELLER[nr].slides[i - 1].tekst
const BT = (nr) => ud.karruseller[nr].billedtekst
const par = [
  [1, 'slide 1', /seks punkter i fast rækkefølge/.test(S(1, 1)), /Klik de seks punkter i rækkefølge/.test(vejl) && /måler siden ledvinklerne, torsoens hældning og stangens vandrette afstand til midtfoden/.test(vejl)],
  [1, 'slide 2', /samme fase og skala, med midtfoden og gulvet samme sted/.test(S(1, 2)) && /i blåt/.test(S(1, 2)), /Modellen står i samme fase, i samme skala og med midtfoden og gulvet samme sted/.test(vejl) && /Dine klik står tyndt i blåt oven på modellen/.test(vejl)],
  [1, 'slide 3', /Mål dit billedes egen tabel/.test(S(1, 3)) && /Kun knæet skiller sig ud, og linjen under siger "Ligner ikke"/.test(S(1, 3)), true], // maalt nedenfor
  [1, 'slide 4', /"Ligner" står kun, når tallene flytter sig samme vej som en af modellens tegnede fejl og mere end klikfejlen/.test(S(1, 4)), /"Ligner" under tabellen står kun, når billedets tal flytter sig samme vej som i en af fejlfigurerne og mere end klikfejlen/.test(vejl)],
  [1, 'slide 5', /bliver på telefonen, i browseren\. De sendes ingen steder hen, og intet gemmes/.test(S(1, 5)), /Billedet og videoen bliver i din browser\. De sendes ingen steder hen, og intet gemmes\. Luk siden, så er de væk/.test(vejl)],
  [1, 'slide 6', /skråt forfra, bliver vinklerne forkerte, typisk flere grader/.test(S(1, 6)), /Står kameraet skråt forfra, bagfra, oppefra eller nedefra, bliver vinklerne forkerte, typisk flere grader/.test(vejl)],
  [1, 'slide 7', /ingen muskler og en stiv ryg og ved ikke, hvor stærk eller smidig du er/.test(S(1, 7)) && /"Fejl" er kun det, modellen selv viser/.test(S(1, 7)), /Den har ingen muskler og ved ikke, hvor stærk eller smidig atleten er\. Ryggen er ét stift stykke/.test(vejl) && /"Fejl" betyder kun det, modellen viser/.test(vejl) && /Det betyder ikke "uden fejl"/.test(vejl)],
  [1, 'slide 8', /Et klik 2 cm forkert flytter knæet 4-5°, så forskelle under ca\. 4° eller 3 cm/.test(S(1, 8)), /Et punkt, der sidder 2 cm forkert, flytter hoften ca\. 3° og knæet 4-5°/.test(vejl) && /Læs derfor kun forskelle over ca\. 4° eller 3 cm/.test(vejl)],
  [2, 'slide 1', /stativ ude til siden, ud for stangen, 3-4 m væk\. På højkant og lige, ikke vippet\. Zoomet ind/.test(S(2, 1)), /3-4 m ude til siden, ud for stangen/.test(film) && /Telefonen på højkant og lige, ikke vippet op eller ned\. Zoom ind/.test(film) && /Fra 3-4 m og zoomet ind er det fint/.test(vejl)],
  [2, 'slide 2', /ca\. ½ m frem uden at dreje telefonen\. Det flytter vinklerne under 1°/.test(S(2, 2)), /flyttes telefonen en halv meter frem uden at dreje den/.test(film) && /50 cm ved siden af på 3 m ligner ca\. 8° skråt\), men flytter vinklerne under 1°/.test(vejl)],
  [2, 'slide 3', /hoftehøjde, hvor hoften er, når du står oprejst\. 3-4 m væk\. Tape på gulvet/.test(S(2, 3)), /i hoftehøjde \(hvor hoften er, når du står\), 3-4 m væk/.test(film) && /tape på gulvet til stativets ben/.test(vejl)],
  [2, 'slide 4', /mindst 3 m væk\. Tættere på ser stangen lavere ud, end den er\. I sumo præcis 3 m, og stativet højst ca\. 20 cm frem/.test(S(2, 4)), /Film dødløftet fra mindst 3 m: tættere på ser stangen lavere ud, end den er/.test(vejl) && /Præcis 3 m væk/.test(film) && /flyt højst stativet ca\. 20 cm frem/.test(film)],
  [2, 'slide 5', /bænkens højde, ikke i hoftehøjde\. 3 m væk, ud for stangen, når den ligger på brystet/.test(S(2, 5)), /Telefonen i bænkens højde, ikke i hoftehøjde/.test(film) && /3 m væk, ud for stangen, når den ligger på brystet, i bænkens højde, på højkant/.test(film)],
  [2, 'slide 6', /vippet ned mod hoften, lægger skinnebenet ca\. 3° frem\. Et flyttet kamera flytter tallene lige så meget som en ændret teknik/.test(S(2, 6)), /telefonen holdt i hånden \(ca\. 140 cm, vippet ned mod hoften\) lægger skinnebenet ca\. 3° frem/.test(vejl) && /Et kamera, der er flyttet eller drejet, flytter tallene lige så meget som en ændret teknik/.test(vejl)],
  [1, 'billedtekst', /Du klikker seks punkter: stangen, midtfoden, anklen, knæet, hoften og skulderen/.test(BT(1)) && /"Ligner" står kun, når tallene flytter sig samme vej som en af modellens tegnede fejl og mere end klikfejlen/.test(BT(1)) && /forskelle under ca\. 4° eller 3 cm kan klikkene selv give/.test(BT(1)), /Klik de seks punkter i rækkefølge/.test(vejl)],
  [2, 'billedtekst', /3-4 m i squat, mindst 3 m i dødløft, præcis 3 m i sumo og 3 m i bænkpres/.test(BT(2)), /Mindst 3 m/.test(film) && /Præcis 3 m væk/.test(film) && /3 m væk, ud for stangen, når den ligger på brystet/.test(film)],
]
ud.sandhed = par.map(([nr, hvor, a, b]) => ({ nr, hvor, paaSlide: a, iKilden: b }))
paastaa(`${par.length} paastande paa slides og i billedteksterne staar som skrevet og passer med vejledningen (main ${lmTop}) eller FILM-KLIP`, ud.sandhed.every((x) => x.paaSlide && x.iKilden), ud.sandhed.filter((x) => !x.paaSlide || !x.iKilden))

// K2: karrusel 2 mod vaerktoejssidens filmeguide (efter 579): ingen modsigelse mere
ud.k2 = {
  hoejkant: /På højkant/.test(S(2, 1)) && /hold telefonen lodret, også til bænkpres/.test(guide) && !/ned på siden/.test(guide),
  afstand: /3-4 m/.test(S(2, 1)) && /Fra 3-4 m og zoomet ind er det fint/.test(guide) && !/Et par meter/.test(guide),
  doedloeft: /mindst 3 m/.test(S(2, 4)) && /Dødløft filmes fra mindst 3 m/.test(guide),
  video: /Et løft kan måles fra en video/.test(BT(2)) && /Videoen kan åbnes direkte i Mål dit billede/.test(guide) && !/skærmbillede/.test(guide),
  baenkHoejde: /bænkens højde/.test(S(2, 5)) && /Til bænkpres i højde med bænken/.test(guide),
  sumoIGuiden: /sumo/i.test(guide),
}
paastaa('K2 lukket: karrusel 2 og vaerktoejssidens filmeguide siger det samme om hoejkant, 3-4 m, doedloeft mindst 3 m, baenkens hoejde og videoen (sumo staar kun i karrusellen, W8)', ud.k2.hoejkant && ud.k2.afstand && ud.k2.doedloeft && ud.k2.video && ud.k2.baenkHoejde && !ud.k2.sumoIGuiden, ud.k2)

// K3: slide 3 mod Maal dit billede paa sitets kopi for samme tegnede krop
const kroppe = JSON.parse(readFileSync(join(K, 'kroppe.json'), 'utf8'))
const s3 = tekstAf(readFileSync(join(K, 'karrusel-1-maal-dit-billede/html/slide-03.html'), 'utf8'))
const typer = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.css': 'text/css' }
const server = createServer((req, res) => { const f = join(site, decodeURIComponent(req.url.split('?')[0])); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end() } res.writeHead(200, { 'content-type': typer[path.extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f)) }).listen(0)
const BASE = `http://127.0.0.1:${server.address().port}`
const page = await browser.newPage({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
await page.route('**/*', (r) => (r.request().url().startsWith(BASE) || /^(data|blob):/.test(r.request().url()) ? r.continue() : r.abort()))
await page.goto(`${BASE}/assets/vaerktoejer/maal-billede/index.html`)
await page.waitForSelector('[data-klar]')
const P = kroppe.lange.punkter, s = 7
const px = (q) => ({ x: 450 + q.x * s, y: 1100 - q.y * s })
const klik = { stang: px(P.bar), midtfod: px(P.midfoot), ankel: px(P.ankle), knae: px(P.knee), hofte: px(P.hip), skulder: px(P.shoulder) }
const vk = await page.evaluate(async (klik) => {
  const k = document.createElement('canvas'); k.width = 900; k.height = 1200
  const x = k.getContext('2d'); x.fillStyle = '#34373d'; x.fillRect(0, 0, 900, 1200)
  await window.maalBillede.laesBillede(k.toDataURL('image/png'), 'syntetisk-lange-laar.png')
  window.maalBillede.saetKrop({ hoejde: '178', vaegt: '85' })
  window.maalBillede.saetFase('squat-bund')
  window.maalBillede.saetPunkter(klik)
  await new Promise((ok) => requestAnimationFrame(() => setTimeout(ok, 300)))
  const tab = [...document.querySelectorAll('table')].filter((t) => /model/i.test(t.innerText)).flatMap((t) => [...t.rows]).map((tr) => [...tr.cells].map((c) => c.textContent.replace(/\s+/g, ' ').trim()))
  const e = document.querySelector('[data-ligner]')
  return { tab, ligner: { status: e.dataset.status, tekst: e.textContent.replace(/\s+/g, ' ').trim() } }
}, klik)
ud.vaerktoejet.langeLaar = vk
await page.locator('table').first().scrollIntoViewIfNeeded().catch(() => {})
await page.screenshot({ path: join(HERE, 'K1-390-vaerktoejet-lange-laar.png') })
await page.close()
const tal = (x) => parseFloat(String(x).replace(/[^0-9,−-]/g, '').replace(',', '.').replace('−', '-'))
const raekke = (re) => vk.tab.find((r) => re.test(r[0] || ''))
const RK = [['overkrop', /^Torso/], ['hofte', /^Hoftevinkel/], ['knæ', /^Knævinkel/], ['stang til hofte', /^Vandret afstand stang/]]
ud.slide3 = RK.map(([navn, re]) => {
  const r = raekke(re)
  const m = s3.match(new RegExp(`${navn} (≈?[0-9,]+ ?(?:°|cm)) (≈?[0-9,]+ ?(?:°|cm)) ([+−-][0-9,]+ ?(?:°|cm))`))
  return { navn, vaerktoej: r ? [r[1], r[2]] : null, slide: m ? [m[1], m[2], m[3]] : null, forskelRegnet: r ? Math.round((tal(r[1]) - tal(r[2])) * 10) / 10 : null }
})
const s3ok = ud.slide3.every((x) => x.vaerktoej && x.slide && x.vaerktoej[0].replace(/\s/g, '') === x.slide[0].replace(/\s/g, '') && x.vaerktoej[1].replace(/\s/g, '') === x.slide[1].replace(/\s/g, '') && Math.abs(tal(x.slide[2]) - x.forskelRegnet) < 0.051)
paastaa(`K3 lukket: slide 3's fire raekker = Maal dit billedes egen tabel paa sitets kopi (${siteTop}, main ${lmTop}) for samme tegnede krop, og forskellen er billede minus model`, s3ok, ud.slide3)
paastaa('K3 lukket: ingen skinneben-raekke og ingen stang til midtfod paa slide 3, "det er laarene, ikke teknikken" er vaek', !/skinneben/i.test(s3) && !/midtfod/i.test(s3) && !/lårene, ikke teknikken/.test(s3 + S(1, 3)))
const over = ud.slide3.filter((x) => Math.abs(x.forskelRegnet) >= (/cm/.test(x.vaerktoej?.[0] || '') ? 3 : 4)).map((x) => x.navn)
paastaa('K3 lukket: "Kun knaeet skiller sig ud" (kun knaeet over ca. 4 grader eller 3 cm) og vaerktoejet siger "Ligner ikke "kun knaeene" eller "hoften skudt for langt tilbage"", som slide 3 viser', over.length === 1 && over[0] === 'knæ' && vk.ligner.status === 'ingen' && /^Ligner ikke "kun knæene" eller "hoften skudt for langt tilbage"/.test(vk.ligner.tekst) && /Ligner ikke "kun knæene" eller "hoften skudt for langt tilbage"/.test(s3), { over, ligner: vk.ligner.tekst.slice(0, 160) })
paastaa('K3 (rest, lav): slide 3 viser kun linjens begyndelse; vaerktoejets linje fortsaetter "Det udelukker ikke fejlen ... Andre fejl tjekker siden ikke", som slide 7 siger kort ("Ligner ikke" betyder ikke uden fejl)', /Det udelukker ikke fejlen/.test(vk.ligner.tekst) && !/udelukker/.test(s3) && /"Ligner ikke" betyder ikke uden fejl/.test(S(1, 7)))

// K4: slide 4's etiket
const s4 = tekstAf(readFileSync(join(K, 'karrusel-1-maal-dit-billede/html/slide-04.html'), 'utf8'))
paastaa('K4 lukket: slide 4 siger "skinnebenet 10° frem, overkroppen ens, tegnet, ikke modellens egen fejlfigur"; 10 grader og overkroppen ens opfylder reglen (mindst 8 grader, torsoen ikke mere frem)', /skinnebenet 10° frem, overkroppen ens, tegnet, ikke modellens egen fejlfigur/.test(s4) && /skinnebenet mindst 8°/.test(vejl) && /Ligner: kun knæene/.test(s4))

// K5, K6
paastaa('K5 lukket: billedtekst 1 siger "seks punkter: stangen, midtfoden, anklen, knaeet, hoften og skulderen" (ikke "paa knoglerne")', /seks punkter: stangen, midtfoden, anklen, knæet, hoften og skulderen/.test(BT(1)) && !/på knoglerne/.test(BT(1)))
paastaa('K6 (lav, uaendret): mindste tekst er stadig 30 px (ca. 10,8 px paa en 390 px telefon), etiketterne i tegningerne', Object.values(ud.laesbar).flat().some((p) => p.mindstePx === 30))

// K1: billedtekst 1 og sitet
const mainFiler = sh(`git -C "${SITE}" ls-tree -r --name-only main`).split('\n')
const grenFiler = sh(`git -C "${SITE}" ls-tree -r --name-only refs/heads/vaerktoejer`).split('\n')
const linkerTil = grenFiler.filter((f) => f.endsWith('.html') && !f.startsWith('vaerktoejer/') && !f.startsWith('assets/vaerktoejer/') && /href="[^"]*vaerktoejer/.test(readFileSync(join(site, f), 'utf8')))
ud.sitet = { mainHarVaerktoejer: mainFiler.includes('vaerktoejer/index.html'), grenHarMaalBillede: grenFiler.includes('assets/vaerktoejer/maal-billede/index.html'), linkerTil, noindex: /noindex/.test(readFileSync(join(site, 'vaerktoejer/index.html'), 'utf8')), mainAhead: sh(`git -C "${SITE}" rev-list --count refs/heads/vaerktoejer..main`).trim(), grenAhead: sh(`git -C "${SITE}" rev-list --count main..refs/heads/vaerktoejer`).trim() }
paastaa('K1 lukket: billedtekst 1 slutter "Maal dit billede ligger paa entropicoaching.dk." uden artiklerne; det bliver sandt med mergen af vaerktoejer (Maal dit billede ligger paa grenen, ikke paa main i dag)', /Mål dit billede ligger på entropicoaching\.dk\.$/.test(BT(1)) && !/artikler/.test(BT(1)) && ud.sitet.grenHarMaalBillede && !ud.sitet.mainHarVaerktoejer, ud.sitet)
paastaa('K7 (middel, Marc): efter mergen linker ingen side paa sitet til /vaerktoejer/, og siden har noindex; en laeser, der gaar ind paa entropicoaching.dk, kan ikke finde Maal dit billede', ud.sitet.linkerTil.length === 0 && ud.sitet.noindex, ud.sitet)

await browser.close(); server.close()
writeFileSync(join(HERE, 'karruseller-585.json'), JSON.stringify({ ...ud, tjek }, null, 1))
const roede = tjek.filter((t) => !t.ok)
console.log(`\nkarruseller-585: ${tjek.length - roede.length}/${tjek.length} tjek groenne`)
process.exit(roede.length ? 1 : 0)
