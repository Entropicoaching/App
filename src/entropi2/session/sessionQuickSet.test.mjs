import test from 'node:test'
import assert from 'node:assert/strict'
import { mountSession } from './sessionView.mjs'
import { setSuggestion } from './sessionModel.mjs'
import { dom, button } from './a11y-dom.mjs'
import { quickSetFixture } from './sessionQuickSetFixture.mjs'

function setup(t) {
  const f = quickSetFixture(), root = dom(), timers = new Set()
  const clock = { Date, setInterval(fn) { timers.add(fn); return fn }, clearInterval(fn) { timers.delete(fn) } }
  const view = mountSession(root, () => f.p, { clock })
  t.after(() => { view.dispose(); assert.equal(timers.size, 0) })
  view.controller.start()
  const field = name => root.querySelector(`[data-field="${name}"]`)
  const submit = () => { root.querySelector('form').dispatch('submit'); return Promise.resolve() }
  const edit = (name, value) => { field(name).value = value; field(name).dispatch('input'); view.update() }
  return { ...f, root, view, timers, field, submit, edit }
}

test('one submit confirms plan, copies last same-exercise weight/reps and advances focus without auto-saving', async t => {
  const f = setup(t)
  assert.equal(f.field('weight').value, '80'); assert.equal(f.field('reps').value, '5')
  assert.ok(button(f.root, 'Som planlagt')); assert.equal(f.calls.length, 0)
  assert.deepEqual(f.p.logInputs, {}); assert.equal(f.timers.size, 0)
  f.edit('weight', '82,5'); f.edit('reps', '6'); f.edit('rpe', '8.5')
  assert.ok(button(f.root, 'Godkendt'))
  await f.submit()
  assert.equal(f.calls.length, 1)
  assert.equal(f.calls[0].input.weight, '82.5'); assert.equal(f.calls[0].reps, 6)
  assert.deepEqual(f.calls[0].options, { preserveMissingRpe: true, sessionOnly: true })
  assert.equal(f.view.controller.state().next.setNumber, 2)
  assert.equal(f.field('weight').value, '82.5'); assert.equal(f.field('reps').value, '6')
  assert.equal(f.field('rpe').value, ''); assert.equal(f.root.querySelector('textarea').value, '')
  assert.ok(button(f.root, 'Som sidste sæt'))
  assert.equal(f.root.ownerDocument.activeElement, f.root.querySelector('[data-heading]'))
  assert.equal(f.timers.size, 1)
  f.view.update(); f.view.controller.close(); f.view.controller.start()
  assert.equal(f.calls.length, 1); assert.equal(f.field('reps').value, '6')
  await f.submit()
  assert.equal(f.calls.length, 2); assert.equal(f.calls[1].input.rpe, '')
  assert.equal(f.calls[1].input.rpe_source, null)
  await f.submit()
  assert.equal(f.view.controller.state().next.exercise.id, 'quick-b')
  assert.equal(f.field('weight').value, '30'); assert.equal(f.field('reps').value, '8')
  assert.ok(button(f.root, 'Som planlagt')); assert.equal(f.calls.length, 3)
})

test('nearest earlier usable pair wins without sorting source rows or crossing identities and queue state', () => {
  const { p, exercise } = quickSetFixture(), next = { exercise, setNumber: 3 }
  const row = extra => ({ athlete_id: p.athleteId, exercise_id: exercise.id, set_number: 1, weight: 72.5, reps_completed: 7, ...extra })
  p.exerciseLogs = [row(), row({ set_number: 2, weight: 0, reps_completed: 6, rpe_actual: 9, note: 'Tungt' })]
  const before = JSON.stringify(p)
  assert.deepEqual(setSuggestion(p, next), { weight: '0', reps: '6', label: 'Som sidste sæt' })
  assert.equal(JSON.stringify(p), before)
  for (const extra of [{ skipped: true }, { _optimistic: true }, { athlete_id: 'other' }, { exercise_id: 'other' },
    { weight: '' }, { weight: -1 }, { weight: Infinity }, { reps_completed: 0 }, { reps_completed: 1.5 },
    { set_number: 3 }, { set_number: -1 }, { set_number: '2' }]) {
    p.exerciseLogs = [row(), row({ set_number: 2, weight: 90, ...extra })]
    assert.equal(setSuggestion(p, next).weight, '72.5', JSON.stringify(extra))
  }
  for (const phase of ['pending', 'parked']) {
    p.exerciseLogs = [row(), row({ set_number: 2, weight: 90 })]
    p.pendingSyncKeys = phase === 'pending' ? ['quick-a_2'] : []
    p.parkedSets = phase === 'parked' ? [{ exerciseId: exercise.id, setNumber: 2 }] : []
    assert.equal(setSuggestion(p, next).weight, '72.5')
  }
  p.pendingSyncKeys = []; p.parkedSets = []
  for (const flag of ['exerciseLogsError', 'exerciseLogsLoading']) {
    p[flag] = true; assert.equal(setSuggestion(p, next).weight, 80); p[flag] = false
  }
  p.enabled = false
  assert.deepEqual(setSuggestion(p, next), { weight: '', reps: '', label: null })
})

test('edited next-set drafts win; explicit clear remains empty across refresh, close and retry', async t => {
  const f = setup(t)
  f.p.logInputs['quick-a_2'] = { weight: '91', reps: '4' }
  await f.submit()
  assert.equal(f.field('weight').value, '91'); assert.equal(f.field('reps').value, '4')
  f.edit('weight', ''); f.edit('reps', '')
  f.view.controller.close(); f.view.controller.start(); f.view.update()
  assert.equal(f.field('weight').value, ''); assert.equal(f.field('reps').value, '')
  assert.ok(button(f.root, 'Godkendt'))
  await f.submit()
  assert.equal(f.calls.length, 1); assert.match(f.root.textContent, /Skriv vægt/)
})

test('zero weight is a complete plan; ranges, missing and invalid prescriptions require input', async t => {
  const f = setup(t)
  for (const [weight, reps, label] of [[0, '5', 'Som planlagt'], [80, '5-8', 'Godkendt'], ['', '5', 'Godkendt'], ['bad', '5', 'Godkendt'], [80, '0', 'Godkendt']]) {
    f.exercise.recommended_weight = weight; f.exercise.reps = reps; f.view.update(); f.view.controller.start()
    assert.ok(button(f.root, label))
    assert.equal(f.calls.length, 0)
  }
  f.exercise.recommended_weight = 0; f.exercise.reps = '5'; f.view.update(); f.view.controller.start()
  await f.submit(); assert.equal(f.calls[0].input.weight, '0')
})

test('double and retained submits, busy edits, OFF, read-only and changed plans keep existing guards', async t => {
  const f = setup(t), form = f.root.querySelector('form')
  let settle
  f.p.onLogSet = (...args) => { f.calls.push(args); return new Promise(r => { settle = r }) }
  const first = f.submit(); await f.submit()
  assert.equal(f.calls.length, 1)
  assert.equal(f.root.querySelector('.approve').disabled, true)
  f.edit('weight', '100'); assert.equal(f.p.logInputs['quick-a_1'], undefined)
  settle({ phase: 'error' }); await first; await Promise.resolve()
  assert.equal(f.field('weight').value, '80'); assert.ok(button(f.root, 'Som planlagt'))
  for (const change of [() => { f.p.readOnly = true }, () => { f.p.readOnly = false; f.exercise.recommended_weight = 85 }, () => { f.p.enabled = false }]) {
    change(); f.view.update(); form.dispatch('submit'); await Promise.resolve()
    assert.equal(f.calls.length, 1)
  }
})

test('queued overlays preserve approved fields and never advance, start rest or offer another write', async t => {
  const f = setup(t)
  f.p.exerciseLogs.push({ athlete_id: f.p.athleteId, exercise_id: 'quick-a', set_number: 1,
    weight: 87.5, reps_completed: 6, rpe_actual: null, _optimistic: true })
  f.p.pendingSyncKeys = ['quick-a_1']; f.view.update()
  assert.equal(f.field('weight').value, '87.5'); assert.equal(f.field('reps').value, '6')
  assert.ok(button(f.root, 'Venter på net')); assert.equal(f.view.controller.state().next.setNumber, 1)
  await f.submit(); assert.equal(f.calls.length, 0); assert.equal(f.timers.size, 0)
  f.p.pendingSyncKeys = []; f.p.exerciseLogs[0]._optimistic = false; f.view.update()
  assert.equal(f.view.controller.state().next.setNumber, 2)
  assert.equal(f.field('weight').value, '87.5'); assert.equal(f.field('reps').value, '6')
})
