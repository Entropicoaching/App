import { test } from 'node:test'
import assert from 'node:assert/strict'
import { install } from './coachMeetLoader.mjs'
import { state, reset, walk } from './coachMeetFake.mjs'
install()
const { CoachMeetSoon, meetSoonRows, readMeetSource } = await import('./coachMeetSoon.mjs')
const { lavNavigation } = await import('./navigation.js')
const now = new Date('2026-10-28T12:00:00Z')
const athlete = { id: 'a', name: 'Syntetisk atlet', competition_date: '2026-10-28' }
const ready = rows => ({ state: 'ready', day: '2026-10-28', ids: ['a'], rows })
const plan = { athlete_id: 'a', start_date: '2026-10-26', sessions: [{ id: 's' }] }
const status = (plans, logs) => meetSoonRows({ athletes: [athlete], now, data: { plan: ready(plans), logs: ready(logs) } })[0].status

test('counter: ambiguous plans, duplicate session IDs and invalid timestamp cannot report all logged', () => {
  assert.equal(status([plan, plan], []), 'Ugens pas: ingen entydig ugeplan')
  assert.equal(status([{ ...plan, sessions: [{ id: 's' }, { id: 's' }] }], []), 'Ugens pas: ukendt')
  assert.equal(status([plan], [{ athlete_id: 'a', logged_at: '2026-02-30T12:00:00Z', exercises: { sessions: { id: 's' } } }]), 'Ugens pas: ukendt')
  assert.equal(status([{ ...plan, start_date: '2026-10-21' }], []), 'Ugens pas: ingen entydig ugeplan')
})
test('counter: dates are strict, duplicate athletes collapse and ties retain every athlete', () => {
  const b = { ...athlete, id: 'b' }
  const rows = meetSoonRows({ athletes: [b, athlete, athlete, { ...athlete, id: 'x', competition_date: '2026-10-28T12:00:00Z' }], now })
  assert.deepEqual(rows.map(r => r.athlete.id), ['a', 'b'])
  assert.equal(rows[0].days, 0)
})
test('counter: real profile handler receives the athlete and selects program with list return', () => {
  const calls = {}, noop = () => {}
  const props = new Proxy({ analyseTabFactory: () => Promise.resolve(), viewRef: { current: 'profile' }, messageThreadAthleteRef: { current: null }, setSelectedAthlete: value => { calls.athlete = value }, setActiveTab: value => { calls.tab = value }, setView: value => { calls.view = value }, setProfileReturnView: value => { calls.returnView = value } }, { get: (o, key) => key in o ? o[key] : noop })
  const { openProfile } = lavNavigation(props)
  reset(); state.values = [now]
  const tree = CoachMeetSoon({ enabled: true, athletes: [athlete], openProfile })
  walk(tree, n => n.type === 'button')[0].props.onClick()
  assert.deepEqual(calls, { athlete, tab: 'program', view: 'profile', returnView: 'list' })
  assert.equal(props.messageThreadAthleteRef.current, athlete.id)
})
test('counter: opt-in clock ticks and cleans up, OFF clock allocates no timer', () => {
  const originalSet = globalThis.setInterval, originalClear = globalThis.clearInterval
  let tick, cleared, count = 0
  try {
    globalThis.setInterval = fn => { tick = fn; count++; return 42 }
    globalThis.clearInterval = id => { cleared = id }
    reset(); CoachMeetSoon({ enabled: false }); assert.equal(state.effects[0](), undefined); assert.equal(count, 0)
    reset(); state.values = [now]; CoachMeetSoon({ enabled: true, athletes: [] })
    const cleanup = state.effects[0](); tick(); assert.ok(state.values[0] instanceof Date)
    cleanup(); assert.equal(cleared, 42); assert.equal(count, 1)
  } finally { globalThis.setInterval = originalSet; globalThis.clearInterval = originalClear }
})
test('counter: late failed request cannot erase a newer ready source', async () => {
  let data = {}, rejectOld
  const setData = update => { data = update(data) }
  const old = readMeetSource(true, 'logs', ['a'], setData, () => new Promise((resolve, reject) => { rejectOld = reject }))
  await readMeetSource(true, 'logs', ['b'], setData, () => ({ data: [], error: null }))
  rejectOld(new Error('synthetic'))
  await assert.rejects(old)
  assert.equal(data.logs.state, 'ready'); assert.deepEqual(data.logs.ids, ['b'])
})
