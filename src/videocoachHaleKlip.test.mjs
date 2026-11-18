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

// Kontrol 2 for 1610v: sættets sidste optur beholdes altid, også når kameraet flytter sig under løftet.
test('et kamera, der flyttes til siden under sidste løft og bliver der, koster ikke løftet', () => {
  for (const [bredde, billeder, start] of [[300, 24, -10], [300, 60, -10], [160, 8, 0], [110, 24, 6]]) {
    const { path, hvile } = bane({ reps: 5 })
    const bund = hvile - 50 + start
    path.pts.forEach((q, i) => { if (i > bund) q.x += bredde * smooth(Math.min(1, (i - bund) / billeder)) })
    klip(path, R)
    assert.ok(path.pts.length >= hvile - 20, `flyt ${bredde} px over ${billeder} billeder fra ${start}: klippet ved ${path.pts.length}, sidste optur slutter ved ${hvile - 20}`)
  }
})

test('et håndholdt kamera, der driver gennem flere løft, koster ingen løft', () => {
  for (const [dx, dy] of [[2.5, 0], [3, 1.5], [0, 2.5], [3, -1]]) {
    const { path, hvile } = bane({ reps: 5 })
    path.pts.forEach((q, i) => { if (i > 200) { q.x += dx * (i - 200); q.y += dy * (i - 200) } })
    klip(path, R)
    assert.ok(path.pts.length >= hvile - 20, `drift ${dx},${dy}: klippet ved ${path.pts.length}, sidste optur slutter ved ${hvile - 20}`)
  }
})

test('atleten går i stativet uden pause, og sporet glider langsomt opad: banen slutter i toppen', () => {
  const { path, top } = udenHvile(i => ({ x: 300 + 600 * smooth(i / 45), y: TOP - 20 * (i / 45) }))
  assert.ok(Math.abs(path.pts.length - top) <= 3, `klippet ved ${path.pts.length}, toppen ved ${top}`)
})

test('en hale, der går tre radius gennem gulvet og op igen et andet sted, er ikke et løft', () => {
  for (const op of [TOP, 800]) {
    const { path, hvile } = bane({ reps: 5, haleSek: 3, hale: t => t < 1
      ? { x: 300 + 200 * smooth(t), y: TOP + 800 * smooth(t) }
      : { x: 500 + 400 * smooth(Math.min(1, (t - 1) / 1.3)), y: 1300 - (1300 - op) * smooth(Math.min(1, (t - 1) / 1.3)) } })
    klip(path, R)
    assert.ok(Math.abs(path.pts.length - hvile) <= 3, `klippet ved ${path.pts.length}, hvile ${hvile}`)
    assert.ok(Math.max(...path.pts.map(q => q.y)) <= BOTTOM)
  }
})

test('dødløft touch and go, hvor stangen ruller efter sidste nedlægning, slutter på gulvet', () => {
  const pts = []
  for (let i = 0; i < 15; i++) pts.push({ x: 300, y: BOTTOM })
  for (let r = 0; r < 4; r++) {
    for (let i = 1; i <= 30; i++) pts.push({ x: 300, y: BOTTOM - 500 * smooth(i / 30) })
    for (let i = 1; i <= 25; i++) pts.push({ x: 300, y: TOP + 500 * smooth(i / 25) })
  }
  const gulv = pts.length
  for (let i = 1; i <= 25; i++) pts.push({ x: 300 + 220 * smooth(i / 25), y: BOTTOM + 30 * (i / 25) })
  const path = { pts, times: pts.map((_, i) => i / FPS), valid: pts.map(() => true), confidence: pts.map(() => 1) }
  klip(path, R)
  assert.ok(Math.abs(path.pts.length - gulv) <= 3, `klippet ved ${path.pts.length}, gulvet ved ${gulv}`)
})

// Kontrol 3 for 1610v.
test('en hale, der synker langsomt gennem gulvet, klippes også', () => {
  const { path, hvile } = bane({ reps: 5, haleSek: 14, hale: t => ({ x: 300, y: TOP + 30 * t * 1.5 + (t > 1 ? 0 : 0) }) })
  // 1,5 px pr. billede fra toppen: først når sporet er under sættets bund, er det en flugt
  klip(path, R)
  assert.ok(Math.max(...path.pts.map(q => q.y)) <= BOTTOM + 3, `dybeste ${Math.max(...path.pts.map(q => q.y))}`)
  assert.ok(path.pts.length >= hvile - 20)
})

test('billedet rettes halvanden radius ned og til siden midt i sættet: ingen løft går tabt', () => {
  const { path } = bane({ reps: 5 })
  const foer = path.pts.length
  path.pts.forEach((q, i) => { if (i > 180) { const e = smooth(Math.min(1, (i - 180) / 24)); q.x += 80 * e; q.y += 150 * e } })
  klip(path, R)
  assert.equal(path.pts.length, foer)
})

// Ordre 1621v: de to fund fra kontrol 1 af 1616v (plan/1616v/KONTROL1.md), med kontrollens egne baner.
const glat = x => smooth(Math.max(0, Math.min(1, x)))
const lavBane = (pts, fps = FPS) => ({ pts: pts.map(q => ({ ...q })), times: pts.map((_, i) => i / fps), valid: pts.map(() => true), confidence: pts.map(() => 1) })
// fem løft; derefter falder sporet gennem gulvet og gynger op og ned (telefonen bæres væk)
function gyngeHale({ rom, doed = false, dybde, udsving, gange = 2, skridt = 60, tur = 20, pause = 0 }) {
  const bot = TOP + rom * R, a = doed ? bot : TOP, b = doed ? TOP : bot, pts = [{ x: 300, y: a }]
  const hold = n => { const q = pts.at(-1); for (let i = 0; i < n; i++) pts.push({ ...q }) }
  const to = (n, x, y) => { const q = pts.at(-1); for (let i = 1; i <= n; i++) pts.push({ x: q.x + (x - q.x) * glat(i / n), y: q.y + (y - q.y) * glat(i / n) }) }
  hold(15); for (let r = 0; r < 5; r++) { to(30, 300, b); to(30, 300, a); hold(15) }
  const slut = pts.length, hy = bot + dybde * R
  to(30, 400, hy)
  for (let k = 0; k < gange; k++) { to(tur, 400 + skridt * (k + 2 / 3), hy - udsving * R); hold(pause); to(tur, 400 + skridt * (k + 7 / 6), hy) }
  hold(20)
  return { path: lavBane(pts), slut, bot }
}

test('en hale gennem gulvet med to eller tre udsving på størrelse med et løft klippes ved gulvet', () => {
  const ikke = []
  for (const [navn, rom, doed] of [['bænk', 2, false], ['squat', 4, false], ['dødløft', 5, true]]) {
    for (const [dybde, gange] of [[4, 2], [3, 2], [5, 3]]) for (const udsving of [1.2, 1.5, 2, 2.5, 3, 3.5, 4]) {
      const { path, slut, bot } = gyngeHale({ rom, doed, dybde, udsving, gange })
      klip(path, R)
      const under = (Math.max(...path.pts.map(q => q.y)) - bot) / R
      if (under > 0.3 || path.pts.length < slut - 3) ikke.push(`${navn} dybde ${dybde}R, ${gange} udsving på ${udsving}R: ${path.pts.length} punkter (sæt slut ${slut}), ${under.toFixed(2)}R under gulvet`)
    }
  }
  assert.deepEqual(ikke, [], `${ikke.length} af 63 haler står tilbage under gulvet`)
})

test('en hale gennem gulvet, der gynger på stedet og ender i bunden, klippes også ved gulvet (squat og bænk)', () => {
  // Dødløft er ikke med: dér slutter et løft i bunden, og gyng på stedet kan ikke skelnes fra løft
  // efter en stor flytning af billedet.
  const ikke = []
  for (const [navn, rom] of [['bænk', 2], ['squat', 4]]) for (const [dybde, gange] of [[4, 2], [3, 2], [5, 3]]) for (const udsving of [1.2, 2, 3, 4]) {
    const { path, slut, bot } = gyngeHale({ rom, dybde, udsving, gange, skridt: 0 })
    klip(path, R)
    const under = (Math.max(...path.pts.map(q => q.y)) - bot) / R
    if (under > 0.3 || path.pts.length < slut - 3) ikke.push(`${navn} dybde ${dybde}R, ${gange} udsving på ${udsving}R: ${under.toFixed(2)}R under gulvet`)
  }
  assert.deepEqual(ikke, [], `${ikke.length} af 24 haler står tilbage under gulvet`)
})

test('billedet rettes tre radius ned eller op midt i sættet, og sættet fortsætter: ingen løft går tabt', () => {
  for (const doed of [false, true]) for (const dy of [-3, 3, 4]) for (const efter of [2, 3]) {
    const a = doed ? BOTTOM : TOP, b = doed ? TOP : BOTTOM, pts = []
    for (let i = 0; i < 15; i++) pts.push({ x: 300, y: a })
    let skift = 0
    for (let r = 0; r < 5; r++) {
      for (let i = 1; i <= 30; i++) pts.push({ x: 300, y: a + (b - a) * smooth(i / 30) })
      for (let i = 1; i <= 30; i++) pts.push({ x: 300, y: b + (a - b) * smooth(i / 30) })
      if (r === 4 - efter) skift = pts.length
      for (let i = 0; i < 36; i++) pts.push({ x: 300, y: a })
    }
    pts.forEach((q, i) => { const m = glat((i - skift - 6) / 18); q.x += 50 * m; q.y += dy * R * m })
    const path = lavBane(pts), foer = path.pts.length
    klip(path, R)
    assert.equal(path.pts.length, foer, `${doed ? 'dødløft' : 'squat'}, ${dy}R, ${efter} løft efter flytningen`)
  }
})

// Samme generator som kontrol 1 (work/1616v/kontrol1/baner3.mjs): tilfældige sæt med kamera og hale.
function tilfaeldigeSaet(froe, antal, klip) {
  let seed = froe
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
  const U = (a, b) => a + (b - a) * rnd(), pick = a => a[Math.floor(rnd() * a.length)]
  const profiler = { fast: { ryst: 0.02, drift: 0 }, haandholdt: { ryst: 0.1, drift: 0.4 }, urolig: { ryst: 0.2, drift: 0.9 } }
  const tal = {}
  for (let it = 0; it < antal; it++) {
    const profNavn = pick(Object.keys(profiler)), prof = profiler[profNavn]
    const R = pick([14, 40, 80, 160, 300]), fps = pick([30, 30, 60]), loeft = pick(['squat', 'baenk', 'doed'])
    const reps = 1 + Math.floor(rnd() * 8), rom = U(loeft === 'baenk' ? 1.6 : 2.2, loeft === 'baenk' ? 3 : 5) * R
    const top = 3 * R, bot = top + rom, x0 = 4 * R, pts = []
    let sidsteOpSlut = 0
    const push = (x, y) => pts.push({ x, y })
    const hold = (sec, x, y) => { for (let i = 0; i < Math.round(sec * fps); i++) push(x, y) }
    const gaa = (sec, x1, y1, xb = 0) => { const a = pts.at(-1), n = Math.max(2, Math.round(sec * fps)); for (let i = 1; i <= n; i++) { const e = glat(i / n); push(a.x + (x1 - a.x) * e + xb * Math.sin(Math.PI * i / n), a.y + (y1 - a.y) * e) } }
    const start = loeft === 'doed' ? bot : top
    push(x0, start); hold(U(0.2, 1.5), x0, start)
    const xb = loeft === 'baenk' ? U(0.1, 0.5) * R : U(0, 0.2) * R
    for (let r = 0; r < reps; r++) {
      const romR = rom * U(0.92, 1.05)
      gaa(U(0.6, 2.2), x0 + (loeft === 'baenk' ? xb : 0), loeft === 'doed' ? bot - romR : top + romR, loeft === 'baenk' ? 0 : xb)
      if (loeft === 'doed') sidsteOpSlut = pts.length - 1
      if (rnd() < (loeft === 'squat' ? 0.15 : 0.6)) hold(U(0.1, 1.2), pts.at(-1).x, pts.at(-1).y)
      gaa(U(0.6, 3), x0, start, loeft === 'baenk' ? 0 : -xb)
      if (loeft !== 'doed') sidsteOpSlut = pts.length - 1
      if (r < reps - 1) hold(rnd() < 0.2 ? 0 : U(0.1, 3), x0, start)
    }
    const saetSlut = pts.length - 1
    const driftY = U(-prof.drift, prof.drift) * R / (saetSlut / reps), driftX = U(-prof.drift, prof.drift) * R / (saetSlut / reps)
    const f1 = U(1, 4), f2 = U(1, 4), p1 = U(0, 6), p2 = U(0, 6)
    const hale = pick(['ingen', 'ro', 'gulv', 'gulv-direkte', 'side', 'op', 'skraa-ned', 'u'])
    const pause = hale === 'gulv-direkte' ? 0 : pick([0, 0.1, 0.3, 1])
    const end = pts.at(-1)
    if (hale !== 'ingen') hold(pause, end.x, end.y)
    if (hale === 'ro') hold(U(1, 4), end.x, end.y)
    if (hale === 'gulv' || hale === 'gulv-direkte') { gaa(U(0.3, 2), end.x + U(-1, 1) * R, bot + U(1.5, 8) * R); hold(U(0, 2), pts.at(-1).x, pts.at(-1).y) }
    if (hale === 'side') { gaa(U(0.5, 2), end.x + pick([-1, 1]) * U(1.5, 6) * R, end.y + U(-0.3, 0.3) * R); hold(U(0, 2), pts.at(-1).x, pts.at(-1).y) }
    if (hale === 'op') { gaa(U(0.5, 2), end.x + U(-2, 2) * R, top - U(1.5, 3) * R); hold(U(0, 1), pts.at(-1).x, pts.at(-1).y) }
    if (hale === 'skraa-ned') { gaa(U(0.5, 2), end.x + pick([-1, 1]) * U(1.5, 4) * R, bot + U(1.2, 5) * R); hold(U(0, 1), pts.at(-1).x, pts.at(-1).y) }
    if (hale === 'u') { gaa(U(0.4, 1.5), end.x + U(0.5, 3) * R, bot + U(2.6, 6) * R); gaa(U(0.4, 1.5), end.x + U(3, 6) * R, top + U(0, 1) * R); hold(U(0, 1), pts.at(-1).x, pts.at(-1).y) }
    let gulv = -Infinity
    pts.forEach((q, i) => {
      const j = Math.min(i, saetSlut), t = i / fps
      q.x += driftX * j + prof.ryst * R * Math.sin(t * f1 * 6.283 + p1); q.y += driftY * j + prof.ryst * R * Math.sin(t * f2 * 6.283 + p2)
      if (i <= saetSlut) gulv = Math.max(gulv, q.y)
    })
    const path = lavBane(pts, fps)
    if (rnd() < 0.3) { const a = Math.floor(rnd() * (pts.length - 12)), l = 1 + Math.floor(rnd() * 8); for (let i = a + 1; i <= a + l; i++) { path.valid[i] = false; path.pts[i] = { ...path.pts[a] } } }
    klip(path, R)
    const m = path.pts.length, tabt = sidsteOpSlut - (m - 1), andel = tabt > 0 ? Math.round((path.pts[m - 1].y - pts[sidsteOpSlut].y) / rom * 100) : 0
    const t = tal[profNavn] ??= { n: 0, taber: 0, over10: 0, over25: 0, gulvhaler: 0, underGulv: 0 }
    t.n++
    if (tabt > Math.max(2, 0.07 * fps)) { t.taber++; if (andel > 10) t.over10++; if (andel > 25) t.over25++ }
    if (/gulv|skraa/.test(hale)) { t.gulvhaler++; if (+(Math.max(...path.pts.map(q => q.y - gulv)) / R).toFixed(2) > 0.3) t.underGulv++ }
  }
  return tal
}

test('håndholdt kamera med drift opad: toppen af sidste optur beholdes (6000 tilfældige sæt, frø 1)', () => {
  const tal = tilfaeldigeSaet(1, 6000, klip)
  assert.equal(tal.haandholdt.n, 2069)
  // bbbe50cb tabte toppen i 7 af de 2069 håndholdte sæt, 1616v i 19 (4 over 10 % af løftets højde)
  assert.ok(tal.haandholdt.taber <= 7, `håndholdt: ${tal.haandholdt.taber} af 2069 mister toppen af sidste optur`)
  assert.ok(tal.haandholdt.over10 <= 1, `håndholdt: ${tal.haandholdt.over10} mister over 10 % af løftets højde`)
  assert.equal(tal.haandholdt.over25, 0)
  // og intet andet må blive dårligere end 1616v: fast telefon 1 og 0, haler under gulvet 0, 5 og 23
  assert.ok(tal.fast.taber <= 1 && tal.fast.underGulv === 0, `fast: ${JSON.stringify(tal.fast)}`)
  assert.ok(tal.haandholdt.underGulv <= 5, `håndholdt under gulv: ${tal.haandholdt.underGulv}`)
  assert.ok(tal.urolig.taber <= 45 && tal.urolig.over25 <= 10 && tal.urolig.underGulv <= 23, `urolig: ${JSON.stringify(tal.urolig)}`)
})

// Ordre 1629v: de to huller, 1621v selv skrev ned (plan/1621v/KONTROL.md, G2 og G1), med kontrollens generator.
// Seks løft med hvile imellem; efter løft tre rettes billedet dy radius (og en halv radius til siden),
// og efter sidste løft kommer en hale gennem gulvet eller opad ('lige op': to radius over den nye top, hvor
// sporet også lå, mens billedet blev flyttet).
// Ordre 1634v: `dybde` er halens dybde under gulvet i radius, `side` dens flytning til siden, `gynge` antal udsving i halen (på løftets højde,
// 0,7 s pr. tur), og med `midt` ('op' eller 'ned') rettes billedet midt i femte løfts optur eller nedtur i stedet
// for i hvilen efter tredje løft, så kun sjette løft er helt.
function flytningOgHale({ loeft, rom, R: r, fps, dy, hale, pause, dybde = 4, side = 1, gynge = 0, midt = null, hvile = 1.2 }) {
  const top = 6 * r + 300, bot = top + rom * r, doed = loeft === 'dødløft', a = doed ? bot : top, b = doed ? top : bot
  const pts = [{ x: 300, y: a }], slut = []
  const hold = s => { const q = pts.at(-1); for (let i = 0; i < Math.round(s * fps); i++) pts.push({ ...q }) }
  const to = (s, x, y) => { const q = pts.at(-1), n = Math.max(2, Math.round(s * fps)); for (let i = 1; i <= n; i++) pts.push({ x: q.x + (x - q.x) * glat(i / n), y: q.y + (y - q.y) * glat(i / n) }) }
  hold(0.5)
  let skift = 0
  for (let k = 0; k < 6; k++) {
    const foerst = pts.length
    to(1, 300, b)
    const vend = pts.length
    to(1, 300, a); slut.push(pts.length - 1)
    if (midt && k === 4) skift = ((midt === 'op') === doed ? foerst : vend) + Math.round(0.1 * fps)
    if (!midt && k === 2) skift = pts.length
    hold(hvile)
  }
  const saet = pts.length
  hold(pause)
  if (hale === 'gulv') to(1, 300 + side * r, bot + dybde * r); else if (hale === 'op') to(1, 300 + r, top - 3 * r); else to(1, 300 + 0.5 * r, top - 2 * r)
  for (let k = 0; k < gynge; k++) { to(0.7, 300 + side * r, bot + (dybde - rom) * r); to(0.7, 300 + side * r, bot + dybde * r) }
  hold(1)
  pts.forEach((q, i) => { const m = glat((i - skift - 0.2 * fps) / (0.6 * fps)); q.x += 0.5 * r * m; q.y += dy * r * m })
  const efter = pts.slice(skift + fps, saet)
  return { path: lavBane(pts, fps), slut, fra: skift + fps, gulv: Math.max(...efter.map(q => q.y)), loft: Math.min(...efter.map(q => q.y)) }
}

test('billedet rettes over 2,5 radius midt i sættet, og klippet ender med en hale: ingen løft går tabt, og halen klippes', () => {
  const tabt = [], hale = []
  let n = 0
  for (const [loeft, rom] of [['squat', 4], ['dødløft', 5], ['bænk', 2]]) for (const r of [14, 100]) for (const fps of [30, 60]) for (const dy of [-3, 2.6, 3, 4]) for (const type of ['gulv', 'op', 'lige op']) for (const pause of [0, 0.5]) {
    // i dødløft er en tur lige op fra gulvet til to radius over toppen ikke til at skelne fra et løft
    if (loeft === 'dødløft' && type === 'lige op') continue
    const { path, slut, fra, gulv, loft } = flytningOgHale({ loeft, rom, R: r, fps, dy, hale: type, pause })
    klip(path, r)
    n++
    const navn = `${loeft} R ${r} fps ${fps} flytning ${dy}R hale ${type} pause ${pause}`
    const mangler = slut.filter(s => s > path.pts.length + 1).length
    if (mangler) tabt.push(`${navn}: ${mangler} løft`)
    const ys = path.pts.slice(fra).map(q => q.y), ude = (type === 'gulv' ? Math.max(...ys) - gulv : loft - Math.min(...ys)) / r
    if (ude > 0.3) hale.push(`${navn}: ${ude.toFixed(2)}R`)
  }
  assert.equal(n, 256)
  assert.deepEqual(tabt, [], `${tabt.length} af 256 baner taber løft efter flytningen`)
  assert.deepEqual(hale, [], `${hale.length} af 256 haler står tilbage`)
})

test('dødløft: en hale gennem gulvet, der gynger på stedet og ender i bunden, klippes ved gulvet', () => {
  const ikke = []
  for (const [dybde, gange] of [[4, 2], [3, 2], [5, 3]]) for (const udsving of [3, 3.5, 4, 5, 6]) {
    const { path, slut, bot } = gyngeHale({ rom: 5, doed: true, dybde, udsving, gange, skridt: 0 })
    klip(path, R)
    const under = (Math.max(...path.pts.map(q => q.y)) - bot) / R
    if (under > 0.3 || path.pts.length < slut - 3) ikke.push(`dybde ${dybde}R, ${gange} udsving på ${udsving}R: ${under.toFixed(2)}R under gulvet`)
  }
  assert.deepEqual(ikke, [], `${ikke.length} af 15 haler står tilbage under gulvet`)
})

test('dødløft: billedet rettes tre radius midt i sættet, og løftene fortsætter med hvile på gulvet: ingen løft går tabt', () => {
  for (const dy of [-3, 3, 4]) for (const hvile of [15, 24, 36]) {
    const pts = []
    for (let i = 0; i < 15; i++) pts.push({ x: 300, y: BOTTOM })
    let skift = 0
    for (let k = 0; k < 5; k++) {
      for (let i = 1; i <= 30; i++) pts.push({ x: 300, y: BOTTOM - 500 * smooth(i / 30) })
      for (let i = 1; i <= 30; i++) pts.push({ x: 300, y: TOP + 500 * smooth(i / 30) })
      if (k === 2) skift = pts.length
      for (let i = 0; i < hvile; i++) pts.push({ x: 300, y: BOTTOM })
    }
    pts.forEach((q, i) => { const m = glat((i - skift - 2) / 10); q.x += 50 * m; q.y += dy * R * m })
    const path = lavBane(pts), foer = path.pts.length
    klip(path, R)
    assert.equal(path.pts.length, foer, `${dy}R, hvile ${hvile} billeder`)
  }
})

test('dødløft uden ro på gulvet: billedet rettes tre radius midt i sættet, og løftene fortsætter i samme takt: ingen løft går tabt', () => {
  for (const dy of [-3, 3, 4]) for (const tur of [20, 30]) {
    const pts = []
    for (let i = 0; i < 15; i++) pts.push({ x: 300, y: BOTTOM })
    let skift = 0
    for (let k = 0; k < 6; k++) {
      for (let i = 1; i <= tur; i++) pts.push({ x: 300, y: BOTTOM - 500 * smooth(i / tur) })
      for (let i = 1; i <= tur; i++) pts.push({ x: 300, y: TOP + 500 * smooth(i / tur) })
      if (k === 2) { skift = pts.length; for (let i = 0; i < 36; i++) pts.push({ x: 300, y: BOTTOM }) }
    }
    for (let i = 0; i < 30; i++) pts.push({ x: 300, y: BOTTOM })
    pts.forEach((q, i) => { const m = glat((i - skift - 6) / 18); q.x += 50 * m; q.y += dy * R * m })
    const path = lavBane(pts), foer = path.pts.length
    klip(path, R)
    assert.equal(path.pts.length, foer, `${dy}R, ${tur} billeder pr. tur`)
  }
})

// Kontrollens fund i 1629v: en pause i toppen af hvert udsving må ikke gøre et gyng til løft. Kun udsving, der
// ligner sættets egne løft i højde, tempo og hvile, tæller som et sæt, der er fortsat efter en flytning af billedet.
test('en hale gennem gulvet, der gynger med pause i toppen af hvert udsving, klippes ved gulvet, når udsvingene ikke ligner sættets løft', () => {
  const ikke = []
  let n = 0
  for (const [navn, rom] of [['bænk', 2], ['squat', 4]]) for (const skridt of [0, 60]) for (const pause of [9, 18, 30]) {
    // lavere eller højere end løftene i samme tempo, og samme højde i et andet tempo
    for (const [faktor, tur] of [[0.7, 30], [1.4, 30], [1, 12], [1, 50]]) {
      const { path, slut, bot } = gyngeHale({ rom, dybde: 3, udsving: faktor * rom, skridt, tur, pause })
      klip(path, R)
      n++
      const under = (Math.max(...path.pts.map(q => q.y)) - bot) / R
      if (under > 0.3 || path.pts.length < slut - 3) ikke.push(`${navn} skridt ${skridt}, pause ${pause} billeder, udsving ${faktor} gange løftet på ${tur} billeder: ${under.toFixed(2)}R under gulvet`)
    }
  }
  assert.equal(n, 48)
  assert.deepEqual(ikke, [], `${ikke.length} af 48 haler står tilbage under gulvet`)
})

// Kontrollens fund 1 i 1629v: dødløft, hvor løftene efter flytningen er uden ro på gulvet, mens sættet før
// flytningen havde ro eller kun var ét løft, må ikke miste løftene efter flytningen.
test('dødløft: billedet rettes over 2,5 radius ned efter første løft eller efter løft med ro, og resten løftes uden ro: ingen løft går tabt', () => {
  for (const dy of [2.7, 3.5, 5, -3.5]) for (const foer of [1, 2, 3, 4]) for (const ro of [0, 30]) {
    const pts = []
    for (let i = 0; i < 15; i++) pts.push({ x: 300, y: BOTTOM })
    let skift = 0
    for (let k = 0; k < 6; k++) {
      for (let i = 1; i <= 30; i++) pts.push({ x: 300, y: BOTTOM - 500 * smooth(i / 30) })
      for (let i = 1; i <= 30; i++) pts.push({ x: 300, y: TOP + 500 * smooth(i / 30) })
      if (k === foer - 1) { skift = pts.length; for (let i = 0; i < 45; i++) pts.push({ x: 300, y: BOTTOM }) } else if (k < foer) for (let i = 0; i < ro; i++) pts.push({ x: 300, y: BOTTOM })
    }
    for (let i = 0; i < 30; i++) pts.push({ x: 300, y: BOTTOM })
    pts.forEach((q, i) => { const m = glat((i - skift - 6) / 18); q.x += 50 * m; q.y += dy * R * m })
    const path = lavBane(pts), foerKlip = path.pts.length
    klip(path, R)
    assert.equal(path.pts.length, foerKlip, `${dy}R efter løft ${foer}, ro før ${ro} billeder`)
  }
})

// Ordre 1634v: de tilfælde, 1629v selv skrev ned som ikke dækkede (plan/1629v/TJEK.md), med samme generator.
// (d) Billedet rettes opad, og halen går gennem det nye gulv, men bliver inden for det gamle område.
test('billedet rettes over 2,5 radius opad midt i sættet, og halen gennem det nye gulv ender inden for det gamle område: halen klippes, og ingen løft går tabt', () => {
  const tabt = [], hale = []
  let n = 0
  for (const [loeft, rom] of [['squat', 4], ['dødløft', 5], ['bænk', 2]]) for (const r of [14, 100]) for (const fps of [30, 60]) for (const [dy, dybde] of [[-2.6, 1.5], [-3, 1.5], [-3, 2], [-4, 2], [-4, 3]]) for (const pause of [0, 0.5]) {
    const { path, slut, fra, gulv } = flytningOgHale({ loeft, rom, R: r, fps, dy, hale: 'gulv', pause, dybde, side: 0.2 })
    klip(path, r)
    n++
    const navn = `${loeft} R ${r} fps ${fps} flytning ${dy}R hale ${dybde}R under nyt gulv pause ${pause}`
    const mangler = slut.filter(s => s > path.pts.length + 1).length
    if (mangler) tabt.push(`${navn}: ${mangler} løft`)
    const ude = (Math.max(...path.pts.slice(fra).map(q => q.y)) - gulv) / r
    if (ude > 0.3) hale.push(`${navn}: ${ude.toFixed(2)}R`)
  }
  assert.equal(n, 120)
  assert.deepEqual(tabt, [], `${tabt.length} af 120 baner taber løft`)
  assert.deepEqual(hale, [], `${hale.length} af 120 haler står tilbage under det nye gulv`)
})

// (b) Billedet rettes midt i en tur, så kun ét helt løft følger, og klippet ender med en hale: løftet går
// stadig tabt (304 af 576 baner med denne generator, som før). Det er en kendt grænse: en regel, der lod en
// enkelt optur langt væk tælle som løft, lod også en hale med ét udsving magen til et løft stå under gulvet
// (kontrollen: bænk og dødløft fik 6 reps og 69 og 111 punkter under bunden). Prøven her holder den vej lukket.
test('en hale gennem gulvet, der holder stille og gør ét udsving magen til sættets løft, klippes ved gulvet og tæller ikke som løft', () => {
  const tabt = [], hale = []
  let n = 0
  for (const [loeft, rom] of [['squat', 4], ['dødløft', 5], ['bænk', 2]]) for (const r of [14, 100]) for (const fps of [30, 60]) for (const dybde of [3, 5]) for (const ro of [0.6, 1.2]) {
    const top = 6 * r + 300, bot = top + rom * r, doed = loeft === 'dødløft', a = doed ? bot : top, b = doed ? top : bot
    const pts = [{ x: 300, y: a }], slut = []
    const hold = s => { const q = pts.at(-1); for (let i = 0; i < Math.round(s * fps); i++) pts.push({ ...q }) }
    const to = (s, x, y) => { const q = pts.at(-1), m = Math.max(2, Math.round(s * fps)); for (let i = 1; i <= m; i++) pts.push({ x: q.x + (x - q.x) * glat(i / m), y: q.y + (y - q.y) * glat(i / m) }) }
    hold(0.5)
    for (let k = 0; k < 5; k++) { to(1, 300, b); to(1, 300, a); slut.push(pts.length - 1); hold(1.2) }
    // halen: ned gennem gulvet, ro, ét udsving på løftets højde og tempo, ro
    const hjem = a + (rom + dybde) * r, ude = b + (rom + dybde) * r
    to(1, 300 + r, hjem); hold(ro); to(1, 300 + r, ude); to(1, 300 + r, hjem); hold(1.5)
    const path = { pts, times: pts.map((_, i) => i / fps), valid: pts.map(() => true), confidence: pts.map(() => 1) }
    klip(path, r)
    n++
    const navn = `${loeft} R ${r} fps ${fps} hale ${dybde}R under gulvet, ro ${ro} s`
    const mangler = slut.filter(q => q > path.pts.length + 1).length
    if (mangler) tabt.push(`${navn}: ${mangler} løft`)
    const under = (Math.max(...path.pts.map(q => q.y)) - bot) / r
    if (under > 0.3) hale.push(`${navn}: ${under.toFixed(2)}R`)
  }
  assert.equal(n, 48)
  assert.deepEqual(tabt, [], `${tabt.length} af 48 baner taber løft`)
  assert.deepEqual(hale, [], `${hale.length} af 48 haler står tilbage under gulvet`)
})

// Ordre 1661v: resten, som kontrollen af 1634v fandt (work/1634v/kontrol3/egen-to.mjs, samme generator).
// Billedet rettes over 2,5 radius opad i en hvile, mindst to løft med ro følger, og billedet flyttes ned
// igen, mens sidste løft er på vej op. Klippet ender uden hale, så intet skal klippes: reglen for en hale
// gennem det nye gulv tog sidste løfts optur med (1128 flere baner end nu med denne generator).
// Er flytningen nedad større end selve løftet, eller ender sporet uden for sættets gamle område, kan den
// gamle regel (flugt fra hele sættets område) stadig tage løftet, som før 1634v: 560 af 8640 baner. Det er
// en kendt grænse, og tallet må ikke vokse.
test('billedet rettes opad i en hvile og flyttes ned igen midt i sidste løfts optur: sidste optur klippes ikke af', () => {
  const tabt = [], inde = []
  let n = 0
  for (const [loeft, rom] of [['squat', 4.2], ['dødløft', 4.8], ['bænk', 2.2], ['bænk', 2.8], ['squat', 3]]) for (const r of [14, 100]) for (const fps of [30, 60]) for (const ryst of [0, 0.08])
    for (const dy1 of [-2.6, -3.5, -5]) for (const dy2 of [1, 1.6, 2.2, 2.6, 3.5, 5]) for (const fase of [0.1, 0.35, 0.6]) for (const hv of [0.6, 1.2]) for (const ro of [0, 2.4]) {
      const top = 10 * r + 300, bot = top + rom * r, doed = loeft === 'dødløft', a = doed ? bot : top, b = doed ? top : bot
      const pts = [{ x: 300, y: a }], slut = []
      const hold = s => { const q = pts.at(-1); for (let i = 0; i < Math.round(s * fps); i++) pts.push({ ...q }) }
      const to = (s, x, y) => { const q = pts.at(-1), m = Math.max(2, Math.round(s * fps)); for (let i = 1; i <= m; i++) pts.push({ x: q.x + (x - q.x) * glat(i / m), y: q.y + (y - q.y) * glat(i / m) }) }
      hold(0.6)
      let s1 = 0, s2 = 0
      for (let k = 0; k < 7; k++) {
        // flytningen nedad begynder fase sekunder inde i sidste løfts optur
        if (k === 6 && doed) s2 = pts.length + Math.round(fase * fps)
        to(1.1, 300, b); if (doed) slut.push(pts.length - 1)
        if (k === 6 && !doed) s2 = pts.length + Math.round(fase * fps)
        to(0.9, 300, a); if (!doed) slut.push(pts.length - 1)
        if (k === 1) { s1 = pts.length; hold(1.3) } else if (k < 6) hold(hv)
      }
      hold(ro)
      pts.forEach((q, i) => {
        const m1 = glat((i - s1 - 0.2 * fps) / (0.6 * fps)), m2 = glat((i - s2) / (0.5 * fps)), t = i / fps
        q.y += dy1 * r * m1 + dy2 * r * m2 + ryst * r * Math.sin(t * 1.3 * 6.283 + 1); q.x += 0.3 * r * m1 - 0.2 * r * m2 + ryst * r * Math.sin(t * 2.1 * 6.283)
      })
      const path = lavBane(pts, fps)
      klip(path, r)
      n++
      if (slut.at(-1) <= path.pts.length + 1) continue
      const navn = `${loeft} ${rom}R R ${r} fps ${fps} ryst ${ryst} op ${dy1}R ned ${dy2}R fase ${fase} hvile ${hv} ro efter ${ro}: banen ender ${slut.at(-1) - path.pts.length + 1} billeder før sidste opturs slutning`
      tabt.push(navn)
      if (dy2 < rom && dy1 + dy2 <= 0) inde.push(navn)
    }
  assert.equal(n, 8640)
  assert.deepEqual(inde, [], `${inde.length} baner mister sidste optur, selv om flytningen nedad er mindre end løftet og sporet bliver inden for det gamle område`)
  assert.ok(tabt.length <= 560, `${tabt.length} af 8640 baner mister sidste optur (560 før 1634v): ${tabt.slice(0, 3).join(' | ')}`)
})
