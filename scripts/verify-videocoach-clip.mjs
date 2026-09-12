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
//         "windows": [{"start":..,"end":..}, ...],
//         "repeatedIdenticalWindows": true }
//     "repeatedIdenticalWindows" (ORDRE 124 · commit 3): sæt kun for et klip
//     limet sammen af IDENTISKE kopier af samme rep (fx via ffmpeg concat,
//     se docs/videocoach/TEST-CLIPS.md) - facit for vindue 2+ bliver da
//     vindue 1's EGET spor, tidsforskudt, i stedet for ét globalt spor hen
//     over klip-samlingerne (som drifter efter det første snit - se
//     "repeatedIdenticalWindows" i main()).
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
// ORDRE 139 · commit 2: kravet PR. KLIP (maxRealtime, evt. diagnostic:true)
// kommer fra `test-clips\manifest.json` (git-ignoreret ligesom klippene selv -
// se `test-clips.manifest.example.json` for skemaet/eksempler). Mangler et
// klip en post, gælder standardkravet (1,10x, ikke diagnostisk) - se
// requirementFor/DEFAULT_REQUIREMENT nedenfor. Et diagnostisk klip måles og
// printes som alle andre, men fælder ikke den samlede test (main()).
//
// Kørsel: npm run verify:videocoach-clip
// Genererer det tegnede klip automatisk (npm run test:clip), hvis det mangler
// OG intet rigtigt klip er lagt i test-clips\.
//
// ORDRE 124 · commit 1: to uafhængige flag, kun til at adskille "hvad er
// seek-ændringen (ordre 121 · commit 1)" fra "hvad er testens nye målemetode
// (ordre 121 · commit 2)" på et RIGTIGT klip (mode==='real' - flagene er
// no-op på det tegnede klip). Se docs/videocoach/RAPPORT-124.md.
//   --windows=old|new (default new) - HVILKE vinduer "Vis mig nu" måles på:
//     old = den fulde analyses EGEN rep-detektion (full.repWindows), ALDRIG
//           presearch - ordre 116/120's logik, FØR ordre 121 · commit 2.
//     new = presearch først (vcRunRepWindowsPresearch), samme kilde som den
//           rigtige app selv bruger - ordre 121 · commit 2's logik, uændret.
//   --seek=old|new (default new) - HVILKEN revision af public/videocoach.html
//     sporings-/presearch-koden udtrækkes fra:
//     old = revisionen lige FØR "ordre 121 · commit 1" (git-historikken) -
//           ingen skygge-seek: presearch restaurerer savedTime bagefter, og
//           vcRealtimeTrackWindow venter altid på sit EGET seek.
//     new = arbejdstræets nuværende public/videocoach.html (skygge-seek).
// Begge default til "new" - uden flag er kørslen UÆNDRET (samme gate-
// kriterier som før: fullOk && comboOk && realtimeFastEnough).
//   node scripts/verify-videocoach-clip.mjs --windows=old --seek=old
//   node scripts/verify-videocoach-clip.mjs --windows=old --seek=new
//   node scripts/verify-videocoach-clip.mjs --windows=new --seek=old
//   node scripts/verify-videocoach-clip.mjs --windows=new --seek=new   (= standard)

import { readFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join, extname, basename } from 'node:path'
import { homedir } from 'node:os'
import { createRequire } from 'node:module'
import ffmpegPath from 'ffmpeg-static'

function flagValue(name, def) {
  const pre = `--${name}=`
  const hit = process.argv.slice(2).find(a => a.startsWith(pre))
  return hit ? hit.slice(pre.length) : def
}
const WINDOWS_MODE = flagValue('windows', 'new')
const SEEK_MODE = flagValue('seek', 'new')
for (const [name, v] of [['windows', WINDOWS_MODE], ['seek', SEEK_MODE]]) {
  if (v !== 'old' && v !== 'new') throw new Error(`verify-videocoach-clip: --${name} skal være "old" eller "new" (fik "${v}").`)
}
// ORDRE 134 · commit 2: --strategy vælger HVORDAN vindue 2/3's seek udføres,
// kun no-op når --windows=old eller --seek=old (uændret gate for dem, se
// runOneClip). 'current' = den rettede skygge-seek fra ordre 121/124
// (standard, uændret). 'playthrough'/'fastseek'/'clone' er de tre forsøgte
// veje fra ordrens "stå på skuldre" (rtAdvanceTo/rtFastSeekToOn/rtEnsureClone
// i public/videocoach.html) - se RAPPORT-134.md for tallene og hvorfor kun
// én (om nogen) blev beholdt i produktionskoden.
const STRATEGY = flagValue('strategy', 'current')
if (!['current', 'playthrough', 'fastseek', 'clone'].includes(STRATEGY)) {
  throw new Error(`verify-videocoach-clip: --strategy skal være "current", "playthrough", "fastseek" eller "clone" (fik "${STRATEGY}").`)
}

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const cacheDir = join(root, 'docs', 'videocoach', 'clip-cache')
const syntheticClipPath = join(cacheDir, 'synthetic-set.mp4')
const syntheticGtPath = join(cacheDir, 'synthetic-set.ground-truth.json')
const testClipsDir = join(root, 'test-clips')

// ---------- 0) Rigtige klip eller det tegnede? ----------
// ORDRE 127 · commit 3: ALLE klip i test-clips\ (ikke kun det alfabetisk
// første) - Marc lægger typisk mere end ét (lys skive-sæt + sort/sort-sæt,
// se docs/videocoach/TEST-CLIPS.md), og de skal alle måles, ikke kun den
// første scriptet snubler over.
function findRealClips() {
  if (!existsSync(testClipsDir)) return []
  return readdirSync(testClipsDir).filter(f => /\.(mp4|mov)$/i.test(f)).sort()
}
function loadRealMeta(clipName) {
  const base = clipName.replace(/\.(mp4|mov)$/i, '')
  const metaPath = join(testClipsDir, `${base}.meta.json`)
  if (!existsSync(metaPath)) return {}
  try {
    const meta = JSON.parse(readFileSync(metaPath, 'utf8'))
    const fields = Object.keys(meta).filter(k => ['barPoint', 'plateRadius', 'windows', 'lift', 'repeatedIdenticalWindows'].includes(k))
    console.log(`Fandt ${base}.meta.json — felterne [${fields.join(', ') || 'ingen genkendte'}] vinder over automatikken, resten findes automatisk.`)
    return meta
  } catch (e) {
    console.log(`${base}.meta.json er ikke gyldig JSON (${e.message}) — ignoreres, alt findes automatisk.`)
    return {}
  }
}

// ORDRE 139 · commit 2: kravet pr. klip kommer nu fra test-clips\manifest.json
// (git-ignoreret ligesom klippene selv, se test-clips.manifest.example.json
// for skemaet) i stedet for én fast konstant for alle klip. Uden en post for
// et givet klip gælder standardkravet - 1,10x, IKKE diagnostisk - så et nyt
// klip Marc lægger i test-clips\ uden at røre manifestet stadig holdes til
// den fulde standard, ikke en utilsigtet lempelse.
const DEFAULT_REQUIREMENT = { maxRealtime: 1.10, diagnostic: false, description: null, reason: null }
function loadManifest() {
  const manifestPath = join(testClipsDir, 'manifest.json')
  if (!existsSync(manifestPath)) return {}
  try {
    return JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch (e) {
    console.log(`test-clips\\manifest.json er ikke gyldig JSON (${e.message}) — ignoreres, alle klip måles mod standardkravet (${DEFAULT_REQUIREMENT.maxRealtime}x, ikke diagnostisk).`)
    return {}
  }
}
function requirementFor(manifest, clipName) {
  const entry = manifest[clipName]
  if (!entry) return { ...DEFAULT_REQUIREMENT }
  const diagnostic = entry.diagnostic === true
  const maxRealtime = typeof entry.maxRealtime === 'number' ? entry.maxRealtime : DEFAULT_REQUIREMENT.maxRealtime
  // "Ingen grænse sænkes for ægte klip" (ordre 139) - kun et klip eksplicit
  // markeret diagnostic må have et krav løsere end standarden.
  if (!diagnostic && maxRealtime > DEFAULT_REQUIREMENT.maxRealtime) {
    throw new Error(`verify-videocoach-clip: manifest-posten for "${clipName}" sætter maxRealtime=${maxRealtime} uden diagnostic:true - en grænse må kun sænkes for et diagnostisk klip (se test-clips.manifest.example.json).`)
  }
  return { maxRealtime, diagnostic, description: entry.description || null, reason: entry.reason || null }
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

// ORDRE 127 · commit 3: ALLE klip i test-clips\, ikke kun det alfabetisk
// første - se runOneClip/main() nedenfor. "synthetic" bruges kun hvis
// test-clips\ er helt tomt.
const realClips = findRealClips()
const usingSynthetic = realClips.length === 0
if (usingSynthetic) {
  console.log('Intet klip i test-clips\\ endnu — venter på Marcs rigtige telefonoptagelse. Kører mod det tegnede klip (docs/videocoach/clip-cache/synthetic-set.mp4).')
} else if (realClips.length > 1) {
  console.log(`${realClips.length} klip fundet i test-clips\\ — kører alle: ${realClips.join(', ')}.`)
}

if (usingSynthetic && (!existsSync(syntheticClipPath) || !existsSync(syntheticGtPath))) {
  console.log('Intet tegnet testklip fundet — genererer det først (npm run test:clip) ...')
  const gen = spawnSync(process.execPath, [join(here, 'make-test-clip.mjs')], { stdio: 'inherit' })
  if (gen.status !== 0) { console.error('Kunne ikke generere testklippet.'); process.exit(1) }
}

const groundTruth = usingSynthetic ? JSON.parse(readFileSync(syntheticGtPath, 'utf8')) : null

// ---------- 1) Udtræk den levende tracker-kode 1:1 fra videocoach.html ----------
const htmlPath = join(root, 'public', 'videocoach.html')
// ORDRE 124 · commit 1: --seek=old finder commit'en "... (ordre 121 · commit
// 1)" i git-historikken og udtrækker fra dens FORÆLDER i stedet for
// arbejdstræets fil - dvs. videocoach.html PRÆCIS som den så ud lige før
// skygge-seeket blev indført. Alle blokke herunder (tracker/autoCalib/
// repDetect/realtimePreview/presearch) udtrækkes fra samme tekst, så en
// eventuel utilsigtet afhængighed af andre ORDRE 121-ændringer i de
// (uændrede) blokke også bliver ægte "før"-adfærd, ikke kun de to blokke
// commit 1 selv rørte.
function findOldSeekRevision() {
  const res = spawnSync('git', ['log', '--format=%H %s'], { cwd: root, encoding: 'utf8' })
  if (res.status !== 0) throw new Error('verify-videocoach-clip: "git log" fejlede - kan ikke slå --seek=old op.')
  const line = (res.stdout || '').split('\n').find(l => l.includes('ordre 121 · commit 1)'))
  if (!line) throw new Error('verify-videocoach-clip: fandt ikke commit "... (ordre 121 · commit 1)" i git-historikken - --seek=old kræver den for at hente videocoach.html FØR skygge-seeket.')
  return line.split(' ')[0] + '^'
}
function loadHtmlSource(seekMode) {
  if (seekMode !== 'old') return readFileSync(htmlPath, 'utf8')
  const rev = findOldSeekRevision()
  const res = spawnSync('git', ['show', `${rev}:public/videocoach.html`], { cwd: root, encoding: 'utf8', maxBuffer: 1024 * 1024 * 64 })
  if (res.status !== 0) throw new Error(`verify-videocoach-clip: "git show ${rev}:public/videocoach.html" fejlede - ${res.stderr || ''}`)
  console.log(`--seek=old: videocoach.html udtrukket fra ${rev} (revisionen lige før "ordre 121 · commit 1" - ingen skygge-seek).`)
  return res.stdout
}
const html = loadHtmlSource(SEEK_MODE)
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
// ORDRE 121 · commit 2: udtræk gentagelses-VINDUE-forudsøgningen (samme
// funktion den rigtige "Vis mig nu" selv kalder, vcAthletePreviewThree ->
// vcRunRepWindowsPresearch) - 1:1, uændret. vcMotionSeries og VC_PRESEARCH_W
// deles med den (urelaterede) SÆT-grænse-forudsøgning fra ORDRE 50, som
// selv trækker awaitCalib/curUrl ind (ikke stubbet her, uden interesse) -
// derfor to smalle udtræk (kun vcMotionSeries + konstanten) i stedet for
// hele ORDRE 50-blokken.
const motionSeriesSource = extractBlock(html,
  'function vcMotionSeries(frames) {', 'function vcFindSetBounds(times, motion, duration, opts = {}) {')
const presearchWidthSource = extractBlock(html,
  'const VC_PRESEARCH_W = 48, VC_PRESEARCH_MAX_SAMPLES = 30;', 'async function vcRunSetBoundsPresearch(duration) {')
// ORDRE 124 · commit 1: udtrækkes nu ved SIGNATUR + balancerede krøllede
// parenteser, ikke ved "ORDRE 54 · slut"-kommentarmarkøren - den markør
// flyttede sig (ordre 121 · commit 2, se videocoach.html) fra lige efter
// vcFindRepAnchors til lige efter vcRunRepWindowsPresearch. --seek=old
// udtrækker fra revisionen FØR den flytning, hvor markøren derfor IKKE
// dækker vcRunRepWindowsPresearch - en ren tekstmarkør ville stille og
// roligt udtrække en tom/forkert funktion og først fejle som en kryptisk
// "vcRunRepWindowsPresearch is not defined" inde i den headless side.
function extractFunctionAt(text, signature) {
  // signature skal ende med funktionens EGEN krop-åbnende "{" - ellers
  // finder et naivt indexOf('{', ...) i stedet en parameter-default's
  // brace (fx "opts = {}") og stopper efter blot ét tegn.
  if (!signature.endsWith('{')) throw new Error(`verify-videocoach-clip: extractFunctionAt kræver en signatur der ender på "{" (fik "${signature}").`)
  const startIdx = text.indexOf(signature)
  if (startIdx < 0) throw new Error(`verify-videocoach-clip: funktions-signatur ikke fundet ("${signature.slice(0, 60)}...") - er videocoach.html omstruktureret?`)
  let depth = 1, i = startIdx + signature.length
  for (; i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}') { depth--; if (depth === 0) { i++; break } }
  }
  if (depth !== 0) throw new Error(`verify-videocoach-clip: ubalancerede "{}" fra signaturen ("${signature.slice(0, 60)}...") - er videocoach.html omstruktureret?`)
  return text.slice(startIdx, i)
}
const repAnchorsSource = extractFunctionAt(html, 'function vcFindRepAnchors(times, motion, opts = {}) {')
const repPresearchConstMatch = html.match(/const VC_REP_PRESEARCH_MAX_SAMPLES = \d+;/)
if (!repPresearchConstMatch) throw new Error('verify-videocoach-clip: "VC_REP_PRESEARCH_MAX_SAMPLES" ikke fundet - er videocoach.html omstruktureret?')
const repWindowsPresearchFnSource = extractFunctionAt(html, 'async function vcRunRepWindowsPresearch(setStart, setEnd) {')
const repWindowsPresearchSource = repAnchorsSource + '\n' + repPresearchConstMatch[0] + '\n' + repWindowsPresearchFnSource
const presearchSource = motionSeriesSource + '\n' + presearchWidthSource + '\n' + repWindowsPresearchSource

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
// ORDRE 127 · commit 3: funktion af klippets sti, ikke en modul-konstant -
// hvert klip i test-clips\ får sin egen harness-side (samme udtrukne
// tracker-/autoCalib-/rep-/presearch-kilde ovenfor, kun selve videoen skifter).
function buildHarnessHtml(clipPathForClip) {
  const clipBase64 = readFileSync(clipPathForClip).toString('base64')
  return `<!doctype html>
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
// ORDRE 116 · commit 1: stub for pr.-frame-profilen vcRealtimeTrackWindow
// skriver til (public/videocoach.html, deklareret ved siden af VC_DIAG -
// uden for det udtrukne ORDRE 80-blok, derfor stub'et her ligesom de andre
// app-globals ovenfor).
// ORDRE 134 · commit 1: seekMs/foersteFrameMs/sporingMs tilføjet (samme
// felter som public/videocoach.html - se vcRealtimeTrackWindow), til
// tabellen pr. vindue nedenfor.
let vcRtDiag = { seekMs: 0, foersteFrameMs: 0, sporingMs: 0, hentMs: 0, nedskaleringMs: 0, soegningMs: 0, tegningMs: 0, filterMs: 0, framesTracked: 0, framesSkipped: 0 };
// ORDRE 121 · commit 2: stubs for vcRunRepWindowsPresearch's egne vagter -
// aldrig sande her (ingen wizard/plade-bekræftelse kører i denne bænk).
let wizard = null, plateConfirm = null;
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
${presearchSource}
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
// ORDRE 121 · commit 2: den RIGTIGE "Vis mig nu"-vej finder sine vinduer via
// presearch (vcRunRepWindowsPresearch) - ALDRIG via den fulde, seek-baserede
// analyse (runAnalysis ovenfor er kun til facit/sammenligning i denne bænk).
window.runRepWindowsPresearch = async function(setStart, setEnd) {
  const t0 = performance.now();
  const r = await vcRunRepWindowsPresearch(setStart, setEnd);
  return { ok: r.ok, windows: r.windows, ms: performance.now() - t0 };
};
// ORDRE 80 · commit 2 / ORDRE 82 · commit 2: "Vis mig nu"s realtids-vej.
// ORDRE 121 · commit 3: fælles kerne for ét vindue, brugt af BÅDE den
// enkeltstående window.runRealtimePreview (KOLD - se main()) og
// window.runVisMigNu (VARM, flere vinduer i træk - se den nedenfor).
async function trackOneWindow(barPt, windowStart, windowEnd, lift, preSeek, opts = {}) {
  tracking = true;
  // ORDRE 116 · commit 1: nulstil pr.-frame-profilen for netop dette vindue
  // (samme reset som vcAthletePreviewThree gør i den rigtige app).
  vcRtDiag = { seekMs: 0, foersteFrameMs: 0, sporingMs: 0, hentMs: 0, nedskaleringMs: 0, soegningMs: 0, tegningMs: 0, filterMs: 0, framesTracked: 0, framesSkipped: 0 };
  const t0 = performance.now();
  // ORDRE 134 · commit 2: opts (sourceVideo/pauseAtEnd) videresendt 1:1 til
  // vcRealtimeTrackWindow - default {} giver PRÆCIS samme kald som før.
  const { path, ok } = await vcRealtimeTrackWindow({ x: barPt.x, y: barPt.y, r: barPt.r }, windowStart, windowEnd, preSeek, opts);
  const ms = performance.now() - t0;
  // ORDRE 116 · commit 3: SAMME efterbehandling som vcAthletePreviewThree gør
  // i den rigtige app (public/videocoach.html) - freezeRawAcquisition +
  // analyzePath, så path.raw/path.analysis.visualPts bliver sat 1:1 som ved
  // en ægte "Vis mig nu"-kørsel. Bekræfter at drawStroke rent faktisk tager
  // drawCleanBarPath-grenen (kræver s.raw && s.analysis) og altså tegner med
  // den udglattede visningsbane, ikke den rå - se RAPPORT-116.md.
  let visualPtsInfo = null;
  if (ok) {
    freezeRawAcquisition(path, { schema: 1, lift: lift || 'squat', trackingStart: windowStart, trackingEnd: windowEnd });
    analyzePath(path);
    const vp = path.analysis && path.analysis.visualPts;
    const rawPts = path.raw.pts;
    const maxShift = vp ? Math.max(0, ...vp.map((p, i) => Math.hypot(p.x - rawPts[i].x, p.y - rawPts[i].y))) : null;
    visualPtsInfo = { hasRaw: !!path.raw, hasAnalysis: !!path.analysis, visualPtsLength: vp ? vp.length : 0, maxShiftFromRawPx: maxShift };
  }
  return {
    ok, ms,
    pts: path.pts.map(p => ({ x: p.x, y: p.y })),
    times: [...path.times],
    valid: [...path.valid],
    rtDiag: vcRtDiag,
    visualPtsInfo,
  };
}
window.runRealtimePreview = async function(barPt, windowStart, windowEnd, lift) {
  strokes.length = 0;
  return trackOneWindow(barPt, windowStart, windowEnd, lift, null);
};
// ORDRE 121 · commit 1/3: samme sekventielle skygge-seek-mønster som
// vcAthletePreviewThree selv bruger (næste vindues seek startet MENS forrige
// vindues efterbehandling kører) - IKKE et 1:1-udtræk (vcAthletePreviewThree
// er tæt vævet ind i DOM/UI-tilstand: say(), setAthleteState, trimStart/
// paintTrim, strokes, vcAthleteUploadAndGo), men bruger kun de udtrukne,
// ægte funktioner (vcRealtimeTrackWindow/rtSeekTo) til selve arbejdet, i
// SAMME rækkefølge/pendingSeek-mønster som public/videocoach.html. Nødvendig
// for overhovedet at kunne måle "mellem vinduer"-skyggen: et løfte startet i
// ét page.evaluate()-kald kan ikke overleve til det NÆSTE evaluate-kald fra
// Node, så vinduerne skal spores i én sammenhængende kørsel her i browseren,
// ikke som separate kald fra main() (se RAPPORT-121.md).
window.runVisMigNu = async function(barPt, windowsList, lift) {
  strokes.length = 0;
  const results = [];
  let pendingSeek = null;
  for (let k = 0; k < windowsList.length; k++) {
    const w = windowsList[k];
    const r = await trackOneWindow(barPt, w.start, w.end, lift, pendingSeek);
    const nextW = windowsList[k + 1];
    pendingSeek = nextW ? rtSeekTo(nextW.start) : null;
    results.push(r);
  }
  return results;
};
// ORDRE 124 · commit 2: samme som runVisMigNu ovenfor, men kalder SELV
// vcRunRepWindowsPresearch først (i SAMME evaluate()-kald, ligesom den
// rigtige vcAthletePreviewThree gør) og bruger dens firstWindowSeek som
// pendingSeek for VINDUE 1 - den rettelse denne ordre lavede i
// videocoach.html. runVisMigNu ovenfor kan IKKE modtage det løfte fra en
// tidligere, separat page.evaluate()-kaldt presearch (et løfte overlever
// ikke evaluate()-grænsen fra Node, se kommentaren ved runVisMigNu), så
// --windows=new --seek=new bruger denne i stedet for at teste den RIGTIGE,
// rettede kode-vej 1:1 - windowsList styrer stadig hvilke vinduer der
// rent faktisk spores/scores, presearchs EGNE fundne vinduer bruges ikke.
window.runVisMigNuFromPresearch = async function(barPt, setStart, setEnd, windowsList, lift) {
  strokes.length = 0;
  const presearch = await vcRunRepWindowsPresearch(setStart, setEnd);
  const results = [];
  let pendingSeek = presearch.firstWindowSeek || null;
  for (let k = 0; k < windowsList.length; k++) {
    const w = windowsList[k];
    const r = await trackOneWindow(barPt, w.start, w.end, lift, pendingSeek);
    const nextW = windowsList[k + 1];
    pendingSeek = nextW ? rtSeekTo(nextW.start) : null;
    results.push(r);
  }
  return results;
};

// ORDRE 134 · commit 2(a): "playthrough" - INGEN seek mellem vinduerne.
// Vindue 1 seekes én gang (presearchs egen skygge-seek, uændret), men
// derefter lades videoen blive ved med at spille (opts.pauseAtEnd=false på
// alle vinduer undtagen det sidste) - rtAdvanceTo (public/videocoach.html)
// venter blot på at den ALLEREDE afspillende video selv når frem til næste
// vindues start, sporing slået fra i mellemrummet (ingen drawImage/match).
window.runVisMigNuFromPresearchPlaythrough = async function(barPt, setStart, setEnd, windowsList, lift) {
  strokes.length = 0;
  const presearch = await vcRunRepWindowsPresearch(setStart, setEnd);
  const results = [];
  let pendingSeek = presearch.firstWindowSeek || null;
  for (let k = 0; k < windowsList.length; k++) {
    const w = windowsList[k];
    const isLast = k === windowsList.length - 1;
    const r = await trackOneWindow(barPt, w.start, w.end, lift, pendingSeek, { pauseAtEnd: isLast });
    const nextW = windowsList[k + 1];
    pendingSeek = nextW ? rtAdvanceTo(video, nextW.start) : null;
    results.push(r);
  }
  return results;
};

// ORDRE 134 · commit 2(b): "fastseek" - samme skygge-mønster som den
// nuværende, rettede kode (runVisMigNuFromPresearch ovenfor), men de
// MELLEMLIGGENDE seeks (vindue 2, 3, ...) bruger video.fastSeek() i stedet
// for at sætte currentTime direkte (rtFastSeekToOn, public/videocoach.html) -
// vindue 1's seek (presearchs egen) er uændret, ude for denne ordres
// grænser at ændre (delt med den almindelige sæt-grænse-forudsøgning).
window.runVisMigNuFromPresearchFastSeek = async function(barPt, setStart, setEnd, windowsList, lift) {
  strokes.length = 0;
  const presearch = await vcRunRepWindowsPresearch(setStart, setEnd);
  const results = [];
  let pendingSeek = presearch.firstWindowSeek || null;
  for (let k = 0; k < windowsList.length; k++) {
    const w = windowsList[k];
    const r = await trackOneWindow(barPt, w.start, w.end, lift, pendingSeek);
    const nextW = windowsList[k + 1];
    pendingSeek = nextW ? rtFastSeekToOn(video, nextW.start) : null;
    results.push(r);
  }
  return results;
};

// ORDRE 134 · commit 2(c): "clone" - en skjult video-klon (rtEnsureClone,
// public/videocoach.html) forudsøges til vindue k+1 MENS vindue k's EGEN
// sporing (på det andet, aktive element) stadig kører - et helt vindues
// varighed som skygge i stedet for blot efterbehandlingens få ms. De to
// elementer bytter rolle for hvert vindue (dobbelt-bufring): "active" er det
// element der lige nu spores/vises, "idle" det der forudsøger NÆSTE+1
// vindue. Med netop 3 vinduer (altid ulige antal her) ender "active" tilbage
// på selve video - ingen afsluttende re-sync nødvendig.
window.runVisMigNuFromPresearchClone = async function(barPt, setStart, setEnd, windowsList, lift) {
  strokes.length = 0;
  const presearch = await vcRunRepWindowsPresearch(setStart, setEnd);
  const results = [];
  let active = video, idle = rtEnsureClone();
  let pendingSeek = presearch.firstWindowSeek || null;
  for (let k = 0; k < windowsList.length; k++) {
    const w = windowsList[k];
    // Start NÆSTE vindues seek på DET LEDIGE element FØR dette vindues egen
    // sporing overhovedet starter - hele dette vindues spilletid (typisk
    // 0,5-2,5s) bliver dermed skygge, ikke kun efterbehandlingens få ms
    // (sammenlign med den nuværende, rettede kode's blotte
    // freezeRawAcquisition/analyzePath-vindue, ordre 121/124).
    const nextW = windowsList[k + 1];
    const idleSeekForNext = nextW ? rtSeekToOn(idle, nextW.start) : null;
    const r = await trackOneWindow(barPt, w.start, w.end, lift, pendingSeek, { sourceVideo: active });
    results.push(r);
    [active, idle] = [idle, active];
    pendingSeek = idleSeekForNext;
  }
  return results;
};
<\/script>
</body></html>`
}

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

// ORDRE 127 · commit 3: kørslen for ÉT klip (tegnet eller ét af flere rigtige
// klip i test-clips\) - udtrukket fra den tidligere main(), som kun kørte
// præcis ét klip. Kaldes én gang pr. klip fra main() nedenfor; browseren er
// fælles (genbrugt på tværs af klip), men hvert klip får sin egen side/
// harness (buildHarnessHtml). Returnerer et sammenfatnings-objekt i stedet
// for selv at kalde process.exit - main() samler facit og afgør exit-koden.
async function runOneClip(browser, mode, clipPathForClip, realMeta, realClipName, requirement) {
  const HARNESS_HTML = buildHarnessHtml(clipPathForClip)
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

  // ORDRE 121 · commit 2: vinduerne til "Vis mig nu" kommer nu fra PRESEARCH
  // (vcRunRepWindowsPresearch, samme funktion den rigtige app selv kalder) -
  // ALDRIG fra den fulde analyses egen rep-detektion, som den rigtige "Vis
  // mig nu" aldrig kører. Den fulde analyse (full.repWindows) er kun en
  // fallback hvis presearch ikke finder noget (og selve KILDEN til facit-
  // banen/truthFn nedenfor - det ændres ikke).
  //
  // Presearch skal (som i den rigtige app) have det BEKRÆFTEDE SÆT-interval,
  // ikke hele rå-filen: et rigtigt klip har typisk dødtid før/efter selve
  // løftet (opsætning, gå væk), og presearch tog fejl af den støj som ægte
  // reps, da denne bænk (uden en atlet der selv trimmer) i første forsøg gav
  // den HELE klippets varighed. Det bekræftede sæt findes her ved at bruge
  // den fulde analyses egen (mere præcise) rep-detektion som et sted at
  // centrere et lille margin omkring - en rimelig stand-in for atletens eget
  // "spol til lige før/efter", ikke en ændring af selve presearch-funktionen.
  // 0,05s margin - en balance mellem to modsatrettede grænser, begge afprøvet
  // og dokumenteret i RAPPORT-121.md: 0s margin gør spændet (0,56s på Marcs
  // klip) kortere end presearchs EGEN minimumsgrænse (span > 0,6s), som
  // fejler helt (ok:false); et rundhåndet margin (afprøvet: 1,0s og 0,2s)
  // trækker til gengæld irrelevant dødtid ind i vinduet (vcFindRepAnchors
  // finder kun PAUSER INDENI settet - for ét enkelt rep er der ingen at
  // finde, så vinduet bliver ALTID hele sæt-intervallet, margin inklusive) og
  // ødelagde sporingen (maxPx 64-89px, over grænsen 35px). 0,05s er den
  // mindste værdi der får presearch over sin egen minimumsgrænse på netop
  // dette klip - stadig en ægte grænse for hvor tæt en ENKELT-reps bænk
  // (uden en atlet der selv trimmer) kan efterligne det virkelige flow. Den
  // rigtige app ville i øvrigt ALDRIG vise "Vis mig nu" for et sæt med kun 1
  // fundet vindue (vcAthletePreviewThree kræver mindst 3, se dens egen
  // guard) - denne bænk tester vinduet alligevel, udelukkende til diagnostik
  // (se pickThreeWindows). Netop derfor bygger commit 3 et rigtigt
  // multi-reps-klip.
  const PRESEARCH_SET_MARGIN_S = 0.05
  // ORDRE 124 · commit 1: fandt at "confirmed set"-standinen herunder (uden
  // fundne full.repWindows) faldt tilbage til PRÆCIS dims.duration som
  // sæt-slut - vcRunRepWindowsPresearch's eget anchor+0.15-loft
  // (`Math.min(setEnd, ...)`) endte derfor med at bygge et vindue der sluttede
  // PRÆCIS ved video.duration. Real-tids-sporing (vcRealtimeTrackWindow) af
  // netop det vindue crasher headless Chromium HELT UAFHÆNGIGT af
  // --seek=old|new (reproduceret begge veje, se RAPPORT-124.md) - en seek
  // helt ud til den sidste, ofte ikke-eksisterende decodede frame er en kendt
  // skrøbelig kant i browseres videodekodere, ikke en ordre 121/124-
  // regression. SEEK_SAFETY_MARGIN_S holder sæt-slutningen (kun denne
  // bænks EGEN stand-in for atletens trim, se kommentaren ovenfor - ikke
  // vcRunRepWindowsPresearch selv) én frame inden for klippets rapporterede
  // varighed, så et vindue aldrig sigter efter den sidste, upålidelige frame.
  const SEEK_SAFETY_MARGIN_S = 1 / 30
  const presearchSetStart = (mode === 'real' && full.repWindows.length)
    ? Math.max(0, full.repWindows[0].start - PRESEARCH_SET_MARGIN_S) : 0
  const presearchSetEnd = Math.max(presearchSetStart, Math.min(dims.duration - SEEK_SAFETY_MARGIN_S,
    (mode === 'real' && full.repWindows.length) ? full.repWindows.at(-1).end + PRESEARCH_SET_MARGIN_S : dims.duration))
  if (mode === 'real') {
    if (realMeta.windows && realMeta.windows.length) {
      windows = realMeta.windows
      console.log(`${windows.length} gentagelse(r) fra sidecar-filen: ` + windows.map(w => `${w.start.toFixed(2)}-${w.end.toFixed(2)}s`).join(', '))
    } else if (WINDOWS_MODE === 'old') {
      // ORDRE 124 · commit 1: --windows=old genskaber ordre 116/120's logik
      // FØR ordre 121 · commit 2 - vinduerne kommer KUN fra den fulde
      // analyses egen rep-detektion, presearch kaldes slet ikke.
      if (full.repWindows.length) {
        windows = full.repWindows
        console.log(`${windows.length} gentagelse(r) fundet automatisk (den fulde analyses egen rep-detektion - --windows=old, presearch ikke brugt): ` +
          windows.map(w => `${w.start.toFixed(2)}-${w.end.toFixed(2)}s`).join(', '))
      } else {
        const capped = Math.min(full.times.at(-1) ?? endT, (full.times[0] ?? startT) + 2)
        console.log('Ingen gentagelser fundet automatisk i den fulde analyse - bruger de første 2s af det analyserede spænd som ét vindue.')
        windows = [{ start: full.times[0] ?? startT, end: capped }]
      }
    } else {
      const presearch = await page.evaluate(([s, e]) => window.runRepWindowsPresearch(s, e), [presearchSetStart, presearchSetEnd])
      if (presearch.ok && presearch.windows.length) {
        windows = presearch.windows
        console.log(`${windows.length} gentagelse(r) fundet automatisk (presearch, ${presearch.ms.toFixed(0)}ms - samme vindues-kilde som den rigtige "Vis mig nu"): ` +
          windows.map(w => `${w.start.toFixed(2)}-${w.end.toFixed(2)}s`).join(', '))
      } else if (full.repWindows.length) {
        windows = full.repWindows
        console.log('Presearch fandt ingen tydelige gentagelser - falder tilbage til den fulde analyses egen rep-detektion for vindues-GRÆNSERNE (kun til denne bænk; den rigtige "Vis mig nu" har ingen fuld analyse at falde tilbage på).')
      } else {
        // ORDRE 120 · commit 2: uden en fundet rep bruges HELE klippets spænd
        // som ét "Vis mig nu"-vindue - det er ikke hvad "Vis mig nu" simulerer
        // (en kort rep-forhåndsvisning, ikke fuld-klip-sporing), og et langt
        // nok spænd fik headless Chromium til at crashe ("Target crashed") på
        // Marcs eget klip da gitter-søgningens startpunkt var dårligt. Loft på
        // 2s - nok til én rep, aldrig hele klippet. (Genindsat under ORDRE 124's
        // rebase - ordre 121 · commit 2's egen sidste-udvej droppede loftet.)
        const capped = Math.min(full.times.at(-1) ?? endT, (full.times[0] ?? startT) + 2)
        console.log('Ingen gentagelser fundet automatisk - bruger de første 2s af det analyserede spænd som ét vindue.')
        windows = [{ start: full.times[0] ?? startT, end: capped }]
      }
    }
  }

  const truthFn = mode === 'synthetic' ? truePosAt : makePathInterpolator(full.times, full.pts)
  const threeWindows = pickThreeWindows(windows)
  const p0s = threeWindows.map(w => truthFn(w.start))
  // ORDRE 124 · commit 3: facit PR. VINDUE for et klippet klip bygget af
  // IDENTISKE gentagne kopier (test-clips\vis-mig-nu-4-reps-syntetisk.mp4,
  // sidecar-feltet "repeatedIdenticalWindows": true - se dens .meta.json).
  // Uden dette var facit ÉT globalt: den fulde analyses egen sammenhængende,
  // seek-baserede spor hen over HELE det sammensatte klip. Det spor er kun
  // troværdigt frem til FØRSTE klip-samling (concat-demuxerens hårde snit
  // mellem to identiske kopier) - en kontinuerlig tracker der forventer
  // glidende bevægelse, men i stedet møder et spring tilbage til klippets
  // eget starttidspunkt (den næste kopi begynder forfra), kan miste eller
  // fejlgenfinde punktet dér, hvorefter HELE resten af det globale spor
  // drifter væk fra virkeligheden - ikke en fejl i selve realtids-sporingen
  // (vindue 1, FØR ethvert snit, ramte fint), men i FACIT for vindue 2+.
  // Da alle vinduer er pixel-identiske gentagelser af vindue 1's egen
  // bevægelse (kun forskudt i tid), er facit for vindue i > 0 i stedet
  // vindue 0's EGEN (ubeskadigede, før noget snit) del af det globale spor,
  // forskudt tilbage til vindue 0's tidsramme - ikke en ny, uafhængig
  // analyse (unødvendig, indholdet er jo identisk).
  const repeatedIdenticalWindows = mode === 'real' && realMeta.repeatedIdenticalWindows === true && threeWindows.length > 1
  function truthFnForWindow(i) {
    if (!repeatedIdenticalWindows) return truthFn
    const offset = threeWindows[i].start - threeWindows[0].start
    return t => truthFn(t - offset)
  }
  if (repeatedIdenticalWindows) console.log(`repeatedIdenticalWindows: facit for vindue 2+ er vindue 1's eget spor, tidsforskudt (ikke ét globalt facit hen over klip-samlingerne).`)

  // ---------- B) "Vis mig nu": op til tre vinduer ----------
  // ORDRE 124 · commit 1: én kørsel måler nu ÉN navngiven kombination
  // (--windows=old|new × --seek=old|new - se filens toptekst), ikke længere
  // en fast VARM+KOLD-parring. KOLD viste sig kontamineret så snart
  // --windows=new: presearch-kaldet der FANDT vinduerne (ovenfor) skygge-
  // seeker allerede til vindue 1 som bivirkning (ordre 121 · commit 1's
  // egen ændring i vcRunRepWindowsPresearch), så en efterfølgende "kold"
  // sekventiel måling på SAMME side aldrig betalte den fulde seek igen - det
  // var ikke en ærlig "uden ordre 121 · commit 1"-baseline. De fire
  // kombinationer måles derfor alle på en FRISK side (ingen fuld analyse har
  // rørt videoen), så den eneste forskel mellem dem rent faktisk er den
  // navngivne variabel - se RAPPORT-124.md for tallene og hvorfor.
  //   --seek=new: window.runVisMigNu (harnessets egen, HÅNDSKREVNE gengivelse
  //     af vcAthletePreviewThree's pendingSeek-mønster - se kommentaren ved
  //     dens definition ovenfor) - skygge-seeker MELLEM vinduer. Findes
  //     vinduerne via --windows=new, primes vindue 1 desuden af presearchs
  //     EGEN skygge-seek (samme kald som fandt vinduerne ovenfor, gentaget
  //     her på den friske side for at udløse den bivirkning realistisk -
  //     dens egne fundne vinduer bruges ikke, threeWindows styrer stadig).
  //   --seek=old: sekventielle, enkeltstående kald (window.runRealtimePreview
  //     pr. vindue) - ingen skygge er mulig her (hvert kald er sin egen
  //     page.evaluate(), et løfte kan ikke overleve til det næste - se
  //     kommentaren ved runVisMigNu's definition), og HARNESS_HTML er desuden
  //     bygget fra --seek=old's ÆLDRE videocoach.html-revision (findOldSeekRevision
  //     ovenfor), som slet ikke har skygge-koden.
  let comboResults = [], comboMs = 0
  if (mode === 'synthetic') {
    for (let i = 0; i < threeWindows.length; i++) {
      const w = threeWindows[i], p0 = p0s[i]
      const r = await page.evaluate(([barPt, s, e, l]) => window.runRealtimePreview(barPt, s, e, l), [{ x: p0.x, y: p0.y, r: plateR }, w.start, w.end, lift])
      comboResults.push(r); comboMs += r.ms
    }
  } else if (SEEK_MODE === 'new') {
    const pageFresh = await browser.newPage({ viewport: { width: 360, height: 640 } })
    pageFresh.on('pageerror', err => console.error('[browser pageerror, frisk side]', err))
    await pageFresh.setContent(HARNESS_HTML, { waitUntil: 'load' })
    await pageFresh.evaluate(() => window.__loaded)
    await pageFresh.evaluate(([w, h]) => window.__initCanvasDims(w, h), [dims.w, dims.h])
    await pageFresh.evaluate(r => window.__setPlateRadius(r), plateR)
    const barPtForCombo = p0s[0]
    if (WINDOWS_MODE === 'new') {
      // ORDRE 124 · commit 2: runVisMigNuFromPresearch kalder presearch OG
      // sporer alle vinduer i ÉT evaluate()-kald, så dens firstWindowSeek kan
      // gives videre som pendingSeek for vindue 1 - den rettede kode-vej (se
      // videocoach.html og kommentaren ved denne funktions definition).
      // ORDRE 134 · commit 2: --strategy vælger hvilken af de fire
      // window.runVisMigNuFromPresearch*-varianter der kaldes - alle fire
      // deler PRÆCIS samme presearch/vindues-opsætning ovenfor, kun HVORDAN
      // vindue 2/3's seek udføres varierer (se funktionernes definition).
      const STRATEGY_FN = {
        current: 'runVisMigNuFromPresearch',
        playthrough: 'runVisMigNuFromPresearchPlaythrough',
        fastseek: 'runVisMigNuFromPresearchFastSeek',
        clone: 'runVisMigNuFromPresearchClone',
      }[STRATEGY]
      comboResults = await pageFresh.evaluate(([bp, s, e, wins, l, fnName]) => window[fnName](bp, s, e, wins, l),
        [{ x: barPtForCombo.x, y: barPtForCombo.y, r: plateR }, presearchSetStart, presearchSetEnd, threeWindows, lift, STRATEGY_FN])
    } else {
      comboResults = await pageFresh.evaluate(([bp, wins, l]) => window.runVisMigNu(bp, wins, l),
        [{ x: barPtForCombo.x, y: barPtForCombo.y, r: plateR }, threeWindows, lift])
    }
    comboMs = comboResults.reduce((s, r) => s + r.ms, 0)
    await pageFresh.close()
  } else {
    const pageFresh = await browser.newPage({ viewport: { width: 360, height: 640 } })
    pageFresh.on('pageerror', err => console.error('[browser pageerror, frisk side]', err))
    await pageFresh.setContent(HARNESS_HTML, { waitUntil: 'load' })
    await pageFresh.evaluate(() => window.__loaded)
    await pageFresh.evaluate(([w, h]) => window.__initCanvasDims(w, h), [dims.w, dims.h])
    await pageFresh.evaluate(r => window.__setPlateRadius(r), plateR)
    for (let i = 0; i < threeWindows.length; i++) {
      const w = threeWindows[i], p0 = p0s[i]
      const r = await pageFresh.evaluate(([barPt, s, e, l]) => window.runRealtimePreview(barPt, s, e, l), [{ x: p0.x, y: p0.y, r: plateR }, w.start, w.end, lift])
      comboResults.push(r); comboMs += r.ms
    }
    await pageFresh.close()
  }
  const threePlayedS = threeWindows.reduce((s, w) => s + (w.end - w.start), 0)

  await page.close()

  // ---------- Evaluering ----------
  const fullDev = deviation(full.pts, full.times, truthFn)
  const comboDev = comboResults.map((r, i) => deviation(r.pts, r.times, truthFnForWindow(i)))
  const comboHops = comboResults.map((r, i) => countHops(r.pts, r.times, truthFnForWindow(i)))
  const comboFrames = comboResults.map((r, i) => frameStats(r, threeWindows[i]))
  const worstComboDev = comboDev.length
    ? { maxPx: Math.max(...comboDev.map(d => d.maxPx)), meanPx: Math.max(...comboDev.map(d => d.meanPx)) }
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
  const comboOk = comboResults.length > 0 && comboResults.every(r => r.ok) &&
    worstComboDev.meanPx <= TOLERANCE_MEAN_PX && worstComboDev.maxPx <= TOLERANCE_MAX_PX
  // ORDRE 139 · commit 2: kravet kommer fra manifestet (requirementFor),
  // ikke længere en fast konstant - se test-clips.manifest.example.json.
  const REALTIME_MAX_FACTOR = requirement.maxRealtime
  const realtimeFactor = threePlayedS > 0 ? comboMs / 1000 / threePlayedS : Infinity
  const realtimeFastEnough = realtimeFactor <= REALTIME_MAX_FACTOR

  const pass = fullOk && comboOk && realtimeFastEnough

  console.log(`\n== Klip: ${mode === 'real' ? `test-clips\\${realClipName} (RIGTIGT klip, ${lift}, facit = den fulde analyses egen bane)` : 'det tegnede klip (docs/videocoach/clip-cache/synthetic-set.mp4, facit = den kendte tegnede bane)'} ==`)
  if (mode === 'real') console.log(`== Kombination: --windows=${WINDOWS_MODE} --seek=${SEEK_MODE} --strategy=${STRATEGY} ==`)
  console.log('== A) Fuld analyse (uændret siden ordre 73) ==')
  console.log(`ok=${full.ok} frames=${full.pts.length} tid=${full.ms.toFixed(1)}ms meanPx=${fullDev.meanPx.toFixed(2)} maxPx=${fullDev.maxPx.toFixed(2)}`)
  console.log(`\n== B) "Vis mig nu" (${threeWindows.length} vindue(r): ${threeWindows.length < 3 ? 'færre end 3 fundet i klippet' : 'første, midt, sidste'}) - denne GATER testen - tal PR. VINDUE ==`)
  comboResults.forEach((r, i) => {
    const w = threeWindows[i], f = comboFrames[i], h = comboHops[i]
    console.log(`  vindue ${i + 1} [${w.start.toFixed(2)}s-${w.end.toFixed(2)}s, ${(w.end - w.start).toFixed(2)}s afspillet]`)
    console.log(`    ok=${r.ok} frames sporet=${f.framesTracked} sprunget over=${f.framesSkipped} ms/frame=${f.msPerFrame.toFixed(1)} tid/afspillet=${f.timeRatio.toFixed(2)}x`)
    console.log(`    afvigelse meanPx=${comboDev[i].meanPx.toFixed(2)} maxPx=${comboDev[i].maxPx.toFixed(2)} hop=${h.hops} (grænse ${h.hopSpeedPxS.toFixed(0)}px/s)`)
    // ORDRE 116 · commit 1: pr.-frame-nedbrydningen fra videocoach.html's
    // egen instrumentering (vcRtDiag) - "tegning" er altid 0 her, headless
    // Chromium kører aldrig app'ens synlige render()-løkke (kun tracker-
    // koden er udtrukket, se docs/videocoach/TID-PR-FRAME.md).
    const d = r.rtDiag, fc = Math.max(1, d.framesTracked + d.framesSkipped)
    console.log(`    pr. frame: hent=${(d.hentMs / fc).toFixed(2)}ms nedskaler=${(d.nedskaleringMs / fc).toFixed(2)}ms søg=${(d.soegningMs / fc).toFixed(2)}ms tegn=${(d.tegningMs / fc).toFixed(2)}ms(*) filter(total)=${d.filterMs.toFixed(2)}ms  [(*) altid 0 headless, se note]`)
    // ORDRE 134 · commit 1: tabel PR. VINDUE - seek-tid, første-frame-tid,
    // sporing (hele rVFC-løkkens vægtid), tegning (altid 0 headless, se
    // note ovenfor) og x realtid for NETOP dette vindue - se
    // vcRealtimeTrackWindow i public/videocoach.html for hvor buckets sættes.
    console.log(`    pr. vindue: seek=${d.seekMs.toFixed(1)}ms 1.frame=${d.foersteFrameMs.toFixed(1)}ms sporing=${d.sporingMs.toFixed(1)}ms tegn=${d.tegningMs.toFixed(1)}ms(*) samlet=${r.ms.toFixed(1)}ms (${(w.end - w.start) > 0 ? ((r.ms / 1000) / (w.end - w.start)).toFixed(2) : 'n/a'}x)`)
    // ORDRE 116 · commit 3: bekræfter at drawStroke tegner med den udglattede
    // visningsbane (path.analysis.visualPts), ikke den rå one-euro-bane -
    // samme efterbehandling som den rigtige app kører (freezeRawAcquisition +
    // analyzePath), kørt her i harnesset, ikke antaget.
    const vpi = r.visualPtsInfo
    console.log(`    visningsbane: raw+analysis sat=${vpi ? (vpi.hasRaw && vpi.hasAnalysis) : false} visualPts=${vpi?.visualPtsLength ?? 0} punkter, maks. forskydning fra rå bane=${vpi?.maxShiftFromRawPx?.toFixed(2) ?? 'n/a'}px`)
  })
  console.log(`  samlet tid (${threeWindows.length} vindue(r)): ${comboMs.toFixed(1)}ms · samlet afspillet varighed: ${(threePlayedS * 1000).toFixed(1)}ms · forhold: ${realtimeFactor.toFixed(2)}x (grænse ${REALTIME_MAX_FACTOR}x)`)
  console.log(`\nTolerance: mean ≤ ${TOLERANCE_MEAN_PX}px, max ≤ ${TOLERANCE_MAX_PX}px (se kildekoden for begrundelsen).`)
  console.log(pass
    ? `\nGRØN: alle reps fundet i den fulde analyse, alle "Vis mig nu"-vinduer fundet inden for tolerance, og "Vis mig nu" var færdig senest ${REALTIME_MAX_FACTOR}x sin egen afspillede varighed.`
    : `\nFEJL: ${!fullOk ? 'fuld analyse fejlede tolerancen eller fandt ikke alle reps. ' : ''}${!comboOk ? '"Vis mig nu" fejlede tolerancen. ' : ''}${!realtimeFastEnough ? `"Vis mig nu" tog ${realtimeFactor.toFixed(2)}x sin afspillede varighed, over grænsen ${REALTIME_MAX_FACTOR}x.` : ''}`)
  // ORDRE 139 · commit 2: et diagnostisk klip (manifest-flag) måles og
  // printes fuldt ud som ethvert andet klip, men fælder ALDRIG hele testen -
  // se requirementFor/main().
  if (requirement.diagnostic) console.log(`(diagnostisk klip${requirement.reason ? ` - ${requirement.reason}` : ''} - denne linje fælder ikke testen, se test-clips\\manifest.json.)`)
  if (mode === 'real' && threeWindows.length < 3) console.log(`\n(Kun ${threeWindows.length} gentagelse(r) i dette klip — et sæt på 3-5 reps giver et mere sigende billede, se docs/videocoach/TEST-CLIPS.md.)`)
  if (mode === 'synthetic') console.log('\n(Kører stadig mod det TEGNEDE klip — læg en rigtig telefonoptagelse i test-clips\\ for at måle mod virkeligheden.)')

  // ORDRE 127 · commit 3: én linje pr. klip, til main()s sammenfatning -
  // browseren lukkes samlet dér (ikke pr. klip), da den nu deles på tværs
  // af alle klip i test-clips\. ORDRE 139 · commit 2: linjen viser nu også
  // klippets EGET krav (kan variere pr. klip, se manifestet) og om det er
  // diagnostisk (måles, men fælder ikke den samlede test).
  const clipLabel = mode === 'real' ? `test-clips\\${realClipName}` : 'det tegnede klip'
  const line = `${clipLabel}: ${threeWindows.length} vindue(r), forhold ${realtimeFactor.toFixed(2)}x (krav ≤${REALTIME_MAX_FACTOR}x${requirement.diagnostic ? ', diagnostisk' : ''}), meanPx=${worstComboDev.meanPx.toFixed(2)}, maxPx=${worstComboDev.maxPx.toFixed(2)}`
  return { pass, line, diagnostic: requirement.diagnostic }
}

// ORDRE 127 · commit 3: kør ALLE klip i test-clips\ (findRealClips ovenfor),
// ikke kun det alfabetisk første - eller det tegnede klip, hvis mappen er
// tom. Én browser genbruges på tværs af klip (hvert klip får sin egen
// side/harness, se runOneClip). Slutter med én linje pr. klip, og fejler
// (exit 1) hvis blot ét klip fejler sin egen tolerance.
async function main() {
  // ORDRE 139 · commit 2: manifestet indlæses én gang for alle klip - se
  // requirementFor ovenfor for standardkravet når et klip mangler en post.
  const manifest = loadManifest()
  const browser = await chromium.launch({ headless: true })
  const summaries = []
  try {
    if (usingSynthetic) {
      summaries.push(await runOneClip(browser, 'synthetic', syntheticClipPath, {}, null, { ...DEFAULT_REQUIREMENT }))
    } else {
      for (const clipName of realClips) {
        const realMeta = loadRealMeta(clipName)
        const clipPathForClip = ensureMp4H264(join(testClipsDir, clipName))
        const requirement = requirementFor(manifest, clipName)
        summaries.push(await runOneClip(browser, 'real', clipPathForClip, realMeta, clipName, requirement))
      }
    }
  } finally {
    // ORDRE 121 · commit 2: eksplicit process.exit (ikke kun exitCode) - to
    // browser-sider kan efterlade en håndtag åben der ellers holder Node's
    // event loop kørende i det uendelige, uden mere output.
    await browser.close()
  }
  if (summaries.length > 1) {
    console.log('\n== Sammenfatning (ét klip pr. linje) ==')
    for (const s of summaries) console.log(`  ${s.pass ? 'GRØN' : 'FEJL'}  ${s.line}`)
  }
  // ORDRE 139 · commit 2: kun IKKE-diagnostiske klip fælder den samlede test
  // (exit-koden) - et diagnostisk klip måles og printes ovenfor som alle
  // andre, men dets egen FEJL/GRØN tæller ikke med her.
  const gating = summaries.filter(s => !s.diagnostic)
  const allPass = gating.every(s => s.pass)
  if (summaries.some(s => s.diagnostic)) {
    console.log(allPass
      ? '\nGRØN (samlet): alle ikke-diagnostiske klip holder deres krav.'
      : '\nFEJL (samlet): mindst ét ikke-diagnostisk klip holder ikke sit krav.')
  }
  process.exit(allPass ? 0 : 1)
}

main().catch(err => { console.error(err); process.exit(1) })
