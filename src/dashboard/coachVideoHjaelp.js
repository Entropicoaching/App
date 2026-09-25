// ORDRE 377: flyttet uændret fra src/Dashboard.jsx (linje 35-178 før
// opdelingen, se docs/DASHBOARD-KORT.md). Rene VideoCoach-hjælpere til
// coachens side: broens konfiguration og validering, stangbane-preview,
// feedback-udkast og målingstekster.
import { validateVideoCoachPayloadBounds } from '../videoCoachSubmission'
import { withVideoCoachPersonalBaseline } from '../videoCoachPersonalFeedback'
import { VIDEOCOACH_LIFT_LABELS as VIDEOCOACH_LIFTS, videoCoachVariationLabel } from '../videoCoachLabels'
import { VIDEOCOACH_BUILD_ID } from '../videoCoachVersion'

const VIDEOCOACH_V3_PREFIX = 'entropi:videocoach:v3'
const VIDEOCOACH_V3_URL = `videocoach.html?coach=1&bridge=v3&v=${VIDEOCOACH_BUILD_ID}`
const VIDEOCOACH_V3_COLUMNS = new Set([
  'client_analysis_id', 'athlete_id', 'athlete_name', 'source_mode', 'status',
  'lift', 'variation', 'load_kg', 'rpe', 'reps_count', 'rep_details',
  'session_context', 'capture_context', 'schema_version', 'schema_v',
  'engine_version', 'tracker_version', 'skeleton_version', 'feedback_version',
  'low_conf_pct', 'position_quality_pct', 'quality_flags', 'metrics', 'skeleton',
  'findings', 'coach_note', 'athlete_feedback', 'ai_draft', 'bar_path',
  'analyzed_at', 'reps', 'load_note', 'bias_note', 'rom_cm', 'loss_pct',
  'stick_pct', 'dip_pct', 'drift_cm', 'extra', 'ai_text',
  // ORDRE 57 · commit 2: enhver række gemt via trackeren er nu 'complete'.
  'analysis_state',
])

function videoCoachBridgeConfig(athletes, selectedAthleteId) {
  return {
    type: `${VIDEOCOACH_V3_PREFIX}:config`,
    athletes: (athletes || []).map(({ id, name }) => ({ id, name })),
    selectedAthleteId: selectedAthleteId || null,
  }
}

// ORDRE 57 · commit 2: allowedCompletionClientId er sat, når coachen lige har
// åbnet EN BESTEMT afventende atlet-video (video_analyses.analysis_state=
// 'awaiting_analysis') for at spore den færdig. Kun dén ene rækkes egen
// source_mode='athlete_submission' er tilladt gennem broen - alt andet skal
// stadig være coachens egne coach_web-analyser.
function validateVideoCoachV3Row(row, athletes, allowedCompletionClientId = null) {
  if (!row || typeof row !== 'object' || Array.isArray(row))
    return 'Ugyldig analysepayload'
  if (Object.keys(row).some(key => !VIDEOCOACH_V3_COLUMNS.has(key)))
    return 'Analysen indeholder et felt, som coach-broen ikke tillader'
  if (row.schema_version !== 3 || row.schema_v !== 3 || row.status !== 'draft')
    return 'Kun schema-v3 drafts kan gemmes gennem coach-broen'
  const isAllowedCompletion = !!allowedCompletionClientId &&
    row.source_mode === 'athlete_submission' && row.client_analysis_id === allowedCompletionClientId
  if (row.source_mode !== 'coach_web' && !isAllowedCompletion) return 'Ugyldig analysekilde'
  if (!['squat', 'bench', 'deadlift'].includes(row.lift)) return 'Ugyldigt løft'
  if (!/^[a-z0-9]+([._-][a-z0-9]+)*$/.test(row.variation || ''))
    return 'Ugyldig variation'
  if (!athletes.some(athlete => athlete.id === row.athlete_id))
    return 'Atleten tilhører ikke den indloggede coach'
  if (!Array.isArray(row.reps) || row.reps.some(value => typeof value !== 'number'))
    return 'Legacy reps skal være numeriske'
  if (!Array.isArray(row.rep_details) || row.reps_count !== row.rep_details.length)
    return 'Repantal og repdetaljer stemmer ikke'
  const boundsError = validateVideoCoachPayloadBounds(row)
  if (boundsError) return boundsError
  return null
}

function videoCoachPathPreview(barPath) {
  if (!barPath || !Array.isArray(barPath.dx) || !Array.isArray(barPath.dy) ||
      barPath.dx.length !== barPath.dy.length || barPath.dx.length > 240 ||
      !Number.isFinite(Number(barPath.x0)) || !Number.isFinite(Number(barPath.y0))) return null
  let x = Number(barPath.x0), y = Number(barPath.y0)
  const points = [{ x, y }]
  for (let i = 0; i < barPath.dx.length; i++) {
    const dx = Number(barPath.dx[i]), dy = Number(barPath.dy[i])
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) > 1000 || Math.abs(dy) > 1000)
      return null
    x += dx; y += dy; points.push({ x, y })
  }
  if (points.length < 2) return null
  const xs = points.map(point => point.x), ys = points.map(point => point.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const width = Math.max(30, maxX - minX), height = Math.max(60, maxY - minY)
  const padX = Math.max(12, width * 0.22), padY = Math.max(12, height * 0.1)
  return {
    points: points.map(point => `${point.x},${point.y}`).join(' '),
    viewBox: `${minX - padX} ${minY - padY} ${width + padX * 2} ${height + padY * 2}`,
    start: points[0], end: points[points.length - 1], referenceX: points[0].x,
    y1: minY - padY, y2: maxY + padY,
  }
}

function videoCoachFeedbackDraft(feedback) {
  const source = feedback && typeof feedback === 'object' ? feedback : {}
  const text = key => Array.isArray(source[key])
    ? source[key].filter(item => item && typeof item.text === 'string')
      .slice(0, 2).map(item => item.text.trim()).filter(Boolean).join('\n')
    : ''
  return { works: text('works'), focus: text('focus'), next_set: text('next_set') }
}

function videoCoachFeedbackPayload(existing, draft, personalBaseline) {
  const source = existing && typeof existing === 'object' ? existing : {}
  const section = key => String(draft?.[key] || '').split(/\r?\n/)
    .map(text => text.trim()).filter(Boolean).slice(0, 2)
    .map((text, index) => ({
      ...(source[key]?.[index] && typeof source[key][index] === 'object' ? source[key][index] : {}),
      text,
      evidence_refs: Array.isArray(source[key]?.[index]?.evidence_refs)
        ? source[key][index].evidence_refs : ['coach_review'],
    }))
  return withVideoCoachPersonalBaseline({
    ...source, works: section('works'), focus: section('focus'), next_set: section('next_set'),
  }, personalBaseline)
}

function coachVideoPriorityDetail(video) {
  const lift = `${VIDEOCOACH_LIFTS[video.lift] || video.lift} · ${videoCoachVariationLabel(video.lift, video.variation)}${video.load_kg != null ? ` · ${video.load_kg} kg` : ''}`
  // ORDRE 266 · commit 2: en atlet-indsendt måling (fra "Film et sæt" eller
  // standardvejens "Send til coach") fortjener sin egen ordlyd i indbakken -
  // "afventer sporing" er teknisk sandt, men ikke det coachen skal reagere på.
  if (video.source_mode === 'athlete_submission') return `Ny måling fra et sæt · ${lift}`
  const prefix = video.analysis_state === 'awaiting_analysis' ? 'Afventer sporing · ' : ''
  return `${prefix}${lift}`
}

// ORDRE 266 · commit 1: kompakt gengivelse af en allerede GEMT måling (samme
// felter en fuld analyse allerede skriver til video_analyses - reps_count,
// rep_details, metrics.bar_drift_cm, bar_path - se AnalyseTab/"Gennemgå
// måling"). Rører intet i videocoach.html; viser kun hvad der allerede er i
// rækken. Returnerer null hvis videoen endnu ikke er sporet (reps_count er
// database-default null for enhver "Film et sæt"/"Send til coach"-video
// FØR nogen - atlet eller coach - rent faktisk har kørt sporingen).
function videoCoachMeasurementSummary(video) {
  if (!video || video.reps_count == null) return null
  const repDetails = Array.isArray(video.rep_details) ? video.rep_details : []
  const repTimesS = repDetails.map(rep => {
    const m = rep?.metrics || {}
    const parts = [m.eccentric_s?.value, m.pause_s?.value, m.concentric_s?.value]
      .filter(v => Number.isFinite(v))
    return parts.length ? parts.reduce((sum, v) => sum + v, 0) : null
  }).filter(v => Number.isFinite(v))
  const avgTimeS = repTimesS.length ? repTimesS.reduce((sum, v) => sum + v, 0) / repTimesS.length : null
  const driftCm = video.metrics?.bar_drift_cm?.value
  return {
    repsCount: video.reps_count,
    avgTimeS: Number.isFinite(avgTimeS) ? avgTimeS : null,
    driftCm: Number.isFinite(driftCm) ? driftCm : null,
    pathPreview: videoCoachPathPreview(video.bar_path),
  }
}

function videoCoachMeasurementText(summary) {
  const parts = [`${summary.repsCount} rep${summary.repsCount === 1 ? '' : 's'}`]
  if (summary.driftCm != null) parts.push(`Ø ${summary.driftCm.toFixed(1)} cm sidelæns`)
  if (summary.avgTimeS != null) parts.push(`Ø ${summary.avgTimeS.toFixed(1)}s/rep`)
  return parts.join(' · ')
}

export {
  VIDEOCOACH_V3_PREFIX, VIDEOCOACH_V3_URL, videoCoachBridgeConfig, validateVideoCoachV3Row,
  videoCoachPathPreview, videoCoachFeedbackDraft, videoCoachFeedbackPayload, coachVideoPriorityDetail,
  videoCoachMeasurementSummary, videoCoachMeasurementText,
}
