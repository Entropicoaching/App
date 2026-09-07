// ORDRE 73 · commit 2 / ORDRE 80 · commit 1+2 / ORDRE 82 · commit 1+2 /
// ORDRE 85 · commit 1 — trackeren mod et RIGTIGT videoklip, i en rigtig
// browser, UDEN at Marc selv skal skrive pixelkoordinater i en JSON-fil.
// -----------------------------------------------------------------------------
// Kører den FAKTISKE, levende tracker-kode fra public/videocoach.html (samme
// udtræksteknik som docs/videocoach/tracker-live-bench.mjs og rep-preview-
// rig.mjs) i headless Chromium: ægte video-afkodning, ægte canvas.drawImage/
// getImageData, ægte seek (venter på 'seeded'), ikke en analytisk pixel-funktion.
//
// ORDRE 82 krævede en sidecar `<navn>.meta.json` (barPoint + windows) for et
// rigtigt klip - kravet om at Marc selv skulle skrive pixelkoordinater og
// sekunder var for tungt, og bænken stod derfor tom. ORDRE 85 fjerner kravet:
//
//   test-clips\<navn>.mp4 ELLER .mov  - Marcs egen telefonoptagelse
//                                       (git-ignoreret, ham selv, ikke en
//                                       atlet — se .gitignore). Er den ikke
//                                       H.264 i mp4-container, transkodes en
//                                       midlertidig kopi (ffmpeg-static,
//                                       findes allerede) til den
//                                       git-ignorerede cache - committes ALDRIG.
//   test-clips\<navn>.meta.json       - VALGFRI, felt for felt: findes et
//     (valgfri)                        felt, vinder det over automatikken.
//       { "barPoint": {"x":..,"y":..}, "plateRadius": .., "lift": "deadlift",
//         "windows": [{"start":..,"end":..}, ...] }
//
// Uden sidecar-felter findes de automatisk:
//   - Stangens startpunkt (ved klippets første frame): et gitter af
//     kandidatpunkter afprøves med appens EGEN `autoCalib` (samme funktion
//     coachen bruger til at bekræfte en klikket skive - udtrukket 1:1, se
//     ORDRE 85-markøren i videocoach.html). Blandt de punkter hvor den finder
//     en tydelig cirkulær kant, vælges den med størst fundet radius (skiven
//     er typisk den mest fremtrædende cirkulære genstand i en løftevideo).
//     Findes intet tydeligt cirkulært punkt NOGEN steder (fx dårligt lys),
//     falder scriptet tilbage til den fulde analyses EGEN kvalitetsmåling af
//     et punkt (`mpGoodFeatures` - den funktion startMultipointTracking selv
//     bruger til at afgøre om et punkt er sporbart) og vælger gitterpunktet
//     med flest gode features. Hvilken metode der vandt, og de fundne
//     koordinater, skrives altid i output.
//   - Gentagelses-vinduerne: den fulde analyses EGEN rep-detektion
//     (analyzeCleanPath/`path.reps` - udtrukket 1:1, se ORDRE 85-markøren)
//     køres på den fulde analyses bane. Ingen forudsøgnings-heuristik
//     opfundet til lejligheden.
//
// Facit for "Vis mig nu" (den hurtige vej): på et RIGTIGT klip findes ingen
// uafhængig sandhed - derfor bruges her den FULDE analyses egen sporede bane
// som facit. På det tegnede klip bruges fortsat den kendte, tegnede bane.
//
// Målt PR. VINDUE: frames sporet, frames sprunget over, ms/frame, tid mod
// afspillet varighed, afvigelse (mean/max px) og antal "hop" (se countHops
// nedenfor for definition og begrundelse af grænsen).
//
// Kørsel: npm run verify:videocoach-clip
// Genererer det tegnede klip automatisk (npm run test:clip), hvis det mangler
// OG intet rigtigt klip er lagt i test-clips\.

import { readFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join, extname, basename } from 'node:path'
import { homedir } from 'node:os'
import { createRequire } from 'node:module'
import ffmpegPath from 'ffmpeg-static'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const cacheDir = join(root, 'docs', 'videocoach', 'clip-cache')
const syntheticClipPath = join(cacheDir, 'synthetic-set.mp4')
const syntheticGtPath = join(cacheDir, 'synthetic-set.ground-truth.json')
const testClipsDir = join(root, 'test-clips')

// ---------- 0) Rigtigt klip eller det tegnede? ----------
function findRealClip() {
  if (!existsSync(testClipsDir)) return null
  const files = readdirSync(testClipsDir).filter(f => /\.(mp4|mov)$/i.test(f)).sort()
  if (files.length > 1) console.log(`Bemærk: ${files.length} klip fundet i test-clips\\ — bruger det alfabetisk første ("${files[0]}").`)
  return files[0] || null
}
function loadRealMeta(clipName) {
  const base = clipName.replace(/\.(mp4|mov)$/i, '')
  const metaPath = join(testClipsDir, `${base}.meta.json`)
  if (!existsSync(metaPath)) return {}
  try {
    const meta = JSON.parse(readFileSync(metaPath, 'utf8'))
    const fields = Object.keys(meta).filter(k => ['barPoint', 'plateRadius', 'windows', 'lift'].includes(k))
    console.log(`Fandt ${base}.meta.json — felterne [${fields.join(', ') || 'ingen genkendte'}] vinder over automatikken, resten findes automatisk.`)
    return meta
  } catch (e) {
    console.log(`${base}.meta.json er ikke gyldig JSON (${e.message}) — ignoreres, alt findes automatisk.`)
    return {}
  }
}

// ORDRE 85 · commit 1: ingen sidecar-fil krævet mere - er klippet ikke H.264 i
// mp4-container, transkodes en midlertidig, git-ignoreret kopi (samme
// ffmpeg-static som make-test-clip.mjs bruger, ingen ny afhængighed).
// Committes ALDRIG, heller ikke som transkodet kopi (se .gitignore).
function probeCodec(path) {
  const res = spawnSync(ffmpegPath, ['-i', path], { encoding: 'utf8' })
  const stderr = res.stderr || ''
  return { isH264: /Video:\s*h264/i.test(stderr), stderr }
}
function ensureMp4H264(srcPath) {
  const ext = extname(srcPath).toLowerCase()
  const probe = probeCodec(srcPath)
  if (ext === '.mp4' && probe.isH264) return srcPath
  mkdirSync(cacheDir, { recursive: true })
  const base = basename(srcPath, extname(srcPath))
  const outPath = join(cacheDir, `real-${base}.mp4`)
  const why = [ext !== '.mp4' ? 'ikke mp4-container' : null, !probe.isH264 ? 'ikke H.264' : null].filter(Boolean).join(' + ')
  console.log(`test-clips\\${basename(srcPath)} er ${why} — transkoder en midlertidig kopi (${probe.isH264 ? 'remux, ingen genkodning' : 'genkodning til H.264'}) til ${outPath.replace(root + '\\', '')} ...`)
  const args = ['-y', '-i', srcPath, '-map', '0:v:0', '-map', '0:a:0?',
    ...(probe.isH264 ? ['-c', 'copy'] : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac']),
    '-movflags', '+faststart', outPath]
  const res = spawnSync(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'inherit'] })
  if (res.status !== 0) throw new Error(`ffmpeg-transkodning fejlede for ${srcPath}`)
  return outPath
}

let mode = 'synthetic', clipPath = syntheticClipPath, realMeta = {}, realClipName = null
const foundReal = findRealClip()
if (foundReal) {
  mode = 'real'
  realClipName = foundReal
  realMeta = loadRealMeta(foundReal)
  clipPath = ensureMp4H264(join(testClipsDir, foundReal))
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
function extractBlock(text, startMarker, endMarker, includeEndMarker = false) {
  const startIdx = text.indexOf(startMarker)
  if (startIdx < 0) throw new Error(`verify-videocoach-clip: startmarkør ikke fundet ("${startMarker.slice(0, 40)}...") - er videocoach.html omstruktureret?`)
  const endIdx = text.indexOf(endMarker, startIdx)
  if (endIdx < 0) throw new Error(`verify-videocoach-clip: slutmarkør ikke fundet ("${endMarker.slice(0, 40)}...") - er videocoach.html omstruktureret?`)
  return text.slice(startIdx, includeEndMarker ? endIdx + endMarker.length : endIdx)
}
const trackerSource = extractBlock(html, 'const PL_ANG = 24, PL_TAU = Math.PI * 2;', 'async function startBarTracking(p0) {')
const realtimePreviewSource = extractBlock(html,
  '// ORDRE 80 · start: realtids-sporing til "Vis mig nu"',
  '// ORDRE 80 · slut: realtids-sporing til "Vis mig nu"', true)
// ORDRE 85: to nye, uændrede udtræk - auto-kalibrering og rep-detektion.
const autoCalibSource = extractBlock(html,
  '// ORDRE 85 · start: auto-kalibrering', '// ORDRE 85 · slut: auto-kalibrering', true)
const repDetectSource = extractBlock(html,
  '// ORDRE 85 · start: rep-detektion', '// ORDRE 85 · slut: rep-detektion', true)

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
// ORDRE 82: klippets opløsning kendes først når metadata er indlæst - canvas'ene
// sættes derfor herfra, ikke i markup'en. ORDRE 85: cmPerPx sættes SEPARAT, når
// pladens radius kendes (autodetekteret eller fra sidecar), da rep-detektionen
// (nedenfor) har brug for den, men ikke selve billedstørrelsen.
let cmPerPx = 1;
window.__initCanvasDims = function(w, h) {
  canvas.width = w; canvas.height = h;
  ocan.width = w; ocan.height = h;
};
window.__setPlateRadius = function(plateR) { cmPerPx = 45 / (2 * plateR); };
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
// ORDRE 85: tager nu session ligesom den rigtige (public/videocoach.html:1279)
// og sætter path.analysisSession - analyzeCleanPath (nu rigtig kode, ikke en
// no-op, se nedenfor) læser session.lift derfra.
function freezeRawAcquisition(path, session) {
  path.raw = { pts: path.pts.map(p => ({...p})), times: [...path.times],
    valid: [...path.valid], start: path.times[0], end: path.times.at(-1) };
  path.analysisSession = session;
}
// ORDRE 85: analyzePath/analyzeCleanPath (udtrukket nedenfor) overskriver
// denne no-op - kun updateCleanReviewUI (DOM-visning, uden interesse her)
// forbliver en no-op.
function analyzePath() {}
function updateCleanReviewUI() {}
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
${autoCalibSource}
<\/script>
<script>
${repDetectSource}
<\/script>
<script>
${realtimePreviewSource}
<\/script>
<script>
// ORDRE 85 · commit 1: stangens startpunkt uden en sidecar-fil. Tier 1
// genbruger appens EGEN autoCalib i et gitter (se autoCalibSource ovenfor);
// tier 2 (kun hvis tier 1 ikke finder noget tydeligt cirkulært NOGEN steder)
// bruger den fulde analyses egen kvalitetsmåling af et punkt (mpGoodFeatures).
window.__autoFindBarPoint = async function(atTime) {
  await __seekToReal(atTime);
  const W = canvas.width, H = canvas.height;
  const margin = 0.18, cols = 6, rows = 7;
  const candidates = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    candidates.push({
      x: W * (margin + (1 - 2 * margin) * c / (cols - 1)),
      y: H * (margin + (1 - 2 * margin) * r / (rows - 1)),
    });
  }
  // Et gitterpunkt nær kanten kan finde en falsk "kant" (billedrammen selv,
  // en skygge) med en urealistisk stor radius - en skive der fylder over
  // en fjerdedel af billedets korteste side er ikke en skive, det er støj.
  // Denne grænse er ny for bænkens gitter-heuristik, ikke en ændring af
  // appens egen autoCalib.
  const maxPlausibleRadius = Math.min(W, H) / 4;
  let best = null, bestRadius = -1;
  for (const cand of candidates) {
    const cmPerPxFound = autoCalib(cand);
    if (cmPerPxFound == null) continue;
    const rad = 45 / (2 * cmPerPxFound);
    if (rad > maxPlausibleRadius) continue;
    if (rad > bestRadius) { bestRadius = rad; best = { x: cand.x, y: cand.y, r: rad, tier: 1, method: 'autoCalib-grid' }; }
  }
  if (best) return best;
  octx.drawImage(video, 0, 0, ocan.width, ocan.height);
  const frame = mpBuildFrame(octx.getImageData(0, 0, W, H).data, W, H, 0, 0, W, H);
  const fallbackRadius = Math.max(20, W / 16);
  let bestFeat = null, bestFeatScore = -1;
  for (const cand of candidates) {
    const feats = mpGoodFeatures(frame, cand, fallbackRadius);
    if (feats.length > bestFeatScore) {
      bestFeatScore = feats.length;
      bestFeat = { x: cand.x, y: cand.y, r: fallbackRadius, tier: 2, method: 'mpGoodFeatures-grid', featureCount: feats.length };
    }
  }
  return bestFeat;
};
window.runAnalysis = async function(startT, endT, p0, lift) {
  strokes.length = 0;
  tracking = true;
  __resetProfile();
  await seekTo(startT);
  const t0 = performance.now();
  const session = { schema: 1, lift: lift || 'squat', trackingStart: startT, trackingEnd: endT };
  const ok = await startMultipointTracking({ x: p0.x, y: p0.y, r: p0.r }, session);
  const ms = performance.now() - t0;
  const path = strokes.find(s => s.type === 'path');
  let repWindows = [];
  if (path) {
    // ORDRE 85 · commit 1: rep-vinduerne kommer fra den fulde analyses EGEN
    // rep-detektion (analyzeCleanPath via analyzePath), ikke en sidecar-fil.
    path.analysisSession = session;
    analyzePath(path);
    repWindows = (path.reps || []).map(rep => ({ start: path.times[rep.start], end: path.times[rep.end] }));
  }
  return {
    ok, ms,
    pts: path ? path.pts.map(p => ({ x: p.x, y: p.y })) : [],
    times: path ? [...path.times] : [],
    valid: path ? [...path.valid] : [],
    repWindows,
    profile: window.__profile,
  };
};
// ORDRE 80 · commit 2 / ORDRE 82 · commit 2: "Vis mig nu"s realtids-vej.
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

// Op til tre vinduer - første, midterste, sidste - men aldrig flere end der
// faktisk blev fundet (ORDRE 85: et rigtigt klip kan sagtens kun have ét
// rep). Dubletter fjernes, så et enkelt fundet vindue kun afprøves én gang.
function pickThreeWindows(windows) {
  const n = windows.length
  if (!n) return []
  const idxs = [...new Set([0, Math.floor((n - 1) / 2), n - 1])]
  return idxs.map(i => windows[i])
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 360, height: 640 } })
  page.on('pageerror', err => console.error('[browser pageerror]', err))
  await page.setContent(HARNESS_HTML, { waitUntil: 'load' })
  await page.evaluate(() => window.__loaded)

  const dims = await page.evaluate(() => ({ w: video.videoWidth, h: video.videoHeight, duration: video.duration }))
  await page.evaluate(([w, h]) => window.__initCanvasDims(w, h), [dims.w, dims.h])

  let windows, plateR, p0Full, lift

  if (mode === 'synthetic') {
    windows = groundTruth.repWindows
    plateR = groundTruth.plateRadius
    p0Full = truePosAt(windows[0].start)
    lift = 'squat'
  } else {
    lift = realMeta.lift || 'deadlift'
    let auto = null
    if (!realMeta.barPoint || !realMeta.plateRadius) {
      auto = await page.evaluate(() => window.__autoFindBarPoint(0))
      if (!auto) throw new Error('verify-videocoach-clip: kunne ikke finde noget kandidatpunkt overhovedet på klippets første frame - er videoen tom/sort?')
      console.log(`Stangens startpunkt fundet automatisk: (${auto.x.toFixed(0)}, ${auto.y.toFixed(0)}) px, radius ${auto.r.toFixed(0)}px, metode "${auto.method}"` +
        (auto.tier === 2 ? ` (tier 2 - ingen tydelig cirkulær kant fundet noget sted, ${auto.featureCount} features på det bedste gitterpunkt)` : ' (tier 1 - autoCalib fandt en tydelig cirkulær kant)'))
    }
    p0Full = realMeta.barPoint || { x: auto.x, y: auto.y }
    plateR = realMeta.plateRadius || (auto ? auto.r : Math.round(dims.w / 16))
  }
  await page.evaluate(r => window.__setPlateRadius(r), plateR)

  // ---------- A) Fuld analyse: hele klippet (tegnet: kendt varighed / rigtigt: fra første frame til klippets slutning) ----------
  const startT = mode === 'synthetic' ? windows[0].start : 0
  const endT = mode === 'synthetic' ? groundTruth.duration : dims.duration
  const full = await page.evaluate(([s, e, p, l]) => window.runAnalysis(s, e, p, l), [startT, endT, { x: p0Full.x, y: p0Full.y, r: plateR }, lift])

  if (mode === 'real') {
    windows = (realMeta.windows && realMeta.windows.length) ? realMeta.windows : full.repWindows
    if (!windows.length) {
      console.log('Ingen gentagelser fundet automatisk i den fulde analyse - bruger hele det analyserede spænd som ét vindue.')
      windows = [{ start: full.times[0] ?? startT, end: full.times.at(-1) ?? endT }]
    } else {
      console.log(`${windows.length} gentagelse(r) fundet ${realMeta.windows?.length ? '(fra sidecar-filen)' : 'automatisk (den fulde analyses egen rep-detektion)'}: ` +
        windows.map(w => `${w.start.toFixed(2)}-${w.end.toFixed(2)}s`).join(', '))
    }
  }

  const truthFn = mode === 'synthetic' ? truePosAt : makePathInterpolator(full.times, full.pts)

  // ---------- B) "Vis mig nu": op til tre vinduer, sekventielt (samme som en atlet der beder om tre reps) ----------
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
  const worstThreeDev = threeDev.length
    ? { maxPx: Math.max(...threeDev.map(d => d.maxPx)), meanPx: Math.max(...threeDev.map(d => d.meanPx)) }
    : { maxPx: 0, meanPx: 0 }

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
  const threeOk = threeResults.length > 0 && threeResults.every(r => r.ok) &&
    worstThreeDev.meanPx <= TOLERANCE_MEAN_PX && worstThreeDev.maxPx <= TOLERANCE_MAX_PX
  const REALTIME_MAX_FACTOR = 1.1
  const realtimeFactor = threePlayedS > 0 ? threeMs / 1000 / threePlayedS : Infinity
  const realtimeFastEnough = realtimeFactor <= REALTIME_MAX_FACTOR

  const pass = fullOk && threeOk && realtimeFastEnough

  console.log(`\n== Klip: ${mode === 'real' ? `test-clips\\${realClipName} (RIGTIGT klip, ${lift}, facit = den fulde analyses egen bane)` : 'det tegnede klip (docs/videocoach/clip-cache/synthetic-set.mp4, facit = den kendte tegnede bane)'} ==`)
  console.log('== A) Fuld analyse (uændret siden ordre 73) ==')
  console.log(`ok=${full.ok} frames=${full.pts.length} tid=${full.ms.toFixed(1)}ms meanPx=${fullDev.meanPx.toFixed(2)} maxPx=${fullDev.maxPx.toFixed(2)}`)
  console.log(`\n== B) "Vis mig nu" (${threeWindows.length} vindue(r): ${threeWindows.length < 3 ? 'færre end 3 fundet i klippet' : 'første, midt, sidste'} — realtids-vejen) — tal PR. VINDUE ==`)
  threeResults.forEach((r, i) => {
    const w = threeWindows[i], f = threeFrames[i], h = threeHops[i]
    console.log(`  vindue ${i + 1} [${w.start.toFixed(2)}s-${w.end.toFixed(2)}s, ${(w.end - w.start).toFixed(2)}s afspillet]`)
    console.log(`    ok=${r.ok} frames sporet=${f.framesTracked} sprunget over=${f.framesSkipped} ms/frame=${f.msPerFrame.toFixed(1)} tid/afspillet=${f.timeRatio.toFixed(2)}x`)
    console.log(`    afvigelse meanPx=${threeDev[i].meanPx.toFixed(2)} maxPx=${threeDev[i].maxPx.toFixed(2)} hop=${h.hops} (grænse ${h.hopSpeedPxS.toFixed(0)}px/s)`)
  })
  console.log(`  samlet tid (${threeWindows.length} vindue(r)): ${threeMs.toFixed(1)}ms · samlet afspillet varighed: ${(threePlayedS * 1000).toFixed(1)}ms · forhold: ${realtimeFactor.toFixed(2)}x (grænse ${REALTIME_MAX_FACTOR}x)`)
  console.log(`\nTolerance: mean ≤ ${TOLERANCE_MEAN_PX}px, max ≤ ${TOLERANCE_MAX_PX}px (se kildekoden for begrundelsen).`)
  console.log(pass
    ? '\nGRØN: alle reps fundet i den fulde analyse, alle "Vis mig nu"-vinduer fundet inden for tolerance, og "Vis mig nu" var færdig senest 1,1x sin egen afspillede varighed.'
    : `\nFEJL: ${!fullOk ? 'fuld analyse fejlede tolerancen eller fandt ikke alle reps. ' : ''}${!threeOk ? '"Vis mig nu" fejlede tolerancen. ' : ''}${!realtimeFastEnough ? `"Vis mig nu" tog ${realtimeFactor.toFixed(2)}x sin afspillede varighed, over grænsen ${REALTIME_MAX_FACTOR}x.` : ''}`)
  if (mode === 'real' && threeWindows.length < 3) console.log(`\n(Kun ${threeWindows.length} gentagelse(r) i dette klip — et sæt på 3-5 reps giver et mere sigende billede, se docs/videocoach/TEST-CLIPS.md.)`)
  if (mode === 'synthetic') console.log('\n(Kører stadig mod det TEGNEDE klip — læg en rigtig telefonoptagelse i test-clips\\ for at måle mod virkeligheden.)')
  process.exitCode = pass ? 0 : 1
}

main().catch(err => { console.error(err); process.exitCode = 1 })
