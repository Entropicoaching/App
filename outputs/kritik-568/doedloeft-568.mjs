// Kritik 568, blok 1: doedloeft-artiklen efter Setus 561, klar naar Marc har svaret?
//   node outputs/kritik-568/doedloeft-568.mjs     -> doedloeft-568.json og D-*.png
// Grenen `artikel-doedloeft` hentes med `git archive` fra entropi-coaching-site-wt2 (ingen gren skiftes,
// intet trae roeres). Loeftmodellens dist hentes med `git archive main dist` fra entropi-loeftmodel-dhruva.
// Marcs spoergsmaal laeses fra C:\Users\Entropi\Desktop\LAES-DOEDLOEFT-BAENK.html (kun laest).
// 1) Tallene i teksten holdes op mod dist (doedloeft-figurer, marcs-doedloeft, loeft-fejl) og tre-loeft.
// 2) Figurerne: kun title/desc/aria og navnet (og lockoutmomentet) maa vaere skiftet ud.
// 3) [MARC]-stederne mod laesesiden. 4) Siden headless paa 390 (touch) og 1280 (mus) uden net.
// Atletnavne: fornavnene fra appens .gitignore, ikke skrevet ud.
import { createRequire } from 'node:module'
import { homedir, tmpdir } from 'node:os'
import path, { join } from 'node:path'
import { writeFileSync, readFileSync, mkdtempSync, existsSync, statSync, readdirSync, mkdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SITE = 'C:/Users/Entropi/Desktop/entropi-coaching-site-wt2'
const LM = 'C:/Users/Entropi/Desktop/entropi-loeftmodel-dhruva'
const LAES = 'C:/Users/Entropi/Desktop/LAES-DOEDLOEFT-BAENK.html'
const GREN = 'artikel-doedloeft'
const sh = (c) => execSync(c, { maxBuffer: 1 << 26 }).toString()
const top = sh(`git -C "${SITE}" rev-parse --short ${GREN}`).trim()
const lmTop = sh(`git -C "${LM}" rev-parse --short main`).trim()
const dir = mkdtempSync(join(tmpdir(), 'k568-'))
execSync(`git -C "${SITE}" archive -o "${join(dir, 'g.tar')}" ${GREN}`)
execSync('tar -xf g.tar', { cwd: dir })
const dist = join(dir, '_lm')
mkdirSync(dist)
execSync(`git -C "${LM}" archive -o "${join(dist, 'd.tar')}" main dist`)
execSync('tar -xf d.tar', { cwd: dist })
const D = (f) => readFileSync(join(dist, 'dist', f), 'utf8')

const tjek = []
const paastaa = (hvad, ok, data) => { tjek.push({ hvad, ok: !!ok, data }); console.log(`${ok ? 'ok ' : 'NEJ'} ${hvad}${data !== undefined ? ' ' + JSON.stringify(data).slice(0, 400) : ''}`) }
const navne = [...new Set([...readFileSync(join(HERE, '..', '..', '.gitignore'), 'utf8').matchAll(/^supabase\/([a-z]+)-\*/gm)].map((m) => m[1]).filter((n) => n !== 'marc'))]
const tekstAf = (s) => s.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ')

// --- kilderne ------------------------------------------------------------------------------
const html = readFileSync(join(dir, 'artikel-doedloeft.html'), 'utf8')
const A = tekstAf(html)
const taet = (s) => s.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ')
const figIdx = taet(D('doedloeft-figurer/index.html'))
const marcsIdx = taet(D('marcs-doedloeft/index.html'))
const fejlIdx = taet(D('loeft-fejl/index.html'))
const svgTekst = (f) => [...D(f).matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]).join(' | ')
const lit = sh(`git -C "${LM}" show main:docs/doedloeft-litteratur.md`).replace(/\s+/g, ' ')

// 1) tallene: [hvad, i artiklen, i dist]
const par = [
  ['opstilling: vinkler', 'Knæ 98°, hofte 51°, skinneben 14°, torso 61° fra lodret', svgTekst('doedloeft-figurer/dl-konventionel-opstilling.svg'), /knæ 98°\s+hofte 51°\s+skinneben 14°\s+torso 61°/],
  ['opstilling: stang 22,5 cm, 3 cm foran, tyngdepunkt 1,4 bag', 'Stangen 22,5 cm over gulvet og 3 cm foran midtfoden', figIdx, /Opstilling: stangen 22,5 cm over gulvet.*Tyngdepunkt fra midtfod \(cm, \+ foran\)-1,4/],
  ['opstilling: momentarme og momenter', 'Knæ 0,8 cm, hofte 41,0 cm, lænd (L5/S1) 24,7 cm. Moment: hofte 1293,7 , lænd 728,7 , knæ 190,8 Nm', figIdx, /Momentarm hofte \(cm\)4135,3Momentarm lænd L5\/S1 \(cm\)24,721Moment knæ \(Nm\)190,8165Moment hofte \(Nm\)1293,71116,8Moment lænd L5\/S1 \(Nm\)728,7621,9/],
  ['knæhøjde: vinkler og 52,1 cm', 'Stangen 52,1 cm over gulvet, over midtfoden. Knæ 146°, hofte 95°, skinneben 1°, torso 53° fra lodret. Tyngdepunktet 2,5 cm bag midtfoden', figIdx, /Knæhøjde: stangen 52,1 cm over gulvet.*Knævinkel \(°\)146,3148,3Hoftevinkel \(°\)94,6105,3Torso fra lodret \(°\)52,944,2/],
  ['knæhøjde: momenter', 'Knæ 6,0 cm, hofte 30,1 cm, lænd 15,1 cm. Moment: hofte 986,8 , lænd 469,9 , knæ −131,8 Nm', figIdx, /Moment knæ \(Nm\)-131,8-155,7Moment hofte \(Nm\)986,8822,6Moment lænd L5\/S1 \(Nm\)469,9370,8/],
  ['lockout: 79,8 cm, 10 cm, 264 Nm', 'Modellens 264 Nm i hofte, lænd og knæ ved lockout er ens for konventionel og sumo', figIdx, /Lockout264,3 Nm264,3 Nm264,3 Nm264,3 Nm/],
  ['skulderen 5 og 12 cm foran stangen', 'skulderen står 5 cm foran stangen ved gulvet og 12 cm ved knæhøjde', figIdx, /Skulderen står 5 cm foran stangen ved gulvet og 12 cm ved knæhøjde/],
  ['kap. 3: arm 0,73 og overslag 0,71', 'Hoftens arm ved knæhøjde er 0,73 gange armen ved gulvet i modellen. Et overslag med torsovinklen fra det målte træk i kapitel 6 giver 0,71', figIdx, /Momentarm hofte \(cm\)4135,3/],
  ['kap. 3: skulderens moment 132 Nm = 270 kg x 9,81 x 5 cm', 'kun hvor stort momentet om skulderen er (132 Nm)', String(Math.round(270 * 9.81 * 0.05)), /^132$/],
  ['sumo: 85 cm, 40 grader, 50 mod 61, vejen 49,4 mod 57,3', 'standbredde på 85 cm og fødderne 40° ud. Set fra siden er låret kortere, fordi det peger ud til siden. Ved gulvet står torsoen 11° mere oprejst (50° mod 61°)', figIdx, /standbredde 85,3 cm, fødderne 40° ud.*konventionel 57,3 cm, sumo 49,4 cm/],
  ['sumo: 14-15 % og 17-21 %', 'Hofte- og lændmomentet er 14-15 % mindre ved gulvet og 17-21 % mindre ved knæhøjde, og stangens vej er 14 % kortere (49,4 mod 57,3 cm)', [1 - 1116.8 / 1293.7, 1 - 621.9 / 728.7, 1 - 822.6 / 986.8, 1 - 370.8 / 469.9, 1 - 49.4 / 57.3].map((x) => Math.round(x * 100)).join(','), /^14,15,17,21,14$/],
  ['sumo: figurteksterne', 'Knæ 89°, hofte 53°, torso 50° fra lodret', svgTekst('doedloeft-figurer/dl-sumo-opstilling.svg') + ' ' + svgTekst('doedloeft-figurer/dl-sumo-knaehoejde.svg'), /knæ 89°\s+hofte 53°.*torso 50°.*knæ 148°\s+hofte 105°.*torso 44°/],
  ['kap. 6: klippets fem billeder (tabellerne)', 'Hofte 79,7 ° ± 3,0 50,6 ° +29,1 ° nej', figIdx, /Hofte79,7 ° ± 3,050,6 °\+29,1 °nej/],
  ['kap. 6: 4 af 22', 'I alt ligger 4 af 22 pålidelige felter inden for én standardafvigelse', figIdx, /I alt 4 af 22 pålidelige, ikke-tilpassede felter/],
  ['kap. 6: stangen frem, 8-9 %, 68 -> 59, 4,9 -> 0,4 og 0,1 foran', 'torsoen går fra 68° til 59°', marcsIdx, /hoftens moment med 8 % \(1382 → 1268 Nm\) og lændens med 9 %.*torsoen rejser sig \(68° → 59°\).*står de 0,4 bag og 0,1 foran midtfoden/],
  ['kap. 6: 120 kg antaget, 0,3-0,4 cm', 'med 100 eller 140 kg flytter balancepunktet sig 0,3-0,4 cm', marcsIdx, /med 100 eller 140 kg flytter balancepunktet sig 0,3-0,4 cm/],
  ['kap. 7 hoften foerst: 11,9 cm, 14 grader, +12/+13 %, ankel -20 %, 4 cm fri', 'Hoften stiger 11,9 cm, og torsoen lægger sig 14° mere ned. Hoften får ca. 12 % og lænden ca. 13 % mere at holde, anklen ca. 20 % mindre', fejlIdx, /hoften stiger 11,9 cm og torsoen lægger sig 14° mere ned.*Falder: ankel −20 %.*Stangen er 4,0 cm fri af skinnebenet/],
  ['kap. 7 stangen frem: 6,5 cm, 6,1-6,5, +16/+35, armen -54 %, 2,5 bag -> 2,0 foran, ankel +104 %', 'Momentarmen om hofte, lænd og knæ bliver 6,1-6,5 cm længere. Hoften får ca. 16 % og lænden ca. 35 % mere at holde, armen, der holder stangen ind mod benene, ca. 54 % mindre, og tyngdepunktet flytter fra 2,5 cm bag midtfoden til 2,0 cm foran', fejlIdx, /bliver momentarmen om hofte, lænd og knæ 6,1-6,5 cm længere.*ankel \+104 %.*−54 %/],
  ['kap. 7: armen slipper -> hofte, lænd, knæ og ankel', 'Når armen slipper sit tag i stangen, flytter stangens vægt ud til hofte, lænd, knæ og ankel', fejlIdx, /Når det slippes, flytter stangens vægt ud til hofte, lænd, knæ og ankel/],
  ['Escamilla: 20 konventionelle ved Special Olympics 1999, 159 grader +- 6', 'Hos 20 løftere i konventionel stil ved Special Olympics 1999 er knæet målt til ca. 159° ± 6 ved knæpassagen', lit, /40 mandlige styrkeløftere fra Special Olympics 1999.*20 konventionel stil.*\| KP \|.*\| 159° ± 6 \|/],
  ['IPF 4.3.1 pkt. 5: fodvip tilladt', 'Fødderne må ikke træde frem, tilbage eller til siden, men må vippe mellem forfod og hæl', lit, /Rocking the feet between the ball and heel\s*is\s*permitted|r\]ocking the feet between the ball and heel is permitted/],
]
const talAfvig = par.filter(([, a, d, re]) => !A.includes(a) || !re.test(d)).map(([h, a, , re]) => ({ h, iArtikel: A.includes(a), iDist: false }))
paastaa(`${par.length} tal-saetninger staar i artiklen og i loeftmodellens main`, talAfvig.length === 0, talAfvig)

// 2) figurerne mod dist
const kildeFor = { 'dl-klip-stang-frem-gulv.svg': 'marcs-doedloeft/marcs-doedloeft-gulv.svg', 'dl-klip-stang-frem-knae.svg': 'marcs-doedloeft/marcs-doedloeft-knae.svg' }
const figAfvig = []
let figAntal = 0
for (const d of ['doedloeft-figurer', 'loeft-fejl']) {
  for (const b of readdirSync(join(dir, 'assets', d)).filter((x) => x.endsWith('.svg'))) {
    figAntal++
    const tok = (s) => s.replace(/\r/g, '').split(/(?=<)/)
    const a = tok(D(kildeFor[b] || `${d}/${b}`)), c = tok(readFileSync(join(dir, 'assets', d, b), 'utf8'))
    if (a.length !== c.length) { figAfvig.push({ b, laengde: [a.length, c.length] }); continue }
    for (let i = 0; i < a.length; i++) {
      if (a[i] === c[i]) continue
      const lov = /^<(svg|title|desc)/.test(a[i]) || (/Marcs (klip|mål)/.test(a[i]) && /klippet|183 cm og 120 kg/.test(c[i])) || (/moment: hofte 264/.test(a[i]) && /moment: ikke vist/.test(c[i]))
      if (!lov || /Marc/.test(c[i])) figAfvig.push({ b, dist: a[i].slice(0, 120), artikel: c[i].slice(0, 120) })
    }
  }
}
paastaa(`${figAntal} figurer = dist paa main, kun navn, title/desc og lockoutmomentet skiftet`, figAntal === 17 && figAfvig.length === 0, figAfvig)

// kap. 4 mod tre-loeft (dist paa main) i browseren nedenfor; vaerktoejerne mod dist
const samme = (a, b) => readFileSync(a).equals(readFileSync(b))
const vaerk = {}
for (const v of ['tre-loeft', 'min-krop', 'maal-billede']) {
  const filer = readdirSync(join(dist, 'dist', v)).filter((f) => statSync(join(dist, 'dist', v, f)).isFile())
  vaerk[v] = filer.filter((f) => !existsSync(join(dir, 'assets', 'vaerktoejer', v, f)) || !samme(join(dist, 'dist', v, f), join(dir, 'assets', 'vaerktoejer', v, f)))
}
paastaa('tre-loeft og min-krop paa grenen = dist paa main', !vaerk['tre-loeft'].length && !vaerk['min-krop'].length, vaerk)

// 3) [MARC]-stederne mod laesesiden
const marc = [...html.matchAll(/<p class="[^"]*marc[^"]*" data-marc="([^"]+)">([\s\S]*?)<\/p>/g)].map((m) => ({ id: m[1], tekst: tekstAf(m[2]).trim() }))
const laes = readFileSync(LAES, 'utf8')
const laesDl = laes.split('id="baenk"')[0]
const felter = [...laes.matchAll(/Står i teksten<\/span><q class="felt">([\s\S]*?)<\/q>/g)].slice(0, 10).map((m) => tekstAf(m[1]).trim())
const sporg = marc.filter((m) => /^dl-\d+$/.test(m.id))
const ordretAfvig = sporg.filter((m) => { const n = Number(m.id.slice(3)); return m.tekst.replace(/^\[MARC \d+:/, '[MARC:') !== felter[n - 1] }).map((m) => m.id)
paastaa('12 [MARC]-steder: dl-1 til dl-10 een gang hver og 2 afledte', marc.length === 12 && sporg.map((m) => m.id).sort().join() === Array.from({ length: 10 }, (_, i) => `dl-${i + 1}`).sort().join() && marc.filter((m) => /afledt/.test(m.id)).length === 2, marc.map((m) => m.id))
paastaa('de 10 spoergsmaal staar ordret som "Staar i teksten" paa laesesiden', felter.length === 10 && ordretAfvig.length === 0, ordretAfvig)

// fund DA1-DA9 (se DOEDLOEFT.md)
const k7 = tekstAf(html.split('id="kap-fejlbilleder"')[1].split('id="kap-praksis"')[0])
const fejl493 = sh(`git -C "${LM}" log --format=%h -S"vil strække mere" main -- dist/loeft-fejl/index.html`).trim()
const fund = {
  DA1: {
    knaeProcentIArtikel: ['−92 %', '+102 %', '+132 %', '+162 %'].filter((x) => k7.includes(x)),
    knaeProcentPaaMain: ['−92 %', '+102 %', '+132 %', '+162 %'].filter((x) => fejlIdx.includes(x)),
    mainSigerIOrd: /vil strække mere/.test(fejlIdx) && /vil bøje mindre/.test(fejlIdx),
    ofteIArtikel: /en løfter flytter ofte også kroppen for at holde balancen/.test(k7),
    mainSiger: /modellen kan ikke sige hvor/.test(fejlIdx),
    bagudPaaMain: /halvvejs: \+24 % \/ \+57 %/.test(fejlIdx), bagudIArtikel: /24 %/.test(k7),
    rettetI: fejl493,
  },
  DA2: {
    artikel: ['for et rigtigt løft af samme vægt', 'for et rigtigt løft', 'Modellen hælder torsoen mere end et målt træk'].filter((x) => A.includes(x)),
    distSiger: /For et løft som Marcs er de sandsynligvis for høje.*\(et skøn: 10-15 %\)/.test(marcsIdx),
    escamillaTorsoLO: /\| LO \| 11° ± 7 \(fra vandret\)/.test(lit) && /torsohældning ved LO ≈ \*\*79°\*\*/.test(lit),
  },
  DA3: { forbehold: /så det siger noget om modellens grænser, ikke om hvordan dødløft bør se ud/.test(A), dl2Mulighed: /Ja, sådan skal et konventionelt træk se ud/.test(tekstAf(laesDl)), forbeholdMarc: /class="note[^"]*marc/.test(html) },
  DA4: { titel: /<title>Dødløftets biomekanik: individuel variation i trækket/.test(html), markeret: /data-marc="[^"]*"[^>]*>[^<]*individuel variation/.test(html), dl1c: /Noget andet først \(skriv hvad\)/.test(tekstAf(laesDl)) },
  DA5: { saetning: A.includes('En løfter, der har låst, læner sig en smule tilbage, og så er hoftemomentet næsten nul'), klippetsLockout: /Knæ og hofte 171,8° mod modellens 180°, torso 3,5° mod 0°/.test(A) },
  DA6: { saetning: A.includes('I modellen er det netop med stangen 3-4 cm foran midtfoden ved gulvet, at krop og stang tilsammen står over midtfoden'), distKraever: /I modellen skal stangen stå 4,2 cm foran ved gulvet/.test(marcsIdx), treCm: /stangen 3 cm foran midtfoden, Knæ|Tyngdepunktet 1,4 cm bag midtfoden/.test(A) },
  DA8: { kommentarNavne: [...new Set((html.match(/<!--[\s\S]*?-->/g) ?? []).join(' ').match(/Bhishak|Yantra|Setu|Dhruva|ORDRE \d+|Ordre \d+/g) ?? [])], jsKommentar: /\/\/ Ordre 405/.test(html) },
  DA9: { maalBilledeAfvigerFraMain: vaerk['maal-billede'] },
  DA10: { laesesidenErKladden: /Kladden på grenen baenk-kladde \(19e41ee\)/.test(tekstAf(laes)), gamleTal: /hoftevinklen er 60,9° mod 51,4°/.test(tekstAf(laes)) && /opdigtet referencekrop/.test(tekstAf(laes)) && /skulderen ca\. 54 % mindre/.test(tekstAf(laes)), artiklenNu: A.includes('hoftevinklen er 59,6° mod 51,4°') },
}
paastaa('DA1: kap. 7 har knaeets procenter og "ofte", som main fjernede i 493', fund.DA1.knaeProcentIArtikel.length === 4 && fund.DA1.knaeProcentPaaMain.length === 0 && fund.DA1.mainSigerIOrd && fund.DA1.ofteIArtikel && fund.DA1.mainSiger && fund.DA1.bagudPaaMain && !fund.DA1.bagudIArtikel && !!fejl493, fund.DA1)
paastaa('DA2: "for et rigtigt loeft" mod dist "for et loeft som Marcs (et skoen)" og Escamilla 79 grader', fund.DA2.artikel.length === 3 && fund.DA2.distSiger && fund.DA2.escamillaTorsoLO, fund.DA2)
paastaa('DA3: forbeholdet svarer paa dl-2 paa forhaand', fund.DA3.forbehold && fund.DA3.dl2Mulighed && !fund.DA3.forbeholdMarc, fund.DA3)
paastaa('DA4: titlen "individuel variation" er umaerket', fund.DA4.titel && !fund.DA4.markeret && fund.DA4.dl1c, fund.DA4)
paastaa('DA5: lockout-saetningen om at laene sig tilbage, og klippets lockout', fund.DA5.saetning && fund.DA5.klippetsLockout, fund.DA5)
paastaa('DA6: "3-4 cm" mod distens 4,2 cm', fund.DA6.saetning && fund.DA6.distKraever && fund.DA6.treCm, fund.DA6)
paastaa('DA8: interne navne i sidens kildekode (kommentarer)', fund.DA8.kommentarNavne.length > 0 && fund.DA8.jsKommentar, fund.DA8)
paastaa('DA9: Maal dit billede paa grenen er ikke main', fund.DA9.maalBilledeAfvigerFraMain.length > 0, fund.DA9)
paastaa('DA10: laesesiden viser kladden fra foer 561', fund.DA10.laesesidenErKladden && fund.DA10.gamleTal && fund.DA10.artiklenNu, fund.DA10)

// laesetid som squat-artiklen: brødtekst, figurtekster og forbehold uden folde og uden .marc, 130 ord/min
const uden = html.split('<main')[1].split('</main>')[0].replace(/<details[\s\S]*?<\/details>/g, '').replace(/<p class="[^"]*marc[^"]*"[\s\S]*?<\/p>/g, '').replace(/<div role="navigation"[^>]*>\s*<\/div>/, '').replace(/<div class="references"[\s\S]*?<\/div>\s*<\/div>/, '').replace(/<div class="author-strip"[\s\S]*$/, '')
const ord = tekstAf(uden).split(' ').filter((w) => /[\p{L}\d]/u.test(w)).length
paastaa(`laesetid: ${ord} ord / 130 = ${(ord / 130).toFixed(1)} min, siden siger 18`, Math.round(ord / 130) === 18 || Math.ceil(ord / 130) === 18, { ord })

// 4) siden i browseren
const TYPER = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.txt': 'text/plain', '.xml': 'application/xml' }
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
for (const w of [390, 1280]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, hasTouch: w === 390, isMobile: w === 390, deviceScaleFactor: w === 390 ? 2 : 1 })
  const page = await ctx.newPage()
  const r = { bredde: w, sidefejl: [], http404: [], eksterne: [] }
  page.on('pageerror', (e) => r.sidefejl.push(e.message))
  page.on('response', (s) => { if (s.status() >= 400 && s.url().startsWith(BASE)) r.http404.push(s.url().slice(BASE.length)) })
  await page.route('**/*', (route) => (route.request().url().startsWith(BASE) ? route.continue() : (r.eksterne.push(new URL(route.request().url()).host), route.abort())))
  await page.goto(BASE + 'artikel-doedloeft.html', { waitUntil: 'load' })
  await page.waitForTimeout(1500)
  await page.evaluate(() => document.querySelectorAll('iframe').forEach((f) => f.scrollIntoView()))
  await page.waitForTimeout(1500)
  await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true }))
  await page.waitForTimeout(600)
  const t = await page.evaluate(() => document.body.innerText)
  Object.assign(r, {
    vandret: await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    skaerme: +(await page.evaluate(() => document.documentElement.scrollHeight / window.innerHeight)).toFixed(1),
    tankestreger: (t.match(/[–—]/g) ?? []).length,
    synligMarc: (t.match(/\[MARC/g) ?? []).length,
    marcSkjult: await page.evaluate(() => [...document.querySelectorAll('.marc')].every((e) => e.offsetParent === null)),
    atletnavne: navne.reduce((a, n) => a + (t.match(new RegExp(`\\b${n}\\b`, 'gi')) ?? []).length, 0),
    interneNavne: (t.match(/\b(Bhishak|Yantra|Setu|Dhruva|Chaturanga|Ordre \d+)\b/g) ?? []).length,
    billeder: await page.evaluate(() => [...document.images].map((i) => ({ src: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 0, bred: Math.round(i.getBoundingClientRect().width) }))),
    rammer: await page.evaluate(() => [...document.querySelectorAll('iframe')].map((f) => ({ id: f.id, h: Math.round(f.getBoundingClientRect().height), tekst: (f.contentDocument?.body?.innerText ?? '').replace(/\s+/g, ' ').slice(0, 200) }))),
    tabeller: await page.evaluate(() => [...document.querySelectorAll('.article-body table')].map((tb) => { const box = tb.closest('.fact-box') || tb.parentElement; const cs = getComputedStyle(box); const kap = tb.closest('section.kapitel')?.id; return { kap, kolonner: tb.rows[0].cells.length, bred: tb.scrollWidth, boks: box.clientWidth, overflowX: cs.overflowX, rullerSelv: box.scrollWidth > box.clientWidth && /auto|scroll/.test(cs.overflowX) } })),
    knapper: await page.evaluate(() => [...document.querySelectorAll('.article-body summary, .kapmenu-knap')].filter((e) => e.offsetParent).map((e) => Math.round(e.getBoundingClientRect().height))),
  })
  // tre-loeft: kap. 4's tal (lange arme, lange laarben, lang torso mod gennemsnit)
  r.treLoeft = {}
  for (const st of ['gennemsnit', 'lange-laar', 'lange-arme', 'lang-torso']) {
    const p2 = await ctx.newPage()
    await p2.goto(BASE + `assets/vaerktoejer/tre-loeft/index.html#loeft=doedloeft&start=${st}&stilling=opstilling`, { waitUntil: 'load' })
    await p2.waitForTimeout(400)
    const tt = (await p2.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    const tal = (n) => tt.match(new RegExp(n + ' ([\\d,−-]+)'))?.[1]
    r.treLoeft[st] = { knae: tal('Knævinkel \\(°\\)'), hofte: tal('Hoftevinkel \\(°\\)'), torso: tal('Torso fra lodret \\(°\\)'), vej: tal('Stangens vej, hele løftet \\(cm\\)'), linje: tt.match(/Længere [^.]*\./)?.[0] ?? '' }
    await p2.close()
  }
  const skud = async (sel, navn) => { const el = page.locator(sel).first(); await el.scrollIntoViewIfNeeded(); await page.waitForTimeout(300); await el.screenshot({ path: join(HERE, `D-${w}-${navn}.png`) }) }
  await skud('#kap-kropstyper ul', 'kap4-tal')
  await skud('#fejl-stang-frem ~ details .fact-box', 'kap7-knae-procent')
  await skud('#fase-lockout', 'lockout')
  await skud('#forbehold', 'forbehold')
  // med skjul-marc fjernet: de 12 steder synlige, som Marc og Setu ser dem
  await page.evaluate(() => document.body.classList.remove('skjul-marc'))
  await page.waitForTimeout(200)
  r.marcSynligeUdenKlasse = await page.evaluate(() => [...document.querySelectorAll('.marc')].filter((e) => e.offsetParent !== null).length)
  r.vandretMedMarc = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)
  sider.push(r)
  await ctx.close()
}
await browser.close()
server.close()
const tl = sider[0].treLoeft
paastaa('kap. 4 = tre-loeft paa main: 67,8/61,5, 59,6/51,4 og vej 6,0 cm kortere, 91,0/99,9',
  tl.gennemsnit.torso === '61,5' && tl['lange-laar'].torso === '67,8' && tl.gennemsnit.hofte === '51,4' && tl['lange-arme'].hofte === '59,6' &&
  (Number(tl.gennemsnit.vej.replace(',', '.')) - Number(tl['lange-arme'].vej.replace(',', '.'))).toFixed(1) === '6.0' && tl.gennemsnit.knae === '99,9' && tl['lang-torso'].knae === '91,0' &&
  A.includes('torsoen hælder 67,8° mod 61,5°') && A.includes('hoftevinklen er 59,6° mod 51,4°, så hoften står højere, og stangens vej bliver 6,0 cm kortere') && A.includes('knævinklen er 91,0° mod 99,9°'), tl)
paastaa('DA7: tre-loefts egen linje siger 8 grader, men viser 51 -> 60', /hoften bøjer 8° mindre ved opstillingen \(51° → 60°\)/.test(tl['lange-arme'].linje), tl['lange-arme'].linje)
for (const r of sider) {
  paastaa(`${r.bredde}: ingen vandret rul, 0 JS-fejl, 0 404, 0 tankestreger, 0 synlige [MARC, 0 atletnavne, 0 interne navne`,
    r.vandret && !r.sidefejl.length && !r.http404.length && !r.tankestreger && !r.synligMarc && r.marcSkjult && !r.atletnavne && !r.interneNavne, { e: r.eksterne, f: r.sidefejl, h: r.http404, t: r.tankestreger, m: r.synligMarc })
  paastaa(`${r.bredde}: kun skrifttypen forsoeger at gaa ud af huset`, r.eksterne.every((h) => /fonts\.(googleapis|gstatic)\.com/.test(h)), [...new Set(r.eksterne)])
  paastaa(`${r.bredde}: 17 billeder vist, 0 brudte, ingen bredere end skaermen`, r.billeder.length === 17 && r.billeder.every((b) => b.ok && b.bred <= r.bredde), r.billeder.filter((b) => !b.ok))
  paastaa(`${r.bredde}: begge rammer har indhold og hoejde`, r.rammer.length === 2 && r.rammer.every((f) => f.h > 150 && f.tekst.length > 20), r.rammer.map((f) => [f.id, f.h]))
  const smalle = r.tabeller.filter((x) => x.bred > x.boks)
  paastaa(`${r.bredde}: ${r.tabeller.length} tabeller; bredere end boksen: ${smalle.length}, og de ruller selv (ikke skaaret af)`, smalle.every((x) => x.rullerSelv), smalle)
  paastaa(`${r.bredde}: uden skjul-marc ses alle 12, stadig uden vandret rul`, r.marcSynligeUdenKlasse === 12 && r.vandretMedMarc)
}
const ud = { gren: GREN, top, loeftmodelMain: lmTop, navneTjekket: navne.length, fund, tjek, sider }
writeFileSync(join(HERE, 'doedloeft-568.json'), JSON.stringify(ud, null, 1))
const roede = tjek.filter((x) => !x.ok).length
console.log(`doedloeft-568: ${tjek.length - roede}/${tjek.length} (${GREN} ${top}, loeftmodel main ${lmTop})`)
process.exit(roede ? 1 : 0)
