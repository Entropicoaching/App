import { addCalendarDays, calendarDay } from '../../../calendarDate.js'
import { nutritionContracts } from '../../nutrition/contracts.mjs'
import { mealsModel } from './todayModel.mjs'
import { iGaarMedPlannavne } from '../../kostplan/atlet/kostIDagModel.mjs'
import { navnNoegle } from '../../kostplan/friPulje.mjs'

// U5: samme klient og samme tabeller som appen bruger i dag (meal_logs og exercise_logs).
// Klienten hentes først, når kortet er monteret med flaget; prøver giver en syntetisk klient.
const appClient = async client => client ?? (await import('../../../supabase.js')).supabase
const MEAL_CAP = 200

export async function readTodayMeals({ athleteId, today, client } = {}) {
  const from = addCalendarDays(today, -1)
  if (typeof athleteId !== 'string' || !athleteId || calendarDay(today) !== today || !from) return { status: 'error' }
  try {
    const database = await appClient(client)
    const result = await database.from('meal_logs').select('id,athlete_id,date,meal,kcal,protein,carb,fat')
      .eq('athlete_id', athleteId).gte('date', from).lte('date', today).limit(MEAL_CAP)
    if (result?.error || !Array.isArray(result?.data) || result.data.length >= MEAL_CAP) return { status: 'error' }
    return mealsModel(result.data, athleteId, today)
  } catch { return { status: 'error' } }
}

// Ordre 1690: dagens godkendte kostplan med den samme læser, som Kost bruger (planAdapter.loadActive).
// Kun antal måltider og planens kcal. Ingen plan, manglende tabeller eller fejl giver null,
// så Mad-rækken bevarer sin gamle tekst og aldrig viser en fejl.
export async function readTodayPlan({ athleteId, today, client } = {}) {
  if (typeof athleteId !== 'string' || !athleteId || calendarDay(today) !== today) return null
  try {
    const { createPlanAdapter } = await import('../../kostplan/planAdapter.mjs')
    const plan = await createPlanAdapter({ enabled: true, athleteId, date: today, client: await appClient(client) }).loadActive()
    if (!plan || !Array.isArray(plan.meals) || !plan.meals.length) return null
    const kcal = Number.isFinite(plan.targets?.kcal) && plan.targets.kcal > 0 ? Math.round(plan.targets.kcal) : null
    return { athleteId, today, meals: plan.meals.length, kcal, names: plan.meals.map(meal => String(meal?.name ?? '')) }
  } catch { return null }
}

export function planLine(plan) {
  if (!plan || !Number.isSafeInteger(plan.meals) || plan.meals < 1) return null
  const meals = `${plan.meals} ${plan.meals === 1 ? 'måltid' : 'måltider'}`
  return `Din kostplan i dag: ${meals}${plan.kcal ? `, ${plan.kcal.toLocaleString('da-DK')} kcal` : ''}.`
}

// 2353: for en kostklient kopieres i går som Kost i dags "Alt fra i går" (KostIDag.mjs, iGaarMedPlannavne),
// så rækkerne får plannavne og tæller som base, ikke som uplanlagt mad i den frie pulje. Et planmåltid, der
// allerede er logget i dag, kopieres ikke igen (samme navnenøgle som friPulje.mjs). Uden plan: listen som før.
export function yesterdayToCopy(yesterday, planNames, todayNames) {
  const list = Array.isArray(yesterday) ? yesterday : []
  if (!Array.isArray(planNames) || !planNames.length) return list
  const covered = new Map()
  for (const name of todayNames ?? []) covered.set(navnNoegle(name), (covered.get(navnNoegle(name)) ?? 0) + 1)
  const taken = new Map(), free = []
  for (const name of planNames) {
    const key = navnNoegle(name)
    if ((covered.get(key) ?? 0) > (taken.get(key) ?? 0)) taken.set(key, (taken.get(key) ?? 0) + 1)
    else free.push(name)
  }
  const rest = list.filter(meal => {
    const key = navnNoegle(meal?.meal)
    if (!(taken.get(key) > 0)) return true
    taken.set(key, taken.get(key) - 1)
    return false
  })
  return iGaarMedPlannavne(rest, free)
}

// Gårsdagens måltider gemmes som nye rækker i dag gennem kostens eksisterende save-kontrakt.
// Stopper ved første fejl og siger, hvor mange der nåede frem.
// 2353: withIds gemmer med saveWithIdentity (som kostloggens fortrydelse), så hele gruppen kan fortrydes.
export async function copyYesterdayMeals({ athleteId, today, meals, client, withIds = false } = {}) {
  let saved = 0
  const ids = []
  try {
    const contracts = nutritionContracts({ client: await appClient(client) })
    for (const meal of meals || []) {
      const row = { ...meal, athlete_id: athleteId, date: today }
      if (withIds) {
        const result = await contracts.saveWithIdentity(row)
        if (result?.ok !== true) break
        if (result.id) ids.push(result.id)
      } else if (await contracts.save(row) !== true) break
      saved++
    }
  } catch { /* saved viser, hvor langt den nåede */ }
  return withIds ? { saved, total: (meals || []).length, ids } : { saved, total: (meals || []).length }
}

// 2353: Fortryd for hele gruppen med kostloggens egen sletning (samme remove, som undoRows i Kost i dag bruger).
export async function undoCopiedMeals({ athleteId, today, ids, client } = {}) {
  let removed = 0
  try {
    const contracts = nutritionContracts({ client: await appClient(client) })
    for (const id of ids || []) if (await contracts.remove({ id, athlete_id: athleteId, date: today }) === true) removed++
  } catch { /* removed viser, hvor mange der blev fjernet */ }
  return removed
}

// Seneste vægt og reps pr. øvelsesnavn, som fetchLastLogs i appen.
export async function readLastWeights({ athleteId, client } = {}) {
  if (typeof athleteId !== 'string' || !athleteId) return null
  try {
    const database = await appClient(client)
    const result = await database.from('exercise_logs').select('weight, reps_completed, logged_at, skipped, exercises(name)')
      .eq('athlete_id', athleteId).order('logged_at', { ascending: false }).limit(500)
    if (result?.error || !Array.isArray(result?.data)) return null
    const map = {}, days = {}
    for (const log of result.data) {
      const name = log?.exercises?.name
      if (typeof name !== 'string' || log.skipped || !(log.weight > 0)) continue
      const k = name.trim().toLowerCase(), day = typeof log.logged_at === 'string' ? calendarDay(log.logged_at) : null
      if (!map[k]) { map[k] = { weight: log.weight, reps_completed: log.reps_completed, top: log.weight }; days[k] = day }
      // U7: top er det tungeste sæt af navnet samme dag som det seneste, så et backoff
      // med samme navn ikke bliver "sidst" for topsættet. Bruges kun bag U7-flaget.
      else if (day && day === days[k] && Number(log.weight) > Number(map[k].top)) map[k].top = log.weight
    }
    return map
  } catch { return null }
}
