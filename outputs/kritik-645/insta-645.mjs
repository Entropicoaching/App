// Kritik 645, blok 1: Instagram 7-12 efter Setus 636 (rettelser af 8 og 10 i ordrer/kilder/setu-624, kun laest) og LAES-INSTAGRAM-2.html.
// Bygger paa insta-631.mjs; I8- og I9-tjekkene er vendt om til lukke-tjek, og 7, 9, 11 og 12 holdes op mod 631's tal.
// 1) Teksten (slides.mjs og billedtekst-7..12.txt) mod Marcs regler med mine egne regler fra 613/622, uafhaengigt af Setus tjek.mjs.
// 2) Marcs ord i 7 og 10 mod SVAR-squat.md; tallene i 8, 9, 11 og 12 mod loeftmodellens dist/*/index.html (entropi-loeftmodel-dhruva).
// 3) Gentagelse af 1-6 (setu-606): samme figur-fil og samme saetning.
// 4) LAES-INSTAGRAM-2.html som file:// i Google Chrome headless, 390 touch og 1280 mus, alt net afbrudt; kontaktark af alle 20 slides i 360 px.
//   node outputs/kritik-645/insta-645.mjs   -> insta-645.json og I-645-*.png
import path, { join } from 'node:path'
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from '../../e2e/harness.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '..', '..')
const K = 'C:/Users/Entropi/Desktop/ordrer/kilder/setu-624'
const K6 = 'C:/Users/Entropi/Desktop/ordrer/kilder/setu-606'
const FOER = 'C:/Users/Entropi/Desktop/ordrer/kilder/setu-636/foer-636'
const LAES = 'C:/Users/Entropi/Desktop/LAES-INSTAGRAM-2.html'
const SVAR = 'C:/Users/Entropi/Desktop/entropi-coaching-site/SVAR-squat.md'
const DIST = 'C:/Users/Entropi/Desktop/entropi-loeftmodel-dhruva/dist'
const { OPSLAG } = await import(pathToFileURL(join(K, 'slides.mjs')).href)
const { OPSLAG: OPSLAG6 } = await import(pathToFileURL(join(K6, 'slides.mjs')).href)
const tjek = []
const paastaa = (hvad, ok, data) => { tjek.push({ hvad, ok: !!ok, data }); console.log(`${ok ? 'ok ' : 'NEJ'} ${hvad}${data !== undefined ? ' ' + JSON.stringify(data).slice(0, 600) : ''}`) }
const ud = { opslag: {}, laes: [] }
const md5 = (b) => createHash('md5').update(b).digest('hex')
const bt = (dir, f) => readFileSync(join(dir, f), 'utf8').replace(/\r/g, '').trim()

// --- 1) Teksten ------------------------------------------------------------------------------------------
const navne = [...new Set([...readFileSync(join(ROOT, '.gitignore'), 'utf8').matchAll(/^supabase\/([a-z]+)-\*/gm)].map((m) => m[1]).filter((n) => n !== 'marc'))]
const regler = {
  tankestreg: /[\u2013\u2014]/,
  opfordring: /(^|[.!?:]\s+)(Skriv|Se|Prøv|Brug|Læs|Klik|Find|Husk|Tjek|Følg|Gem|Del|Kommentér|Kommenter|Link|Book|Kontakt|Hent|Start|Byg|Test)\b|\b(link i bio|følg med|skriv til|book en|send en dm|prøv dig frem|find din)\b/i,
  dramatisk: /^(Forestil dig|Har du nogensinde|Sandheden er|Det her|Glem alt|Stop|Alle taler om|De fleste)/,
  metaOmOpslag: /\b(opslag|karrusel|swipe|slide|i dette indlæg|næste billede)\b/i,
  marc: /\bMarcs?\b/,
  kilo: /\d+\s?kg\b/i,
  nm: /\bNm\b/,
  engelskUdenForMarcsOrd: /\b(leg drive|lats?|bracing|trial and error|sticking point)\b/i,
  minusProcent: /[-−]\s?\d+\s?%/,
  vaegtFlytter: /vægten flytter/i,
}
for (const [nr, o] of Object.entries(OPSLAG)) {
  const b = bt(K, o.billedtekst)
  const dele = [...o.slides.map((s, i) => ({ hvor: `slide ${i + 1}`, t: s.tekst })), ...b.split('\n\n').map((t, i) => ({ hvor: `billedtekst afsnit ${i + 1}`, t }))]
  const brud = []
  for (const d of dele) for (const [r, re] of Object.entries(regler)) if (re.test(d.t)) brud.push({ regel: r, hvor: d.hvor, tekst: d.t.match(re)[0] })
  for (const n of navne) for (const d of dele) if (new RegExp(`\\b${n}\\b`, 'i').test(d.t)) brud.push({ regel: 'atletnavn', hvor: d.hvor })
  const afsnit = b.split('\n\n')
  ud.opslag[nr] = {
    titel: o.titel, slides: o.slides.length, brud, slut: afsnit.at(-1).slice(-60),
    sidsteAfsnitForbehold: /(ikke målt|modellens|ingen muskler|ingen fast regel|referencekrop|modelvalg)/.test(afsnit.at(-1)),
    sidsteSlideForbehold: o.slides.length === 1 || /(ingen muskler|modelvalg|ingen fast regel|individuelt|ikke målt)/.test(o.slides.at(-1).tekst),
    btTegn: b.length, laengsteSlide: Math.max(...o.slides.map((s) => s.tekst.length)),
    antalPng: readdirSync(join(K, o.mappe)).filter((f) => f.endsWith('.png')).length,
  }
}
const alleBrud = Object.entries(ud.opslag).flatMap(([nr, o]) => o.brud.map((b) => ({ nr, ...b })))
paastaa('0 tankestreger, opfordringer, dramatiske aabninger, meta, "Marc", kilo, Nm, atletnavne, minusprocenter og "vaegten flytter" i slides og billedtekster', !alleBrud.filter((b) => b.regel !== 'engelskUdenForMarcsOrd').length, alleBrud)
paastaa('0 engelske fagord uden for Marcs egne (bias, lowbar, goblet squat og lockout er hans eller 1-6\'s)', !alleBrud.filter((b) => b.regel === 'engelskUdenForMarcsOrd').length)
paastaa('Alle seks billedtekster slutter med "Entropi Coaching ligger paa entropicoaching.dk."', Object.values(ud.opslag).every((o) => /Entropi Coaching ligger på entropicoaching\.dk\.$/.test(o.slut)), Object.values(ud.opslag).map((o) => o.slut))
paastaa('Forbeholdet staar i billedtekstens sidste afsnit i alle seks og paa sidste slide i de fire karruseller (enkeltbillederne 9 og 11 har det kun i billedteksten, som 3 og 6)', Object.values(ud.opslag).every((o) => o.sidsteAfsnitForbehold && o.sidsteSlideForbehold), Object.fromEntries(Object.entries(ud.opslag).map(([n, o]) => [n, [o.sidsteAfsnitForbehold, o.sidsteSlideForbehold]])))
paastaa('20 PNG (5+5+1+4+1+4)', Object.values(ud.opslag).reduce((a, o) => a + o.antalPng, 0) === 20, Object.values(ud.opslag).map((o) => o.antalPng))
paastaa('Billedtekster under 2200 tegn (Instagrams graense) og slidetekst under 200 tegn', Object.values(ud.opslag).every((o) => o.btTegn < 2200 && o.laengsteSlide < 200), Object.values(ud.opslag).map((o) => [o.btTegn, o.laengsteSlide]))

// --- 2) Marcs ord og tallene -----------------------------------------------------------------------------
const svar = readFileSync(SVAR, 'utf8')
const marc = [
  ['7', 'naturlige position', /naturlige position/], ['7', 'stagnation og til værre skader', /stagnation og til værre\s+skader/],
  ['7', 'hvad der føles bedre', /hvad der føles bedre/], ['7', 'godkendt(es) i konkurrence', /konkurrencegodkendt/],
  ['7', 'ingen fast regel for knæ og fodstilling', /Fast regel for knæ og fodstilling: nej/], ['7', 'nettet og Instagram', /nettet og på Instagram/],
  ['10', 'egne bias', /egne bias/], ['10', 'bygge de svage punkter op', /bygge de svage punkter op/], ['10', 'goblet squat afslører bias', /Goblet squat er god til at afsløre/],
  ['10', 'bias mod lowbar', /bias mod lowbar/], ['10', 'mobilitet eller tidligere skader', /mobilitet eller tidligere skader/],
]
ud.marc = marc.map(([nr, hvad, re]) => ({ nr, hvad, iSvar: re.test(svar) }))
paastaa('Opslag 7 og 10: hvert af Marcs udsagn staar i SVAR-squat.md', ud.marc.every((m) => m.iSvar), ud.marc.filter((m) => !m.iSvar))
// Saetninger i 7 og 10, der ikke kan fores tilbage til SVAR-squat (Setus overgange, jeg-form Marc ikke har sagt ordret).
const t7 = [...OPSLAG[7].slides.map((s) => s.tekst), bt(K, 'billedtekst-7.txt')].join(' ')
ud.jegForm7 = { arbejderMedSomCoach: /Det, jeg arbejder med som coach/.test(t7), svarSiger: /Det handler om at finde den naturlige position/.test(svar), positionenDenEnkeltes: /positionen den enkeltes/.test(t7) }

const side = (d) => readFileSync(join(DIST, d, 'index.html'), 'utf8').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
const lf = side('loeft-fejl'), bf = side('baenk-figurer'), df = side('doedloeft-figurer')
const tekstAf = (nr) => [...OPSLAG[nr].slides.map((s) => s.tekst), bt(K, OPSLAG[nr].billedtekst)].join(' ')
const tal = {
  8: { tekst: tekstAf(8), kilde: lf, krav: ['11,9 cm', '14°', 'hoften ca. 12 %', 'lænden ca. 13 %', '1,4 cm bag', '2,5 cm bag', 'Skinnebenet 7°', '3,0 cm foran midtfoden'], egne: [['61°', /Torso fra lodret \(°\) 60,7/, df], ['75°', /lægger sig 14° mere ned/, lf], ['41,0', /Momentarm hofte \(cm\) 41 /, df], ['24,7', /Momentarm lænd L5\/S1 \(cm\) 24,7/, df]] },
  9: { tekst: tekstAf(9), kilde: bf, krav: ['(47 cm)', '(81 cm)', '43,0 cm', '41,8 cm', '39,2 cm', '10° / 34°', '28° / 33°', '48° / 30°', '3,8 cm kortere'] },
  11: { tekst: tekstAf(11), kilde: df, krav: ['22,5 cm over gulvet', '52,1 cm over gulvet', '79,8 cm over gulvet', 'Torso fra lodret (°) 60,7', 'Torso fra lodret (°) 52,9', 'Momentarm hofte (cm) 30,1', 'Momentarm hofte (cm) 10 '] },
  12: { tekst: tekstAf(12), kilde: bf + ' ' + lf, krav: ['25,1 cm mod fødderne', 'Middel bue: vej 41,8 cm', 'næsten over skulderen', 'lidt ud på vej op'] },
}
ud.tal = {}
for (const [nr, t] of Object.entries(tal)) ud.tal[nr] = { mangler: t.krav.filter((k) => !t.kilde.includes(k)), egne: (t.egne || []).map(([v, re, k]) => ({ v, iTekst: t.tekst.includes(v), iKilde: re.test(k) })) }
paastaa('Opslag 8, 9, 11 og 12: tallene staar i loeftmodellens figursider (loeft-fejl, baenk-figurer, doedloeft-figurer)', Object.values(ud.tal).every((x) => !x.mangler.length && x.egne.every((e) => e.iTekst && e.iKilde)), ud.tal)
// 0,8 cm i 12 staar ikke i figursiden; maal det i baenk-midt.svg: stangens og skulderleddets x.
const midt = readFileSync(join(DIST, 'baenk-figurer', 'baenk-midt.svg'), 'utf8')
ud.midt08 = { i08: /0,8 cm/.test(midt), titler: [...midt.matchAll(/<title>([^<]+)<\/title>/g)].map((m) => m[1]).slice(0, 8), tekster: [...midt.matchAll(/<text[^>]*>([^<]+)<\/text>/g)].map((m) => m[1]).slice(0, 20) }
// Setus tal 45,8/27,8 (hoften og laenden med hoften foerst): 41,0*1,12 og 24,7*1,13
ud.regn8 = { hofte: +(45.8 / 41.0 - 1).toFixed(3), laend: +(27.8 / 24.7 - 1).toFixed(3) }
paastaa('Opslag 8: 45,8/41,0 = ca. +12 % og 27,8/24,7 = ca. +13 % (regnet efter)', Math.round(ud.regn8.hofte * 100) === 12 && Math.round(ud.regn8.laend * 100) === 13, ud.regn8)
paastaa('Opslag 9: 43,0 - 39,2 = 3,8 cm, og 64 er midt imellem 47 og 81', Math.abs(43.0 - 39.2 - 3.8) < 1e-9 && (47 + 81) / 2 === 64)

// --- 3) Gentagelse af 1-6 --------------------------------------------------------------------------------
const udvid = (f) => { const m = f.match(/\$\{(\w+)\}/); if (!m) return [f]; const alt = m[1] === 'fil' ? ['opstilling', 'knaehoejde', 'lockout', 'smal', 'middel', 'bred'] : ['lille', 'middel', 'stor']; return alt.map((a) => f.replace(m[0], a)) }
// 645: kun tegninger, som slides.mjs bruger (tegn.mjs har stadig den ubrugte 'sq-lowbar' med 1's figur).
const brugte = (op) => new Set(Object.values(op).flatMap((o) => o.slides.map((s) => s.tegning)).filter(Boolean))
const figurer = (dir, op) => { const b = brugte(op); const t = readFileSync(join(dir, 'tegn.mjs'), 'utf8').split(/\n  (?='[\w-]+': \(\) =>)/).filter((d) => b.has(d.match(/^'([\w-]+)'/)?.[1])).join('\n'); return [...t.matchAll(/model\(\s*[`'](.+?\.svg)[`']\s*,\s*(\[[^\]]+\])/g)].flatMap((m) => udvid(m[1]).map((fil) => ({ fil, crop: m[2].replace(/\s/g, '') }))).filter((x) => existsSync(join(DIST, x.fil))) }
const f6 = figurer(K6, OPSLAG6), f7 = figurer(K, OPSLAG)
ud.figurer = { f6: f6.length, f7: f7.length }
ud.sammeFigur = f7.filter((a, i) => f6.some((b) => b.fil === a.fil) && f7.findIndex((c) => c.fil === a.fil) === i).map((a) => ({ fil: a.fil, crop624: a.crop, crop606: f6.find((b) => b.fil === a.fil).crop }))
const HENVISNING = 'Entropi Coaching ligger på entropicoaching.dk.'
const saetninger = (s) => s.split(/(?<=[.:])\s+/).map((x) => x.trim()).filter((x) => x.length > 25 && x !== HENVISNING)
const alt6 = Object.values(OPSLAG6).flatMap((o) => [...o.slides.map((s) => s.tekst), bt(K6, o.billedtekst)]).flatMap(saetninger)
ud.sammeSaetning = Object.entries(OPSLAG).flatMap(([nr, o]) => [...o.slides.map((s) => s.tekst), bt(K, o.billedtekst)].flatMap(saetninger).filter((s) => alt6.some((a) => a.slice(0, 60) === s.slice(0, 60))).map((s) => ({ nr, s })))
// Skabelonen "Tre X i modellens baenkpres ..., jo kortere vej til lockout" (3 og 9)
ud.skabelon = { nr3: OPSLAG6[3].slides[0].tekst, nr9: OPSLAG[9].slides[0].tekst }
paastaa('I8 lukket: 10 bruger ingen modelfigur fra 1-6 og ingen saetning fra 1-6 (kun 11 deler opstillingsfiguren med 6, I8b valgfri)', ud.sammeFigur.length === 1 && /dl-konventionel-opstilling/.test(ud.sammeFigur[0].fil) && ud.sammeSaetning.length === 0, { figur: ud.sammeFigur, saetning: ud.sammeSaetning })
const tegn = readFileSync(join(K, 'tegn.mjs'), 'utf8')
const sp = tegn.slice(tegn.indexOf("'stangens-plads'"), tegn.indexOf('].join', tegn.indexOf("'stangens-plads'")))
ud.stangensPlads = { brugt: OPSLAG[10].slides[2].tegning, model: /model\(/.test(sp), etiketter: [...sp.matchAll(/tekst\([^']*'([^']+)'/g)].map((m) => m[1]) }
const spBrud = ud.stangensPlads.etiketter.flatMap((t) => Object.entries(regler).filter(([, re]) => re.test(t)).map(([r]) => ({ r, t })))
paastaa('I8: slide 3 i 10 er tegningen stangens-plads uden model(), og dens etiketter bryder ingen regel', ud.stangensPlads.brugt === 'stangens-plads' && !ud.stangensPlads.model && !spBrud.length, { ...ud.stangensPlads, spBrud })
const h = (p) => md5(readFileSync(p))
const m10 = join(K, OPSLAG[10].mappe), f10 = join(FOER, 'opslag-10-squat-bias')
ud.nr10png = ['slide-01.png', 'slide-02.png', 'slide-03.png', 'slide-04.png'].map((f) => ({ f, ens: h(join(m10, f)) === h(join(f10, f)) }))
paastaa('I8: 10 slide 3 og 4 er nye PNG (slide 3 tegningen, slide 4 teksten), 1 og 2 byte for byte som foer 636', ud.nr10png.map((x) => x.ens).join() === 'true,true,false,false', ud.nr10png)
const afsnit10 = bt(K, 'billedtekst-10.txt').split(/\n\n/).at(-1)
paastaa('I8: billedtekst 10 sidste afsnit starter ikke med 1-saetningen og har forbeholdet', !/^Figuren er løftmodellens squat/.test(afsnit10) && /ikke målt/.test(afsnit10), afsnit10.slice(0, 120))
const b8 = bt(K, 'billedtekst-8.txt').split(/\n\n/)[0]
const svgTekst = (f) => [...readFileSync(join(DIST, 'loeft-fejl', f), 'utf8').matchAll(/<text[^>]*>([^<]+)</g)].map((m) => m[1]).join(' | ')
ud.i9 = { afsnit1: b8, model: svgTekst('dl-hofte-foerst-model.svg').match(/knæ \d+°.*?skinneben \d+°/)?.[0], foerst: svgTekst('dl-hofte-foerst.svg').match(/knæ \d+°.*?skinneben \d+°/)?.[0] }
paastaa('I9 lukket: billedtekst 8 siger "knaeene strakt mere" og "skinnebenet staar lodret", ikke "hvor knaeene er strakt"; figurerne siger knae 98 til 127 og skinneben 14 til 0', /knæene strakt mere/.test(b8) && /skinnebenet står lodret/.test(b8) && !/hvor knæene er strakt/.test(b8) && /knæ 98°.*skinneben 14°/.test(ud.i9.model) && /knæ 127°.*skinneben 0°/.test(ud.i9.foerst), ud.i9)
const j631 = JSON.parse(readFileSync(join(ROOT, 'outputs', 'kritik-631', 'insta-631.json'), 'utf8')).opslag
ud.uroert = ['7', '9', '11', '12'].map((n) => ({ n, nu: [ud.opslag[n].btTegn, ud.opslag[n].laengsteSlide, ud.opslag[n].slides], i631: [j631[n].btTegn, j631[n].laengsteSlide, j631[n].slides] }))
paastaa('7, 9, 11 og 12 uroert siden 631 (samme tegn i billedtekst, laengste slide og antal slides; slides.mjs-diff mod foer-636 roerer kun 10)', ud.uroert.every((u) => u.nu.join() === u.i631.join()) && readFileSync(join(FOER, 'slides.mjs'), 'utf8').split(/\n/).filter((l, i) => l !== readFileSync(join(K, 'slides.mjs'), 'utf8').split(/\n/)[i]).length === 2, ud.uroert)

// LAES-INSTAGRAM-2 viser de nuvaerende PNG byte for byte og billedteksterne.
const laesKilde = readFileSync(LAES, 'utf8')
const indlejret = new Set([...laesKilde.matchAll(/data:image\/png;base64,([^"')]+)/g)].map((m) => md5(Buffer.from(m[1], 'base64'))))
const pngs = Object.values(OPSLAG).flatMap((o) => readdirSync(join(K, o.mappe)).filter((f) => f.endsWith('.png')).map((f) => join(K, o.mappe, f)))
const laesTekst = laesKilde.replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/\s+/g, ' ')
ud.laesIndhold = { pngIndlejret: pngs.filter((p) => indlejret.has(md5(readFileSync(p)))).length, pngAlle: pngs.length, bt: Object.values(OPSLAG).map((o) => laesTekst.includes(bt(K, o.billedtekst).split('\n')[0].slice(0, 100))) }
paastaa('LAES-INSTAGRAM-2 viser alle 20 nuvaerende PNG byte for byte og de seks billedtekster', ud.laesIndhold.pngIndlejret === 20 && ud.laesIndhold.bt.every(Boolean), ud.laesIndhold)

// --- 4) LAES-INSTAGRAM-2.html i browseren ----------------------------------------------------------------
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
      svar: /instagram ok 7-12/.test(document.body.innerText),
      rettet631: (document.body.innerText.match(/Rettet efter Bhishaks 631/g) || []).length,
      tankestreg: /[\u2013\u2014]/.test(document.body.innerText),
      naevner16: /opslag [1-6]\b/i.test(document.body.innerText),
    }
  })
  await page.screenshot({ path: join(HERE, `I-645-${bredde}-laes-top.png`) })
  ud.laes.push({ bredde, ...v, jsFejl: fejl })
  await ctx.close()
}
for (const r of ud.laes) paastaa(`LAES-INSTAGRAM-2 ${r.bredde}: 20 billeder indlaest, 6 kopiknapper, svarformen og to "Rettet efter Bhishaks 631"-noter staar, 0 JS-fejl, ingen sidelaens rulning, 0 tankestreger`, r.billeder === 20 && r.indlaest === 20 && r.kopi === 6 && r.svar && r.rettet631 === 2 && !r.jsFejl.length && !r.sidelaens && !r.tankestreg, r)
paastaa('LAES-INSTAGRAM-2: 0 kald ud af huset', !eksterne.size, [...eksterne])

// Kontaktark: alle 20 slides i 360 px bredde (ca. Instagram paa en telefon), fire pr. ark, plus 1-6's figur ved siden af 10 og 11.
const alle = Object.entries(OPSLAG).flatMap(([nr, o]) => readdirSync(join(K, o.mappe)).filter((f) => f.endsWith('.png')).sort().map((f) => ({ nr, f, p: join(K, o.mappe, f) })))
const par = [
  { nr: '1 (606)', f: 'slide-01.png', p: join(K6, OPSLAG6[1].mappe, 'slide-01.png') }, { nr: '10', f: 'slide-03.png', p: join(K, OPSLAG[10].mappe, 'slide-03.png') },
  { nr: '6 (606)', f: 'slide-01.png', p: join(K6, OPSLAG6[6].mappe, 'slide-01.png') }, { nr: '11', f: 'slide-01.png', p: join(K, OPSLAG[11].mappe, 'slide-01.png') },
]
const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 } })
const page = await ctx.newPage()
const ark = async (liste, navn) => {
  const html = '<body style="margin:0;background:#222;display:flex;flex-wrap:wrap;gap:8px;padding:8px;font:14px sans-serif;color:#fff">' + liste.map((x) => `<figure style="margin:0;width:360px"><img src="data:image/png;base64,${readFileSync(x.p).toString('base64')}" style="width:360px;display:block"><figcaption>${x.nr} ${x.f}</figcaption></figure>`).join('') + '</body>'
  await page.setContent(html)
  await page.screenshot({ path: join(HERE, navn), fullPage: true })
}
for (let a = 0; a < alle.length; a += 4) await ark(alle.slice(a, a + 4), `I-645-ark-${a / 4 + 1}.png`)
await ark(par, 'I-645-ark-gentagelse.png')
await browser.close()
ud.tjek = tjek
writeFileSync(join(HERE, 'insta-645.json'), JSON.stringify(ud, null, 1))
console.log(`${tjek.filter((t) => t.ok).length}/${tjek.length}`)
