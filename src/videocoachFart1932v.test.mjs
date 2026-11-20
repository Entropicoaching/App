import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Ordre 1932v (Marc 19. nov. kl. 20:50: "bar tracker misser stadig, den er ikke reliabel"; 1899v: "farten vises
// ca. 20 % for høj ved 60 billeder i sekundet"). Prøver den levende kode i public/videocoach.html på opdigtede
// baner med kendt fart: hvilke billeder der bruges, og at farten er den samme, uanset hvordan billederne ligger i tid.
const html = readFileSync(new URL('../public/videocoach.html', import.meta.url), 'utf8')

const gapKode = html.match(/const VC_FRAME_GAP = ([^;]+);/), hulKode = html.match(/const VC_FRAME_HOLE = ([^;]+);/)
assert.ok(gapKode && hulKode, 'reglen for hvilke billeder der bruges findes i videocoach.html')
const GAP = new Function(`return ${gapKode[1]}`)(), HOLE = new Function(`return ${hulKode[1]}`)()
// billedtider som afkoderen giver dem: hele mikrosekunder
const kilde = (fps, sek = 4) => Array.from({ length: Math.round(fps * sek) }, (_, k) => Math.round(k / fps * 1e6) / 1e6)
const valgt = tider => { const ud = []; let sidst = null; for (const t of tider) if (sidst == null || t - sidst >= GAP) { ud.push(t); sidst = t } return ud }
const spring = tider => tider.slice(1).map((t, i) => Math.round((t - tider[i]) * 1e4) / 10)

test('billedvalg: ved 60 billeder i sekundet bruges præcis hvert andet billede, så afstanden er ens', () => {
  const brugt = valgt(kilde(60))
  assert.deepEqual([...new Set(spring(brugt))], [33.3])
  assert.equal(brugt.length, 120)
  // det gamle 30 fps-gitter gav skiftevis 1, 2 og 3 kildebilleder mellem de brugte billeder
  const gammel = []; let plads = -1
  for (const t of kilde(60)) { const p = Math.round(t * 30); if (p > plads) { gammel.push(t); plads = p } }
  assert.deepEqual([...new Set(spring(gammel))].sort((a, b) => a - b), [16.7, 33.3, 50])
})

test('billedvalg: 24, 25, 29,97 og 30 billeder i sekundet bruger alle billeder, 50 og 120 bruger hvert andet og hvert fjerde', () => {
  for (const [fps, hver] of [[24, 1], [25, 1], [29.97, 1], [30, 1], [50, 2], [120, 4]]) {
    const alle = kilde(fps), brugt = valgt(alle)
    assert.equal(brugt.length, Math.ceil(alle.length / hver), `${fps} fps`)
    const s = spring(brugt)
    assert.ok(Math.max(...s) - Math.min(...s) <= 0.11, `${fps} fps: afstanden mellem de brugte billeder er ens (${Math.min(...s)} til ${Math.max(...s)} ms)`)
    assert.ok(Math.max(...s) / 1000 < HOLE, `${fps} fps: ingen afstand tæller som et hul`)
  }
})

test('billedvalg: klargøringen, sporeren og det klargjorte klip bruger billedets egen tid og ikke et 30 fps-gitter', () => {
  assert.ok(!/Math\.round\(tm \* 30\)/.test(html) && !/slot > lastSlot/.test(html) && !/timestamp: Math\.round\(s \/ 30 \* 1e6\)/.test(html), 'gitteret er væk')
  assert.ok(html.includes('if (lastTm != null && tm - lastTm < VC_FRAME_GAP) return;'), 'klargøringen vælger efter tid')
  assert.ok(html.includes('if (t > startT + 1e-3 && t - lastT >= VC_FRAME_GAP) {'), 'sporeren vælger efter tid')
  assert.ok(html.includes('put(mediaTime);'), 'det klargjorte klip får billedets egen tid')
})

// analysen fra siden, kørt på en bane
const analyseFra = html.indexOf('function analyzeCleanPath(path) {'), analyseTil = html.indexOf('function analyzePath(path) {', analyseFra)
assert.ok(analyseFra > 0 && analyseTil > analyseFra, 'analysen findes i videocoach.html')
const analyse = new Function('path', 'canvas', 'cmPerPx', `const buildVisualBarPath = () => [], updateCleanReviewUI = () => {};
${html.slice(analyseFra, analyseTil)}
  return analyzeCleanPath(path)`)

const R = 100, CM = 45 / (2 * R), glat = x => { const c = Math.max(0, Math.min(1, x)); return c * c * (3 - 2 * c) }
// fem løft ned og op fra hvile til hvile; opturen bliver langsommere løft for løft
function saet(loeft, optur) {
  const rom = loeft === 'bench' ? 170 : 300, top = 500, bund = top + rom, doed = loeft === 'deadlift', led = []
  let T = 1
  for (const c of optur) {
    if (doed) { led.push({ a: T, b: T + c, fra: bund, til: top, op: true }); T += c + 0.6; led.push({ a: T, b: T + 0.9, fra: top, til: bund }); T += 0.9 + 0.7 }
    else { led.push({ a: T, b: T + 1.1, fra: top, til: bund }); T += 1.1 + 0.3; led.push({ a: T, b: T + c, fra: bund, til: top, op: true }); T += c + 0.9 }
  }
  const y = t => { let v = doed ? bund : top; for (const s of led) { if (t >= s.b) v = s.til; else if (t >= s.a) { v = s.fra + (s.til - s.fra) * glat((t - s.a) / (s.b - s.a)); break } else break } return v }
  // sand fart: gennemsnittet af farten opad over 0,05 m/s (appens egen definition), regnet på den sande bane
  const sand = led.filter(s => s.op).map(s => { let sum = 0, n = 0; const h = 0.0005; for (let t = s.a; t < s.b; t += h) { const v = (y(t) - y(t + h)) * CM / 100 / h; if (v > 0.05) { sum += v; n++ } } return sum / n })
  return { y, sand, slut: T + 1, loeft }
}
let froe = 1932
const tilf = () => { froe = (froe * 1664525 + 1013904223) >>> 0; return froe / 4294967296 }
// billedtider: jævnt, det gamle 60 fps-mønster (1, 2 og 3 kildebilleder), variabel billedrate og tabte billeder
const TIDER = {
  'jævnt 30': slut => Array.from({ length: Math.floor(slut * 30) }, (_, k) => k / 30),
  'jævnt 24': slut => Array.from({ length: Math.floor(slut * 24) }, (_, k) => k / 24),
  '60 fps på det gamle gitter': slut => { const t = []; let k = 0; for (let i = 0; k / 60 < slut; i++) { t.push(k / 60); k += [1, 2, 3][i % 3] } return t },
  'variabel billedrate': slut => { const t = []; for (let x = 0; x < slut; x += (0.62 + 0.76 * tilf()) / 30) t.push(x); return t },
  'tabte billeder': slut => { const t = []; for (let x = 0; x < slut; x += (tilf() < 0.12 ? 2 : tilf() < 0.05 ? 3 : 1) / 30) t.push(x); return t },
}
function fart(s, tider, stoej = 0.15) {
  const times = tider(s.slut), pts = times.map(t => ({ x: 360 + (tilf() - 0.5) * 2 * stoej, y: s.y(t) + (tilf() - 0.5) * 2 * stoej }))
  const path = { pts, times, raw: { pts, times, valid: pts.map(() => true), start: times[0], end: times.at(-1) }, analysisSession: { schema: 1, lift: s.loeft } }
  analyse(path, { width: 720 }, CM)
  return path.reps
}

test('farten pr. løft rammer den sande fart inden for 5 %, uanset hvordan billederne ligger i tid', () => {
  for (const [loeft, optur] of [['squat', [0.80, 0.86, 0.93, 1.02, 1.14]], ['bench', [0.70, 0.75, 0.81, 0.90, 1.02]], ['deadlift', [0.90, 0.96, 1.04, 1.14, 1.30]]]) {
    const s = saet(loeft, optur)
    for (const [navn, tider] of Object.entries(TIDER)) {
      const reps = fart(s, tider)
      assert.equal(reps.length, 5, `${loeft}, ${navn}: fem løft`)
      reps.forEach((rep, i) => {
        const fejl = (rep.mcv / s.sand[i] - 1) * 100
        assert.ok(Math.abs(fejl) < 5, `${loeft}, ${navn}, løft ${i + 1}: ${rep.mcv.toFixed(3)} mod ${s.sand[i].toFixed(3)} m/s (${fejl.toFixed(1)} %)`)
      })
      const tab = (1 - reps[4].mcv / reps[0].mcv) * 100, sandTab = (1 - s.sand[4] / s.sand[0]) * 100
      assert.ok(Math.abs(tab - sandTab) < 4, `${loeft}, ${navn}: fartstab ${tab.toFixed(0)} % mod ${sandTab.toFixed(0)} %`)
    }
  }
})

test('farten er den samme ved jævne billeder, om billederne ligger 33 eller 42 ms fra hinanden', () => {
  const s = saet('squat', [0.80, 0.86, 0.93, 1.02, 1.14])
  const a = fart(s, TIDER['jævnt 30'], 0), b = fart(s, TIDER['jævnt 24'], 0)
  a.forEach((rep, i) => assert.ok(Math.abs(rep.mcv / b[i].mcv - 1) < 0.04, `løft ${i + 1}: ${rep.mcv.toFixed(3)} og ${b[i].mcv.toFixed(3)} m/s`))
})

test('hvert løft får en fart, og toppen er aldrig lavere end gennemsnittet', () => {
  const s = saet('squat', [0.80, 0.86, 0.93, 1.02, 1.14])
  for (const tider of Object.values(TIDER)) fart(s, tider).forEach(rep => {
    assert.ok(Number.isFinite(rep.mcv) && rep.mcv > 0.05)
    assert.ok(rep.peak >= rep.mcv, `top ${rep.peak.toFixed(3)} mod gennemsnit ${rep.mcv.toFixed(3)}`)
  })
})
