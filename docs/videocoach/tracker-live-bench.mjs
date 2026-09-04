// ORDRE 45 · tracker-live-bench.mjs
// -----------------------------------------------------------------------------
// Målestokken for tracker-hastighedsordren. I modsætning til de øvrige rigge i
// denne mappe kører denne den FAKTISKE, levende tracker-kode fra
// public/videocoach.html (startMultipointTracking + mp*/pl*-hjælpefunktionerne)
// - ikke en hen-porteret kopi, og ikke kun en kildetekst-kontrol. Koden trækkes
// ud af HTML-filen ved opstart og køres i ren Node mod deterministiske,
// syntetiske frames (ingen video, ingen browser, intet fra en rigtig atlet).
//
// Kørsel:
//   node docs/videocoach/tracker-live-bench.mjs              (sammenlign mod baseline)
//   node docs/videocoach/tracker-live-bench.mjs --write-baseline   (kun i commit 1)
//   node docs/videocoach/tracker-live-bench.mjs --json        (maskinlæsbart resumé, ingen exit ved afvigelse)
//
// Se RAPPORT.md for hvorfor disse tre scenarier + et fjerde bonus-scenarie blev
// valgt, og hvad de IKKE fanger sammenlignet med en rigtig optagelse.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(here, '..', '..', 'public', 'videocoach.html');
const baselinePath = join(here, 'tracker-live-bench.baseline.json');
const html = readFileSync(htmlPath, 'utf8');

// ---------- 1) Udtræk den levende tracker-kode 1:1 fra videocoach.html ----------
// Blokken starter ved PL_ANG (plade-identitetsvagtens konstanter) og slutter
// lige før startBarTracking (den GAMLE, uafhængige encentrums-tracker, som
// ikke er en del af denne ordre - se RAPPORT.md om hvorfor de eksisterende
// tracker-testrig.js/tracker-freeze-rig.js tester netop den døde funktion).
const START_MARKER = 'const PL_ANG = 24, PL_TAU = Math.PI * 2;';
const END_MARKER = 'async function startBarTracking(p0) {';
function extractLiveTrackerSource() {
  const startIdx = html.indexOf(START_MARKER);
  if (startIdx < 0) throw new Error('tracker-live-bench: startmarkør ikke fundet - er videocoach.html omstruktureret?');
  const endIdx = html.indexOf(END_MARKER, startIdx);
  if (endIdx < 0) throw new Error('tracker-live-bench: slutmarkør ikke fundet - er videocoach.html omstruktureret?');
  return html.slice(startIdx, endIdx);
}

// ---------- 2) Byg et minimalt DOM/canvas-stub-miljø ----------
// Alt der IKKE er selve tracker-algoritmen (video-element, canvas, statustekst,
// knapper) stubbes. octx.getImageData beregner pixler analytisk fra scenens
// definition i stedet for at rendere en fuld buffer pr. frame - hurtigere og
// enklere end at genbruge de ældre riggees fulde frame-buffere.
const W = 480, H = 640;

function makeEnv(scene) {
  const video = {
    currentTime: 0, duration: scene.duration, videoWidth: W, videoHeight: H,
    playbackRate: 1, muted: false, paused: true, ended: false,
    play() { this.paused = false; return Promise.resolve(); },
    pause() { this.paused = true; },
  };
  const ocan = { width: W, height: H };
  const canvas = { width: W, height: H };
  const octx = {
    getImageData(x0, y0, w, h) {
      const out = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const v = scene.pixel(video.currentTime, x0 + x, y0 + y);
          const i = (y * w + x) * 4;
          out[i] = v; out[i + 1] = v; out[i + 2] = v; out[i + 3] = 255;
        }
      }
      return { data: out };
    },
    drawImage() {},   // scenen læses direkte via video.currentTime, intet at tegne
  };
  return { video, ocan, canvas, octx };
}

// ---------- 3) De syntetiske scenarier ----------
// Deterministisk fra et frø (Math.sin-baseret støj, ingen Math.random) - kan
// køres igen om et halvt år og give nøjagtig samme tal.
function noise2D(x, y) {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return (s - Math.floor(s)) * 20 - 10;
}
function ringBlob(dx, dy, r) { return Math.hypot(dx, dy) < r; }

// FPS=30, PLATE_R=70. Kamera statisk, skive bevæger sig kun lodret (som et
// ægte squat/dødløft-klip filmet fra siden ville gøre, når rammen er stabil).
const PLATE_R = 70, CX = 240, FPS = 30;

function buildScene({ name, duration, poseAt, contrastAt = () => 1 }) {
  return {
    name, duration,
    poseAt,
    pixel(t, x, y) {
      const { cy } = poseAt(t);
      const cx = CX;
      const bg = 118 + noise2D(x, y) + (x / W) * 18;
      const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy);
      const contrast = contrastAt(t);
      let plate = null;
      if (r < PLATE_R) {
        plate = 42;
        if (r > PLATE_R - 6) plate = 66;
        if (r > PLATE_R * 0.55 && r < PLATE_R * 0.62) plate = 155;
        if (r < 11) plate = 188;
        const theta = t * 2.1;   // roterende tekstur = feature-rig overflade
        for (const phi of [0, Math.PI * 0.9]) {
          const bx = cx + Math.cos(theta + phi) * 14 * (phi ? 2.3 : 1);
          const by = cy + Math.sin(theta + phi) * 14 * (phi ? 2.3 : 1);
          if (ringBlob(x - bx, y - by, 6.5)) plate = 205;
        }
      }
      if (plate == null) return Math.max(0, Math.min(255, bg));
      // lav-kontrast-scenariet trækker pladens værdi imod baggrunden
      const blended = bg + (plate - bg) * contrast;
      return Math.max(0, Math.min(255, blended));
    },
  };
}

// et rent sæt: én rep, jævn ned/op, fuld kontrast hele vejen
function poseCleanSingle(t) {
  const repT = Math.max(0, Math.min(1, t / 1.6));
  const d = repT < 0.5 ? repT / 0.5 : (1 - repT) / 0.5;
  return { cy: 190 + 260 * d };
}
const sceneClean = buildScene({ name: 'clean_single_rep', duration: 1.6, poseAt: poseCleanSingle });

// lav kontrast i bunden: samme bane, men kontrasten falder til 28% i den
// nederste tredjedel (skygge/mørk baggrund ved gulvet - Marcs egen beskrivelse)
function contrastBottomFade(t) {
  const { cy } = poseCleanSingle(t);
  const depth = (cy - 190) / 260;   // 0 = top, 1 = bund
  return depth > 0.6 ? 0.28 + (1 - depth) * 0.2 : 1;
}
const sceneLowContrast = buildScene({
  name: 'low_contrast_bottom', duration: 1.6, poseAt: poseCleanSingle, contrastAt: contrastBottomFade,
});

// flere reps: tre reps med forskellig dybde (samme mønster som ordre 43's
// median-rep-test), så banen skal følges gennem to fulde vendinger
function poseMultiRep(t) {
  const repDur = 1.5, reps = [260, 300, 265];
  const repIndex = Math.min(reps.length - 1, Math.floor(t / repDur));
  const localT = (t - repIndex * repDur) / repDur;
  const d = localT < 0.5 ? localT / 0.5 : (1 - localT) / 0.5;
  return { cy: 190 + reps[repIndex] * Math.max(0, d) };
}
const sceneMultiRep = buildScene({ name: 'multi_rep', duration: 1.5 * 3, poseAt: poseMultiRep });

// bonus: kortvarig okklusion midt i nedturen (en hånd/rack-kant der glider hen
// over skiven i ca. 4 frames) - stresser identitets-/hjemme-genfindingsstien i
// startMultipointTracking, som INGEN eksisterende rig i denne mappe rører ved
// (se RAPPORT.md - de eksisterende frys-rigge tester den gamle, døde tracker).
function buildOcclusionScene() {
  const base = buildScene({ name: 'brief_occlusion', duration: 1.6, poseAt: poseCleanSingle });
  const occlStart = 0.62, occlEnd = 0.78;
  return {
    ...base,
    pixel(t, x, y) {
      const v = base.pixel(t, x, y);
      if (t >= occlStart && t <= occlEnd) {
        const { cy } = poseCleanSingle(t);
        if (y > cy - 10 && y < cy + PLATE_R + 20) return 30;   // mørk bjælke glider hen over
      }
      return v;
    },
  };
}
const sceneOcclusion = buildOcclusionScene();

const SCENARIOS = [sceneClean, sceneLowContrast, sceneMultiRep, sceneOcclusion];

// ---------- 4) Kør trackeren mod ét scenarie ----------
async function runScenario(scene) {
  const source = extractLiveTrackerSource();
  const { video, ocan, canvas, octx } = makeEnv(scene);
  const strokes = [];
  const stubSay = () => {};
  const noopAsync = async () => {};
  const stub = {
    video, ocan, canvas, octx, strokes,
    colorInput: { value: '#e63946' },
    barBtn: { textContent: '', classList: { add() {}, remove() {} } },
    playBtn: { textContent: '' },
    playLabel: () => '',
    say: stubSay,
    setAthleteState: null,
    analyzing: false,
    SLIM: false, ATHLETE: false, COACHWEB: false, DESKTOP: true,
    HAS_RVFC: false,
    FRAME: 1 / FPS,
    TRACKER_BENCHMARK: false, TRACKER_PROBE: false,
    vcTiming: { trackingStartedAt: null },
    idxAtTime(s, t) {
      const times = s.times || [];
      let lo = 0, hi = times.length - 1;
      if (!times.length) return 0;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (times[mid] < t) lo = mid + 1; else hi = mid;
      }
      return lo;
    },
    freezeRawAcquisition(path) {
      // Kun rå acquisition er interessant her - post-processing (glatning,
      // rep-detektion) hører til analyseCleanPath, ikke selve trackeren.
      path.raw = { pts: path.pts.map(p => ({ ...p })), times: [...path.times],
        valid: [...path.valid], start: path.times[0], end: path.times.at(-1) };
    },
    analyzePath() {},
    createAnalysisSession() { return { schema: 1, lift: 'squat', trackingStart: 0, trackingEnd: scene.duration }; },
  };
  let tracking = true, awaitBarClick = false, analysisSession = null, cmPerPx = 45 / (2 * PLATE_R);
  // seekTo lokal til riggen: den ægte version venter på video-elementets
  // 'seeked'-event, som intet stub-<video> her udsender.
  async function seekTo(t) { video.currentTime = t; }

  const names = Object.keys(stub);
  const values = names.map(n => stub[n]);
  const fn = new Function(
    ...names, 'tracking_init', 'awaitBarClick_init', 'analysisSession_init', 'cmPerPx_init', 'seekTo',
    `let tracking = tracking_init, awaitBarClick = awaitBarClick_init, analysisSession = analysisSession_init, cmPerPx = cmPerPx_init;\n` +
    source +
    `\nreturn startMultipointTracking;`
  );
  const startMultipointTracking = fn(...values, tracking, awaitBarClick, analysisSession, cmPerPx, seekTo);

  const p0 = { x: CX, y: poseAtStart(scene), r: PLATE_R };
  const session = { schema: 1, lift: 'squat', trackingStart: 0, trackingEnd: scene.duration };

  const wallStart = performance.now();
  const ok = await startMultipointTracking(p0, session, {});
  const wallMs = performance.now() - wallStart;

  const path = strokes.find(s => s.type === 'path');
  return { name: scene.name, ok, wallMs, path, duration: scene.duration };
}
function poseAtStart(scene) { return scene.poseAt(0).cy; }

// ---------- 5) Kør alle scenarier, sammenlign mod baseline eller skriv én ----------
function summarizePath(path) {
  if (!path) return null;
  return {
    frames: path.pts.length,
    pts: path.pts.map(p => ({ x: +p.x.toFixed(3), y: +p.y.toFixed(3) })),
    times: path.times.map(t => +t.toFixed(4)),
    valid: [...path.valid],
    lowConf: path.lowConf || 0,
    homeRecoveries: path.homeRecoveries || 0,
  };
}

function pathDeviation(a, b) {
  if (!a || !b) return { maxPx: Infinity, meanPx: Infinity, frameCountDiff: a && b ? 0 : Infinity };
  const n = Math.min(a.pts.length, b.pts.length);
  let max = 0, sum = 0, counted = 0;
  for (let i = 0; i < n; i++) {
    const d = Math.hypot(a.pts[i].x - b.pts[i].x, a.pts[i].y - b.pts[i].y);
    max = Math.max(max, d); sum += d; counted++;
  }
  return { maxPx: max, meanPx: counted ? sum / counted : 0, frameCountDiff: a.pts.length - b.pts.length };
}

// snæver tolerance: valgt FØR nogen optimering blev rørt (se RAPPORT.md commit 1).
// 0 px for uændret kode (deterministisk), men frame-spring/interpolation i
// senere commits kan lovligt indføre INTERPOLEREDE punkter - tolerancen er
// derfor sat til at fange reel banedrift, ikke pixel-for-pixel identisk output.
const TOLERANCE_MAX_PX = 1.5;
const TOLERANCE_MEAN_PX = 0.5;

async function main() {
  const args = process.argv.slice(2);
  const writeBaseline = args.includes('--write-baseline');
  const jsonOnly = args.includes('--json');
  const results = [];
  for (const scene of SCENARIOS) {
    const r = await runScenario(scene);
    results.push(r);
  }

  const summary = {};
  for (const r of results) summary[r.name] = { ok: r.ok, wallMs: +r.wallMs.toFixed(2), path: summarizePath(r.path) };

  if (writeBaseline) {
    writeFileSync(baselinePath, JSON.stringify(summary, null, 2) + '\n');
    if (!jsonOnly) console.log(`Baseline skrevet: ${baselinePath}`);
    return;
  }

  if (!existsSync(baselinePath)) {
    console.error('Ingen baseline fundet - kør med --write-baseline først (kun commit 1 skal gøre dette).');
    process.exitCode = 1;
    return;
  }
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  let failed = false;
  const rows = [];
  for (const r of results) {
    const base = baseline[r.name];
    if (!base) { rows.push({ name: r.name, status: 'INGEN BASELINE', wallMs: r.wallMs }); failed = true; continue; }
    const dev = pathDeviation(base.path, summarizePath(r.path));
    const beforeMs = base.wallMs, afterMs = r.wallMs;
    const factor = beforeMs > 0 ? beforeMs / Math.max(0.001, afterMs) : null;
    const okPath = dev.maxPx <= TOLERANCE_MAX_PX && dev.meanPx <= TOLERANCE_MEAN_PX && dev.frameCountDiff === 0;
    const okOutcome = r.ok === base.ok;
    const pass = okPath && okOutcome;
    if (!pass) failed = true;
    rows.push({
      name: r.name, status: pass ? 'OK' : 'AFVIGELSE',
      beforeMs: +beforeMs.toFixed(1), afterMs: +afterMs.toFixed(1),
      factor: factor ? +factor.toFixed(2) : null,
      maxPx: +dev.maxPx.toFixed(3), meanPx: +dev.meanPx.toFixed(3),
      frameCountDiff: dev.frameCountDiff, ok: r.ok,
    });
  }

  if (jsonOnly) {
    console.log(JSON.stringify({ pass: !failed, rows }, null, 2));
  } else {
    console.log('scenarie'.padEnd(20), 'status'.padEnd(11), 'før(ms)'.padStart(9), 'efter(ms)'.padStart(10),
      'faktor'.padStart(8), 'maxPx'.padStart(8), 'meanPx'.padStart(8), 'frames∆'.padStart(9));
    for (const row of rows) {
      console.log(
        row.name.padEnd(20), row.status.padEnd(11),
        (row.beforeMs ?? '-').toString().padStart(9), (row.afterMs ?? '-').toString().padStart(10),
        (row.factor ?? '-').toString().padStart(8), (row.maxPx ?? '-').toString().padStart(8),
        (row.meanPx ?? '-').toString().padStart(8), (row.frameCountDiff ?? '-').toString().padStart(9));
    }
    console.log(failed
      ? `\nFEJL: banen afviger ud over tolerancen (max ${TOLERANCE_MAX_PX}px / mean ${TOLERANCE_MEAN_PX}px) i mindst ét scenarie.`
      : `\nGRØN: alle ${rows.length} scenarier inden for tolerance (max ${TOLERANCE_MAX_PX}px / mean ${TOLERANCE_MEAN_PX}px).`);
  }
  process.exitCode = failed ? 1 : 0;
}

main();
