// Independent fixtures and lifecycle checks; run in their own node:test process.
import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './prog3Loader.mjs'
import { mount, nodes, text, enableEffects, flushEffects } from './prog3Dom.mjs'
install()
const { default: Program } = await import('./ProgramTab.jsx')
const action = tree => nodes(tree, n => Object.hasOwn(n.props, 'data-program-next'))[0]
const week = (id, number) => ({ id, week_number: number, block_name: number < 4 ? 'Test' : 'Basis',
  sessions: [{ id: id + '-rest', exercises: [] }, { id: id + '-pass', title: 'Testpas', weekday: 0,
    exercises: [{ id: id + '-ex', sets: '1', reps: '3', intensity: 'RPE 7' }] }] })
function fixture() {
  const weeks = [week('old', 0), week('now', 3), week('later', 4)]
  const calls = [], store = new Map()
  let p = { entropi2: true, athlete: { id: 'review-athlete' }, allWeeks: weeks, currentWeek: weeks[1], viewingWeekIdx: 1,
    computeActiveWeekIdx: () => 1, fmtWeekRange: () => null, weekStartDate: () => null, WEEKDAYS_LONG: [],
    exerciseLogs: [], pastLogs: [], sessionRefs: { current: {} }, readinessLog: { readiness_score: 90 },
    fetchProgramBlockLogs: async () => [],
    setViewingWeekIdx: index => { p = { ...p, viewingWeekIdx: index }; calls.push(['week', index]) },
    setProgOpenSession: id => { p = { ...p, progOpenSession: id } },
    setPastLogs: pastLogs => { p = { ...p, pastLogs } }, fetchPastLogs: () => {},
  }
  const view = mount(Program, p)
  return { calls, store, get props() { return p }, update(extra) { p = { ...p, ...extra } }, render: () => view.render(p) }
}
function localStorage(t, store) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true,
    value: { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) } })
  t.after(() => { if (original) Object.defineProperty(globalThis, 'localStorage', original); else delete globalThis.localStorage })
}

test('review: no next target is fabricated while future evidence is loading or failed, including another block', async t => {
  enableEffects()
  const a = fixture(); localStorage(t, a.store)
  let release
  a.update({ exerciseLogs: [{ exercise_id: 'now-ex', set_number: 1 }],
    fetchProgramBlockLogs: () => new Promise(resolve => { release = resolve }) })
  assert.equal(action(a.render()), undefined)
  await flushEffects(); assert.equal(action(a.render()), undefined)
  release(null); await flushEffects(); assert.equal(action(a.render()), undefined)
  a.update({ exerciseLogs: [...a.props.exerciseLogs], fetchProgramBlockLogs: async () => [] })
  a.render(); await flushEffects()
  assert.match(text(action(a.render())), /Næste pas · Testpas/)
  action(a.render()).props.onClick()
  assert.equal(a.props.viewingWeekIdx, 2, 'next block is reachable from production-shaped evidence')
  assert.equal(a.props.progOpenSession, 'later-pass')
})

test('review: saved identity waits for the new athlete program, and refresh does not reopen an old selection', async t => {
  enableEffects()
  const a = fixture(); localStorage(t, a.store)
  a.store.set('entropi2:athlete:second:program:last-week', '"second-old"')
  a.render(); await flushEffects(); a.render()
  a.update({ athlete: { id: 'second' } })
  a.render(); await flushEffects(); a.render()
  assert.deepEqual(a.calls, [])
  const weeks = [week('second-old', 0), week('second-current', 1)]
  a.update({ allWeeks: weeks, currentWeek: weeks[1] })
  a.render(); await flushEffects(); a.render()
  assert.equal(a.props.viewingWeekIdx, 0)
  a.update({ viewingWeekIdx: 1, allWeeks: [...weeks] })
  a.render(); await flushEffects(); a.render()
  assert.equal(a.props.viewingWeekIdx, 1, 'subsequent refresh respects parent navigation')
  assert.equal(a.store.size, 1, 'only explicit navigation can write the new preference')
})
