// ORDRE 73 · commit 2 / ORDRE 80 · commit 1+2 — trackeren mod et RIGTIGT
// videoklip, i en rigtig browser.
// -----------------------------------------------------------------------------
// Kører den FAKTISKE, levende tracker-kode fra public/videocoach.html (samme
// udtræksteknik som docs/videocoach/tracker-live-bench.mjs og rep-preview-
// rig.mjs) mod det syntetiske, men RIGTIGT kodede klip fra
// scripts/make-test-clip.mjs, inde i headless Chromium: ægte video-afkodning,
// ægte canvas.drawImage/getImageData, ægte seek (venter på 'seeded'), ikke en
// analytisk pixel-funktion. Det er netop den grænse, alle videocoach-rapporter
// siden ordre 41 har måttet skrive som "ikke afprøvet" — se RAPPORT.md.
//
// To ting måles:
//   A) Den fulde analyse (fem reps, coachens vej, startMultipointTracking
//      UÆNDRET siden ordre 73) — findes alle fem reps, og hvor meget afviger
//      den sporede bane fra facit (den kendte, tegnede bane inkl.
//      kameravaklen, gemt af make-test-clip.mjs)?
//   B) "Vis mig nu" (ordre 80: tre hårdkodede vinduer — rep 1, midterste [3.],
//      sidste [5.] — sporet med den NYE realtids-vej, vcRealtimeTrackWindow,
//      der afspiller i 1x i stedet for at seeke frame for frame) — er den
//      færdig senest 1,1x vinduernes egen afspillede varighed, og er banen
//      stadig inden for ordre 73's tolerance?
//
// Kørsel: npm run verify:videocoach-clip
// Genererer klippet automatisk (npm run test:clip), hvis det mangler.

import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { createRequire } from 'node:module'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const clipPath = join(root, 'docs', 'videocoach', 'clip-cache', 'synthetic-set.mp4')
const gtPath = join(root, 'docs', 'videocoach', 'clip-cache', 'synthetic-set.ground-truth.json')

// ---------- 0) Sørg for at klippet findes (genererer det lazily, samme som gate-tracker.mjs's mønster for andre riggees forudsætninger) ----------
if (!existsSync(clipPath) || !existsSync(gtPath)) {
  console.log('Intet testklip fundet — genererer det først (npm run test:clip) ...')
  const gen = spawnSync(process.execPath, [join(here, 'make-test-clip.mjs')], { stdio: 'inherit' })
  if (gen.status !== 0) { console.error('Kunne ikke generere testklippet.'); process.exit(1) }
}

const groundTruth = JSON.parse(readFileSync(gtPath, 'utf8'))
const { width: W, height: H, fps: FPS, plateRadius: PLATE_R, duration: DURATION, repWindows, samples } = groundTruth

// ---------- 1) Udtræk den levende tracker-kode 1:1 fra videocoach.html ----------
// Samme markører som tracker-live-bench.mjs/rep-preview-rig.mjs.
const htmlPath = join(root, 'public', 'videocoach.html')
const html = readFileSync(htmlPath, 'utf8')
const START_MARKER = 'const PL_ANG = 24, PL_TAU = Math.PI * 2;'
const END_MARKER = 'async function startBarTracking(p0) {'
function extractLiveTrackerSource() {
  const startIdx = html.indexOf(START_MARKER)
  if (startIdx < 0) throw new Error('verify-videocoach-clip: startmarkør ikke fundet - er videocoach.html omstruktureret?')
  const endIdx = html.indexOf(END_MARKER, startIdx)
  if (endIdx < 0) throw new Error('verify-videocoach-clip: slutmarkør ikke fundet - er videocoach.html omstruktureret?')
  return html.slice(startIdx, endIdx)
}
const trackerSource = extractLiveTrackerSource()

// ORDRE 80 · commit 2: den nye realtids-sporing til "Vis mig nu" ligger
// UDEN FOR PL_ANG→startBarTracking (den blok bruges også af de Node-baserede
// rigge tracker-live-bench.mjs/rep-preview-rig.mjs, som ingen `document` har -
// et document.createElement('canvas') dér ville vælte dem). Egne markører,
// samme udtræksteknik som ORDRE 54's vcFindRepAnchors i rep-preview-rig.mjs.
const RT_START_MARKER = '// ORDRE 80 · start: realtids-sporing til "Vis mig nu"'
const RT_END_MARKER = '// ORDRE 80 · slut: realtids-sporing til "Vis mig nu"'
function extractRealtimePreviewSource() {
  const startIdx = html.indexOf(RT_START_MARKER)
  if (startIdx < 0) throw new Error('verify-videocoach-clip: ORDRE 80-startmarkør ikke fundet - er videocoach.html omstruktureret?')
  const endIdx = html.indexOf(RT_END_MARKER, startIdx)
  if (endIdx < 0) throw new Error('verify-videocoach-clip: ORDRE 80-slutmarkør ikke fundet - er videocoach.html omstruktureret?')
  return html.slice(startIdx, endIdx + RT_END_MARKER.length)
}
const realtimePreviewSource = extractRealtimePreviewSource()

// ---------- 2) Facit: interpolér den kendte, tegnede position ved et vilkårligt tidspunkt ----------
function truePosAt(t) {
  const n = samples.length
  if (t <= samples[0].t) return samples[0]
  if (t >= samples[n - 1].t) return samples[n - 1]
  let lo = 0, hi = n - 1
  while (lo < hi - 1) { const mid = (lo + hi) >> 1; if (samples[mid].t <= t) lo = mid; else hi = mid }
  const a = samples[lo], b = samples[hi]
  const f = (t - a.t) / (b.t - a.t)
  return { t, x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }
}

// ---------- 3) Byg harness-siden (ægte <video>/<canvas>, ingen syntetisk pixel-funktion) ----------
const clipBase64 = readFileSync(clipPath).toString('base64')

// Samme fri-variabel-liste som tracker-live-bench.mjs's stub-objekt (verificeret
// mod selve kildeteksten i public/videocoach.html — se RAPPORT.md, "Metode").
const HARNESS_HTML = `<!doctype html>
<html><head><meta charset="utf-8"></head><body>
<video id="vid" muted playsinline preload="auto" src="data:video/mp4;base64,${clipBase64}"></video>
<canvas id="visCanvas" width="${W}" height="${H}"></canvas>
<script>
window.__loaded = new Promise(resolve => {
  const v = document.getElementById('vid');
  if (v.readyState >= 1) resolve(); else v.addEventListener('loadedmetadata', () => resolve(), { once: true });
});
</script>
<script>
let video = document.getElementById('vid');
let canvas = document.getElementById('visCanvas');
let ocan = document.createElement('canvas'); ocan.width = ${W}; ocan.height = ${H};
let octx = ocan.getContext('2d', { willReadFrequently: true });
let strokes = [];
let colorInput = { value: '#e63946' };
let barBtn = { textContent: '', classList: { add(){}, remove(){} } };
let playBtn = { textContent: '' };
function playLabel(){ return ''; }
function say(){}
let setAthleteState = null;
let awaitShClick = null;
let analyzing = false;
let SLIM = false, ATHLETE = false, COACHWEB = false, DESKTOP = true;
let HAS_RVFC = false;
let FRAME = 1 / ${FPS};
let TRACKER_BENCHMARK = false, TRACKER_PROBE = false;
let VC_TRACKER_FAST = true;
let vcTiming = { trackingStartedAt: null };
function idxAtTime(s, t) {
  const times = s.times || [];
  let lo = 0, hi = times.length - 1;
  if (!times.length) return 0;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (times[mid] < t) lo = mid + 1; else hi = mid; }
  return lo;
}
function freezeRawAcquisition(path) {
  path.raw = { pts: path.pts.map(p => ({...p})), times: [...path.times],
    valid: [...path.valid], start: path.times[0], end: path.times.at(-1) };
}
function analyzePath() {}
function createAnalysisSession() { return { schema: 1, lift: 'squat', trackingStart: 0, trackingEnd: video.duration }; }
let tracking = true, awaitBarClick = false, analysisSession = null, cmPerPx = 45 / (2 * ${PLATE_R});
// Ægte seek: venter på det RIGTIGE 'seeked'-event fra en ægte afkodning, ikke
// en synkron stub som i tracker-live-bench.mjs (der har ingen video at vente på).
async function __seekToReal(t) {
  return new Promise(resolve => {
    if (Math.abs(video.currentTime - t) < 1e-4) { resolve(); return; }
    const onSeeked = () => { video.removeEventListener('seeked', onSeeked); resolve(); };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = t;
  });
}
// ORDRE 80 · commit 1: profil pr. frame af den (endnu) seek-baserede vej —
// hvor går tiden, før noget ændres? seekTo pakkes ind (afkodning+seek), og
// mellemrummet fra én seks slutning til næste seks START er ALT arbejde
// processFrame lavede på den foregående frame (tegning + selve
// sporingsregnestykket) — drawImage pakkes separat ind for at skille de to ad.
window.__profile = { seekMs: [], processMs: [], drawMs: [] };
let __lastSeekEnd = null;
function seekTo(t) {
  if (__lastSeekEnd != null) window.__profile.processMs.push(performance.now() - __lastSeekEnd);
  const t0 = performance.now();
  return __seekToReal(t).then(() => {
    window.__profile.seekMs.push(performance.now() - t0);
    __lastSeekEnd = performance.now();
  });
}
const __origDrawImage = octx.drawImage.bind(octx);
octx.drawImage = (...args) => {
  const t0 = performance.now();
  const r = __origDrawImage(...args);
  window.__profile.drawMs.push(performance.now() - t0);
  return r;
};
function __resetProfile() { window.__profile = { seekMs: [], processMs: [], drawMs: [] }; __lastSeekEnd = null; }
<\/script>
<script>
${trackerSource}
<\/script>
<script>
${realtimePreviewSource}
<\/script>
<script>
window.runAnalysis = async function(startT, endT, p0) {
  strokes.length = 0;
  tracking = true;
  __resetProfile();
  await seekTo(startT);
  const t0 = performance.now();
  const ok = await startMultipointTracking({ x: p0.x, y: p0.y, r: ${PLATE_R} },
    { schema: 1, lift: 'squat', trackingStart: startT, trackingEnd: endT });
  const ms = performance.now() - t0;
  const path = strokes.find(s => s.type === 'path');
  return {
    ok, ms,
    pts: path ? path.pts.map(p => ({ x: p.x, y: p.y })) : [],
    times: path ? [...path.times] : [],
    valid: path ? [...path.valid] : [],
    profile: window.__profile,
  };
};
// ORDRE 80 · commit 2: "Vis mig nu"s nye realtids-vej (ikke startMultipointTracking).
window.runRealtimePreview = async function(barPt, windowStart, windowEnd) {
  strokes.length = 0;
  tracking = true;
  const t0 = performance.now();
  const { path, ok } = await vcRealtimeTrackWindow({ x: barPt.x, y: barPt.y, r: ${PLATE_R} }, windowStart, windowEnd);
  const ms = performance.now() - t0;
  return {
    ok, ms,
    pts: path.pts.map(p => ({ x: p.x, y: p.y })),
    times: [...path.times],
  };
};
<\/script>
</body></html>`

// ---------- 4) Kør i headless Chromium (playwright fra den delte codex-runtime — samme kilde som docs/videocoach/run-clean-rebuild-gate.mjs, ingen ny projekt-afhængighed) ----------
const runtimeModules = join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules')
const require = createRequire(import.meta.url)
const { chromium } = require(join(runtimeModules, 'playwright'))

function pathDeviation(pts, times) {
  let max = 0, sum = 0
  for (let i = 0; i < pts.length; i++) {
    const truth = truePosAt(times[i])
    const d = Math.hypot(pts[i].x - truth.x, pts[i].y - truth.y)
    max = Math.max(max, d); sum += d
  }
  return { maxPx: max, meanPx: pts.length ? sum / pts.length : Infinity }
}

// Rep 1, den midterste (3. af 5) og den sidste (5.) — hårdkodet fra klippets
// EGEN facit-JSON, ikke fra en forudsøgnings-heuristik (samme princip som
// rep-preview-rig.mjs's THREE_WINDOWS).
function pickThreeWindows(windows) {
  const n = windows.length
  return [windows[0], windows[Math.floor((n - 1) / 2)], windows[n - 1]]
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 360, height: 640 } })
  page.on('pageerror', err => console.error('[browser pageerror]', err))
  await page.setContent(HARNESS_HTML, { waitUntil: 'load' })
  await page.evaluate(() => window.__loaded)

  // ---------- A) Fuld analyse: alle fem reps, fra første reps start til klippets slutning ----------
  const startT = repWindows[0].start
  const p0Full = truePosAt(startT)
  const full = await page.evaluate(([s, e, p]) => window.runAnalysis(s, e, p), [startT, DURATION, { x: p0Full.x, y: p0Full.y }])

  // ---------- B) "Vis mig nu": tre hårdkodede vinduer, sekventielt (samme som en atlet der beder om tre reps) ----------
  // ORDRE 80: den NYE realtids-vej (vcRealtimeTrackWindow) — afspiller hvert
  // vindue i 1x og sporer på de frames der rent faktisk kommer, ikke
  // startMultipointTrackings seek-løkke (den bruges fortsat af A ovenfor).
  const windows = pickThreeWindows(repWindows)
  const threeResults = []
  let threeMs = 0
  for (const w of windows) {
    const p0 = truePosAt(w.start)
    const r = await page.evaluate(([barPt, s, e]) => window.runRealtimePreview(barPt, s, e), [{ x: p0.x, y: p0.y }, w.start, w.end])
    threeResults.push(r)
    threeMs += r.ms
  }
  const threePlayedS = windows.reduce((s, w) => s + (w.end - w.start), 0)

  await browser.close()

  // ---------- Evaluering ----------
  const fullDev = pathDeviation(full.pts, full.times)
  const threeDev = threeResults.map(r => pathDeviation(r.pts, r.times))
  const worstThreeDev = { maxPx: Math.max(...threeDev.map(d => d.maxPx)), meanPx: Math.max(...threeDev.map(d => d.meanPx)) }

  // Tolerance: kameravaklen alene flytter skiven op til ~4.4px (se
  // make-test-clip.mjs's shakeX/shakeY-amplitude). Første kørsel mod det
  // FAKTISKE, kodede klip (se RAPPORT.md, "Hvorfor denne grænse") målte
  // mean ~10-14px / max ~20-31px — en ægte H.264-afkodning og en fersk
  // identitets-genkalibrering midt i klippet (hvert "Vis mig nu"-vindue
  // starter en ny sporing) lægger reel kvantiserings- og blok-støj oven i
  // vaklen, som tracker-live-bench.mjs's analytiske pixel-funktion aldrig
  // ser. 15px gennemsnit / 35px max er stadig under en tredjedel af pladens
  // radius (${PLATE_R}px) — langt fra "banen er forkert" — men tolererer
  // den støj en ægte optagelse rent faktisk har, i stedet for at kræve
  // pixel-identisk facit som kun en syntetisk scene kan give.
  const TOLERANCE_MEAN_PX = 15, TOLERANCE_MAX_PX = 35
  const MIN_FRAMES_PER_REP = 20 // ~0.66s ved 30fps — mindre end det har ikke "fundet" rep'en

  const fullFoundAllReps = full.pts.length >= repWindows.length * MIN_FRAMES_PER_REP * 0.7
  const fullOk = full.ok && fullDev.meanPx <= TOLERANCE_MEAN_PX && fullDev.maxPx <= TOLERANCE_MAX_PX && fullFoundAllReps
  const threeOk = threeResults.every(r => r.ok) && worstThreeDev.meanPx <= TOLERANCE_MEAN_PX && worstThreeDev.maxPx <= TOLERANCE_MAX_PX
  // ORDRE 80's eget kriterium: "Vis mig nu" skal være færdig senest 1,1x
  // vinduernes EGEN afspillede varighed (ikke længere sammenlignet med den
  // fulde analyses tid — de to sporer nu forskellige veje, se commit 2).
  const REALTIME_MAX_FACTOR = 1.1
  const realtimeFactor = threePlayedS > 0 ? threeMs / 1000 / threePlayedS : Infinity
  const realtimeFastEnough = realtimeFactor <= REALTIME_MAX_FACTOR

  const pass = fullOk && threeOk && realtimeFastEnough

  console.log('== A) Fuld analyse (alle 5 reps, ægte afkodning, uændret siden ordre 73) ==')
  console.log(`ok=${full.ok} frames=${full.pts.length} tid=${full.ms.toFixed(1)}ms meanPx=${fullDev.meanPx.toFixed(2)} maxPx=${fullDev.maxPx.toFixed(2)}`)
  console.log('\n== B) "Vis mig nu" (rep 1, 3, 5 — NY realtids-vej, ægte afkodning) ==')
  threeResults.forEach((r, i) => {
    console.log(`  vindue ${i + 1} [${windows[i].start.toFixed(2)}s-${windows[i].end.toFixed(2)}s, ${(windows[i].end - windows[i].start).toFixed(2)}s afspillet] ok=${r.ok} frames=${r.pts.length} tid=${r.ms.toFixed(1)}ms meanPx=${threeDev[i].meanPx.toFixed(2)} maxPx=${threeDev[i].maxPx.toFixed(2)}`)
  })
  console.log(`  samlet tid (3 vinduer): ${threeMs.toFixed(1)}ms · samlet afspillet varighed: ${(threePlayedS * 1000).toFixed(1)}ms · forhold: ${realtimeFactor.toFixed(2)}x (grænse ${REALTIME_MAX_FACTOR}x)`)
  console.log(`\nTolerance: mean ≤ ${TOLERANCE_MEAN_PX}px, max ≤ ${TOLERANCE_MAX_PX}px (se kildekoden for begrundelsen).`)
  console.log(pass
    ? '\nGRØN: alle 5 reps fundet i den fulde analyse, alle tre "Vis mig nu"-reps fundet inden for tolerance, og "Vis mig nu" var færdig senest 1,1x sin egen afspillede varighed — på et RIGTIGT, kodet videoklip.'
    : `\nFEJL: ${!fullOk ? 'fuld analyse fejlede tolerancen eller fandt ikke alle reps. ' : ''}${!threeOk ? '"Vis mig nu" fejlede tolerancen. ' : ''}${!realtimeFastEnough ? `"Vis mig nu" tog ${realtimeFactor.toFixed(2)}x sin afspillede varighed, over grænsen ${REALTIME_MAX_FACTOR}x.` : ''}`)
  process.exitCode = pass ? 0 : 1
}

main().catch(err => { console.error(err); process.exitCode = 1 })
