// ORDRE 109 · commit 1 — "den kunne ikke finde skiverne": en syntetisk
// prøvebænk for `autoCalib` (public/videocoach.html, ORDRE 85-markøren),
// UDEN video, UDEN browser. Samme udtræksteknik som scripts/verify-
// videocoach-clip.mjs (regex-markører, IKKE en manuel kopi af koden — se
// docs/videocoach/SKIVEN-FINDES-IKKE.md for hvorfor: en kopi kan drifte fra
// den kode atleten faktisk kører, en udtrukket funktion kan ikke).
//
// autoCalib kalder kun tre ting fra sin omgivelse: octx.drawImage (til at
// tegne den aktuelle video-frame ind), octx.getImageData og canvas/ocan's
// width/height. Det er nok til at køre funktionen i ren Node: en falsk
// "canvas" er bare et objekt med de tre metoder/felter, der læser fra en
// RGBA-buffer vi selv har tegnet skiver i - samme mønster som
// docs/videocoach/tracker-testrig.js's "canvas-emulering", men her udtrukket
// 1:1 fra videocoach.html i stedet for kopieret i hånden.
//
// Otte betingelser, valgt fra Marcs egen liste i ORDRE 109: kontrast, radius
// uden for forventet interval, kant mod rack, mørk skive på mørk baggrund,
// lille video, skive delvist ude af billedet, telefon i portrait med sort
// bjælke - plus én baseline (god kontrast, fri bane) som kontrol.
//
// Kørsel: npm run verify:videocoach-plate-detect

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const htmlPath = join(root, 'public', 'videocoach.html')
const html = readFileSync(htmlPath, 'utf8')

function extractBlock(text, startMarker, endMarker, includeEndMarker = false) {
  const startIdx = text.indexOf(startMarker)
  if (startIdx < 0) throw new Error(`verify-videocoach-plate-detect: startmarkør ikke fundet ("${startMarker.slice(0, 40)}...") - er videocoach.html omstruktureret?`)
  const endIdx = text.indexOf(endMarker, startIdx)
  if (endIdx < 0) throw new Error(`verify-videocoach-plate-detect: slutmarkør ikke fundet ("${endMarker.slice(0, 40)}...") - er videocoach.html omstruktureret?`)
  return text.slice(startIdx, includeEndMarker ? endIdx + endMarker.length : endIdx)
}

// Samme markører som scripts/verify-videocoach-clip.mjs bruger for
// autoCalibSource - ét sted i videocoach.html definerer sandheden.
const autoCalibSource = extractBlock(html,
  '// ORDRE 85 · start: auto-kalibrering', '// ORDRE 85 · slut: auto-kalibrering', true)
const buildAutoCalib = new Function('octx', 'video', 'ocan', 'canvas', `${autoCalibSource}\nreturn autoCalib;`)

// ---------- syntetisk "canvas": en RGBA-buffer + de tre ting autoCalib bruger ----------
function makeBuffer(W, H, bg) {
  const buf = new Uint8ClampedArray(W * H * 4)
  for (let i = 0; i < W * H; i++) {
    buf[i * 4] = buf[i * 4 + 1] = buf[i * 4 + 2] = bg
    buf[i * 4 + 3] = 255
  }
  return buf
}
function fillCircle(buf, W, H, cx, cy, r, val) {
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r))
  const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r))
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) {
        const i = (y * W + x) * 4
        buf[i] = buf[i + 1] = buf[i + 2] = val
      }
}
function fillRect(buf, W, H, x0, y0, w, h, val) {
  for (let y = Math.max(0, y0); y < Math.min(H, y0 + h); y++)
    for (let x = Math.max(0, x0); x < Math.min(W, x0 + w); x++) {
      const i = (y * W + x) * 4
      buf[i] = buf[i + 1] = buf[i + 2] = val
    }
}
function makeCtx(buf, W, H) {
  return {
    drawImage() {},                      // videoen er allerede "tegnet" ind i buf
    getImageData(x0, y0, w, h) {
      const out = new Uint8ClampedArray(w * h * 4)
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const sx = x0 + x, sy = y0 + y, di = (y * w + x) * 4
          if (sx < 0 || sy < 0 || sx >= W || sy >= H) { out[di + 3] = 255; continue }
          const si = (sy * W + sx) * 4
          out[di] = buf[si]; out[di + 1] = buf[si + 1]; out[di + 2] = buf[si + 2]; out[di + 3] = 255
        }
      return { data: out }
    },
  }
}

function runAutoCalib(W, H, center, buf) {
  const octx = makeCtx(buf, W, H)
  const dims = { width: W, height: H }
  const autoCalib = buildAutoCalib(octx, {}, dims, dims)
  const scale = autoCalib(center)         // cm/px eller null
  return scale ? 22.5 / scale : null       // -> fundet radius i px, eller null
}

// ---------- otte betingelser (+ baseline) ----------
const conditions = []

// 1) Baseline: god kontrast, fri bane, centreret.
{
  const W = 720, H = 1280, cx = 360, cy = 640, r = 140
  const buf = makeBuffer(W, H, 170); fillCircle(buf, W, H, cx, cy, r, 90)
  conditions.push({ name: 'baseline (god kontrast, fri bane)', W, H, cx, cy, r, buf,
    expect: 'fundet', why: 'kontrast 80, ingen forstyrrelser - det tilfælde autoCalib er bygget til.' })
}

// 2) Lav kontrast generelt (lys skive på lys baggrund).
{
  const W = 720, H = 1280, cx = 360, cy = 640, r = 140
  const buf = makeBuffer(W, H, 200); fillCircle(buf, W, H, cx, cy, r, 178)
  conditions.push({ name: 'kontrast (lys skive på lys baggrund, diff 22)', W, H, cx, cy, r, buf,
    expect: 'ikke fundet', why: 'kontrast-spring (22) under grænsen (28 - se autoCalib) på alle 16 stråler.' })
}

// 3) Radius uden for forventet interval (skiven fylder mere end de scannede 45%).
{
  const W = 720, H = 1280, cx = 360, cy = 640, r = 400   // maxR = min(W,H)*0.45 = 324
  const buf = makeBuffer(W, H, 170); fillCircle(buf, W, H, cx, cy, r, 90)
  conditions.push({ name: 'radius uden for forventet interval (skive > maxR)', W, H, cx, cy, r, buf,
    expect: 'ikke fundet', why: 'kanten ligger uden for søgeradius (maxR=324px) - scanningen ser aldrig et spring.' })
}

// 4) Kant mod rack: to lodrette stolper (venstre+højre) og en vandret bjælke
// forneden - som et squat-stativ skiven står i - alle med STØRRE kontrast-
// spring end skivens egen kant. Én enkelt stolpe viste sig IKKE nok til at
// rykke median-stemmen (kun 1-2 af 16 stråler rammer den) - først når
// forstyrrelsen dækker flertallet af retninger, vælter den resultatet.
{
  const W = 720, H = 1280, cx = 360, cy = 640, r = 100
  const buf = makeBuffer(W, H, 170); fillCircle(buf, W, H, cx, cy, r, 110)   // skivens spring: 60
  fillRect(buf, W, H, 480, 0, 240, H, 255)     // højre stolpe, spring: 85
  fillRect(buf, W, H, 0, 0, 240, H, 255)       // venstre stolpe, spring: 85
  fillRect(buf, W, H, 0, 760, W, H - 760, 255) // bjælke forneden, spring: 85
  conditions.push({ name: 'kant mod rack (stolper + bjælke på 3 af 4 sider)', W, H, cx, cy, r, buf,
    expect: 'fundet, men FORKERT', why: 'rackets spring (85) > skivens (60) på flertallet af de 16 stråler - autoCalib returnerer en tro og sikker, men forkert, radius. INGEN fejlbesked.' })
}

// 5) Mørk skive på mørk baggrund (Marcs sandsynlige sag: sort bumperplade, dæmpet lys).
{
  const W = 720, H = 1280, cx = 360, cy = 640, r = 120
  const buf = makeBuffer(W, H, 45); fillCircle(buf, W, H, cx, cy, r, 26)
  conditions.push({ name: 'mørk skive på mørk baggrund (diff 19)', W, H, cx, cy, r, buf,
    expect: 'ikke fundet', why: 'samme mekanisme som kontrast-sagen ovenfor, men den mest sandsynlige virkelige version af den.' })
}

// 6) Lille video (lav opløsning) - skiven er kun nogle få pixels i radius.
{
  const W = 160, H = 120, cx = 80, cy = 60, r = 8
  const buf = makeBuffer(W, H, 170); fillCircle(buf, W, H, cx, cy, r, 80)
  conditions.push({ name: 'lille video (160×120, skive-radius 8px)', W, H, cx, cy, r, buf,
    expect: 'ikke fundet', why: 'bevidst gulv i autoCalib: "rad < 12" -> for få pixels til at bære en måling.' })
}

// 7) Skiven delvist uden for billedet (klippet af kanten).
{
  const W = 720, H = 1280, cx = 690, cy = 640, r = 140   // højre side af cirklen ligger uden for W
  const buf = makeBuffer(W, H, 170); fillCircle(buf, W, H, cx, cy, r, 90)
  conditions.push({ name: 'skive delvist ude af billedet (klippet af højrekant)', W, H, cx, cy, r, buf,
    expect: 'grænsetilfælde', why: 'de stråler der peger ud af billedet mister kanten (clamp) - resten kan stadig nå de 6/16 stemmer.' })
}

// 8) Telefon i portrait med sort bjælke (letterbox) OVER OG UNDER skiven -
// den typiske situation når en landskabs-optagelse vises i et portræt-
// vindue: kun en smal, vandret synlig bane tilbage. Bjælkernes spring (170,
// sort mod grå baggrund) er langt over skivens egen (60) og rammer
// flertallet af de 16 stråler (op OG ned), ligesom rack-sagen ovenfor.
{
  const W = 720, H = 1280, cx = 360, cy = 640, r = 100
  const buf = makeBuffer(W, H, 170)
  fillRect(buf, W, H, 0, 0, W, 520, 0)         // sort bjælke øverst
  fillRect(buf, W, H, 0, 760, W, H - 760, 0)   // sort bjælke nederst
  fillCircle(buf, W, H, cx, cy, r, 110)        // skiven males OVEN PÅ bjælkerne - urørt, spring 60
  conditions.push({ name: 'telefon i portrait med sort bjælke (over+under)', W, H, cx, cy, r, buf,
    expect: 'fundet, men FORKERT', why: 'bjælkernes spring (170) > skivens (60) på flertallet af stråler op/ned - samme svaghed som rack-sagen: sikker, men forkert radius.' })
}

// ---------- kør og rapportér ----------
const rows = conditions.map(c => {
  const foundR = runAutoCalib(c.W, c.H, { x: c.cx, y: c.cy }, c.buf)
  const found = foundR != null
  const errPx = found ? Math.abs(foundR - c.r) : null
  return { navn: c.name, forventet: c.expect, fundet: found ? 'ja' : 'nej',
    radiusFejlPx: errPx == null ? '-' : errPx.toFixed(1), why: c.why }
})

console.log('== ORDRE 109 · commit 1: autoCalib mod otte syntetiske betingelser ==\n')
const nameW = Math.max(...rows.map(r => r.navn.length)) + 2
console.log(`${'Betingelse'.padEnd(nameW)}${'Fundet'.padEnd(8)}${'Radius-fejl (px)'.padEnd(18)}Forventning`)
for (const r of rows)
  console.log(`${r.navn.padEnd(nameW)}${r.fundet.padEnd(8)}${String(r.radiusFejlPx).padEnd(18)}${r.forventet}`)
console.log()
for (const r of rows) console.log(`- ${r.navn}: ${r.why}`)

// ---------- selv-tjek: de tilfælde vi VED skal fejle sikkert, skal stadig fejle sikkert ----------
// De to "grænsetilfælde"/"kan være forkert" rækker (rack, letterbox) er
// bevidst IKKE en hård påstand her - det er netop pointen i rapporten: de
// fejler ikke rent, det er derfor ring-bekræftelsen i UI'en (plateConfirm)
// er sikkerhedsnettet, ikke autoCalib selv.
const mustFailSafely = ['kontrast (lys skive på lys baggrund, diff 22)',
  'radius uden for forventet interval (skive > maxR)',
  'mørk skive på mørk baggrund (diff 19)',
  'lille video (160×120, skive-radius 8px)']
const mustFind = ['baseline (god kontrast, fri bane)']
let ok = true
for (const r of rows) {
  if (mustFailSafely.includes(r.navn) && r.fundet !== 'nej') {
    console.error(`FEJL: "${r.navn}" burde fejle sikkert (returnere null), men fandt en radius.`)
    ok = false
  }
  if (mustFind.includes(r.navn) && r.fundet !== 'ja') {
    console.error(`FEJL: "${r.navn}" burde finde skiven, men gjorde ikke.`)
    ok = false
  }
}
console.log(ok
  ? '\nGRØN: de éntydige tilfælde opfører sig som dokumenteret i docs/videocoach/SKIVEN-FINDES-IKKE.md.'
  : '\nRØD: autoCalib har ændret opførsel på et éntydigt tilfælde - se fejl ovenfor.')
process.exitCode = ok ? 0 : 1
