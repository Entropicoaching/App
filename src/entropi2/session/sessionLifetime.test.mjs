import test from 'node:test'
import assert from 'node:assert/strict'
import { createSessionController } from './sessionModel.mjs'
import { mountSession } from './sessionView.mjs'
import { quickSetFixture } from './sessionQuickSetFixture.mjs'
import { dom, button } from './a11y-dom.mjs'

const handler = (node, name) => { assert.ok(node); return [...node.events.get(name)][0] }
const submit = form => handler(form, 'submit')({ preventDefault() {} })
function fixture(t) {
  const f = quickSetFixture(), root = dom(), timers = new Set()
  const clock = { Date: { now: () => 0 }, setInterval(fn) { timers.add(fn); return fn }, clearInterval(fn) { timers.delete(fn) } }
  const view = mountSession(root, () => f.p, { clock })
  t.after(() => { view.dispose(); assert.equal(timers.size, 0) })
  view.controller.start()
  return { ...f, root, view, clock, timers }
}
const captured = f => {
  const s = f.view.controller.state()
  return { form: f.root.querySelector('form'), finish: handler(button(f.root, 'Afslut pas'), 'click'),
    approve: () => f.view.controller.approve(s.key, s.input, s.selection.stamp),
    edit: () => f.view.controller.edit(s.key, 'weight', '999', s.selection.stamp),
    s }
}

for (const transition of ['dispose', 'refresh', 'owner', 'plan', 'off', 'offline', 'error']) {
  test(`retained node and direct native callbacks are inert after ${transition}`, { timeout: 5000 }, async t => {
    const f = fixture(t), old = captured(f), finishBefore = old.finish
    const inputs = JSON.stringify(f.p.logInputs)
    if (transition === 'dispose') f.view.dispose()
    if (transition === 'owner') f.p.athleteId = 'other-synthetic'
    if (transition === 'plan') f.exercise.reps = '7'
    if (transition === 'off') f.p.enabled = false
    if (transition === 'offline') f.p.offlineSnapshotAt = 1
    if (transition === 'error') f.p.programError = true
    f.view.update()
    await submit(old.form); old.form.dispatch('submit'); finishBefore()
    assert.deepEqual(f.calls, [])
    assert.equal(JSON.stringify(f.p.logInputs), inputs)
    if (transition === 'refresh') {
      assert.equal(f.view.controller.state().summary, false)
      await submit(f.root.querySelector('form'))
      assert.equal(f.calls.length, 1, 'current form still writes')
    } else {
      assert.equal(await old.approve(), false); old.edit()
      assert.equal(f.view.controller.finish(), false)
      assert.equal(JSON.stringify(f.p.logInputs), inputs)
    }
  })
}

test('dispose revokes controller methods synchronously before teardown and is terminal/idempotent', { timeout: 5000 }, async t => {
  const f = fixture(t), old = captured(f), c = f.view.controller
  const finish = c.finish, start = c.start, approve = c.approve
  const restNode = f.root.querySelector('.e2-rest'), remove = restNode.remove.bind(restNode)
  restNode.remove = () => {
    assert.equal(c.state().open, false)
    assert.equal(start(), false); assert.equal(finish(), false)
    old.edit(); old.finish(); old.form.dispatch('submit')
    return remove()
  }
  f.view.dispose(); f.view.dispose(); f.view.update()
  assert.equal(await approve(old.s.key, old.s.input, old.s.selection.stamp), false)
  assert.equal(c.state().selection, null); assert.equal(c.state().canStart, false)
  assert.deepEqual(f.calls, []); assert.deepEqual(f.p.logInputs, {})
})

test('old dispose and completion callbacks cannot disturb a fresh mount in the same root', { timeout: 5000 }, async t => {
  const f = fixture(t), old = captured(f)
  f.view.dispose()
  const fresh = mountSession(f.root, () => f.p, { clock: f.clock })
  t.after(() => fresh.dispose())
  fresh.controller.start(); const form = f.root.querySelector('form')
  f.view.dispose(); f.view.update(); old.finish(); old.form.dispatch('submit')
  assert.equal(f.root.querySelector('form') === form, true)
  assert.equal(fresh.controller.state().summary, false)
  await submit(form); assert.equal(f.calls.length, 1)
  assert.equal(fresh.controller.state().key, 'quick-a_2')
})

for (const result of ['saved', 'queued', 'parked', 'error', 'throw']) {
  test(`in-flight ${result} response after disposal cannot render into replacement; no duplicate write`, { timeout: 5000 }, async t => {
    const f = fixture(t); let settle, reject, count = 0
    f.p.onLogSet = () => { count++; if (count > 1) return false; return new Promise((yes, no) => { settle = yes; reject = no }) }
    const old = captured(f), pending = old.approve()
    assert.equal(count, 1); assert.equal(f.view.controller.state().phase, 'saving')
    f.view.dispose()
    const next = quickSetFixture(), fresh = mountSession(f.root, () => next.p, { clock: f.clock })
    t.after(() => fresh.dispose()); fresh.controller.start()
    const form = f.root.querySelector('form'), text = f.root.textContent
    if (result === 'throw') reject(Error('synthetic failure'))
    else settle({ phase: result, storageFailed: result === 'error' })
    assert.equal(await pending, false)
    old.form.dispatch('submit'); assert.equal(await old.approve(), false)
    assert.equal(count, 1); assert.equal(f.root.querySelector('form') === form, true); assert.equal(f.root.textContent, text)
    await submit(form); assert.equal(next.calls.length, 1)
  })
}

for (const transition of ['owner', 'plan', 'off']) {
  test(`late response cannot refresh a new context after ${transition} and restore`, { timeout: 5000 }, async t => {
    const f = fixture(t), old = captured(f); let settle, calls = 0
    f.p.onLogSet = () => { calls++; return new Promise(r => { settle = r }) }
    const pending = old.approve()
    if (transition === 'owner') f.p.athleteId = 'synthetic-other'
    if (transition === 'plan') f.exercise.reps = '7'
    if (transition === 'off') f.p.enabled = false
    f.view.update()
    f.p.athleteId = 'quick-athlete'; f.exercise.reps = '5'; f.p.enabled = true
    f.view.update(); f.view.controller.start()
    const form = f.root.querySelector('form'), text = f.root.textContent
    settle({ phase: 'error', storageFailed: true }); assert.equal(await pending, false)
    assert.equal(f.root.querySelector('form') === form, true); assert.equal(f.root.textContent, text)
    old.finish(); old.form.dispatch('submit'); assert.equal(calls, 1)
    assert.equal(f.view.controller.state().summary, false)
  })
}

test('positive early acknowledgement returns true, preserves options and advances exactly once', { timeout: 5000 }, async t => {
  const f = fixture(t), old = captured(f)
  assert.equal(await old.approve(), true)
  assert.equal(f.calls.length, 1)
  assert.deepEqual(f.calls[0].options, { preserveMissingRpe: true, sessionOnly: true })
  assert.deepEqual([f.calls[0].ex.id, f.calls[0].set_number, f.calls[0].input.weight], ['quick-a', 1, '80'])
  await submit(old.form); old.finish()
  assert.equal(f.calls.length, 1); assert.equal(f.view.controller.state().summary, false)
  f.view.dispose(); assert.equal(await old.approve(), false)
})

test('disposal in saving notification prevents the writer', async () => {
  const f = quickSetFixture(); let c
  c = createSessionController(() => f.p, () => { if (c.state().phase === 'saving') c.dispose() })
  c.start(); const s = c.state()
  assert.equal(await c.approve(s.key, s.input, s.selection.stamp), false)
  assert.deepEqual(f.calls, [])
})

for (const transition of ['dispose', 'owner', 'off', 'readOnly']) {
  test(`synchronous parser ${transition} cannot start a writer after revocation`, async t => {
    const f = fixture(t), old = captured(f)
    f.p.parsePlannedRpe = () => {
      if (transition === 'dispose') f.view.dispose()
      if (transition === 'owner') f.p.athleteId = 'synthetic-other'
      if (transition === 'off') f.p.enabled = false
      if (transition === 'readOnly') f.p.readOnly = true
      return 8
    }
    assert.equal(await old.approve(), false)
    assert.deepEqual(f.calls, [])
  })
}

test('a legitimate in-flight write survives close and reopen, with one acknowledgement', async t => {
  const f = fixture(t), original = f.p.onLogSet; let settle, calls = 0
  f.p.onLogSet = (...args) => {
    calls++
    return new Promise(resolve => { settle = () => resolve(original(...args)) })
  }
  const pending = captured(f).approve()
  f.view.controller.close(); f.view.controller.start()
  settle(); assert.equal(await pending, true)
  assert.equal(calls, 1); assert.equal(f.calls.length, 1)
  assert.equal(f.view.controller.state().key, 'quick-a_2')
})
