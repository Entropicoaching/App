import { useMemo } from 'react'
import { activityDay } from '../dashboard/coachInactive.mjs'

// Entropi 2: konteksten hører til den afsluttede kalenderlæsning, ikke til gengivelsen.
// Dagen fastlåses, når kalenderen er læst; efter midnat uden ny læsning afviser coachskærmen den.
export function entropi2ReadContext({ enabled, loading, loadError, coachId, athleteIds, calendarStatus, now = new Date() }) {
  if (enabled !== true || loading || loadError || typeof coachId !== 'string' || !coachId || calendarStatus !== 'ready') return undefined
  return { coachId, athleteIds: [...athleteIds], day: activityDay(now) }
}

// Ny kontekst kun ved ny kalenderlæsning (nyt calendarWeeks-objekt), ejer-, atlet- eller statusskift.
// Tiden er bevidst ikke en afhængighed.
export function entropi2ReadContextDeps({ enabled, loading, loadError, coachId, athletes, calendarWeeks, calendarStatus }) {
  const athleteKey = JSON.stringify((Array.isArray(athletes) ? athletes : []).map(item => item?.id))
  return [enabled, loading, loadError, coachId, athleteKey, calendarWeeks, calendarStatus]
}

export function useEntropi2ReadContext(input) {
  const deps = entropi2ReadContextDeps(input)
  const [enabled, loading, loadError, coachId, athleteKey, , calendarStatus] = deps
  // Afhængighederne er netop listen fra entropi2ReadContextDeps.
  return useMemo(() => entropi2ReadContext({ enabled, loading, loadError, coachId, athleteIds: JSON.parse(athleteKey), calendarStatus }), deps)
}
