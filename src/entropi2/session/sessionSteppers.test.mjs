import test from 'node:test'
import assert from 'node:assert/strict'
import { mountSession } from './sessionView.mjs'
import { syntheticDom } from './sessionSyntheticDom.mjs'
import { fixture } from './sessionRegression.test.mjs'

// Marc 3. nov.: the old Dagens pas let the athlete change weight by 2,5 kg and pick RPE with one tap.
test('one tap changes weight by 2,5 kg, reps by 1 and picks or clears RPE', () => {
  const p = fixture(), dom = syntheticDom(), view = mountSession(dom.root, () => p, dom)
  view.controller.start()
  const key = view.controller.state().key
  const tap = label => dom.root.querySelector(`[data-step="${label}"]`).fire('click')
  view.controller.edit(key, 'weight', '80', view.controller.state().selection.stamp)
  tap('weight-up'); assert.equal(p.logInputs[key].weight, '82.5')
  tap('weight-up'); assert.equal(p.logInputs[key].weight, '85')
  tap('weight-down'); assert.equal(p.logInputs[key].weight, '82.5')
  view.controller.edit(key, 'weight', '0', view.controller.state().selection.stamp)
  tap('weight-down'); assert.equal(p.logInputs[key].weight, '0')
  view.controller.edit(key, 'reps', '5', view.controller.state().selection.stamp)
  tap('reps-up'); assert.equal(p.logInputs[key].reps, '6')
  tap('reps-down'); tap('reps-down'); assert.equal(p.logInputs[key].reps, '4')
  tap('rpe-8.5'); assert.equal(p.logInputs[key].rpe, '8.5')
  view.update() // the app rerenders when logInputs change
  assert.equal(dom.root.querySelector('[data-step="rpe-8.5"]').getAttribute('aria-pressed'), 'true')
  assert.equal(dom.root.querySelector('[data-step="rpe-9"]').getAttribute('aria-pressed'), 'false')
  tap('rpe-8.5'); assert.equal(p.logInputs[key].rpe, '')
  const rpeButtons = dom.root.querySelectorAll('[data-step]').filter(n => n.getAttribute('class') === 'rpe')
  assert.deepEqual(rpeButtons.map(n => n.textContent), ['6', '6,5', '7', '7,5', '8', '8,5', '9', '9,5', '10'])
  view.dispose()
})
