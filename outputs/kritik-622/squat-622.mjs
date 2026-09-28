// Kritik 622, blok 1: squat-artiklen paa udgivelse-squat-min-krop efter Setus 615 (2b0f368 + 9ae75d5) og
// Desktop/LAES-SQUAT.html. Sitet hentes med `git archive` fra entropi-coaching-site-wt2 (traeet roeres ikke),
// ogsaa f3c1684 (kapitel 6 foer 615) til sammenligning. Google Chrome (den installerede) headless, 390 touch og
// 1280 mus, alt net uden for den lokale server afbrudt (ogsaa Google Fonts). LAES-SQUAT.html som file://, kun laest.
//   node outputs/kritik-622/squat-622.mjs   -> squat-622.json og Q-*.png
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
const ver = { gren: sh(`git -C "${SITE}" rev-parse --short ${GREN}`).trim(), foer615: 'f3c1684' }
const dir = mkdtempSync(join(tmpdir(), 'k622-'))
const hent = (ref, hvor) => { mkdirSync(hvor, { recursive: true }); execSync(`git -C "${SITE}" archive -o "${join(hvor, 'a.tar')}" ${ref}`); execSync('tar -xf a.tar', { cwd: hvor }); rmSync(join(hvor, 'a.tar')) }
const web = join(dir, 'ny'), webF = join(dir, 'foer')
hent(GREN, web); hent(ver.foer615, webF)
const tjek = []
const paastaa = (hvad, ok, data) => { tjek.push({ hvad, ok: !!ok, data }); console.log(`${ok ? 'ok ' : 'NEJ'} ${hvad}${data !== undefined ? ' ' + JSON.stringify(data).slice(0, 600) : ''}`) }
const ud = { ver, visninger: [], laes: [], tekst: {} }

// --- Teksten: linje for linje i kilden ------------------------------------------------------------------
const kilde = readFileSync(join(web, 'artikel-squat.html'), 'utf8').split(/\r?\n/)
const L = kilde.map((l, i) => ({ n: i + 1, l }))
const idx = (re) => L.find(({ l }) => re.test(l)).n
const k6fra = idx(/id="kap-virkeligheden"/), k6til = idx(/id="kap-fejlbilleder"/) - 1
const forfatter = idx(/class="author-strip"/), forbFra = idx(/id="forbehold"/), forbTil = idx(/id="referencer"/)
const synlig = (l) => l.replace(/<!--.*?-->/g, '').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ')
const k6 = L.filter(({ n }) => n >= k6fra && n <= k6til)
const find = (re, linjer = L, fra = 41, til = forfatter) => linjer.filter(({ n, l }) => n >= fra && n <= til && re.test(synlig(l))).map(({ n }) => n)
const forbeholdTekst = L.filter(({ n }) => n >= forbFra && n < forbTil).map(({ l }) => synlig(l)).join(' ')
const FORB = ['ikke en løfter', 'ikke hvad en bestemt løfter gør', '"inden for" betyder ikke, at modellen rammer', 'klikfejlen og ét kamera', 'usikkerheden i målingen']
ud.tekst = {
  k6: [k6fra, k6til], forbehold: [forbFra, forbTil],
  marc: find(/\bMarcs?\b/),
  tankestreg: find(/[\u2013\u2014]/),
  jegIK6: find(/\b(jeg|mig|min|mit|mine)\b/i, k6),
  svarlinje: k6.filter(({ l }) => /class="svar"/.test(l)).map(({ n, l }) => ({ n, t: synlig(l).trim() })),
  metaK6: find(/(Metoden vises|kapitlet viser|her vises)/i, k6),
  forbeholdK6Broed: k6.filter(({ l }) => /<p>|<caption>|class="svar"|<dd>/.test(l) && /(ikke en løfter|ikke at modellen rammer|ikke hvad en bestemt løfter|usikkerhed i målingen|antaget)/.test(synlig(l))).map(({ n }) => n),
  forbeholdNederst: FORB.map((f) => ({ f, ok: forbeholdTekst.includes(f) })),
  gul: find(/gule streg/, k6), orange: find(/orange streg er midtfoden/, k6),
  alleKlik: find(/alle (fem|ti) klik|ved alle (fem|ti)/, k6),
  andele: { a999: find(/999/, k6), a852: find(/852/, k6) },
  runderTusind: find(/af\s+1000\s+runder|1000\s+runder|2000\s+runder/, k6),
  runderToHundrede: find(/200\s+runder/, k6),
  promise: find(/Indtil mit eget klip/, k6),
  laesetid: (kilde.join('\n').match(/(\d+) min\. læsning/) || [])[1],
}
paastaa(`Ingen "Marc"/"Marcs" i artiklens synlige tekst foer forfatterlinjen (41-${forfatter})`, !ud.tekst.marc.length, ud.tekst.marc)
paastaa('0 tankestreger i synlig tekst', !ud.tekst.tankestreg.length, ud.tekst.tankestreg)
paastaa('Kapitel 6 har jeg-form (Q3) og "Indtil mit eget klip" staar der', ud.tekst.jegIK6.length >= 1 && ud.tekst.promise.length === 1, { jeg: ud.tekst.jegIK6, promise: ud.tekst.promise })
paastaa('Svarlinjen i kapitel 6 er et fund, ingen "Metoden vises" (Q3)', ud.tekst.svarlinje.length === 1 && /^Målingen skiller/.test(ud.tekst.svarlinje[0].t) && !ud.tekst.metaK6.length, ud.tekst.svarlinje)
paastaa('Kapitel 6: ingen forbehold i broedteksten, og Forbehold nederst rummer alle fem (Q4)', !ud.tekst.forbeholdK6Broed.length && ud.tekst.forbeholdNederst.every((x) => x.ok), { broed: ud.tekst.forbeholdK6Broed, nederst: ud.tekst.forbeholdNederst })
paastaa('Midtfoden er "orange streg", ingen "gule streg" (Q5)', !ud.tekst.gul.length && ud.tekst.orange.length, { gul: ud.tekst.gul, orange: ud.tekst.orange })
paastaa('Ingen "alle fem/ti klik"; 999 og 852 af 1000 staar (Q2)', !ud.tekst.alleKlik.length && ud.tekst.andele.a999.length && ud.tekst.andele.a852.length, ud.tekst.andele)
paastaa('R2: "runder" bruges om to ting: "af 1000 runder" (en runde = eet klik) og "200 runder af fem" (en runde = fem klik)', ud.tekst.runderTusind.length && ud.tekst.runderToHundrede.length, { tusind: ud.tekst.runderTusind, toHundrede: ud.tekst.runderToHundrede })

// --- Server ---------------------------------------------------------------------------------------------
const typer = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.json': 'application/json', '.woff2': 'font/woff2' }
const f404 = []
const server = createServer((req, res) => {
  const [, rod, ...rest] = decodeURIComponent(req.url.split('?')[0].split('#')[0]).split('/')
  let f = join(rod === 'foer' ? webF : web, '/' + rest.join('/'))
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

// --- Artiklen: kapitel 6 efter 615 og foer (f3c1684) -------------------------------------------------------
for (const [hvilken, rod] of [['ny', 'ny'], ['foer615', 'foer']]) {
  for (const bredde of [390, 1280]) {
    const { ctx, page, fejl } = await side(bredde)
    await page.goto(`${BASE}/${rod}/artikel-squat.html#kap-virkeligheden`, { waitUntil: 'load' })
    await page.evaluate(() => document.querySelectorAll('#kap-virkeligheden details').forEach((d) => { d.open = true }))
    await page.waitForTimeout(800)
    const v = await page.evaluate(() => {
      const k = document.getElementById('kap-virkeligheden')
      const px = (el) => el ? +parseFloat(getComputedStyle(el).fontSize).toFixed(1) : null
      const imgs = [...k.querySelectorAll('img')].map((i) => ({ src: i.getAttribute('src').split('/').pop(), ok: i.complete && i.naturalWidth > 0, w: Math.round(i.getBoundingClientRect().width) }))
      const tabeller = [...k.querySelectorAll('table')].map((t) => {
        const w = t.closest('.mom-tabel-wrap') || t.parentElement
        const wr = w.getBoundingClientRect()
        const celler = [...t.querySelectorAll('th,td')]
        const udenfor = celler.filter((c) => c.getBoundingClientRect().right > wr.right + 1).map((c) => c.textContent.trim().slice(0, 30))
        const kol = [...t.querySelectorAll('thead th')].map((th) => ({ t: th.textContent.trim(), b: Math.round(th.getBoundingClientRect().width) }))
        return { tabelB: Math.round(t.getBoundingClientRect().width), rammeB: Math.round(w.clientWidth), ruller: w.scrollWidth > w.clientWidth + 1, udenfor, kol, px: { maalt: px(t.querySelector('.mom-maalt')), afv: px(t.querySelector('td .mom-model')), model: px(t.querySelector('th .mom-model')), caption: px(t.querySelector('caption')), led: px(t.querySelector('tbody th')) }, hoejde: Math.round(t.getBoundingClientRect().height) }
      })
      const tekst = k.innerText
      return { imgs, tabeller, ord: tekst.split(/\s+/).filter(Boolean).length, sidelaens: document.documentElement.scrollWidth > window.innerWidth + 1, marcSynlig: /\bMarcs?\b/.test(document.querySelector('.article-body')?.innerText || ''), broed: px(k.querySelector('p:not(.svar)')) }
    })
    const png = `Q-${bredde}-${hvilken}-k6.png`
    await (await page.$('#kap-virkeligheden')).screenshot({ path: join(HERE, png) })
    if (hvilken === 'ny') await (await page.$('#forbehold')).screenshot({ path: join(HERE, `Q-${bredde}-ny-forbehold.png`) })
    ud.visninger.push({ hvilken, bredde, ...v, jsFejl: [...fejl], png })
    await ctx.close()
  }
}
for (const r of ud.visninger.filter((r) => r.hvilken === 'ny')) {
  paastaa(`Kapitel 6 (${ver.gren}) ${r.bredde}: to figurer indlaest, 0 JS-fejl, ingen sidelaens rulning, intet "Marc" i broedteksten`, r.imgs.length === 2 && r.imgs.every((i) => i.ok) && !r.jsFejl.length && !r.sidelaens && !r.marcSynlig, { imgs: r.imgs, ord: r.ord })
  paastaa(`Kapitel 6 ${r.bredde}: tabellerne ruller ikke, ingen celle uden for rammen, "Kun knaeene" er anden kolonne (Q1)`, r.tabeller.length === 2 && r.tabeller.every((t) => !t.ruller && !t.udenfor.length && /kun knæene/i.test(t.kol[1]?.t)), r.tabeller.map((t) => ({ b: t.tabelB, ramme: t.rammeB, kol: t.kol, px: t.px })))
}
const f390 = ud.visninger.find((r) => r.hvilken === 'foer615' && r.bredde === 390)
paastaa('Foer 615 (f3c1684) paa 390: tabellerne rullede (Q1 var rigtig)', f390.tabeller.every((t) => t.ruller), f390.tabeller.map((t) => ({ b: t.tabelB, ramme: t.rammeB })))
const n390 = ud.visninger.find((r) => r.hvilken === 'ny' && r.bredde === 390)
paastaa('R4: paa 390 er tabellernes mindste skrift (afvigelse og model) under 11 px, broedteksten til sammenligning', true, { tabel: n390.tabeller[0].px, broed: n390.broed })

// --- LAES-SQUAT.html ----------------------------------------------------------------------------------------
const laesKilde = readFileSync(LAES, 'utf8')
const laesTxt = (id) => { const i = laesKilde.indexOf(`id="${id}"`); return laesKilde.slice(i, i + 6000).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ') }
ud.laesTekst = {
  v2Forældet: /Med den nye udgave er linjen\s*Metoden vises her på en low bar-squat/.test(laesTxt('v2')),
  v2ScriptForaeldet: /607's udgivelsesscript/.test(laesTxt('v2')),
  hovedMeta: /2b0f368/.test(laesKilde) && /9ae75d5/.test(laesKilde),
  promiseSynligForMarc: /indtil dit eget klip/.test(laesKilde),
  helArtikelGammel: /kapitel 6 herunder er den gamle udgave/.test(laesKilde),
}
paastaa('R3: LAES-SQUAT valg 2 (U6) siger stadig, at den nye linje er "Metoden vises her paa en low bar-squat." og naevner 607\'s script', ud.laesTekst.v2Forældet && ud.laesTekst.v2ScriptForaeldet, ud.laesTekst)
for (const bredde of [390, 1280]) {
  const { ctx, page, fejl } = await side(bredde)
  await page.goto(pathToFileURL(LAES).href, { waitUntil: 'load' })
  await page.evaluate(() => document.getElementById('k6-to').scrollIntoView())
  await page.waitForTimeout(800)
  const v = await page.evaluate(() => {
    const s = document.getElementById('k6-to')
    const figs = [...s.querySelectorAll('figure')].filter((f) => f.querySelector('.rul')).map((f) => {
      const img = f.querySelector('img'), rul = f.querySelector('.rul'), r = f.getBoundingClientRect()
      return { lbl: f.querySelector('.lbl')?.textContent, ok: img.complete && img.naturalWidth > 0, natur: [img.naturalWidth, img.naturalHeight], vist: Math.round(img.getBoundingClientRect().width), kanRulle: rul.scrollHeight > rul.clientHeight + 1, x: Math.round(r.left), y: Math.round(r.top + window.scrollY) }
    })
    const svar = [...document.querySelectorAll('code')].map((c) => c.textContent).filter((t) => /squat kapitel 6/.test(t))
    return { figs, svar, sidelaens: document.documentElement.scrollWidth > window.innerWidth + 1, svarOeverst: /squat kapitel 6: ny/.test(document.body.innerText.slice(0, 1800)) }
  })
  await page.screenshot({ path: join(HERE, `Q-${bredde}-laes-squat-k6.png`) })
  ud.laes.push({ bredde, ...v, skala: v.figs.map((f) => +(f.natur[0] / f.vist).toFixed(2)), jsFejl: [...fejl] })
  await ctx.close()
}
for (const r of ud.laes) {
  paastaa(`LAES-SQUAT ${r.bredde}: ny og gammel indlaest og rullbare, svarlinjerne oeverst, 0 JS-fejl, ingen sidelaens rulning, billederne mindst 2,9x (Q7)`, r.figs.length === 2 && r.figs.every((f) => f.ok && f.kanRulle) && r.svarOeverst && r.svar.length >= 2 && !r.jsFejl.length && !r.sidelaens && r.skala.every((s) => s >= 2.9), { figs: r.figs, skala: r.skala, svar: r.svar })
}
const l390 = ud.laes.find((r) => r.bredde === 390), l1280 = ud.laes.find((r) => r.bredde === 1280)
paastaa('LAES-SQUAT: under hinanden paa 390, side om side paa 1280', l390.figs[1].y > l390.figs[0].y && l1280.figs[1].x > l1280.figs[0].x, { l390: l390.figs.map((f) => [f.x, f.y]), l1280: l1280.figs.map((f) => [f.x, f.y]) })
ud.eksterne = [...eksterne]; ud.f404 = f404
paastaa('Alt net uden for den lokale server afbrudt; 0 fejl 404', !f404.length, { afbrudt: ud.eksterne })
ud.tjek = tjek
await browser.close(); server.close()
rmSync(dir, { recursive: true, force: true })
writeFileSync(join(HERE, 'squat-622.json'), JSON.stringify(ud, null, 1))
console.log(`${tjek.filter((t) => t.ok).length}/${tjek.length}`)
