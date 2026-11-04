import test from 'node:test'
import assert from 'node:assert/strict'
import { readCoachPrognose } from './coachPrognoseRead.mjs'

const now = '2026-11-04T12:00:00Z'
const row = i => ({ id: `synthetic-${i}`, athlete_id: 'synthetic-a' })
function fixture(pages) {
  const calls = []
  const client = { from(table) {
    const call = { table }; calls.push(call)
    const query = Object.fromEntries(['select', 'eq', 'gte', 'lte', 'order'].map(method => [method, (...args) => {
      ;(call[method] ??= []).push(args); return query
    }]))
    query.range = async (...args) => { call.range = args; return pages[calls.length - 1] }
    return query
  } }
  return { client, calls }
}

test('coach forecast reads only scoped history, including every page and block context', async () => {
  const first = Array.from({ length: 250 }, (_, i) => row(i))
  const f = fixture([{ data: first }, { data: [row(250)] }])
  assert.deepEqual(await readCoachPrognose(f.client, 'synthetic-a', now), [...first, row(250)])
  assert.equal(f.calls.length, 2)
  for (const call of f.calls) {
    assert.equal(call.table, 'exercise_logs')
    assert.deepEqual(call.eq, [['athlete_id', 'synthetic-a']])
    assert.deepEqual(call.gte, [['logged_at', '2026-08-11T00:00:00Z']])
    assert.deepEqual(call.lte, [['logged_at', '2026-11-04T12:00:00.000Z']])
    assert.match(call.select[0][0], /exercises\(name, sessions\(weeks\(block_name\)\)\)/)
    assert.deepEqual(call.order, [['logged_at', { ascending: true }], ['id', { ascending: true }]])
  }
  assert.deepEqual(f.calls.map(call => call.range), [[0, 249], [250, 499]])
})

test('empty, rejected, malformed and foreign histories stay distinct', async () => {
  assert.deepEqual(await readCoachPrognose(fixture([{ data: [] }]).client, 'synthetic-a', now), [])
  for (const page of [{ data: null }, { data: [], error: {} }, { data: {} },
    { data: [null] }, { data: [{ athlete_id: 'synthetic-b' }] }, { data: Array.from({ length: 251 }, (_, i) => row(i)) }])
    await assert.rejects(readCoachPrognose(fixture([page]).client, 'synthetic-a', now), /unavailable/)
  await assert.rejects(readCoachPrognose({ from() { throw Error('synthetic rejection') } }, 'synthetic-a', now), /synthetic rejection/)
})

test('missing identity or invalid clock never starts a read', async () => {
  const client = { from() { assert.fail('invalid scope started read') } }
  for (const id of [undefined, null, '', ' ', 42])
    await assert.rejects(readCoachPrognose(client, id, now), /scope/)
  for (const clock of [null, '2026-02-30', 'bad', new Date(NaN)])
    await assert.rejects(readCoachPrognose(client, 'synthetic-a', clock), /scope/)
})

test('pagination cap and later-page errors reject the entire snapshot', async () => {
  const full = { data: Array.from({ length: 250 }, (_, i) => row(i)) }
  const f = fixture(Array.from({ length: 20 }, () => full))
  await assert.rejects(readCoachPrognose(f.client, 'synthetic-a', now), /incomplete/)
  assert.equal(f.calls.length, 20)
  await assert.rejects(readCoachPrognose(fixture([full, { error: {}, data: [] }]).client, 'synthetic-a', now), /unavailable/)
})

test('cancelled scope starts no subsequent page or result', async () => {
  let current = false
  const f = fixture([])
  assert.equal(await readCoachPrognose(f.client, 'synthetic-a', now, () => current), null)
  assert.equal(f.calls.length, 0)
  f.client.from = () => ({ select() { return this }, eq() { return this }, gte() { return this }, lte() { return this }, order() { return this },
    async range() { current = false; return { data: Array.from({ length: 250 }, (_, i) => row(i)) } } })
  current = true
  assert.equal(await readCoachPrognose(f.client, 'synthetic-a', now, () => current), null)
})
