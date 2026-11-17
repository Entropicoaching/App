import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Ordre 1610v (Marc 17. nov.: "bartrackeren fortsatte igennem gulvet ... i slutningen af videoen").
// Prøver den levende haleklipning fra public/videocoach.html på opdigtede baner. Klip med billeder
// prøves af scripts/verify-videocoach-slut-spor.mjs.
const html = readFileSync(new URL('../public/videocoach.html', import.meta.url), 'utf8')
const start = html.indexOf('  const trimEscapedTail=()=>{'), end = html.indexOf('  trimEscapedTail();', start)
assert.ok(start > 0 && end > start, 'haleklipningen findes i videocoach.html')
const klip = new Function('path', 'radius', `${html.slice(start, end)}\n  trimEscapedTail();\n  return path`)

const R = 100, FPS = 30, TOP = 500, BOTTOM = 1000
const smooth = x => x * x * (3 - 2 * x)
// reps ned og op med hvile i toppen; derefter en hale givet som funktion af tiden efter sættet
function bane({ reps = 3, hale = null, haleSek = 0, slutIBund = false, drift = 0 }) {
  const pts = [], add = (x, y) => pts.push({ x: x + drift * pts.length, y })
  for (let i = 0; i < 15; i++) add(300, TOP)
  for (let r = 0; r < reps; r++) {
    const sidste = r === reps - 1
    for (let i = 1; i <= 30; i++) add(300, TOP + (BOTTOM - TOP) * smooth(i / 30))
    if (sidste && slutIBund) break
    for (let i = 1; i <= 30; i++) add(300, BOTTOM - (BOTTOM - TOP) * smooth(i / 30))
    for (let i = 0; i < 20; i++) add(300 + (i % 2), TOP)
  }
  const hvile = pts.length
  for (let i = 1; i <= haleSek * FPS; i++) { const q = hale(i / FPS); pts.push({ x: q.x + drift * pts.length, y: q.y }) }
  return { path: { pts, times: pts.map((_, i) => i / FPS), valid: pts.map(() => true), confidence: pts.map(() => 1) }, hvile }
}

test('en hale, der falder gennem gulvet og aldrig kommer tilbage, klippes ved det sidste rolige punkt', () => {
  const { path, hvile } = bane({ haleSek: 2, hale: t => ({ x: 300, y: TOP + 900 * t }) })
  const foer = path.pts.length
  klip(path, R)
  assert.ok(path.pts.length < foer)
  assert.ok(Math.abs(path.pts.length - hvile) <= 3, `klippet ved ${path.pts.length}, sættet sluttede ved ${hvile}`)
  assert.ok(Math.max(...path.pts.map(q => q.y)) <= BOTTOM)
  assert.equal(path.times.length, path.pts.length); assert.equal(path.valid.length, path.pts.length); assert.equal(path.confidence.length, path.pts.length)
  assert.equal(path.tailCutAt, path.times.at(-1))
})

test('en hale til siden ud af billedet klippes også, selv når de sidste billeder kun holder sidste punkt', () => {
  const { path, hvile } = bane({ haleSek: 2, hale: t => ({ x: 300 + 700 * Math.min(1, t), y: TOP }) })
  for (let i = path.pts.length - 15; i < path.pts.length; i++) path.valid[i] = false
  klip(path, R)
  assert.ok(Math.abs(path.pts.length - hvile) <= 3, `klippet ved ${path.pts.length}, hvile ${hvile}`)
})

// Kontrol 1610v: uden hvile efter sidste løft må klipningen aldrig tage løftets optur med.
const udenHvile = hale => {
  const { path } = bane({ reps: 3 })
  path.pts.length -= 20
  const top = path.pts.length
  for (let i = 1; i <= 45; i++) path.pts.push(hale(i))
  for (const k of ['times', 'valid', 'confidence']) path[k] = path.pts.map((_, i) => k === 'times' ? i / FPS : k === 'valid' ? true : 1)
  klip(path, R)
  return { path, top }
}

test('en flugt lige efter sidste løft, uden hvile imellem, klipper ikke løftet af', () => {
  const ned = udenHvile(i => ({ x: 300, y: TOP + 30 * i }))
  assert.ok(ned.path.pts.length >= ned.top - 2, `ned: klippet ved ${ned.path.pts.length}, toppen ved ${ned.top}`)
  assert.ok(Math.max(...ned.path.pts.map(q => q.y)) <= BOTTOM + 30, 'banen ender ikke under sættets laveste punkt')
  const side = udenHvile(i => ({ x: 300 + 25 * i, y: TOP }))
  assert.ok(side.path.pts.length >= side.top - 2 && side.path.pts.length <= side.top + 3, `til siden: klippet ved ${side.path.pts.length}, toppen ved ${side.top}`)
  const op = udenHvile(i => ({ x: 300, y: TOP - 25 * i }))
  assert.ok(op.path.pts.length >= op.top - 2 && op.path.pts.length <= op.top + 3, `opad: klippet ved ${op.path.pts.length}, toppen ved ${op.top}`)
})

test('bænk med pause på brystet, ført tilbage i stativet uden pause i toppen, beholder sidste løft', () => {
  const pts = []
  for (let i = 0; i < 15; i++) pts.push({ x: 300, y: TOP })
  for (let r = 0; r < 3; r++) {
    for (let i = 1; i <= 25; i++) pts.push({ x: 300, y: TOP + (BOTTOM - TOP) * smooth(i / 25) })
    for (let i = 0; i < 12; i++) pts.push({ x: 300, y: BOTTOM })
    for (let i = 1; i <= 22; i++) pts.push({ x: 300, y: BOTTOM - (BOTTOM - TOP) * smooth(i / 22) })
    if (r < 2) for (let i = 0; i < 15; i++) pts.push({ x: 300, y: TOP })
  }
  const top = pts.length
  for (let i = 1; i <= 20; i++) pts.push({ x: 300 - 6.5 * i, y: TOP - 2 * i })
  for (let i = 0; i < 20; i++) pts.push({ x: 170, y: TOP - 40 })
  const path = { pts, times: pts.map((_, i) => i / FPS), valid: pts.map(() => true), confidence: pts.map(() => 1) }
  klip(path, R)
  assert.ok(path.pts.length >= top - 2, `klippet ved ${path.pts.length}, toppen ved ${top}`)
})

test('et sidste løft, der presses skråt ud af området og hjem i samme bevægelse, beholdes', () => {
  const pts = []
  for (let i = 0; i < 15; i++) pts.push({ x: 300, y: TOP })
  for (let r = 0; r < 3; r++) {
    for (let i = 1; i <= 25; i++) pts.push({ x: 300, y: TOP + (BOTTOM - TOP) * smooth(i / 25) })
    for (let i = 0; i < 12; i++) pts.push({ x: 300, y: BOTTOM })
    if (r < 2) { for (let i = 1; i <= 22; i++) pts.push({ x: 300, y: BOTTOM - (BOTTOM - TOP) * smooth(i / 22) }); for (let i = 0; i < 15; i++) pts.push({ x: 300, y: TOP }) }
  }
  for (let i = 1; i <= 30; i++) pts.push({ x: 300 - 130 * smooth(i / 30), y: BOTTOM - (BOTTOM - TOP) * smooth(i / 30) })
  const top = pts.length
  for (let i = 0; i < 25; i++) pts.push({ x: 170, y: TOP })
  const path = { pts, times: pts.map((_, i) => i / FPS), valid: pts.map(() => true), confidence: pts.map(() => 1) }
  klip(path, R)
  assert.ok(path.pts.length >= top - 3, `klippet ved ${path.pts.length}, toppen ved ${top}`)
})

test('et hop væk efter et hul i sporingen beholdes ikke, selv om det ender nær startstedets højde', () => {
  const { path } = bane({ reps: 3 })
  const n = path.pts.length
  for (let i = 1; i <= 30; i++) path.pts.push({ x: 300, y: TOP + (BOTTOM - TOP) * smooth(i / 30) })
  for (let i = 0; i < 40; i++) path.pts.push({ x: 300, y: BOTTOM })
  for (let i = 0; i < 30; i++) path.pts.push({ x: 700, y: TOP - 200 })
  path.times = path.pts.map((_, i) => i / FPS); path.valid = path.pts.map((_, i) => !(i >= n + 30 && i < n + 70)); path.confidence = path.valid.map(Number)
  klip(path, R)
  assert.ok(path.pts.every(q => q.x < 400), 'hoppet er klippet af')
})

test('en bane uden confidence kan også klippes', () => {
  const { path } = bane({ haleSek: 2, hale: t => ({ x: 300, y: TOP + 900 * t }) })
  delete path.confidence
  klip(path, R)
  assert.ok(Math.max(...path.pts.map(q => q.y)) <= BOTTOM)
})

test('et sæt, der slutter i ro, røres ikke', () => {
  const { path } = bane({ haleSek: 3, hale: t => ({ x: 300 + 4 * Math.sin(t * 20), y: TOP + 4 * Math.cos(t * 17) }) })
  const foer = path.pts.length
  klip(path, R)
  assert.equal(path.pts.length, foer); assert.equal(path.tailCutAt, undefined)
})

test('et enkelt løft, der slutter i toppen eller bunden af sin første tur, røres ikke', () => {
  for (const slutIBund of [true]) {
    const { path } = bane({ reps: 1, slutIBund })
    const foer = path.pts.length
    klip(path, R)
    assert.equal(path.pts.length, foer)
  }
  // dødløft: fra gulvet til toppen, og klippet slutter i toppen
  const pts = [...Array(20).fill({ x: 300, y: BOTTOM }), ...Array.from({ length: 40 }, (_, i) => ({ x: 300, y: BOTTOM - 500 * smooth((i + 1) / 40) })), ...Array(30).fill({ x: 300, y: BOTTOM - 500 })]
  const path = { pts, times: pts.map((_, i) => i / FPS), valid: pts.map(() => true), confidence: pts.map(() => 1) }
  klip(path, R)
  assert.equal(path.pts.length, 90)
})

test('en sidste rep, der går lidt dybere, og et kamera der langsomt driver, røres ikke', () => {
  const dybere = bane({ reps: 3, haleSek: 1, hale: t => ({ x: 300, y: TOP + (BOTTOM + 60 - TOP) * smooth(t) }) })
  let foer = dybere.path.pts.length
  klip(dybere.path, R)
  assert.equal(dybere.path.pts.length, foer, 'under én radius uden for sættets område er ikke en flugt')
  const drift = bane({ reps: 5, drift: 0.6 })
  foer = drift.path.pts.length
  klip(drift.path, R)
  assert.equal(drift.path.pts.length, foer)
})

test('et spor, der forlader sættets område, men kommer hjem igen, røres ikke', () => {
  const { path } = bane({ haleSek: 2, hale: t => ({ x: 300, y: TOP + 900 * Math.sin(Math.PI * Math.min(1, t)) }) })
  const foer = path.pts.length
  klip(path, R)
  assert.equal(path.pts.length, foer)
})
