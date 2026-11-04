import test from 'node:test'
import assert from 'node:assert/strict'
import { mountSession } from './sessionView.mjs'
import { historyTestDom } from './historik/historyTestDom.mjs'
import { button } from './a11y-dom.mjs'

const now = Date.parse('2026-11-04T12:00:00Z')
const row = (extra = {}) => ({ id: 'old-set', athlete_id: 'synthetic-a', exercise_id: 'lift-a', set_number: 20,
  weight: 80, reps_completed: 5, rpe_actual: 8, logged_at: '2026-10-28T10:00:00Z', ...extra })
function setup(extra = {}) {
  const ex = { id: 'lift-a', name: 'Løft A', sets: 2, reps: 5, recommended_weight: 80,
    tempo: '3-1-X-0', restSeconds: 90, note: 'Hold spændet' }
  const other = { ...ex, id: 'lift-b', name: 'Løft B' }
  const week = { id: 'week', athlete_id: 'synthetic-a', sessions: [{ id: 'session', exercises: [ex, other] }] }
  let writes = 0, next = 0
  const timers = new Map(), root = historyTestDom()
  const clock = { Date: { now: () => now }, setInterval(fn) { timers.set(++next, fn); return next }, clearInterval(id) { timers.delete(id) } }
  const p = { enabled: true, athleteId: 'synthetic-a', currentWeek: week, allWeeks: [week],
    exerciseLogs: [], logInputs: {}, setLogInputs(fn) { p.logInputs = fn(p.logInputs) },
    parsePlannedRpe: () => null, onLogSet() { writes++ }, ...extra }
  const view = mountSession(root, () => p, { clock }); view.controller.start()
  return { root, p, ex, view, timers, get writes() { return writes }, dispose() { view.dispose(); assert.equal(timers.size, 0) } }
}
const fold = (t, id = 'exercise-history-current') => t.root.querySelector(`[data-detail="${id}"]`)
const toggle = (node, open) => { node.open = open; node.dispatch('toggle') }

test('Sidst is a native, initially closed fold; shows eight sets and calendar e1RM; same tap closes', () => {
  const logs = Array.from({ length: 10 }, (_, i) => row({ id: `old-${i}`, set_number: i + 10,
    weight: 70 + i, logged_at: `2026-10-${String(i + 1).padStart(2, '0')}T10:00:00Z` }))
  const t = setup({ exerciseLogs: logs })
  try {
    const f = fold(t), summary = f.querySelector('summary')
    assert.equal(f.open, false); assert.match(summary.textContent, /^Sidst:/)
    assert.equal(t.root.querySelector('[data-e2-exercise-history]'), null)
    toggle(f, true)
    assert.equal(f.querySelectorAll('li').length, 8)
    assert.match(f.textContent, /Seneste tunge sæt|Estimeret 1RM/)
    assert.match(f.querySelector('svg').getAttribute('aria-label'), /Estimeret 1RM:/)
    assert.equal(f.querySelector('svg').namespaceURI, 'http://www.w3.org/2000/svg')
    assert.ok(f.querySelector('polyline')); assert.equal(f.querySelectorAll('circle').length, 8)
    assert.equal(f.querySelector('svg').style.maxWidth, '520px')
    assert.equal(f.querySelector('time').getAttribute('datetime'), '2026-10-10')
    assert.equal(f.querySelector('details').open, false)
    toggle(f, false); assert.equal(f.querySelector('[data-e2-exercise-history]'), null)
    assert.equal(t.writes, 0)
  } finally { t.dispose() }
})

test('empty, load error and loading are honest and never reveal stale sets or raw errors', () => {
  for (const [extra, expected] of [[{}, /Ingen bekræftede tunge sæt/],
    [{ exerciseLogs: [row()], exerciseLogsError: new Error('RAW SECRET') }, /Historikken kunne ikke vises/],
    [{ exerciseLogs: [row()], exerciseLogsLoading: true }, /Historikken hentes/]]) {
    const t = setup(extra)
    try {
      const f = fold(t); assert.equal(f.querySelector('summary').textContent, 'Sidst')
      toggle(f, true); assert.match(f.textContent, expected)
      assert.doesNotMatch(f.textContent, /RAW SECRET|80 kg|Ingen bekræftede.*Historikken/)
      assert.equal(f.querySelector('svg'), null); assert.equal(f.querySelector('ol'), null)
      if (extra.exerciseLogsError) assert.ok(f.querySelector('[role="alert"]'))
    } finally { t.dispose() }
  }
})

test('Escape and native cancel close history first, restore summary focus, then allow closing the session', () => {
  const t = setup({ exerciseLogs: [row()] })
  try {
    const f = fold(t), d = t.root.querySelector('dialog'), summary = f.querySelector('summary')
    toggle(f, true); let prevented = false
    summary.focus(); d.dispatch('keydown', { key: 'Escape', preventDefault() { prevented = true } })
    assert.equal(prevented, true); assert.equal(f.open, false)
    assert.ok(t.root.ownerDocument.activeElement === summary)
    assert.equal(t.view.controller.state().open, true)
    toggle(f, true); d.dispatch('cancel'); assert.equal(f.open, false)
    assert.equal(t.view.controller.state().open, true)
    d.dispatch('cancel'); assert.equal(t.view.controller.state().open, false)
  } finally { t.dispose() }
})

test('refresh keeps open fold, explanation and focus; changed data/error replaces content immediately', () => {
  const t = setup({ exerciseLogs: [row()] })
  try {
    toggle(fold(t), true)
    const about = fold(t).querySelector('details'); about.open = true; about.querySelector('summary').focus()
    t.p.exerciseLogs = [row({ weight: 85 })]; t.view.update()
    assert.equal(fold(t).open, true); assert.match(fold(t).textContent, /85 kg/); assert.doesNotMatch(fold(t).textContent, /80 kg/)
    assert.equal(fold(t).querySelector('details').open, true)
    assert.ok(t.root.ownerDocument.activeElement === fold(t).querySelector('details').querySelector('summary'))
    t.p.exerciseLogsError = true; t.view.update()
    assert.match(fold(t).textContent, /Historikken kunne ikke vises/)
    assert.equal(fold(t).querySelector('ol'), null)
    t.p.exerciseLogsError = false; t.p.exerciseLogs = []; t.view.update()
    assert.match(fold(t).textContent, /Ingen bekræftede/)
  } finally { t.dispose() }
})

test('overview folds use each exact exercise and athlete; pending/parked/unconfirmed rows stay excluded', () => {
  const t = setup({ exerciseLogs: [row(), row({ id: 'b', exercise_id: 'lift-b', weight: 45 }),
    row({ id: 'foreign', athlete_id: 'synthetic-b', weight: 999 }), row({ id: 'pending', set_number: 21, weight: 998 }),
    row({ id: 'parked', set_number: 22, weight: 997 }), row({ id: 'optimistic', _optimistic: true, weight: 996 })],
    pendingSyncKeys: ['lift-a_21'], parkedSets: [{ exerciseId: 'lift-a', setNumber: 22 }] })
  try {
    const overview = t.root.querySelector('[data-detail="history"]'); overview.open = true
    const a = fold(t, 'exercise-history-0'), b = fold(t, 'exercise-history-1')
    toggle(a, true); toggle(b, true)
    assert.match(a.textContent, /80 kg/); assert.doesNotMatch(a.textContent, /45 kg|99[6-9] kg/)
    assert.match(b.textContent, /45 kg/); assert.doesNotMatch(b.textContent, /80 kg/)
    assert.equal(a.querySelectorAll('li').length, 1); assert.equal(b.querySelectorAll('li').length, 1)
  } finally { t.dispose() }
})

test('Escape ignores a history fold hidden inside the closed session overview', () => {
  const t = setup({ exerciseLogs: [row()] })
  try {
    const overview = t.root.querySelector('[data-detail="history"]')
    overview.open = true; toggle(fold(t, 'exercise-history-0'), true)
    overview.open = false
    t.root.querySelector('dialog').dispatch('cancel')
    assert.equal(t.view.controller.state().open, false)
  } finally { t.dispose() }
})

test('history does not change form, steppers, tempo, notes, plates, warmup or finishing', () => {
  const t = setup({ exerciseLogs: [row()] })
  try {
    toggle(fold(t), true); button(t.root, '+2,5').click(); button(t.root, '+1').click(); button(t.root, '8').click()
    button(t.root, 'Teknik').click(); t.view.update()
    assert.equal(t.root.querySelector('[data-field="weight"]').value, '82.5')
    assert.equal(t.root.querySelector('[data-field="reps"]').value, '6')
    assert.equal(t.root.querySelector('[data-field="rpe"]').value, '8')
    assert.equal(button(t.root, 'Teknik').getAttribute('aria-pressed'), 'true')
    assert.ok(t.root.querySelector('[data-detail="warmup"]')); assert.ok(t.root.querySelector('[data-detail="plates"]'))
    assert.match(t.root.querySelector('[data-e2-tempo]').textContent, /3-1-X-0/)
    button(t.root, 'Afslut pas').click(); assert.ok(t.root.querySelector('[data-session-summary]'))
    assert.equal(fold(t), null); assert.equal(t.writes, 0)
  } finally { t.dispose() }
})

test('close, OFF, plan/athlete change and disposal reset folds and make retained toggle listeners inert', () => {
  for (const change of ['close', 'off', 'plan', 'athlete', 'dispose']) {
    const t = setup({ exerciseLogs: [row()] })
    try {
      const old = fold(t); toggle(old, true)
      if (change === 'close') t.view.controller.close()
      if (change === 'off') { t.p.enabled = false; t.view.update() }
      if (change === 'plan') { t.ex.name = 'Ændret løft'; t.view.update() }
      if (change === 'athlete') { t.p.athleteId = 'synthetic-b'; t.p.currentWeek.athlete_id = 'synthetic-b'; t.view.update() }
      if (change === 'dispose') t.view.dispose()
      assert.equal(old.events.get('toggle').size, 0)
      toggle(old, true); assert.equal(t.root.querySelector('[data-e2-exercise-history]'), null)
      assert.equal(t.writes, 0)
      if (change === 'close' || change === 'plan' || change === 'athlete') {
        t.view.controller.start(); assert.equal(fold(t).open, false)
      }
    } finally { t.dispose() }
  }
})
