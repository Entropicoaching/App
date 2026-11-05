import './trainingFullscreenRegister.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
const { default: TrainingFullscreen } = await import('./TrainingFullscreen.mjs')
import { FakeNode, mount } from './trainingFullscreenFake.mjs'
import { bindTrainingDialog, watchTrainingRest, remainingTrainingRest } from './trainingFullscreenDom.mjs'
const { createTrainingApproval } = await import('./trainingFullscreenModel.mjs')

function dialogFixture() {
  const dialog = new FakeNode('dialog'), handle = new FakeNode('handle'), close = new FakeNode('button'), trigger = new FakeNode('button')
  let dismissed = 0
  const dispose = bindTrainingDialog({ dialog, handle, close, trigger, dismiss: () => { dismissed++ } })
  return { dialog, handle, close, trigger, dispose, count: () => dismissed }
}

test('counter 1: X and native keyboard cancel close, focus returns, all listeners removed', () => {
  for (const kind of ['X', 'Escape']) {
    const f = dialogFixture(); assert.equal(f.dialog.open, true); assert.equal(f.close.focused, true)
    let prevented = false
    if (kind === 'X') f.close.fire('click')
    else f.dialog.fire('cancel', { preventDefault() { prevented = true } })
    assert.equal(f.dialog.open, false); assert.equal(f.count(), 1)
    if (kind === 'Escape') assert.equal(prevented, true)
    f.dispose(); assert.equal(f.trigger.focused, true)
    for (const node of [f.dialog, f.close, f.handle]) for (const listeners of node.listeners.values()) assert.equal(listeners.size, 0)
  }
})

test('counter 2: only a deliberate downward touch swipe on the handle closes', () => {
  const f = dialogFixture()
  const down = { isPrimary: true, pointerType: 'touch', pointerId: 2, clientX: 50, clientY: 20 }
  f.handle.fire('pointerdown', down)
  f.handle.fire('pointerup', { pointerId: 2, clientX: 150, clientY: 100 })
  assert.equal(f.dialog.open, true, 'horizontal gesture')
  f.handle.fire('pointerdown', down); f.handle.fire('pointercancel')
  f.handle.fire('pointerup', { pointerId: 2, clientX: 50, clientY: 100 }); assert.equal(f.dialog.open, true)
  f.handle.fire('pointerdown', down)
  f.handle.fire('pointerup', { pointerId: 3, clientX: 50, clientY: 150 }); assert.equal(f.dialog.open, true)
  f.handle.fire('pointerup', { pointerId: 2, clientX: 55, clientY: 100 }); assert.equal(f.dialog.open, false)
  f.dispose()
})

test('counter 3: timer derives elapsed time and clears at expiry and disposal', () => {
  let now = 1000, updates = [], cleared = [], callback
  const clock = { Date: { now: () => now }, setInterval(fn) { callback = fn; return 42 }, clearInterval(id) { cleared.push(id) } }
  const pause = { startedAt: 1000, durationSeconds: 90 }
  const dispose = watchTrainingRest(pause, value => updates.push(value), clock)
  assert.equal(updates[0], 90)
  now = 76500; callback(); assert.equal(updates.at(-1), 15)
  now = 100000; callback(); assert.equal(updates.at(-1), 0); assert.deepEqual(cleared, [42])
  dispose(); assert.deepEqual(cleared, [42])
  now = 1000; const stop = watchTrainingRest(pause, () => {}, clock); stop(); assert.deepEqual(cleared, [42, 42])
  assert.equal(remainingTrainingRest(null), 0)
  assert.equal(remainingTrainingRest({ startedAt: NaN, durationSeconds: 90 }), 0)
})

test('counter 4: component close/unmount clears its timer and preserves parent logs', () => {
  const timers = new Map(); let seq = 0
  const originalSet = globalThis.setInterval, originalClear = globalThis.clearInterval
  globalThis.setInterval = fn => { timers.set(++seq, fn); return seq }
  globalThis.clearInterval = id => timers.delete(id)
  const s = { id: 's', exercises: [{ id: 'e', name: 'Pres', sets: 2, reps: '3' }] }, week = { id: 'w', sessions: [s] }
  const logs = [{ exercise_id: 'e', set_number: 1, weight: null, reps_completed: 3, rpe_actual: null }]
  const runtime = mount(TrainingFullscreen, { allWeeks: [week], currentWeek: week, exerciseLogs: logs,
    logInputs: {}, restPause: { startedAt: Date.now(), durationSeconds: 90 } })
  try {
    const start = () => { runtime.nodes(n => n.type === 'button')[0].props.onClick(); runtime.render() }
    start(); assert.equal(timers.size, 1)
    assert.match(runtime.text(), /Ikke angivet kg, 3 gent\., RPE Ikke angivet/)
    const dialog = runtime.nodes(n => n.type === 'dialog')[0].props.ref.current
    dialog.fire('cancel', { preventDefault() {} }); runtime.render()
    assert.equal(timers.size, 0); assert.equal(logs.length, 1)
    start(); assert.equal(timers.size, 1); runtime.unmount(); assert.equal(timers.size, 0)
  } finally { runtime.unmount(); globalThis.setInterval = originalSet; globalThis.clearInterval = originalClear }
})

test('counter 5: malformed and nonnumeric reps stay blank, long coach text stays text', () => {
  const s = { id: 's', title: 'Pas', exercises: [{ id: 'e', name: 'Hold', sets: 1, reps: '30 sek', note: '<script>fixture</script>' }] }
  const week = { id: 'w', sessions: [s] }
  const runtime = mount(TrainingFullscreen, { allWeeks: [week], currentWeek: week, exerciseLogs: [], logInputs: {} })
  runtime.nodes(n => n.type === 'button')[0].props.onClick(); runtime.render()
  assert.equal(runtime.nodes(n => n.type === 'input')[1].props.value, '')
  assert.equal(runtime.nodes(n => n.type === 'script').length, 0)
  assert.match(runtime.text(), /<script>fixture<\/script>/)
  for (const n of runtime.nodes(n => n.type === 'button' || n.type === 'input')) {
    assert.ok(n.props.style.minHeight >= 44); assert.ok(n.props.style.minWidth >= 44)
  }
  const dialog = runtime.nodes(n => n.type === 'dialog')[0]
  assert.equal(dialog.props.style.width, '100vw'); assert.equal(dialog.props.style.height, '100dvh')
  assert.equal(dialog.props['aria-labelledby'], 'synthetic-training-title')
  runtime.unmount()
})

test('counter 6: saved logs after close and complete session cannot cause another write', async () => {
  let writes = 0
  const s = { id: 's', exercises: [{ id: 'e', sets: 1 }] }, expected = { exercise: s.exercises[0], setNumber: 1 }
  const state = { exerciseLogs: [{ exercise_id: 'e', set_number: 1 }], onLogSet: async () => { writes++ } }
  const approval = createTrainingApproval(() => state, () => {})
  assert.equal(await approval.approve(s, expected, { weight: '10', reps: '5' }), false)
  assert.equal(writes, 0)
})

test('counter 7: empty logs after handler settles show failure, no false completed state', async () => {
  const s = { id: 's', exercises: [{ id: 'e', sets: 1 }] }, messages = []
  const approval = createTrainingApproval(() => ({ exerciseLogs: [], onLogSet: async () => {} }), m => messages.push(m))
  assert.equal(await approval.approve(s, { exercise: s.exercises[0], setNumber: 1 }, { weight: 10, reps: 5 }), true)
  assert.equal(approval.pending.size, 1, 'locked until committed props are checked')
  approval.reconcile()
  assert.ok(messages.includes('Sættet blev ikke gemt. Prøv igen.'))
  assert.equal(approval.pending.size, 0)
  // Simulate React batching: handler settles before latest props have committed.
  const state = { exerciseLogs: [], onLogSet: async () => {} }, batched = []
  const second = createTrainingApproval(() => state, m => batched.push(m))
  const expected = { exercise: s.exercises[0], setNumber: 1 }
  await second.approve(s, expected, { weight: 10, reps: 5 })
  assert.equal(second.pending.size, 1)
  assert.equal(await second.approve(s, expected, { weight: 10, reps: 5 }), false)
  state.exerciseLogs = [{ exercise_id: 'e', set_number: 1 }]
  second.reconcile()
  assert.equal(second.pending.size, 0)
  assert.ok(!batched.includes('Sættet blev ikke gemt. Prøv igen.'))
})
