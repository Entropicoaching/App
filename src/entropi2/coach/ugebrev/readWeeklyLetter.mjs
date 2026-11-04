import { calendarDay, addCalendarDays } from '../../../calendarDate.js'
import { createWeeklyLetter } from './weeklyLetterModel.mjs'

// Existing athlete-entered readiness_logs sleep hours only. Other domains need
// dated targets, confirmed plans or different scales and remain unknown here.
export async function readWeeklyLetter({ enabled = false, getScope, database, now = () => new Date() } = {}) {
  if (enabled !== true) return { state: 'off' }
  const initial = getScope()
  if (initial.role !== 'coach') throw Error('Ugebrev kræver coachrollen.')
  const asOf = calendarDay(now()), from = addCalendarDays(asOf, -6)
  if (!from) throw Error('Ugens dato kunne ikke bestemmes.')
  const current = () => {
    const s = getScope()
    if (s.role !== 'coach' || s.ownerId !== initial.ownerId || s.athleteId !== initial.athleteId
      || calendarDay(now()) !== asOf) throw Error('Ugebrevets kontekst er ændret. Prøv igen.')
  }
  const result = await database.from('readiness_logs').select('id,athlete_id,logged_date,sleep_hours')
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
        || !Number.isFinite(row.sleep_hours) || row.sleep_hours < 0 || row.sleep_hours > 24))
      throw Error('Ugens søvnregistreringer er ikke entydige.')
    ids.add(row.id); days.add(row.logged_date)
    return { day: row.logged_date, source: 'athlete_manual', sleepHours: row.sleep_hours }
  })
  return createWeeklyLetter({ enabled: true, data: {
    state: 'ready', complete: true, athleteId: initial.athleteId, asOf, daily,
  } })
}
