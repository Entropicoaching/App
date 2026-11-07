import test from 'node:test'
import assert from 'node:assert/strict'
import { loadRadarSnapshot, scopeKey, RADAR_READ_CAP, RADAR_READ_PAGE_SIZE } from './read.mjs'
import { fixture, day, mockClient } from './fixtures.mjs'

const scope = () => { const { source } = fixture(); return source.readContext }
test('reader OFF and invalid scope never inspect a client; empty roster makes zero queries', async () => {
  assert.deepEqual(await loadRadarSnapshot({ get client() { throw Error('OFF client') } }), { state: 'off' })
  for (const change of [s => { s.coachId = '' }, s => { s.day = '2026-02-30' }, s => { s.athleteIds.push(s.athleteIds[0]) }, s => { s.athleteIds = [''] }]) {
    const s = scope(); change(s); const fake = mockClient()
    assert.equal((await loadRadarSnapshot({ enabled: true, scope: s, client: fake.client })).state, 'error')
    assert.equal(fake.calls.length, 0)
  }
  const fake = mockClient(), s = { ...scope(), athleteIds: [] }
  assert.equal((await loadRadarSnapshot({ enabled: true, scope: s, client: fake.client })).state, 'ready')
  assert.equal(fake.calls.length, 0)
})
test('reader captures owner/day/roster and projects only radar fields from existing tables', async () => {
  const s = scope(), id = s.athleteIds[0]
  const fake = mockClient({
    exercise_logs: { data: [{ id: 'synthetic-log', athlete_id: id, logged_at: `${day}T10:00:00Z`, skipped: false, rpe_actual: 8,
      exercises: { sessions: { id: 'synthetic-session' } }, note: 'UNUSED-SENTINEL' }] },
    readiness_logs: { data: [{ athlete_id: id, logged_date: day, sleep_hours: 7, readiness_score: 60, pain: 3, pain_location: 'knæ', note: 'UNUSED-SENTINEL' }] },
  })
  const before = JSON.stringify(s), result = await loadRadarSnapshot({ enabled: true, scope: s, client: fake.client })
  assert.equal(result.state, 'ready'); assert.equal(result.from, '2026-10-24')
  assert.equal(result.logs.rows[0].sessionId, 'synthetic-session')
  assert.equal(result.readiness.rows[0].readiness, 60)
  assert.doesNotMatch(JSON.stringify(result), /UNUSED-SENTINEL/)
  assert.equal(JSON.stringify(s), before)
  assert.deepEqual(fake.calls.map(c => c.table), ['exercise_logs', 'readiness_logs', 'exercise_logs', 'readiness_logs'])
  for (const call of fake.calls) {
    assert.deepEqual(call.methods.find(m => m[0] === 'in'), ['in', 'athlete_id', s.athleteIds])
    const offset = fake.calls.indexOf(call) < 2 ? 0 : 1
    assert.deepEqual(call.methods.at(-1), ['range', offset, offset + RADAR_READ_PAGE_SIZE - 1])
    assert.equal(call.methods.some(m => ['insert', 'update', 'delete', 'rpc'].includes(m[0])), false)
  }
  assert.deepEqual(fake.calls[0].methods.find(m => m[0] === 'gte'), ['gte', 'logged_at', '2026-10-23T00:00:00Z'])
  s.athleteIds.push('changed-after-read'); assert.equal(result.athleteIds.length, 1)
})
test('failures, throws, cap, duplicate rows, wrong athlete and invalid dates fail the affected source only', async () => {
  for (const value of [{ error: true, data: [] }, {}, () => { throw Error('synthetic') },
    { data: Array.from({ length: RADAR_READ_CAP }, () => ({})) },
    { data: [{ athlete_id: 'foreign', logged_date: day }] },
    { data: [{ athlete_id: scope().athleteIds[0], logged_date: '2026-02-30' }] },
    { data: Array.from({ length: 2 }, () => ({ athlete_id: scope().athleteIds[0], logged_date: day })) },
  ]) {
    const fake = mockClient({ readiness_logs: value })
    const result = await loadRadarSnapshot({ enabled: true, scope: scope(), client: fake.client })
    assert.equal(result.state, 'partial'); assert.equal(result.readiness.state, 'error')
    assert.equal(result.logs.state, 'ready')
    assert.deepEqual(result.readiness.rows, [])
  }
})
test('Copenhagen DST days are filtered from wide UTC bounds, never host local time', async () => {
  for (const [date, inside, outside] of [
    ['2026-10-25', '2026-10-24T22:30:00Z', '2026-10-25T23:30:00Z'],
    ['2026-03-29', '2026-03-28T23:30:00Z', '2026-03-29T22:30:00Z'],
  ]) {
    const s = { ...scope(), day: date }, id = s.athleteIds[0]
    const fake = mockClient({ exercise_logs: { data: [inside, outside].map((logged_at, i) => ({ id: `log-${i}`, athlete_id: id, logged_at, skipped: false })) } })
    const result = await loadRadarSnapshot({ enabled: true, scope: s, client: fake.client })
    assert.equal(result.logs.rows.length, 1); assert.equal(result.logs.rows[0].logged_at, inside)
  }
})
test('same scope key is independent of roster order and changes with owner and day', () => {
  const s = { ...scope(), athleteIds: ['synthetic-b', 'synthetic-a'] }
  assert.equal(scopeKey(s), scopeKey({ ...s, athleteIds: [...s.athleteIds].reverse() }))
  assert.notEqual(scopeKey(s), scopeKey({ ...s, coachId: 'other' }))
  assert.notEqual(scopeKey(s), scopeKey({ ...s, day: '2026-11-07' }))
})
