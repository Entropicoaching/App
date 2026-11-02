import { useEffect, useState } from 'react'

// Entropi 2 (APP-KOST-COACH1): coachens kostkvittering til CoachScreen.coachNutrition.
// Én atlet-scopet læsning af meal_logs og de eksisterende mål via appens egen klient.
// Konteksten (ejer, atlet-id'er, dag) indfanges ved læsningens start fra readContext og
// følger svaret uændret; en gammel respons kan aldrig få en ny kontekst.
export const COACH_NUTRITION_CAP = 1000
const DAY_MS = 86400000

export function nutritionFrom(day) {
  const stamp = Date.parse(day + 'T00:00:00Z')
  return Number.isFinite(stamp) ? new Date(stamp - 6 * DAY_MS).toISOString().slice(0, 10) : null
}

const validContext = context => !!context && typeof context.coachId === 'string' && context.coachId.length > 0 &&
  typeof context.day === 'string' && nutritionFrom(context.day) !== null && Array.isArray(context.athleteIds)

// Ren læsning: samme fejl- og cap-mønster som morgenlæsningerne (fejl => error, cap nået => partial).
export async function readCoachNutrition(client, context) {
  if (!validContext(context)) return undefined
  const athleteIds = [...context.athleteIds]
  const base = { coachId: context.coachId, day: context.day, athleteIds,
    from: nutritionFrom(context.day), through: context.day }
  if (!athleteIds.length) return { ...base, state: 'ready', complete: true, rows: [], targets: [] }
  let meals, goals
  try {
    [meals, goals] = await Promise.all([
      client.from('meal_logs').select('id, athlete_id, date, meal, kcal, protein')
        .in('athlete_id', athleteIds).gte('date', base.from).lte('date', base.through)
        .order('date').limit(COACH_NUTRITION_CAP),
      client.from('athletes').select('id, kcal_target, protein_target').in('id', athleteIds),
    ])
  } catch {
    return { ...base, state: 'error', complete: false }
  }
  if (meals?.error || goals?.error || !Array.isArray(meals?.data) || !Array.isArray(goals?.data))
    return { ...base, state: 'error', complete: false }
  if (meals.data.length >= COACH_NUTRITION_CAP) return { ...base, state: 'partial', complete: false }
  return { ...base, state: 'ready', complete: true,
    rows: meals.data.map(row => ({ ...row, id: typeof row?.id === 'number' ? String(row.id) : row?.id })),
    targets: goals.data.map(row => ({ athlete_id: row?.id, kcal_target: row?.kcal_target, protein_target: row?.protein_target })) }
}

// Effektens krop: starter kun en læsning med flaget tændt, en klient og en gyldig kontekst.
// Returnerer en annullering; et svar efter annullering afleveres aldrig.
export function startCoachNutritionRead({ enabled, client, readContext }, onResult) {
  if (enabled !== true || !client || !validContext(readContext)) return undefined
  let current = true
  readCoachNutrition(client, readContext).then(batch => {
    if (current) onResult({ context: readContext, batch })
  }, () => { if (current) onResult({ context: readContext, batch: undefined }) })
  return () => { current = false }
}

// Et afleveret svar gives kun videre, så længe det hører til netop det readContext-objekt,
// læsningen startede med. Ny kontekst kræver et nyt afsluttet svar.
export function selectCoachNutrition(result, enabled, readContext) {
  return enabled === true && !!readContext && result?.context === readContext ? result.batch : undefined
}

export function useEntropi2CoachNutrition({ enabled, client, readContext }) {
  const [result, setResult] = useState(null)
  useEffect(() => startCoachNutritionRead({ enabled, client, readContext }, setResult), [enabled, client, readContext])
  return selectCoachNutrition(result, enabled, readContext)
}
