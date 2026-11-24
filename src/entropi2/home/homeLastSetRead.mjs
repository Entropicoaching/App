import { foldNavn } from '../../exerciseNames.js'

// Ordre 2072: pasets "Sidst:" kender kun logs for ugens egne øvelser (andre uger har andre id'er).
// Ét opslag af atletens egne seneste sæt pr. øvelsesnavn (foldet, uden sprungne, de nyeste 500) til
// de øvelser, der ikke er logget før i denne uge. Fejl giver et tomt svar; intet skrives.
// Klienten hentes først ved kald, aldrig ved import.
export async function readHomeLastSets({ athleteId, client } = {}) {
  if (typeof athleteId !== 'string' || !athleteId.trim()) return {}
  try {
    const database = client ?? (await import('../../supabase.js')).supabase
    const page = await database.from('exercise_logs')
      .select('weight, reps_completed, rpe_actual, logged_at, set_number, athlete_id, skipped, exercises(name)')
      .eq('athlete_id', athleteId).eq('skipped', false).order('logged_at', { ascending: false }).limit(500)
    if (page?.error || !Array.isArray(page?.data)) return {}
    const map = {}
    for (const row of page.data) {
      const name = row?.exercises?.name
      if (typeof name !== 'string' || !name.trim()) continue
      const key = foldNavn(name.trim())
      if (!map[key]) map[key] = []
      map[key].push({ ...row, exercises: undefined })
    }
    return map
  } catch { return {} }
}
