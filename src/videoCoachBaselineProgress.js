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
        typeof analysis.variation !== 'string' ||
        !['coach_approved', 'shared'].includes(analysis.status) ||
        Number(analysis.low_conf_pct || 0) > 15 || !hasEligibleBaselineMetric(analysis)) return
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

export function videoCoachBaselineReviewImpact(baselines, analyses, analysis) {
  if (!analysis || !VIDEOCOACH_LIFT_LABELS[analysis.lift] ||
      typeof analysis.variation !== 'string') return null

  const variation = videoCoachVariationIdentity(analysis.lift, analysis.variation)
  const key = `${analysis.lift}:${variation}`
  const label = `${VIDEOCOACH_LIFT_LABELS[analysis.lift]} · ${videoCoachVariationLabel(analysis.lift, variation)}`
  const current = buildVideoCoachBaselineProfiles(baselines, analyses)
    .find(profile => profile.key === key)?.nAnalyses || 0

  if (analysis.status === 'invalid') return {
    kind: 'excluded', label, current, after: current,
    title: 'Udeladt fra personlig baseline',
    detail: 'Målingen påvirker ikke atletens historiske sammenligning.',
  }

  const lowConfidence = Number(analysis.low_conf_pct || 0)
  if (lowConfidence > 15) return {
    kind: 'blocked', label, current, after: current,
    title: 'Tæller ikke i baseline',
    detail: `Lav tracking-confidence er ${lowConfidence.toLocaleString('da-DK', { maximumFractionDigits: 1 })}% · grænsen er 15%.`,
  }

  if (!hasEligibleBaselineMetric(analysis)) return {
    kind: 'blocked', label, current, after: current,
    title: 'Tæller ikke i baseline',
    detail: 'Målingen mangler en sammenlignelig metric med tilstrækkelig sikkerhed.',
  }

  if (analysis.status === 'coach_approved' || analysis.status === 'shared') return {
    kind: current >= READY_ANALYSES ? 'ready' : 'included', label, current, after: current,
    title: 'Indgår i personlig baseline',
    detail: current >= READY_ANALYSES
      ? `${label} bygger nu på ${current} brugbare målinger.`
      : `${label} er på ${current}/5 brugbare målinger.`,
  }

  if (analysis.status !== 'draft') return null

  const after = current + 1
  const title = current === 0
    ? 'Starter personlig baseline'
    : current < PRELIMINARY_ANALYSES && after >= PRELIMINARY_ANALYSES
      ? 'Giver en foreløbig retning'
      : current < READY_ANALYSES && after >= READY_ANALYSES
        ? 'Gør baseline klar'
        : current >= READY_ANALYSES ? 'Udvider en klar baseline' : 'Bygger personlig baseline'
  const detail = current === 0
    ? `Godkendelse starter ${label} på 1/5 brugbare målinger.`
    : current >= READY_ANALYSES
      ? `Godkendelse udvider profilen fra ${current} til ${after} brugbare målinger.`
      : `Godkendelse flytter ${label} fra ${current}/5 til ${after}/5.`

  return {
    kind: after >= READY_ANALYSES ? 'ready' : after >= PRELIMINARY_ANALYSES ? 'preliminary' : 'building',
    label, current, after, title, detail,
  }
}
