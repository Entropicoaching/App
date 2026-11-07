// Regression checks use actual product imports and synthetic database pages.
import test from 'node:test'
import assert from 'node:assert/strict'
import { coachHomeModel } from '../coachModel.mjs'
import { coachRadarModel } from './model.mjs'
import { loadRadarSnapshot, RADAR_READ_CAP } from './read.mjs'
import { fixture, day } from './fixtures.mjs'

function pagedClient(tables, { serverCap = 1000, failAt, repeat = false } = {}) {
  const calls = []
  return { calls, client: { from(table) {
    const call = { table, methods: [] }; calls.push(call)
    const query = Object.fromEntries(['select', 'in', 'gte', 'lte', 'order'].map(method => [method, (...args) => {
      call.methods.push([method, ...args]); return query
    }]))
    const page = (start, end) => {
      if (table === 'exercise_logs' && start >= failAt) return { data: null, error: { code: 'SYNTHETIC' } }
      const rows = tables[table] ?? []
      return { data: rows.slice(repeat ? 0 : start, (repeat ? 0 : start) + Math.min(end - start + 1, serverCap)), error: null }
    }
    query.limit = limit => { call.methods.push(['limit', limit]); return page(0, limit - 1) }
    query.range = (start, end) => { call.methods.push(['range', start, end]); return page(start, end) }
    return query
  } } }
}
const inspect = f => coachRadarModel({ enabled: true, ...f, context: coachHomeModel(f.source, day) })
const log = (id, athlete_id, logged_at = `${day}T10:00:00Z`) => ({ id, athlete_id, logged_at, skipped: false })

test('F1: 40 athletes, 1001 logs, server cap 1000 cannot invent noLog', async () => {
  const f = fixture(40)
  const logs = Array.from({ length: 1000 }, (_, i) => log(`old-${String(i).padStart(4, '0')}`, f.ids[i % 39], '2026-10-25T10:00:00Z'))
  logs.push(log('today-last', f.ids[39]))
  const fake = pagedClient({ exercise_logs: logs })
  f.snapshot = await loadRadarSnapshot({ enabled: true, scope: f.source.readContext, client: fake.client })
  assert.equal(f.snapshot.logs.complete, true)
  assert.equal(f.snapshot.logs.rows.length, 1001)
  assert.equal(inspect(f).rows.some(row => row.athlete.id === f.ids[39]), false)
  assert.equal(inspect(f).rows.length, 39)
  for (const row of inspect(f).rows) { assert.equal(row.score, 20); assert.equal(row.signals[0].key, 'noLog') }
  const pages = fake.calls.filter(c => c.table === 'exercise_logs')
  assert.deepEqual(pages.map(c => c.methods.at(-1)[1]), [0, 1000, 1001])
  assert.ok(pages[0].methods.at(-1)[2] >= 1000, 'requested page must exceed server cap')
  for (const c of pages) assert.deepEqual(c.methods.filter(m => m[0] === 'order'), [
    ['order', 'logged_at', { ascending: true }], ['order', 'id', { ascending: true }],
  ])
})

test('short nonempty pages are followed to empty for both sources, including equal timestamps', async () => {
  const f = fixture(3), logs = f.ids.map((id, i) => log(`tie-${i}`, id))
  const readiness = f.ids.map(athlete_id => ({ athlete_id, logged_date: day, readiness_score: 60 }))
  const fake = pagedClient({ exercise_logs: logs, readiness_logs: readiness }, { serverCap: 1 })
  f.snapshot = await loadRadarSnapshot({ enabled: true, scope: f.source.readContext, client: fake.client })
  assert.equal(f.snapshot.state, 'ready')
  assert.equal(f.snapshot.logs.rows.length, 3); assert.equal(f.snapshot.readiness.rows.length, 3)
  assert.deepEqual(inspect(f).rows, [])
  for (const table of ['exercise_logs', 'readiness_logs']) {
    const pages = fake.calls.filter(c => c.table === table)
    assert.deepEqual(pages.map(c => c.methods.at(-1)[1]), [0, 1, 2, 3])
    if (table === 'readiness_logs') for (const c of pages) assert.deepEqual(c.methods.filter(m => m[0] === 'order'), [
      ['order', 'logged_date', { ascending: true }], ['order', 'athlete_id', { ascending: true }],
    ])
  }
})

test('a failure on a later page discards all logs and never proves absence', async () => {
  const f = fixture(2), fake = pagedClient({ exercise_logs: [log('one', f.ids[0])] }, { serverCap: 1, failAt: 1 })
  f.source.athletes[1].competition_date = day
  f.snapshot = await loadRadarSnapshot({ enabled: true, scope: f.source.readContext, client: fake.client })
  assert.equal(f.snapshot.state, 'partial'); assert.equal(f.snapshot.logs.complete, false)
  assert.deepEqual(f.snapshot.logs.rows, [])
  assert.deepEqual(inspect(f).rows.map(r => r.signals.map(s => s.key)), [['competition']])
})

test('overlapping pages fail closed even when they contain only out-of-window UTC rows', async () => {
  const f = fixture(), fake = pagedClient({ exercise_logs: [log('outside', f.ids[0], '2026-10-23T10:00:00Z')] }, { serverCap: 1, repeat: true })
  f.snapshot = await loadRadarSnapshot({ enabled: true, scope: f.source.readContext, client: fake.client })
  assert.equal(f.snapshot.logs.complete, false); assert.deepEqual(inspect(f).rows, [])
  assert.ok(fake.calls.length < 10, 'duplicate pagination must terminate promptly')
})

test('the original row ceiling remains unknown rather than a truncated complete read', async () => {
  const f = fixture(), rows = Array.from({ length: RADAR_READ_CAP }, (_, i) => log(`cap-${String(i).padStart(5, '0')}`, f.ids[0]))
  const fake = pagedClient({ exercise_logs: rows })
  f.snapshot = await loadRadarSnapshot({ enabled: true, scope: f.source.readContext, client: fake.client })
  assert.equal(f.snapshot.logs.complete, false); assert.deepEqual(f.snapshot.logs.rows, [])
  assert.deepEqual(inspect(f).rows, [])
})

test('9999 rows followed by empty are complete; reaching the page budget is unknown', async () => {
  const f = fixture(), rows = Array.from({ length: RADAR_READ_CAP - 1 }, (_, i) => log(`below-${String(i).padStart(5, '0')}`, f.ids[0]))
  const fake = pagedClient({ exercise_logs: rows })
  f.snapshot = await loadRadarSnapshot({ enabled: true, scope: f.source.readContext, client: fake.client })
  assert.equal(f.snapshot.logs.complete, true); assert.equal(f.snapshot.logs.rows.length, RADAR_READ_CAP - 1)
  assert.deepEqual(inspect(f).rows, [])
  const small = pagedClient({ exercise_logs: rows }, { serverCap: 1 })
  f.snapshot = await loadRadarSnapshot({ enabled: true, scope: f.source.readContext, client: small.client })
  assert.equal(small.calls.filter(c => c.table === 'exercise_logs').length, 100)
  assert.equal(f.snapshot.logs.complete, false); assert.deepEqual(inspect(f).rows, [])
})

test('a client without pagination cannot provide absence evidence', async () => {
  const f = fixture(), fake = pagedClient({})
  const client = { from(table) { const query = fake.client.from(table); delete query.range; return query } }
  f.snapshot = await loadRadarSnapshot({ enabled: true, scope: f.source.readContext, client })
  assert.equal(f.snapshot.state, 'partial'); assert.deepEqual(inspect(f).rows, [])
})

function* permutations(rows) {
  if (!rows.length) { yield []; return }
  for (let i = 0; i < rows.length; i++) for (const rest of permutations(rows.filter((_, j) => i !== j))) yield [rows[i], ...rest]
}
const message = (id, role, time, category = 'besked') => ({ athlete_id: id, sender_role: role, created_at: `${day}T${time}:00Z`, category })

test('F2: every permutation clears old ties when a unique newer athlete or coach message exists', () => {
  for (const role of ['athlete', 'coach']) {
    const f = fixture(40), id = f.ids[20]
    const rows = [message(id, 'athlete', '08:00'), message(id, 'coach', '08:00'), message(id, role, '09:00')]
    const expected = role === 'athlete' ? [{ id, score: 50, keys: ['messages'] }] : []
    for (const ordering of permutations(rows)) {
      f.source.coachMorningData.messages.rows = ordering
      assert.deepEqual(inspect(f).rows.map(r => ({ id: r.athlete.id, score: r.score, keys: r.signals.map(s => s.key) })), expected)
    }
  }
})

test('latest conflicting ties stay ambiguous in every permutation; same-role duplicates do not', () => {
  for (const tiedRole of ['coach', 'athlete']) {
    const f = fixture(), id = f.ids[0]
    const rows = [message(id, 'athlete', '08:00'), message(id, 'athlete', '09:00'), message(id, tiedRole, '09:00')]
    for (const ordering of permutations(rows)) {
      f.source.coachMorningData.messages.rows = ordering
      assert.deepEqual(inspect(f).rows.map(r => r.score), tiedRole === 'coach' ? [] : [50])
    }
  }
})

test('message tracks and malformed-message guards remain independent of old-tie reset', () => {
  const f = fixture(), id = f.ids[0]
  f.source.coachMorningData.messages.rows = [message(id, 'athlete', '08:00'), message(id, 'coach', '08:00'),
    message(id, 'athlete', '09:00'), message(id, 'athlete', '09:00', 'teknik'), message(id, 'coach', '09:00', 'teknik')]
  assert.equal(inspect(f).rows[0].score, 50)
  f.source.coachMorningData.messages.rows.push(message(id, 'unknown', '07:00'))
  assert.deepEqual(inspect(f).rows, [])
})

test('all six old-tie/new-message permutations give identical full ranking for 40 athletes', () => {
  const f = fixture(40)
  const triples = f.ids.map((id, i) => [message(id, 'athlete', '08:00'), message(id, 'coach', '08:00'), message(id, i % 2 ? 'coach' : 'athlete', '09:00')])
  f.source.athletes.forEach((a, i) => { if (i % 3 === 0) a.competition_date = day })
  let expected
  for (const order of permutations([0, 1, 2])) {
    f.source.coachMorningData.messages.rows = triples.flatMap(rows => order.map(i => rows[i]))
    const before = JSON.stringify(f)
    const result = inspect(f).rows
    if (!expected) expected = result
    assert.deepEqual(result, expected)
    assert.equal(JSON.stringify(f), before)
    f.source.athletes.reverse()
  }
  assert.ok(expected.length > 20)
  assert.equal(expected[0].score, 60)
})
