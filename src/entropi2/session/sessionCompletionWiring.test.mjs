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

test('confirmed completion keeps summary and hides rating without a persistence route', async () => {
  const t = setup()
  try {
    await t.approve(); await t.approve()
    assert.ok(t.root.querySelector('[data-session-summary]'))
    assert.equal(feeling(t.root), null)
    assert.doesNotMatch(t.root.textContent, /Hvordan var passet|Lokal kladde|Kladde udfyldt/)
    assert.equal(t.calls, 2)
    button(t.root, 'Luk pas').click(); button(t.root, 'Åbn dagens pas').click()
    assert.equal(feeling(t.root), null)
    assert.equal(t.calls, 2)
  } finally { t.view.dispose() }
  assert.equal(t.timers.size, 0)
})

test('manual finish, failed save and skipped rows never reveal the unsaved rating', async () => {
  const t = setup([''])
  try {
    button(t.root, 'Afslut pas').click(); assert.equal(feeling(t.root), null)
    button(t.root, 'Fortsæt passet').click()
    t.p.onLogSet = () => { throw new Error('synthetic failure') }
    assert.equal(await t.approve(), false)
    assert.equal(feeling(t.root), null)
    t.p.exerciseLogs = [{ exercise_id: 'ex-0', set_number: 1, skipped: true }]
    t.view.update(); assert.equal(feeling(t.root), null)
    assert.ok(t.root.querySelector('[data-session-summary]'))
  } finally { t.view.dispose() }
  assert.equal(t.timers.size, 0)
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
      if (notes[0]) {
        assert.match(t.root.querySelector('[data-e2-supersaet]').textContent, /bed din coach rette gruppen/)
        assert.doesNotMatch(t.root.querySelector('[data-detail="history"]').textContent, /Gruppering:/)
      } else assert.equal(t.root.querySelector('[data-e2-supersaet]'), null)
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
