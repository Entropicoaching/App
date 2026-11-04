import test from 'node:test'
import assert from 'node:assert/strict'
import { fremgangSnapshot } from './fremgangSnapshot.mjs'
import { buildAthleteOverview } from './overview.mjs'
const props = extra => ({ enabled: true, athleteId: 'synthetic-a', now: '2026-11-04T12:00:00Z', ...extra })
const snapshot = (extra = {}) => Object.defineProperties({ athleteId: 'synthetic-a', endDate: '2026-11-03',
  status: 'ready', complete: true, dailyRows: [] }, Object.getOwnPropertyDescriptors(extra))

test('OFF does not read identity, time or snapshot', () => {
  for (const enabled of [undefined, false, 'true', 1]) assert.equal(fremgangSnapshot({ enabled,
    get snapshot() { throw Error('read') }, get now() { throw Error('clock') } }), null)
})
test('missing source, identity, date and switched athlete remain unavailable', () => {
  for (const change of [{}, { snapshot: snapshot({ athleteId: 'other' }) },
    { snapshot: snapshot({ endDate: '2026-11-04' }) }, { now: undefined, snapshot: snapshot() },
    { athleteId: undefined, snapshot: snapshot() }])
    assert.equal(fremgangSnapshot(props(change)).status, 'unavailable')
})
test('loading and error never read partial payload; incomplete is not empty', () => {
  for (const status of ['loading', 'error', 'ready']) {
    const input = snapshot({ status, complete: false, get dailyRows() { throw Error('partial') } })
    assert.equal(fremgangSnapshot(props({ snapshot: input })).status, status === 'loading' ? 'loading' : 'error')
  }
})
test('canonical complete source reaches actual overview, ignores cycle and unrelated collections', () => {
  const dailyRows = [0, 1, 2, 3].map(i => Object.freeze({ athlete_id: 'synthetic-a', source: 'athlete_manual',
    logged_date: `2026-11-0${i + 1}`, sleep_hours: 0, energy: 2, stress: 3, soreness: 0 }))
  const input = snapshot({ dailyRows: Object.freeze(dailyRows),
    get cycle() { throw Error('private') }, get exerciseLogs() { throw Error('outside projection') } })
  Object.freeze(input)
  const result = buildAthleteOverview(fremgangSnapshot(props({ snapshot: input })), { enabled: true })
  assert.equal(result.status, 'ready'); assert.equal(result.to, '2026-11-03')
  assert.equal(result.weeks.at(-1).wellbeing[0].count, 3)
  assert.equal(result.weeks.at(-1).wellbeing[0].days.at(-1).value, 0)
  assert.equal(JSON.stringify(result).includes('cycle'), false)
  const empty = buildAthleteOverview(fremgangSnapshot(props({ snapshot: snapshot() })), { enabled: true })
  assert.equal(empty.status, 'empty')
  const foreign = snapshot({ dailyRows: [{ athlete_id: 'other' }] })
  assert.equal(buildAthleteOverview(fremgangSnapshot(props({ snapshot: foreign })), { enabled: true }).status, 'error')
})
test('Copenhagen midnight and DST choose last complete calendar day', () => {
  const p = props({ now: '2026-10-25T23:30:00Z', snapshot: snapshot({ endDate: '2026-10-25' }) })
  assert.equal(fremgangSnapshot(p).endDate, '2026-10-25')
})
