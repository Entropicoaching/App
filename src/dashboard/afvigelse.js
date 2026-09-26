// ORDRE 277 · commit 1 — "coachen ser på et blik hvem han skal skrive til":
// afvigelse denne uge, planlagt mod gennemført, sæt og tonnage, for
// coachens sorterbare atletliste (Dashboard.jsx). Ingen Supabase-kald,
// ingen UI — rene funktioner, samme mønster som src/volume/planlagt.js.
//
// "Denne uge" er IKKE en kalenderuge her (til forskel fra
// src/volume/planlagt.js's beregnPlanlagtDenneUge) — det er athletens
// AKTUELLE programuge, samme koncept listen allerede bruger til at vise
// "Uge N" (currentWeekNo, src/dashboardShared.js). De fleste programuger
// mangler en start_date (se planlagt.js's egen note); at kræve en
// kalenderuge-datering ville lade de fleste atleter falde i "ingen plan",
// hvilket ville modsige selve ordrens formål (find hvem der er skredet).

/**
 * Afvigelse for én atlets aktuelle programuge.
 *
 * @param {{ plannedSets?: number, plannedTonnage?: number, completedSets?: number, completedTonnage?: number }} input
 *   `plannedTonnage` er summen af sæt × anbefalet vægt for øvelser der HAR
 *   en anbefalet vægt (øvelser uden tælles kun med i sæt, ikke i tonnage —
 *   der er intet kg-tal at sammenligne imod).
 * @returns {{ harPlan: boolean, plannedSets: number, plannedTonnage: number, completedSets: number, completedTonnage: number, afvigelseSaet: number, afvigelseTonnage: number, score: number }}
 *   `score` er en intern sorteringsnøgle (andel af planen der mangler,
 *   sæt + tonnage lagt sammen så de to enheder kan sammenlignes) — ALDRIG
 *   vist i UI'et, kun brugt til rækkefølgen (ordrens "ingen procent der
 *   ligner en karakter" gælder visningen, ikke sorteringen). De øvrige felter
 *   ekkoer input igennem (afrundet ingen steder) — UI'et viser dem direkte.
 */
export function beregnUgensAfvigelse({ plannedSets = 0, plannedTonnage = 0, completedSets = 0, completedTonnage = 0 } = {}) {
  if (!(plannedSets > 0)) {
    return { harPlan: false, plannedSets: 0, plannedTonnage: 0, completedSets, completedTonnage, afvigelseSaet: 0, afvigelseTonnage: 0, score: -1 }
  }
  const afvigelseSaet = plannedSets - completedSets
  const afvigelseTonnage = plannedTonnage - completedTonnage
  const saetAndel = Math.max(0, afvigelseSaet) / plannedSets
  const tonnageAndel = plannedTonnage > 0 ? Math.max(0, afvigelseTonnage) / plannedTonnage : 0
  return {
    harPlan: true, plannedSets, plannedTonnage, completedSets, completedTonnage,
    afvigelseSaet, afvigelseTonnage, score: saetAndel + tonnageAndel,
  }
}

/**
 * Sorterer rækker (`{ afvigelse: ReturnType<typeof beregnUgensAfvigelse> }`)
 * efter faldende score — størst afvigelse (mest skredet fra planen) øverst.
 * Atleter uden plan samles NEDERST, i deres indbyrdes rækkefølge fra
 * `rows` (stabilt) — "ingen plan" er ikke en afvigelse, se ordrens egen ord.
 *
 * @template T
 * @param {Array<T & { afvigelse: { harPlan: boolean, score: number } }>} rows
 * @returns {Array<T>}
 */
export function sorterEfterAfvigelse(rows) {
  const medPlan = rows.filter(r => r.afvigelse.harPlan)
  const udenPlan = rows.filter(r => !r.afvigelse.harPlan)
  medPlan.sort((a, b) => b.afvigelse.score - a.afvigelse.score)
  return [...medPlan, ...udenPlan]
}

// ORDRE 428 (C3): planlagt og gennemført kg skal regnes på samme måde, ellers
// står en fuldført plan som fx "2180 kg planlagt, 12160 kg gennemført".
// Reps-feltet er fri tekst ("5", "4-6", "8-10", "45s"). Et interval tæller
// som midten. Alt andet end tal/interval (tid, AMRAP) giver null, og så
// tæller øvelsen hverken med i planlagt eller gennemført kg.
export function planlagteReps(reps) {
  const m = String(reps ?? '').trim().match(/^(\d+(?:[.,]\d+)?)(?:\s*[-–]\s*(\d+(?:[.,]\d+)?))?$/)
  if (!m) return null
  const lav = Number(m[1].replace(',', '.'))
  const hoej = m[2] != null ? Number(m[2].replace(',', '.')) : lav
  return (lav + hoej) / 2
}

// Tæller en øvelse med i kg-sammenligningen? Kun med anbefalet vægt og reps
// der kan regnes (samme betingelse på begge sider).
export function taellerIKg(exercise) {
  return exercise?.recommended_weight != null && planlagteReps(exercise.reps) != null
}

// ORDRE 428 (C2): ugens stemme for coachens atletliste. Laveste vurdering
// (1-5) og den nyeste tekst atleten har skrevet, pas-kommentar eller
// sæt-note. "Nyeste" er efter passets rækkefølge i ugen; inden for samme pas
// står kommentaren (skrevet efter passet) efter noterne.
//   pas:   [{ order, rating, comment }]   (ugens pas)
//   noter: [{ order, note }]              (sæt-noter i ugens pas)
export function ugensStemme(pas = [], noter = []) {
  const vurderinger = pas.map(p => Number(p.rating)).filter(v => v >= 1 && v <= 5)
  const tekster = [
    ...pas.filter(p => p.comment && String(p.comment).trim()).map(p => ({ order: Number(p.order) || 0, tekst: String(p.comment).trim() })),
    ...noter.filter(n => n.note && String(n.note).trim()).map(n => ({ order: (Number(n.order) || 0) - 0.5, tekst: String(n.note).trim() })),
  ].sort((a, b) => b.order - a.order)
  if (!vurderinger.length && !tekster.length) return null
  return {
    laveste: vurderinger.length ? Math.min(...vurderinger) : null,
    tekst: tekster[0]?.tekst || null,
    flereTekster: Math.max(0, tekster.length - 1),
  }
}
