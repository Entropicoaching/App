import { addCalendarDays, calendarDay } from '../../../calendarDate.js'
import { nutritionContracts } from '../../nutrition/contracts.mjs'
import { mealsModel } from './todayModel.mjs'

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

// Gårsdagens måltider gemmes som nye rækker i dag gennem kostens eksisterende save-kontrakt.
// Stopper ved første fejl og siger, hvor mange der nåede frem.
export async function copyYesterdayMeals({ athleteId, today, meals, client } = {}) {
  let saved = 0
  try {
    const contracts = nutritionContracts({ client: await appClient(client) })
    for (const meal of meals || []) {
      if (await contracts.save({ ...meal, athlete_id: athleteId, date: today }) !== true) break
      saved++
    }
  } catch { /* saved viser, hvor langt den nåede */ }
  return { saved, total: (meals || []).length }
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
