import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCoachTeamOverview as build } from './overview.mjs'
import { athlete, asOf, options } from './fixtures.mjs'

const row = a => build(options([a])).athletes[0]
const freeze = x => { if (x && typeof x === 'object') { Object.values(x).forEach(freeze); Object.freeze(x) } return x }

test('OFF is literal and does not read roster, date or snapshots', () => {
  for (const enabled of [undefined, false, null, 0, 1, 'true']) {
    assert.deepEqual(build({ enabled, get roster() { throw Error('read roster') },
      get asOf() { throw Error('read date') }, get athletes() { throw Error('read athletes') } }), { state: 'off', athletes: [] })
  }
  assert.equal(build().state, 'off')
})

test('complete empty roster differs from loading, errors and partial lists', () => {
  assert.equal(build(options()).state, 'empty')
  assert.deepEqual(build({ enabled: true, roster: { state: 'loading' },
    get athletes() { throw Error('read') }, get asOf() { throw Error('read') } }), { state: 'loading', athletes: [] })
  for (const roster of [undefined, { state: 'error' }, { state: 'ready', complete: false, athleteIds: [] },
    { state: 'ready', complete: true }, { state: 'ready', complete: true, athleteIds: ['synthetic-a', 'synthetic-a'] },
    { state: 'ready', complete: true, athleteIds: [' '] }, { state: 'ready', complete: true, athleteIds: Array(1) }]) {
    assert.deepEqual(build({ ...options(), roster }), { state: 'error', athletes: [] })
  }
})

test('invalid calendar and malformed snapshot list fail visibly', () => {
  for (const asOf of [undefined, '2026-02-30', '2026-11-04T00:00:00Z', '0000-01-01', '9999-12-31']) {
    assert.equal(build({ ...options([athlete('synthetic-a')]), asOf }).state, 'error')
  }
  assert.equal(build({ ...options([athlete('synthetic-a')]), athletes: {} }).state, 'error')
})

test('all roster athletes survive missing snapshots; foreign snapshots are ignored', () => {
  const props = options([athlete('synthetic-a'), athlete('synthetic-b')])
  props.athletes = [athlete('synthetic-a'), { athleteId: 'synthetic-foreign', get coachWeek() { throw Error('foreign read') } }]
  const m = build(props)
  assert.deepEqual(m.athletes.map(a => a.athleteId), ['synthetic-b', 'synthetic-a'])
  assert.equal(m.athletes[0].flagCount, null); assert.equal(m.athletes[0].unknownDomains, 4)
  assert.equal(m.athletes[1].flagCount, 0)
})

test('actual coachuge flags count first; unknown flags precede known zero', () => {
  const one = athlete('synthetic-one'), two = athlete('synthetic-two'), zero = athlete('synthetic-zero'), unknown = athlete('synthetic-unknown')
  one.coachWeek.daily[0].pain = 8; one.coachWeek.daily[0].painLocation = 'synthetic-location'
  two.coachWeek.daily.forEach(d => { d.sleepHours = 5; d.stress = 4 })
  unknown.coachWeek.complete = false
  const m = build(options([zero, unknown, one, two]))
  assert.deepEqual(m.athletes.map(a => [a.athleteId, a.flagCount]),
    [['synthetic-two', 2], ['synthetic-one', 1], ['synthetic-unknown', null], ['synthetic-zero', 0]])
})

test('ties sort unknown coverage, missing/invalid days, then stable athlete ID', () => {
  const complete = athlete('synthetic-a'), missing = athlete('synthetic-b'), invalid = athlete('synthetic-c'), unknown = athlete('synthetic-d')
  missing.sources.readiness.rows = []
  invalid.sources.readiness.rows.forEach(r => { r.readiness_score = null })
  unknown.sources.weight.state = 'partial'
  const m = build(options([complete, invalid, missing, unknown]))
  assert.deepEqual(m.athletes.map(a => a.athleteId), ['synthetic-d', 'synthetic-b', 'synthetic-c', 'synthetic-a'])
  assert.equal(m.athletes[0].unknownDomains, 1)
  assert.equal(m.athletes[1].missingValueDays, 24)
  assert.equal(m.athletes[2].missingValueDays, 24)
  assert.equal(m.athletes[3].missingValueDays, 0)
})

test('actual kvalitet counts are visible for current partial week and earlier weeks', () => {
  const m = row(athlete('synthetic-a'))
  assert.equal(m.weeks.length, 4)
  assert.equal(m.weeks[0].weekStart, '2026-10-12')
  const current = m.weeks.at(-1)
  assert.equal(current.weekStart, '2026-11-02'); assert.equal(current.through, asOf)
  assert.equal(current.elapsedDays, 3); assert.equal(current.partial, true)
  for (const d of Object.values(current.domains)) {
    assert.equal(d.recordedDays, 3); assert.equal(d.valueDays, 3)
  }
})

test('row and source identity, optimistic data and future values follow kvalitet', () => {
  const a = athlete('synthetic-a')
  a.sources.weight.athleteId = 'synthetic-other'
  a.sources.readiness.rows.forEach(r => { r.athlete_id = 'synthetic-other' })
  a.sources.training.rows.forEach(r => { r._optimistic = true })
  a.sources.nutrition.rows = [{ athlete_id: a.athleteId, date: '2026-11-05', meal: 'synthetic-meal', kcal: 500, protein: 30 }]
  const current = row(a).weeks.at(-1)
  assert.equal(current.domains.weight.state, 'invalid'); assert.equal(current.domains.weight.recordedDays, null)
  for (const domain of ['readiness', 'training', 'nutrition']) assert.equal(current.domains[domain].recordedDays, 0)
})

test('week identity/cutoff mismatch and partial reads never report zero flags', () => {
  for (const change of [a => { a.coachWeek.athleteId = 'synthetic-other' }, a => { a.coachWeek.asOf = '2026-11-03' },
    a => { a.coachWeek.complete = false }, a => { a.coachWeek.state = 'error' }, a => { a.coachWeek = null }]) {
    const a = athlete('synthetic-a'); change(a)
    assert.equal(row(a).flagCount, null); assert.equal(row(a).weekState, 'error')
  }
  const a = athlete('synthetic-a'); a.coachWeek.state = 'loading'
  assert.equal(row(a).flagCount, null); assert.equal(row(a).weekState, 'loading')
})

test('duplicate snapshots fail closed, including three duplicates and reversed inputs', () => {
  const a = athlete('synthetic-a'), props = options([a])
  for (const athletes of [[a, a], [a, a, a]]) {
    const m = build({ ...props, athletes })
    assert.equal(m.athletes[0].flagCount, null); assert.equal(m.athletes[0].unknownDomains, 4)
    assert.deepEqual(build({ ...props, athletes: [...athletes].reverse() }), m)
  }
})

test('missing and failed sources remain unknown, while complete empty sources give zero days', () => {
  const a = athlete('synthetic-a')
  delete a.sources.training; a.sources.nutrition.state = 'error'; a.sources.weight.state = 'loading'
  a.sources.readiness.rows = []
  const m = row(a), domains = m.weeks.at(-1).domains
  assert.equal(m.unknownDomains, 3)
  for (const d of ['training', 'nutrition', 'weight']) {
    assert.equal(domains[d].recordedDays, null); assert.equal(domains[d].missingDays, null)
  }
  assert.equal(domains.readiness.recordedDays, 0); assert.equal(domains.readiness.missingDays.length, 3)
})

test('empty week and incomplete signal evidence remain distinct from sufficient no-flags', () => {
  const a = athlete('synthetic-a')
  a.coachWeek.daily = []; a.coachWeek.loadDays = []; a.coachWeek.strength = null
  a.coachWeek.nutritionDays = []; a.coachWeek.weightDays = []; a.coachWeek.compliance = null
  assert.equal(row(a).weekState, 'empty'); assert.equal(row(a).flagCount, 0)
  a.coachWeek.daily = [{ day: asOf, source: 'athlete_manual', pain: 0 }]
  assert.equal(row(a).weekState, 'insufficient'); assert.equal(row(a).flagCount, 0)
  assert.equal(row(athlete('synthetic-b')).weekState, 'noFlags')
})

test('input stays frozen; permutations preserve order and output excludes raw/private fields', () => {
  const a = athlete('synthetic-a'), b = athlete('synthetic-b')
  for (const object of [a, a.coachWeek, a.sources, a.coachWeek.daily[0], a.sources.readiness.rows[0]]) {
    Object.defineProperty(object, 'cycle', { enumerable: true, get() { throw Error('private field read') } })
    object.note = 'PRIVATE-SENTINEL'
  }
  // Freeze without reading the deliberately forbidden getters.
  const props = options([a, b]); Object.freeze(props); Object.freeze(props.athletes)
  const m = build(props)
  assert.equal(JSON.stringify(m).includes('PRIVATE-SENTINEL'), false)
  assert.doesNotMatch(JSON.stringify(m), /cycle|painLocation|programVersion|readiness_score/)
  assert.deepEqual(build({ ...props, roster: { ...props.roster, athleteIds: [...props.roster.athleteIds].reverse() },
    athletes: [...props.athletes].reverse() }), m)
  const clean = freeze(options([athlete('synthetic-frozen')]))
  assert.doesNotThrow(() => build(clean))
})

test('unreadable per-athlete data is contained and does not erase other athletes', () => {
  const bad = { athleteId: 'synthetic-bad', get coachWeek() { throw Error('private error') },
    get sources() { throw Error('private error') } }
  const m = build(options([bad, athlete('synthetic-good')]))
  assert.equal(m.state, 'ready'); assert.equal(m.athletes.length, 2)
  assert.equal(m.athletes[0].flagCount, null); assert.equal(m.athletes[0].unknownDomains, 4)
  assert.equal(m.athletes[1].flagCount, 0)
  assert.doesNotMatch(JSON.stringify(m), /private error/)
})
