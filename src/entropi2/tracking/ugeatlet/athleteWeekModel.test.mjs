import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAthleteWeek } from './athleteWeekModel.mjs'
import { emptySnapshot, populatedSnapshot, session, daily, set, nutrition } from './fixtures.mjs'

const build = input => buildAthleteWeek(input, { enabled: true })
const freeze = object => {
  for (const value of Object.values(object)) if (value && typeof value === 'object') freeze(value)
  return Object.freeze(object)
}

test('OFF is the default and only literal true inspects the snapshot', () => {
  const poison = new Proxy({}, { get() { throw Error('OFF read') } })
  assert.equal(buildAthleteWeek(poison), null)
  for (const enabled of [false, undefined, null, 0, 1, 'true']) assert.equal(buildAthleteWeek(poison, { enabled }), null)
})

test('loading and incomplete/error snapshots do not inspect payload collections', () => {
  for (const status of ['loading', 'error', 'ready']) {
    const input = { status, complete: false, get sessions() { throw Error('partial read') } }
    assert.deepEqual(build(input), { status: status === 'loading' ? 'loading' : 'error' })
  }
  for (const input of [null, undefined, [], {}, { status: 'ready', complete: true }]) assert.deepEqual(build(input), { status: 'error' })
})

test('empty is a dated seven-day window, missing measurements are not zero', () => {
  const model = build(emptySnapshot())
  assert.equal(model.status, 'empty')
  assert.deepEqual([model.from, model.to, model.days], ['2026-11-01', '2026-11-07', 7])
  assert.equal(model.sleep.average, null); assert.equal(model.energy.average, null)
  assert.equal(model.nutrition.kcal.percent, null); assert.equal(model.bestSet.value, null)
  assert.equal(model.sessions.completed, 0)
})

test('confirmed sessions are counted individually with planned/extra split; sets never imply sessions', () => {
  const data = populatedSnapshot(), model = build(data)
  assert.deepEqual([model.sessions.completed, model.sessions.completedPlanned, model.sessions.planned,
    model.sessions.extraCompleted], [2, 1, 2, 1])
  data.sessions = []
  assert.equal(build(data).sessions.completed, 0)
  data.sessions = [session('a'), session('b')]
  assert.equal(build(data).sessions.completed, 2)
})

test('best is estimated within one selected variant; warmup, pending, skipped and >10 reps excluded', () => {
  const data = populatedSnapshot()
  data.strength.sets.push(set('warmup', { kg: 900, warmup: true }), set('pending', { kg: 900, confirmed: false }),
    set('skipped', { kg: 900, skipped: true }), set('high-reps', { kg: 900, reps: 11 }),
    set('zero-reps', { kg: 900, reps: 0 }), set('missing', { kg: null }), set('bodyweight', { kg: 0 }))
  const best = build(data).bestSet
  assert.equal(best.count, 2); assert.equal(best.value.id, 'set-2')
  assert.deepEqual([best.value.kg, best.value.reps], [110, 3])
  assert.ok(Math.abs(best.value.estimate - 121) < 1e-10)
  data.strength.sets = [set('one-rep', { kg: 90, reps: 1 }), set('ten-reps', { kg: 90, reps: 10 })]
  assert.equal(build(data).bestSet.value.id, 'ten-reps')
})

test('best tie is deterministic under input permutation; higher weight then oldest date then id', () => {
  const data = populatedSnapshot()
  data.strength.sets = [set('z', { day: '2026-11-02' }), set('b'), set('a')]
  assert.equal(build(data).bestSet.value.id, 'a')
  data.strength.sets.reverse()
  assert.equal(build(data).bestSet.value.id, 'a')
  data.strength.sets = [set('low', { kg: 90, reps: 10 }), set('high', { kg: 100, reps: 6 })]
  assert.equal(build(data).bestSet.value.id, 'high')
})

test('wellbeing has per-field four-day minimum, integer energy and preserves zero sleep', () => {
  const data = emptySnapshot()
  data.daily = [0, 1, 2].map(index => daily(index, { sleepHours: 0 }))
  assert.deepEqual([build(data).sleep.count, build(data).sleep.average], [3, null])
  data.daily.push(daily(3, { sleepHours: 0, energy: null }))
  const model = build(data)
  assert.equal(model.sleep.average, 0); assert.equal(model.energy.average, null)
  data.daily.push(daily(4, { sleepHours: null, energy: 5 }))
  assert.equal(build(data).energy.average, 3.5)
  assert.equal(build(data).sleep.count, 4)
})

test('nutrition compares the same complete, dated, per-metric day pairs, without extrapolation', () => {
  const data = emptySnapshot()
  data.nutritionDays = [nutrition(0), nutrition(1, { kcal: 3000, kcalTarget: 3000, proteinG: 120, proteinTargetG: 150 }),
    nutrition(2, { complete: false, kcal: 50000 }), nutrition(3, { targetVersion: null }),
    nutrition(4, { kcalTarget: null })]
  const result = build(data).nutrition
  assert.equal(result.loggedDays, 5); assert.equal(result.completeDays, 4)
  assert.deepEqual([result.kcal.count, result.kcal.average, result.kcal.targetAverage, result.kcal.percent], [2, 2400, 2500, 96])
  assert.equal(result.protein.count, 3)
  assert.deepEqual(result.kcal.observations.map(row => row.day), ['2026-11-01', '2026-11-02'])
})

test('nutrition zero is measured, absent/zero targets are never claimed reached, overflow stays null', () => {
  const data = emptySnapshot(); data.nutritionDays = [nutrition(0, { kcal: 0, proteinG: 0 })]
  assert.equal(build(data).nutrition.kcal.percent, 0)
  data.nutritionDays[0].kcalTarget = null
  assert.equal(build(data).nutrition.kcal.percent, null)
  data.nutritionDays[0].kcalTarget = 0
  assert.equal(build(data).status, 'error')
  data.nutritionDays[0].kcalTarget = Number.MIN_VALUE; data.nutritionDays[0].kcal = 100000
  assert.equal(build(data).nutrition.kcal.percent, null)
})

test('all collections fail closed for mixed owners, sparse arrays, invalid rows and missing arrays', () => {
  for (const key of ['sessions', 'daily', 'nutritionDays']) {
    for (const rows of [undefined, {}, [null], [42], Array(1), [{ athleteId: 'other', day: '2026-01-01' }]]) {
      assert.equal(build({ ...emptySnapshot(), [key]: rows }).status, 'error', key)
    }
  }
  const data = populatedSnapshot(); data.strength.sets[0].athleteId = 'other'
  assert.equal(build(data).status, 'error')
})

test('ambiguous duplicate dates/IDs fail closed; no arbitrary winning record', () => {
  const data = populatedSnapshot()
  for (const key of ['sessions', 'daily', 'nutritionDays']) {
    const input = { ...data, [key]: [...data[key], { ...data[key][0] }] }
    assert.equal(build(input).status, 'error', key)
  }
  data.strength.sets.push({ ...data.strength.sets[0], kg: 200 })
  assert.equal(build(data).status, 'error')
})

test('invalid finite/range/type/provenance data fail closed rather than coerce', () => {
  for (const extra of [{ sleepHours: '7' }, { sleepHours: NaN }, { sleepHours: Infinity },
    { sleepHours: -1 }, { sleepHours: 25 }, { energy: 0 }, { energy: 6 }, { energy: 2.5 }, { source: 'device' }]) {
    assert.equal(build({ ...emptySnapshot(), daily: [daily(0, extra)] }).status, 'error')
  }
  for (const extra of [{ completed: 1 }, { planned: null }, { id: '' }]) {
    assert.equal(build({ ...emptySnapshot(), sessions: [session('a', extra)] }).status, 'error')
  }
  for (const extra of [{ kcal: '2000' }, { proteinG: -1 }, { complete: 'true' }, { targetVersion: '' }, { proteinTargetG: Infinity }]) {
    assert.equal(build({ ...emptySnapshot(), nutritionDays: [nutrition(0, extra)] }).status, 'error')
  }
  for (const extra of [{ unit: 'lb' }, { variantId: 'another' }, { exerciseId: 'another' },
    { confirmed: 1 }, { warmup: null }, { reps: 1.5 }, { kg: '100' }]) {
    const data = populatedSnapshot(); data.strength.sets = [set('x', extra)]
    assert.equal(build(data).status, 'error')
  }
})

test('invalid dates and year underflow are errors, including timestamp input', () => {
  for (const endDate of [null, '2026-02-30', '2026-11-07T00:00:00Z', '0000-11-07', '0001-01-01']) {
    assert.equal(build({ ...emptySnapshot(), endDate }).status, 'error', endDate)
  }
  assert.equal(build({ ...emptySnapshot(), daily: [daily(0, { day: '2026-02-29' })] }).status, 'error')
})

test('inclusive boundaries, older/future rows and Copenhagen DST calendar window', () => {
  const data = populatedSnapshot()
  data.sessions = ['2026-10-31', '2026-11-01', '2026-11-07', '2026-11-08'].map((day, i) => session(`s${i}`, { day }))
  assert.equal(build(data).sessions.completed, 2)
  const dst = build({ ...emptySnapshot(), endDate: '2026-10-27',
    daily: [daily(0, { day: '2026-10-25' })] })
  assert.equal(dst.from, '2026-10-21'); assert.equal(dst.sleep.count, 1)
  assert.equal(build({ ...emptySnapshot(), endDate: '2028-03-01' }).from, '2028-02-24')
})

test('private extras are never read, projected or used; frozen snapshots remain unchanged', () => {
  const data = populatedSnapshot(), before = JSON.stringify(data)
  const objects = [data, ...data.daily, ...data.sessions, ...data.nutritionDays, data.strength, ...data.strength.sets]
  for (const object of objects) Object.defineProperty(object, 'cycle', { get() { throw Error('private read') } })
  freeze(data)
  const model = build(data)
  assert.equal(model.status, 'ready'); assert.equal(JSON.stringify(data), before)
  assert.doesNotMatch(JSON.stringify(model), /cycle|synthetic-athlete|athleteId/)
})
