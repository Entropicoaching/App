// Kritik 582, blok 1: doedloeft- og baenk-artiklen efter Setus 575 (DA1-DA12, BA1-BA10), og laesesiden.
//   node outputs/kritik-582/artikler-582.mjs     -> artikler-582.json og A-*.png
// Grenene `artikel-doedloeft` og `artikel-baenk` hentes med `git archive` fra entropi-coaching-site-wt2
// (ingen gren skiftes, intet trae roeres). Loeftmodellens main (dist, src, kroppe, docs) hentes med
// `git archive` fra entropi-loeftmodel-dhruva, og baenkmodellen koeres direkte for BA1.
// C:\Users\Entropi\Desktop\LAES-DOEDLOEFT-BAENK.html og Setus ipf-2026-uddrag.txt er kun laest.
// IPF Technical Rulebook 2026 v3 hentes som PDF fra powerlifting.sport til en midlertidig mappe og laeses
// med pdftotext; den gemmes ikke i repoet (kun sha256). Uden net springes det tjek over og siges.
// 1) Hver DA/BA mod grenen, main og regelbogen. 2) Hvad der ellers er aendret siden 568/572.
// 3) Laesesiden: artiklernes tekstblokke ordret, og de 18 "Staar i teksten".
// 4) Begge artikler headless paa 390 (touch) og 1280 (mus) uden net.
// Atletnavne: fornavnene fra appens .gitignore, ikke skrevet ud.
import { createRequire } from 'node:module'
import { homedir, tmpdir } from 'node:os'
import path, { join } from 'node:path'
import { writeFileSync, readFileSync, mkdtempSync, existsSync, statSync, mkdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SITE = 'C:/Users/Entropi/Desktop/entropi-coaching-site-wt2'
const LM = 'C:/Users/Entropi/Desktop/entropi-loeftmodel-dhruva'
const LAES = 'C:/Users/Entropi/Desktop/LAES-DOEDLOEFT-BAENK.html'
const SETU = 'C:/Users/Entropi/Desktop/ordrer/kilder/setu-575'
const IPF_URL = 'https://www.powerlifting.sport/fileadmin/ipf/data/rules/technical-rules/english/2026_IPF_Technical_Rulebook__effective_01_March_2026__v3.pdf'
const sh = (c) => execSync(c, { maxBuffer: 1 << 26 }).toString()
const kort = (r, repo = SITE) => sh(`git -C "${repo}" rev-parse --short ${r}`).trim()
const G = { dl: { gren: 'artikel-doedloeft', foer: '1793972', fil: 'artikel-doedloeft.html' }, bp: { gren: 'artikel-baenk', foer: 'fb0cefa', fil: 'artikel-baenk.html' } }
for (const g of Object.values(G)) g.top = kort(g.gren)
const lmTop = kort('main', LM)
const dir = mkdtempSync(join(tmpdir(), 'k582-'))
for (const [k, g] of Object.entries(G)) {
  mkdirSync(join(dir, k))
  execSync(`git -C "${SITE}" archive -o "${join(dir, k, 'g.tar')}" ${g.gren}`)
  execSync('tar -xf g.tar', { cwd: join(dir, k) })
}
const lm = join(dir, '_lm')
mkdirSync(lm)
execSync(`git -C "${LM}" archive -o "${join(lm, 'd.tar')}" main dist src kroppe docs package.json`)
execSync('tar -xf d.tar', { cwd: lm })
const D = (f) => readFileSync(join(lm, 'dist', f), 'utf8')
const imp = (f) => import(pathToFileURL(join(lm, 'src', f)).href)

const tjek = []
const paastaa = (hvad, ok, data) => { tjek.push({ hvad, ok: !!ok, data }); console.log(`${ok ? 'ok ' : 'NEJ'} ${hvad}${data !== undefined ? ' ' + JSON.stringify(data).slice(0, 500) : ''}`) }
const navne = [...new Set([...readFileSync(join(HERE, '..', '..', '.gitignore'), 'utf8').matchAll(/^supabase\/([a-z]+)-\*/gm)].map((m) => m[1]).filter((n) => n !== 'marc'))]
const tekstAf = (s) => s.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ')
const komma = (x, d = 1) => x.toFixed(d).replace('.', ',').replace('-', '−')
const html = { dl: readFileSync(join(dir, 'dl', G.dl.fil), 'utf8'), bp: readFileSync(join(dir, 'bp', G.bp.fil), 'utf8') }
const A = { dl: tekstAf(html.dl), bp: tekstAf(html.bp) }
const kap = (k, id, til) => tekstAf(html[k].split(`id="${id}"`)[1].split(til ? `id="${til}"` : '</main>')[0])
const fejlTekst = tekstAf(D('loeft-fejl/index.html'))

// --- 0) grenene og main ----------------------------------------------------------------------
const aendret = (g) => sh(`git -C "${SITE}" diff --name-only ${g.foer} ${g.gren}`).split('\n').filter(Boolean)
paastaa(`grenene: ${G.dl.gren} ${G.dl.top} (efter ${G.dl.foer}) og ${G.bp.gren} ${G.bp.top} (efter ${G.bp.foer}); hver roerer kun sin artikel og det faelles stilark`,
  G.dl.top === '1c85d55' && G.bp.top === 'd33a6f1' && aendret(G.dl).join() === 'artikel-doedloeft.html,assets/artikel-doedloeft.css' && aendret(G.bp).join() === 'artikel-baenk.html,assets/artikel-doedloeft.css', { dl: aendret(G.dl), bp: aendret(G.bp) })
const cssDl = sh(`git -C "${SITE}" rev-parse ${G.dl.gren}:assets/artikel-doedloeft.css`).trim(), cssBp = sh(`git -C "${SITE}" rev-parse ${G.bp.gren}:assets/artikel-doedloeft.css`).trim()
paastaa('assets/artikel-doedloeft.css er samme blob paa begge grene (ingen konflikt ved merge)', cssDl === cssBp, [cssDl.slice(0, 8), cssBp.slice(0, 8)])
let uaendretSiden = false
try { execSync(`git -C "${LM}" merge-base --is-ancestor 37c9a27 main`); uaendretSiden = sh(`git -C "${LM}" diff --name-only 37c9a27 main -- dist/loeft-fejl dist/doedloeft-figurer dist/baenk-figurer dist/marcs-doedloeft dist/tre-loeft dist/min-krop docs/doedloeft-litteratur.md docs/baenk-litteratur.md src/baenkStillinger.js`).trim() === '' } catch { uaendretSiden = false }
paastaa(`loeftmodellens main ${lmTop} indeholder 37c9a27, og fejlsiden, figurerne, tre-loeft, min krop, litteraturen og baenkmodellen er uaendrede siden`, uaendretSiden)
// Hvor mange linjer i artiklerne er aendret af 575 (resten er holdt op i 568 og 572)
const linjer = (g) => sh(`git -C "${SITE}" diff --numstat ${g.foer} ${g.gren} -- ${g.fil}`).trim().split(/\s+/).slice(0, 2).map(Number)

// --- 1) doedloeftet: DA1-DA12 ----------------------------------------------------------------
const k7 = kap('dl', 'kap-fejlbilleder', 'kap-praksis')
const tabRaekkerDl = [
  ['Modellen', '−1,4 cm', '0 %', '0 %', '0 %', '0 %'], ['Skinnebenet 7°', '−2,0 cm', '+7 %', '+8 %', 'vil bøje mindre', '0 %'], ['Skinnebenet 0°', '−2,5 cm', '+12 %', '+13 %', 'skifter retning', '0 %'],
  ['Modellen, over midtfoden', '−2,5 cm', '0 %', '0 %', '0 %', '0 %'], ['5,0 cm frem', '1,0 cm', '+12 %', '+27 %', 'vil strække mere', '−42 %'], ['6,5 cm frem', '2,0 cm', '+16 %', '+35 %', 'vil strække mere', '−54 %'], ['8,0 cm frem', '3,1 cm', '+20 %', '+43 %', 'vil strække mere', '−67 %'],
]
// fejlsiden paa main: samme tal og samme ord (dens tabel har stangens plads i en ekstra kolonne)
const mainRaekke = (r) => { const [n, tp, h, l, k, a] = r; const cm = tp.replace(' cm', ''); return new RegExp(`${cm} ${h.replace('+', '\\+').replace(' %', ' %')} ${l.replace('+', '\\+')} ${k === '0 %' ? '(–|0 %)' : k} (\\+)?${a.replace('+', '\\+')}`).test(fejlTekst) }
const da = {
  DA1: {
    raekkerIArtikel: tabRaekkerDl.filter((r) => !k7.includes(r.join(' '))).map((r) => r[0]),
    raekkerPaaMain: tabRaekkerDl.filter((r) => r[0].startsWith('Modellen') || mainRaekke(r)).length,
    knaeProcent: (k7.match(/(−92|\+102|\+132|\+162) %/g) ?? []),
    stangKolonne: /Stang fra midtfod/.test(k7),
    billedtekster: ['Ryggen kan ikke runde i modellen, så figuren viser ikke, hvad der sker, hvis ryggen runder under fejlen.', 'En løfter, der flytter kroppen bagud for balancen, ligger et andet sted; modellen kan ikke sige hvor.', 'Figuren viser det rene tilfælde, hvor kun stangen flytter sig; derfor ender tyngdepunktet foran midtfoden.']
      .map((s) => [k7.includes(s), fejlTekst.includes(s.replace('Figuren viser det rene tilfælde', 'Stangen glider frem er vist i det rene tilfælde'))]),
    bagud: k7.includes('Flytter løfteren sig bagud for balancen, får hoften og lænden endnu mere at holde i modellen (halvvejs: +24 % / +57 %).') && fejlTekst.includes('Flytter løfteren sig bagud for balancen, får hoften og lænden endnu mere at holde i modellen (halvvejs: +24 % / +57 %).'),
    gamle: ['en løfter flytter ofte også kroppen', 'hvert leds momentarm', 'fra hælen frem mod tæerne', 'en løfter kan også lade skulderen glide længere frem', 'holder op med at hjælpe'].filter((s) => k7.includes(s)),
    svar: k7.includes('bliver momentarmen om hofte, lænd og knæ næsten lige så meget længere') && fejlTekst.includes('momentarmen om hofte, lænd og knæ') && k7.includes('flytter fra bag midtfoden frem mod forfoden') && /2,5 cm bag midtfoden til 2,0 cm foran den, mod forfoden/.test(fejlTekst),
    knaeOrd: k7.includes('vægten vil strække knæet i stedet for at bøje det') && fejlTekst.includes('vægten nu vil strække knæet i stedet for at bøje det') && fejlTekst.includes('Vægten vil strække knæet mere end før'),
    knaeModelRaekke: { artikel: '0 %', main: '–' },
  },
  DA2: {
    alle: (A.dl.match(/10-15 %[^.]*\./g) ?? []),
    rigtigt: (A.dl.match(/et rigtigt løft/g) ?? []).length,
    kap1: A.dl.includes('Modellen hælder torsoen mere end det målte træk i kapitel 6: 61° mod ca. 50° ved gulvet.'),
    main: /\(et skøn: 10-15 %\)/.test(tekstAf(D('marcs-doedloeft/index.html'))),
  },
  DA3: { gammel: /siger noget om modellens grænser, ikke om hvordan dødløft bør se ud/.test(A.dl), afledt: /<p class="marc" data-marc="dl-2 afledt">\[MARC, afledt af 2: hvad det målte træk siger \(om modellens grænser, eller om hvordan et konventionelt træk bør se ud\), skrives her ud fra svaret på 2\.\]<\/p>/.test(html.dl), iForbeholdet: html.dl.indexOf('data-marc="dl-2 afledt"') > html.dl.indexOf('id="forbehold"') },
  DA4: { afledt: /data-marc="dl-1 afledt">\[MARC, afledt af 1: titlen "individuel variation i trækket"/.test(html.dl), steder: ['<title>', 'og:title', 'twitter:title', '"headline"'].filter((s) => new RegExp(`${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\\n]{0,160}individuel variation i trækket`).test(html.dl)) },
  DA5: A.dl.includes('Læner løfteren sig en smule tilbage, er hoftemomentet næsten nul.') && !A.dl.includes('En løfter, der har låst, læner sig'),
  DA6: { svar: A.dl.includes('I modellen er det netop med stangen ca. 4 cm foran midtfoden ved gulvet'), main: /4,2 cm/.test(tekstAf(D('marcs-doedloeft/index.html'))), overskriftOmKlippet: A.dl.includes('hvor det målte træk har den (3,8 cm foran ved gulvet, 2,7 cm ved knæhøjde)') },
  DA8: { html: [...new Set((html.dl.match(/Bhishak|Yantra|Setu|Dhruva|Chaturanga|ORDRE \d+|Ordre \d+/g) ?? []))], css: [...new Set((readFileSync(join(dir, 'dl', 'assets', 'artikel-doedloeft.css'), 'utf8').match(/Bhishak|Yantra|Setu|Dhruva|ORDRE \d+|Ordre \d+/g) ?? []))], squatStilark: ['artikel-skabelon.css', 'artikel-opslag.css'].map((f) => [f, (readFileSync(join(dir, 'dl', 'assets', f), 'utf8').match(/Ordre \d+|ORDRE \d+|Yantra|Bhishak/g) ?? []).length]) },
  DA12: { artikel: A.dl.includes('Stangen må ikke gå ned undervejs; sætter den sig en smule, når skuldrene kommer tilbage, er det ikke en grund til underkendelse.') && A.dl.includes('IPF Technical Rulebook 2026, afsnit 4.3, punkt 2 til 4, og 4.3.1, punkt 1 til 4.') },
}
paastaa('DA1: kap. 7 har fejlsidens 7 tabelraekker, knaeet i ord, ingen knae-procent, ingen "Stang fra midtfod"-kolonne', !da.DA1.raekkerIArtikel.length && da.DA1.raekkerPaaMain === 7 && !da.DA1.knaeProcent.length && !da.DA1.stangKolonne, da.DA1)
paastaa('DA1: de tre billedtekst-saetninger og saetningen om bagud (+24 % / +57 %) staar ordret paa fejlsiden paa main', da.DA1.billedtekster.every(([a, m]) => a && m) && da.DA1.bagud, da.DA1.billedtekster)
paastaa('DA1: svar-linjerne siger det samme som fejlsiden, og intet af 476-teksten er tilbage', da.DA1.svar && da.DA1.knaeOrd && !da.DA1.gamle.length, da.DA1.gamle)
paastaa('DA2: "10-15 %" staar 3 steder, alle "for det maalte traek i kapitel 6 (et skoen)", og "et rigtigt loeft" er vaek', da.DA2.alle.length === 3 && da.DA2.alle.every((s) => /for (højt|høje) for det målte træk i kapitel 6 \(et skøn\)/.test(s)) && da.DA2.rigtigt === 0 && da.DA2.kap1 && da.DA2.main, da.DA2.alle)
paastaa('DA3: forbeholdets bisaetning er taget ud og staar som dl-2 afledt i forbeholdet', !da.DA3.gammel && da.DA3.afledt && da.DA3.iForbeholdet, da.DA3)
paastaa('DA4: titlen er markeret dl-1 afledt; "individuel variation i traekket" staar i title, og:, twitter: og JSON-LD', da.DA4.afledt && da.DA4.steder.length === 4, da.DA4)
paastaa('DA5: lockout-saetningen er betinget', da.DA5)
paastaa('DA6: svar-linjen siger "ca. 4 cm" (main 4,2); "3-4 cm" i overskriften og dl-2 er klippets 3,8 cm, ikke modellens', da.DA6.svar && da.DA6.main && da.DA6.overskriftOmKlippet, da.DA6)
paastaa('DA8: ingen interne navne eller ordrenumre i artiklens html eller artikel-doedloeft.css (squat-stilarkene har dem stadig)', !da.DA8.html.length && !da.DA8.css.length && da.DA8.squatStilark.every(([, n]) => n > 0), da.DA8)

// --- 2) baenken: BA1-BA10 --------------------------------------------------------------------
const { PRESETS } = await imp('presets.js')
const { laesKrop } = await imp('krop.js')
const { baenkStillinger } = await imp('baenkStillinger.js')
const bal = PRESETS.find((p) => p.id === 'balanceret').values
const krop = laesKrop(join(lm, 'kroppe', 'marc.json'), bal)
const L = { ...bal, ...krop.lengths, heightCm: krop.hoejdeCm }
const foedder = Object.fromEntries(['lille', 'middel', 'stor'].map((b) => [b, baenkStillinger(L, b, 'middel').stillinger.find((s) => s.id === 'bryst').tal.stangMod.fodderCm]))
const k5 = kap('bp', 'kap-variant', 'kap-virkeligheden')
const ba = {
  BA1: {
    model: Object.fromEntries(Object.entries(foedder).map(([k, v]) => [k, komma(v)])),
    tekst: k5.includes('Fra lille til middel bue rører stangen 3 cm længere mod fødderne, og fra middel til stor 1 cm nærmere halsen.'),
    svar: k5.includes('Med mere bue kommer brystets top højere op, og stangens vej bliver kortere. Hvor stangen rører, flytter sig kun et par cm.'),
    gamle: ['højere op og længere mod fødderne', 'og stangen rører længere mod fødderne', 'fordi stangen rører længere mod fødderne'].filter((s) => A.bp.includes(s)),
    bp5: /<p class="marc" data-marc="bp-5">\[MARC 5: Hvor stor en bue vil du have hos en atlet, og hvad afgør det\? Modellen siger kun, at stor bue gør vejen 23 % kortere og skulderens momentarm 7 % længere\.\]<\/p>/.test(html.bp),
    vip: k5.includes('En bue, der er større end modellens middel bue,'),
    figursidenPaaMain: /med mere bue ligger det punkt højere og længere mod fødderne/.test(tekstAf(D('baenk-figurer/index.html'))),
  },
  BA2: { tekst: A.bp.includes('De 9 cm uden for hånden er et modelvalg og et skøn, ikke en måling. Med albuen lodret under hånden forfra stod den 21 cm mod fødderne fra siden.'), gamle: ['armen lignede ikke et bænkpres', '8-10 cm ud er vurderet'].filter((s) => A.bp.includes(s)) },
  BA4: A.bp.includes('I modellen lander stangen 10-15 cm nærmere halsen') && !A.bp.includes('I bænken lander stangen'),
  BA5: /data-marc="bp-1 afledt">\[MARC, afledt af 1: titlen "bue, greb og individuel variation"/.test(html.bp),
  BA6: A.bp.includes('Hoved, skuldre og balder skal have kontakt med bænken, og fødderne skal stå fladt på gulvet, så fladt som skoen tillader. Stillingen holdes hele løftet; fødderne må flytte sig, men skal blive flade, og de må ikke røre bænken.') && A.bp.includes('IPF Technical Rulebook 2026, afsnit 4.2, punkt 2 og 5, og 4.2.1, punkt 2 og 9.') && A.bp.includes('IPF Technical Rulebook 2026, afsnit 4.2, punkt 8, og 4.2.1, punkt 3, 4, 6 og 11.'),
  BA7: [...new Set((html.bp.match(/Bhishak|Yantra|Setu|Dhruva|Chaturanga|ORDRE \d+|Ordre \d+/g) ?? []))],
  BA9: A.bp.includes('Grebet er holdt fast i modellen, så kun albuen flytter sig; grebet kan flytte sig med albuen.') && !A.bp.includes('flytter ofte grebet'),
}
paastaa('BA1: modellen har stangen 22,1 / 25,1 / 24,1 cm mod foedderne; teksten siger +3 og -1 cm, svar-linjen og bp-5 er rettet', ba.BA1.model.lille === '22,1' && ba.BA1.model.middel === '25,1' && ba.BA1.model.stor === '24,1' && ba.BA1.tekst && ba.BA1.svar && !ba.BA1.gamle.length && ba.BA1.bp5 && ba.BA1.vip, ba.BA1)
paastaa('BA2: albuens 9 cm er "et modelvalg og et skoen, ikke en maaling", og vurderingen fra 457 er vaek', ba.BA2.tekst && !ba.BA2.gamle.length, ba.BA2)
paastaa('BA4, BA5, BA9: "I modellen lander", titlen bp-1 afledt, "grebet kan flytte sig med albuen"', ba.BA4 && ba.BA5 && ba.BA9)
paastaa('BA7: ingen interne navne eller ordrenumre i baenkartiklens html', !ba.BA7.length, ba.BA7)

// --- 3) regelbogen (DA12 og BA6) -------------------------------------------------------------
const ipf = { hentet: false }
try {
  const pdf = join(dir, 'ipf.pdf')
  execSync(`curl -sSL -m 90 -o "${pdf}" "${IPF_URL}"`)
  execSync(`pdftotext -layout "${pdf}" "${join(dir, 'ipf.txt')}"`)
  ipf.hentet = true
  ipf.sha256 = createHash('sha256').update(readFileSync(pdf)).digest('hex')
  ipf.bytes = statSync(pdf).size
  const tx = readFileSync(join(dir, 'ipf.txt'), 'utf8')
  const flad = tx.replace(/\s+/g, ' ')
  const sider = tx.split('\f').map((p) => p.replace(/\s+/g, ' '))
  const side = (s) => { const i = sider.findIndex((p) => p.includes(s)); return i < 0 ? null : (sider[i].match(/(\d+) Powerlifting and rules of performance/) ?? [])[1] ?? `pdf ${i + 1}` }
  ipf.saetninger = {
    'DA12 4.3 pkt. 4': 'If the bar settles as the shoulders come back (slightly downward on completion) this should not be reason to disqualify the lift.',
    'BA6 4.2 pkt. 2': 'Foot movement is permissible but must remain flat on the platform. During the set-up on the bench, the athlete is not allowed to place his/her feet on the bench.',
    'BA6 4.2.1 pkt. 2': 'any raising movement of the head, shoulders, or buttocks, from the bench, or lateral movement of hands on the bar.',
    'BA6 4.2.1 pkt. 6': 'or the bar is touching the belt.',
    'BA6 4.2.1 pkt. 9': "Any contact of the lifter's feet with the bench or its supports. Lifting of the feet is not allowed. Foot movement is permissible but must remain flat on the platform.",
  }
  ipf.fundet = Object.fromEntries(Object.entries(ipf.saetninger).map(([k, s]) => [k, flad.includes(s)]))
  ipf.trykteSider = { '4.3 pkt. 4': side('4.3. DEADLIFT'), '4.2 pkt. 2': side('Foot movement is permissible but must remain flat on the platform. During'), '4.2.1': side('4.2.1. CAUSES') }
  // Setus uddrag linje for linje mod PDF'en
  const udd = readFileSync(join(SETU, 'ipf-2026-uddrag.txt'), 'utf8').split('\n').slice(4).map((l) => l.trim()).filter((l) => l.length > 20 && !/T E C H N I C A L/.test(l))
  ipf.uddragLinjer = udd.length
  ipf.uddragIkkeIPdf = udd.filter((l) => !flad.includes(l.replace(/\s+/g, ' ')))
} catch (e) { ipf.fejl = String(e.message).slice(0, 200) }
if (ipf.hentet) {
  paastaa('DA12 og BA6: saetningerne staar ordret i regelbogens PDF (v3), og artiklernes danske gengivelse og kildelinjer passer', Object.values(ipf.fundet).every(Boolean) && da.DA12.artikel && ba.BA6, { fundet: ipf.fundet, sider: ipf.trykteSider })
  paastaa(`Setus uddrag: alle ${ipf.uddragLinjer} linjer staar ordret i PDF'en`, ipf.uddragLinjer >= 30 && !ipf.uddragIkkeIPdf.length, ipf.uddragIkkeIPdf)
} else paastaa('DA12 og BA6: regelbogen kunne ikke hentes (uden net); kun artiklens tekst tjekket', da.DA12.artikel && ba.BA6, ipf)

// --- 4) laesesiden: ordret ens med artiklerne, og de 18 "Staar i teksten" -----------------------
const laes = readFileSync(LAES, 'utf8')
const felterAlle = [...laes.matchAll(/Står i teksten<\/span><q class="felt">([\s\S]*?)<\/q>/g)].map((m) => tekstAf(m[1]).trim())
const marcAf = (k, pre) => [...html[k].matchAll(/<p class="[^"]*marc[^"]*" data-marc="([^"]+)">([\s\S]*?)<\/p>/g)].filter((m) => new RegExp(`^${pre}-\\d+$`).test(m[1])).map((m) => ({ id: m[1], tekst: tekstAf(m[2]).trim() }))
const felt = { dl: marcAf('dl', 'dl'), bp: marcAf('bp', 'bp') }
const feltAfvig = [...felt.dl.map((m) => [m, felterAlle[Number(m.id.slice(3)) - 1]]), ...felt.bp.map((m) => [m, felterAlle[10 + Number(m.id.slice(3)) - 1]])].filter(([m, f]) => m.tekst !== f).map(([m]) => m.id)
paastaa('laesesiden: de 18 "Staar i teksten" er ordret artiklernes 10 + 8 [MARC], med nummeret', felterAlle.length === 18 && felt.dl.length === 10 && felt.bp.length === 8 && !feltAfvig.length, feltAfvig)
const lesT = tekstAf(laes)
const laesFund = {
  gamleKladde: ['Kladden på grenen baenk-kladde', 'opdigtet referencekrop', 'Når albuen går 90° ud', 'ca. 44 %', '(Ordre 468)', 'skulderen ca. 54 % mindre', '60,9°'].filter((s) => lesT.includes(s)),
  nyeRettelser: ['for det målte træk i kapitel 6 (et skøn)', 'Hvor stangen rører, flytter sig kun et par cm.', 'et modelvalg og et skøn, ikke en måling', 'modellen kan ikke sige hvor', 'MARC, afledt af 2: hvad det målte træk siger'].filter((s) => !lesT.includes(s)),
  forslagDl2: /Forbeholdets sidste sætning, om hvad klippet siger, skrives ud fra dit svar her \(markeret "afledt af 2" nederst i artiklen\)/.test(lesT),
  forslagBp7: /9 cm uden for hånden midt i opturen, et modelvalg og et skøn, ikke en måling/.test(lesT),
}
paastaa('laesesiden: ingen tekst fra kladden, alle 575-rettelser er med, forslagene til doedloeft 2 og baenk 7 er opdateret', !laesFund.gamleKladde.length && !laesFund.nyeRettelser.length && laesFund.forslagDl2 && laesFund.forslagBp7, laesFund)

// --- 5) browseren: artiklerne og laesesiden ----------------------------------------------------
const TYPER = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.txt': 'text/plain', '.xml': 'application/xml' }
const server = createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  let fil = u === '/laes.html' ? LAES : join(dir, u)
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
const BLOKKE = (rod) => [...document.querySelectorAll(`${rod} :is(p,li,figcaption,th,td,dt,dd,h1,h2,h3,summary,q)`)].filter((e) => !e.closest('nav,[role="navigation"],.kapmenu,.toc')).map((e) => e.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean)
const sider = []
const ordret = {}
for (const w of [390, 1280]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, hasTouch: w === 390, isMobile: w === 390, deviceScaleFactor: w === 390 ? 2 : 1 })
  for (const k of ['dl', 'bp']) {
    const page = await ctx.newPage()
    const r = { artikel: k, bredde: w, sidefejl: [], http404: [], eksterne: [] }
    page.on('pageerror', (e) => r.sidefejl.push(e.message))
    page.on('response', (s) => { if (s.status() >= 400 && s.url().startsWith(BASE)) r.http404.push(s.url().slice(BASE.length)) })
    await page.route('**/*', (route) => (route.request().url().startsWith(BASE) ? route.continue() : (r.eksterne.push(new URL(route.request().url()).host), route.abort())))
    await page.goto(BASE + `${k}/${G[k].fil}`, { waitUntil: 'load' })
    await page.waitForTimeout(1200)
    await page.evaluate(() => document.querySelectorAll('iframe').forEach((f) => f.scrollIntoView()))
    await page.waitForTimeout(1200)
    await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true }))
    await page.waitForTimeout(400)
    const t = await page.evaluate(() => document.body.innerText)
    Object.assign(r, {
      vandret: await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
      tankestreger: (t.match(/[–—]/g) ?? []).length,
      synligMarc: (t.match(/\[MARC|\[ \]/g) ?? []).length,
      atletnavne: navne.reduce((a, n) => a + (t.match(new RegExp(`\\b${n}\\b`, 'gi')) ?? []).length, 0),
      interneNavne: (t.match(/\b(Bhishak|Yantra|Setu|Dhruva|Chaturanga|Ordre \d+)\b/g) ?? []).length,
      billeder: await page.evaluate(() => [...document.images].filter((i) => !(i.complete && i.naturalWidth > 0)).length),
      antalBilleder: await page.evaluate(() => document.images.length),
      tabeller: await page.evaluate(() => [...document.querySelectorAll('.article-body table')].map((tb) => { const box = tb.closest('.fact-box') || tb.parentElement; return { kap: tb.closest('section')?.id, bred: tb.scrollWidth, boks: box.clientWidth } })),
    })
    if (w === 390) ordret[k] = await page.evaluate(BLOKKE, 'main')
    const skud = async (sel, navn) => { const el = page.locator(sel).first(); await el.scrollIntoViewIfNeeded(); await page.waitForTimeout(250); await el.screenshot({ path: join(HERE, `A-${w}-${navn}.png`) }) }
    if (k === 'dl') { await skud('#kap-fejlbilleder .fact-box', 'dl-kap7-tabel'); await skud('#forbehold', 'dl-forbehold') } else { await skud('p:has-text("Fra lille til middel bue")', 'bp-buen'); await skud('p.svar:has-text("Hvor stangen rører")', 'bp-buen-svar') }
    await page.evaluate(() => document.body.classList.remove('skjul-marc'))
    await page.waitForTimeout(150)
    r.marcSynlige = await page.evaluate(() => [...document.querySelectorAll('.marc')].filter((e) => e.offsetParent !== null).length)
    r.vandretMedMarc = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)
    if (w === 390) await skud(k === 'dl' ? '[data-marc="dl-2 afledt"]' : '[data-marc="bp-1 afledt"]', `${k}-afledt-med-marc`)
    // laesetid: broedtekst, figurtekster og forbehold uden folde og uden .marc, 130 ord/min
    r.ord = await page.evaluate(() => { const m = document.querySelector('main').cloneNode(true); m.querySelectorAll('details,.marc,.references,.author-strip,[role="navigation"],script,style,svg').forEach((e) => e.remove()); return m.textContent.split(/\s+/).filter((x) => /[\p{L}\d]/u.test(x)).length })
    r.laesetidSiden = await page.evaluate(() => (document.body.innerText.match(/(\d+) min\.? læsning|Læsetid:? (\d+) min|(\d+) min/) ?? []).slice(1).find(Boolean))
    sider.push(r)
    await page.close()
  }
  // laesesiden
  const page = await ctx.newPage()
  const r = { artikel: 'laes', bredde: w, sidefejl: [], eksterne: [] }
  page.on('pageerror', (e) => r.sidefejl.push(e.message))
  await page.route('**/*', (route) => (route.request().url().startsWith(BASE) || route.request().url().startsWith('data:') ? route.continue() : (r.eksterne.push(new URL(route.request().url()).host), route.abort())))
  await page.goto(BASE + 'laes.html', { waitUntil: 'load' })
  await page.waitForTimeout(800)
  await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true }))
  const t = await page.evaluate(() => document.body.innerText)
  Object.assign(r, { vandret: await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), tankestreger: (t.match(/[–—]/g) ?? []).length, atletnavne: navne.reduce((a, n) => a + (t.match(new RegExp(`\\b${n}\\b`, 'gi')) ?? []).length, 0) })
  if (w === 390) { ordret.laesDl = await page.evaluate(BLOKKE, '#s4'); ordret.laesBp = await page.evaluate(BLOKKE, '#s5') }
  const skud = async (sel, navn) => { const el = page.locator(sel).first(); await el.scrollIntoViewIfNeeded(); await page.waitForTimeout(250); await el.screenshot({ path: join(HERE, `A-${w}-${navn}.png`) }) }
  await skud('#s2 .byg >> nth=1', 'laes-dl2')
  sider.push(r)
  await ctx.close()
}
// tre-loeft paa main: DA7 (linjen under figuren)
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const p2 = await ctx.newPage()
await p2.route('**/*', (route) => (route.request().url().startsWith(BASE) ? route.continue() : route.abort()))
await p2.goto(BASE + '_lm/dist/tre-loeft/index.html#loeft=doedloeft&start=lange-arme&stilling=opstilling', { waitUntil: 'load' })
await p2.waitForTimeout(500)
const da7 = ((await p2.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').match(/Længere [^.]*\./) ?? [''])[0]
await browser.close()
server.close()

const multi = (a) => a.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map())
const mangler = (a, b) => { const mb = multi(b); return a.filter((x) => { const n = mb.get(x) ?? 0; if (n > 0) { mb.set(x, n - 1); return false } return true }) }
// laesesidens egne linjer: overskriften, en note om grenen og en note under hver indlejret figur (stillbillede)
const LAES_EGNE = /^(Dødløftartiklen|Bænkartiklen), som den ser ud nu$|^Artiklen på grenen artikel-(doedloeft|baenk) \([0-9a-f]{7}\), uden ændringer\.|^Læsesiden: figuren kan indstilles på sitet\. Her står den, som den åbner\.$/
const ord = {
  dl: { artikel: ordret.dl.length, iLaes: ordret.laesDl.length, manglerILaes: mangler(ordret.dl, ordret.laesDl), kunILaes: mangler(ordret.laesDl, ordret.dl) },
  bp: { artikel: ordret.bp.length, iLaes: ordret.laesBp.length, manglerILaes: mangler(ordret.bp, ordret.laesBp), kunILaes: mangler(ordret.laesBp, ordret.bp) },
}
paastaa(`laesesiden: alle ${ord.dl.artikel} + ${ord.bp.artikel} tekstblokke i artiklerne staar ordret i laesesidens to artikler; ud over dem kun laesesidens egne noter (grenens hash, stillbillederne)`, ['dl', 'bp'].every((k) => !ord[k].manglerILaes.length && ord[k].kunILaes.every((x) => LAES_EGNE.test(x))) && ord.dl.kunILaes.some((x) => x.includes(`artikel-doedloeft (${G.dl.top})`)) && ord.bp.kunILaes.some((x) => x.includes(`artikel-baenk (${G.bp.top})`)), { dl: [ord.dl.manglerILaes, ord.dl.kunILaes], bp: [ord.bp.manglerILaes, ord.bp.kunILaes] })
paastaa('DA7 (Yantra): tre-loefts linje paa main siger stadig "8° mindre (51° → 60°)"', /hoften bøjer 8° mindre ved opstillingen \(51° → 60°\)/.test(da7), da7)
for (const r of sider.filter((s) => s.artikel !== 'laes')) {
  paastaa(`${r.artikel} ${r.bredde}: ingen vandret rul, 0 JS-fejl, 0 404, 0 tankestreger, 0 synlige [MARC, 0 atletnavne, 0 interne navne, ${r.antalBilleder} billeder hele`, r.vandret && !r.sidefejl.length && !r.http404.length && !r.tankestreger && !r.synligMarc && !r.atletnavne && !r.interneNavne && !r.billeder, { f: r.sidefejl, h: r.http404, t: r.tankestreger, m: r.synligMarc })
  paastaa(`${r.artikel} ${r.bredde}: kun skrifttypen forsoeger at gaa ud af huset; uden skjul-marc ${r.marcSynlige} synlige, stadig uden vandret rul`, r.eksterne.every((h) => /fonts\.(googleapis|gstatic)\.com/.test(h)) && r.vandretMedMarc && r.marcSynlige === (r.artikel === 'dl' ? 14 : 11), [...new Set(r.eksterne)])
}
for (const r of sider.filter((s) => s.artikel === 'laes')) paastaa(`laesesiden ${r.bredde}: ingen vandret rul, 0 JS-fejl, 0 tankestreger, 0 atletnavne, intet ud af huset ud over skrifter`, r.vandret && !r.sidefejl.length && !r.tankestreger && !r.atletnavne && r.eksterne.every((h) => /fonts\.(googleapis|gstatic)\.com/.test(h)), r)
const lt = (k) => sider.find((s) => s.artikel === k && s.bredde === 390).ord
paastaa(`laesetid: doedloeft ${lt('dl')} ord = ${(lt('dl') / 130).toFixed(1)} min (siden 18), baenk ${lt('bp')} ord = ${(lt('bp') / 130).toFixed(1)} min (siden 17)`, Math.round(lt('dl') / 130) === 18 && Math.round(lt('bp') / 130) === 17)
const tab390 = sider.filter((s) => s.bredde === 390 && s.tabeller).flatMap((s) => s.tabeller.map((t) => ({ ...t, a: s.artikel })))
const status = {
  DA7: da7, DA9_BA8: 'maal-billede paa grenene er ikke main (se tjekket nedenfor)',
  DA11_BA10: { tabeller390: tab390.length, bredereEndBoksen: tab390.filter((t) => t.bred > t.boks).length, kap7dl: tab390.filter((t) => t.a === 'dl' && t.kap === 'kap-fejlbilleder').map((t) => [t.bred, t.boks]) },
  linjerAendret575: { dl: linjer(G.dl), bp: linjer(G.bp) },
}
const samme = (a, b) => existsSync(a) && existsSync(b) && readFileSync(a).equals(readFileSync(b))
status.maalBilledeAfviger = ['index.html', 'maal-billede.js'].filter((f) => !samme(join(lm, 'dist', 'maal-billede', f), join(dir, 'dl', 'assets', 'vaerktoejer', 'maal-billede', f)))
paastaa('DA9/BA8: Maal dit billede paa grenene er stadig ikke main (index.html og maal-billede.js)', status.maalBilledeAfviger.length === 2, status.maalBilledeAfviger)
paastaa(`DA11/BA10: ${status.DA11_BA10.bredereEndBoksen} af ${status.DA11_BA10.tabeller390} tabeller er stadig bredere end boksen paa 390 (de ruller selv)`, status.DA11_BA10.bredereEndBoksen > 0, status.DA11_BA10)

const ud = { grene: G, loeftmodelMain: lmTop, navneTjekket: navne.length, da, ba, ipf: { ...ipf, uddragIkkeIPdf: ipf.uddragIkkeIPdf }, laesFund, ordret: ord, status, tjek, sider }
writeFileSync(join(HERE, 'artikler-582.json'), JSON.stringify(ud, null, 1))
const roede = tjek.filter((x) => !x.ok).length
console.log(`artikler-582: ${tjek.length - roede}/${tjek.length} (${G.dl.gren} ${G.dl.top}, ${G.bp.gren} ${G.bp.top}, loeftmodel main ${lmTop})`)
process.exit(roede ? 1 : 0)
