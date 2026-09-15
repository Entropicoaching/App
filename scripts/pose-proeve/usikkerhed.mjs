// ORDRE 218, commit 2: et ægte usikkerhedsbånd, ikke Drishtis som proxy.
//
// Port af entropi-loeftmodel/tools/videomaal/usikkerhed.py's ensemble —
// SAMME tre akser (side, nabobillede, udglatning), SAMME valg (spænd,
// max−min, ikke en standardafvigelse — usikkerhed.py's egen begrundelse,
// gentaget her: robust nok med kun 4-5 stikprøver, og samme metrik
// spredning.py/stoej.py allerede brugte per akse).
//
// ÉN forskel fra Python-udgaven, en EFFEKTIVITETSGEVINST, ikke en genvej:
// usikkerhed.py må køre MediaPipe PÅ NY for "den anden side", fordi dens
// rå landmark-fil kun gemte den VALGTE sides punkter pr. billede (se dens
// egen toptekst, afsnittet om "Side"). Denne prøves extract.mjs beholder
// ALLEREDE alle 117 billeders FULDE BlazePose-landmarks (begge sider,
// samme detektion) — den anden side her er derfor et andet indeks ind i
// data der allerede findes, ingen ny model-kørsel. Se docs/RAPPORT-218.md
// for tallet det sparer.
//
// Stangen (skiven) har ingen "side" (samme observation som Drishtis
// stoej.py: "En skive har desuden INGEN side") — dens ensemble er derfor
// KUN {center, nabo-1, nabo+1, udglattet}, fire varianter, ikke fem.
// Falder et billedes stang tilbage til håndled (ingen valideret skive, se
// skive.mjs), bruger DENNE funktion i stedet håndledets EGNE fem
// varianter (side+naboer+udglatning, samme struktur som vinklerne) —
// ærligt konsistent med hvilken kilde selve punktets `stang`-felt kom fra
// (se `stang_kilde`).

import { angleAt, signedLeanFromVertical } from './matematik.mjs'

const ANGLE_KEYS = ['ankelGrader', 'knaeGrader', 'hofteGrader', 'torsoGrader']
const STANG_KEYS = ['xFodlaengder', 'yFodlaengder']
const HOFTE_KEYS = ['hoejdeFodlaengder']
const ROUND_DECIMALS = { ankelGrader: 2, knaeGrader: 2, hofteGrader: 2, torsoGrader: 2, xFodlaengder: 4, yFodlaengder: 4, hoejdeFodlaengder: 4 }

function angleFieldValues(pts, forwardSign) {
  return {
    ankelGrader: signedLeanFromVertical(pts.ankle, pts.knee, forwardSign),
    torsoGrader: signedLeanFromVertical(pts.hip, pts.shoulder, forwardSign),
    knaeGrader: angleAt(pts.knee, pts.ankle, pts.hip),
    hofteGrader: angleAt(pts.hip, pts.knee, pts.shoulder),
  }
}

function wristFieldValues(pts, ref) {
  const [x, y] = pts.wrist
  return {
    xFodlaengder: (ref.forward_sign * (x - ref.midfoot_x_px)) / ref.foot_length_px,
    yFodlaengder: (ref.floor_y_px - y) / ref.foot_length_px,
  }
}

function hipHeightFieldValues(pts, ref) {
  return { hoejdeFodlaengder: (ref.floor_y_px - pts.hip[1]) / ref.foot_length_px }
}

function plateFieldValues(skive, ref) {
  if (!skive) return null
  return {
    xFodlaengder: (ref.forward_sign * (skive.x - ref.midfoot_x_px)) / ref.foot_length_px,
    yFodlaengder: (ref.floor_y_px - skive.y) / ref.foot_length_px,
  }
}

function average(dicts, keys) {
  const out = {}
  for (const k of keys) {
    const vals = dicts.filter(Boolean).map(d => d[k]).filter(v => v != null)
    out[k] = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null
  }
  return out
}

function spread(dicts, keys) {
  const out = {}
  for (const k of keys) {
    const vals = dicts.filter(Boolean).map(d => d[k]).filter(v => v != null)
    out[k] = vals.length >= 2 ? Math.max(...vals) - Math.min(...vals) : null
  }
  return out
}

function roundFields(obj, keys) {
  const out = {}
  for (const k of keys) {
    const v = obj[k]
    out[k] = v == null ? null : Math.round(v * 10 ** ROUND_DECIMALS[k]) / 10 ** ROUND_DECIMALS[k]
  }
  return out
}

/** Vinklernes usikkerhedsbånd for billede `idx`: spænd af {basis (valgt
 * side), anden side, billede−1 (valgt side), billede+1 (valgt side),
 * udglattet (gennemsnit af basis+naboer)} — samme ensemble som
 * usikkerhed.py's field_values()+spread_values() for ANGLE_KEYS.
 * `measuredChosen`/`measuredOther`: arrays (indekseret på billedeIndex) af
 * matematik.mjs's measureFrame()-resultater for hhv. den valgte og den
 * anden side. */
export function angleUsikkerhed(idx, measuredChosen, measuredOther, ref) {
  const basisM = measuredChosen[idx]
  if (!basisM) return roundFields({}, ANGLE_KEYS)
  const basis = angleFieldValues(basisM.points_px, ref.forward_sign)
  const otherM = measuredOther[idx]
  const otherVariant = otherM ? angleFieldValues(otherM.points_px, ref.forward_sign) : null
  const minusM = measuredChosen[idx - 1]
  const plusM = measuredChosen[idx + 1]
  const minus = minusM ? angleFieldValues(minusM.points_px, ref.forward_sign) : null
  const plus = plusM ? angleFieldValues(plusM.points_px, ref.forward_sign) : null
  const naboer = [minus, plus].filter(Boolean)
  const udglattet = naboer.length ? average([basis, ...naboer], ANGLE_KEYS) : null
  const ensemble = [basis, ...naboer]
  if (otherVariant) ensemble.push(otherVariant)
  if (udglattet) ensemble.push(udglattet)
  return roundFields(spread(ensemble, ANGLE_KEYS), ANGLE_KEYS)
}

/** ORDRE 218, commit 4: hoftehøjdens usikkerhedsbånd (frontsquat) — samme
 * fem-variant-ensemble som vinklerne (hoften HAR en side, i modsætning
 * til skiven), se usikkerhed.py's field_keys_for('frontsquat'). */
export function hoftehoejdeUsikkerhed(idx, measuredChosen, measuredOther, ref) {
  const basisM = measuredChosen[idx]
  if (!basisM) return roundFields({}, HOFTE_KEYS)
  const basis = hipHeightFieldValues(basisM.points_px, ref)
  const otherM = measuredOther[idx]
  const otherVariant = otherM ? hipHeightFieldValues(otherM.points_px, ref) : null
  const minusM = measuredChosen[idx - 1]
  const plusM = measuredChosen[idx + 1]
  const minus = minusM ? hipHeightFieldValues(minusM.points_px, ref) : null
  const plus = plusM ? hipHeightFieldValues(plusM.points_px, ref) : null
  const naboer = [minus, plus].filter(Boolean)
  const udglattet = naboer.length ? average([basis, ...naboer], HOFTE_KEYS) : null
  const ensemble = [basis, ...naboer]
  if (otherVariant) ensemble.push(otherVariant)
  if (udglattet) ensemble.push(udglattet)
  return roundFields(spread(ensemble, HOFTE_KEYS), HOFTE_KEYS)
}

/** Stangens usikkerhedsbånd for billede `idx`. `source`: 'skive' eller
 * 'haandled' — SAMME kilde `beregnKontraktPunkt()` selv brugte for dette
 * billedes `stang`-felt (se `stang_kilde`), så usikkerhedstallet er
 * internt konsistent med tallet det følger (samme princip usikkerhed.py's
 * egen toptekst nævner). `skiveByIndex`: Map billedeIndex -> plausibel
 * skive-detektion eller null (extract.mjs's egen, efter den fysiske
 * sandsynlighedsport). */
export function stangUsikkerhed(idx, source, { skiveByIndex, measuredChosen, measuredOther, ref }) {
  if (source === 'skive') {
    const center = plateFieldValues(skiveByIndex.get(idx), ref)
    const minus = plateFieldValues(skiveByIndex.get(idx - 1), ref)
    const plus = plateFieldValues(skiveByIndex.get(idx + 1), ref)
    const naboer = [minus, plus].filter(Boolean)
    const udglattet = naboer.length ? average([center, ...naboer], STANG_KEYS) : null
    const ensemble = [center, ...naboer]
    if (udglattet) ensemble.push(udglattet)
    return roundFields(spread(ensemble, STANG_KEYS), STANG_KEYS)
  }
  const basisM = measuredChosen[idx]
  if (!basisM) return roundFields({}, STANG_KEYS)
  const basis = wristFieldValues(basisM.points_px, ref)
  const otherM = measuredOther[idx]
  const otherVariant = otherM ? wristFieldValues(otherM.points_px, ref) : null
  const minusM = measuredChosen[idx - 1], plusM = measuredChosen[idx + 1]
  const minus = minusM ? wristFieldValues(minusM.points_px, ref) : null
  const plus = plusM ? wristFieldValues(plusM.points_px, ref) : null
  const naboer = [minus, plus].filter(Boolean)
  const udglattet = naboer.length ? average([basis, ...naboer], STANG_KEYS) : null
  const ensemble = [basis, ...naboer]
  if (otherVariant) ensemble.push(otherVariant)
  if (udglattet) ensemble.push(udglattet)
  return roundFields(spread(ensemble, STANG_KEYS), STANG_KEYS)
}
