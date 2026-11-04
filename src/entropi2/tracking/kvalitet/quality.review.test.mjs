import test from 'node:test'
import assert from 'node:assert/strict'
import { weeklyDataBasis } from './weeklyDataBasis.mjs'

// Separate deterministic oracle: direct UTC day buckets, no imports of the
// production calendar helpers, load/trend modules, or model implementation.
test('review: 100 seeded histories match independent calendar/day-count oracle', () => {
  let seed = 4189
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32 }
  const athleteId = 'synthetic-oracle'
  const domains = ['training', 'nutrition', 'weight', 'readiness']
  const dates = Array.from({ length: 28 }, (_, i) => new Date(Date.UTC(2026, 9, 12 + i)).toISOString().slice(0, 10))
  for (let run = 0; run < 100; run++) {
    const expected = {}, sources = {}
    for (const domain of domains) {
      const rows = [], presence = [], values = []
      for (const [i, date] of dates.entries()) {
        const present = random() > 0.35, known = random() > 0.2
        presence.push(present); values.push(present && known)
        if (!present) continue
        const row = { athlete_id: athleteId, id: `${domain}-${i}` }
        if (domain === 'training') Object.assign(row, { logged_at: date, weight: known ? 60 : null, reps_completed: 5 })
        if (domain === 'nutrition') Object.assign(row, { date, meal: 'Syntetisk måltid', kcal: 500, protein: known ? 30 : null, carb: 50, fat: 10 })
        if (domain === 'weight') Object.assign(row, { logged_at: date, weight: known ? 80 : 0 })
        if (domain === 'readiness') Object.assign(row, { logged_date: date, readiness_score: known ? 0 : null })
        rows.push(row)
        if (random() > 0.5) rows.push({ ...row })
        rows.push({ ...row, athlete_id: 'synthetic-other' })
      }
      // Fisher-Yates, including foreign rows and repeated copies.
      for (let i = rows.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1)); [rows[i], rows[j]] = [rows[j], rows[i]]
      }
      sources[domain] = { athleteId, state: 'ready', complete: true, rows }
      expected[domain] = { presence, values }
    }
    const model = weeklyDataBasis({ enabled: true, athleteId, asOf: '2026-11-08', sources })
    for (let week = 0; week < 4; week++) {
      assert.equal(model.weeks[week].elapsedDays, 7)
      for (const domain of domains) {
        const want = expected[domain], basis = model.weeks[week].domains[domain]
        const indexes = Array.from({ length: 7 }, (_, i) => week * 7 + i)
        assert.equal(basis.recordedDays, indexes.filter(i => want.presence[i]).length)
        assert.equal(basis.valueDays, indexes.filter(i => want.values[i]).length)
        assert.deepEqual(basis.missingDays, indexes.filter(i => !want.presence[i]).map(i => dates[i]))
        assert.deepEqual(basis.invalidDays, indexes.filter(i => want.presence[i] && !want.values[i]).map(i => dates[i]))
      }
    }
  }
})

test('review: early calendar boundaries never throw or invent a ready result', () => {
  const athleteId = 'synthetic-boundary'
  const sources = Object.fromEntries(['training', 'nutrition', 'weight', 'readiness'].map(key =>
    [key, { athleteId, state: 'ready', complete: true, rows: [] }]))
  for (const asOf of ['0000-01-01', '0000-01-22', '0000-01-25', '9999-12-31', '0000-01-28']) {
    const model = weeklyDataBasis({ enabled: true, athleteId, asOf, sources })
    assert.ok(['ready', 'invalid'].includes(model.state))
    if (model.state === 'ready') {
      assert.equal(model.weeks.length, 4)
      assert.ok(model.weeks.every(week => week.weekStart && week.weekEnd))
    }
  }
})
