import test from 'node:test'
import assert from 'node:assert/strict'
import { createRestTimer } from './restTimer.mjs'
import { dom, button } from './a11y-dom.mjs'

function fixture(seconds = 90) {
  let now = Date.parse('2026-11-04T12:00:00Z'), id = 0
  const callbacks = new Map(), signals = []
  const clock = { Date: { now: () => now },
    navigator: { vibrate: value => signals.push(value) },
    setInterval: fn => { callbacks.set(++id, fn); return id },
    clearInterval: key => callbacks.delete(key) }
  const root = dom(), view = createRestTimer(root.ownerDocument, clock)
  root.append(view.node)
  const exercise = Object.freeze({ id: 'ex', name: 'Synthetic lift', sets: 4, restSeconds: seconds })
  const state = { open: true, summary: false, selection: { stamp: 'plan' },
    session: { id: 'session', exercises: [exercise] }, logs: [] }
  const props = Object.freeze({})
  view.update(state, props)
  const confirm = (set = 1, offset = 0) => Object.freeze({ exercise_id: 'ex', set_number: set,
    logged_at: new Date(now + offset).toISOString() })
  const update = () => view.update(state, props)
  const advance = ms => { now += ms; for (const callback of [...callbacks.values()]) callback() }
  const text = () => view.node.querySelector('[role="timer"]').textContent
  return { view, state, props, confirm, update, advance, text, callbacks, signals }
}

test('independent accumulated-active-time oracle: 12,000 deterministic timer actions', () => {
  let random = 28571
  const next = limit => { random = (Math.imul(random, 1664525) + 1013904223) >>> 0; return random % limit }
  for (let run = 0; run < 120; run++) {
    const seconds = 1 + next(300), f = fixture(seconds)
    let allowance = seconds * 1000, consumed = 0, suspended = false
    f.state.logs = Object.freeze([f.confirm()]); f.update()
    try {
      for (let step = 0; step < 100; step++) {
        const operation = next(5)
        if (operation === 0) {
          const elapsed = next(15000)
          if (!suspended) consumed = Math.min(allowance, consumed + elapsed)
          f.advance(elapsed)
        } else if (operation === 1 && consumed < allowance) {
          button(f.view.node, suspended ? 'Fortsæt' : 'Pause').click()
          suspended = !suspended
        } else if (operation === 2) {
          button(f.view.node, '+30 s').click(); allowance += 30000
        } else if (operation === 3) {
          button(f.view.node, 'Nulstil').click(); allowance = seconds * 1000; consumed = 0; suspended = false
        } else f.update()
        const expected = Math.ceil((allowance - consumed) / 1000)
        assert.equal(f.text(), `${Math.floor(expected / 60)}:${String(expected % 60).padStart(2, '0')}`, `run ${run}, step ${step}`)
        assert.equal(f.callbacks.size, suspended || expected === 0 ? 0 : 1)
      }
    } finally { f.view.dispose() }
    assert.equal(f.callbacks.size, 0)
  }
})

test('latest confirmed timestamp wins independently of input ordering; edits cannot restart it', () => {
  for (const reverse of [false, true]) {
    const f = fixture(60)
    try {
      const earlier = f.confirm(1), later = f.confirm(2, 5000)
      f.advance(8000)
      f.state.logs = Object.freeze(reverse ? [later, earlier] : [earlier, later]); f.update()
      assert.equal(f.text(), '0:57')
      f.advance(1000)
      f.state.logs = Object.freeze([{ ...later, logged_at: f.confirm(2).logged_at }, earlier]); f.update()
      assert.equal(f.text(), '0:56')
    } finally { f.view.dispose() }
  }
})

test('hidden timer cannot vibrate or respond to retained controls; dispose is terminal', () => {
  const f = fixture(1)
  f.state.logs = [f.confirm()]; f.update()
  const reset = button(f.view.node, 'Nulstil')
  f.state.open = false; f.update(); f.advance(5000)
  reset.click(); assert.equal(f.signals.length, 0); assert.equal(f.callbacks.size, 0)
  f.state.open = true; f.update()
  assert.equal(f.text(), '0:00'); assert.deepEqual(f.signals, [150])
  f.update(); assert.deepEqual(f.signals, [150])
  f.view.dispose(); reset.click(); f.update(); f.advance(5000)
  assert.equal(f.callbacks.size, 0); assert.deepEqual(f.signals, [150])
})

test('instances have separate controls, deadlines, signals and disposal', () => {
  const a = fixture(10), b = fixture(20)
  try {
    for (const f of [a, b]) { f.state.logs = [f.confirm()]; f.update() }
    button(a.view.node, '+30 s').click(); a.advance(5000); b.advance(5000)
    assert.equal(a.text(), '0:35'); assert.equal(b.text(), '0:15')
    a.view.dispose(); b.advance(15000)
    assert.equal(a.signals.length, 0); assert.deepEqual(b.signals, [150])
    assert.equal(a.callbacks.size, 0); assert.equal(b.callbacks.size, 0)
  } finally { a.view.dispose(); b.view.dispose() }
})
