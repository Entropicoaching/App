import { addCalendarDays } from '../../calendarDate.js'
import { activityDay } from '../../dashboard/coachInactive.mjs'
import { isDay } from '../tracking/visning/trackingContract.mjs'
import { coachTrackingModel } from './coachTrackingModel.mjs'
import { weeklyReportModel } from './weeklyReportModel.mjs'

const token = value => typeof value === 'string' && value.length > 0
  && value.length <= 120 && value === value.trim()
const ids = values => Array.isArray(values) && values.length <= 10000
  && Array.from(values).every(token) && new Set(values).size === values.length
const sameIds = (a, b) => ids(a) && ids(b) && a.length === b.length
  && a.every(id => b.includes(id))
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0

// Only existing owner/day/roster-scoped list reads. No coachAnalysis snapshot,
// new read, private domain or inference of four complete calendar weeks.
export function coachTeamModel(options = {}) {
  if (options.enabled !== true) return null
  const { props = {}, context = {} } = options
  const day = context.day, receipt = props.readContext, owner = props.session?.user?.id
  const rosterIds = Array.isArray(props.athletes) ? props.athletes.map(a => a?.id) : null
  if (!context.rosterReady || !isDay(day) || !token(owner) || props.loading || props.loadError
    || receipt?.coachId !== owner || receipt.day !== day
    || !sameIds(receipt.athleteIds, rosterIds) || !Array.isArray(context.athletes)) return null
  const visibleIds = context.athletes.map(a => a.id)
  if (!ids(visibleIds) || visibleIds.some(id => !rosterIds.includes(id))) return null
  if (!visibleIds.length) return null
  const report = weeklyReportModel(props, day), from = addCalendarDays(day, -27)
  const athletes = context.athletes.flatMap(athlete => {
    const rows = context.logs.complete ? context.logs.rows.filter(row =>
      row.athlete_id === athlete.id && row.skipped !== true && !row._optimistic) : []
    const trainingDays = context.logs.complete ? new Set(rows.map(row => activityDay(row.logged_at))
      .filter(date => date && date >= from && date <= day)).size : null
    const reportRow = report.rows.find(row => row.athlete.id === athlete.id)
    const nutritionDays = reportRow?.nutrition?.logged ?? null
    // A successful empty read is still no reason to add an empty team section.
    if (!(trainingDays > 0 || nutritionDays > 0)) return []
    const derived = coachTrackingModel(props, context, athlete, reportRow)
    return [{ athleteId: athlete.id, name: athlete.name,
      signalCount: derived.signals.length, trainingDays, nutritionDays }]
  })
  athletes.sort((a, b) => b.signalCount - a.signalCount || compare(a.athleteId, b.athleteId))
  return athletes.length ? { asOf: day, trainingFrom: from,
    nutritionFrom: addCalendarDays(day, -6), athletes } : null
}
