// ORDRE 1180: videocoach klipper ikke sættet af, og stangbanen er præcis.
// Kører den levende kode fra public/videocoach.html (sæt-forudsøgning, sporing,
// rep-tælling) i Edge mod et opdigtet prøveklip (scripts/videocoach-saet-klip.mjs,
// 1080x1920, 30 fps, 5 reps, kendt bane) og tjekker to krav:
//   1) alle 5 reps findes, og sætforslaget (trim) klipper hverken første eller
//      sidste rep af.
//   2) sporet bane mod den sande: gennemsnit højst 2 % af billedhøjden, ingen
//      rep over 4 %.
// Brug: node scripts/verify-videocoach-saet-bane.mjs [--klip=<mappe>] [--ud=<json>]
// Klippet optages i docs/videocoach/clip-cache/saet-bane/ (git-ignoreret), hvis det
// mangler. Kræver Edge (channel msedge) og playwright fra codex-runtime.
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { lavKlip, PLATE_R, PRESETS } from './videocoach-saet-klip.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const arg = (n, d) => (process.argv.slice(2).find(a => a.startsWith(`--${n}=`)) || `--${n}=${d}`).split('=').slice(1).join('=')
const klipDir = arg('klip', join(root, 'docs', 'videocoach', 'clip-cache', 'saet-bane'))
const navn = arg('navn', '')
if (!navn) {
  // uden --navn: kør alle navngivne klip hver for sig (hver i sin egen proces)
  let bad = 0
  for (const n of Object.keys(PRESETS)) {
    console.log(`
== klip ${n} ==`)
    const r = spawnSync(process.execPath, [process.argv[1], `--navn=${n}`, ...process.argv.slice(2).filter(a => !a.startsWith('--navn='))], { stdio: 'inherit' })
    if (r.status !== 0) bad++
  }
  process.exit(bad ? 1 : 0)
}
const MEAN_MAX = 0.02, REP_MAX = 0.04

let clipPath = ['mp4', 'webm'].map(e => join(klipDir, `${navn}.${e}`)).find(existsSync)
const truthPath = join(klipDir, `${navn}.sand-bane.json`)
if (!clipPath || !existsSync(truthPath)) {
  console.log('Prøveklippet mangler, optager det i Edge (ca. 25 s) ...')
  clipPath = (await lavKlip(klipDir, { ...PRESETS[navn], navn })).clipPath
}
const truth = JSON.parse(readFileSync(truthPath, 'utf8'))

const html = readFileSync(join(root, 'public', 'videocoach.html'), 'utf8')
function block(a, b, incl = false) {
  const i = html.indexOf(a); if (i < 0) throw new Error(`mangler: ${a.slice(0, 50)}`)
  const j = html.indexOf(b, i); if (j < 0) throw new Error(`mangler: ${b.slice(0, 50)}`)
  return html.slice(i, incl ? j + b.length : j)
}
const trackerSrc = block('const PL_ANG = 24, PL_TAU = Math.PI * 2;', 'async function startBarTracking(p0) {')
const repDetectSrc = block('// ORDRE 85 · start: rep-detektion', '// ORDRE 85 · slut: rep-detektion', true)
const setBoundsSrc = block('function vcMotionSeries(frames) {', '// Kaldes fra begin() ved video-åbning')

const HARNESS = () => `<!doctype html><html><body>
<video id="vid" muted playsinline preload="auto" src="data:video/${clipPath.endsWith('.webm') ? 'webm' : 'mp4'};base64,${readFileSync(clipPath).toString('base64')}"></video>
<canvas id="visCanvas"></canvas>
<script>
window.__loaded = new Promise(r => { const v = document.getElementById('vid'); if (v.readyState >= 1) r(); else v.addEventListener('loadedmetadata', () => r(), { once: true }) });
let video = document.getElementById('vid'), canvas = document.getElementById('visCanvas');
let ocan = document.createElement('canvas'), octx = ocan.getContext('2d', { willReadFrequently: true });
let cmPerPx = 1;
window.__init = (w, h, plateR) => { canvas.width = w; canvas.height = h; ocan.width = w; ocan.height = h; cmPerPx = 45 / (2 * plateR) };
let strokes = [], colorInput = { value: '#e63946' };
let barBtn = { textContent: '', classList: { add(){}, remove(){} } }, playBtn = { textContent: '' };
function playLabel(){ return '' } function say(){}
let setAthleteState = null, awaitShClick = null, analyzing = false;
let SLIM = false, ATHLETE = false, COACHWEB = false, DESKTOP = true, HAS_RVFC = false;
let FRAME = 1 / 30, TRACKER_BENCHMARK = false, TRACKER_PROBE = false, VC_TRACKER_FAST = true;
let vcTiming = { trackingStartedAt: null };
let wizard = null, plateConfirm = null, awaitCalib = false, awaitBarClick = false, analysisSession = null, tracking = true, curUrl = 'x';
function idxAtTime(s, t) { const ts = s.times || []; let lo = 0, hi = ts.length - 1; if (!ts.length) return 0; while (lo < hi) { const m = (lo + hi) >> 1; if (ts[m] < t) lo = m + 1; else hi = m } return lo }
function freezeRawAcquisition(path, session) { path.raw = { pts: path.pts.map(p => ({...p})), times: [...path.times], valid: [...path.valid], start: path.times[0], end: path.times.at(-1) }; path.analysisSession = session }
function analyzePath() {} function updateCleanReviewUI() {}
function createAnalysisSession() { return { schema: 1, lift: 'squat', trackingStart: 0, trackingEnd: video.duration } }
function seekTo(t) { return new Promise(res => { if (Math.abs(video.currentTime - t) < 1e-4) { res(); return } const f = () => { video.removeEventListener('seeked', f); res() }; video.addEventListener('seeked', f); video.currentTime = t }) }
<\/script>
<script>${trackerSrc}<\/script>
<script>${repDetectSrc}<\/script>
<script>${setBoundsSrc}<\/script>
<script>
window.saetForslag = async d => vcRunSetBoundsPresearch(d);
window.koerAnalyse = async (s, e, p0, lift) => {
  strokes.length = 0; tracking = true; await seekTo(s);
  const session = { schema: 1, lift, trackingStart: s, trackingEnd: e };
  const ok = await startMultipointTracking({ x: p0.x, y: p0.y, r: p0.r }, session);
  const path = strokes.find(x => x.type === 'path'); let reps = [];
  if (path) { path.analysisSession = session; analyzePath(path); reps = (path.reps || []).map(r => ({ start: path.times[r.start], end: path.times[r.end] })) }
  return { ok, pts: path ? path.pts.map(p => ({ x: p.x, y: p.y })) : [], times: path ? [...path.times] : [], valid: path ? [...path.valid] : [], reps };
};
<\/script></body></html>`

const sandAt = t => {
  const f = truth.frames, n = f.length
  if (t <= f[0].t) return f[0]
  if (t >= f[n - 1].t) return f[n - 1]
  let lo = 0, hi = n - 1
  while (lo < hi - 1) { const m = (lo + hi) >> 1; if (f[m].t <= t) lo = m; else hi = m }
  const k = (t - f[lo].t) / (f[hi].t - f[lo].t)
  return { x: f[lo].x + (f[hi].x - f[lo].x) * k, y: f[lo].y + (f[hi].y - f[lo].y) * k }
}

const runtime = join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright')
const { chromium } = createRequire(import.meta.url)(runtime)
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const out = { fails: [] }
try {
  const page = await browser.newPage({ viewport: { width: 360, height: 640 } })
  page.on('pageerror', e => console.error('[browser pageerror]', e))
  await page.setContent(HARNESS(), { waitUntil: 'load' })
  await page.evaluate(() => window.__loaded)
  const dims = await page.evaluate(() => ({ w: video.videoWidth, h: video.videoHeight, d: video.duration }))
  await page.evaluate(([w, h, r]) => window.__init(w, h, r), [dims.w, dims.h, PLATE_R])
  const wins = truth.repWindows
  const firstStart = wins[0].start, lastEnd = wins.at(-1).end

  // 1) sætforslaget (det appen bruger til trim)
  await page.evaluate(() => { tracking = false })
  const sug = await page.evaluate(d => window.saetForslag(d), dims.d)
  out.forslag = { start: sug.start, end: sug.end, foundStart: sug.foundStart, foundEnd: sug.foundEnd, ok: sug.ok }
  const trimStart = sug.ok ? sug.start : 0, trimEnd = sug.ok ? Math.min(sug.end, dims.d) : dims.d
  console.log(`klip ${dims.w}x${dims.h}, ${dims.d.toFixed(2)} s; sandt sæt ${firstStart.toFixed(2)}-${lastEnd.toFixed(2)} s; forslag ${trimStart.toFixed(2)}-${trimEnd.toFixed(2)} s`)
  if (trimStart > firstStart + 0.05) out.fails.push(`forslaget klipper starten af (${trimStart.toFixed(2)} > ${firstStart.toFixed(2)})`)
  if (trimEnd < lastEnd - 0.05) out.fails.push(`forslaget klipper slutningen af (${trimEnd.toFixed(2)} < ${lastEnd.toFixed(2)})`)

  // 2) analyse over det foreslåtte sæt
  const p0 = { x: truth.frames[0].x, y: sandAt(trimStart).y, r: PLATE_R }
  const res = await page.evaluate(([s, e, p, l]) => window.koerAnalyse(s, e, p, l), [trimStart, trimEnd, p0, 'squat'])
  out.reps = res.reps.length
  console.log(`reps fundet: ${res.reps.length} af ${wins.length}` + res.reps.map(r => ` ${r.start.toFixed(2)}-${r.end.toFixed(2)}`).join(','))
  if (res.reps.length !== wins.length) out.fails.push(`fandt ${res.reps.length} reps, ventede ${wins.length}`)
  if (res.reps.length && res.reps[0].start > wins[0].end) out.fails.push('første rep mangler')
  if (res.reps.length && res.reps.at(-1).end < wins.at(-1).start) out.fails.push('sidste rep mangler')

  // 3) baneafvigelse i procent af billedhøjden
  const dev = res.pts.map((p, i) => Math.hypot(p.x - sandAt(res.times[i]).x, p.y - sandAt(res.times[i]).y) / dims.h)
  const mean = dev.reduce((a, b) => a + b, 0) / Math.max(1, dev.length)
  const perRep = wins.map(w => { const d = dev.filter((_, i) => res.times[i] >= w.start && res.times[i] <= w.end); return d.length ? Math.max(...d) : Infinity })
  if (process.env.VC_DEBUG) {
    console.log('forslag', JSON.stringify(sug), 'punkter', res.times.length, 'tid', res.times[0]?.toFixed(2), '-', res.times.at(-1)?.toFixed(2), 'gyldige', res.valid.filter(Boolean).length)
    for (let b = 0; b < Math.ceil(dims.d); b += 1) { const ix = res.times.map((t, i) => i).filter(i => res.times[i] >= b && res.times[i] < b + 1); if (ix.length) console.log(b, 'dev%', (100 * Math.max(...ix.map(i => dev[i]))).toFixed(2), 'trackY', res.pts[ix[0]].y.toFixed(0), 'sandY', sandAt(res.times[ix[0]]).y.toFixed(0)) }
  }
  if (process.env.VC_DEBUG) for (const o of [-3, -2, -1, -0.5, 0, 0.5, 1, 2, 3].map(f => f / 30)) { const dd = res.pts.map((p, i) => ({ t: res.times[i], d: Math.hypot(p.x - sandAt(res.times[i] + o).x, p.y - sandAt(res.times[i] + o).y) / dims.h })).filter(x => x.t > firstStart && x.t < lastEnd); console.log('forskydning (billeder)', (o * 30).toFixed(1), 'gns%', (100 * dd.reduce((a, b) => a + b.d, 0) / dd.length).toFixed(2)) }
  if (process.env.VC_TRACE) { const [a, b] = process.env.VC_TRACE.split(',').map(Number); res.times.forEach((t, i) => { if (t >= a && t <= b) console.log('spor', t.toFixed(3), 'valid', res.valid[i] ? 1 : 0, 'track', res.pts[i].y.toFixed(0), 'sand', sandAt(t).y.toFixed(0)) }) }
  out.meanPct = mean * 100; out.repMaxPct = perRep.map(x => x * 100)
  console.log(`baneafvigelse: gennemsnit ${(mean * 100).toFixed(2)} % (krav højst ${MEAN_MAX * 100} %), værste pr. rep ${perRep.map(x => (x * 100).toFixed(2)).join(' / ')} % (krav højst ${REP_MAX * 100} %)`)
  if (!(mean <= MEAN_MAX)) out.fails.push(`gennemsnitlig afvigelse ${(mean * 100).toFixed(2)} % over ${MEAN_MAX * 100} %`)
  if (perRep.some(x => !(x <= REP_MAX))) out.fails.push('mindst én rep afviger mere end 4 %')
} finally { await browser.close() }
const ud = arg('ud', '')
if (ud) writeFileSync(ud, JSON.stringify(out, null, 1))
console.log(out.fails.length ? `FEJL: ${out.fails.join('; ')}` : 'GRØN: alle reps findes, sættet er ikke klippet af, og banen er inden for kravene.')
process.exit(out.fails.length ? 1 : 0)
