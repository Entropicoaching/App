import { antalOrd } from '../../antalOrd.mjs'
import { calendarDay } from '../../../calendarDate.js'
import { buildNutritionReport } from '../../kostplan/rapport/nutritionReport.mjs'

const number = value => value > 0 && value < 0.1 ? '<0,1'
  : new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1 }).format(value)
const identity = value => typeof value === 'string' && value.trim().length > 0
const day = value => typeof value === 'string' && calendarDay(value) === value

// Observations, never a recovery score or a claim about causes. Native
// readiness_logs soreness_level is 1–5, unlike coachuge's soreness (0–10).
function recoveryContext(data, from, asOf) {
  const rows = data.recoveryDays
  if (!Array.isArray(rows) || rows.length > 7 || !rows.every(row => row
    && row.source === 'athlete_manual' && day(row.day) && row.day >= from && row.day <= asOf)
    || new Set(rows.map(row => row.day)).size !== rows.length) return null
  const metrics = [['energy', 'energi'], ['stress', 'stress'], ['sorenessLevel', 'ømhed']].flatMap(([key, title]) => {
    if (rows.some(row => row[key] != null && (!Number.isInteger(row[key]) || row[key] < 1 || row[key] > 5))) return []
    const known = rows.filter(row => row[key] != null)
    if (!known.length) return []
    const value = known.length >= 4 ? known.reduce((sum, row) => sum + row[key], 0) / known.length : null
    return [{ key, title, sampleCount: known.length, value }]
  })
  if (!metrics.length) return null
  const observations = metrics.map(m => m.value === null
    ? `${m.title}: ${m.sampleCount}/7 dage, for lidt til et ugesnit`
    : `${m.title}: ${number(m.value)}/5 i gennemsnit på ${m.sampleCount}/7 dage`)
  return { id: 'recovery', title: 'Restitution', from, to: asOf,
    source: 'readiness_logs: atletens egne registreringer', minimumSampleCount: 4,
    metrics, text: `Om din restitution har du registreret ${observations.join('; ')} (${from} – ${asOf}). Det er observationer, ikke en samlet vurdering af din restitution.` }
}

function nutritionContext(data) {
  const receipt = data.nutritionRead
  // Use only the existing complete, coach/athlete/day-bound report contract.
  // The current conversation host has no receipt: no query, plan or goal is invented.
  if (receipt == null) return null
  if (receipt.state !== 'ready' || receipt.complete !== true
    || !identity(data.coachId) || receipt.coachId !== data.coachId
    || receipt.athleteId !== data.athleteId || receipt.date !== data.asOf) throw Error('Ugyldigt kostgrundlag')
  try {
    const report = buildNutritionReport({ enabled: true, athleteId: data.athleteId, date: data.asOf,
      plans: receipt.planHistory === 'unavailable' ? [] : receipt.plans,
      mealLogs: receipt.mealLogs, weightLogs: receipt.weightLogs })
    if (!report.week.loggedDays) return null
    const metrics = ['kcal', 'protein'].flatMap(key => {
      const metric = report.week.metrics[key]
      if (metric.actual === null) return []
      const unit = key === 'kcal' ? 'kcal' : 'g protein'
      const comparison = metric.target === null ? 'uden kendt, entydigt dateret mål'
        : `mod ${number(metric.target)} ${unit} i daterede planmål for de samme loggede dage (${metric.percent === null ? 'procent ukendt' : `${number(metric.percent)} %`})`
      return [{ key, ...metric, text: `${number(metric.actual)} ${unit} ${comparison}` }]
    })
    if (!metrics.length) return null
    return { id: 'nutrition', title: 'Kost i forhold til plan', from: report.from, to: report.date,
      source: 'kostplan/rapport: måltidslog og dateret planhistorik',
      sampleCount: report.week.loggedDays, elapsedDays: report.week.elapsedDays, metrics,
      text: `Du har logget måltider på ${report.week.loggedDays}/${report.week.elapsedDays} ${antalOrd(report.week.elapsedDays, 'dag', 'dage')} (${report.from} – ${report.date}): ${metrics.map(m => m.text).join('; ')}. Loggen viser ikke nødvendigvis hele dit indtag, og dage uden log er ukendte.` }
  } catch {
    // Failed/invalid supplied reads are errors, not authoritatively empty reads.
    throw Error('Kostgrundlaget kunne ikke bruges')
  }
}

export function weeklyLetterContext(data, evaluation) {
  const { from, asOf } = evaluation
  const sleep = evaluation.sections.find(section => section.id === 'sleepHours')
  const contexts = []
  if (sleep.dataBasis.sampleCount > 0) {
    const count = sleep.dataBasis.sampleCount, value = sleep.value
    contexts.push({ id: 'sleep', title: 'Søvn', from, to: asOf, sampleCount: count,
      minimumSampleCount: 4, value, source: 'atletens egne søvnregistreringer',
      text: value === null
        ? `Du har registreret søvn på ${count}/7 dage (${from} – ${asOf}); det er for lidt til et ugesnit.`
        : `Din registrerede søvn var i gennemsnit ${number(value)} ${antalOrd(value, 'time', 'timer')} på ${count}/7 dage (${from} – ${asOf}). Dage uden registrering er ukendte.` })
  }
  const recovery = recoveryContext(data, from, asOf), nutrition = nutritionContext(data)
  if (recovery) contexts.push(recovery)
  if (nutrition) contexts.push(nutrition)
  return contexts
}
