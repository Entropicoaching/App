// ============================================================================
// tracker-freeze-rig.js  ·  Bar-tracker FRYS-optimering (nuvaerende v3-tracker)
// ----------------------------------------------------------------------------
// Marc: stangbane-trackeren FRYSER en gang i mellem (punktet saetter sig fast).
// Rig porterer den NUVAERENDE processFrame 1:1 (kontinuitetsregel + patchVar-
// gulve), reproducerer frysningen, og tester et DAEMPET/CAP'ET coast-fix mod
// ALLE scenarier - der maa ikke opstaa regression.
//   node tracker-freeze-rig.js
// ============================================================================
const W = 640, H = 720, PLATE_R = 80, CX = 320;
const noise = new Float32Array(W * H);
for (let i = 0; i < noise.length; i++) noise[i] = ((Math.sin(i * 12.9898) * 43758.5453) % 1) * 18;

let DISTRACT = 0;   // statisk hoejkontrast-feature i baggrunden (frys-lokke)
let OCCL = 0;       // bund-okklusion (laar/skygge over nedre halvskive)
function renderFrame(cy, theta) {
  const d = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = 120 + noise[y * W + x] + (x / W) * 20;
    const dx = x - CX, dy = y - cy, r = Math.hypot(dx, dy);
    if (r < PLATE_R) {
      v = 45;
      if (r > PLATE_R - 6) v = 70;
      if (r > PLATE_R * 0.55 && r < PLATE_R * 0.62) v = 160;
      if (r < 12) v = 190;
      for (const phi of [0, Math.PI * 0.9]) {
        const tx = CX + Math.cos(theta + phi) * 15 * (phi ? 2.4 : 1);
        const ty = cy + Math.sin(theta + phi) * 15 * (phi ? 2.4 : 1);
        if (Math.hypot(x - tx, y - ty) < 7) v = 210;
      }
    }
    // STATISK distraktor: en fast lys "plade-lignende" klat ved (CX-6, 250)
    // (fx en anden skive/rack-detalje) som templaten kan laase paa naar
    // soegevinduet halter bagud paa en hurtig rep.
    if (DISTRACT) {   // DISTRACT = distraktorens y-position (0 = fra)
      const ddx = x - (CX - 4), ddy = y - DISTRACT, rr = Math.hypot(ddx, ddy);
      if (rr < 26) { v = 48; if (rr < 10) v = 195; if (rr > 12 && rr < 16) v = 165; }
    }
    // BUND-OKKLUSION (lange saet): naer bunden daekker laar/skygge nedre
    // halvdel af skiven - kombineret m. akkumuleret rotation = frys-opskrift
    if (OCCL && cy > 455 && dy > 6 && r < PLATE_R + 30)
      v = 58 + noise[y * W + x] * 0.35;
    const i = (y * W + x) * 4; d[i] = d[i+1] = d[i+2] = v; d[i+3] = 255;
  }
  return d;
}

let frameData = null;
const octx = { getImageData: (x0, y0, w, h) => {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = Math.max(0, Math.min(W - 1, x0 + x)), sy = Math.max(0, Math.min(H - 1, y0 + y));
    const si = (sy * W + sx) * 4, di = (y * w + x) * 4;
    out[di] = frameData[si]; out[di+1] = frameData[si+1]; out[di+2] = frameData[si+2]; out[di+3] = 255;
  }
  return { data: out };
} };
const ocan = { width: W, height: H };
let cmPerPx = 45 / (2 * PLATE_R);
function grabGray(x, y, size) {
  const half = size >> 1;
  const dd = octx.getImageData((x - half) | 0, (y - half) | 0, size, size).data;
  const g = new Float32Array(size * size);
  for (let i = 0; i < g.length; i++) g[i] = dd[i*4]*.3 + dd[i*4+1]*.59 + dd[i*4+2]*.11;
  return g;
}
// recenterOnPlate 1:1 fra appen (v2)
function recenterOnPlate(pt) {
  try {
    if (!cmPerPx) return null;
    const rExp = 22.5 / cmPerPx;
    if (rExp < 14) return null;
    const M = Math.round(rExp * 1.6);
    const x0 = Math.max(0, Math.round(pt.x - M)), y0 = Math.max(0, Math.round(pt.y - M));
    const w = Math.min(ocan.width - x0, 2 * M), h = Math.min(ocan.height - y0, 2 * M);
    if (w < rExp || h < rExp) return null;
    const d = octx.getImageData(x0, y0, w, h).data;
    const gg = (x, y) => { const xi = Math.max(x0, Math.min(x0 + w - 1, x | 0)), yi = Math.max(y0, Math.min(y0 + h - 1, y | 0));
      const i = ((yi - y0) * w + (xi - x0)) * 4; return d[i]*.3 + d[i+1]*.59 + d[i+2]*.11; };
    const edges = [];
    for (let a = 0; a < 16; a++) {
      const dx = Math.cos(a * Math.PI / 8), dy = Math.sin(a * Math.PI / 8);
      let prev = gg(pt.x + dx * rExp * .78, pt.y + dy * rExp * .78), bestR = 0, bestJ = 0;
      for (let r = rExp * .82; r <= rExp * 1.18; r += 2) { const v = gg(pt.x + dx * r, pt.y + dy * r);
        const j = Math.abs(v - prev); if (j > bestJ) { bestJ = j; bestR = r; } prev = v; }
      edges.push(bestJ > 22 ? bestR : null);
    }
    let sx = 0, sy = 0, npair = 0; const radii = [];
    for (let a = 0; a < 8; a++) { const r1 = edges[a], r2 = edges[a + 8]; if (r1 == null || r2 == null) continue;
      const off = (r1 - r2) / 2; sx += off * Math.cos(a * Math.PI / 8); sy += off * Math.sin(a * Math.PI / 8);
      radii.push((r1 + r2) / 2); npair++; }
    if (npair < 5) return null;
    const mR = radii.reduce((s, r) => s + r, 0) / npair;
    const spread = Math.sqrt(radii.reduce((s, r) => s + (r - mR) ** 2, 0) / npair);
    if (spread > rExp * 0.08) return null;
    if (Math.abs(mR - rExp) > rExp * 0.15) return null;
    const cx = 2 * sx / npair, cy = 2 * sy / npair;
    if (Math.hypot(cx, cy) > rExp * 0.25) return null;
    return { x: cx, y: cy, q: spread / rExp };   // q: lavere = bedre cirkel
  } catch { return null; }
}

// ===== NUVAERENDE tracker (v3) porteret 1:1 fra processFrame, + FIX-toggle ====
function track(frames, p0, fix) {
  const P = Math.max(27, Math.round(W / 32) | 1);
  const R = Math.round(W / 20);
  frameData = frames[0];
  let patch = grabGray(p0.x, p0.y, P);
  const patch0 = Float32Array.from(patch);   // ORIGINAL skive-template (til frys-recovery)
  const calcPatchVar = () => {
    let m = 0, c = 0; for (let py = 0; py < P; py += 2) for (let px = 0; px < P; px += 2) { m += patch[py*P+px]; c++; }
    m /= c; let v = 0; for (let py = 0; py < P; py += 2) for (let px = 0; px < P; px += 2) { const d0 = patch[py*P+px]-m; v += d0*d0; } return v;
  };
  let patchVar = calcPatchVar();
  let cur = { ...p0 }, vel = { x: 0, y: 0 }, emaBest = null, lost = 0;
  let pendReloc = null;   // v2: kandidat der venter paa tidslig bekraeftelse
  const pts = [{ ...cur }];
  for (let f = 1; f < frames.length; f++) {
    frameData = frames[f];
    const pred = { x: cur.x + vel.x, y: cur.y + vel.y };
    const Wd = 2 * R + P;
    const wx = Math.round(Math.max(0, Math.min(W - Wd, pred.x - Wd / 2)));
    const wy = Math.round(Math.max(0, Math.min(H - Wd, pred.y - Wd / 2)));
    const wd = octx.getImageData(wx, wy, Wd, Wd).data;
    const wg = new Float32Array(Wd * Wd);
    for (let i = 0; i < wg.length; i++) wg[i] = wd[i*4]*.3 + wd[i*4+1]*.59 + wd[i*4+2]*.11;
    let pMean = 0, pCnt = 0;
    for (let py = 0; py < P; py += 2) for (let px = 0; px < P; px += 2) { pMean += patch[py*P+px]; pCnt++; }
    pMean /= pCnt;
    const cost = (ox, oy, cap) => {
      let wMean = 0; for (let py = 0; py < P; py += 2) { const row = (oy+py)*Wd+ox; for (let px = 0; px < P; px += 2) wMean += wg[row+px]; }
      wMean /= pCnt; let s = 0;
      for (let py = 0; py < P && s < cap; py += 2) { const row = (oy+py)*Wd+ox, prow = py*P;
        for (let px = 0; px < P; px += 2) { const dd = (wg[row+px]-wMean)-(patch[prow+px]-pMean); s += dd*dd; } }
      return s;
    };
    let best = 1e18, bo = { x: 0, y: 0 };
    for (let oy = 0; oy + P <= Wd; oy += 2) for (let ox = 0; ox + P <= Wd; ox += 2) { const s = cost(ox, oy, best); if (s < best) { best = s; bo = { x: ox, y: oy }; } }
    for (let oy = Math.max(0, bo.y-2); oy <= Math.min(Wd-P, bo.y+2); oy++) for (let ox = Math.max(0, bo.x-2); ox <= Math.min(Wd-P, bo.x+2); ox++) { const s = cost(ox, oy, best); if (s < best) { best = s; bo = { x: ox, y: oy }; } }
    let nx = wx + bo.x + P/2, ny = wy + bo.y + P/2, uncertain = false;
    // KONTINUITET
    if (Math.hypot(nx - pred.x, ny - pred.y) > R * 0.6) {
      let b2 = 1e18, bo2 = null;
      for (let oy = 0; oy + P <= Wd; oy += 2) for (let ox = 0; ox + P <= Wd; ox += 2) {
        if (Math.hypot(wx+ox+P/2 - pred.x, wy+oy+P/2 - pred.y) > R * 0.45) continue;
        const s2 = cost(ox, oy, b2); if (s2 < b2) { b2 = s2; bo2 = { x: ox, y: oy }; } }
      if (bo2) { nx = wx + bo2.x + P/2; ny = wy + bo2.y + P/2; best = b2; }
      uncertain = true;
    }
    if (emaBest !== null && best > Math.max(emaBest * 6, patchVar * 0.35)) uncertain = true;

    // ---- FIX (Runde 22): plade-tabt-vagt via recenterOnPlate ----
    // recenterOnPlate finder KUN skiven hvis den faktisk er ved punktet.
    // Returnerer den null gentagne gange, er punktet TABT (frosset paa
    // baggrund) -> gensoeg skiven i et STORT vindue og genlaas. Ellers uroert.
    let didRecover = false;
    if (fix) {
      const c = recenterOnPlate({ x: nx, y: ny });
      if (c) lost = 0; else lost++;
      if (lost >= 4) {
        // gensoeg med ORIGINAL-template (aldrig forgiftet) i lodret stribe -
        // rig-data viste at denne konservatisme VINDER over "laer nyt
        // udseende ved relokering" (som cementerer fejl-relokeringer)
        let gb = 1e18, gp = null, p0m = 0;
        for (let i = 0; i < patch0.length; i++) p0m += patch0[i]; p0m /= patch0.length;
        for (let yy = P; yy <= H - P; yy += 6)
          for (let xx = Math.max(P, cur.x - 2*R); xx <= Math.min(W - P, cur.x + 2*R); xx += 6) {
            const g = grabGray(xx, yy, P);
            let m = 0; for (let i = 0; i < g.length; i++) m += g[i]; m /= g.length;
            let s = 0; for (let i = 0; i < g.length; i += 2) { const dd = (g[i]-m)-(patch0[i]-p0m); s += dd*dd; }
            if (s < gb) { gb = s; gp = { x: xx, y: yy }; }
          }
        if (gp && recenterOnPlate(gp)) {
          if (Math.hypot(gp.x - cur.x, gp.y - cur.y) > R) {   // AEGTE frys: skiven langt fra punktet
            nx = gp.x; ny = gp.y; vel = { x: 0, y: 0 };
            patch = Float32Array.from(patch0);
            patchVar = calcPatchVar();
            didRecover = true;
          }
          lost = 0;   // skiven fundet (naer eller fjern) -> ikke laengere "tabt"
        } else lost = 2;   // intet fund -> proev igen om et par frames (ikke hver frame)
      }
    }

    if (!didRecover) {
      vel = { x: (nx - cur.x) * .7 + vel.x * .3, y: (ny - cur.y) * .7 + vel.y * .3 };
      cur = { x: nx, y: ny };
    } else { cur = { x: nx, y: ny }; }

    emaBest = emaBest === null ? Math.max(best, patchVar * 0.06) : Math.max(emaBest * .9 + best * .1, patchVar * 0.05);
    // NB: forsoeg paa "template-hygiejne" (kun laere ved lost===0) og
    // cirkel-scan-relokering med bekraeftelse blev BEGGE testet 8/7 og
    // TABTE til denne simple v1 - se HANDOVER. Roer den ikke uden rig-bevis.
    if (!didRecover && best < Math.max(emaBest * 2.2, patchVar * 0.12)) {
      const nyt = grabGray(cur.x, cur.y, P);
      for (let i = 0; i < patch.length; i++) patch[i] = patch[i] * .85 + nyt[i] * .15;
      patchVar = calcPatchVar();
    }
    pts.push({ ...cur });
  }
  return pts;
}

// ===================== SCENARIER =====================
function build(fn, nfr) { const a = []; for (let f = 0; f < nfr; f++) a.push(fn(f)); return a; }
function smoother(t){ t=Math.max(0,Math.min(1,t)); return t*t*t*(t*(t*6-15)+10); }

function evalRun(pts, truthY, label) {
  const n = pts.length;
  const maxDev = Math.max(...pts.map(p => Math.abs(p.x - CX)));
  const yErr = Math.abs(pts[n-1].y - truthY(n-1));
  const moved = Math.hypot(pts[n-1].x - pts[0].x, pts[n-1].y - pts[0].y);
  // frys: fulgte banen IKKE (endte langt fra sand y) ELLER bevaegede sig knap nok
  const froze = yErr > 60 || moved < (Math.abs(truthY(n-1) - truthY(0)) * 0.4);
  console.log(`   ${label.padEnd(10)} maxX ${maxDev.toFixed(0).padStart(3)} · yFejl ${yErr.toFixed(0).padStart(3)} · flyttet ${moved.toFixed(0).padStart(3)}${froze ? '  *** FRYSER ***' : '  OK'}`);
  return { maxDev, yErr, moved, froze };
}

// 1) rolig rep (regression) - langsom lodret bevaegelse
const slowY = f => 150 + f * 4;
const s1 = build(f => renderFrame(slowY(f), f * 0.12), 90);
// 2) HURTIG accelererende rep + statisk distraktor (frys-forsoeg)
DISTRACT = 250;
const fastY = f => 150 + 380 * smoother(f / 40);   // hurtig optur, staar stille i toppen
const s2 = build(f => renderFrame(fastY(f), f * 0.2), 70);
DISTRACT = 0;
// 3) stille start (skiven staar stille foerst, saa bevaeger sig)
const stillY = f => f < 25 ? 150 : 150 + (f - 25) * 5;
const s3 = build(f => renderFrame(stillY(f), f * 0.1), 90);

console.log('\n=== BAR-TRACKER FRYS-RIG (v3 + fix) ===');
console.log('1) rolig rep (regressionsvagt)');
const r1a = evalRun(track(s1, { x: CX + 6, y: 150 }, false), slowY, 'NUVAER.');
const r1b = evalRun(track(s1, { x: CX + 6, y: 150 }, true), slowY, 'FIX');
console.log('2) hurtig rep + statisk distraktor (frys-forsoeg)');
const r2a = evalRun(track(s2, { x: CX + 6, y: 150 }, false), fastY, 'NUVAER.');
const r2b = evalRun(track(s2, { x: CX + 6, y: 150 }, true), fastY, 'FIX');
console.log('3) stille start');
const r3a = evalRun(track(s3, { x: CX + 6, y: 150 }, false), stillY, 'NUVAER.');
const r3b = evalRun(track(s3, { x: CX + 6, y: 150 }, true), stillY, 'FIX');

// 4) LANGT SAET: 7 reps, udtraetning (langsommere reps), AKKUMULERET
// rotation (~6 omdrejninger) + bund-okklusion. Marcs krav: skal virke
// for VILKAARLIGT antal reps - ikke kun 5.
OCCL = 1;
DISTRACT = 445;   // distraktor NAER bunden, hvor farten er lav = frys-lokke
const cyc = [];
let thAcc = 0;
for (let k = 0; k < 7; k++) {
  const nf = 34 + k * 6;                   // udtraetning: rep k tager laengere
  for (let f = 0; f < nf; f++) {
    const ph = f / nf;
    cyc.push({ y: 150 + 360 * (0.5 - 0.5 * Math.cos(ph * 2 * Math.PI)),
               th: (thAcc + f) * 0.12 });
  }
  thAcc += nf;
}
const s4 = cyc.map(o => renderFrame(o.y, o.th));
OCCL = 0; DISTRACT = 0;
const truth4 = f => cyc[Math.min(f, cyc.length - 1)].y;
function evalCyc(pts, truthF, label) {
  let maxE = 0, sum = 0, tailSum = 0, tailN = 0;
  const n = pts.length, tail0 = Math.floor(n * 0.85);
  pts.forEach((p, i) => { const e = Math.abs(p.y - truthF(i));
    if (e > maxE) maxE = e; sum += e;
    if (i >= tail0) { tailSum += e; tailN++; } });
  const rms = sum / n, tailErr = tailSum / tailN;
  // PERMANENT frossen = sporer stadig ikke til sidst. Kortvarige tab m.
  // genfinding er acceptable i fjendtlige scenarier - permanent doed er ikke.
  const dead = tailErr > 70;
  const status = dead ? '  *** PERMANENT TABT ***'
    : (maxE > 90 ? '  (tab undervejs, GENFANDT)' : '  OK');
  console.log(`   ${label.padEnd(10)} maxYfejl ${maxE.toFixed(0).padStart(4)} · snitfejl ${rms.toFixed(1).padStart(6)} · slutfejl ${tailErr.toFixed(0).padStart(4)}${status}`);
  return { maxE, rms, tailErr, froze: dead };
}
console.log('4) LANGT SAET: 7 reps + udtraetning + rotation + bund-okklusion + distraktor');
const r4a = evalCyc(track(s4, { x: CX + 6, y: 150 }, false), truth4, 'NUVAER.');
const r4b = evalCyc(track(s4, { x: CX + 6, y: 150 }, true), truth4, 'FIX v1');

console.log('\n=== DOM ===');
const noReg = !r1b.froze && !r3b.froze && r1b.yErr < 30 && r3b.yErr < 40;
console.log(` frys reproduceret (nuvaer, s2 + s4):    ${r2a.froze && r4a.froze}`);
console.log(` v1 loeser s2:                           ${!r2b.froze}`);
console.log(` LANGT SAET: v1 permanent-tabt: ${r4b.froze} (slutfejl ${r4b.tailErr.toFixed(0)} - krav: selvhelende)`);
console.log(` ingen regression (1 og 3):              ${noReg}`);
console.log((r2a.froze && !r2b.froze && !r4b.froze && noReg)
  ? '\n GROEN: v1-vagten overlever ALLE scenarier inkl. vilkaarligt lange saet\n (kortvarige tab selvheles). Forsoegte "forbedringer" (cirkel-scan-reloker,\n template-hygiejne) TABTE begge til v1 i denne rig - 8/7-2026.\n'
  : '\n (se ovenfor - juster scenarie/fix)\n');
