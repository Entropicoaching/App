import test from 'node:test'
import assert from 'node:assert/strict'
import { mountExerciseHistory, sessionHistoryProps } from './exerciseHistoryDom.mjs'
import { exerciseHistoryContent } from './exerciseHistoryContent.mjs'
import { historyTestDom } from './historyTestDom.mjs'
import { mountSession } from '../sessionView.mjs'

const now = Date.parse('2026-11-04T12:00:00Z')
const ex = { id: 'lift', name: 'Løft', sets: 2, reps: 5, recommended_weight: 80 }
const row = { id: 'old', athlete_id: 'synthetic-a', exercise_id: 'lift', set_number: 20,
  weight: 80, reps_completed: 5, logged_at: '2026-10-28T10:00:00Z' }
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
const tick = () => new Promise(resolve => setImmediate(resolve))
function fixture(onRetry) {
  const root = historyTestDom()
  const p = { athleteId: 'synthetic-a', exerciseLogs: [row], exerciseLogsError: true, onRetryExerciseLogs: onRetry }
  let active = true
  const dispose = mountExerciseHistory(root, { detail: 'retry', read: () => sessionHistoryProps(p, ex, now),
    active: () => active, open: true })
  return { root, p, dispose, deactivate: () => { active = false } }
}
const retryButton = root => root.querySelectorAll('button').find(n => n.textContent === 'Hent igen')
const h = (tag, props, ...children) => ({ tag, props: props || {}, children: children.flat().filter(Boolean) })
function buttons(tree) { return tree ? [...(tree.tag === 'button' ? [tree] : []), ...(tree.children || []).flatMap(buttons)] : [] }

test('shared React/native content wires a real callback only for an actionable error; loading wins over old error', () => {
  let calls = 0
  const p = sessionHistoryProps({ athleteId: 'synthetic-a', exerciseLogs: [row], exerciseLogsError: true,
    onRetryExerciseLogs() { calls++ } }, ex, now)
  assert.equal(p.onRetry instanceof Function, true)
  const tree = exerciseHistoryContent(h, p), [button] = buttons(tree)
  assert.equal(button.children[0], 'Hent igen'); assert.equal(button.props.type, 'button')
  assert.ok(button.props.style.minHeight >= 44)
  assert.equal(calls, 0); button.props.onClick(); assert.equal(calls, 1)
  assert.equal(buttons(exerciseHistoryContent(h, { ...p, onRetry: undefined })).length, 0)
  assert.equal(buttons(exerciseHistoryContent(h, { ...p, loading: true })).length, 0)
  assert.equal(exerciseHistoryContent(h, { enabled: false, get onRetry() { assert.fail('OFF callback read') } }), null)
})

test('native retry calls the current reader, prevents duplicate requests and replaces loading with fresh confirmed sets', async () => {
  const job = deferred(); let calls = 0
  const f = fixture(() => { assert.fail('obsolete reader') })
  f.p.onRetryExerciseLogs = async () => { calls++; await job.promise; f.p.exerciseLogsError = false; f.p.exerciseLogs = [{ ...row, weight: 85 }] }
  const old = retryButton(f.root)
  assert.equal(old.attributes.onClick, undefined); assert.match(f.root.textContent, /Historikken kunne ikke vises/)
  old.click(); old.click(); assert.equal(calls, 1)
  assert.match(f.root.textContent, /Historikken hentes/); assert.doesNotMatch(f.root.textContent, /80 kg|85 kg|kunne ikke vises/)
  assert.equal(retryButton(f.root), undefined)
  job.resolve(); await tick()
  assert.match(f.root.textContent, /85 kg × 5/); assert.doesNotMatch(f.root.textContent, /80 kg|Historikken hentes|Hent igen/)
  assert.equal(f.root.querySelector('details').open, true)
  assert.equal(f.root.ownerDocument.activeElement, f.root.querySelector('h2'))
  old.click(); assert.equal(calls, 1)
  f.dispose(); old.click(); assert.equal(calls, 1)
})

test('throw, rejected promise and explicit false stay generic, hide stale values and remain retryable', async () => {
  for (const failure of [() => { throw Error('RAW SECRET') }, () => Promise.reject(Error('RAW SECRET')), () => false]) {
    const f = fixture(failure)
    retryButton(f.root).click(); await tick()
    assert.match(f.root.textContent, /Historikken kunne ikke vises|Hent igen/)
    assert.doesNotMatch(f.root.textContent, /RAW SECRET|80 kg|Historikken hentes/)
    assert.equal(f.root.ownerDocument.activeElement, retryButton(f.root))
    f.p.onRetryExerciseLogs = () => { f.p.exerciseLogsError = false; f.p.exerciseLogs = [] }
    retryButton(f.root).click(); await tick()
    assert.equal(f.root.querySelector('details'), null)
    f.dispose()
  }
})

test('closed, inactive and disposed controls cannot read again; late responses cannot alter a replacement athlete view', async () => {
  for (const kind of ['closed', 'inactive', 'disposed']) {
    let calls = 0
    const f = fixture(() => { calls++ }), old = retryButton(f.root)
    if (kind === 'closed') f.root.querySelector('details').open = false
    if (kind === 'inactive') f.deactivate()
    if (kind === 'disposed') f.dispose()
    old.click(); assert.equal(calls, 0); f.dispose()
  }
  const job = deferred(); let calls = 0
  const f = fixture(async () => { calls++; await job.promise })
  const old = retryButton(f.root); old.click(); f.dispose()
  const stop = mountExerciseHistory(f.root, { detail: 'replacement', read: () => ({ enabled: true,
    athleteId: 'synthetic-b', exerciseId: 'lift', exerciseName: 'Løft', logs: [{ ...row, athlete_id: 'synthetic-b', weight: 50 }], now }),
    active: () => true, open: true })
  const replacement = f.root.textContent
  job.resolve(); await tick(); old.click()
  assert.equal(f.root.textContent, replacement); assert.match(replacement, /50 kg/); assert.equal(calls, 1)
  stop()
})

test('real mounted session forwards the retry contract and preserves unsaved input while the fold refreshes', async () => {
  const root = historyTestDom(), timers = new Map(); let timer = 0, reads = 0, writes = 0
  const week = { id: 'week', athlete_id: 'synthetic-a', sessions: [{ id: 'session', exercises: [ex] }] }
  const p = { enabled: true, athleteId: 'synthetic-a', currentWeek: week, allWeeks: [week],
    exerciseLogs: [row], exerciseLogsError: true, logInputs: {}, parsePlannedRpe: () => null,
    setLogInputs(fn) { p.logInputs = fn(p.logInputs) }, onLogSet() { writes++ },
    async onRetryExerciseLogs() { reads++; p.exerciseLogsError = false; p.exerciseLogs = [{ ...row, weight: 85 }] } }
  const clock = { Date: { now: () => now }, setInterval(fn) { timers.set(++timer, fn); return timer }, clearInterval(id) { timers.delete(id) } }
  const view = mountSession(root, () => p, { clock })
  try {
    view.controller.start()
    const input = root.querySelector('[data-field="weight"]'); input.value = '82.5'; input.dispatch('input')
    const fold = root.querySelector('[data-exercise-history-fold]'); fold.open = true; fold.dispatch('toggle')
    const retry = retryButton(fold); assert.ok(retry); retry.click(); await tick()
    assert.equal(reads, 1); assert.equal(writes, 0)
    assert.match(fold.textContent, /85 kg/); assert.equal(fold.open, true)
    assert.equal(root.querySelector('[data-field="weight"]').value, '82.5')
    assert.equal(view.controller.state().input.weight, '82.5')
  } finally { view.dispose(); assert.equal(timers.size, 0) }
})

test('OFF history mount leaves existing content and callbacks untouched', () => {
  const root = historyTestDom(); root.textContent = 'Existing'
  const stop = mountExerciseHistory(root, { read: () => ({ enabled: false,
    get logs() { assert.fail('OFF logs') }, get onRetry() { assert.fail('OFF retry') } }), active: () => true, open: true })
  assert.equal(root.textContent, 'Existing'); stop(); assert.equal(root.textContent, 'Existing')
})


test('a completed retry does not steal focus after the athlete moves to another control', async () => {
  const job = deferred()
  const f = fixture(async () => { await job.promise; f.p.exerciseLogsError = false })
  const outside = f.root.ownerDocument.createElement('button'); f.root.append(outside)
  retryButton(f.root).click(); outside.focus()
  job.resolve(); await tick()
  assert.equal(f.root.ownerDocument.activeElement, outside)
  assert.match(f.root.textContent, /80 kg/)
  f.dispose()
})

test('host recovery clears a failed retry when the same fold is opened again', async () => {
  for (const recovery of ['logs', 'error']) {
    const f = fixture(() => false)
    retryButton(f.root).click(); await tick()
    assert.match(f.root.textContent, /Historikken kunne ikke vises/)
    const fold = f.root.querySelector('details'); fold.open = false; fold.dispatch('toggle')
    if (recovery === 'logs') f.p.exerciseLogs = [{ ...row, weight: 90 }]
    f.p.exerciseLogsError = false
    fold.open = true; fold.dispatch('toggle')
    assert.match(fold.textContent, recovery === 'logs' ? /90 kg/ : /80 kg/)
    assert.doesNotMatch(fold.textContent, /Hent igen|kunne ikke vises/); f.dispose()
  }
})

test('a failure without a retry callback makes no promise of a retry action', () => {
  const props = sessionHistoryProps({ athleteId: 'synthetic-a', exerciseLogs: [row], exerciseLogsError: true }, ex, now)
  const tree = exerciseHistoryContent(h, props)
  const text = value => typeof value === 'string' ? value : (value?.children || []).map(text).join(' ')
  assert.equal(buttons(tree).length, 0)
  assert.doesNotMatch(text(tree), /Prøv|Hent igen|hente den igen/)
})
