import { createNutritionController } from '../../nutrition/controller.mjs'
import { mountNutrition } from '../../nutrition/view.mjs'
import { createAthleteDay, mealKey } from './dayModel.mjs'
import { trackerReceipts, sameLoggedMeal } from './trackerReceipts.mjs'

// Reuse the whole existing kcal tracker, including its log, update/remove,
// food portions, favorites and failure UI. Persistence functions are injected.
// Existing nutrition CSS belongs to the assembly, as for mountNutrition itself.
export function mountExistingTracker(host, options = {}) {
  if (options.enabled !== true) return () => {}
  const { athlete, date, contracts, storage, foods, currentDay, onDayChanged, ...view } = options
  const controller = createNutritionController({ enabled: true, athlete, date,
    contracts, storage, foods, currentDay, onDayChanged })
  try { return mountNutrition(host, controller, view) }
  catch (error) { controller.dispose(); throw error }
}

// Assembly seam: loadPlan is an explicit projection of an already available
// active plan, or null when unavailable. No new table, query or activation is
// invented here. Pass the SAME existing nutrition contracts to trackerOptions.
export function createTrackedAthleteDay(options = {}) {
  if (options.enabled !== true) return null
  const { athleteId, date, contracts, storage, currentDay, loadPlan = async () => null } = options
  const writable = typeof contracts?.saveWithIdentity === 'function'
    && typeof storage?.getItem === 'function' && typeof storage?.setItem === 'function'
  const receipts = writable ? trackerReceipts(storage, athleteId, date) : null
  let loadedPlan = null, loadedLogs = [], seen = new Map(), disposed = false, loadToken = 0
  const scopedLogs = async () => {
    const rows = await contracts.load(athleteId, date)
    if (!Array.isArray(rows) || rows.some(row => row?.athlete_id !== athleteId || row.date > date))
      throw new Error('Forkert kostlog')
    return rows
  }
  const entryKey = mealId => mealKey(athleteId, date, loadedPlan, mealId)
  const loadDay = async () => {
    const token = ++loadToken
    const plan = structuredClone(await loadPlan({ athleteId, date }))
    if (plan === null || plan?.active === false) return { plan }
    const logs = await scopedLogs(), entries = receipts?.read() || []
    const eaten = [], blockedMeals = []
    for (const meal of plan.meals) {
      const entry = entries.find(item => item.key === mealKey(athleteId, date, plan, meal.id))
      if (!entry) continue
      const row = logs.find(row => row.id === entry.log_id && row.date === date)
      if (entry.state === 'pending' || (row && !sameLoggedMeal(row, entry))) blockedMeals.push(meal.id)
      else if (row) eaten.push({ key: entry.key, meal_id: meal.id, log_id: row.id, foods: entry.foods })
      // A confirmed row removed through the existing tracker is no longer eaten.
    }
    if (!disposed && token === loadToken) {
      loadedPlan = plan; loadedLogs = logs
      seen = new Map(entries.map(entry => [entry.key, JSON.stringify(entry)]))
    }
    return { plan, logs, eaten, blockedMeals }
  }
  const saveMeal = async payload => {
    if (disposed || payload.athlete_id !== athleteId || payload.date !== date
      || payload.key !== entryKey(payload.meal_id)) throw new Error('Forkert dagsplan')
    const entries = receipts.read(), existing = entries.find(entry => entry.key === payload.key)
    // Detect another session's reservation before sending any insert.
    if (JSON.stringify(existing) !== seen.get(payload.key) || existing?.state === 'pending'
      || (existing && loadedLogs.some(row => row.id === existing.log_id && row.date === date)))
      throw new Error('Måltidet skal kontrolleres i kostloggen')
    const entry = { key: payload.key, meal_id: payload.meal_id, plan_id: payload.plan_id,
      plan_revision: payload.plan_revision, state: 'pending', foods: payload.foods.map(({ id, grams }) => ({ id, grams })),
      log: { ...payload.log } }
    const next = entries.filter(item => item.key !== payload.key)
    // Reserve on the athlete's click, BEFORE the existing tracker insert. A
    // failed reservation performs no diary write and is safe to retry.
    try { receipts.write([...next, entry]) } catch { return false }
    const result = await contracts.saveWithIdentity({ athlete_id: athleteId, date, ...payload.log })
    // The production contract cannot distinguish a lost response from a rejected
    // insert. Keep pending on any unconfirmed result; never automatically retry.
    if (result?.ok !== true || typeof result.id !== 'string' || !result.id.trim()
      || result.id.length > 200 || result.id.startsWith('local:')
      || loadedLogs.some(row => row.id === result.id)) throw new Error('Gemningen er uafklaret')
    // Re-read to preserve another meal's receipt from a different session.
    const current = receipts.read()
    if (JSON.stringify(current.find(item => item.key === entry.key)) !== JSON.stringify(entry))
      throw new Error('Kvitteringen er ændret')
    if (current.some(item => item.state === 'confirmed' && item.log_id === result.id))
      throw new Error('Kostloggen returnerede et genbrugt id')
    receipts.write(current.map(item => item.key === entry.key ? { ...entry, state: 'confirmed', log_id: result.id } : item))
    if (!disposed) {
      seen.set(entry.key, JSON.stringify({ ...entry, state: 'confirmed', log_id: result.id }))
      loadedLogs = [...loadedLogs, { athlete_id: athleteId, date, id: result.id, ...payload.log }]
    }
    return true
  }
  const releaseMeal = async ({ mealId }) => {
    if (disposed || !loadedPlan) return false
    const key = entryKey(mealId), entries = receipts.read(), entry = entries.find(item => item.key === key)
    if (!entry) return false
    const logs = await scopedLogs()
    // A known row must be removed via the ordinary tracker, never by this action.
    if (disposed || (entry.log_id && logs.some(row => row.id === entry.log_id))) return false
    const current = receipts.read()
    if (JSON.stringify(current.find(item => item.key === key)) !== JSON.stringify(entry)) return false
    receipts.write(current.filter(item => item.key !== key))
    return true
  }
  const model = createAthleteDay({ enabled: true, athleteId, date, loadDay, currentDay,
    saveMeal: writable ? saveMeal : undefined, releaseMeal: writable ? releaseMeal : undefined })
  const dispose = model.dispose
  return { ...model, dispose() { disposed = true; loadToken++; loadedPlan = null; loadedLogs = []; seen.clear(); dispose() } }
}
