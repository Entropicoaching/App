// Kritik 613, blok 2: de seks Instagram-opslag fra Setus 606 (ordrer/kilder/setu-606, kun laest) og LAES-INSTAGRAM.html.
// 1) Teksten (slides.mjs og billedtekst-1..6.txt) mod Marcs regler med mine egne regler, uafhaengigt af Setus tjek.mjs.
// 2) Tallene i opslag 1 og 4 mod squat-artiklens kapitel 7 (f3c1684, git archive), og regnestykket i opslag 3.
// 3) LAES-INSTAGRAM.html som file:// i Google Chrome headless, 390 touch og 1280 mus, alt net afbrudt; et kontaktark
//    af alle 24 slides (Q-insta-*.png), saa jeg kan se dem igennem.
//   node outputs/kritik-613/insta-613.mjs   -> insta-613.json og I-*.png
import path, { join } from 'node:path'
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from '../../e2e/harness.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '..', '..')
const K = 'C:/Users/Entropi/Desktop/ordrer/kilder/setu-606'
const LAES = 'C:/Users/Entropi/Desktop/LAES-INSTAGRAM.html'
const SITE = 'C:/Users/Entropi/Desktop/entropi-coaching-site-wt2'
const { OPSLAG } = await import(pathToFileURL(join(K, 'slides.mjs')).href)
const tjek = []
const paastaa = (hvad, ok, data) => { tjek.push({ hvad, ok: !!ok, data }); console.log(`${ok ? 'ok ' : 'NEJ'} ${hvad}${data !== undefined ? ' ' + JSON.stringify(data).slice(0, 600) : ''}`) }
const ud = { opslag: {}, laes: [] }

// --- 1) Teksten ---------------------------------------------------------------------------------------
const navne = [...new Set([...readFileSync(join(ROOT, '.gitignore'), 'utf8').matchAll(/^supabase\/([a-z]+)-\*/gm)].map((m) => m[1]).filter((n) => n !== 'marc'))]
const regler = {
  tankestreg: /[\u2013\u2014]/,
  opfordring: /(^|[.!?]\s+)(Skriv|Se|Prøv|Brug|Læs|Klik|Find|Husk|Tjek|Følg|Gem|Del|Kommentér|Kommenter|Link|Book|Kontakt|Hent)\b|\b(link i bio|følg med|skriv til|book en|send en dm)\b/i,
  dramatisk: /^(Forestil dig|Har du nogensinde|Sandheden er|Det her|Glem alt|Stop)/,
  metaOmOpslag: /\b(opslag|karrusel|swipe|slide|i dette indlæg|næste billede)\b/i,
  marc: /\bMarcs?\b/,
  kilo: /\d+\s?kg\b/i,
  engelsk: /\b(leg drive|lats?|bracing)\b/i,
}
for (const [nr, o] of Object.entries(OPSLAG)) {
  const bt = readFileSync(join(K, o.billedtekst), 'utf8').replace(/\r/g, '').trim()
  const dele = [...o.slides.map((s, i) => ({ hvor: `slide ${i + 1}`, t: s.tekst })), ...bt.split('\n\n').map((t, i) => ({ hvor: `billedtekst afsnit ${i + 1}`, t }))]
  const brud = []
  for (const d of dele) for (const [r, re] of Object.entries(regler)) if (re.test(d.t)) brud.push({ regel: r, hvor: d.hvor, tekst: d.t.match(re)[0] })
  for (const n of navne) for (const d of dele) if (new RegExp(`\\b${n}\\b`, 'i').test(d.t)) brud.push({ regel: 'atletnavn', hvor: d.hvor })
  const slut = bt.split('\n').pop()
  ud.opslag[nr] = { titel: o.titel, slides: o.slides.length, brud, slut, sidsteAfsnitForbehold: /(ikke målt|modellens|ingen muskler|øjebliksbillede|ikke hvilken)/.test(bt.split('\n\n').pop()), antalPng: readdirSync(join(K, o.mappe)).filter((f) => f.endsWith('.png')).length }
}
const alleBrud = Object.entries(ud.opslag).flatMap(([nr, o]) => o.brud.filter((b) => b.regel !== 'engelsk').map((b) => ({ nr, ...b })))
paastaa('0 tankestreger, opfordringer, dramatiske aabninger, "Marc", kilo og atletnavne i slides og billedtekster', !alleBrud.filter((b) => b.regel !== 'metaOmOpslag').length, alleBrud)
paastaa('Alle seks billedtekster slutter med en neutral henvisning til entropicoaching.dk', Object.values(ud.opslag).every((o) => /ligger på entropicoaching\.dk\.$/.test(o.slut)), Object.values(ud.opslag).map((o) => o.slut.slice(-80)))
paastaa('Forbeholdet staar i billedtekstens sidste afsnit i alle seks', Object.values(ud.opslag).every((o) => o.sidsteAfsnitForbehold))
paastaa('24 PNG (5+5+1+6+6+1)', Object.values(ud.opslag).reduce((a, o) => a + o.antalPng, 0) === 24, Object.values(ud.opslag).map((o) => o.antalPng))
const eng = Object.entries(ud.opslag).flatMap(([nr, o]) => o.brud.filter((b) => b.regel === 'engelsk').map((b) => ({ nr, ...b })))
paastaa('Engelsk fagord i teksten (fund, ikke regelbrud)', true, eng)

// --- 2) Tallene -------------------------------------------------------------------------------------------
const art = execSync(`git -C "${SITE}" show udgivelse-squat-min-krop:artikel-squat.html`, { maxBuffer: 1 << 26 }).toString()
const k7 = art.slice(art.indexOf('id="kap-fejlbilleder"'), art.indexOf('id="fejl-god-morgen"')).replace(/<[^>]+>/g, '')
const tal4 = ['3,7', '2,9', '29,1', '23,0', '15,7', '21,7', '30°', '40°', '64°', '49°', '31,1', '13,6']
ud.tal4 = tal4.map((t) => ({ t, iK7: k7.includes(t) }))
paastaa('Opslag 4: alle 12 tal staar i artiklens kapitel 7 (samme krop, 183 cm)', ud.tal4.every((x) => x.iK7), ud.tal4.filter((x) => !x.iK7))
const t1 = OPSLAG[1].slides.map((s) => s.tekst).join(' ')
const k1 = art.slice(art.indexOf('id="fase-bund"'), art.indexOf('id="fase-vendepunkt"')).replace(/<[^>]+>/g, '')
ud.tal1 = { opslag: ['1 cm bag', '21,7', '23 cm'].map((t) => t1.includes(t)), artikelKap1: ['0,9', '20,5', '21,4'].map((t) => k1.includes(t)) }
paastaa('Opslag 1 bruger 183 cm-kroppens tal (1 / 21,7 / 23 cm), artiklens kapitel 1 den balancerede krops (0,9 / 20,5 / 21,4 cm)', ud.tal1.opslag.every(Boolean) && ud.tal1.artikelKap1.every(Boolean), ud.tal1)
const bt3 = readFileSync(join(K, 'billedtekst-3.txt'), 'utf8')
ud.tal3 = { lille: 46.2, stor: 35.8, forskelVist: bt3.match(/(\d+,\d) cm kortere/)[1], forskelAfVist: (46.2 - 35.8).toFixed(1).replace('.', ',') }
paastaa('Opslag 3: "10,5 cm kortere" mod 46,2 - 35,8 = 10,4 med de viste tal', ud.tal3.forskelVist !== ud.tal3.forskelAfVist, ud.tal3)

// --- 3) LAES-INSTAGRAM.html ---------------------------------------------------------------------------
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const browser = await chromium.launch({ headless: true, executablePath: CHROME })
const eksterne = new Set()
for (const bredde of [390, 1280]) {
  const mobil = bredde < 600
  const ctx = await browser.newContext({ viewport: { width: bredde, height: mobil ? 780 : 900 }, deviceScaleFactor: mobil ? 2 : 1, isMobile: mobil, hasTouch: mobil })
  const page = await ctx.newPage()
  const fejl = []
  page.on('pageerror', (e) => fejl.push(e.message))
  await page.route('**/*', (r) => { const u = r.request().url(); if (u.startsWith('file:') || /^(data|blob):/.test(u)) return r.continue(); eksterne.add(u.split('?')[0]); return r.abort() })
  await page.goto(pathToFileURL(LAES).href, { waitUntil: 'load' })
  await page.waitForTimeout(800)
  const v = await page.evaluate(() => {
    const imgs = [...document.images]
    return {
      billeder: imgs.length, indlaest: imgs.filter((i) => i.complete && i.naturalWidth > 0).length,
      vistB: [...new Set(imgs.map((i) => Math.round(i.getBoundingClientRect().width)))],
      kopi: [...document.querySelectorAll('button')].filter((b) => /kopi/i.test(b.textContent)).length,
      sidelaens: document.documentElement.scrollWidth > window.innerWidth + 1,
      svar: /instagram ok 1-6/.test(document.body.innerText),
      tankestreg: /[\u2013\u2014]/.test(document.body.innerText),
    }
  })
  await page.screenshot({ path: join(HERE, `I-${bredde}-laes-top.png`) })
  ud.laes.push({ bredde, ...v, jsFejl: fejl })
  await ctx.close()
}
for (const r of ud.laes) paastaa(`LAES-INSTAGRAM ${r.bredde}: 24 billeder indlaest, 6 kopiknapper, svarformen staar, 0 JS-fejl, ingen sidelaens rulning, 0 tankestreger`, r.billeder === 24 && r.indlaest === 24 && r.kopi === 6 && r.svar && !r.jsFejl.length && !r.sidelaens && !r.tankestreg, r)
paastaa('LAES-INSTAGRAM: 0 kald ud af huset', !eksterne.size, [...eksterne])

// Kontaktark: alle slides i 360 px bredde (ca. Instagram paa en telefon), seks pr. ark.
const alle = Object.entries(OPSLAG).flatMap(([nr, o]) => readdirSync(join(K, o.mappe)).filter((f) => f.endsWith('.png')).sort().map((f) => ({ nr, f, p: join(K, o.mappe, f) })))
const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } })
const page = await ctx.newPage()
for (let a = 0; a < alle.length; a += 6) {
  const html = '<body style="margin:0;background:#222;display:flex;flex-wrap:wrap;gap:8px;padding:8px;font:14px sans-serif;color:#fff">' + alle.slice(a, a + 6).map((x) => `<figure style="margin:0;width:360px"><img src="data:image/png;base64,${readFileSync(x.p).toString('base64')}" style="width:360px;display:block"><figcaption>${x.nr} ${x.f}</figcaption></figure>`).join('') + '</body>'
  await page.setContent(html)
  await page.screenshot({ path: join(HERE, `I-ark-${a / 6 + 1}.png`), fullPage: true })
}
await browser.close()
ud.tjek = tjek
writeFileSync(join(HERE, 'insta-613.json'), JSON.stringify(ud, null, 1))
console.log(`${tjek.filter((t) => t.ok).length}/${tjek.length}`)
