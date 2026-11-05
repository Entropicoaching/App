import { hentAlleSider } from '../../fremgangLogs.js'

const columns = 'athlete_id,exercise_id,set_number,weight,reps_completed,skipped,logged_at,exercises(name,sessions(weeks(block_name)))'

// Existing production columns only. Include skipped slots to establish session
// completion, and paginate to exhaustion so an older maximum is never lost.
// The caller gates own Home; no client is loaded at import time or in tests.
export async function readHomeRecordHistory({ athleteId, client } = {}) {
  if (typeof athleteId !== 'string' || !athleteId.trim()) return { status: 'error' }
  try {
    const database = client ?? (await import('../../supabase.js')).supabase
    const result = await hentAlleSider(async (from, to) => {
      const page = await database.from('exercise_logs').select(columns)
        .eq('athlete_id', athleteId).order('logged_at', { ascending: false })
        .order('id', { ascending: false }).range(from, to)
      if (page?.error || !Array.isArray(page?.data)) throw Error('Incomplete history')
      return page
    })
    if (result.error) throw Error('Incomplete history')
    const rows = Array.from(result.data, row => {
      if (!row || row.athlete_id !== athleteId || row.exercise_id == null ||
          !Number.isSafeInteger(row.set_number) || row.set_number < 1) throw Error('Invalid scope')
      // Do not retain unrelated fields from an injected or future response.
      return { athlete_id: athleteId, exercise_id: row.exercise_id, set_number: row.set_number,
        weight: row.weight, reps_completed: row.reps_completed, skipped: row.skipped,
        logged_at: row.logged_at, exercises: { name: row.exercises?.name,
          sessions: { weeks: { block_name: row.exercises?.sessions?.weeks?.block_name } } } }
    })
    return { status: 'ready', complete: true, athleteId, rows }
  } catch { return { status: 'error', athleteId } }
}
