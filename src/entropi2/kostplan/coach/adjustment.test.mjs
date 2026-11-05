import test from 'node:test'
import assert from 'node:assert/strict'
import { portalAdjustment, choosePortalAdjustment } from './adjustment.mjs'
import { adjustmentFixture, on, ago } from './adjustment.fixture.mjs'
import { freeze } from '../justering/fixture.mjs'
import { isDayReceipt } from '../../../mealEvidence.mjs'

const proposal = f => portalAdjustment(f)?.snapshot

test('actual adjustment calculation uses only confirmed days and respects limits without changing the input', () => {
  const f = freeze(adjustmentFixture()), before = structuredClone(f)
  const p = proposal(f)
  assert.equal(p.phase, 'ready'); assert.equal(p.deltaKcal, -140); assert.equal(p.proposedKcal, 2660)
  assert.equal(p.evidence.trend.count, 28); assert.equal(p.evidence.diet.completeDays, 27)
  assert.equal(p.evidence.diet.meanKcal, 2800); assert.deepEqual(p.evidence.readiness, { energy: 3, hunger: 3 })
  assert.deepEqual(f, before)
})

test('strict OFF never reads a receipt, identities or dates', () => {
  for (const enabled of [false, undefined, null, 1, 'true']) assert.equal(portalAdjustment({ enabled,
    get receipt() { throw Error('OFF'); }, get coachId() { throw Error('OFF'); } }), null)
})

test('missing production capabilities, partial, stale, foreign and malformed data stay invisible', () => {
  const cases = [
    f => { f.receipt = undefined }, f => { delete f.receipt.adjustmentBasis },
    f => { f.receipt.from = ago(6) }, f => { f.receipt.from = ago(28) },
    f => { f.receipt.from = '2026-02-30' }, f => { f.date = '2026-02-30' },
    f => { f.receipt.complete = false }, f => { f.receipt.state = 'partial' }, f => { f.receipt.state = 'error' },
    f => { f.receipt.state = 'loading' }, f => { f.coachId = 'foreign' }, f => { f.athleteId = 'foreign' },
    f => { f.date = ago(1) }, f => { f.receipt.through = ago(1) },
    f => { f.receipt.adjustmentBasis.plan.coachId = 'foreign' }, f => { f.receipt.adjustmentBasis.plan.athleteId = 'foreign' },
    f => { f.receipt.adjustmentBasis.plan.status = 'draft' }, f => { delete f.receipt.adjustmentBasis.plan.version },
    f => { f.receipt.adjustmentBasis.adult = false }, f => { delete f.receipt.adjustmentBasis.training },
    f => { f.receipt.adjustmentBasis.goal = 'invalid' }, f => { f.receipt.adjustmentBasis.readiness = {} },
    f => { f.receipt.weightLogs[0].athlete_id = 'foreign' }, f => { f.receipt.mealLogs[0].athlete_id = 'foreign' },
    f => { f.receipt.mealLogs.push(f.receipt.mealLogs[0]) }, f => { f.receipt.weightLogs.push(f.receipt.weightLogs[0]) },
    f => { f.receipt.mealLogs[0].date = ago(28) }, f => { f.receipt.mealLogs[0].meal = '' },
    f => { f.receipt.weightLogs = null }, f => { f.receipt.mealLogs = null },
  ]
  cases.forEach((change, index) => { const f = adjustmentFixture(); change(f); assert.equal(proposal(f), undefined, `case ${index}`) })
})

test('logged meals, read completeness or edited confirmations never stand in for complete diet days', () => {
  for (const change of [
    f => { f.receipt.mealLogs = f.receipt.mealLogs.filter(r => !isDayReceipt(r)) },
    f => { f.receipt.mealLogs.filter(r => !isDayReceipt(r)).forEach(r => { r.kcal++ }) },
    f => { f.receipt.mealLogs.filter(r => !isDayReceipt(r)).forEach(r => { r.protein++ }) },
    f => { f.receipt.mealLogs.filter(r => !isDayReceipt(r)).forEach(r => { r.id += '-edited' }) },
  ]) { const f = adjustmentFixture(); change(f); assert.equal(portalAdjustment(f), null) }
})

test('coverage edges are owned by the calculation: 20/28 passes, 19/28 fails; 10 weights with 5 at each end', () => {
  const f = adjustmentFixture()
  f.receipt.mealLogs = f.receipt.mealLogs.filter(r => r.date >= ago(20))
  assert.equal(proposal(f).evidence.diet.completeDays, 20)
  f.receipt.mealLogs = f.receipt.mealLogs.filter(r => r.date >= ago(19))
  assert.equal(portalAdjustment(f), null)
  const g = adjustmentFixture()
  g.receipt.weightLogs = g.receipt.weightLogs.filter((_, i) => i < 5 || i >= 23)
  assert.equal(proposal(g).evidence.trend.count, 10)
  g.receipt.weightLogs.pop(); assert.equal(portalAdjustment(g), null)
  const h = adjustmentFixture()
  h.receipt.weightLogs = h.receipt.weightLogs.filter(r => r.logged_at.slice(0, 10) >= ago(12))
  assert.equal(portalAdjustment(h), null)
})

test('duplicate weighing days are excluded and Copenhagen dates use the existing weight parser', () => {
  const f = adjustmentFixture()
  f.receipt.weightLogs.push({ ...f.receipt.weightLogs.at(-1), id: 'synthetic-duplicate-day', weight: 350 })
  assert.equal(proposal(f).evidence.trend.count, 27)
  assert.equal(portalAdjustment(f).nutrition.weightKg, 80)
  f.receipt.weightLogs.at(-1).logged_at = '2026-11-04wrong'
  assert.equal(proposal(f).evidence.trend.count, 28)
  assert.equal(portalAdjustment(f).nutrition.weightKg, 80)
  const g = adjustmentFixture()
  g.receipt.weightLogs[0].logged_at = ago(28) + 'T23:30:00Z'
  assert.equal(proposal(g).evidence.trend.count, 28)
})

test('recovery, high load, competition, floors, no needed change and cooldown never present an actionable card', () => {
  for (const change of [
    b => { b.readiness.energy = 2 }, b => { b.readiness.hunger = 4 },
    b => { b.training.volume = 'high' }, b => { b.training.intensity = 'high' },
    b => { b.plan.lastAdjustedOn = ago(6) }, b => { b.plan.lastReviewedOn = ago(6) },
    b => { b.plan.evaluatedThrough = on }, b => { b.competition = { date: on, weightClassKg: 75 } },
    b => { b.plan.kcal = 1600 }, b => { b.goal = 'maintain' },
  ]) { const f = adjustmentFixture(); change(f.receipt.adjustmentBasis); assert.equal(portalAdjustment(f), null) }
  const f = adjustmentFixture(); delete f.receipt.adjustmentBasis.readiness
  assert.equal(proposal(f).evidence.readiness, null)
})

test('explicit accept/reject revalidates evidence and returns a candidate only; stale decisions fail', () => {
  for (const decision of ['accept', 'reject']) {
    const f = freeze(adjustmentFixture()), before = structuredClone(f), p = proposal(f)
    const result = choosePortalAdjustment(f, p, decision)
    assert.equal(result.record.decision, decision)
    assert.equal(result.plan.kcal, decision === 'accept' ? 2660 : 2800)
    assert.equal(result.plan.version, 2); assert.deepEqual(f, before)
  }
  for (const change of [
    f => { f.receipt.adjustmentBasis.plan.version++ },
    f => { f.receipt.mealLogs[0].kcal++ },
    f => { f.receipt.weightLogs[0].weight = 81 },
    f => { f.receipt.coachId = 'foreign' }, f => { f.receipt.complete = false },
  ]) { const f = adjustmentFixture(), p = proposal(f); change(f); assert.throws(() => choosePortalAdjustment(f, p, 'accept'), TypeError) }
})
