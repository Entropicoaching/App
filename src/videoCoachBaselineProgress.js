import { VIDEOCOACH_LIFT_LABELS, videoCoachVariationIdentity, videoCoachVariationLabel } from './videoCoachLabels.js'

const READY_ANALYSES = 5
const PRELIMINARY_ANALYSES = 3

function profileDetails(lift, variation, nAnalyses) {
  const identity = videoCoachVariationIdentity(lift, variation)
  return {
    key: `${lift}:${identity}`,
    lift,
    variation: identity,
    label: `${VIDEOCOACH_LIFT_LABELS[lift]} · ${videoCoachVariationLabel(lift, identity)}`,
    nAnalyses,
    remaining: Math.max(0, READY_ANALYSES - nAnalyses),
    progressPct: Math.min(100, Math.round(nAnalyses / READY_ANALYSES * 100)),
    stage: nAnalyses >= READY_ANALYSES
      ? 'ready'
      : nAnalyses >= PRELIMINARY_ANALYSES ? 'preliminary' : 'building',
  }
}

function hasEligibleBaselineMetric(analysis) {
  if (!['coach_approved', 'shared'].includes(analysis?.status)) return false
  if (Number(analysis.low_conf_pct || 0) > 15) return false
  return Object.values(analysis.metrics || {}).some(metric => {
    if (!metric || typeof metric !== 'object' || metric.eligible_for_baseline !== true) return false
    if (!Number.isFinite(Number(metric.value)) || !String(metric.method || '').trim()) return false
    return metric.confidence == null || Number(metric.confidence) >= 0.75
  })
}

export function buildVideoCoachBaselineProfiles(baselines, analyses = []) {
  const profiles = new Map()

  for (const row of baselines || []) {
    if (!row || !VIDEOCOACH_LIFT_LABELS[row.lift] || typeof row.variation !== 'string') continue
    const nAnalyses = Number(row.n_analyses)
    if (!Number.isFinite(nAnalyses) || nAnalyses < 1) continue

    const variation = videoCoachVariationIdentity(row.lift, row.variation)
    const key = `${row.lift}:${variation}`
    const current = profiles.get(key)
    if (current && current.nAnalyses >= nAnalyses) continue
    profiles.set(key, profileDetails(row.lift, variation, nAnalyses))
  }

  const eligibleAnalysisIds = new Map()
  analyses.forEach((analysis, index) => {
    if (!analysis || !VIDEOCOACH_LIFT_LABELS[analysis.lift] ||
        typeof analysis.variation !== 'string' || !hasEligibleBaselineMetric(analysis)) return
    const variation = videoCoachVariationIdentity(analysis.lift, analysis.variation)
    const key = `${analysis.lift}:${variation}`
    if (!eligibleAnalysisIds.has(key)) eligibleAnalysisIds.set(key, new Set())
    eligibleAnalysisIds.get(key).add(analysis.id || analysis.client_analysis_id || `row-${index}`)
  })

  for (const [key, ids] of eligibleAnalysisIds) {
    const current = profiles.get(key)
    if (current && current.nAnalyses >= ids.size) continue
    const [lift, ...variationParts] = key.split(':')
    profiles.set(key, profileDetails(lift, variationParts.join(':'), ids.size))
  }

  return [...profiles.values()].sort((a, b) =>
    b.nAnalyses - a.nAnalyses || a.label.localeCompare(b.label, 'da'))
}

export function countReadyVideoCoachBaselineProfiles(profiles) {
  return (profiles || []).filter(profile => profile?.stage === 'ready').length
}
