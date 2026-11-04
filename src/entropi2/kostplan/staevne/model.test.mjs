import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCompetitionPlan, COACH_MESSAGE, POLICY } from './model.mjs'
import { input } from './fixture.mjs'

const plan = overrides => buildCompetitionPlan({ enabled: true, input: input(overrides) })
const isoAfter = days => new Date(Date.UTC(2026, 10, 1 + days)).toISOString().slice(0, 10)

test('OFF is strict, inert and reads no input', () => {
  for (const enabled of [undefined, false, 0, 1, 'true', null]) {
    assert.deepEqual(buildCompetitionPlan({ enabled, get input() { throw Error('read') } }), { phase: 'off' })
  }
})

test('empty and malformed data do not invent a plan', () => {
  for (const value of [null, undefined]) {
    const p = buildCompetitionPlan({ enabled: true, input: value })
    assert.equal(p.phase, 'empty'); assert.deepEqual(p.weeks, [])
    assert.equal(p.coachMessage, COACH_MESSAGE)
  }
  for (const value of [true, '80', [], 80]) {
    assert.equal(buildCompetitionPlan({ enabled: true, input: value }).phase, 'invalid')
  }
})

test('finite numeric weights only; endpoints accepted', () => {
  for (const key of ['weightKg', 'weightClassKg']) {
    for (const value of [undefined, null, '', '80', '80,5', NaN, Infinity, -Infinity, 0, 24.99, 350.01]) {
      const p = plan({ [key]: value })
      assert.equal(p.phase, 'invalid', `${key}: ${value}`)
      assert.equal(p.basis, undefined); assert.deepEqual(p.weeks, [])
    }
    for (const value of [25, 350]) assert.notEqual(plan({ [key]: value }).phase, 'invalid')
  }
})

test('dates are real ISO calendar days with no implicit clock', () => {
  for (const key of ['asOf', 'competitionDate']) {
    for (const value of [undefined, null, '', '2026-02-29', '2026-04-31', '2026-13-01', '2026-11-31', '2026-1-01', '2026-11-30T10:00:00Z', '1899-12-31', '10000-01-01']) {
      assert.equal(plan({ [key]: value }).phase, 'invalid', `${key}: ${value}`)
    }
  }
  const leap = plan({ asOf: '2028-02-01', competitionDate: '2028-02-29' })
  assert.equal(leap.basis.weighInDate, '2028-02-28')
  assert.equal(plan({ asOf: '9999-12-01', competitionDate: '9999-12-30' }).basis.weighInDate, '9999-12-29')
})

test('only literal 2 and 24 hour weigh-ins are supported', () => {
  for (const value of [undefined, null, 0, 1, 3, 12, 48, '2', '24', NaN]) {
    assert.equal(plan({ weighInHours: value }).phase, 'invalid')
  }
  assert.equal(plan({ weighInHours: 2 }).basis.weighInDate, '2026-11-30')
  assert.equal(plan().basis.weighInDate, '2026-11-29')
})

test('adult and health review are explicit gates, never inferred', () => {
  for (const key of ['adult', 'healthReviewed']) for (const value of [undefined, null, false, 'true', 1]) {
    const p = plan({ [key]: value })
    assert.equal(p.phase, 'review'); assert.deepEqual(p.weeks, [])
    assert.equal(p.recovery, undefined); assert.equal(p.acute, undefined)
  }
})

test('weigh-in cutoff includes previous day at 24h; no retrospective plan', () => {
  for (const overrides of [
    { asOf: '2026-11-29' }, { asOf: '2026-11-30' }, { asOf: '2026-12-01' },
    { weighInHours: 2, asOf: '2026-11-30' },
  ]) {
    const p = plan(overrides)
    assert.equal(p.phase, 'review'); assert.deepEqual(p.weeks, [])
    assert.equal(p.basis, undefined)
  }
})

test('a reachable class yields gradual weekly checkpoints, not kcal or activation', () => {
  const p = plan()
  assert.equal(p.phase, 'draft'); assert.equal(p.withinClass, true)
  assert.equal(p.policy, POLICY); assert.equal(p.requiresCoachReview, true)
  assert.equal(p.basis.windowDays, 28); assert.equal(p.weeks.length, 4)
  assert.equal(p.projectedKg, 78); assert.equal(p.acute.status, 'not-needed')
  assert.ok(p.weeklyLossPct > 0 && p.weeklyLossPct < 1)
  assert.equal(p.kcal, undefined); assert.equal(p.activated, undefined)
  assert.equal(p.acute.prescribedWaterLossKg, 0)
})

test('at or below class never triggers loss or gain, even with one day remaining', () => {
  for (const weightKg of [78, 77.512345]) {
    const p = plan({ weightKg, asOf: '2026-11-28' })
    assert.equal(p.phase, 'draft'); assert.equal(p.weeklyLossPct, 0)
    assert.equal(p.projectedKg, weightKg); assert.equal(p.acute.status, 'not-needed')
    assert.ok(p.weeks.every(week => week.lossKg === 0 && week.targetKg === weightKg))
  }
})

test('insufficient time blocks weight reduction, never a last-minute catch-up', () => {
  for (let days = 1; days < 7; days++) {
    const p = plan({ competitionDate: isoAfter(days + 1) })
    assert.equal(p.phase, 'review'); assert.deepEqual(p.weeks, [])
    assert.equal(p.acute, undefined); assert.match(p.reason, /Under syv dage/)
  }
})

test('last four weeks only, and a future start is explicit', () => {
  const p = plan({ competitionDate: '2027-01-01', weightClassKg: 70 })
  assert.equal(p.basis.windowStart, '2026-12-03')
  assert.equal(p.basis.startsLater, true); assert.equal(p.weeks.length, 4)
  assert.equal(p.basis.windowDays, 28)
  assert.equal(p.phase, 'review'); assert.equal(p.acute.status, 'over-limit')
})

test('2h prohibits acute water loss for every shortfall, even with unknown override flags', () => {
  const p = plan({ weighInHours: 2, competitionDate: '2026-11-08', weightClassKg: 79,
    allowWaterCut: true, acuteAssessmentPct: 10 })
  assert.equal(p.phase, 'review'); assert.equal(p.acute.status, 'not-supported')
  assert.equal(p.limits.acuteAssessmentPct, 0)
  assert.equal(p.acute.assessmentLimitKg, 0); assert.equal(p.acute.prescribedWaterLossKg, 0)
  assert.match(p.reason, /2 timers vejning/)
})

test('24h shortfall is only a review, bounded by 1% of projected weight', () => {
  const p = plan({ competitionDate: '2026-11-09', weightClassKg: 78.8 })
  assert.equal(p.acute.status, 'coach-review'); assert.equal(p.phase, 'review')
  assert.ok(p.acute.remainingKg > 0 && p.acute.remainingKg <= p.acute.assessmentLimitKg)
  assert.ok(p.acute.assessmentLimitKg <= p.projectedKg * 0.01)
  assert.equal(p.acute.prescribedWaterLossKg, 0)
  const unsafe = plan({ competitionDate: '2026-11-09', weightClassKg: 78 })
  assert.equal(unsafe.acute.status, 'over-limit'); assert.match(unsafe.reason, /anden vægtklasse/)
})

test('exhaustive synthetic grid: every full/partial week respects the loss ceiling', () => {
  let checked = 0
  for (const weightKg of [25, 52.125, 80, 137.7, 350]) {
    for (const fraction of [1, 0.999, 0.98, 0.96, 0.9]) {
      const weightClassKg = Math.max(25, weightKg * fraction)
      for (let available = 7; available <= 60; available++) {
        for (const weighInHours of [2, 24]) {
          const p = plan({ weightKg, weightClassKg, weighInHours,
            competitionDate: isoAfter(available + (weighInHours === 24 ? 1 : 0)) })
          assert.ok(p.weeks.length >= 1 && p.weeks.length <= 4)
          assert.ok(p.weeklyLossPct >= 0 && p.weeklyLossPct <= 1)
          assert.equal(p.basis.windowDays, Math.min(available, 28))
          assert.equal(p.weeks.reduce((sum, w) => sum + w.days, 0), p.basis.windowDays)
          let previousDate = p.basis.windowStart, previousKg = weightKg
          for (const week of p.weeks) {
            assert.equal(week.from, previousDate); assert.equal(week.startKg, previousKg)
            assert.ok(week.targetKg <= previousKg + 1e-10)
            assert.ok(week.targetKg >= previousKg * 0.99 ** (week.days / 7) - 1e-10)
            assert.ok(week.targetKg >= Math.min(weightKg, weightClassKg))
            assert.ok(Number.isFinite(week.lossKg))
            previousDate = week.through; previousKg = week.targetKg
          }
          assert.equal(previousDate, p.basis.weighInDate)
          assert.equal(p.acute.prescribedWaterLossKg, 0)
          assert.ok(p.acute.assessmentLimitKg <= (weighInHours === 24 ? p.projectedKg * 0.01 : 0))
          if (p.phase === 'draft') assert.ok(p.projectedKg <= weightClassKg)
          checked++
        }
      }
    }
  }
  assert.equal(checked, 2700)
})

test('recovery distinguishes 2h and 24h, warns, and has no forced fluid dose', () => {
  for (const hours of [2, 24]) {
    const p = plan({ weighInHours: hours })
    assert.equal(p.recovery.windowHours, hours)
    assert.equal(p.recovery.steps.length, 2)
    assert.match(p.recovery.warning, /søg akut lægehjælp/)
    assert.ok(p.cautions.some(text => text.includes('Ingen sauna')))
    assert.equal(p.coachMessage, COACH_MESSAGE)
  }
  assert.match(plan({ weighInHours: 2 }).recovery.steps.join(' '), /to timer/)
  assert.match(plan().recovery.steps.join(' '), /individualiseres/)
})

test('deterministic detached output, immutable input and real bibliographic identities', () => {
  const data = Object.freeze(input())
  const first = buildCompetitionPlan({ enabled: true, input: data })
  const second = buildCompetitionPlan({ enabled: true, input: data })
  assert.deepEqual(first, second)
  first.weeks[0].targetKg = 0; first.sources[0].url = 'bad'; first.recovery.steps.push('bad')
  assert.deepEqual(buildCompetitionPlan({ enabled: true, input: data }), second)
  assert.deepEqual(second.sources.map(s => s.url), [
    'https://doi.org/10.1123/ijsnem.21.2.97', 'https://doi.org/10.1123/ijsnem.2016-0211',
    'https://doi.org/10.1249/MSS.0000000000000852',
  ])
  assert.ok(second.sources.every(s => s.evidence.length > 30))
})
