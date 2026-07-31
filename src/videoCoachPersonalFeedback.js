import { videoCoachVariationIdentity } from './videoCoachLabels.js'

const MAX_TEXT_LENGTH = 500
const MIN_BASELINE_ANALYSES = 3
const MAX_LOW_CONFIDENCE_PCT = 15
const MIN_METRIC_CONFIDENCE = 0.75
const MIN_FINDING_CONFIDENCE = 0.65

function cleanText(value, maxLength = MAX_TEXT_LENGTH) {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : ''
}

function finiteNumber(value) {
  if (value == null || typeof value === 'boolean' ||
      (typeof value === 'string' && !value.trim())) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function sameVersion(left, right) {
  const a = cleanText(left, 100)
  const b = cleanText(right, 100)
  return !!a && a === b
}

export function sanitizeVideoCoachPersonalBaseline(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const reference = value.evidence_ref
  if (!reference || typeof reference !== 'object' || Array.isArray(reference)) return null

  const text = cleanText(value.text)
  const findingId = cleanText(reference.finding_id, 120)
  const athleteId = cleanText(reference.athlete_id, 120)
  const lift = cleanText(reference.lift, 40)
  const variation = cleanText(reference.variation, 120)
  const metricKey = cleanText(reference.metric_key, 120)
  const metricMethod = cleanText(reference.metric_method, 160)
  const baselineVersion = cleanText(reference.baseline_version, 100)
  const analysisId = cleanText(reference.analysis_id, 120)
  const nAnalyses = finiteNumber(reference.n_analyses)

  if (!text || !findingId.startsWith('baseline_') || !athleteId || !lift || !variation ||
      !metricKey || !metricMethod || !baselineVersion || !analysisId ||
      nAnalyses == null || nAnalyses < MIN_BASELINE_ANALYSES) return null

  return {
    text,
    evidence_ref: {
      schema_version: 'personal-baseline-evidence/v1',
      finding_id: findingId,
      analysis_id: analysisId,
      athlete_id: athleteId,
      lift,
      variation,
      metric_key: metricKey,
      metric_method: metricMethod,
      baseline_version: baselineVersion,
      n_analyses: Math.floor(nAnalyses),
    },
  }
}

export function videoCoachPersonalBaselineForAnalysis(feedback, analysis, athleteId) {
  const selected = sanitizeVideoCoachPersonalBaseline(feedback?.personal_baseline)
  if (!selected || !analysis || !athleteId) return null
  const reference = selected.evidence_ref
  const analysisId = cleanText(analysis.id || analysis.client_analysis_id, 120)
  const variation = videoCoachVariationIdentity(analysis.lift, analysis.variation)
  return reference.analysis_id === analysisId && reference.athlete_id === athleteId &&
    reference.lift === analysis.lift && reference.variation === variation
    ? selected : null
}

export function videoCoachPersonalBaselineAthleteText(value) {
  const selected = sanitizeVideoCoachPersonalBaseline(value)
  return selected
    ? selected.text.replace(/^(OK|OBS|NOTE):\s*/i, '')
      .replace(/atletens median/gi, 'din median')
    : ''
}

export function videoCoachPersonalBaselineOptions(baselines, analysis, athleteId) {
  const lowConfidencePct = finiteNumber(analysis?.low_conf_pct ?? 0)
  if (!analysis || !athleteId || analysis.athlete_id !== athleteId ||
      !['squat', 'bench', 'deadlift'].includes(analysis.lift) ||
      typeof analysis.variation !== 'string' ||
      lowConfidencePct == null || lowConfidencePct > MAX_LOW_CONFIDENCE_PCT) return []

  const variation = videoCoachVariationIdentity(analysis.lift, analysis.variation)
  const metrics = analysis.metrics && typeof analysis.metrics === 'object' ? analysis.metrics : {}
  const findings = Array.isArray(analysis.findings) ? analysis.findings : []
  const snapshots = Array.isArray(analysis.session_context?.baseline_snapshot)
    ? analysis.session_context.baseline_snapshot : []
  const analysisId = cleanText(analysis.id || analysis.client_analysis_id, 120)
  if (!analysisId) return []

  const options = []
  for (const snapshot of snapshots) {
    if (!snapshot || typeof snapshot !== 'object') continue
    const metricKey = cleanText(snapshot.metric_key, 120)
    const metricMethod = cleanText(snapshot.metric_method, 160)
    const nAnalyses = finiteNumber(snapshot.n_analyses)
    const metric = metrics[metricKey]
    if (!metricKey || !metricMethod || nAnalyses == null || nAnalyses < MIN_BASELINE_ANALYSES ||
        !metric || metric.eligible_for_baseline !== true ||
        cleanText(metric.method, 160) !== metricMethod || finiteNumber(metric.value) == null ||
        (metric.confidence != null && finiteNumber(metric.confidence) < MIN_METRIC_CONFIDENCE)) continue

    const baseline = (baselines || []).find(item => item && item.lift === analysis.lift &&
      videoCoachVariationIdentity(item.lift, item.variation) === variation &&
      item.metric_key === metricKey && item.metric_method === metricMethod &&
      finiteNumber(item.n_analyses) >= MIN_BASELINE_ANALYSES &&
      finiteNumber(item.median) != null && sameVersion(item.baseline_version, snapshot.baseline_version))
    if (!baseline) continue

    const finding = findings.find(item => item && item.id === `baseline_${metricKey}` &&
      cleanText(item.summary) && Array.isArray(item.evidence_refs) &&
      item.evidence_refs.includes(metricKey) && finiteNumber(item.confidence) >= MIN_FINDING_CONFIDENCE)
    if (!finding) continue

    const option = sanitizeVideoCoachPersonalBaseline({
      text: finding.summary,
      evidence_ref: {
        finding_id: finding.id,
        analysis_id: analysisId,
        athlete_id: athleteId,
        lift: analysis.lift,
        variation,
        metric_key: metricKey,
        metric_method: metricMethod,
        baseline_version: baseline.baseline_version,
        n_analyses: Math.min(Math.floor(nAnalyses), Math.floor(Number(baseline.n_analyses))),
      },
    })
    if (option && !options.some(item => item.id === option.evidence_ref.finding_id)) {
      options.push({ id: option.evidence_ref.finding_id, ...option })
    }
  }

  return options
}

export function videoCoachPersonalBaselineSelection(feedback, options) {
  const selected = sanitizeVideoCoachPersonalBaseline(feedback?.personal_baseline)
  if (!selected) return ''
  return (options || []).some(option => option.id === selected.evidence_ref.finding_id &&
    option.evidence_ref.analysis_id === selected.evidence_ref.analysis_id &&
    option.evidence_ref.athlete_id === selected.evidence_ref.athlete_id &&
    option.evidence_ref.lift === selected.evidence_ref.lift &&
    option.evidence_ref.variation === selected.evidence_ref.variation &&
    option.evidence_ref.metric_key === selected.evidence_ref.metric_key &&
    option.evidence_ref.metric_method === selected.evidence_ref.metric_method &&
    option.evidence_ref.baseline_version === selected.evidence_ref.baseline_version &&
    option.evidence_ref.n_analyses === selected.evidence_ref.n_analyses)
    ? selected.evidence_ref.finding_id : ''
}

export function withVideoCoachPersonalBaseline(feedback, selectedOption) {
  const result = { ...(feedback && typeof feedback === 'object' ? feedback : {}) }
  const selected = sanitizeVideoCoachPersonalBaseline(selectedOption)
  if (selected) result.personal_baseline = selected
  else delete result.personal_baseline
  return result
}
