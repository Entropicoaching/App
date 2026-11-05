import test from 'node:test'
import assert from 'node:assert/strict'
import { loadViews, seed, render, named, session, ownAthlete, otherAthlete } from '../../athlete/coachOwnTrainingFixture.mjs'
import { homeRecord } from './homeRecord.mjs'

// Actual copied AthleteView -> HomeSession -> Home props; no service, effects,
// browser or real profile. Genuine React rendering has its own explicit gate.
const { default: AthleteView, dispose } = await loadViews()
test.after(dispose)
const now = new Date('2026-11-05T12:00:00Z')
function homeFor(athlete, role) {
  const week = { id: 'synthetic-record-week', athlete_id: athlete.id, start_date: '2026-11-02', block_name: 'Styrke',
    sessions: [{ id: 'synthetic-record-session', exercises: [{ id: 'synthetic-record-squat', name: 'Squat', sets: 1 }] }] }
  seed({ athlete, currentWeek: week, allWeeks: [week],
    exerciseLogsStatus: { athleteId: athlete.id, weekId: week.id, loading: false, error: false }, exerciseLogs: [{ athlete_id: athlete.id,
    exercise_id: 'synthetic-record-squat', set_number: 1, weight: 140, reps_completed: 3, logged_at: '2026-11-04T12:00:00Z' }] })
  const tree = render(AthleteView, { role, session,
    ...(role === 'coach' ? { coachAthleteId: athlete.id, onExitPreview() {} } : {}) })
  const wrapper = named(tree, 'HomeSession')
  assert.ok(wrapper)
  return named(wrapper.type(wrapper.props), 'AthleteHome').props
}

test('actual athlete and coach own-training adapters supply all existing record inputs without a new host contract', () => {
  for (const role of ['athlete', 'coach']) {
    const props = homeFor(ownAthlete, role)
    assert.equal(props.sessionReadOnly, false)
    assert.equal(typeof props.onLogSet, 'function'); assert.equal(typeof props.setLogInputs, 'function')
    assert.equal(homeRecord(props, { status: 'ready', complete: true, athleteId: ownAthlete.id, rows: [
      { athlete_id: ownAthlete.id, exercise_id: 'synthetic-prior', set_number: 1, weight: 130, reps_completed: 3,
        logged_at: '2026-10-01T12:00:00Z', exercises: { name: 'Squat', sessions: { weeks: { block_name: 'Styrke' } } } },
    ] }, now).weight, 140)
  }
})

test('actual another-athlete preview denies the record model before inspecting history', () => {
  const props = homeFor(otherAthlete, 'coach')
  assert.equal(props.sessionReadOnly, true)
  assert.equal(homeRecord(props, new Proxy({}, { get() { assert.fail('preview history access') } }), now), null)
})
