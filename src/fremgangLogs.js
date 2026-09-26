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
    // ORDRE 439: exercise_id, så ugens egne sæt kan tages fra exerciseLogs
    // i stedet (rekorder.js), uden at et sæt tælles to gange.
    .select('exercise_id, weight, reps_completed, logged_at, exercises(name)')
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

// ORDRE 450: rækkerne til rekord-indekset (src/athlete/rekordIndeks.js).
// Samme felter og filtre som ovenfor, men kun rækker fra `siden` og frem
// (null = alt, første gang). Faldende med samme grænse, så en grænse også her
// koster de ældste rækker.
export function rekordRaekkerQuery(client, athleteId, siden = null) {
  let q = client
    .from('exercise_logs')
    .select('exercise_id, weight, reps_completed, logged_at, exercises(name)')
    .eq('athlete_id', athleteId)
    .eq('skipped', false)
    .gt('weight', 0)
  if (siden) q = q.gte('logged_at', siden)
  return q.order('logged_at', { ascending: false }).limit(FREMGANG_LOG_LIMIT)
}
