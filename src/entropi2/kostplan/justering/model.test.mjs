import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateNutrition } from '../beregning.mjs'
import { evaluateAdjustment, decideAdjustment } from './model.mjs'
import { on, ago, plan, nutrition, actor, setup, freeze } from './fixture.mjs'

const decide = (proposal, input, patch = {}) => decideAdjustment(proposal,
  { plan: input.plan, nutrition: input.nutrition, actor, decision: 'accept', on, ...patch })

test('strict OFF does not read any plan or nutrition, and empty is honest', () => {
  const poison = new Proxy({}, { get() { throw Error('OFF read') } })
  for (const enabled of [undefined, false, null, 0, 1, 'true']) {
    assert.deepEqual(evaluateAdjustment({ enabled, get plan() { throw Error('OFF plan') }, nutrition: poison }), { phase: 'off' })
  }
  assert.equal(evaluateAdjustment({ enabled: true, plan: null, nutrition: poison }).phase, 'empty')
})

test('uses actual calculation, explicit evidence and bounded energy change without mutating inputs', () => {
  const input = freeze(setup()), proposal = evaluateAdjustment(input)
  const calculation = calculateNutrition({ ...input.nutrition, currentPlan: input.plan })
  assert.equal(proposal.phase, 'ready'); assert.equal(proposal.deltaKcal, -140)
  assert.equal(proposal.proposedKcal, 2660)
  assert.equal(proposal.deltaKcal, calculation.weekly.deltaKcal)
  assert.equal(proposal.policyVersion, calculation.policyVersion)
  assert.deepEqual(proposal.evidence.diet, calculation.evidence.diet)
  assert.equal(proposal.evidence.trend.count, 28); assert.equal(proposal.evidence.targetWeeklyPct, -0.5)
  assert.equal(proposal.evidence.observedWeeklyPct, 0)
  assert.equal(proposal.evidence.trainingKnown, true)
  assert.equal(proposal.nextEligibleOn, '2026-11-11')
  assert.equal(proposal.requiresCoachActivation, true)
  proposal.evidence.diet.dates.pop(); proposal.plan.kcal = 99
  assert.equal(input.plan.kcal, 2800); assert.equal(evaluateAdjustment(input).evidence.diet.completeDays, 28)
})

test('cut, maintain and bulk use desired trend in both directions; tolerance holds', () => {
  for (const goal of ['cut', 'maintain', 'bulk']) {
    for (const [kg, sign] of [[-1, 1], [1, -1]]) {
      const proposal = evaluateAdjustment({ enabled: true, plan: plan(), nutrition: nutrition({ goal }, kg) })
      assert.equal(Math.sign(proposal.deltaKcal), sign)
    }
  }
  for (const kg of [0, 0.08, -0.08]) {
    assert.equal(evaluateAdjustment({ enabled: true, plan: plan(), nutrition: nutrition({ goal: 'maintain' }, kg) }).phase, 'hold')
  }
})

test('missing training never becomes rest evidence; high load prevents reductions but permits fuel increases', () => {
  const unknown = evaluateAdjustment(setup({}, { training: undefined }))
  assert.equal(unknown.phase, 'hold'); assert.equal(unknown.evidence.trainingKnown, false)
  for (const training of [{ volume: 'high', intensity: 'light' }, { volume: 'moderate', intensity: 'high' }]) {
    const down = evaluateAdjustment(setup({}, { training }))
    assert.equal(down.phase, 'hold'); assert.match(down.reason, /Høj træningsbelastning/)
    const up = evaluateAdjustment(setup({}, { training, goal: 'bulk' }))
    assert.equal(up.phase, 'ready'); assert.ok(up.deltaKcal > 0)
  }
})

test('missing, sparse, incomplete, duplicate, stale and future evidence never invents a usable week', () => {
  for (const patch of [{ weights: [] }, { dietDays: [] }, { weights: nutrition().weights.slice(0, 8) },
    { dietDays: nutrition().dietDays.map(d => ({ ...d, complete: false })) },
    { weights: nutrition().weights.flatMap(d => [d, { ...d }]) },
    { weights: [{ date: ago(40), kg: 80 }, { date: ago(-1), kg: 80 }] }]) {
    const result = evaluateAdjustment(setup({}, patch))
    assert.equal(result.phase, 'hold'); assert.equal(result.deltaKcal, 0)
    assert.throws(() => decide(result, setup({}, patch)), TypeError)
  }
  assert.equal(evaluateAdjustment(setup({}, { weights: [] })).evidence.trend.weeklyKg, null)
  assert.equal(evaluateAdjustment(setup({}, { dietDays: [] })).evidence.diet.meanKcal, null)
})

test('resting and training floors are enforced before cooldown and high-load holds', () => {
  for (const patch of [{ kcal: 1500 }, { kcal: 2000, lastReviewedOn: ago(1) }]) {
    const result = evaluateAdjustment(setup(patch, { training: { volume: 'high', intensity: 'high' } }))
    assert.equal(result.phase, 'review'); assert.equal(result.proposedKcal, null)
  }
  const result = evaluateAdjustment(setup({ kcal: 2100 }, { training: { volume: 'rest', intensity: 'light' } }))
  assert.equal(result.proposedKcal, 2000); assert.equal(result.deltaKcal, -100)
  const raised = evaluateAdjustment(setup({ kcal: 4100 }, { minKcal: 4000 }))
  assert.equal(raised.proposedKcal, 4000)
})

test('readiness, imminent competition, reused evidence and seven-day clock retain base safeguards', () => {
  for (const patch of [{ readiness: { energy: 2, hunger: 2 } },
    { competition: { date: ago(-7), weightClassKg: 79 } }]) {
    assert.equal(evaluateAdjustment(setup({}, patch)).phase, 'hold')
  }
  for (const patch of [{ lastAdjustedOn: ago(6) }, { evaluatedThrough: on }, { lastReviewedOn: ago(6) }]) {
    assert.equal(evaluateAdjustment(setup(patch)).phase, 'hold')
  }
  assert.equal(evaluateAdjustment(setup({ lastAdjustedOn: ago(7), lastReviewedOn: ago(7) })).phase, 'ready')
  const year = evaluateAdjustment(setup({ createdOn: '2026-12-28', lastReviewedOn: '2026-12-28' }, { date: '2027-01-02' }))
  assert.equal(year.phase, 'hold'); assert.equal(year.nextEligibleOn, '2027-01-04')
})

test('accept and reject return detached candidates/receipts; rejection consumes the weekly slot', () => {
  for (const decision of ['accept', 'reject']) {
    const input = freeze(setup()), proposal = freeze(evaluateAdjustment(input))
    const result = decide(proposal, input, { decision })
    assert.equal(result.plan.kcal, decision === 'accept' ? 2660 : 2800)
    assert.equal(result.plan.version, 2); assert.equal(result.plan.lastReviewedOn, on)
    assert.equal(result.plan.evaluatedThrough, on)
    assert.equal(result.plan.lastAdjustedOn, decision === 'accept' ? on : undefined)
    assert.equal(result.record.decision, decision); assert.equal(result.record.fromVersion, 1)
    assert.equal(result.snapshot.phase, decision === 'accept' ? 'accepted' : 'rejected')
    assert.equal(evaluateAdjustment({ ...input, plan: result.plan }).phase, 'hold')
    assert.equal(evaluateAdjustment({ ...input, plan: result.plan, nutrition: { ...input.nutrition, date: ago(-1) } }).phase, 'hold')
    assert.throws(() => decide(proposal, { ...input, plan: result.plan }), TypeError)
    result.record.evidence.trend.dates.pop()
    assert.equal(proposal.evidence.trend.dates.length, 28)
  }
})

test('stale plan/version/evidence and tampered proposal cannot be accepted or rejected', () => {
  const input = setup(), proposal = evaluateAdjustment(input)
  for (const patch of [{ version: 2 }, { kcal: 3000 }, { id: 'other' }, { athleteId: 'other' },
    { coachId: 'other' }, { status: 'archived' }, { lastReviewedOn: on }]) {
    for (const decision of ['accept', 'reject']) assert.throws(() => decide(proposal,
      { ...input, plan: { ...input.plan, ...patch } }, { decision }), TypeError)
  }
  assert.throws(() => decide({ ...proposal, proposedKcal: 100 }, input), TypeError)
  const changed = nutrition(); changed.dietDays[0].kcal = 3500
  assert.throws(() => decide(proposal, { ...input, nutrition: changed }), TypeError)
  assert.throws(() => decide(proposal, input, { on: ago(-1) }), TypeError)
  // Supplied nested currentPlan must not change the version actually reviewed.
  assert.deepEqual(evaluateAdjustment(setup({}, { currentPlan: { kcal: 100000 } })), proposal)
})

test('only the matching trusted coach and explicit choices are accepted; invalid bases fail loudly', () => {
  const input = setup(), proposal = evaluateAdjustment(input)
  for (const actor of [null, {}, { role: 'athlete', id: 'synthetic-coach' }, { role: 'coach', id: 'other' }]) {
    assert.throws(() => decide(proposal, input, { actor }), TypeError)
  }
  for (const decision of ['__proto__', 'accepted', null]) assert.throws(() => decide(proposal, input, { decision }), TypeError)
  for (const patch of [{ version: 0 }, { version: 1.5 }, { kcal: NaN }, { kcal: '2800' },
    { id: '' }, { status: 'draft' }, { createdOn: '2026-02-30' }, { lastReviewedOn: ago(-1) },
    { lastAdjustedOn: ago(29) }]) assert.throws(() => evaluateAdjustment(setup(patch)), TypeError)
  const max = setup({ version: Number.MAX_SAFE_INTEGER })
  assert.throws(() => decide(evaluateAdjustment(max), max), TypeError)
  assert.throws(() => evaluateAdjustment(setup({}, { adult: false })), TypeError)
})

test('property grid: every offered change stays within step, percent, basis and training floors', () => {
  for (const weightKg of [45, 80, 140, 350]) for (const goal of ['bulk', 'maintain', 'cut']) {
    for (const volume of ['rest', 'light', 'moderate', 'high']) for (const kcal of [1600, 2100, 2800, 4000, 10000]) {
      const input = setup({ kcal }, { weightKg, goal, training: { volume, intensity: 'light' } })
      input.nutrition.weights = input.nutrition.weights.map(w => ({ ...w, kg: weightKg }))
      const p = evaluateAdjustment(input)
      if (p.phase === 'ready') {
        assert.ok(Math.abs(p.deltaKcal) <= 150)
        assert.ok(Math.abs(p.deltaKcal) <= kcal * 0.05)
        assert.ok(p.proposedKcal >= p.limits.reviewBasisMinKcal)
        const load = ({ rest: 0, light: 100, moderate: 200, high: 300 })[volume]
        assert.ok(p.proposedKcal + load >= p.limits.minKcal)
        assert.equal(decide(p, input).plan.kcal, p.proposedKcal)
      }
    }
  }
})
