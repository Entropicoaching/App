import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './opvarmStigeLoader.mjs'
import { mount, nodes, text } from './opvarmStigeDom.mjs'
install()
const { default: Program, loadWarmupChecked, saveWarmupChecked } = await import('./ProgramTab.jsx')

function fakeStorage() {
  const map = new Map()
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)) },
    removeItem: k => { map.delete(k) },
  }
}
function props(extra = {}) {
  const exercise = { id: 'ex', name: 'Squat', recommended_weight: 100, sets: 1, reps: '3' }
  const week = { id: 'week', week_number: 1, sessions: [{ id: 'session', title: 'Dagens pas', exercises: [exercise] }] }
  return {
    opvarmStige: false, allWeeks: [week], currentWeek: week, viewingWeekIdx: 0, computeActiveWeekIdx: () => 0,
    athlete: { id: 'synthetic' }, exerciseLogs: [], pastLogs: [], progOpenSession: 'session',
    readinessLog: { readiness_score: 90 }, sessionRefs: { current: {} }, dismissedFeedback: new Set(),
    feedbackInputs: {}, logInputs: {}, setConfirm: {}, exWarmupExpanded: new Set(['ex']), warmupChecked: {},
    exWarmupWeightOverride: {}, exerciseHistory: {}, lastLogByExerciseName: {}, fmtWeekRange: () => '',
    weekStartDate: () => '2026-10-26', suggestWarmupOverride: () => null,
    calcWarmupSets: () => [{ weight: 20, reps: 5, pct: 'Stang' }], parsePlannedRpe: () => null,
    setWarmupChecked: () => {}, ...extra,
  }
}
const row = tree => nodes(tree, n => typeof n.props.onClick === 'function' && text(n).includes('Stang'))
  .find(n => n.type === 'div' && n.props.style?.cursor === 'pointer')
const ticked = tree => text(row(tree)).includes('✓')

test('flueben i opvarmningen overlever genmontering samme dag og ryddes ved ny dato', t => {
  const storage = fakeStorage()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
  t.after(() => { delete globalThis.localStorage })
  let state = {}
  const setWarmupChecked = fn => { state = fn(state) }
  let app = mount(Program, props({ warmupChecked: state, setWarmupChecked }))
  assert.equal(ticked(app.render()), false)
  row(app.render()).props.onClick()
  app.unmount()
  state = {}
  app = mount(Program, props({ warmupChecked: state, setWarmupChecked }))
  assert.equal(ticked(app.render()), true, 'fluebenet skal staa efter genmontering')
  row(app.render()).props.onClick()
  app.unmount()
  app = mount(Program, props({ warmupChecked: {}, setWarmupChecked }))
  assert.equal(ticked(app.render()), false, 'afkrydsning fjernet med et tryk til')
  app.unmount()
})

test('hjaelperen gemmer pr. atlet og dato, rydder ved ny dato og sluger lagringsfejl', () => {
  const storage = fakeStorage()
  const dag = new Date('2026-11-20T12:00:00')
  const naeste = new Date('2026-11-21T08:00:00')
  assert.equal(saveWarmupChecked('a1', { ex: { ws_0: true } }, dag, storage), true)
  assert.deepEqual(loadWarmupChecked('a1', dag, storage), { ex: { ws_0: true } })
  assert.deepEqual(loadWarmupChecked('a2', dag, storage), {})
  assert.deepEqual(loadWarmupChecked('a1', naeste, storage), {})
  assert.deepEqual(loadWarmupChecked('a1', dag, storage), {})
  const defekt = { getItem() { throw Error('x') }, setItem() { throw Error('x') }, removeItem() { throw Error('x') } }
  assert.equal(saveWarmupChecked('a1', {}, dag, defekt), false)
  assert.deepEqual(loadWarmupChecked('a1', dag, defekt), {})
  assert.deepEqual(loadWarmupChecked('', dag, storage), {})
})
