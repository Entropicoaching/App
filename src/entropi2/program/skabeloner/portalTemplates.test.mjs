import test from 'node:test'
import assert from 'node:assert/strict'
import { templateFromWeek, readTemplateLibrary } from './portalTemplates.mjs'
import { createProgramTemplate } from './programTemplates.mjs'

const fixture = () => ({ id: 'synthetic-week', athlete_id: 'synthetic-athlete', week_number: 1,
  sessions: [{ id: 'synthetic-session', title: 'Pas A', weekday: 0,
    exercises: [{ id: 'synthetic-exercise', name: 'Squat', sets: 3, reps: '5', intensity: 'RPE 7,5', recommended_weight: null }] }] })

test('portal week becomes a detached reusable v1 template without IDs or athlete data', () => {
  const week = fixture(), before = JSON.stringify(week)
  const template = templateFromWeek(week, '  Basis  ', week.athlete_id)
  assert.equal(template.name, 'Basis')
  assert.equal(template.weeks[0].sessions[0].dayOfWeek, 1)
  assert.deepEqual(template.weeks[0].sessions[0].exercises[0].sets, Array.from({ length: 3 }, () => ({ reps: 5, rpe: 7.5 })))
  assert.doesNotMatch(JSON.stringify(template), /synthetic-|athlete_id|recommended_weight/)
  const next = createProgramTemplate(template, { enabled: true }).template
  next.weeks[0].sessions[0].exercises[0].sets[0].reps = 6
  assert.equal(template.weeks[0].sessions[0].exercises[0].sets[0].reps, 5)
  assert.equal(JSON.stringify(week), before)
})

test('no inferred weekday, reps, intensity, weights or notes; foreign sources rejected', () => {
  assert.throws(() => templateFromWeek(fixture(), 'Basis', 'other'))
  const missingDay = fixture(); missingDay.sessions[0].weekday = null
  assert.throws(() => templateFromWeek(missingDay, 'Basis', missingDay.athlete_id))
  for (const patch of [{ reps: '3-5' }, { reps: '' }, { sets: 0 }, { intensity: '80%' }, { intensity: 'RPE 11' },
    { recommended_weight: 100 }, { note: 'Bevar denne note' }]) {
    const week = fixture(); Object.assign(week.sessions[0].exercises[0], patch)
    assert.throws(() => templateFromWeek(week, 'Basis', week.athlete_id))
  }
})

test('empty, corrupt and invalid stored libraries remain distinct', () => {
  assert.deepEqual(readTemplateLibrary(null), [])
  for (const raw of ['invalid', '{}', '[{}]', 'x'.repeat(400001)]) assert.throws(() => readTemplateLibrary(raw))
  const week = fixture(), template = templateFromWeek(week, 'Basis', week.athlete_id)
  assert.deepEqual(readTemplateLibrary(JSON.stringify([template])), [template])
})
