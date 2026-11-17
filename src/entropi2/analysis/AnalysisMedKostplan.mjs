// Navneområde i stedet for navngivne hooks: de lukkede prøveharnesser erstatter react med en
// fixture, der kun har createElement. Hooks køres kun, når komponenten gengives af React.
import * as React from 'react'
import MineData from '../athlete/minedata/MineData.mjs'
import { mineDataWithPlan } from './analysisMineData.mjs'
import { calendarDay, addCalendarDays } from '../../calendarDate.js'
import { createPlanAdapter } from '../kostplan/planAdapter.mjs'
import { planWindow } from './kostDageModPlan.mjs'

// Kun læsning, atletens egen klient. Godkendt plan pr. dag via den eksisterende adapter
// (to vinduer à 7 dage) og atletens egne kostrækker for de samme 14 dage. Intet svar,
// fejl eller annullering giver ingen basis, og så vises kortet ikke.
export async function readKostPlanBasis({ client, athleteId, today, isCurrent = () => true }) {
  const { start, end } = planWindow(today)
  const ends = [end, addCalendarDays(end, -7)]
  const planDays = []
  for (const date of ends) {
    // loadDailyReferences kræver et id til sin coach-kontrakt; her er læseren atleten selv.
    const refs = await createPlanAdapter({ enabled: true, client, athleteId, date })
      .loadDailyReferences({ coachId: athleteId, isCurrent })
    if (refs?.state !== 'ready') return null
    planDays.push(...refs.days)
  }
  const result = await client.from('meal_logs').select('date, meal, kcal, protein')
    .eq('athlete_id', athleteId).gte('date', start).lte('date', end).limit(1000)
  if (!isCurrent() || !result || result.error || !Array.isArray(result.data) || result.data.length >= 1000) return null
  return { athleteId, planDays, meals: result.data }
}

export function useKostPlanBasis({ enabled, client, athleteId, today }) {
  const [basis, setBasis] = React.useState(null)
  // Klienten kan være et nyt objekt ved hver gengivelse; læsningen hører til atlet og dag.
  const clientRef = React.useRef(client)
  clientRef.current = client
  const live = enabled === true && athleteId != null && typeof client?.from === 'function'
  React.useEffect(() => {
    if (!live) return undefined
    let current = true
    readKostPlanBasis({ client: clientRef.current, athleteId, today, isCurrent: () => current })
      .then(value => { if (current) setBasis(value) }, () => { if (current) setBasis(null) })
    return () => { current = false }
  }, [live, athleteId, today])
  return live && basis?.athleteId === athleteId ? basis : null
}

// Mine data med kostdagene mod planen. Før læsningen er færdig, og hvis den fejler,
// ses Mine data som før.
export default function MineDataMedKostplan({ mineProps, athlete, client, now }) {
  const basis = useKostPlanBasis({ enabled: true, client, athleteId: athlete?.id,
    today: calendarDay(now ?? new Date()) })
  return React.createElement(MineData, { ...mineDataWithPlan(mineProps, basis), showRecords: false })
}
