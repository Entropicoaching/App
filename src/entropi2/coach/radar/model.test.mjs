import test from 'node:test'
import assert from 'node:assert/strict'
import { coachHomeModel } from '../coachModel.mjs'
import { coachRadarModel } from './model.mjs'
import { fixture, day } from './fixtures.mjs'
import { shiftDay } from './rules.mjs'

const inspect = ({ source, snapshot }) => coachRadarModel({ enabled: true, source, snapshot, context: coachHomeModel(source, day) })
const keys = f => inspect(f).rows.flatMap(row => row.signals.map(signal => signal.key))
function message(id, extra = {}) {
  return { athlete_id: id, sender_role: 'athlete', category: 'besked', created_at: `${day}T10:00:00Z`, ...extra }
}
test('OFF ignores source; empty known reads and unknown reads have distinct states', () => {
  assert.equal(coachRadarModel({ get source() { throw Error('OFF') } }), null)
  assert.deepEqual(inspect(fixture()).rows, [])
  const f = fixture(); f.snapshot = null
  assert.equal(inspect(f).state, 'partial'); assert.deepEqual(keys(f), [])
  f.source.athletes = []; f.source.readContext.athleteIds = []
  assert.equal(inspect(f).rows.length, 0)
})
test('unanswered messages use latest sender, including read messages, never unread count alone', () => {
  const f = fixture(), id = f.ids[0]
  f.source.coachMorningData.messages.rows = [message(id)]
  assert.deepEqual(keys(f), ['messages'])
  f.source.unreadByTrack = { [id]: { besked: 50 } }
  f.source.coachMorningData.messages.rows.push(message(id, { sender_role: 'coach', created_at: `${day}T11:00:00Z` }))
  assert.deepEqual(keys(f), [])
  f.source.coachMorningData.messages.rows = [message(id), message(id, { sender_role: 'coach' })]
  assert.deepEqual(keys(f), [], 'equal timestamp with different roles is ambiguous')
  f.source.coachMorningData.messages.rows = [message(id, { created_at: '2026-11-07T10:00:00Z' })]
  assert.deepEqual(keys(f), [])
})
test('videos require an actual pending athlete submission, valid time and unique ID', () => {
  const f = fixture(), id = f.ids[0]
  const video = { id: 'synthetic-video', athlete_id: id, status: 'draft', source_mode: 'athlete_submission', created_at: `${day}T09:00:00Z` }
  f.source.coachMorningData.videos.rows = [video, { ...video }]
  assert.deepEqual(keys(f), ['videos']); assert.match(inspect(f).rows[0].reason, /^1 video/)
  for (const extra of [{ status: 'shared' }, { source_mode: 'coach_upload' }, { created_at: null }, { athlete_id: 'foreign' }]) {
    f.source.coachMorningData.videos.rows = [{ ...video, ...extra }]; assert.deepEqual(keys(f), [])
  }
})
test('owner/day/roster boundaries, hidden athletes, load failures and source caps exclude stale facts', () => {
  for (const change of [f => { f.source.session.user.id = 'foreign' }, f => { f.source.readContext.day = '2026-11-05' },
    f => { f.source.readContext.athleteIds = [] }, f => { f.source.athletes[0].hidden = true },
    f => { f.source.hiddenAthleteIds = new Set(f.ids) }, f => { f.source.loading = true }, f => { f.source.loadError = true }]) {
    const f = fixture(); f.source.athletes[0].competition_date = day; change(f)
    assert.deepEqual(inspect(f).rows, [])
  }
  for (const change of [f => { f.snapshot.coachId = 'foreign' }, f => { f.snapshot.day = '2026-11-05' },
    f => { f.snapshot.athleteIds = ['foreign'] }, f => { f.snapshot.from = '2026-10-25' },
    f => { f.snapshot.through = '2026-11-05' }, f => { f.snapshot.logs.complete = false },
    f => { f.snapshot.logs.rows[0].athlete_id = 'foreign' }, f => { f.snapshot.logs.rows[0].logged_at = '2026-11-07T10:00:00Z' },
    f => { f.snapshot.logs.rows.push({ ...f.snapshot.logs.rows[0] }) }]) {
    const f = fixture(); f.snapshot.logs.rows[0].logged_at = '2026-10-30T10:00:00Z'; change(f)
    assert.deepEqual(keys(f), [])
  }
})
test('missing or failed domains never infer absence; independent competition evidence survives', () => {
  for (const state of ['error', 'loading', 'partial']) {
    const f = fixture(); f.snapshot.logs.state = state; f.snapshot.logs.rows = []
    f.source.athletes[0].competition_date = shiftDay(day, 21)
    assert.deepEqual(keys(f), ['competition']); assert.equal(inspect(f).state, 'partial')
  }
  const f = fixture(); f.snapshot.logs.rows = []
  assert.deepEqual(keys(f), ['noLog'])
  f.snapshot.logs.rows = [{ id: 'old-log', athlete_id: f.ids[0], logged_at: '2026-11-01T10:00:00Z', skipped: false, sessionId: 's' }]
  assert.deepEqual(keys(f), ['noLog'])
  f.snapshot.logs.rows[0].logged_at = '2026-11-02T10:00:00Z'; assert.deepEqual(keys(f), [])
  f.snapshot.logs.rows[0].skipped = true; assert.deepEqual(keys(f), ['noLog'])
})
test('all numeric trends use actual distinct days; pain retains body area and source', () => {
  const f = fixture(), id = f.ids[0]
  f.snapshot.logs.rows = [13, 10, 7, 6, 3, 0].map((age, i) => ({ id: `log-${i}`, athlete_id: id,
    logged_at: `${shiftDay(day, -age)}T10:00:00Z`, skipped: false, sessionId: `s-${i}`, rpe_actual: i < 3 ? 6 : 8 }))
  f.snapshot.readiness.rows = [13, 10, 7, 6, 3, 0].map((age, i) => ({ athlete_id: id,
    day: shiftDay(day, -age), sleep: i < 3 ? 8 : 6, readiness: i < 3 ? 80 : 60,
    pain: i < 3 ? 2 : 4, location: 'knæ', source: 'athlete_manual' }))
  const before = JSON.stringify(f)
  assert.deepEqual(keys(f), ['pain', 'rpe', 'readiness', 'sleep'])
  assert.equal(inspect(f).rows[0].score, 130)
  assert.equal(JSON.stringify(f), before)
  f.snapshot.readiness.rows.slice(3).forEach(row => { row.location = 'ryg' })
  assert.deepEqual(keys(f), ['rpe', 'readiness', 'sleep'])
  f.snapshot.readiness.rows.forEach(row => { row.source = 'automatic' })
  assert.deepEqual(keys(f), ['rpe'])
  f.snapshot.logs.rows.forEach(row => { row.rpe_actual = null })
  assert.deepEqual(keys(f), [])
})
test('missed sessions use explicit planned IDs in the last ended week, never current-week shortfall', () => {
  const f = fixture(), id = f.ids[0]
  f.source.calendarWeeks[id] = [{ start_date: '2026-10-26', exercise_count: 1,
    actionSessions: [{ id: 'planned-a', plannedSets: 3 }, { id: 'planned-b', plannedSets: 3 }] }]
  assert.deepEqual(keys(f), ['missed']); assert.match(inspect(f).rows[0].reason, /^2 pas/)
  f.snapshot.logs.rows[0].sessionId = 'planned-a'
  assert.match(inspect(f).rows[0].reason, /^1 pas/)
  f.source.calendarWeeks[id][0].start_date = '2026-11-02'
  assert.deepEqual(keys(f), [])
  f.source.calendarWeeks[id][0].start_date = '2026-10-26'
  delete f.snapshot.logs.rows[0].sessionId; assert.deepEqual(keys(f), [])
  f.snapshot.logs.rows[0].sessionId = 'planned-a'
  delete f.source.calendarWeeks[id][0].actionSessions; assert.deepEqual(keys(f), [])
})
test('block end uses current named block even when another block follows; ambiguous and undated blocks vanish', () => {
  const f = fixture(), id = f.ids[0]
  f.source.calendarWeeks[id] = [
    { start_date: '2026-11-02', exercise_count: 1, block_name: 'Syntetisk blok A' },
    { start_date: '2026-11-09', exercise_count: 1, block_name: 'Syntetisk blok B' },
  ]
  assert.deepEqual(keys(f), ['block']); assert.match(inspect(f).rows[0].reason, /om 2 dage/)
  f.source.calendarWeeks[id].push({ start_date: '2026-11-16', exercise_count: 1, block_name: 'Syntetisk blok A' })
  assert.deepEqual(keys(f), [])
  f.source.calendarWeeks[id].pop(); f.source.calendarWeeks[id][0].block_name = null
  assert.deepEqual(keys(f), [])
  f.source.calendarWeeks[id][0].block_name = 'A'; f.source.calendarWeeks[id][1].start_date = null
  assert.deepEqual(keys(f), [])
})
test('1, 12 and 40 athletes rank deterministically, without mutating inputs or including foreign rows', () => {
  for (const count of [1, 12, 40]) {
    const f = fixture(count)
    f.source.coachMorningData.messages.rows = f.ids.map(id => message(id))
    const before = JSON.stringify(f), rows = inspect(f).rows
    assert.equal(rows.length, count); assert.deepEqual(rows.map(r => r.athlete.id), [...f.ids])
    assert.equal(JSON.stringify(f), before)
    f.source.athletes.reverse(); f.source.coachMorningData.messages.rows.reverse(); f.snapshot.logs.rows.reverse()
    assert.deepEqual(inspect(f).rows, rows)
  }
})
