import { load } from '../load.mjs'
import { buildStrengthTrend } from '../strengthTrend.mjs'
import { nutritionTrend } from '../nutritionTrend.mjs'
import { weightTrend } from '../weightTrend.mjs'
import { uniqueSets } from '../../analysis/weeklyLoad.mjs'
import { calendarDay, addCalendarDays } from '../../../calendarDate.js'

export const FIELDS = Object.freeze([
  Object.freeze({ key: 'sleep_hours', label: 'Søvn', unit: 'timer', min: 0, max: 24 }),
  Object.freeze({ key: 'energy', label: 'Energi', unit: 'af 5 (5 højest)', min: 1, max: 5 }),
  Object.freeze({ key: 'stress', label: 'Stress', unit: 'af 5 (5 højest)', min: 1, max: 5 }),
  Object.freeze({ key: 'soreness', label: 'Ømhed', unit: 'af 10 (0 ingen)', min: 0, max: 10 }),
])
const validDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && calendarDay(value) === value
const mean = values => values.length ? values.reduce((s, v) => s + v / values.length, 0) : null
const sum = values => {
  if (!values.length || values.some(v => v === null)) return null
  const value = values.reduce((s, v) => s + v, 0)
  return Number.isFinite(value) ? value : null
}
const observation = (row, field) => {
  const v = row?.[field.key]
  return typeof v === 'number' && Number.isFinite(v) && v >= field.min && v <= field.max
    && (field.key === 'sleep_hours' || Number.isInteger(v)) ? v : null
}

/** Pure, unwired view model. Explicit complete, single-athlete snapshot; no IO.
 * Daily rows are canonical athlete_manual tracking_daily_v1 projections:
 * athlete_id, logged_date, sleep_hours, energy, stress, soreness (0..10).
 * With dailySource=readiness_logs, daily rows retain source=readiness_logs and
 * native soreness_level (1..5). Never pass it as soreness. Other properties are ignored.
 * endDate is the last completed Copenhagen calendar day, chosen by the caller.
 */
export function buildAthleteOverview(input = {}, { enabled = false } = {}) {
  if (enabled !== true) return null
  if (!input || typeof input !== 'object') return { status: 'error' }
  if (input.status === 'loading') return { status: 'loading' }
  if (input.status !== 'ready' || input.complete !== true) return { status: 'error' }
  const { athleteId, endDate, dailyRows, exerciseLogs, mealRows, weightRows } = input
  const from = validDay(endDate) ? addCalendarDays(endDate, -27) : null
  if (typeof athleteId !== 'string' || !athleteId.trim() || !from) return { status: 'error' }
  const collections = [dailyRows, exerciseLogs, mealRows, weightRows]
  if (collections.some(rows => !Array.isArray(rows) || rows.some(row => !row
    || typeof row !== 'object' || row.athlete_id !== athleteId))) return { status: 'error' }
  const weightDates = new Set()
  for (const row of weightRows) {
    if (!validDay(row.logged_at)) return { status: 'error' }
    if (row.logged_at < from || row.logged_at > endDate) continue
    if (weightDates.has(row.logged_at)) return { status: 'error' }
    weightDates.add(row.logged_at)
  }
  // Legacy check-in soreness is 1..5; it is never recast as canonical 0..10.
  const readiness = input.dailySource === 'readiness_logs'
  const fields = readiness ? [...FIELDS.slice(0, 3),
    { key: 'soreness_level', label: 'Ømhed', unit: 'af 5 (5 mest)', min: 1, max: 5 }] : FIELDS
  const daily = new Map()
  for (const row of dailyRows) {
    if (!validDay(row.logged_date)) return { status: 'error' }
    if (row.logged_date < from || row.logged_date > endDate) continue
    if (row.source !== (readiness ? 'readiness_logs' : 'athlete_manual') || daily.has(row.logged_date)) return { status: 'error' }
    daily.set(row.logged_date, Object.fromEntries(fields.map(field => [field.key, observation(row, field)])))
  }
  // A final snapshot excludes optimistic and conflicting set copies for BOTH models.
  const logs = uniqueSets(exerciseLogs).filter(row => !row._optimistic
    && typeof row.logged_at === 'string' && calendarDay(row.logged_at) >= from
    && calendarDay(row.logged_at) <= endDate)
  const training = load(logs, endDate)
  const strength = buildStrengthTrend(logs, { today: endDate })
  if (!training || !strength) return { status: 'error' }
  const weights = weightTrend(weightRows, athleteId, endDate)
  const weeks = Array.from({ length: 4 }, (_, index) => {
    const start = addCalendarDays(from, index * 7), end = addCalendarDays(start, 6)
    const inWeek = date => date >= start && date <= end
    // Calling per bucket preserves the oldest days when endDate is midweek.
    // No current targets are retroactively applied to historical meals.
    const nutrition = nutritionTrend(mealRows, {}, end).days.filter(day => inWeek(day.date))
    const dates = Array.from({ length: 7 }, (_, i) => addCalendarDays(start, i))
    const wellbeing = fields.map(field => {
      const days = dates.map(date => ({ date, value: daily.get(date)?.[field.key] ?? null }))
      const known = days.filter(day => day.value !== null)
      return { key: field.key, label: field.label, unit: field.unit, days,
        count: known.length, average: known.length >= 4 ? mean(known.map(day => day.value)) : null }
    })
    const trainingDays = training.days.filter(day => inWeek(day.date)).map(day => ({
      date: day.date, sets: day.sets, tonnage: day.sets > 0 ? day.tonnage : null,
    }))
    const measuredTraining = trainingDays.filter(day => day.sets > 0)
    const weightDays = dates.map(date => ({ date,
      value: weights.daily.find(day => day.date === date)?.weight ?? null }))
    const measuredWeight = weightDays.filter(day => day.value !== null)
    return { from: start, to: end, wellbeing,
      training: { days: trainingDays, observedDays: measuredTraining.length,
        sets: sum(measuredTraining.map(day => day.sets)),
        tonnage: sum(measuredTraining.map(day => day.tonnage)),
      },
      nutrition: { days: nutrition.map(day => ({ date: day.date, kcal: day.totals.kcal,
        protein: day.totals.protein })), loggedDays: nutrition.length,
        kcal: nutrition.length && nutrition.every(day => day.totals.kcal !== null)
          ? mean(nutrition.map(day => day.totals.kcal)) : null,
        protein: nutrition.length && nutrition.every(day => day.totals.protein !== null)
          ? mean(nutrition.map(day => day.totals.protein)) : null },
      weight: { days: weightDays, count: measuredWeight.length,
        average: measuredWeight.length >= 4 ? mean(measuredWeight.map(day => day.value)) : null },
    }
  })
  const hasData = weeks.some(w => w.wellbeing.some(f => f.count) || w.training.observedDays
    || w.nutrition.loggedDays || w.weight.count)
  return { status: hasData ? 'ready' : 'empty', from, to: endDate, weeks,
    strength: strength.lifts.flatMap(lift => lift.weeks
      .filter(week => week.e1rm !== null && week.weekStart <= endDate
        && addCalendarDays(week.weekStart, 6) >= from)
      .map(week => ({ name: lift.name, weekStart: week.weekStart, e1rm: week.e1rm }))),
  }
}
