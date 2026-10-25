import { createWeekDate } from './calendarWeekDate.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { currentWeekNo, computePhases } from '../dashboardShared.js'
import { buildPlanOverview, planOverviewCounts } from '../planOverview.js'
import { lavProfilTal } from './profilTal.js'
import { beregnUgensAfvigelse, sorterEfterAfvigelse } from './afvigelse.js'

const RealDate = Date
function at(iso, run) {
  globalThis.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [iso])) }
    static now() { return new RealDate(iso).getTime() }
  }
  try { return run() } finally { globalThis.Date = RealDate }
}
const week = (n, date, count = 1) => ({ week_number: n, start_date: date, exercise_count: count })
const overview = (weeks, today = '2026-10-24') => buildPlanOverview({ athletes: [{ id: 'a', name: 'A' }], calendarWeeks: { a: weeks }, today })[0]

test('F1: en udskudt uge bruger sin egen startdato', () => {
  const weeks = [week(1, '2026-12-21'), week(2, '2027-01-04')]
  at('2027-01-05T10:00:00', () => assert.equal(currentWeekNo(weeks, 1), 2))
  at('2026-12-29T10:00:00', () => assert.equal(currentWeekNo(weeks, null), null))
})

test('F2: ny uge ved lokal midnat efter skift til sommertid', { skip: new RealDate('2026-03-23T12:00:00').getTimezoneOffset() === new RealDate('2026-03-30T12:00:00').getTimezoneOffset() }, () => {
  at('2026-03-30T00:30:00', () => assert.equal(currentWeekNo([week(1, '2026-03-23'), week(2, null)], 1), 2))
})

test('F3: daterede uger uden oevelser giver ingen plan', () => {
  assert.equal(overview([week(1, '2026-12-21', 0)]).status, 'needs_plan')
})

test('F3: slettede oevelser i sidste uge forlaenger ikke daekningen', () => {
  const entry = overview([week(1, '2026-10-19'), week(2, '2026-12-21', 0)])
  assert.equal(entry.coverage_end, '2026-10-25')
  assert.equal(entry.status, 'review_soon')
})

test('F4: oevelsesnavne maa ogsaa vaere indbyggede objektnavne', () => {
  const logs = ['constructor', '__proto__', 'toString', 'Squat'].map((name, i) => ({ exercises: { name }, weight: 100 + i, reps_completed: 5 }))
  const result = lavProfilTal({ athleteLogs: logs, athleteWeightLogs: [] })
  for (let i = 0; i < logs.length; i++) assert.equal(result.bestLog(logs[i].exercises.name, 5).weight, 100 + i)
  assert.equal(result.bestLog('valueOf', 5), null)
})

test('tomt program og tomme blokke bevarer den eksisterende reserve', () => {
  assert.equal(currentWeekNo([], null), null)
  assert.equal(currentWeekNo([], 4), 4)
  assert.deepEqual(computePhases([]), [])
  assert.equal(overview([]).status, 'needs_plan')
  assert.equal(overview([week(1, null)]).status, 'needs_dates')
})

test('uger uden egen dato udledes over aarsskifte uden at aendre input', () => {
  const weeks = [week(3, null), week(1, '2026-12-21'), week(2, null)]
  const before = structuredClone(weeks)
  at('2027-01-04T00:00:00', () => assert.equal(currentWeekNo(weeks, null), 3))
  assert.deepEqual(weeks, before)
})

test('efteraarsskift slutter ved lokal midnat og har ingen hul', () => {
  const weeks = [week(1, '2026-10-19'), week(2, null)]
  at('2026-10-25T23:30:00', () => assert.equal(currentWeekNo(weeks, null), 1))
  at('2026-10-26T00:00:00', () => assert.equal(currentWeekNo(weeks, null), 2))
})

test('historiske logs fra en slettet oevelse ignoreres', () => {
  const result = lavProfilTal({ athleteLogs: [{ exercises: null, weight: 100, reps_completed: 5 }], athleteWeightLogs: [] })
  assert.equal(result.bestLog('Squat', 5), null)
  assert.equal(result.currentWeight, null)
})

test('eksisterende repzoner vaelger den seneste log i samme zone', () => {
  const logs = [3, 6, 10].map((reps_completed, i) => ({ exercises: { name: 'Squat' }, weight: 120 - i * 10, reps_completed }))
  const result = lavProfilTal({ athleteLogs: logs, athleteWeightLogs: [{ weight: 80 }, { weight: 82 }] })
  assert.equal(result.bestLog('Squat', '4-6').weight, 110)
  assert.equal(result.bestLog('Squat', 0).weight, 120)
  assert.equal(result.currentWeight, 81)
})

test('mange atleter holdes adskilt i status og stabil afvigelsessortering', () => {
  const athletes = Array.from({ length: 10000 }, (_, i) => ({ id: `atlet_${i}`, name: `Atlet ${String(i).padStart(5, '0')}` }))
  const calendarWeeks = Object.fromEntries(athletes.map((a, i) => [a.id, i % 2 ? [] : [week(1, '2026-12-21')]]))
  const entries = buildPlanOverview({ athletes, calendarWeeks, today: '2026-10-24' })
  assert.equal(entries.length, 10000)
  assert.deepEqual(planOverviewCounts(entries), { needs_plan: 5000, covered: 5000 })
  assert.equal(new Set(entries.map(e => e.athlete.id)).size, 10000)
  const rows = athletes.map((athlete, i) => ({ athlete, afvigelse: beregnUgensAfvigelse({ plannedSets: i % 2 ? 0 : 4, completedSets: 2 }) }))
  const result = sorterEfterAfvigelse(rows)
  assert.equal(result[0].athlete.id, 'atlet_0')
  assert.equal(result[4999].athlete.id, 'atlet_9998')
  assert.equal(result[5000].athlete.id, 'atlet_1')
  assert.equal(rows[1].athlete.id, 'atlet_1')
})

const weeksAt = (date1, date2) => [{ week_number: 1, start_date: date1 }, { week_number: 2, start_date: date2 }]
test('K1: tidslinjen bruger gemt dato over aarsskifte og matcher ugevaelgeren', () => {
  const weeks = weeksAt('2026-12-14', '2027-01-04')
  const date = createWeekDate(weeks)(2)
  assert.equal(date.getTime(), new RealDate('2027-01-04T12:00:00').getTime())
  at('2027-01-04T12:00:00', () => assert.equal(currentWeekNo(weeks, null), 2))
})
test('K1: mellemrum og forskudte gemte datoer bevares', () => {
  for (const [first, second] of [['2026-03-16', '2026-04-13'], ['2026-10-12', '2026-11-09']]) {
    const weeks = weeksAt(first, second)
    assert.equal(createWeekDate(weeks)(2).getTime(), new RealDate(second + 'T12:00:00').getTime())
  }
})
test('kalenderens udaterede uger bevarer lokal middag ved begge tidsskift', () => {
  for (const [first, expected] of [['2026-03-23', '2026-03-30'], ['2026-10-19', '2026-10-26']]) {
    assert.equal(createWeekDate(weeksAt(first, null))(2).getTime(), new RealDate(expected + 'T12:00:00').getTime())
  }
})
test('kalender uden datoer forbliver uden anker', () => {
  assert.equal(createWeekDate([]), null)
  assert.equal(createWeekDate([{ week_number: 1 }]), null)
})
test('kalenderdatoer kopieres og input bevares', () => {
  const weeks = weeksAt('2026-12-21', null)
  const before = structuredClone(weeks)
  const lookup = createWeekDate(weeks)
  const first = lookup(2)
  assert.equal(first.getTime(), new RealDate('2026-12-28T12:00:00').getTime())
  first.setFullYear(2000)
  assert.equal(lookup(2).getTime(), new RealDate('2026-12-28T12:00:00').getTime())
  assert.deepEqual(weeks, before)
})
