// VideoCoach-broens konstanter og rene hjaelpere — flyttet uaendret ud af
// AthleteView.jsx (ordre 373). Bruges af broen (useVideoCoachBro.js),
// iframen, fetchAthlete (isUuid) og feedback-kortene (athleteVideoPathPreview).
import { validateVideoCoachPayloadBounds } from '../videoCoachSubmission'
import { VIDEOCOACH_BUILD_ID } from '../videoCoachVersion'

const ATHLETE_VIDEOCOACH_PREFIX = 'entropi:videocoach:v3'
const ATHLETE_VIDEOCOACH_QUEUE_CHANGED = 'entropi:videocoach:queue-changed'
const ATHLETE_VIDEOCOACH_URL = `videocoach.html?mode=athlete&bridge=athlete-v1&v=${VIDEOCOACH_BUILD_ID}`
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ATHLETE_VIDEOCOACH_COLUMNS = new Set([
  'client_analysis_id', 'athlete_id', 'athlete_name', 'source_mode', 'status',
  'lift', 'variation', 'load_kg', 'rpe', 'reps_count', 'rep_details',
  'session_context', 'capture_context', 'schema_version', 'schema_v',
  'engine_version', 'tracker_version', 'skeleton_version', 'feedback_version',
  'low_conf_pct', 'position_quality_pct', 'quality_flags', 'metrics', 'skeleton',
  'findings', 'coach_note', 'athlete_feedback', 'ai_draft', 'bar_path',
  'analyzed_at', 'reps', 'load_note', 'bias_note', 'rom_cm', 'loss_pct',
  'stick_pct', 'dip_pct', 'drift_cm', 'extra', 'ai_text',
])

function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

function validateAthleteVideoCoachRow(row, athleteId) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return 'Ugyldig analysepayload'
  if (Object.keys(row).some(key => !ATHLETE_VIDEOCOACH_COLUMNS.has(key)))
    return 'Analysen indeholder et felt, som atletbroen ikke tillader'
  if (row.schema_version !== 3 || row.schema_v !== 3 || row.status !== 'draft')
    return 'Kun schema-v3 kladder kan sendes til coachen'
  if (row.source_mode !== 'athlete_submission' || row.athlete_id !== athleteId)
    return 'Analysen er ikke knyttet til den indloggede atlet'
  if (!isUuid(row.client_analysis_id)) return 'Analysen mangler et gyldigt klient-id'
  if (!['squat', 'bench', 'deadlift'].includes(row.lift)) return 'Ugyldigt løft'
  if (!/^[a-z0-9]+([._-][a-z0-9]+)*$/.test(row.variation || ''))
    return 'Ugyldig variation'
  if (!Array.isArray(row.reps) || row.reps.some(value => typeof value !== 'number'))
    return 'Repdata skal være numeriske'
  if (!Array.isArray(row.rep_details) || row.reps_count !== row.rep_details.length)
    return 'Repantal og repdetaljer stemmer ikke'
  const boundsError = validateVideoCoachPayloadBounds(row)
  if (boundsError) return boundsError
  const athleteNote = row.session_context?.athlete_note
  if (athleteNote != null && (typeof athleteNote !== 'string' || athleteNote.length > 1000))
    return 'Notatet til coachen er ugyldigt eller for langt'
  return null
}

function athleteVideoPathPreview(barPath) {
  if (!barPath || !Array.isArray(barPath.dx) || !Array.isArray(barPath.dy) ||
      barPath.dx.length !== barPath.dy.length || barPath.dx.length > 240 ||
      !Number.isFinite(Number(barPath.x0)) || !Number.isFinite(Number(barPath.y0))) return null
  let x = Number(barPath.x0), y = Number(barPath.y0)
  const path = [{ x, y }]
  for (let i = 0; i < barPath.dx.length; i++) {
    const dx = Number(barPath.dx[i]), dy = Number(barPath.dy[i])
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) > 1000 || Math.abs(dy) > 1000)
      return null
    x += dx; y += dy; path.push({ x, y })
  }
  if (path.length < 2) return null
  const xs = path.map(point => point.x), ys = path.map(point => point.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const width = Math.max(30, maxX - minX), height = Math.max(60, maxY - minY)
  const padX = Math.max(12, width * 0.22), padY = Math.max(12, height * 0.1)
  return {
    points: path.map(point => `${point.x},${point.y}`).join(' '),
    viewBox: `${minX - padX} ${minY - padY} ${width + padX * 2} ${height + padY * 2}`,
    start: path[0], end: path[path.length - 1], referenceX: path[0].x,
    y1: minY - padY, y2: maxY + padY,
  }
}

export { ATHLETE_VIDEOCOACH_PREFIX, ATHLETE_VIDEOCOACH_QUEUE_CHANGED, ATHLETE_VIDEOCOACH_URL,
  isUuid, validateAthleteVideoCoachRow, athleteVideoPathPreview }
