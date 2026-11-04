// Separate-process verification with independent synthetic fixtures; no test helpers.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createProgramTemplate, validateProgramTemplate } from './programTemplates.mjs'

test('review: JSON round-trip, same-day sessions and nested reuse isolation', () => {
  const raw = '{"version":1,"name":"Udkast","weeks":[{"weekNumber":1,"sessions":[{"name":"Morgen","dayOfWeek":3,"exercises":[{"exerciseKey":"demo-a","name":"Demo A","sets":[{"reps":4,"rpe":6.5}]}]},{"name":"Aften","dayOfWeek":3,"exercises":[{"exerciseKey":"demo-b","name":"Demo B","sets":[{"reps":12,"rpe":null}]}]}]}]}'
  const input = JSON.parse(raw)
  const a = createProgramTemplate(input, { enabled: true })
  assert.equal(a.state, 'ready')
  assert.equal(a.template.weeks[0].sessions.length, 2)
  assert.equal(a.template.weeks[0].sessions[1].exercises[0].sets[0].rpe, null)
  const b = createProgramTemplate(JSON.parse(JSON.stringify(a.template)), { enabled: true })
  assert.deepEqual(b, a)
  b.template.weeks[0].sessions[1].exercises[0].sets[0].reps = 25
  assert.equal(a.template.weeks[0].sessions[1].exercises[0].sets[0].reps, 12)
  assert.equal(JSON.stringify(input), raw)
})

test('review: grid rejects invalid prescriptions without rounding or partial success', () => {
  for (const reps of [-1, 0, 1, 3.5, 100, 101, '8']) {
    for (const rpe of [null, 0, 1, 4.25, 7.5, 10, 11, '7']) {
      const input = { version: 1, name: 'Grid', weeks: [{ weekNumber: 1, sessions: [
        { name: 'Pas', dayOfWeek: 5, exercises: [{ exerciseKey: 'demo', name: 'Demo', sets: [{ reps, rpe }] }] },
      ] }] }
      const expected = typeof reps === 'number' && Number.isInteger(reps) && reps >= 1 && reps <= 100
        && (rpe === null || (typeof rpe === 'number' && rpe >= 1 && rpe <= 10 && rpe % 0.5 === 0))
      const result = createProgramTemplate(input, { enabled: true })
      assert.equal(validateProgramTemplate(input).valid, expected)
      assert.equal(result.state, expected ? 'ready' : 'invalid')
      if (!expected) assert.equal(result.template, null)
    }
  }
})

test('review: rest-only templates work; hidden persistence fields cannot be accepted', () => {
  const base = { version: 1, name: 'Pause', weeks: [{ weekNumber: 1, sessions: [] }] }
  const result = createProgramTemplate(base, { enabled: true })
  assert.deepEqual(result.template.weeks, base.weeks)
  for (const extra of ['athlete_id', 'id', 'start_date', 'approved', '__proto__']) {
    const input = JSON.parse(JSON.stringify(base).slice(0, -1) + `,"${extra}":"synthetic"}`)
    assert.equal(createProgramTemplate(input, { enabled: true }).state, 'invalid')
  }
  const data = new Proxy({}, { get() { throw Error('OFF touched data') } })
  assert.equal(createProgramTemplate(data, { enabled: false }), null)
})
