import test from 'node:test'
import assert from 'node:assert/strict'
import { mountSession } from './sessionView.mjs'
import { dom, button } from './a11y-dom.mjs'
import { quickSetFixture } from './sessionQuickSetFixture.mjs'

function setup(t, patch = {}) {
  const f = quickSetFixture(), root = dom(), timers = new Set()
  Object.assign(f.p, patch)
  const view = mountSession(root, () => f.p, { clock: {
    Date: { now: () => Date.parse('2026-11-03T12:00:00Z') },
    setInterval(fn) { timers.add(fn); return fn }, clearInterval(fn) { timers.delete(fn) }
  } })
  t.after(() => { view.dispose(); assert.equal(timers.size, 0) })
  view.controller.start()
  return { ...f, root, view, doc: root.ownerDocument }
}
const fold = f => f.root.querySelector('[data-detail="rpe"]')
const input = (f, name) => f.root.querySelector(`[data-field="${name}"]`)
const step = (f, id) => f.root.querySelector(`[data-step="${id}"]`)
const approve = f => { const s = f.view.controller.state(); return f.view.controller.approve(s.key, s.input, s.selection.stamp) }

test('optional RPE starts folded after weight/reps, exposes all choices and never copies planned RPE', t => {
  const f = setup(t)
  f.exercise.intensity = 'RPE 8'; f.view.update(); f.view.controller.start()
  const d = fold(f)
  assert.ok(d); assert.equal(d.open, false)
  assert.equal(d.querySelector('summary').textContent, 'Tilføj oplevet anstrengelse (RPE)')
  assert.equal(input(f, 'rpe').value, '')
  assert.equal(d.querySelector('label').textContent, 'Oplevet RPE (valgfri)')
  assert.ok(input(f, 'rpe').parentElement === d.querySelector('label'))
  assert.deepEqual(d.querySelectorAll('button').map(b => b.textContent), ['6', '6,5', '7', '7,5', '8', '8,5', '9', '9,5', '10'])
  const fields = d.parentElement
  assert.ok(fields.children.indexOf(d) > fields.children.indexOf(input(f, 'reps').parentElement.parentElement))
  d.open = true; f.view.update(); assert.equal(fold(f).open, true)
  assert.equal(f.calls.length, 0)
})

test('typed RPE, including zero, stays visible/open; cleared RPE stays empty and saves as missing', async t => {
  for (const value of ['0', '5,5', '8.5', '10']) {
    const f = setup(t, { logInputs: { 'quick-a_1': { rpe: value } } })
    assert.equal(fold(f).open, true)
    assert.match(fold(f).querySelector('summary').textContent, new RegExp(value.replace('.', ',')))
    fold(f).open = false; f.view.update()
    assert.equal(fold(f).open, true)
    const rpe = input(f, 'rpe'); rpe.value = ''; rpe.dispatch('input'); f.view.update()
    assert.equal(fold(f).open, true); assert.equal(input(f, 'rpe').value, '')
    assert.equal(await approve(f), true)
    assert.equal(f.calls[0].input.rpe, ''); assert.equal(f.calls[0].input.rpe_source, null)
    assert.deepEqual(f.calls[0].options, { preserveMissingRpe: true, sessionOnly: true })
    assert.equal(fold(f).open, false); assert.equal(input(f, 'rpe').value, '')
  }
})

test('every weight/reps/RPE button keeps focus across repeated same-set prop refreshes', t => {
  const f = setup(t)
  for (const id of ['weight-up', 'weight-down', 'reps-up', 'reps-down', 'rpe-6', 'rpe-6.5', 'rpe-7', 'rpe-7.5', 'rpe-8', 'rpe-8.5', 'rpe-9', 'rpe-9.5', 'rpe-10']) {
    if (id.startsWith('rpe-')) fold(f).open = true
    for (let repeat = 0; repeat < 2; repeat++) {
      const old = step(f, id); old.focus(); old.click(); f.view.update()
      assert.ok(step(f, id) !== old)
      assert.ok(f.doc.activeElement === step(f, id), id)
      if (id.startsWith('rpe-')) assert.equal(fold(f).open, true)
    }
  }
  assert.equal(f.calls.length, 0)
})

test('RPE field selection and fold summary focus survive; next set resets fold and focuses heading', async t => {
  const f = setup(t)
  fold(f).open = true
  input(f, 'rpe').value = '8,5'; input(f, 'rpe').dispatch('input')
  input(f, 'rpe').focus(); input(f, 'rpe').setSelectionRange(1, 2); f.view.update()
  assert.ok(f.doc.activeElement === input(f, 'rpe'))
  assert.equal(input(f, 'rpe').selectionStart, 1); assert.equal(input(f, 'rpe').selectionEnd, 2)
  fold(f).querySelector('summary').focus(); f.view.update()
  assert.ok(f.doc.activeElement === fold(f).querySelector('summary'))
  step(f, 'rpe-9').focus(); step(f, 'rpe-9').click(); f.view.update()
  assert.equal(await approve(f), true)
  assert.equal(f.calls[0].input.rpe, '9'); assert.equal(f.calls[0].input.rpe_source, 'athlete')
  assert.equal(fold(f).open, false); assert.equal(input(f, 'rpe').value, '')
  assert.ok(f.doc.activeElement === f.root.querySelector('[data-heading]'))
})

test('saving and waiting lock controls, error preserves RPE and restores available focused step', async t => {
  const f = setup(t)
  fold(f).open = true; step(f, 'rpe-8.5').click(); f.view.update()
  let resolve
  f.p.onLogSet = () => new Promise(r => { resolve = r })
  step(f, 'rpe-8.5').focus()
  const saving = approve(f)
  assert.equal(fold(f).open, true)
  assert.equal(step(f, 'rpe-8.5').disabled, true)
  assert.equal(input(f, 'rpe').value, '8,5')
  assert.ok(f.doc.activeElement === f.root.querySelector('[data-heading]'))
  assert.match(fold(f).textContent, /0 til 10/)
  resolve({ phase: 'error' }); await saving
  assert.equal(step(f, 'rpe-8.5').disabled, false)
  step(f, 'rpe-8.5').focus(); f.view.update()
  assert.ok(f.doc.activeElement === step(f, 'rpe-8.5'))
  assert.equal(input(f, 'rpe').value, '8,5')
  assert.match(f.root.querySelector('[data-announce]').textContent, /Dine tal er bevaret/)
})

test('offline, parked and optimistic sets preserve entered RPE and locks; OFF and read-only remove controls', t => {
  for (const phase of ['queued', 'parked', 'waiting']) {
    const f = setup(t, { logInputs: { 'quick-a_1': { rpe: '7.5' } } })
    if (phase === 'queued') f.p.pendingSyncKeys = ['quick-a_1']
    if (phase === 'parked') f.p.parkedSets = [{ exerciseId: 'quick-a', setNumber: 1 }]
    if (phase === 'waiting') f.p.exerciseLogs = [{ exercise_id: 'quick-a', set_number: 1, _optimistic: true }]
    f.view.update()
    assert.equal(fold(f).open, true); assert.equal(input(f, 'rpe').value, '7,5')
    assert.equal(input(f, 'rpe').disabled, true); assert.equal(step(f, 'rpe-8').disabled, true)
    assert.equal(f.calls.length, 0)
    f.p.readOnly = true; f.view.update(); assert.equal(fold(f), null)
    f.p.enabled = false; f.view.update(); assert.equal(f.root.querySelector('dialog'), null)
    assert.equal(f.root.hidden, true)
  }
})

test('closing returns focus to opener and reopening retains self-entered RPE', t => {
  const f = setup(t)
  fold(f).open = true; step(f, 'rpe-8').click(); f.view.update()
  button(f.root, 'Luk pas').click()
  assert.ok(f.doc.activeElement === button(f.root, 'Åbn dagens pas'))
  button(f.root, 'Åbn dagens pas').click()
  assert.equal(fold(f).open, true); assert.equal(input(f, 'rpe').value, '8')
  assert.ok(f.doc.activeElement === f.root.querySelector('[data-heading]'))
})


test('a step inside a closed RPE fold is unavailable and cannot receive restored focus', t => {
  const f = setup(t)
  fold(f).open = true; step(f, 'rpe-8').focus()
  fold(f).open = false; f.view.update()
  assert.equal(fold(f).open, false)
  assert.ok(f.doc.activeElement === f.root.querySelector('[data-heading]'))
})
