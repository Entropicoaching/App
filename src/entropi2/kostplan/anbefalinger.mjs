// Plads til det videnskabelige kostbilag (U1). Felterne står tomme, indtil
// bilaget er gennemgået; der opfindes ingen tal her. Indtil da bruger appen
// coachens egne mål (athletes.kcal_target og athletes.protein_target) og
// atletens eget væskemål. Et tal må kun udfyldes sammen med en navngiven kilde.
export const ANBEFALINGER = Object.freeze({
  status: 'afventer-bilag',
  protein: Object.freeze({ gPrKgMin: null, gPrKgMax: null, kilde: null }),
  energi: Object.freeze({
    // kcal-justering i forhold til vedligehold, pr. mål. Tomt indtil bilaget.
    bulk: Object.freeze({ procentMin: null, procentMax: null, kilde: null }),
    vedligehold: Object.freeze({ procentMin: null, procentMax: null, kilde: null }),
    cut: Object.freeze({ procentMin: null, procentMax: null, kilde: null }),
  }),
  vaeske: Object.freeze({ mlPrKg: null, mlPrTraeningstime: null, kilde: null }),
})

const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0
const kilde = value => typeof value === 'string' && value.trim().length > 0

// Et forslag kræver både tal og kilde. Mangler et af dem, er svaret null, og
// visningen falder tilbage til coachens eller atletens eget tal.
export function vaeskeForslag(vaegtKg, traeningstimer = 0, anbefalinger = ANBEFALINGER) {
  const v = anbefalinger?.vaeske
  if (!v || !positive(v.mlPrKg) || !kilde(v.kilde) || !positive(vaegtKg)) return null
  const ekstra = positive(v.mlPrTraeningstime) && positive(traeningstimer) ? v.mlPrTraeningstime * traeningstimer : 0
  return { ml: Math.round((v.mlPrKg * vaegtKg + ekstra) / 50) * 50, kilde: v.kilde.trim() }
}

export function proteinForslag(vaegtKg, anbefalinger = ANBEFALINGER) {
  const p = anbefalinger?.protein
  if (!p || !positive(p.gPrKgMin) || !positive(p.gPrKgMax) || !kilde(p.kilde) || !positive(vaegtKg)) return null
  return { minG: Math.round(p.gPrKgMin * vaegtKg), maxG: Math.round(p.gPrKgMax * vaegtKg), kilde: p.kilde.trim() }
}
