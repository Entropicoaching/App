import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAthleteOverview, FIELDS } from './overview.mjs'
import { addCalendarDays } from '../../../calendarDate.js'
const id = 'synthetic-athlete'
const date = i => addCalendarDays('2026-10-08', i)
const build = data => buildAthleteOverview(data, { enabled: true })
const fixture = () => ({ status: 'ready', complete: true, athleteId: id, endDate: date(27),
  dailyRows: [], exerciseLogs: [], mealRows: [], weightRows: [] })
const daily = (i, extra = {}) => ({ athlete_id: id, source: 'athlete_manual', logged_date: date(i), ...extra })
const set = (i, extra = {}) => ({ athlete_id: id, id: `set-${i}`, logged_at: date(i),
  exercise_id: 'synthetic-squat', set_number: 1, weight: 100, reps_completed: 5,
  exercises: { name: 'Squat' }, ...extra })
const weight = (i, n = 80) => ({ athlete_id: id, logged_at: date(i), weight: n })
const meal = (i, extra = {}) => ({ athlete_id: id, date: date(i), meal: 'Syntetisk måltid',
  kcal: 1000, protein: 50, carb: 100, fat: 20, ...extra })

test('OFF is literal, inert and default', () => {
  const poison = new Proxy({}, { get() { throw Error('read while OFF') } })
  for (const enabled of [undefined, false, null, 'true', 1]) {
    assert.equal(buildAthleteOverview(poison, { enabled }), null)
  }
})
test('loading and incomplete fetch never read or calculate payload', () => {
  for (const status of ['loading', 'error', 'ready']) {
    const data = { status, complete: false, get dailyRows() { throw Error('partial read') } }
    assert.deepEqual(build(data), { status: status === 'loading' ? 'loading' : 'error' })
  }
  assert.deepEqual(build(null), { status: 'error' })
})
test('empty is distinct from zero, exactly 28 days and four trailing periods', () => {
  const result = build(fixture())
  assert.equal(result.status, 'empty')
  assert.equal(result.from, date(0)); assert.equal(result.to, date(27))
  assert.equal(result.weeks.length, 4)
  const days = result.weeks.flatMap(w => w.weight.days.map(d => d.date))
  assert.equal(new Set(days).size, 28)
  assert.deepEqual(days, Array.from({ length: 28 }, (_, i) => date(i)))
  for (const w of result.weeks) {
    assert.equal(w.training.tonnage, null); assert.equal(w.training.sets, null)
    assert.equal(w.weight.average, null); assert.equal(w.nutrition.kcal, null)
    assert.ok(w.training.days.every(d => d.tonnage === null))
  }
})
test('wellbeing is field-specific, >=4/7, retains raw dates and explicit zero', () => {
  const data = fixture()
  data.dailyRows = [0, 1, 2, 3].map(i => daily(i, { sleep_hours: 0, energy: 2,
    stress: i < 3 ? 4 : null, soreness: 0 }))
  const fields = build(data).weeks[0].wellbeing
  assert.deepEqual(fields.map(f => [f.count, f.average]), [[4, 0], [4, 2], [3, null], [4, 0]])
  assert.equal(fields[0].days[4].value, null)
  assert.deepEqual(FIELDS.map(f => f.key), ['sleep_hours', 'energy', 'stress', 'soreness'])
})
test('invalid measurements stay unknown; legacy soreness is never converted', () => {
  const data = fixture()
  data.dailyRows = [0, 1, 2, 3].map(i => daily(i, { sleep_hours: '7', energy: 1.5,
    stress: Infinity, soreness_level: 5, soreness: 11 }))
  assert.equal(build(data).status, 'empty')
  assert.ok(build(data).weeks[0].wellbeing.every(f => f.count === 0))
})
test('mixed athlete scope, absent collections and wrong provenance fail closed', () => {
  for (const key of ['dailyRows', 'exerciseLogs', 'mealRows', 'weightRows']) {
    const data = fixture(); data[key] = [{ athlete_id: 'other' }]
    assert.deepEqual(build(data), { status: 'error' })
    data[key] = undefined; assert.deepEqual(build(data), { status: 'error' })
  }
  const data = fixture(); data.dailyRows = [daily(0, { source: 'device', energy: 3 })]
  assert.deepEqual(build(data), { status: 'error' })
})
test('duplicate daily and weight dates are ambiguous, never silently chosen', () => {
  const data = fixture(); data.dailyRows = [daily(0), daily(0)]
  assert.equal(build(data).status, 'error')
  data.dailyRows = []; data.weightRows = [weight(0), weight(0, 81)]
  assert.equal(build(data).status, 'error')
})
test('invalid dates and unsupported underflow fail without a clock fallback', () => {
  for (const endDate of [undefined, '', '2026-02-30', '2026-11-04T12:00:00Z', '0000-01-01']) {
    assert.equal(build({ ...fixture(), endDate }).status, 'error')
  }
  const data = fixture(); data.dailyRows = [daily(0, { logged_date: '2026-02-30' })]
  assert.equal(build(data).status, 'error')
})
test('old and future observations cannot enter trailing periods', () => {
  const data = fixture()
  data.dailyRows = [-1, 28].map(i => daily(i, { energy: 5 }))
  data.exerciseLogs = [-1, 28].map(i => set(i))
  data.weightRows = [-1, 28].map(i => weight(i))
  data.mealRows = [-1, 28].map(i => meal(i))
  assert.equal(build(data).status, 'empty')
})
test('actual load: measured sets, missing days unknown, no compliance claims', () => {
  const data = fixture(); data.exerciseLogs = [set(0), set(1, { skipped: true }),
    set(2, { _optimistic: true }), set(3, { weight: null })]
  const w = build(data).weeks[0]
  assert.equal(w.training.sets, 2); assert.equal(w.training.observedDays, 2)
  assert.equal(w.training.tonnage, null)
  assert.equal(w.training.days[0].tonnage, 500)
  assert.equal(w.training.days[1].tonnage, null)
  assert.ok(!('compliance' in w.training)); assert.ok(!('signal' in w.training))
})
test('actual load/strength share deduplication and exclude optimistic copies', () => {
  const data = fixture(); const row = set(4)
  data.exerciseLogs = [row, { ...row }]
  let result = build(data)
  assert.equal(result.weeks[0].training.sets, 1)
  assert.ok(result.strength.length > 0)
  data.exerciseLogs.push({ ...row, weight: 120 })
  result = build(data); assert.equal(result.status, 'empty'); assert.equal(result.strength.length, 0)
  data.exerciseLogs = [set(4, { _optimistic: true })]
  assert.equal(build(data).strength.length, 0)
})
test('strength includes leading partial calendar week, never older raw sets', () => {
  const data = fixture(); data.exerciseLogs = [set(-1, { weight: 1000 }), set(0)]
  const result = build(data)
  assert.equal(result.strength.length, 1)
  assert.ok(result.strength[0].weekStart < result.from)
  assert.ok(result.strength[0].e1rm < 200)
})
test('actual nutrition covers all four trailing weeks at a midweek end', () => {
  const data = fixture(); data.mealRows = Array.from({ length: 28 }, (_, i) => meal(i))
  const result = build(data)
  assert.equal(result.weeks.flatMap(w => w.nutrition.days).length, 28)
  for (const w of result.weeks) {
    assert.ok(Math.abs(w.nutrition.kcal - 1000) < 1e-10)
    assert.ok(Math.abs(w.nutrition.protein - 50) < 1e-10)
    assert.equal(w.nutrition.loggedDays, 7)
    assert.ok(!('targets' in w.nutrition)); assert.ok(!('signal' in w.nutrition))
  }
})
test('incomplete or zero nutrition never masquerades as full target compliance', () => {
  const data = fixture(); data.mealRows = [meal(0, { kcal: 0, protein: 0 })]
  assert.equal(build(data).weeks[0].nutrition.kcal, 0)
  data.mealRows.push(meal(1, { kcal: null }))
  assert.equal(build(data).weeks[0].nutrition.kcal, null)
})
test('actual weight raw values obey plan minimum four dates per week', () => {
  const data = fixture(); data.weightRows = [0, 1, 2].map(i => weight(i))
  assert.equal(build(data).weeks[0].weight.average, null)
  data.weightRows.push(weight(3, 84))
  const result = build(data).weeks[0].weight
  assert.equal(result.average, 81); assert.equal(result.count, 4)
  assert.equal(result.days[4].value, null)
})
test('Copenhagen calendar conversion preserves DST local date', () => {
  const data = fixture(); data.exerciseLogs = [set(17, { logged_at: '2026-10-24T23:30:00Z' })]
  const days = build(data).weeks.flatMap(w => w.training.days)
  assert.equal(days.find(d => d.date === '2026-10-25').sets, 1)
  assert.equal(days.find(d => d.date === '2026-10-24').sets, 0)
})
test('private extras never read/projected; frozen inputs unchanged', () => {
  const data = fixture(); data.dailyRows = [daily(0, { energy: 3 })]
  Object.defineProperty(data, 'cycle', { enumerable: true, get() { throw Error('private read') } })
  Object.defineProperty(data.dailyRows[0], 'cycle', { enumerable: true, get() { throw Error('private read') } })
  Object.freeze(data.dailyRows[0]); Object.freeze(data.dailyRows); Object.freeze(data)
  const output = build(data)
  assert.equal(output.status, 'ready')
  assert.ok(!JSON.stringify(output).includes('cycle'))
})
