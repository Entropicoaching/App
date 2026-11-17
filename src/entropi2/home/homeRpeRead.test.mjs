import test from 'node:test'
import assert from 'node:assert/strict'
import { readHomeRpeLastTime } from './homeRpeRead.mjs'

function client(result, calls = []) {
  const q = { select: c => { calls.push(['select', c]); return q }, eq: (k, v) => { calls.push(['eq', k, v]); return q },
    order: (k, o) => { calls.push(['order', k, o]); return q }, limit: n => { calls.push(['limit', n]); return result } }
  return { from: table => { calls.push(['from', table]); return q } }
}
const row = (logged_at, rpe_actual) => ({ logged_at, rpe_actual })

test('ordre 1594: one read of own sets, only rpe and date, newest 60, no skipped sets', async () => {
  const calls = []
  assert.equal(await readHomeRpeLastTime({ athleteId: 'a1', client: client({ data: [row('2026-11-15T10:00:00Z', 8)] }, calls) }), true)
  assert.deepEqual(calls, [['from', 'exercise_logs'], ['select', 'rpe_actual,logged_at'], ['eq', 'athlete_id', 'a1'],
    ['eq', 'skipped', false], ['order', 'logged_at', { ascending: false }], ['limit', 60]])
})

test('ordre 1594: only the latest logged day counts', async () => {
  const data = [row('2026-11-15T10:00:00Z', null), row('2026-11-15T09:50:00Z', ''), row('2026-11-12T10:00:00Z', 9)]
  assert.equal(await readHomeRpeLastTime({ athleteId: 'a1', client: client({ data }) }), false)
  assert.equal(await readHomeRpeLastTime({ athleteId: 'a1', client: client({ data: [...data, row('2026-11-15T09:40:00Z', 7.5)] }) }), true)
  assert.equal(await readHomeRpeLastTime({ athleteId: 'a1', client: client({ data: [row('2026-11-12T10:00:00Z', 0)] }) }), true)
})

test('ordre 1594: no rows, error, broken rows, thrown error or no athlete give false', async () => {
  for (const result of [{ data: [] }, { error: { message: 'x' }, data: null }, { data: null }, { data: [null, row('nej', 8)] }])
    assert.equal(await readHomeRpeLastTime({ athleteId: 'a1', client: client(result) }), false)
  assert.equal(await readHomeRpeLastTime({ athleteId: 'a1', client: { from() { throw Error('net') } } }), false)
  assert.equal(await readHomeRpeLastTime({ athleteId: '', client: client({ data: [row('2026-11-15T10:00:00Z', 8)] }) }), false)
  assert.equal(await readHomeRpeLastTime({}), false)
})
