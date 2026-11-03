import test from 'node:test'
import assert from 'node:assert/strict'
import { sessionSummary } from './sessionSummary.mjs'
import { mountSession } from './sessionView.mjs'
import { dom, button } from './a11y-dom.mjs'

const now = Date.parse('2026-11-03T12:00:00Z')
const clock = { Date: { now: () => now }, setInterval() { assert.fail('Unexpected real timer') }, clearInterval() {} }
function fixture() {
  const session = { id: 'session', title: 'Dagens pas', exercises: [
    { id: 'a', name: 'Løft A', sets: 2, reps: 5, recommended_weight: 60 },
    { id: 'b', name: 'Løft B', sets: 1, reps: 3, recommended_weight: 40 },
    { id: 'c', name: 'Løft C', sets: 0 },
  ] }
  const week = { id: 'week', sessions: [session] }
  const p = { enabled: true, athleteId: 'synthetic', currentWeek: week, allWeeks: [week],
    exerciseLogs: [], logInputs: {}, setLogInputs() {}, parsePlannedRpe: () => null }
  return { p, session }
}
const row = (exercise_id, set_number, extra = {}) => ({ exercise_id, set_number, athlete_id: 'synthetic',
  weight: 60, reps_completed: 5, rpe_actual: null, logged_at: '2026-11-03T10:00:00Z', ...extra })

test('summary: zero, partial, complete, no sets and frozen input', () => {
  const { p, session } = fixture()
  const read = () => sessionSummary(session, p.exerciseLogs, p, now)
  assert.deepEqual([read().done, read().total, read().highestRpe], [0, 3, null])
  assert.deepEqual(read().exercises.map(e => e.missing), [2, 1, 0])
  p.exerciseLogs = [row('a', 1)]
  assert.equal(read().done, 1)
  assert.deepEqual(read().exercises.map(e => e.missing), [1, 1, 0])
  p.exerciseLogs.push(row('a', 2), row('b', 1))
  Object.freeze(p.exerciseLogs); Object.freeze(session.exercises); Object.freeze(session); Object.freeze(p)
  assert.equal(read().done, 3)
  assert.ok(read().exercises.every(e => e.missing === 0))
  assert.deepEqual(sessionSummary(null, [], {}, now), { done: 0, total: 0, exercises: [], highestRpe: null })
})

test('summary: daily decimal metrics omit old/future/skipped/invalid data; zero kg and zero RPE survive', () => {
  const { p, session } = fixture()
  p.exerciseLogs = [row('a', 1, { weight: '62.5', rpe_actual: '8,5' }), row('a', 2, { weight: '65,25', rpe_actual: 9.5 }),
    row('b', 1, { weight: 0, rpe_actual: 0 })]
  let result = sessionSummary(session, p.exerciseLogs, p, now)
  assert.equal(result.highestRpe, '9,5')
  assert.equal(result.exercises[0].heaviest, '65,25 kg × 5')
  assert.equal(result.exercises[1].heaviest, '0 kg × 5')
  for (const extra of [{ logged_at: '2026-11-02T10:00:00Z' }, { logged_at: '2026-11-03T13:00:00Z' },
    { logged_at: '2026-11-03' }, { logged_at: '2026-02-30T10:00:00Z' }, { skipped: true }]) {
    result = sessionSummary(session, [row('a', 1, { weight: 999, rpe_actual: 10, ...extra })], p, now)
    assert.equal(result.done, 1); assert.equal(result.highestRpe, null); assert.equal(result.exercises[0].heaviest, null)
  }
  for (const value of ['', null, -1, 'NaN', Infinity, 11]) {
    result = sessionSummary(session, [row('a', 1, { rpe_actual: value })], p, now)
    assert.equal(result.highestRpe, null)
  }
  result = sessionSummary(session, [row('a', 1, { logged_at: '2026-11-02T23:30:00Z', rpe_actual: 7 })], p, now)
  assert.equal(result.highestRpe, '7') // Copenhagen's current calendar day.
})

test('summary: only planned confirmed own slots count once; queued and parked do not count', () => {
  const { p, session } = fixture()
  p.exerciseLogs = [row('a', 1), row('a', 1), row('a', 3), row('other', 1),
    row('a', 2, { _optimistic: true }), row('b', 1, { athlete_id: 'other' })]
  assert.equal(sessionSummary(session, p.exerciseLogs, p, now).done, 1)
  p.pendingSyncKeys = ['a_1']
  assert.equal(sessionSummary(session, p.exerciseLogs, p, now).done, 0)
  p.pendingSyncKeys = []; p.parkedSets = [{ exerciseId: 'a', setNumber: 1 }]
  assert.equal(sessionSummary(session, p.exerciseLogs, p, now).done, 0)
})

test('actual DOM: manual zero/partial finish, repeat, resume, close/reopen, history and accessible focus', () => {
  const { p } = fixture(), root = dom(), view = mountSession(root, () => p, { clock })
  try {
    button(root, 'Start dagens pas').click()
    const live = root.querySelectorAll('[role="status"]').at(-1)
    button(root, 'Afslut pas').click()
    const heading = root.querySelector('[data-heading]')
    assert.equal(heading.textContent, 'Opsummering af passet')
    assert.equal(root.ownerDocument.activeElement, heading)
    assert.equal(heading.getAttribute('tabindex'), '-1')
    assert.match(root.querySelector('[data-session-summary]').textContent, /0 af 3 sæt klaret/)
    assert.match(root.textContent, /Løft C: ingen planlagte sæt/)
    assert.equal(view.controller.finish(), true)
    assert.equal(root.querySelector('[data-heading]'), heading)
    assert.equal(live.getAttribute('aria-live'), 'polite')
    button(root, 'Fortsæt passet').click()
    assert.equal(root.querySelector('[data-session-summary]'), null)
    p.exerciseLogs.push(row('a', 1, { rpe_actual: 8.5 })); view.update()
    button(root, 'Afslut pas').click()
    assert.equal(root.querySelectorAll('[role="status"]').at(-1), live)
    assert.equal(live.textContent, '1 af 3 sæt klaret')
    assert.match(root.textContent, /Løft A: 1 sæt tilbage/)
    assert.match(root.textContent, /Højeste RPE i dag: 8,5/)
    assert.ok(root.querySelector('[data-last-set]'))
    button(root, 'Luk pas').click()
    button(root, 'Åbn dagens pas').click()
    assert.ok(root.querySelector('[data-session-summary]'))
    p.enabled = false; view.update()
    assert.equal(root.hidden, true); assert.equal(root.querySelector('dialog'), null)
  } finally { view.dispose() }
})

test('actual DOM: automatic finish waits for confirmation and focuses summary after final save', async () => {
  const { p } = fixture(), root = dom()
  p.exerciseLogs = [row('a', 1), row('a', 2)]
  let settle, writes = 0
  p.onLogSet = () => { writes++; p.exerciseLogs.push(row('b', 1, { _optimistic: true })); return new Promise(r => { settle = r }) }
  const view = mountSession(root, () => p, { clock })
  try {
    view.controller.start()
    const stamp = view.controller.state().selection.stamp
    const saving = view.controller.approve('b_1', { weight: '42.5', reps: '3', rpe: '' }, stamp)
    view.update(); assert.equal(root.querySelector('[data-session-summary]'), null)
    p.exerciseLogs[2] = row('b', 1, { weight: 42.5 }); view.update()
    assert.equal(root.querySelector('[data-session-summary]'), null)
    settle(); assert.equal(await saving, true)
    assert.equal(writes, 1)
    assert.match(root.querySelector('[data-session-summary]').textContent, /3 af 3 sæt klaret/)
    assert.equal(root.ownerDocument.activeElement, root.querySelector('[data-heading]'))
    assert.equal(root.querySelector('form'), null)
    assert.equal(await view.controller.approve('b_1', { weight: '42.5', reps: '3' }, stamp), false)
    assert.equal(view.controller.finish(), true); assert.equal(writes, 1)
  } finally { view.dispose() }
})

test('manual finish cannot write and summary is discarded on a new plan', async () => {
  const { p } = fixture(), root = dom(), view = mountSession(root, () => p, { clock })
  p.onLogSet = () => assert.fail('Finish must not save')
  try {
    assert.equal(view.controller.finish(), false)
    view.controller.start(); const s = view.controller.state(); view.controller.finish()
    assert.equal(await view.controller.approve(s.key, { weight: '60', reps: '5' }, s.selection.stamp), false)
    p.currentWeek.sessions[0].exercises[0].sets = 3; view.update()
    assert.equal(root.querySelector('dialog'), null)
    view.controller.start()
    assert.equal(root.querySelector('[data-session-summary]'), null)
  } finally { view.dispose() }
})
