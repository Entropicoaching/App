import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { homeProgramReadSetters, retryHomeProgram } from './homeProgramRead.mjs'
import { homeModel } from './homeModel.mjs'
import { homeWeekOverview } from './homeWeekOverview.mjs'
import { fixture } from './homeProgramReadFixture.mjs'

const boundary = new URL('./homeProgramReadFixture.mjs', import.meta.url).href
const loader = registerHooks({ resolve(specifier, context, next) {
  if (/\/(?:supabase)(?:\.js)?$/.test(specifier)) return { shortCircuit: true, url: boundary }
  return next(specifier, context)
} })
test.after(() => loader.deregister())
const { lavLaesninger } = await import('../../athlete/laesninger.js')
const athlete = { id: 'synthetic-program-athlete' }
const now = new Date('2026-11-04T12:00:00Z')
const week = { id: 'synthetic-program-week', athlete_id: athlete.id, start_date: '2026-11-02', week_number: 1,
  sessions: [{ id: 'synthetic-program-session', weekday: 2, exercises: [{ id: 'synthetic-program-exercise', sets: 1 }] }] }
function setup(extra = {}) {
  const state = { enabled: true, athlete, now, programLoading: true, programError: false, currentWeek: null,
    allWeeks: [], exerciseLogs: [], ...extra }
  const set = name => value => { state[name] = typeof value === 'function' ? value(state[name]) : value }
  const noop = () => {}
  const setters = homeProgramReadSetters({ onReadError: () => noop,
    ...Object.fromEntries(['programError','programLoading','allWeeks','currentWeek','offlineSnapshotAt']
      .map(name => ['set' + name[0].toUpperCase() + name.slice(1), set(name)])) })
  const otherSetters = Object.fromEntries(['ExerciseLogs','LastLogByExerciseName','ExerciseHistory','WeeklyTonnage','LiftProgress',
    'ViewingWeekIdx','UgensLogsHentet','LogInputs'].map(name => ['set' + name, noop]))
  // No session/user capability: the copied reader cannot persist an offline snapshot.
  const reader = lavLaesninger({ athlete, onReadError: () => noop, ...otherSetters, ...setters })
  fixture.calls = []
  return { state, setters, retrySetters: { setProgramError: set('programError'), setProgramLoading: set('programLoading') },
    read: () => reader.fetchProgram(athlete.id) }
}
const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }

test('initial read is loading; confirmed empty is empty, never an error', async () => {
  const f = setup()
  assert.equal(homeModel(f.state).kind, 'loading')
  fixture.result = { data: [], error: null }
  await f.read()
  assert.equal(f.state.programLoading, false)
  assert.equal(homeModel(f.state).kind, 'no-program')
  assert.equal(f.state.programError, false)
  assert.deepEqual(fixture.calls.filter(row => row[0] === 'weeks'), [
    ['weeks','select','*, sessions(*, exercises(*))'], ['weeks','eq','athlete_id',athlete.id],
    ['weeks','order','week_number',{ ascending: true }]])
})

test('actual reader failure preserves known content; successful empty retry clears it', async () => {
  const f = setup({ allWeeks: [week], currentWeek: week })
  fixture.result = { data: null, error: { message: 'synthetic transport failure' } }
  await f.read()
  assert.equal(f.state.programLoading, false)
  assert.equal(f.state.programError, true)
  assert.equal(f.state.currentWeek, week)
  assert.equal(homeModel(f.state).target, null)
  fixture.result = { data: [], error: null }
  await f.read()
  assert.deepEqual(f.state.allWeeks, [])
  assert.equal(f.state.currentWeek, null)
  assert.equal(homeModel(f.state).kind, 'no-program')
})

test('actual populated retry restores the next session and clears the offline restriction', async () => {
  const f = setup({ programError: true, offlineSnapshotAt: 123 })
  fixture.result = { data: structuredClone([week]), error: null }
  await f.read(); await settle()
  assert.equal(f.state.programError, false)
  assert.equal(f.state.programLoading, false)
  assert.equal(f.state.offlineSnapshotAt, null)
  assert.equal(homeModel(f.state).target.session.id, week.sessions[0].id)
})

test('partial week reads hide stale counts and start targets until the active week settles', () => {
  const f = setup({ programLoading: false, allWeeks: [week], currentWeek: week })
  f.setters.setProgramError(false)
  f.setters.setAllWeeks([week])
  assert.equal(f.state.currentWeek, week, 'A populated read keeps the original active-week sequence')
  assert.equal(f.state.programLoading, true)
  assert.equal(homeModel(f.state).target, null)
  assert.equal(homeWeekOverview(f.state), null)
  f.setters.setCurrentWeek(week)
  assert.equal(f.state.programLoading, false)
  assert.ok(homeWeekOverview(f.state))
})

test('every actual program read exposes loading before its deferred query settles', async () => {
  const f = setup({ programLoading: false, allWeeks: [week], currentWeek: week })
  let resolve
  fixture.result = new Promise(done => { resolve = done })
  const read = f.read()
  assert.equal(f.state.programLoading, true)
  assert.equal(homeModel(f.state).target, null)
  resolve({ data: [], error: null }); await read
  assert.equal(f.state.programLoading, false)
  assert.equal(homeModel(f.state).kind, 'no-program')
})

test('athlete-only offline snapshots finish loading without inventing a program', () => {
  const f = setup()
  f.setters.setOfflineSnapshotAt(123)
  assert.equal(f.state.programLoading, false)
  assert.equal(homeModel(f.state).kind, 'missing')
  assert.deepEqual(f.state.allWeeks, [])
})

test('thrown retry resets loading and retains a retryable generic program error', async () => {
  const f = setup({ programLoading: false })
  await retryHomeProgram(() => { throw Error('synthetic programmer/transport failure') }, f.retrySetters)
  assert.equal(f.state.programLoading, false)
  assert.equal(f.state.programError, true)
  fixture.result = { data: [], error: null }
  await retryHomeProgram(f.read, f.retrySetters)
  assert.equal(f.state.programError, false)
  assert.equal(homeModel(f.state).kind, 'no-program')
})
