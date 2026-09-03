// Regressionslås for ORDRE 20 bug 2 (zoom viste kun ét hjørne af videoen) —
// se ORDRE 23. Kildetekst-verifikation af videocoach.html's wiring (samme
// stil som de øvrige scripts/verify-videocoach-*.mjs), plus de rene
// zoom-matematik-tests i public/videocoach-zoom.test.js (kørt separat via
// `node --test`, inkl. et 390px-mobilscenarie og fire-hjørne-panorering).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const html = readFileSync(new URL('../public/videocoach.html', import.meta.url), 'utf8')
const zoomJs = readFileSync(new URL('../public/videocoach-zoom.js', import.meta.url), 'utf8')

// --- Den delte, enhedstestede zoom-matematik er faktisk koblet på -----------
assert.match(html, /<script type="module" src="videocoach-zoom\.js"><\/script>/,
  'videocoach-zoom.js skal loades som modul FØR hovedscriptet')
assert.match(zoomJs, /export function zoomKeepingPoint\(base, refFocal, refZoom, targetFocal, newScale\)/)
assert.match(zoomJs, /window\.VideoCoachZoom = \{ zoomKeepingPoint, clampScale \}/,
  'zoomKeepingPoint skal eksponeres globalt til det ikke-modul hovedscript')

// --- Touch-pinch bruger den delte funktion, ikke sin egen kopi --------------
assert.match(html, /VideoCoachZoom\.zoomKeepingPoint\(\s*\n\s*pinch\.base, pinch\.m0, \{ s: pinch\.s0, x: pinch\.x0, y: pinch\.y0 \}, m, s\)/)

// --- Ctrl\/Cmd+hjul zoomer om musemarkøren — fandtes slet ikke før ----------
assert.match(html, /if \(e\.ctrlKey \|\| e\.metaKey\) \{ zoomAtCursor\(e\); return; \}/,
  'Musehjul-handleren skal skelne Ctrl\\/Cmd (trackpad-klemme) fra almindelig frame-step-scroll')
assert.match(html, /function zoomAtCursor\(e\) \{/)
assert.match(html, /const focal = \{ x: e\.clientX, y: e\.clientY \};/,
  'zoomAtCursor skal bruge musens position som pegepunkt, ikke et fast hjørne')
assert.match(html, /VideoCoachZoom\.zoomKeepingPoint\(base, focal, zoom, focal, s\)/)

// --- Safaris native pinch-zoom (iOS-tilgængelighed ignorerer maximum-scale) -
// må ikke længere kunne lægge sig oveni vores egen — det var hovedkilden til
// "kun højre hjørne i syne".
assert.match(html, /window\.addEventListener\('gesturestart', e => e\.preventDefault\(\)\)/)
assert.match(html, /window\.addEventListener\('gesturechange', e => e\.preventDefault\(\)\)/)

// --- MIN/MAX-zoom er navngivne konstanter (regressionsguard mod at et af de
// to steder glemmes hvis grænserne ændres) --------------------------------
assert.match(html, /const MIN_ZOOM = 0\.3;/)
assert.match(html, /const MAX_ZOOM = 4;/)
assert.equal((html.match(/Math\.min\(MAX_ZOOM,/g) || []).length, 2,
  'Både pinch- og hjul-zoom skal klemmes til samme MAX_ZOOM')

console.log('videocoach.html bruger den delte, enhedstestede zoom-matematik til både pinch og Ctrl/Cmd-hjul, og blokerer Safaris native pinch-zoom.')
