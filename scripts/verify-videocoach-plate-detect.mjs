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
// ORDRE 120 · commit 1: en atlet kunne ikke få en MØRK skive genkendt -
// samme mekanisme som "mørk skive på mørk baggrund" ovenfor, men prøvebænken
// havde kun ét mørkt tilfælde. Seks flere, valgt fra Marcs egen liste i
// ORDRE 120: mørkegrå baggrund, sort gulv med lys nav (Marcs eget klip har
// præcis dette - sølv-muffe midt i en sort skive), farvet skive (grøn/blå
// kalibreret vægt) hvor luminans er blind men farvetone ikke er, lys
// ring-tekst som distraherer en enkelt-bedste-kant-strategi, blankt
// top-refleks, og til sidst ét RIGTIGT frame fra Marcs eget testklip (se
// `realFrameCondition` nedenfor) - ingen af de seks er opfundet til at
// "vinde": tallene i RAPPORT-120.md er hvad de faktisk gav, før og efter.
//
// Kørsel: npm run verify:videocoach-plate-detect

import { readFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ffmpegPath from 'ffmpeg-static'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const htmlPath = join(root, 'public', 'videocoach.html')
const html = readFileSync(htmlPath, 'utf8')
const testClipsDir = join(root, 'test-clips')
const cacheDir = join(root, 'docs', 'videocoach', 'clip-cache')

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
// ORDRE 120 · commit 1: samme som fillCircle, men med tre uafhængige
// kanaler - nødvendig for "farve, ikke luminans"-tilfældet (skive-11).
function fillCircleRGB(buf, W, H, cx, cy, r, rv, gv, bv) {
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r))
  const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r))
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) {
        const i = (y * W + x) * 4
        buf[i] = rv; buf[i + 1] = gv; buf[i + 2] = bv
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

// ---------- ægte frame fra Marcs eget testklip ----------
// ORDRE 120: "brug et klip med en mørk skive hvis der findes et i test-clips
// (ellers skriv at der mangler et og bed Marc om ét)". test-clips\ er
// git-ignoreret (Marcs egne optagelser, se .gitignore) - denne funktion
// finder klippet ved kørsel, ligesom scripts/verify-videocoach-clip.mjs.
// Skivens centrum/radius/udsnit er MÅLT I HÅNDEN (beskåret skærmbillede +
// gitter, se docs/videocoach/RAPPORT-120.md) for netop dette klip - IKKE en
// uafhængig facit, ligesom det virkelige klip i verify-videocoach-clip.mjs
// heller ikke har én. W/H er den DEKODEDE (roterede) opløsning ffmpeg
// leverer for denne optagelse (iPhone gemmer den liggende med et
// rotations-flag; ffmpeg retter det ved dekodning) - IKKE containerens rå
// stream-opløsning, som derfor ikke kan probes automatisk her.
const KNOWN_CLIPS = {
  'marc-doedloeft-270.mov': { frame: 30, W: 1440, H: 1920, cx: 700, cy: 1230, r: 198,
    note: 'sort/rød skive mod mørkegråt gulv-gummi, sølv-muffe synlig gennem midterhullet - dødløft, ca. 1s inde i klippet' },
}

function realFrameCondition() {
  if (!existsSync(testClipsDir) || !readdirSync(testClipsDir).some(f => /\.(mp4|mov)$/i.test(f))) {
    console.log('BEMÆRK: intet klip i test-clips\\ - mangler et med en mørk skive. Bed Marc om ét (se "Hvad er næste" i RAPPORT-120.md).\n')
    return null
  }
  const clipName = readdirSync(testClipsDir).filter(f => /\.(mp4|mov)$/i.test(f)).sort()[0]
  const known = KNOWN_CLIPS[clipName]
  if (!known) {
    console.log(`BEMÆRK: klip fundet (${clipName}), men skivens position er ikke målt for dette klip endnu - springer det ægte-frame-tilfælde over. Tilføj det til KNOWN_CLIPS i denne fil, eller læg marc-doedloeft-270.mov tilbage i test-clips\\.\n`)
    return null
  }
  mkdirSync(cacheDir, { recursive: true })
  const rawPath = join(cacheDir, `plate-detect-${clipName.replace(/\.(mp4|mov)$/i, '')}.rgba`)
  const res = spawnSync(ffmpegPath, ['-y', '-i', join(testClipsDir, clipName),
    '-vf', `select=eq(n\\,${known.frame})`, '-vframes', '1', '-pix_fmt', 'rgba', '-f', 'rawvideo', rawPath],
    { stdio: 'ignore' })
  if (res.status !== 0 || !existsSync(rawPath)) {
    console.log(`BEMÆRK: ffmpeg kunne ikke hente frame ${known.frame} af ${clipName} - springer det ægte-frame-tilfælde over.\n`)
    return null
  }
  const raw = readFileSync(rawPath)
  if (raw.length !== known.W * known.H * 4) {
    console.log(`BEMÆRK: ${clipName} gav en uventet bufferstørrelse (${raw.length} ≠ ${known.W * known.H * 4} - er klippet ombyttet eller ffmpeg-versionen anderledes?) - springer det ægte-frame-tilfælde over.\n`)
    return null
  }
  const buf = new Uint8ClampedArray(raw.buffer, raw.byteOffset, raw.byteLength)
  return { name: `ægte frame (${clipName}, frame ${known.frame}) - ${known.note}`,
    W: known.W, H: known.H, cx: known.cx, cy: known.cy, r: known.r, buf,
    expect: 'ikke fundet ELLER fundet men forkert (før) - skivens position er MÅLT i hånden, ikke en uafhængig facit',
    why: 'ægte gym-lys, video-kompressionsstøj og en skæv kameravinkel - det virkelige tilfælde alle de syntetiske tilfælde ovenfor prøver at efterligne.' }
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

// 9) Sort skive på mørkegrå baggrund (mørkere/gråere variant end skive-5 -
// "sort/mørkegrå" er Marcs eget ordvalg i ORDRE 120, ikke identisk med den
// eksisterende gulv-45/skive-26).
{
  const W = 720, H = 1280, cx = 360, cy = 640, r = 130
  const buf = makeBuffer(W, H, 65); fillCircle(buf, W, H, cx, cy, r, 42)
  conditions.push({ name: 'sort skive på mørkegrå baggrund (diff 23)', W, H, cx, cy, r, buf,
    expect: 'ikke fundet (før), fundet (efter)', why: 'spring 23 < grænsen (28) på gråtone alene - samme mekanisme som skive-5, anden gråtone-kombination.' })
}

// 10) Sort skive på sort gulv MED en lys nav/muffe midt i skiven - Marcs
// eget klip (betingelse 15 nedenfor) har præcis denne kombination (sølvfarvet
// stangmuffe gennem midterhullet). Faren: en lyskraftig lille cirkel nær
// centrum kan "vinde" som den stærkeste kant på alle 16 stråler, længe før
// skivens egen (svage) yderkant nås.
{
  const W = 720, H = 1280, cx = 360, cy = 640, r = 125
  const buf = makeBuffer(W, H, 24); fillCircle(buf, W, H, cx, cy, r, 15)
  fillCircle(buf, W, H, cx, cy, 15, 190)   // lys nav, radius 15 - langt under skivens 125
  conditions.push({ name: 'sort skive på sort gulv med lys nav (diff 9, nav-radius 15)', W, H, cx, cy, r, buf,
    expect: 'fundet, men FORKERT (før OG efter) - kendt grænse, se "Ærlige grænser"', why: 'navets kant er en ÆGTE, fuldt konsistent cirkel (ring-scoren for nav-radius 15 er reelt højere end skivens egen svage rand ved r=125) - ring-scoring kan ikke skelne "den stærkeste cirkel" fra "den plade coachen mente". Uændret af ORDRE 120s fix; ring-bekræftelsen i UI\'en er sikkerhedsnettet.' })
}

// 11) Mørkegrøn/mørkeblå kalibreret skive (20/25 kg) på mørk baggrund -
// FARVE adskiller skive fra baggrund, LUMINANS gør stort set ikke (diff ~3).
// Ren gråtone-kant-søgning er blind for denne; farve-afstand er ikke.
{
  const W = 720, H = 1280, cx = 360, cy = 640, r = 130
  const buf = makeBuffer(W, H, 55)   // neutral gråbaggrund, R=G=B=55 (lum 55)
  fillCircleRGB(buf, W, H, cx, cy, r, 40, 40, 149)   // mørkeblå (kalibreret 25 kg-farve), lum ≈ 52
  conditions.push({ name: 'mørkeblå kalibreret skive (25 kg) på mørk baggrund (lum-diff ~3, farve-afstand ~96)', W, H, cx, cy, r, buf,
    expect: 'ikke fundet (før) - luminans alene ser næsten intet', why: 'lum(baggrund)=55, lum(skive)≈52 - under enhver rimelig gråtone-grænse. Farve-afstanden (blåt kanal-spring) er derimod stor.' })
}

// 12) Mørk skive med lys ring-tekst (indpræget/malet skrift, som "ZTTEX"/
// "20 KG" på en rigtig skive) - lyse bogstav-klatter et stykke INDE i
// skiven (ikke ved selve yderkanten), som kan narre en enkelt-bedste-kant-
// strategi til at låse på en for LILLE radius på de par stråler der rammer
// et bogstav, mens skivens egen (svage) yderkant er den eneste ægte cirkel.
{
  const W = 720, H = 1280, cx = 360, cy = 640, r = 130
  const buf = makeBuffer(W, H, 50); fillCircle(buf, W, H, cx, cy, r, 30)   // skivens kant: spring 20
  fillRect(buf, W, H, cx - 10, cy - 95, 20, 14, 210)   // "bogstav" kl. 12, radius ~90
  fillRect(buf, W, H, cx + 60, cy - 70, 16, 14, 210)   // "bogstav" kl. 1-2, radius ~90
  conditions.push({ name: 'mørk skive med lys ring-tekst (skivekant spring 20, to bogstav-klatter ved r≈90)', W, H, cx, cy, r, buf,
    expect: 'ikke fundet (før), fundet ved YDERKANTEN (efter) - ikke ved bogstaverne', why: 'to stråler ser en stærk, men FORKERT, kant ved bogstaverne (r≈90); resten ser kun skivens svage yderkant (r=130, spring 20). Ring-scoring skal foretrække den kant der er konsistent hele vejen rundt.' })
}

// 13) Mørk skive under stærkt top-lys - et blankt refleks-parti et stykke
// inde i skiven (ikke ved kanten), bredere end enkelt-bogstaverne i
// betingelse 12 (rammer 2-3 af de 16 stråler, som et rigtigt refleks ville).
{
  const W = 720, H = 1280, cx = 360, cy = 640, r = 130
  const buf = makeBuffer(W, H, 48); fillCircle(buf, W, H, cx, cy, r, 28)   // skivens kant: spring 20
  fillCircle(buf, W, H, cx - 15, cy - 75, 30, 225)   // refleks-plet, centrum ~r=77 fra midte, radius 30
  conditions.push({ name: 'mørk skive under top-lys (blankt refleks midt i skiven, ikke ved kanten)', W, H, cx, cy, r, buf,
    expect: 'ikke fundet (før), fundet ved YDERKANTEN (efter)', why: 'refleksets kant er stærkere end skivens egen, men rammer kun 2-3 af 32 ring-punkter - dækningskravet (≥14/32 punkter skal vise en kant) forkaster refleksen som kandidat, så kun skivens egen (svage, men SAMMENHÆNGENDE) rand er tilbage.' })
}

// 14) Rigtig frame fra Marcs eget testklip (test-clips\) - se realFrameCondition.
// Findes intet klip, eller intet klip med kendt skive-position, skrives en
// tydelig besked i stedet for at fejle bænken (ORDRE 120: "ellers skriv at
// der mangler et og bed Marc om ét").
const realCondition = realFrameCondition()
if (realCondition) conditions.push(realCondition)

// ---------- kør og rapportér ----------
const rows = conditions.map(c => {
  const foundR = runAutoCalib(c.W, c.H, { x: c.cx, y: c.cy }, c.buf)
  const found = foundR != null
  const errPx = found ? Math.abs(foundR - c.r) : null
  return { navn: c.name, forventet: c.expect, fundet: found ? 'ja' : 'nej',
    radiusFejlPx: errPx == null ? '-' : errPx.toFixed(1), why: c.why }
})

console.log(`== ORDRE 109/120: autoCalib mod ${rows.length} betingelser (${rows.length - (realCondition ? 1 : 0)} syntetiske${realCondition ? ' + 1 ægte frame' : ''}) ==\n`)
const nameW = Math.max(...rows.map(r => r.navn.length)) + 2
console.log(`${'Betingelse'.padEnd(nameW)}${'Fundet'.padEnd(8)}${'Radius-fejl (px)'.padEnd(18)}Forventning`)
for (const r of rows)
  console.log(`${r.navn.padEnd(nameW)}${r.fundet.padEnd(8)}${String(r.radiusFejlPx).padEnd(18)}${r.forventet}`)
console.log()
for (const r of rows) console.log(`- ${r.navn}: ${r.why}`)

// ---------- selv-tjek: ORDRE 120s facit for de éntydige tilfælde ----------
// To grupper der stadig IKKE er en hård påstand: nav-tilfældet (kendt,
// uændret grænse - se dens "why") og det ægte klip (ingen uafhængig facit).
// De fejler ikke rent, det er derfor ring-bekræftelsen i UI'en (plateConfirm)
// er sikkerhedsnettet, ikke autoCalib selv.
const mustFailSafely = [
  'radius uden for forventet interval (skive > maxR)',
  'lille video (160×120, skive-radius 8px)',
]
// ORDRE 120s egen grænse: baseline og delvist-ude-af-billede skal stadig
// være ≤2px. De øvrige er NYE fund efter fixet - løsere grænse (de var slet
// ikke fundet før, så enhver fornuftig radius er en forbedring), men stadig
// hårdt tjekket for ikke at drifte umærket.
const mustFind = [
  { navn: 'baseline (god kontrast, fri bane)', maxErrPx: 2 },
  { navn: 'skive delvist ude af billedet (klippet af højrekant)', maxErrPx: 2 },
  { navn: 'kontrast (lys skive på lys baggrund, diff 22)', maxErrPx: 5 },
  { navn: 'mørk skive på mørk baggrund (diff 19)', maxErrPx: 5 },
  { navn: 'sort skive på mørkegrå baggrund (diff 23)', maxErrPx: 5 },
  { navn: 'mørkeblå kalibreret skive (25 kg) på mørk baggrund (lum-diff ~3, farve-afstand ~96)', maxErrPx: 5 },
  { navn: 'mørk skive med lys ring-tekst (skivekant spring 20, to bogstav-klatter ved r≈90)', maxErrPx: 5 },
  { navn: 'kant mod rack (stolper + bjælke på 3 af 4 sider)', maxErrPx: 5 },
  { navn: 'telefon i portrait med sort bjælke (over+under)', maxErrPx: 5 },
  { navn: 'mørk skive under top-lys (blankt refleks midt i skiven, ikke ved kanten)', maxErrPx: 5 },
]
let ok = true
for (const r of rows) {
  if (mustFailSafely.includes(r.navn) && r.fundet !== 'nej') {
    console.error(`FEJL: "${r.navn}" burde fejle sikkert (returnere null), men fandt en radius.`)
    ok = false
  }
  const mf = mustFind.find(m => m.navn === r.navn)
  if (mf) {
    if (r.fundet !== 'ja') { console.error(`FEJL: "${r.navn}" burde finde skiven, men gjorde ikke.`); ok = false }
    else if (Number(r.radiusFejlPx) > mf.maxErrPx) {
      console.error(`FEJL: "${r.navn}" fandt en radius, men fejlen (${r.radiusFejlPx}px) overstiger grænsen (${mf.maxErrPx}px).`)
      ok = false
    }
  }
}
console.log(ok
  ? '\nGRØN: autoCalib opfører sig som dokumenteret i docs/videocoach/SKIVEN-FINDES-IKKE.md og RAPPORT-120.md.'
  : '\nRØD: autoCalib har ændret opførsel på et éntydigt tilfælde - se fejl ovenfor.')
process.exitCode = ok ? 0 : 1
