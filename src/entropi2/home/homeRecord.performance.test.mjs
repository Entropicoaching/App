import test from 'node:test'
import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import { homeRecord } from './homeRecord.mjs'

function yearFixture(record) {
  const athlete = { id: 'synthetic-performance' }, allWeeks = [], rows = []
  for (let w = 0; w < 52; w++) {
    const start = Date.parse('2026-11-02T00:00:00Z') - (51 - w) * 7 * 86400000
    const week = { id: `week-${w}`, athlete_id: athlete.id, start_date: new Date(start).toISOString().slice(0, 10),
      block_name: 'Styrke', sessions: [] }
    for (let s = 0; s < 3; s++) {
      const session = { id: `session-${w}-${s}`, exercises: [] }
      for (let e = 0; e < 4; e++) {
        const exercise = { id: `exercise-${w}-${s}-${e}`, name: ['Squat', 'Bænkpres', 'Dødløft', 'Roning'][e], sets: 5 }
        session.exercises.push(exercise)
        for (let n = 1; n <= 5; n++) rows.push({ athlete_id: athlete.id, exercise_id: exercise.id, set_number: n,
          weight: record && w === 51 && s === 2 && e === 0 ? 200 : 100, reps_completed: 3, skipped: false,
          logged_at: new Date(start + s * 86400000 + 12 * 3600000 + (e * 5 + n) * 60000).toISOString(),
          exercises: { name: exercise.name, sessions: { weeks: { block_name: 'Styrke' } } } })
      }
      week.sessions.push(session)
    }
    allWeeks.push(week)
  }
  const currentWeek = allWeeks.at(-1), localIds = new Set(currentWeek.sessions.flatMap(s => s.exercises.map(e => e.id)))
  return { props: { enabled: true, athlete, currentWeek, allWeeks, exerciseLogs: rows.filter(r => localIds.has(r.exercise_id)) },
    history: { status: 'ready', complete: true, athleteId: athlete.id, rows }, now: new Date('2026-11-05T12:00:00Z') }
}

for (const record of [false, true]) test(`52 weeks / 3,120 rows, ${record ? 'with' : 'without'} a record: median below 50 ms`, t => {
  const f = yearFixture(record), samples = []
  assert.equal(f.history.rows.length, 3120)
  for (let i = 0; i < 9; i++) {
    const start = performance.now(), result = homeRecord(f.props, f.history, f.now)
    samples.push(performance.now() - start)
    assert.equal(result?.weight ?? null, record ? 200 : null)
  }
  const median = [...samples].sort((a, b) => a - b)[4]
  t.diagnostic(`milliseconds: ${samples.map(n => n.toFixed(2)).join(', ')}; median=${median.toFixed(2)}`)
  assert.ok(median < 50, `median ${median.toFixed(2)} ms`)
})
