import { homeworkLibrary, readHomework, saveHomework } from './mobilityHomework.mjs'

export const HOME_EXERCISE_DB_DEFAULTS = Object.freeze({ hjemmeoevDb: false })
const columns = 'id,athlete_id,coach_id,exercises,created_at'
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
const fail = message => ({ value: null, error: message })
function clean(value) {
  if (value === null) return null
  const problem = homeworkLibrary().find(item => item.id === value?.problemId)
  const ids = value?.exerciseIds
  if (!problem || !Array.isArray(ids) || ids.length < 1 || ids.length > 4 ||
      new Set(ids).size !== ids.length || !ids.every(id => problem.exercises.some(ex => ex.id === id))) throw Error('assignment')
  return { problemId: problem.id, exerciseIds: [...ids] }
}

// Inject the existing session-bound client. This module never creates a client,
// reads credentials, toggles global flags, or automatically copies local data.
// Both methods are async in OFF and ON mode. Errors never fall back to local data.
export function createHomeExerciseDb({ hjemmeoevDb = false, client, storage } = {}) {
  const enabled = hjemmeoevDb === true
  const scopeValid = (athleteId, coachId) => uuid(athleteId) && uuid(coachId)
  return Object.freeze({
    async read(athleteId, coachId) {
      if (!enabled) return readHomework(athleteId, storage)
      if (!scopeValid(athleteId, coachId)) return fail('Atlet eller coach mangler.')
      athleteId = athleteId.toLowerCase(); coachId = coachId.toLowerCase()
      try {
        const { data, error } = await client.from('home_exercise_assignments').select(columns)
          .eq('athlete_id', athleteId).eq('coach_id', coachId).maybeSingle()
        if (error) throw error
        if (data === null) return { value: null, error: null }
        if (data.athlete_id !== athleteId || data.coach_id !== coachId || !uuid(data.id) || data.exercises === null) throw Error('scope')
        return { value: clean(data.exercises), error: null }
      } catch { return fail('Hjemmeoevelser kunne ikke laeses fra databasen. Proev igen.') }
    },
    async save(athleteId, coachId, value) {
      if (!enabled) return saveHomework(athleteId, value, storage)
      if (!scopeValid(athleteId, coachId)) return fail('Atlet eller coach mangler.')
      athleteId = athleteId.toLowerCase(); coachId = coachId.toLowerCase()
      let exercises
      try { exercises = clean(value) } catch { return fail('Vaelg en problematik og en til fire tilhoerende oevelser.') }
      try {
        if (exercises === null) {
          const { error } = await client.from('home_exercise_assignments').delete()
            .eq('athlete_id', athleteId).eq('coach_id', coachId)
          if (error) throw error
          return { value: null, error: null }
        }
        const { data, error } = await client.from('home_exercise_assignments')
          .upsert({ athlete_id: athleteId, coach_id: coachId, exercises }, { onConflict: 'athlete_id,coach_id' })
          .select(columns).single()
        if (error) throw error
        if (data.athlete_id !== athleteId || data.coach_id !== coachId || !uuid(data.id)) throw Error('scope')
        const saved = clean(data.exercises)
        if (JSON.stringify(saved) !== JSON.stringify(exercises)) throw Error('write_not_confirmed')
        return { value: saved, error: null }
      } catch { return fail('Hjemmeoevelser kunne ikke gemmes i databasen. Proev igen.') }
    },
  })
}
