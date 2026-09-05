// ORDRE 57 · "upload og gå" — atleten uploader den rå video i stedet for at
// spore den lokalt. Rene funktioner (ingen Supabase-kald), så stien og
// rækken kan testes hermetisk mod insert-policyens betingelser.

export const VIDEOCOACH_UPLOAD_BUCKET = 'videocoach-uploads'
export const VIDEOCOACH_UPLOAD_MAX_BYTES = 500 * 1024 * 1024

// Sti-udledningen bruger KUN mime-typen, aldrig filnavnet — se ORDRE-Vaidya.md.
export const VIDEOCOACH_UPLOAD_EXT_BY_MIME = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/x-m4v': 'm4v',
  'video/3gpp': '3gp',
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

function finiteInRange(value, min, max) {
  if (value == null) return true
  return Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max
}

export function videoUploadMimeAllowed(mimeType) {
  return Object.prototype.hasOwnProperty.call(VIDEOCOACH_UPLOAD_EXT_BY_MIME, mimeType)
}

export function videoUploadExtForMime(mimeType) {
  return VIDEOCOACH_UPLOAD_EXT_BY_MIME[mimeType] || null
}

// Stikonvention håndhævet af storage.objects-policies: første segment SKAL
// være athletes.id (ikke user_id).
export function buildVideoUploadPath(athleteId, clientAnalysisId, mimeType) {
  const ext = videoUploadExtForMime(mimeType)
  if (!ext || !isUuid(athleteId) || !isUuid(clientAnalysisId)) return null
  return `${athleteId}/${clientAnalysisId}.${ext}`
}

// Supabase Storage afviser en dublet-sti (bucket-policyen tillader ikke
// overskrivning) — det er den forventede "allerede uploadet"-udgang af en
// gentaget forsøg efter at rækken-indsættelsen fejlede første gang.
export function videoUploadAlreadyExistsError(error) {
  if (!error) return false
  const status = String(error.statusCode ?? error.status ?? '')
  if (status === '409') return true
  const message = String(error.message || error.error || '')
  return /duplicate/i.test(message) || /already exists/i.test(message)
}

// Defense-in-depth: samme tjekliste som databasens
// entropi_vc3_athlete_insert_own_draft-policy og video_analyses_v3_payload_bounds
// (schema_version/schema_v/source_mode/status/coach_note/bias_note håndteres af
// buildAwaitingAnalysisRow og rører aldrig klientinput), plus upload-specifikke
// grænser (mime, størrelse) som ikke er databasens ansvar.
export function validateVideoUploadRequest({
  athleteId, clientAnalysisId, lift, variation, mimeType, fileSize, loadKg, rpe, athleteNote,
} = {}) {
  if (!isUuid(athleteId)) return 'Atleten kunne ikke identificeres'
  if (!isUuid(clientAnalysisId)) return 'Analysen mangler et gyldigt klient-id'
  if (!['squat', 'bench', 'deadlift'].includes(lift)) return 'Ugyldigt løft'
  if (!/^[a-z0-9]+([._-][a-z0-9]+)*$/.test(variation || '')) return 'Ugyldig variation'
  if (!videoUploadMimeAllowed(mimeType)) return 'Videoformatet understøttes ikke'
  if (!Number.isFinite(Number(fileSize)) || Number(fileSize) <= 0) return 'Videofilen er tom eller ugyldig'
  if (Number(fileSize) > VIDEOCOACH_UPLOAD_MAX_BYTES) return 'Videoen er større end 500 MB'
  if (!finiteInRange(loadKg, 0, 1000)) return 'Belastningen er uden for det tilladte interval'
  if (!finiteInRange(rpe, 0, 10)) return 'RPE er uden for det tilladte interval'
  if (athleteNote != null && (typeof athleteNote !== 'string' || athleteNote.length > 1000))
    return 'Notatet til coachen er ugyldigt eller for langt'
  return null
}

// Rækken der indsættes med analysis_state='awaiting_analysis'. reps_count,
// metrics, findings, rep_details og bar_path udelades bevidst — kolonnernes
// egne defaults (allerede kørt i produktion, se migrationen) gør en række
// uden analyse lovlig efter video_analyses_v3_payload_bounds.
export function buildAwaitingAnalysisRow({
  athleteId, athleteName = null, clientAnalysisId, lift, variation,
  loadKg = null, rpe = null, athleteNote = null, videoPath,
}) {
  return {
    client_analysis_id: clientAnalysisId,
    athlete_id: athleteId,
    athlete_name: athleteName,
    source_mode: 'athlete_submission',
    status: 'draft',
    schema_version: 3,
    schema_v: 3,
    lift,
    variation,
    load_kg: loadKg,
    rpe,
    video_path: videoPath,
    analysis_state: 'awaiting_analysis',
    coach_note: null,
    bias_note: null,
    session_context: {
      training_session_id: null,
      program_item_id: null,
      coach_note_snapshot: null,
      baseline_snapshot: [],
      athlete_note: athleteNote || null,
      feedback_evidence: null,
    },
  }
}
