import { requireId, windowEnding } from './trackingDates.mjs'
import { summarizeWellbeing } from './wellbeing.mjs'

import { load } from './load.mjs'
import { buildStrengthTrend } from './strengthTrend.mjs'
import { nutritionTrend } from './nutritionTrend.mjs'
import { weightTrend } from './weightTrend.mjs'

// null means unavailable/partial/failed, [] means a complete empty snapshot.
// Caller must pass complete histories and rows with explicit athlete_id.
function scoped(rows, athleteId) {
  if (rows === null) return null
  if (!Array.isArray(rows)) throw new TypeError('Complete snapshot array required')
  return rows.filter(row => row?.athlete_id === athleteId)
}
const section = (data, ready) => ({ status: ready ? 'ready' : 'insufficient', data })

export function composeWeeklyReview({ enabled = false, athleteId, weekEnd,
  wellbeing = [], readiness = [], exerciseLogs = null, mealLogs = null, weightLogs = null,
  targets = null, plannedSessions = null, completedSessions = null } = {}) {
  if (enabled !== true) return null // OFF performs no validation, reads or writes.
  requireId(athleteId)
  const window = windowEnding(weekEnd, 7)
  const recovery = summarizeWellbeing({ athleteId, weekEnd, rows: wellbeing, readiness })
  const exercises = scoped(exerciseLogs, athleteId), meals = scoped(mealLogs, athleteId)
  const weights = scoped(weightLogs, athleteId)
  const loadData = exercises === null ? null : load(exercises, weekEnd)
  const strength = exercises === null ? null : buildStrengthTrend(exercises, { today: weekEnd })
  const nutrition = meals === null ? null : nutritionTrend(meals, targets, weekEnd)
  const weight = weights === null ? null : weightTrend(weights, athleteId, weekEnd)
  // Keep native result shapes, units, windows and thresholds; no scalar adapter.
  const sections = {
    load: section(loadData, loadData?.acuteChronicRatio != null),
    strength: section(strength, strength?.lifts.some(lift => lift.drop !== null)),
    nutrition: section(nutrition, nutrition?.recent?.loggedDays === 7 && nutrition.recent.belowProtein80Days !== null),
    weight: section(weight, weight?.fastChange != null),
  }
  const signals = [...recovery.signals]
  const add = (id, reason, evidence) => signals.push({ id, severity: 'attention', reason, evidence })
  if (loadData?.signal === 'belastningsspring') add('load', 'Registreret volumenforhold uden for 0,8–1,5', {
    from: loadData.days[0].date, to: weekEnd, acuteLoad: loadData.acuteLoad,
    chronicLoad: loadData.chronicLoad, value: loadData.acuteChronicRatio,
    threshold: { below: 0.8, above: 1.5 }, days: loadData.days,
  })
  for (const lift of strength?.lifts ?? []) {
    if (lift.drop !== true && lift.plateau !== true) continue
    add(`strength:${lift.key}`, lift.drop ? `${lift.name}: e1RM faldet mere end 5 %` : `${lift.name}: tre afsluttede uger uden ny top`, {
      from: strength.windowStart, to: strength.completedThrough, key: lift.key,
      weeks: lift.weeks, slopeKgPerWeek: lift.slopeKgPerWeek, dropPercent: lift.dropPercent,
      threshold: { dropPercent: 5, plateauWeeks: 3 },
    })
  }
  if (nutrition?.signal === 'lavt protein') add('nutrition', 'Registreret protein under 80 % af nuværende mål på mindst fire af syv loggede datoer', {
    from: nutrition.recent.dates[0], to: nutrition.recent.dates.at(-1), ...nutrition.recent,
    target: targets?.protein_target, targetBasis: 'current', threshold: { percent: 80, days: 4 },
  })
  if (weight?.fastChange === true) add('weight', 'Ugevægt ændret mere end 1 % i samme retning i to uger; sammenhold med mål', {
    ...windowEnding(weekEnd, 21), weeklyChange: weight.weeklyChange,
    previousWeeklyChange: weight.previousWeeklyChange, daily: weight.daily, threshold: 1,
  })
  let compliance = { status: 'insufficient', percent: null, planned: null, completed: null }
  if (plannedSessions !== null && completedSessions !== null) {
    if (!Number.isInteger(plannedSessions) || !Number.isInteger(completedSessions) || plannedSessions < 0 || completedSessions < 0 || completedSessions > plannedSessions) throw new TypeError('Invalid session counts')
    compliance = { status: plannedSessions > 0 ? 'ready' : 'notPlanned', percent: plannedSessions > 0 ? completedSessions / plannedSessions * 100 : null, planned: plannedSessions, completed: completedSessions }
    if (plannedSessions > 0 && compliance.percent < 75) signals.push({ id: 'compliance', severity: 'attention', reason: 'Under 75 % af planlagte pas bekræftet gennemført', evidence: { ...window, planned: plannedSessions, completed: completedSessions, threshold: 75 } })
  }
  signals.sort((a, b) => Number(b.severity === 'priority') - Number(a.severity === 'priority') || a.id.localeCompare(b.id))
  const readyCount = Object.values(sections).filter(section => section.status === 'ready').length + Object.values(recovery.metrics).filter(metric => metric.status === 'ready').length
  return { athleteId, window, sections, recovery, compliance, signals,
    status: signals.some(signal => signal.severity === 'priority') ? 'reviewPain' : signals.length ? 'review' : readyCount === 10 && compliance.status === 'ready' ? 'noFlags' : 'insufficient',
    planning: { automaticChanges: false, reviewSignalIds: signals.map(signal => signal.id) } }
}
