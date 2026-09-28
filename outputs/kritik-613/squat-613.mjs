// Kritik 613, blok 1: squat-artiklen paa udgivelse-squat-min-krop (Setu 607, f3c1684) og LAES-SQUAT.html.
// Sitet hentes med `git archive` fra entropi-coaching-site-wt2 (traeet roeres ikke), ogsaa 25d6a41 (gammel kapitel 6)
// til sammenligning. Google Chrome (den installerede) headless, 390 touch og 1280 mus, alt net uden for den lokale
// server afbrudt (ogsaa Google Fonts). LAES-SQUAT.html aabnes som file:// fra skrivebordet, kun laest.
//   node outputs/kritik-613/squat-613.mjs   -> squat-613.json og Q-*.png
import path, { join } from 'node:path'
import { tmpdir } from 'node:os'
import { writeFileSync, readFileSync, mkdtempSync, existsSync, statSync, mkdirSync, rmSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { createServer } from 'node:http'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from '../../e2e/harness.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SITE = 'C:/Users/Entropi/Desktop/entropi-coaching-site-wt2'
const GREN = 'refs/heads/udgivelse-squat-min-krop'
const LAES = 'C:/Users/Entropi/Desktop/LAES-SQUAT.html'
const sh = (c) => execSync(c, { maxBuffer: 1 << 26 }).toString()
const ver = { gren: sh(`git -C "${SITE}" rev-parse --short ${GREN}`).trim(), gammel: '25d6a41' }
const dir = mkdtempSync(join(tmpdir(), 'k613-'))
const hent = (ref, hvor) => { mkdirSync(hvor, { recursive: true }); execSync(`git -C "${SITE}" archive -o "${join(hvor, 'a.tar')}" ${ref}`); execSync('tar -xf a.tar', { cwd: hvor }); rmSync(join(hvor, 'a.tar')) }
const web = join(dir, 'ny'), webG = join(dir, 'gammel')
hent(GREN, web); hent(ver.gammel, webG)
const tjek = []
const paastaa = (hvad, ok, data) => { tjek.push({ hvad, ok: !!ok, data }); console.log(`${ok ? 'ok ' : 'NEJ'} ${hvad}${data !== undefined ? ' ' + JSON.stringify(data).slice(0, 600) : ''}`) }
const ud = { ver, visninger: [], laes: [], tekst: {} }

// --- Teksten: linje for linje i kilden ------------------------------------------------------------------
const kilde = readFileSync(join(web, 'artikel-squat.html'), 'utf8').split(/\r?\n/)
const synlig = (l) => l.replace(/<!--.*?-->/g, '').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ')
const k6 = kilde.map((l, i) => ({ n: i + 1, l })).filter(({ n }) => n >= 484 && n <= 544)
const find = (re, linjer = kilde.map((l, i) => ({ n: i + 1, l })), fra = 41, til = 766) => linjer.filter(({ n, l }) => n >= fra && n <= til && re.test(synlig(l))).map(({ n }) => n)
ud.tekst = {
  marc: find(/\bMarcs?\b/),
  tankestreg: find(/[\u2013\u2014]/),
  jegIK6: find(/\b(jeg|mig|min|mit|mine)\b/i, k6),
  jegIAlt: find(/\b(jeg|mig|min|mit|mine)\b/i).length,
  opfordring: find(/(^|[.>]\s*)(Skriv|Se|Prøv|Brug|Læs|Klik|Find|Husk|Tjek|Følg)\s/),
  metaK6: find(/(kapitel \d|figuren|tabellen|her )/i, k6),
  forbeholdK6Broed: k6.filter(({ l }) => /<p>|<caption>|class="svar"/.test(l) && /(ikke en løfter|ikke at modellen rammer|ikke hvad en bestemt løfter|usikkerhed i målingen|antaget)/.test(synlig(l))).map(({ n }) => n),
  gulMidtfod: find(/gule streg er midtfoden/),
  orangeMidtfod: find(/orange mærke ved foden er midtfoden/),
}
paastaa('Ingen "Marc"/"Marcs" i artiklens synlige tekst foer forfatterlinjen (linje 41-749)', !find(/\bMarcs?\b/, undefined, 41, 749).length, ud.tekst.marc)
paastaa('0 tankestreger i synlig tekst', !ud.tekst.tankestreg.length, ud.tekst.tankestreg)
paastaa('Kapitel 6 (484-544) har ingen jeg-form (hverken "Marcs" eller "jeg/mit")', !ud.tekst.jegIK6.length, { jegIK6: ud.tekst.jegIK6, jegIAlt: ud.tekst.jegIAlt })
paastaa('Kapitel 6: forbehold i broedteksten over "Gaa dybere" (linjenumre)', true, ud.tekst.forbeholdK6Broed)
paastaa('Midtfoden kaldes "gule streg" i kapitel 6 og "orange maerke" i kapitel 1 (samme farve #c8923a)', ud.tekst.gulMidtfod.length && ud.tekst.orangeMidtfod.length, { gul: ud.tekst.gulMidtfod, orange: ud.tekst.orangeMidtfod })

// --- Server ---------------------------------------------------------------------------------------------
const typer = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.json': 'application/json', '.woff2': 'font/woff2' }
const f404 = []
const server = createServer((req, res) => {
  const [, rod, ...rest] = decodeURIComponent(req.url.split('?')[0].split('#')[0]).split('/')
  let f = join(rod === 'gammel' ? webG : web, '/' + rest.join('/'))
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html')
  if (!existsSync(f)) { f404.push(req.url); res.writeHead(404); return res.end() }
  res.writeHead(200, { 'content-type': typer[path.extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f))
}).listen(0)
const BASE = `http://127.0.0.1:${server.address().port}`
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const browser = await chromium.launch({ headless: true, executablePath: CHROME })
ud.chrome = browser.version()
const eksterne = new Set()
const side = async (bredde) => {
  const mobil = bredde < 600
  const ctx = await browser.newContext({ viewport: { width: bredde, height: mobil ? 780 : 900 }, deviceScaleFactor: mobil ? 2 : 1, isMobile: mobil, hasTouch: mobil })
  const page = await ctx.newPage()
  const fejl = []
  page.on('pageerror', (e) => fejl.push(e.message))
  await page.route('**/*', (r) => { const u = r.request().url(); if (u.startsWith(BASE) || u.startsWith('file:') || /^(data|blob):/.test(u)) return r.continue(); eksterne.add(u.split('?')[0]); return r.abort() })
  return { ctx, page, fejl, mobil }
}

// --- Artiklen, ny og gammel kapitel 6 ------------------------------------------------------------------------
for (const [hvilken, rod] of [['ny', 'ny'], ['gammel', 'gammel']]) {
  for (const bredde of [390, 1280]) {
    const { ctx, page, fejl } = await side(bredde)
    await page.goto(`${BASE}/${rod}/artikel-squat.html#kap-virkeligheden`, { waitUntil: 'load' })
    await page.waitForTimeout(800)
    const v = await page.evaluate(() => {
      const k = document.getElementById('kap-virkeligheden')
      const imgs = [...k.querySelectorAll('img')].map((i) => ({ src: i.getAttribute('src').split('/').pop(), ok: i.complete && i.naturalWidth > 0, w: Math.round(i.getBoundingClientRect().width) }))
      const tabeller = [...k.querySelectorAll('table')].map((t) => {
        const w = t.closest('.mom-tabel-wrap') || t.parentElement
        const cap = t.querySelector('caption')
        const sidsteKol = t.querySelector('thead th:last-child')
        return { tabelB: Math.round(t.getBoundingClientRect().width), rammeB: Math.round(w.clientWidth), ruller: w.scrollWidth > w.clientWidth + 1, captionB: cap ? Math.round(cap.getBoundingClientRect().width) : null, modelKolSynligUdenRul: sidsteKol ? sidsteKol.getBoundingClientRect().right <= w.getBoundingClientRect().right + 1 : null }
      })
      const tekst = k.innerText
      return { imgs, tabeller, ord: tekst.split(/\s+/).filter(Boolean).length, sidelaens: document.documentElement.scrollWidth > window.innerWidth + 1, mount: !!document.querySelector('#maalt-over-model-mount .mom, #maalt-over-model-mount svg, #maalt-over-model-mount canvas'), marcSynlig: /\bMarcs?\b/.test(document.querySelector('.article-body').innerText), mit: /Mit eget klip|mit målte skelet/.test(tekst) }
    })
    const png = `Q-${bredde}-${hvilken}-k6.png`
    const kap = await page.$('#kap-virkeligheden')
    await kap.screenshot({ path: join(HERE, png) })
    const r = { hvilken, bredde, ...v, jsFejl: [...fejl], png }
    ud.visninger.push(r)
    await ctx.close()
  }
}
for (const r of ud.visninger) {
  if (r.hvilken === 'ny') paastaa(`Ny kapitel 6 ${r.bredde}: to figurer indlaest, 0 JS-fejl, ingen sidelaens rulning, intet "Marc" i broedteksten`, r.imgs.length === 2 && r.imgs.every((i) => i.ok) && !r.jsFejl.length && !r.sidelaens && !r.marcSynlig, { imgs: r.imgs, ord: r.ord })
  else paastaa(`Gammel kapitel 6 (${ver.gammel}) ${r.bredde}: indlejringen tegnes, "Mit eget klip"/"mit maalte skelet" staar, 0 JS-fejl`, r.mount && r.mit && !r.jsFejl.length && !r.marcSynlig, { imgs: r.imgs.length, ord: r.ord, jsFejl: r.jsFejl })
}
const ny390 = ud.visninger.find((r) => r.hvilken === 'ny' && r.bredde === 390)
paastaa('Ny kapitel 6 paa 390: tabellerne ruller sidelaens i deres ramme, Model-kolonnen og tabelteksten er uden for skaermen uden rul', ny390.tabeller.every((t) => t.ruller && !t.modelKolSynligUdenRul && t.captionB > t.rammeB), ny390.tabeller)
const ny1280 = ud.visninger.find((r) => r.hvilken === 'ny' && r.bredde === 1280)
paastaa('Ny kapitel 6 paa 1280: tabellerne ruller ikke', ny1280.tabeller.every((t) => !t.ruller), ny1280.tabeller)

// --- LAES-SQUAT.html ----------------------------------------------------------------------------------------
for (const bredde of [390, 1280]) {
  const { ctx, page, fejl } = await side(bredde)
  await page.goto(pathToFileURL(LAES).href, { waitUntil: 'load' })
  await page.evaluate(() => document.getElementById('k6-to').scrollIntoView())
  await page.waitForTimeout(600)
  const v = await page.evaluate(() => {
    const s = document.getElementById('k6-to')
    const figs = [...s.querySelectorAll('.k6par figure')].map((f) => {
      const img = f.querySelector('img'), rul = f.querySelector('.rul'), r = f.getBoundingClientRect()
      return { lbl: f.querySelector('.lbl').textContent, ok: img.complete && img.naturalWidth > 0, natur: [img.naturalWidth, img.naturalHeight], vist: [Math.round(img.getBoundingClientRect().width), Math.round(img.getBoundingClientRect().height)], rulH: rul.clientHeight, kanRulle: rul.scrollHeight > rul.clientHeight + 1, x: Math.round(r.left), y: Math.round(r.top + window.scrollY) }
    })
    const svar = [...document.querySelectorAll('code')].map((c) => c.textContent).filter((t) => /squat kapitel 6/.test(t))
    const top = document.body.innerText.slice(0, 1400)
    return { figs, svar, sidelaens: document.documentElement.scrollWidth > window.innerWidth + 1, svarOeverst: /squat kapitel 6: ny/.test(top), vaerdiSkala: figs.map((f) => +(f.vist[0] / f.natur[0]).toFixed(2)) }
  })
  const png = `Q-${bredde}-laes-squat-k6.png`
  await page.screenshot({ path: join(HERE, png) })
  ud.laes.push({ bredde, ...v, jsFejl: [...fejl], png })
  await ctx.close()
}
for (const r of ud.laes) {
  paastaa(`LAES-SQUAT ${r.bredde}: ny og gammel kapitel 6 begge indlaest og rullbare, svarlinjerne "squat kapitel 6: ny/gammel" staar oeverst, 0 JS-fejl, ingen sidelaens rulning`, r.figs.length === 2 && r.figs.every((f) => f.ok && f.kanRulle) && r.svarOeverst && r.svar.length >= 2 && !r.jsFejl.length && !r.sidelaens, { figs: r.figs, svar: r.svar })
}
const l390 = ud.laes.find((r) => r.bredde === 390)
paastaa('LAES-SQUAT 390: de to kapitler staar under hinanden (ikke side om side), billederne er 350 px brede skaermbilleder vist 1:1 (1x, bloede paa en 3x-telefon)', l390.figs[1].y > l390.figs[0].y && l390.figs[0].x === l390.figs[1].x, { skala: l390.vaerdiSkala, natur: l390.figs.map((f) => f.natur) })
ud.eksterne = [...eksterne]; ud.f404 = f404
paastaa('Alt net uden for den lokale server afbrudt; 0 fejl 404', !f404.length, { afbrudt: ud.eksterne })
ud.tjek = tjek
await browser.close(); server.close()
rmSync(dir, { recursive: true, force: true })
writeFileSync(join(HERE, 'squat-613.json'), JSON.stringify(ud, null, 1))
console.log(`${tjek.filter((t) => t.ok).length}/${tjek.length}`)
