import test from 'node:test'
import assert from 'node:assert/strict'
import { planLift, validateResult } from './meetModel.mjs'

test('three strategies use rounded-down 2.5 kg attempts', () => {
  for (const [strategy, expected] of Object.entries({ conservative: [172.5, 187.5, 195], normal: [180, 192.5, 200], aggressive: [182.5, 200, 205] })) {
    const plan = planLift({ e1RM: 200 }, strategy)
    assert.deepEqual(plan.attempts, expected)
    assert.ok(plan.attempts.every(kg => Number.isInteger(kg / 2.5)))
    assert.match(plan.basis, /ingen nylige/)
  }
})
test('recent latest three singles cap e1RM without mutation and reject stale or future evidence', () => {
  const singles = Object.freeze([
    { kg: 300, date: '2026-09-01' }, { kg: 250, date: '2026-11-05' },
    { kg: 180, date: '2026-11-03' }, { kg: 175, date: '2026-11-02' },
    { kg: 170, date: '2026-09-23' }, { kg: 200, date: '2026-09-24' },
  ].map(Object.freeze))
  const plan = planLift(Object.freeze({ e1RM: 220, heavySingles: singles }), 'normal', '2026-11-04')
  assert.equal(plan.recentCount, 3)
  assert.equal(plan.reference, 200 / 0.95)
  assert.equal(plan.attempts[0], 187.5)
  const capped = planLift({ e1RM: 220, heavySingles: [{ kg: 180, date: '2026-11-03' }] }, 'normal', '2026-11-04')
  assert.equal(capped.reference, 180 / 0.95)
  assert.equal(planLift({ heavySingles: singles }, 'normal', '2026-11-04').reference, 200)
  assert.equal(planLift({ heavySingles: [{ kg: 200, date: '2026-09-22' }] }, 'normal', '2026-11-04').status, 'empty')
})
test('only newest three eligible singles influence proposals, date boundary is inclusive', () => {
  const heavySingles = [1, 2, 3, 4].map((d, i) => ({ kg: i === 0 ? 300 : 150, date: `2026-11-0${d}` }))
  assert.equal(planLift({ heavySingles }, 'normal', '2026-11-04').reference, 150)
  assert.equal(planLift({ heavySingles: [{ kg: 150, date: '2026-09-23' }] }, 'normal', '2026-11-04').status, 'ready')
})
test('warmup progresses below opener with times, including previous-day midnight', () => {
  const plan = planLift({ e1RM: 200, openerTime: '10:00' })
  assert.deepEqual(plan.warmup.map(s => [s.kg, s.reps, s.time]), [[70, 5, '09:25'], [107.5, 3, '09:35'], [135, 2, '09:45'], [155, 1, '09:53']])
  assert.ok(plan.warmup.every(s => s.kg < plan.attempts[0]))
  assert.equal(planLift({ e1RM: 200, openerTime: '00:10' }).warmup[0].time, '23:35')
  assert.equal(planLift({ e1RM: 200, openerTime: '00:10' }).warmup[0].previousDay, true)
  assert.equal(planLift({ e1RM: 200 }).warmup[0].time, null)
  assert.deepEqual(planLift({ e1RM: 2.5 }).warmup, [])
})
test('empty and invalid data never become invented proposals', () => {
  for (const input of [null, undefined, {}, { heavySingles: [] }]) assert.equal(planLift(input).status, 'empty')
  for (const input of [[], '200', { e1RM: NaN }, { e1RM: Infinity }, { e1RM: true }, { e1RM: 0 }, { e1RM: '200' }, { e1RM: 2001 }, { heavySingles: {} }, { heavySingles: [null] }, { heavySingles: [{ kg: 100, date: '2026-02-30' }] }, { e1RM: 200, openerTime: '24:00' }])
    assert.equal(planLift(input, 'normal', '2026-11-04').status, 'error', JSON.stringify(input))
  assert.equal(planLift({ e1RM: 200 }, '__proto__').status, 'error')
  assert.equal(planLift({ heavySingles: [{ kg: 100, date: '2026-11-01' }] }).status, 'error')
})
test('actual results distinguish blanks, pending, success, failure and invalid increments', () => {
  for (const value of [null, {}, { kg: '', status: 'pending' }]) assert.equal(validateResult(value).status, 'empty')
  for (const status of ['good', 'miss', 'pending']) assert.deepEqual(validateResult({ kg: '152,5', status }), { status: 'valid', kg: 152.5, outcome: status })
  for (const value of [[], false, { kg: '', status: 'good' }, { kg: 151 }, { kg: 0 }, { kg: true }, { kg: Infinity }, { kg: ' ' }, { kg: '1e2' }, { kg: 150, status: 'approved' }]) assert.equal(validateResult(value).status, 'error')
})
test('proposals remain valid results at both supported weight boundaries', () => {
  for (const e1RM of [2.5, 10, 1999, 2000]) for (const strategy of ['conservative', 'normal', 'aggressive'])
    for (const kg of planLift({ e1RM }, strategy).attempts) assert.equal(validateResult({ kg }).status, 'valid')
})
