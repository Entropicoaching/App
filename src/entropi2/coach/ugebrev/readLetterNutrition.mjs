import { createPlanAdapter } from '../../kostplan/planAdapter.mjs'

// Ordre 1886: ugebrevets kost mod den godkendte kostplan. Måltidsrækkerne er Dashboardets
// afsluttede kostlæsning (samme som Kost & mål og coachens kostlinje); dagsreferencerne læses
// med samme bundne læsning som den aktive rapport (activeReport.mjs). Ingen ny forespørgsel.
// Uden måltider eller uden en godkendt dag i ugen gives intet, og brevet er som før.
// En ufærdig eller fejlet læsning (også planhistorik 'unavailable') kaster, så ugebrevet kan sige, at kosten ikke kunne hentes.
export async function readLetterNutrition({ coachId, athleteId, asOf, source, client } = {}) {
  if (source?.state !== 'ready' || source.complete !== true || source.coachId !== coachId
    || source.through !== asOf || !Array.isArray(source.athleteIds) || !source.athleteIds.includes(athleteId)
    || !Array.isArray(source.rows)) throw Error('Ugens kost kunne ikke hentes.')
  const mealLogs = source.rows.filter(row => row?.athlete_id === athleteId)
  if (!mealLogs.length) return undefined
  const dailyReferences = await createPlanAdapter({ enabled: true, client, athleteId, date: asOf })
    .loadDailyReferences({ coachId })
  // 'unavailable' er en fejlet læsning af planhistorikken, ikke "ingen plan".
  if (dailyReferences?.state !== 'ready' || !Array.isArray(dailyReferences.days)) throw Error('Ugens kost kunne ikke hentes.')
  if (!dailyReferences.days.some(day => day?.state === 'approved')) return undefined
  return { coachId, athleteId, date: asOf, state: 'ready', complete: true, planHistory: 'daily',
    dailyReferences, mealLogs }
}
