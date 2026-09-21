// ORDRE 293 · blok 1 (F2) — Fremgang-fanens hentning af al historik. Hentes
// FALDENDE (nyeste først) med grænsen, og vendes bagefter, så en grænse — vores
// egen eller Supabases "Max rows" — altid koster de ÆLDSTE sæt, aldrig de
// nyeste (før: stigende + limit, så kurven endte i fortiden for en atlet med
// mere historik end grænsen). Ingen paginering og ingen datogrænse: hvad
// kurven viser er uændret for alle med færre sæt end grænsen.
export const FREMGANG_LOG_LIMIT = 4000

export function fremgangLogsQuery(client, athleteId) {
  return client
    .from('exercise_logs')
    .select('weight, reps_completed, logged_at, exercises(name)')
    .eq('athlete_id', athleteId)
    .eq('skipped', false)
    .gt('weight', 0)
    .order('logged_at', { ascending: false })
    .limit(FREMGANG_LOG_LIMIT)
}

// Faldende → kronologisk (ældste først), som resten af Fremgang forventer.
export function fremgangLogsKronologisk(rows) {
  return [...(rows || [])].reverse()
}
