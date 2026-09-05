// ORDRE 50 · set-bounds-presearch-rig.mjs
// -----------------------------------------------------------------------------
// Måler den billige forudsøgning (vcMotionSeries/vcFindSetBounds i
// public/videocoach.html) der foreslår sættets start/slut, så Marc kan
// trykke start uden selv at spole. De to funktioner udtrækkes 1:1 fra HTML-
// filen (samme mønster som tracker-live-bench.mjs) og køres i ren Node mod
// syntetiske, lav-opløsnings gråtone-prøver - ingen video, ingen browser,
// intet fra en rigtig atlet.
//
// To grupper scenarier:
//   DE SEKS   - samme navne/varighed/bevægelse som npm run gate:tracker
//               (docs/videocoach/tracker-live-bench.mjs), reproduceret her
//               fordi den fil ikke eksporterer sine scener og IKKE må røres
//               af denne ordre. Dette er målingen ordren selv beder om:
//               "hvor tæt forslaget rammer det sted, en manuel opsætning
//               ville have valgt, på hvert af de seks scenarier".
//   EKSTRA    - to scenarier MED en ægte optaktsstilhed før løftet starter.
//               Ingen af de seks officielle scenarier har det (klippet
//               starter altid midt i bevægelsen) - se RAPPORT.md. De er
//               taget med for at kunne validere startforslaget overhovedet,
//               ikke fordi ordren kræver dem.
//
// Kørsel: node docs/videocoach/set-bounds-presearch-rig.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(here, '..', '..', 'public', 'videocoach.html');
const html = readFileSync(htmlPath, 'utf8');

// ---------- 1) Udtræk den levende, rene forudsøgnings-logik 1:1 ----------
const START_MARKER = '// ORDRE 50 · start: billig forudsøgning for sættets start/slut';
const END_MARKER = '// ORDRE 50 · slut: billig forudsøgning for sættets start/slut';
function extractPureSource() {
  const startIdx = html.indexOf(START_MARKER);
  if (startIdx < 0) throw new Error('set-bounds-presearch-rig: startmarkør ikke fundet - er videocoach.html omstruktureret?');
  const endIdx = html.indexOf(END_MARKER, startIdx);
  if (endIdx < 0) throw new Error('set-bounds-presearch-rig: slutmarkør ikke fundet - er videocoach.html omstruktureret?');
  return html.slice(startIdx, endIdx);
}
function loadPureFns() {
  const source = extractPureSource();
  const fn = new Function(`${source}\nreturn { vcMotionSeries, vcFindSetBounds };`);
  return fn();
}

// ---------- 2) Syntetiske scener ----------
// Deterministisk (Math.sin-baseret støj, ingen Math.random). Kamera statisk,
// én lodret-bevægende "skive" over et støjende baggrund - vi tester kun
// TIDSLOGIKKEN (hvornår er der ro/bevægelse), ikke plade-identitet, så en
// forenklet, tekstur-fri skive er nok her.
function noise2D(x, y, seed = 0) {
  const s = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.1) * 43758.5453;
  return (s - Math.floor(s)) * 14 - 7;
}
const W = 480, H = 640, PLATE_R = 70, CX = 240;

function buildScene({ name, duration, poseAt, contrastAt = () => 1, camNoiseSeed = 0 }) {
  return {
    name, duration, poseAt,
    // Punkt-sampling (nearest-neighbour), ikke box-average - en forenkling af
    // den rigtige canvas-nedskalering (bilineær). Se RAPPORT.md, "Ærlige
    // grænser": dette tester tidslogikken, ikke selve canvas-nedskaleringen.
    pixel(t, x, y) {
      const { cy } = poseAt(t);
      const bg = 118 + noise2D(x, y, camNoiseSeed) + (x / W) * 18;
      const dx = x - CX, dy = y - cy, r = Math.hypot(dx, dy);
      if (r >= PLATE_R) return Math.max(0, Math.min(255, bg));
      const contrast = contrastAt(t);
      const plate = r < 11 ? 188 : r > PLATE_R - 6 ? 66 : 42;
      const blended = bg + (plate - bg) * contrast;
      return Math.max(0, Math.min(255, blended));
    },
  };
}

// --- de samme seks bevægelsesmønstre som tracker-live-bench.mjs (ORDRE 45) ---
function poseCleanSingle(t) {
  const repT = Math.max(0, Math.min(1, t / 1.6));
  const d = repT < 0.5 ? repT / 0.5 : (1 - repT) / 0.5;
  return { cy: 190 + 260 * d };
}
function contrastBottomFade(t) {
  const { cy } = poseCleanSingle(t);
  const depth = (cy - 190) / 260;
  return depth > 0.6 ? 0.28 + (1 - depth) * 0.2 : 1;
}
function poseMultiRep(t) {
  const repDur = 1.5, reps = [260, 300, 265];
  const repIndex = Math.min(reps.length - 1, Math.floor(t / repDur));
  const localT = (t - repIndex * repDur) / repDur;
  const d = localT < 0.5 ? localT / 0.5 : (1 - localT) / 0.5;
  return { cy: 190 + reps[repIndex] * Math.max(0, d) };
}
function poseIdleTail(t) {
  if (t <= 1.6) return poseCleanSingle(t);
  return { cy: 190 };
}
function posePausedHold(t) {
  const repDur = 1.5, holdDur = 3.5;
  if (t <= repDur) return poseCleanSingle((t / repDur) * 1.6);
  if (t <= repDur + holdDur) return { cy: 190 };
  const t2 = t - repDur - holdDur;
  return poseCleanSingle((t2 / repDur) * 1.6);
}
function buildOcclusion() {
  const base = buildScene({ name: 'brief_occlusion', duration: 1.6, poseAt: poseCleanSingle });
  const occlStart = 0.62, occlEnd = 0.78;
  return {
    ...base,
    pixel(t, x, y) {
      const v = base.pixel(t, x, y);
      if (t >= occlStart && t <= occlEnd) {
        const { cy } = poseCleanSingle(t);
        if (y > cy - 10 && y < cy + PLATE_R + 20) return 30;
      }
      return v;
    },
  };
}

// --- ekstra: ægte optaktsstilhed før løftet (ingen af de seks har dette) ---
function poseLeadinIdle(t) {
  const LEAD = 3.5;
  if (t <= LEAD) return { cy: 190 };
  return poseCleanSingle(t - LEAD);
}
function poseLeadinAndTail(t) {
  const LEAD = 2.5;
  if (t <= LEAD) return { cy: 190 };
  if (t <= LEAD + 1.6) return poseCleanSingle(t - LEAD);
  return { cy: 190 };
}

const SIX_OFFICIAL = [
  { scene: buildScene({ name: 'clean_single_rep', duration: 1.6, poseAt: poseCleanSingle }),
    manualStart: 0, manualEnd: 1.6 },
  { scene: buildScene({ name: 'low_contrast_bottom', duration: 1.6, poseAt: poseCleanSingle, contrastAt: contrastBottomFade }),
    manualStart: 0, manualEnd: 1.6 },
  { scene: buildScene({ name: 'multi_rep', duration: 1.5 * 3, poseAt: poseMultiRep }),
    manualStart: 0, manualEnd: 1.5 * 3 },
  { scene: buildOcclusion(), manualStart: 0, manualEnd: 1.6 },
  { scene: buildScene({ name: 'idle_tail_after_rep', duration: 1.6 + 9, poseAt: poseIdleTail }),
    manualStart: 0, manualEnd: 1.6 },
  { scene: buildScene({ name: 'paused_hold_between_reps', duration: 1.5 * 2 + 3.5, poseAt: posePausedHold }),
    manualStart: 0, manualEnd: 1.5 * 2 + 3.5 },
];
const EXTRA = [
  { scene: buildScene({ name: 'leadin_idle_before_rep', duration: 3.5 + 1.6, poseAt: poseLeadinIdle }),
    manualStart: 3.5, manualEnd: 3.5 + 1.6 },
  { scene: buildScene({ name: 'leadin_and_tail', duration: 2.5 + 1.6 + 4, poseAt: poseLeadinAndTail }),
    manualStart: 2.5, manualEnd: 2.5 + 1.6 },
];

// ---------- 3) Kør forudsøgningen mod ét scenarie ----------
// Efterligner vcRunSetBoundsPresearch: op til 30 prøver á 48px bredde,
// gråtone, frame-til-frame-diff. Camera-capture er punkt-sampling (se
// buildScene) i stedet for browserens rigtige nedskalering - se "Ærlige
// grænser" i RAPPORT.md.
const PRESEARCH_W = 48, PRESEARCH_MAX_SAMPLES = 30, FRAME = 1 / 30;
function runPresearch(scene, fns) {
  const startedAt = performance.now();
  const duration = scene.duration;
  const psH = Math.max(9, Math.round(PRESEARCH_W * (H / W)));
  const stepS = Math.max(0.2, duration / PRESEARCH_MAX_SAMPLES);
  const times = [];
  for (let t = 0; t < duration; t += stepS) times.push(t);
  const lastSafe = Math.max(0, duration - FRAME);
  if (times.length < 2 || times.at(-1) < lastSafe - 0.001) times.push(lastSafe);

  const frames = times.map(t => {
    const g = new Float32Array(PRESEARCH_W * psH);
    for (let y = 0; y < psH; y++) {
      for (let x = 0; x < PRESEARCH_W; x++) {
        const fx = (x / PRESEARCH_W) * W, fy = (y / psH) * H;
        g[y * PRESEARCH_W + x] = scene.pixel(Math.min(t, lastSafe), fx, fy);
      }
    }
    return g;
  });

  const motion = fns.vcMotionSeries(frames);
  const result = fns.vcFindSetBounds(times, motion, duration);
  const ms = performance.now() - startedAt;
  return { ...result, ms, samples: times.length };
}

// ---------- 4) Rapportér ----------
function report(group, rows, fns) {
  console.log(`\n== ${group} ==`);
  console.log('scenarie'.padEnd(26), 'ms'.padStart(7), 'prøver'.padStart(7),
    'foreslået'.padStart(18), 'manuelt'.padStart(14), 'Δstart'.padStart(8), 'Δslut'.padStart(8));
  let worstDelta = 0;
  for (const { scene, manualStart, manualEnd } of rows) {
    const r = runPresearch(scene, fns);
    const sStart = r.ok ? r.start : null, sEnd = r.ok ? r.end : null;
    const dStart = sStart == null ? Infinity : Math.abs(sStart - manualStart);
    const dEnd = sEnd == null ? Infinity : Math.abs(sEnd - manualEnd);
    worstDelta = Math.max(worstDelta, Number.isFinite(dStart) ? dStart : 0, Number.isFinite(dEnd) ? dEnd : 0);
    const foreslaaet = r.ok ? `${sStart.toFixed(2)}–${sEnd.toFixed(2)}s` : `(${r.reason || 'fejl'})`;
    console.log(
      scene.name.padEnd(26), r.ms.toFixed(1).padStart(7), String(r.samples).padStart(7),
      foreslaaet.padStart(18), `${manualStart.toFixed(1)}–${manualEnd.toFixed(1)}s`.padStart(14),
      dStart.toFixed(2).padStart(8), dEnd.toFixed(2).padStart(8));
  }
  return worstDelta;
}

function main() {
  const fns = loadPureFns();
  // TOLERANCE: forudsøgningen har en bevidst margin (0.6s før / 0.3s efter,
  // se vcFindSetBounds) - den skal IKKE ramme præcis det fysiske
  // bevægelses-punkt, men et brugbart sted tæt på. 1.0s er rummeligt nok til
  // margenen, stramt nok til at fange en reelt forkert gæt.
  const TOLERANCE_S = 1.0;
  const worst1 = report('DE SEKS officielle gate:tracker-scenarier', SIX_OFFICIAL, fns);
  const worst2 = report('EKSTRA (ikke en del af de seks) - tester optaktsstilhed', EXTRA, fns);
  const worst = Math.max(worst1, worst2);
  console.log(`\nStørste afvigelse fra "manuel opsætning": ${worst.toFixed(2)}s (tolerance ${TOLERANCE_S}s).`);
  console.log(worst <= TOLERANCE_S ? 'SET-BOUNDS-PRESEARCH — GRØN.' : 'SET-BOUNDS-PRESEARCH — FEJL: afvigelse over tolerance.');
  process.exitCode = worst <= TOLERANCE_S ? 0 : 1;
}

main();
