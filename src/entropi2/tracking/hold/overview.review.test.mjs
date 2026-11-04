import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCoachTeamOverview } from './overview.mjs'
import { athlete, options } from './fixtures.mjs'

// Independent fixture oracle: input decisions, not the returned model, determine
// expected counts and coverage. No production sort helper is imported.
test('review oracle: 30 permuted teams keep exact flag counts, coverage and rank tiers', () => {
  let seed = 94531
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32 }
  for (let run = 0; run < 30; run++) {
    const inputs = [], expected = new Map()
    for (let i = 0; i < 12; i++) {
      const id = `synthetic-${String(i).padStart(2, '0')}`, a = athlete(id)
      const count = Math.floor(random() * 6), unknown = random() < 0.2
      const invalidCoverage = random() < 0.5, unknownCoverage = random() < 0.3
      a.coachWeek.daily.forEach(d => {
        if (count >= 1) d.sleepHours = 5
        if (count >= 2) d.sleepQuality = 2
        if (count >= 3) d.energy = 2
        if (count >= 4) d.stress = 4
        if (count >= 5) { d.soreness = 7; d.sorenessLocation = 'synthetic-location' }
      })
      if (unknown) a.coachWeek.complete = false
      if (invalidCoverage) a.sources.readiness.rows.forEach(r => { r.readiness_score = null })
      if (unknownCoverage) a.sources.weight.state = 'error'
      expected.set(id, { count: unknown ? null : count, invalid: invalidCoverage ? 24 : 0,
        unknown: unknownCoverage ? 1 : 0 })
      inputs.push(a)
    }
    for (let i = inputs.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1)); [inputs[i], inputs[j]] = [inputs[j], inputs[i]]
    }
    const result = buildCoachTeamOverview(options(inputs))
    assert.equal(result.athletes.length, 12)
    const expectedIds = []
    // Enumerate rank buckets rather than reusing the implementation comparator.
    for (const count of [5, 4, 3, 2, 1, null, 0]) {
      for (const unknown of [1, 0]) {
        for (const invalid of [24, 0]) {
          expectedIds.push(...[...expected].filter(([, e]) => e.count === count && e.unknown === unknown && e.invalid === invalid)
            .map(([id]) => id).sort())
        }
      }
    }
    assert.deepEqual(result.athletes.map(a => a.athleteId), expectedIds)
    for (const a of result.athletes) {
      const e = expected.get(a.athleteId)
      assert.equal(a.flagCount, e.count)
      assert.equal(a.unknownDomains, e.unknown)
      assert.equal(a.missingValueDays, e.invalid)
      assert.equal(a.weeks.at(-1).domains.readiness.recordedDays, 3)
      assert.equal(a.weeks.at(-1).domains.readiness.valueDays, e.invalid ? 0 : 3)
    }
    assert.deepEqual(buildCoachTeamOverview(options([...inputs].reverse())), result)
  }
})
