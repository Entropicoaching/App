import test from 'node:test'
import assert from 'node:assert/strict'
import { mountSession } from './sessionView.mjs'
import { syntheticDom } from './sessionSyntheticDom.mjs'

export function fixture() {
  const ex = { id: 'ex-a', name: 'Løft A', sets: 2, reps: '5', recommended_weight: 80 }
  const week = { id: 'week-a', athlete_id: 'athlete-a', sessions: [{ id: 'session-a', exercises: [ex,
    { ...ex, id: 'ex-b', name: 'Løft B', sets: 1 }] }] }
  const p = { enabled: true, athleteId: 'athlete-a', allWeeks: [week], currentWeek: week,
    exerciseLogs: [], logInputs: {}, setLogInputs(fn) { p.logInputs = fn(p.logInputs) },
    parsePlannedRpe: () => null,
    onLogSet(ex, set, total, reps, planned, input) { p.exerciseLogs.push({ exercise_id: ex.id, set_number: set,
      weight: Number(input.weight), reps_completed: reps, rpe_actual: null, logged_at: '2026-11-03T11:00:00Z' }) } }
  return p
}
test('OFF, start, edit, confirmed save, pause and disposal preserve behavior', async () => {
  const p = fixture(), dom = syntheticDom(), view = mountSession(dom.root, () => p, dom)
  assert.equal(view.controller.start(), true)
  const s = view.controller.state()
  view.controller.edit(s.key, 'weight', '82.5', s.selection.stamp)
  assert.equal(p.logInputs[s.key].weight, '82.5')
  assert.equal(await view.controller.approve(s.key, { weight: '82.5', reps: '5', rpe: '' }, s.selection.stamp), true)
  assert.equal(view.controller.state().next.setNumber, 2)
  p.restPause = { startedAt: dom.clock.Date.now(), durationSeconds: 60 }; view.update()
  assert.match(dom.root.textContent, /Pause: 60 sekunder/); assert.equal(dom.timers.size, 1)
  view.controller.close(); assert.equal(dom.timers.size, 0)
  p.enabled = false; view.update(); assert.equal(dom.root.hidden, true); assert.equal(view.controller.start(), false)
  view.dispose(); assert.equal(dom.root.children.length, 0); assert.equal(dom.timers.size, 0)
})
test('actual renderer shows calm history per exercise, refreshes and removes it', () => {
  const p = fixture(), dom = syntheticDom()
  p.exerciseLogs = [{ athlete_id: 'athlete-a', exercise_id: 'ex-a', set_number: 1,
    weight: 80, reps_completed: 5, rpe_actual: 8, logged_at: '2026-10-28T10:00:00Z' },
  { athlete_id: 'athlete-a', exercise_id: 'ex-b', set_number: 1,
    weight: 45, reps_completed: 6, rpe_actual: 7, logged_at: '2026-10-29T10:00:00Z' }]
  const view = mountSession(dom.root, () => p, dom)
  try {
    view.controller.start()
    const lines = () => dom.root.querySelectorAll('[data-last-set]').map(n => n.textContent)
    assert.deepEqual(lines(), ['Sidst: 80 kg × 5 · RPE 8 (28. okt.)',
      'Sidst: 80 kg × 5 · RPE 8 (28. okt.)', 'Sidst: 45 kg × 6 · RPE 7 (29. okt.)'])
    assert.equal(dom.root.querySelector('[data-last-set]').getAttribute('class'), 'muted')
    assert.equal(dom.root.querySelector('[data-last-set]').getAttribute('role'), null)
    const field = dom.root.querySelector('[data-field="weight"]')
    field.focus(); field.setSelectionRange(1, 2)
    const details = dom.root.querySelector('[data-detail="history"]'); details.open = true
    view.update()
    assert.equal(dom.doc.activeElement.getAttribute('data-field'), 'weight')
    assert.equal(dom.doc.activeElement.selectionStart, 1)
    assert.equal(dom.root.querySelector('[data-detail="history"]').open, true)
    p.exerciseLogs = []; view.update(); assert.deepEqual(lines(), [])
    p.exerciseLogs = [{ athlete_id: 'athlete-b', exercise_id: 'ex-a', set_number: 1,
      weight: 200, reps_completed: 1, rpe_actual: 10, logged_at: '2026-10-28T10:00:00Z' }]
    view.update(); assert.deepEqual(lines(), [])
    p.enabled = false; view.update(); assert.equal(dom.root.hidden, true); assert.equal(dom.root.querySelector('dialog'), null)
  } finally { view.dispose() }
  assert.equal(dom.timers.size, 0)
})
