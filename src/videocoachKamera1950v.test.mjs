import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Ordre 1950v (Marc 19. nov. kl. 20:50: "bar tracker misser stadig, den er ikke reliabel"; 1932v målte håndholdt
// kamera 26 til 31 % for lavt). Prøver den levende kode i public/videocoach.html: kameraets bevægelse måles på
// baggrunden (kbStep), og analysen trækker den fra, så farten er stangens egen, også når telefonen holdes i hånden.
const html = readFileSync(new URL('../public/videocoach.html', import.meta.url), 'utf8')
const skaer = (fra, til) => { const a = html.indexOf(fra), b = html.indexOf(til, a); assert.ok(a > 0 && b > a, `findes i videocoach.html: ${fra.slice(0, 40)}`); return html.slice(a, b) }

// kbStep med dens hjælpere (mpClamp, mpMedian, mpPatchStats, mpZnssd, mpMatchPoint)
const kbKode = skaer('const mpClamp = ', 'function mpCropBounds(') + skaer('function mpPatchStats(frame', 'function kbGrab(') + skaer('function kbSub(', '// ORDRE 1192: sporing uden requestVideoFrameCallback')
const kb = new Function(`${kbKode}; return { kbStep, KB_SCALE, mpMatchPoint }`)()

// analysen fra siden, kørt på en bane (som i videocoachFart1932v.test.mjs)
const analyse = new Function('path', 'canvas', 'cmPerPx', `const buildVisualBarPath = () => [], updateCleanReviewUI = () => {};
${skaer('function analyzeCleanPath(path) {', 'function analyzePath(path) {')}
  return analyzeCleanPath(path)`)

let froe = 1950
const tilf = () => { froe = (froe * 1664525 + 1013904223) >>> 0; return froe / 4294967296 }
const glat = x => { const c = Math.max(0, Math.min(1, x)); return c * c * (3 - 2 * c) }

// Et billede med struktur i flere størrelser (væg, gulv), som et rigtigt rum. Værdien i (x, y) er en glat funktion,
// så billedet kan forskydes med brøkdele af et pixel.
const hash = (x, y) => { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s) }
const blod = (x, y, sc) => { const xi = Math.floor(x / sc), yi = Math.floor(y / sc), fx = x / sc - xi, fy = y / sc - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1); return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v - .5 }
const vaeg = (x, y) => 120 + blod(x, y, 32) * 90 + blod(x + 500, y, 12) * 60 + blod(x, y + 500, 5) * 40
const billede = (w, h, kamera, ting = []) => {
  const gray = new Float32Array(w * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = vaeg(x - kamera.x, y - kamera.y)
    for (const t of ting) if (x >= t.x0 + t.dx && x < t.x1 + t.dx && y >= t.y0 + t.dy && y < t.y1 + t.dy) v = 60 + blod(x - t.dx + 900, y - t.dy + 900, 9) * 120
    gray[y * w + x] = v
  }
  return { gray, w, h, x0: 0, y0: 0, cw: w, ch: h }
}
const W = 360, H = 640, skive = { x: 180 * kb.KB_SCALE, y: 300 * kb.KB_SCALE, r: 45 * kb.KB_SCALE }

test('kameraets skridt findes på baggrunden med brøkdele af et pixel, selv om atleten og stangen flytter sig anderledes', () => {
  // atleten: en bred figur midt i billedet, som går op, mens kameraet driver ned til højre
  const krop = { x0: 120, x1: 240, y0: 200, y1: 640, dx: 0, dy: 0 }
  for (const [dx, dy] of [[0, 0], [1.4, -0.6], [-2.3, 1.1], [0.3, 3.7]]) {
    const foer = billede(W, H, { x: 0, y: 0 }, [krop])
    const nu = billede(W, H, { x: dx, y: dy }, [{ ...krop, dx: 0, dy: -4 }])
    const st = kb.kbStep(foer, nu, { x: 0, y: 0 }, skive)
    assert.ok(st.ok, `kameraet måles (${st.matched} udsnit, klynge ${st.cluster}, næststørste ${st.second})`)
    assert.ok(Math.abs(st.x / kb.KB_SCALE - dx) <= .35 && Math.abs(st.y / kb.KB_SCALE - dy) <= .35,
      `skridt (${(st.x / kb.KB_SCALE).toFixed(2)}, ${(st.y / kb.KB_SCALE).toFixed(2)}) mod (${dx}, ${dy})`)
  }
})

test('uden struktur i baggrunden, eller når to klynger er lige store, regnes kameraet som stillestående', () => {
  const flad = { gray: new Float32Array(W * H).fill(100), w: W, h: H, x0: 0, y0: 0, cw: W, ch: H }
  assert.equal(kb.kbStep(flad, flad, { x: 0, y: 0 }, skive).ok, false)
  // venstre halvdel står stille, højre halvdel flytter sig: ingen entydig baggrund
  const halv = { x0: 180, x1: 360, y0: 0, y1: 640, dx: 0, dy: 0 }
  const foer = billede(W, H, { x: 0, y: 0 }, [halv]), nu = billede(W, H, { x: 0, y: 0 }, [{ ...halv, dx: 0, dy: 5 }])
  const st = kb.kbStep(foer, nu, { x: 0, y: 0 }, skive)
  assert.equal(st.ok, false, `to lige store klynger: ${st.cluster} mod ${st.second}`)
})

// fem løft ned og op fra hvile til hvile, opturen langsommere løft for løft; kameraet driver og ryster hele tiden
const R = 100, CM = 45 / (2 * R)
function saet(optur) {
  const top = 500, bund = 800, led = []
  let T = 1
  for (const c of optur) { led.push({ a: T, b: T + 1.1, fra: top, til: bund }); T += 1.1 + 0.3; led.push({ a: T, b: T + c, fra: bund, til: top, op: true }); T += c + 0.9 }
  const y = t => { let v = top; for (const s of led) { if (t >= s.b) v = s.til; else if (t >= s.a) { v = s.fra + (s.til - s.fra) * glat((t - s.a) / (s.b - s.a)); break } else break } return v }
  const sand = led.filter(s => s.op).map(s => { let sum = 0, n = 0; const h = 0.0005; for (let t = s.a; t < s.b; t += h) { const v = (y(t) - y(t + h)) * CM / 100 / h; if (v > 0.05) { sum += v; n++ } } return sum / n })
  return { y, sand, slut: T + 1 }
}
const kamera = t => ({ x: 25 * Math.sin(t / 7.3 * 6.2832 + .4) + 4 * Math.sin(t * 4.3 * 6.2832), y: 40 * Math.sin(t / 6.1 * 6.2832 + 1.2) + 18 * Math.sin(t / 2.6 * 6.2832 + .5) + 4 * Math.sin(t * 3.7 * 6.2832 + 2) + 1.5 * Math.sin(t * 6.3 * 6.2832) })
function fart(s, fps, medKamera) {
  const times = Array.from({ length: Math.floor(s.slut * fps) }, (_, k) => k / fps)
  const cam = times.map(kamera)
  const pts = times.map((t, i) => ({ x: 360 + cam[i].x + (tilf() - .5) * .3, y: s.y(t) + cam[i].y + (tilf() - .5) * .3 }))
  const path = { pts, times, raw: { pts, times, valid: pts.map(() => true), start: times[0], end: times.at(-1), cam: medKamera ? cam.map(c => ({ x: c.x + (tilf() - .5) * .6, y: c.y + (tilf() - .5) * .6 })) : null }, analysisSession: { schema: 1, lift: 'squat' } }
  analyse(path, { width: 720 }, CM)
  return path
}

test('håndholdt kamera: med kameraets bevægelse trukket fra rammer farten pr. løft den sande inden for 5 % ved 30 og 60 fps', () => {
  const s = saet([0.90, 0.97, 1.05, 1.15, 1.28])
  for (const fps of [30, 60]) {
    const reps = fart(s, fps, true).reps
    assert.equal(reps.length, 5, `${fps} fps: fem løft`)
    reps.forEach((rep, i) => {
      const fejl = (rep.mcv / s.sand[i] - 1) * 100
      assert.ok(!rep.camMoved && Math.abs(fejl) < 5, `${fps} fps, løft ${i + 1}: ${rep.mcv.toFixed(3)} mod ${s.sand[i].toFixed(3)} m/s (${fejl.toFixed(1)} %)`)
    })
  }
})

test('uden kameraets bevægelse (som før) er den samme bane 7 % eller mere forkert på mindst to løft', () => {
  const s = saet([0.90, 0.97, 1.05, 1.15, 1.28])
  const reps = fart(s, 30, false).reps
  const galt = reps.filter((rep, i) => rep.camMoved || Math.abs(rep.mcv / s.sand[i] - 1) >= .07).length
  assert.ok(galt >= 2, `${galt} løft over 7 % (${reps.map((rep, i) => rep.camMoved ? 'ikke målt' : ((rep.mcv / s.sand[i] - 1) * 100).toFixed(1)).join(' ')})`)
})

test('klippes en hale af banen, klippes kameraets bevægelse med, så korrektionen ikke falder bort (kontrollens fund)', () => {
  const fra = html.indexOf('  const trimEscapedTail=()=>{'), til = html.indexOf('  trimEscapedTail();', fra)
  assert.ok(fra > 0 && til > fra, 'haleklipningen findes')
  const klip = new Function('path', 'radius', `${html.slice(fra, til)}\n  trimEscapedTail();\n  return path`)
  // tre løft ned og op med hvile i toppen, derefter en hale, hvor sporet glider ud af billedet forneden
  const FPS = 30, TOP = 500, BUND = 1000, pts = [], times = []
  const y = t => { const s = t % 3; return s < 1 ? TOP + (BUND - TOP) * glat(s) : s < 2 ? BUND - (BUND - TOP) * glat(s - 1) : TOP }
  for (let i = 0; i < 9 * FPS; i++) { times.push(i / FPS); pts.push({ x: 360, y: y(i / FPS) }) }
  for (let i = 0; i < 3 * FPS; i++) { times.push(9 + i / FPS); pts.push({ x: 360 + i * 4, y: TOP + i * 9 }) }
  const path = { pts, times, valid: pts.map(() => true), confidence: pts.map(() => 1), cam: pts.map((_, i) => ({ x: i * .1, y: 0 })) }
  klip(path, 100)
  assert.ok(path.tailCutAt != null && path.pts.length < 12 * FPS, 'halen er klippet')
  assert.equal(path.cam.length, path.pts.length)
  assert.ok(html.includes('if(path.cam)path.cam.length=cut+1;'), 'haleklipningen forkorter path.cam')
})

test('står kameraet stille, er regnestykket bit for bit som før, og banen oven på videoen bliver i billedets koordinater', () => {
  const s = saet([0.90, 0.97, 1.05, 1.15, 1.28])
  const times = Array.from({ length: Math.floor(s.slut * 30) }, (_, k) => k / 30)
  const pts = times.map(t => ({ x: 360, y: s.y(t) }))
  const lav = cam => { const path = { pts, times, raw: { pts, times, valid: pts.map(() => true), start: times[0], end: times.at(-1), cam }, analysisSession: { schema: 1, lift: 'squat' } }; analyse(path, { width: 720 }, CM); return path }
  const uden = lav(null), nul = lav(times.map(() => ({ x: 0, y: 0 })))
  assert.deepEqual(nul.reps.map(r => r.mcv), uden.reps.map(r => r.mcv))
  assert.equal(nul.analysis.camMaxPx, 0)
  assert.ok(html.includes('visualPts:buildVisualBarPath(imagePts, raw.valid, raw.times)'), 'den tegnede bane bygges af billedets punkter')
  assert.ok(html.includes('path.cam.push({x:kbOff.x,y:kbOff.y});'), 'sporeren gemmer kameraets bevægelse pr. billede')
  assert.ok(html.includes('pts, times, valid, confidence, validity, cam,'), 'den rå bane fryser kameraets bevægelse med')
})
