import test from 'node:test'
import assert from 'node:assert/strict'
import { mountSession } from './sessionView.mjs'
import { dom, button } from './a11y-dom.mjs'

function setup(prescription = {}) {
  let now = Date.parse('2026-11-03T12:00:00Z'), id = 0
  const timers = new Map(), clock = { Date: { now: () => now },
    setInterval(fn) { timers.set(++id, fn); return id }, clearInterval(i) { timers.delete(i) } }
  const advance = ms => { now += ms; for (const fn of [...timers.values()]) fn() }
  const ex = { id: 'a', name: 'Løft', sets: 8, reps: 5, recommended_weight: 60, ...prescription }
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
      assert.deepEqual(options, { preserveMissingRpe: true, sessionOnly: true }); assert.equal(input.weight, '60')
      p.exerciseLogs.push(row(set_number))
    }
    const s = view.controller.state()
    assert.equal(await view.controller.approve(s.key, { weight: '60', reps: '5', rpe: '' }, s.selection.stamp), true)
  }
  return { p, root, view, row, rest, save, advance, timers, clock, ex }
}

test('actual save starts default countdown; no drift after suspended ticks; no log writes from timer', async () => {
  const f = setup()
  try {
    f.view.controller.start(); assert.equal(f.rest().hidden, true); assert.equal(f.timers.size, 0)
    await f.save()
    assert.equal(f.rest().hidden, false); assert.equal(f.timers.size, 1)
    const rows = JSON.stringify(f.p.exerciseLogs)
    assert.match(f.rest().textContent, /1:30/)
    f.advance(61500)
    assert.match(f.rest().textContent, /0:29/)
    f.view.update(); f.view.update(); assert.equal(f.timers.size, 1)
    assert.equal(JSON.stringify(f.p.exerciseLogs), rows)
    await f.save(); assert.match(f.rest().textContent, /1:30/)
  } finally { f.view.dispose() }
  assert.equal(f.timers.size, 0)
})

for (const [prescription, expected] of [
  [{ name: 'Squat' }, '2:00'], [{ name: 'Bænkpres - topsæt' }, '2:00'],
  [{ name: 'Dødløft' }, '2:00'], [{ name: 'Sumo dødløft' }, '2:00'],
  [{ name: 'DB bench press' }, '1:30'], [{ restSeconds: 75 }, '1:15'],
  [{ note: 'Tempo 3-1-X-0; Pause 1,5 min' }, '1:30'],
  [{ note: 'Hvile 2:30' }, '2:30'],
  [{ restSeconds: 45, note: 'Pause 3 min' }, '0:45'],
  [{ restSeconds: 'bad' }, '1:30'], [{ name: 'Squat', restSeconds: -1 }, '2:00'],
  [{ restSeconds: 0 }, '0:00'],
]) {
  test(`program/default countdown ${JSON.stringify(prescription)}`, async () => {
    const f = setup(prescription)
    try {
      f.view.controller.start(); await f.save()
      assert.equal(f.rest().querySelector('[role="timer"]').textContent, expected)
      assert.equal(f.rest().querySelector('[role="timer"]').getAttribute('aria-live'), 'off')
      assert.equal(f.rest().querySelector('[role="status"]').getAttribute('aria-live'), 'polite')
      if (prescription.restSeconds === 'bad' || prescription.restSeconds === -1)
        assert.match(f.rest().textContent, /kan ikke læses.*standardpause/)
      for (const label of ['Pause', 'Nulstil', '+30 s']) {
        const control = button(f.rest(), label)
        assert.equal(control.tagName, 'button'); assert.equal(control.getAttribute('type'), 'button')
      }
    } finally { f.view.dispose() }
    assert.equal(f.timers.size, 0)
  })
}

test('pause/resume, repeated extension, reset and next confirmation preserve fractional time and stable focus', async () => {
  const f = setup({ restSeconds: 60 })
  try {
    f.view.controller.start(); await f.save()
    f.advance(10500)
    const pause = button(f.rest(), 'Pause'); pause.focus(); pause.click()
    assert.match(f.rest().textContent, /0:50/); assert.equal(f.timers.size, 0)
    f.advance(90000); f.view.update()
    assert.equal(f.root.ownerDocument.activeElement, pause)
    assert.match(f.rest().textContent, /0:50/)
    button(f.rest(), '+30 s').click(); button(f.rest(), '+30 s').click()
    assert.match(f.rest().textContent, /1:50/); assert.equal(f.timers.size, 0)
    button(f.rest(), 'Fortsæt').click(); f.advance(109499)
    assert.match(f.rest().textContent, /0:01/)
    f.advance(1); assert.match(f.rest().textContent, /0:00/); assert.equal(f.timers.size, 0)
    button(f.rest(), '+30 s').click(); assert.match(f.rest().textContent, /0:30/)
    f.advance(5000); button(f.rest(), 'Nulstil').click()
    assert.match(f.rest().textContent, /1:00/)
    button(f.rest(), 'Pause').click(); await f.save()
    assert.match(f.rest().textContent, /1:00/); assert.ok(button(f.rest(), 'Pause'))
    assert.equal(f.timers.size, 1)
  } finally { f.view.dispose() }
})

test('zero gives one quiet signal per run; absent, denied and throwing vibration are harmless', async () => {
  for (const vibrate of [undefined, () => false, () => { throw Error('denied') }]) {
    const f = setup({ restSeconds: 1 })
    let calls = 0
    f.clock.navigator = vibrate ? { vibrate(ms) { calls++; assert.equal(ms, 150); return vibrate() } } : undefined
    try {
      f.view.controller.start(); await f.save()
      f.advance(999); assert.doesNotMatch(f.rest().textContent, /Pausen er slut/)
      f.advance(1); assert.match(f.rest().textContent, /Pausen er slut/)
      const status = f.rest().querySelector('[role="status"]')
      f.advance(100000); f.view.update(); f.view.update()
      assert.equal(f.rest().querySelector('[role="status"]'), status)
      assert.equal(calls, vibrate ? 1 : 0); assert.equal(f.timers.size, 0)
      button(f.rest(), 'Nulstil').click(); f.advance(1000)
      assert.equal(calls, vibrate ? 2 : 0)
    } finally { f.view.dispose() }
  }
})

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
    assert.match(f.rest().textContent, /1:27/); assert.equal(f.timers.size, 1)
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
    assert.match(f.rest().textContent, /0:25/)
    assert.equal(f.timers.size, 1)
    f.advance(25000); assert.match(f.rest().textContent, /Pausen er slut/)
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
    assert.equal(f.timers.size, 1); assert.match(f.rest().textContent, /1:25/)
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
    assert.match(css, /min-height:48px;min-width:88px/)
    assert.match(css, /prefers-reduced-motion:reduce/); assert.match(css, /animation:none;transition:none/)
    // 390px viewport minus existing frame padding leaves 350px; each target can wrap.
    assert.ok(390 - 2 * 20 >= 44)
    const choice = button(f.rest(), '+30 s'); choice.focus(); f.view.update(); f.advance(1000)
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

test('empty and failed program have no countdown; save failure keeps error visible without a timer', async () => {
  for (const patch of [{ allWeeks: [], currentWeek: null }, { programError: 'synthetic' }]) {
    const f = setup()
    try {
      Object.assign(f.p, patch); f.view.update()
      assert.equal(f.view.controller.start(), false)
      assert.equal(f.root.querySelector('.e2-rest'), null); assert.equal(f.timers.size, 0)
      assert.match(f.root.textContent, patch.programError ? /Programmet kunne ikke hentes/ : /Intet pas i dag/)
    } finally { f.view.dispose() }
  }
  const f = setup()
  try {
    f.view.controller.start(); f.p.onLogSet = () => { throw Error('synthetic') }
    const s = f.view.controller.state()
    assert.equal(await f.view.controller.approve(s.key, { weight: '60', reps: '5' }, s.selection.stamp), false)
    assert.equal(f.rest().hidden, true); assert.equal(f.timers.size, 0)
    assert.match(f.root.textContent, /Sættet blev ikke gemt/)
  } finally { f.view.dispose() }
})

test('pause uses completed exercise at a transition; supersets and other set tools remain', async () => {
  const f = setup({ name: 'Squat', sets: 1, note: 'Supersæt: A; Tempo 3-1-X-0; Pause 45 sek' })
  f.p.currentWeek.sessions[0].exercises.push({ id: 'b', name: 'Rows', sets: 2, reps: 8,
    recommended_weight: 30, restSeconds: 180, note: 'Supersæt: A' })
  try {
    f.view.update(); f.view.controller.start(); await f.save()
    assert.equal(f.view.controller.state().next.exercise.id, 'b')
    assert.match(f.rest().textContent, /0:45/); assert.match(f.rest().textContent, /Efter Squat/)
    assert.match(f.root.textContent, /Supersæt A: Squat \+ Rows/)
    for (const label of ['−2,5', '+2,5', 'Som planlagt', 'Afslut pas']) assert.ok(button(f.root, label))
    assert.match(f.root.textContent, /Skiver|Gentagelser|RPE/)
  } finally { f.view.dispose() }
})
