import test from 'node:test'
import assert from 'node:assert/strict'
import { readWeeklyLetter } from './readWeeklyLetter.mjs'
import { activePlan, meal, coach } from '../../kostplan/rapport/reportFixture.mjs'

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
  assert.deepEqual(f.calls, [['from', 'readiness_logs'], ['select', 'id,athlete_id,logged_date,sleep_hours,energy,stress,soreness_level'],
    ['eq', 'athlete_id', 'synthetic-athlete'], ['gte', 'logged_date', '2026-10-29'],
    ['lte', 'logged_date', '2026-11-04'], ['order', 'logged_date'], ['order', 'id'], ['range', 0, 999]])
})

test('production recovery scales enter the draft with their own basis, never 0–10 soreness', async () => {
  const f = fixture()
  f.rows.forEach(row => Object.assign(row, { energy: 2, stress: 4, soreness_level: 5 }))
  const m = await readWeeklyLetter(f.options)
  assert.match(m.text, /energi: 2\/5.*4\/7 dage/)
  assert.match(m.text, /stress: 4\/5/); assert.match(m.text, /ømhed: 5\/5/)
  assert.match(m.text, /5 timer på 4\/7 dage \(2026-10-29 – 2026-11-04\)/)
  assert.equal(m.context.find(c => c.id === 'recovery').metrics.length, 3)
  assert.notEqual(m.evidence.id, 'soreness')
  for (const key of ['energy', 'stress', 'soreness_level']) {
    for (const value of [0, 6, 2.5, '2', NaN]) {
      const invalid = fixture(); invalid.rows[0][key] = value
      await assert.rejects(readWeeklyLetter(invalid.options))
    }
  }
})

test('optional nutrition receipt is requested once with pinned scope and rechecked after await', async () => {
  const f = fixture(); let reads = 0
  f.options.getNutritionRead = async scope => {
    reads++; assert.deepEqual(scope, { role: 'coach', ownerId: 'synthetic-owner', athleteId: 'synthetic-athlete', asOf: '2026-11-04' })
    f.scope({ athleteId: 'other' }); return undefined
  }
  await assert.rejects(readWeeklyLetter(f.options)); assert.equal(reads, 1)
  const off = fixture(); off.options.enabled = false
  off.options.getNutritionRead = () => assert.fail('OFF nutrition')
  assert.deepEqual(await readWeeklyLetter(off.options), { state: 'off' })
})

test('actual reader passes a scoped report receipt through the actual report and letter models', async () => {
  const f = fixture(); f.scope({ ownerId: coach.id })
  f.options.getNutritionRead = async scope => ({ state: 'ready', complete: true,
    coachId: scope.ownerId, athleteId: scope.athleteId, date: scope.asOf,
    plans: [activePlan()], weightLogs: [], mealLogs: [meal('2026-11-02', 'synthetic-log')] })
  const m = await readWeeklyLetter(f.options)
  assert.equal(m.context.find(c => c.id === 'nutrition').sampleCount, 1)
  assert.match(m.text, /1\.000 kcal mod 2\.000 kcal/)
  assert.equal(f.calls.filter(call => call[0] === 'from').length, 1)
  f.options.getNutritionRead = async () => ({ state: 'error' })
  const failed = await readWeeklyLetter(f.options)
  assert.equal(failed.state, 'error'); assert.equal(failed.text, undefined)
})

test('OFF does not access any dependency getter, including optional nutrition', async () => {
  for (const enabled of [undefined, false, null, 0, 'true']) {
    const options = new Proxy({ enabled }, { get(target, key) {
      if (key !== 'enabled') assert.fail(`OFF read: ${String(key)}`)
      return target.enabled
    } })
    assert.deepEqual(await readWeeklyLetter(options), { state: 'off' })
  }
})

test('invalid identities never query and in-place scope mutation is detected', async () => {
  for (const patch of [{ ownerId: '' }, { athleteId: ' ' }, { ownerId: null }]) {
    const f = fixture(); f.scope(patch)
    await assert.rejects(readWeeklyLetter(f.options)); assert.deepEqual(f.calls, [])
  }
  const f = fixture(), scope = { role: 'coach', ownerId: 'synthetic-owner', athleteId: 'synthetic-athlete' }
  f.options.getScope = () => scope
  f.afterRead(() => { scope.athleteId = 'other' })
  await assert.rejects(readWeeklyLetter(f.options))
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
