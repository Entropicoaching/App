// Ordre 1683: coachens "Parathed i dag" viser dagstjekkets smerte (0 til 10) i stedet for ømheden
// (1 til 5), når atleten har skrevet smerte samme dag. Ét-tryks-energien gemmer gårsdagens ømhed
// som forslag, så ømheden kan modsige smerten; dagstjekket er det, atleten selv valgte i dag.
// Kun visning: readiness_logs og tracking_daily_v1 skrives ikke. Rækken er atletens seneste række
// i tracking_daily_v1 (læst sammen med readiness i dashboard/laesninger.js); kun samme dag tæller.
export function dayPainOn(row, athleteId, day) {
  if (!row || row.athlete_id !== athleteId || row.logged_date !== day) return null
  if (!Number.isInteger(row.pain) || row.pain < 0 || row.pain > 10) return null
  const location = typeof row.pain_location === 'string' && row.pain_location.trim() ? row.pain_location.trim().slice(0, 40) : null
  return { pain: row.pain, location }
}
