import test from 'node:test'
import assert from 'node:assert/strict'
import { readWeeklyLetter } from './readWeeklyLetter.mjs'

function fixture() {
  const calls = []
  let scope = { role: 'coach', ownerId: 'synthetic-owner', athleteId: 'synthetic-athlete' }
  let result = { data: Array.from({ length: 4 }, (_, i) => ({ id: `s${i}`,
    athlete_id: scope.athleteId, logged_date: `2026-11-0${i + 1}`, sleep_hours: 5 })) }
  let afterRead = () => {}
  const query = Object.fromEntries(['select', 'eq', 'gte', 'lte', 'order'].map(method => [method,
    (...args) => { calls.push([method, ...args]); return query }]))
  query.range = async (...args) => { calls.push(['range', ...args]); afterRead(); return result }
  const options = { enabled: true, getScope: () => scope, now: () => new Date('2026-11-04T12:00:00Z'),
    database: { from: table => { calls.push(['from', table]); return query } } }
  return { options, calls, rows: result.data,
    scope: patch => { scope = { ...scope, ...patch } }, result: value => { result = value },
    afterRead: fn => { afterRead = fn } }
}

test('actual reader: explicit scoped bounded sleep query feeds actual model, no cycle access', async () => {
  const f = fixture()
  for (const row of f.rows) Object.defineProperty(row, 'cycle', { get() { assert.fail('cycle read') } })
  const m = await readWeeklyLetter(f.options)
  assert.equal(m.state, 'ready'); assert.equal(m.evidence.id, 'sleepHours')
  assert.match(m.text, /søvn/); assert.equal(m.training, null); assert.equal(m.nutritionDays, null)
  assert.equal(m.incomplete, true)
  assert.deepEqual(f.calls, [['from', 'readiness_logs'], ['select', 'id,athlete_id,logged_date,sleep_hours'],
    ['eq', 'athlete_id', 'synthetic-athlete'], ['gte', 'logged_date', '2026-10-29'],
    ['lte', 'logged_date', '2026-11-04'], ['order', 'logged_date'], ['order', 'id'], ['range', 0, 999]])
})

test('empty and unknown sleep remain empty; zero hours is a known observation', async () => {
  for (const rows of [[], [{ id: 's', athlete_id: 'synthetic-athlete', logged_date: '2026-11-04', sleep_hours: null }]]) {
    const f = fixture(); f.result({ data: rows })
    assert.equal((await readWeeklyLetter(f.options)).state, 'empty')
  }
  const f = fixture(); f.rows.forEach(r => { r.sleep_hours = 0 })
  assert.equal((await readWeeklyLetter(f.options)).evidence.value, 0)
})

test('errors, incomplete, invalid, duplicate, foreign and out-of-period data fail closed', async () => {
  for (const change of [f => f.result({ error: {} }), f => f.result({ data: null }),
    f => f.result({ data: Array(1000).fill(f.rows[0]) }), f => f.rows.push(f.rows[0]),
    f => { f.rows[1].logged_date = f.rows[0].logged_date },
    f => { f.rows[0].athlete_id = 'other' }, f => { f.rows[0].logged_date = '2026-10-28' },
    f => { f.rows[0].logged_date = '2026-11-05' }, f => { f.rows[0].logged_date = '2026-02-30' },
    f => { f.rows[0].sleep_hours = '5' }, f => { f.rows[0].sleep_hours = NaN },
    f => { f.rows[0].sleep_hours = 25 }]) {
    const f = fixture(); change(f); await assert.rejects(readWeeklyLetter(f.options))
  }
})

test('scope changes, revocation and midnight during the read reject the result', async () => {
  for (const patch of [{ athleteId: 'other' }, { ownerId: 'other' }, { role: 'athlete' }]) {
    const f = fixture(); f.afterRead(() => f.scope(patch)); await assert.rejects(readWeeklyLetter(f.options))
  }
  const f = fixture(); let late = false
  f.options.now = () => new Date(late ? '2026-11-04T23:01:00Z' : '2026-11-04T22:59:00Z')
  f.afterRead(() => { late = true }); await assert.rejects(readWeeklyLetter(f.options))
  const denied = fixture(); denied.options.getScope = () => { throw Error('revoked') }
  await assert.rejects(readWeeklyLetter(denied.options)); assert.deepEqual(denied.calls, [])
})

test('strict OFF and athlete role never query; invalid clock fails', async () => {
  for (const enabled of [undefined, false, 1, 'true']) {
    assert.deepEqual(await readWeeklyLetter({ enabled,
      getScope() { assert.fail('OFF scope') }, database: new Proxy({}, { get() { assert.fail('OFF database') } }) }), { state: 'off' })
  }
  const f = fixture(); f.scope({ role: 'athlete' }); await assert.rejects(readWeeklyLetter(f.options))
  assert.deepEqual(f.calls, [])
  f.scope({ role: 'coach' }); f.options.now = () => new Date(NaN)
  await assert.rejects(readWeeklyLetter(f.options)); assert.deepEqual(f.calls, [])
})
