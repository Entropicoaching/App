import { test } from 'node:test'
import assert from 'node:assert/strict'
import { estimatedOneRepMax, heaviestSetPerWeek } from './exerciseProgress.js'

test('estimatedOneRepMax bruger Epley (vægt × (1 + reps/30))', () => {
  assert.equal(estimatedOneRepMax(100, 1), 100 * (1 + 1 / 30))
  assert.equal(estimatedOneRepMax(100, 5), 100 * (1 + 5 / 30))
  assert.equal(estimatedOneRepMax(0, 5), 0)
})

test('heaviestSetPerWeek vælger det tungeste sæt pr. kalenderuge, ældste først', () => {
  const logs = [
    { weight: 80, reps_completed: 5, logged_at: '2026-01-05T10:00:00Z' }, // uge 2026-W02
    { weight: 85, reps_completed: 3, logged_at: '2026-01-07T10:00:00Z' }, // samme uge, tungere
    { weight: 90, reps_completed: 2, logged_at: '2026-01-13T10:00:00Z' }, // uge 2026-W03
  ]
  const uger = heaviestSetPerWeek(logs)
  assert.equal(uger.length, 2)
  assert.equal(uger[0].weight, 85)
  assert.equal(uger[0].reps, 3)
  assert.equal(uger[1].weight, 90)
  assert.ok(uger[0].uge < uger[1].uge, 'ældste uge skal stå først')
})

test('heaviestSetPerWeek: ved lige vægt vinder flest reps', () => {
  const logs = [
    { weight: 100, reps_completed: 3, logged_at: '2026-02-02T10:00:00Z' },
    { weight: 100, reps_completed: 5, logged_at: '2026-02-03T10:00:00Z' },
  ]
  const uger = heaviestSetPerWeek(logs)
  assert.equal(uger.length, 1)
  assert.equal(uger[0].reps, 5)
})

test('heaviestSetPerWeek beregner e1rm med samme Epley-formel', () => {
  const uger = heaviestSetPerWeek([{ weight: 100, reps_completed: 5, logged_at: '2026-03-02T10:00:00Z' }])
  assert.equal(uger[0].e1rm, Math.round(estimatedOneRepMax(100, 5)))
})

test('heaviestSetPerWeek ignorerer sæt uden vægt (skulle allerede være filtreret, men skal ikke kunne kaste)', () => {
  assert.deepEqual(heaviestSetPerWeek([{ weight: 0, reps_completed: 5, logged_at: '2026-03-02T10:00:00Z' }]), [])
  assert.deepEqual(heaviestSetPerWeek([]), [])
  assert.deepEqual(heaviestSetPerWeek(undefined), [])
})
