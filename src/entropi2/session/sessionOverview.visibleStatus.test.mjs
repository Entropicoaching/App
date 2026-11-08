import test from 'node:test'
import assert from 'node:assert/strict'
import { mountSession } from './sessionView.mjs'
import { dom, button } from './a11y-dom.mjs'
import { createElement as h, act } from 'react'
import { createRoot } from 'react-dom/client'
import SessionScreen from './SessionScreen.mjs'
import { sessionReactDocument } from './sessionQuickSetReactDom.mjs'
import { parsePlannedRpe } from '../../dashboardShared.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
const fold = root => root.querySelector('[data-session-overview]')
const row = (exercise_id, set_number, extra = {}) => ({ athlete_id: 'visible-owner', exercise_id,
  set_number, weight: 0, reps_completed: 5, logged_at: '2026-11-03T10:00:00Z', ...extra })

function fixture(extras = {}, root = dom()) {
  const session = { id: 'visible-session', title: 'Dagens styrke med kontrollerede gentagelser og et langt dansk navn', exercises: [
    { id: 'visible-a', name: 'Knæbøjning med kontrolleret sænkning', sets: 3, reps: 5, recommended_weight: 0, restSeconds: 90 },
    { id: 'visible-b', name: 'Enarmsroning med støtte', sets: 3, reps: 5, recommended_weight: 0 },
  ] }
  const week = { id: 'visible-week', program_id: 'visible-program', athlete_id: 'visible-owner',
    start_date: '2026-11-02', sessions: [session] }
  const writes = [], timers = new Set()
  let now = Date.parse('2026-11-03T12:00:00Z')
  const clock = { Date: { now: () => now }, setInterval(fn) { timers.add(fn); return fn },
    clearInterval(fn) { timers.delete(fn) } }
  const p = { enabled: true, athleteId: 'visible-owner', currentWeek: week, allWeeks: [week], exerciseLogs: [],
    logInputs: {}, pendingSyncKeys: [], parkedSets: [], parsePlannedRpe,
    setLogInputs(fn) { writes.push('input'); p.logInputs = fn(p.logInputs) },
    onLogSet(...args) { writes.push(args); return { phase: 'waiting' } },
    onSkipSet() { writes.push('skip') }, onSkipExercise() { writes.push('skip exercise') },
    onUnskipSet() { writes.push('undo') }, ...extras }
  const view = mountSession(root, () => p, { clock })
  button(root, 'Start dagens pas').click()
  return { root, p, view, session, week, writes, timers, clock,
    advance(ms) { now += ms; for (const fn of [...timers]) fn() },
    dispose() { view.dispose(); assert.equal(timers.size, 0) } }
}

// Model only the browser's native details default action; product events are real.
function toggle(node) {
  const summary = node.querySelector('summary')
  summary.focus(); summary.click(); node.open = !node.open; node.dispatch('toggle')
}

function expectCounts(root, expected, context = '') {
  const overview = fold(root)
  assert.ok(overview)
  const summary = overview.querySelector('summary')
  const counts = overview.querySelectorAll('[data-overview-counts]')
  assert.equal(counts.length, 1, 'Keep the original single inner totals node')
  assert.equal(counts[0].parentElement, overview)
  assert.equal(summary.querySelector('[data-overview-counts]'), null)
  assert.equal(counts[0].textContent, expected, context)
  assert.equal(summary.querySelector('span').textContent, expected)
  assert.ok(summary.textContent.includes(expected), 'Native summary exposes the same totals')
  return summary
}

test('first normal mount exposes mixed confirmed/skip/unconfirmed totals while closed, and keeps native summary contracts', () => {
  const f = fixture({ exerciseLogs: [row('visible-a', 1), row('visible-a', 1), row('visible-a', 2, { skipped: true }),
    row('visible-b', 1), row('visible-b', 2), row('visible-b', 3, { _optimistic: true })],
    pendingSyncKeys: ['visible-b_1'], parkedSets: [{ exerciseId: 'visible-b', setNumber: 2 }] })
  try {
    assert.ok(!fold(f.root).open)
    const expected = '1 registreret · 1 sprunget over · 1 tilbage · 3 ikke bekræftet'
    const summary = expectCounts(f.root, expected)
    assert.ok(summary.textContent.startsWith(`Overblik over passet · ${f.session.title}`))
    assert.equal(summary.getAttribute('data-overview-focus'), 'overview')
    assert.equal(fold(f.root).getAttribute('data-detail'), 'overview')
    assert.deepEqual(fold(f.root).querySelectorAll('[data-overview-focus]').map(n => n.getAttribute('data-overview-focus')),
      ['overview', 'overview-0', 'overview-1', 'return'])
    assert.equal(summary.querySelector('span').getAttribute('class'), 'overview-dosage')
    assert.equal(fold(f.root).querySelectorAll('[aria-live],[role="status"],[role="alert"]').length, 0)
    assert.equal(summary.querySelectorAll('button').length, 0)
    const key = f.view.controller.state().key
    toggle(fold(f.root)); assert.equal(fold(f.root).open, true); expectCounts(f.root, expected)
    toggle(fold(f.root)); assert.equal(fold(f.root).open, false); expectCounts(f.root, expected)
    assert.equal(f.view.controller.state().key, key)
    assert.deepEqual(f.writes, [])
    assert.equal(f.timers.size, 0)
  } finally { f.dispose() }
})

test('closed summary follows actual controller/projection for unavailable, failed, conflicting and foreign snapshots', () => {
  const remaining = '0 registreret · 0 sprunget over · 6 tilbage'
  const uncertain = '0 registreret · 0 sprunget over · 5 tilbage · 1 ikke bekræftet'
  const unavailable = '0 registreret · 0 sprunget over · 0 tilbage · 6 ikke bekræftet'
  const cases = [
    ['empty', {}, remaining],
    ['duplicate confirmed', { exerciseLogs: [row('visible-a', 1), row('visible-a', 1)] }, '1 registreret · 0 sprunget over · 5 tilbage'],
    ['saved skip', { exerciseLogs: [row('visible-a', 1, { skipped: true })] }, '0 registreret · 1 sprunget over · 5 tilbage'],
    ['conflicting duplicates', { exerciseLogs: [row('visible-a', 1), row('visible-a', 1, { skipped: true })] }, uncertain],
    ['optimistic', { exerciseLogs: [row('visible-a', 1, { _optimistic: true })] }, uncertain],
    ['pending', { exerciseLogs: [row('visible-a', 1)], pendingSyncKeys: ['visible-a_1'] }, uncertain],
    ['parked', { exerciseLogs: [row('visible-a', 1)], parkedSets: [{ exerciseId: 'visible-a', setNumber: 1 }] }, uncertain],
    ['failed', { setConfirm: { 'visible-a_1': 'error' } }, uncertain],
    ['loading', { exerciseLogs: [row('visible-a', 1)], exerciseLogsLoading: true }, unavailable],
    ['error', { exerciseLogs: [row('visible-a', 1)], exerciseLogsError: true }, unavailable],
    ['unloaded', { exerciseLogs: undefined }, unavailable],
    // The existing dated-week projection excludes undated history; it cannot register it.
    ['undated', { exerciseLogs: [row('visible-a', 1, { logged_at: undefined })] }, remaining],
    ...[{ athlete_id: 'foreign' }, { session_id: 'foreign' }, { week_id: 'foreign' }, { program_id: 'foreign' },
      { exercises: { session_id: 'foreign' } }, { exercise_id: 'foreign' }, { set_number: 99 },
      { logged_at: '2026-10-27T10:00:00Z' }, { logged_at: '2026-11-04T10:00:00Z' }]
      .map(extra => [JSON.stringify(extra), { exerciseLogs: [row('visible-a', 1, extra)] }, remaining]),
  ]
  for (const [label, extras, expected] of cases) {
    const f = fixture(extras)
    try {
      assert.ok(!fold(f.root).open, label)
      expectCounts(f.root, expected, label)
      assert.deepEqual(f.writes, [], label)
    } finally { f.dispose() }
  }
})

test('closed summary distinguishes an incomplete plan from a known zero count', () => {
  const f = fixture()
  try {
    f.session.exercises[1].sets = null; f.view.update()
    button(f.root, 'Start dagens pas').click()
    expectCounts(f.root, '0 registreret · 0 sprunget over · 3 tilbage · Planen er ufuldstændig')
    assert.ok(!fold(f.root).open)
    f.session.exercises[1].sets = 0; f.view.update()
    button(f.root, 'Start dagens pas').click()
    expectCounts(f.root, '0 registreret · 0 sprunget over · 3 tilbage')
    assert.deepEqual(f.writes, [])
  } finally { f.dispose() }
})

test('actual form acknowledgement updates closed counts only when confirmed and preserves the rest deadline', async () => {
  let acknowledge
  const f = fixture({ onLogSet(...args) { f.writes.push(args); return new Promise(resolve => { acknowledge = resolve }) } })
  try {
    f.root.querySelector('form').dispatch('submit')
    const waiting = '0 registreret · 0 sprunget over · 5 tilbage · 1 ikke bekræftet'
    expectCounts(f.root, waiting)
    assert.ok(!fold(f.root).open)
    f.p.exerciseLogs = [row('visible-a', 1, { logged_at: '2026-11-03T12:00:00Z' })]; f.view.update()
    expectCounts(f.root, waiting)
    assert.equal(f.view.controller.state().phase, 'saving')
    acknowledge({ phase: 'saved' }); await tick()
    expectCounts(f.root, '1 registreret · 0 sprunget over · 5 tilbage')
    assert.ok(!fold(f.root).open)
    assert.equal(f.view.controller.state().key, 'visible-a_2')
    const rest = f.root.querySelector('.e2-rest')
    const timer = rest.querySelector('[role="timer"]')
    assert.equal(timer.textContent, '1:30')
    f.advance(13000)
    toggle(fold(f.root)); toggle(fold(f.root))
    f.view.update()
    assert.equal(f.root.querySelector('.e2-rest'), rest)
    assert.equal(timer.textContent, '1:17')
    assert.equal(f.timers.size, 1)
    assert.equal(f.writes.length, 1)
  } finally { f.dispose() }
})

test('pending and parked host updates stay unconfirmed until actual confirmed rows arrive', () => {
  const f = fixture({ exerciseLogs: [row('visible-a', 1, { _optimistic: true })], pendingSyncKeys: ['visible-a_1'] })
  try {
    const uncertain = '0 registreret · 0 sprunget over · 5 tilbage · 1 ikke bekræftet'
    expectCounts(f.root, uncertain)
    f.p.pendingSyncKeys = []; f.p.parkedSets = [{ exerciseId: 'visible-a', setNumber: 1 }]; f.view.update()
    expectCounts(f.root, uncertain)
    f.p.parkedSets = []; f.p.exerciseLogs = [row('visible-a', 1)]; f.view.update()
    expectCounts(f.root, '1 registreret · 0 sprunget over · 5 tilbage')
    assert.ok(!fold(f.root).open)
    assert.deepEqual(f.writes, [])
  } finally { f.dispose() }
})

test('summary updates preserve drafts and focus, and native return stays scoped across readonly/day/identity/OFF/unmount', () => {
  const f = fixture()
  try {
    for (const [field, value] of [['weight', '42,5'], ['reps', '6'], ['rpe', '8,5'], ['note-text', 'Hold denne kladde']]) {
      const input = f.root.querySelector(`[data-field="${field}"]`)
      input.value = value; input.focus(); input.dispatch('input')
    }
    toggle(fold(f.root))
    f.p.exerciseLogs = [row('visible-b', 1)]; f.view.update()
    const summary = expectCounts(f.root, '1 registreret · 0 sprunget over · 5 tilbage')
    assert.equal(fold(f.root).open, true)
    assert.equal(f.root.ownerDocument.activeElement, summary)
    for (const [field, value] of [['weight', '42,5'], ['reps', '6'], ['rpe', '8,5'], ['note-text', 'Hold denne kladde']])
      assert.equal(f.root.querySelector(`[data-field="${field}"]`).value, value)
    button(f.root, 'Tilbage til dit sæt').click()
    assert.equal(fold(f.root).open, false)
    assert.equal(f.root.ownerDocument.activeElement, f.root.querySelector('[data-field="weight"]'))
    assert.ok(f.writes.every(write => write === 'input'))
  } finally { f.dispose() }

  for (const change of ['readonly', 'day', 'athlete', 'week', 'session', 'off', 'unmount']) {
    const scoped = fixture()
    try {
      const summary = expectCounts(scoped.root, '0 registreret · 0 sprunget over · 6 tilbage')
      toggle(fold(scoped.root))
      const back = button(scoped.root, 'Tilbage til dit sæt')
      if (change === 'readonly') scoped.p.readOnly = true
      if (change === 'day') scoped.advance(86400000)
      if (change === 'athlete') scoped.p.athleteId = 'replacement-owner'
      if (change === 'week') scoped.week.id = 'replacement-week'
      if (change === 'session') scoped.session.id = 'replacement-session'
      if (change === 'off') scoped.p.enabled = false
      if (change === 'unmount') scoped.view.dispose()
      const before = scoped.root.ownerDocument.activeElement
      back.click()
      assert.equal(scoped.root.ownerDocument.activeElement, before, change)
      scoped.view.update(); back.click()
      if (['readonly', 'day'].includes(change)) {
        expectCounts(scoped.root, '0 registreret · 0 sprunget over · 6 tilbage')
        assert.equal(fold(scoped.root).open, false)
      } else assert.equal(fold(scoped.root), null, change)
      assert.equal(summary.isConnected, false)
      assert.deepEqual(scoped.writes, [], change)
    } finally { scoped.dispose() }
  }
})

test('real React SessionScreen renders live closed counts on first open and host rerender without remounting the workout', async () => {
  const doc = sessionReactDocument(), f = fixture({}, doc.createElement('section'))
  f.view.dispose()
  const host = doc.createElement('div'); doc.body.append(host)
  const replacements = { window: doc.defaultView, IS_REACT_ACT_ENVIRONMENT: true,
    setInterval: f.clock.setInterval, clearInterval: f.clock.clearInterval }
  const previous = Object.fromEntries(Object.keys(replacements).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  for (const [key, value] of Object.entries(replacements)) Object.defineProperty(globalThis, key, { configurable: true, value })
  const root = createRoot(host)
  try {
    // Exercise the production React -> mountSession -> createSessionOverview path.
    f.p.exerciseLogs = [row('visible-a', 1)]
    await act(async () => root.render(h(SessionScreen, f.p)))
    await act(async () => button(host, 'Start dagens pas').click())
    expectCounts(host, '1 registreret · 0 sprunget over · 5 tilbage')
    assert.ok(!fold(host).open)
    const keyBefore = host.querySelector('[data-overview-current]').textContent
    const input = host.querySelector('[data-field="weight"]')
    await act(async () => { input.value = '37,5'; input.focus(); input.dispatch('input') })
    const summary = fold(host).querySelector('summary'); summary.focus()
    f.p.exerciseLogs = [...f.p.exerciseLogs, row('visible-b', 1, { skipped: true })]
    await act(async () => root.render(h(SessionScreen, { ...f.p })))
    const currentSummary = expectCounts(host, '1 registreret · 1 sprunget over · 4 tilbage')
    assert.ok(!fold(host).open)
    assert.equal(doc.activeElement, currentSummary)
    assert.equal(host.querySelector('[data-field="weight"]').value, '37,5')
    assert.equal(host.querySelector('[data-overview-current]').textContent, keyBefore)
    assert.ok(f.writes.every(write => write === 'input'))
  } finally {
    await act(async () => root.unmount())
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
    f.dispose()
  }
})
