// ORDRE 57 · "upload og gå" — atleten uploader den rå video i stedet for at
// spore den lokalt. Rene funktioner (ingen Supabase-kald), så stien og
// rækken kan testes hermetisk mod insert-policyens betingelser.

export const VIDEOCOACH_UPLOAD_BUCKET = 'videocoach-uploads'
// U2: bucketen tillader 500 MB, men Supabase-planens grænse pr. fil er 50 MB
// (app-planen 9. nov., afsnit 2). Grænsen tjekkes her, før overførslen starter,
// så en lang video aldrig fejler først efter hele overførslen.
export const VIDEOCOACH_UPLOAD_MAX_BYTES = 50 * 1024 * 1024
// ORDRE 1616v: med videolageret (R2) går klippet uden om Supabase-planens 50 MB. Et klargjort klip
// fylder ca. 30 MB pr. minut (4 Mbit/s) og appens egen optagelse ca. 38 MB (5 Mbit/s), så 3 minutter
// er 90 til 115 MB. Workeren tager op til 1 GB direkte til R2 (src/videolager/worker.js).
export const VIDEOCOACH_LAGER_MAX_BYTES = 200 * 1024 * 1024

export function videoUploadMaxBytes(lagerTil) {
  return lagerTil === true ? VIDEOCOACH_LAGER_MAX_BYTES : VIDEOCOACH_UPLOAD_MAX_BYTES
}

// Reserven til Supabase findes kun for klip, Supabase kan tage imod.
export function videoUploadReserveMulig(fileSize) {
  return Number(fileSize) <= VIDEOCOACH_UPLOAD_MAX_BYTES
}

export function videoUploadTooLargeText(maxBytes = VIDEOCOACH_UPLOAD_MAX_BYTES) {
  return `Videoen er større end ${Math.round(maxBytes / 1048576)} MB. Optag et kortere klip eller i lavere kvalitet (fx 1080p), og send igen.`
}

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
  return (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) &&
    Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max
}

export function videoUploadMimeAllowed(mimeType) {
  return Object.prototype.hasOwnProperty.call(VIDEOCOACH_UPLOAD_EXT_BY_MIME, mimeType)
}

export function videoUploadExtForMime(mimeType) {
  return videoUploadMimeAllowed(mimeType) ? VIDEOCOACH_UPLOAD_EXT_BY_MIME[mimeType] : null
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

// ORDRE 1890v (Marc 19. nov.: "den siger bar fejl"): en coach, der træner på sin egen profil (ordre 1610v),
// er logget ind som coach. Lageret og databasen tager kun imod video fra atletens eget login, så
// afvisningen får grunden med på dansk. Atletens eget login får teksten uændret.
// ORDRE 2399v (2367v fund 2): siden 1952 må coachen sende for sin egen atlet, så login-teksten står kun,
// når svaret faktisk er en login-afvisning (401, 403 eller RLS). En netfejl viser sin egen årsag.
export function videoSendLoginAfvist(error, text = '') {
  const status = String(error?.status ?? ''), statusCode = String(error?.statusCode ?? '')
  if (status === '401' || status === '403' || statusCode === '401' || statusCode === '403') return true
  const code = String(error?.code ?? '')
  if (code === '42501' || code.startsWith('PGRST30')) return true
  return /row[- ]level security|unauthori[sz]ed|forbidden|Log ind igen|kan kun sende video|Kun atleter kan sende/i
    .test(`${error?.message || ''} ${text}`)
}

export function videoSendCoachLoginReason(text, athlete, userId, error = null) {
  const coachLogin = typeof userId === 'string' && !!userId && athlete?.coach_id === userId && athlete?.user_id !== userId
  return coachLogin && videoSendLoginAfvist(error, text)
    ? `Du er logget ind som coach, og video kan kun sendes fra atletens eget login (${text})` : text
}

// ORDRE 2399v (2367v fund 3): falder nettet, svarer browserens fetch på engelsk ("Failed to fetch",
// "NetworkError when attempting to fetch resource.", "Load failed"), og Supabase-reserven gav den tekst
// videre i stedet for lagerets danske. Ingen engelsk fejltekst må nå brugeren i sendvejen.
export const VIDEO_UPLOAD_NETFEJL = 'Forbindelsen blev afbrudt. Prøv igen'
const ENGELSK_NETFEJL = /failed to fetch|networkerror|network request failed|load failed|fetch failed|ERR_INTERNET_DISCONNECTED|ERR_NETWORK/i
export function videoUploadNetfejl(error) {
  if (!error) return false
  if (Number(error.status ?? error.statusCode ?? 0) >= 400) return false
  return ENGELSK_NETFEJL.test(String(error.message || '')) || error.name === 'StorageUnknownError'
}
// Reservens fejl på dansk: en netfejl får lagerets egen tekst, hvis lageret også faldt på nettet, ellers standardteksten.
export function videoUploadReserveFejl(reserveError, lagerError = null) {
  if (!reserveError || !videoUploadNetfejl(reserveError)) return reserveError
  const lagerTekst = typeof lagerError?.message === 'string' ? lagerError.message : ''
  return { ...reserveError, message: lagerTekst.startsWith('Forbindelsen blev afbrudt') ? lagerTekst : VIDEO_UPLOAD_NETFEJL }
}

// Defense-in-depth: samme tjekliste som databasens
// entropi_vc3_athlete_insert_own_draft-policy og video_analyses_v3_payload_bounds
// (schema_version/schema_v/source_mode/status/coach_note/bias_note håndteres af
// buildAwaitingAnalysisRow og rører aldrig klientinput), plus upload-specifikke
// grænser (mime, størrelse) som ikke er databasens ansvar.
// ORDRE 109 · commit 3: kort, forudbestemt årsagskode fra videocoach.html
// (plate:fail:auto / plate:fail:small-video / plate:manual:ok) - aldrig fri
// tekst, så et forkert klientbygget felt ikke kan smugle andet ind her.
// ORDRE 262 · commit 3: manglede de tre VELLYKKEDE auto-kalibrerings-ruter
// (wizardClick sætter vcPlateCalibReason=`plate:auto:${autoCalib.lastRoute}`,
// lastRoute er 'ring'/'farve'/'lum', se public/videocoach.html) - enhver
// atlet der kørte lokal sporing (auto-kalibrering lykkedes) FØR afsendelse
// ramte derfor ALTID "Kalibreringsårsagen er ugyldig" og landede stille i
// sendearkets faldback, uanset flow. Fundet ved "Film et sæt"s Gem-knap
// (samme eksisterende vej), rettet her fordi den blokerede for at genbruge
// vejen - ingen sammenhæng med selve trackeren.
const PLATE_CALIBRATION_REASONS = new Set([
  'plate:fail:auto', 'plate:fail:small-video', 'plate:manual:ok',
  'plate:auto:ring', 'plate:auto:farve', 'plate:auto:lum',
])

// U9 (Marc 11. nov.): atletens egen stangbane følger med videoen, så coachen ikke skal spore igen.
// Samme format og grænser som videoCoachSubmission (x0, y0 og højst 240 skridt på ±2000).
function validBarPath(barPath) {
  const step = value => typeof value === 'number' && Number.isFinite(value) && value >= -2000 && value <= 2000
  return !!barPath && typeof barPath === 'object' && !Array.isArray(barPath) &&
    typeof barPath.x0 === 'number' && Number.isFinite(barPath.x0) && typeof barPath.y0 === 'number' && Number.isFinite(barPath.y0) &&
    Array.isArray(barPath.dx) && Array.isArray(barPath.dy) && barPath.dx.length === barPath.dy.length &&
    barPath.dx.length > 0 && barPath.dx.length <= 240 && barPath.dx.every(step) && barPath.dy.every(step) &&
    Object.values(barPath).every(value => Array.isArray(value) || value === null || ['number', 'string'].includes(typeof value)) &&
    JSON.stringify(barPath).length <= 20000
}

export function validateVideoUploadRequest({
  athleteId, clientAnalysisId, lift, variation, mimeType, fileSize, loadKg, rpe, athleteNote,
  plateCalibration, barPath = null, maxBytes = VIDEOCOACH_UPLOAD_MAX_BYTES,
} = {}) {
  if (!isUuid(athleteId)) return 'Atleten kunne ikke identificeres'
  if (!isUuid(clientAnalysisId)) return 'Analysen mangler et gyldigt klient-id'
  if (!['squat', 'bench', 'deadlift'].includes(lift)) return 'Ugyldigt løft'
  if (!/^[a-z0-9]+([._-][a-z0-9]+)*$/.test(variation || '')) return 'Ugyldig variation'
  if (!videoUploadMimeAllowed(mimeType)) return 'Videoformatet understøttes ikke'
  if (!finiteInRange(fileSize, Number.MIN_VALUE, Number.MAX_VALUE) || fileSize == null) return 'Videofilen er tom eller ugyldig'
  if (Number(fileSize) > maxBytes) return videoUploadTooLargeText(maxBytes)
  if (!finiteInRange(loadKg, 0, 1000)) return 'Belastningen er uden for det tilladte interval'
  if (!finiteInRange(rpe, 0, 10)) return 'RPE er uden for det tilladte interval'
  if (athleteNote != null && (typeof athleteNote !== 'string' || athleteNote.length > 1000))
    return 'Notatet til coachen er ugyldigt eller for langt'
  if (plateCalibration != null && !PLATE_CALIBRATION_REASONS.has(plateCalibration))
    return 'Kalibreringsårsagen er ugyldig'
  if (barPath != null && !validBarPath(barPath)) return 'Stangbanen har et ugyldigt eller for stort format'
  return null
}

// Rækken der indsættes med analysis_state='awaiting_analysis'. reps_count,
// metrics, findings, rep_details og bar_path udelades bevidst — kolonnernes
// egne defaults (allerede kørt i produktion, se migrationen) gør en række
// uden analyse lovlig efter video_analyses_v3_payload_bounds.
export function buildAwaitingAnalysisRow({
  athleteId, athleteName = null, clientAnalysisId, lift, variation,
  loadKg = null, rpe = null, athleteNote = null, videoPath, plateCalibration = null, barPath = null,
}) {
  return {
    ...(validBarPath(barPath) ? { bar_path: JSON.parse(JSON.stringify(barPath)) } : {}),
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
      // ORDRE 109 · commit 3: findes kun feltet i eksisterende JSON-payload -
      // ingen migration. Se PLATE_CALIBRATION_REASONS ovenfor for de gyldige
      // værdier; null betyder auto-kalibrering lykkedes uden problemer.
      plate_calibration: plateCalibration || null,
    },
  }
}
