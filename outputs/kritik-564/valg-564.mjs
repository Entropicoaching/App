// Kritik 564, blok 2: Marcs valg-side i matematik (Ganitas 557). Laest som en laerer paa telefonen:
// C:\Users\Entropi\Desktop\MARCS-VALG-MATEMATIK.html (kun laest; sammenlignet med kopien i matematik main
// outputs/557/) headless paa 360 og 390 med touch, lyst og moerkt, og 1280 med mus, uden net. Og eet tal
// pr. valg holdt op mod koden i matematik main (git archive; intet trae roeres) og mine elev-552-koersler.
//   node outputs/kritik-564/valg-564.mjs [ref]
// Skriver valg-564.json og M-*.png.
import path from 'node:path'
import { tmpdir } from 'node:os'
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { chromium } from '../../e2e/harness.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const MAT = 'C:/Users/Entropi/Desktop/matematik'
const HTML = 'C:/Users/Entropi/Desktop/MARCS-VALG-MATEMATIK.html'
const SHA = execSync(`git -C ${MAT} rev-parse --short ${process.argv[2] || 'main'}`).toString().trim()
const M = path.join(tmpdir(), `kritik-564-matematik-${SHA}`)
if (!existsSync(path.join(M, 'src', 'spil-figur.js'))) {
  mkdirSync(M, { recursive: true })
  execSync(`git -C ${MAT} archive ${SHA} src docs/MARCS-VALG-542.md outputs/557/MARCS-VALG-MATEMATIK.html outputs/RAPPORT-557.md package.json | tar -x -C "${M.replace(/\\/g, '/')}"`, { shell: 'bash' })
}
const imp = (f) => import(pathToFileURL(path.join(M, f)).href)
const F = await imp('src/spil-figur.js')
const QB = await imp('src/questbog.js')

const tjek = []
const paastaa = (hvad, ok, data) => { tjek.push({ hvad, ok: !!ok, data }); console.log(`${ok ? 'ok ' : 'NEJ'} ${hvad}${data !== undefined ? ' ' + JSON.stringify(data).slice(0, 500) : ''}`) }
const ud = { ref: SHA, sider: {} }

// --- siden er den samme som den committede kopi -------------------------------------------------
const side = readFileSync(HTML, 'utf8')
const kopi = readFileSync(path.join(M, 'outputs/557/MARCS-VALG-MATEMATIK.html'), 'utf8')
ud.magenTilKopi = side.replace(/\r/g, '') === kopi.replace(/\r/g, '')
ud.scripts = (side.match(/<script|<link|src=|href=/gi) || []).length

// --- i browseren -------------------------------------------------------------------------------
const LAES = () => {
  const lum = (c) => { const m = c.match(/\d+(\.\d+)?/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]) }
  const bund = (e) => { for (let x = e; x; x = x.parentElement) { const b = getComputedStyle(x).backgroundColor; if (!/rgba\(0, 0, 0, 0\)|transparent/.test(b)) return b } return 'rgb(255,255,255)' }
  const tekster = [...document.querySelectorAll('h1,h2,h3,p,code,b,span,footer')].filter((e) => e.textContent.trim() && e.getBoundingClientRect().height > 0)
  const kontrast = tekster.map((e) => { const a = lum(getComputedStyle(e).color), b = lum(bund(e)); return { e: e.textContent.trim().slice(0, 30), px: parseFloat(getComputedStyle(e).fontSize), k: Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 10) / 10 } })
  const valg = [...document.querySelectorAll('section.valg')].map((s) => ({
    id: s.querySelector('h2').id,
    idag: s.querySelector('.i-dag')?.textContent.trim(),
    muligheder: [...s.querySelectorAll('.mulighed')].map((m) => ({ bogstav: m.querySelector('.bogstav').textContent.trim(), titel: m.querySelector('h3').textContent.replace(/\s+/g, ' ').trim(), forslag: m.classList.contains('mulighed--forslag'), maerker: [...m.querySelectorAll('.maerker')].map((p) => p.textContent.trim()), advarsel: m.querySelector('.advarsel')?.textContent.trim() || null, tekst: m.textContent.replace(/\s+/g, ' ').trim() })),
  }))
  const forslag = [...document.querySelectorAll('.maerke-forslag')].map((e) => e.textContent.trim())
  const svar = document.querySelector('.svar code')?.textContent.trim()
  const skaermeTilSidstValg = Math.round((document.querySelector('#n1').closest('section').getBoundingClientRect().bottom + scrollY) / innerHeight * 10) / 10
  return {
    side: document.documentElement.scrollWidth, klient: document.documentElement.clientWidth, hoejde: document.documentElement.scrollHeight, skaerm: innerHeight,
    skaerme: Math.round((document.documentElement.scrollHeight / innerHeight) * 10) / 10, skaermeTilSidstValg,
    mindstePx: Math.min(...kontrast.map((k) => k.px)), mindsteKontrast: kontrast.reduce((a, k) => (k.k < a.k ? k : a)),
    ord: document.body.innerText.split(/\s+/).filter(Boolean).length, tekst: document.body.innerText, valg, forslag, svar,
    maerkeForslagPx: parseFloat(getComputedStyle(document.querySelector('.maerke-forslag')).fontSize),
  }
}
const browser = await chromium.launch({ headless: true })
for (const [bredde, tema] of [[360, 'light'], [390, 'light'], [390, 'dark'], [1280, 'light']]) {
  const mobil = bredde < 500
  const ctx = await browser.newContext({ viewport: { width: bredde, height: mobil ? 780 : 900 }, deviceScaleFactor: mobil ? 3 : 1, isMobile: mobil, hasTouch: mobil, colorScheme: tema })
  const page = await ctx.newPage()
  const net = [], fejl = []
  page.on('pageerror', (e) => fejl.push(e.message))
  page.on('request', (r) => { if (!/^file:/.test(r.url())) net.push(r.url()) })
  await page.route('**/*', (r) => (/^(file|data):/.test(r.request().url()) ? r.continue() : r.abort()))
  await page.goto(pathToFileURL(HTML).href)
  const r = await page.evaluate(LAES)
  r.net = net; r.jsFejl = fejl
  ud.sider[`${bredde}-${tema}`] = r
  if (bredde !== 1280 || tema === 'light') await page.screenshot({ path: path.join(HERE, `M-${bredde}-${tema}.png`), fullPage: true })
  await ctx.close()
}
await browser.close()

// --- tekstens ord, som en laerer ville mangle ------------------------------------------------------
const s390 = ud.sider['390-light'], T = s390.tekst
const FAGORD = ['forløb', 'mestre', 'mestrede', 'model-elev', 'Bhishak', 'Ganita', 'Dhruva', 'quest', 'M2', 'N1', 'N8', 'Bigården', 'Grusgraven', 'Min helt', 'niveau', 'titel']
ud.fagord = Object.fromEntries(FAGORD.map((o) => [o, (T.match(new RegExp(o.replace('-', '\\-'), 'gi')) || []).length]))
const md = readFileSync(path.join(M, 'docs/MARCS-VALG-542.md'), 'utf8')
// Det, den lange udgave siger, og som telefonsiden ikke har:
ud.kunIMd = {
  hvilketTalStiger: /Møllen og Sporvognen giver Hoved/.test(md) && !/Sporvognen/.test(T),
  mestretDefineret: /3 af 3 rigtige i første forsøg/.test(md) && !/3 af 3/.test(T),
  forslagetsGrundM2: /Det er den mindste ændring/.test(md) && !/mindste ændring/.test(T),
  forslagetsGrundN1: /ingen elev oplever at få en titel taget/.test(md) && !/taget fra sig/.test(T),
}

// --- eet tal pr. valg mod koden --------------------------------------------------------------------
const fig = F.nyFigur('x', 'lilla')
const kode = {}
kode.m2Start = [fig.hoved, fig.haand, fig.hjerte]
// Den travle: seks mestrede regne-forloeb (Moellen) giver 7-1-1; foelgeren: tre forloeb og tre hjulpne, fordelt paa hoved og haand.
let t = fig; for (let i = 0; i < 6; i++) t = F.givNiveauPoint(t, 'forloeb', 'hoved').figur
kode.travl = [t.niveau, t.hoved, t.haand, t.hjerte, F.titelForNiveau(t.niveau)]
let f = fig
for (const [h, e] of [['forloeb', 'hoved'], ['quest', 'hoved'], ['quest', 'hoved'], ['forloeb', 'haand'], ['forloeb', 'haand'], ['quest', 'haand']]) f = F.givNiveauPoint(f, h, e).figur
kode.foelger = [f.niveau, f.hoved, f.haand, f.hjerte, f.niveauPoint, F.titelForNiveau(f.niveau)]
kode.titler = [2, 3, 4, 5, 7, 8, 10, 11].map((n) => [n, F.titelForNiveau(n)])
kode.questHalvtNiveau = F.NIVEAU_POINT.quest / 2
const bog = (id) => QB.BOG_QUESTS ? QB.BOG_QUESTS.find((q) => q.id === id) : null
kode.hansFoersteKraever = bog('sten-til-diget')?.kraever
kode.bigaardenKraever = bog('bistaderne')?.kraever
// Mine egne elev-552-koersler (fire terninger, efter 542): niveau og hjulpne for den travle og foelgeren paa 390.
ud.elev552 = ['525', '7', '42', '1234'].map((ter) => {
  const j = JSON.parse(readFileSync(path.join(HERE, '..', 'kritik-552', `elev-552-efter-${ter}.json`), 'utf8'))
  const k = (v) => j.koersler.find((x) => x.variant === v && x.bredde === 390)
  const tal = (v) => { const x = k(v); return { niveau: Number(x.hoved.match(/Niveau (\d+)/)[1]), titel: x.hoved.match(/· (\S+)/)[1], hjulpet: x.log.filter((l) => l.art === 'tak').length } }
  return { terning: ter, travl: tal('travl'), foelger: tal('foelger') }
})
ud.kode = kode

// --- tjek ------------------------------------------------------------------------------------------
const alle = (fn) => Object.values(ud.sider).every(fn)
paastaa('Siden paa skrivebordet er magen til kopien i matematik main (outputs/557)', ud.magenTilKopi)
paastaa('Ingen scripts, links eller eksterne filer; intet net; ingen JS-fejl', ud.scripts === 0 && alle((s) => s.net.length === 0 && s.jsFejl.length === 0))
paastaa('Ingen vandret rulning paa 360, 390 (lys og moerk) og 1280', alle((s) => s.side <= s.klient), Object.entries(ud.sider).map(([k, s]) => [k, s.side, s.skaerme]))
paastaa('Kontrast mindst 4,5 og skrift mindst 12 px, lyst og moerkt', alle((s) => s.mindsteKontrast.k >= 4.5 && s.mindstePx >= 12), Object.entries(ud.sider).map(([k, s]) => [k, s.mindsteKontrast, s.mindstePx]))
const m2 = s390.valg.find((v) => v.id === 'm2'), n1 = s390.valg.find((v) => v.id === 'n1')
paastaa('Hvert valg (M2 A-C, N1 A, A+, B, C) har "Eleven mærker"', [...m2.muligheder, ...n1.muligheder].every((m) => m.maerker.some((x) => /^Eleven mærker/.test(x))), [...m2.muligheder, ...n1.muligheder].map((m) => m.bogstav))
paastaa('N6: N1 A siger, at titlen forsvinder ("mister titlen", "Lærling" igen)', /mister titlen/.test(n1.muligheder.find((m) => m.bogstav === 'A').advarsel || '') && /Lærling/.test(n1.muligheder.find((m) => m.bogstav === 'A').advarsel || ''))
paastaa('N7: M2 A siger, at Hjerte starter paa 1 (Hjerte 1 = har ikke hjulpet nogen), og A0 er naevnt', /starter stadig på 1/.test(m2.muligheder[0].tekst) && /Hjerte 1 = har ikke hjulpet nogen/.test(m2.muligheder[0].tekst) && /M2 A0/.test(m2.muligheder[0].tekst))
paastaa('Forslaget er maerket ("Mit forslag") paa een mulighed pr. valg: M2 A og N1 A+', s390.forslag.length === 2 && m2.muligheder.filter((m) => m.forslag).map((m) => m.bogstav).join() === 'A' && n1.muligheder.filter((m) => m.forslag).map((m) => m.bogstav).join() === 'A+')
paastaa('Eksemplet paa et svar er praecis Ganitas forslag', s390.svar === 'matematik: M2 A, N1 A+', s390.svar)
paastaa('Siden siger ikke, hvem "mit" er, foer foden ("Ganita, ordre 557")', !/Ganitas forslag|Ganita foreslår/.test(T.split('Åbent, ikke et valg')[0]) && /Ganita, ordre 557/.test(T))
paastaa('M2 A siger ikke, hvad der sker med tallene hos en elev, der allerede spiller (regnes de om?)', !/allerede|regnes om|i dag har/.test(m2.muligheder[0].tekst), m2.muligheder[0].tekst)
paastaa('M2 A0 siger, at den travle faar Hjerte 0, men ikke at en elev, der spiller, ser tallet falde fra 1 til 0', /M2 A0/.test(m2.muligheder[0].tekst) && !/falde|falder|mister/.test(m2.muligheder[0].tekst))
paastaa('Kode: en ny figur har 1-1-1', kode.m2Start.join() === '1,1,1', kode.m2Start)
paastaa('Kode: seks mestrede forloeb ved Moellen giver 7-1-1, niveau 7, Svend', kode.travl.join() === '7,7,1,1,Svend', kode.travl)
paastaa('Kode: tre forloeb og tre hjulpne giver niveau 5 med et halvt niveau i vente, Hjerte 1', kode.foelger[0] === 5 && kode.foelger[3] === 1 && kode.foelger[4] === 1, kode.foelger)
paastaa('Kode: titlerne fra niveau 3, 5, 8 og 11', JSON.stringify(kode.titler) === JSON.stringify([[2, null], [3, 'Lærling'], [4, 'Lærling'], [5, 'Svend'], [7, 'Svend'], [8, 'Mester'], [10, 'Mester'], [11, 'Stormester']]))
paastaa('Kode: at hjaelpe (en quest) giver et halvt niveau i dag (N1 C)', kode.questHalvtNiveau === 0.5)
paastaa('Kode: Hans\' foerste opgave kraever Grusgravens forloeb 1 (N8); Bigaarden kraever Moellens forloeb 6 og Anes aebleskiver (M2 B "i dag")', JSON.stringify(kode.hansFoersteKraever) === '{"forloeb":["stenbrud",1]}' && JSON.stringify(kode.bigaardenKraever) === '{"forloeb":["moellen",6],"quests":["aebleskiver"]}', [kode.hansFoersteKraever, kode.bigaardenKraever])
paastaa('Elev-552 (terning 525): den travle niveau 7 Svend, foelgeren niveau 5 og hjulpet 3, som siden siger', ud.elev552[0].travl.niveau === 7 && ud.elev552[0].travl.titel === 'Svend' && ud.elev552[0].foelger.niveau === 5 && ud.elev552[0].foelger.hjulpet === 3)
paastaa('Elev-552 over fire terninger: den travle 7-9 (Svend eller Mester), foelgeren 4-8; siden naevner kun terning 525', ud.elev552.map((e) => e.travl.niveau).join() === '7,8,9,7' && ud.elev552.map((e) => e.foelger.niveau).join() === '5,4,8,4', ud.elev552)
ud.tjek = tjek
delete s390.tekst
for (const s of Object.values(ud.sider)) delete s.tekst
writeFileSync(path.join(HERE, 'valg-564.json'), JSON.stringify(ud, null, 1))
const nej = tjek.filter((x) => !x.ok).length
console.log(`${tjek.length - nej}/${tjek.length} tjek groenne (matematik ${SHA})`, JSON.stringify(ud.fagord), JSON.stringify(ud.kunIMd))
if (nej) process.exitCode = 1
