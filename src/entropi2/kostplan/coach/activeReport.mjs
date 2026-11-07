import { createPlanAdapter } from '../planAdapter.mjs'
import { productionClient } from './activation.mjs'
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
  return receipt.mealLogs.some(row => row?.athlete_id === athleteId && identifier(row.id)
    && day(row.date) && row.date >= from && row.date <= date
    && typeof row.meal === 'string' && row.meal.trim() && !isDayReceipt({ meal: row.meal.trimStart() }))
    ? { coachId, athleteId, date, receipt } : null
}

// The only I/O is the bounded daily history read on the existing namespace adapter. Cleanup prevents
// late client/athlete/date/read results from reappearing in a different scope.
export function startActiveReport(options, onResult) {
  const scope = activeReportScope(options)
  if (!scope) return undefined
  let current = true
  Promise.resolve().then(async () => {
    if (!current) return
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
  if (!result || result.state === 'ready' && !result.report) return null
  // Summary stays visible in Kost & mål; individual days are folded by the
  // existing report view. Weight is already shown by the host, so not repeated.
  return nutritionReportView(create, { enabled: true, ...result, onRetry })
}
