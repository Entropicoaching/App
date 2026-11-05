import { calendarDay, addCalendarDays } from '../../../calendarDate.js'
import { createWeeklyLetter } from './weeklyLetterModel.mjs'

// Existing athlete-entered fields only. Nutrition requires a complete receipt
// from the existing report contract; no mutable current targets are backdated.
export async function readWeeklyLetter(options = {}) {
  if (options?.enabled !== true) return { state: 'off' }
  const { getScope, database, getNutritionRead, now = () => new Date() } = options
  const scope = getScope()
  const initial = { role: scope?.role, ownerId: scope?.ownerId, athleteId: scope?.athleteId }
  if (initial.role !== 'coach' || ![initial.ownerId, initial.athleteId].every(id => typeof id === 'string' && id.trim()))
    throw Error('Ugebrev kræver coachrollen og en valgt atlet.')
  const asOf = calendarDay(now()), from = addCalendarDays(asOf, -6)
  if (!from) throw Error('Ugens dato kunne ikke bestemmes.')
  const current = () => {
    const s = getScope()
    if (s.role !== 'coach' || s.ownerId !== initial.ownerId || s.athleteId !== initial.athleteId
      || calendarDay(now()) !== asOf) throw Error('Ugebrevets kontekst er ændret. Prøv igen.')
  }
  const result = await database.from('readiness_logs').select('id,athlete_id,logged_date,sleep_hours,energy,stress,soreness_level')
    .eq('athlete_id', initial.athleteId).gte('logged_date', from).lte('logged_date', asOf)
    .order('logged_date').order('id').range(0, 999)
  current()
  if (result?.error || !Array.isArray(result?.data) || result.data.length >= 1000)
    throw Error('Ugens søvnregistreringer kunne ikke hentes komplet.')
  const days = new Set(), ids = new Set()
  const daily = result.data.map(row => {
    if (!row || typeof row.id !== 'string' || !row.id || ids.has(row.id)
      || row.athlete_id !== initial.athleteId || calendarDay(row.logged_date) !== row.logged_date
      || row.logged_date < from || row.logged_date > asOf || days.has(row.logged_date)
      || row.sleep_hours != null && (typeof row.sleep_hours !== 'number'
        || !Number.isFinite(row.sleep_hours) || row.sleep_hours < 0 || row.sleep_hours > 24)
      || ['energy', 'stress', 'soreness_level'].some(key => row[key] != null
        && (!Number.isInteger(row[key]) || row[key] < 1 || row[key] > 5)))
      throw Error('Ugens søvnregistreringer er ikke entydige.')
    ids.add(row.id); days.add(row.logged_date)
    return { day: row.logged_date, source: 'athlete_manual', sleepHours: row.sleep_hours,
      energy: row.energy, stress: row.stress }
  })
  const recoveryDays = result.data.map(row => ({ day: row.logged_date, source: 'athlete_manual',
    energy: row.energy, stress: row.stress, sorenessLevel: row.soreness_level }))
  const nutritionRead = typeof getNutritionRead === 'function' ? await getNutritionRead({ ...initial, asOf }) : undefined
  current()
  return createWeeklyLetter({ enabled: true, data: {
    state: 'ready', complete: true, athleteId: initial.athleteId, coachId: initial.ownerId,
    asOf, daily, recoveryDays, nutritionRead,
  } })
}
