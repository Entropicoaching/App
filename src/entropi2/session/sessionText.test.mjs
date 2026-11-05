import test from 'node:test'
import assert from 'node:assert/strict'
import { mountSession } from './sessionView.mjs'
import { syntheticDom } from './sessionSyntheticDom.mjs'

test('Danish repetition labels and errors preserve the production input key and approval payload', async () => {
  const ex = { id: 'synthetic-lift', name: 'Syntetisk løft', sets: 2, reps: 5, recommended_weight: 0 }
  const week = { id: 'synthetic-week', athlete_id: 'synthetic-a',
    sessions: [{ id: 'synthetic-session', exercises: [ex] }] }
  const calls = []
  const props = { enabled: true, athleteId: 'synthetic-a', allWeeks: [week], currentWeek: week,
    exerciseLogs: [], logInputs: {}, setLogInputs(fn) { props.logInputs = fn(props.logInputs) },
    parsePlannedRpe: () => null, onLogSet(...args) { calls.push(args); return { phase: 'queued' } } }
  const dom = syntheticDom(), view = mountSession(dom.root, () => props, dom)
  try {
    view.controller.start()
    const input = dom.root.querySelector('[data-field="reps"]')
    assert.match(input.parent.textContent, /Gentagelser/)
    input.value = '2.5'; input.fire('input')
    const s = view.controller.state()
    assert.equal(s.input.reps, '2.5')
    assert.equal(await view.controller.approve(s.key, s.input, s.selection.stamp), false)
    assert.match(dom.root.querySelector('[role="alert"]').textContent, /Skriv vægt og hele gentagelser over 0/)
    assert.equal(calls.length, 0)
    assert.doesNotMatch(dom.root.textContent, /\breps\b/i)
    const values = { weight: '0', reps: '5', rpe: '' }
    await view.controller.approve(s.key, values, s.selection.stamp)
    assert.equal(calls.length, 1)
    assert.deepEqual(calls[0], [ex, 1, 2, 5, null,
      { ...values, rpe_source: null }, { preserveMissingRpe: true, sessionOnly: true }])
  } finally { view.dispose(); assert.equal(dom.timers.size, 0) }
})
