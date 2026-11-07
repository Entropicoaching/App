import test from 'node:test'
import assert from 'node:assert/strict'
import { createAthleteDay } from './dayModel.mjs'
import { createNutritionController } from '../../nutrition/controller.mjs'
import { remainingToday, startAdvice } from '../../nutrition/startModel.mjs'

const athleteId = 'zero-content-athlete', date = '2026-11-07'
function channel(targets) {
  const owner = Object.freeze({})
  return { owner, athleteId, date, snapshot: () => ({ owner, athleteId, date, source: 'approved-plan', state: 'ready',
    planId: 'zero-plan', revision: 'zero-version', targets }) }
}

test('known zero: exact 137 kcal / 0 protein channel stays separate from profile and actual intake', () => {
  const tracker = createNutritionController({ enabled: true, athlete: { id: athleteId, kcal_target: 2701, protein_target: 171 }, date,
    contracts: { dayTargets: channel({ kcal: 137, protein: 0 }) } })
  try {
    const s = tracker.snapshot()
    assert.deepEqual(s.targets, { kcal: 137, protein: 0 })
    assert.deepEqual(s.profileTargets, { kcal: 2701, protein: 171 })
    assert.deepEqual(s.totals, { kcal: 0, protein: 0, carb: 0, fat: 0 })
    assert.deepEqual(remainingToday(s.totals, s.targets), { kcal: 137, protein: null })
    assert.equal(startAdvice(s.targets).protein, null)
  } finally { tracker.dispose() }
})

test('known zero: approved content accepts 0 and decimal zero; absent, blank, invalid and negative remain unknown', async () => {
  for (const [value, expected] of [[0, 0], ['0,0', 0], [undefined, null], [null, null], ['', null], ['  ', null], [NaN, null], [Infinity, null], [-1, null], ['unknown', null], [false, null]]) {
    const tracker = createNutritionController({ enabled: true, athlete: { id: athleteId, protein_target: 171 }, date,
      contracts: { dayTargets: channel({ kcal: 137, protein: value }) } })
    const day = createAthleteDay({ enabled: true, athleteId, date, loadDay: async () => ({
      plan: { id: 'zero-plan', revision: 'zero-version', athlete_id: athleteId, date, active: true,
        meals: [], targets: { kcal: 137, protein: value, carb: value, fat: value } }, logs: [], eaten: [],
    }) })
    try {
      assert.equal(tracker.snapshot().targets.protein, expected)
      assert.equal(await day.load(), true)
      assert.deepEqual(day.snapshot().targets, { kcal: 137, protein: expected, carb: expected, fat: expected })
      assert.deepEqual(day.snapshot().remaining, { kcal: 137, protein: null, carb: null, fat: null })
    } finally { tracker.dispose(); day.dispose() }
  }
})
