// Kritik 558, blok 1: fejlgenkendelsen efter Yantras 545, 549 og 554 mod entropi-loeftmodel-dhruva
// main (346f791). Mit 548-script med Yantras to rettelser fra 549 (feltets hael sendes til genkendFejl,
// 'hint' taelles for sig; outputs/549/bhishak/fejl-549.mjs), udvidet med:
//
//   node outputs/kritik-558/fejl-558.mjs
//
// Loeftmodellen hentes med git archive til en midlertidig mappe; intet trae roeres. Skriver
// outputs/kritik-558/fejl-558.json. Kun syntetiske punkter (modellens egne stillinger og fejlfigurer,
// tegnet i 3D og fotograferet med mit pinhole-kamera) og Marcs egne klik fra 462/494/498.
//
// A  ti kamerapladser fra 548: falsk alarm, overset, og hvor ofte en rigtig fejlfigur faar den stille
//    linje ("Ligner ikke ..."). L  linjens egne tal mod mine (hvad lover den, hvad sker der).
// D  doedloeftets bane over gulvet (gulvvagten 0,04 fra 545).
// H  sko med hael: samme hael, feltet paa 0, omvendt (torsoen holdt) og halvvejs; hint og dom.
// T  taeer ud (T1, T2). K  skraat og forskudt kamera, hintets tekst. E  Marcs klip. F  saetningerne.
// S  sumo mod sidens sumomodel med mine dybder (knaeet og foden 10 cm ud/ind, smal og bred) og mine
//    kameraer, inkl. 2-5 grader skraat og 25 cm forskudt; og en traener der filmer i haanden
//    (vinklen og pladsen spredt): hvor tit tjekkes sumo overhovedet?
// B  baenkens bue: Yantras vip (554), 545's lodrette loeft, halvt af hver og vip med skuldrene trukket
//    3 cm ned mod hofterne; falsk "stangen for hoejt", overset og "ikke tjekket".

import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

const DHRUVA = 'C:/Users/Entropi/Desktop/entropi-loeftmodel-dhruva';
const REF = process.argv[2] || 'main';
const SHA = execSync(`git -C ${DHRUVA} rev-parse --short ${REF}`).toString().trim();
const LM = path.join(tmpdir(), `kritik-558-loeftmodel-${SHA}`);
if (!fs.existsSync(path.join(LM, 'dist', 'maal-billede', 'index.html'))) {
  fs.rmSync(LM, { recursive: true, force: true }); fs.mkdirSync(LM, { recursive: true });
  execSync(`git -C ${DHRUVA} archive ${SHA} src dist scripts kroppe docs outputs/videomaal outputs/507 outputs/514 outputs/520 package.json | tar -x -C "${LM.replace(/\\/g, '/')}"`, { shell: 'bash' });
}
const imp = (f) => import(pathToFileURL(path.join(LM, f)).href);
const { maal, skalaFraKrop, knaeFaseTjek, fraLodret, indvendigVinkel } = await imp('src/maalBillede.js');
const { kroppe, modelFase } = await imp('src/maalBilledeModel.js');
const { indstilling } = await imp('src/minKrop.js');
const FJ = await imp('src/maalBilledeFejl.js');
const { genkendFejl, FEJL_REGLER, stilleLinje, skraatKamera, fejlTal, ingenLinjeFor, hintLinje, OVERSET, OVERSET_SUMO } = FJ;
const LV = await imp('src/loeftVirkelighed.js');
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
let seed = 558;
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
  return genkendFejl(m, ref, { knaeFase: knaeFaseTjek(m), haele: FELT, ...o });
}
// Svaret som en kort noegle: fejlens id, 'ingen' (linjen "Ligner ingen") eller 'ikke:<grund>'.
let FELT = 0; // Yantra 549: feltet "Sko med hæle", som siden sender det
const svar = (g) => (g.status === 'ligner' ? g.regel.id : g.status === 'hint' ? `hint:${g.regel.id}` : g.status === 'ingen' ? 'ingen' : g.status === 'ingen-regel' ? 'ingen-regel' : `ikke:${g.grund}`);
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
      FELT = refH;
      const saet = KB.map(({ k, L }) => ({ b: squatBilleder(ind('squat', k.h, k.v, k.pct), undefined, { haele: hc, refHaele: refH }), L }));
      for (const regel of FEJL_REGLER.filter((r) => r.fase.startsWith('squat'))) {
        const f = regel.fase;
        const normal = saet.flatMap(({ b, L }) => b.normal[f].map((x) => ({ ...x, L: L[f] })));
        const fejl = saet.flatMap(({ b, L }) => b.fejl[regel.id].map((x) => ({ ...x, L: L[f] })));
        const nn = fordeling(normal, f, c.k, KLIKFEJL.omhyggelig, N), ff = fordeling(fejl, f, c.k, KLIKFEJL.omhyggelig, N);
        const nt = fordeling(normal, f, c.k, KLIKFEJL.typisk, N);
        maalTil[regel.id] = { hintFejl: pct(ff.t['hint:' + regel.id] || 0, ff.n), hintNormal: pct(nn.t['hint:' + regel.id] || 0, nn.n), falskAlarm: pct(nn.t[regel.id] || 0, nn.n), falskAlarmTyp: pct(nt.t[regel.id] || 0, nt.n), overset: pct(ff.n - (ff.t[regel.id] || 0), ff.n), fejlIngenLinje: pct(ff.t.ingen || 0, ff.n) };
      }
    }
  }
}
FELT = 0;
// Yantras spoergsmaal 2 omvendt: loefteren i sko holder torsoen og lader skinnebenet staa (billedet = fladt
// fodtoejs stilling), men feltet siger c cm. Siger siden saa noget?
// 558: ogsaa halvvejs (billedet med den halve hael i modellens ankelboejning, feltet paa hele), 2,5 cm,
// typiske klik, og den rigtige fejlfigur "hoften tilbage" i sko: dom, hint eller den stille linje?
H.omvendt = {}; H.halvvejs = {};
for (const [maade, billedeHael] of [['omvendt', () => 0], ['halvvejs', (hc) => hc / 2]]) {
  for (const hc of [1, 1.5, 2, 2.5, 3]) {
    H[maade][hc] = {}; FELT = hc;
    const saet = KB.map(({ k, L }) => ({ b: squatBilleder(ind('squat', k.h, k.v, k.pct), undefined, { haele: billedeHael(hc), refHaele: hc }), L }));
    for (const regel of FEJL_REGLER.filter((r) => r.fase.startsWith('squat'))) {
      const f = regel.fase;
      const normal = saet.flatMap(({ b, L }) => b.normal[f].map((x) => ({ ...x, L: L[f] })));
      const nn = fordeling(normal, f, KAMERAER[0].k, KLIKFEJL.omhyggelig, N), nt = fordeling(normal, f, KAMERAER[0].k, KLIKFEJL.typisk, N);
      H[maade][hc][regel.id] = { falskAlarm: pct(nn.t[regel.id] || 0, nn.n), falskAlarmTyp: pct(nt.t[regel.id] || 0, nt.n), ikke: pct(sumIkke(nn.t), nn.n), hint: pct(nn.t['hint:' + regel.id] || 0, nn.n), hintTyp: pct(nt.t['hint:' + regel.id] || 0, nt.n) };
    }
  }
}
// High bar i sko: modellens high bar med hael h, feltet paa h (siden kender kun low bar) eller 0.
for (const hc of [0, 2]) {
  H.highbar[hc] = {};
  for (const felt of [0, hc]) {
    FELT = felt;
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
FELT = 0;
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
F.ingenLinje = ingenLinjeFor('squat-midt');
F.stilleForGrunde = { ...T.linjer };

// Hvad tjekker "Ligner ingen" egentlig? Antal regler pr. fase (af modellens fejlbilleder).
F.reglerPrFase = Object.fromEntries(FASER.map((f) => [f, FEJL_REGLER.filter((r) => r.fase === f).map((r) => r.titel)]));

// --- L: hvad linjen "Ligner ikke ..." lover, mod det mine kameraer og klik maaler -------------------
const L558 = { linjer: {}, regler: {} };
const ordTal = (t) => (t ? t.split(/\s+/).filter(Boolean).length : 0);
for (const f of FASER) {
  const v = { flad: ingenLinjeFor(f) };
  if (f.startsWith('squat')) v.sko2 = ingenLinjeFor(f, { haele: 2 });
  if (f.startsWith('dl-')) v.sumo = ingenLinjeFor(f, { stil: 'sumo' });
  L558.linjer[f] = Object.fromEntries(Object.entries(v).map(([k, t]) => [k, { tekst: t, ord: ordTal(t), tegn: t.length }]));
}
{
  const r = FEJL_REGLER.find((x) => x.id === 'sq-hofte-tilbage-bund');
  const t = hintLinje({ regel: r, haele: 2 });
  L558.hint = { tekst: t, ord: ordTal(t), tegn: t.length };
}
for (const regel of FEJL_REGLER) {
  const lovet = Math.max(...regel.figurer.map((fg) => OVERSET[fg.id]?.pct ?? 0));
  const m = A.regler[regel.id].kamera;
  L558.regler[regel.id] = {
    fase: regel.fase, lovet,
    maalt: Object.fromEntries(['vinkelret', 'haand140', 'lav45', 'taet2m', 'forskudt50', 'skraa5', 'skraa10', 'skraaM10'].map((c) => [c, { omh: m[c].omhyggelig.overset, typ: m[c].typisk.overset, stilleOmh: m[c].omhyggelig.fejlMedIngenLinje, stilleTyp: m[c].typisk.fejlMedIngenLinje }])),
  };
}

// --- S: sumo mod sidens sumomodel med mine dybder, kameraer og klik ----------------------------
const NS = 40;
const SUMO_VAR = { yantra: {}, knaeUd10: { knae: -10 }, knaeInd10: { knae: 10 }, smal10: { knae: 10, ankel: 10, midtfod: 10 }, bred10: { knae: -10, ankel: -10, midtfod: -10 } };
const flyt = (Q, v) => { const R = { ...Q }; for (const [id, dz] of Object.entries(v)) R[id] = { ...Q[id], z: Q[id].z + dz }; return R; };
const skr = (g) => ({ id: `skraa${g}`, k: (h, P) => ({ afstand: 300, hoejde: h, skraa: g, cx: P.stang.x }) });
const SK = [...KAMERAER.filter((c) => ['vinkelret', 'hoej30', 'haand140', 'lav45', 'taet2m', 'forskudt50', 'skraa10', 'skraaM10'].includes(c.id)), { id: 'forskudt25', k: (h, P) => ({ afstand: 300, hoejde: h, cx: P.stang.x - 25 }) }, skr(2), skr(-2), skr(3), skr(-3), skr(4), skr(-4), skr(5), skr(-5)];
const SUMO_KB = KROPPE.map((k) => LV.dlBilleder(k, 'sumo', 'sumo'));
const SREG = { 'dl-hofte-foerst': 'dl-gulv', 'dl-stang-frem': 'dl-knae' };
const S = { N: NS, varianter: SUMO_VAR, kameraer: SK.map((c) => c.id), res: {} };
let sfroe = 5580;
for (const [vn, v] of Object.entries(SUMO_VAR)) {
  S.res[vn] = {};
  for (const c of SK) {
    S.res[vn][c.id] = {};
    for (const [sdNavn, sd] of Object.entries(KLIKFEJL)) {
      const g = FM.gauss(sfroe++);
      const r = {};
      for (const [id, f] of Object.entries(SREG)) {
        const normal = SUMO_KB.flatMap((b) => b.normal[f].map((x) => ({ ...x, Q: flyt(x.Q, v) })));
        const fejl = SUMO_KB.flatMap((b) => b.fejl[id].map((x) => ({ ...x, Q: flyt(x.Q, v) })));
        const prStilling = {};
        let nn = 0, fa = 0, ik = 0, ikF = 0;
        for (const x of normal) {
          const a = LV.fordeling3D([x], f, c, 'doedloeft', { sd, N: NS, g, stil: 'sumo' });
          const p = (prStilling[x.navn] = prStilling[x.navn] || { n: 0, fa: 0 });
          p.n += a.n; p.fa += a.t[id] || 0;
          nn += a.n; fa += a.t[id] || 0; ik += a.t['usikker-kamera'] || 0; ikF += a.t['usikker-fase'] || 0;
        }
        const ff = LV.fordeling3D(fejl, f, c, 'doedloeft', { sd, N: NS, g, stil: 'sumo' });
        const maks = Object.entries(prStilling).reduce((m, [navn, p]) => (pct(p.fa, p.n) > m.pct ? { navn, pct: pct(p.fa, p.n) } : m), { navn: null, pct: 0 });
        r[id] = { falskAlarm: pct(fa, nn), falskMaks: maks, overset: pct(ff.n - (ff.t[id] || 0), ff.n), fejlStille: pct(ff.t.ingen || 0, ff.n), fejlIkke: pct((ff.t['usikker-kamera'] || 0) + (ff.t['usikker-fase'] || 0), ff.n), normalIkkeKamera: pct(ik, nn), normalIkkeFase: pct(ikF, nn) };
      }
      S.res[vn][c.id][sdNavn] = r;
    }
  }
}
// En traener, der filmer i haanden: vinklen ~ N(0, sg) grader og pladsen ~ N(0, so) cm ved siden af stangen.
// Hvor tit tjekkes sumo ved knaehoejde (modellens egen stilling i knaehoejde og fejlfiguren), mod konventionel?
S.film = {};
const KONV_KB = KROPPE.map((k) => LV.dlBilleder(k, 'konventionel'));
for (const [navn, sg, so] of [['stativ', 1, 5], ['roligt', 2, 10], ['almindeligt', 4, 20], ['hurtigt', 6, 30]]) {
  const g = FM.gauss(5590), gk = FM.gauss(5591);
  const t = { sumo: { n: 0, tjekket: 0, fejlN: 0, fejlFundet: 0 }, konv: { n: 0, tjekket: 0, fejlN: 0, fejlFundet: 0 } };
  for (let i = 0; i < 200; i++) {
    const th = gk() * sg, off = gk() * so;
    const c = { k: (h, P) => ({ afstand: 300, hoejde: h, skraa: th, cx: P.stang.x - off }) };
    for (const [stil, kb] of [['sumo', SUMO_KB], ['konv', KONV_KB]]) {
      const st = stil === 'sumo' ? 'sumo' : 'konventionel';
      for (const b of kb) {
        const x = b.normal['dl-knae'].find((y) => /knæhøjde 0/.test(y.navn));
        const a = LV.fordeling3D([x], 'dl-knae', c, 'doedloeft', { sd: KLIKFEJL.typisk, N: 1, g, stil: st });
        t[stil].n++; if (!a.t['usikker-kamera']) t[stil].tjekket++;
        const e = LV.fordeling3D(b.fejl['dl-stang-frem'], 'dl-knae', c, 'doedloeft', { sd: KLIKFEJL.typisk, N: 1, g, stil: st });
        t[stil].fejlN += e.n; t[stil].fejlFundet += e.t['dl-stang-frem'] || 0;
      }
    }
  }
  S.film[navn] = { sg, so, sumoTjekket: pct(t.sumo.tjekket, t.sumo.n), sumoFundet: pct(t.sumo.fejlFundet, t.sumo.fejlN), konvTjekket: pct(t.konv.tjekket, t.konv.n), konvFundet: pct(t.konv.fejlFundet, t.konv.fejlN) };
}
// Navenes afstand i cm (sidens skala) for modellens sumo i knaehoejde, 178 cm, uden klikfejl, pr. grad og pr. forskydning.
{
  const x = SUMO_KB[0].normal['dl-knae'].find((y) => /knæhøjde 0/.test(y.navn));
  const nav = (c) => { const klik = foto(x.Q, kamera(c.k(75, x.P))); const m = maal(klik, { fase: 'dl-knae', cmPrPx: skalaFraKrop(klik, x.L) }); return r1(m.navAfstand); };
  S.navCm = { grader: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((gr) => [gr, nav(skr(gr))])), forskudt: Object.fromEntries([10, 20, 25, 30, 40].map((o) => [o, nav({ k: (h, P) => ({ afstand: 300, hoejde: h, cx: P.stang.x - o }) })])) };
}

// --- B: baenkens bue: vip (554), lodret (545), halvt af hver, vip med skuldrene 3 cm ned ---------------
const NB = 40;
const BK = LV.KAMERAER_BAENK.filter((c) => ['baenkhoejde', 'vinkelret', 'haand140', 'forskudt50', 'skraa10'].includes(c.id));
const medP = (x, P) => ({ ...x, P, Q: i3D(P, 'baenk') });
function baenkVariant(k, bue, maade) {
  if (maade === 'vip' || maade === 'lodret') return LV.baenkBilleder(k, bue, { maade });
  const v = LV.baenkBilleder(k, maade === 'halv' ? bue / 2 : bue, { maade: 'vip' });
  const aendr = maade === 'halv'
    ? (x) => medP(x, { ...x.P, stang: { x: x.P.stang.x, y: x.P.stang.y + bue / 2 } })
    : (x) => { const s = Math.sign(x.P.midtfod.x - x.P.skulder.x); return medP(x, { ...x.P, skulder: { x: x.P.skulder.x + 3 * s, y: x.P.skulder.y } }); };
  return { normal: { 'baenk-bryst': v.normal['baenk-bryst'].map(aendr) }, fejl: { 'bp-hoejt-bryst': v.fejl['bp-hoejt-bryst'].map(aendr) }, udenfor: v.udenfor };
}
const B = { N: NB, kameraer: BK.map((c) => c.id), buer: [0, 2.5, 5, 7.5], res: {}, geometri: {} };
let bfroe = 5585;
for (const maade of ['vip', 'lodret', 'halv', 'vipNed3']) {
  B.res[maade] = {}; B.geometri[maade] = {};
  for (const bue of B.buer) {
    const saet = KROPPE.map((k) => baenkVariant(k, bue, maade));
    const normal = saet.flatMap((s) => s.normal['baenk-bryst']);
    const fejl = saet.flatMap((s) => s.fejl['bp-hoejt-bryst']);
    // Geometrien uden kamera: hvor flytter stangen sig mod skulderen?
    const d = (x, k) => fejlTal(x.P)[k] - fejlTal(x.ref)[k];
    const gs = (arr, k) => (arr.length ? r1(arr.reduce((a, x) => a + d(x, k), 0) / arr.length) : null);
    B.geometri[maade][bue] = { normalN: normal.length, udenfor: saet.reduce((a, s) => a + s.udenfor.length, 0), modFodder: gs(normal, 'stangModFodder'), overSkulder: gs(normal, 'stangOverSkulder'), overVagt: pct(normal.filter((x) => d(x, 'stangOverSkulder') > FJ.BRYST_BUE_CM).length, normal.length), modFodderMin: normal.length ? r1(Math.min(...normal.map((x) => d(x, 'stangModFodder')))) : null };
    B.res[maade][bue] = {};
    for (const c of BK) {
      B.res[maade][bue][c.id] = {};
      for (const [sdNavn, sd] of Object.entries(KLIKFEJL)) {
        const g = FM.gauss(bfroe++);
        const nn = LV.fordeling3D(normal, 'baenk-bryst', c, 'baenk', { sd, N: NB, g });
        const pr = {};
        for (const x of fejl) { const a = LV.fordeling3D([x], 'baenk-bryst', c, 'baenk', { sd, N: NB, g }); const p = (pr[x.navn] = pr[x.navn] || { n: 0, f: 0, s: 0 }); p.n += a.n; p.f += a.t['bp-hoejt-bryst'] || 0; p.s += a.t.ingen || 0; }
        B.res[maade][bue][c.id][sdNavn] = { falskAlarm: pct(nn.t['bp-hoejt-bryst'] || 0, nn.n), ikkeTjekket: pct((nn.t['usikker-fase'] || 0) + (nn.t['usikker-kamera'] || 0), nn.n), overset: Object.fromEntries(Object.entries(pr).map(([k, p]) => [k, pct(p.n - p.f, p.n)])), stille: Object.fromEntries(Object.entries(pr).map(([k, p]) => [k, pct(p.s, p.n)])) };
      }
    }
  }
}

const ud = { ref: SHA, A, D, H, T, K, E, F, L: L558, S, B };
fs.writeFileSync(path.join(UD, 'fejl-558.json'), JSON.stringify(ud, null, 1));

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
console.log('\nL', JSON.stringify(L558, null, 1));
console.log('\nH omvendt', JSON.stringify(H.omvendt)); console.log('H halvvejs', JSON.stringify(H.halvvejs));
for (const [vn, v] of Object.entries(S.res)) for (const [c, x] of Object.entries(v)) console.log('S', vn.padEnd(9), c.padEnd(11), JSON.stringify(x));
console.log('S film', JSON.stringify(S.film)); console.log('S navCm', JSON.stringify(S.navCm));
console.log('B geometri', JSON.stringify(B.geometri));
for (const [m, v] of Object.entries(B.res)) for (const [b, x] of Object.entries(v)) console.log('B', m.padEnd(7), b, JSON.stringify(x));
