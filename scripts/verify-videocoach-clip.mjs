// ORDRE 73 · commit 2 / ORDRE 80 · commit 1+2 / ORDRE 82 · commit 1 — trackeren
// mod et RIGTIGT videoklip, i en rigtig browser.
// -----------------------------------------------------------------------------
// Kører den FAKTISKE, levende tracker-kode fra public/videocoach.html (samme
// udtræksteknik som docs/videocoach/tracker-live-bench.mjs og rep-preview-
// rig.mjs) i headless Chromium: ægte video-afkodning, ægte canvas.drawImage/
// getImageData, ægte seek (venter på 'seeded'), ikke en analytisk pixel-funktion.
//
// ORDRE 82: Marcs egen måling på telefonen viste at det tegnede klip (ordre 73)
// er for nemt og gav et FALSK billede — pænere bane og bedre forhold end en
// rigtig optagelse. Dette script kører derfor nu mod et RIGTIGT klip, hvis ét
// findes:
//
//   test-clips\<navn>.mp4        - Marcs egen telefonoptagelse (git-ignoreret,
//                                  ham selv, ikke en atlet — se .gitignore)
//   test-clips\<navn>.meta.json  - påkrævet sidecar, samme <navn>, format:
//       {
//         "barPoint": { "x": 540, "y": 810 },   // pixel i videoens EGEN
//                                                 // opløsning, skivens centrum
//                                                 // ved starten af FØRSTE vindue
//         "plateRadius": 90,                     // valgfri; ellers videoens
//                                                 // bredde / 16 (samme
//                                                 // fallback som selve
//                                                 // trackeren bruger)
//         "windows": [ { "start": 1.2, "end": 3.6 }, ... ]  // ét pr. gentagelse,
//                                                             // sekunder, i den
//                                                             // rigtige videos
//                                                             // egen tidslinje
//       }
//   Hvorfor en sidecar og ikke automatisk detektion: et headless script kan
//   ikke "se" hvor skiven er eller hvor gentagelserne starter/slutter på en
//   RIGTIG optagelse uden gæt — og et forkert gæt ville give tal der ser
//   rigtige ud, men ikke er det (præcis den fælde ordre 82 blev skrevet for at
//   undgå). Findes ingen .mp4 i test-clips\, eller mangler/er sidecar'en
//   ufuldstændig, falder scriptet ÆRLIGT tilbage til det tegnede klip og siger
//   det tydeligt — det stopper ikke.
//
// Facit for "Vis mig nu" (den hurtige vej): på et RIGTIGT klip findes ingen
// uafhængig sandhed (ingen kendt, tegnet bane) — derfor bruges her den FULDE
// analyses egen sporede bane som facit, sådan som ordre 82 beder om. På det
// tegnede klip bruges fortsat den kendte, tegnede bane (strengere facit, som
// ikke selv kan have sporingsfejl).
//
// Målt PR. VINDUE (ordre 82 · commit 1's egentlige leverance — tallene FØR
// noget ændres): frames sporet, frames sprunget over, ms/frame, tid mod
// afspillet varighed, afvigelse (mean/max px) og antal "hop" (se countHops
// nedenfor for definition og begrundelse af grænsen).
//
// Kørsel: npm run verify:videocoach-clip
// Genererer det tegnede klip automatisk (npm run test:clip), hvis det mangler
// OG intet rigtigt klip er lagt i test-clips\.

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { createRequire } from 'node:module'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const syntheticClipPath = join(root, 'docs', 'videocoach', 'clip-cache', 'synthetic-set.mp4')
const syntheticGtPath = join(root, 'docs', 'videocoach', 'clip-cache', 'synthetic-set.ground-truth.json')
const testClipsDir = join(root, 'test-clips')

// ---------- 0) Rigtigt klip eller det tegnede? ----------
function findRealClip() {
  if (!existsSync(testClipsDir)) return null
  const files = readdirSync(testClipsDir).filter(f => /\.mp4$/i.test(f)).sort()
  if (files.length > 1) console.log(`Bemærk: ${files.length} mp4-filer fundet i test-clips\\ — bruger den alfabetisk første ("${files[0]}").`)
  return files[0] || null
}
function loadRealMeta(mp4Name) {
  const base = mp4Name.replace(/\.mp4$/i, '')
  const metaPath = join(testClipsDir, `${base}.meta.json`)
  if (!existsSync(metaPath)) return { ok: false, reason: `mangler ${base}.meta.json ved siden af klippet (se formatet øverst i dette script)` }
  let meta
  try { meta = JSON.parse(readFileSync(metaPath, 'utf8')) }
  catch (e) { return { ok: false, reason: `${base}.meta.json er ikke gyldig JSON (${e.message})` } }
  if (!meta.barPoint || typeof meta.barPoint.x !== 'number' || typeof meta.barPoint.y !== 'number')
    return { ok: false, reason: `${base}.meta.json mangler barPoint {x,y}` }
  if (!Array.isArray(meta.windows) || !meta.windows.length || meta.windows.some(w => !(w.end > w.start)))
    return { ok: false, reason: `${base}.meta.json mangler windows: [{start,end}, ...] (mindst ét, start<end)` }
  return { ok: true, meta }
}

let mode = 'synthetic', clipPath = syntheticClipPath, realMeta = null, realClipName = null
const foundReal = findRealClip()
if (foundReal) {
  const check = loadRealMeta(foundReal)
  if (check.ok) { mode = 'real'; clipPath = join(testClipsDir, foundReal); realMeta = check.meta; realClipName = foundReal }
  else console.log(`Fandt test-clips\\${foundReal}, men ${check.reason} — kører mod det tegnede klip i stedet.`)
} else {
  console.log('Intet klip i test-clips\\ endnu — venter på Marcs rigtige telefonoptagelse. Kører mod det tegnede klip (docs/videocoach/clip-cache/synthetic-set.mp4).')
}

if (mode === 'synthetic' && (!existsSync(syntheticClipPath) || !existsSync(syntheticGtPath))) {
  console.log('Intet tegnet testklip fundet — genererer det først (npm run test:clip) ...')
  const gen = spawnSync(process.execPath, [join(here, 'make-test-clip.mjs')], { stdio: 'inherit' })
  if (gen.status !== 0) { console.error('Kunne ikke generere testklippet.'); process.exit(1) }
}

const groundTruth = mode === 'synthetic' ? JSON.parse(readFileSync(syntheticGtPath, 'utf8')) : null

// ---------- 1) Udtræk den levende tracker-kode 1:1 fra videocoach.html ----------
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

// ---------- 2) Facit: interpolér en kendt bane (samples-liste ELLER en sporet bane) ved et vilkårligt tidspunkt ----------
function truePosAt(t) {
  const samples = groundTruth.samples
  const n = samples.length
  if (t <= samples[0].t) return samples[0]
  if (t >= samples[n - 1].t) return samples[n - 1]
  let lo = 0, hi = n - 1
  while (lo < hi - 1) { const mid = (lo + hi) >> 1; if (samples[mid].t <= t) lo = mid; else hi = mid }
  const a = samples[lo], b = samples[hi]
  const f = (t - a.t) / (b.t - a.t)
  return { t, x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }
}
// ORDRE 82: på et rigtigt klip findes ingen kendt bane — facit ER den fulde
// analyses egen sporede bane (times/pts), interpoleret på samme måde.
function makePathInterpolator(times, pts) {
  const n = times.length
  return function at(t) {
    if (!n) return { x: 0, y: 0 }
    if (t <= times[0]) return pts[0]
    if (t >= times[n - 1]) return pts[n - 1]
    let lo = 0, hi = n - 1
    while (lo < hi - 1) { const mid = (lo + hi) >> 1; if (times[mid] <= t) lo = mid; else hi = mid }
    const f = (t - times[lo]) / (times[hi] - times[lo])
    return { x: pts[lo].x + (pts[hi].x - pts[lo].x) * f, y: pts[lo].y + (pts[hi].y - pts[lo].y) * f }
  }
}

// ---------- 3) Byg harness-siden (ægte <video>/<canvas>, ingen syntetisk pixel-funktion) ----------
const clipBase64 = readFileSync(clipPath).toString('base64')

const HARNESS_HTML = `<!doctype html>
<html><head><meta charset="utf-8"></head><body>
<video id="vid" muted playsinline preload="auto" src="data:video/mp4;base64,${clipBase64}"></video>
<canvas id="visCanvas"></canvas>
<script>
window.__loaded = new Promise(resolve => {
  const v = document.getElementById('vid');
  if (v.readyState >= 1) resolve(); else v.addEventListener('loadedmetadata', () => resolve(), { once: true });
});
</script>
<script>
let video = document.getElementById('vid');
let canvas = document.getElementById('visCanvas');
let ocan = document.createElement('canvas');
let octx = ocan.getContext('2d', { willReadFrequently: true });
// ORDRE 82: klippets opløsning kendes først når metadata er indlæst (kan være
// et rigtigt klip i en hvilken som helst opløsning, ikke kun det tegnede
// klips faste 720x1280) - canvas'ene sættes derfor herfra, ikke i markup'en.
let cmPerPx = 1;
window.__initCanvas = function(w, h, plateR) {
  canvas.width = w; canvas.height = h;
  ocan.width = w; ocan.height = h;
  cmPerPx = 45 / (2 * plateR);
};
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
// Samme faste antagelse som selve appen (public/videocoach.html linje ~1750:
// "const FRAME = 1 / 30;") - bruges kun som seek-skridtlængde/gap-grænse, ikke
// som en påstand om klippets faktiske fps, og er derfor rigtig for ethvert
// rigtigt klip på samme måde som for det tegnede.
let FRAME = 1 / 30;
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
let tracking = true, awaitBarClick = false, analysisSession = null;
async function __seekToReal(t) {
  return new Promise(resolve => {
    if (Math.abs(video.currentTime - t) < 1e-4) { resolve(); return; }
    const onSeeked = () => { video.removeEventListener('seeked', onSeeked); resolve(); };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = t;
  });
}
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
  const ok = await startMultipointTracking({ x: p0.x, y: p0.y, r: p0.r },
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
  const { path, ok } = await vcRealtimeTrackWindow({ x: barPt.x, y: barPt.y, r: barPt.r }, windowStart, windowEnd);
  const ms = performance.now() - t0;
  return {
    ok, ms,
    pts: path.pts.map(p => ({ x: p.x, y: p.y })),
    times: [...path.times],
    valid: [...path.valid],
  };
};
<\/script>
</body></html>`

// ---------- 4) Kør i headless Chromium (playwright fra den delte codex-runtime — samme kilde som docs/videocoach/run-clean-rebuild-gate.mjs, ingen ny projekt-afhængighed) ----------
const runtimeModules = join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules')
const require = createRequire(import.meta.url)
const { chromium } = require(join(runtimeModules, 'playwright'))

function deviation(pts, times, truthFn) {
  let max = 0, sum = 0
  for (let i = 0; i < pts.length; i++) {
    const truth = truthFn(times[i])
    const d = Math.hypot(pts[i].x - truth.x, pts[i].y - truth.y)
    max = Math.max(max, d); sum += d
  }
  return { maxPx: max, meanPx: pts.length ? sum / pts.length : Infinity }
}

// ORDRE 82 · commit 1: "hop" = frame-til-frame-hastighed (px/s, ikke rå px —
// vinduer har forskellig varighed) der er hurtigere end skiven NOGENSINDE
// beviseligt bevæger sig i netop dette klip. Grænsen er derfor selvkalibrerende
// pr. klip: 95-percentilen af facits egen frame-til-frame-hastighed (den
// hurtigste plausible fase, fx bunden af et squat), ganget 2.5 for at rumme
// ægte eksplosive faser uden at kalde dem hop, med et gulv på 200px/s så et
// næsten stillestående facit (fx et kort vindue) ikke gør enhver bevægelse til
// et "hop". Det fanger netop den slags falske diskontinuitet frame-spring +
// lineær interpolation kan producere, uden at kræve pixel-identisk facit.
function countHops(pts, times, truthFn) {
  const step = 1 / 30
  const speeds = []
  for (let t = times[0]; t < times.at(-1); t += step) {
    const a = truthFn(t), b = truthFn(t + step)
    speeds.push(Math.hypot(b.x - a.x, b.y - a.y) / step)
  }
  speeds.sort((a, b) => a - b)
  const p95 = speeds.length ? speeds[Math.floor(speeds.length * 0.95)] : 0
  const hopSpeedPxS = Math.max(200, p95 * 2.5)
  let hops = 0
  for (let i = 1; i < pts.length; i++) {
    const dt = Math.max(1e-3, times[i] - times[i - 1])
    const speed = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y) / dt
    if (speed > hopSpeedPxS) hops++
  }
  return { hops, hopSpeedPxS }
}

function frameStats(r, w) {
  const perFrame = r.valid.slice(1) // ekskl. det indledende, allerede kendte startpunkt
  const framesTracked = perFrame.filter(Boolean).length
  const framesSkipped = perFrame.length - framesTracked
  const totalFrames = perFrame.length || 1
  const msPerFrame = r.ms / totalFrames
  const playedS = w.end - w.start
  const timeRatio = playedS > 0 ? (r.ms / 1000) / playedS : Infinity
  return { framesTracked, framesSkipped, msPerFrame, timeRatio, playedS }
}

// Rep 1, den midterste (3. af 5) og den sidste (5.) — hårdkodet fra klippets
// EGEN vinduesliste (facit-JSON for det tegnede klip, sidecar-JSON for et
// rigtigt), ikke fra en forudsøgnings-heuristik.
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

  const windows = mode === 'synthetic' ? groundTruth.repWindows : realMeta.windows
  const dims = await page.evaluate(() => ({ w: video.videoWidth, h: video.videoHeight }))
  const plateR = mode === 'synthetic' ? groundTruth.plateRadius : (realMeta.plateRadius || Math.round(dims.w / 16))
  await page.evaluate(([w, h, r]) => window.__initCanvas(w, h, r), [dims.w, dims.h, plateR])

  const p0Truth = mode === 'synthetic' ? truePosAt : null // sat efter den fulde analyse i 'real'-tilstand

  // ---------- A) Fuld analyse: alle reps, fra første vindues start til klippets slutning (tegnet) / sidste vindues slutning (rigtigt) ----------
  const startT = windows[0].start
  const endT = mode === 'synthetic' ? groundTruth.duration : windows.at(-1).end
  const p0Full = mode === 'synthetic' ? truePosAt(startT) : realMeta.barPoint
  const full = await page.evaluate(([s, e, p]) => window.runAnalysis(s, e, p), [startT, endT, { x: p0Full.x, y: p0Full.y, r: plateR }])

  const truthFn = mode === 'synthetic' ? truePosAt : makePathInterpolator(full.times, full.pts)

  // ---------- B) "Vis mig nu": tre hårdkodede vinduer, sekventielt (samme som en atlet der beder om tre reps) ----------
  const threeWindows = pickThreeWindows(windows)
  const threeResults = []
  let threeMs = 0
  for (const w of threeWindows) {
    const p0 = truthFn(w.start)
    const r = await page.evaluate(([barPt, s, e]) => window.runRealtimePreview(barPt, s, e), [{ x: p0.x, y: p0.y, r: plateR }, w.start, w.end])
    threeResults.push(r)
    threeMs += r.ms
  }
  const threePlayedS = threeWindows.reduce((s, w) => s + (w.end - w.start), 0)

  await browser.close()

  // ---------- Evaluering ----------
  const fullDev = deviation(full.pts, full.times, truthFn)
  const threeDev = threeResults.map(r => deviation(r.pts, r.times, truthFn))
  const threeHops = threeResults.map(r => countHops(r.pts, r.times, truthFn))
  const threeFrames = threeResults.map((r, i) => frameStats(r, threeWindows[i]))
  const worstThreeDev = { maxPx: Math.max(...threeDev.map(d => d.maxPx)), meanPx: Math.max(...threeDev.map(d => d.meanPx)) }

  // Tolerance: kameravaklen alene flytter skiven op til ~4.4px på det tegnede
  // klip (se make-test-clip.mjs's shakeX/shakeY-amplitude); en ægte H.264-
  // afkodning og en fersk identitets-genkalibrering midt i klippet lægger reel
  // kvantiserings- og blok-støj oven i vaklen. 15px gennemsnit / 35px max er
  // stadig under en tredjedel af pladens radius (${plateR}px på dette klip) —
  // langt fra "banen er forkert" — men tolererer den støj en ægte optagelse
  // rent faktisk har.
  const TOLERANCE_MEAN_PX = 15, TOLERANCE_MAX_PX = 35
  const MIN_FRAMES_PER_REP = 20 // ~0.66s ved 30fps — mindre end det har ikke "fundet" rep'en

  const fullFoundAllReps = full.pts.length >= windows.length * MIN_FRAMES_PER_REP * 0.7
  const fullOk = full.ok && fullDev.meanPx <= TOLERANCE_MEAN_PX && fullDev.maxPx <= TOLERANCE_MAX_PX && fullFoundAllReps
  const threeOk = threeResults.every(r => r.ok) && worstThreeDev.meanPx <= TOLERANCE_MEAN_PX && worstThreeDev.maxPx <= TOLERANCE_MAX_PX
  const REALTIME_MAX_FACTOR = 1.1
  const realtimeFactor = threePlayedS > 0 ? threeMs / 1000 / threePlayedS : Infinity
  const realtimeFastEnough = realtimeFactor <= REALTIME_MAX_FACTOR

  const pass = fullOk && threeOk && realtimeFastEnough

  console.log(`\n== Klip: ${mode === 'real' ? `test-clips\\${realClipName} (RIGTIGT klip, facit = den fulde analyses egen bane)` : 'det tegnede klip (docs/videocoach/clip-cache/synthetic-set.mp4, facit = den kendte tegnede bane)'} ==`)
  console.log('== A) Fuld analyse (alle reps, ægte afkodning, uændret siden ordre 73) ==')
  console.log(`ok=${full.ok} frames=${full.pts.length} tid=${full.ms.toFixed(1)}ms meanPx=${fullDev.meanPx.toFixed(2)} maxPx=${fullDev.maxPx.toFixed(2)}`)
  console.log('\n== B) "Vis mig nu" (rep 1, midt, sidste — realtids-vejen) — tal PR. VINDUE ==')
  threeResults.forEach((r, i) => {
    const w = threeWindows[i], f = threeFrames[i], h = threeHops[i]
    console.log(`  vindue ${i + 1} [${w.start.toFixed(2)}s-${w.end.toFixed(2)}s, ${(w.end - w.start).toFixed(2)}s afspillet]`)
    console.log(`    ok=${r.ok} frames sporet=${f.framesTracked} sprunget over=${f.framesSkipped} ms/frame=${f.msPerFrame.toFixed(1)} tid/afspillet=${f.timeRatio.toFixed(2)}x`)
    console.log(`    afvigelse meanPx=${threeDev[i].meanPx.toFixed(2)} maxPx=${threeDev[i].maxPx.toFixed(2)} hop=${h.hops} (grænse ${h.hopSpeedPxS.toFixed(0)}px/s)`)
  })
  console.log(`  samlet tid (3 vinduer): ${threeMs.toFixed(1)}ms · samlet afspillet varighed: ${(threePlayedS * 1000).toFixed(1)}ms · forhold: ${realtimeFactor.toFixed(2)}x (grænse ${REALTIME_MAX_FACTOR}x)`)
  console.log(`\nTolerance: mean ≤ ${TOLERANCE_MEAN_PX}px, max ≤ ${TOLERANCE_MAX_PX}px (se kildekoden for begrundelsen).`)
  console.log(pass
    ? '\nGRØN: alle reps fundet i den fulde analyse, alle tre "Vis mig nu"-reps fundet inden for tolerance, og "Vis mig nu" var færdig senest 1,1x sin egen afspillede varighed.'
    : `\nFEJL: ${!fullOk ? 'fuld analyse fejlede tolerancen eller fandt ikke alle reps. ' : ''}${!threeOk ? '"Vis mig nu" fejlede tolerancen. ' : ''}${!realtimeFastEnough ? `"Vis mig nu" tog ${realtimeFactor.toFixed(2)}x sin afspillede varighed, over grænsen ${REALTIME_MAX_FACTOR}x.` : ''}`)
  if (mode === 'synthetic') console.log('\n(Kører stadig mod det TEGNEDE klip — læg en rigtig telefonoptagelse + <navn>.meta.json i test-clips\\ for at måle mod virkeligheden.)')
  process.exitCode = pass ? 0 : 1
}

main().catch(err => { console.error(err); process.exitCode = 1 })
