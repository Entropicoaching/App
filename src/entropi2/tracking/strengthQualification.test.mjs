import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { buildStrengthTrend, uniqueStrengthSets } from './strengthTrend.mjs'
import { composeWeeklyReview } from './weeklyReview.mjs'
import { buildAthleteOverview } from './atlet/overview.mjs'
import MineTal from './atlet/MineTal.mjs'
import { uniqueSets, weeklyLoad } from '../analysis/weeklyLoad.mjs'
import { estimatedOneRepMax } from '../../exerciseProgress.js'

const athleteId = 'synthetic-qualification-owner'
const today = '2026-11-04'
const dates = ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26']
const stable = () => dates.map((logged_at, i) => ({
  id: `qualification-${i}`, athlete_id: athleteId, exercise_id: 'deadlift', set_number: i,
  logged_at, weight: 140, reps_completed: 4,
  exercises: { name: 'Deadlift', sessions: { weeks: { block_name: 'Strength' } } },
}))
const permutations = rows => [rows, [...rows].reverse()]
const trend = rows => buildStrengthTrend(rows, { today })
const deadlift = rows => trend(rows).lifts.find(lift => lift.key === 'doedloeft')
const review = rows => composeWeeklyReview({ enabled: true, athleteId, weekEnd: today, exerciseLogs: rows })
const snapshot = exerciseLogs => ({ status: 'ready', complete: true, athleteId, endDate: today,
  dailyRows: [], mealRows: [], weightRows: [], exerciseLogs })
const conflicts = row => [
  { ...row, exercises: { name: 'Curl' } },
  { ...row, exercises: { name: 'Deadlift - backoff' } },
  { ...row, exercises: { name: 'Pause deadlift' } },
  ...['Deload', 'Aflastning', 'Taper'].map(block_name => ({ ...row,
    exercises: { name: 'Deadlift', sessions: { weeks: { block_name } } } })),
]
function unknown(rows) {
  const lift = deadlift(rows)
  assert.equal(lift.weeks.at(-2).e1rm, null)
  for (const field of ['plateau', 'drop', 'dropPercent', 'slopeKgPerWeek']) assert.equal(lift[field], null)
  const result = review(rows)
  assert.equal(result.sections.strength.status, 'insufficient')
  assert.equal(result.status, 'insufficient')
  assert.deepEqual(result.planning.reviewSignalIds, [])
  assert.equal(result.planning.automaticChanges, false)
}

test('same-ID effective exercise name, set type, variant and week block conflicts stay unknown', () => {
  const rows = stable()
  for (const conflict of conflicts(rows[3])) {
    for (const ordered of permutations([...rows, conflict])) unknown(ordered)
  }
})

test('effective flat reps and name aliases are compared before qualification', () => {
  const rows = stable().map(({ reps_completed, exercises, ...row }) => ({
    ...row, name: exercises.name, reps: reps_completed,
  }))
  for (const changes of [{ reps: 1 }, { reps_completed: null, reps: 1 }, { name: 'Curl' }]) {
    for (const ordered of permutations([...rows, { ...rows[3], ...changes }])) unknown(ordered)
  }
  // Null primary reps falls back, while a present primary value owns the estimate.
  for (const last of [{ ...rows[3], reps_completed: null },
    { ...rows[3], reps_completed: 4, reps: 1 },
    { ...rows[3], exercises: { name: 'Deadlift' }, name: 'Curl' }]) {
    for (const ordered of permutations([...rows, last])) assert.deepEqual(trend(ordered), trend(rows))
  }
})

test('fallback position/time identities share the strength conflict rule without inventing IDs', () => {
  for (const kind of ['position', 'time']) {
    const rows = stable().map(row => {
      const copy = { ...row }; delete copy.id
      if (kind === 'time') delete copy.set_number
      return copy
    })
    for (const conflict of conflicts(rows[3])) {
      for (const ordered of permutations([...rows, conflict])) unknown(ordered)
    }
    assert.deepEqual(trend([...rows, { ...rows[3] }]), trend(rows))
  }
  // Without any shared identity, observations remain independent as before.
  const rows = stable().map(row => {
    const copy = { ...row }; delete copy.id; delete copy.exercise_id; delete copy.set_number
    return copy
  })
  assert.equal(deadlift([...rows, { ...rows[3], exercises: { name: 'Curl' } }]).plateau, true)
})

test('unrelated unambiguous sets and lifts survive qualification and reps-alias conflicts', () => {
  const rows = stable()
  const bench = rows.map(row => ({ ...row, id: `bench-${row.id}`, exercise_id: 'bench', exercises: { name: 'Bench press' } }))
  const valid = { ...rows[3], id: 'valid-latest', set_number: 9, weight: 150 }
  const flat = rows.map(({ reps_completed, exercises, ...row }) => ({ ...row, name: exercises.name, reps: reps_completed }))
  for (const disputed of [...conflicts(rows[3]).map(conflict => [...rows, conflict]),
    [...flat, { ...flat[3], reps: 1 }]]) {
    for (const ordered of permutations([...disputed, ...bench])) {
      const result = review(ordered)
      assert.equal(deadlift(ordered).weeks.at(-2).e1rm, null)
      assert.deepEqual(result.planning.reviewSignalIds, ['strength:baenkpres'])
    }
    for (const ordered of permutations([...disputed, valid, ...bench])) {
      assert.equal(deadlift(ordered).weeks.at(-2).e1rm, estimatedOneRepMax(150, 4))
      assert.equal(deadlift(ordered).plateau, false)
      assert.equal(deadlift(ordered).drop, false)
      assert.deepEqual(review(ordered).planning.reviewSignalIds, ['strength:baenkpres'])
    }
  }
})

test('actual overview and real React retain unknown strength through the consumer boundary', () => {
  const rows = stable()
  const flat = rows.map(({ reps_completed, exercises, ...row }) => ({ ...row, name: exercises.name, reps: reps_completed }))
  for (const disputed of [...conflicts(rows[3]).map(conflict => [...rows, conflict]),
    [...flat, { ...flat[3], reps: 1 }]]) {
    for (const ordered of permutations(disputed)) {
      const input = snapshot(ordered)
      const model = buildAthleteOverview(input, { enabled: true })
      assert.equal(model.strength.some(lift => lift.weekStart === dates[3]), false)
      assert.equal(model.strength.some(lift => lift.weekStart === dates[2]), true)
      const html = renderToStaticMarkup(h(MineTal, { enabled: true, snapshot: input }))
      assert.doesNotMatch(html, /Dødløft · uge fra 2026-10-26/)
      assert.match(html, /Dødløft · uge fra 2026-10-19/)
      const valid = { ...rows[3], id: 'valid-rendered', set_number: 9, weight: 150 }
      const withValid = renderToStaticMarkup(h(MineTal, { enabled: true, snapshot: snapshot([...ordered, valid]) }))
      assert.match(withValid, /Dødløft · uge fra 2026-10-26: 170,0 kg e1RM/)
    }
  }
})

test('strength normalization preserves default load semantics and does not mutate frozen input', () => {
  const rows = stable()
  const duplicate = { ...rows[3], exercises: { name: 'Curl' } }
  const input = [...rows, duplicate]
  const expectedLoad = weeklyLoad(rows, today)
  for (const row of input) {
    if (row.exercises.sessions) {
      Object.freeze(row.exercises.sessions.weeks); Object.freeze(row.exercises.sessions)
    }
    Object.freeze(row.exercises); Object.freeze(row)
  }
  Object.freeze(input)
  const before = JSON.stringify(input)
  for (const ordered of permutations(input)) {
    assert.equal(uniqueSets(ordered).length, 4)
    assert.deepEqual(weeklyLoad(ordered, today), expectedLoad)
    assert.equal(uniqueStrengthSets(ordered).length, 3)
    unknown(ordered)
  }
  assert.equal(JSON.stringify(input), before)
})

test('overview still resolves conflicts before range filtering and preserves owner, date and OFF gates', () => {
  const rows = stable()
  for (const changes of [{ logged_at: '2026-07-01' }, { logged_at: '2026-12-01' }]) {
    for (const ordered of permutations([...rows, { ...rows[3], ...changes }])) {
      assert.equal(buildAthleteOverview(snapshot(ordered), { enabled: true }).strength.some(lift => lift.weekStart === dates[3]), false)
    }
  }
  const outsider = { ...rows[3], athlete_id: 'foreign-owner', exercises: { name: 'Curl' } }
  assert.deepEqual(review([...rows, outsider]), review(rows))
  assert.equal(buildAthleteOverview(snapshot([...rows, outsider]), { enabled: true }).status, 'error')
  const unreadable = new Proxy({}, { get() { throw Error('OFF read') } })
  assert.equal(buildAthleteOverview(unreadable), null)
  assert.equal(renderToStaticMarkup(h(MineTal, { enabled: false, snapshot: unreadable })), '')
})

test('strength normalization never enumerates private fields or reads shadowed flat aliases', () => {
  const rows = stable()
  for (const row of rows) {
    for (const key of ['cycle', 'cycleData', 'auth', 'athleteName', 'reps', 'name']) {
      Object.defineProperty(row, key, { enumerable: true, get() { throw Error(`Unexpected read: ${key}`) } })
    }
    Object.freeze(row)
  }
  Object.freeze(rows)
  assert.equal(deadlift(rows).plateau, true)
  assert.equal(buildAthleteOverview(snapshot(rows), { enabled: true }).status, 'ready')
  assert.match(renderToStaticMarkup(h(MineTal, { enabled: true, snapshot: snapshot(rows) })), /170|158,7/)
})
