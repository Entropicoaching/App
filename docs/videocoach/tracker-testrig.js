// Syntetisk test af VideoCoach-trackeren + skive-recentrering.
// Scene: mørk skive (radius 80) på gråmeleret baggrund, bevæger sig nedad,
// med roterende højkontrast-tekstur (som skrift/logo på en rigtig skive).
// Kører den ÆGTE matching-kode + recenterOnPlate og måler x-afvigelse.

const W = 640, H = 720;
const PLATE_R = 80;
const CX = 320;                      // sand centrum-x (konstant = lodret løft)
const noise = new Float32Array(W * H);
for (let i = 0; i < noise.length; i++) noise[i] = (Math.sin(i * 12.9898) * 43758.5453) % 1 * 18;

// ---- syntetisk frame: RGBA-buffer som canvas ----
function renderFrame(cy, theta) {
  const d = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let v = 120 + noise[y * W + x] + (x / W) * 20;      // baggrund m. gradient
      const dx = x - CX, dy = y - cy;
      const r = Math.hypot(dx, dy);
      if (r < PLATE_R) {
        v = 45;                                            // skiveflade
        if (r > PLATE_R - 6) v = 70;                       // fælg-ring
        if (r > PLATE_R * 0.55 && r < PLATE_R * 0.62) v = 160;  // indre kontrastring (tekst/farve)
        if (r < 12) v = 190;                               // nav (metal, centreret)
        // roterende tekstur: to lyse "logoer" der følger skivens rotation
        for (const phi of [0, Math.PI * 0.9]) {
          const tx = CX + Math.cos(theta + phi) * 15 * (phi ? 2.4 : 1);
          const ty = cy + Math.sin(theta + phi) * 15 * (phi ? 2.4 : 1);
          if (Math.hypot(x - tx, y - ty) < 7) v = 210;
        }
      }
      const i = (y * W + x) * 4;
      d[i] = d[i+1] = d[i+2] = v; d[i+3] = 255;
    }
  }
  return d;
}

// ---- canvas-emulering ----
let frameData = null;
const octx = { getImageData: (x0, y0, w, h) => {
  if (w <= 0 || h <= 0) throw new Error(`getImageData: ugyldig størrelse ${w}x${h}`);
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const si = ((y0 + y) * W + (x0 + x)) * 4, di = (y * w + x) * 4;
      out[di] = frameData[si]; out[di+1] = frameData[si+1];
      out[di+2] = frameData[si+2]; out[di+3] = 255;
    }
  return { data: out };
}};
const ocan = { width: W, height: H };

// ================= KODE FRA videocoach.html (porteret 1:1) =================
let cmPerPx = 45 / (2 * PLATE_R);

function grabGray(x, y, size) {
  const half = size >> 1;
  const d = octx.getImageData((x - half) | 0, (y - half) | 0, size, size).data;
  const g = new Float32Array(size * size);
  for (let i = 0; i < g.length; i++)
    g[i] = d[i*4] * .3 + d[i*4+1] * .59 + d[i*4+2] * .11;
  return g;
}

// v2: SELV-VALIDERENDE - returnerer kun en korrektion når strålerne er
// enige om ÉN konsistent cirkel med (nogenlunde) den lovede radius.
function recenterOnPlate(pt) {
  try {
    if (!cmPerPx) return null;
    const rExp = 22.5 / cmPerPx;
    if (rExp < 14) return null;
    const M = Math.round(rExp * 1.6);
    const x0 = Math.max(0, Math.round(pt.x - M));
    const y0 = Math.max(0, Math.round(pt.y - M));
    const w = Math.min(ocan.width - x0, 2 * M), h = Math.min(ocan.height - y0, 2 * M);
    if (w < rExp || h < rExp) return null;
    const d = octx.getImageData(x0, y0, w, h).data;
    const gg = (x, y) => {
      const xi = Math.max(x0, Math.min(x0 + w - 1, x | 0));
      const yi = Math.max(y0, Math.min(y0 + h - 1, y | 0));
      const i = ((yi - y0) * w + (xi - x0)) * 4;
      return d[i] * .3 + d[i+1] * .59 + d[i+2] * .11;
    };
    // søg kanten i et SMALT bånd om forventet radius (±18%) - så kan
    // indre ringe/tekst/naboskiver ikke kapre strålerne
    const edges = [];
    for (let a = 0; a < 16; a++) {
      const dx = Math.cos(a * Math.PI / 8), dy = Math.sin(a * Math.PI / 8);
      let prev = gg(pt.x + dx * rExp * .78, pt.y + dy * rExp * .78);
      let bestR = 0, bestJ = 0;
      for (let r = rExp * .82; r <= rExp * 1.18; r += 2) {
        const v = gg(pt.x + dx * r, pt.y + dy * r);
        const j = Math.abs(v - prev);
        if (j > bestJ) { bestJ = j; bestR = r; }
        prev = v;
      }
      edges.push(bestJ > 22 ? bestR : null);
    }
    let sx = 0, sy = 0, npair = 0;
    const radii = [];
    for (let a = 0; a < 8; a++) {
      const r1 = edges[a], r2 = edges[a + 8];
      if (r1 == null || r2 == null) continue;
      const off = (r1 - r2) / 2;
      sx += off * Math.cos(a * Math.PI / 8);
      sy += off * Math.sin(a * Math.PI / 8);
      radii.push((r1 + r2) / 2);           // parrets bud på cirkel-radius
      npair++;
    }
    if (npair < 5) return null;
    // VALIDERING 1: parrene skal være enige om radius (lav spredning) ...
    const mR = radii.reduce((s, r) => s + r, 0) / npair;
    const spread = Math.sqrt(radii.reduce((s, r) => s + (r - mR) ** 2, 0) / npair);
    if (spread > rExp * 0.08) return null;
    // ... 2: og radius skal ligne den kalibrerede skive
    if (Math.abs(mR - rExp) > rExp * 0.15) return null;
    const cx = 2 * sx / npair, cy = 2 * sy / npair;
    // ... 3: korrektioner er små justeringer, aldrig hop
    if (Math.hypot(cx, cy) > rExp * 0.25) return null;
    return { x: cx, y: cy };
  } catch { return null; }             // må ALDRIG kunne vælte sporingen
}

// tracking-loop (samme logik som processFrame)
function track(frames, p0, useRecenter) {
  const P = Math.max(27, Math.round(W / 32) | 1);
  const R = Math.round(W / 20);
  frameData = frames[0];
  // INTET start-snap i v2: en forkert flytning her poisoner templaten.
  let rcTrust = 3;   // selvdeaktivering: 3 "strikes" -> recentrering slås fra
  let patch = grabGray(p0.x, p0.y, P);
  let cur = { ...p0 }, vel = { x: 0, y: 0 }, emaBest = null;
  const pts = [{ ...cur }];
  for (let f = 1; f < frames.length; f++) {
    frameData = frames[f];
    const pred = { x: cur.x + vel.x, y: cur.y + vel.y };
    const Wd = 2 * R + P;
    const wx = Math.round(Math.max(0, Math.min(W - Wd, pred.x - Wd / 2)));
    const wy = Math.round(Math.max(0, Math.min(H - Wd, pred.y - Wd / 2)));
    const wd = octx.getImageData(wx, wy, Wd, Wd).data;
    const wg = new Float32Array(Wd * Wd);
    for (let i = 0; i < wg.length; i++)
      wg[i] = wd[i*4] * .3 + wd[i*4+1] * .59 + wd[i*4+2] * .11;
    let pMean = 0, pCnt = 0;
    for (let py = 0; py < P; py += 2)
      for (let px = 0; px < P; px += 2) { pMean += patch[py*P+px]; pCnt++; }
    pMean /= pCnt;
    const cost = (ox, oy, cap) => {
      let wMean = 0;
      for (let py = 0; py < P; py += 2) {
        const row = (oy + py) * Wd + ox;
        for (let px = 0; px < P; px += 2) wMean += wg[row + px];
      }
      wMean /= pCnt;
      let s = 0;
      for (let py = 0; py < P && s < cap; py += 2) {
        const row = (oy + py) * Wd + ox, prow = py * P;
        for (let px = 0; px < P; px += 2) {
          const dd = (wg[row + px] - wMean) - (patch[prow + px] - pMean);
          s += dd * dd;
        }
      }
      return s;
    };
    let best = 1e18, bo = { x: 0, y: 0 };
    for (let oy = 0; oy + P <= Wd; oy += 2)
      for (let ox = 0; ox + P <= Wd; ox += 2) {
        const s = cost(ox, oy, best);
        if (s < best) { best = s; bo = { x: ox, y: oy }; }
      }
    for (let oy = Math.max(0, bo.y-2); oy <= Math.min(Wd-P, bo.y+2); oy++)
      for (let ox = Math.max(0, bo.x-2); ox <= Math.min(Wd-P, bo.x+2); ox++) {
        const s = cost(ox, oy, best);
        if (s < best) { best = s; bo = { x: ox, y: oy }; }
      }
    if (emaBest !== null && best > emaBest * 6) {
      cur = { x: pred.x, y: pred.y };
      vel = { x: vel.x * .92, y: vel.y * .92 };
    } else {
      const nx = wx + bo.x + P/2, ny = wy + bo.y + P/2;
      vel = { x: (nx - cur.x) * .7 + vel.x * .3, y: (ny - cur.y) * .7 + vel.y * .3 };
      cur = { x: nx, y: ny };
      if (useRecenter && rcTrust > 0 && pts.length % 3 === 0) {
        const c = recenterOnPlate(cur);
        if (c) {
          const rExp = 22.5 / cmPerPx;
          if (Math.hypot(c.x, c.y) > rExp * 0.18) {
            rcTrust--;           // stor uenighed med matcheren = strike
          } else {
            cur = { x: cur.x + c.x * .5, y: cur.y + c.y * .5 };
          }
        }
      }
      emaBest = emaBest === null ? best : emaBest * .9 + best * .1;
      if (best < emaBest * 2.2) {
        const nyt = grabGray(cur.x, cur.y, P);
        for (let i = 0; i < patch.length; i++) patch[i] = patch[i] * .85 + nyt[i] * .15;
      }
    }
    pts.push({ ...cur });
  }
  return pts;
}

// ================= TESTS =================
// 1) enhedstest: kendt offset -> korrektion skal pege mod centrum
frameData = renderFrame(300, 0);
for (const e of [[20,0],[-20,0],[0,20],[14,-14]]) {
  const c = recenterOnPlate({ x: CX + e[0], y: 300 + e[1] });
  console.log(`offset (${e}) -> korrektion`, c ? `(${c.x.toFixed(1)}, ${c.y.toFixed(1)})` : 'null',
    c && Math.hypot(c.x + e[0], c.y + e[1]) < 8 ? 'OK' : '*** FEJL');
}

// 2) fulde forløb under forskellige kalibrerings-scenarier.
// Kravet er ASYMMETRISK: recenter skal hjælpe ved korrekt kalibrering og
// må ALDRIG være (væsentligt) værre end baseline ved forkert kalibrering.
const frames = [];
for (let f = 0; f < 90; f++) frames.push(renderFrame(150 + f * 4, f * 0.12));
const trueY = f => 150 + f * 4;
const goodCm = 45 / (2 * PLATE_R);

for (const [navn, cm] of [['korrekt kalib', goodCm],
                          ['kalib 1.5x for stor rExp', goodCm / 1.5],
                          ['kalib 0.6x for lille rExp', goodCm / 0.6]]) {
  cmPerPx = cm;
  const out = [];
  for (const useRC of [false, true]) {
    try {
      const pts = track(frames, { x: CX + 6, y: 150 }, useRC);
      const maxDev = Math.max(...pts.map(p => Math.abs(p.x - CX)));
      const yErr = Math.abs(pts[pts.length-1].y - trueY(89));
      const moved = Math.hypot(pts[pts.length-1].x - pts[0].x,
                               pts[pts.length-1].y - pts[0].y);
      out.push(`${useRC ? 'MED' : 'UDEN'}: maxX ${maxDev.toFixed(1)} yFejl ${yErr.toFixed(1)} ` +
               `flyttet ${moved.toFixed(0)}${moved < 100 ? ' ***FRYSER***' : ''}`);
    } catch (err) { out.push(`${useRC ? 'MED' : 'UDEN'}: ***EXCEPTION*** ${err.message}`); }
  }
  console.log(`[${navn}]  ${out.join('  |  ')}`);
}
