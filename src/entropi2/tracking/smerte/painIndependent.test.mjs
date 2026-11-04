import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPainHistory } from './painModel.mjs'

// Separate countercheck: derive expected windows from UTC day numbers,
// independently of the model's calendar helpers and grouping implementation.
test('countercheck: 250 seeded sparse histories match a calendar-day oracle', () => {
  let seed = 20261104
  const random = n => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n }
  const dayMs = 86400000, end = Date.UTC(2026, 10, 4)
  for (let trial = 0; trial < 250; trial++) {
    const weeks = 4 + random(5), daily = []
    for (let ago = -2; ago < 65; ago++) {
      if (random(3) === 0) continue
      daily.push({ day: new Date(end - ago * dayMs).toISOString().slice(0, 10),
        source: 'athlete_manual', pain: random(11), painLocation: ['Testknæ', 'Testryg'][random(2)] })
    }
    daily.reverse()
    const result = buildPainHistory({ enabled: true, weeks,
      data: { state: 'ready', complete: true, athleteId: 'synthetic-athlete', asOf: '2026-11-04', daily } })
    assert.equal(result.state, 'ready')
    for (const name of ['Testknæ', 'Testryg']) {
      const expected = daily.filter(r => r.painLocation === name).map(r => ({ ...r,
        ago: (end - Date.parse(r.day)) / dayMs })).filter(r => r.ago >= 0 && r.ago < weeks * 7)
      const area = result.areas.find(a => a.name === name)
      if (!expected.length) { assert.equal(area, undefined); continue }
      assert.equal(area.count, expected.length)
      assert.deepEqual(area.high.map(r => `${r.day}/${r.value}`).sort(),
        expected.filter(r => r.pain >= 7).map(r => `${r.day}/${r.pain}`).sort())
      const previous = expected.filter(r => r.ago >= 14 && r.ago < 28)
      const recent = expected.filter(r => r.ago < 14)
      // Compare integer cross-products instead of floating-point means.
      const deltaNumerator = recent.reduce((s, r) => s + r.pain, 0) * previous.length
        - previous.reduce((s, r) => s + r.pain, 0) * recent.length
      const rising = previous.length >= 3 && recent.length >= 3
        && deltaNumerator >= 2 * previous.length * recent.length
      assert.equal(area.rising, rising)
      for (let i = 0; i < weeks; i++) {
        const lower = (weeks - i - 1) * 7, upper = lower + 7
        const bucket = expected.filter(r => r.ago >= lower && r.ago < upper)
        assert.equal(area.history[i].count, bucket.length)
        assert.equal(area.history[i].average,
          bucket.length ? bucket.reduce((s, r) => s + r.pain, 0) / bucket.length : null)
      }
    }
  }
})

test('countercheck: contradictory same-day records cannot hide a 7+ observation', () => {
  const daily = [7, 0].map(pain => ({ day: '2026-11-04', pain, painLocation: 'Testknæ', source: 'athlete_manual' }))
  for (const rows of [daily, [...daily].reverse()]) {
    assert.equal(buildPainHistory({ enabled: true, data: { state: 'ready', complete: true,
      athleteId: 'synthetic-athlete', asOf: '2026-11-04', daily: rows } }).state, 'error')
  }
})
