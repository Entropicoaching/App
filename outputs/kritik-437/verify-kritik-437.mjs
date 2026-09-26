// ORDRE 437: verify:kritik-437. Intet netvaerk, ingen skak-mappe; kun de gemte
// maalinger (lavet mod skak main b9f8303) og dokumenterne.
//   node outputs/kritik-437/verify-kritik-437.mjs 1   blok 1
//   node outputs/kritik-437/verify-kritik-437.mjs 2   blok 1 + blok 2 (standard)
//
// Blok 1: 60 lette gaader er soegt dybere (gaader-437.json), og ratingens
//   matematik og dagens gaade holder (rating-437.json): ingen rating under
//   bunden, Elo-eleverne finder deres styrke og ligger stille, dagens gaade er
//   ens paa tre "pc'er" samme dato, stimen taeller rigtigt.
// Blok 2: den nye elev paa 390 px (elev-437.json) og KRITIK-gaader + RAPPORT-437.
// Exit 1 ved fejl.
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const blok = Number(process.argv[2] ?? 2)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const DOCS = path.join(HERE, '..', '..', 'docs', 'kritik-437')
const fejl = []
const ok = (b, t) => { if (!b) fejl.push(t) }
const json = (f) => {
  const p = path.join(HERE, f)
  if (!existsSync(p)) { fejl.push(`${f} mangler`); return null }
  return JSON.parse(readFileSync(p, 'utf8'))
}
const tekst = (f) => {
  const p = path.join(DOCS, f)
  if (!existsSync(p)) { fejl.push(`docs/kritik-437/${f} mangler`); return null }
  return readFileSync(p, 'utf8').replace(/\r/g, '')
}

// --- blok 1: gaaderne ------------------------------------------------------------
const g = json('gaader-437.json')
if (g) {
  ok(g.antal === 60 && g.resultater.length === 60, `gaader-437: ${g.antal} gaader, ordren siger 60`)
  ok(g.iAlt === 330, `gaader-437: banken har ${g.iAlt} lette gaader, ventet 330`)
  ok(new Set(g.resultater.map((r) => r.id)).size === 60, 'gaader-437: samme gaade to gange')
  ok(g.resultater.every((r) => r.dybdeBrugt >= 4), `gaader-437: soegt under dybde 4: ${g.resultater.filter((r) => !(r.dybdeBrugt >= 4)).map((r) => r.id).join(', ')}`)
  ok(g.resultater.filter((r) => r.dybdeBrugt >= 5).length >= 50, 'gaader-437: faerre end 50 af 60 soegt i dybde 5 (generatoren brugte 3)')
  ok(Object.keys(g.prTema).length === 4, `gaader-437: ${Object.keys(g.prTema).length} temaer i udvalget, ventet alle 4`)
  ok(g.ulovlige.length === 0, `gaader-437: ulovlige stillinger: ${g.ulovlige.map((x) => x.id).join(', ')}`)
  ok(g.forkertTema.length === 0, `gaader-437: forkert tema: ${g.forkertTema.map((x) => `${x.id} (${x.grund})`).join(', ')}`)
  // Fundene fra soegningen (K8 i KRITIK-gaader) med id. De maa ikke vokse; forsvinder
  // de, er gaaderne rettet, og KRITIK skal opdateres.
  const ider = (l) => l.map((x) => x.id).sort().join(',')
  ok(ider(g.facitVinderIkke) === '425-0200,425-0247', `gaader-437: "Red din brik" hvor brikken tabes alligevel: ${ider(g.facitVinderIkke)} (maalt: 425-0200, 425-0247)`)
  ok(ider(g.toLoesninger) === '425-0076,425-0200,425-0247', `gaader-437: to loesninger i dybde 5: ${ider(g.toLoesninger)} (maalt: 425-0076, 425-0200, 425-0247)`)
  ok(ider(g.ligeSaaFristende) === '425-0052,425-0076', `gaader-437: lige saa fristende for en begynder: ${ider(g.ligeSaaFristende)} (maalt: 425-0052, 425-0076)`)
  const r22 = g.resultater.find((x) => x.id === '425-0022')
  ok(r22 && r22.soeg.ogsaaMat > 0, 'gaader-437: 425-0022 (to ens slag, det ene patt) er ikke med i udvalget')
  ok(g.resultater.filter((x) => x.tema === 'mateIn1').every((x) => x.tema_.mattraek === 1), 'gaader-437: en mat i 1 med mere end eet mattraek')
  ok(g.resultater.filter((x) => x.tema === 'fork').every((x) => x.tema_.ok && x.soeg3), 'gaader-437: en gaffel uden tvunget kongetraek eller uden soegt tredje traek')
  ok(g.matOverset.length === 0, `gaader-437: facit overser en mat: ${g.matOverset.map((x) => x.id).join(', ')}`)
}

// --- blok 1: ratingen og dagens gaade ------------------------------------------------
const r = json('rating-437.json')
if (r) {
  ok(r.bundBrudAntal === 0, `rating-437: ${r.bundBrudAntal} gange under bunden (400 i de foerste 20, ellers 200) eller over 2500`)
  const e = r.elever
  for (const n of ['fast-70', 'fast-30', 'elo-70', 'elo-30', 'stoej-70', 'svag-250']) ok(e[n], `rating-437: eleven ${n} mangler`)
  if (e['elo-70'] && e['elo-30']) {
    ok(Math.abs(e['elo-70'].ratingEfter[200].gns - e['elo-70'].styrke) <= 30, 'rating-437: 70 %-eleven (Elo) finder ikke sin styrke paa 200 gaader')
    ok(Math.abs(e['elo-30'].ratingEfter[200].gns - e['elo-30'].styrke) <= 30, 'rating-437: 30 %-eleven (Elo) finder ikke sin styrke paa 200 gaader')
    ok(e['elo-70'].sdGaade101til200 <= 50 && e['stoej-70'].sdGaade101til200 <= 50, 'rating-437: 70 %-eleven er ikke stabil (sd over 50 i gaade 101-200)')
    ok(e['elo-70'].loestAndelGaade101til200 >= 0.45 && e['elo-70'].loestAndelGaade101til200 <= 0.6, 'rating-437: den stabile rating giver ikke ca. 50 % loeste')
  }
  if (e['fast-30']) {
    ok(e['fast-30'].minFoerste20 >= 400 && e['svag-250'].minFoerste20 >= 400, 'rating-437: 30 %-eleven kom under 400 i de foerste 20')
    ok(e['fast-30'].minEfter20 >= 200 && e['svag-250'].minEfter20 >= 200, 'rating-437: 30 %-eleven kom under 200')
  }
  if (e['fast-70']) ok(e['fast-70'].ratingEfter[200].gns > e['fast-70'].ratingEfter[100].gns + 200, 'rating-437: fast-70 stiger ikke laengere - ret fundet om "70 % uanset svaerhed" i KRITIK')
  ok(r.dagensEnsPaaSammeDato === true, 'rating-437: dagens gaade er ikke ens paa pc\'erne samme dato')
  ok(r.dagensPcer?.length === 9 && new Set(r.dagensPcer.map((p) => p.froe)).size === 3, 'rating-437: dagens gaade er ikke regnet paa tre separate pc\'er')
  ok(r.dagensPcer?.some((p) => p.tz === 'UTC' && p.dagsNoegleKl0030Dansk === '2026-09-27'), 'rating-437: tidszone-tjekket (00:30 dansk tid paa en UTC-pc) mangler')
  ok(r.dagensRaekkefoelgeLigegyldig === true, 'rating-437: dagens gaade afhaenger af puljens raekkefoelge')
  ok(r.dagensAar?.alleI500til800 && r.dagensAar?.alleLovlige, 'rating-437: en dagens gaade uden for 500-800 eller ulovlig')
  ok(r.stimeOk === true, 'rating-437: stimen taeller forkert (1,1,2,3,1 og 0 efter et hul)')
  const h = r.halvtreds?.['foerst 10 forkerte, saa 10 rigtige']
  ok(h && h.slut < 800, 'rating-437: eleven der forbedrer sig ender ikke laengere under 800 - ret fundet i KRITIK')
}

// --- blok 2 -------------------------------------------------------------------------
if (blok >= 2) {
  const el = json('elev-437.json')
  if (el) {
    for (const k of ['A', 'B']) {
      const e = el[k]
      ok(e && e.forloeb.length === 20, `elev-437 ${k}: ${e?.forloeb.length} gaader, ventet 20`)
      ok(e && e.moenster.split('').filter((x) => x === 'R').length === 10, `elev-437 ${k}: loeste ikke praecis 10 af 20 rent`)
      ok(e && e.sidefejl.length === 0, `elev-437 ${k}: sidefejl ${e?.sidefejl.join(' | ')}`)
      ok(e && e.forloeb.every((x) => x.aendring !== ''), `elev-437 ${k}: en gaade gav ingen +/- ved ratingen`)
    }
    ok(el.A?.start.rating === '800', 'elev-437: ny elev starter ikke paa 800')
    ok(el.B && el.B.slut < 800, 'elev-437: elev B (forbedrer sig) ender ikke under 800 - ret K1 i KRITIK')
    ok(el.A?.forloeb.some((x) => x.maade !== 'rent' && x.maade !== 'hint-spring' && /løst uden hint/.test(x.status) && x.aendring.startsWith('−')), 'elev-437: "Loest! ... (loest uden hint)" med et minus findes ikke laengere - ret K2 i KRITIK')
    ok(el.sort && el.sort.tur === 'b' && el.sort.braetFraHvid === true && el.sort.tekstOmTur.length === 0, 'elev-437: en gaade med sort i traek vendes nu eller siger hvem der traekker - ret K3 i KRITIK')
    ok(el.A?.maal.ratingSesUdenScroll === false && el.A?.maal.grafSesUdenScroll === false, 'elev-437: ratingen/grafen ses nu uden at scrolle paa 390 x 844 - ret K4 i KRITIK')
  }
  const filer = readdirSync(HERE)
  ok(filer.filter((f) => /^G-\d\d-.*\.png$/.test(f)).length >= 12, 'faerre end 12 G-skaermbilleder')
  const k = tekst('KRITIK-gaader.md')
  if (k) {
    ok(/\*\*Klar til klassen: (ja|nej), fordi/i.test(k), 'KRITIK-gaader mangler linjen "Klar til klassen: ja/nej, fordi"')
    ok(/\*\*K1\./.test(k) && k.indexOf('**K1.') < k.indexOf('## Hvad der holder'), 'KRITIK-gaader: fundene skal staa oeverst')
  }
  const rp = tekst('RAPPORT-437.md')
  if (rp) {
    ok(rp.split('\n')[0].trim() === 'Ordre 437', 'RAPPORT-437.md skal starte med "Ordre 437"')
    for (const a of ['## Gren', '## Hvad ændret', '## Testresultat', '## Hvad er næste', '## Ærlige grænser']) ok(rp.includes(a), `RAPPORT-437.md mangler "${a}"`)
    ok(/Chaturanga/.test(rp.split('## Hvad er næste')[1] ?? ''), 'RAPPORT-437: "Hvad er naeste" skal have fundene til Chaturanga')
  }
}

if (fejl.length) {
  console.error(`verify:kritik-437 blok ${blok} ROED (${fejl.length}):\n - ${fejl.join('\n - ')}`)
  process.exit(1)
}
console.log(`verify:kritik-437 blok ${blok} GROEN: 60 lette gaader soegt dybere, ratingens bund, Elo-stabilitet, dagens gaade paa tre pc'er og stimen holder${blok >= 2 ? '; elev A og B paa 390 px og dokumenterne i orden' : ''}.`)
