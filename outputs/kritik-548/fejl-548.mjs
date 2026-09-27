// Kritik 548, blok 1: "Ligner: <fejl>" i Maal dit billede igen, efter Yantras 537 (sko med hael,
// taeer ud, skraat kamera) og 541 (L1, L2, L4, L5), mod entropi-loeftmodel-dhruva main (ca860bf).
// Mine scenarier og mit pinhole-kamera fra 536 (outputs/kritik-536/fejl-536.mjs), udvidet.
//
//   node outputs/kritik-548/fejl-548.mjs
//
// Loeftmodellen hentes med git archive til en midlertidig mappe; intet trae roeres.
// Skriver outputs/kritik-548/fejl-548.json. Kun syntetiske punkter (modellens egne stillinger og
// fejlfigurer, tegnet i 3D og fotograferet med mit pinhole-kamera) og Marcs egne klik fra 462/494/498.
//
// A  Otte kamerapladser fra 536 plus 20 grader skraat og 10 grader til den anden side: falsk alarm,
//    overset, og hvor ofte en rigtig fejlfigur faar linjen "Ligner ingen ..." (tjekket, intet fund).
// D  L1: doedloeftets egen bane 0-20 cm over gulvet fra alle pladser, med og uden det fjerne nav.
// H  Sko med hael (537): billedet i sko med 0-3 cm hael, feltet paa samme hael eller 0.
//    Og min 536-hael (skinnebenet vippet) med high bar, feltet paa 0 og 2.
// T  Taeer ud: T1 = min 536 (knaeet drejet ud om hofte-ankel), T2 = benet drejet om en lodret akse
//    gennem hoften (knae og fod foelger taeerne). Hvad staar der paa skaermen?
// K  Skraat kamera: sidens skoen af vinklen (de to nav) mod den rigtige, 3 og 4 m, og et kamera
//    der staar forskudt uden at dreje.
// E  Marcs klip: Yantras 498-klik (med og uden 514's fjerne nav) og mine 494-klik.
// F  Saetningerne med og uden Min krop, og den stille linje for hver status.

import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

const DHRUVA = 'C:/Users/Entropi/Desktop/entropi-loeftmodel-dhruva';
const REF = process.argv[2] || 'main';
const SHA = execSync(`git -C ${DHRUVA} rev-parse --short ${REF}`).toString().trim();
const LM = path.join(tmpdir(), `kritik-548-loeftmodel-${SHA}`);
if (!fs.existsSync(path.join(LM, 'dist', 'maal-billede', 'index.html'))) {
  fs.rmSync(LM, { recursive: true, force: true }); fs.mkdirSync(LM, { recursive: true });
  execSync(`git -C ${DHRUVA} archive ${SHA} src dist scripts kroppe docs outputs/videomaal outputs/507 outputs/514 outputs/520 package.json | tar -x -C "${LM.replace(/\\/g, '/')}"`, { shell: 'bash' });
}
const imp = (f) => import(pathToFileURL(path.join(LM, f)).href);
const { maal, skalaFraKrop, knaeFaseTjek, fraLodret, indvendigVinkel } = await imp('src/maalBillede.js');
const { kroppe, modelFase } = await imp('src/maalBilledeModel.js');
const { indstilling } = await imp('src/minKrop.js');
const FJ = await imp('src/maalBilledeFejl.js');
const { genkendFejl, FEJL_REGLER, stilleLinje, skraatKamera, INGEN_LINJE, fejlTal } = FJ;
const FM = await imp('src/fejlgenkendelseMaaling.js');
const { KROPPE, KLIKFEJL, kropsBilleder, squatBilleder } = FM;
const { MARC_GULV } = await imp('scripts/ordre-507-skaermbilleder.mjs');
const { MARC_KNAE } = await imp('scripts/ordre-510-skaermbilleder.mjs');
const { FJERNT_NAV } = await imp('scripts/ordre-514-skaermbilleder.mjs');

const UD = path.dirname(fileURLToPath(import.meta.url));
const r1 = (x) => (x === null || x === undefined || !Number.isFinite(x) ? null : Math.round(x * 10) / 10);
const pct = (a, n) => (n ? Math.round((1000 * a) / n) / 10 : null);
const IDS = ['stang', 'midtfod', 'ankel', 'knae', 'hofte', 'skulder'];
const LOEFT = { 'squat-bund': 'squat', 'squat-midt': 'squat', 'dl-gulv': 'doedloeft', 'dl-knae': 'doedloeft', 'baenk-bryst': 'baenk' };
const FASER = Object.keys(LOEFT);
const ind = (loeft, h, v, p = {}) => ({ ...indstilling(loeft, { hoejde: h, vaegt: v }, { gennemsnit: true }), ...p });

// --- pinhole (som 511/521/530/536) ---------------------------------------------------
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const mul = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const norm = (a) => mul(a, 1 / Math.sqrt(dot(a, a)));
function kamera({ afstand = 300, hoejde = 75, skraa = 0, sigte = 'vandret', maal: mp = null, cx = 0 }) {
  const s = (skraa * Math.PI) / 180;
  const C = { x: cx + afstand * Math.sin(s), y: hoejde, z: -afstand * Math.cos(s) };
  const T = sigte === 'vandret' ? { x: cx, y: hoejde, z: 0 } : mp;
  const fwd = norm(sub(T, C));
  const right = norm(cross({ x: 0, y: 1, z: 0 }, fwd));
  const up = cross(fwd, right);
  return (P) => { const d = sub(P, C); const zc = dot(d, fwd); return { x: 1000 * (dot(d, right) / zc) + 1000, y: 1000 - 1000 * (dot(d, up) / zc) }; };
}
// For skraa kamera: drejet om stangens punkt i x = cx (kameraet ser mod det punkt).
function kameraDrejet({ afstand = 300, hoejde = 75, skraa = 0, cx = 0 }) {
  const s = (skraa * Math.PI) / 180;
  const C = { x: cx + afstand * Math.sin(s), y: hoejde, z: -afstand * Math.cos(s) };
  const fwd = norm(sub({ x: cx, y: hoejde, z: 0 }, C));
  const right = norm(cross({ x: 0, y: 1, z: 0 }, fwd));
  const up = cross(fwd, right);
  return (P) => { const d = sub(P, C); const zc = dot(d, fwd); return { x: 1000 * (dot(d, right) / zc) + 1000, y: 1000 - 1000 * (dot(d, up) / zc) }; };
}
const DYBDE = {
  squat: { stang: -70, midtfod: -15, ankel: -16, knae: -18, hofte: -18, skulder: -20 },
  doedloeft: { stang: -75, midtfod: -12, ankel: -14, knae: -13, hofte: -18, skulder: -20 },
  baenk: { stang: -75, midtfod: -15, ankel: -14, knae: -13, hofte: -18, skulder: -20 },
};
const KAMHOEJDE = { squat: 80, doedloeft: 75, baenk: 60 };
const KAMERAER = [
  { id: 'vinkelret', navn: 'vinkelret, 3 m, i hoftehøjde', k: (h, P) => ({ afstand: 300, hoejde: h, cx: P.stang.x }) },
  { id: 'hoej30', navn: '30 cm højere, vippet ned mod hoften', k: (h, P) => ({ afstand: 300, hoejde: h + 30, cx: P.stang.x, sigte: 'maal', maal: { x: P.stang.x, y: P.hofte.y, z: 0 } }) },
  { id: 'haand140', navn: 'i hånden, 140 cm, vippet ned mod hoften', k: (h, P) => ({ afstand: 300, hoejde: 140, cx: P.stang.x, sigte: 'maal', maal: { x: P.stang.x, y: P.hofte.y, z: 0 } }) },
  { id: 'lav45', navn: 'lavt (45 cm)', k: (h, P) => ({ afstand: 300, hoejde: 45, cx: P.stang.x }) },
  { id: 'taet2m', navn: 'tæt, 2 m', k: (h, P) => ({ afstand: 200, hoejde: h, cx: P.stang.x }) },
  { id: 'forskudt50', navn: 'vinkelret, men 50 cm ved siden af stangen', k: (h, P) => ({ afstand: 300, hoejde: h, cx: P.stang.x - 50 }) },
  { id: 'skraa5', navn: '5° skråt', k: (h, P) => ({ afstand: 300, hoejde: h, skraa: 5, cx: P.stang.x }) },
  { id: 'skraa10', navn: '10° skråt', k: (h, P) => ({ afstand: 300, hoejde: h, skraa: 10, cx: P.stang.x }) },
  { id: 'skraaM10', navn: '10° skråt til den anden side', k: (h, P) => ({ afstand: 300, hoejde: h, skraa: -10, cx: P.stang.x }) },
  { id: 'skraa20', navn: '20° skråt', k: (h, P) => ({ afstand: 300, hoejde: h, skraa: 20, cx: P.stang.x }) },
];
function i3D(P, loeft, ekstra = {}) {
  const d = DYBDE[loeft];
  const Q = {};
  for (const id of IDS) Q[id] = ekstra[id] || { x: P[id].x, y: P[id].y, z: d[id] };
  Q.stangFjern = ekstra.stangFjern || { x: P.stang.x, y: P.stang.y, z: -d.stang };
  return Q;
}
const foto = (Q, kam, { nav = true } = {}) => { const u = Object.fromEntries(Object.entries(Q).map(([k, p]) => [k, kam(p)])); if (!nav) delete u.stangFjern; return u; };

// --- klikfejl -----------------------------------------------------------------------
let seed = 548;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const gauss = () => { let u = 0; while (u === 0) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };
function stoej(klik, cmPrPx, sd) {
  if (!sd) return klik;
  const ud = {};
  for (const [id, p] of Object.entries(klik)) { const s = (sd[id] ?? 0.5) / cmPrPx; ud[id] = { x: p.x + gauss() * s, y: p.y + gauss() * s }; }
  return ud;
}
// Siden i node: skala fra kroppens laengder, knaefasen som siden, uden Min krop.
function genkend(klik, faseId, ref, L, o = {}) {
  const m = maal(klik, { fase: faseId, cmPrPx: skalaFraKrop(klik, L) });
  return genkendFejl(m, ref, { knaeFase: knaeFaseTjek(m), ...o });
}
// Svaret som en kort noegle: fejlens id, 'ingen' (linjen "Ligner ingen") eller 'ikke:<grund>'.
const svar = (g) => (g.status === 'ligner' ? g.regel.id : g.status === 'ingen' ? 'ingen' : g.status === 'ingen-regel' ? 'ingen-regel' : `ikke:${g.grund}`);
const erIkke = (k) => k.startsWith('ikke:');
const sumIkke = (t) => Object.entries(t).filter(([k]) => erIkke(k)).reduce((a, [, v]) => a + v, 0);

const KB = KROPPE.map((k) => {
  const b = kropsBilleder(k);
  const L = Object.fromEntries(FASER.map((f) => [f, modelFase(f, ind(LOEFT[f], k.h, k.v, k.pct)).L]));
  return { k, b, L };
});

function fordeling(billeder, faseId, kamF, sd, N, { nav = true } = {}) {
  const t = {};
  let n = 0;
  for (const { P, ref, L } of billeder) {
    const loeft = LOEFT[faseId];
    const kam = kamera(kamF(KAMHOEJDE[loeft], P));
    const klik = foto(i3D(P, loeft), kam, { nav });
    const k = skalaFraKrop(klik, L);
    for (let i = 0; i < (sd ? N : 1); i++) { const s = svar(genkend(stoej(klik, k, sd), faseId, ref, L)); t[s] = (t[s] || 0) + 1; n++; }
  }
  return { n, t };
}
const N = 60;

// --- A: alle regler, alle pladser ------------------------------------------------------
const A = { kameraer: KAMERAER.map((c) => ({ id: c.id, navn: c.navn })), N, regler: {} };
for (const regel of FEJL_REGLER) {
  const f = regel.fase;
  const normal = KB.flatMap(({ b, L }) => b.normal[f].map((x) => ({ ...x, L: L[f] })));
  const fejl = KB.flatMap(({ b, L }) => b.fejl[regel.id].map((x) => ({ ...x, L: L[f] })));
  const r = (A.regler[regel.id] = { fase: f, titel: regel.titel, kamera: {} });
  for (const c of KAMERAER) {
    const rk = (r.kamera[c.id] = {});
    const n0 = fordeling(normal, f, c.k, null, 1), f0 = fordeling(fejl, f, c.k, null, 1);
    rk.udenKlik = { falskAlarm: pct(n0.t[regel.id] || 0, n0.n), fundet: pct(f0.t[regel.id] || 0, f0.n), fejlSvar: f0.t };
    for (const [sdNavn, sd] of Object.entries(KLIKFEJL)) {
      const nn = fordeling(normal, f, c.k, sd, N), ff = fordeling(fejl, f, c.k, sd, N);
      rk[sdNavn] = {
        falskAlarm: pct(nn.t[regel.id] || 0, nn.n),
        overset: pct(ff.n - (ff.t[regel.id] || 0), ff.n),
        // Den rigtige fejlfigur faar linjen "Ligner ingen af modellens fejlfigurer over maalefejlen."
        fejlMedIngenLinje: pct(ff.t.ingen || 0, ff.n),
        fejlIkkeTjekket: pct(sumIkke(ff.t), ff.n),
        normalIkkeTjekket: pct(sumIkke(nn.t), nn.n),
        normalIngenLinje: pct(nn.t.ingen || 0, nn.n),
      };
    }
    // Uden det fjerne nav (kun omhyggelige klik): hvad staar der?
    const nu = fordeling(normal, f, c.k, KLIKFEJL.omhyggelig, N, { nav: false }), fu = fordeling(fejl, f, c.k, KLIKFEJL.omhyggelig, N, { nav: false });
    rk.udenNav = { falskAlarm: pct(nu.t[regel.id] || 0, nu.n), fundet: pct(fu.t[regel.id] || 0, fu.n), normalIkkeTjekket: pct(sumIkke(nu.t), nu.n), fejlIngenLinje: pct(fu.t.ingen || 0, fu.n) };
  }
}

// --- D: L1, doedloeftets egen bane over gulvet fra alle pladser ------------------------
const D = { cm: [0, 2, 5, 8, 10, 12, 14, 16, 18, 20], kamera: {} };
for (const c of KAMERAER) {
  D.kamera[c.id] = {};
  for (const cm of D.cm) {
    const liste = KB.map(({ b, L }) => {
      const g = b.normal['dl-gulv'][0].P, kn = b.normal['dl-knae'][0].P;
      const t = cm / (kn.stang.y - g.stang.y);
      const P = Object.fromEntries(IDS.map((id) => [id, { x: g[id].x + t * (kn[id].x - g[id].x), y: g[id].y + t * (kn[id].y - g[id].y) }]));
      return { P, ref: g, L: L['dl-gulv'] };
    });
    const o = fordeling(liste, 'dl-gulv', c.k, KLIKFEJL.omhyggelig, N), ty = fordeling(liste, 'dl-gulv', c.k, KLIKFEJL.typisk, N);
    const u = fordeling(liste, 'dl-gulv', c.k, KLIKFEJL.omhyggelig, N, { nav: false });
    D.kamera[c.id][cm] = { omhyggelig: pct(o.t['dl-hofte-foerst'] || 0, o.n), typisk: pct(ty.t['dl-hofte-foerst'] || 0, ty.n), omhIngen: pct(o.t.ingen || 0, o.n), omhIkke: pct(sumIkke(o.t), o.n), udenNavLigner: pct(u.t['dl-hofte-foerst'] || 0, u.n), udenNavIkke: pct(sumIkke(u.t), u.n) };
  }
}
D.maksOmh = Math.max(...Object.values(D.kamera).flatMap((k) => Object.values(k).map((x) => x.omhyggelig)));
D.maksTyp = Math.max(...Object.values(D.kamera).flatMap((k) => Object.values(k).map((x) => x.typisk)));

// --- H: sko med hael (537) ---------------------------------------------------------------
const H = { haele: [0, 1, 2, 2.5, 3], kameraer: ['vinkelret', 'haand140', 'skraa10'], samme: {}, flad: {}, highbar: {} };
for (const kid of H.kameraer) {
  const c = KAMERAER.find((x) => x.id === kid);
  H.samme[kid] = {}; H.flad[kid] = {};
  for (const hc of H.haele) {
    H.samme[kid][hc] = {}; H.flad[kid][hc] = {};
    for (const [maalTil, refH] of [[H.samme[kid][hc], hc], [H.flad[kid][hc], 0]]) {
      const saet = KB.map(({ k, L }) => ({ b: squatBilleder(ind('squat', k.h, k.v, k.pct), undefined, { haele: hc, refHaele: refH }), L }));
      for (const regel of FEJL_REGLER.filter((r) => r.fase.startsWith('squat'))) {
        const f = regel.fase;
        const normal = saet.flatMap(({ b, L }) => b.normal[f].map((x) => ({ ...x, L: L[f] })));
        const fejl = saet.flatMap(({ b, L }) => b.fejl[regel.id].map((x) => ({ ...x, L: L[f] })));
        const nn = fordeling(normal, f, c.k, KLIKFEJL.omhyggelig, N), ff = fordeling(fejl, f, c.k, KLIKFEJL.omhyggelig, N);
        const nt = fordeling(normal, f, c.k, KLIKFEJL.typisk, N);
        maalTil[regel.id] = { falskAlarm: pct(nn.t[regel.id] || 0, nn.n), falskAlarmTyp: pct(nt.t[regel.id] || 0, nt.n), overset: pct(ff.n - (ff.t[regel.id] || 0), ff.n), fejlIngenLinje: pct(ff.t.ingen || 0, ff.n) };
      }
    }
  }
}
// Yantras spoergsmaal 2 omvendt: loefteren i sko holder torsoen og lader skinnebenet staa (billedet = fladt
// fodtoejs stilling), men feltet siger c cm. Siger siden saa noget?
H.omvendt = {};
for (const hc of [1, 2, 3]) {
  H.omvendt[hc] = {};
  const saet = KB.map(({ k, L }) => ({ b: squatBilleder(ind('squat', k.h, k.v, k.pct), undefined, { haele: 0, refHaele: hc }), L }));
  for (const regel of FEJL_REGLER.filter((r) => r.fase.startsWith('squat'))) {
    const f = regel.fase;
    const normal = saet.flatMap(({ b, L }) => b.normal[f].map((x) => ({ ...x, L: L[f] })));
    const nn = fordeling(normal, f, KAMERAER[0].k, KLIKFEJL.omhyggelig, N);
    H.omvendt[hc][regel.id] = { falskAlarm: pct(nn.t[regel.id] || 0, nn.n), ikke: pct(sumIkke(nn.t), nn.n) };
  }
}
// High bar i sko: modellens high bar med hael h, feltet paa h (siden kender kun low bar) eller 0.
for (const hc of [0, 2]) {
  H.highbar[hc] = {};
  for (const felt of [0, hc]) {
    const t = {}; let n = 0;
    for (const { k, L } of KB) {
      for (const f of ['squat-bund', 'squat-midt']) {
        const I = { ...ind('squat', k.h, k.v, k.pct), stang: 'highbar', haele: hc };
        const mf = modelFase(f, I);
        if (!mf.feasible) continue;
        const ref = modelFase(f, { ...ind('squat', k.h, k.v, k.pct), haele: felt }).punkter;
        const klik = foto(i3D(mf.punkter, 'squat'), kamera({ afstand: 300, hoejde: 80, cx: mf.punkter.stang.x }));
        const kk = skalaFraKrop(klik, L[f]);
        for (let i = 0; i < N; i++) { const s = svar(genkend(stoej(klik, kk, KLIKFEJL.omhyggelig), f, ref, L[f])); const key = `${f}:${s}`; t[key] = (t[key] || 0) + 1; }
        n += N;
      }
    }
    H.highbar[hc][felt] = Object.fromEntries(Object.entries(t).map(([kk, v]) => [kk, pct(v, n / 2)]));
  }
}
// Hvor meget flytter hael modellens bund (178 cm): skinneben/torso.
{
  const I = ind('squat', 178, 85);
  H.forskydning = {};
  for (const hc of H.haele) {
    const t0 = fejlTal(modelFase('squat-bund', I).punkter), t = fejlTal(modelFase('squat-bund', { ...I, haele: hc }).punkter);
    H.forskydning[hc] = { skinneben: r1(t.skinneben - t0.skinneben), torso: r1(t.torso - t0.torso) };
  }
}

// --- T: taeer ud ---------------------------------------------------------------------------
const drej = (v, k, t) => add(add(mul(v, Math.cos(t)), mul(cross(k, v), Math.sin(t))), mul(k, dot(k, v) * (1 - Math.cos(t))));
// T1 (536): knaeet drejet ud mod kameraet om linjen hofte-ankel.
function t1(P, loeft, grader) {
  const d = DYBDE[loeft];
  const A3 = { x: P.ankel.x, y: P.ankel.y, z: d.ankel }, H3 = { x: P.hofte.x, y: P.hofte.y, z: d.hofte }, K3 = { x: P.knae.x, y: P.knae.y, z: d.knae };
  const akse = norm(sub(H3, A3));
  const t = (grader * Math.PI) / 180;
  let K = add(A3, drej(sub(K3, A3), akse, t));
  if (K.z > K3.z) K = add(A3, drej(sub(K3, A3), akse, -t));
  return i3D(P, loeft, { knae: K });
}
// T2: hele benet (knae, ankel, midtfod) drejet om en lodret akse gennem hoften, ud mod kameraet.
function t2(P, loeft, grader) {
  const d = DYBDE[loeft];
  const t = (grader * Math.PI) / 180;
  const H3 = { x: P.hofte.x, y: P.hofte.y, z: d.hofte };
  const rot = (id) => { const p = { x: P[id].x, y: P[id].y, z: d[id] }; const dx = p.x - H3.x; return { x: H3.x + dx * Math.cos(t), y: p.y, z: p.z - Math.abs(dx) * Math.sin(t) }; };
  return i3D(P, loeft, { knae: rot('knae'), ankel: rot('ankel'), midtfod: rot('midtfod') });
}
const T = { grader: [0, 10, 20, 30, 40], t1: {}, t2: {}, tal: {}, linjer: {} };
for (const [navn, fn] of [['t1', t1], ['t2', t2]]) {
  T.tal[navn] = {};
  for (const f of ['squat-bund', 'squat-midt']) {
    const kam = (P) => kamera({ afstand: 300, hoejde: 80, cx: P.stang.x });
    T[navn][f] = {}; T.tal[navn][f] = {};
    for (const g of T.grader) {
      const tael = (billeder) => { const t = {}; let n = 0; for (const { P, ref, L } of billeder) { const klik = foto(fn(P, 'squat', g), kam(P)); const k = skalaFraKrop(klik, L); for (let i = 0; i < N; i++) { const gg = genkend(stoej(klik, k, KLIKFEJL.omhyggelig), f, ref, L); const s = svar(gg); t[s] = (t[s] || 0) + 1; n++; if (erIkke(s)) T.linjer[s] = stilleLinje(gg); } } return Object.fromEntries(Object.entries(t).map(([k, v]) => [k, pct(v, n)])); };
      const normal = KB.flatMap(({ b, L }) => b.normal[f].map((x) => ({ ...x, L: L[f] })));
      const fejl = Object.fromEntries(FEJL_REGLER.filter((r) => r.fase === f).map((r) => [r.id, tael(KB.flatMap(({ b, L }) => b.fejl[r.id].map((x) => ({ ...x, L: L[f] }))))]));
      T[navn][f][g] = { normal: tael(normal), fejl };
      const { b, L } = KB[0];
      const x = b.normal[f][0];
      const klik = foto(fn(x.P, 'squat', g), kam(x.P));
      const m = maal(klik, { fase: f, cmPrPx: skalaFraKrop(klik, L[f]) });
      const ft = fejlTal(m.model), fr = fejlTal(x.ref);
      T.tal[navn][f][g] = { skinneben: r1(ft.skinneben - fr.skinneben), torso: r1(ft.torso - fr.torso), knae: r1(ft.knae - fr.knae) };
    }
  }
}

// --- K: skraat kamera, sidens skoen af vinklen ---------------------------------------------
const K = { skraa: {}, forskudt: {}, taeer: {} };
{
  const { b, L } = KB[0];
  const x = b.normal['squat-bund'][0];
  const skoen = (klik) => { const m = maal(klik, { fase: 'squat-bund', cmPrPx: skalaFraKrop(klik, L['squat-bund']) }); const s = skraatKamera(m); return s ? { grader: r1(s.grader), navCm: r1(s.navCm), hint: s.over } : null; };
  for (const afstand of [300, 400]) {
    K.skraa[afstand] = {};
    for (const th of [0, 3, 5, 7, 10, 15, 20]) K.skraa[afstand][th] = skoen(foto(i3D(x.P, 'squat'), kameraDrejet({ afstand, hoejde: 80, skraa: th, cx: x.P.stang.x })));
  }
  for (const off of [0, 25, 50, 100]) K.forskudt[off] = { 300: skoen(foto(i3D(x.P, 'squat'), kamera({ afstand: 300, hoejde: 80, cx: x.P.stang.x - off }))), 400: skoen(foto(i3D(x.P, 'squat'), kamera({ afstand: 400, hoejde: 80, cx: x.P.stang.x - off }))) };
  // Hvor meget flytter vinklerne sig ved 50 cm forskudt (ingen drejning)? og ved 5 grader drejet?
  const vink = (klik) => { const m = maal(klik, { fase: 'squat-bund', cmPrPx: skalaFraKrop(klik, L['squat-bund']) }); const a = fejlTal(m.model), r = fejlTal(x.ref); return { skinneben: r1(a.skinneben - r.skinneben), torso: r1(a.torso - r.torso), knae: r1(a.knae - r.knae) }; };
  K.vinkler = { forskudt50: vink(foto(i3D(x.P, 'squat'), kamera({ afstand: 300, hoejde: 80, cx: x.P.stang.x - 50 }))), drejet5: vink(foto(i3D(x.P, 'squat'), kameraDrejet({ afstand: 300, hoejde: 80, skraa: 5, cx: x.P.stang.x }))), drejet10: vink(foto(i3D(x.P, 'squat'), kameraDrejet({ afstand: 300, hoejde: 80, skraa: 10, cx: x.P.stang.x }))) };
  // Navenes halve afstand: min stang har navene 70 cm ude (squat); siden regner med 80.
  K.navHalvCm = { mine: 70, siden: FJ.NAV_HALV_CM };
}

// --- E: Marcs klip ---------------------------------------------------------------------------
const MINE = {
  start: { stang: { x: 441, y: 828 }, midtfod: { x: 430, y: 948 }, ankel: { x: 400, y: 905 }, knae: { x: 447, y: 668 }, hofte: { x: 343, y: 583 }, skulder: { x: 470, y: 460 } },
  knaehoejde: { stang: { x: 434, y: 768 }, midtfod: { x: 427, y: 942 }, ankel: { x: 398, y: 905 }, knae: { x: 445, y: 640 }, hofte: { x: 340, y: 553 }, skulder: { x: 460, y: 418 } },
};
const E = {};
{
  const KK = kroppe('doedloeft', null, { hoejde: '183', vaegt: '120', stangKg: 270 });
  for (const [navn, klik, f] of [
    ['yantra-gulv', MARC_GULV, 'dl-gulv'], ['yantra-gulv-to-nav', { ...MARC_GULV, stangFjern: FJERNT_NAV }, 'dl-gulv'], ['bhishak-gulv', MINE.start, 'dl-gulv'],
    ['yantra-knae', MARC_KNAE, 'dl-knae'], ['bhishak-knae', MINE.knaehoejde, 'dl-knae'],
  ]) {
    const mf = modelFase(f, KK.snit);
    const g = genkend(klik, f, mf.punkter, mf.L);
    E[navn] = { status: g.status, regel: g.regel?.id || null, grund: g.grund, linje: stilleLinje(g) };
  }
}

// --- F: saetningerne og linjerne -------------------------------------------------------------
const FORBUDT = ['muskel', 'stærk', 'svag', 'bedre', 'dårlig', 'forkert', 'skade', 'farlig', 'Nm', 'risiko', 'du ', 'skal ', 'bør ', 'undgå', 'problem', 'korrekt', 'fejlfri', 'godkend'];
const F = { saetninger: [], linjer: {} };
for (const { k, b, L } of KB) {
  for (const regel of FEJL_REGLER) {
    for (const x of b.fejl[regel.id]) {
      const klik = foto(i3D(x.P, LOEFT[regel.fase]), kamera({ afstand: 300, hoejde: KAMHOEJDE[LOEFT[regel.fase]], cx: x.P.stang.x }));
      for (const minKrop of [false, true]) {
        const g = genkend(klik, regel.fase, x.ref, L[regel.fase], { minKrop });
        if (g.status === 'ligner' && g.regel.id === regel.id) F.saetninger.push({ krop: k.navn, regel: regel.id, minKrop, saetning: g.saetning, ord: g.saetning.split(/\s+/).length, forbudt: FORBUDT.filter((w) => g.saetning.toLowerCase().includes(w.toLowerCase())) });
      }
    }
  }
}
F.unikke = [...new Set(F.saetninger.map((s) => s.saetning.replace(/\d+/g, '#')))];
F.maxOrd = Math.max(...F.saetninger.map((s) => s.ord));
F.medForbudt = F.saetninger.filter((s) => s.forbudt.length).map((s) => ({ regel: s.regel, forbudt: s.forbudt }));
F.letterHaelen = F.saetninger.filter((s) => /letter hælen/.test(s.saetning)).length;
F.gennemsnit = F.saetninger.filter((s) => !s.minKrop && /gennemsnittet for din højde/.test(s.saetning)).length;
F.sammeKrop = F.saetninger.filter((s) => s.minKrop && /samme krop/.test(s.saetning)).length;
F.ingenLinje = INGEN_LINJE;
F.stilleForGrunde = { ...T.linjer };

// Hvad tjekker "Ligner ingen" egentlig? Antal regler pr. fase (af modellens fejlbilleder).
F.reglerPrFase = Object.fromEntries(FASER.map((f) => [f, FEJL_REGLER.filter((r) => r.fase === f).map((r) => r.titel)]));

const ud = { ref: SHA, A, D, H, T, K, E, F };
fs.writeFileSync(path.join(UD, 'fejl-548.json'), JSON.stringify(ud, null, 1));

// --- kort udskrift ---
console.log(`dhruva ${SHA}, N=${N} pr. billede`);
for (const [id, r] of Object.entries(A.regler)) {
  console.log(`\n${id} (${r.fase})`);
  for (const c of KAMERAER) { const x = r.kamera[c.id]; console.log(`  ${c.id.padEnd(10)} uk fa ${x.udenKlik.falskAlarm} fu ${x.udenKlik.fundet} | omh fa ${x.omhyggelig.falskAlarm} ov ${x.omhyggelig.overset} (ingen-linje ${x.omhyggelig.fejlMedIngenLinje}, ikke ${x.omhyggelig.fejlIkkeTjekket}; normal ikke ${x.omhyggelig.normalIkkeTjekket}) | typ fa ${x.typisk.falskAlarm} ov ${x.typisk.overset} ingen ${x.typisk.fejlMedIngenLinje} | udenNav ${JSON.stringify(x.udenNav)}`); }
}
console.log('\nD maks', D.maksOmh, D.maksTyp);
for (const [c, v] of Object.entries(D.kamera)) console.log(' ', c.padEnd(10), Object.entries(v).map(([cm, x]) => `${cm}:${x.omhyggelig}/${x.typisk}/i${x.omhIkke}/u${x.udenNavLigner}`).join(' '));
console.log('\nH samme', JSON.stringify(H.samme)); console.log('H flad', JSON.stringify(H.flad)); console.log('H highbar', JSON.stringify(H.highbar)); console.log('H omvendt', JSON.stringify(H.omvendt)); console.log('H forskydning', JSON.stringify(H.forskydning));
console.log('\nT tal', JSON.stringify(T.tal)); console.log('T1', JSON.stringify(T.t1)); console.log('T2', JSON.stringify(T.t2)); console.log('T linjer', JSON.stringify(T.linjer));
console.log('\nK', JSON.stringify(K));
console.log('\nE', JSON.stringify(E, null, 0));
console.log('\nF', F.saetninger.length, 'saetninger, max ord', F.maxOrd, 'forbudt', JSON.stringify(F.medForbudt), 'letter haelen', F.letterHaelen, 'gennemsnit', F.gennemsnit, 'samme krop', F.sammeKrop); for (const s of F.unikke) console.log('  -', s);
console.log('regler pr fase', JSON.stringify(F.reglerPrFase));
