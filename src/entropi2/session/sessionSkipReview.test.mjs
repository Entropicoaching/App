import test from 'node:test'
import assert from 'node:assert/strict'
import { createSessionController } from './sessionModel.mjs'

// Independently assembled synthetic oracle for local Codex self-review.
// This is not a substitute for the required fresh separate native reviewer.
test('independent 216-case oracle: occupied slots and current-set selection bound both skip actions', async () => {
  const kinds = ['empty', 'done', 'skipped', 'optimistic', 'queued', 'parked']
  for (const a of kinds) for (const b of kinds) for (const c of kinds) {
    const slots = [a, b, c]
    for (const exercise of [false, true]) {
      const ex = { id: 'independent-ex', name: 'Independent', sets: 3, reps: 7 }
      const week = { id: 'independent-week', athlete_id: 'independent-owner', sessions: [{ id: 'independent-session', exercises: [ex] }] }
      let writes = 0
      const props = { enabled: true, athleteId: week.athlete_id, allWeeks: [week], currentWeek: week,
        exerciseLogs: slots.flatMap((kind, i) => ['done', 'skipped', 'optimistic'].includes(kind)
          ? [{ exercise_id: ex.id, set_number: i + 1, skipped: kind === 'skipped', _optimistic: kind === 'optimistic' }] : []),
        pendingSyncKeys: slots.flatMap((kind, i) => kind === 'queued' ? [`${ex.id}_${i + 1}`] : []),
        parkedSets: slots.flatMap((kind, i) => kind === 'parked' ? [{ exerciseId: ex.id, setNumber: i + 1 }] : []),
        parsePlannedRpe: () => 7,
        onSkipSet(id, n, planned) { writes++; assert.equal(id, ex.id); assert.equal(n, current + 1); assert.equal(planned, 7) },
        onSkipExercise(value) { writes++; assert.equal(value, ex) } }
      const current = slots.findIndex(kind => !['done', 'skipped'].includes(kind))
      const permitted = current >= 0 && slots[current] === 'empty' &&
        (!exercise || !slots.some(kind => ['queued', 'parked'].includes(kind)))
      const ctl = createSessionController(() => props)
      ctl.start()
      const s = ctl.state()
      if (exercise) {
        assert.equal(ctl.requestSkip(s.key, s.selection?.stamp), permitted, slots.join(','))
        await ctl.skipExercise(s.key, s.selection?.stamp)
      } else await ctl.skipSet(s.key, s.selection?.stamp)
      assert.equal(writes, permitted ? 1 : 0, `${exercise}: ${slots}`)
      ctl.dispose()
    }
  }
})

test('independent notification revocation: finishing or changing current slot cancels a not-yet-started skip', async () => {
  for (const mode of ['finish', 'current']) {
    const ex = { id: 'review-ex', sets: 2 }, week = { id: 'review-week', sessions: [{ id: 'review-session', exercises: [ex] }] }
    let calls = 0, ctl, revoke = false
    const p = { enabled: true, athleteId: 'review-owner', allWeeks: [week], currentWeek: week,
      exerciseLogs: [{ exercise_id: ex.id, set_number: 1 }], parsePlannedRpe: () => 8, onSkipSet() { calls++ } }
    ctl = createSessionController(() => p, () => {
      if (!revoke) return
      revoke = false
      if (mode === 'finish') ctl.finish()
      else p.exerciseLogs = []
    })
    ctl.start(); const s = ctl.state(); revoke = true
    assert.equal(await ctl.skipSet(s.key, s.selection.stamp), false)
    assert.equal(calls, 0); ctl.dispose()
  }
})
