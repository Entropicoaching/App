// Ordre 437, blok 1a: 60 tilfaeldige af de 330 lette gaader (ordre 425) tjekket
// med en EGEN, dybere soegning end generatorens (dybde 3 + rolig).
// Laeser en KOPI af skak/main (git archive), aldrig skak-mappen selv.
//
// Brug: node outputs/kritik-437/gaader-437.mjs <skak-kopi> [dybde=5] [antal=60]
//   <skak-kopi> = mappe med data/, src/ og node_modules (chess.js).
// Skriver outputs/kritik-437/gaader-437.json. Soeger i op til 8 processer paa een gang
// (PARALLEL=1 for een); proces k tager hver n. gaade (DEL=k/n, internt).
//
// Pr. gaade:
//   lovlig    chess.js kan laese den, en konge af hver farve, siden der ikke er
//             i traek staar ikke i skak, partiet er ikke slut, ingen bonde paa
//             1./8. raekke.
//   entydig   negamax med alfa-beta, <dybde> halvtraek + rolig soegning (slag og
//             forvandlinger), KUN materiale (ingen remisregler: "for lidt til mat"
//             er remis i skak, men en gaade handler om at vinde eller redde en brik),
//             materiale i bondeenheder, mat = 1000. Appen godtager
//             KUN facit-traekket, saa ethvert andet foerste traek der vinder
//             lige saa meget (inden for 1,5 bonde) er en anden loesning, eleven
//             bliver straffet for. Mat i 1: alle mattraek taelles. Gaflen: ogsaa
//             tredje traek (slaget) og om modstanderens svar er tvunget.
//   tema      maalt direkte paa stillingen (se temaTjek).
//   rating    enkle, gennemsigtige traek der goer en gaade svaer for en
//             begynder: brikker, lokkende slag/skak, langt traek, kongen slaar,
//             sort i traek; og en dom pr. gaade.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const skak = path.resolve(process.argv[2] ?? '');
const DYBDE = Number(process.argv[3] ?? 5);
const ANTAL = Number(process.argv[4] ?? 60);
const her = path.dirname(fileURLToPath(import.meta.url));
const kraev = createRequire(path.join(skak, 'package.json'));
const { Chess } = await import(pathToFileURL(kraev.resolve('chess.js')).href);
const alle = JSON.parse(readFileSync(path.join(skak, 'data/gaader-lette.json'), 'utf8'));

// ---------- udvaelgelse: fast froe, saa samme 60 hver gang ----------
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(437);
const kopi = [...alle];
for (let i = kopi.length - 1; i > 0; i -= 1) {
  const j = Math.floor(rnd() * (i + 1));
  [kopi[i], kopi[j]] = [kopi[j], kopi[i]];
}
const udvalg = kopi.slice(0, ANTAL).sort((a, b) => (a.id < b.id ? -1 : 1));

// ---------- egen soegning ----------
const V = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const MAT = 1000;
const uci = (m) => `${m.from}${m.to}${m.promotion ?? ''}`;
let knuder = 0;

function materiale(c) {
  let s = 0;
  for (const r of c.board()) for (const b of r) if (b) s += (b.color === c.turn() ? 1 : -1) * V[b.type];
  return s;
}
function ordn(ts) {
  const w = (m) => (m.captured ? V[m.captured] * 10 - V[m.piece] + 100 : 0) + (m.promotion ? 80 : 0) + (m.san.includes('+') ? 5 : 0);
  return ts.sort((a, b) => w(b) - w(a));
}
function rolig(c, a, b, d) {
  knuder += 1;
  const ts = c.moves({ verbose: true });
  if (ts.length === 0) return c.inCheck() ? -MAT : 0;
  const staa = materiale(c);
  if (d === 0 || staa >= b) return staa;
  if (staa > a) a = staa;
  for (const m of ordn(ts.filter((t) => t.captured || t.promotion))) {
    c.move(m); const s = -rolig(c, -b, -a, d - 1); c.undo();
    if (s >= b) return s;
    if (s > a) a = s;
  }
  return a;
}
// Transpositionstabel (stilling + dybde) med alfa-beta-graenser, og et loft
// over knuder pr. gaade: en stilling med forvandlinger kan eksplodere, saa
// gaaden soeges da igen et halvtraek lavere (og det noteres).
const LOFT = Number(process.env.KNUDE_LOFT ?? 3_000_000);
let tt = new Map();
class LoftNaaet extends Error {}
function negamax(c, d, a, b) {
  knuder += 1;
  if (knuder > LOFT) throw new LoftNaaet();
  const noegle = `${c.fen().split(' ').slice(0, 4).join(' ')}|${d}`;
  const a0 = a;
  const hit = tt.get(noegle);
  if (hit) {
    if (hit.f === 0) return hit.s;
    if (hit.f === 1 && hit.s >= b) return hit.s;
    if (hit.f === -1 && hit.s <= a) return hit.s;
  }
  const ts = c.moves({ verbose: true });
  if (ts.length === 0) return c.inCheck() ? -MAT - d : 0;
  if (d === 0) return rolig(c, a, b, 8);
  let bedst = -Infinity;
  for (const m of ordn(ts)) {
    c.move(m); const s = -negamax(c, d - 1, -b, -a); c.undo();
    if (s > bedst) bedst = s;
    if (s > a) a = s;
    if (a >= b) break;
  }
  tt.set(noegle, { s: bedst, f: bedst <= a0 ? -1 : bedst >= b ? 1 : 0 });
  return bedst;
}
function scoreEfter(c, m, d, a = -Infinity, b = Infinity) {
  c.move(m); const s = -negamax(c, d - 1, -b, -a); c.undo();
  return s;
}
// Facit soeges med fuldt vindue; hvert andet foerste traek med vinduet
// [facit - 3, facit + 1], saa vi faar det praecist nok til at se, om det kommer
// inden for 1,5 bonde, og om det er BEDRE end facit (fx en mat eleven ser).
const norm = (x) => (x >= MAT ? MAT : x <= -MAT ? -MAT : x);
function vurder(fen, facitUci, d, forsvar = false) {
  const c = new Chess(fen);
  const nu = materiale(c);
  const ts = c.moves({ verbose: true });
  const f = ts.find((m) => uci(m) === facitUci);
  if (!f) return { fejl: 'facit er ikke lovligt' };
  const facit = scoreEfter(c, f, d);
  const andre = [];
  for (const m of ts) {
    if (m === f) continue;
    const s = scoreEfter(c, m, d, facit - 3, facit + 1);
    andre.push({ uci: uci(m), san: m.san, score: s });
  }
  andre.sort((x, y) => y.score - x.score);
  const bedsteAndet = andre[0] ?? null;
  return {
    nu,
    facitGevinst: facit >= MAT ? 'mat' : facit - nu,
    facitScore: facit,
    bedsteAndet: bedsteAndet ? { uci: bedsteAndet.uci, san: bedsteAndet.san, gevinst: bedsteAndet.score >= MAT ? 'mat' : bedsteAndet.score - nu, score: bedsteAndet.score } : null,
    // "Lige saa godt" = inden for 1,5 bonde af facit og selv en gevinst. Ved
    // "Red din brik" er facit ingen gevinst (brikken reddes), saa dér taeller
    // ethvert andet traek der ogsaa holder materialet.
    ligeSaaGode: andre.filter((x) => x.score > facit - 1.5 && (forsvar || x.score - nu >= 1)).map((x) => x.san),
    bedreEndFacit: andre.filter((x) => x.score > facit).map((x) => x.san),
    // Naar facit ender i mat, kan andre traek ogsaa goere det, bare langsommere.
    // Det er "teknisk" ikke entydigt, men ikke det en begynder ser; det tager
    // graadigt() sig af (to slag paa samme brik, 425-0022).
    ogsaaMat: facit >= MAT ? andre.filter((x) => x.score >= MAT).length : 0,
  };
}

// Hvad ser en begynder? Et halvtraek + rolig soegning ("hvad vinder jeg lige
// nu, og kan det slaas igen?"). Et andet foerste traek der her ser lige saa
// godt ud som facit, er en fristelse appen straffer (fx at forvandle en bonde
// til en dronning i en "Slaa den ubeskyttede", 425-0076).
function graadigt(fen, facitUci) {
  const c = new Chess(fen);
  const nu = materiale(c);
  const ts = c.moves({ verbose: true });
  const sc = (m) => { c.move(m); const s = -rolig(c, -Infinity, Infinity, 8); c.undo(); return norm(s); };
  const f = ts.find((m) => uci(m) === facitUci);
  const facit = sc(f);
  const lige = ts.filter((m) => m !== f).map((m) => ({ san: m.san, s: sc(m) })).filter((x) => x.s >= facit && x.s > nu).map((x) => `${x.san} (${x.s >= MAT ? 'mat' : `+${x.s - nu}`})`);
  return { facitSer: facit >= MAT ? 'mat' : facit - nu, ligeSaaFristende: lige };
}

// ---------- lovlighed ----------
function lovlighed(fen) {
  let c;
  try { c = new Chess(fen); } catch (e) { return { ok: false, grund: `chess.js: ${e.message}` }; }
  const brikker = c.board().flat().filter(Boolean);
  const konger = brikker.filter((b) => b.type === 'k');
  if (konger.length !== 2 || konger[0].color === konger[1].color) return { ok: false, grund: 'ikke en konge af hver farve' };
  const anden = konger.find((k) => k.color !== c.turn());
  if (c.isAttacked(anden.square, c.turn())) return { ok: false, grund: 'siden der ikke er i traek staar i skak' };
  if (brikker.some((b) => b.type === 'p' && /[18]$/.test(b.square))) return { ok: false, grund: 'bonde paa 1./8. raekke' };
  if (c.isGameOver()) return { ok: false, grund: 'partiet er slut' };
  return { ok: true, brikker: brikker.length };
}

// ---------- tema ----------
function lovligeSlagPaa(c, felt) {
  return c.moves({ verbose: true }).filter((m) => m.to === felt && m.captured);
}
function temaTjek(g) {
  const c = new Chess(g.fen);
  const [t1, t2, t3] = g.solutionUci;
  const m1 = c.moves({ verbose: true }).find((m) => uci(m) === t1);
  if (!m1) return { ok: false, grund: 'foerste traek ulovligt' };
  if (g.tema === 'hangingPiece') {
    if (!m1.captured) return { ok: false, grund: 'facit er ikke et slag' };
    c.move(m1);
    const igen = lovligeSlagPaa(c, m1.to);
    return { ok: igen.length === 0 && g.solutionUci.length === 1, grund: igen.length ? `kan slaas igen med ${igen.map((m) => m.san).join(', ')}` : '', slaaet: m1.captured, slaarMed: m1.piece };
  }
  if (g.tema === 'mateIn1') {
    const mat = c.moves({ verbose: true }).filter((m) => { c.move(m); const x = c.isCheckmate(); c.undo(); return x; });
    return { ok: mat.length === 1 && uci(mat[0]) === t1, grund: mat.length !== 1 ? `${mat.length} mattraek: ${mat.map((m) => m.san).join(', ')}` : '', mattraek: mat.length };
  }
  if (g.tema === 'defensiveMove') {
    // Brikken paa fra-feltet er angrebet af en billigere brik, eller angrebet
    // og udaekket (425-0202: et taarn angriber en udaekket springer), og paa
    // til-feltet kan den ikke slaas.
    const angribere = c.attackers(m1.from, c.turn() === 'w' ? 'b' : 'w').map((f) => c.get(f));
    const udaekket = c.attackers(m1.from, c.turn()).length === 0;
    const billigere = angribere.some((a) => (V[a.type] < V[m1.piece] && a.type !== 'k') || udaekket);
    c.move(m1);
    const igen = lovligeSlagPaa(c, m1.to);
    c.undo();
    // Hvor mange felter er sikre for brikken? (felter hvor den ikke kan slaas)
    const sikre = c.moves({ verbose: true }).filter((m) => m.from === m1.from).filter((m) => {
      c.move(m); const s = lovligeSlagPaa(c, m.to).length === 0; c.undo(); return s;
    }).map((m) => m.san);
    return { ok: billigere && igen.length === 0 && !m1.captured, grund: [!billigere && 'brikken var hverken angrebet af en billigere eller udaekket', igen.length && 'kan slaas paa til-feltet', m1.captured && 'facit er et slag'].filter(Boolean).join('; '), sikreFelter: sikre };
  }
  if (g.tema === 'fork') {
    if (m1.piece !== 'n' || !m1.san.includes('+')) return { ok: false, grund: 'foerste traek er ikke springer-skak' };
    c.move(m1);
    const svar = c.moves({ verbose: true });
    const kongeSvar = svar.filter((m) => m.piece === 'k' && !m.captured);
    const andetSvar = svar.filter((m) => !(m.piece === 'k' && !m.captured)).map((m) => m.san);
    const m2 = svar.find((m) => uci(m) === t2);
    if (!m2) return { ok: false, grund: 'modstanderens svar er ulovligt' };
    c.move(m2);
    const m3 = c.moves({ verbose: true }).find((m) => uci(m) === t3);
    const ok = Boolean(m3?.captured) && m3.piece === 'n' && andetSvar.length === 0;
    return { ok, grund: !m3?.captured ? 'tredje traek er ikke springerens slag' : andetSvar.length ? `modstanderen kan ogsaa: ${andetSvar.join(', ')}` : '', svarMuligheder: svar.length, kongeSvar: kongeSvar.length, gafletBrik: m3?.captured };
  }
  return { ok: false, grund: `ukendt tema ${g.tema}` };
}

// ---------- svaerhed for en begynder ----------
function svaerhedstraek(g) {
  const c = new Chess(g.fen);
  const ts = c.moves({ verbose: true });
  const f = ts.find((m) => uci(m) === g.solutionUci[0]);
  const dx = Math.abs(f.from.charCodeAt(0) - f.to.charCodeAt(0));
  const dy = Math.abs(Number(f.from[1]) - Number(f.to[1]));
  const andreSlag = ts.filter((m) => m.captured && m !== f).map((m) => m.san);
  const andreSkak = ts.filter((m) => m.san.includes('+') && m !== f).map((m) => m.san);
  return {
    brikker: c.board().flat().filter(Boolean).length,
    lovligeTraek: ts.length,
    farve: c.turn(),
    brik: f.piece,
    laengde: Math.max(dx, dy),
    springer: f.piece === 'n',
    kongenSlaar: f.piece === 'k' && Boolean(f.captured),
    forvandling: Boolean(f.promotion),
    andreSlag, andreSkak,
  };
}

// Dom: en "slaa den ubeskyttede" paa 350 skal vaere let. Vi siger en gaade er
// "svaerere end sin rating", hvis den har mindst to af disse ting og ligger i
// den nederste del af sit temas skala: 7+ brikker, 2+ andre slag der lokker,
// langt traek (4+ felter), kongen der slaar, sort i traek.
function ratingDom(g, s) {
  const tunge = [
    s.brikker >= 7 && '7+ brikker',
    s.andreSlag.length >= 2 && `${s.andreSlag.length} andre slag`,
    s.laengde >= 4 && `langt traek (${s.laengde} felter)`,
    s.kongenSlaar && 'kongen slaar',
    s.farve === 'b' && 'sort i traek',
    s.forvandling && 'facit er en forvandling',
  ].filter(Boolean);
  const bund = { hangingPiece: 340, mateIn1: 390, defensiveMove: 490, fork: 565 }[g.tema];
  const svaerereEndRating = tunge.length >= 2 && g.svaerhed <= bund;
  return { tunge, svaerereEndRating };
}

const t0 = Date.now();
const resultater = [];
const DEL = process.env.DEL;
const PARALLEL = Number(process.env.PARALLEL ?? Math.min(8, os.cpus().length));
let mine = udvalg;
if (DEL) {
  const [k, n] = DEL.split('/').map(Number);
  mine = udvalg.filter((_, i) => i % n === k);
} else if (PARALLEL > 1) {
  const filer = await Promise.all(Array.from({ length: PARALLEL }, (_, k) => new Promise((ok, nej) => {
    const fil = path.join(os.tmpdir(), `gaader-437-del-${k}-${process.pid}.json`);
    const barn = spawn(process.execPath, [fileURLToPath(import.meta.url), ...process.argv.slice(2)], { env: { ...process.env, DEL: `${k}/${PARALLEL}`, UD: fil }, stdio: ['ignore', 'inherit', 'inherit'] });
    barn.on('exit', (kode) => (kode === 0 ? ok(fil) : nej(new Error(`del ${k} fejlede (${kode})`))));
  })));
  for (const fil of filer) resultater.push(...JSON.parse(readFileSync(fil, 'utf8')));
  resultater.sort((a, b) => (a.id < b.id ? -1 : 1));
  mine = [];
}
for (const g of mine) {
  const t = Date.now();
  knuder = 0;
  const lov = lovlighed(g.fen);
  const tema = lov.ok ? temaTjek(g) : { ok: false, grund: 'ulovlig' };
  let soeg = null;
  let soeg3 = null;
  let dybdeBrugt = null;
  for (let d = DYBDE; lov.ok && d >= 3 && dybdeBrugt === null; d -= 1) {
    try {
      knuder = 0; tt = new Map();
      soeg = vurder(g.fen, g.solutionUci[0], d, g.tema === 'defensiveMove');
      if (g.tema === 'fork') {
        const c = new Chess(g.fen);
        c.move({ from: g.solutionUci[0].slice(0, 2), to: g.solutionUci[0].slice(2, 4) });
        c.move({ from: g.solutionUci[1].slice(0, 2), to: g.solutionUci[1].slice(2, 4) });
        knuder = 0; tt = new Map();
        soeg3 = vurder(c.fen(), g.solutionUci[2], d);
      }
      dybdeBrugt = d;
    } catch (e) {
      if (!(e instanceof LoftNaaet)) throw e;
    }
  }
  const s = lov.ok ? svaerhedstraek(g) : null;
  const graad = lov.ok && (g.tema === 'hangingPiece' || g.tema === 'defensiveMove') ? graadigt(g.fen, g.solutionUci[0]) : null;
  const dom = s ? ratingDom(g, s) : null;
  const toLoesninger = g.tema === 'mateIn1'
    ? tema.mattraek !== 1
    : Boolean(soeg && soeg.ligeSaaGode.length) || Boolean(soeg3 && soeg3.ligeSaaGode.length);
  const facitVinder = g.tema === 'mateIn1' ? soeg?.facitGevinst === 'mat'
    : g.tema === 'defensiveMove' ? Boolean(soeg && (soeg.facitGevinst === 'mat' || soeg.facitGevinst >= 0))
      : Boolean(soeg && (soeg.facitGevinst === 'mat' || soeg.facitGevinst >= 1));
  const r = {
    id: g.id, tema: g.tema, rating: g.svaerhed, fen: g.fen, facit: g.solutionUci,
    lovlig: lov, tema_: tema, soeg, soeg3, svaerhed: s, dom,
    toLoesninger, facitVinder, graad,
    matOverset: Boolean(soeg && soeg.facitGevinst !== 'mat' && soeg.bedsteAndet?.gevinst === 'mat'),
    dybdeBrugt, ms: Date.now() - t,
  };
  resultater.push(r);
  console.log(`${g.id} ${g.tema.padEnd(13)} ${g.svaerhed} lovlig=${lov.ok} tema=${tema.ok} facit=${soeg?.facitGevinst} andet=${soeg?.bedsteAndet?.san}:${soeg?.bedsteAndet?.gevinst} to=${toLoesninger} graad=${graad?.ligeSaaFristende.join('/') ?? '-'} d=${dybdeBrugt} ${dom?.svaerereEndRating ? 'SVAER:' + dom.tunge.join('/') : ''} ${r.ms}ms`);
}

if (DEL) {
  writeFileSync(process.env.UD, JSON.stringify(resultater));
  process.exit(0);
}
const pr = (f) => resultater.filter(f);
const temaer = [...new Set(resultater.map((r) => r.tema))];
const ud = {
  kilde: 'skak main (git archive), data/gaader-lette.json',
  dybde: DYBDE, froe: 437, antal: resultater.length, iAlt: alle.length,
  sekunder: Math.round((Date.now() - t0) / 1000),
  knudeLoft: LOFT,
  dybdeBrugt: Object.fromEntries([...new Set(resultater.map((r) => r.dybdeBrugt))].map((d) => [d, resultater.filter((r) => r.dybdeBrugt === d).length])),
  prTema: Object.fromEntries(temaer.map((t) => [t, pr((r) => r.tema === t).length])),
  ulovlige: pr((r) => !r.lovlig.ok).map((r) => ({ id: r.id, grund: r.lovlig.grund })),
  forkertTema: pr((r) => !r.tema_.ok).map((r) => ({ id: r.id, tema: r.tema, grund: r.tema_.grund })),
  toLoesninger: pr((r) => r.toLoesninger).map((r) => ({ id: r.id, tema: r.tema, rating: r.rating, fen: r.fen, facit: r.facit, ogsaa: [...(r.soeg?.ligeSaaGode ?? []), ...(r.soeg3?.ligeSaaGode ?? []).map((x) => `(3. traek) ${x}`)] })),
  // Et andet foerste traek der for en begynder ser lige saa godt ud (et
  // halvtraek + rolig soegning): fristelser appen straffer med "Ikke den vej".
  ligeSaaFristende: pr((r) => r.graad?.ligeSaaFristende.length).map((r) => ({ id: r.id, tema: r.tema, rating: r.rating, fen: r.fen, facit: r.facit, facitSer: r.graad.facitSer, ogsaa: r.graad.ligeSaaFristende })),
  facitVinderIkke: pr((r) => r.lovlig.ok && !r.facitVinder).map((r) => ({ id: r.id, tema: r.tema, gevinst: r.soeg?.facitGevinst })),
  matOverset: pr((r) => r.matOverset).map((r) => ({ id: r.id, tema: r.tema, rating: r.rating, fen: r.fen, facit: r.facit, mat: r.soeg.bedsteAndet.san })),
  svaerereEndRating: pr((r) => r.dom?.svaerereEndRating).map((r) => ({ id: r.id, tema: r.tema, rating: r.rating, fen: r.fen, facit: r.facit, hvorfor: r.dom.tunge })),
  lokkendeSlagIMatI1: pr((r) => r.tema === 'mateIn1' && r.svaerhed.andreSlag.length > 0).length,
  kongenSlaar: pr((r) => r.svaerhed?.kongenSlaar).length,
  resultater,
};
writeFileSync(path.join(her, 'gaader-437.json'), `${JSON.stringify(ud, null, 1)}\n`);
console.log(`\n${ud.antal} gaader, dybde ${DYBDE}, ${ud.sekunder} s. ulovlige ${ud.ulovlige.length}, forkert tema ${ud.forkertTema.length}, to loesninger ${ud.toLoesninger.length}, facit vinder ikke ${ud.facitVinderIkke.length}, mat overset ${ud.matOverset.length}, svaerere end rating ${ud.svaerereEndRating.length}, lige saa fristende ${ud.ligeSaaFristende.length}`);
