import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import AthleteHome from './AthleteHome.mjs'
import { homeModel, startHomeSession, DEFAULT_ENTROPI2_HOME } from './homeModel.mjs'
import { homeWeekOverview } from './homeWeekOverview.mjs'
import { weekSessions } from '../session/weekSessions.mjs'
import { createSessionController, setKey } from '../session/sessionModel.mjs'

// Actual product models and React. Only the parent snapshots/callback and clock
// are synthetic; no writer, queue storage, module substitutes or live services.
function fixture(exerciseId = 'synthetic_pending_lift') {
  const athlete = { id: 'synthetic-pending-athlete' }
  const exercise = { id: exerciseId, name: 'Syntetisk løft', sets: 2, reps: 5, recommended_weight: 40 }
  const session = { id: 'synthetic-pending-session', title: 'Syntetisk pas', weekday: 2, exercises: [exercise] }
  const week = { id: 'synthetic-pending-week', athlete_id: athlete.id, week_number: 1,
    start_date: '2026-11-02', sessions: [session] }
  const starts = [], writes = []
  const p = { enabled: true, athlete, athleteId: athlete.id, now: new Date('2026-11-04T12:00:00Z'),
    allWeeks: [week], currentWeek: week, exerciseLogs: [], pendingSyncKeys: [], parkedSets: [],
    parsePlannedRpe: () => null, logInputs: {}, setLogInputs(update) { p.logInputs = update(p.logInputs) },
    onLogSet(...args) { writes.push(args); return false } }
  const controller = createSessionController(() => p)
  p.onStartSession = (...args) => { starts.push(args); return controller.start() }
  const row = (set_number, extra = {}) => ({ athlete_id: athlete.id, exercise_id: exercise.id,
    set_number, weight: 40, reps_completed: 5, logged_at: '2026-11-04T10:00:00Z', ...extra })
  const key = setKey({ exercise, setNumber: 2 })
  return { p, exercise, session, week, controller, starts, writes, row, key }
}

function read(f) {
  const card = homeModel(f.p), overview = homeWeekOverview(f.p)
  assert.ok(overview?.plan)
  return { card, overview, item: weekSessions(overview.plan).sessions[0], state: f.controller.state() }
}

function assertUnfinished(f, phase) {
  const { card, overview, item, state } = read(f)
  assert.equal(card.kind, 'today')
  assert.equal(card.target.session, f.session)
  assert.equal(card.target.week, f.week)
  assert.equal(card.logged, 1)
  assert.equal(card.total, 2)
  assert.deepEqual([item.status, item.done, item.confirmed, item.skipped, item.dataMissing], ['delvist', 1, 1, 0, false])
  assert.equal(overview.line, 'Ugen: 0 af 1 pas')
  assert.equal(state.session, f.session)
  assert.equal(state.done, 1)
  assert.equal(state.key, f.key)
  assert.equal(state.next.setNumber, 2)
  assert.equal(state.phase, phase)
  assert.equal(state.summary, false)
  assert.equal(state.feeling, null)
  return card
}

for (const guard of ['queued', 'parked']) {
  for (const skipped of [false, true]) {
    test(`pending Home: ${guard} final ${skipped ? 'skipped' : 'logged'} slot retains its start/resume target`, () => {
      const f = fixture()
      f.p.exerciseLogs = [f.row(1)]
      const shown = homeModel(f.p)
      f.p.exerciseLogs = [f.row(1), f.row(2, { skipped })]
      if (guard === 'queued') f.p.pendingSyncKeys = [f.key]
      else f.p.parkedSets = [{ exerciseId: f.exercise.id, setNumber: 2 }]
      // A retained start from before the unconfirmed overlay remains usable.
      assert.equal(startHomeSession(f.p, shown, f.p.now), true)
      const selection = f.controller.state().selection
      assert.equal(assertUnfinished(f, guard).stamp, shown.stamp)
      f.controller.close()
      assert.equal(startHomeSession(f.p, homeModel(f.p), f.p.now), true)
      assert.deepEqual(f.controller.state().selection, selection)
      assertUnfinished(f, guard)
      assert.deepEqual(f.starts, [[f.session.id, f.week.id], [f.session.id, f.week.id]])
      assert.deepEqual(f.writes, [])
    })
  }
}

test('pending Home: queue -> failed/parked retry -> confirmed retry through Home, week and controller', async () => {
  const f = fixture()
  f.p.exerciseLogs = [f.row(1)]
  const shown = homeModel(f.p)
  assert.equal(startHomeSession(f.p, shown, f.p.now), true)
  const selection = f.controller.state().selection
  f.p.onLogSet = (...args) => {
    f.writes.push(args)
    f.p.exerciseLogs = [f.row(1), f.row(2)]
    f.p.pendingSyncKeys = [f.key]
    return { phase: 'queued' }
  }
  const before = f.controller.state()
  assert.equal(await f.controller.approve(before.key, before.input, selection.stamp), false)
  assertUnfinished(f, 'queued')

  // Parent supplies the failed transport's parked snapshot. The real controller
  // must retain its selection; it does not implement the host's retry transport.
  f.p.pendingSyncKeys = []
  f.p.parkedSets = [{ exerciseId: f.exercise.id, setNumber: 2 }]
  f.p.setConfirm = { [f.key]: 'error' }
  f.controller.refresh()
  assertUnfinished(f, 'parked')
  f.controller.close()
  assert.equal(startHomeSession(f.p, shown, f.p.now), true)
  assert.deepEqual(f.controller.state().selection, selection)

  // A failed retry leaves the same slot parked. Neither repeat reads nor a
  // saved-looking indicator may declare completion while that guard exists.
  f.p.setConfirm = { [f.key]: 'saved' }
  f.controller.refresh()
  assertUnfinished(f, 'parked')
  const state = f.controller.state()
  assert.equal(await f.controller.approve(state.key, state.input, selection.stamp), false)
  assert.equal(f.writes.length, 1)

  // During host replay it is queued again; only the confirmed parent snapshot
  // clears both guards. No storage or save implementation is reproduced here.
  f.p.parkedSets = []
  f.p.pendingSyncKeys = [f.key]
  f.controller.refresh()
  assertUnfinished(f, 'queued')
  f.p.exerciseLogs = [f.row(1), f.row(2, { id: 'synthetic-confirmed-retry' })]
  f.p.pendingSyncKeys = []
  f.controller.refresh()
  const { card, overview, item, state: complete } = read(f)
  assert.equal(card.kind, 'done')
  assert.equal(card.target, null)
  assert.deepEqual([item.status, item.done, item.confirmed, item.skipped], ['klaret', 2, 2, 0])
  assert.equal(overview.line, 'Ugen: 1 af 1 pas')
  assert.equal(complete.done, 2)
  assert.equal(complete.next, null)
  assert.equal(complete.summary, true)
  assert.ok(complete.feeling)
  assert.deepEqual(complete.selection, selection)
  assert.equal(startHomeSession(f.p, shown, f.p.now), false)
  assert.equal(f.writes.length, 1)
})

test('pending Home: optimistic rejection and valid confirmed/skipped completion are preserved', () => {
  for (const skipped of [false, true]) {
    const f = fixture()
    f.p.exerciseLogs = [f.row(1), f.row(2, { skipped, _optimistic: true })]
    assert.equal(f.controller.start(), true)
    assertUnfinished(f, 'waiting')
    f.p.exerciseLogs = [f.row(1), f.row(2, { skipped })]
    const { card, overview, item, state } = read(f)
    assert.equal(card.kind, 'done')
    assert.equal(card.target, null)
    assert.deepEqual([item.status, item.done, item.confirmed, item.skipped],
      ['klaret', 2, skipped ? 1 : 2, skipped ? 1 : 0])
    assert.equal(overview.line, 'Ugen: 1 af 1 pas')
    assert.equal(state.done, 2)
    assert.equal(state.summary, true)
  }
})

test('pending Home: exact existing position identity works for underscored and numeric exercise IDs', () => {
  for (const exerciseId of ['synthetic_lift_with_underscores', 42]) {
    for (const guard of ['queued', 'parked']) {
      const f = fixture(exerciseId)
      f.p.exerciseLogs = [f.row(1), f.row(2)]
      if (guard === 'queued') f.p.pendingSyncKeys = [f.key]
      else f.p.parkedSets = [{ exerciseId, setNumber: 2 }]
      assert.equal(f.controller.start(), true)
      assertUnfinished(f, guard)
    }
  }
})

test('pending Home: unrelated positions and alternative identity formats do not block confirmation', () => {
  for (const guard of [
    { pendingSyncKeys: ['synthetic_pending_lift:2'] },
    { pendingSyncKeys: ['synthetic_pending_lift_02'] },
    { pendingSyncKeys: ['synthetic_pending_lift_3', 'synthetic-other-lift_2'] },
    { parkedSets: [{ exercise_id: 'synthetic_pending_lift', set_number: 2 }] },
    { parkedSets: [{ exerciseId: 'synthetic_pending_lift', setNumber: '2' }] },
    { parkedSets: [null, { exerciseId: 'synthetic_pending_lift', setNumber: 3 },
      { exerciseId: 'synthetic-other-lift', setNumber: 2 }] },
  ]) {
    const f = fixture()
    f.p.exerciseLogs = [f.row(1), f.row(2)]
    Object.assign(f.p, guard)
    const card = homeModel(f.p), overview = homeWeekOverview(f.p)
    assert.equal(card.kind, 'done')
    assert.equal(card.target, null)
    assert.equal(weekSessions(overview.plan).sessions[0].status, 'klaret')
    assert.equal(overview.line, 'Ugen: 1 af 1 pas')
  }
})

test('pending Home: missing or non-array guard lists follow the week projection contract', () => {
  for (const value of [undefined, null, {}, 'synthetic_pending_lift_2']) {
    const f = fixture()
    f.p.exerciseLogs = [f.row(1), f.row(2)]
    f.p.pendingSyncKeys = value
    f.p.parkedSets = value
    assert.equal(homeModel(f.p).kind, 'done')
    assert.equal(homeWeekOverview(f.p).line, 'Ugen: 1 af 1 pas')
  }
})

test('pending Home: foreign athlete rows cannot confirm the selected session', () => {
  const f = fixture()
  f.p.exerciseLogs = [f.row(1), f.row(2, { athlete_id: 'synthetic-other-athlete' })]
  assert.equal(f.controller.start(), true)
  assertUnfinished(f, 'idle')
  const shown = homeModel(f.p)
  f.p.athlete = { id: 'synthetic-next-athlete' }
  f.p.athleteId = f.p.athlete.id
  const replacement = { ...f.week, athlete_id: f.p.athlete.id }
  f.p.allWeeks = [replacement]
  f.p.currentWeek = replacement
  f.p.pendingSyncKeys = [f.key]
  f.controller.refresh()
  assert.equal(startHomeSession(f.p, shown, f.p.now), false)
  const card = homeModel(f.p), overview = homeWeekOverview(f.p)
  assert.equal(card.logged, 0)
  assert.equal(card.target.week, replacement)
  assert.equal(weekSessions(overview.plan).sessions[0].done, 0)
  assert.equal(f.controller.state().selection, null)
  assert.deepEqual(f.starts, [])
})

test('pending Home: another session and a future calendar target retain their own positions', () => {
  for (const weekday of [2, 4]) {
    const f = fixture()
    const other = { ...f.session, id: 'synthetic-other-session', weekday,
      exercises: [{ ...f.exercise, id: 'synthetic-other-exercise' }] }
    f.week.sessions.push(other)
    f.p.exerciseLogs = [f.row(1), f.row(2),
      ...[1, 2].map(n => f.row(n, { exercise_id: other.exercises[0].id }))]
    f.p.pendingSyncKeys = [setKey({ exercise: other.exercises[0], setNumber: 2 })]
    if (weekday === 4) f.p.now = new Date('2026-11-05T12:00:00Z')
    const card = homeModel(f.p), overview = homeWeekOverview(f.p)
    assert.equal(card.kind, weekday === 2 ? 'today' : 'next')
    assert.equal(card.target.session, other)
    assert.equal(card.logged, 1)
    assert.equal(overview.line, 'Ugen: 1 af 2 pas')
    assert.deepEqual(weekSessions(overview.plan).sessions.map(s => [s.status, s.done]),
      [['klaret', 2], ['delvist', 1]])
    const starts = []
    f.p.onStartSession = (...args) => { starts.push(args); return true }
    assert.equal(startHomeSession(f.p, card, f.p.now), true)
    assert.deepEqual(starts, [[other.id, f.week.id]])
  }
})

test('pending Home: OFF and unavailable/stale start guards remain effective', () => {
  const f = fixture()
  f.p.exerciseLogs = [f.row(1), f.row(2)]
  f.p.pendingSyncKeys = [f.key]
  f.p.parkedSets = [{ exerciseId: f.exercise.id, setNumber: 2 }]
  const shown = homeModel(f.p)
  assert.equal(DEFAULT_ENTROPI2_HOME, false)
  for (const enabled of [undefined, false, 1, 'true']) {
    const off = { ...f.p, enabled, onStartSession() { assert.fail('OFF start') } }
    assert.equal(startHomeSession(off, shown, f.p.now), false)
    assert.equal(homeWeekOverview(off), null)
    assert.equal(createSessionController(() => off).start(), false)
    assert.equal(renderToStaticMarkup(createElement(AthleteHome, off)), '')
  }
  for (const extra of [{ programError: true }, { programLoading: true }, { onHoliday: true },
    { offlineSnapshotAt: 'synthetic-snapshot' }]) {
    assert.equal(homeModel({ ...f.p, ...extra }).target, null)
    assert.equal(startHomeSession({ ...f.p, ...extra }, shown, f.p.now), false)
  }
  const replacement = { ...f.week, sessions: [{ ...f.session, title: 'Syntetisk ændring' }] }
  assert.equal(startHomeSession({ ...f.p, allWeeks: [replacement], currentWeek: replacement }, shown, f.p.now), false)
  assert.equal(startHomeSession(f.p, shown, new Date('2026-11-05T12:00:00Z')), false)
  assert.deepEqual(f.starts, [])
})

test('pending Home: deeply frozen inputs are unchanged by repeated projections and starts', () => {
  for (const guard of ['queued', 'parked']) {
    const f = fixture()
    f.p.exerciseLogs = [f.row(1), f.row(2)]
    if (guard === 'queued') f.p.pendingSyncKeys = [f.key]
    else f.p.parkedSets = [{ exerciseId: f.exercise.id, setNumber: 2 }]
    const freeze = value => {
      if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.values(value).forEach(freeze)
        Object.freeze(value)
      }
      return value
    }
    freeze(f.p)
    const before = JSON.stringify(f.p)
    for (let i = 0; i < 3; i++) {
      assert.equal(startHomeSession(f.p, homeModel(f.p), f.p.now), true)
      assertUnfinished(f, guard)
    }
    assert.equal(JSON.stringify(f.p), before)
    assert.deepEqual(f.writes, [])
  }
})
