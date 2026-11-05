import test from 'node:test'
import assert from 'node:assert/strict'
import { coachAthleteWorkspace } from './coachWorkspaceModel.mjs'

const day = '2026-11-03', athlete = { id: 'synthetic-athlete', name: 'Syntetisk atlet' }
const context = () => ({ day, rosterReady: true, athletes: [athlete], logs: { complete: true, rows: [] },
  inbox: [], messages: { complete: true } })
const report = { ready: false, rows: [] }
const props = () => ({ readContext: { coachId: 'synthetic-coach' }, coachAnalysis: {
  coachId: 'synthetic-coach', day, athleteIds: [athlete.id], state: 'ready', byAthlete: {
    [athlete.id]: { athleteId: athlete.id, day, state: 'ready', complete: true,
      evaluation: { source: 'synthetic' }, plan: { athleteId: athlete.id }, tracking: { asOf: day } }
  }
} })
const model = p => coachAthleteWorkspace(p, context(), athlete, report)

test('no snapshot or optional host receipts leaves analysis absent, without throwing', () => {
  for (const p of [{}, { readContext: {} }, { readContext: { coachId: 'synthetic-coach' } }]) {
    const result = model(p)
    assert.equal(result.evaluation, undefined)
    assert.equal(result.plan, undefined)
    assert.equal(result.tracking, undefined)
    assert.deepEqual(result.signals, [])
    assert.equal(result.error, false)
  }
  const result = coachAthleteWorkspace({}, context(), athlete, { rows: [{ athlete, nutrition: { logged: 2 } }] })
  assert.equal(result.facts.nutrition.from, undefined)
})

test('only current, complete, same-owner and same-athlete receipts expose snapshots', () => {
  const valid = model(props())
  assert.equal(valid.evaluation.source, 'synthetic')
  assert.equal(valid.plan.athleteId, athlete.id)
  assert.equal(valid.tracking.asOf, day)
  for (const mutate of [p => { delete p.readContext }, p => { p.coachAnalysis.coachId = 'foreign' },
    p => { p.coachAnalysis.day = '2026-11-02' }, p => { p.coachAnalysis.athleteIds = [] },
    p => { p.coachAnalysis.byAthlete[athlete.id].athleteId = 'foreign' },
    p => { p.coachAnalysis.byAthlete[athlete.id].complete = false }]) {
    const p = props(); mutate(p); const result = model(p)
    assert.equal(result.evaluation, undefined)
    assert.equal(result.plan, undefined)
    assert.equal(result.tracking, undefined)
  }
})

test('scoped failures show an error and never retain ready snapshots', () => {
  for (const mutate of [p => { p.coachAnalysis.state = 'error' },
    p => { p.coachAnalysis.byAthlete[athlete.id].state = 'error' }]) {
    const p = props(); mutate(p); const result = model(p)
    assert.equal(result.error, true)
    assert.equal(result.evaluation, undefined)
    assert.equal(result.plan, undefined)
    assert.equal(result.tracking, undefined)
  }
})

test('rejected rosters return null; assembly does not mutate captured inputs', () => {
  assert.equal(coachAthleteWorkspace({}, { ...context(), rosterReady: false }, athlete, report), null)
  assert.equal(coachAthleteWorkspace({}, { ...context(), athletes: [] }, athlete, report), null)
  const p = props(), c = context(), before = structuredClone({ p, c })
  coachAthleteWorkspace(p, c, athlete, report)
  assert.deepEqual({ p, c }, before)
})

test('loading, truncated and stale rich receipts leave all optional tools hidden', () => {
  for (const mutate of [p => { p.coachAnalysis.state = 'loading' },
    p => { p.coachAnalysis.byAthlete[athlete.id].state = 'loading' },
    p => { delete p.coachAnalysis.byAthlete[athlete.id].complete },
    p => { p.coachAnalysis.byAthlete[athlete.id].day = '2026-11-02' }]) {
    const p = props(); mutate(p)
    const result = model(p)
    for (const key of ['evaluation', 'plan', 'tracking']) assert.equal(result[key], undefined)
    assert.equal(result.error, false)
  }
})
