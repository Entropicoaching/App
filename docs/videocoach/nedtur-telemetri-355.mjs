// ORDRE 355 · blok 1: frame-for-frame telemetri af den LEVENDE dødløft-tracker
// (startMultipointTracking, udtrukket 1:1 fra public/videocoach.html med samme
// markører og samme harness-stubs som scripts/verify-videocoach-clip.mjs) med
// trackerProbe slået til. Ingen produktionsfil ændres; ingen atletdata skrives.
//
// Kørsel:
//   node docs/videocoach/nedtur-telemetri-355.mjs [--clip=<fil i test-clips\ eller clip-cache\>]
//        [--stride=1|2|3] [--all]
// --stride=N: harnesset søger N kildeframes frem pr. trackerframe. 1 = headless
//   standard (hver frame). 2-3 efterligner mobilens rVFC-cadence, hvor
//   kildeframes springes over under afspilning (se gapStrikes i trackeren).
// --x= --y= --r=: manuelt pladecenter/radius i videopixels (ellers autoCalib-gitteret).
// --all: skriv alle frames, ikke kun tab-episoder med 3 frames kontekst.
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, basename } from 'node:path'
import { homedir } from 'node:os'
import { createRequire } from 'node:module'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const arg = (name, dflt) => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : dflt
}
const ALL = process.argv.includes('--all')
const STRIDE = Math.max(1, Number(arg('stride', '1')) || 1)
const clipArg = arg('clip', 'vis-mig-nu-4-reps-realistisk.mp4')
const clipPath = [join(root, 'test-clips', clipArg), join(here, 'clip-cache', clipArg), clipArg].find(existsSync)
if (!clipPath) throw new Error(`nedtur-telemetri: fandt ikke ${clipArg}`)
if (!/\.mp4$/i.test(clipPath)) throw new Error('nedtur-telemetri: kræver mp4/H.264 (kør verify:videocoach-clip først; den lægger .mov-kopien i clip-cache\\real-*.mp4)')

const html = readFileSync(join(root, 'public', 'videocoach.html'), 'utf8')
const verifySrc = readFileSync(join(root, 'scripts', 'verify-videocoach-clip.mjs'), 'utf8')
const between = (text, a, b, withB = false) => {
  const i = text.indexOf(a); if (i < 0) throw new Error(`markør mangler: ${a.slice(0, 50)}`)
  const j = text.indexOf(b, i); if (j < 0) throw new Error(`markør mangler: ${b.slice(0, 50)}`)
  return text.slice(i, withB ? j + b.length : j)
}
const trackerSource = between(html, 'const PL_ANG = 24, PL_TAU = Math.PI * 2;', 'async function startBarTracking(p0) {')
const autoCalibSource = between(html, '// ORDRE 85 · start: auto-kalibrering', '// ORDRE 85 · slut: auto-kalibrering', true)
const repDetectSource = between(html, '// ORDRE 85 · start: rep-detektion', '// ORDRE 85 · slut: rep-detektion', true)
// Samme app-stubs som verify-harnesset, kun med probe-kanalen tændt og FRAME = stride/30.
const stubs = between(verifySrc, "let video = document.getElementById('vid');",
  'function __resetProfile() {', false)
  .replace('let TRACKER_BENCHMARK = false, TRACKER_PROBE = false;', 'let TRACKER_BENCHMARK = true, TRACKER_PROBE = true;')
  .replace('let FRAME = 1 / 30;', `let FRAME = ${STRIDE} / 30;`)
  .replace(/\\\//g, '/')
const autoFind = between(verifySrc, 'window.__autoFindBarPoint = async function(atTime) {', 'window.runAnalysis = ')

const page = `<!doctype html><html><head><meta charset="utf-8"></head><body>
<video id="vid" muted playsinline preload="auto" src="data:video/mp4;base64,${readFileSync(clipPath).toString('base64')}"></video>
<canvas id="visCanvas"></canvas>
<script>window.__loaded=new Promise(r=>{const v=document.getElementById('vid');if(v.readyState>=1)r();else v.addEventListener('loadedmetadata',()=>r(),{once:true});});</script>
<script>${stubs}
function __resetProfile() { window.__profile = { seekMs: [], processMs: [], drawMs: [] }; __lastSeekEnd = null; }
function publishTrackerBenchmarkRun(run) { window.__vcTrackerBenchmarkLast = run; }
</script>
<script>${trackerSource}</script>
<script>${autoCalibSource}</script>
<script>${repDetectSource}</script>
<script>${autoFind}
window.runProbe = async function(endT, p0) {
  strokes.length = 0; tracking = true; __resetProfile(); await seekTo(0);
  const session = { schema: 1, lift: 'deadlift', trackingStart: 0, trackingEnd: endT };
  await startMultipointTracking({ x: p0.x, y: p0.y, r: p0.r }, session);
  const path = strokes.find(s => s.type === 'path');
  return { pts: path.pts.map(p => p && ({ x: p.x, y: p.y })), times: [...path.times], valid: [...path.valid],
    probe: window.__vcTrackerProbeLog || [], homeRecoveries: path.homeRecoveries || 0 };
};
</script></body></html>`

const runtimeModules = join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules')
const { chromium } = createRequire(import.meta.url)(join(runtimeModules, 'playwright'))
const browser = await chromium.launch({ headless: true })
try {
  const tab = await browser.newPage({ viewport: { width: 360, height: 640 } })
  tab.on('pageerror', e => console.error('[pageerror]', e))
  await tab.setContent(page, { waitUntil: 'load' })
  await tab.evaluate(() => window.__loaded)
  const dims = await tab.evaluate(() => ({ w: video.videoWidth, h: video.videoHeight, d: video.duration }))
  await tab.evaluate(([w, h]) => window.__initCanvasDims(w, h), [dims.w, dims.h])
  // --x/--y/--r: manuelt pladecenter (autoCalib-gitteret kan lande på baggrunden, se RAPPORT-355).
  const manual = arg('x') && arg('y') && arg('r')
  const auto = manual ? { x: +arg('x'), y: +arg('y'), r: +arg('r'), method: 'manuel' } : await tab.evaluate(() => window.__autoFindBarPoint(0))
  await tab.evaluate(r => window.__setPlateRadius(r), auto.r)
  const res = await tab.evaluate(([e, p]) => window.runProbe(e, p), [dims.d, { x: auto.x, y: auto.y, r: auto.r }])
  const R = auto.r
  console.log(`klip=${basename(clipPath)} ${dims.w}x${dims.h} ${dims.d.toFixed(2)}s stride=${STRIDE} start=${auto.method} p0=(${auto.x.toFixed(0)},${auto.y.toFixed(0)}) R=${R.toFixed(0)} frames=${res.times.length} probe=${res.probe.length} homeRecoveries=${res.homeRecoveries}`)

  // Probe-rækken er én pr. fuldt behandlet frame (skip-frames i quiet-streak har ingen probe).
  const byT = new Map(res.probe.map(q => [q.t.toFixed(4), q]))
  let lost = 0, prev = null
  const rows = res.times.map((t, i) => {
    const p = res.pts[i], q = byT.get(t.toFixed(4)) || null
    const v = prev && p ? { x: (p.x - prev.p.x) / Math.max(1e-3, t - prev.t), y: (p.y - prev.p.y) / Math.max(1e-3, t - prev.t) } : { x: 0, y: 0 }
    lost = res.valid[i] ? 0 : lost + 1
    if (p) prev = { p, t }
    return { i, t, p, v, lost, valid: res.valid[i], q }
  })
  const fmt = r => {
    const q = r.q
    const gate = !q ? 'skip' : q.accepted ? 'ok' : q.rejectGate
    const nums = !q ? '' : ` moves=${q.moves} kept=${q.kept} (>=5) jump=${q.jump == null ? '-' : q.jump.toFixed(1)}/${q.maxJump == null ? '-' : q.maxJump.toFixed(1)}` +
      (q.identityChecked ? ` id=${q.identityOK}` : '') + (q.descentGate ? ` desc=${q.descentGate}` : '') + (q.recoveryGate ? ` rec=${q.recoveryGate}` : '') +
      (q.homeSearch ? ` home(c=${q.homeSearch.circle} cov=${q.homeSearch.cover})` : '')
    return `  f${String(r.i).padStart(4)} t=${r.t.toFixed(3)} pos=(${r.p ? r.p.x.toFixed(0) : '-'},${r.p ? r.p.y.toFixed(0) : '-'}) dy/p0=${r.p ? ((r.p.y - auto.y) / R).toFixed(2) : '-'}R vel=(${r.v.x.toFixed(0)},${r.v.y.toFixed(0)})px/s lost=${r.lost} ${gate}${nums}`
  }
  if (ALL) rows.forEach(r => console.log(fmt(r)))
  // Tab-episoder: sammenhængende !valid, med 3 frames før.
  const episodes = []
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].valid) continue
    let j = i; while (j < rows.length && !rows[j].valid) j++
    episodes.push({ a: i, b: j }); i = j
  }
  console.log(`tab-episoder: ${episodes.length}`)
  for (const ep of episodes) {
    const first = rows[ep.a], gates = {}
    rows.slice(ep.a, ep.b).forEach(r => { const g = r.q ? r.q.rejectGate : 'skip'; gates[g] = (gates[g] || 0) + 1 })
    console.log(`\n== episode t=${first.t.toFixed(3)}-${(rows[ep.b] || rows.at(-1)).t.toFixed(3)} (${ep.b - ep.a} frames) porte=${JSON.stringify(gates)}`)
    if (!ALL) rows.slice(Math.max(0, ep.a - 3), Math.min(rows.length, ep.b + 1)).forEach(r => console.log(fmt(r)))
  }
} finally { await browser.close() }
