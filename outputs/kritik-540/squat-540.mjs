// Kritik 540, blok 1: squat-artiklen efter Setus 534 (U12: de tre referencekroppe, U15: 0,09 m/s
// med Hales m.fl. 2009). Kapitel 3's tabel og kapitel 7 mod loeftmodellens main.
//   node outputs/kritik-540/squat-540.mjs          -> squat-540.json og S-*.png
// Grenen `udgivelse-squat-min-krop` hentes med `git archive` fra entropi-coaching-site-wt2 til en
// midlertidig mappe (intet trae roeres, ingen gren skiftes), serveres paa 127.0.0.1 og koeres
// headless i Chromium paa 390 (touch) og 1280 px med alle folder aabne. Alt uden for huset
// blokeres og taelles. Loeftmodellens tal laeses med `git show main:...` fra
// entropi-loeftmodel-dhruva: docs/REFERENCEKROPPE.md, docs/squat-litteratur.md,
// outputs/anatomi/tal-balanceret-lowbar.json (kapitel 3), outputs/fejl-marc/tal.json (kapitel 7's
// to foerste) og outputs/fejlbilleder/tal-balanceret-lowbar.json (kapitel 7's fire sidste).
// Atletnavne: fornavnene fra appens .gitignore, ikke skrevet ud.
import { createRequire } from 'node:module'
import { homedir, tmpdir } from 'node:os'
import path, { join } from 'node:path'
import { writeFileSync, readFileSync, mkdtempSync, existsSync, statSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SITE = 'C:/Users/Entropi/Desktop/entropi-coaching-site-wt2'
const LM = 'C:/Users/Entropi/Desktop/entropi-loeftmodel-dhruva'
const GREN = 'udgivelse-squat-min-krop'
const sh = (c) => execSync(c, { maxBuffer: 1 << 26 }).toString()
const top = sh(`git -C "${SITE}" rev-parse --short ${GREN}`).trim()
const lmTop = sh(`git -C "${LM}" rev-parse --short main`).trim()
const lm = (f) => sh(`git -C "${LM}" show main:${f}`)
const dir = mkdtempSync(join(tmpdir(), 'k540-'))
execSync(`git -C "${SITE}" archive -o "${join(dir, 'g.tar')}" ${GREN}`)
execSync('tar -xf g.tar', { cwd: dir })

const tjek = []
const paastaa = (hvad, ok, data) => { tjek.push({ hvad, ok: !!ok, data }); console.log(`${ok ? 'ok ' : 'NEJ'} ${hvad}${data !== undefined ? ' ' + JSON.stringify(data).slice(0, 300) : ''}`) }
const dk = (x, d) => Number(x).toFixed(d).replace('.', ',').replace(/^-/, '-')
const navne = [...new Set([...readFileSync(join(HERE, '..', '..', '.gitignore'), 'utf8').matchAll(/^supabase\/([a-z]+)-\*/gm)].map((m) => m[1]).filter((n) => n !== 'marc'))]

// --- loeftmodellens main ----------------------------------------------------------------------
const refDoc = lm('docs/REFERENCEKROPPE.md')
const lit = lm('docs/squat-litteratur.md')
const anat = JSON.parse(lm('outputs/anatomi/tal-balanceret-lowbar.json'))
const fm = JSON.parse(lm('outputs/fejl-marc/tal.json'))
const fb = JSON.parse(lm('outputs/fejlbilleder/tal-balanceret-lowbar.json'))
const refRaekker = refDoc.split('\n').filter((l) => /^\| (balanceret|fejlkroppen|gennemsnitlig)/.test(l)).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()))
const kroppe = Object.fromEntries(refRaekker.map((r) => [r[0].split(' ')[0], { hoejde: r[2], vaegt: r[3], stang: r[4], laengder: r[5], arme: r[6], momenter: r[7] }]))

// --- artiklen som kilde ---------------------------------------------------------------------
const html = readFileSync(join(dir, 'artikel-squat.html'), 'utf8')
const tekstAf = (s) => s.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ')
const kapitel = (id) => tekstAf(html.split(`id="${id}"`)[1].split('<section class="kapitel"')[0])
const k2 = kapitel('kap-segmentmodellen'), k3 = kapitel('kap-anatomien'), k6 = kapitel('kap-virkeligheden'), k7 = kapitel('kap-fejlbilleder')
const intro = tekstAf(html.split('class="article-intro"')[1].split('<div role="navigation"')[0])
const u12 = k2.match(/Tallene i artiklen står på tre referencekroppe\.[^]*?i squat\./)?.[0] ?? ''

// U12 mod REFERENCEKROPPE.md
const [b, f, g] = [kroppe.balanceret, kroppe.fejlkroppen, kroppe.gennemsnitlig]
paastaa('REFERENCEKROPPE: tre kroppe laest fra main', b && f && g, { b, f, g })
paastaa('U12 balanceret: 78 kg, 100 kg, 42/42/50, ca. 171-174, kap. 1-5 og de fire sidste',
  b.vaegt === '78 kg' && b.stang === '100 kg' && b.laengder === '42,0 / 42,0 / 50,0' && /171-174/.test(b.hoejde) &&
  /vejer 78 kg og har 100 kg på stangen/.test(u12) && /lår 42, skinneben 42 og torso 50 cm/.test(u12) && /ca\. 171 til 174 cm/.test(u12) && /kapitel 1 til 5 og de fire sidste fejlbilleder i kapitel 7/.test(u12))
paastaa('U12 fejlkroppen: 183 cm og 120 kg antaget, stang 120 kg, laengder udledt',
  f.hoejde === '183 cm (antaget)' && f.vaegt === '120 kg (antaget)' && f.stang === '120 kg' &&
  /krop på 183 cm og 120 kg med 120 kg på stangen, hvor højde og vægt er antaget og længderne udledt af højden/.test(u12))
paastaa('U12 gennemsnit: 178 cm, 85 kg, 120 kg i squat', g.hoejde === '178 cm' && g.vaegt === '85 kg' && g.stang === '120 kg' && /178 cm og 85 kg med 120 kg på stangen i squat/.test(u12))
paastaa('kap. 7 indledning og begge momenttabeller siger den antagne krop', /en antaget krop på 183 cm og 120 kg med 120 kg på stangen/.test(k7) && (k7.match(/Antaget krop på 183 cm og 120 kg med 120 kg på stangen/g) ?? []).length === 2)
const armB = b.arme.split(' / '), armF = f.arme.split(' / '), momB = b.momenter.split(' / '), momF = f.momenter.split(' / ')
paastaa('kap. 7 fejlkroppens arme og momenter = REFERENCEKROPPE (21,7/23,0 cm, 435/497 Nm)',
  k7.includes(`til knæet, 29,1 cm mod ${armF[1]} i referencen, og til hoften, 15,7 cm mod ${armF[0]}`) && k7.includes(`<td>${momF[1]},0</td>`.replace(/<[^>]+>/g, '')) !== false &&
  html.includes(`<th scope="row">Knæ</th><td>${momF[1]},0</td>`) && html.includes(`<th scope="row">Hofte</th><td>${momF[0]},1</td>`), { armF, momF })
paastaa('kap. 7 balanceret: stang til hofte/knae 20,5/21,4 cm og 312/345 Nm = REFERENCEKROPPE',
  k7.includes(`mod ${armB[0]} og ${armB[1]} cm i referencen`) && html.includes(`<th scope="row">Knæ</th><td>${momB[1]},4</td>`) && html.includes(`<th scope="row">Hofte</th><td>${momB[0]},4</td>`), { armB, momB })

// U15 mod squat-litteratur.md kilde 4
const kilde4 = lit.split('**Kilde 4.**')[1].split('**Kilde 5.**')[0].replace(/\s+/g, ' ')
const u15 = html.match(/Hos 25 løftere ved en konkurrence var den lodrette stanghastighed 0,09 m\/s[^<]*/)?.[0] ?? ''
paastaa('U15: saetningen staar een gang, med Hales m.fl. 2009', (html.match(/0,09 m\/s/g) ?? []).length === 1 && /\(Hales m\.fl\., 2009\)/.test(u15), u15)
paastaa('U15: kilde 4 siger 25 loeftere, konkurrence, 0,09 m/s ved sticking point (ordret "squat (0.09 m/s)")',
  /25 løftere under en regional styrkeløftskonkurrence/.test(kilde4) && /Ved squattens sticking point: lodret stanghastighed 0,09 m\/s/.test(kilde4) && /"The statistical analysis revealed significant differences exist between the squat \(0\.09 m\/s\)/.test(kilde4) && /quantified at the sticking point/.test(kilde4))
paastaa('U15: torsoen ca. 49 grader fra lodret = 90 - 40,6', /torsovinkel 40,6° ± 6,3 mod vandret \(49° fra lodret\)/.test(kilde4) && Math.round(90 - 40.6) === 49 && /torsoen ca\. 49° fra lodret/.test(u15))
paastaa('U15: Hales i referencelisten, 0,11 m/s stadig med Larsen', /Hales, M\. E\., Johnson, B\. F\., &amp; Johnson, J\. T\. \(2009\)/.test(html) && /0,11 m\/s[^<]*<span class="kilde">[^<]*Larsen m\.fl\. \(2021a\)/.test(html))

// kapitel 3's tekst mod anatomi-tallene (balanceret, lowbar)
// JSON-filen gemmer andelen med 3 decimaler og armen med 2; siden regner med fuld praecision.
// Ligger JSON-tallet paa en halv enhed (0,945 -> 94 eller 95), er begge afrundinger rigtige.
const muligt = (x, faktor, tol) => [...new Set([Math.round(x * faktor - tol), Math.round(x * faktor + tol)])]
const ALT = (xs) => (xs.length === 1 ? String(xs[0]) : `«${xs.join('~')}»`)
const pct = (fase, gr) => ALT(muligt(anat.faser[fase].grupper[gr].andelAfEgetMax, 100, 0.05))
const span = (fase, a, bb) => `${pct(fase, a)}-${pct(fase, bb)} %`
const k3forventet = [
  `er ${span('opstilling', 'soleus', 'gastrocnemius')} af sit eget største`,
  `Knæstrækkernes krav er ${pct('halvvejs', 'kvadriceps')} % af deres eget største, læggens ${span('halvvejs', 'soleus', 'gastrocnemius')}, sædemusklens ${pct('halvvejs', 'gluteusMaximus')} %, baglårets ${pct('halvvejs', 'hamstrings')} %, stor adduktors ${pct('halvvejs', 'adduktorMagnus')} % og rygstrækkernes ${pct('halvvejs', 'rygstraekkere')} %`,
  `bøjet ${Math.round(anat.faser.halvvejs.hoftefleksionGrader)}° mellem torso og lår`,
  `Knæstrækkernes krav er ${pct('bund', 'kvadriceps')} % af deres eget største, læggens ${span('bund', 'soleus', 'gastrocnemius')} og rygstrækkernes ${pct('bund', 'rygstraekkere')} %`,
  `Hoften er her bøjet ${Math.round(anat.faser.bund.hoftefleksionGrader)}°`,
  `Knæstrækkernes krav er ${pct('sticking', 'kvadriceps')} % af deres eget største, læggens ${span('sticking', 'soleus', 'gastrocnemius')}, sædemusklens og stor adduktors ${pct('sticking', 'gluteusMaximus')} %, baglårets ${pct('sticking', 'hamstrings')} % og rygstrækkernes ${pct('sticking', 'rygstraekkere')} %`,
  `(110° mod 134°)`, `(90 % mod 75 %)`,
  `(${dk(anat.faser.sticking.grupper.kvadriceps.momentarmCm, 1)} mod ${dk(anat.faser.bund.grupper.kvadriceps.momentarmCm, 1)} cm)`,
  `(24 mod ${Math.round(Number(armB[1].replace(',', '.')))} cm)`,
  `Alle tal i kapitlet gælder den balancerede referencekrop med lowbar`,
]
const somRegex = (s) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/«([^»]*)»/g, (m, a) => `(?:${a.split('~').join('|')})`))
const k3mangler = k3forventet.filter((s) => !somRegex(s).test(k3))
paastaa(`kap. 3's tekst: ${k3forventet.length} tal-saetninger = anatomi-tallene`, k3mangler.length === 0, k3mangler)
const cap = (fase, navn) => { const x = anat.faser[fase]; return `${navn} Skinneben ${Math.round(x.skinnebenGrader)}°, knæfleksion ${Math.round(x.knaefleksionGrader)}°, hoftefleksion ${Math.round(x.hoftefleksionGrader)}° (torso-lår), torso ${Math.round(x.torsoFraLodretGrader)}° fra lodret.` }
const k3cap = [cap('opstilling', 'Opstilling / lockout.'), cap('halvvejs', 'Halvvejs ned.'), cap('bund', 'Bund.'), cap('sticking', 'Sticking point.')].filter((s) => !k3.includes(s))
paastaa('kap. 3\'s fire billedtekster = anatomi-tallene', k3cap.length === 0, k3cap)
paastaa('kap. 3: krop og stang i anatomi-tallene er balanceret 78/100, lowbar', anat.krop === 'balanceret' && anat.stang === 'lowbar' && anat.kropsmaal.bodyMass === 78 && anat.kropsmaal.barMass === 100)

// kapitel 7 mod loeftmodellens tal
const tabeller = [...html.matchAll(/<table class="fejl-moment">([\s\S]*?)<\/table>/g)].map((m) => [...m[1].matchAll(/<tr><th scope="row">([^<]+)<\/th><td>([^<]+)<\/td><td>([^<]+)<\/td><td>([^<]+)<\/td><\/tr>/g)].map((r) => r.slice(1)))
const led = [['Ankel', 'ankel'], ['Knæ', 'knae'], ['Hofte', 'hofte'], ['Lænd (L5/S1)', 'laend']]
const tabelSkal = (foer, efter) => led.map(([n, k]) => [n, dk(foer[k], 1), dk(efter[k], 1), (efter[k] - foer[k] > 0.04 ? '+' : '') + dk(efter[k] - foer[k], 1)])
const V = fm.versioner
const skal7 = [
  tabelSkal(V.reference.bund.momentNm, V['kun-knae'].bund.momentNm),
  tabelSkal(V.reference.bund.momentNm, V['hofte-tilbage'].bund.momentNm),
  ...['god-morgen', 'haele-letter', 'stang-foran-midtfod', 'for-lidt-dybde'].map((id) => { const x = fb.fejlbilleder[id]; const o = (m) => ({ ankel: m.ankelNm, knae: m.knaeNm, hofte: m.hofteNm, laend: m.laendNm }); return tabelSkal(o(x.momentFoer), o(x.momentEfter)) }),
]
const tabelAfvig = []
skal7.forEach((t, i) => t.forEach((r, j) => { const a = tabeller[i]?.[j]?.map((c) => c.replace('-0,0', '0,0')); const s = r.map((c) => c.replace('-0,0', '0,0')); if (!a || a.join('|') !== s.join('|')) tabelAfvig.push({ tabel: i, a, s }) }))
paastaa('kap. 7: alle seks momenttabeller = loeftmodellens tal (24 raekker)', tabeller.length === 6 && tabelAfvig.length === 0, tabelAfvig)
const kk = V['kun-knae'], ht = V['hofte-tilbage'], rf = V.reference
const r0 = (x) => dk(x, 0), r1 = (x) => dk(x, 1)
const k7forventet = [
  `hælen letter, ${r1(kk.bund.haelHoejdeCm)} cm`, `Stangen står ${r1(kk.bund.stangFraMidtfodCm)} cm foran midtfoden mod ${r0(-rf.bund.stangFraMidtfodCm)} cm bagved`,
  `torsoen står ${r0(kk.bund.torso)}° fra lodret mod ${r0(rf.bund.torso)}°`,
  `Knæets momentarm vokser fra ${r0(rf.bund.momentarmKnaeCm)} til ${r0(kk.bund.momentarmKnaeCm)} cm, og hoftens falder fra ${r0(rf.bund.momentarmHofteCm)} til ${r0(kk.bund.momentarmHofteCm)} cm`,
  `knæmomentet stiger fra ${r0(rf.bund.momentNm.knae)} til ${r0(kk.bund.momentNm.knae)} Nm, hoftemomentet falder fra ${r0(rf.bund.momentNm.hofte)} til ${r0(kk.bund.momentNm.hofte)} Nm, og lændens fra ${r0(rf.bund.momentNm.laend)} til ${r0(kk.bund.momentNm.laend)} Nm`,
  `${r0(kk.sticking.torso)}° mod ${r0(rf.sticking.torso)}°`, `stangen ${r1(kk.sticking.stangFraMidtfodCm)} cm foran midtfoden`,
  `stiger hoften ${r1(kk.bundTilSticking.hofteOpCm)} cm og skulderen ${r1(kk.bundTilSticking.skulderOpCm)} cm, mod ${r1(rf.bundTilSticking.hofteOpCm)} og ${r1(rf.bundTilSticking.skulderOpCm)} cm`,
  `Knæ ${r0(kk.bund.knae)}°, hofte ${r0(kk.bund.hofte)}°, skinneben ${r0(kk.bund.skinneben)}°, torso ${r0(kk.bund.torso)}° fra lodret. Hælen ${r1(kk.bund.haelHoejdeCm)} cm oppe, stangen ${r1(kk.bund.stangFraMidtfodCm)} cm foran midtfoden`,
  `Med skinnebenet ${r0(ht.bund.skinneben)}° fra lodret mod referencens ${r0(rf.bund.skinneben)}°`, `torsoen falder frem til ${r0(ht.bund.torso)}° mod ${r0(rf.bund.torso)}°`,
  `Hoftens momentarm vokser fra ${r0(rf.bund.momentarmHofteCm)} til ${r0(ht.bund.momentarmHofteCm)} cm, og knæets falder fra ${r0(rf.bund.momentarmKnaeCm)} til ${r0(ht.bund.momentarmKnaeCm)} cm`,
  `Hoftemomentet stiger fra ${r0(rf.bund.momentNm.hofte)} til ${r0(ht.bund.momentNm.hofte)} Nm, lændens fra ${r0(rf.bund.momentNm.laend)} til ${r0(ht.bund.momentNm.laend)} Nm`,
  `knæmomentet falder fra ${r0(rf.bund.momentNm.knae)} til ${r0(ht.bund.momentNm.knae)} Nm`,
  `stiger hoften ${r0(ht.bundTilSticking.hofteOpCm)} cm frem til sticking point, mens skulderen kun stiger ${r0(ht.bundTilSticking.skulderOpCm)} cm; i referencen stiger hoften ${r0(rf.bundTilSticking.hofteOpCm)} cm og skulderen ${r0(rf.bundTilSticking.skulderOpCm)} cm`,
  `torsoen ${r0(ht.sticking.torso)}°, og stangen står ${r1(ht.sticking.stangFraMidtfodCm)} cm foran midtfoden`,
  `Knæ ${r0(ht.bund.knae)}°, hofte ${r0(ht.bund.hofte)}°, skinneben ${r0(ht.bund.skinneben)}°, torso ${r0(ht.bund.torso)}° fra lodret. Stangen ${r1(ht.bund.stangFraMidtfodCm)} cm foran midtfoden`,
  `til hoften, ${r1(ht.bund.momentarmHofteCm)} cm mod ${r1(rf.bund.momentarmHofteCm)} i referencen, og til knæet, ${r1(ht.bund.momentarmKnaeCm)} cm mod ${r1(rf.bund.momentarmKnaeCm)}`,
  `stiger hoften ${r1(ht.bundTilSticking.hofteOpCm)} cm og skulderen ${r1(ht.bundTilSticking.skulderOpCm)} cm, mod ${r1(rf.bundTilSticking.hofteOpCm)} og ${r1(rf.bundTilSticking.skulderOpCm)} cm`,
]
const gm = fb.fejlbilleder['god-morgen'], hl = fb.fejlbilleder['haele-letter'], sf = fb.fejlbilleder['stang-foran-midtfod'], ld = fb.fejlbilleder['for-lidt-dybde']
k7forventet.push(
  `hæves hoften ${gm.hipRiseCm} cm ved uændret skulderhøjde, og torsoen hælder ${r1(gm.torsoDeltaDeg)}° mere, fra ${r0(gm.baseline.torsoLeanDeg)}° til ${r0(gm.variant.torsoLeanDeg)}°`,
  `Knæmomentet falder ${r0(-gm.momentDelta.knaeNm)} Nm, og hofte- og lændmomentet stiger ${r0(gm.momentDelta.hofteNm)} og ${r0(gm.momentDelta.laendNm)} Nm`,
  `ankelgrænsen sat til ${hl.ankleDorsiflexionMaxDeg}°`, `torsoen hælder ${r0(hl.variant.torsoLeanDeg)}° mod ${r0(hl.baseline.torsoLeanDeg)}°`,
  `Knæmomentet falder ${r0(-hl.momentDelta.knaeNm)} Nm, og hofte- og lændmomentet stiger ${r0(hl.momentDelta.hofteNm)} og ${r0(hl.momentDelta.laendNm)} Nm`,
  `Flyttes stangen ${sf.forwardDeltaCm} cm frem, fra ${r1(-sf.afstandTilMidtfodFoerCm)} cm bagved til ${r1(sf.afstandTilMidtfodEfterCm)} cm foran midtfoden, stiger momentet om både ankel, hofte og lænd med ${r0(sf.momentDelta.hofteNm)} Nm`,
  `Stopper hoften ${ld.hipRiseCm} cm højere`, `(knæet ${r1(ld.momentDelta.knaeNm)} Nm)`,
)
const k7mangler = k7forventet.filter((s) => !k7.includes(s))
paastaa(`kap. 7's tekst og billedtekster: ${k7forventet.length} tal-saetninger = loeftmodellens tal`, k7mangler.length === 0, k7mangler)
paastaa('kap. 7: fejl-marc er regnet paa 183 cm-kroppen med 120 kg stang', fm.krop.bodyMass === 120 && fm.krop.barMass === 120 && /marc\.json/.test(fm.krop.kilde) && fb.kropsmaal.bodyMass === 78 && fb.kropsmaal.barMass === 100)

// Fund (U17-U20): det, der ikke passer
const fund = {
  U17: { tekst: /Hvert fejlbillede er en afvigelse fra den balancerede referencekrops løste positur i bunden/.test(k7) && /Gælder balanceret krop, lowbar\.Løftmodellens/.test(k7) },
  U18: { tekst: /Modellen har registreret seks fejlbilleder i alt/.test(k7), iModellen: Object.keys(fb.fejlbilleder).length, liste: Object.keys(fb.fejlbilleder) },
  U19: { u12NaevnerKap6: /kapitel 6/.test(u12), u12NaevnerKap8: /kapitel 8/.test(u12), kap6: (k6.match(/Modellen får kroppens mål \(183 cm, 120 kg\)/) ?? [''])[0], kap6Antaget: /antaget/.test(k6), intro: /en segmentmodel af en opdigtet referencekrop/.test(intro) },
  U20: { minKropSomVaerktoej: /Min krop viser uden egne mål/.test(u12), markeret: /<(a|strong|em)[^>]*>Min krop<\/(a|strong|em)> viser uden egne mål/.test(html) },
}
paastaa('fund U17-U20 er som beskrevet i SQUAT.md', fund.U17.tekst && fund.U18.tekst && fund.U18.iModellen === 8 && !fund.U19.u12NaevnerKap6 && !fund.U19.kap6Antaget && fund.U19.intro && fund.U20.minKropSomVaerktoej && !fund.U20.markeret, fund)

// --- siden i browseren ------------------------------------------------------------------------
const TYPER = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json' }
const server = createServer((req, res) => {
  let fil = join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname))
  if (existsSync(fil) && statSync(fil).isDirectory()) fil = join(fil, 'index.html')
  if (!existsSync(fil)) { res.writeHead(404); return res.end('404') }
  res.writeHead(200, { 'content-type': TYPER[path.extname(fil).toLowerCase()] ?? 'application/octet-stream' })
  res.end(readFileSync(fil))
})
await new Promise((ok) => server.listen(0, '127.0.0.1', ok))
const BASE = `http://127.0.0.1:${server.address().port}/`
const require = createRequire(import.meta.url)
const { chromium } = require(join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright'))
const browser = await chromium.launch()
const sider = []
const faseNavn = { opstilling: 'opstilling', halvvejs: 'halvvejs', bund: 'bund', sticking: 'sticking', lockout: 'lockout' }
const gruppeRaekke = ['kvadriceps', 'gluteusMaximus', 'hamstrings', 'adduktorMagnus', 'soleus', 'gastrocnemius', 'rygstraekkere']
for (const w of [390, 1280]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, hasTouch: w === 390, isMobile: w === 390, deviceScaleFactor: w === 390 ? 2 : 1 })
  const page = await ctx.newPage()
  const r = { bredde: w, sidefejl: [], http404: [], eksterne: 0 }
  page.on('pageerror', (e) => r.sidefejl.push(e.message))
  page.on('response', (s) => { if (s.status() >= 400 && s.url().startsWith(BASE)) r.http404.push(s.url().slice(BASE.length)) })
  await page.route('**/*', (route) => (route.request().url().startsWith(BASE) ? route.continue() : (r.eksterne++, route.abort())))
  await page.goto(BASE + 'artikel-squat.html', { waitUntil: 'load' })
  await page.waitForTimeout(1500)
  await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true }))
  await page.waitForTimeout(600)
  const t = await page.evaluate(() => document.body.innerText)
  Object.assign(r, {
    vandret: await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    tankestreger: (t.match(/[–—]/g) ?? []).length,
    synligMarc: (t.match(/\[MARC/g) ?? []).length,
    atletnavne: navne.reduce((a, n) => a + (t.match(new RegExp(`\\b${n}\\b`, 'gi')) ?? []).length, 0),
    u12Synlig: t.includes('Tallene i artiklen står på tre referencekroppe.'),
    u15Synlig: t.includes('0,09 m/s ved sticking point'),
  })
  // kapitel 3's tabel i hver stilling
  r.tabel = {}
  const afvig = []
  for (const fase of Object.keys(faseNavn)) {
    await page.locator(`#anatomi-panel button[data-fase="${fase}"]`).first()[w === 390 ? 'tap' : 'click']()
    await page.waitForTimeout(250)
    const rows = await page.evaluate(() => [...document.querySelectorAll('#anatomi-panel .anatomi-tabel tbody tr')].map((tr) => [...tr.children].map((td) => td.textContent.trim())))
    r.tabel[fase] = rows
    rows.forEach((row, i) => {
      const gr = anat.faser[fase].grupper[gruppeRaekke[i]]
      const andele = gr.andelAfEgetMax == null ? ['-'] : muligt(gr.andelAfEgetMax, 100, 0.05).map((x) => `${x} %`)
      const arme = muligt(gr.momentarmCm, 10, 0.05).map((x) => dk(x / 10, 1))
      if (!arme.includes(row[2]) || !andele.includes(row[3])) afvig.push({ fase, gruppe: gruppeRaekke[i], side: [row[2], row[3]], model: [arme, andele] })
    })
  }
  r.tabelAfvig = afvig
  r.tabelSkrift = await page.evaluate(() => { const td = document.querySelector('#anatomi-panel .anatomi-tabel td'); const wr = document.querySelector('#anatomi-panel .anatomi-tabel-wrap'); return { px: parseFloat(getComputedStyle(td).fontSize), egetRullelag: wr.scrollWidth > wr.clientWidth } })
  await page.locator('#anatomi-panel button[data-fase="bund"]').first().click()
  const skud = async (sel, navn) => { const el = page.locator(sel).first(); await el.scrollIntoViewIfNeeded(); await page.waitForTimeout(200); await el.screenshot({ path: join(HERE, `S-${w}-${navn}.png`) }) }
  await skud('#kap-segmentmodellen p:nth-of-type(3)', 'u12')
  await skud('#anatomi-panel', 'kap3-tabel')
  await skud('#kap-fejlbilleder table.fejl-moment', 'kap7-kun-knaeene')
  await skud('#fase-sticking-point p:nth-of-type(4)', 'u15')
  sider.push(r)
  await ctx.close()
}
await browser.close()
server.close()
for (const r of sider) {
  paastaa(`${r.bredde}: ingen vandret rul, 0 JS-fejl, 0 404, 0 tankestreger, 0 [MARC, 0 atletnavne`, r.vandret && !r.sidefejl.length && !r.http404.length && !r.tankestreger && !r.synligMarc && !r.atletnavne, { e: r.eksterne, f: r.sidefejl, h: r.http404, t: r.tankestreger })
  paastaa(`${r.bredde}: U12 og U15 synlige`, r.u12Synlig && r.u15Synlig)
  paastaa(`${r.bredde}: kap. 3's tabel i alle fem stillinger (35 raekker) = anatomi-tallene`, Object.values(r.tabel).every((x) => x.length === 7) && r.tabelAfvig.length === 0, r.tabelAfvig)
}
const ud = { gren: GREN, top, loeftmodelMain: lmTop, navneTjekket: navne.length, kroppe, fund, tjek, sider: sider.map(({ tabel, ...x }) => x), tabel390: sider[0].tabel }
writeFileSync(join(HERE, 'squat-540.json'), JSON.stringify(ud, null, 2) + '\n')
console.log(`squat-540: ${tjek.filter((x) => x.ok).length}/${tjek.length} tjek groenne (site ${top}, loeftmodel ${lmTop})`)
