import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Ordre 2031v (Marc 19. nov. kl. 20:50: "bar tracker misser stadig, den er ikke reliabel"; 1950v målte, at et løft
// tabes, når skiven dækkes kort midt i opturen). Prøver den levende kode i public/videocoach.html:
//  1) analysen bygger bro over et kort hul af ugyldige billeder (tilbagefangstens rette linje) midt i en optur,
//     så løftet findes, og dets fart vises som usikker i stedet for et forkert tal;
//  2) dækker hullet hele opturen og varer længere end sættets typiske optur plus 0,6 s, tælles løftet ikke,
//     men står i analysis.unseen ("1 løft kunne ikke ses");
//  3) uden huller er tallene bit for bit som før (samme bane uden ugyldige billeder);
//  4) sporeren har dækningsvagten (RL_COVER, to billeder i træk) og søger længere lodret, mens sporet er tabt;
//  5) ringsøgningen kan begrænses vandret (rangeX) uden at ændre fundet, når grænsen ikke rammes.
const html = readFileSync(new URL('../public/videocoach.html', import.meta.url), 'utf8')
const skaer = (fra, til) => { const a = html.indexOf(fra), b = html.indexOf(til, a); assert.ok(a > 0 && b > a, `findes i videocoach.html: ${fra.slice(0, 40)}`); return html.slice(a, b) }

const analyse = new Function('path', 'canvas', 'cmPerPx', `const buildVisualBarPath = () => [], updateCleanReviewUI = () => {};
${skaer('function analyzeCleanPath(path) {', 'function analyzePath(path) {')}
  return analyzeCleanPath(path)`)

const glat = x => { const c = Math.max(0, Math.min(1, x)); return c * c * (3 - 2 * c) }
const R = 100, CM = 45 / (2 * R), FPS = 30
// fem løft ned og op fra hvile til hvile, opturen langsommere løft for løft (som 1950v's prøve)
function saet(optur = [0.90, 0.97, 1.05, 1.15, 1.28]) {
  const top = 500, bund = 800, led = []
  let T = 1
  for (const c of optur) { led.push({ a: T, b: T + 1.1, fra: top, til: bund }); T += 1.1 + 0.3; led.push({ a: T, b: T + c, fra: bund, til: top, op: true }); T += c + 0.9 }
  const y = t => { let v = top; for (const s of led) { if (t >= s.b) v = s.til; else if (t >= s.a) { v = s.fra + (s.til - s.fra) * glat((t - s.a) / (s.b - s.a)); break } else break } return v }
  const opture = led.filter(s => s.op)
  const sand = opture.map(s => { let sum = 0, n = 0; const h = 0.0005; for (let t = s.a; t < s.b; t += h) { const v = (y(t) - y(t + h)) * CM / 100 / h; if (v > 0.05) { sum += v; n++ } } return sum / n })
  return { y, sand, slut: T + 1, opture }
}
// banen som sporeren gemmer den: i et hul [fra, til] ligger punkterne på en ret linje mellem det sidste gyldige
// punkt før og det første efter, og de er ugyldige (præcis som tilbagefangsten skriver dem)
function bane(s, hul = null) {
  const times = Array.from({ length: Math.floor(s.slut * FPS) }, (_, k) => k / FPS)
  const valid = times.map(t => !(hul && t >= hul[0] && t <= hul[1]))
  const pts = times.map(t => ({ x: 360, y: s.y(t) }))
  if (hul) {
    const i0 = valid.lastIndexOf(true, times.findIndex(t => t >= hul[0])), i1 = valid.indexOf(true, times.findIndex(t => t > hul[1]))
    for (let i = i0 + 1; i < i1; i++) { const u = (times[i] - times[i0]) / (times[i1] - times[i0]); pts[i] = { x: 360, y: pts[i0].y + (pts[i1].y - pts[i0].y) * u } }
  }
  const path = { pts, times, raw: { pts, times, valid, start: times[0], end: times.at(-1), cam: null }, analysisSession: { schema: 1, lift: 'squat' } }
  analyse(path, { width: 720 }, CM)
  return path
}

test('et kort hul midt i tredje løfts optur: løftet findes, farten er usikker, de andre fire er som før', () => {
  const s = saet(), o = s.opture[2]
  const uden = bane(s), med = bane(s, [o.a + 0.15, o.b - 0.2])   // dækket fra 0,15 s inde i opturen til 0,2 s før toppen
  assert.equal(uden.reps.length, 5)
  assert.equal(med.reps.length, 5, `fem løft med hul (${med.reps.length})`)
  assert.equal(med.analysis.unseen.length, 0)
  assert.equal(med.reps[2].usikker, true, 'løft 3 er usikkert')
  assert.ok(Number.isNaN(med.reps[2].mcv), 'usikkert løft har ingen fart')
  for (const i of [0, 1, 3, 4]) {
    assert.equal(med.reps[i].usikker, false)
    assert.equal(med.reps[i].mcv, uden.reps[i].mcv, `løft ${i + 1} har samme fart som uden hul`)
  }
})

test('dækker hullet hele opturen, og er det langt, tælles løftet ikke, men står som "kunne ikke ses"', () => {
  const s = saet(), o = s.opture[2]
  const med = bane(s, [o.a - 0.6, o.b + 0.9])   // 2,5 s mod en typisk optur på ca. 1 s
  assert.equal(med.reps.length, 4, `fire løft (${med.reps.length})`)
  assert.equal(med.analysis.unseen.length, 1, 'ét løft kunne ikke ses')
  assert.ok(med.analysis.unseen[0].start < med.reps[2].start && med.analysis.unseen[0].end > med.reps[1].end, 'det usete løft ligger mellem løft 2 og 4')
  assert.ok(html.includes("løft kunne ikke ses"), 'atleten får det at vide i resultatpanelet')
})

test('et langt hul fra midt i nedturen til næsten toppen af opturen: løftet tælles ikke, men står som "kunne ikke ses" (ikke stilhed)', () => {
  const s = saet(), o = s.opture[2]
  const med = bane(s, [o.a - 1.0, o.a + 0.85])   // 1,85 s: stangen var på vej ned før hullet og når toppen lige efter det
  assert.equal(med.reps.length, 4, `fire løft (${med.reps.length})`)
  assert.equal(med.analysis.unseen.length, 1, 'ét løft kunne ikke ses')
  assert.ok(med.analysis.unseen[0].end > med.reps[1].end && med.analysis.unseen[0].start < med.reps[2].start, 'det usete løft ligger mellem løft 2 og 4')
  for (const i of [0, 1]) assert.equal(med.reps[i].mcv, bane(s).reps[i].mcv, `løft ${i + 1} som uden hul`)
})

test('et langt hul fra bunden til et stykke ned ad næste nedtur (skiven ses igen højere oppe og på vej ned): "kunne ikke ses"', () => {
  const s = saet(), o = s.opture[2]
  const med = bane(s, [o.a - 0.2, o.b + 0.9 + 0.6])   // ca. 2,75 s: over broens 2,5 s, så hullet ikke bygges bro over
  assert.equal(med.reps.length, 4, `fire løft (${med.reps.length})`)
  assert.equal(med.analysis.unseen.length, 1, 'ét løft kunne ikke ses')
  assert.ok(med.analysis.unseen[0].start >= med.reps[1].end && med.analysis.unseen[0].end <= med.reps[2].start, 'det usete løft ligger mellem løft 2 og 4')
})

test('dækker hullet hele opturen, men er det kort (som en hånd, der går forbi), findes løftet med usikker fart', () => {
  const s = saet(), o = s.opture[2]
  const med = bane(s, [o.a - 0.05, o.b + 0.05])   // ca. 1,15 s, under typisk optur plus 0,6 s
  assert.equal(med.reps.length, 5)
  assert.equal(med.reps[2].usikker, true)
  assert.equal(med.analysis.unseen.length, 0)
})

test('et hul uden for opturen (i hvilen i toppen) ændrer intet ved løftene', () => {
  const s = saet(), o = s.opture[1]
  const uden = bane(s), med = bane(s, [o.b + 0.2, o.b + 0.7])
  assert.equal(med.reps.length, 5)
  assert.deepEqual(med.reps.map(r => r.usikker), [false, false, false, false, false])
  assert.deepEqual(med.reps.map(r => r.mcv), uden.reps.map(r => r.mcv))
})

test('et hul, der begynder i opturens sidste billede (toppen), gør ikke løftet usikkert (kontrollens fund 2)', () => {
  const s = saet(), o = s.opture[1]
  const uden = bane(s), med = bane(s, [o.b, o.b + 0.5])
  assert.equal(med.reps.length, 5)
  assert.deepEqual(med.reps.map(r => r.usikker), [false, false, false, false, false])
  med.reps.forEach((rep, i) => assert.ok(Math.abs(rep.mcv - uden.reps[i].mcv) < 1e-9, `løft ${i + 1}: ${rep.mcv} mod ${uden.reps[i].mcv}`))
})

test('uden huller er analysen bit for bit som en bane, hvor alle billeder er gyldige (ingen bro, ingen usikker, intet uset)', () => {
  const s = saet()
  const path = bane(s)
  assert.deepEqual(path.reps.map(r => r.usikker), [false, false, false, false, false])
  assert.deepEqual(path.analysis.unseen, [])
  path.reps.forEach((rep, i) => assert.ok(Math.abs(rep.mcv / s.sand[i] - 1) < .05, `løft ${i + 1}: ${rep.mcv.toFixed(3)} mod ${s.sand[i].toFixed(3)}`))
})

test('sporeren: dækningsvagten spørger referencen før godkendelse, og tilbagefangsten søger længere lodret, mens sporet er tabt', () => {
  assert.ok(html.includes('const RL_COVER=.45;'), 'grænsen for "ligner ikke skiven" findes')
  assert.ok(html.includes('if(coverStreak>=2){identityOK=false;path.covered=(path.covered||0)+1;'), 'to billeder i træk under grænsen = dækket')
  assert.ok(html.includes("lockPre&&lockPre.x0===cur.x&&lockPre.y0===cur.y?lockPre.h:look(lock.k)"), 'låsen genbruger vagtens måling (bit for bit)')
  assert.ok(html.includes('const far=!accepted&&cmPerPx>0?Math.min(radius*8,radius*.6+(200/cmPerPx)*lostS):0;'), 'rækkevidden følger 2 m/s, mens sporet er tabt')
  assert.ok(html.includes('lock.ok=lock.good;lock.low=0;lock.pending=null;coverStreak=0;'), 'tilbagefangsten nulstiller vagten')
})

test('ringsøgningen med vandret grænse finder det samme som uden, når fundet ligger inden for grænsen', () => {
  const kode = skaer('const RL_PX=40,RL_RINGS=24', 'let rlCan=null,rlCtx=null;') + skaer('function rlProfile(f,px,py,out,spread,skip=1){', 'function rlInit(p0,radius,path){')
  const rl = new Function(`${kode}; return { rlSearch, rlReference, RL_PX }`)()
  // et udsnit med en "skive" (ringe omkring et punkt); referencen tages fra et udsnit, hvor skiven står i midten
  const range = 60, half = range + 40 + 2, n = 2 * half + 1
  const tegn = (cx, cy) => { const g = new Float32Array(n * n); for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const d = Math.hypot(x - cx, y - cy); g[y * n + x] = 120 + 60 * Math.cos(d / 4) + ((x * 7 + y * 13) % 5) } return { g, n, half, s: 1, cx: 0, cy: 0, range } }
  const ref = rl.rlReference(tegn(half, half))
  const f = tegn(half + 9, half - 30)
  const a = rl.rlSearch(f, ref, 3), b = rl.rlSearch(f, ref, 3, 20)
  assert.ok(a && b, 'begge søgninger finder noget')
  assert.ok(Math.abs(a.x - 9) < 1 && Math.abs(a.y + 30) < 1, `fundet ligger på skiven (${a.x.toFixed(2)},${a.y.toFixed(2)})`)
  assert.ok(Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9, `samme fund (${a.x.toFixed(2)},${a.y.toFixed(2)}) mod (${b.x.toFixed(2)},${b.y.toFixed(2)})`)
  const c = rl.rlSearch(f, ref, 3, 4)
  assert.ok(Math.abs(c.x) <= 4.5, `med grænsen 4 ligger fundet inden for den (${c.x.toFixed(2)})`)
})
