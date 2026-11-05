import test from 'node:test'
import assert from 'node:assert/strict'
import { mountSession } from './sessionView.mjs'
import { syntheticDom } from './sessionSyntheticDom.mjs'

function setup(extras = {}, props = {}) {
  const ex = { id: 'lift', name: 'Row', sets: 2, reps: 5, recommended_weight: 80, ...extras }
  const week = { id: 'week', athlete_id: 'synthetic', sessions: [{ id: 'session', exercises: [ex] }] }
  let writes = 0, edits = 0
  const p = { enabled: true, athleteId: 'synthetic', currentWeek: week, allWeeks: [week], exerciseLogs: [], logInputs: {},
    setLogInputs(fn) { edits++; p.logInputs = fn(p.logInputs) }, parsePlannedRpe: () => null,
    onLogSet() { writes++ }, ...props }
  const dom = syntheticDom(), view = mountSession(dom.root, () => p, dom)
  view.controller.start()
  return { ...dom, view, p, get writes() { return writes }, get edits() { return edits },
    dispose() { view.dispose(); assert.equal(dom.timers.size, 0) } }
}
const plan = t => t.root.querySelector('[aria-label="Planlagt belastning"]')

test('missing optional plan fields and RPE disappear; known zero remains; reps absence is one plan error', () => {
  for (const missing of [null, undefined, '', '   ']) {
    const t = setup({ reps: missing, recommended_weight: missing, intensity: missing })
    try {
      assert.match(plan(t).textContent, /Gentagelser mangler i planen. Bed din coach rette øvelsen/)
      assert.equal(plan(t).querySelectorAll('[role="alert"]').length, 1)
      assert.doesNotMatch(t.root.textContent, /Ikke angivet|Intensitet:|RPE ikke angivet/)
      assert.equal(t.root.querySelectorAll('[data-exercise-history-fold]').length, 0)
      assert.ok(t.root.querySelector('form'))
    } finally { t.dispose() }
  }
  const t = setup({ recommended_weight: 0, intensity: 0 }, { exerciseLogs: [
    { exercise_id: 'lift', set_number: 1, weight: 0, reps_completed: 5, rpe_actual: 0 },
  ] })
  try {
    assert.match(plan(t).textContent, /0 kg/)
    assert.match(plan(t).textContent, /Intensitet: 0/)
    assert.match(t.root.querySelector('[data-detail="history"]').textContent, /0 kg, 5 reps, RPE 0/)
  } finally { t.dispose() }
})

test('confirmed log without RPE has no placeholder; early summary keeps count and remaining exercises', () => {
  const t = setup({}, { exerciseLogs: [{ exercise_id: 'lift', set_number: 1, weight: 80, reps_completed: 5 }] })
  try {
    assert.match(t.root.querySelector('[data-detail="history"]').textContent, /80 kg, 5 reps/)
    assert.doesNotMatch(t.root.querySelector('[data-detail="history"]').textContent, /RPE/)
    t.view.controller.finish()
    const summary = t.root.querySelector('[data-session-summary]').textContent
    assert.match(summary, /1 af 2 sæt klaret/)
    assert.match(summary, /Row: 1 sæt tilbage/)
    assert.doesNotMatch(summary, /Ingen endnu|Øvelser med alle sæt klaret|Højeste RPE/)
    assert.equal(t.root.querySelectorAll('[data-e2-session-feeling]').length, 0)
    assert.equal(t.writes, 0)
  } finally { t.dispose() }
})

test('explicit read-only mode hides registration and blocks retained handlers; missing callback remains an error', async () => {
  const t = setup()
  try {
    const saved = t.root.querySelector('form'), s = t.view.controller.state()
    t.p.readOnly = true; t.view.update()
    assert.equal(t.root.querySelectorAll('form,input,[data-step],[data-set-note]').length, 0)
    assert.equal(t.root.querySelectorAll('[data-detail="plates"]').length, 0)
    t.view.controller.edit(s.key, 'weight', '90', s.selection.stamp)
    assert.equal(t.view.controller.editNote(s.key, { text: 'stale' }, s.selection.stamp), false)
    saved.fire('submit', { preventDefault() {} })
    assert.equal(await t.view.controller.approve(s.key, { weight: '90', reps: '5' }, s.selection.stamp), false)
    assert.equal(t.writes, 0); assert.equal(t.edits, 0)
    t.p.readOnly = false; t.p.onLogSet = null; t.view.update()
    assert.equal(await t.view.controller.approve(s.key, { weight: '90', reps: '5' }, s.selection.stamp), false)
    assert.match(t.root.textContent, /Registrering er ikke tilgængelig/)
  } finally { t.dispose() }
})

test('partial groups cannot advertise a complete group or invent dosage; safe individual plan stays', () => {
  const t = setup({ note: 'Supersæt: A' })
  try {
    t.view.controller.close()
    t.p.currentWeek.sessions[0].exercises.push({ id: 'other', name: 'Press', sets: null, reps: 8, note: 'Supersæt: A' })
    t.view.update(); t.view.controller.start()
    assert.match(t.root.textContent, /bed din coach rette gruppen/)
    assert.doesNotMatch(t.root.textContent, /Supersæt A: Row \+ Press|Gruppering:|antal sæt mangler|Ingen planlagte sæt at vise/)
    assert.match(plan(t).textContent, /5 gentagelser/)
    assert.equal(t.writes, 0)
  } finally { t.dispose() }
})
