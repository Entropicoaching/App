import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { buildAwaitingAnalysisRow, buildVideoUploadPath, VIDEOCOACH_UPLOAD_BUCKET,
  VIDEOCOACH_UPLOAD_MAX_BYTES, validateVideoUploadRequest, videoUploadAlreadyExistsError,
  videoUploadExtForMime, videoUploadMimeAllowed } from '../src/videoCoachUpload.js'

const athleteId = '11111111-1111-4111-8111-111111111111'
const clientAnalysisId = '22222222-2222-4222-8222-222222222222'

// ---------- stibyggeren: <athlete_id>/<client_analysis_id>.<ext>, ext udledt af mime ----------
assert.equal(buildVideoUploadPath(athleteId, clientAnalysisId, 'video/mp4'),
  `${athleteId}/${clientAnalysisId}.mp4`)
assert.equal(buildVideoUploadPath(athleteId, clientAnalysisId, 'video/quicktime'),
  `${athleteId}/${clientAnalysisId}.mov`)
assert.equal(buildVideoUploadPath(athleteId, clientAnalysisId, 'video/webm'),
  `${athleteId}/${clientAnalysisId}.webm`)
assert.equal(buildVideoUploadPath(athleteId, clientAnalysisId, 'video/x-m4v'),
  `${athleteId}/${clientAnalysisId}.m4v`)
assert.equal(buildVideoUploadPath(athleteId, clientAnalysisId, 'video/3gpp'),
  `${athleteId}/${clientAnalysisId}.3gp`)
// Aldrig fra filnavnet - kun mime afgør ext. Et ukendt/tomt mime giver ingen sti.
assert.equal(buildVideoUploadPath(athleteId, clientAnalysisId, ''), null)
assert.equal(buildVideoUploadPath(athleteId, clientAnalysisId, 'video/mp4; codecs=avc1'), null)
assert.equal(buildVideoUploadPath(athleteId, clientAnalysisId, 'application/octet-stream'), null)
// Ugyldige id'er (fx athlete user_id i stedet for athletes.id) skal fejle stille.
assert.equal(buildVideoUploadPath('ikke-en-uuid', clientAnalysisId, 'video/mp4'), null)
assert.equal(buildVideoUploadPath(athleteId, 'ikke-en-uuid', 'video/mp4'), null)
assert.equal(videoUploadExtForMime('video/mp4'), 'mp4')
assert.equal(videoUploadExtForMime('video/avi'), null)
assert.equal(videoUploadMimeAllowed('video/mp4'), true)
assert.equal(videoUploadMimeAllowed('video/avi'), false)

console.log('Upload-stien er korrekt udledt af mime, aldrig af filnavnet.')

// ---------- validateVideoUploadRequest: samme tjekliste som insert-policyen ----------
const validRequest = {
  athleteId, clientAnalysisId, lift: 'squat', variation: 'competition_squat',
  mimeType: 'video/mp4', fileSize: 42_000_000, loadKg: 120, rpe: 8, athleteNote: 'Knæ lidt indad',
}
assert.equal(validateVideoUploadRequest(validRequest), null)
assert.match(validateVideoUploadRequest({ ...validRequest, athleteId: 'x' }), /atleten/i)
assert.match(validateVideoUploadRequest({ ...validRequest, clientAnalysisId: 'x' }), /klient-id/i)
assert.match(validateVideoUploadRequest({ ...validRequest, lift: 'ohp' }), /løft/i)
assert.match(validateVideoUploadRequest({ ...validRequest, variation: 'Konkurrence Squat' }), /variation/i)
assert.match(validateVideoUploadRequest({ ...validRequest, mimeType: 'video/avi' }), /format/i)
assert.match(validateVideoUploadRequest({ ...validRequest, fileSize: 0 }), /tom/i)
assert.match(validateVideoUploadRequest({ ...validRequest, fileSize: VIDEOCOACH_UPLOAD_MAX_BYTES + 1 }), /500 MB/i)
assert.equal(validateVideoUploadRequest({ ...validRequest, fileSize: VIDEOCOACH_UPLOAD_MAX_BYTES }), null)
assert.match(validateVideoUploadRequest({ ...validRequest, loadKg: 1001 }), /belastning/i)
assert.match(validateVideoUploadRequest({ ...validRequest, rpe: 11 }), /rpe/i)
assert.match(validateVideoUploadRequest({ ...validRequest, athleteNote: 'x'.repeat(1001) }), /notat/i)
assert.equal(validateVideoUploadRequest({ ...validRequest, loadKg: null, rpe: null, athleteNote: null }), null)

console.log('Upload-forespørgslen håndhæver samme grænser som databasen, plus mime/størrelse.')

// ---------- buildAwaitingAnalysisRow som tjekliste mod entropi_vc3_athlete_insert_own_draft ----------
const videoPath = buildVideoUploadPath(athleteId, clientAnalysisId, 'video/mp4')
const row = buildAwaitingAnalysisRow({
  athleteId, athleteName: 'Testatlet', clientAnalysisId, lift: 'squat',
  variation: 'competition_squat', loadKg: 120, rpe: 8, athleteNote: 'Se knæet', videoPath,
})

// entropi_vc3_athlete_insert_own_draft (20260815123142_videocoach_athlete_draft_idempotency.sql):
assert.equal(row.client_analysis_id, clientAnalysisId, 'client_analysis_id is not null')
assert.equal(row.schema_version, 3, 'schema_version = 3')
assert.equal(row.schema_v, 3, 'schema_v = 3')
assert.equal(row.source_mode, 'athlete_submission', 'source_mode = athlete_submission')
assert.equal(row.status, 'draft', 'status = draft')
assert.equal(row.coach_note, null, 'coach_note is null')
assert.equal(row.bias_note, null, 'bias_note is null')
// athlete_id sættes af os selv (rækkens ejer) - policyens exists-tjek på
// athletes.user_id kan kun bekræftes af databasen, ikke hermetisk her.
assert.equal(row.athlete_id, athleteId)
// video_analyses_v3_payload_bounds: kolonner UDELADT bevidst, så defaults
// (allerede sat i produktionsmigrationen) gør rækken lovlig uden analyse.
for (const column of ['reps_count', 'metrics', 'findings', 'rep_details', 'bar_path'])
  assert.equal(Object.prototype.hasOwnProperty.call(row, column), false,
    `${column} skal udelades - kolonnens default gør en afventende række lovlig`)
// lift/variation er NOT NULL på tabellen
assert.equal(row.lift, 'squat')
assert.equal(row.variation, 'competition_squat')
// den nye analysis_state-kontrakt (denne ordres migration)
assert.equal(row.analysis_state, 'awaiting_analysis')
assert.equal(row.video_path, videoPath)
assert.equal(row.session_context.athlete_note, 'Se knæet')

const rowWithoutOptionals = buildAwaitingAnalysisRow({
  athleteId, clientAnalysisId, lift: 'bench', variation: 'competition_bench', videoPath,
})
assert.equal(rowWithoutOptionals.load_kg, null)
assert.equal(rowWithoutOptionals.rpe, null)
assert.equal(rowWithoutOptionals.session_context.athlete_note, null)

console.log('En afventende række opfylder entropi_vc3_athlete_insert_own_draft-tjeklisten.')

// ---------- idempotent retry: uploaden må ikke fejle hårdt på en gentaget sti ----------
assert.equal(videoUploadAlreadyExistsError({ statusCode: '409' }), true)
assert.equal(videoUploadAlreadyExistsError({ statusCode: 409 }), true)
assert.equal(videoUploadAlreadyExistsError({ message: 'The resource already exists' }), true)
assert.equal(videoUploadAlreadyExistsError({ message: 'Duplicate' }), true)
assert.equal(videoUploadAlreadyExistsError({ statusCode: '400', message: 'Invalid mime type' }), false)
assert.equal(videoUploadAlreadyExistsError(null), false)
assert.equal(VIDEOCOACH_UPLOAD_BUCKET, 'videocoach-uploads')

console.log('En gentaget upload-sti genkendes som "allerede uploadet", ikke som en fatal fejl.')

// ---------- migrationsfilen er gemt, versionsstyret og markeret som allerede kørt ----------
const migrationsDir = new URL('../supabase/migrations/', import.meta.url)
const migrationNames = await import('node:fs/promises').then(fs => fs.readdir(migrationsDir))
const matches = migrationNames.filter(name => name.endsWith('_video_upload_and_go_v1.sql'))
assert.equal(matches.length, 1, 'Forventede præcis én migration for video_upload_and_go_v1')
const migration = await readFile(new URL(matches[0], migrationsDir), 'utf8')
assert.match(migration, /^-- ALLEREDE KØRT PÅ PRODUKTION 2026-09-05.*kør aldrig igen\.?\s*$/m)
assert.match(migration, /insert into storage\.buckets[\s\S]*'videocoach-uploads'/i)
assert.match(migration, /allowed_mime_types[\s\S]*video\/mp4[\s\S]*video\/quicktime[\s\S]*video\/webm/i)
assert.match(migration, /add column if not exists video_path text/i)
assert.match(migration, /add column if not exists analysis_state text not null default 'complete'/i)
assert.match(migration, /check \(analysis_state in \('awaiting_analysis', 'complete'\)\)/i)
assert.doesNotMatch(migration, /drop table|truncate|service_role|secret|password/i,
  'Migrationsfilen indeholder en forbudt konstruktion')

console.log('Migrationsfilen er versionsstyret, markeret som allerede kørt, og matcher det aftalte skema.')
