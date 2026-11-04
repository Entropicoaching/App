import test from 'node:test'
import assert from 'node:assert/strict'
import { mountSession } from './sessionView.mjs'
import { dom, button } from './a11y-dom.mjs'

function setup(notes = ['', '']) {
  const exercises = notes.map((note, i) => ({ id: `ex-${i}`, name: `Løft ${i + 1}`,
    sets: 1, reps: 5, recommended_weight: 40, note }))
  const week = { id: 'week', athlete_id: 'synthetic', sessions: [{ id: 'session', exercises }] }
  let calls = 0
  const p = { enabled: true, athleteId: 'synthetic', currentWeek: week, allWeeks: [week],
    exerciseLogs: [], logInputs: {}, setLogInputs(fn) { p.logInputs = fn(p.logInputs) },
    parsePlannedRpe: () => null, onLogSet(ex, set_number, _total, _reps, _planned, input) {
      calls++
      assert.equal(Object.hasOwn(input, 'energy'), false)
      p.exerciseLogs.push({ exercise_id: ex.id, set_number, weight: Number(input.weight), reps_completed: 5 })
    } }
  const root = dom(), timers = new Set()
  const clock = { Date: { now: () => 0 }, setInterval(fn) { timers.add(fn); return fn }, clearInterval(fn) { timers.delete(fn) } }
  const view = mountSession(root, () => p, { clock })
  const approve = () => { const s = view.controller.state(); return view.controller.approve(s.key, s.input, s.selection.stamp) }
  view.controller.start()
  return { root, view, p, exercises, timers, approve, get calls() { return calls } }
}
const feeling = root => root.querySelector('[data-e2-session-feeling]')
const field = (root, name) => root.querySelector(`[data-field="feeling-${name}"]`)
function change(root, name, value) {
  const n = field(root, name); n.value = value; n.dispatch(name === 'note' ? 'input' : 'change')
}

test('final confirmed set reveals optional local feeling after summary, without another write', async () => {
  const t = setup()
  try {
    assert.equal(feeling(t.root), null)
    button(t.root, 'Afslut pas').click(); assert.equal(feeling(t.root), null)
    button(t.root, 'Fortsæt passet').click()
    await t.approve(); assert.equal(feeling(t.root), null)
    await t.approve()
    assert.ok(feeling(t.root))
    assert.match(feeling(t.root).textContent, /Lokal kladde.*kan ikke gemmes/)
    assert.match(feeling(t.root).textContent, /sendes ikke til din coach/)
    const summary = t.root.querySelector('[data-session-summary]'), box = feeling(t.root)
    assert.ok(box.parentElement.children.indexOf(box) > box.parentElement.children.indexOf(summary))
    assert.equal(box.querySelector('form'), null)
    assert.equal(box.querySelector('button'), null)
    assert.equal(box.querySelector('details').open, false)
    assert.equal(box.querySelectorAll('label').length, 3)
    assert.equal(field(t.root, 'note').getAttribute('maxlength'), '280')
    assert.equal(field(t.root, 'rpe').querySelectorAll('option').length, 22)
    assert.equal(field(t.root, 'energy').querySelectorAll('option').length, 6)
    change(t.root, 'rpe', '0'); change(t.root, 'energy', '1'); change(t.root, 'note', '<b>Kun tekst</b>')
    assert.match(feeling(t.root).textContent, /Kladde udfyldt. Den er ikke gemt/)
    assert.equal(t.root.querySelector('b'), null)
    field(t.root, 'energy').focus(); t.view.update()
    assert.equal(t.root.ownerDocument.activeElement, field(t.root, 'energy'))
    assert.equal(field(t.root, 'rpe').value, '0')
    assert.equal(field(t.root, 'note').value, '<b>Kun tekst</b>')
    const scope = t.view.controller.state().feeling.scope
    button(t.root, 'Luk pas').click()
    assert.equal(t.view.controller.editFeeling(scope, { note: 'closed' }), false)
    button(t.root, 'Åbn dagens pas').click()
    assert.equal(field(t.root, 'note').value, '<b>Kun tekst</b>')
    assert.equal(t.calls, 2)
  } finally { t.view.dispose() }
  assert.equal(t.timers.size, 0)
})

test('empty, invalid and cleared feeling remains optional; failed set save cannot unlock it', async () => {
  const t = setup([''])
  try {
    t.p.onLogSet = () => { throw new Error('synthetic failure') }
    assert.equal(await t.approve(), false); assert.equal(feeling(t.root), null)
    t.p.exerciseLogs = [{ exercise_id: 'ex-0', set_number: 1 }]; t.view.update()
    assert.ok(feeling(t.root))
    assert.equal(feeling(t.root).querySelector('[role="alert"]').textContent, '')
    change(t.root, 'rpe', '11')
    assert.match(feeling(t.root).querySelector('[role="alert"]').textContent, /Brug RPE/)
    change(t.root, 'rpe', '8'); change(t.root, 'energy', '3'); change(t.root, 'note', 'x'.repeat(281))
    assert.match(feeling(t.root).querySelector('[role="alert"]').textContent, /280 tegn/)
    change(t.root, 'note', ''); change(t.root, 'rpe', '')
    assert.equal(feeling(t.root).querySelector('[role="alert"]').textContent, '')
    assert.match(feeling(t.root).textContent, /springe vurderingen over/)
  } finally { t.view.dispose() }
})

test('saving, optimistic, queued, parked and all-skipped rows do not unlock completion', async () => {
  for (const phase of ['saving', 'optimistic', 'queued', 'parked', 'skipped']) {
    const t = setup([''])
    let settle, pending
    try {
      if (phase === 'saving') {
        t.p.onLogSet = () => new Promise(resolve => { settle = resolve })
        pending = t.approve()
      }
      t.p.exerciseLogs = [{ exercise_id: 'ex-0', set_number: 1,
        ...(phase === 'optimistic' ? { _optimistic: true } : {}), ...(phase === 'skipped' ? { skipped: true } : {}) }]
      if (phase === 'queued') t.p.pendingSyncKeys = ['ex-0_1']
      if (phase === 'parked') t.p.parkedSets = [{ exerciseId: 'ex-0', setNumber: 1 }]
      t.view.update(); assert.equal(feeling(t.root), null, phase)
      if (settle) { settle(); await pending; assert.ok(feeling(t.root)) }
    } finally { if (settle) { settle(); await pending }; t.view.dispose() }
  }
})

test('draft isolation and stale handlers across rerender, plan, athlete, OFF and disposal', async () => {
  const t = setup([''])
  try {
    await t.approve(); change(t.root, 'note', 'local')
    const stale = field(t.root, 'note'), scope = t.view.controller.state().feeling.scope
    t.view.update(); stale.value = 'stale'; stale.dispatch('input')
    assert.equal(t.view.controller.state().feeling.draft.note, 'local')
    t.exercises[0].note = 'Ny plan'; t.view.update()
    assert.equal(t.root.querySelector('dialog'), null)
    assert.equal(t.view.controller.editFeeling(scope, { note: 'stale' }), false)
    t.p.exerciseLogs = []; t.view.controller.start(); await t.approve()
    assert.equal(field(t.root, 'note').value, '')
    change(t.root, 'note', 'new')
    t.p.athleteId = 'other'; t.p.currentWeek.athlete_id = 'other'; t.view.update()
    t.p.exerciseLogs = []; t.view.controller.start(); assert.equal(feeling(t.root), null)
    await t.approve(); assert.equal(field(t.root, 'note').value, '')
    t.p.enabled = false; t.view.update(); assert.equal(t.root.hidden, true)
    assert.equal(t.root.querySelector('dialog'), null); assert.equal(t.timers.size, 0)
  } finally { t.view.dispose() }
})

test('superset/circuit membership is simple, conditional, read-only and folded in history', () => {
  for (const kind of ['Supersæt', 'Cirkel']) {
    const t = setup([`${kind}: A`, `${kind}: A`])
    try {
      const group = t.root.querySelector('[data-e2-supersaet]')
      assert.equal(group.textContent, `${kind} A: Løft 1 + Løft 2`)
      assert.equal(group.querySelector('ol'), null)
      assert.doesNotMatch(group.textContent, /Skift øvelse|Pause/)
      const history = t.root.querySelector('[data-detail="history"]')
      assert.equal(history.open, false)
      assert.ok(history.querySelectorAll('h2').some(n => n.textContent === `${kind} A`))
      assert.equal(t.calls, 0)
      for (const text of ['−2,5', '+2,5', '−1', '+1', '6', '10']) assert.ok(button(t.root, text))
      assert.ok(t.root.querySelector('[data-detail="plates"]'))
      assert.ok(t.root.querySelector('[data-set-note]'))
    } finally { t.view.dispose() }
  }
  for (const notes of [['', ''], ['Supersæt: A', ''], ['Supersæt: ???', 'Supersæt: A']]) {
    const t = setup(notes)
    try {
      assert.equal(t.root.querySelector('[data-e2-supersaet]'), null)
      if (notes[0]) assert.match(t.root.querySelector('[data-detail="history"]').textContent, /Gruppering:/)
    } finally { t.view.dispose() }
  }
})

test('empty program and program failure cannot reveal either block', () => {
  const t = setup()
  try {
    t.p.programError = true; t.view.update()
    assert.match(t.root.textContent, /Programmet kunne ikke hentes/)
    assert.equal(t.root.querySelector('[data-e2-supersaet]'), null)
    assert.equal(feeling(t.root), null)
    t.p.programError = false; t.p.currentWeek.sessions = []; t.view.update()
    assert.match(t.root.textContent, /Intet pas i dag/)
    assert.equal(t.view.controller.start(), false)
  } finally { t.view.dispose() }
})
