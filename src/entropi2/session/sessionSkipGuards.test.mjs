import test from 'node:test'
import assert from 'node:assert/strict'
import { createSessionController } from './sessionModel.mjs'
import { quickSetFixture } from './sessionQuickSetFixture.mjs'

function setup(changed) {
  const f = quickSetFixture(), calls = []
  f.p.onSkipSet = (...args) => { calls.push(args) }
  f.p.onSkipExercise = (...args) => { calls.push(args) }
  f.p.onUnskipSet = (...args) => { calls.push(args) }
  const c = createSessionController(() => f.p, changed); c.start()
  return { ...f, c, calls }
}
for (const mode of ['queued', 'parked', 'optimistic', 'confirmed', 'saving']) test(`current ${mode} is never overwritten by skip`, async () => {
  const f = setup(), s = f.c.state(), key = s.key
  if (mode === 'queued') f.p.pendingSyncKeys = [key]
  if (mode === 'parked') f.p.parkedSets = [{ exerciseId: f.exercise.id, setNumber: 1 }]
  if (mode === 'optimistic' || mode === 'confirmed') f.p.exerciseLogs = [{ exercise_id: f.exercise.id, set_number: 1, _optimistic: mode === 'optimistic' }]
  let release
  if (mode === 'saving') {
    f.p.onLogSet = () => new Promise(resolve => { release = resolve })
    void f.c.approve(key, s.input, s.selection.stamp)
  }
  assert.equal(await f.c.skipSet(key, s.selection.stamp), false)
  assert.equal(f.calls.length, 0)
  if (release) release(false)
  f.c.dispose()
})
for (const mode of ['queued', 'parked']) test(`exercise skip excludes rowless future ${mode} slot`, async () => {
  const f = setup(), s = f.c.state()
  if (mode === 'queued') f.p.pendingSyncKeys = [`${f.exercise.id}_3`]
  else f.p.parkedSets = [{ exerciseId: f.exercise.id, setNumber: 3 }]
  assert.equal(f.c.requestSkip(s.key, s.selection.stamp), false)
  assert.equal(await f.c.skipExercise(s.key, s.selection.stamp), false)
  assert.equal(f.calls.length, 0); f.c.dispose()
})
test('explicit confirmation is tied to the exact remaining slots', async () => {
  const f = setup(), s = f.c.state()
  assert.equal(await f.c.skipExercise(s.key, s.selection.stamp), false)
  f.p.exerciseLogs = [{ exercise_id: f.exercise.id, set_number: 3, weight: 40, reps_completed: 5 }]
  assert.equal(f.c.requestSkip(s.key, s.selection.stamp), true)
  f.p.exerciseLogs = []
  assert.equal(await f.c.skipExercise(s.key, s.selection.stamp), false)
  assert.equal(f.calls.length, 0); f.c.dispose()
})
for (const mode of ['owner', 'week', 'plan', 'off', 'preview', 'dispose']) test(`skip revalidates ${mode} after parser and retained calls cannot write`, async () => {
  const f = setup(), s = f.c.state()
  f.p.parsePlannedRpe = () => {
    if (mode === 'owner') f.p.athleteId = 'different'
    if (mode === 'week') f.p.currentWeek = { ...f.p.currentWeek, id: 'different' }
    if (mode === 'plan') f.exercise.sets++
    if (mode === 'off') f.p.enabled = false
    if (mode === 'preview') f.p.readOnly = true
    if (mode === 'dispose') f.c.dispose()
    return 8
  }
  assert.equal(await f.c.skipSet(s.key, s.selection.stamp), false)
  assert.equal(f.calls.length, 0)
  f.c.dispose()
})
test('summary of all skipped sets has no feeling evidence and undo remains source-confirmed', async () => {
  const f = setup()
  f.p.exerciseLogs = f.p.currentWeek.sessions[0].exercises.flatMap(ex =>
    Array.from({ length: ex.sets }, (_, i) => ({ exercise_id: ex.id, set_number: i + 1, skipped: true })))
  const s = f.c.state()
  assert.equal(s.summary, true); assert.equal(s.feeling, null)
  assert.equal(await f.c.unskipSet(`${f.exercise.id}_1`, s.selection.stamp), false)
  assert.equal(f.c.state().next, null)
  assert.equal(f.calls.length, 1)
  assert.equal(await f.c.unskipSet(`${f.exercise.id}_1`, s.selection.stamp), false)
  assert.equal(f.calls.length, 1); f.c.dispose()
})
