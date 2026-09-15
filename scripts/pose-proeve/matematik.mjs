// ORDRE 188: JS-oversættelse af entropi-loeftmodel-wt2/tools/videomaal/maal.py
// + bane.py's matematik — ÉN TIL ÉN, ikke "som jeg selv ville" (ordrens egen
// instruks). Landmark-indekser, sidevalg, vinkelformler og den robuste
// gulv-/midtfod-/skala-reference er kopieret herfra, kun sprogoversat.
// Kilde-filer (læs dem for begrundelsen bag hvert valg):
//   entropi-loeftmodel-wt2/tools/videomaal/maal.py  (angle_at, lean_from_vertical,
//     pick_side, measure_frame, LM/SIDE_INDEX)
//   entropi-loeftmodel-wt2/tools/videomaal/bane.py  (signed_lean_from_vertical,
//     robust_floor_reference, statistics_median, FRAME_START/FRAME_LOCKOUT)
//
// BEVIDST IKKE kopieret: tools/videomaal/stoej.py's Hough-cirkel-pladeaflæsning
// for `stang` (erstatter håndledstilnærmelsen i den NUVÆRENDE facit-fil).
// Ordre 188 peger kun på bane.py, ikke stoej.py, som "stå på skuldre"-kilden —
// se docs/RAPPORT-188.md for hvorfor det er et bevidst, noteret valg, ikke en
// forglemmelse, og hvad det betyder for `stang`-sammenligningen i commit 2.

// BlazePose/MediaPipe Pose's 33 punkter — samme delmængde som maal.py's LM.
export const LM = Object.freeze({
  nose: [0, 0],
  shoulder: [11, 12],
  elbow: [13, 14],
  wrist: [15, 16],
  hip: [23, 24],
  knee: [25, 26],
  ankle: [27, 28],
  heel: [29, 30],
  foot_index: [31, 32],
})
export const SIDE_INDEX = Object.freeze({ left: 0, right: 1 })
export const FRAME_START = 21 // "stangen forlader gulvet" — samme billede som Drishtis bane.py
export const FRAME_LOCKOUT = 48

/** Indvendig vinkel (grader) ved `joint` mellem stråler til a og b. 180° = strakt. */
export function angleAt(joint, a, b) {
  const v1 = [a[0] - joint[0], a[1] - joint[1]]
  const v2 = [b[0] - joint[0], b[1] - joint[1]]
  const n1 = Math.hypot(v1[0], v1[1])
  const n2 = Math.hypot(v2[0], v2[1])
  if (n1 < 1e-9 || n2 < 1e-9) return null
  const cosA = Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / (n1 * n2)))
  return Math.acos(cosA) * 180 / Math.PI
}

/** Som bane.py's signed_lean_from_vertical: positiv når segmentet peger
 * mod tæerne (forwardSign-retningen), negativ ellers. */
export function signedLeanFromVertical(pFrom, pTo, forwardSign) {
  const dx = (pTo[0] - pFrom[0]) * forwardSign
  const dy = pTo[1] - pFrom[1]
  if (dx === 0 && dy === 0) return null
  return Math.atan2(dx, Math.abs(dy)) * 180 / Math.PI
}

export function px(landmark, w, h) {
  return [landmark.x * w, landmark.y * h]
}

/** Samme sidevalg som maal.py's pick_side: den side (venstre/højre) der i
 * gennemsnit har højst visibility på de brugte punkter, over alle billeder. */
export function pickSide(allFrames) {
  const sums = { left: 0, right: 0 }
  const counts = { left: 0, right: 0 }
  const keys = ['shoulder', 'hip', 'knee', 'ankle', 'heel', 'foot_index', 'wrist']
  for (const frame of allFrames) {
    if (!frame) continue
    for (const side of ['left', 'right']) {
      const idx = SIDE_INDEX[side]
      for (const key of keys) {
        const lm = frame[LM[key][idx]]
        sums[side] += lm.visibility
        counts[side] += 1
      }
    }
  }
  const avg = { left: counts.left ? sums.left / counts.left : 0, right: counts.right ? sums.right / counts.right : 0 }
  const chosen = avg.right >= avg.left ? 'right' : 'left'
  return { chosen, avg }
}

/** Som maal.py's measure_frame: udtrækker de brugte punkter (i pixler) +
 * visibility for DEN VALGTE side, for ét billede. null hvis ingen krop fundet. */
export function measureFrame(frameLandmarks, side, w, h) {
  if (!frameLandmarks) return null
  const i = SIDE_INDEX[side]
  const shoulder = px(frameLandmarks[LM.shoulder[i]], w, h)
  const hip = px(frameLandmarks[LM.hip[i]], w, h)
  const knee = px(frameLandmarks[LM.knee[i]], w, h)
  const ankle = px(frameLandmarks[LM.ankle[i]], w, h)
  const heel = px(frameLandmarks[LM.heel[i]], w, h)
  const footIndex = px(frameLandmarks[LM.foot_index[i]], w, h)
  const wrist = px(frameLandmarks[LM.wrist[i]], w, h)
  return {
    points_px: { shoulder, hip, knee, ankle, heel, foot_index: footIndex, wrist },
    visibility: {
      shoulder: frameLandmarks[LM.shoulder[i]].visibility,
      hip: frameLandmarks[LM.hip[i]].visibility,
      knee: frameLandmarks[LM.knee[i]].visibility,
      ankle: frameLandmarks[LM.ankle[i]].visibility,
      heel: frameLandmarks[LM.heel[i]].visibility,
      foot_index: frameLandmarks[LM.foot_index[i]].visibility,
      wrist: frameLandmarks[LM.wrist[i]].visibility,
    },
  }
}

export function statisticsMedian(values) {
  const s = [...values].sort((a, b) => a - b)
  const n = s.length
  const mid = Math.floor(n / 2)
  return n % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

const VISIBILITY_MIN_FOR_REFERENCE = 0.8

/** Som bane.py's robust_floor_reference: gulvets pixel-y, midtfodens
 * pixel-x, fodlængden i pixler og fortegnet, som medianen af hæl-/
 * tåpunktet hen over alle billeder hvor BEGGE punkters visibility er >= 0.8. */
export function robustFloorReference(measuredFrames) {
  const heelXs = [], heelYs = [], footXs = [], footYs = []
  for (const f of measuredFrames) {
    if (!f) continue
    const vis = f.visibility
    if (vis.heel < VISIBILITY_MIN_FOR_REFERENCE || vis.foot_index < VISIBILITY_MIN_FOR_REFERENCE) continue
    const [hx, hy] = f.points_px.heel
    const [fx, fy] = f.points_px.foot_index
    heelXs.push(hx); heelYs.push(hy); footXs.push(fx); footYs.push(fy)
  }
  if (heelYs.length < 3) {
    throw new Error(`For få pålidelige fodbilleder (${heelYs.length}) til en robust gulvreference.`)
  }
  const heelX = statisticsMedian(heelXs), heelY = statisticsMedian(heelYs)
  const footX = statisticsMedian(footXs), footY = statisticsMedian(footYs)
  const floorY = (heelY + footY) / 2
  const midfootX = (heelX + footX) / 2
  const footLengthPx = Math.hypot(footX - heelX, footY - heelY)
  const forwardSign = (footX - heelX) >= 0 ? 1 : -1
  return {
    floor_y_px: floorY, midfoot_x_px: midfootX, foot_length_px: footLengthPx,
    forward_sign: forwardSign, n_billeder_brugt: heelYs.length,
    heel_px_median: [heelX, heelY], foot_index_px_median: [footX, footY],
  }
}

/** Ét kontrakt-punkt (bane.py's hovedløkke, ét billede) — vinkler + stang,
 * i formatet docs/MAALING-KONTRAKT.md beskriver (uden `usikkerhed`, se filens
 * egen toptekst for hvorfor).
 *
 * ORDRE 218, commit 1: `plate` (skive.mjs's findPlate()-resultat for dette
 * billede, {x,y,r,npair,spread} i samme pixel-koordinater som `pts`) bruges
 * for stangens position når den findes — håndleddet (`pts.wrist`) er nu
 * kun FALLBACK for de billeder hvor ingen skive kunne valideres, ikke
 * standardmetoden. `stang_kilde` siger hvilken der blev brugt, pr. punkt. */
export function beregnKontraktPunkt(idx, tidspunktMs, measured, ref, plate = null) {
  const { floor_y_px: floorY, midfoot_x_px: midfootXRef, foot_length_px: footLen, forward_sign: forwardSign } = ref
  const pts = measured.points_px
  const ankelGrader = signedLeanFromVertical(pts.ankle, pts.knee, forwardSign)
  const torsoGrader = signedLeanFromVertical(pts.hip, pts.shoulder, forwardSign)
  const knaeGrader = angleAt(pts.knee, pts.ankle, pts.hip)
  const hofteGrader = angleAt(pts.hip, pts.knee, pts.shoulder)
  const [barX, barY] = plate ? [plate.x, plate.y] : pts.wrist
  const xFodlaengder = (forwardSign * (barX - midfootXRef)) / footLen
  const yFodlaengder = (floorY - barY) / footLen
  const round = (v, d) => (v === null || v === undefined ? null : Math.round(v * 10 ** d) / 10 ** d)
  return {
    øvelse: 'doedloeft',
    billedeIndex: idx,
    tidspunktMs: round(tidspunktMs, 1),
    vinkler: {
      ankelGrader: round(ankelGrader, 2),
      knaeGrader: round(knaeGrader, 2),
      hofteGrader: round(hofteGrader, 2),
      torsoGrader: round(torsoGrader, 2),
    },
    stang: {
      xFodlaengder: round(xFodlaengder, 4),
      yFodlaengder: round(yFodlaengder, 4),
    },
    stang_kilde: plate
      ? `skive (findPlate/edgeScan, npair=${plate.npair}, radius=${Math.round(plate.r)}px) — se scripts/pose-proeve/skive.mjs`
      : 'haandled (fallback — ingen skive valideret for dette billede)',
  }
}

/** ORDRE 218, commit 4: frontsquattens kontrakt-punkt — samme fire vinkler
 * som beregnKontraktPunkt(), men `hofte.hoejdeFodlaengder` i stedet for et
 * `stang`-felt (INTET stang-felt her — samme begrundelse som
 * squat_bane.py's egen toptekst: frontsquattens stangposition kan ikke
 * udtrykkes af modellen, det er ikke en forglemmelse). Ingen skive
 * involveret. */
export function beregnKontraktPunktSquat(idx, tidspunktMs, measured, ref) {
  const { floor_y_px: floorY, foot_length_px: footLen, forward_sign: forwardSign } = ref
  const pts = measured.points_px
  const ankelGrader = signedLeanFromVertical(pts.ankle, pts.knee, forwardSign)
  const torsoGrader = signedLeanFromVertical(pts.hip, pts.shoulder, forwardSign)
  const knaeGrader = angleAt(pts.knee, pts.ankle, pts.hip)
  const hofteGrader = angleAt(pts.hip, pts.knee, pts.shoulder)
  const hipY = pts.hip[1]
  const hoejdeFodlaengder = (floorY - hipY) / footLen
  const round = (v, d) => (v === null || v === undefined ? null : Math.round(v * 10 ** d) / 10 ** d)
  return {
    øvelse: 'frontsquat',
    billedeIndex: idx,
    tidspunktMs: round(tidspunktMs, 1),
    vinkler: {
      ankelGrader: round(ankelGrader, 2),
      knaeGrader: round(knaeGrader, 2),
      hofteGrader: round(hofteGrader, 2),
      torsoGrader: round(torsoGrader, 2),
    },
    hofte: {
      hoejdeFodlaengder: round(hoejdeFodlaengder, 4),
    },
  }
}
