// Complete, explicitly requested reads through the host's existing client.
// No client construction, storage, writes, identity lookup or automatic reads.
const tables = [
  ['exerciseLogs', 'exercise_logs', 'id,athlete_id,logged_at,exercise_id,exercises(name),set_number,weight,reps_completed,rpe_planned,rpe_actual,skipped,note'],
  ['mealLogs', 'meal_logs', 'id,athlete_id,date,meal,kcal,protein,carb,fat'],
  ['weightLogs', 'weight_logs', 'id,athlete_id,logged_at,weight'],
]
export async function loadAthleteExport({ client, getScope }) {
  const initial = getScope()
  const athleteId = initial.athleteId, ownerId = initial.ownerId
  function check() {
    const scope = getScope()
    if (scope.enabled !== true || typeof athleteId !== 'string' || !athleteId.trim() ||
        typeof ownerId !== 'string' || !ownerId.trim() || scope.athleteId !== athleteId ||
        scope.ownerId !== ownerId || scope.athleteUserId !== ownerId) {
      throw new Error('Eksport kræver den aktuelle atlets egen profil.')
    }
  }
  check()
  if (typeof client?.from !== 'function') throw new Error('Data er ikke tilgængelige.')
  const result = { athleteId, ownerId }
  for (const [key, table, columns] of tables) {
    const rows = [], ids = new Set()
    for (let page = 0; ; page++) {
      check()
      if (page >= 200) throw new Error('Eksporten er for stor til at klargøre samlet.')
      const { data, error } = await client.from(table).select(columns)
        .eq('athlete_id', athleteId).order('id', { ascending: true }).range(page * 500, page * 500 + 499)
      check()
      if (error || !Array.isArray(data) || data.length > 500) throw new Error('Alle data kunne ikke hentes.')
      for (const row of data) {
        if (!row || row.athlete_id !== athleteId || !row.id || ids.has(row.id)) {
          throw new Error('Data kunne ikke samles sikkert. Prøv igen.')
        }
        ids.add(row.id); rows.push(row)
      }
      if (data.length < 500) break
    }
    result[key] = { athleteId, state: 'ready', complete: true, rows }
  }
  check()
  return result
}
