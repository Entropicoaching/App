import { createPlanAdapter } from '../planAdapter.mjs'
import { friUge } from '../friPulje.mjs'
import { calendarDay } from '../../../calendarDate.js'

// 2177 (Marc 24. nov. kl. 19:11): atleten ser samme ugedom som coachen. Samme friUge, samme 7 dage
// (dagsreferencerne slutter i dag, så ingen fremtidige dage) og samme kostrækker som coachens linje
// "Basemåltider fulgt: X af Y. Fri pulje holdt: N af M loggede dage." Ren læsning, ingen skrivning.
const loggede = n => (n === 1 ? 'logget dag' : 'loggede dage')

// Ren: dage er dagsreferencer ({ date, state, friPct, maaltider, targets }), raekker atletens kostrækker.
// Uden niveau over 0 % kender dagen ikke sine basemåltider (maaltider følger kun med et niveau), og coachens linje
// udelades også; så er der ingen linje. Ingen pulje i ugen eller ingen logning på puljedagene giver ingen linje.
export function ugeFriLinje({ dage: planDage, raekker, today } = {}) {
  const til = calendarDay(today)
  if (!til || !Array.isArray(planDage)) return null
  const fri = friUge({ dage: planDage.filter(d => d?.date <= til), raekker: (raekker ?? []).filter(row => row?.date <= til) })
  if (!fri || fri.vurderede === 0) return null
  return `Seneste 7 dage: basemåltider fulgt ${fri.basis} af ${fri.basisAf}, fri pulje holdt ${fri.holdt} af ${fri.vurderede} ${loggede(fri.vurderede)}.`
}

// Læser de 7 dagsreferencer og kostrækkerne for de samme dage med atletens egen klient.
// Fejl, afbrydelse eller et fyldt resultat giver null, og så vises ingen linje.
export async function readUgeFri({ client, athleteId, date, planDays = null, isCurrent = () => true }) {
  if (typeof client?.from !== 'function' || !athleteId || !calendarDay(date)) return null
  const refs = planDays ?? await createPlanAdapter({ enabled: true, client, athleteId, date })
    .loadDailyReferences({ coachId: athleteId, isCurrent })
  if (refs?.state !== 'ready' && !planDays) return null
  const days = planDays ?? refs.days
  if (!days.some(d => d?.state === 'approved' && d.friPct > 0)) return { dage: days, raekker: [] }
  const from = days.map(d => d.date).sort()[0]
  const result = await client.from('meal_logs').select('date, meal, kcal').eq('athlete_id', athleteId)
    .gte('date', from).lte('date', date).limit(1000)
  if (!isCurrent() || !result || result.error || !Array.isArray(result.data) || result.data.length >= 1000) return null
  return { dage: days, raekker: result.data }
}
