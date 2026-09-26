// Ordre 437, blok 1b: ratingens matematik og dagens gaade, med skaks EGEN kode
// (src/gaaderating.js, src/gaadestime.js) og den rigtige pulje (Lichess-banken
// + egne + de 330 lette, kun lovlige stillinger, som i src/gaader.js).
// Laeser en KOPI af skak/main (git archive), aldrig skak-mappen selv.
//
// Brug: node outputs/kritik-437/rating-437.mjs <skak-kopi>
// Skriver outputs/kritik-437/rating-437.json.
//   (internt: node rating-437.mjs <skak-kopi> --pc <dato> <bland-froe> - en "pc")
//
// Elever (500 koersler hver, fast froe, 200 gaader):
//   fast-70 / fast-30  loeser 70 % / 30 % UANSET gaadens svaerhed.
//   elo-70 / elo-30    har en fast styrke S, saa de loeser 70 % / 30 % af
//                      gaaderne omkring 800 (startratingen), og loeser en gaade
//                      paa R med Elo-sandsynligheden 1 / (1 + 10^((R - S)/400)).
//   stoej-70           som elo-70, men med 10 % "gaet" og 10 % "sjusk" (et barn).
//   svag-250           styrke 250, under de letteste gaader (300).
// Afgoerelsen er appens: afgoerRating i src/gaader.js (antal, fejl i traek),
// valget er appens: maalRatingForValg + vaelgNaesteGaade, de 15 sidst viste undgaas.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const skak = path.resolve(process.argv[2] ?? '');
const her = path.dirname(fileURLToPath(import.meta.url));
createRequire(path.join(skak, 'package.json'));
const imp = (p) => import(pathToFileURL(path.join(skak, p)).href);
const R = await imp('src/gaaderating.js');
const T = await imp('src/gaadestime.js');
const { erLovligStilling } = await imp('src/taktikanalyse.js');
const { GAADEBANK_STOR_GZIP_BASE64 } = await imp('src/gaadebank-stor.js');
const { afkodGaadebankStor } = await imp('src/gaadedata.js');
const kilde = (f) => readFileSync(path.join(skak, f), 'utf8');
const SIDST_VIST = Number(/GAADE_SIDST_VIST_MAKS = (\d+)/.exec(kilde('src/main.js'))[1]);

const laes = (fil) => JSON.parse(kilde(`data/${fil}`)).map((g) => ({ id: g.id, fen: g.fen, solutionUci: g.solutionUci, rating: g.svaerhed, tema: g.tema }));
async function byggPulje({ lichess = true } = {}) {
  const lok = laes('gaader.json').concat(laes('gaader-lette.json'));
  const bank = lichess ? await afkodGaadebankStor(GAADEBANK_STOR_GZIP_BASE64) : [];
  return bank.concat(lok).filter((g) => erLovligStilling(g.fen));
}

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function bland(liste, froe) {
  const r = mulberry32(froe);
  const k = [...liste];
  for (let i = k.length - 1; i > 0; i -= 1) { const j = Math.floor(r() * (i + 1)); [k[i], k[j]] = [k[j], k[i]]; }
  return k;
}

// ---------- "pc"-tilstand: en separat proces regner dagens gaade ----------
if (process.argv[3] === '--pc') {
  const dato = process.argv[4];
  const froe = Number(process.argv[5]);
  const pulje = bland(await byggPulje(), froe); // anden raekkefoelge end den anden pc
  const g = T.vaelgDagensGaade(T.dagensKandidater(pulje), dato);
  // Samme oejeblik paa begge pc'er: kl. 00:30 dansk tid den 28. sep (22:30 UTC
  // den 27.). En pc med forkert tidszone har stadig "i gaar" og faar en anden gaade.
  const oejeblik = new Date(Date.UTC(2026, 8, 27, 22, 30));
  console.log(JSON.stringify({ dato, id: g.id, rating: g.rating, tz: process.env.TZ ?? '', dagsNoegleKl0030Dansk: R.dagsNoegle(oejeblik) }));
  process.exit(0);
}

const pulje = await byggPulje();
const ud = { kilde: 'skak main (git archive)', puljeLovlige: pulje.length, sidstVist: SIDST_VIST };
// Hvor mange gaader har sort i traek? (Gaader vender ikke brattet, se KRITIK.)
const sort = (l) => l.filter((g) => g.fen.split(' ')[1] === 'b').length;
const lette = pulje.filter((g) => g.id.startsWith('425-'));
ud.sortITraek = { pulje: sort(pulje), puljeAndel: Number((sort(pulje) / pulje.length).toFixed(2)), lette: sort(lette), letteAntal: lette.length };

// ---------- en elev ----------
// loesSandsynlighed(gaadeRating) -> p. Returnerer forloebet gaade for gaade.
function spil(loesP, antal, froe) {
  const rnd = mulberry32(froe);
  let rating = R.START_RATING;
  let ratingAntal = 0;
  let fejlIRaekke = 0;
  const sidst = [];
  const forloeb = [];
  for (let i = 0; i < antal; i += 1) {
    const maal = R.maalRatingForValg(rating, fejlIRaekke);
    const g = R.vaelgNaesteGaade(pulje, maal, sidst, rnd);
    sidst.push(g.id); if (sidst.length > SIDST_VIST) sidst.shift();
    const rent = rnd() < loesP(g.rating);
    const foer = rating;
    rating = R.nyRating(foer, g.rating, rent, ratingAntal);
    const bund = ratingAntal < R.BUND_ANTAL ? R.BUND_START : R.RATING_MIN;
    ratingAntal += 1;
    fejlIRaekke = rent ? 0 : fejlIRaekke + 1;
    forloeb.push({ id: g.id, g: g.rating, rent, foer, efter: rating, delta: rating - foer, bund, lette: g.id.startsWith('425-') });
  }
  return forloeb;
}
const elo = (S) => (r) => 1 / (1 + 10 ** ((r - S) / 400));
const S70 = Math.round(800 + 400 * Math.log10(0.7 / 0.3)); // 947
const S30 = Math.round(800 - 400 * Math.log10(0.7 / 0.3)); // 653
const ELEVER = {
  'fast-70': () => 0.7,
  'fast-30': () => 0.3,
  'elo-70': elo(S70),
  'elo-30': elo(S30),
  'stoej-70': (r) => 0.1 + 0.8 * elo(S70)(r),
  'svag-250': elo(250),
};
const KOERSLER = 500;
const ANTAL = 200;
const gns = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const sd = (a) => { const m = gns(a); return Math.sqrt(gns(a.map((x) => (x - m) ** 2))); };
const pct = (a, p) => { const k = [...a].sort((x, y) => x - y); return k[Math.min(k.length - 1, Math.floor(p * k.length))]; };

ud.elever = {};
const brud = [];
for (const [navn, p] of Object.entries(ELEVER)) {
  const efter = { 20: [], 50: [], 100: [], 200: [] };
  const udsving = []; // sd af ratingen i gaade 101-200 pr. koersel
  const sving10 = []; // stoerste aendring over 10 gaader i 101-200
  const loestSidste100 = [];
  const forskelligeSidste100 = [];
  let minFoerste20 = Infinity;
  let minEfter20 = Infinity;
  let lette = 0; let alleValg = 0;
  for (let k = 0; k < KOERSLER; k += 1) {
    const f = spil(p, ANTAL, 1000 + k);
    for (const [i, x] of f.entries()) {
      if (x.efter < x.bund || x.efter > R.RATING_MAKS) brud.push({ navn, k, i, ...x });
      if (i < 20) minFoerste20 = Math.min(minFoerste20, x.efter); else minEfter20 = Math.min(minEfter20, x.efter);
      if (x.lette) lette += 1;
      alleValg += 1;
    }
    for (const n of [20, 50, 100, 200]) efter[n].push(f[n - 1].efter);
    const bag = f.slice(100).map((x) => x.efter);
    udsving.push(sd(bag));
    let m = 0; for (let i = 10; i < bag.length; i += 1) m = Math.max(m, Math.abs(bag[i] - bag[i - 10]));
    sving10.push(m);
    loestSidste100.push(gns(f.slice(100).map((x) => (x.rent ? 1 : 0))));
    forskelligeSidste100.push(new Set(f.slice(100).map((x) => x.id)).size);
  }
  ud.elever[navn] = {
    styrke: { 'elo-70': S70, 'stoej-70': S70, 'elo-30': S30, 'svag-250': 250 }[navn] ?? null,
    ratingEfter: Object.fromEntries(Object.entries(efter).map(([n, a]) => [n, { gns: Math.round(gns(a)), p10: pct(a, 0.1), p90: pct(a, 0.9) }])),
    sdGaade101til200: Math.round(gns(udsving)),
    stoersteSving10: Math.round(gns(sving10)),
    loestAndelGaade101til200: Number(gns(loestSidste100).toFixed(2)),
    minFoerste20, minEfter20,
    andelLetteGaader: Number((lette / alleValg).toFixed(2)),
    forskelligeGaaderIGaade101til200: Math.round(gns(forskelligeSidste100)),
  };
  console.log(navn, JSON.stringify(ud.elever[navn]));
}
ud.bundBrud = brud.slice(0, 20);
ud.bundBrudAntal = brud.length;

// ---------- 50 % af de foerste 20 (blok 2's elev), i fire raekkefoelger ----------
// Gaaderne vaelges som i appen; kun raekkefoelgen af rigtige/forkerte er fast.
function foerste20(moenster, froe = 7) {
  const rnd = mulberry32(froe);
  let rating = R.START_RATING; let n = 0; let fejl = 0; const sidst = [];
  const vist = [];
  for (const rent of moenster) {
    const g = R.vaelgNaesteGaade(pulje, R.maalRatingForValg(rating, fejl), sidst, rnd);
    sidst.push(g.id); if (sidst.length > SIDST_VIST) sidst.shift();
    const ny = R.nyRating(rating, g.rating, rent, n);
    vist.push(R.aendringTekst(ny - rating));
    rating = ny; n += 1; fejl = rent ? 0 : fejl + 1;
  }
  return { slut: rating, vist };
}
const skift = Array.from({ length: 20 }, (_, i) => i % 2 === 0);
const moenstre = {
  'skiftevis (R F R F ...)': skift,
  'foerst 10 rigtige, saa 10 forkerte': Array.from({ length: 20 }, (_, i) => i < 10),
  'foerst 10 forkerte, saa 10 rigtige': Array.from({ length: 20 }, (_, i) => i >= 10),
  'tilfaeldig (froe 437)': bland(skift, 437),
};
ud.halvtreds = Object.fromEntries(Object.entries(moenstre).map(([k, m]) => [k, foerste20(m)]));
// Og fordelingen over 500 tilfaeldige raekkefoelger med praecis 10 af 20.
const slut20 = [];
for (let k = 0; k < 500; k += 1) slut20.push(foerste20(bland(skift, 5000 + k), 9000 + k).slut);
ud.halvtredsFordeling = { gns: Math.round(gns(slut20)), min: Math.min(...slut20), p10: pct(slut20, 0.1), p90: pct(slut20, 0.9), maks: Math.max(...slut20) };
// K-trappen og hvad "+x/-y" er ved lige rating
ud.kTrappe = [0, 1, 5, 10, 15, 19, 20, 50].map((n) => ({ gaadeNr: n + 1, K: R.kFaktor(n), vundetVedLige: R.aendringTekst(R.nyRating(800, 800, true, n) - 800), tabtVedLige: R.aendringTekst(R.nyRating(800, 800, false, n) - 800) }));
console.log('50 % af foerste 20', JSON.stringify(ud.halvtreds), JSON.stringify(ud.halvtredsFordeling));

// ---------- dagens gaade ----------
// (1) to "pc'er": to separate Node-processer med hver sin raekkefoelge af puljen
//     (og hver sin tidszone), samme dato.
const selv = fileURLToPath(import.meta.url);
const pcer = [];
for (const dato of ['2026-09-28', '2026-12-24', '2027-03-28']) {
  for (const [froe, tz] of [[1, 'Europe/Copenhagen'], [2, 'Europe/Copenhagen'], [3, 'UTC']]) {
    const env = { ...process.env, TZ: tz }; // kun denne proces' miljoe
    const svar = JSON.parse(execFileSync(process.execPath, [selv, skak, '--pc', dato, String(froe)], { env, encoding: 'utf8' }).trim());
    pcer.push({ froe, ...svar });
  }
}
ud.dagensPcer = pcer;
ud.dagensEnsPaaSammeDato = ['2026-09-28', '2026-12-24', '2027-03-28'].every((d) => new Set(pcer.filter((p) => p.dato === d).map((p) => p.id)).size === 1);
console.log('dagens paa to pcer', ud.dagensEnsPaaSammeDato, JSON.stringify(pcer));

// (2) et helt aar: spredning, gentagelser, hvor mange er fra de lette gaader
const kand = T.dagensKandidater(pulje);
const aar = [];
for (let d = 0; d < 365; d += 1) {
  const dato = new Date(Date.UTC(2026, 8, 1 + d)).toISOString().slice(0, 10);
  aar.push({ dato, ...T.vaelgDagensGaade(kand, dato) });
}
const temaer = {};
for (const g of aar) temaer[g.tema] = (temaer[g.tema] ?? 0) + 1;
let gentagetInden30 = 0;
for (let i = 0; i < aar.length; i += 1) if (aar.slice(Math.max(0, i - 30), i).some((x) => x.id === aar[i].id)) gentagetInden30 += 1;
ud.dagensAar = {
  kandidater: kand.length,
  forskellige: new Set(aar.map((g) => g.id)).size,
  gentagetInden30Dage: gentagetInden30,
  fraLette: aar.filter((g) => g.id.startsWith('425-')).length,
  alleI500til800: aar.every((g) => g.rating >= 500 && g.rating <= 800),
  alleLovlige: aar.every((g) => erLovligStilling(g.fen)),
  temaer,
  ratingGns: Math.round(gns(aar.map((g) => g.rating))),
};
// (3) uafhaengig af puljens raekkefoelge (i samme proces, 20 blandinger)
ud.dagensRaekkefoelgeLigegyldig = Array.from({ length: 20 }, (_, i) => T.vaelgDagensGaade(T.dagensKandidater(bland(pulje, 100 + i)), '2026-10-05').id).every((id, _, a) => id === a[0]);
// (4) hvis Lichess-banken ikke kan pakkes ud (appens catch-gren), er puljen en anden
const kandUden = T.dagensKandidater(await byggPulje({ lichess: false }));
ud.dagensUdenLichess = { kandidater: kandUden.length, andenGaadeAntalDage: aar.filter((g) => T.vaelgDagensGaade(kandUden, g.dato).id !== g.id).length };
console.log('dagens aar', JSON.stringify(ud.dagensAar), 'uden lichess', JSON.stringify(ud.dagensUdenLichess));

// ---------- stimen: fem dage, et hul, midnat ----------
let s = T.tomStime();
const stimeLog = [];
for (const [dag, rent] of [['2026-09-28', true], ['2026-09-28', false], ['2026-09-29', true], ['2026-09-30', true], ['2026-10-02', true]]) {
  const r = T.registrerLoest(s, dag, rent);
  s = r.stime;
  stimeLog.push({ dag, rent, dage: s.dage, rigtigeIRaekke: s.rigtigeIRaekke, loestIDag: s.loestIDag });
}
ud.stime = { log: stimeLog, visningDagenEfterHul: T.visStime(s, '2026-10-04').dage };
ud.stimeOk = stimeLog.map((x) => x.dage).join(',') === '1,1,2,3,1' && ud.stime.visningDagenEfterHul === 0;

writeFileSync(path.join(her, 'rating-437.json'), `${JSON.stringify(ud, null, 1)}\n`);
console.log(`bundbrud ${brud.length}, dagens ens ${ud.dagensEnsPaaSammeDato}, stime ok ${ud.stimeOk}`);
