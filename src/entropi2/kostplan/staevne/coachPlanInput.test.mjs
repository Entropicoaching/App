import test from 'node:test'
import assert from 'node:assert/strict'
import { competitionBasis, competitionInput, emptyPlanDraft, localPlanDay, planKg } from './coachPlanInput.mjs'
import { buildCompetitionPlan } from './model.mjs'

const athlete = extra => ({ competition_date: '2026-11-30', weight_class: 78, ...extra })

test('production basis is strict OFF and only uses real date and weight class fields', () => {
  for (const enabled of [undefined, false, 'true', 1]) {
    assert.equal(competitionBasis({ enabled, get athlete() { assert.fail('OFF read') } }), null)
  }
  assert.deepEqual(competitionBasis({ enabled: true, athlete: { ...athlete(),
    get bodyweight() { assert.fail('undated weight read') }, get target_weight() { assert.fail('goal read') },
  } }), { competitionDate: '2026-11-30', weightClassKg: 78 })
  assert.equal(competitionBasis({ enabled: true, athlete: { competition_date: '2026-11-30', target_weight: 78 } }), null)
})

test('missing or malformed production fields hide the integration', () => {
  for (const competition_date of [undefined, null, '', '2026-02-29', '2026-11-31', '2026-11-30T12:00:00Z', '1899-12-31', '9999-12-31'])
    assert.equal(competitionBasis({ enabled: true, athlete: athlete({ competition_date }) }), null)
  for (const weight_class of [undefined, null, '', 0, -78, 24.99, 350.01, Infinity, true, '78 kg', '78+', '0x50', [], {}])
    assert.equal(competitionBasis({ enabled: true, athlete: athlete({ weight_class }) }), null)
  assert.equal(competitionBasis({ enabled: true }), null)
  assert.equal(competitionBasis({ enabled: true, athlete: athlete({ competition_date: '2028-02-29', weight_class: '78,5' }) }).weightClassKg, 78.5)
})

test('weight parsing accepts decimal input without fabricating zero or accepting units', () => {
  for (const value of [25, 350, ' 80,25 ', '80.25']) assert.ok(planKg(value) >= 25)
  for (const value of ['', ' ', null, undefined, false, NaN, Infinity, '80kg', '8e1', '80,2.5']) assert.equal(planKg(value), null)
})

test('temporary evidence has no defaults or implicit confirmations', () => {
  const basis = competitionBasis({ enabled: true, athlete: athlete() })
  const draft = emptyPlanDraft()
  assert.deepEqual(draft, { weightKg: '', weighInHours: '', adult: false, healthReviewed: false })
  assert.deepEqual(competitionInput(basis, draft, '2026-11-01'), { ...basis, asOf: '2026-11-01',
    weightKg: null, weighInHours: null, adult: false, healthReviewed: false })
  assert.equal(competitionInput(basis, { ...draft, adult: 'true', healthReviewed: 1 }, '2026-11-01').adult, false)
  assert.equal(competitionInput(basis, { ...draft, weighInHours: 2 }, '2026-11-01').weighInHours, null)
  assert.deepEqual(emptyPlanDraft(), draft)
  assert.notEqual(emptyPlanDraft(), draft)
})

test('actual model keeps adult, health, past-date and 2h/24h safety gates through the adapter', () => {
  const basis = competitionBasis({ enabled: true, athlete: athlete() })
  const draft = { weightKg: '80', weighInHours: '24', adult: true, healthReviewed: true }
  const model = (changes = {}, asOf = '2026-11-01', b = basis) => buildCompetitionPlan({ enabled: true,
    input: competitionInput(b, { ...draft, ...changes }, asOf) })
  assert.equal(model().phase, 'draft')
  for (const changes of [{ adult: false }, { healthReviewed: false }]) assert.equal(model(changes).weeks.length, 0)
  assert.equal(model({}, '2026-11-29').weeks.length, 0)
  const shortfall = model({ weightKg: '90', weighInHours: '2' })
  assert.equal(shortfall.phase, 'review')
  assert.equal(shortfall.acute.assessmentLimitKg, 0)
  assert.equal(shortfall.acute.prescribedWaterLossKg, 0)
  assert.equal(model({ weightKg: '90' }).acute.prescribedWaterLossKg, 0)
  assert.equal(model({ weightKg: '78' }).weeklyLossPct, 0)
})

test('local date uses calendar fields on both sides of a UTC midnight', () => {
  const date = { getFullYear: () => 2027, getMonth: () => 0, getDate: () => 1,
    toISOString() { assert.fail('UTC date used') } }
  assert.equal(localPlanDay(date), '2027-01-01')
  assert.equal(localPlanDay(new Date(2026, 10, 5, 23, 55)), '2026-11-05')
})
