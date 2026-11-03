import test from 'node:test'
import assert from 'node:assert/strict'
import { mountSession } from './sessionView.mjs'
import { sessionPrescription } from './sessionPrescription.mjs'
import { parsePlannedRest, parseTempo } from './tempo/tempoParser.mjs'
import { dom, button } from './a11y-dom.mjs'

function setup(patch = {}) {
  const ex = { id: 'lift', name: 'Løft', sets: 2, reps: 5, recommended_weight: 80, ...patch }
  const week = { id: 'week', athlete_id: 'synthetic-a', sessions: [{ id: 'session', exercises: [ex] }] }
  let calls = 0, saved
  const p = { enabled: true, athleteId: 'synthetic-a', currentWeek: week, allWeeks: [week],
    exerciseLogs: [], logInputs: {}, setLogInputs(fn) { p.logInputs = fn(p.logInputs) },
    parsePlannedRpe: () => null, onLogSet(_ex, set_number, _total, _reps, _planned, input) {
      calls++; saved = input; p.exerciseLogs.push({ exercise_id: ex.id, set_number, note: input.note })
    } }
  const root = dom(), timers = new Map(); let next = 0
  const clock = { Date: { now: () => 0 }, setInterval(fn) { timers.set(++next, fn); return next }, clearInterval(id) { timers.delete(id) } }
  const view = mountSession(root, () => p, { clock }); view.controller.start()
  const approve = () => { const s = view.controller.state(); return view.controller.approve(s.key, s.input, s.selection.stamp) }
  return { root, p, ex, view, timers, approve, get calls() { return calls }, get saved() { return saved } }
}
const detail = (root, name) => root.querySelector(`[data-detail="${name}"]`)
const openPlates = root => { const d = detail(root, 'plates'); d.open = true; d.dispatch('toggle'); return d }

test('session wiring: compact plan, first-set warmup above form, calculator at weight and native folds', () => {
  const t = setup({ note: 'Tempo 3-1-X-0; Pause 90 sek; Hold spændet' })
  try {
    const { root } = t, warm = detail(root, 'warmup'), plates = detail(root, 'plates')
    assert.equal(warm.open, false); assert.equal(plates.open, false)
    assert.equal(detail(root, 'tempo-phases').open, false)
    assert.match(root.querySelector('[data-e2-tempo]').textContent, /Tempo: 3-1-X-0/)
    assert.match(root.querySelector('[data-e2-tempo]').textContent, /Planlagt pause mellem sæt: 1 min. 30 sek./)
    assert.match(warm.textContent, /32,5 kg × 5/)
    const siblings = warm.parentElement.children
    assert.ok(siblings.indexOf(warm) < siblings.indexOf(root.querySelector('form')))
    assert.equal(plates.parentElement, root.querySelector('[data-field="weight"]').parentElement.parentElement.parentElement)
    assert.equal(root.querySelector('[data-e2-plader]'), null)
    openPlates(root); assert.match(plates.textContent, /Samlet vægt: 80 kg/)
    assert.equal(root.querySelector('[data-set-note]').querySelectorAll('button').length, 4)
    assert.equal(t.calls, 0)
    warm.open = true
    const bar = plates.querySelector('select'); bar.value = '15'; bar.dispatch('change')
    button(root, '+2,5').click(); t.view.update()
    assert.equal(detail(root, 'warmup').open, true)
    assert.equal(detail(root, 'plates').open, true)
    assert.equal(detail(root, 'plates').querySelector('select').value, '15')
    assert.match(detail(root, 'plates').textContent, /82,5/)
  } finally { t.view.dispose() }
  assert.equal(t.timers.size, 0)
})

test('notes use actual model, save once with set, clear and never carry into the next set', async () => {
  const t = setup()
  try {
    button(t.root, 'Tungt').click()
    const text = t.root.querySelector('textarea'); text.value = 'Sidste rep'; text.dispatch('input')
    assert.equal(t.calls, 0)
    t.view.update(); assert.equal(t.root.querySelector('textarea').value, 'Sidste rep')
    assert.equal(button(t.root, 'Tungt').getAttribute('aria-pressed'), 'true')
    await t.approve()
    assert.equal(t.calls, 1); assert.equal(t.saved.note, 'Tungt: Sidste rep')
    assert.equal(t.saved.rpe_source, null)
    assert.equal(t.root.querySelector('textarea').value, '')
    assert.equal(detail(t.root, 'warmup'), null)
    assert.equal(detail(t.root, 'plates').open, false)
    button(t.root, 'Let').click(); button(t.root, 'Let').click()
    await t.approve(); assert.equal(t.saved.note, '')
  } finally { t.view.dispose() }
})

test('invalid input and rejected save retain note and numbers; busy and retained handlers cannot edit', async () => {
  const t = setup(); let resolve
  t.p.onLogSet = () => new Promise(r => { resolve = r })
  try {
    const text = t.root.querySelector('textarea'); text.value = 'x'.repeat(200); text.dispatch('input')
    assert.equal(text.value.length, 140)
    const old = button(t.root, 'Smerte')
    const s = t.view.controller.state()
    await t.view.controller.approve(s.key, { weight: 'bad', reps: '5' }, s.selection.stamp)
    assert.match(t.root.querySelector('[role="alert"]').textContent, /Skriv vægt/)
    assert.equal(t.root.querySelector('textarea').value.length, 140)
    const pending = t.approve()
    assert.equal(t.root.querySelector('textarea').disabled, true)
    old.click(); assert.equal(t.view.controller.state().note.choice, '')
    resolve(false); await pending
    assert.equal(t.root.querySelector('textarea').disabled, false)
    assert.equal(t.view.controller.state().input.weight, 80)
    assert.equal(t.root.querySelector('textarea').value.length, 140)
    button(t.root, 'Smerte').click(); assert.equal(t.view.controller.state().note.choice, 'Smerte')
  } finally { t.view.dispose() }
})

test('OFF and program changes invalidate retained events and isolate drafts by athlete and plan', () => {
  const t = setup()
  try {
    button(t.root, 'Teknik').click(); const retained = button(t.root, 'Let')
    const old = t.view.controller.state()
    t.ex.tempo = '2-0-1-0'; t.view.update()
    assert.equal(t.root.querySelector('dialog'), null)
    assert.equal(t.view.controller.editNote(old.key, { text: 'stale' }, old.selection.stamp), false)
    retained.click(); t.view.controller.start()
    assert.equal(t.root.querySelector('textarea').value, '')
    assert.equal(t.view.controller.state().note.choice, '')
    button(t.root, 'Teknik').click()
    t.p.athleteId = 'synthetic-b'; t.p.currentWeek.athlete_id = 'synthetic-b'
    t.view.update(); t.view.controller.start()
    assert.equal(t.view.controller.state().note.choice, '')
    t.p.enabled = false; t.view.update(); retained.click()
    assert.equal(t.root.hidden, true); assert.equal(t.root.querySelector('dialog'), null)
    assert.equal(t.calls, 0); assert.equal(t.timers.size, 0)
  } finally { t.view.dispose() }
})

test('missing and malformed prescriptions, zero work weight and calculator errors are honest', () => {
  for (const props of [{ recommended_weight: 0 }, { recommended_weight: 'bad', tempo: 'oops', restSeconds: -1 }]) {
    const t = setup(props)
    try {
      assert.match(detail(t.root, 'warmup').textContent, /Intet beregnet forslag/)
      const plan = t.root.querySelector('[data-e2-tempo]').textContent
      assert.match(plan, props.tempo ? /Tempo kan ikke vises/ : /Tempo er ikke angivet/)
      assert.match(plan, props.tempo ? /Planlagt pause kan ikke vises/ : /Pause mellem sæt er ikke angivet/)
      openPlates(t.root)
      assert.match(detail(t.root, 'plates').textContent, props.tempo ? /Angiv en gyldig/ : /under stangens/)
      const input = detail(t.root, 'plates').querySelector('input'); input.value = ''; input.dispatch('input')
      assert.match(detail(t.root, 'plates').textContent, /Angiv en gyldig/)
      assert.equal(t.calls, 0)
    } finally { t.view.dispose() }
  }
})

test('legacy note adapter extracts labelled instructions only, explicit fields win, malformed remains invalid', () => {
  assert.deepEqual(sessionPrescription({ note: 'Hold i 60 sek' }), { tempo: undefined, restSeconds: undefined })
  assert.deepEqual(sessionPrescription({ note: 'Tempo 3 - 1 - X - 0; hvile 1,5 min mellem sæt' }),
    { tempo: '3 - 1 - X - 0', restSeconds: '1,5 min' })
  assert.deepEqual(sessionPrescription({ note: 'Pause 90 sek; Tempo 3-1-1-0', restSeconds: 0, tempo: '' }),
    { tempo: '', restSeconds: 0 })
  for (const rest of ['-5', '1:99', '1,5 sek', 'ukendt', '999999999999'])
    assert.equal(parsePlannedRest(sessionPrescription({ note: `Pause ${rest}` }).restSeconds).status, 'invalid', rest)
  assert.equal(parseTempo(sessionPrescription({ note: 'Tempo forkert' }).tempo).status, 'invalid')
})

test('note text focus survives refresh, native textarea/select join focus wrap, closed tools stay out', () => {
  const t = setup()
  try {
    const text = t.root.querySelector('textarea'); text.focus(); text.setSelectionRange(0, 0); t.view.update()
    assert.equal(t.root.ownerDocument.activeElement, t.root.querySelector('textarea'))
    const d = t.root.querySelector('dialog'), close = button(t.root, 'Luk pas')
    const history = detail(t.root, 'history'); history.open = true
    const last = t.root.ownerDocument.createElement('textarea'); history.append(last)
    last.focus(); d.dispatch('keydown', { key: 'Tab' }); assert.equal(t.root.ownerDocument.activeElement, close)
    history.open = false; close.focus(); d.dispatch('keydown', { key: 'Tab', shiftKey: true })
    assert.equal(t.root.ownerDocument.activeElement, history.querySelector('summary'))
  } finally { t.view.dispose() }
})


test('real form submit merges current numbers and draft; calculator Enter cannot approve', async () => {
  const t = setup()
  try {
    const plates = openPlates(t.root); let prevented = false
    plates.dispatch('keydown', { key: 'Enter', preventDefault() { prevented = true } })
    assert.equal(prevented, true); assert.equal(t.calls, 0)
    const input = t.root.querySelector('[data-field="weight"]'); input.value = '87,5'
    button(t.root, 'Teknik').click()
    t.root.querySelector('form').dispatch('submit')
    await Promise.resolve()
    assert.equal(t.calls, 1); assert.equal(t.saved.note, 'Teknik'); assert.equal(t.saved.weight, '87.5')
  } finally { t.view.dispose() }
})

test('queued, parked and waiting sets lock notes, and close/reopen retains the same scoped draft', () => {
  for (const phase of ['queued', 'parked', 'waiting']) {
    const t = setup()
    try {
      button(t.root, 'Let').click(); t.view.controller.close(); t.view.controller.start()
      assert.equal(button(t.root, 'Let').getAttribute('aria-pressed'), 'true')
      const stale = button(t.root, 'Tungt')
      if (phase === 'queued') t.p.pendingSyncKeys = ['lift_1']
      if (phase === 'parked') t.p.parkedSets = [{ exerciseId: 'lift', setNumber: 1 }]
      if (phase === 'waiting') t.p.exerciseLogs = [{ exercise_id: 'lift', set_number: 1, _optimistic: true }]
      t.view.update(); assert.equal(t.root.querySelector('textarea').disabled, true)
      stale.click(); assert.equal(t.view.controller.state().note.choice, 'Let'); assert.equal(t.calls, 0)
    } finally { t.view.dispose() }
  }
})


test('existing host input note is visible and preserved until the athlete explicitly clears it', async () => {
  const t = setup()
  try {
    t.p.logInputs.lift_1 = { note: 'Aftalt teknik' }; t.view.update()
    assert.equal(t.root.querySelector('textarea').value, 'Aftalt teknik')
    const text = t.root.querySelector('textarea'); text.value = ''; text.dispatch('input')
    await t.approve(); assert.equal(t.saved.note, '')
  } finally { t.view.dispose() }
})
