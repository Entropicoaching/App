import test from 'node:test'
import assert from 'node:assert/strict'
import { mountSession } from './sessionView.mjs'
import { dom } from './a11y-dom.mjs'
import { quickSetFixture } from './sessionQuickSetFixture.mjs'

// u8c (ordre 87): vægt og RPE i passet står med dansk komma, uanset hvor tallet kommer fra.
// Det gemte tal er uændret. Kun syntetiske data.
function setup(t) {
  const f = quickSetFixture(), root = dom(), timers = new Set()
  f.exercise.recommended_weight = 87.5
  const clock = { Date, setInterval(fn) { timers.add(fn); return fn }, clearInterval(fn) { timers.delete(fn) } }
  const view = mountSession(root, () => f.p, { clock })
  t.after(() => { view.dispose(); assert.equal(timers.size, 0) })
  view.controller.start()
  const field = name => root.querySelector(`[data-field="${name}"]`)
  const step = id => root.querySelector(`[data-step="${id}"]`)
  return { ...f, root, view, field, step }
}

test('u8c: planvægt, ±2,5 og RPE-knap viser dansk komma i felterne', t => {
  const f = setup(t)
  assert.equal(f.field('weight').value, '87,5', 'Som planlagt')
  f.step('weight-up').click(); f.view.update()
  assert.equal(f.field('weight').value, '90')
  f.step('weight-down').click(); f.view.update(); f.step('weight-down').click(); f.view.update()
  assert.equal(f.field('weight').value, '85')
  f.step('weight-up').click(); f.view.update()
  assert.equal(f.field('weight').value, '87,5', '±2,5')
  f.root.querySelector('[data-detail="rpe"]').open = true
  f.step('rpe-8.5').click(); f.view.update()
  assert.equal(f.field('rpe').value, '8,5', 'RPE-knap')
  assert.equal(f.step('rpe-8.5').getAttribute('aria-pressed'), 'true')
})

test('u8c: Som sidste sæt og sætlisten viser dansk komma; det gemte tal er uændret', async t => {
  const f = setup(t)
  f.field('rpe').value = '8,5'; f.field('rpe').dispatch('input'); f.view.update()
  f.root.querySelector('form').dispatch('submit'); await Promise.resolve()
  assert.equal(f.calls[0].input.weight, '87.5'); assert.equal(f.calls[0].input.rpe, '8.5')
  f.view.update()
  assert.equal(f.field('weight').value, '87,5', 'Som sidste sæt')
  const text = f.root.textContent
  assert.match(text, /Sæt 1: 87,5 kg, 5 gent\., RPE 8,5/)
  assert.doesNotMatch(text, /87\.5|RPE 8\.5/)
})
