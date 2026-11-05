import test from 'node:test'
import assert from 'node:assert/strict'
import { mountSession } from './sessionView.mjs'
import { sessionStyle } from './sessionStyle.mjs'
import { dom, button } from './a11y-dom.mjs'
import { quickSetFixture } from './sessionQuickSetFixture.mjs'

const planIn = root => root.querySelectorAll('section').find(n => n.getAttribute('aria-label') === 'Planlagt belastning')

function setup(t, exercise = {}) {
  const f = quickSetFixture(), root = dom(), timers = new Set()
  Object.assign(f.exercise, exercise)
  const view = mountSession(root, () => f.p, { clock: {
    Date: { now: () => Date.parse('2026-11-03T12:00:00Z') },
    setInterval(fn) { timers.add(fn); return fn }, clearInterval(fn) { timers.delete(fn) }
  } })
  t.after(() => { view.dispose(); assert.equal(timers.size, 0) })
  view.controller.start()
  return { ...f, root, view }
}

test('one visible plan line contains the exact short or long prescription, with focus outside folds', t => {
  for (const reps of ['5', '5 langsomme gentagelser efterfulgt af en meget lang teknisk instruktion']) {
    const f = setup(t, { reps, recommended_weight: 0, note: 'Hold kontrollen hele vejen' })
    const plan = planIn(f.root)
    assert.equal(plan.querySelectorAll('.plan').length, 1)
    assert.equal(plan.querySelector('.plan').textContent, `${reps} gentagelser · 0 kg`)
    assert.ok(plan.matches('.plan-card'))
    const focus = plan.querySelectorAll('p').find(n => n.textContent.startsWith('Coachens fokus:'))
    assert.equal(focus.parentElement, plan)
    assert.equal(focus.textContent, 'Coachens fokus: Hold kontrollen hele vejen')
    assert.equal(f.calls.length, 0)
    assert.ok(f.root.querySelector('form').matches('.registration-card'))
  }
})

test('missing prescriptions remain honest and missing reps remain an unfolded alert', t => {
  for (const missing of [null, undefined, '', '   ']) {
    const f = setup(t, { reps: missing, recommended_weight: missing })
    const plan = planIn(f.root)
    const alert = plan.querySelector('[role="alert"]')
    assert.equal(alert.parentElement, plan)
    assert.match(alert.textContent, /Gentagelser mangler i planen/)
    assert.doesNotMatch(plan.textContent, /kg|undefined|null| · /)
  }
  const weightOnly = setup(t, { reps: null, recommended_weight: 80 })
  assert.equal(weightOnly.root.querySelector('.plan').textContent, '80 kg')
  const repsOnly = setup(t, { reps: '5', recommended_weight: null })
  assert.equal(repsOnly.root.querySelector('.plan').textContent, '5 gentagelser')
})

test('registration follows the compact plan directly on every set, including the next exercise ramp', async t => {
  const f = setup(t)
  for (let index = 0; index < 4; index++) {
    const plan = planIn(f.root), form = f.root.querySelector('form'), siblings = plan.parentElement.children
    assert.equal(siblings.indexOf(form), siblings.indexOf(plan) + 1)
    if (index === 3) {
      assert.equal(f.view.controller.state().next.exercise.id, f.other.id)
      const warm = f.root.querySelector('[data-detail="warmup"]')
      assert.ok(warm); assert.equal(warm.open, false)
      assert.ok(siblings.indexOf(warm) < siblings.indexOf(plan))
    } else {
      const s = f.view.controller.state()
      assert.equal(await f.view.controller.approve(s.key, s.input, s.selection.stamp), true)
    }
  }
  assert.equal(f.calls.length, 3)
})

test('idle, saving, waiting, queued and error preserve locks, readable status and active retry', async t => {
  const f = setup(t)
  let settle
  f.p.onLogSet = () => new Promise(resolve => { settle = resolve })
  const state = () => f.view.controller.state()
  const locks = expected => {
    const form = f.root.querySelector('form')
    for (const node of form.querySelectorAll('button,input,textarea,fieldset')) assert.equal(node.disabled, expected)
    assert.equal(f.root.querySelector('[data-field="weight"]').value, '80')
    assert.equal(f.root.querySelector('[data-field="reps"]').value, '5')
  }
  assert.equal(state().phase, 'idle'); locks(false)
  assert.ok(button(f.root, 'Som planlagt'))
  f.root.querySelector('[data-step="rpe-8"]').click(); f.view.update()
  const s = state(), save = f.view.controller.approve(s.key, state().input, s.selection.stamp)
  assert.equal(state().phase, 'saving'); locks(true)
  assert.ok(button(f.root, 'Afventer svar').disabled)
  assert.match(f.root.querySelector('[data-announce]').textContent, /Gemmer sættet. Vent på svar/)
  assert.equal(f.root.querySelector('[data-step="rpe-8"]').getAttribute('aria-pressed'), 'true')
  settle(undefined); await save
  assert.equal(state().phase, 'waiting'); locks(true)
  assert.match(f.root.querySelector('[data-announce]').textContent, /Afventer bekræftelse/)
  f.p.pendingSyncKeys = [s.key]; f.view.update()
  assert.equal(state().phase, 'queued'); locks(true)
  assert.ok(button(f.root, 'Venter på net').disabled)
  assert.match(f.root.querySelector('[data-announce]').textContent, /Venter på net/)
  f.p.pendingSyncKeys = []; f.p.setConfirm = { [s.key]: 'error' }; f.view.update()
  assert.equal(state().phase, 'error'); locks(false)
  assert.equal(button(f.root, 'Som planlagt').disabled, false)
  assert.match(f.root.querySelector('[data-announce]').textContent, /Dine tal er bevaret. Prøv igen/)
  f.p.onLogSet = () => ({ phase: 'error' })
  assert.equal(await f.view.controller.approve(s.key, state().input, s.selection.stamp), false)
  assert.equal(state().phase, 'error'); locks(false)
  f.p.enabled = false; f.view.update()
  assert.equal(f.root.hidden, true); assert.equal(f.root.querySelector('dialog'), null)
  assert.equal(f.calls.length, 0)
})

function rule(selector) {
  const matches = [...sessionStyle.matchAll(/([^{}]+)\{([^{}]+)\}/g)]
    .filter(([, selectors]) => selectors.split(',').map(s => s.trim()).includes(selector))
  assert.ok(matches.length, selector)
  return Object.fromEntries(matches.flatMap(([, , body]) => body.split(';').filter(Boolean).map(p => p.split(':').map(s => s.trim()))))
}

function contrast(a, b) {
  const luminance = hex => hex.slice(1).match(/../g).map(v => parseInt(v, 16) / 255)
    .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
    .reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0)
  const [x, y] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (x + .05) / (y + .05)
}

test('compact spacing wraps without shrinking controls; locked selected buttons have readable distinct surfaces', () => {
  const plan = rule('.e2-session .plan-card'), line = rule('.e2-session .plan')
  assert.equal(plan.padding, '16px'); assert.equal(plan.margin, '12px 0')
  assert.equal(rule('.e2-session .registration-card')['margin-top'], '12px')
  assert.equal(line['overflow-wrap'], 'anywhere')
  assert.equal(rule('.e2-session .stepper-line input')['min-height'], '56px')
  assert.equal(rule('.e2-session .rpe-row button')['min-height'], '48px')
  assert.equal(rule('.e2-session .approve')['min-height'], '52px')
  const idle = rule('.e2-session button'), locked = rule('.e2-session button:disabled')
  const selected = rule('.e2-session button[aria-pressed="true"]:disabled')
  assert.deepEqual(selected, locked)
  assert.notEqual(locked.background, idle.background)
  assert.equal(locked['border-style'], 'dashed')
  assert.equal(locked.opacity, '1')
  assert.ok(contrast(locked.color, locked.background) >= 4.5)
  assert.ok(sessionStyle.indexOf('.e2-session button[aria-pressed="true"]:disabled') >
    sessionStyle.indexOf('.e2-session .rpe-row button[aria-pressed="true"]'))
})
