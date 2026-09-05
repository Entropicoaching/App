// ORDRE 54 · rep-preview-rig.mjs
// -----------------------------------------------------------------------------
// To ting måles, begge med den LEVENDE kode udtrukket 1:1 fra
// public/videocoach.html (samme teknik som tracker-live-bench.mjs og
// set-bounds-presearch-rig.mjs) - ingen video, ingen browser, intet fra en
// rigtig atlet:
//
//   A) TRÆFSIKKERHED - finder vcFindRepAnchors (ORDRE 54's billige
//      forudsøgning INDENI et sæt) de rigtige gentagelses-pauser i et
//      syntetisk 8-reps-sæt? Og falder den korrekt tilbage (< 3 vinduer),
//      når sættet er "touch-and-go" uden pause mellem reps?
//   B) HASTIGHED - hvor meget hurtigere er det at spore tre gentagelser
//      (første, midt, sidste) end at spore alle otte kontinuerligt, med den
//      SAMME levende startMultipointTracking-kode? Vinduerne her er
//      HÅRDKODEDE fra scenens egen definition (ikke forudsøgningens output),
//      så hastighedstallet er uafhængigt af, hvor præcist forudsøgningen
//      rammer - den del er allerede dækket af (A).
//
// Kørsel: node docs/videocoach/rep-preview-rig.mjs
//
// Se RAPPORT.md ("Ærlige grænser") for hvad dette IKKE måler: en rigtig
// telefons video-afkodning, batteri, eller hvor godt forudsøgningen rammer på
// en ægte optagelse med bare delvis pause mellem reps.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(here, '..', '..', 'public', 'videocoach.html');
const html = readFileSync(htmlPath, 'utf8');

// ---------- 0) Udtræk den levende kode 1:1 ----------
function extractBetween(startMarker, endMarker, label) {
  const startIdx = html.indexOf(startMarker);
  if (startIdx < 0) throw new Error(`rep-preview-rig: startmarkør (${label}) ikke fundet - er videocoach.html omstruktureret?`);
  const endIdx = html.indexOf(endMarker, startIdx);
  if (endIdx < 0) throw new Error(`rep-preview-rig: slutmarkør (${label}) ikke fundet - er videocoach.html omstruktureret?`);
  return html.slice(startIdx, endIdx);
}
const REP_ANCHOR_SRC = extractBetween(
  '// ORDRE 54 · start: billig forudsøgning for GENTAGELSES-grænser',
  '// ORDRE 54 · slut: billig forudsøgning for GENTAGELSES-grænser', 'ORDRE 54 vcFindRepAnchors');
const MOTION_SERIES_SRC = extractBetween(
  '// ORDRE 50 · start: billig forudsøgning for sættets start/slut',
  '// ORDRE 50 · slut: billig forudsøgning for sættets start/slut', 'ORDRE 50 vcMotionSeries');
function loadPresearchFns() {
  const fn = new Function(`${MOTION_SERIES_SRC}\n${REP_ANCHOR_SRC}\nreturn { vcMotionSeries, vcFindRepAnchors };`);
  return fn();
}

const TRACKER_START = 'const PL_ANG = 24, PL_TAU = Math.PI * 2;';
const TRACKER_END = 'async function startBarTracking(p0) {';
function extractLiveTrackerSource() {
  return extractBetween(TRACKER_START, TRACKER_END, 'live tracker');
}

// ---------- 1) Fælles scene-geometri (samme konstanter som tracker-live-bench) ----------
const W = 480, H = 640, PLATE_R = 70, CX = 240, FPS = 30;
function noise2D(x, y) {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return (s - Math.floor(s)) * 20 - 10;
}
function ringBlob(dx, dy, r) { return Math.hypot(dx, dy) < r; }

// 8 gentagelser, jævn ned/op, med en kort pause ved toppen mellem hver -
// realistisk for et bænket/squattet sæt, hvor stangen holdes et øjeblik i
// låst position mellem reps (samme "hjem"-antagelse som ORDRE 43's
// coach-kalibrerede genbrug, se videocoach.html).
const REP_DUR = 1.4, HOLD_DUR = 0.5, CYCLE = REP_DUR + HOLD_DUR, N_REPS = 8;
function poseEightReps(t) {
  const repIndex = Math.min(N_REPS - 1, Math.floor(t / CYCLE));
  const localT = t - repIndex * CYCLE;
  if (localT > REP_DUR) return { cy: 190 };
  const half = REP_DUR / 2;
  const d = localT < half ? localT / half : (REP_DUR - localT) / half;
  return { cy: 190 + 260 * Math.max(0, d) };
}
const EIGHT_REP_DURATION = N_REPS * CYCLE - HOLD_DUR;

// touch-and-go: samme 8 reps, INGEN pause mellem dem (kontinuerlig bølge) -
// den vante hårde case for enhver "find pausen"-heuristik.
function poseTouchAndGo(t) {
  const repIndex = Math.min(N_REPS - 1, Math.floor(t / REP_DUR));
  const localT = t - repIndex * REP_DUR;
  const half = REP_DUR / 2;
  const d = localT < half ? localT / half : (REP_DUR - localT) / half;
  return { cy: 190 + 260 * Math.max(0, d) };
}
const TOUCH_AND_GO_DURATION = N_REPS * REP_DUR;

// Simpel (utekstureret) skive til del A - motion-serien skal måle EGENTLIG
// bevægelse, ikke en roterende teksturs egen mikro-bevægelse. Del B bruger
// buildFullScene nedenfor i stedet, fordi den LEVENDE tracker (mpGoodFeatures)
// kræver tekstur for at finde nok features - samme grund som tracker-live-
// bench.mjs's rigtige scener har den (se docs/videocoach/RAPPORT.md, ORDRE 45).
function buildPlainScene(name, duration, poseAt) {
  return {
    name, duration, poseAt,
    pixel(t, x, y) {
      const { cy } = poseAt(t);
      const bg = 118 + noise2D(x, y) + (x / W) * 18;
      const dx = x - CX, dy = y - cy, r = Math.hypot(dx, dy);
      if (r >= PLATE_R) return Math.max(0, Math.min(255, bg));
      const plate = r < 11 ? 188 : r > PLATE_R - 6 ? 66 : 42;
      return Math.max(0, Math.min(255, plate));
    },
  };
}

function buildFullScene(name, duration, poseAt) {
  return {
    name, duration, poseAt,
    pixel(t, x, y) {
      const { cy } = poseAt(t);
      const bg = 118 + noise2D(x, y) + (x / W) * 18;
      const dx = x - CX, dy = y - cy, r = Math.hypot(dx, dy);
      if (r >= PLATE_R) return Math.max(0, Math.min(255, bg));
      let plate = 42;
      if (r > PLATE_R - 6) plate = 66;
      if (r > PLATE_R * 0.55 && r < PLATE_R * 0.62) plate = 155;
      if (r < 11) plate = 188;
      const theta = t * 2.1;
      for (const phi of [0, Math.PI * 0.9]) {
        const bx = CX + Math.cos(theta + phi) * 14 * (phi ? 2.3 : 1);
        const by = cy + Math.sin(theta + phi) * 14 * (phi ? 2.3 : 1);
        if (ringBlob(x - bx, y - by, 6.5)) plate = 205;
      }
      return Math.max(0, Math.min(255, plate));
    },
  };
}
const sceneEight = buildFullScene('eight_reps_paused', EIGHT_REP_DURATION, poseEightReps);
const sceneTouchAndGo = buildFullScene('eight_reps_touch_and_go', TOUCH_AND_GO_DURATION, poseTouchAndGo);
const scenePlainEight = buildPlainScene('eight_reps_paused_plain', EIGHT_REP_DURATION, poseEightReps);
const scenePlainTouchAndGo = buildPlainScene('eight_reps_touch_and_go_plain', TOUCH_AND_GO_DURATION, poseTouchAndGo);

// ---------- A) Træfsikkerhed: vcFindRepAnchors mod de to scener ----------
const PRESEARCH_W = 48, PRESEARCH_MAX_SAMPLES = 90, FRAME = 1 / FPS;
function runAnchorPresearch(scene, fns) {
  const duration = scene.duration;
  const psH = Math.max(9, Math.round(PRESEARCH_W * (H / W)));
  const stepS = Math.max(0.1, duration / PRESEARCH_MAX_SAMPLES);
  const times = [];
  for (let t = 0; t < duration; t += stepS) times.push(t);
  const lastSafe = Math.max(0, duration - FRAME);
  if (times.length < 2 || times.at(-1) < lastSafe - 0.001) times.push(lastSafe);
  const frames = times.map(t => {
    const g = new Float32Array(PRESEARCH_W * psH);
    for (let y = 0; y < psH; y++)
      for (let x = 0; x < PRESEARCH_W; x++)
        g[y * PRESEARCH_W + x] = scene.pixel(Math.min(t, lastSafe), (x / PRESEARCH_W) * W, (y / psH) * H);
    return g;
  });
  const motion = fns.vcMotionSeries(frames);
  const anchors = fns.vcFindRepAnchors(times, motion);
  const windows = [];
  for (let i = 0; i < anchors.length - 1; i++) windows.push({ start: anchors[i], end: anchors[i + 1] });
  return { anchors, windows };
}

function reportAccuracy(fns) {
  console.log('== A) Træfsikkerhed: vcFindRepAnchors ==');
  const paused = runAnchorPresearch(scenePlainEight, fns);
  const touchAndGo = runAnchorPresearch(scenePlainTouchAndGo, fns);
  console.log(`eight_reps_paused         · ${paused.windows.length} vinduer fundet (forventet ~${N_REPS}, spænd 5-${N_REPS})`);
  console.log(`  ankre (s): ${paused.anchors.map(a => a.toFixed(2)).join(', ')}`);
  console.log(`eight_reps_touch_and_go   · ${touchAndGo.windows.length} vinduer fundet (forventet < 3 - ingen pause at finde)`);
  console.log(`  ankre (s): ${touchAndGo.anchors.map(a => a.toFixed(2)).join(', ')}`);
  const pausedOk = paused.windows.length >= 5 && paused.windows.length <= N_REPS;
  const touchOk = touchAndGo.windows.length < 3;
  console.log(pausedOk ? 'OK: fandt en brugbar rep-opdeling i det pausede sæt' : 'FEJL: for få/for mange vinduer i det pausede sæt');
  console.log(touchOk ? 'OK: faldt korrekt tilbage (< 3 vinduer) for touch-and-go' : 'FEJL: fandt uventet ≥3 vinduer i touch-and-go (ingen reel pause findes)');
  return pausedOk && touchOk;
}

// ---------- B) Hastighed: 8 kontinuerlige reps vs. 3 hårdkodede vinduer ----------
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
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const v = scene.pixel(video.currentTime, x0 + x, y0 + y);
          const i = (y * w + x) * 4;
          out[i] = v; out[i + 1] = v; out[i + 2] = v; out[i + 3] = 255;
        }
      return { data: out };
    },
    drawImage() {},
  };
  return { video, ocan, canvas, octx };
}

function makeTrackerFn(scene) {
  const source = extractLiveTrackerSource();
  const { video, ocan, canvas, octx } = makeEnv(scene);
  const strokes = [];
  const stub = {
    video, ocan, canvas, octx, strokes,
    colorInput: { value: '#e63946' },
    barBtn: { textContent: '', classList: { add() {}, remove() {} } },
    playBtn: { textContent: '' },
    playLabel: () => '',
    say: () => {},
    setAthleteState: null,
    awaitShClick: null,
    analyzing: false,
    SLIM: false, ATHLETE: false, COACHWEB: false, DESKTOP: true,
    HAS_RVFC: false,
    FRAME: 1 / FPS,
    TRACKER_BENCHMARK: false, TRACKER_PROBE: false,
    VC_TRACKER_FAST: true,
    vcTiming: { trackingStartedAt: null },
    idxAtTime(s, t) {
      const times = s.times || [];
      let lo = 0, hi = times.length - 1;
      if (!times.length) return 0;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (times[mid] < t) lo = mid + 1; else hi = mid; }
      return lo;
    },
    freezeRawAcquisition(path) {
      path.raw = { pts: path.pts.map(p => ({ ...p })), times: [...path.times],
        valid: [...path.valid], start: path.times[0], end: path.times.at(-1) };
    },
    analyzePath() {},
    createAnalysisSession() { return { schema: 1, lift: 'squat', trackingStart: 0, trackingEnd: scene.duration }; },
  };
  let tracking = true, awaitBarClick = false, analysisSession = null, cmPerPx = 45 / (2 * PLATE_R);
  let trimEnd = Infinity;
  async function seekTo(t) { video.currentTime = t; }
  const names = [...Object.keys(stub), 'trimEndEff'];
  const values = [...Object.values(stub), () => Math.min(video.duration || Infinity, trimEnd)];
  const fn = new Function(
    ...names, 'tracking_init', 'awaitBarClick_init', 'analysisSession_init', 'cmPerPx_init', 'seekTo',
    `let tracking = tracking_init, awaitBarClick = awaitBarClick_init, analysisSession = analysisSession_init, cmPerPx = cmPerPx_init;\n` +
    source +
    `\nreturn startMultipointTracking;`
  );
  const startMultipointTracking = fn(...values, tracking, awaitBarClick, analysisSession, cmPerPx, seekTo);
  return { startMultipointTracking, video, strokes, setTrimEnd: v => { trimEnd = v; } };
}

async function measureContinuous(scene) {
  const { startMultipointTracking, video, setTrimEnd } = makeTrackerFn(scene);
  setTrimEnd(scene.duration);
  video.currentTime = 0;
  const p0 = { x: CX, y: poseEightReps(0).cy, r: PLATE_R };
  const startedAt = performance.now();
  const ok = await startMultipointTracking(p0, { schema: 1, lift: 'squat', trackingStart: 0, trackingEnd: scene.duration });
  return { ok, ms: performance.now() - startedAt };
}

async function measureThreeWindows(scene, windows) {
  const { startMultipointTracking, video, setTrimEnd } = makeTrackerFn(scene);
  const startedAt = performance.now();
  let allOk = true;
  for (const w of windows) {
    setTrimEnd(w.end);
    video.currentTime = w.start;
    const p0 = { x: CX, y: poseEightReps(w.start).cy, r: PLATE_R };
    const ok = await startMultipointTracking(p0, { schema: 1, lift: 'squat', trackingStart: w.start, trackingEnd: w.end });
    allOk = allOk && ok;
  }
  return { ok: allOk, ms: performance.now() - startedAt };
}

// Hårdkodet fra scenens EGEN definition (rep 1, rep 4 [0-indeks 3, "midt" af
// 8], rep 8) - IKKE fra forudsøgningens output, se filhovedet.
const THREE_WINDOWS = [
  { start: 0 * CYCLE, end: 0 * CYCLE + REP_DUR + 0.15 },
  { start: 3 * CYCLE, end: 3 * CYCLE + REP_DUR + 0.15 },
  { start: 7 * CYCLE, end: 7 * CYCLE + REP_DUR },
];

async function reportSpeed() {
  console.log('\n== B) Hastighed: 8 reps kontinuerligt vs. 3 hårdkodede vinduer ==');
  const full = await measureContinuous(sceneEight);
  const three = await measureThreeWindows(sceneEight, THREE_WINDOWS);
  const factor = full.ms > 0 ? full.ms / Math.max(0.001, three.ms) : null;
  console.log(`8 reps kontinuerligt   · ${full.ms.toFixed(1)}ms · ok=${full.ok}`);
  console.log(`3 reps (1., midt, 8.)  · ${three.ms.toFixed(1)}ms · ok=${three.ok}`);
  console.log(`Forhold (målestoks-tid, IKKE et rigtig-video-sekund-estimat): ${factor ? factor.toFixed(2) + 'x' : '-'}`);
  console.log('Se RAPPORT.md for ekstrapolering til Marcs målte 2-3 minutter på en rigtig telefon.');
  return { fullMs: full.ms, threeMs: three.ms, factor };
}

async function main() {
  const fns = loadPresearchFns();
  const accuracyOk = reportAccuracy(fns);
  const speed = await reportSpeed();
  const jsonOnly = process.argv.includes('--json');
  if (jsonOnly) {
    console.log('\n' + JSON.stringify({ accuracyOk, speed }, null, 2));
  }
  console.log('\n' + (accuracyOk ? 'REP-PREVIEW-RIG — GRØN.' : 'REP-PREVIEW-RIG — FEJL: se rødt ovenfor.'));
  process.exitCode = accuracyOk ? 0 : 1;
}

main();
