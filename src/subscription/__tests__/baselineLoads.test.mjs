import test from 'node:test'
import assert from 'node:assert/strict'

import { adaptiveBaselineFromPerformance, adaptiveWeekOneStartingLoad, applyBaselineLoadsToProgram, baselineWeekOnePreview, emptyBaselineLoads, estimatedOneRepMaxFromPerformance, targetRpeWithCap, validateBaselineLoads, weekOneStartingLoadFromOneRepMax } from '../baselineLoads.js'

const program = {
  sessions: [{
    id: 'a',
    movements: [
      { role: 'squat-pattern', roleClass: 'main', exerciseName: 'Low-bar squat' },
      { role: 'bench-pattern', roleClass: 'main', exerciseName: 'Bænkpres' },
      { role: 'hinge-pattern', roleClass: 'main', exerciseName: 'Sumo dødløft' },
      { role: 'pull', roleClass: 'assistance', exerciseName: 'Chest-supported row' },
    ],
  }],
}

test('tomme eller uklare baseline-input fejler synligt og udfylder intet', () => {
  const result = validateBaselineLoads(emptyBaselineLoads())
  assert.equal(result.ok, false)
  assert.equal(result.values.squat, null)
  assert.ok(result.errors.deadlift)
})

test('et estimeret 1RM bliver til en konservativ uge-1-startvægt, aldrig den samme sætvægt', () => {
  const result = applyBaselineLoadsToProgram(program, { squat: 120, bench: 80, deadlift: 160 })
  const movements = result.program.sessions[0].movements
  assert.equal(result.validation.ok, true)
  assert.equal(movements[0].startingLoadKg, 82.5)
  assert.equal(movements[1].startingLoadKg, 52.5)
  assert.equal(movements[2].startingLoadKg, 107.5)
  assert.equal(movements[0].estimatedOneRepMaxKg, 120)
  assert.equal('startingLoadKg' in movements[3], false)
  assert.equal('startingLoadKg' in program.sessions[0].movements[0], false)
})

test('uge-1-startvægt er gennemsigtig og afrundes ned til en mulig stangvægt', () => {
  assert.equal(weekOneStartingLoadFromOneRepMax('squat', 200), 145)
  assert.equal(weekOneStartingLoadFromOneRepMax('bench', 200), 135)
  assert.equal(weekOneStartingLoadFromOneRepMax('deadlift', 201), 140)
})

test('et tungt flerrepssæt kan blive til et konservativt e1RM-grundlag', () => {
  assert.equal(estimatedOneRepMaxFromPerformance({ weightKg: 200, reps: 4, rpe: 10 }), 220)
  assert.equal(estimatedOneRepMaxFromPerformance({ weightKg: 200, reps: 4, rpe: 8 }), 233.33)
})

test('0, negative og urealistiske tal godkendes ikke som estimeret 1RM', () => {
  const result = validateBaselineLoads({ squat: 0, bench: -1, deadlift: 501 })
  assert.equal(result.ok, false)
  assert.deepEqual(result.values, { squat: null, bench: null, deadlift: null })
})

test('adaptiv baseline bruger en konservativ nedre grænse frem for at tage et e1RM som sandhed', () => {
  const high = adaptiveBaselineFromPerformance({ weightKg: 200, reps: 4, rpe: 9 })
  const low = adaptiveBaselineFromPerformance({ weightKg: 160, reps: 10, rpe: 6 })
  assert.equal(high.confidence, 'high')
  assert.equal(high.conservativeOneRepMaxKg, 221)
  assert.equal(high.minimumComparableExposures, 2)
  assert.equal(low.confidence, 'low')
  assert.ok(low.conservativeOneRepMaxKg < low.estimatedOneRepMaxKg)
  assert.equal(low.minimumComparableExposures, 3)
  assert.deepEqual(low.automaticChangesForbidden, ['set-count', 'exercise-selection', 'frequency'])
})

test('lav sikkerhed sænker kun introduktionsbelastning og RPE-loft, ikke programvolumen', () => {
  const high = adaptiveWeekOneStartingLoad('squat', { weightKg: 200, reps: 4, rpe: 9 }, { weekOnePercentOfEstimated1RM: 0.75 })
  const low = adaptiveWeekOneStartingLoad('squat', { weightKg: 160, reps: 10, rpe: 6 }, { weekOnePercentOfEstimated1RM: 0.75 })
  assert.equal(high.startingPercentage, 75)
  assert.equal(high.introRpeCap, 7)
  assert.equal(low.startingPercentage, 72.5)
  assert.equal(low.introRpeCap, 6)
  assert.ok(low.startingLoadKg < low.conservativeOneRepMaxKg * 0.75)
})

test('preview og anvendt uge-1-program bruger præcis samme adaptive belastning', () => {
  const performance = { weightKg: 200, reps: 4, rpe: 9 }
  const prescription = { sets: 3, reps: '4–6', targetRpe: '6–7', weekOnePercentOfEstimated1RM: 0.75, loadIncrementKg: 2.5 }
  const preview = baselineWeekOnePreview('squat', performance, prescription)
  const withPrescription = {
    sessions: [{ id: 'a', movements: [{ role: 'squat-pattern', roleClass: 'main', exerciseName: 'Low-bar squat', prescription }] }],
  }
  const applied = applyBaselineLoadsToProgram(withPrescription, {
    squat: performance,
    bench: { weightKg: 100, reps: 1, rpe: 10 },
    deadlift: { weightKg: 220, reps: 1, rpe: 10 },
  }).program.sessions[0].movements[0]
  assert.equal(preview.startingLoadKg, 165)
  assert.equal(applied.startingLoadKg, preview.startingLoadKg)
  assert.equal(applied.baselineGuidance.conservativeOneRepMaxKg, preview.conservativeOneRepMaxKg)
})

test('lav baseline-sikkerhed bliver til et effektivt uge-1-RPE-loft i programmet', () => {
  assert.equal(targetRpeWithCap('6–7', 6), '6')
  const prescription = { sets: 3, reps: '5–7', targetRpe: '6–7', weekOnePercentOfEstimated1RM: 0.725, loadIncrementKg: 1 }
  const withPrescription = {
    sessions: [{ id: 'a', movements: [{ role: 'squat-pattern', roleClass: 'main', exerciseName: 'Goblet squat', prescription }] }],
  }
  const applied = applyBaselineLoadsToProgram(withPrescription, {
    squat: { weightKg: 40, reps: 10, rpe: 6 },
    bench: { weightKg: 30, reps: 10, rpe: 6 },
    deadlift: { weightKg: 60, reps: 10, rpe: 6 },
  }).program.sessions[0].movements[0]
  assert.equal(applied.baselineGuidance.introRpeCap, 6)
  assert.equal(applied.prescription.baseTargetRpe, '6–7')
  assert.equal(applied.prescription.targetRpe, '6')
  assert.equal(applied.startingLoadKg % 1, 0)
})
