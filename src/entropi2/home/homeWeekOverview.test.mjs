import test from 'node:test'
import assert from 'node:assert/strict'
import { homeWeekOverview } from './homeWeekOverview.mjs'
const now = new Date('2026-11-03T12:00:00Z')
const athlete = { id: 'synthetic-athlete' }
const week = { id: 'synthetic-week', athlete_id: athlete.id, start_date: '2026-11-02',
  sessions: [0, 1].map(i => ({ id: `s${i}`, title: `Syntetisk pas ${i}`, weekday: i,
    exercises: [{ id: `e${i}`, name: 'Syntetisk øvelse', sets: 1 }] })) }
const log = (i, extra = {}) => ({ athlete_id: athlete.id, exercise_id: `e${i}`, set_number: 1,
  logged_at: '2026-11-03T10:00:00Z', ...extra })
const props = extra => ({ enabled: true, athlete, allWeeks: [week], currentWeek: week,
  exerciseLogs: [log(0), log(1, { skipped: true })], now, ...extra })

test('usable current week survives unrelated undated, invalid and Tuesday plans', () => {
  for (const start_date of [undefined, null, '', 'invalid', '2026-11-10', '2026-02-30']) {
    const input = props({ allWeeks: [null, { ...week, id: 'other', start_date }, week] })
    assert.equal(homeWeekOverview(input).line, 'Ugen: 2 af 2 pas')
    assert.equal(homeWeekOverview(input).plan.week, week)
  }
})

test('legacy completion semantics include skipped slots; unconfirmed slots stay incomplete', () => {
  assert.equal(homeWeekOverview(props()).line, 'Ugen: 2 af 2 pas')
  assert.equal(homeWeekOverview(props({ exerciseLogs: [] })).line, 'Ugen: 0 af 2 pas')
  for (const extra of [
    { pendingSyncKeys: ['e0_1'] }, { parkedSets: [{ exerciseId: 'e0', setNumber: 1 }] },
    { exerciseLogs: [log(0, { _optimistic: true }), log(1, { skipped: true })] },
    { exerciseLogs: [log(0, { athlete_id: 'other' }), log(1, { skipped: true })] },
  ]) assert.equal(homeWeekOverview(props(extra)).line, 'Ugen: 1 af 2 pas')
  assert.equal(homeWeekOverview(props({ exerciseLogs: [log(0), log(0, { skipped: true })] })).line, null)
})

test('holiday, unavailable and ambiguous snapshots expose no weekly line or plan', () => {
  for (const extra of [
    { onHoliday: true }, { loading: true }, { programError: true }, { offlineSnapshotAt: 'synthetic' },
    { allWeeks: undefined }, { allWeeks: null }, { allWeeks: {} }, { allWeeks: [] },
    { exerciseLogs: undefined }, { athlete: undefined }, { now: new Date(NaN) },
    { allWeeks: [week, { ...week, id: 'duplicate-date' }] },
    { allWeeks: [week, { ...week, start_date: '2026-11-09' }] },
    { allWeeks: [{ ...week, athlete_id: 'other' }] },
  ]) assert.equal(homeWeekOverview(props(extra)), null)
})

test('empty loaded week is distinct from missing data', () => {
  const empty = { ...week, sessions: [] }
  const result = homeWeekOverview(props({ allWeeks: [empty], currentWeek: empty }))
  assert.equal(result.line, 'Ingen pas planlagt i denne uge.')
  assert.equal(result.plan, null)
})

test('Copenhagen midnight selects next week rather than the stale currentWeek', () => {
  const next = { ...week, id: 'next', start_date: '2026-11-09' }
  const input = props({ allWeeks: [week, next], now: new Date('2026-11-08T22:59:59Z') })
  assert.equal(homeWeekOverview(input).plan.week, week)
  input.now = new Date('2026-11-08T23:00:00Z')
  assert.equal(homeWeekOverview(input).plan.week, next)
  assert.equal(homeWeekOverview(input).line, 'Ugen: 0 af 2 pas')
  assert.equal(homeWeekOverview({ ...input, allWeeks: [week] }), null)
})

test('OFF reads no data and frozen input remains unchanged', () => {
  for (const enabled of [undefined, false, 1, 'true']) {
    assert.equal(homeWeekOverview({ enabled, get allWeeks() { assert.fail('OFF read') } }), null)
  }
  const freeze = value => {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
    return value
  }
  const input = freeze(props())
  const before = JSON.stringify(input)
  assert.equal(homeWeekOverview(input).line, 'Ugen: 2 af 2 pas')
  assert.equal(JSON.stringify(input), before)
})

// Explicit dates cover every day of each independently chosen 7-day interval.
// October cases cross the Copenhagen winter-time transition (25 October).
test('Monday, Tuesday and Sunday starts work on every day, including winter time', () => {
  for (const [start, dates, outside] of [
    ['2026-11-02', ['02', '03', '04', '05', '06', '07', '08'].map(d => `2026-11-${d}`), ['2026-11-01', '2026-11-09']],
    ['2026-11-03', ['03', '04', '05', '06', '07', '08', '09'].map(d => `2026-11-${d}`), ['2026-11-02', '2026-11-10']],
    ['2026-11-01', ['01', '02', '03', '04', '05', '06', '07'].map(d => `2026-11-${d}`), ['2026-10-31', '2026-11-08']],
    ['2026-10-19', ['19', '20', '21', '22', '23', '24', '25'].map(d => `2026-10-${d}`), ['2026-10-18', '2026-10-26']],
    ['2026-10-20', ['20', '21', '22', '23', '24', '25', '26'].map(d => `2026-10-${d}`), ['2026-10-19', '2026-10-27']],
    ['2026-10-25', ['25', '26', '27', '28', '29', '30', '31'].map(d => `2026-10-${d}`), ['2026-10-24', '2026-11-01']],
  ]) {
    const selected = { ...week, start_date: start }
    const input = props({ allWeeks: [{ ...week, id: 'undated', start_date: null }, selected],
      currentWeek: { ...week, id: 'stale' }, exerciseLogs: [] })
    for (const day of dates) {
      const result = homeWeekOverview({ ...input, now: new Date(`${day}T12:00:00Z`) })
      assert.equal(result?.line, 'Ugen: 0 af 2 pas', `${start} contains ${day}`)
      assert.equal(result?.plan.week, selected)
    }
    for (const day of outside)
      assert.equal(homeWeekOverview({ ...input, now: new Date(`${day}T12:00:00Z`) }), null)
  }
})

test('interval ends at Copenhagen midnight, including 169-hour winter-time week', () => {
  for (const [start_date, before, end] of [
    ['2026-11-03', '2026-11-09T22:59:59Z', '2026-11-09T23:00:00Z'],
    ['2026-11-01', '2026-11-07T22:59:59Z', '2026-11-07T23:00:00Z'],
    ['2026-10-20', '2026-10-26T22:59:59Z', '2026-10-26T23:00:00Z'],
    ['2026-10-25', '2026-10-31T22:59:59Z', '2026-10-31T23:00:00Z'],
  ]) {
    const input = props({ allWeeks: [{ ...week, start_date }], exerciseLogs: [] })
    assert.equal(homeWeekOverview({ ...input, now: new Date(before) })?.line, 'Ugen: 0 af 2 pas')
    assert.equal(homeWeekOverview({ ...input, now: new Date(end) }), null)
  }
  const input = props({ allWeeks: [{ ...week, start_date: '2026-10-25' }], exerciseLogs: [] })
  assert.equal(homeWeekOverview({ ...input, now: new Date('2026-10-24T21:59:59Z') }), null)
  for (const now of ['2026-10-24T22:00:00Z', '2026-10-25T00:30:00Z', '2026-10-25T01:30:00Z'])
    assert.equal(homeWeekOverview({ ...input, now: new Date(now) })?.line, 'Ugen: 0 af 2 pas')
})

test('two containing intervals are ambiguous regardless of order or currentWeek', () => {
  const other = { ...week, id: 'overlap', start_date: '2026-11-03' }
  for (const allWeeks of [[week, other], [other, week]])
    assert.equal(homeWeekOverview(props({ allWeeks })), null)
})
