import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMonthReport } from './monthReportModel.mjs'
import { fixture, populated, date, daily, set, meal, weight, session } from './fixtures.mjs'
const build = s => buildMonthReport(s, { enabled: true })
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`)

test('OFF is literal and does not inspect snapshot', () => {
  const poison = new Proxy({}, { get() { throw Error('OFF read') } })
  for (const enabled of [undefined, null, false, 'true', 1]) assert.equal(buildMonthReport(poison, { enabled }), null)
})
test('loading and incomplete snapshots do not read collections', () => {
  for (const status of ['loading', 'ready', 'error']) {
    const result = build({ status, complete: false, get exerciseLogs() { throw Error('read') } })
    assert.equal(result.status, status === 'loading' ? 'loading' : 'error')
  }
  assert.equal(build(null).status, 'error')
})
test('empty has four contiguous buckets covering exactly 28 calendar days', () => {
  const r = build(fixture())
  assert.equal(r.status, 'empty'); assert.equal(r.from, date(0)); assert.equal(r.to, date(27))
  assert.equal(r.weeks.length, 4)
  assert.deepEqual(r.weeks.flatMap(w => w.weight.days.map(d => d.date)), Array.from({ length: 28 }, (_, i) => date(i)))
  for (const w of r.weeks) {
    assert.equal(w.training.tonnage, null); assert.equal(w.nutrition.kcal, null); assert.equal(w.weight.average, null)
    for (const b of Object.values(w.basis)) assert.deepEqual(b, { validDays: 0, missingDays: 7, invalidDays: 0 })
  }
  assert.equal(r.flags.length, 0); assert.equal(r.automaticChanges, false)
})
test('actual copied models: strength, volume, intensity, nutrition, weight, readiness and sessions', () => {
  const r = build(populated()); assert.equal(r.status, 'ready')
  assert.deepEqual(r.strength.find(s => s.name === 'Squat').values.map(n => Math.round(n)), [117, 117, 117, 93])
  assert.deepEqual(r.weeks.map(w => w.training.tonnage), [500, 500, 500, 400])
  assert.deepEqual(r.weeks.map(w => w.training.sets), [1, 1, 1, 1])
  assert.equal(r.weeks[0].intensity.zones.find(z => z.key === '80to90').count, 1)
  assert.equal(r.weeks[3].intensity.zones.find(z => z.key === 'under70').count, 1)
  for (const w of r.weeks) {
    near(w.nutrition.kcal, 2000); near(w.nutrition.protein, 100); near(w.weight.average, 80)
    near(w.wellbeing.find(f => f.key === 'energy').average, 2)
    assert.equal(w.sessions.completed, 1); assert.equal(w.basis.nutrition.validDays, 7)
  }
  assert.deepEqual(r.flags.map(f => f.id), ['strength:squat', 'energy'])
  for (const f of r.flags) {
    assert.equal(f.dataBasis.from, date(0)); assert.equal(f.dataBasis.to, date(27))
    assert.ok(f.dataBasis.rule); assert.equal(f.dataBasis.observations.length, 4)
  }
})
test('completion comes only from authoritative session status; extras separate', () => {
  const s = fixture(); s.exerciseLogs = [set(0)]
  let r = build(s); assert.equal(r.weeks[0].sessions.completed, 0)
  s.sessions = [session(0, { completed: false }), session(1, { planned: false })]
  r = build(s); assert.deepEqual(r.weeks[0].sessions, { planned: 1, completed: 1, completedPlanned: 0, extra: 1 })
  assert.equal(r.flags[0].id, `sessions:${date(0)}`)
  assert.deepEqual(r.flags[0].dataBasis.observations[0], { from: date(0), to: date(6), value: 0, count: 1, unit: 'planlagte pas' })
})
test('strict strength drop threshold and four observed buckets required', () => {
  const s = fixture(); s.exerciseLogs = [0, 7, 14, 21].map(i => set(i, { weight: i === 21 ? 95 : 100 }))
  assert.equal(build(s).flags.length, 0)
  s.exerciseLogs[3].weight = 94.9; assert.equal(build(s).flags.length, 1)
  s.exerciseLogs.splice(1, 1); assert.equal(build(s).flags.length, 0)
})
test('all main lifts and variants stay separate; accessory excluded', () => {
  const s = fixture(); s.exerciseLogs = ['Squat', 'Bænkpres', 'Dødløft', 'Sumo dødløft', 'Pause squat', 'Biceps curl'].map((name, i) => set(i, { exercises: { name } }))
  const observed = build(s).strength.filter(l => l.values.some(n => n !== null))
  assert.equal(observed.length, 5); assert.ok(!observed.some(l => l.name === 'Biceps curl'))
})
test('optimistic, skipped and deload sets never create strength', () => {
  const s = fixture(); s.exerciseLogs = [set(0, { _optimistic: true }), set(1, { skipped: true }),
    set(2, { exercises: { name: 'Squat', sessions: { weeks: { block_name: 'Deload' } } } })]
  assert.ok(build(s).strength.every(l => l.values.every(n => n === null)))
})
test('unknown references count separately; invalid volume is not zero', () => {
  const s = fixture(); s.exerciseLogs = [set(0, { reference_e1rm: null }), set(1, { weight: null })]
  const w = build(s).weeks[0]
  assert.equal(w.intensity.unknown, 2); assert.equal(w.intensity.classified, 0)
  assert.equal(w.training.tonnage, null); assert.equal(w.basis.training.invalidDays, 1)
})
test('identical copies do not add sets; conflicting references/names/dates fail closed', () => {
  const s = fixture(); const row = set(0); s.exerciseLogs = [row, { ...row }]
  assert.equal(build(s).weeks[0].training.sets, 1)
  for (const extra of [{ reference_e1rm: 200 }, { exercises: { name: 'Bænkpres' } }, { logged_at: date(1) }, { id: 'other', weight: 120 }, { id: 'other' }]) {
    assert.equal(build({ ...s, exerciseLogs: [row, { ...row, ...extra }] }).status, 'error')
  }
})
test('outside window and future rows excluded; DST uses Copenhagen day', () => {
  const s = fixture(); s.exerciseLogs = [set(-1), set(28), set(17, { logged_at: '2026-10-24T23:30:00Z' })]
  s.sessions = [session(-1), session(28)]
  s.mealRows = [-1, 28].map(i => meal(i)); s.dailyRows = [-1, 28].map(i => daily(i)); s.weightRows = [-1, 28].map(i => weight(i))
  const r = build(s); assert.equal(r.weeks[2].training.days.find(d => d.date === '2026-10-25').sets, 1)
  assert.equal(r.weeks.reduce((a, w) => a + (w.training.sets ?? 0), 0), 1)
  assert.ok(r.weeks.every(w => w.sessions.completed === 0 && w.nutrition.loggedDays === 0))
})
test('field-specific minimums preserve zeros and missing observations', () => {
  const s = fixture(); s.dailyRows = [0, 1, 2].map(i => daily(i, { sleep_hours: 0, energy: 0 }))
  s.weightRows = [0, 1, 2].map(i => weight(i))
  let w = build(s).weeks[0]; assert.equal(w.wellbeing[0].average, null); assert.equal(w.weight.average, null)
  s.dailyRows.push(daily(3, { sleep_hours: 0 })); s.weightRows.push(weight(3))
  w = build(s).weeks[0]; assert.equal(w.wellbeing[0].average, 0); near(w.weight.average, 80)
  assert.equal(w.wellbeing.find(f => f.key === 'energy').average, null)
})
test('nutrition never applies present targets; malformed meal invalidates weekly average', () => {
  const s = fixture(); s.mealRows = [meal(0, { kcal: 0, protein: 0 })]
  assert.equal(build(s).weeks[0].nutrition.kcal, 0)
  s.mealRows.push(meal(1, { kcal: null })); assert.equal(build(s).weeks[0].nutrition.kcal, null)
  assert.equal(build(s).weeks[0].basis.nutrition.invalidDays, 1)
})
test('identities, completeness, duplicate sessions/days and invalid dates fail closed', () => {
  for (const key of ['dailyRows', 'exerciseLogs', 'mealRows', 'weightRows', 'sessions']) {
    assert.equal(build({ ...fixture(), [key]: [{ athlete_id: 'other' }] }).status, 'error')
    assert.equal(build({ ...fixture(), [key]: null }).status, 'error')
  }
  for (const endDate of ['2026-02-30', '0000-01-01', '2026-11-04T00:00:00Z', undefined]) assert.equal(build({ ...fixture(), endDate }).status, 'error')
  for (const extra of [{ dailyRows: [daily(0), daily(0)] }, { weightRows: [weight(0), weight(0)] },
    { sessions: [session(0), session(0)] }, { dailyRows: [daily(0, { source: 'device' })] },
    { exerciseLogs: [set(0, { unit: 'lb' })] }, { exerciseLogs: [set(0, { logged_at: 'yesterday' })] },
    { mealRows: [meal(0, { date: '2026-02-30' })] }]) assert.equal(build({ ...fixture(), ...extra }).status, 'error')
})
test('private fields are never read or returned; inputs remain frozen', () => {
  const s = populated()
  for (const object of [s, ...s.dailyRows, ...s.exerciseLogs, ...s.mealRows, ...s.weightRows, ...s.sessions]) {
    Object.defineProperty(object, 'cycle', { enumerable: true, get() { throw Error('private read') } }); Object.freeze(object)
  }
  for (const key of ['dailyRows', 'exerciseLogs', 'mealRows', 'weightRows', 'sessions']) Object.freeze(s[key])
  const r = build(s); assert.equal(r.status, 'ready'); assert.ok(!JSON.stringify(r).includes('cycle'))
})


test('energy flag requires four valid days in every bucket; session threshold is strict', () => {
  const s = populated(); s.dailyRows = s.dailyRows.filter(r => ![date(0), date(1), date(2), date(3)].includes(r.logged_date))
  assert.ok(!build(s).flags.some(f => f.id === 'energy'))
  s.sessions = [0, 1, 2, 3].map(i => session(i, { completed: i < 3 }))
  assert.ok(!build(s).flags.some(f => f.id.startsWith('sessions:')))
  s.sessions[2].completed = false
  assert.ok(build(s).flags.some(f => f.id.startsWith('sessions:')))
})
test('draft daily, meal, weight and session rows fail closed', () => {
  for (const [key, row] of [['dailyRows', daily(0)], ['mealRows', meal(0)], ['weightRows', weight(0)], ['sessions', session(0)]]) {
    assert.equal(build({ ...fixture(), [key]: [{ ...row, _optimistic: true }] }).status, 'error')
  }
})
