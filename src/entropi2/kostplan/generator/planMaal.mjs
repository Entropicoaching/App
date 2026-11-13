// Ordre 1169: justerer portionerne på én plandag, så kcal og protein ligger inden for 5 % af målet.
// Kun portioner flyttes, aldrig varer. Grænsen pr. vare er det mindste/største af katalogets og planens
// egen portion (samme regel som realismeprøven med kilde coach, ordre 1159). Rene funktioner, kun syntetiske data i prøver.
export const BAAND = 0.025

// poster: [{ grams, kcal100, protein100, min, max }]. Returnerer nye gram (heltal, rundet til 5 g fra 50 g).
// trin: valgfri afrunding i gram (generatoren bruger 5); uden trin rundes til 5 g fra 50 g som i 1169.
export function juster(poster, { kcal, protein }, baand = BAAND, trin = 0) {
  const g0 = poster.map(p => p.grams)
  const cur = (key, g) => poster.reduce((s, p, i) => s + p[key] * g[i] / 100, 0)
  const klem = (nu, maal) => Math.min(maal * (1 + baand), Math.max(maal * (1 - baand), nu))
  const maalK = klem(cur('kcal100', g0), kcal), maalP = klem(cur('protein100', g0), protein)
  const lo = poster.map(p => Math.min(p.min, p.grams)), hi = poster.map(p => Math.max(p.max, p.grams))
  let g = [...g0]
  const fri = new Set(g0.keys())
  for (let runde = 0; runde < 20; runde++) {
    const dK = maalK - cur('kcal100', g), dP = maalP - cur('protein100', g)
    if (Math.abs(dK) < 1 && Math.abs(dP) < 0.2) break
    const idx = [...fri]
    // x_i = a_i*l1 + b_i*l2 (mindste relative ændring); a_i = kcal pr. 100 g * g0 / 100
    const a = i => poster[i].kcal100 * g0[i] / 100, b = i => poster[i].protein100 * g0[i] / 100
    let aa = 0, ab = 0, bb = 0
    for (const i of idx) { aa += a(i) * a(i); ab += a(i) * b(i); bb += b(i) * b(i) }
    const det = aa * bb - ab * ab
    if (Math.abs(det) < 1e-9) break
    const l1 = (dK * bb - dP * ab) / det, l2 = (dP * aa - dK * ab) / det
    let klemt = false
    for (const i of idx) {
      const ny = g[i] + g0[i] * (a(i) * l1 + b(i) * l2)
      if (ny < lo[i]) { g[i] = lo[i]; fri.delete(i); klemt = true }
      else if (ny > hi[i]) { g[i] = hi[i]; fri.delete(i); klemt = true }
      else g[i] = ny
    }
    if (!klemt && fri.size === idx.length) { /* ligning løst uden klemning */ }
    if (fri.size === 0) break
  }
  return g.map((v, i) => {
    const r = trin ? Math.round(v / trin) * trin : v >= 50 ? Math.round(v / 5) * 5 : Math.round(v)
    return Math.min(hi[i], Math.max(lo[i], r))
  })
}

export const afvigelse = (poster, g, { kcal, protein }) => ({
  kcalProcent: (poster.reduce((s, p, i) => s + p.kcal100 * g[i] / 100, 0) - kcal) / kcal * 100,
  proteinProcent: (poster.reduce((s, p, i) => s + p.protein100 * g[i] / 100, 0) - protein) / protein * 100,
})
