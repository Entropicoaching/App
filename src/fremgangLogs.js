// ORDRE 293 · blok 1 (F2) — Fremgang-fanens hentning af al historik. Hentes
// FALDENDE (nyeste først) med grænsen, og vendes bagefter, så en grænse — vores
// egen eller Supabases "Max rows" — altid koster de ÆLDSTE sæt, aldrig de
// nyeste (før: stigende + limit, så kurven endte i fortiden for en atlet med
// mere historik end grænsen). Ingen paginering og ingen datogrænse: hvad
// kurven viser er uændret for alle med færre sæt end grænsen.
export const FREMGANG_LOG_LIMIT = 4000

// ORDRE 456: { fra, til } = én side (range) i stedet for grænsen; se hentAlleSider.
export function fremgangLogsQuery(client, athleteId, { fra = null, til = null } = {}) {
  const q = client
    .from('exercise_logs')
    // ORDRE 439: exercise_id, så ugens egne sæt kan tages fra exerciseLogs
    // i stedet (rekorder.js), uden at et sæt tælles to gange.
    .select('exercise_id, weight, reps_completed, logged_at, exercises(name, sessions(weeks(block_name)))')
    .eq('athlete_id', athleteId)
    .eq('skipped', false)
    .gt('weight', 0)
    .order('logged_at', { ascending: false })
  return fra == null ? q.limit(FREMGANG_LOG_LIMIT) : q.order('id', { ascending: false }).range(fra, til)
}

// Faldende → kronologisk (ældste først), som resten af Fremgang forventer.
export function fremgangLogsKronologisk(rows) {
  return [...(rows || [])].reverse()
}

// ORDRE 450: rækkerne til rekord-indekset (src/athlete/rekordIndeks.js).
// Samme felter og filtre som ovenfor, men kun rækker fra `siden` og frem
// (null = alt, første gang). Faldende med samme grænse, så en grænse også her
// koster de ældste rækker.
export function rekordRaekkerQuery(client, athleteId, siden = null, { fra = null, til = null } = {}) {
  let q = client
    .from('exercise_logs')
    .select('exercise_id, weight, reps_completed, logged_at, exercises(name, sessions(weeks(block_name)))')
    .eq('athlete_id', athleteId)
    .eq('skipped', false)
    .gt('weight', 0)
  if (siden) q = q.gte('logged_at', siden)
  q = q.order('logged_at', { ascending: false })
  return fra == null ? q.limit(FREMGANG_LOG_LIMIT) : q.order('id', { ascending: false }).range(fra, til)
}

// ORDRE 456 (A4 i docs/kritik-446): hele historikken, side for side. Supabase'
// "Max rows" (standard 1000 i et nyt projekt) afskærer stille ethvert svar,
// uanset limit. Med ét kald på 4000 blev "bedst før" regnet ud fra de nyeste
// 1000 eller 4000 sæt, og et almindeligt sæt kunne fejres som rekord, når
// atletens top lå længere tilbage. Nu hentes sider (range, logged_at og id
// faldende, så de ikke overlapper), til en side kommer tom tilbage: så er
// loftet ligegyldigt, hvad prod end står på. lavSide(fra, til) giver et kald
// med { data, error }; svaret har samme form. Flere end MAX_SIDER sider giver
// en fejl, så intet regnes ud fra en halv historik.
export const SIDE_STR = 1000
export const MAX_SIDER = 200

export async function hentAlleSider(lavSide, sideStr = SIDE_STR) {
  const alle = []
  for (let side = 0; side < MAX_SIDER; side++) {
    const { data, error } = await lavSide(alle.length, alle.length + sideStr - 1)
    if (error) return { data: null, error }
    if (!data?.length) return { data: alle, error: null }
    alle.push(...data)
  }
  return { data: null, error: { code: 'FOR_MANGE_SIDER', message: `Historikken er over ${MAX_SIDER * sideStr} rækker` } }
}
