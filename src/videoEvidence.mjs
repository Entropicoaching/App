import { videoCoachVariationIdentity } from './videoCoachLabels.js'
// Individual rows, not an aggregate count, establish a reference sample.
export function videoReferenceEvidence(baseline, analysis, athleteId) {
  const metric = baseline.metric_key
  const version = analysis.engine_version && analysis.tracker_version
    ? analysis.engine_version + '|' + analysis.tracker_version : null
  return { currentId: analysis.id || analysis.client_analysis_id, athleteId,
    variation: videoCoachVariationIdentity(analysis.lift, analysis.variation), metric, method: baseline.metric_method, version,
    rows: (baseline.reference_analyses || []).flatMap(r => {
      const m = r.metrics?.[metric]
      if (m?.eligible_for_baseline !== true || r.lift !== analysis.lift) return []
      return [{ id: r.id, date: r.analyzed_at, approved: ['coach_approved', 'shared'].includes(r.status),
        athleteId: r.athlete_id, variation: videoCoachVariationIdentity(r.lift, r.variation), metric, method: m.method,
        version: r.engine_version && r.tracker_version ? r.engine_version + '|' + r.tracker_version : null,
        value: m.value }]
    }) }
}
export function attachVideoReferences(baselines, analyses) {
  return baselines.map(b => ({ ...b, reference_analyses: analyses }))
}
