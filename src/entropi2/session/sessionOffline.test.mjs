import './sessionSaveRegister.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { mountSession } from './sessionView.mjs'
import { dom } from './a11y-dom.mjs'
import { loadOfflineSets, saveOfflineSet, newSetClientId, overlayQueuedSets } from '../../offlineSetQueue.js'
import { markNetworkFailure, markNetworkSuccess } from '../../offlineSession.js'
import { rows, calls, reset, mode } from './sessionSaveBoundary.mjs'
const { lavSaetSkrivning } = await import('../../athlete/saetSkrivning.js')

function setup(t, online = true) {
  reset(); markNetworkSuccess()
  const values = new Map(), storage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) }
  for (const [key, value] of [['localStorage', storage], ['navigator', { onLine: online }]]) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key)
    Object.defineProperty(globalThis, key, { configurable: true, value, writable: true })
    t.after(() => { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] })
  }
  const ex = { id: 'lift', name: 'Løft', sets: 3, reps: 5, recommended_weight: 80 }
  const week = { id: 'week', athlete_id: 'synthetic-a', sessions: [{ id: 'session', exercises: [ex] }] }
  const p = { enabled: true, athleteId: 'synthetic-a', currentWeek: week, allWeeks: [week],
    exerciseLogs: [], logInputs: {}, pendingSyncKeys: [], setConfirm: {}, parsePlannedRpe: () => null }
  const set = name => value => { p[name] = typeof value === 'function' ? value(p[name]) : value }
  p.setLogInputs = set('logInputs')
  const ref = { current: {} }, noop = () => {}
  const handlers = () => lavSaetSkrivning({ athlete: { id: p.athleteId }, allWeeks: p.allWeeks, currentWeek: p.currentWeek,
    exerciseLogs: p.exerciseLogs, logInputs: p.logInputs, feedbackInputs: {}, setWriteRef: ref,
    setExerciseLogs: set('exerciseLogs'), setLogInputs: p.setLogInputs, setSetConfirm: set('setConfirm'),
    setPendingSyncCount() { p.pendingSyncKeys = Object.keys(loadOfflineSets(p.athleteId, storage)) },
    setLastLoggedSet: noop, setRestPause: noop, fetchExerciseLogs: noop, setPrToast: noop, setPrToastFading: noop, showFlash: noop })
  p.onLogSet = (...args) => handlers().logDagensPasSet(...args)
  const root = dom(), view = mountSession(root, () => p, { clock: { Date, setInterval: () => 1, clearInterval: noop } })
  t.after(() => { view.dispose(); markNetworkSuccess() })
  view.controller.start()
  const approve = () => { const s = view.controller.state(); return view.controller.approve(s.key,
    { weight: '82,5', reps: '5', rpe: '', note: 'Teknik' }, s.selection.stamp) }
  return { root, p, ex, view, storage, handlers, approve, values }
}

test('actual controller + renderer + existing callback queue offline, show waiting and replay on recovery', async t => {
  const f = setup(t, false)
  assert.equal(await f.approve(), false)
  assert.match(f.root.textContent, /Venter på net/)
  assert.equal(f.view.controller.state().done, 0)
  assert.equal(f.p.setConfirm.lift_1, undefined)
  assert.equal(f.p.exerciseLogs.length, 0)
  assert.equal(calls.length, 0)
  const entry = loadOfflineSets('synthetic-a', f.storage).lift_1
  assert.equal(entry.payload.weight, 82.5); assert.equal(entry.payload.rpe_actual, null)
  assert.equal(entry.payload.note, 'Teknik')
  f.view.controller.close(); f.view.controller.start()
  assert.match(f.root.textContent, /Venter på net/)
  globalThis.navigator.onLine = true
  await f.handlers().flushOfflineSets(); f.view.update()
  assert.equal(rows.size, 1); assert.equal([...rows.keys()][0], entry.clientId)
  assert.equal(f.view.controller.state().done, 1)
  assert.equal(f.view.controller.state().next.setNumber, 2)
  assert.equal(f.p.setConfirm.lift_1, 'saved')
})

test('lost reply, replay and repeat flush use one server row and preserve approval time', async t => {
  const f = setup(t); mode('lost')
  await f.approve()
  assert.equal(rows.size, 1); assert.equal(f.view.controller.state().done, 0)
  const entry = loadOfflineSets('synthetic-a', f.storage).lift_1
  await f.handlers().flushOfflineSets(); await f.handlers().flushOfflineSets(); f.view.update()
  assert.equal(rows.size, 1)
  assert.equal([...rows.values()][0].logged_at, entry.payload.logged_at)
  assert.equal(calls.filter(c => c.op === 'insert').length, 1)
  assert.equal(f.view.controller.state().done, 1)
})

test('queue replay probes remembered bad wifi, stays ordered and concurrent flushes send once', async t => {
  const f = setup(t, false)
  await f.approve()
  const first = loadOfflineSets('synthetic-a', f.storage).lift_1
  saveOfflineSet('synthetic-a', 'lift_2', { ...first, setNumber: 2, clientId: newSetClientId() }, f.storage)
  globalThis.navigator.onLine = true; markNetworkFailure(); mode('throw')
  await f.handlers().flushOfflineSets()
  assert.equal(rows.size, 0)
  assert.equal(calls.length, 1, 'failed head stops the round')
  mode('ok')
  await Promise.all([f.handlers().flushOfflineSets(), f.handlers().flushOfflineSets()])
  assert.deepEqual(calls.filter(c => c.op === 'insert').map(c => c.body.set_number), [1, 2])
  assert.equal(rows.size, 2)
})

test('storage denial keeps input and actionable error; OFF and retained approval never write', async t => {
  const f = setup(t, false)
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw Error('blocked') } })
  await f.approve()
  assert.match(f.root.textContent, /kunne ikke gemmes lokalt/)
  assert.equal(f.view.controller.state().phase, 'error')
  assert.equal(f.p.logInputs.lift_1.weight, '82.5')
  assert.equal(f.p.exerciseLogs.length, 0)
  await f.handlers().flushOfflineSets() // Denied getter also cannot break automatic retry.
  const old = f.view.controller.state(); f.p.enabled = false; f.view.update()
  assert.equal(await f.view.controller.approve(old.key, old.input, old.selection.stamp), false)
  assert.equal(calls.length, 0); assert.equal(f.root.hidden, true)
})

test('pending real-looking rows cannot count as saved or unlock completion', t => {
  const f = setup(t)
  f.p.exerciseLogs = [1, 2, 3].map(set_number => ({ athlete_id: 'synthetic-a', exercise_id: 'lift', set_number }))
  f.p.pendingSyncKeys = ['lift_1']; f.view.update()
  assert.equal(f.view.controller.state().done, 2)
  assert.equal(f.view.controller.state().next.setNumber, 1)
  assert.equal(f.view.controller.state().feeling, null)
})

test('freshly mounted session shows exact queued weight, reps, missing RPE and note after reload', async t => {
  const f = setup(t, false)
  await f.approve(); f.view.dispose()
  f.p.logInputs = {}
  f.p.exerciseLogs = overlayQueuedSets([], loadOfflineSets('synthetic-a', f.storage), 'synthetic-a')
  const root = dom(), view = mountSession(root, () => f.p, { clock: { Date, setInterval: () => 1, clearInterval() {} } })
  t.after(() => view.dispose()); view.controller.start()
  assert.equal(root.querySelector('[data-field="weight"]').value, '82.5')
  assert.equal(root.querySelector('[data-field="reps"]').value, '5')
  assert.equal(root.querySelector('[data-field="rpe"]').value, '')
  assert.equal(root.querySelector('textarea').value, 'Teknik')
  assert.match(root.textContent, /Venter på net/)
  assert.equal(view.controller.state().done, 0)
})
