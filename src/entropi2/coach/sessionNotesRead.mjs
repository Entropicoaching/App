// K-R3-ENTROPI-SAMLET fund 2: pasnotevaelgeren henter selv den valgte atlets logs
// (samme kolonner som coachens eksisterende detaljelaesning), seneste 8 dage.
export const SESSION_NOTES_LIMIT = 300
const COLUMNS = 'id, athlete_id, set_number, weight, reps_completed, note, logged_at, rpe_actual, rpe_planned, skipped, exercise_id, exercises(id, name, sets, reps, intensity, recommended_weight, session_id, sessions(id, title, athlete_rating, athlete_comment, weeks(week_number, block_name)))'

export async function loadSessionNotes(client, athleteId, now = Date.now()) {
  if (!client || typeof client.from !== 'function' || typeof athleteId !== 'string' || !athleteId) return { state: 'error' }
  try {
    const since = new Date(now - 8 * 86400000).toISOString()
    const { data, error } = await client.from('exercise_logs').select(COLUMNS)
      .eq('athlete_id', athleteId).gte('logged_at', since)
      .order('logged_at', { ascending: false }).limit(SESSION_NOTES_LIMIT)
    if (error || !Array.isArray(data)) return { state: 'error' }
    const logs = Object.assign([...data], { readEvidence: { athleteId, complete: data.length < SESSION_NOTES_LIMIT } })
    return { state: 'loaded', logs }
  } catch { return { state: 'error' } }
}
