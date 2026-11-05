import test from 'node:test'
import assert from 'node:assert/strict'
import { analysisSessions, analysisIntensity } from './analysisSnapshots.mjs'
import { weeklyIntensity } from './intensitet/intensityModel.mjs'
import { analysisMineData } from './analysisMineData.mjs'
import { mineDataModel } from '../athlete/minedata/mineDataModel.mjs'

const now = new Date('2026-11-04T12:00:00Z')
const row = extra => ({ exercise_id: 'e', set_number: 1, logged_at: '2026-11-03T12:00:00Z',
  weight: 80, reps_completed: 3, ...extra })
const props = extra => ({ athlete: { id: 'synthetic-a' }, fremgangLogs: [], exerciseLogs: [row()],
  currentWeek: { start_date: '2026-11-02', sessions: [{ id: 's', exercises: [{ id: 'e', sets: 1 }] }] }, ...extra })

test('session bridge counts only fully confirmed positions of the displayed week', () => {
  const p = props(), source = analysisSessions(p, now)
  assert.equal(source.state, 'ready'); assert.equal(source.rows.length, 1)
  const bridge = analysisMineData(p, now)
  assert.equal(mineDataModel(bridge).sessions.completed, 1)
  assert.equal(bridge.sessionsLabel, 'Pas i den viste programuge')
  for (const exerciseLogs of [[], [row({ skipped: true })], [row({ pending: true })],
    [row(), row({ _optimistic: true })], [row(), row({ weight: 99 })],
    [row({ athlete_id: 'foreign' })], [row({ set_number: 2 })], [row({ reps_completed: 0 })],
    [row({ logged_at: '2026-11-01' })], [row({ logged_at: '2026-11-04T13:00:00Z' })],
    [row({ logged_at: '2026-02-30' })]]) {
    assert.equal(analysisSessions(props({ exerciseLogs }), now).rows.length, 0)
  }
  assert.equal(analysisSessions(props({ exerciseLogs: [row(), row()] }), now).rows.length, 1)
})

test('session missing, loading, errors and invalid program structure never fabricate zero', () => {
  for (const extra of [{ exerciseLogs: undefined }, { currentWeek: null },
    { currentWeek: { start_date: '2026-02-30', sessions: [] } },
    { currentWeek: { start_date: '2026-09-01', sessions: [] } },
    { currentWeek: { start_date: '2026-11-09', sessions: [] } },
    { currentWeek: { start_date: '2026-11-02', sessions: [{ exercises: [] }] } }])
    assert.equal(analysisSessions(props(extra), now).state, 'unavailable')
  assert.equal(analysisSessions(props({ exerciseLogsLoading: true }), now).state, 'loading')
  assert.equal(analysisSessions(props({ exerciseLogsError: true }), now).state, 'error')
  const p = props(); p.currentWeek.sessions.push(p.currentWeek.sessions[0])
  assert.equal(analysisSessions(p, now).state, 'unavailable')
})

test('intensity bridge keeps external references, unknowns and local undo authoritative', () => {
  const p = props({ fremgangLogs: [row({ weight: 999 })], exerciseLogs: [row({ reference_e1rm: 100 })] })
  const model = weeklyIntensity(analysisIntensity(p), now)
  assert.equal(model.weeks[3].classified, 1)
  assert.equal(model.weeks[3].zones.find(z => z.key === '80to90').count, 1)
  assert.equal(weeklyIntensity(analysisIntensity(props()), now).weeks[3].unknown, 1)
  assert.deepEqual(analysisIntensity({ ...p, exerciseLogs: [] }), [])
  assert.deepEqual(analysisIntensity({ ...p, exerciseLogs: [row(), row({ pending: true })] }), [])
  assert.deepEqual(analysisIntensity(props({ exerciseLogs: [row({ athlete_id: 'foreign' })] })), [])
  for (const extra of [{ fremgangLoading: true }, { fremgangError: true },
    { exerciseLogsLoading: true }, { exerciseLogsError: true }, { fremgangLogs: undefined }])
    assert.equal(analysisIntensity(props(extra)), undefined)
})

test('read-only bridge leaves deeply frozen synthetic snapshots unchanged', () => {
  const p = props(), before = JSON.stringify(p)
  const freeze = x => { if (x && typeof x === 'object') { Object.values(x).forEach(freeze); Object.freeze(x) } }
  freeze(p); analysisSessions(p, now); analysisIntensity(p); analysisMineData(p, now)
  assert.equal(JSON.stringify(p), before)
})
