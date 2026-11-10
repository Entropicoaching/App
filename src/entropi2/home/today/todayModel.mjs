import { calendarDay, addCalendarDays } from '../../../calendarDate.js'
import { parseInputNumber, optionalInput } from '../../../inputValues.js'
import { isDayReceipt } from '../../../mealEvidence.mjs'
import { mealTemplateItems } from '../../../athlete/kostSkabeloner.mjs'
import { fixedRepsEntry } from '../../../fixedRepsEntry.js'

// U5: rene beregninger bag "I dag"-kortet. Ingen skrivninger og ingen nye tabeller;
// alt kommer fra weight_logs, readiness_logs, meal_logs og exercise_logs, som appen allerede bruger.

const validDay = day => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && calendarDay(day) === day
const own = (row, athleteId) => row && row.athlete_id === athleteId && !row._optimistic

export function formatKg(value) {
  const n = parseInputNumber(value)
  return n == null ? '' : (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, '').replace('.', ',')
}

// ±0,1 kg uden flydende kommatal-støj.
export function stepKg(value, delta) {
  const n = parseInputNumber(value)
  if (n == null) return null
  const next = Math.round((n + delta) * 10) / 10
  return next > 0 ? next : null
}

// Seneste vægt før i dag; forslaget til ét tryk.
export function latestWeight(weightLogs, athleteId, today) {
  if (!Array.isArray(weightLogs) || !athleteId || !validDay(today)) return null
  const rows = weightLogs.filter(row => own(row, athleteId) && validDay(row.logged_at) && row.logged_at < today &&
    parseInputNumber(row.weight) > 0).sort((a, b) => a.logged_at < b.logged_at ? 1 : -1)
  return rows.length ? Math.round(parseInputNumber(rows[0].weight) * 10) / 10 : null
}

export function weightDone(weightLogs, athleteId, today) {
  return Array.isArray(weightLogs) && weightLogs.some(row => own(row, athleteId) && row.logged_at === today &&
    parseInputNumber(row.weight) > 0)
}

export function readinessDone({ readinessLog, trackingData, athleteId, today }) {
  if (own(readinessLog, athleteId) && readinessLog.logged_date === today) return true
  return trackingData?.status === 'ready' && trackingData.athleteId === athleteId && trackingData.today === today &&
    Array.isArray(trackingData.readinessRows) &&
    trackingData.readinessRows.some(row => own(row, athleteId) && row.logged_date === today)
}

// Dagsform på ét tryk: energi er dagens svar; motivation, stress og ømhed kommer fra
// den seneste række de sidste 7 dage (ikke kun i går). Søvn kopieres aldrig.
// Et påbegyndt udkast overskrives aldrig.
export function readinessSuggestion({ athleteId, today, trackingData, readinessLog, readinessInput }) {
  if (!athleteId || !validDay(today) || trackingData?.status !== 'ready' || trackingData.complete !== true ||
      trackingData.athleteId !== athleteId || trackingData.today !== today || !Array.isArray(trackingData.readinessRows)) return null
  if (readinessDone({ readinessLog, trackingData, athleteId, today })) return null
  if (['sleep', 'energy', 'motivation', 'stress', 'soreness'].some(key => !optionalInput(readinessInput?.[key]))) return null
  const from = addCalendarDays(today, -7)
  const rows = trackingData.readinessRows.filter(row => own(row, athleteId) && validDay(row.logged_date) &&
    row.logged_date < today && row.logged_date >= from).sort((a, b) => a.logged_date < b.logged_date ? 1 : -1)
  if (!rows.length) return null
  const scores = Object.fromEntries(['motivation', 'stress', 'soreness_level'].map(key => [key, parseInputNumber(rows[0][key])]))
  if (Object.values(scores).some(value => !Number.isInteger(value) || value < 1 || value > 5)) return null
  return { from: rows[0].logged_date, motivation: String(scores.motivation), stress: String(scores.stress),
    soreness: String(scores.soreness_level) }
}

// Dagens og gårsdagens måltider fra meal_logs. Dagskvitteringer tæller ikke som mad.
export function mealsModel(rows, athleteId, today) {
  if (!Array.isArray(rows) || !athleteId || !validDay(today)) return { status: 'error' }
  const yesterdayDay = addCalendarDays(today, -1)
  const meals = rows.filter(row => own(row, athleteId) && !isDayReceipt(row))
  const yesterday = meals.filter(row => row.date === yesterdayDay && mealTemplateItems([row]))
    .map(row => ({ meal: row.meal, kcal: row.kcal, protein: row.protein, carb: row.carb, fat: row.fat }))
  return { status: 'ready', today: meals.filter(row => row.date === today).length, yesterday }
}

// Første sæt uden coachens vægt forudfyldes med sidste pas for samme øvelse.
// Et allerede udfyldt felt eller en coachvægt bevares altid.
export function firstSetPrefill(exercises, lastByName, logInputs = {}) {
  const out = {}
  if (!Array.isArray(exercises) || !lastByName) return out
  for (const ex of exercises) {
    const key = `${ex?.id}_1`
    if (!ex?.id || typeof ex.name !== 'string') continue
    const given = v => v != null && String(v).trim() !== ''
    if (given(ex.recommended_weight) || given(logInputs?.[key]?.weight)) continue
    const last = lastByName[ex.name.trim().toLowerCase()]
    const weight = parseInputNumber(last?.weight)
    if (weight == null || weight < 0) continue
    const reps = fixedRepsEntry(ex.reps) ?? (Number.isInteger(last.reps_completed) && last.reps_completed > 0 ? String(last.reps_completed) : '')
    out[key] = { ...(logInputs?.[key] || {}), weight: String(weight), reps: given(logInputs?.[key]?.reps) ? logInputs[key].reps : reps }
  }
  return out
}

const names = { weight: 'vægt', readiness: 'dagsform', training: 'træning', meal: 'mad' }
export function joinDanish(words) {
  return words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} og ${words[words.length - 1]}`
}

// Rækkefølgen er fast: vægt, dagsform, træning, mad. Træning tæller kun, når der er et pas i dag.
export function todayItems({ weight, readiness, training, meal }) {
  const items = []
  if (weight) items.push({ key: 'weight', done: weight.done === true })
  if (readiness) items.push({ key: 'readiness', done: readiness.done === true })
  if (training?.kind === 'today' || training?.kind === 'done' && training.today === true)
    items.push({ key: 'training', done: training.kind === 'done' || training.total > 0 && training.logged >= training.total })
  if (meal && meal.status === 'ready') items.push({ key: 'meal', done: meal.today > 0 })
  const missing = items.filter(item => !item.done).map(item => item.key)
  const done = items.filter(item => item.done).map(item => item.key)
  return { items, missing, done,
    headline: !items.length ? null : missing.length ? `Mangler i dag: ${joinDanish(missing.map(key => names[key]))}` : 'Alt er logget i dag',
    doneLine: done.length && missing.length ? `Klaret: ${joinDanish(done.map(key => names[key]))}` : null }
}
