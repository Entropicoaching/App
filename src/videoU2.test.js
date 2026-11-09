// U2 (ordre 50): pålidelig videocoach. Hver prøve gengiver en påvist fejl på
// 4c60aa7b. Kun syntetiske data.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validateVideoUploadRequest } from './videoCoachUpload.js'
import { markUploadInflight, clearUploadInflight, takeStaleUploadInflight } from './athleteSilentFailLog.js'

const request = fileSize => ({
  athleteId: '00000000-0000-4000-8000-000000000001', clientAnalysisId: '00000000-0000-4000-8000-000000000002',
  lift: 'squat', variation: 'competition_squat', mimeType: 'video/mp4', fileSize, loadKg: 100, rpe: 8,
})
const MB = 1024 * 1024

test('videokøen: en video over lagerets 50 MB afvises, før overførslen starter', () => {
  const error = validateVideoUploadRequest(request(60 * MB))
  assert.match(error || '', /50 MB/)
  assert.match(error, /kortere klip eller i lavere kvalitet/)
  assert.equal(validateVideoUploadRequest(request(40 * MB)), null)
  assert.equal(validateVideoUploadRequest(request(50 * MB)), null)
})

function fakeStorage() {
  const data = new Map()
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key) }
}

test('upload-advarslen: et hurtigt afslag på en anden anmodning rydder ikke markøren for den igangværende upload', () => {
  const storage = fakeStorage()
  markUploadInflight('syntetisk-atlet', 'req-1', storage)
  clearUploadInflight('syntetisk-atlet', storage, 'req-2')
  assert.equal(takeStaleUploadInflight('syntetisk-atlet', storage)?.requestId, 'req-1')
})

test('upload-advarslen: bridgen rydder kun markøren for sin egen anmodning', () => {
  const source = readFileSync(new URL('./athlete/useVideoCoachBro.js', import.meta.url), 'utf8')
  assert.match(source, /clearUploadInflight\(currentAthlete\.id, undefined, message\.requestId\)/)
})

test('videokøen: coachens kø og ulæste beskeder hentes igen hvert minut, mens appen er synlig', () => {
  const source = readFileSync(new URL('./dashboard/useDashboardEffekter.js', import.meta.url), 'utf8')
  assert.match(source, /setInterval\(refreshWhenVisible, 60 \* 1000\)/)
  assert.doesNotMatch(source, /setInterval\(refreshWhenVisible, 5 \* 60 \* 1000\)/)
})
