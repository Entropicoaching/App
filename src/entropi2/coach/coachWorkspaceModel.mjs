import { activityDay } from '../../dashboard/coachInactive.mjs'
import { isDay } from '../tracking/visning/trackingContract.mjs'
import { buildAthleteSignalList } from '../tracking/signaler/athleteSignals.mjs'
import { coachTrackingModel } from './coachTrackingModel.mjs'
import { weeklyReportModel } from './weeklyReportModel.mjs'

// Read-only assembly. Rich snapshots require a captured owner/day/athlete receipt.
// Existing list reads never prove a complete calendar week or training block.
export function coachAthleteWorkspace(props, context, athlete, report = weeklyReportModel(props, context.day)) {
  const { day } = context
  if (!context.rosterReady || !isDay(day) || !context.athletes.some(a => a.id === athlete.id)) return null
  const id = athlete.id, source = props.coachAnalysis
  const scoped = Boolean(props.readContext?.coachId) && source?.coachId === props.readContext.coachId && source.day === day &&
    Array.isArray(source.athleteIds) && source.athleteIds.includes(id)
  const entry = scoped && source.byAthlete?.[id]
  const current = entry?.athleteId === id && entry.day === day
  const snapshot = source?.state === 'ready' && current && entry.state === 'ready' && entry.complete === true ? entry : null
  const error = Boolean(scoped && (source.state === 'error' || current && entry.state === 'error'))
  const row = report.rows.find(r => r.athlete.id === id)
  const receipt = { athleteId: id, day, state: 'ready', complete: true }
  const logs = context.logs.rows.filter(r => r.athlete_id === id && r.skipped !== true && !r._optimistic)
  const dates = logs.map(r => activityDay(r.logged_at))
  const validLogs = context.logs.complete && dates.every(d => d && d <= day)
  const unread = context.inbox.filter(r => r.athlete.id === id && r.item.kind === 'message')
    .reduce((sum, r) => sum + r.item.count, 0)
  const derived = coachTrackingModel(props, context, athlete, row, snapshot?.cardWeight)
  const signals = buildAthleteSignalList({ enabled: true, athleteId: id,
    outputs: [...derived.signals.map(signal => ({ athleteId: id, source: signal.sources[0],
      signals: [{ ...signal, reason: signal.reasons[0], dataBasis: signal.dataBasis[0] }] })),
      ...(Array.isArray(snapshot?.signalOutputs) ? snapshot.signalOutputs.map(output => ({ ...output,
      signals: Array.isArray(output?.signals) ? output.signals.filter(signal =>
        isDay(signal?.dataBasis?.to) && signal.dataBasis.to <= day) : [] })) : [])] })
  return {
    key: `${props.readContext?.coachId}:${id}:${day}`, error, signals, report,
    compact: { signals: [...(derived.weight ? [derived.weight.text] : []),
      ...signals.map(signal => signal.reasons[0])].filter((text, index, all) => all.indexOf(text) === index).slice(0, 2) },
    facts: { athlete, today: day,
      session: validLogs && dates.length > 0 ? { ...receipt, lastDay: dates.sort().at(-1) ?? null } : undefined,
      nutrition: row?.nutrition ? { ...receipt, from: props.coachNutrition?.from,
        through: day, loggedDays: row.nutrition.logged } : undefined,
      messages: context.messages.complete ? { ...receipt, count: unread } : undefined,
      weight: snapshot?.cardWeight },
    evaluation: snapshot?.evaluation ? { ...snapshot.evaluation, athleteId: id, athleteName: athlete.name, today: day } : undefined,
    plan: snapshot?.plan?.athleteId === id ? snapshot.plan : undefined,
    tracking: snapshot?.tracking?.asOf === day ? snapshot.tracking : undefined,
  }
}
