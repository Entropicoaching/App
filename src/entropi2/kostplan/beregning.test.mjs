import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateNutrition, POLICY } from './beregning.mjs'

const date = '2026-11-04'
const iso = n => new Date(Date.parse(date + 'T00:00:00Z') - n * 86400000).toISOString().slice(0, 10)
const base = overrides => ({ date, adult: true, weightKg: 80, goal: 'maintain', maintenanceKcal: 2800, ...overrides })
const data = (weeklyKg = 0, days = 28, kcal = 2800) => ({
  weights: Array.from({ length: days }, (_, i) => ({ date: iso(days - i - 1), kg: 80 + weeklyKg * i / 7 })),
  dietDays: Array.from({ length: days }, (_, i) => ({ date: iso(days - i - 1), complete: true, kcal })),
})
const currentPlan = { kcal: 2800, createdOn: iso(14) }
const close = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`)

test('empty history is explicit; no mutation or hidden time; deterministic plain result', () => {
  const input = base(), before = JSON.stringify(input)
  const result = calculateNutrition(input)
  assert.equal(result.maintenanceSource, 'coach-estimate')
  assert.equal(result.evidence.trend.weeklyKg, null)
  assert.equal(result.evidence.diet.meanKcal, null)
  assert.equal(result.weekly.action, 'hold')
  assert.equal(result.weekly.proposedKcal, null)
  assert.equal(JSON.stringify(input), before)
  assert.deepEqual(calculateNutrition(input), result)
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result)
  result.evidence.training.volume = 'high'
  assert.equal(calculateNutrition(input).evidence.training.volume, 'rest')
})

for (const goal of ['cut', 'maintain', 'bulk']) {
  test(`${goal}: intensity controls energy and desired weekly weight change`, () => {
    const values = ['light', 'moderate', 'aggressive'].map(intensity => calculateNutrition(base({ goal, intensity })))
    const sign = goal === 'cut' ? -1 : 1
    for (let i = 1; i < values.length; i++) {
      if (goal === 'maintain') assert.deepEqual(values[i].targets, values[0].targets)
      else {
        assert.ok(sign * values[i].targets.kcal > sign * values[i - 1].targets.kcal)
        assert.ok(sign * values[i].targetWeeklyPct > sign * values[i - 1].targetWeeklyPct)
      }
    }
  })
}

for (const days of [14, 21, 28]) {
  test(`calibration from ${days} observed days uses real response and matched complete diary`, () => {
    const result = calculateNutrition(base({ ...data(0.2, days) }))
    assert.equal(result.maintenanceSource, 'current-response')
    close(result.evidence.trend.weeklyKg, 0.2)
    close(result.maintenanceKcal, 2580)
    assert.equal(result.evidence.trend.count, days)
    assert.equal(result.evidence.from, iso(days - 1))
    assert.equal(result.evidence.diet.completeDays, days)
  })
}

test('positive and negative response calibrate symmetrically; incomplete diary never counts as zero', () => {
  close(calculateNutrition(base(data(-0.2))).maintenanceKcal, 3020)
  const insufficient = data(0.2)
  insufficient.dietDays = insufficient.dietDays.slice(0, 19)
  const result = calculateNutrition(base(insufficient))
  assert.equal(result.maintenanceSource, 'coach-estimate')
  assert.equal(result.evidence.diet.completeDays, 19)
  assert.equal(result.evidence.diet.meanKcal, 2800)
  assert.equal(calculateNutrition(base({ ...data(0.2), dietDays: data().dietDays.map(r => ({ ...r, complete: false })) })).evidence.diet.meanKcal, null)
})

test('duplicate dates excluded entirely; invalid, old and future evidence rejected', () => {
  const history = data()
  history.weights.push({ ...history.weights[0] }, { date: iso(-1), kg: 80 }, { date: '2026-02-30', kg: 80 }, { date: iso(30), kg: 80 }, { date: iso(3), kg: Infinity })
  history.dietDays.push({ ...history.dietDays[0] }, { date: iso(-1), complete: true, kcal: 9000 })
  const result = calculateNutrition(base(history))
  assert.equal(result.evidence.trend.count, 27)
  assert.equal(result.evidence.trend.rejected, 6)
  assert.equal(result.evidence.diet.completeDays, 27)
  assert.equal(result.evidence.diet.rejected, 3)
  assert.ok(!result.evidence.trend.dates.includes(iso(27)))
})

test('fewer than fourteen days, one sparse endpoint and stale weights do not permit adjustment', () => {
  for (const history of [data(0, 13), { ...data(), weights: data().weights.slice(4) },
    { ...data(), weights: data().weights.slice(0, 20) }]) {
    // The middle case has >=14 days and enough endpoints; remove all but four in first week.
    if (history.weights.length === 24) history.weights = history.weights.filter((_, i) => i > 6 || i < 4)
    assert.equal(calculateNutrition(base({ ...history, currentPlan })).weekly.action, 'hold')
  }
})

test('validated previous response used before coach fallback; latest plan wins without reordering input', () => {
  const experiences = [
    { from: iso(80), through: iso(60), averageKcal: 2600, weeklyChangeKg: 0, weightKg: 80, adherence: 0.9 },
    { from: iso(40), through: iso(20), averageKcal: 3000, weeklyChangeKg: 0.2, weightKg: 80, adherence: 0.9 },
  ]
  const before = JSON.stringify(experiences)
  const result = calculateNutrition(base({ experiences }))
  assert.equal(result.maintenanceSource, 'previous-response')
  close(result.maintenanceKcal, 2780)
  assert.equal(JSON.stringify(experiences), before)
  assert.equal(result.evidence.experience.through, iso(20))
  const duplicate = calculateNutrition(base({ experiences: [experiences[1], experiences[1]] }))
  assert.equal(duplicate.maintenanceSource, 'coach-estimate')
})

test('unreliable, stale, future or implausible prior plans do not calibrate', () => {
  const prior = { from: iso(40), through: iso(20), averageKcal: 3000, weeklyChangeKg: 0.2, weightKg: 80, adherence: 0.9 }
  for (const patch of [{ adherence: 0.79 }, { through: iso(-1) }, { from: iso(210), through: iso(190) },
    { from: iso(22) }, { weightKg: 40 }, { averageKcal: Infinity }, { weeklyChangeKg: 20 }]) {
    assert.equal(calculateNutrition(base({ experiences: [{ ...prior, ...patch }] })).maintenanceSource, 'coach-estimate')
  }
})

test('weight estimate is labelled and cannot grant automatic weekly adjustment', () => {
  const result = calculateNutrition(base({ maintenanceKcal: undefined, currentPlan }))
  assert.equal(result.maintenanceSource, 'weight-estimate')
  assert.equal(result.maintenanceKcal, 2400)
  assert.ok(result.warnings.length)
  assert.equal(result.weekly.action, 'hold')
})

test('high volume and high intensity each increase carbohydrate allocation', () => {
  const rest = calculateNutrition(base())
  const volume = calculateNutrition(base({ training: { volume: 'high', intensity: 'light' } }))
  const intense = calculateNutrition(base({ training: { volume: 'high', intensity: 'high' } }))
  assert.ok(volume.targets.carb > rest.targets.carb)
  assert.ok(intense.targets.carb > volume.targets.carb)
  assert.ok(volume.targets.fat >= 64)
})

test('an individual energy floor cannot swallow training fuel; weekly basis uses its own floor', () => {
  const rest = calculateNutrition(base({ minKcal: 4000 }))
  const heavy = calculateNutrition(base({ minKcal: 4000, training: { volume: 'high', intensity: 'high' },
    currentPlan: { kcal: 4000, createdOn: iso(14) }, ...data() }))
  assert.equal(heavy.targets.kcal, rest.targets.kcal + 400)
  assert.ok(heavy.targets.carb > rest.targets.carb)
  assert.equal(heavy.limits.baseMinKcal, 4000)
  assert.equal(heavy.limits.minKcal, 4400)
  assert.notEqual(heavy.weekly.action, 'review')
})

test('poor readiness removes today deficit and holds weekly changes; readiness is copied', () => {
  for (const readiness of [{ energy: 2, hunger: 2 }, { energy: 5, hunger: 4 }]) {
    const result = calculateNutrition(base({ goal: 'cut', readiness, ...data(), currentPlan }))
    assert.equal(result.energyShare, 0)
    assert.ok(result.targets.kcal >= result.maintenanceKcal)
    assert.equal(result.weekly.action, 'hold')
    result.evidence.readiness.energy = 99
    assert.ok(readiness.energy <= 5)
  }
})

test('stævne cannot intensify a cut, impossible or imminent weight class requires coach', () => {
  const normal = calculateNutrition(base({ goal: 'cut', ...data(), currentPlan }))
  for (const competition of [{ date: iso(-7), weightClassKg: 79 }, { date: iso(-42), weightClassKg: 60 }, { date, weightClassKg: 80 }]) {
    const result = calculateNutrition(base({ goal: 'cut', competition, ...data(), currentPlan }))
    assert.deepEqual(result.targets, normal.targets)
    assert.equal(result.evidence.competition.requiresCoachReview, true)
    assert.equal(result.weekly.action, 'hold')
    assert.ok(result.warnings.some(w => w.includes('Stævnevægt')))
  }
  const past = calculateNutrition(base({ goal: 'cut', competition: { date: iso(1), weightClassKg: 70 }, ...data(), currentPlan }))
  assert.equal(past.evidence.competition.requiresCoachReview, false)
  assert.equal(past.weekly.action, normal.weekly.action)
})

test('weekly step has reason and dates, capped at 150 kcal AND five percent', () => {
  const result = calculateNutrition(base({ goal: 'cut', ...data(), currentPlan }))
  assert.equal(result.weekly.action, 'adjust')
  assert.equal(result.weekly.deltaKcal, -140)
  assert.equal(result.weekly.proposedKcal, 2660)
  assert.equal(result.weekly.evidence.weightDates.length, 28)
  assert.equal(result.weekly.evidence.completeDietDates.length, 28)
  assert.equal(result.weekly.requiresCoachActivation, true)
  assert.ok(result.weekly.reason.includes('Vægttrend'))
  assert.doesNotMatch(result.weekly.reason, /\d\.\d/, 'u8c: dansk komma i begrundelsen')
  assert.equal(result.weekly.nextEligibleOn, '2026-11-11')
  const larger = calculateNutrition(base({ goal: 'bulk', ...data(), currentPlan: { ...currentPlan, kcal: 4000 } }))
  assert.equal(larger.weekly.deltaKcal, 150)
})

test('weekly drift moves in correct direction for bulk, maintain and cut', () => {
  for (const goal of ['bulk', 'maintain', 'cut']) {
    for (const [weeklyKg, direction] of [[-1, 1], [1, -1]]) {
      const result = calculateNutrition(base({ goal, ...data(weeklyKg), currentPlan }))
      assert.equal(Math.sign(result.weekly.deltaKcal), direction)
    }
  }
})

test('stable goal and tolerance boundary do not cause oscillation', () => {
  for (const weeklyKg of [0, 0.08, -0.08]) {
    const result = calculateNutrition(base({ ...data(weeklyKg), currentPlan }))
    assert.equal(result.weekly.action, 'hold')
  }
})

test('seven-day rolling cooldown survives ISO week/year boundaries and activation replay', () => {
  for (const days of [0, 1, 6]) {
    const result = calculateNutrition(base({ goal: 'cut', ...data(), currentPlan: { ...currentPlan, lastAdjustedOn: iso(days) } }))
    assert.equal(result.weekly.action, 'hold')
  }
  assert.equal(calculateNutrition(base({ goal: 'cut', ...data(), currentPlan: { ...currentPlan, lastAdjustedOn: iso(7) } })).weekly.action, 'adjust')
  const proposal = calculateNutrition(base({ goal: 'cut', ...data(), currentPlan })).weekly
  const accepted = { ...currentPlan, kcal: proposal.proposedKcal, lastAdjustedOn: date, evaluatedThrough: date }
  assert.equal(calculateNutrition(base({ goal: 'cut', ...data(), currentPlan: accepted })).weekly.action, 'hold')
  const year = calculateNutrition(base({ date: '2027-01-02', currentPlan: { kcal: 2800, createdOn: '2026-12-28' } }))
  assert.equal(year.weekly.nextEligibleOn, '2027-01-04')
})

test('already evaluated history is held; current plan under floor produces review, never low proposal', () => {
  assert.equal(calculateNutrition(base({ ...data(), currentPlan: { ...currentPlan, evaluatedThrough: date } })).weekly.action, 'hold')
  const result = calculateNutrition(base({ ...data(), currentPlan: { ...currentPlan, kcal: 1500 } }))
  assert.equal(result.weekly.action, 'review')
  assert.equal(result.weekly.proposedKcal, null)
  const floor = calculateNutrition(base({ goal: 'cut', ...data(), currentPlan: { ...currentPlan, kcal: 2100 } }))
  assert.ok(floor.weekly.proposedKcal >= floor.limits.minKcal)
})

test('safety and energy balance across adult weights, goals, loads and intensities', () => {
  for (const weightKg of [25, 45.3, 80, 140, 350]) {
    for (const goal of ['cut', 'maintain', 'bulk']) {
      for (const intensity of ['light', 'moderate', 'aggressive']) {
        for (const volume of ['rest', 'light', 'moderate', 'high']) {
          const result = calculateNutrition(base({ weightKg, goal, intensity, volume,
            maintenanceKcal: weightKg * 20, training: { volume, intensity: 'light' } }))
          const t = result.targets
          assert.ok(Object.values(t).every(Number.isFinite))
          assert.ok(t.kcal >= Math.max(1600, weightKg * 25))
          assert.ok(t.protein >= weightKg * 2)
          assert.ok(t.fat >= weightKg * 0.8 - 1e-8)
          assert.ok(t.carb >= result.limits.carbFloor - 1e-8)
          close(t.kcal, t.protein * 4 + t.carb * 4 + t.fat * 9)
        }
      }
    }
  }
  assert.equal(POLICY.minKcal, 1600)
  assert.equal(calculateNutrition(base({ minKcal: 4000 })).targets.kcal, 4000)
})

const invalid = [null, undefined, {}, base({ date: '2026-02-30' }), base({ date: '9999-12-31' }),
  base({ weightKg: NaN }), base({ weightKg: Infinity }), base({ weightKg: '80' }), base({ weightKg: 0 }),
  base({ adult: false }), base({ goal: '__proto__' }), base({ intensity: 'invalid' }),
  base({ windowDays: 13 }), base({ windowDays: 29 }), base({ windowDays: 14.5 }),
  base({ training: { volume: 'rest', intensity: 'high' } }), base({ training: { volume: 'high', intensity: '__proto__' } }),
  base({ readiness: {} }), base({ readiness: { energy: 0, hunger: 5 } }),
  base({ maintenanceKcal: 1000 }), base({ maintenanceKcal: Infinity }), base({ minKcal: 1000 }),
  base({ competition: { date: 'x', weightClassKg: 80 } }), base({ competition: { date, weightClassKg: 0 } }),
  base({ weights: {} }), base({ dietDays: {} }), base({ experiences: {} }),
  base({ currentPlan: { kcal: 2800 } }), base({ currentPlan: { kcal: Infinity, createdOn: iso(7) } }),
  base({ currentPlan: { kcal: 2800, createdOn: iso(-1) } }), base({ currentPlan: { ...currentPlan, evaluatedThrough: iso(-1) } }),
  base({ currentPlan: { ...currentPlan, lastAdjustedOn: iso(15) } }),
  base({ currentPlan: { kcal: 2800, lastAdjustedOn: iso(7) } }),
  base({ ...data(), maintenanceKcal: Infinity })]
test('invalid required values fail explicitly, including prototype-like enums and missing adjustment clock', () => {
  for (const value of invalid) assert.throws(() => calculateNutrition(value), TypeError, JSON.stringify(value))
})

test('model output can be a current plan throughout the supported weight and energy domain', () => {
  const input = base({ weightKg: 350, maintenanceKcal: 21000, goal: 'bulk', intensity: 'aggressive',
    training: { volume: 'high', intensity: 'high' } })
  const result = calculateNutrition(input)
  assert.ok(result.targets.kcal > 20000)
  assert.doesNotThrow(() => calculateNutrition({ ...input, currentPlan: { kcal: result.targets.kcal, createdOn: iso(7) } }))
  const upper = calculateNutrition(base({ ...data(), goal: 'bulk', currentPlan: { kcal: 100000, createdOn: iso(7) } }))
  assert.equal(upper.weekly.action, 'hold')
  assert.equal(upper.weekly.proposedKcal, 100000)
})

test('seventy percent coverage is inclusive, and diary period excludes data before the observed trend', () => {
  const history = data(0, 20)
  history.dietDays = history.dietDays.slice(0, 14)
  history.dietDays.push({ date: iso(25), kcal: 9000, complete: true })
  const result = calculateNutrition(base({ ...history, currentPlan }))
  assert.equal(result.maintenanceSource, 'current-response')
  assert.equal(result.evidence.diet.meanKcal, 2800)
  assert.equal(result.evidence.diet.rejected, 1)
  assert.equal(result.weekly.action, 'hold')
  assert.equal(calculateNutrition(base({ ...history, dietDays: history.dietDays.slice(1), currentPlan })).maintenanceSource, 'coach-estimate')
})
