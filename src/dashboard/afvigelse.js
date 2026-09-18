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
