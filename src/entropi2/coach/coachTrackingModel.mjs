import { load } from '../tracking/load.mjs'
import { nutritionTrend } from '../tracking/nutritionTrend.mjs'
import { weightTrend } from '../tracking/weightTrend.mjs'
import { buildAthleteSignalList } from '../tracking/signaler/athleteSignals.mjs'
import { addCalendarDays } from '../../calendarDate.js'

// Only completed, owner/day/roster-scoped reads from coachHomeModel and
// weeklyReportModel enter this adapter. No new read, profile cache or clock.
export function coachTrackingModel(props, context, athlete, reportRow, cardWeight) {
  const id = athlete.id, day = context.day
  const outputs = []
  const add = (source, key, reason, from, to, sampleCount, minimumSampleCount, summary) => outputs.push({
    athleteId: id, source, signals: [{ key, subject: 'weekly', strength: 'obs', reason,
      dataBasis: { sufficient: true, from, to, sampleCount, minimumSampleCount, summary } }] })
  const logs = context.logs.complete ? context.logs.rows.filter(row => row.athlete_id === id && !row._optimistic) : []
  const training = context.logs.complete ? load(logs, day) : null
  if (training?.signal === 'belastningsspring') {
    add('belastning', 'load.change', 'Registreret belastning har ændret sig', addCalendarDays(day, -27), day,
      training.days.filter(row => row.sets > 0).length, 4,
      `7 dage: ${Math.round(training.acuteLoad)} kg × reps; 28-dages ugesnit: ${Math.round(training.chronicLoad)} kg × reps`)
  }
  // reportRow.nutrition exists only after validating the entire nutrition receipt.
  if (reportRow?.nutrition && Array.isArray(props.coachNutrition?.rows) && Array.isArray(props.coachNutrition?.targets)) {
    const source = props.coachNutrition
    const meals = source.rows.filter(row => row.athlete_id === id)
    const target = source.targets.find(row => row.athlete_id === id)
    const nutrition = nutritionTrend(meals, target, day, { projection: 'kcal-protein' })
    if (nutrition.signal) {
      const dates = nutrition.recent.dates
      add('kost', 'nutrition.protein', 'Lavt protein i de seneste 7 loggede dage', dates[0], dates.at(-1),
        dates.length, 7, `${nutrition.recent.belowProtein80Days}/7 loggede dage under 80 % af proteinmålet`)
    }
  }
  let weight
  if (cardWeight?.athleteId === id && cardWeight.day === day && cardWeight.state === 'ready' &&
    cardWeight.complete === true && cardWeight.from === addCalendarDays(day, -13) && cardWeight.through === day &&
    Array.isArray(cardWeight.points)) {
    const seen = new Set()
    const valid = cardWeight.points.every(point => point && typeof point.kg === 'number' &&
      Number.isFinite(point.kg) && point.kg > 0 && typeof point.day === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(point.day) && addCalendarDays(point.day, 0) === point.day &&
      point.day >= cardWeight.from && point.day <= day && !seen.has(point.day) && seen.add(point.day))
    if (valid) {
      const trend = weightTrend(cardWeight.points.map(point => ({ athlete_id: id,
        logged_at: point.day, weight: point.kg })), id, day)
      if (trend.weeklyChange) {
        const kg = Math.round(trend.weeklyChange.kg * 10) / 10
        weight = { deltaKg: kg, text: `Vægttrend ${kg > 0 ? '+' : ''}${(kg === 0 ? 0 : kg).toFixed(1).replace('.', ',')} kg · ugesnit` }
      }
    }
  }
  return { signals: buildAthleteSignalList({ enabled: true, athleteId: id, outputs }), weight }
}

export function hasReportValues(report, athleteId) {
  if (report?.ready !== true || !Array.isArray(report.rows)) return false
  const matches = report.rows.filter(row => row?.athlete?.id === athleteId)
  if (matches.length !== 1) return false
  const row = matches[0]
  return [row.training?.completed, row.training?.planned].some(value => Number.isSafeInteger(value) && value >= 0) ||
    Number.isSafeInteger(row.nutrition?.logged) && row.nutrition.logged >= 0 && row.nutrition.logged <= 7
}
