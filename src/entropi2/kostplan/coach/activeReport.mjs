import { createPlanAdapter } from '../planAdapter.mjs'
import { productionClient, readActivationState } from './activation.mjs'
import { identifier, day } from './model.mjs'
import { isDayReceipt } from '../../../mealEvidence.mjs'
import { buildDailyPlanNutritionReport } from '../rapport/nutritionReport.mjs'
import { nutritionReportView } from '../rapport/reportView.mjs'

// Reuse the host's completed seven-day meal read. Profile goals, device drafts
// and device-local history cannot stand in for approved SQL version history.
export function activeReportScope(options = {}) {
  if (options.enabled !== true) return null
  const { coachId, athleteId, date, receipt } = options
  if (!identifier(coachId) || !identifier(athleteId) || !day(date)
    || date < '1900-01-07' || date > '9999-12-24'
    || receipt?.coachId !== coachId || receipt.athleteId !== athleteId || receipt.date !== date
    || receipt.state !== 'ready' || receipt.complete !== true || !Array.isArray(receipt.mealLogs)) return null
  const from = new Date(Date.parse(`${date}T00:00:00Z`) - 6 * 86400000).toISOString().slice(0, 10)
  return !receipt.mealLogs.length || receipt.mealLogs.some(row => row?.athlete_id === athleteId && identifier(row.id)
    && day(row.date) && row.date >= from && row.date <= date
    && typeof row.meal === 'string' && row.meal.trim() && !isDayReceipt({ meal: row.meal.trimStart() }))
    ? { coachId, athleteId, date, receipt } : null
}

// Read activation capability for empty logs, or bounded daily history for meals. Cleanup prevents
// late client/athlete/date/read results from reappearing in a different scope.
export function startActiveReport(options, onResult) {
  const scope = activeReportScope(options)
  if (!scope) return undefined
  let current = true
  Promise.resolve().then(async () => {
    if (!current) return
    // An empty completed read can expose confirmed activation capability, but
    // supplies no consumption or historical approval evidence.
    if (scope.receipt.mealLogs.length === 0) {
      try {
        const client = options.client ?? await (options.loadClient ?? productionClient)()
        if (!current) return
        const activation = await readActivationState({ client, athleteId: scope.athleteId, date: scope.date })
        if (current) onResult({ ...scope, state: activation.state, activePlan: activation.active, report: null })
      } catch { if (current) onResult({ ...scope, state: 'error' }) }
      return
    }
    let dailyReferences
    try {
      const client = options.client ?? await (options.loadClient ?? productionClient)()
      if (!current) return
      // History is uncached: retry always repeats the bounded scoped reads.
      dailyReferences = await createPlanAdapter({ enabled: true, client, athleteId: scope.athleteId, date: scope.date })
        .loadDailyReferences({ coachId: scope.coachId, isCurrent: () => current })
    } catch {
      // Client/read unavailability is unknown history, not missing consumption.
      // The report's explicit unavailable contract supplies no historical targets.
    }
    if (!current) return
    const report = buildDailyPlanNutritionReport({ enabled: true, athleteId: scope.athleteId,
      date: scope.date, dailyReferences, mealLogs: scope.receipt.mealLogs })
    if (current) onResult({ ...scope, state: 'ready', report })
  }).catch(() => { if (current) onResult({ ...scope, state: 'error' }) })
  return () => { current = false }
}

export function activeReportView(create, result, onRetry) {
  if (!result) return null
  if (result.state === 'unavailable' || result.state === 'ready' && !result.report) {
    return create('div', null,
      create('p', { role: 'status' }, result.state === 'unavailable'
        ? 'Aktivering er ikke tilgængelig: kostplanens tabeller mangler. Lokale kladder er ikke delt med atleten.'
        : result.activePlan
          ? 'Atleten har en bekræftet aktiv kostplan. Der er endnu ingen måltidslogs i perioden.'
          : 'Ingen aktiv kostplan blev fundet for atleten og datoen.'),
      typeof onRetry === 'function' && create('button', { type: 'button', style: { minHeight: 44 }, onClick: onRetry }, 'Kontrollér aktivering igen'))
  }
  // Summary stays visible in Kost & mål; individual days are folded by the
  // existing report view. Weight is already shown by the host, so not repeated.
  return nutritionReportView(create, { enabled: true, ...result, onRetry })
}
