import test from 'node:test'
import assert from 'node:assert/strict'
import { suggestNextWeekLoad as suggest } from './nextWeekLoad.mjs'

const week = (weight = 100, rpe = 7, reps = 8) => ({
  weight, plannedSets: 3, targetReps: 8,
  sets: Array.from({ length: 3 }, () => ({ weight, reps, rpe })),
})

test('completed low-effort week suggests 2.5% with Danish reason', () => {
  assert.deepEqual(suggest(week()), {
    weight: 102.5, changePercent: 2.5, action: 'increase', reasonCode: 'low_rpe',
    reason: 'Foreslå op til 2,5 % højere vægt: alle sæt nåede repsmålet med RPE højst 7.',
  })
})

test('rounds increase down to equipment increment; never forces a step', () => {
  assert.equal(suggest(week(110)).weight, 112.5)
  assert.equal(suggest(week(20)).reasonCode, 'step_too_large')
  assert.equal(suggest(week(20), { incrementKg: 0.5 }).weight, 20.5)
  assert.equal(suggest(week(20), { incrementKg: 2 }).weight, 20)
})

test('worst set controls effort; moderate RPE holds and RPE >=9 reduces', () => {
  for (const rpe of [7.01, 8, 8.99]) assert.equal(suggest(week(100, rpe)).action, 'hold')
  for (const rpe of [9, 9.5, 10]) {
    const input = week(); input.sets[1].rpe = rpe
    assert.equal(suggest(input).weight, 95)
    assert.equal(suggest(input).reasonCode, 'high_rpe')
  }
  assert.equal(suggest(week(101, 9)).weight, 97.5)
  assert.equal(suggest(week(20, 9)).reasonCode, 'step_too_large')
})

test('unmet reps hold unless high effort supports conservative reduction', () => {
  const input = week(); input.sets[2].reps = 7
  assert.equal(suggest(input).reasonCode, 'reps_not_met')
  input.sets[2].rpe = 9
  assert.equal(suggest(input).weight, 95)
  assert.equal(suggest(week(100, 7, 10)).action, 'increase')
})

test('missing, extra and sparse sets cannot suggest progression', () => {
  for (const sets of [[], week().sets.slice(0, 2), [...week().sets, week().sets[0]], new Array(3), null]) {
    assert.equal(suggest({ ...week(), sets }).action, 'hold')
  }
  const input = week(); input.plannedSets = 1; input.sets.length = 1
  assert.equal(suggest(input).reasonCode, 'maintain')
})

test('missing/invalid plan keeps reference weight', () => {
  for (const key of ['plannedSets', 'targetReps']) {
    for (const value of [undefined, null, '', '3', 0, -1, 1.5, NaN, Infinity]) {
      assert.equal(suggest({ ...week(), [key]: value }).reasonCode, 'incomplete_week')
    }
  }
})

test('invalid set values never silently coerce or omit a set', () => {
  for (const key of ['weight', 'reps', 'rpe']) {
    const bad = [undefined, null, '', '7', NaN, Infinity, -1, {}, false]
    if (key === 'rpe') bad.push(10.01)
    if (key === 'reps') bad.push(0, 1.2)
    if (key === 'weight') bad.push(100.001)
    for (const value of bad) {
      const input = week(); input.sets[0][key] = value
      assert.equal(suggest(input).reasonCode, 'invalid_set', `${key}: ${String(value)}`)
    }
  }
  for (const value of [null, undefined, 1]) {
    const input = week(); input.sets[0] = value
    assert.equal(suggest(input).reasonCode, 'invalid_set')
  }
  assert.equal(suggest(week(100, 0)).action, 'increase')
})

test('mixed loads require review, even when the hardest set is high effort', () => {
  const input = week(); input.sets[1].weight = 90
  assert.equal(suggest(input).reasonCode, 'mixed_loads')
  input.sets[1].rpe = 10
  assert.equal(suggest(input).weight, 100)
})

test('invalid reference weight has no suggestion; zero stays zero', () => {
  for (const value of [undefined, null, '', '100', false, -1, NaN, Infinity, 100.001, 1e20]) {
    const result = suggest({ ...week(), weight: value })
    assert.equal(result.weight, null)
    assert.equal(result.action, 'unavailable')
    assert.equal(result.changePercent, 0)
  }
  assert.equal(suggest().weight, null)
  assert.equal(suggest(null).weight, null)
  assert.equal(suggest(week(0)).weight, 0)
})

test('invalid equipment increment holds safely', () => {
  for (const incrementKg of [null, 0, -1, NaN, Infinity, '2.5', 0.001, 1e20]) {
    assert.equal(suggest(week(), { incrementKg }).reasonCode, 'invalid_increment')
  }
})

test('deterministic and does not mutate frozen input or share returned objects', () => {
  const input = week()
  input.sets.forEach(Object.freeze); Object.freeze(input.sets); Object.freeze(input)
  const options = Object.freeze({ incrementKg: 0.5 })
  const first = suggest(input, options), second = suggest(input, options)
  assert.deepEqual(first, second); assert.notEqual(first, second)
  first.weight = 1
  assert.equal(suggest(input, options).weight, 102.5)
})

test('numeric sweep: every suggestion respects the 5% ceiling and step grid', () => {
  for (const weight of [0.01, 0.1, 0.29, 1, 9.99, 20, 39.99, 50, 99.99, 100, 123.45, 9999999999.99, 1e10]) {
    for (const incrementKg of [0.01, 0.1, 0.5, 1, 1.25, 2.5, 5, 100]) {
      for (const rpe of [0, 7, 7.5, 8.5, 9, 10]) {
        const result = suggest(week(weight, rpe), { incrementKg })
        const base = BigInt(Math.round(weight * 100)), next = BigInt(Math.round(result.weight * 100))
        assert.ok(next * 100n <= base * 105n)
        assert.ok(next * 100n >= base * 95n)
        if (result.action === 'increase') assert.ok(next * 1000n <= base * 1025n)
        if (result.action !== 'hold') assert.equal(next % BigInt(Math.round(incrementKg * 100)), 0n)
        assert.ok(Number.isFinite(result.changePercent))
        assert.ok(result.reason.length > 0)
      }
    }
  }
})
