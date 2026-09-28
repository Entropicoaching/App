// Kritik 622, blok 2: de seks Instagram-opslag efter Setus 615-rettelser af 2 og 3 (ordrer/kilder/setu-606, kun laest) og LAES-INSTAGRAM.html.
// 1) Teksten (slides.mjs og billedtekst-1..6.txt) mod Marcs regler med mine egne regler, uafhaengigt af Setus tjek.mjs.
// 2) Tallene i opslag 1 og 4 mod squat-artiklens kapitel 7 (f3c1684, git archive), og regnestykket i opslag 3.
// 3) LAES-INSTAGRAM.html som file:// i Google Chrome headless, 390 touch og 1280 mus, alt net afbrudt; et kontaktark
//    af alle 24 slides (Q-insta-*.png), saa jeg kan se dem igennem.
//   node outputs/kritik-622/insta-622.mjs   -> insta-622.json og I-*.png
import path, { join } from 'node:path'
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
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
paastaa('Engelsk fagord i teksten (ingen efter 615)', !eng.length, eng)

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
const t3 = bt3 + ' ' + OPSLAG[3].slides.map((s) => s.tekst).join(' ')
ud.tal3 = { caTi: /ca\. 10 cm kortere/.test(bt3), roererIkke: /rører ikke/.test(t3), tiFem: /10,5/.test(t3), legDrive: /leg drive/i.test(t3), skub: /skub fra benene/.test(t3), hoejder: /25,2, 29,0 og 32,9 cm/.test(bt3) }
paastaa('Opslag 3 (I1): "ca. 10 cm kortere", ingen 10,5, "roerer ikke" slettet, "skub fra benene" i stedet for leg drive', ud.tal3.caTi && !ud.tal3.roererIkke && !ud.tal3.tiFem && !ud.tal3.legDrive && ud.tal3.skub && ud.tal3.hoejder, ud.tal3)
const bt2 = readFileSync(join(K, 'billedtekst-2.txt'), 'utf8')
const sl2 = OPSLAG[2].slides.map((s) => s.tekst)
const t2 = bt2 + ' ' + sl2.join(' ')
ud.tal2 = { flytterUd: /flytter ud/.test(t2), minus54: /[-−]\s?54/.test(t2), mindre54: /54 % mindre/.test(bt2), slide5: sl2[4]?.slice(0, 60), fejlBetyder: /Fejl betyder her/.test(t2) }
paastaa('Opslag 2 (I2, I3): ingen "flytter ud" og intet -54 %, "54 % mindre" i billedteksten, slide 5 starter med "Modellen har ingen muskler"', !ud.tal2.flytterUd && !ud.tal2.minus54 && ud.tal2.mindre54 && /^Modellen har ingen muskler/.test(ud.tal2.slide5) && !ud.tal2.fejlBetyder, ud.tal2)
// 1, 4, 5 og 6 maa ikke vaere roert i 615: deres filer er aeldre end de nye PNG i 2 og 3, og 2 og 3 skal
// adskille sig byte for byte fra Setus kopi fra foer 615 (setu-615/foer-606).
const FOER = join(K, '..', 'setu-615', 'foer-606')
const filer = (nr) => [join(K, OPSLAG[nr].billedtekst), ...readdirSync(join(K, OPSLAG[nr].mappe)).filter((f) => f.endsWith('.png')).map((f) => join(K, OPSLAG[nr].mappe, f))]
const nye23 = [2, 3].flatMap((nr) => filer(nr).slice(1))
const foerste23 = Math.min(...nye23.map((p) => statSync(p).mtimeMs))
const urort = [1, 4, 5, 6].flatMap(filer).map((p) => ({ p: path.basename(path.dirname(p)) + '/' + path.basename(p), nyere: statSync(p).mtimeMs >= foerste23 }))
const roert23 = nye23.map((p) => { const g = join(FOER, path.basename(path.dirname(p)), path.basename(p)); let gl = null; try { gl = readFileSync(g) } catch {} return { p: path.basename(path.dirname(p)).slice(0, 8) + '/' + path.basename(p), aendret: !gl || !gl.equals(readFileSync(p)) } })
ud.urort = { foerste23: new Date(foerste23).toISOString(), nyere: urort.filter((x) => x.nyere), roert23 }
paastaa('Opslag 1, 4, 5 og 6 er ikke roert efter kopien fra foer 615; slide 4 og 5 i nr. 2 og slide 1 i nr. 3 er andre end foer 615 (slide 1-3 i nr. 2 maa vaere ens)', !ud.urort.nyere.length && ['opslag-2/slide-04.png', 'opslag-2/slide-05.png', 'opslag-3/slide-01.png'].every((q) => roert23.find((x) => x.p === q)?.aendret), ud.urort)

// LAES-INSTAGRAM skal vise de nuvaerende PNG (byte for byte) og de nuvaerende billedtekster 2 og 3.
const laesKilde = readFileSync(LAES, 'utf8')
const md5 = (b) => createHash('md5').update(b).digest('hex')
const indlejret = new Set([...laesKilde.matchAll(/data:image\/png;base64,([^"]+)/g)].map((m) => md5(Buffer.from(m[1], 'base64'))))
const pngs = Object.values(OPSLAG).flatMap((o) => readdirSync(join(K, o.mappe)).filter((f) => f.endsWith('.png')).map((f) => join(K, o.mappe, f)))
const laesTekst = laesKilde.replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/\s+/g, ' ')
const foersteLinje = (nr) => readFileSync(join(K, OPSLAG[nr].billedtekst), 'utf8').split(String.fromCharCode(10))[0].trim().slice(0, 120)
ud.laesIndhold = { pngIndlejret: pngs.filter((p) => indlejret.has(md5(readFileSync(p)))).length, pngAlle: pngs.length, bt23: [2, 3].map((nr) => laesTekst.includes(foersteLinje(nr))) }
paastaa('LAES-INSTAGRAM viser alle 24 nuvaerende PNG byte for byte og de nye billedtekster 2 og 3', ud.laesIndhold.pngIndlejret === 24 && ud.laesIndhold.bt23.every(Boolean), ud.laesIndhold)

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
writeFileSync(join(HERE, 'insta-622.json'), JSON.stringify(ud, null, 1))
console.log(`${tjek.filter((t) => t.ok).length}/${tjek.length}`)
