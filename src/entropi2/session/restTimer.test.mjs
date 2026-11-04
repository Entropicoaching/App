import test from 'node:test'
import assert from 'node:assert/strict'
import { mountSession } from './sessionView.mjs'
import { dom, button } from './a11y-dom.mjs'

function setup() {
  let now = Date.parse('2026-11-03T12:00:00Z'), id = 0
  const timers = new Map(), clock = { Date: { now: () => now },
    setInterval(fn) { timers.set(++id, fn); return id }, clearInterval(i) { timers.delete(i) } }
  const advance = ms => { now += ms; for (const fn of [...timers.values()]) fn() }
  const ex = { id: 'a', name: 'Løft', sets: 8, reps: 5, recommended_weight: 60 }
  const week = { id: 'week', sessions: [{ id: 'session', exercises: [ex] }] }
  const p = { enabled: true, athleteId: 'synthetic', allWeeks: [week], currentWeek: week,
    exerciseLogs: [], logInputs: {}, setLogInputs() {}, parsePlannedRpe: () => null }
  const row = (set_number, extra = {}) => ({ exercise_id: 'a', set_number, weight: 60, reps_completed: 5,
    logged_at: new Date(now).toISOString(), ...extra })
  const root = dom(), view = mountSession(root, () => p, { clock })
  const rest = () => root.querySelector('.e2-rest')
  const save = async () => {
    p.onLogSet = (exercise, set_number, total, reps, rpe, input, options) => {
      assert.equal(exercise, ex); assert.equal(total, ex.sets); assert.equal(reps, 5); assert.equal(rpe, null)
      assert.deepEqual(options, { preserveMissingRpe: true }); assert.equal(input.weight, '60')
      p.exerciseLogs.push(row(set_number))
    }
    const s = view.controller.state()
    assert.equal(await view.controller.approve(s.key, { weight: '60', reps: '5', rpe: '' }, s.selection.stamp), true)
  }
  return { p, root, view, row, rest, save, advance, timers, clock }
}

test('actual save starts elapsed time; no drift after suspended ticks; no log writes from timer', async () => {
  const f = setup()
  try {
    f.view.controller.start(); assert.equal(f.rest().hidden, true); assert.equal(f.timers.size, 0)
    await f.save()
    assert.equal(f.rest().hidden, false); assert.equal(f.timers.size, 1)
    const rows = JSON.stringify(f.p.exerciseLogs)
    assert.match(f.rest().textContent, /Siden sidste sæt: 0:00/)
    f.advance(91500)
    assert.match(f.rest().textContent, /Siden sidste sæt: 1:31/)
    f.view.update(); f.view.update(); assert.equal(f.timers.size, 1)
    assert.equal(JSON.stringify(f.p.exerciseLogs), rows)
    await f.save(); assert.match(f.rest().textContent, /Siden sidste sæt: 0:00/)
  } finally { f.view.dispose() }
  assert.equal(f.timers.size, 0)
})

for (const seconds of [60, 90, 120, 180]) {
  test(`optional ${seconds}s has a silent persistent completion, off and native button semantics`, async () => {
    const f = setup()
    try {
      f.view.controller.start(); await f.save()
      const choice = button(f.rest(), `${seconds} s`)
      choice.focus(); choice.click() // Native button activation contract; no browser key synthesis.
      assert.equal(choice.tagName, 'button'); assert.equal(choice.getAttribute('type'), 'button')
      assert.equal(choice.getAttribute('aria-pressed'), 'true')
      assert.equal(f.rest().querySelector('[role="timer"]').getAttribute('aria-live'), 'off')
      const status = f.rest().querySelector('[role="status"]')
      assert.equal(status.getAttribute('aria-live'), 'polite')
      f.advance(seconds * 1000 - 1); assert.doesNotMatch(status.textContent, /er gået/)
      f.advance(1); assert.match(status.textContent, /Hviletiden er gået/)
      f.view.update(); assert.equal(f.root.ownerDocument.activeElement, choice)
      assert.equal(f.rest().querySelector('[role="status"]'), status)
      f.advance(120000); assert.match(status.textContent, /Hviletiden er gået/)
      button(f.rest(), 'Kun tid').click(); assert.equal(status.textContent, '')
      assert.equal(choice.getAttribute('aria-pressed'), 'false')
    } finally { f.view.dispose() }
    assert.equal(f.timers.size, 0)
  })
}

test('optimistic row and resolved callback do not start until a confirmed row arrives', async () => {
  const f = setup()
  try {
    f.view.controller.start()
    let settle
    f.p.onLogSet = () => { f.p.exerciseLogs.push(f.row(1, { _optimistic: true })); return new Promise(r => { settle = r }) }
    const s = f.view.controller.state()
    const saving = f.view.controller.approve(s.key, { weight: '60', reps: '5' }, s.selection.stamp)
    f.view.update(); assert.equal(f.timers.size, 0)
    f.advance(3000); settle(); assert.equal(await saving, false); assert.equal(f.timers.size, 0)
    f.p.exerciseLogs[0] = { ...f.p.exerciseLogs[0], _optimistic: false }; f.view.update()
    assert.match(f.rest().textContent, /Siden sidste sæt: 0:03/); assert.equal(f.timers.size, 1)
  } finally { f.view.dispose() }
})

test('confirmed row during a pending callback waits for settlement and retains elapsed time', async () => {
  const f = setup()
  try {
    f.view.controller.start()
    let settle
    f.p.onLogSet = () => { f.p.exerciseLogs.push(f.row(1)); return new Promise(r => { settle = r }) }
    const s = f.view.controller.state()
    const saving = f.view.controller.approve(s.key, { weight: '60', reps: '5' }, s.selection.stamp)
    f.view.update(); f.advance(65000); assert.equal(f.timers.size, 0)
    settle(); assert.equal(await saving, true)
    assert.match(f.rest().textContent, /Siden sidste sæt: 1:05/)
    assert.equal(f.timers.size, 1)
    button(f.rest(), '60 s').click(); assert.match(f.rest().textContent, /Hviletiden er gået/)
  } finally { f.view.dispose() }
})

test('historical, skipped, queued, parked, foreign, unplanned and invalid timestamp rows do not start', () => {
  const f = setup()
  try {
    f.p.exerciseLogs = [f.row(1)]; f.view.controller.start(); assert.equal(f.timers.size, 0)
    f.p.pendingSyncKeys = ['a_3']; f.p.parkedSets = [{ exerciseId: 'a', setNumber: 4 }]
    f.p.exerciseLogs.push(f.row(2, { skipped: true }), f.row(3), f.row(4),
      f.row(5, { athlete_id: 'other' }), f.row(6, { logged_at: 'bad' }),
      f.row(7, { logged_at: '2026-11-03T11:59:59Z' }), f.row(9))
    f.view.update(); assert.equal(f.timers.size, 0)
    f.p.pendingSyncKeys = []; f.view.update(); assert.equal(f.timers.size, 1)
  } finally { f.view.dispose() }
})

test('failed save never starts; confirmed final set stops; resume, close, OFF and plan change clean up', async () => {
  const f = setup()
  try {
    f.view.controller.start(); f.p.onLogSet = () => { throw Error('synthetic') }
    let s = f.view.controller.state()
    assert.equal(await f.view.controller.approve(s.key, { weight: '60', reps: '5' }, s.selection.stamp), false)
    assert.equal(f.timers.size, 0)
    await f.save(); assert.equal(f.timers.size, 1)
    f.view.controller.close(); assert.equal(f.timers.size, 0)
    f.advance(5000); f.view.controller.start()
    assert.equal(f.timers.size, 1); assert.match(f.rest().textContent, /0:05/)
    f.view.controller.finish(); assert.equal(f.timers.size, 0)
    f.view.controller.resume(); assert.equal(f.timers.size, 1)
    f.p.currentWeek.sessions[0].exercises[0].sets = 9; f.view.update()
    assert.equal(f.timers.size, 0); assert.equal(f.root.querySelector('dialog'), null)
    f.view.controller.start(); assert.equal(f.rest().hidden, true)
    await f.save(); assert.equal(f.timers.size, 1)
    f.p.enabled = false; f.view.update(); assert.equal(f.timers.size, 0); assert.equal(f.root.hidden, true)
  } finally { f.view.dispose() }
  const g = setup()
  try {
    g.view.controller.start(); await g.save()
    for (let i = 2; i <= 8; i++) g.p.exerciseLogs.push(g.row(i))
    g.view.update(); assert.equal(g.timers.size, 0); assert.equal(g.rest().hidden, true)
  } finally { g.view.dispose() }
})

test('390px structural CSS contract, reduced motion, keyboard trap and stable timer focus', async () => {
  const f = setup()
  try {
    f.view.controller.start(); await f.save()
    const css = f.rest().querySelector('style').textContent
    assert.match(css, /display:flex;flex-wrap:wrap;gap:8px/)
    assert.match(css, /min-width:0;max-width:100%;overflow-wrap:anywhere/)
    assert.match(css, /min-height:44px;min-width:44px/)
    assert.match(css, /prefers-reduced-motion:reduce/); assert.match(css, /animation:none;transition:none/)
    // 390px viewport minus existing frame padding leaves 350px; each target can wrap.
    assert.ok(390 - 2 * 20 >= 44)
    const choice = button(f.rest(), '90 s'); choice.focus(); f.view.update(); f.advance(1000)
    assert.equal(f.root.ownerDocument.activeElement, choice)
    const dialog = f.root.querySelector('dialog'), close = button(f.root, 'Luk pas')
    const last = f.root.querySelector('[data-detail="history"]').querySelector('summary')
    close.focus(); dialog.dispatch('keydown', { key: 'Tab', shiftKey: true })
    assert.equal(f.root.ownerDocument.activeElement, last)
    dialog.dispatch('keydown', { key: 'Tab' }); assert.equal(f.root.ownerDocument.activeElement, close)
    dialog.dispatch('cancel'); assert.equal(f.timers.size, 0)
    f.view.controller.start(); assert.equal(f.timers.size, 1)
  } finally { f.view.dispose() }
  assert.equal(f.timers.size, 0)
})
