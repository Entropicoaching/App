import test from 'node:test'
import assert from 'node:assert/strict'
import { mountSession } from './sessionView.mjs'
import { dom, button } from './a11y-dom.mjs'
import { createMobilityPlan } from '../mobility/plan/mobilityPlanDom.mjs'

function setup(names = ['Squat', 'Bench press', 'Sumo deadlift'], enabled = true) {
  const exercises = names.map((name, i) => ({ id: `ex-${i}`, name, sets: 2, reps: 5, recommended_weight: 80 }))
  const session = { id: 'session', exercises }
  const week = { id: 'week', athlete_id: 'synthetic', sessions: [session] }
  const p = { enabled, athleteId: 'synthetic', currentWeek: week, allWeeks: [week], exerciseLogs: [], logInputs: {},
    setLogInputs(fn) { p.logInputs = fn(p.logInputs) }, parsePlannedRpe: () => null,
    onLogSet(ex, set_number) { p.exerciseLogs.push({ exercise_id: ex.id, set_number }); calls++ } }
  let calls = 0
  const root = dom(), timers = new Set()
  const clock = { Date: { now: () => 0 }, setInterval(fn) { timers.add(fn); return fn }, clearInterval(fn) { timers.delete(fn) } }
  const view = mountSession(root, () => p, { clock })
  view.controller.start()
  const approve = () => { const s = view.controller.state(); return view.controller.approve(s.key, s.input, s.selection.stamp) }
  return { p, root, view, timers, approve, get calls() { return calls } }
}
const warmup = root => root.querySelector('[data-detail="warmup"]')

test('daily mobility uses all today lifts, starts folded above first exercise, and shares one ramp', () => {
  const t = setup()
  try {
    const warm = warmup(t.root), heading = t.root.querySelector('h1')
    assert.equal(warm.querySelector('summary').textContent, 'Opvarmning (5-10 min)')
    assert.equal(warm.open, false)
    assert.ok(warm.parentElement.children.indexOf(warm) < heading.parentElement.children.indexOf(heading))
    assert.equal(t.root.querySelectorAll('[data-detail="warmup"]').length, 1)
    const mobility = warm.querySelector('[data-session-mobility]')
    assert.match(mobility.textContent, /Squat · Bænkpres · Sumodødløft · Ca. 10 min/)
    assert.equal(mobility.querySelectorAll('li').length, 9)
    assert.ok(mobility.querySelectorAll('details').every(d => !d.open))
    assert.equal(warm.querySelectorAll('.e2-opvarmning').length, 1)
    assert.match(warm.textContent, /32,5 kg × 5/)
    assert.equal(mobility.querySelectorAll('button,input,form').length, 0)
    warm.open = true
    const help = mobility.querySelector('details'); help.open = true
    help.querySelector('summary').focus()
    t.view.update()
    assert.equal(warmup(t.root).open, true)
    assert.equal(t.root.ownerDocument.activeElement.parentElement.getAttribute('data-detail'), help.getAttribute('data-detail'))
    button(t.root, '+2,5').click(); t.view.update()
    assert.match(warmup(t.root).textContent, /82,5 kg/)
    assert.equal(warmup(t.root).querySelectorAll('.e2-opvarmning').length, 1)
    assert.equal(t.calls, 0)
  } finally { t.view.dispose() }
  assert.equal(t.timers.size, 0)
})

test('later sets, later lifts, resume and summary do not repeat daily mobility', async () => {
  const t = setup()
  try {
    await t.approve()
    assert.equal(warmup(t.root), null)
    await t.approve()
    assert.equal(t.view.controller.state().next.exercise.id, 'ex-1')
    assert.equal(warmup(t.root).querySelector('summary').textContent, 'Opvarmningssæt')
    assert.equal(t.root.querySelector('[data-session-mobility]'), null)
    assert.equal(warmup(t.root).querySelectorAll('.e2-opvarmning').length, 1)
    t.view.controller.close(); t.view.controller.start()
    assert.equal(t.root.querySelector('[data-session-mobility]'), null)
    t.view.controller.finish()
    assert.equal(warmup(t.root), null)
    assert.ok(t.root.querySelector('[data-session-summary]'))
    assert.equal(t.calls, 2)
  } finally { t.view.dispose() }
  assert.equal(t.timers.size, 0)
})

test('unsupported lifts and malformed plan show honest empty/error, preserving the ramp and set form', () => {
  for (const [names, role, text] of [[['Row'], 'status', /Ingen rutine klar/], [['Squat', ''], 'alert', /Rutinen kunne ikke laves/]]) {
    const t = setup(names)
    try {
      const mobility = t.root.querySelector('[data-session-mobility]')
      assert.match(mobility.querySelector(`[role="${role}"]`).textContent, text)
      assert.equal(mobility.querySelector('ol'), null)
      assert.match(warmup(t.root).textContent, /32,5 kg × 5/)
      assert.ok(t.root.querySelector('form'))
      assert.equal(t.calls, 0)
    } finally { t.view.dispose() }
  }
})

test('strict OFF, empty day and program error create no daily mobility or writes', () => {
  const doc = new Proxy({}, { get() { assert.fail('OFF accessed document') } })
  for (const enabled of [undefined, false, 1, 'true']) {
    assert.equal(createMobilityPlan(doc, { enabled, get session() { assert.fail('OFF accessed session') } }), null)
  }
  for (const kind of ['off', 'empty', 'error']) {
    const t = setup(['Squat'], false)
    try {
      if (kind !== 'off') t.p.enabled = true
      if (kind === 'empty') t.p.currentWeek.sessions = []
      if (kind === 'error') t.p.programError = true
      t.view.update(); assert.equal(t.view.controller.start(), false)
      assert.equal(t.root.querySelector('[data-session-mobility]'), null)
      if (kind === 'empty') assert.match(t.root.textContent, /Intet pas i dag/)
      if (kind === 'error') assert.match(t.root.textContent, /Programmet kunne ikke hentes/)
      assert.equal(t.calls, 0)
    } finally { t.view.dispose() }
    assert.equal(t.timers.size, 0)
  }
})

test('zero-set entries do not hide daily mobility; program change replaces its contents', () => {
  const t = setup(['Squat', 'Bench press'])
  try {
    t.view.controller.close()
    t.p.currentWeek.sessions[0].exercises[0].sets = 0
    t.view.update(); t.view.controller.start()
    assert.match(warmup(t.root).textContent, /Bænkpres · Ca. 7 min/)
    assert.doesNotMatch(t.root.querySelector('[data-session-mobility]').textContent, /Ankel-vægstræk/)
    t.p.currentWeek.sessions[0].exercises[1].name = 'Sumo deadlift'
    t.view.update()
    assert.equal(t.root.querySelector('dialog'), null)
    t.view.controller.start()
    assert.match(warmup(t.root).textContent, /Sumodødløft · Ca. 7 min/)
    assert.equal(warmup(t.root).open, false)
  } finally { t.view.dispose() }
})
