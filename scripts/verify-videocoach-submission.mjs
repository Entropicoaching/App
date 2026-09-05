import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { flushVideoCoachDraftQueue, isRetryableVideoCoachError, purgeVideoCoachDraftQueues,
  queueVideoCoachDraft,
  saveVideoCoachDraft, validateVideoCoachPayloadBounds,
  videoCoachSavedIdentityMatches } from '../src/videoCoachSubmission.js'

const row = {
  client_analysis_id: '11111111-1111-4111-8111-111111111111',
  athlete_id: '22222222-2222-4222-8222-222222222222',
}

function supabaseMock(results) {
  const calls = []
  const chain = {
    insert(value) { calls.push(['insert', value]); return chain },
    update(value) { calls.push(['update', value]); return chain },
    select(value) { calls.push(['select', value]); return chain },
    eq(column, value) { calls.push(['eq', column, value]); return chain },
    single() { calls.push(['single']); return Promise.resolve(results.shift()) },
    then(resolve, reject) { return Promise.resolve(results.shift()).then(resolve, reject) },
  }
  return { client: {
    from(table) { calls.push(['from', table]); return chain },
    rpc(name, args) { calls.push(['rpc', name, args]); return chain },
  }, calls }
}

function storageMock() {
  const values = new Map()
  return {
    get length() { return values.size },
    key(index) { return [...values.keys()][index] ?? null },
    getItem(key) { return values.get(key) ?? null },
    setItem(key, value) { values.set(key, value) },
    removeItem(key) { values.delete(key) },
  }
}

assert.equal(videoCoachSavedIdentityMatches(row, row), true)
assert.equal(videoCoachSavedIdentityMatches({ ...row, athlete_id: 'other' }, row), false)

{
  const saved = { ...row, id: 'analysis-1', status: 'draft' }
  const { client, calls } = supabaseMock([{ data: saved, error: null }])
  const result = await saveVideoCoachDraft(client, row)
  assert.equal(result.error, null)
  assert.equal(result.duplicate, false)
  assert.equal(result.data, saved)
  assert.equal(calls.some(call => call[0] === 'eq'), false)
}

{
  const saved = { ...row, id: 'analysis-athlete', status: 'coach_approved' }
  const { client, calls } = supabaseMock([
    { data: null, error: { code: '23505', message: 'duplicate' } },
    { data: saved, error: null },
  ])
  const result = await saveVideoCoachDraft(client, row, { athleteSubmission: true })
  assert.equal(result.error, null)
  assert.equal(result.duplicate, true)
  assert.equal(result.data.status, 'coach_approved')
  assert.deepEqual(calls.find(call => call[0] === 'rpc'), ['rpc',
    'get_my_video_analysis_submission_identity_v3',
    { p_client_analysis_id: row.client_analysis_id }])
}

// ORDRE 57 · commit 2: fuldførelse af en afventende atlet-video er en ren
// UPDATE på client_analysis_id - aldrig en ny INSERT ved siden af.
{
  const saved = { ...row, id: 'analysis-1', status: 'draft' }
  const { client, calls } = supabaseMock([{ data: saved, error: null }])
  const result = await saveVideoCoachDraft(client, row,
    { updateClientAnalysisId: row.client_analysis_id })
  assert.equal(result.error, null)
  assert.equal(result.duplicate, false)
  assert.equal(result.data, saved)
  assert.equal(calls.some(call => call[0] === 'insert'), false,
    'En fuldførelse må aldrig indsætte en ny række')
  assert.deepEqual(calls.find(call => call[0] === 'update'), ['update', row])
  assert.deepEqual(calls.find(call => call[0] === 'eq'),
    ['eq', 'client_analysis_id', row.client_analysis_id])
}

// En UPDATE der rammer 0 rækker (forkert client_analysis_id, eller RLS
// blokerer en anden coachs atlet) skal fejle synligt, ikke stille lykkes.
{
  const { client } = supabaseMock([{ data: null, error: { message: 'no rows' } }])
  const result = await saveVideoCoachDraft(client, row,
    { updateClientAnalysisId: 'et-andet-id' })
  assert.ok(result.error, 'En update uden match skal give en fejl')
}

// 23505-dublet-genforsøget gælder kun rene inserts, aldrig en UPDATE.
{
  const { client, calls } = supabaseMock([
    { data: null, error: { code: '23505', message: 'duplicate' } },
  ])
  const result = await saveVideoCoachDraft(client, row,
    { updateClientAnalysisId: row.client_analysis_id })
  assert.equal(result.duplicate, false)
  assert.equal(calls.filter(call => call[0] === 'update').length, 1,
    'En UPDATE må ikke udløse et ekstra dublet-genforsøg')
}

assert.equal(isRetryableVideoCoachError({ message: 'Failed to fetch' }), true)
assert.equal(isRetryableVideoCoachError({ code: 'PGRST001' }), true)
assert.equal(isRetryableVideoCoachError({ code: '42501' }), false)
assert.equal(isRetryableVideoCoachError({ code: 'VC_IDENTITY_MISMATCH' }), false)

const athleteView = await readFile(new URL('../src/AthleteView.jsx', import.meta.url), 'utf8')
assert.match(athleteView, /queueVideoCoachDraft\(safeRow,[\s\S]*dispatchEvent\(new Event\(ATHLETE_VIDEOCOACH_QUEUE_CHANGED\)\)/,
  'En ny offlinekladde skal selv starte retry-kæden uden et online-event')
assert.match(athleteView, /addEventListener\(ATHLETE_VIDEOCOACH_QUEUE_CHANGED, retryWhenQueueChanges\)/)
const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
assert.match(appSource, /!session \|\| \(previousUserId && previousUserId !== session\.user\.id\)[\s\S]*purgeVideoCoachDraftQueues\(\)/,
  'Logout og profilskifte skal rydde lokalt gemte videoanalyser')

const boundedRow = {
  ...row, reps_count: 1, reps: [1], rep_details: [{ start_s: 0, end_s: 1,
    valid_ratio: 0.95, confidence: 0.9 }], load_kg: 100, rpe: 8,
  low_conf_pct: 5, position_quality_pct: null,
  bar_path: { dx: [1, 2], dy: [-2, -1] },
  metrics: { rom_cm: { value: 42, method: 'tracked_path_calibrated_v1', confidence: 0.9 } },
  findings: [{ summary: 'Stabil måling' }],
}
assert.equal(validateVideoCoachPayloadBounds(boundedRow), null)
assert.match(validateVideoCoachPayloadBounds({ ...boundedRow, reps_count: 21 }), /1 og 20/)
assert.match(validateVideoCoachPayloadBounds({ ...boundedRow,
  bar_path: { dx: Array(241).fill(1), dy: Array(241).fill(1) } }), /Stangbanen/)
assert.match(validateVideoCoachPayloadBounds({ ...boundedRow, rep_details: null }), /Repdetaljerne/)
assert.match(validateVideoCoachPayloadBounds({ ...boundedRow,
  rep_details: [{ ...boundedRow.rep_details[0], start_s: 2, end_s: 1 }] }), /Repdetaljerne/)
assert.equal(queueVideoCoachDraft(row, storageMock()), false,
  'En ufuldstændig payload må ikke lægges i offlinekøen')

{
  const storage = storageMock()
  storage.setItem('unrelated', 'keep')
  assert.equal(queueVideoCoachDraft(boundedRow, storage, 'owner-a'), true)
  assert.equal(purgeVideoCoachDraftQueues(storage), 1)
  assert.equal(storage.getItem('unrelated'), 'keep')
}

{
  const storage = storageMock()
  assert.equal(queueVideoCoachDraft(boundedRow, storage, 'owner-a'), true)
  const { client } = supabaseMock([])
  const result = await flushVideoCoachDraftQueue(client, row.athlete_id, storage, 'owner-b')
  assert.deepEqual(result, { sent: 0, remaining: 0, expired: 0, invalid: 1 })
  assert.equal(storage.length, 0, 'En kø fra en anden login-ejer skal slettes lokalt')
}

{
  const storage = storageMock()
  assert.equal(queueVideoCoachDraft(boundedRow, storage), true)
  assert.equal(storage.length, 1)
  const saved = { ...row, id: 'analysis-queued', status: 'draft' }
  const { client } = supabaseMock([{ data: saved, error: null }])
  const result = await flushVideoCoachDraftQueue(client, row.athlete_id, storage)
  assert.deepEqual(result, { sent: 1, remaining: 0, expired: 0, invalid: 0 })
  assert.equal(storage.length, 0)
}

{
  const storage = storageMock()
  assert.equal(queueVideoCoachDraft(boundedRow, storage), true)
  const { client } = supabaseMock([{ data: null, error: { code: 'PGRST001' } }])
  const result = await flushVideoCoachDraftQueue(client, row.athlete_id, storage)
  assert.deepEqual(result, { sent: 0, remaining: 1, expired: 0, invalid: 0 })
  assert.equal(storage.length, 1)
}

{
  const storage = storageMock()
  assert.equal(queueVideoCoachDraft(boundedRow, storage), true)
  const key = storage.key(0)
  const queued = JSON.parse(storage.getItem(key))
  queued.queued_at = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
  storage.setItem(key, JSON.stringify(queued))
  const { client } = supabaseMock([])
  const result = await flushVideoCoachDraftQueue(client, row.athlete_id, storage)
  assert.deepEqual(result, { sent: 0, remaining: 0, expired: 1, invalid: 0 })
  assert.equal(storage.length, 0)
}

{
  const storage = storageMock()
  assert.equal(queueVideoCoachDraft(boundedRow, storage), true)
  const key = storage.key(0)
  const queued = JSON.parse(storage.getItem(key))
  queued.row.rep_details = null
  storage.setItem(key, JSON.stringify(queued))
  const { client } = supabaseMock([])
  const result = await flushVideoCoachDraftQueue(client, row.athlete_id, storage)
  assert.deepEqual(result, { sent: 0, remaining: 0, expired: 0, invalid: 1 })
  assert.equal(storage.length, 0)
}

{
  const saved = { ...row, id: 'analysis-1', status: 'draft' }
  const { client, calls } = supabaseMock([
    { data: null, error: { code: '23505', message: 'duplicate' } },
    { data: saved, error: null },
  ])
  const result = await saveVideoCoachDraft(client, row)
  assert.equal(result.error, null)
  assert.equal(result.duplicate, true)
  assert.deepEqual(calls.find(call => call[0] === 'eq'),
    ['eq', 'client_analysis_id', row.client_analysis_id])
}

{
  const wrongAthlete = { ...row, athlete_id: '33333333-3333-4333-8333-333333333333' }
  const { client } = supabaseMock([
    { data: null, error: { code: '23505', message: 'duplicate' } },
    { data: wrongAthlete, error: null },
  ])
  const result = await saveVideoCoachDraft(client, row)
  assert.equal(result.duplicate, true)
  assert.match(result.error.message, /forkert atlet/)
}

console.log('VideoCoach gemmer accepterer kun en identisk, profilkoblet dublet.')
