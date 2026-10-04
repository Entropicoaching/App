// Ren regnekode for stangens hastighed pr. rep og hastighedstab pr. saet.
// Ingen DOM, ingen side-effekter; kun tal ind og tal ud, saa filen senere kan
// flyttes til loeftmodellens video/. Roerer ikke trackeren: den laeser kun den
// allerede beregnede, udglattede y-bane, tidsstempler, valid-flag og rep-vinduer.
//
// Hastighed (m/s, positiv = opad): centraldifferens over et vindue paa +-h
// frames, hvor h svarer til ca. 5-frame-vindue ved 60 fps (+-2) og 3-frame
// ved 30 fps (+-1). Et punkt med et ugyldigt (lowconf/frys-vagt) frame i
// vinduet faar ingen hastighed og indgaar ikke.
export const VC_VEL_HALF_WINDOW_S = 1 / 24
export const VC_VEL_MIN_VALID_FRACTION = 0.7
export const VC_VEL_MIN_SAMPLES = 3
export const VC_VEL_MOVING_MS = 0.05
export const VC_VEL_EDGE_FRACTION = 0.3 // udelader kant-frames hvor stangen endnu ikke/ikke laengere loeftes for alvor

function halfWindowFrames(t) {
  const dts = []
  for (let i = 1; i < t.length; i++) if (t[i] > t[i - 1]) dts.push(t[i] - t[i - 1])
  dts.sort((a, b) => a - b)
  const dt = dts.length ? dts[dts.length >> 1] : 1 / 30
  return Math.max(1, Math.round(VC_VEL_HALF_WINDOW_S / dt))
}

export function pointVelocities({ y, t, valid, cmPerPx }) {
  const n = y.length
  const h = halfWindowFrames(t)
  // udglat y: 5-frame glidende middel over gyldige punkter (som analyzeCleanPath)
  const ys = y.map((_, i) => {
    let sum = 0, c = 0
    const r = Math.min(2, i, n - 1 - i) // symmetrisk ved kanterne, saa en lineaer bane forbliver lineaer
    for (let k = i - r; k <= i + r; k++) if (valid[k]) { sum += y[k]; c++ }
    return c ? sum / c : y[i]
  })
  return y.map((_, i) => {
    if (i - h < 0 || i + h >= n) return NaN
    for (let k = i - h; k <= i + h; k++) if (!valid[k]) return NaN
    const span = t[i + h] - t[i - h]
    if (!(span > 0)) return NaN
    return (ys[i - h] - ys[i + h]) * cmPerPx / 100 / span
  })
}

// reps: [{start, end}] = koncentrisk fase (indeks). Returnerer pr. rep
// {mean, peak} i m/s eller null hvis for usikker, og lossPct for saettet.
export function repSpeeds({ y, t, valid, cmPerPx, reps }) {
  const h = halfWindowFrames(t)
  const perRep = reps.map(rep => {
    const from = Math.max(0, rep.start), to = Math.min(y.length - 1, rep.end)
    const len = to - from + 1
    if (len <= 0) return { mean: null, peak: null }
    // Udglatning og vindue holdes inde i repens koncentriske fase (ingen udtvaerning mod pausen)
    const v = pointVelocities({ y: y.slice(from, to + 1), t: t.slice(from, to + 1),
      valid: valid.slice(from, to + 1), cmPerPx })
    const vals = v.filter(Number.isFinite)
    // som appens MCV: middel over de punkter der faktisk bevaeger sig opad (> 0,05 m/s), saa stille kant-frames i vinduet ikke traekker ned
    const top = Math.max(0, ...vals)
    const moving = vals.filter(x => x > Math.max(VC_VEL_MOVING_MS, top * VC_VEL_EDGE_FRACTION))
    const inner = Math.max(1, len - 2 * h)
    if (moving.length < VC_VEL_MIN_SAMPLES || vals.length / inner < VC_VEL_MIN_VALID_FRACTION)
      return { mean: null, peak: null }
    return { mean: moving.reduce((s, x) => s + x, 0) / moving.length, peak: Math.max(...moving) }
  })
  return { reps: perRep, lossPct: setVelocityLoss(perRep.map(r => r.mean)) }
}

// (bedste rep - sidste rep) / bedste rep, i procent. Kraever mindst to reps
// med tal og at sidste rep selv har et tal; ellers null (vises som "-").
export function setVelocityLoss(means) {
  const good = means.filter(m => Number.isFinite(m) && m > 0)
  const last = means[means.length - 1]
  if (good.length < 2 || !Number.isFinite(last)) return null
  const best = Math.max(...good)
  return (best - last) / best * 100
}

// Tab pr. rep i forhold til saettets bedste rep (til tabellen).
export function repLossPct(means) {
  const good = means.filter(m => Number.isFinite(m) && m > 0)
  const best = good.length ? Math.max(...good) : NaN
  return means.map(m => Number.isFinite(m) && good.length >= 2 ? (best - m) / best * 100 : null)
}

if (typeof globalThis !== 'undefined') globalThis.vcVelocity = { pointVelocities, repSpeeds, setVelocityLoss, repLossPct }
