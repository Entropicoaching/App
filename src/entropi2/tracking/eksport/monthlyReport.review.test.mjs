import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCoachMonthlyReport, exportCoachMonthlyReport } from './monthlyReport.mjs'

// Separate oracle: no overview/trend imports and no production helper reuse.
const day = offset => new Date(Date.UTC(2026, 9, 8 + offset)).toISOString().slice(0, 10)
const monday = date => {
  const time = Date.parse(`${date}T00:00:00Z`)
  return new Date(time - (new Date(time).getUTCDay() + 6) % 7 * 86400000).toISOString().slice(0, 10)
}
test('review oracle: 60 seeded sparse 28-day histories match direct dated sums and weekly maxima', () => {
  let seed = 91317
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32 }
  for (let trial = 0; trial < 60; trial++) {
    const snapshot = { status: 'ready', complete: true, athleteId: 'synthetic-oracle', endDate: day(27),
      exerciseLogs: [], mealRows: [], weightRows: [], dailyRows: [] }
    const expected = new Map(), strength = new Map()
    for (let i = -2; i <= 29; i++) {
      const date = day(i), values = {}
      if (random() < 0.5) {
        const count = 1 + Math.floor(random() * 3)
        values.training_sets = count; values.training_volume = 0
        for (let j = 0; j < count; j++) {
          const kg = 20 + Math.floor(random() * 100), reps = 1 + Math.floor(random() * 6)
          snapshot.exerciseLogs.push({ athlete_id: snapshot.athleteId, id: `s-${i}-${j}`,
            logged_at: date, weight: kg, reps_completed: reps, exercises: { name: 'Squat' } })
          values.training_volume += kg * reps
          if (i >= 0 && i <= 27) {
            const key = monday(date), estimate = kg * (1 + reps / 30)
            strength.set(key, Math.max(strength.get(key) ?? 0, estimate))
          }
        }
      }
      if (random() < 0.6) {
        values.nutrition_energy = 0; values.nutrition_protein = 0
        const count = 1 + Math.floor(random() * 3)
        for (let j = 0; j < count; j++) {
          const kcal = Math.floor(random() * 1000), protein = Math.floor(random() * 50)
          values.nutrition_energy += kcal; values.nutrition_protein += protein
          snapshot.mealRows.push({ athlete_id: snapshot.athleteId, date, meal: 'Syntetisk',
            kcal, protein, carb: 10, fat: 5 })
        }
      }
      if (random() < 0.4) {
        values.body_weight = 60 + Math.floor(random() * 40)
        snapshot.weightRows.push({ athlete_id: snapshot.athleteId, logged_at: date, weight: values.body_weight })
      }
      if (random() < 0.6) {
        values.sleep = Math.floor(random() * 12); values.energy = 1 + Math.floor(random() * 5)
        values.stress = 1 + Math.floor(random() * 5); values.soreness = Math.floor(random() * 11)
        snapshot.dailyRows.push({ athlete_id: snapshot.athleteId, logged_date: date, source: 'athlete_manual',
          sleep_hours: values.sleep, energy: values.energy, stress: values.stress, soreness: values.soreness })
      }
      if (i >= 0 && i <= 27) expected.set(date, values)
    }
    // Reverse input order to catch reliance on a sorted snapshot.
    for (const key of ['exerciseLogs', 'mealRows', 'weightRows', 'dailyRows']) snapshot[key].reverse()
    const report = buildCoachMonthlyReport(snapshot, { enabled: true })
    assert.equal(report.status, 'ready')
    for (const row of report.records) {
      if (row.record_type === 'daily') {
        assert.equal(row.value, expected.get(row.period_from)[row.metric] ?? null)
      } else if (row.record_type === 'data_basis') {
        const count = [...expected].filter(([date, values]) => date >= row.period_from && date <= row.period_to
          && values[row.metric] !== undefined).length
        assert.equal(row.observed_days, count)
        assert.equal(row.expected_days, 7)
      } else {
        assert.equal(row.value, strength.get(monday(row.period_from)))
      }
    }
    assert.equal(report.records.filter(r => r.record_type === 'strength').length, strength.size)
    assert.equal(report.records.filter(r => r.record_type === 'daily').length, 252)
  }
})

test('review: consent cannot add cycle fields; unknown format and partial errors produce no content', () => {
  const snapshot = { status: 'ready', complete: true, athleteId: 'synthetic-review', endDate: day(27),
    exerciseLogs: [], mealRows: [], weightRows: [], dailyRows: [],
    cycleConsent: true, cycle: [{ day: day(0), phase: 'PRIVATE_SENTINEL' }], name: 'PRIVATE_SENTINEL' }
  for (const format of ['json', 'csv']) {
    const output = exportCoachMonthlyReport(snapshot, { enabled: true, format })
    assert.doesNotMatch(output.content, /PRIVATE_SENTINEL|cycle|Consent/)
  }
  for (const options of [{ enabled: true, format: 'CSV' }, { enabled: true, format: {} }]) {
    assert.equal(exportCoachMonthlyReport(snapshot, options).status, 'error')
    assert.ok(!('content' in exportCoachMonthlyReport(snapshot, options)))
  }
  assert.ok(!('content' in exportCoachMonthlyReport({ ...snapshot, complete: false }, { enabled: true })))
})
