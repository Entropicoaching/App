// Kritik 530, blok 1: E7, E8 og E3-resten efter Yantras 522, med mine egne
// scenarier fra 511/521 (samme pinhole, dybder, klikfejl og 507-aendring).
//
//   node outputs/kritik-530/foer-efter-530.mjs
//
// Loeftmodellen er entropi-loeftmodel-dhruva main @ c9950e0 (522 merget),
// hentet med git archive til en midlertidig mappe; intet trae roeres.
// Skriver outputs/kritik-530/foer-efter-530.json. Kun syntetiske punkter og
// Marcs egne klik fra 462 (MARC_GULV, allerede i Yantras repo).
//
// E7: par uden aendring, det fjerne nav skarpt / skoennet / skoennet med
//     krydset, 1 og 3 runder. Ogsaa "samme sted paa kanten tre gange" (navets
//     fejl trukket een gang pr. billede og delt af runderne). Og prisen:
//     hvor ofte fanges en ren stangaendring paa 2, 3 og 5 cm med faktor 1,
//     1,5 og 2?
// E8: saetningsRaekker mod min Monte Carlo pr. antal raekker.
// E3-rest: faseHoejdeTjek (hint) med mine fire kamerapladser fra 521 og to
//     rigtige fasefejl (et billede 6 og 12 cm fra sticking point).

import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

const DHRUVA = 'C:/Users/Entropi/Desktop/entropi-loeftmodel-dhruva';
const REF = process.argv[2] || 'c9950e0';
const SHA = execSync(`git -C ${DHRUVA} rev-parse --short ${REF}`).toString().trim();
const LM = path.join(tmpdir(), `kritik-530-loeftmodel-${SHA}`);
if (!fs.existsSync(path.join(LM, 'dist', 'maal-billede', 'index.html'))) {
  fs.rmSync(LM, { recursive: true, force: true }); fs.mkdirSync(LM, { recursive: true });
  execSync(`git -C ${DHRUVA} archive ${SHA} src dist scripts kroppe test outputs/videomaal outputs/507 outputs/514 package.json | tar -x -C "${LM.replace(/\\/g, '/')}"`, { shell: 'bash' });
}
const imp = (f) => import(pathToFileURL(path.join(LM, f)).href);
const { PUNKTER, maal, skalaFraKrop, fraLodret, indvendigVinkel } = await imp('src/maalBillede.js');
const { foerEfterTabel, stoersteForskelle, forskelSaetning, saetningsRaekker, taerskel, STANG_RAEKKER, NAV_SKOENNET_FAKTOR } = await imp('src/maalBilledeFoerEfter.js');
const { kroppe, modelFase, faseHoejdeTjek, FASE_HOEJDE_HINT_CM } = await imp('src/maalBilledeModel.js');
const { MARC_GULV, efterKlik } = await imp('scripts/ordre-507-skaermbilleder.mjs');
const { marcsFejlSaet } = await imp('src/embed/squatFejlbilleder.js');

const UD = path.dirname(fileURLToPath(import.meta.url));
const r1 = (x) => (x === null || !Number.isFinite(x) ? null : Math.round(x * 10) / 10);
const IDS = PUNKTER.map((p) => p.id);
const pct = (a, n) => Math.round((100 * a) / n);

// --- faelles: Marcs doedloeft ved gulvet som figur i cm (som 521) ------------
const KD = kroppe('doedloeft', null, { hoejde: '183', vaegt: '120', stangKg: 270 });
const LD = modelFase('dl-gulv', KD.snit).L;
const FOER = maal(MARC_GULV, { fase: 'dl-gulv', cmPrPx: skalaFraKrop(MARC_GULV, LD) });
const FIG = FOER.model;
const maalSom = (klik, faseId, L) => maal(klik, { fase: faseId, cmPrPx: skalaFraKrop(klik, L) });

const DYBDE_DL = { stang: -75, midtfod: -12, ankel: -14, knae: -13, hofte: -18, skulder: -20 };
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const norm = (a) => { const n = Math.sqrt(dot(a, a)); return { x: a.x / n, y: a.y / n, z: a.z / n }; };
function kamera({ afstand = 300, hoejde = 75, skraa = 0, sigte = 'vandret', maal: mp = { x: 0, y: 75, z: 0 } }) {
  const s = (skraa * Math.PI) / 180;
  const C = { x: afstand * Math.sin(s), y: hoejde, z: -afstand * Math.cos(s) };
  const T = sigte === 'vandret' ? { x: 0, y: hoejde, z: 0 } : mp;
  const fwd = norm(sub(T, C));
  const right = norm(cross({ x: 0, y: 1, z: 0 }, fwd));
  const up = cross(fwd, right);
  return (P) => { const d = sub(P, C); const zc = dot(d, fwd); return { x: 1000 * (dot(d, right) / zc) + 1000, y: 1000 - 1000 * (dot(d, up) / zc) }; };
}
function i3D(F, dybde) {
  const P = {};
  for (const id of IDS) P[id] = { x: F[id].x, y: F[id].y, z: dybde[id] };
  P.stangFjern = { x: F.stang.x, y: F.stang.y, z: -dybde.stang };
  return P;
}
const foto = (P3, kam, { nav = true } = {}) => {
  const ud = Object.fromEntries(Object.entries(P3).map(([k, p]) => [k, kam(p)]));
  if (!nav) delete ud.stangFjern;
  return ud;
};
const REFK = { afstand: 300, hoejde: 75 };

// --- klikfejl (samme antagelser som 511/521) ---------------------------------
const STOEJ = {
  omhyggelig: { stang: 0.5, midtfod: 1.0, ankel: 1.0, knae: 1.0, hofte: 1.5, skulder: 1.5 },
  typisk: { stang: 1.0, midtfod: 1.5, ankel: 1.0, knae: 1.5, hofte: 2.5, skulder: 2.0 },
};
const NAV_SD = { skarpt: 0.5, skoennet: 2.5 };
let seed = 530;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const gauss = () => { let u = 0; while (u === 0) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };
// fastNav: navets fejl (px) givet udefra, saa runderne deler den (samme sted paa kanten).
function stoej(klik, cmPrPx, sd, navSd, fastNav = null) {
  const ud = {};
  for (const [id, p] of Object.entries(klik)) {
    if (id === 'stangFjern' && fastNav) { ud[id] = { x: p.x + fastNav.x + gauss() * (0.5 / cmPrPx), y: p.y + fastNav.y + gauss() * (0.5 / cmPrPx) }; continue; }
    const s = (id === 'stangFjern' ? navSd : sd[id] ?? 0) / cmPrPx;
    ud[id] = { x: p.x + gauss() * s, y: p.y + gauss() * s };
  }
  return ud;
}
// Naevner saetningen noget, hvis stangens taerskler ganges med f? (f = 1 er 522 uden kryds.)
const naevner = (t, f) => t.filter((r) => r.forskel !== null && !r.kameraKrav && r.iSaetning !== false && Math.abs(r.forskel) >= r.taerskel * (STANG_RAEKKER.includes(r.id) ? f : 1));

function monteCarlo(klikFoer, klikEfter, { sd, runder = 1, navSd = 0.5, n = 2000, samme = false }) {
  const k = skalaFraKrop(klikFoer, LD);
  const t = { uden: { alle: 0, stang: 0 }, kryds: { alle: 0, stang: 0 }, f15: { alle: 0, stang: 0 } };
  let enig = 0;
  const serie = (klik) => {
    const fast = samme ? { x: gauss() * (navSd / k), y: gauss() * (navSd / k) } : null;
    return Array.from({ length: runder }, () => maalSom(stoej(klik, k, sd, navSd, fast), 'dl-gulv', LD));
  };
  for (let i = 0; i < n; i++) {
    const A = serie(klikFoer);
    const B = serie(klikEfter);
    const uden = foerEfterTabel(A, B);
    const kryds = foerEfterTabel(A, B, { navSkoennet: true });
    const sU = stoersteForskelle(uden), sK = stoersteForskelle(kryds), s15 = naevner(uden, 1.5);
    // Kontrol: min egen regning med f = 1 og f = 2 skal give samme raekker som 522's.
    if (naevner(uden, 1).length === sU.length && naevner(uden, NAV_SKOENNET_FAKTOR).length === sK.length) enig++;
    for (const [nv, s] of [['uden', sU], ['kryds', sK], ['f15', s15]]) {
      if (s.length) t[nv].alle++;
      if (s.some((r) => STANG_RAEKKER.includes(r.id))) t[nv].stang++;
    }
  }
  const p = (o) => ({ alle: pct(o.alle, n), stang: pct(o.stang, n) });
  return { n, udenKryds: p(t.uden), medKryds: p(t.kryds), faktor15: p(t.f15), kontrolEnig: pct(enig, n) };
}

const P3ref = i3D(FIG, DYBDE_DL);
const kRef = kamera(REFK);
const klikRef = foto(P3ref, kRef);
const klikRefUden = foto(P3ref, kRef, { nav: false });

// --- E7: falske forskelle uden aendring --------------------------------------
const e7 = { ingenAendring: {}, sammeStedPaaKanten: {}, stangFlyttet: {}, aendring507: {} };
for (const [navn, sd] of Object.entries(STOEJ)) {
  for (const runder of [1, 3]) {
    e7.ingenAendring[`${navn}-${runder}-udenNav`] = monteCarlo(klikRefUden, klikRefUden, { sd, runder });
    e7.ingenAendring[`${navn}-${runder}-navSkarpt`] = monteCarlo(klikRef, klikRef, { sd, runder, navSd: NAV_SD.skarpt });
    e7.ingenAendring[`${navn}-${runder}-navSkoennet`] = monteCarlo(klikRef, klikRef, { sd, runder, navSd: NAV_SD.skoennet });
  }
}
// Samme sted paa kanten tre gange: navets fejl deles af runderne.
for (const [navn, sd] of Object.entries(STOEJ)) e7.sammeStedPaaKanten[`${navn}-3`] = monteCarlo(klikRef, klikRef, { sd, runder: 3, navSd: NAV_SD.skoennet, samme: true });

// Prisen: en ren stangaendring (kroppen staar stille, stangen d cm vandret).
for (const d of [2, 3, 5]) {
  const F2 = { ...FIG, stang: { x: FIG.stang.x + d, y: FIG.stang.y } };
  const klikFlyt = foto(i3D(F2, DYBDE_DL), kRef);
  for (const runder of [1, 3]) {
    e7.stangFlyttet[`${d}cm-${runder}-navSkarpt`] = monteCarlo(klikRef, klikFlyt, { sd: STOEJ.omhyggelig, runder, navSd: NAV_SD.skarpt, n: 1000 });
    e7.stangFlyttet[`${d}cm-${runder}-navSkoennet`] = monteCarlo(klikRef, klikFlyt, { sd: STOEJ.omhyggelig, runder, navSd: NAV_SD.skoennet, n: 1000 });
  }
}
const { efterCm } = efterKlik();
const klikAendret = foto(i3D(efterCm, DYBDE_DL), kRef);
for (const runder of [1, 3]) {
  e7.aendring507[`omhyggelig-${runder}-navSkarpt`] = monteCarlo(klikRef, klikAendret, { sd: STOEJ.omhyggelig, runder, navSd: NAV_SD.skarpt, n: 1000 });
  e7.aendring507[`omhyggelig-${runder}-navSkoennet`] = monteCarlo(klikRef, klikAendret, { sd: STOEJ.omhyggelig, runder, navSd: NAV_SD.skoennet, n: 1000 });
}
// Stangens taerskler med og uden krydset (1 runde, begge nav).
const t1 = foerEfterTabel(maalSom(klikRef, 'dl-gulv', LD), maalSom(klikRef, 'dl-gulv', LD));
const t1k = foerEfterTabel(maalSom(klikRef, 'dl-gulv', LD), maalSom(klikRef, 'dl-gulv', LD), { navSkoennet: true });
e7.stangTaerskler = Object.fromEntries(STANG_RAEKKER.filter((id) => t1.find((r) => r.id === id)).map((id) => [id, { uden: r1(t1.find((r) => r.id === id).taerskel), med: r1(t1k.find((r) => r.id === id).taerskel) }]));
// Uden nav: krydset maa intet goere (afkrydsningen staar ikke paa siden).
const tu = foerEfterTabel(maalSom(klikRefUden, 'dl-gulv', LD), maalSom(klikRefUden, 'dl-gulv', LD), { navSkoennet: true });
e7.udenNavKrydsGoerIntet = tu.every((r) => !r.navSkoennet);

// --- E8: saetningsRaekker mod min Monte Carlo --------------------------------
const e8 = {
  dlUdenNav: saetningsRaekker(foerEfterTabel(maalSom(klikRefUden, 'dl-gulv', LD), maalSom(klikRefUden, 'dl-gulv', LD))),
  dlMedNav: saetningsRaekker(t1),
  mc: {
    udenNav: e7.ingenAendring['omhyggelig-1-udenNav'].udenKryds.alle,
    navSkarpt: e7.ingenAendring['omhyggelig-1-navSkarpt'].udenKryds.alle,
    navSkoennetKryds: e7.ingenAendring['omhyggelig-1-navSkoennet'].medKryds.alle,
    typiskUdenNav: e7.ingenAendring['typisk-1-udenNav'].udenKryds.alle,
    typiskNavSkarpt: e7.ingenAendring['typisk-1-navSkarpt'].udenKryds.alle,
  },
};

// --- E3-rest: squat sticking point, mine fire kamerapladser ------------------
const KS = kroppe('squat', null, { hoejde: '178', stangKg: 140 });
const mfS = modelFase('squat-midt', KS.snit);
const DYBDE_SQ = { stang: -70, midtfod: -15, ankel: -16, knae: -18, hofte: -18, skulder: -20 };
const KAM_SQ = [
  { id: 'ref', k: { afstand: 300, hoejde: 80 } },
  { id: 'op30vip', k: { afstand: 300, hoejde: 110, sigte: 'maal', maal: { x: mfS.punkter.hofte.x, y: mfS.punkter.hofte.y, z: 0 } } },
  { id: 'lav60', k: { afstand: 300, hoejde: 60 } },
  { id: 'skraa10', k: { afstand: 300, hoejde: 80, skraa: 10 } },
];
const sqMaal = (fig, c, nav) => maalSom(foto(i3D(fig, DYBDE_SQ), kamera(c.k), { nav }), 'squat-midt', mfS.L);
const tjekSq = (fig, c, nav) => { const m = sqMaal(fig, c, nav); const hj = faseHoejdeTjek(m, mfS, m.cmPrPx); return { kamera: c.id, nav, forskelCm: r1(hj.forskelCm), graense: hj.graense, dom: hj.dom, hint: !!hj.hint }; };
const e3 = { hintGraense: FASE_HOEJDE_HINT_CM, kameraer: KAM_SQ.flatMap((c) => [false, true].map((nav) => tjekSq(mfS.punkter, c, nav))) };
// Rigtige fasefejl: et billede fra et andet sted i opturen (stangen 6 og 12 cm fra sticking point), vinkelret kamera.
const saet = marcsFejlSaet(mfS.L, KS.snit.stang || 'lowbar');
const squatVed = (p) => { const q = saet.vedFremdrift('reference', p).points; return { stang: q.bar, midtfod: q.midfoot, ankel: q.ankle, knae: q.knee, hofte: q.hip, skulder: q.shoulder }; };
const findP = (maalY, lo, hi) => { for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (squatVed(m).stang.y > maalY) lo = m; else hi = m; } return (lo + hi) / 2; };
const y0 = squatVed(saet.stickingP).stang.y;
e3.rigtigFasefejl = [];
for (const dy of [-12, -6, 6, 12]) {
  const fig = squatVed(dy < 0 ? findP(y0 + dy, saet.stickingP, 1) : findP(y0 + dy, 0, saet.stickingP));
  for (const nav of [false, true]) e3.rigtigFasefejl.push({ stangFlyttetCm: dy, ...tjekSq(fig, KAM_SQ[0], nav) });
}

const ud = {
  kilde: { loeftmodel: `entropi-loeftmodel-dhruva main ${SHA} (522 merget), via git archive`, marc: 'MARC_GULV (Marcs eget klip, 462)' },
  antagelser: { dybderDoedloeft: DYBDE_DL, fjerntNav: '+75 cm (modsat side)', dybderSquat: DYBDE_SQ, klikStoej: STOEJ, navSd: NAV_SD, sammeStedPaaKanten: 'navets fejl trukket een gang pr. billede (SD 2,5 cm) plus 0,5 cm pr. runde', kamera: 'pinhole som 511/521, referencen 3 m' },
  NAV_SKOENNET_FAKTOR,
  E7: e7,
  E8: e8,
  E3rest: e3,
};
fs.writeFileSync(path.join(UD, 'foer-efter-530.json'), JSON.stringify(ud, null, 2) + '\n');
const vis = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, `uden ${v.udenKryds.alle}/${v.udenKryds.stang} | kryds ${v.medKryds.alle}/${v.medKryds.stang} | f1,5 ${v.faktor15.alle}/${v.faktor15.stang} | kontrol ${v.kontrolEnig}%`]));
console.log(JSON.stringify({ ingen: vis(e7.ingenAendring), samme: vis(e7.sammeStedPaaKanten), flyt: vis(e7.stangFlyttet), a507: vis(e7.aendring507), taerskler: e7.stangTaerskler, udenNavKrydsGoerIntet: e7.udenNavKrydsGoerIntet, E8: e8, E3: e3 }, null, 1));
