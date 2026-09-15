// ORDRE 218, commit 1: stangen fra skiven, ikke håndleddet.
//
// "Stå på skuldre" (ordrens egen instruks, prioriteret rækkefølge):
// 1) genbrug appens EGEN skivetracker, 2) kun hvis den ikke kan bruges
// løsrevet, OpenCV.js HoughCircles som Drishtis stoej.py gør.
//
// Vurdering: public/videocoach.html's skivetracker ("WHOLE-PLATE POWERLIFT
// TRACKER" + "SKIVE-RECENTRERING v2"/recenterOnPlate()) er en LIVE,
// klik-seedet, kontinuert tracker — coachen klikker skiven ÉN gang, og
// resten er frame-til-frame-kontinuitet (emaBest/patchVar/lost-gensøgning).
// Selve invarianterne er eksplicit "fredet"
// (docs/videocoach/HANDOVER-VIDEOCOACH.md, "BAR-TRACKER FREDNING": "bryd dem
// ALDRIG uden rig-bevis foerst", og recenterOnPlate()s egen kommentar:
// "Cirkel-scan-reloker ... er MODBEVIST - genopfind dem ikke", om at fodre
// scanningen tilbage ind i den KØRENDE matcher). Denne prøve har hverken et
// klik eller kontinuitet mellem billeder (seek-pr-billede, ét ad gangen,
// samme begrundelse som extract.mjs's egen). Den fulde tracker kan derfor
// IKKE genbruges løsrevet — præcis den situation ordren selv navngiver.
//
// Hvad der ER genbrugt, bogstaveligt: recenterOnPlate()s radiale kant-scan
// (16 stråler, forventet-radius-bånd ±18%, valideret på enighed mellem
// strålepar) — se edgeScan() nedenfor, linje for linje samme matematik,
// kun DOM-uafhængig (en getGray(x,y)-accessor i stedet for det globale
// ocan/octx, og returnerer et ABSOLUT centrum+radius i stedet for
// recenterOnPlate()s dx/dy-korrektion til en allerede kørende tracker —
// her ER scanningen selve detektionen, ikke en korrektion af én).
//
// Hvad der ER NYT: findPlate()s grove gittersøgning, fordi edgeScan() kun
// validerer når startpunktet allerede er inden for ~25% af den forventede
// radius fra det sande centrum — noget den levende tracker får gratis af
// kontinuitet/klik, som denne prøve ikke har. Søgningen bruger håndleddet
// (samme "stå på skuldre"-proxy ordre 188 allerede bruger til vinklerne)
// som centrum for et vindue, og prøver et gitter af centre × radier,
// scoret med edgeScan()s egen npair/spread — ingen ny kant-matematik, kun
// gentagne kald til den genbrugte scanning, samme rolle som OpenCVs
// HoughCircles-akkumulator ville spille. Radius-intervallet er Drishtis
// EGET, dokumenterede, per-klip interval for netop dette klip
// (tools/videomaal/stoej.py's kildekode/kommentar: "dette klips egne, ikke
// en generel konstant") — IKKE hendes facit-tal, kun hendes tunede
// søgeparameter, samme slags "stå på skuldre"-genbrug som FRAME_START/
// FRAME_LOCKOUT i matematik.mjs.

/** Literal port af public/videocoach.html's recenterOnPlate(). Returnerer
 * {x, y, r, npair, spread} (absolut centrum) eller null hvis scanningen
 * ikke kan validere enighed mellem mindst 6 af de 8 strålepar. */
export function edgeScan(getGray, seed, rExp) {
  if (rExp < 14) return null
  const edges = []
  for (let a = 0; a < 16; a++) {
    const dx = Math.cos(a * Math.PI / 8), dy = Math.sin(a * Math.PI / 8)
    let prev = getGray(seed.x + dx * rExp * .78, seed.y + dy * rExp * .78)
    let bestR = 0, bestJ = 0
    for (let r = rExp * .82; r <= rExp * 1.18; r += 2) {
      const v = getGray(seed.x + dx * r, seed.y + dy * r)
      const j = Math.abs(v - prev)
      if (j > bestJ) { bestJ = j; bestR = r }
      prev = v
    }
    edges.push(bestJ > 26 ? bestR : null)
  }
  let sx = 0, sy = 0, npair = 0
  const radii = []
  for (let a = 0; a < 8; a++) {
    const r1 = edges[a], r2 = edges[a + 8]
    if (r1 == null || r2 == null) continue
    const off = (r1 - r2) / 2
    sx += off * Math.cos(a * Math.PI / 8)
    sy += off * Math.sin(a * Math.PI / 8)
    radii.push((r1 + r2) / 2)
    npair++
  }
  if (npair < 6) return null
  const mR = radii.reduce((s, r) => s + r, 0) / npair
  const spread = Math.sqrt(radii.reduce((s, r) => s + (r - mR) ** 2, 0) / npair)
  if (spread > rExp * 0.055) return null
  if (Math.abs(mR - rExp) > rExp * 0.15) return null
  const cx = 2 * sx / npair, cy = 2 * sy / npair
  if (Math.hypot(cx, cy) > rExp * 0.25) return null
  return { x: seed.x + cx, y: seed.y + cy, r: mR, npair, spread }
}

const DEFAULT_RADII = [170, 185, 200, 215, 230] // Drishtis stoej.py, --min-radius/--max-radius standard for marc-doedloeft-270

/** Grov gittersøgning om `seedWrist` (håndleddet), derefter én
 * fin-forfining med edgeScan() på det fundne centrum/radius — samme
 * to-trins idé recenterOnPlate() selv bruger til at følge en roterende
 * skive, blot uden kontinuiteten fra forrige billede. */
export function findPlate(getGray, seedWrist, opts = {}) {
  const radii = opts.radii || DEFAULT_RADII
  const windowPx = opts.windowPx ?? 220
  const coarseStepPx = opts.coarseStepPx ?? 44
  const fineStepPx = opts.fineStepPx ?? 11

  function bestInWindow(cx, cy, stepPx) {
    let best = null
    for (let dy = -windowPx; dy <= windowPx; dy += stepPx) {
      for (let dx = -windowPx; dx <= windowPx; dx += stepPx) {
        const seed = { x: cx + dx, y: cy + dy }
        for (const rExp of radii) {
          const res = edgeScan(getGray, seed, rExp)
          if (!res) continue
          if (!best || res.npair > best.npair || (res.npair === best.npair && res.spread < best.spread)) best = res
        }
      }
    }
    return best
  }

  const coarse = bestInWindow(seedWrist.x, seedWrist.y, coarseStepPx)
  if (!coarse) return null
  const fineWindow = Math.max(coarseStepPx, 30)
  let best = coarse
  for (let dy = -fineWindow; dy <= fineWindow; dy += fineStepPx) {
    for (let dx = -fineWindow; dx <= fineWindow; dx += fineStepPx) {
      const seed = { x: coarse.x + dx, y: coarse.y + dy }
      const res = edgeScan(getGray, seed, coarse.r)
      if (!res) continue
      if (res.npair > best.npair || (res.npair === best.npair && res.spread < best.spread)) best = res
    }
  }
  return best
}

/** "Kontinuitetsregel" fra videocoach.html's egen tracker-invariant #2
 * (docs/videocoach/HANDOVER-VIDEOCOACH.md, "BAR-TRACKER FREDNING": "spring
 * > R*0.6 -> gensoeg naert - ingen coast") — genbrugt her som en
 * gensøgning TÆT på forrige billedes VALIDEREDE skive, ikke som live
 * feedback ind i en kørende matcher (det er PRÆCIS den brug
 * recenterOnPlate()s egen kommentar siger er modbevist/destabiliserende —
 * denne prøve har ingen kørende matcher at destabilisere, kun uafhængige
 * per-billede-detektioner der her får lov at bruge NABOENS resultat som et
 * ekstra, snævert søgested). "Ingen coast": finder gensøgningen intet, er
 * svaret null — billedet falder tilbage til håndled, det gættes ikke. */
export function searchNear(getGray, priorCenter, priorR, { windowPx = 40, stepPx = 8 } = {}) {
  let best = null
  for (let dy = -windowPx; dy <= windowPx; dy += stepPx) {
    for (let dx = -windowPx; dx <= windowPx; dx += stepPx) {
      const seed = { x: priorCenter.x + dx, y: priorCenter.y + dy }
      const res = edgeScan(getGray, seed, priorR)
      if (!res) continue
      if (!best || res.npair > best.npair || (res.npair === best.npair && res.spread < best.spread)) best = res
    }
  }
  return best
}
