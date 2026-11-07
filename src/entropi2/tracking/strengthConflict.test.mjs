import test from 'node:test'
import assert from 'node:assert/strict'
import { buildStrengthTrend } from './strengthTrend.mjs'
import { composeWeeklyReview } from './weeklyReview.mjs'
import { weeklyDataBasis } from './kvalitet/weeklyDataBasis.mjs'
import { estimatedOneRepMax } from '../../exerciseProgress.js'

const athleteId = 'synthetic-strength-owner'
const asOf = '2026-11-04'
const dates = ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26']
const stable = (owner = athleteId, exercise = 'squat', name = 'Squat') => dates.map((logged_at, i) => ({
  id: `${exercise}-${i}`, athlete_id: owner, exercise_id: exercise, set_number: i + 1,
  logged_at, weight: 100, reps_completed: 3, exercises: { name },
}))
const lift = (model, key = 'squat') => model.lifts.find(item => item.key === key)
const trend = rows => buildStrengthTrend(rows, { today: asOf })
const review = (rows, owner = athleteId) => composeWeeklyReview({
  enabled: true, athleteId: owner, weekEnd: asOf, exerciseLogs: rows,
})
const basis = rows => weeklyDataBasis({ enabled: true, athleteId, asOf,
  sources: { training: { athleteId, state: 'ready', complete: true, rows } },
})
const permutations = rows => [rows, [...rows].reverse()]
function unknownLatest(rows, recordedDays = 0) {
  const strength = lift(trend(rows))
  assert.equal(strength.weeks.at(-2).e1rm, null)
  assert.equal(strength.plateau, null)
  assert.equal(strength.drop, null)
  assert.equal(strength.dropPercent, null)
  assert.equal(strength.slopeKgPerWeek, null)
  const composed = review(rows)
  assert.deepEqual(composed.sections.strength.data, trend(rows))
  assert.equal(composed.sections.strength.status, 'insufficient')
  assert.equal(composed.signals.some(signal => signal.id.startsWith('strength:')), false)
  assert.equal(composed.planning.reviewSignalIds.some(id => id.startsWith('strength:')), false)
  assert.equal(composed.status, 'insufficient')
  assert.equal(basis(rows).weeks[2].domains.training.recordedDays, recordedDays)
}

test('four completed weeks plus a conflicting last ID cannot create a weekly top or review', () => {
  for (const weight of [90, 200]) {
    const rows = stable()
    for (const ordered of permutations([...rows, { ...rows[3], weight }])) unknownLatest(ordered)
  }
})

test('identical persisted copies retain an actually valid stable series and plateau evidence', () => {
  const rows = stable()
  const expected = trend(rows)
  for (const ordered of permutations([...rows, { ...rows[3], exercises: { name: 'Squat' } }])) {
    assert.deepEqual(trend(ordered), expected)
    const s = lift(trend(ordered))
    assert.deepEqual(s.weeks.slice(-5, -1).map(week => week.e1rm), Array(4).fill(estimatedOneRepMax(100, 3)))
    assert.equal(s.slopeKgPerWeek, 0)
    assert.equal(s.plateau, true)
    assert.equal(s.drop, false)
    const composed = review(ordered)
    assert.equal(composed.sections.strength.status, 'ready')
    assert.equal(composed.status, 'review')
    assert.deepEqual(composed.planning.reviewSignalIds, ['strength:squat'])
    const signal = composed.signals.find(item => item.id === 'strength:squat')
    assert.deepEqual(signal.evidence.weeks, s.weeks)
    assert.deepEqual(signal.evidence.threshold, { dropPercent: 5, plateauWeeks: 3 })
    assert.equal(composed.planning.automaticChanges, false)
    assert.equal(basis(ordered).weeks[2].domains.training.recordedDays, 1)
  }
})

test('conflicts resolve across the whole snapshot before date or qualification filters', () => {
  const rows = stable()
  for (const changes of [
    { reps_completed: 4 },
    { logged_at: '2026-10-27' },
    { logged_at: '2026-10-26T12:00:00Z' },
    { logged_at: '2026-07-01' },
    { logged_at: '2026-12-01' },
    { logged_at: 'invalid' },
    { skipped: true },
    { _optimistic: true },
    { weight: null },
    { weight: 500, exercise_id: 'accessory', exercises: { name: 'Curl' } },
  ]) {
    // Coverage discards optimistic rows before identity resolution; a confirmed
    // copy can still count as a recorded day there, without proving strength.
    for (const ordered of permutations([...rows, { ...rows[3], ...changes }])) {
      unknownLatest(ordered, changes._optimistic ? 1 : 0)
    }
  }
})

test('shared fallback identities reject position/time conflicts and keep identical copies', () => {
  for (const identity of ['position', 'time']) {
    const rows = stable().map(row => {
      const copy = { ...row }; delete copy.id
      if (identity === 'time') delete copy.set_number
      return copy
    })
    for (const ordered of permutations([...rows, { ...rows[3], weight: 200 }])) unknownLatest(ordered)
    assert.deepEqual(trend([...rows, { ...rows[3] }]), trend(rows))
  }
})

test('unrelated exercises and athletes cannot replace or remove scoped strength evidence', () => {
  const rows = stable()
  const conflict = { ...rows[3], weight: 200 }
  const bench = stable(athleteId, 'bench', 'Bench press')
  // Same IDs from another athlete are discarded by the real composition boundary.
  const foreign = stable('synthetic-other-owner').map(row => ({ ...row, weight: 250 }))
  for (const ordered of permutations([...rows, conflict, ...bench, ...foreign])) {
    const composed = review(ordered)
    assert.equal(lift(composed.sections.strength.data).weeks.at(-2).e1rm, null)
    assert.equal(lift(composed.sections.strength.data).plateau, null)
    assert.equal(lift(composed.sections.strength.data, 'baenkpres').plateau, true)
    assert.deepEqual(composed.planning.reviewSignalIds.filter(id => id.startsWith('strength:')), ['strength:baenkpres'])
    assert.equal(lift(review(ordered, 'synthetic-other-owner').sections.strength.data).plateau, true)
    assert.deepEqual(review([...rows, ...foreign]).sections.strength.data, trend(rows))
  }
})

test('independent valid set in disputed week remains measurable; conflict cannot manufacture its top', () => {
  const rows = stable()
  const valid = { ...rows[3], id: 'independent-last-set', set_number: 5, weight: 110 }
  for (const ordered of permutations([...rows, { ...rows[3], weight: 400 }, valid])) {
    const s = lift(trend(ordered))
    assert.equal(s.weeks.at(-2).e1rm, estimatedOneRepMax(110, 3))
    assert.equal(s.plateau, false)
    assert.equal(s.drop, false)
    assert.equal(review(ordered).signals.some(signal => signal.id === 'strength:squat'), false)
    assert.equal(basis(ordered).weeks[2].domains.training.recordedDays, 1)
  }
})

test('optimistic-only or missing strength stays unknown, and OFF still does not inspect input', () => {
  const rows = stable().map((row, i) => i === 3 ? { ...row, _optimistic: true } : row)
  unknownLatest(rows)
  assert.equal(review(null).sections.strength.data, null)
  assert.equal(review([]).sections.strength.status, 'insufficient')
  const options = { enabled: false, exerciseLogs: new Proxy([], {
    get() { throw Error('OFF inspected logs') },
  }) }
  assert.equal(composeWeeklyReview(options), null)
})

test('frozen snapshots remain unchanged and deterministic after normalization', () => {
  const rows = stable()
  rows.push({ ...rows[3], weight: 200 })
  for (const row of rows) { Object.freeze(row.exercises); Object.freeze(row) }
  Object.freeze(rows)
  const before = JSON.stringify(rows)
  assert.deepEqual(trend(rows), trend([...rows].reverse()))
  unknownLatest(rows)
  assert.equal(JSON.stringify(rows), before)
})
