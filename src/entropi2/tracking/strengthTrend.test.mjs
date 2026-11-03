import test from 'node:test'
import assert from 'node:assert/strict'
import { buildStrengthTrend } from './strengthTrend.mjs'
import { estimatedOneRepMax } from '../../exerciseProgress.js'

const today = '2026-11-03'
const dates = ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26']
const row = (day, weight = 100, name = 'Squat', reps = 3) => ({ logged_at: day, weight, reps_completed: reps, exercises: { name } })
const logs = weights => weights.map((weight, i) => row(dates[i], weight))
const result = rows => buildStrengthTrend(rows, { today })
const squat = rows => result(rows).lifts.find(l => l.key === 'squat')
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`)

test('explicit clock, invalid collections/dates and empty observations', () => {
  assert.equal(buildStrengthTrend([]), null)
  for (const bad of [null, undefined, {}, 'logs']) assert.equal(result(bad), null)
  for (const bad of ['', 'no-date', '2026-02-30', '2026-13-01', null]) assert.equal(buildStrengthTrend([], { today: bad }), null)
  const m = result([])
  assert.equal(m.lifts.length, 4)
  assert.equal(m.windowStart, '2026-08-17')
  assert.equal(m.completedThrough, '2026-11-01')
  for (const l of m.lifts) {
    assert.equal(l.weeks.length, 12)
    assert.ok(l.weeks.every(w => w.e1rm === null))
    assert.equal(l.slopeKgPerWeek, null)
    assert.equal(l.plateau, null)
    assert.equal(l.drop, null)
  }
})

test('weekly maximum uses shared Epley estimate, not heaviest weight', () => {
  const s = squat([row(dates[0], 110, 'Squat', 1), row(dates[0], 100, 'Squat', 8)])
  near(s.weeks[7].e1rm, estimatedOneRepMax(100, 8))
})

test('four progressive weeks give positive slope, no plateau/drop', () => {
  const s = squat(logs([100, 110, 120, 130]))
  near(s.slopeKgPerWeek, 11)
  assert.equal(s.plateau, false)
  assert.equal(s.drop, false)
})

test('three weeks without a new top give plateau, ties count', () => {
  for (const weights of [[100, 100, 100, 100], [100, 99, 98, 100]]) {
    assert.equal(squat(logs(weights)).plateau, true)
  }
  assert.equal(squat(logs([100, 101, 100, 100])).plateau, false)
  assert.equal(squat(logs([100, 100, 100])).plateau, null)
})

test('drop is strictly above 5 percent, below threshold and above threshold', () => {
  for (const [last, expected] of [[95, false], [95.001, false], [94.999, true], [90, true]]) {
    const s = squat(logs([100, 100, 100, last]))
    assert.equal(s.drop, expected)
    near(s.dropPercent, 100 - last)
  }
})

test('drop uses highest weekly estimate anywhere in four-week window', () => {
  const s = squat(logs([90, 100, 98, 94]))
  assert.equal(s.drop, true)
  assert.equal(s.plateau, false)
  near(s.dropPercent, 6)
})

test('gaps are null and disable signals; regression keeps calendar spacing', () => {
  const s = squat(['2026-09-28','2026-10-05','2026-10-19','2026-10-26'].map((d, i) => row(d, [100, 110, 130, 140][i])))
  near(s.slopeKgPerWeek, 11)
  assert.equal(s.weeks[8].e1rm, null)
  assert.equal(s.plateau, null)
  assert.equal(s.drop, null)
})

test('stale observations cannot produce a current signal', () => {
  const s = squat(logs([100,100,100,100]).map(r => ({...r, logged_at: r.logged_at.replace('10-', '09-')})))
  assert.equal(s.plateau, null)
  assert.equal(s.drop, null)
})

test('current partial week is returned but cannot change completed statistics', () => {
  const a = squat(logs([100, 100, 100, 100]))
  const b = squat([...logs([100, 100, 100, 100]), row(today, 400)])
  assert.equal(b.weeks.at(-1).provisional, true)
  near(b.weeks.at(-1).e1rm, 440)
  assert.equal(b.plateau, a.plateau)
  assert.equal(b.drop, a.drop)
  assert.equal(b.slopeKgPerWeek, a.slopeKgPerWeek)
})

test('date bounds, Copenhagen midnight, ISO year and DST boundaries', () => {
  const s = squat([row('2026-08-16', 900), row('2026-08-17', 100), row('2026-11-04', 900), row('2026-11-01T23:30:00Z', 120)])
  near(s.weeks[0].e1rm, 110)
  near(s.weeks.at(-1).e1rm, 132)
  assert.equal(result([row('2026-10-25T01:30:00Z')]).lifts.find(l => l.key === 'squat').weeks[9].e1rm, 110.00000000000001)
  const year = buildStrengthTrend([row('2025-12-31')], { today: '2026-01-05' })
  assert.equal(year.currentWeek, '2026-01-05')
  near(year.lifts.find(l => l.key === 'squat').weeks[10].e1rm, 110)
})

test('aliases merge but bench, sumo, conventional and variants stay separate', () => {
  const names = ['Baenkpres - topsaet', 'Bench press', 'Deadlift', 'Doedloeft (sumo)', 'Pause squat', 'Squat']
  const m = result(names.map((name, i) => row(dates[0], 100 + i, name)))
  assert.equal(m.lifts.length, 5)
  near(m.lifts.find(l => l.key === 'baenkpres').weeks[7].e1rm, estimatedOneRepMax(101, 3))
  near(m.lifts.find(l => l.key === 'sumo doedloeft').weeks[7].e1rm, estimatedOneRepMax(103, 3))
  near(m.lifts.find(l => l.key === 'doedloeft').weeks[7].e1rm, estimatedOneRepMax(102, 3))
  near(m.lifts.find(l => l.key === 'pause squat').weeks[7].e1rm, estimatedOneRepMax(104, 3))
})

test('existing main-lift and heavy-set rules reject accessories, light sets and deload', () => {
  const names = ['RDL', 'Romanian deadlift', 'Front squat', 'Goblet squat', 'DB bench press', 'Triceps bench extension', 'OHP', 'Squat - backoff', 'Squat teknik single']
  const rows = names.map(name => row(dates[0], 500, name))
  rows.push({...row(dates[0], 500), skipped: true}, row(dates[0],500,'Squat',9))
  rows.push({...row(dates[0],500), exercises: {name:'Squat', sessions:{weeks:{block_name:'Deload'}}}})
  const m = result(rows)
  assert.equal(m.lifts.length, 4)
  assert.ok(m.lifts.every(l => l.weeks.every(w => w.e1rm === null)))
})

test('invalid numeric/date rows ignored; supported numeric strings and flat aliases', () => {
  const rows = [null, {}, ...[0,-1,NaN,Infinity,'bad',true,{}].map(w => row(dates[0],w)), row('2026-02-30'), row('bad'), row(undefined)]
  assert.ok(squat(rows).weeks.every(w => w.e1rm === null))
  const s = squat([{name:'Squat', weight:'100,5', reps:'3', logged_at:dates[0]}])
  near(s.weeks[7].e1rm, estimatedOneRepMax('100,5', '3'))
})

test('deterministic order, duplicate rows and frozen input cause no mutation', () => {
  const rows = logs([100, 110, 120, 130])
  for (const r of rows) { Object.freeze(r.exercises); Object.freeze(r) }
  Object.freeze(rows)
  assert.deepEqual(result(rows), result([...rows].reverse().concat(rows)))
})

test('extreme finite values leave statistics finite or null', () => {
  const s = squat(logs([1e305, 2e305, 3e305, 4e305]))
  assert.ok(Number.isFinite(s.slopeKgPerWeek))
  assert.ok(Number.isFinite(s.dropPercent))
  assert.ok(s.weeks.every(w => w.e1rm === null || Number.isFinite(w.e1rm)))
})
