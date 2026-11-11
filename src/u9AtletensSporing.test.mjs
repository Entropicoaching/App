import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validateVideoUploadRequest, buildAwaitingAnalysisRow } from './videoCoachUpload.js'

// U9 punkt 7 (Marc 11. nov.): "når jeg prøver at åbne en tilsendt video fra testatlet, siger den spor video,
// men det har atleten vel allerede gjort?" Atletens sporing blev aldrig sendt med; kun videoen.
// Nu følger stangbanen med (feltet bar_path findes og må sættes af atleten, ingen migration), og coachen
// ser atletens sporing. "Spor nu" vises kun, når der ingen sporing er.
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const base = { athleteId: '11111111-1111-4111-8111-111111111111', clientAnalysisId: '22222222-2222-4222-8222-222222222222',
  lift: 'squat', variation: 'standard', mimeType: 'video/mp4', fileSize: 1000 }
const barPath = { x0: 120, y0: 300, dx: [1, -2, 0], dy: [-40, -35, -20] }

test('U9 7: atletens stangbane valideres og følger med i den afventende række', () => {
  assert.equal(validateVideoUploadRequest({ ...base, barPath }), null)
  assert.equal(validateVideoUploadRequest({ ...base, barPath: null }), null)
  assert.match(validateVideoUploadRequest({ ...base, barPath: { x0: 1, y0: 2, dx: [1], dy: [] } }), /Stangbanen/)
  assert.match(validateVideoUploadRequest({ ...base, barPath: { x0: 1, y0: 2, dx: [9999], dy: [1] } }), /Stangbanen/)
  const row = buildAwaitingAnalysisRow({ ...base, videoPath: 'a/b.mp4', barPath })
  assert.deepEqual(row.bar_path, barPath)
  assert.equal(row.analysis_state, 'awaiting_analysis')
  assert.equal(Object.hasOwn(buildAwaitingAnalysisRow({ ...base, videoPath: 'a/b.mp4' }), 'bar_path'), false)
})

test('U9 7: videosiden sender atletens sporing med, og appen lægger den i rækken', () => {
  const html = read('../public/videocoach.html')
  const send = html.slice(html.indexOf('async function vcAthleteUploadAndGo'), html.indexOf('function vcAthleteCancelUpload'))
  assert.match(send, /barPath: vcAthleteTrackedBarPath\(lift\)/)
  const raw = html.slice(html.indexOf('function vcV3RequestUploadAndGoRaw'), html.indexOf('function vcV3RequestAbortUpload'))
  assert.match(raw, /barPath = null/); assert.match(raw, /loadKg, rpe, athleteNote, plateCalibration, barPath \}/)
  const bro = read('./athlete/useVideoCoachBro.js')
  assert.equal((bro.match(/barPath: message\.barPath/g) || []).length, 2)
})

test('U9 7: coachen ser atletens sporing; "Spor nu" kun uden sporing; listerne henter bar_path', () => {
  const tab = read('./dashboard/AnalyseTab.jsx')
  const card = tab.slice(tab.indexOf("if (analysis.analysis_state === 'awaiting_analysis') {"), tab.indexOf('const status = VIDEOCOACH_STATUS[analysis.status]'))
  assert.match(card, /Atletens sporing/)
  assert.match(card, /athleteTracked \? 'Åbn video →' : 'Spor nu →'/)
  assert.match(card, /<polyline/)
  const laes = read('./dashboard/laesninger.js')
  const history = laes.slice(laes.indexOf('async function fetchVideoCoachHistory'), laes.indexOf('async function fetchVideoCoachHistory') + 2500)
  for (const select of history.match(/\.select\('id,client_analysis_id[^']*'\)/g)) assert.match(select, /bar_path/)
})
