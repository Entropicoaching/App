import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h, act } from 'react'
import { createRoot } from 'react-dom/client'
import SessionScreen from './SessionScreen.mjs'
import HomeSession from '../home/HomeSession.mjs'
import { sessionReactDocument } from './sessionQuickSetReactDom.mjs'
import { quickSetFixture } from './sessionQuickSetFixture.mjs'

const callback = (node, type) => { assert.ok(node); return [...node.events.get(type)][0] }
const submit = form => callback(form, 'submit')({ preventDefault() {} })
async function mounted(t, { home = false } = {}) {
  const f = quickSetFixture(), doc = sessionReactDocument(), host = doc.createElement('div'), timers = new Set()
  f.p.athlete = { id: f.p.athleteId }
  f.p.currentWeek.start_date = '2026-11-02'; f.p.currentWeek.week_number = 1; f.p.currentWeek.sessions[0].weekday = 1
  f.p.now = new Date('2026-11-03T12:00Z')
  f.p.readHomeRecordHistory = async () => ({ status: 'ready', complete: true, athleteId: f.p.athleteId, rows: [] })
  doc.body.append(host)
  const create = doc.createElement
  doc.createElement = tag => {
    const node = create(tag)
    if (tag === 'select') Object.defineProperty(node, 'options', { get: () => node.children.filter(n => n.tagName === 'OPTION') })
    return node
  }
  const values = { window: doc.defaultView, IS_REACT_ACT_ENVIRONMENT: true,
    setInterval(fn) { timers.add(fn); return fn }, clearInterval(fn) { timers.delete(fn) } }
  const old = new Map(Object.keys(values).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]))
  for (const [k, value] of Object.entries(values)) Object.defineProperty(globalThis, k, { configurable: true, value })
  const root = createRoot(host); let closed = false
  const refresh = () => act(async () => root.render(h(home ? HomeSession : SessionScreen, f.p)))
  const close = async () => {
    if (closed) return
    closed = true
    try { await act(async () => root.unmount()); assert.equal(timers.size, 0) }
    finally { for (const [k, value] of old) {
      if (value) Object.defineProperty(globalThis, k, value); else delete globalThis[k]
    } }
  }
  t.after(close); await refresh()
  const start = host.querySelectorAll('button').find(n => n.textContent === 'Start dagens pas')
  assert.ok(start)
  await act(async () => {
    if (home) {
      host.dispatch('click', { type: 'click', target: start, button: 0, bubbles: true, stopPropagation() {} })
      await import('./sessionView.mjs'); await new Promise(r => setImmediate(r))
    } else start.click()
  })
  assert.ok(host.querySelector('form'))
  return { ...f, host, refresh, close, root }
}

for (const transition of ['unmount', 'update', 'owner', 'program', 'off']) {
  test(`actual ReactDOM SessionScreen revokes retained nodes/functions after ${transition}`, async t => {
    const f = await mounted(t), form = f.host.querySelector('form'), fn = callback(form, 'submit')
    const finish = callback(f.host.querySelectorAll('button').find(n => n.textContent === 'Afslut pas'), 'click')
    if (transition === 'unmount') await f.close()
    else {
      if (transition === 'owner') f.p.athleteId = 'new-synthetic-owner'
      if (transition === 'program') f.p.currentWeek = { ...f.p.currentWeek, program_id: 'replacement' }
      if (transition === 'off') f.p.enabled = false
      await f.refresh()
    }
    await act(async () => { form.dispatch('submit'); await fn({ preventDefault() {} }); finish() })
    assert.deepEqual(f.calls, []); assert.deepEqual(f.p.logInputs, {})
    assert.equal(f.host.querySelector('[data-session-summary]'), null)
    if (transition === 'update') {
      await act(async () => { await submit(f.host.querySelector('form')) })
      assert.equal(f.calls.length, 1)
    }
  })
}

test('actual HomeSession calendar boundary rejects retained form and completion without an update', async t => {
  const f = await mounted(t, { home: true }), form = f.host.querySelector('form')
  const finish = callback(f.host.querySelectorAll('button').find(n => n.textContent === 'Afslut pas'), 'click')
  const submitFn = callback(form, 'submit')
  // The bridge checks the live calendar on every controller entry.
  f.p.now.setUTCDate(4)
  await act(async () => { form.dispatch('submit'); await submitFn({ preventDefault() {} }); finish() })
  assert.deepEqual(f.calls, [])
  await f.refresh(); assert.equal(f.host.querySelector('dialog'), null)
})

for (const response of ['early', 'late', 'rejected']) {
  test(`actual ReactDOM permits one legitimate ${response} write and protects a fresh remount`, async t => {
    const f = await mounted(t); let settle, reject, count = 0, acknowledgements = 0
    const writer = f.p.onLogSet
    f.p.onLogSet = (...args) => {
      count++
      if (count > 1) return false
      return new Promise((yes, no) => {
        settle = () => { writer(...args); acknowledgements++; yes({ phase: 'saved' }) }
        reject = () => no(Error('synthetic write failure'))
      })
    }
    await f.refresh()
    const form = f.host.querySelector('form'), submitFn = callback(form, 'submit')
    let pending
    await act(async () => { pending = submitFn({ preventDefault() {} }) })
    assert.equal(count, 1)
    if (response === 'early') {
      await act(async () => { settle(); assert.equal(await pending, true) })
      assert.equal(acknowledgements, 1)
    }
    // React removes the native view. A fresh root receives an independent controller.
    await f.close()
    const fresh = await mounted(t), nextForm = fresh.host.querySelector('form'), text = fresh.host.textContent
    await act(async () => {
      if (response === 'late') settle()
      if (response === 'rejected') reject()
      if (response !== 'early') assert.equal(await pending, false)
      form.dispatch('submit'); assert.equal(await submitFn({ preventDefault() {} }), false)
    })
    assert.equal(count, 1); assert.equal(acknowledgements, response === 'rejected' ? 0 : 1)
    assert.equal(fresh.host.querySelector('form') === nextForm, true); assert.equal(fresh.host.textContent, text)
    await act(async () => { await submit(nextForm) }); assert.equal(fresh.calls.length, 1)
  })
}
