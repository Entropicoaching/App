import { runGuardedWrite } from '../../athleteWriteGuard.js'
import { runGuardedRead } from '../../athleteReadGuard.js'
import { calendarTime } from '../../athlete/kostNumbers.mjs'
import { isDayReceipt } from '../../mealEvidence.mjs'
import { mealTemplateItems } from '../../athlete/kostSkabeloner.mjs'

// Same meal_logs fields and guards as lavKostHandlinger. No client singleton.
// The assembly supplies its existing authenticated client; tests supply a fake.
export function nutritionContracts({ client, onReadError = () => {}, onWriteError = () => {} }) {
  return {
    // Existing meal_logs update/delete paths, with explicit athlete/day scope.
    // Select the affected identity: a zero-row write must not look successful.
    async remove(row) {
      if (!writableRow(row)) return false
      return affected(() => client.from('meal_logs').delete()
        .eq('id', row.id).eq('athlete_id', row.athlete_id).eq('date', row.date).select('id'), row.id)
    },
    async update(row) {
      const items = mealTemplateItems([row])
      if (!writableRow(row) || !items || isDayReceipt({ meal: items[0].meal.trimStart() })) return false
      return affected(() => client.from('meal_logs').update(items[0])
        .eq('id', row.id).eq('athlete_id', row.athlete_id).eq('date', row.date).select('id'), row.id)
    },
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
  async function affected(run, id) {
    let matched = false
    const ok = await runGuardedWrite(async () => {
      const result = await run()
      matched = Array.isArray(result?.data) && result.data.length === 1 && result.data[0]?.id === id
      return result
    }, onWriteError)
    return ok === true && matched
  }
}

const writableRow = row => typeof row?.id === 'string' && row.id.trim() && !row.id.startsWith('local:')
  && typeof row.athlete_id === 'string' && row.athlete_id.trim() && calendarTime(row.date) !== null
