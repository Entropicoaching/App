import { runGuardedWrite } from '../../athleteWriteGuard.js'
import { runGuardedRead } from '../../athleteReadGuard.js'
import { calendarTime } from '../../athlete/kostNumbers.mjs'
import { isDayReceipt } from '../../mealEvidence.mjs'
import { mealTemplateItems } from '../../athlete/kostSkabeloner.mjs'

// Same meal_logs fields and guards as lavKostHandlinger. No client singleton.
// The assembly supplies its existing authenticated client; tests supply a fake.
export function nutritionContracts({ client, onReadError = () => {}, onWriteError = () => {} }) {
  return {
    async load(athleteId, date) {
      if (!athleteId || calendarTime(date) === null) throw new TypeError('Ugyldig kostdato')
      const from = new Date(calendarTime(date) - 30 * 86400000).toISOString().slice(0, 10)
      const result = await runGuardedRead(() => client.from('meal_logs').select('*')
        .eq('athlete_id', athleteId).gte('date', from).lte('date', date)
        .order('created_at', { ascending: false }), onReadError)
      if (!result.ok || !Array.isArray(result.data)) throw new Error('Kostloggen kunne ikke hentes')
      // Defense in depth: a misrouted response cannot cross the athlete boundary.
      if (result.data.some(row => row?.athlete_id !== athleteId)) throw new Error('Forkert atlet i kostloggen')
      return result.data
    },
    async save(row) {
      const items = mealTemplateItems([row])
      if (!row?.athlete_id || calendarTime(row.date) === null || !items || isDayReceipt({ meal: items[0].meal.trimStart() })) return false
      return runGuardedWrite(() => client.from('meal_logs').insert({
        athlete_id: row.athlete_id, date: row.date, ...items[0],
      }), onWriteError)
    },
  }
}
