// Kritik 576, blok 2: Setus to Instagram-karruseller (ordre 573) i C:\Users\Entropi\Desktop\ordrer\kilder\setu-573\
// (kun laest; intet rettes, intet koeres i mappen). Holdt op mod Marcs regler fra ordre 573, mod vejledningen i
// Maal dit billede (dist paa loeftmodellens main, git archive) og FILM-KLIP.html, og mod vaerktoejet selv.
//   node outputs/kritik-576/karruseller-576.mjs     -> karruseller-576.json og K-*.png (slides i telefonstoerrelse)
// 1) Stil: tankestreger, atletnavne, opfordring, dramatisk aabning, meta, forbehold nederst, neutral henvisning.
// 2) Laesbar paa en telefon: HTML'en bag hver PNG aabnet headless i 1080 x 1350; mindste skrift og kontrast,
//    omregnet til en telefon, der viser billedet 390 px bredt.
// 3) Sand: hver paastand paa slides og i billedteksterne holdt op mod kilden; slide 3's tabel og slide 4's
//    fejlfigur holdt op mod det, Maal dit billede selv viser for samme tegnede krop.
import path, { join } from 'node:path'
import { tmpdir } from 'node:os'
import { readFileSync, writeFileSync, readdirSync, mkdtempSync, mkdirSync, existsSync, statSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { createServer } from 'node:http'
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

const dir = mkdtempSync(join(tmpdir(), 'k576b-'))
execSync(`git -C "${LM}" archive -o "${join(dir, 'd.tar')}" main dist src kroppe package.json`)
execSync('tar -xf d.tar', { cwd: dir })
const lmTop = sh(`git -C "${LM}" rev-parse --short main`).trim()
const vejl = tekstAf(readFileSync(join(dir, 'dist/maal-billede/index.html'), 'utf8'))
const film = tekstAf(readFileSync('C:/Users/Entropi/Desktop/FILM-KLIP.html', 'utf8'))
const { KARRUSELLER } = await import(pathToFileURL(join(K, 'slides.mjs')).href)
const ud = { lmTop, karruseller: {}, sandhed: [], vaerktoejet: {}, sitet: {} }

// --- 1) stil ------------------------------------------------------------------------------------------
const OPFORDRING = /\b(prøv|kom i gang|ansøg|book|kontakt|skriv til|følg|link i bio|tilmeld|læs mere|gem (den|opslaget)|del (den|opslaget)|swipe)\b|!/i
const DRAMA = /^(forestil dig|vidste du|hemmelighed|sandheden|stop|glem|de fleste|alle tror|du gør det forkert)/i
const META = /\b(denne karrusel|dette opslag|i dag vil jeg|slide|swipe|karrusel)\b/i
const FORBEHOLD = /ingen muskler|skøn|målefejl|ikke uden fejl|i hånden/
let alleTekster = ''
for (const [nr, k] of Object.entries(KARRUSELLER)) {
  const bt = readFileSync(join(K, k.billedtekst), 'utf8').replace(/\r/g, '').trim()
  const html = readdirSync(join(K, k.mappe, 'html')).filter((f) => f.endsWith('.html')).sort().map((f) => tekstAf(readFileSync(join(K, k.mappe, 'html', f), 'utf8')))
  const png = readdirSync(join(K, k.mappe)).filter((f) => f.endsWith('.png')).sort().map((f) => { const b = readFileSync(join(K, k.mappe, f)); return { f, w: b.readUInt32BE(16), h: b.readUInt32BE(20) } })
  const alt = [bt, ...k.slides.map((s) => s.tekst), ...html].join(' \n ')
  alleTekster += alt
  // Forbeholdene: tekstslides uden tegning til sidst; ingen forbeholdsord paa slides foer dem
  const foersteRen = k.slides.findIndex((s) => s.tegning === null)
  const sidste = foersteRen >= 0 ? k.slides.slice(foersteRen) : []
  const r = {
    slides: k.slides.length, png, billedtekst: bt, bogstaver: bt.length,
    tankestreger: (alt.match(/[\u2013\u2014]/g) || []).length,
    navne: !udenNavne(alt), opfordring: [...k.slides.map((s) => s.tekst), bt].filter((t) => OPFORDRING.test(t)),
    drama: DRAMA.test(k.slides[0].tekst) || DRAMA.test(bt), meta: [...k.slides.map((s) => s.tekst), bt].filter((t) => META.test(t)),
    forbeholdNederst: sidste.length > 0 && sidste.every((s) => s.tegning === null && FORBEHOLD.test(s.tekst)) && k.slides.slice(0, foersteRen).every((s) => !FORBEHOLD.test(s.tekst)), forbeholdSlides: sidste.length,
    slut: bt.split(/(?<=\.)\s+/).pop(),
  }
  ud.karruseller[nr] = r
  paastaa(`K${nr}: ${r.slides} slides, alle ${r.png.length} PNG 1080 x 1350`, r.png.length === r.slides && r.png.every((p) => p.w === 1080 && p.h === 1350), r.png.map((p) => `${p.w}x${p.h}`))
  paastaa(`K${nr}: 0 tankestreger, 0 atletnavne, ingen opfordring, ingen dramatisk aabning, ingen meta (slides, tegninger og billedtekst)`, !r.tankestreger && !r.navne && !r.opfordring.length && !r.drama && !r.meta.length, { opf: r.opfordring, meta: r.meta })
  paastaa(`K${nr}: forbeholdene staar paa de sidste slides og ikke foer`, r.forbeholdNederst)
  paastaa(`K${nr}: billedteksten slutter med en neutral henvisning til entropicoaching.dk ("${r.slut}")`, /entropicoaching\.dk\.$/.test(bt) && !OPFORDRING.test(r.slut))
}

// --- 2) laesbar paa en telefon ---------------------------------------------------------------------
const browser = await chromium.launch({ headless: true })
const MAAL = () => {
  const lum = (c) => { const m = c.match(/\d+(\.\d+)?/g).map(Number); const [r, g, b] = m.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
  const kontrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
  const bg = getComputedStyle(document.body).backgroundColor
  const ud = []
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  while (walk.nextNode()) {
    const n = walk.currentNode; if (!n.textContent.trim()) continue
    const e = n.parentElement, cs = getComputedStyle(e), rg = document.createRange(); rg.selectNodeContents(n); const r = rg.getBoundingClientRect()
    if (cs.visibility === 'hidden' || cs.display === 'none' || r.width === 0) continue
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
    pr.push({ f, tekster: m.length, mindstePx: mindst.px, mindsteTelefonPx: Math.round(mindst.px * 390 / 1080 * 10) / 10, hvad: mindst.t, lavKontrast: Math.min(...m.map((x) => x.kontrast)), kant: Math.min(...m.map((x) => x.kant)), slideTekstPx: Math.max(...m.map((x) => x.px)) })
  }
  await page.close()
  ud.laesbar[nr] = pr
  paastaa(`K${nr}: al tekst mindst 30 px i 1080 (ca. 10,8 px paa en 390 px telefon), kontrast mindst 4,5, mindst 40 px fra kanten`, pr.every((p) => p.mindstePx >= 30 && p.lavKontrast >= 4.5 && p.kant >= 40), pr.map((p) => [p.f.slice(6, 8), p.mindstePx, p.lavKontrast, p.kant]))
}
// Slides i telefonstoerrelse til rapporten (390 px brede, som i Instagrams feed)
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
// [karrusel, hvor, paastanden, kilden siger det]
const par = [
  [1, 'slide 1', /seks punkter i fast rækkefølge/.test(S(1, 1)), /Klik de seks punkter i rækkefølge/.test(vejl) && /måler siden ledvinklerne, torsoens hældning og stangens vandrette afstand til midtfoden/.test(vejl)],
  [1, 'slide 2', /samme fase og skala, med midtfoden og gulvet samme sted/.test(S(1, 2)) && /i blåt/.test(S(1, 2)), /Modellen står i samme fase, i samme skala og med midtfoden og gulvet samme sted/.test(vejl) && /Dine klik står tyndt i blåt oven på modellen/.test(vejl)],
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
  [1, 'billedtekst', /"Ligner" står kun, når tallene flytter sig samme vej som en af modellens tegnede fejl og mere end klikfejlen/.test(BT(1)) && /forskelle under ca\. 4° eller 3 cm kan klikkene selv give/.test(BT(1)), true],
  [2, 'billedtekst', /3-4 m i squat, mindst 3 m i dødløft, præcis 3 m i sumo og 3 m i bænkpres/.test(BT(2)), /Mindst 3 m/.test(film) && /Præcis 3 m væk/.test(film) && /3 m væk, ud for stangen, når den ligger på brystet/.test(film)],
]
ud.sandhed = par.map(([nr, hvor, a, b]) => ({ nr, hvor, paaSlide: a, iKilden: b }))
paastaa(`${par.length} paastande paa slides og i billedteksterne staar som skrevet og passer med vejledningen (main ${lmTop}) eller FILM-KLIP`, ud.sandhed.every((x) => x.paaSlide && x.iKilden), ud.sandhed.filter((x) => !x.paaSlide || !x.iKilden))

// Slide 3: tabellen er Min krops "tabel" fra 524 (kroppe.json). Hvad viser Maal dit billede selv for samme krop?
const kroppe = JSON.parse(readFileSync(join(K, 'kroppe.json'), 'utf8'))
const tegn = readFileSync(join(K, 'tegn.mjs'), 'utf8')
const typer = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.css': 'text/css' }
const server = createServer((req, res) => { const f = join(dir, decodeURIComponent(req.url.split('?')[0])); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end() } res.writeHead(200, { 'content-type': typer[path.extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f)) }).listen(0)
const BASE = `http://127.0.0.1:${server.address().port}`
const page = await browser.newPage({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
await page.route('**/*', (r) => (r.request().url().startsWith(BASE) || /^(data|blob):/.test(r.request().url()) ? r.continue() : r.abort()))
await page.goto(`${BASE}/dist/maal-billede/index.html`)
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
  const under = document.querySelector('[data-resultat]')?.innerText.replace(/\s+/g, ' ') || ''
  return { tab, ligner: { status: e.dataset.status, tekst: e.textContent.replace(/\s+/g, ' ').trim() }, under: under.slice(0, 1500) }
}, klik)
ud.vaerktoejet.langeLaar = vk
await page.locator('[data-resultat]').scrollIntoViewIfNeeded().catch(() => {})
await page.screenshot({ path: join(HERE, 'K1-390-vaerktoejet-lange-laar.png') })
const raekke = (re) => vk.tab.find((r) => re.test(r[0] || ''))
ud.vaerktoejet.raekker = vk.tab.map((r) => r[0])
paastaa('K3 (fund): Maal dit billede har ingen skinneben-raekke i squattens tabel for samme krop; slide 3 viser skinneben 45 mod 40 (+5, guld), som er Min krops/modellens valg', !raekke(/^Skinneben/i) && !!raekke(/^Knævinkel/) && /\['skinneben', 'Skinneben fra lodret'\]/.test(tegn) && kroppe.lange.tabel.find((t) => t.navn === 'Skinneben fra lodret').forskel === 5 && /Det, modellen selv vælger, fx squattens skinneben/.test(vejl), { raekker: ud.vaerktoejet.raekker })
const kn = raekke(/^Knævinkel/)
ud.vaerktoejet.knae = kn
const tal = (x) => parseFloat(String(x).replace(/[^0-9,−-]/g, '').replace(',', '.').replace('−', '-'))
paastaa('slide 3 knaeet (41,4 mod 46,1), hoften (34,6 mod 36,9) og overkroppen (51,8 mod 49,2) staar ogsaa i vaerktoejet for samme krop', kn && Math.abs(tal(kn[1]) - 41.4) <= 0.1 && Math.abs(tal(kn[2]) - 46.1) <= 0.1 && Math.abs(tal(raekke(/^Hoftevinkel/)[1]) - 34.6) <= 0.1 && Math.abs(tal(raekke(/^Torso/)[2]) - 49.2) <= 0.1, vk.tab)
const st = raekke(/^Stangen foran midtfoden/)
ud.vaerktoejet.stang = st
paastaa('K3 (fund): vaerktoejet viser stangen -0,7 cm (bag midtfoden) og ingen modelvaerdi uden stangens vaegt; slide 3 viser 0,7 mod 0,8 cm', st && tal(st[1]) < 0 && /skriv stangens vægt/.test(st[2]), st)
paastaa('Maal dit billede siger "Ligner ikke" om den tegnede krop med lange laar (den er modellens egen udfoerelse)', vk.ligner.status === 'ingen', vk.ligner.tekst.slice(0, 120))

// Slide 4: fejlfiguren "kun knaeene" er Setus egen (10 grader); modellens er en anden
const { squatBilleder } = await import(pathToFileURL(join(dir, 'src', 'fejlgenkendelseMaaling.js')).href)
const { indstilling } = await import(pathToFileURL(join(dir, 'src', 'minKrop.js')).href)
const sq = squatBilleder({ ...indstilling('squat', { hoejde: 178, vaegt: 85 }, { gennemsnit: true }) })
const skinneben = (P) => Math.atan2(P.knae.x - P.ankel.x, P.knae.y - P.ankel.y) * 180 / Math.PI
const torso = (P) => Math.atan2(Math.abs(P.skulder.x - P.hofte.x), P.skulder.y - P.hofte.y) * 180 / Math.PI
const nB = sq.normal['squat-bund'][0].P, fB = sq.fejl['sq-kun-knae-bund'][0].P
ud.fejlfigur = { modelSkinnebenMere: Math.round((Math.abs(skinneben(fB)) - Math.abs(skinneben(nB))) * 10) / 10, modelTorsoMere: Math.round((torso(fB) - torso(nB)) * 10) / 10, setu: 10, regel: 8 }
paastaa('K4 (fund): slide 4\'s "kun knaeene" er tegnet med skinnebenet 10 grader frem; modellens egen fejlfigur har det ca. 17 grader frem og hoften under stangen; reglen siger 8', /skinnebenet 10° længere frem/.test(tegn) && ud.fejlfigur.modelSkinnebenMere > 14 && /skinnebenet mindst 8°/.test(vejl), ud.fejlfigur)

// Billedteksterne peger paa sitet: hvad ligger paa sitets main i dag?
const mainFiler = sh(`git -C "${SITE}" ls-tree -r --name-only main`).split('\n')
ud.sitet = {
  vaerktoejer: mainFiler.includes('vaerktoejer/index.html'),
  artikler: mainFiler.filter((f) => /^artikel-(squat|doedloeft|baenk)[^/]*\.html$/.test(f)),
  treLoeftArtikler: ['artikel-squat.html', 'artikel-doedloeft.html', 'artikel-baenk.html'].filter((f) => mainFiler.includes(f)),
}
paastaa('K1 (fund): billedtekst 1 siger "Maal dit billede og artiklerne om de tre loeft ligger paa entropicoaching.dk"; paa sitets main ligger i dag hverken vaerktoejssiden eller de tre loeft-artikler', /Mål dit billede og artiklerne om de tre løft ligger på entropicoaching\.dk\./.test(BT(1)) && !ud.sitet.vaerktoejer && ud.sitet.treLoeftArtikler.length === 0, ud.sitet)

const { createHash } = await import('node:crypto')
ud.filer = {}
const alleFiler = (d, rel = '') => readdirSync(join(d, rel), { withFileTypes: true }).flatMap((e) => e.isDirectory() ? alleFiler(d, join(rel, e.name)) : [join(rel, e.name).split(path.sep).join('/')])
for (const f of alleFiler(K)) ud.filer[f] = createHash('sha256').update(readFileSync(join(K, f))).digest('hex')
await browser.close(); server.close()
writeFileSync(join(HERE, 'karruseller-576.json'), JSON.stringify({ ...ud, tjek }, null, 1))
const roede = tjek.filter((t) => !t.ok)
console.log(`\nkarruseller-576: ${tjek.length - roede.length}/${tjek.length} tjek groenne`)
process.exit(roede.length ? 1 : 0)
