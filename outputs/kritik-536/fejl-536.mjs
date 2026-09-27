// Kritik 536, blok 1: "Ligner: <fejl>" i Maal dit billede efter Yantras 520 og 535
// (entropi-loeftmodel-dhruva main @ 6d3129e), med mine egne scenarier fra 511/521/530.
//
//   node outputs/kritik-536/fejl-536.mjs
//
// Loeftmodellen hentes med git archive til en midlertidig mappe; intet trae roeres.
// Skriver outputs/kritik-536/fejl-536.json. Kun syntetiske punkter (modellens egne
// stillinger og fejlfigurer, tegnet i 3D og fotograferet med mit pinhole-kamera) og
// Marcs egne klik fra 462/494/498 (allerede i Yantras repo og i min 494).
//
// A  Kameraet: Yantras tal er et kamera vinkelret uden perspektiv. Her staar punkterne
//    i 3D (dybder som 521/530) og fotograferes fra seks pladser: vinkelret 3 m, 30 cm
//    hoejere og vippet ned, lavt (45 cm), 2 m (taet), 5 og 10 grader skraat. Falsk alarm
//    og overset pr. regel med omhyggelige og typiske klik, og hvor ofte der intet staar,
//    fordi kameraet eller fasen er usikker.
// B  Knaeene ud (taeer ud / bred fodstilling og Marcs gulvbillede): knaeet drejet ud mod
//    kameraet om linjen hofte-ankel, 0-40 grader. Hofte og ankel bliver, hvor de er.
// C  Sko med hael og high bar (squat): modellens high bar, og skinnebenet vippet a grader
//    frem om anklen (laarets retning og torsoen uaendret).
// D  Fasen valgt med oejet: squattens bund 5-15 % oppe, sticking point +-8..16 %, og
//    doedloeftet lidt efter at stangen slipper gulvet.
// E  Marcs klip: Yantras 498-klik og mine 494-klik paa gulv- og knaebilledet.
// F  Saetningerne: alle "ligner"-saetninger for fem kroppe; ord, laengde og tone.

import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

const DHRUVA = 'C:/Users/Entropi/Desktop/entropi-loeftmodel-dhruva';
const REF = process.argv[2] || 'main';
const SHA = execSync(`git -C ${DHRUVA} rev-parse --short ${REF}`).toString().trim();
const LM = path.join(tmpdir(), `kritik-536-loeftmodel-${SHA}`);
if (!fs.existsSync(path.join(LM, 'dist', 'maal-billede', 'index.html'))) {
  fs.rmSync(LM, { recursive: true, force: true }); fs.mkdirSync(LM, { recursive: true });
  execSync(`git -C ${DHRUVA} archive ${SHA} src dist scripts kroppe docs outputs/videomaal outputs/507 outputs/514 outputs/520 package.json | tar -x -C "${LM.replace(/\\/g, '/')}"`, { shell: 'bash' });
}
const imp = (f) => import(pathToFileURL(path.join(LM, f)).href);
const { maal, skalaFraKrop, knaeFaseTjek, fraLodret, indvendigVinkel } = await imp('src/maalBillede.js');
const { kroppe, modelFase } = await imp('src/maalBilledeModel.js');
const { indstilling } = await imp('src/minKrop.js');
const { beregn } = await imp('src/treLoeft.js');
const { marcsFejlSaet } = await imp('src/embed/squatFejlbilleder.js');
const { hofteFoerst } = await imp('src/doedloeftFejl.js');
const FJ = await imp('src/maalBilledeFejl.js');
const { genkendFejl, FEJL_REGLER } = FJ;
const FM = await imp('src/fejlgenkendelseMaaling.js');
const { KROPPE, KLIKFEJL, kropsBilleder } = FM;
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

// --- pinhole (som 511/521/530) -------------------------------------------------
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const mul = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const norm = (a) => mul(a, 1 / Math.sqrt(dot(a, a)));
function kamera({ afstand = 300, hoejde = 75, skraa = 0, sigte = 'vandret', maal: mp = null, cx = 0 }) {
  // cx: kameraet staar ud for x = cx (centreret paa stangen); skraa drejer om det punkt.
  const s = (skraa * Math.PI) / 180;
  const C = { x: cx + afstand * Math.sin(s), y: hoejde, z: -afstand * Math.cos(s) };
  const T = sigte === 'vandret' ? { x: cx, y: hoejde, z: 0 } : mp;
  const fwd = norm(sub(T, C));
  const right = norm(cross({ x: 0, y: 1, z: 0 }, fwd));
  const up = cross(fwd, right);
  return (P) => { const d = sub(P, C); const zc = dot(d, fwd); return { x: 1000 * (dot(d, right) / zc) + 1000, y: 1000 - 1000 * (dot(d, up) / zc) }; };
}
// Punkternes dybde (cm, negativ = mod kameraet): markoerer paa kroppens naere side; det naere nav 75 cm ude.
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
];
function i3D(P, loeft, ekstra = {}) {
  const d = DYBDE[loeft];
  const Q = {};
  for (const id of IDS) Q[id] = ekstra[id] || { x: P[id].x, y: P[id].y, z: d[id] };
  Q.stangFjern = { x: P.stang.x, y: P.stang.y, z: -d.stang };
  return Q;
}
const foto = (Q, kam) => Object.fromEntries(Object.entries(Q).map(([k, p]) => [k, kam(p)]));

// --- klikfejl ---------------------------------------------------------------------
let seed = 536;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const gauss = () => { let u = 0; while (u === 0) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };
function stoej(klik, cmPrPx, sd) {
  if (!sd) return klik;
  const ud = {};
  for (const [id, p] of Object.entries(klik)) { const s = (sd[id] ?? 0.5) / cmPrPx; ud[id] = { x: p.x + gauss() * s, y: p.y + gauss() * s }; }
  return ud;
}
// Siden i node: skala fra kroppens laengder (ingen skive klikket), knaefasen som siden.
function genkend(klik, faseId, ref, L) {
  const m = maal(klik, { fase: faseId, cmPrPx: skalaFraKrop(klik, L) });
  return genkendFejl(m, ref, { knaeFase: knaeFaseTjek(m) });
}
const svar = (g) => (g.status === 'ligner' ? g.regel.id : g.status);

// --- billederne: Yantras normale og fejlbehaeftede stillinger for fem kroppe -----------
const KB = KROPPE.map((k) => {
  const b = kropsBilleder(k);
  const L = Object.fromEntries(FASER.map((f) => [f, modelFase(f, ind(LOEFT[f], k.h, k.v, k.pct)).L]));
  return { k, b, L };
});

// Taeller for et saet billeder under et kamera: fordeling af svarene.
function fordeling(billeder, faseId, kamF, sd, N) {
  const t = {};
  let n = 0;
  for (const { P, ref, L } of billeder) {
    const loeft = LOEFT[faseId];
    const kam = kamera(kamF(KAMHOEJDE[loeft], P));
    const klik = foto(i3D(P, loeft), kam);
    const k = skalaFraKrop(klik, L);
    for (let i = 0; i < (sd ? N : 1); i++) { const s = svar(genkend(stoej(klik, k, sd), faseId, ref, L)); t[s] = (t[s] || 0) + 1; n++; }
  }
  return { n, t };
}
const N = 60;
const A = { kameraer: KAMERAER.map((c) => ({ id: c.id, navn: c.navn })), N, regler: {} };
for (const regel of FEJL_REGLER) {
  const f = regel.fase;
  const normal = KB.flatMap(({ b, L }) => b.normal[f].map((x) => ({ ...x, L: L[f] })));
  const fejl = KB.flatMap(({ b, L }) => b.fejl[regel.id].map((x) => ({ ...x, L: L[f] })));
  const r = (A.regler[regel.id] = { fase: f, titel: regel.titel, kamera: {} });
  for (const c of KAMERAER) {
    const rk = (r.kamera[c.id] = {});
    // Uden klikfejl: kun kameraets egen skaevhed.
    const n0 = fordeling(normal, f, c.k, null, 1), f0 = fordeling(fejl, f, c.k, null, 1);
    rk.udenKlik = { falskAlarm: pct(n0.t[regel.id] || 0, n0.n), fundet: pct(f0.t[regel.id] || 0, f0.n), fejlSvar: f0.t };
    for (const [sdNavn, sd] of Object.entries(KLIKFEJL)) {
      const nn = fordeling(normal, f, c.k, sd, N), ff = fordeling(fejl, f, c.k, sd, N);
      const usikker = (t) => (t['usikker-kamera'] || 0) + (t['usikker-fase'] || 0);
      rk[sdNavn] = {
        falskAlarm: pct(nn.t[regel.id] || 0, nn.n),
        overset: pct(ff.n - (ff.t[regel.id] || 0), ff.n),
        oversetFordiUsikker: pct(usikker(ff.t), ff.n),
        normalUsikker: pct(usikker(nn.t), nn.n),
      };
    }
  }
}
// Kameraets skaevhed paa raekkerne: modellens stilling (178 cm), afvigelse fra modellen i hver regels raekker.
A.skaevhed = {};
for (const f of FASER) {
  const { b, L } = KB[0];
  const x = b.normal[f][0];
  const loeft = LOEFT[f];
  A.skaevhed[f] = {};
  for (const c of KAMERAER) {
    const klik = foto(i3D(x.P, loeft), kamera(c.k(KAMHOEJDE[loeft], x.P)));
    const g = genkend(klik, f, x.ref, L[f]);
    A.skaevhed[f][c.id] = { status: g.status, grund: g.grund, raekker: Object.fromEntries(g.alle.flatMap((a) => [...a.raekker.map((rr) => [`${a.regel.id}:${rr.id}`, r1(rr.afvig)]), ...a.vaern.map((v) => [`${a.regel.id}:vaern-${v.id}`, r1(v.afvig)])])) };
  }
}

// --- B: knaeene ud om linjen hofte-ankel -----------------------------------------------
// Rodrigues: v drejet vinklen t om enhedsaksen k.
const drej = (v, k, t) => add(add(mul(v, Math.cos(t)), mul(cross(k, v), Math.sin(t))), mul(k, dot(k, v) * (1 - Math.cos(t))));
function knaeUd(P, loeft, grader) {
  const d = DYBDE[loeft];
  const A3 = { x: P.ankel.x, y: P.ankel.y, z: d.ankel }, H3 = { x: P.hofte.x, y: P.hofte.y, z: d.hofte }, K3 = { x: P.knae.x, y: P.knae.y, z: d.knae };
  const akse = norm(sub(H3, A3));
  const t = (grader * Math.PI) / 180;
  let K = add(A3, drej(sub(K3, A3), akse, t));
  if (K.z > K3.z) K = add(A3, drej(sub(K3, A3), akse, -t)); // knaeet ud mod kameraet (den naere side)
  return i3D(P, loeft, { knae: K });
}
const B = { grader: [0, 10, 20, 30, 40], normal: {}, fejl: {}, tal: {} };
for (const f of ['squat-bund', 'squat-midt', 'dl-gulv']) {
  const loeft = LOEFT[f];
  const kam = (P) => kamera({ afstand: 300, hoejde: KAMHOEJDE[loeft], cx: P.stang.x });
  B.normal[f] = {}; B.fejl[f] = {}; B.tal[f] = {};
  for (const g of B.grader) {
    const tael = (billeder, sd) => { const t = {}; let n = 0; for (const { P, ref, L } of billeder) { const klik = foto(knaeUd(P, loeft, g), kam(P)); const k = skalaFraKrop(klik, L); for (let i = 0; i < (sd ? N : 1); i++) { const s = svar(genkend(stoej(klik, k, sd), f, ref, L)); t[s] = (t[s] || 0) + 1; n++; } } return { n, t }; };
    const normal = KB.flatMap(({ b, L }) => b.normal[f].map((x) => ({ ...x, L: L[f] })));
    const nn = tael(normal, KLIKFEJL.omhyggelig);
    B.normal[f][g] = Object.fromEntries(Object.entries(nn.t).map(([k, v]) => [k, pct(v, nn.n)]));
    for (const regel of FEJL_REGLER.filter((r) => r.fase === f)) {
      const fejl = KB.flatMap(({ b, L }) => b.fejl[regel.id].map((x) => ({ ...x, L: L[f] })));
      const ff = tael(fejl, KLIKFEJL.omhyggelig);
      (B.fejl[f][regel.id] = B.fejl[f][regel.id] || {})[g] = pct(ff.t[regel.id] || 0, ff.n);
    }
    // Hvad kameraet ser (178 cm, modellens stilling, uden klikfejl): skinneben og knae mod modellen.
    const { b, L } = KB[0];
    const x = b.normal[f][0];
    const m = maal(foto(knaeUd(x.P, loeft, g), kam(x.P)), { fase: f, cmPrPx: skalaFraKrop(foto(knaeUd(x.P, loeft, g), kam(x.P)), L[f]) });
    B.tal[f][g] = { skinneben: r1(fraLodret(m.model.ankel, m.model.knae) - fraLodret(x.ref.ankel, x.ref.knae)), knae: r1(indvendigVinkel(m.model.hofte, m.model.knae, m.model.ankel) - indvendigVinkel(x.ref.hofte, x.ref.knae, x.ref.ankel)) };
  }
}

// --- C: sko med hael og high bar (squat) ---------------------------------------------
// Skinnebenet vippet a grader frem om anklen; laarets retning og torsoen uaendret (knaeet a grader mere boejet).
function haelVip(P, a) {
  const t = (-a * Math.PI) / 180; // frem = mod +x
  const v = { x: P.knae.x - P.ankel.x, y: P.knae.y - P.ankel.y };
  const knae = { x: P.ankel.x + v.x * Math.cos(t) - v.y * Math.sin(t), y: P.ankel.y + v.x * Math.sin(t) + v.y * Math.cos(t) };
  const dx = knae.x - P.knae.x, dy = knae.y - P.knae.y;
  const flyt = (p) => ({ x: p.x + dx, y: p.y + dy });
  return { ...P, knae, hofte: flyt(P.hofte), skulder: flyt(P.skulder), stang: flyt(P.stang) };
}
const C = { haelGrader: [0, 2, 4, 6, 8], lowbar: {}, highbar: {}, highbarTal: {} };
for (const f of ['squat-bund', 'squat-midt']) {
  C.lowbar[f] = {}; C.highbar[f] = {};
  for (const [stang, maalTil] of [['lowbar', C.lowbar[f]], ['highbar', C.highbar[f]]]) {
    for (const a of C.haelGrader) {
      const t = {}; let n = 0;
      for (const { k, b, L } of KB) {
        const I = { ...ind('squat', k.h, k.v, k.pct), stang };
        const mf = modelFase(f, I);
        if (!mf.feasible) continue;
        const ref = b.normal[f][0].ref; // modellens low bar med samme krop (siden kender kun low bar)
        const P = haelVip(mf.punkter, a);
        const klik = foto(i3D(P, 'squat'), kamera({ afstand: 300, hoejde: 80, cx: P.stang.x }));
        const kk = skalaFraKrop(klik, L[f]);
        for (let i = 0; i < N * 2; i++) { const s = svar(genkend(stoej(klik, kk, KLIKFEJL.omhyggelig), f, ref, L[f])); t[s] = (t[s] || 0) + 1; n++; }
      }
      maalTil[a] = Object.fromEntries(Object.entries(t).map(([kk, v]) => [kk, pct(v, n)]));
    }
  }
  const { k, b } = KB[0];
  const hb = modelFase(f, { ...ind('squat', k.h, k.v, k.pct), stang: 'highbar' }).punkter;
  const lb = b.normal[f][0].ref;
  C.highbarTal[f] = { skinneben: r1(fraLodret(hb.ankel, hb.knae) - fraLodret(lb.ankel, lb.knae)), torso: r1(fraLodret(hb.hofte, hb.skulder) - fraLodret(lb.hofte, lb.skulder)), knae: r1(indvendigVinkel(hb.hofte, hb.knae, hb.ankel) - indvendigVinkel(lb.hofte, lb.knae, lb.ankel)) };
}

// --- D: fasen valgt med oejet ----------------------------------------------------------
const D = { squat: {}, doedloeft: {} };
{
  const vinkelret = (loeft, P) => kamera({ afstand: 300, hoejde: KAMHOEJDE[loeft], cx: P.stang.x });
  const pk = (g) => { const p = g.points; return { stang: p.bar, midtfod: p.midfoot, ankel: p.ankle, knae: p.knee, hofte: p.hip, skulder: p.shoulder }; };
  const tael = (liste, f) => { const t = {}; let n = 0; for (const { P, ref, L } of liste) { const klik = foto(i3D(P, LOEFT[f]), vinkelret(LOEFT[f], P)); const kk = skalaFraKrop(klik, L); for (let i = 0; i < N; i++) { const s = svar(genkend(stoej(klik, kk, KLIKFEJL.omhyggelig), f, ref, L)); t[s] = (t[s] || 0) + 1; n++; } } return Object.fromEntries(Object.entries(t).map(([k, v]) => [k, pct(v, n)])); };
  for (const [f, fremdrift] of [['squat-bund', [0.95, 0.9, 0.85]], ['squat-midt', [-0.16, -0.12, -0.08, 0.08, 0.12, 0.16]]]) {
    D.squat[f] = {};
    for (const p of fremdrift) {
      const liste = KB.map(({ k, b, L }) => {
        const s = marcsFejlSaet(beregn('squat', ind('squat', k.h, k.v, k.pct)).L, 'lowbar');
        const q = f === 'squat-bund' ? p : s.stickingP + p;
        return { P: pk(s.vedFremdrift('reference', q)), ref: b.normal[f][0].ref, L: L[f] };
      });
      // Og fejlfigurerne samme sted i opturen: bliver de fundet?
      const fejlListe = (id) => KB.map(({ k, b, L }) => {
        const s = marcsFejlSaet(beregn('squat', ind('squat', k.h, k.v, k.pct)).L, 'lowbar');
        const q = f === 'squat-bund' ? p : s.stickingP + p;
        return { P: pk(s.vedFremdrift(id, q)), ref: b.normal[f][0].ref, L: L[f] };
      });
      D.squat[f][p] = { normal: tael(liste, f), kunKnae: tael(fejlListe('kun-knae'), f), hofteTilbage: tael(fejlListe('hofte-tilbage'), f) };
    }
  }
  // Doedloeftet: stillingen lidt efter at stangen slipper gulvet, som en lineaer overgang mellem modellens
  // gulv og knaehoejde (en tilnaermelse: modellen har ingen bane imellem i Maal dit billede).
  D.doedloeft['dl-gulv'] = {};
  for (const cm of [0, 2, 5, 8, 12, 16, 20]) {
    const liste = KB.map(({ b, L }) => {
      const g = b.normal['dl-gulv'][0].P, kn = b.normal['dl-knae'][0].P;
      const t = cm / (kn.stang.y - g.stang.y);
      // (cm = 0: modellens egen stilling ved gulvet)
      const P = Object.fromEntries(IDS.map((id) => [id, { x: g[id].x + t * (kn[id].x - g[id].x), y: g[id].y + t * (kn[id].y - g[id].y) }]));
      return { P, ref: g, L: L['dl-gulv'] };
    });
    D.doedloeft['dl-gulv'][cm] = tael(liste, 'dl-gulv');
    // Uden klikfejl, 178 cm: fasens vagt (stangens hoejde / knaeets mod modellens, graense 0,15) og raekkerne.
    const x = liste[0];
    const m = maal(foto(i3D(x.P, 'doedloeft'), vinkelret('doedloeft', x.P)), { fase: 'dl-gulv', cmPrPx: skalaFraKrop(foto(i3D(x.P, 'doedloeft'), vinkelret('doedloeft', x.P)), x.L) });
    const fsk = FJ.faseSikker(FEJL_REGLER[0], m, x.ref);
    const g = genkendFejl(m, x.ref);
    const mFlad = maal(Object.fromEntries([...IDS.map((id) => [id, { x: 600 + x.P[id].x * 3, y: 1300 - x.P[id].y * 3 }]), ['stangFjern', { x: 600 + x.P.stang.x * 3, y: 1300 - x.P.stang.y * 3 }]]), { fase: 'dl-gulv', cmPrPx: 1 / 3 });
    D.doedloeft['dl-gulv'][`${cm}-fladt`] = { gulvAndelOver: r1(FJ.faseSikker(FEJL_REGLER[0], mFlad, x.ref).tal * 100) / 100 };
    // Samme forhold med stangens midte (midt mellem de to nav) i stedet for det naere nav, og med et lavt kamera.
    const andel = (P, st) => (st.y - P.midtfod.y) / (P.knae.y - P.midtfod.y);
    const refA = andel(x.ref, x.ref.stang);
    const kLav = foto(i3D(x.P, 'doedloeft'), kamera({ afstand: 300, hoejde: 45, cx: x.P.stang.x }));
    const mLav = maal(kLav, { fase: 'dl-gulv', cmPrPx: skalaFraKrop(kLav, x.L) });
    D.doedloeft['dl-gulv'][`${cm}-andre`] = { midtNav: r1((andel(m.model, m.model.stang) - refA) * 100) / 100, lavt45Naer: r1((andel(mLav.model, mLav.model.stangNaer || mLav.model.stang) - refA) * 100) / 100, stangCmOverGulvMidt: r1(m.model.stang.y - m.model.midtfod.y), modelStangCm: r1(x.ref.stang.y - x.ref.midtfod.y) };
    D.doedloeft['dl-gulv'][`${cm}-udenKlik`] = { gulvAndelOver: r1(fsk.tal * 100) / 100, faseOk: fsk.ok, status: g.status, raekker: g.raekker.map((r) => [r.id, r1(r.afvig)]) };
  }
  // Hoften stiger foerst, men kun halvvejs (skinnebenet halvvejs mod lodret): fundet?
  D.doedloeft.halvvejs = {};
  for (const { k, b, L } of KB.slice(0, 1)) {
    for (const g of [0, 3, 6, 9]) {
      const P = pk(hofteFoerst(L['dl-gulv'], g).geo);
      D.doedloeft.halvvejs[g] = tael([{ P, ref: b.normal['dl-gulv'][0].ref, L: L['dl-gulv'] }], 'dl-gulv');
    }
  }
}

// --- E: Marcs klip (462) ---------------------------------------------------------------
const MINE = {
  start: { stang: { x: 441, y: 828 }, midtfod: { x: 430, y: 948 }, ankel: { x: 400, y: 905 }, knae: { x: 447, y: 668 }, hofte: { x: 343, y: 583 }, skulder: { x: 470, y: 460 } },
  knaehoejde: { stang: { x: 434, y: 768 }, midtfod: { x: 427, y: 942 }, ankel: { x: 398, y: 905 }, knae: { x: 445, y: 640 }, hofte: { x: 340, y: 553 }, skulder: { x: 460, y: 418 } },
};
const E = {};
{
  const K = kroppe('doedloeft', null, { hoejde: '183', vaegt: '120', stangKg: 270 });
  for (const [navn, klik, f] of [
    ['yantra-gulv', MARC_GULV, 'dl-gulv'], ['yantra-gulv-to-nav', { ...MARC_GULV, stangFjern: FJERNT_NAV }, 'dl-gulv'], ['bhishak-gulv', MINE.start, 'dl-gulv'],
    ['yantra-knae', MARC_KNAE, 'dl-knae'], ['bhishak-knae', MINE.knaehoejde, 'dl-knae'],
  ]) {
    const mf = modelFase(f, K.snit);
    const g = genkend(klik, f, mf.punkter, mf.L);
    E[navn] = { status: g.status, regel: g.regel?.id || null, grund: g.grund, raekker: g.alle.map((a) => ({ regel: a.regel.id, status: a.status, raekker: a.raekker.map((r) => ({ id: r.id, billede: r1(r.billede), model: r1(r.model), afvig: r1(r.afvig), taerskel: r.taerskel })) })) };
  }
  // Knaeene ud: hvor mange grader giver Marcs "knae 24 grader mere strakt, skinnebenet kun 4 grader mere lodret"?
  E.knaeUdForklaring = B.tal['dl-gulv'];
}

// --- F: saetningerne -------------------------------------------------------------------
const FORBUDT = ['muskel', 'stærk', 'svag', 'bedre', 'dårlig', 'forkert', 'skade', 'farlig', 'Nm', 'risiko', 'du ', 'skal ', 'bør ', 'undgå', 'problem'];
const F = { saetninger: [], graenser: {} };
for (const { k, b, L } of KB) {
  for (const regel of FEJL_REGLER) {
    for (const x of b.fejl[regel.id]) {
      const klik = foto(i3D(x.P, LOEFT[regel.fase]), kamera({ afstand: 300, hoejde: KAMHOEJDE[LOEFT[regel.fase]], cx: x.P.stang.x }));
      const g = genkend(klik, regel.fase, x.ref, L[regel.fase]);
      if (g.status === 'ligner' && g.regel.id === regel.id) F.saetninger.push({ krop: k.navn, regel: regel.id, figur: x.navn, saetning: g.saetning, ord: g.saetning.split(/\s+/).length, forbudt: FORBUDT.filter((w) => g.saetning.toLowerCase().includes(w.toLowerCase())) });
    }
    if (regel.graense) F.graenser[regel.id] = regel.graense;
  }
}
F.unikke = [...new Set(F.saetninger.map((s) => s.saetning.replace(/\d+/g, '#')))];
F.maxOrd = Math.max(...F.saetninger.map((s) => s.ord));
F.medForbudt = F.saetninger.filter((s) => s.forbudt.length).map((s) => ({ regel: s.regel, forbudt: s.forbudt }));

const ud = { ref: SHA, A, B, C, D, E, F };
fs.writeFileSync(path.join(UD, 'fejl-536.json'), JSON.stringify(ud, null, 1));

// --- kort udskrift ---
console.log(`dhruva ${SHA}, N=${N} pr. billede`);
for (const [id, r] of Object.entries(A.regler)) {
  console.log(`\n${id} (${r.fase})`);
  for (const c of KAMERAER) { const x = r.kamera[c.id]; console.log(`  ${c.id.padEnd(9)} uden klik fa ${x.udenKlik.falskAlarm} fundet ${x.udenKlik.fundet} | omh fa ${x.omhyggelig.falskAlarm} ov ${x.omhyggelig.overset} (usikker ${x.omhyggelig.oversetFordiUsikker}; normal usikker ${x.omhyggelig.normalUsikker}) | typ fa ${x.typisk.falskAlarm} ov ${x.typisk.overset}`); }
}
console.log('\nskaevhed', JSON.stringify(A.skaevhed, null, 0));
console.log('\nB tal', JSON.stringify(B.tal)); console.log('B normal', JSON.stringify(B.normal)); console.log('B fejl', JSON.stringify(B.fejl));
console.log('\nC highbarTal', JSON.stringify(C.highbarTal)); console.log('C lowbar', JSON.stringify(C.lowbar)); console.log('C highbar', JSON.stringify(C.highbar));
console.log('\nD', JSON.stringify(D));
console.log('\nE', JSON.stringify(E, null, 0));
console.log('\nF', F.saetninger.length, 'saetninger, max ord', F.maxOrd, 'forbudt', JSON.stringify(F.medForbudt)); for (const s of F.unikke) console.log('  -', s);
