import test from 'node:test'
import assert from 'node:assert/strict'
import { MOBILITY_DONE_PREFIX as prefix, readMobilityDone, markMobilityDone, mobilityDoneWeek } from './mobilityDone.mjs'

function fixture() {
  const values = new Map(), writes = []
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem(key, value) { writes.push(key); values.set(key, value) },
  }
  const options = { enabled: true, athleteId: 'synthetic-a', storage }
  const mark = (routineId = 'routine-1', day = '2026-11-03', extra = {}) =>
    markMobilityDone({ ...options, routineId, day, ...extra })
  const week = (screenDate = '2026-11-03', weeklyTarget = 3) =>
    mobilityDoneWeek({ ...options, screenDate, weeklyTarget })
  return { values, writes, storage, options, mark, week }
}

test('OFF and missing opt-in do not touch storage', () => {
  const storage = new Proxy({}, { get() { throw Error('unexpected access') } })
  for (const enabled of [undefined, false, 'true', 1]) {
    assert.deepEqual(readMobilityDone({ enabled, storage }), { entries: [], error: null })
    assert.equal(markMobilityDone({ enabled, storage }).saved, false)
    assert.equal(mobilityDoneWeek({ enabled, storage }), null)
  }
})

test('save/read roundtrip, duplicate routine/day, separate routines and athletes', () => {
  const f = fixture()
  assert.deepEqual(readMobilityDone(f.options), { entries: [], error: null })
  assert.equal(f.mark().changed, true)
  assert.equal(f.mark().changed, false)
  assert.equal(f.writes.length, 1)
  f.mark('routine-2'); f.mark('routine-1', '2026-11-04')
  f.mark('routine-other', '2026-11-03', { athleteId: 'synthetic-b' })
  assert.equal(readMobilityDone(f.options).entries.length, 3)
  assert.deepEqual(readMobilityDone({ ...f.options, athleteId: 'synthetic-b' }).entries,
    [{ routineId: 'routine-other', day: '2026-11-03' }])
  assert.ok(f.writes.every(key => key.startsWith(prefix)))
  const w = f.week()
  assert.equal(w.label, '3 af 3 rutiner denne uge')
  assert.equal(w.days.length, 7)
  assert.deepEqual(w.days.map(d => d.count), [0, 2, 1, 0, 0, 0, 0])
  assert.equal(w.days[1].done, true)
  assert.equal(f.week('2026-11-03', 1).completed, 3)
})

test('corrupt, unknown and malformed histories stay untouched, also on mark', () => {
  const f = fixture()
  for (const raw of ['{', 'null', '[]', JSON.stringify({ version: 2, entries: [] }),
    JSON.stringify({ version: 1, athleteId: 'synthetic-b', entries: [] }),
    JSON.stringify({ version: 1, athleteId: 'synthetic-a', entries: [{ routineId: 'x', day: '2026-02-30' }] }),
    JSON.stringify({ version: 1, athleteId: 'synthetic-a', entries: [null] })]) {
    f.values.set(prefix + 'synthetic-a', raw)
    const r = readMobilityDone(f.options)
    assert.deepEqual(r.entries, []); assert.ok(r.error)
    assert.equal(f.mark().saved, false)
    assert.equal(f.values.get(prefix + 'synthetic-a'), raw)
    assert.equal(f.writes.length, 0)
    assert.equal(f.week().days.length, 7)
    assert.equal(f.week().completed, 0); assert.ok(f.week().error)
  }
})

test('storage read and write exceptions are visible without optimistic completion', () => {
  const f = fixture(); f.mark()
  const before = f.values.get(prefix + 'synthetic-a')
  f.storage.setItem = () => { throw Error('quota') }
  const failed = f.mark('not-saved')
  assert.equal(failed.error, 'write-failed'); assert.equal(failed.saved, false)
  assert.equal(failed.entries.length, 1)
  assert.equal(f.values.get(prefix + 'synthetic-a'), before)
  f.storage.getItem = () => { throw Error('blocked') }
  assert.equal(readMobilityDone(f.options).error, 'read-failed')
  assert.equal(f.mark().error, 'read-failed')
  assert.equal(readMobilityDone({ ...f.options, storage: null }).error, 'read-failed')
})

test('cap keeps newest 400 calendar records, including out-of-order backfill', () => {
  const f = fixture()
  for (let i = 400; i >= 0; i--) {
    f.mark('routine', new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10))
  }
  const entries = readMobilityDone(f.options).entries
  assert.equal(entries.length, 400)
  assert.equal(entries[0].day, '2024-01-02')
  assert.equal(entries.at(-1).day, '2025-02-04')
  const persisted = JSON.parse(f.values.get(prefix + 'synthetic-a'))
  assert.deepEqual(persisted.entries, entries)
})

test('valid oversized read is bounded and deduplicated without repair writes', () => {
  const f = fixture()
  const entries = Array.from({ length: 405 }, (_, i) => ({ routineId: `r-${String(i).padStart(3, '0')}`, day: '2026-11-03' }))
  f.values.set(prefix + 'synthetic-a', JSON.stringify({ version: 1, athleteId: 'synthetic-a', entries: [...entries, entries[0]] }))
  assert.equal(readMobilityDone(f.options).entries.length, 400)
  assert.equal(f.writes.length, 0)
})

test('Sunday/Monday and year changes select exactly the surrounding week', () => {
  const f = fixture()
  f.mark('r', '2027-01-03'); f.mark('r', '2027-01-04')
  assert.equal(f.week('2027-01-03').weekStart, '2026-12-28')
  assert.equal(f.week('2027-01-03').weekEnd, '2027-01-03')
  assert.equal(f.week('2027-01-03').days[6].done, true)
  assert.equal(f.week('2027-01-04').weekStart, '2027-01-04')
  assert.equal(f.week('2027-01-04').days[0].done, true)
  assert.equal(f.week('2027-01-04').completed, 1)
})

test('Danish calendar instants across both DST transitions and local midnight', () => {
  const f = fixture()
  for (const [instant, expected] of [
    ['2026-03-28T23:30:00Z', '2026-03-29'],
    ['2026-03-29T00:30:00Z', '2026-03-29'],
    ['2026-03-29T01:30:00Z', '2026-03-29'],
    ['2026-03-29T22:30:00Z', '2026-03-30'],
    ['2026-10-25T00:30:00Z', '2026-10-25'],
    ['2026-10-25T01:30:00Z', '2026-10-25'],
    ['2026-10-25T23:30:00Z', '2026-10-26'],
  ]) {
    const result = f.mark(instant, new Date(instant))
    assert.ok(result.entries.some(e => e.routineId === instant && e.day === expected))
    const week = f.week(new Date(instant))
    assert.equal(week.days.length, 7)
    assert.ok(week.days.some(d => d.day === expected && d.done))
    assert.equal(new Set(week.days.map(d => d.day)).size, 7)
  }
  assert.equal(f.week('2026-03-29').weekStart, '2026-03-23')
  assert.equal(f.week('2026-03-30').weekStart, '2026-03-30')
  assert.equal(f.week('2026-10-25').weekStart, '2026-10-19')
})

test('invalid caller inputs do not write; leap dates and zero target are supported', () => {
  const f = fixture()
  for (const day of ['2026-02-29', '2026-04-31', '', '2026-11-03T12:00:00Z', new Date(NaN), null, 0]) {
    assert.equal(f.mark('r', day).error, 'invalid-input')
    assert.equal(f.week(day).error, 'invalid-input')
  }
  for (const routineId of ['', ' ', null, 1, 'x'.repeat(201)]) assert.equal(f.mark(routineId).saved, false)
  for (const athleteId of ['', null, ' ', 1]) assert.equal(f.mark('r', '2026-11-03', { athleteId }).saved, false)
  for (const target of [undefined, -1, 1.5, '3', NaN]) {
    assert.equal(mobilityDoneWeek({ ...f.options, screenDate: '2026-11-03', weeklyTarget: target }).error, 'invalid-input')
  }
  assert.equal(f.writes.length, 0)
  assert.equal(f.mark('r', '2028-02-29').saved, true)
  assert.equal(f.week('2028-02-29', 0).label, '1 af 0 rutiner denne uge')
})

test('callers cannot mutate returned records into subsequent history', () => {
  const f = fixture(); const result = f.mark()
  result.entries[0].routineId = 'changed'
  const week = f.week(); week.days[1].routineIds.push('changed')
  assert.equal(readMobilityDone(f.options).entries[0].routineId, 'routine-1')
  assert.equal(f.week().completed, 1)
})
