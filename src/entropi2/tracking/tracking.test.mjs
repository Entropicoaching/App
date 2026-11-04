import test from 'node:test'
import assert from 'node:assert/strict'
import { dayNumber, windowEnding } from './trackingDates.mjs'
import { normalizeDailyExtras, summarizeWellbeing } from './wellbeing.mjs'
import { mayReadCycle, projectCycle } from './cyclePrivacy.mjs'
import { composeWeeklyReview } from './weeklyReview.mjs'
import { load } from './load.mjs'
import { buildStrengthTrend } from './strengthTrend.mjs'
import { nutritionTrend } from './nutritionTrend.mjs'
import { weightTrend } from './weightTrend.mjs'

const weekEnd = '2026-11-04'
const athlete = { id: 'athlete-profile', user_id: 'athlete-login', coach_id: 'coach-login' }
const consent = { athlete_id: athlete.id, coach_id: athlete.coach_id, sharing_enabled: true }
const day = offset => new Date(Date.parse(weekEnd) + offset * 86400000).toISOString().slice(0, 10)
const row = (date, patch = {}) => ({ athlete_id: athlete.id, logged_date: date, sleep_quality: 3, pain: 0, ...patch })
const ready = (date, patch = {}) => ({ athlete_id: athlete.id, logged_date: date, sleep_hours: 7, energy: 3, stress: 3, soreness_level: 1, ...patch })
const seven = factory => Array.from({ length: 7 }, (_, i) => factory(day(-i)))
const summary = (rows = [], readiness = []) => summarizeWellbeing({ athleteId: athlete.id, weekEnd, rows, readiness })
const compose = (extra = {}) => composeWeeklyReview({ enabled: true, athleteId: athlete.id, weekEnd, ...extra })

test('strict calendar dates, leap days, DST windows and bad windows', () => {
  assert.equal(dayNumber('2024-02-29') + 1, dayNumber('2024-03-01'))
  for (const bad of ['2026-02-29', '2026-13-01', '2026-1-01', '', null, '2026-10-25T00:00Z']) assert.throws(() => dayNumber(bad))
  assert.equal(windowEnding('2026-10-26', 7).from, '2026-10-20')
  assert.throws(() => windowEnding(weekEnd, 0))
})

test('extras payload preserves zero/null and rejects duplicate readiness fields and invalid values', () => {
  assert.deepEqual(normalizeDailyExtras({ athlete_id: athlete.id, logged_date: weekEnd, pain: 0, secret: 'omit' }),
    { athlete_id: athlete.id, logged_date: weekEnd, sleep_quality: null, pain: 0, pain_location: null })
  for (const patch of [{}, { sleep_hours: 7 }, { energy: 3 }, { stress: 4 }, { soreness: 7 }, { soreness_level: 3 },
    { pain: '' }, { pain: NaN }, { pain: Infinity }, { pain: -1 }, { pain: 11 }, { pain: 1.5 }, { pain: 7 },
    { sleep_quality: 6 }, { pain: 0, pain_location: 'knee' }, { pain: 7, pain_location: ' ' }]) {
    assert.throws(() => normalizeDailyExtras({ athlete_id: athlete.id, logged_date: weekEnd, ...patch }))
  }
  assert.equal(normalizeDailyExtras(row(weekEnd, { pain: 7, pain_location: 'knee' })).pain, 7)
})

test('readiness and extras join once per date without writes, copying or scale conversion', () => {
  const readiness = seven(date => ready(date, { sleep_hours: 0, soreness_level: 4 }))
  const rows = seven(row)
  const original = structuredClone({ rows, readiness })
  const result = summary([...rows, row(day(-7)), row(day(1)), row(weekEnd, { athlete_id: 'other' })], readiness)
  assert.equal(result.observedDays, 7)
  assert.equal(result.metrics.sleep_hours.mean, 0)
  assert.equal(result.metrics.soreness_level.mean, 4)
  assert.deepEqual({ rows, readiness }, original)
  assert.throws(() => summary([rows[0], rows[0]]), /Conflicting/)
  assert.throws(() => summary([], [readiness[0], readiness[0]]), /Conflicting/)
  assert.throws(() => summary([], [ready(weekEnd, { soreness_level: 0 })]))
  assert.throws(() => summary([], [ready(weekEnd, { soreness_level: 6 })]))
})

test('per-metric four-date minimum and pain priority retain dates, raw values and boundaries', () => {
  assert.equal(summary([], seven(ready).slice(0, 3)).metrics.energy.mean, null)
  assert.equal(summary([], seven(ready).slice(0, 4)).metrics.energy.mean, 3)
  assert.deepEqual(summary([], seven(date => ready(date, { sleep_hours: 6 }))).signals, [])
  const result = summary([row(weekEnd, { pain: 7, pain_location: 'knee' })], seven(date => ready(date, { sleep_hours: 5.5, energy: 2, stress: 4, soreness_level: 4 })))
  assert.deepEqual(result.signals.map(s => s.id), ['sleep_hours', 'energy', 'stress', 'soreness_level', 'pain'])
  assert.equal(result.signals.at(-1).severity, 'priority')
  assert.equal(result.signals[0].evidence.dates.length, 7)
  assert.deepEqual(result.signals[0].evidence.values, Array(7).fill(5.5))
  assert.equal(summary([row(weekEnd, { pain: 6, pain_location: 'knee' })]).signals.length, 0)
})

test('cycle policy decision matrix: owner/current consent recipient only; login is not profile id', () => {
  for (const [viewerId, consents, expected] of [
    [athlete.user_id, [], true], [athlete.id, [consent], false],
    [athlete.coach_id, [], false], [athlete.coach_id, [consent], true],
    [athlete.coach_id, [{ ...consent, sharing_enabled: false }], false],
    [athlete.coach_id, [{ ...consent, sharing_enabled: 'true' }], false],
    [athlete.coach_id, [{ ...consent, athlete_id: 'other' }], false],
    ['former-coach', [{ ...consent, coach_id: 'former-coach' }], false],
    ['stranger', [consent], false], [null, [consent], false], [athlete.coach_id, null, false],
  ]) assert.equal(mayReadCycle({ viewerId, athlete, consents }), expected)
  assert.equal(mayReadCycle({ viewerId: 'replacement', athlete: { ...athlete, coach_id: 'replacement' }, consents: [consent] }), false)
})

test('revocation removes rows, count and derived fields; denied path never touches private input', () => {
  const bomb = new Proxy([], { get() { throw Error('private data accessed') } })
  assert.equal(projectCycle({ viewerId: athlete.coach_id, athlete, consents: [], rows: bomb, weekEnd: 'invalid' }), null)
  const rows = [{ athlete_id: athlete.id, logged_date: weekEnd, bleeding: 'light', cycle_day: 2, derived_readiness: 10 }]
  const grant = { viewerId: athlete.coach_id, athlete, consents: [consent], rows, weekEnd }
  const visible = projectCycle(grant)
  assert.equal(visible.entries.length, 1)
  assert.equal('derived_readiness' in visible.entries[0], false)
  consent.sharing_enabled = false
  assert.equal(projectCycle(grant), null)
  assert.equal(projectCycle({ ...grant, viewerId: athlete.user_id }).entries.length, 1)
  consent.sharing_enabled = true
})

test('cycle projection excludes other athletes, outside dates; no inferred cycle phase', () => {
  const entry = { athlete_id: athlete.id, logged_date: weekEnd, bleeding: 'none' }
  const args = { viewerId: athlete.user_id, athlete, weekEnd }
  assert.equal(projectCycle({ ...args, rows: [entry, { ...entry, athlete_id: 'other' }, { ...entry, logged_date: day(-7) }] }).entries.length, 1)
  assert.throws(() => projectCycle({ ...args, rows: [entry, entry] }), /Duplicate/)
  for (const patch of [{ bleeding: 'guessed' }, { cycle_day: 0 }, { cycle_day: 121 }, { note: 'x'.repeat(1001) }]) assert.throws(() => projectCycle({ ...args, rows: [{ ...entry, ...patch }] }))
})

test('OFF never inspects any source or validates identity, and is strict boolean', () => {
  const bomb = new Proxy([], { get() { throw Error('OFF read') } })
  assert.equal(composeWeeklyReview(), null)
  for (const enabled of [false, 'true', 1]) assert.equal(composeWeeklyReview({ enabled, exerciseLogs: bomb, wellbeing: bomb, readiness: bomb }), null)
})

test('native models receive isolated real row shapes, with exact native output and no mutation', () => {
  const exerciseLogs = ['2026-10-08', '2026-10-15', '2026-10-22', '2026-10-29'].map((logged_at, i) =>
    ({ athlete_id: athlete.id, logged_at, weight: i === 3 ? 1000 : 100, reps_completed: 3, exercises: { name: 'Squat' } }))
  const mealLogs = seven(date => ({ athlete_id: athlete.id, date, meal: 'Synthetic meal', kcal: 100, protein: 79, carb: 1, fat: 1 }))
  const weightLogs = Array.from({ length: 21 }, (_, i) => ({ athlete_id: athlete.id, logged_at: day(-i), weight: i < 7 ? 84 : i < 14 ? 82 : 80 }))
  const targets = { protein_target: 100, kcal_target: 100 }
  const all = { exerciseLogs, mealLogs, weightLogs, targets }
  const before = structuredClone(all)
  const result = compose(all)
  assert.deepEqual(result.sections.load.data, load(exerciseLogs, weekEnd))
  assert.deepEqual(result.sections.strength.data, buildStrengthTrend(exerciseLogs, { today: weekEnd }))
  assert.deepEqual(result.sections.nutrition.data, nutritionTrend(mealLogs, targets, weekEnd))
  assert.deepEqual(result.sections.weight.data, weightTrend(weightLogs, athlete.id, weekEnd))
  assert.deepEqual(all, before)
  for (const id of ['load', 'nutrition', 'weight']) assert.ok(result.signals.some(signal => signal.id === id))
  assert.equal(result.signals.find(s => s.id === 'nutrition').evidence.targetBasis, 'current')
  const foreign = Object.fromEntries(['exerciseLogs', 'mealLogs', 'weightLogs'].map(key => [key, all[key].map(row => ({ ...row, athlete_id: 'other' }))]))
  assert.deepEqual(compose(foreign).signals, [])
  assert.ok(Object.values(compose(foreign).sections).every(s => s.status === 'insufficient'))
})

test('native strength plateau/drop, variant identity and completed-week gate', () => {
  const exerciseLogs = ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'].map((logged_at, i) =>
    ({ athlete_id: athlete.id, logged_at, weight: i === 3 ? 90 : 100, reps_completed: 3, exercises: { name: 'Squat' } }))
  const result = compose({ exerciseLogs })
  const signal = result.signals.find(s => s.id === 'strength:squat')
  assert.ok(signal)
  assert.match(signal.reason, /5 %/)
  assert.equal(signal.evidence.to, '2026-11-01')
  assert.equal(compose({ exerciseLogs: exerciseLogs.slice(1) }).signals.some(s => s.id.startsWith('strength:')), false)
})

test('missing/empty histories stay insufficient; compliance keeps Danish text and pain first', () => {
  for (const extra of [{}, { exerciseLogs: [], mealLogs: [], weightLogs: [] }]) {
    const result = compose(extra)
    assert.equal(result.status, 'insufficient')
    assert.ok(Object.values(result.sections).every(s => s.status === 'insufficient'))
    assert.equal(result.planning.automaticChanges, false)
  }
  assert.throws(() => compose({ exerciseLogs: {} }))
  const result = compose({ wellbeing: [row(weekEnd, { pain: 8, pain_location: 'back' })], plannedSessions: 4, completedSessions: 2 })
  assert.equal(result.status, 'reviewPain')
  assert.equal(result.signals[0].id, 'pain')
  assert.equal(result.signals.find(s => s.id === 'compliance').reason, 'Under 75 % af planlagte pas bekræftet gennemført')
  assert.equal(compose({ plannedSessions: 0, completedSessions: 0 }).compliance.percent, null)
  for (const [plannedSessions, completedSessions] of [[1, 2], [-1, 0], [2, 0.5]]) assert.throws(() => compose({ plannedSessions, completedSessions }))
})

test('complete native coverage can be noFlags, but any missing domain prevents it', () => {
  const exerciseLogs = ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26', weekEnd].map((logged_at, i) =>
    ({ athlete_id: athlete.id, logged_at, weight: 100 + i * 10, reps_completed: 3, exercises: { name: 'Squat' } }))
  const mealLogs = seven(date => ({ athlete_id: athlete.id, date, meal: 'Synthetic meal', kcal: 100, protein: 100, carb: 1, fat: 1 }))
  const weightLogs = Array.from({ length: 21 }, (_, i) => ({ athlete_id: athlete.id, logged_at: day(-i), weight: 80 }))
  const input = { exerciseLogs, mealLogs, weightLogs, targets: { protein_target: 100 },
    readiness: seven(ready), wellbeing: seven(row), plannedSessions: 4, completedSessions: 3 }
  assert.equal(compose(input).status, 'noFlags')
  for (const key of ['exerciseLogs', 'mealLogs', 'weightLogs']) assert.equal(compose({ ...input, [key]: null }).status, 'insufficient')
  assert.equal(compose({ ...input, readiness: [] }).status, 'insufficient')
})
