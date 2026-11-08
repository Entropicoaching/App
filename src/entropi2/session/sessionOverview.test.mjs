import test from 'node:test'
import assert from 'node:assert/strict'
import { mountSession } from './sessionView.mjs'
import { dom, button } from './a11y-dom.mjs'
import { sessionStyle } from './sessionStyle.mjs'
import { parsePlannedRpe } from '../../dashboardShared.js'
import { mountHomeSession } from '../home/homeSessionBridge.mjs'
import { createElement as h, act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import SessionScreen from './SessionScreen.mjs'
import { sessionReactDocument } from './sessionQuickSetReactDom.mjs'

const tick = () => new Promise(resolve => setImmediate(resolve))
const fold = (root, name = 'overview') => root.querySelector(`[data-detail="${name}"]`)
// The synthetic DOM has no UA default action. Perform only the native details
// toggle after activating its real summary; no product handlers are replaced.
function toggle(node) {
  const summary = node.querySelector('summary'); summary.focus(); summary.click()
  node.open = !node.open; node.dispatch('toggle')
}
function setup(t, extras = {}, root = dom()) {
  const exercises = [
    { id: 'oa', name: 'Squat med et langt navn der skal kunne brydes på en lille skærm', sets: 3, reps: '5', recommended_weight: 0,
      intensity: 'RPE 7,5', note: 'Supersæt: A; tempo: 3-0-X-0; pause: 90 sek', exercise_order: 1 },
    { id: 'ob', name: 'Row', sets: 2, reps: '8-10', note: 'Supersæt: A', exercise_order: 2 },
    { id: 'oc', name: 'Lunge', sets: 1, reps: 0, recommended_weight: 0, intensity: 0, restSeconds: 0, exercise_order: 3 },
    { id: 'oz', name: 'Valgfri bevægelse', sets: 0, exercise_order: 4 },
  ]
  const session = { id: 'os', title: 'Styrke og kontrol', exercises }
  const week = { id: 'ow', athlete_id: 'synthetic-owner', program_id: 'op', start_date: '2026-11-02', week_number: 1, sessions: [session] }
  const calls = [], writes = [], edits = []
  let now = Date.parse('2026-11-03T12:00:00Z')
  const timers = new Set(), clock = { Date: { now: () => now },
    setInterval(fn) { timers.add(fn); return fn }, clearInterval(fn) { timers.delete(fn) } }
  const p = { enabled: true, athleteId: week.athlete_id, athlete: { id: week.athlete_id }, currentWeek: week, allWeeks: [week],
    now: new Date(now), getNow: () => new Date(now), exerciseLogs: [], pendingSyncKeys: [], parkedSets: [], logInputs: {}, parsePlannedRpe,
    setLogInputs(fn) { edits.push('input'); p.logInputs = fn(p.logInputs) },
    onLogSet(...args) {
      calls.push(args); writes.push('log')
      const [ex, set, , reps, , input] = args
      p.exerciseLogs.push(row(ex.id, set, { weight: Number(input.weight), reps_completed: reps, logged_at: new Date(now).toISOString() }))
      return { phase: 'saved' }
    },
    onSkipSet() { writes.push('skip') }, onSkipExercise() { writes.push('skip exercise') }, onUnskipSet() { writes.push('undo') }, ...extras }
  const view = mountSession(root, () => p, { clock })
  t.after(() => { view.dispose(); assert.equal(timers.size, 0) })
  button(root, 'Start dagens pas').click()
  return { p, session, week, exercises, root, view, calls, writes, edits, timers, clock,
    advance(ms) { now += ms; for (const fn of [...timers]) fn() } }
}
const row = (exercise_id, set_number, extra = {}) => ({ athlete_id: 'synthetic-owner', exercise_id, set_number,
  weight: 0, reps_completed: 5, logged_at: '2026-11-03T11:55:00Z', ...extra })
const statuses = root => root.querySelectorAll('[data-overview-status]').map(n => n.getAttribute('data-overview-status'))
function type(root, field, value) {
  const input = root.querySelector(`[data-field="${field}"]`)
  input.value = value; input.focus(); input.dispatch('input'); return input
}
const submit = root => root.querySelector('form').dispatch('submit')

test('pinned lead: the mounted current workout offers its overview beside the active exercise', () => {
  const session = { id: 'synthetic-session', title: 'Hele styrkepasset', exercises: [
    { id: 'synthetic-a', name: 'Squat', sets: 2, reps: 5, recommended_weight: 0 },
    { id: 'synthetic-b', name: 'Row', sets: 1, reps: 8 },
  ] }
  const week = { id: 'synthetic-week', sessions: [session] }
  const p = { enabled: true, athleteId: 'synthetic', currentWeek: week, allWeeks: [week], exerciseLogs: [], logInputs: {} }
  const root = dom(), view = mountSession(root, () => p)
  try {
    button(root, 'Start dagens pas').click()
    const overview = root.querySelector('[data-session-overview]')
    assert.ok(overview, 'A current-session overview is missing from the actual mounted logging flow')
    assert.match(overview.textContent, /Hele styrkepasset/)
    const siblings = overview.parentElement.children
    assert.ok(siblings.indexOf(overview) > siblings.indexOf(root.querySelector('h1')))
    assert.ok(siblings.indexOf(overview) < siblings.indexOf(root.querySelector('form')))
  } finally { view.dispose() }
})

test('actual overview: ordered unequal supersets, exact prescriptions and one count per planned slot', t => {
  const f = setup(t, { exerciseLogs: [row('oa', 1), row('oa', 1), row('oa', 2, { skipped: true }),
    row('ob', 1), row('ob', 2, { _optimistic: true }), row('oc', 1)],
    pendingSyncKeys: ['ob_1'], parkedSets: [{ exerciseId: 'oc', setNumber: 1 }] })
  toggle(fold(f.root)); toggle(fold(f.root, 'overview-0')); toggle(fold(f.root, 'overview-1'))
  const overview = fold(f.root)
  assert.equal(overview.querySelector('ol').getAttribute('aria-label'), 'Øvelser i planlagt rækkefølge')
  assert.deepEqual(overview.querySelectorAll('[data-overview-focus]').map(n => n.getAttribute('data-overview-focus')),
    ['overview', 'overview-0', 'overview-1', 'overview-2', 'overview-3', 'return'])
  assert.deepEqual(statuses(overview), ['completed', 'skipped', 'remaining', 'pending', 'waiting', 'parked'])
  assert.equal(overview.querySelector('[data-overview-counts]').textContent,
    '1 registreret · 1 sprunget over · 1 tilbage · 3 ikke bekræftet')
  assert.match(fold(f.root, 'overview-0').textContent, /3 sæt · 5 gentagelser/)
  assert.match(fold(f.root, 'overview-0').textContent, /Supersæt A/)
  assert.match(fold(f.root, 'overview-0').textContent, /Planlagt vægt: 0 kg/)
  assert.match(fold(f.root, 'overview-0').textContent, /Intensitet: RPE 7,5/)
  assert.match(fold(f.root, 'overview-0').textContent, /Tempo: 3-0-X-0/)
  assert.match(fold(f.root, 'overview-0').textContent, /Pause: 1 min. 30 sek./)
  assert.match(fold(f.root, 'overview-1').textContent, /2 sæt · 8-10 gentagelser/)
  assert.doesNotMatch(fold(f.root, 'overview-1').textContent, /Planlagt vægt:|Pause:|Intensitet:/)
  assert.match(fold(f.root, 'overview-2').textContent, /0 gentagelser/)
  assert.match(fold(f.root, 'overview-2').textContent, /Intensitet: 0/)
  assert.match(fold(f.root, 'overview-2').textContent, /Ingen planlagt pause \(0 sek.\)/)
  assert.match(fold(f.root, 'overview-3').textContent, /0 planlagte sæt · Gentagelser mangler/)
  assert.equal(overview.querySelectorAll('[aria-current="step"]').length, 1)
  assert.match(overview.querySelector('[aria-current="step"]').textContent, /Nu: sæt 3 af 3/)
  assert.equal(overview.querySelector('[data-overview-current]').textContent, 'Sæt 3: Tilbage · Nu')
  assert.deepEqual(f.writes, []); assert.deepEqual(f.edits, [])
})

test('strict projection ignores foreign/old-week/future/other-session logs and exposes uncertainty', t => {
  const f = setup(t, { exerciseLogs: [row('other-exercise', 1), row('oa', 1, { athlete_id: 'foreign' }),
    row('ob', 1, { logged_at: '2026-10-27T10:00:00Z' }), row('ob', 2, { session_id: 'old-session' }),
    row('oc', 1, { logged_at: '2026-11-04T12:00:00Z' }), row('oa', 99)] })
  toggle(fold(f.root))
  assert.deepEqual(statuses(fold(f.root)), ['remaining', 'remaining', 'remaining', 'remaining', 'remaining', 'remaining'])
  assert.match(fold(f.root).textContent, /0 registreret · 0 sprunget over · 6 tilbage/)
  f.p.exerciseLogs = [row('oa', 1), row('oa', 1, { skipped: true })]; f.view.update()
  assert.equal(statuses(fold(f.root))[0], 'unknown')
  f.p.exerciseLogsLoading = true; f.view.update()
  assert.ok(statuses(fold(f.root)).every(s => s === 'unknown'))
  assert.match(fold(f.root).textContent, /6 ikke bekræftet/)
  f.p.exerciseLogsLoading = false; f.p.exerciseLogsError = true; f.view.update()
  assert.ok(statuses(fold(f.root)).every(s => s === 'unknown'))
  assert.equal(fold(f.root).open, true); assert.deepEqual(f.writes, [])
})

test('missing plan count differs from zero; undated confirmation remains unknown', t => {
  const f = setup(t)
  f.exercises[3].sets = null; f.view.update()
  button(f.root, 'Start dagens pas').click(); toggle(fold(f.root)); toggle(fold(f.root, 'overview-3'))
  assert.match(fold(f.root, 'overview-3').textContent, /Antal sæt mangler eller kan ikke læses/)
  assert.match(fold(f.root).textContent, /Planen er ufuldstændig/)
  assert.doesNotMatch(fold(f.root, 'overview-3').textContent, /0 planlagte sæt/)
  f.p.exerciseLogs = [row('oa', 1, { logged_at: undefined })]; f.view.update()
  assert.equal(statuses(fold(f.root))[0], 'unknown')
  assert.deepEqual(f.writes, [])
})

test('native exploration preserves numeric/note drafts and exact payload only on explicit form submit', async t => {
  const f = setup(t)
  type(f.root, 'weight', '42,5'); type(f.root, 'reps', '6'); type(f.root, 'rpe', '8,5')
  const note = type(f.root, 'note-text', 'Roligt og kontrolleret')
  note.setSelectionRange(4, 9)
  const form = f.root.querySelector('form'), key = f.view.controller.state().key
  toggle(fold(f.root)); toggle(fold(f.root, 'overview-1'))
  assert.equal(f.root.querySelector('form'), form)
  assert.equal(f.view.controller.state().key, key)
  await tick(); f.view.update()
  assert.equal(fold(f.root).open, true); assert.equal(fold(f.root, 'overview-1').open, true)
  assert.equal(f.root.ownerDocument.activeElement, fold(f.root, 'overview-1').querySelector('summary'))
  for (const [field, value] of [['weight', '42,5'], ['reps', '6'], ['rpe', '8,5'], ['note-text', 'Roligt og kontrolleret']])
    assert.equal(f.root.querySelector(`[data-field="${field}"]`).value, value)
  button(f.root, 'Tilbage til dit sæt').click()
  assert.equal(fold(f.root).open, false)
  assert.equal(f.root.ownerDocument.activeElement, f.root.querySelector('[data-field="weight"]'))
  assert.equal(f.writes.length, 0)
  assert.ok(button(f.root, 'Spring sættet over')); assert.ok(button(f.root, 'Spring øvelsen over'))
  submit(f.root); await tick()
  assert.equal(f.calls.length, 1)
  assert.deepEqual(f.calls[0], [f.exercises[0], 1, 3, 6, 7.5,
    { weight: '42.5', reps: '6', rpe: '8.5', note: 'Roligt og kontrolleret', rpe_source: 'athlete' },
    { preserveMissingRpe: true, sessionOnly: true }])
  assert.equal(f.view.controller.state().key, 'oa_2')
  assert.equal(statuses(fold(f.root))[0], 'completed')
  assert.equal(fold(f.root).querySelector('[data-overview-current]').textContent, 'Sæt 2: Tilbage · Nu')
})

test('pending save keeps inspection usable, cannot be duplicated, and updates next marker without losing folds', async t => {
  let resolve
  const f = setup(t)
  f.p.onLogSet = (...args) => { f.calls.push(args); return new Promise(r => { resolve = r }) }
  submit(f.root)
  assert.equal(f.view.controller.state().phase, 'saving')
  toggle(fold(f.root)); toggle(fold(f.root, 'overview-1'))
  const inspection = fold(f.root, 'overview-1').querySelector('summary'); inspection.focus()
  assert.equal(statuses(fold(f.root))[0], 'waiting')
  button(f.root, 'Tilbage til dit sæt').click()
  assert.equal(f.root.ownerDocument.activeElement, f.root.querySelector('[data-heading]'))
  toggle(fold(f.root)); inspection.focus(); submit(f.root)
  assert.equal(f.calls.length, 1)
  f.p.exerciseLogs = [row('oa', 1)]; f.view.update()
  assert.equal(statuses(fold(f.root))[0], 'waiting')
  resolve({ phase: 'saved' }); await tick()
  assert.equal(f.view.controller.state().key, 'oa_2')
  assert.equal(fold(f.root).open, true); assert.equal(fold(f.root, 'overview-1').open, true)
  assert.equal(f.root.ownerDocument.activeElement, fold(f.root, 'overview-1').querySelector('summary'))
  assert.equal(statuses(fold(f.root))[0], 'completed')
  assert.equal(f.calls.length, 1)
})

test('rest deadline survives opening/closing/exploration and confirmed set progression, cleans on close', async t => {
  const f = setup(t)
  submit(f.root); await tick()
  const rest = f.root.querySelectorAll('[role="timer"]').find(n => n.getAttribute('aria-label') === 'Pause tilbage'), node = f.root.querySelector('.e2-rest')
  assert.equal(rest.textContent, '1:30'); assert.equal(f.timers.size, 1)
  f.advance(11000)
  toggle(fold(f.root)); toggle(fold(f.root, 'overview-2'))
  assert.equal(rest.textContent, '1:19'); assert.equal(f.timers.size, 1)
  f.view.update()
  assert.equal(f.root.querySelector('.e2-rest'), node)
  assert.equal(rest.textContent, '1:19'); assert.equal(f.timers.size, 1)
  button(f.root, 'Tilbage til dit sæt').click(); f.advance(2000)
  assert.equal(rest.textContent, '1:17')
  button(f.root, 'Luk pas').click(); assert.equal(f.timers.size, 0)
  button(f.root, 'Åbn dagens pas').click()
  assert.equal(fold(f.root).open, false)
})

test('readonly/day/identity/week/program/OFF/dispose retire old return callbacks and reset expansion', t => {
  for (const change of ['readonly', 'day', 'athlete', 'week', 'program', 'session', 'off', 'dispose']) {
    const f = setup(t)
    toggle(fold(f.root)); toggle(fold(f.root, 'overview-1'))
    const back = button(f.root, 'Tilbage til dit sæt')
    if (change === 'readonly') f.p.readOnly = true
    if (change === 'day') f.advance(86400000)
    if (change === 'athlete') f.p.athleteId = 'replacement'
    if (change === 'week') f.week.id = 'replacement-week'
    if (change === 'program') f.week.program_id = 'replacement-program'
    if (change === 'session') f.session.id = 'replacement-session'
    if (change === 'off') f.p.enabled = false
    if (change === 'dispose') f.view.dispose()
    const before = f.root.ownerDocument.activeElement
    back.click()
    assert.ok(f.root.ownerDocument.activeElement === before, change)
    f.view.update(); back.click()
    assert.deepEqual(f.writes, [], change)
    if (change === 'readonly' || change === 'day') {
      assert.equal(fold(f.root).open, false)
      assert.equal(fold(f.root, 'overview-1').open, false)
      assert.ok(f.root.ownerDocument.activeElement === f.root.querySelector('[data-heading]'))
    } else assert.equal(f.root.querySelector('dialog'), null)
  }
})

test('actual Home bridge day change closes overview and rejects retained real form', async t => {
  const f = setup(t)
  f.view.dispose()
  f.session.exercises = f.exercises.slice(0, 3)
  const bridge = mountHomeSession(f.root, () => f.p)
  t.after(() => bridge.dispose())
  assert.equal(await bridge.start('os', 'ow'), true)
  toggle(fold(f.root)); toggle(fold(f.root, 'overview-1'))
  const form = f.root.querySelector('form'), back = button(f.root, 'Tilbage til dit sæt')
  f.advance(86400000); bridge.update()
  assert.equal(f.root.querySelector('dialog'), null)
  form.dispatch('submit'); back.click(); await tick()
  assert.deepEqual(f.writes, [])
})

test('overview styles stay local, wrap long content and preserve native 44px controls without viewport rules', () => {
  const rules = [...sessionStyle.matchAll(/([^{}]+)\{([^{}]+)\}/g)].filter(([, selector]) => selector.includes('overview'))
  assert.ok(rules.length >= 8)
  assert.ok(rules.every(([, selector]) => selector.trim().startsWith('.e2-session ')))
  assert.match(rules.map(rule => rule[2]).join(' '), /overflow-wrap:anywhere/)
  assert.match(rules.map(rule => rule[2]).join(' '), /min-height:44px/)
  assert.doesNotMatch(rules.map(rule => rule[2]).join(' '), /\b(?:100vw|position:fixed|white-space:nowrap|width:\d+px)/)
})

test('real React SessionScreen rerenders preserve explored overview, typed drafts and focus until explicit submit', async t => {
  const doc = sessionReactDocument(), f = setup(t, {}, doc.createElement('section'))
  f.view.dispose()
  const host = doc.createElement('div'); doc.body.append(host)
  const replacements = { window: doc.defaultView, IS_REACT_ACT_ENVIRONMENT: true,
    setInterval: f.clock.setInterval, clearInterval: f.clock.clearInterval }
  const original = Object.fromEntries(Object.keys(replacements).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  for (const [key, value] of Object.entries(replacements)) Object.defineProperty(globalThis, key, { configurable: true, value })
  const root = createRoot(host)
  let refresh
  function App() {
    const [, update] = useState(0); refresh = () => update(n => n + 1)
    return h(SessionScreen, { ...f.p, setLogInputs(fn) { f.p.logInputs = fn(f.p.logInputs); refresh() } })
  }
  try {
    await act(async () => root.render(h(App)))
    await act(async () => button(host, 'Start dagens pas').click())
    await act(async () => type(host, 'weight', '47,5'))
    await act(async () => type(host, 'note-text', 'Bevar denne kladde'))
    toggle(fold(host)); toggle(fold(host, 'overview-2'))
    await act(async () => { await tick(); refresh() })
    assert.equal(fold(host).open, true); assert.equal(fold(host, 'overview-2').open, true)
    assert.equal(doc.activeElement, fold(host, 'overview-2').querySelector('summary'))
    assert.equal(host.querySelector('[data-field="weight"]').value, '47,5')
    assert.equal(host.querySelector('[data-field="note-text"]').value, 'Bevar denne kladde')
    button(host, 'Tilbage til dit sæt').click()
    assert.equal(doc.activeElement, host.querySelector('[data-field="weight"]'))
    assert.equal(f.calls.length, 0)
    await act(async () => { submit(host); await tick(); refresh() })
    assert.equal(f.calls.length, 1); assert.equal(f.calls[0][5].weight, '47.5')
    assert.equal(f.calls[0][5].note, 'Bevar denne kladde')
    assert.equal(fold(host).querySelector('[data-overview-current]').textContent, 'Sæt 2: Tilbage · Nu')
    f.p.enabled = false
    await act(async () => refresh())
    assert.equal(host.querySelector('dialog'), null)
  } finally {
    await act(async () => root.unmount())
    for (const [key, descriptor] of Object.entries(original)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
    assert.equal(f.timers.size, 0)
  }
})

// Independent vectors for a separate local same-engine Codex self-review pass.
// The fixture and oracle below do not reuse the producer fixture/status builder.
// This does not substitute for the coordinator's fresh native reviewer.
test('review vectors: strict week boundaries, exact IDs, duplicate conflicts, failed rows and optimistic suppression', () => {
  const vectors = [
    { rows: [], expected: 'remaining' },
    { rows: [{ logged_at: '2026-11-01T23:00:00Z' }], expected: 'completed' }, // Copenhagen Monday.
    { rows: [{ logged_at: '2026-11-01T22:59:59Z' }], expected: 'remaining' },
    { rows: [{ logged_at: '2026-11-09T00:00:00+01:00' }], expected: 'remaining' },
    { rows: [{ athlete_id: 'different-owner' }], expected: 'remaining' },
    { rows: [{ exercise_id: 'old-program-exercise' }], expected: 'remaining' },
    { rows: [{ session_id: 'old-session' }], expected: 'remaining' },
    { rows: [{ week_id: 'old-week' }], expected: 'remaining' },
    { rows: [{ program_id: 'old-program' }], expected: 'remaining' },
    { rows: [{ exercises: { session_id: 'old-session' } }], expected: 'remaining' },
    { rows: [{ skipped: true }], expected: 'skipped' },
    { rows: [{}, {}], expected: 'completed' },
    { rows: [{}, { skipped: true }], expected: 'unknown' },
    { rows: [{ _optimistic: true }], expected: 'waiting' },
    { rows: [{}, { _optimistic: true }], expected: 'waiting' },
    { rows: [{}], queue: true, expected: 'pending' },
    { rows: [{ skipped: true }], parked: true, expected: 'parked' },
    { rows: [{}], failed: true, expected: 'error' },
    { rows: [{}], loading: true, expected: 'unknown' },
    { rows: [{}], error: true, expected: 'unknown' },
    { rows: [{ logged_at: '2026-02-30T10:00:00Z' }], expected: 'remaining' },
    { rows: [{ logged_at: undefined }], undatedWeek: true, expected: 'unknown' },
  ]
  for (const [index, vector] of vectors.entries()) {
    const exercise = { id: 'review_lift_with_underscores', name: 'Review løft', sets: 2, reps: 7, recommended_weight: 0 }
    const session = { id: 'review-session', title: 'Uafhængig lokal vektor', exercises: [exercise] }
    const week = { id: 'review-week', athlete_id: 'review-owner', program_id: 'review-program', start_date: vector.undatedWeek ? undefined : '2026-11-02', sessions: [session] }
    const key = `${exercise.id}_1`
    const props = { enabled: true, athleteId: 'review-owner', allWeeks: [week], currentWeek: week,
      exerciseLogs: vector.rows.map(extra => ({ athlete_id: 'review-owner', exercise_id: exercise.id, set_number: 1,
        weight: 0, reps_completed: 7, logged_at: '2026-11-03T10:00:00Z', ...extra })),
      pendingSyncKeys: vector.queue ? [key] : [], parkedSets: vector.parked ? [{ exerciseId: exercise.id, setNumber: 1 }] : [],
      setConfirm: vector.failed ? { [key]: 'error' } : {}, exerciseLogsLoading: !!vector.loading, exerciseLogsError: !!vector.error,
      logInputs: {}, setLogInputs() { assert.fail('Review navigation edited an input') },
      onLogSet() { assert.fail('Review navigation wrote a log') } }
    const root = dom(), timerIds = new Set(), clock = { Date: { now: () => Date.parse('2026-11-08T12:00:00Z') },
      setInterval(fn) { timerIds.add(fn); return fn }, clearInterval(fn) { timerIds.delete(fn) } }
    const view = mountSession(root, () => props, { clock })
    try {
      button(root, 'Start dagens pas').click()
      toggle(fold(root)); toggle(fold(root, 'overview-0'))
      assert.equal(statuses(fold(root))[0], vector.expected, `review vector ${index}`)
      assert.equal(fold(root).querySelectorAll('[data-overview-status]').length, 2, `planned slots ${index}`)
      button(root, 'Tilbage til dit sæt').click()
      const input = root.querySelector('[data-field="weight"]')
      assert.ok(root.ownerDocument.activeElement === (input.disabled ? root.querySelector('[data-heading]') : input), `return ${index}`)
    } finally { view.dispose(); assert.equal(timerIds.size, 0) }
  }
})
