import { useEffect, useState } from 'react'
import { addCalendarDays } from '../calendarDate.js'
import { createPlanAdapter } from './kostplan/planAdapter.mjs'
import { planWindow } from './analysis/kostDageModPlan.mjs'

// CoachScreen and Kost & mål share this read through Dashboard's existing client.
// The public cap is now a page size. Both tables need an empty terminal page;
// REST pagination is bounded evidence, not a transactional snapshot.
export const COACH_NUTRITION_CAP = 1000
const MAX_ROWS = 10000
const MAX_PAGES = 100
const DAY_MS = 86400000

export function nutritionFrom(day) {
  const stamp = Date.parse(day + 'T00:00:00Z')
  return Number.isFinite(stamp) ? new Date(stamp - 6 * DAY_MS).toISOString().slice(0, 10) : null
}

const validContext = context => !!context && typeof context.coachId === 'string' && context.coachId.length > 0 &&
  typeof context.day === 'string' && nutritionFrom(context.day) !== null && Array.isArray(context.athleteIds) &&
  context.athleteIds.every(id => typeof id === 'string' && id.length > 0) &&
  new Set(context.athleteIds).size === context.athleteIds.length
const sameScope = (context, captured) => context?.coachId === captured.coachId && context.day === captured.day &&
  Array.isArray(context.athleteIds) && Array.isArray(captured.athleteIds) && context.athleteIds.length === captured.athleteIds.length &&
  context.athleteIds.every((id, i) => id === captured.athleteIds[i])
const capture = context => ({ coachId: context.coachId, day: context.day, athleteIds: [...context.athleteIds] })
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0
const validId = id => typeof id === 'string' ? id.trim().length > 0 : Number.isSafeInteger(id)

async function readTable(client, current, meals, athleteIds, from, through) {
  const allowed = new Set(athleteIds)
  const rows = [], seen = new Set()
  let previous
  for (let page = 0; page < MAX_PAGES; page++) {
    if (!current() || rows.length >= MAX_ROWS) return { state: 'partial' }
    let query = client.from(meals ? 'meal_logs' : 'athletes')
      .select(meals ? 'id, athlete_id, date, meal, kcal, protein, carb, fat' : 'id, kcal_target, protein_target')
      .in(meals ? 'athlete_id' : 'id', [...athleteIds])
    if (meals) query = query.gte('date', from).lte('date', through).order('date', { ascending: true })
    query = query.order('id', { ascending: true })
    const size = Math.min(COACH_NUTRITION_CAP, MAX_ROWS - rows.length)
    const result = await query.range(rows.length, rows.length + size - 1)
    if (!current()) return { state: 'partial' }
    if (result?.error || !Array.isArray(result?.data) || result.data.length > size) return { state: 'error' }
    // A short page can be the server's smaller Max rows setting. Only empty
    // proves exhaustion; advance by received count, never requested count.
    if (!result.data.length) return { state: 'ready', rows }
    for (const row of result.data) {
      if (!validId(row?.id) || !allowed.has(meals ? row.athlete_id : row.id) ||
        (meals && (typeof row.date !== 'string' || row.date < from || row.date > through)))
        return { state: 'error' }
      const key = String(row.id)
      // The unique id and the total order protect against overlapping pages,
      // ignored ranges, duplicate rows and backwards/nonprogressing responses.
      const order = previous && (meals ? compare(previous.date, row.date) : 0)
      if (seen.has(key) || (previous && (order > 0 || (order === 0 &&
        (typeof previous.id !== typeof row.id || compare(previous.id, row.id) >= 0)))))
        return { state: 'partial' }
      seen.add(key); previous = row; rows.push(row)
    }
  }
  return { state: 'partial' }
}

async function readNutrition(client, context, current) {
  if (!validContext(context)) return undefined
  const captured = capture(context), athleteIds = captured.athleteIds
  const base = { ...captured, from: nutritionFrom(captured.day), through: captured.day }
  const incomplete = state => ({ ...base, state, complete: false })
  if (!athleteIds.length) return { ...base, state: 'ready', complete: true, rows: [], targets: [] }
  try {
    const meals = await readTable(client, current, true, athleteIds, base.from, base.through)
    if (meals.state !== 'ready') return incomplete(meals.state)
    const goals = await readTable(client, current, false, athleteIds, base.from, base.through)
    if (goals.state !== 'ready') return incomplete(goals.state)
    if (!current()) return incomplete('partial')
    return { ...base, state: 'ready', complete: true,
      rows: meals.rows.map(row => ({ ...row, id: typeof row.id === 'number' ? String(row.id) : row.id })),
      targets: goals.rows.map(row => ({ athlete_id: row.id, kcal_target: row.kcal_target, protein_target: row.protein_target })) }
  } catch { return incomplete('error') }
}

// Kostplanen pr. atlet (ordre 1588). Kun læsning, coachens egen klient (RLS afgrænser).
// Adapteren giver 7 dage pr. kald, så de 14 afsluttede dage er to kald pr. atlet, ikke et pr. dag.
// En atlet uden godkendt plan i vinduet, eller hvis planlæsning fejler, får ingen post og
// beholder profilens mål. Fejl her må aldrig fælde den almindelige kostlæsning.
export async function readCoachPlanBasis(client, context, current = () => true) {
  if (!validContext(context) || !context.athleteIds.length) return null
  const { start, end } = planWindow(context.day)
  const ends = [end, addCalendarDays(end, -7)]
  const athletes = []
  for (const athleteId of context.athleteIds) {
    try {
      const days = []
      for (const date of ends) {
        const refs = await createPlanAdapter({ enabled: true, client, athleteId, date })
          .loadDailyReferences({ coachId: context.coachId, isCurrent: current })
        if (!current()) return null
        if (refs?.state !== 'ready' || !Array.isArray(refs.days)) { days.length = 0; break }
        days.push(...refs.days)
      }
      if (days.some(d => d?.state === 'approved' && d.date >= start && d.date <= end))
        athletes.push({ athlete_id: athleteId, days })
    } catch { if (!current()) return null }
  }
  if (!athletes.length) return null
  try {
    const meals = await readTable(client, current, true, athletes.map(a => a.athlete_id), start, end)
    if (meals.state !== 'ready' || !current()) return null
    return { from: start, through: end, athletes, meals: meals.rows }
  } catch { return null }
}

export async function readCoachNutrition(client, context) {
  return readNutrition(client, context, () => true)
}

// Effektens krop: starter kun en læsning med flaget tændt, en klient og en gyldig kontekst.
// Returnerer en annullering; et svar efter annullering afleveres aldrig.
export function startCoachNutritionRead({ enabled, client, readContext }, onResult) {
  if (enabled !== true || !client || !validContext(readContext)) return undefined
  let current = true
  const captured = capture(readContext)
  const active = () => current && sameScope(readContext, captured)
  readNutrition(client, captured, active).then(async batch => {
    if (!active()) return
    onResult({ context: readContext, batch })
    // Profillinjen vises straks; kostplanen kommer som en opgradering, hvis den findes.
    if (batch?.state !== 'ready' || batch.complete !== true || !batch.athleteIds.length) return
    const plan = await readCoachPlanBasis(client, captured, active)
    if (plan && active()) onResult({ context: readContext, batch: { ...batch, plan } })
  }, () => { if (active()) onResult({ context: readContext, batch: undefined }) })
  return () => { current = false }
}

// Et afleveret svar gives kun videre, så længe det hører til netop det readContext-objekt,
// læsningen startede med. Ny kontekst kræver et nyt afsluttet svar.
export function selectCoachNutrition(result, enabled, readContext) {
  return enabled === true && !!readContext && result?.context === readContext &&
    sameScope(readContext, result.batch ?? {}) ? result.batch : undefined
}

export function useEntropi2CoachNutrition({ enabled, client, readContext }) {
  const [result, setResult] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const scope = enabled === true && validContext(readContext) ? JSON.stringify(capture(readContext)) : null
  useEffect(() => startCoachNutritionRead({ enabled, client, readContext },
    value => setResult({ ...value, client })), [enabled, client, readContext, scope, attempt])
  const batch = selectCoachNutrition(result?.client === client ? result : null, enabled, readContext)
  // En fejlet laesning kan hentes igen fra coachens overblik (K-R3-ENTROPI-SAMLET fund 3).
  return batch && batch.state !== 'ready' ? { ...batch, reload: () => setAttempt(n => n + 1) } : batch
}
