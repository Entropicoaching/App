import test from 'node:test'
import assert from 'node:assert/strict'
import { readCoachWarmupTemplates, coachWarmupSteps } from './coachWarmup.mjs'
import { createOpvarmning } from './OpvarmningView.mjs'
import { syntheticDom } from '../sessionSyntheticDom.mjs'
import { mountSession } from '../sessionView.mjs'
import { dom } from '../a11y-dom.mjs'

// Ordre 1704: coachen gemmer opvarmning pr. atlet og kategori (warmup_templates).
// Entropi 2 laeser kun atletens egne raekker, kun de brugte felter, og skriver aldrig.
function client(result, calls = []) {
  const q = {
    select: c => { calls.push(['select', c]); return q },
    eq: (k, v) => { calls.push(['eq', k, v]); return Promise.resolve(result) },
  }
  return { from: table => { calls.push(['from', table]); return q } }
}
const squat = { exercise_category: 'Squat', steps: ['Hoftecirkler 2 x 10', 'Goblet squat 2 x 5'] }

test('ordre 1704: one read of own templates, only used fields, no writes', async () => {
  const calls = []
  assert.deepEqual(await readCoachWarmupTemplates({ athleteId: 'atlet-o', client: client({ data: [squat] }, calls) }), [squat])
  assert.deepEqual(calls, [['from', 'warmup_templates'], ['select', 'exercise_category,steps'], ['eq', 'athlete_id', 'atlet-o']])
})

test('ordre 1704: errors, broken rows or no athlete give no templates and no read', async () => {
  for (const result of [{ error: { message: 'x' }, data: null }, { data: null }])
    assert.deepEqual(await readCoachWarmupTemplates({ athleteId: 'atlet-o', client: client(result) }), [])
  assert.deepEqual(await readCoachWarmupTemplates({ athleteId: 'atlet-o', client: { from() { throw Error('net') } } }), [])
  const calls = []
  assert.deepEqual(await readCoachWarmupTemplates({ athleteId: '', client: client({ data: [squat] }, calls) }), [])
  assert.deepEqual(await readCoachWarmupTemplates({}), [])
  assert.equal(calls.length, 0)
  assert.deepEqual(await readCoachWarmupTemplates({ athleteId: 'atlet-o', client: client({ data: [null, squat] }) }), [squat])
})

test('ordre 1704: same category match as old code, main lifts only, sumo counts as Dødløft', () => {
  const templates = [squat, { exercise_category: 'Dødløft', steps: ['Hip hinge 2 x 8', ' '] }]
  assert.deepEqual(coachWarmupSteps(templates, 'Squat'), squat.steps)
  assert.deepEqual(coachWarmupSteps(templates, 'Back squat - top set'), squat.steps)
  assert.deepEqual(coachWarmupSteps(templates, 'Sumo dødløft'), ['Hip hinge 2 x 8'])
  assert.deepEqual(coachWarmupSteps(templates, 'Dødløft'), ['Hip hinge 2 x 8'])
  assert.deepEqual(coachWarmupSteps(templates, 'Bænkpres'), [])
  assert.deepEqual(coachWarmupSteps(templates, 'Pause squat'), [])
  assert.deepEqual(coachWarmupSteps(undefined, 'Squat'), [])
  assert.deepEqual(coachWarmupSteps([{ exercise_category: 'Squat', steps: 'ikke en liste' }], 'Squat'), [])
})

test('ordre 1704: coach steps replace the computed ramp once under "Fra din coach"', () => {
  const { doc } = syntheticDom()
  const view = createOpvarmning(doc, { enabled: true, firstWorkSet: { weight: 100 }, coachSteps: squat.steps })
  assert.equal(view.querySelectorAll('h3').filter(n => n.textContent === 'Fra din coach').length, 1)
  assert.deepEqual(view.querySelectorAll('li').map(n => n.textContent), squat.steps)
  assert.doesNotMatch(view.textContent, /af arbejdsvægten/)
  assert.equal(view.getAttribute('aria-label'), 'Opvarmning fra din coach')
  const plain = createOpvarmning(doc, { enabled: true, firstWorkSet: { weight: 100 }, coachSteps: [] })
  assert.doesNotMatch(plain.textContent, /Fra din coach/)
  assert.match(plain.textContent, /af arbejdsvægten/)
})

function session(names, templates) {
  const exercises = names.map((name, i) => ({ id: `ex-${i}`, name, sets: 1, reps: 5, recommended_weight: 80 }))
  const week = { id: 'week', athlete_id: 'atlet-o', sessions: [{ id: 'session', exercises }] }
  const p = { enabled: true, athleteId: 'atlet-o', currentWeek: week, allWeeks: [week], exerciseLogs: [], logInputs: {},
    coachWarmupTemplates: templates, setLogInputs(fn) { p.logInputs = fn(p.logInputs) }, parsePlannedRpe: () => null,
    onLogSet(ex, set_number) { p.exerciseLogs.push({ exercise_id: ex.id, set_number }) } }
  const root = dom(), clock = { Date: { now: () => 0 }, setInterval: fn => fn, clearInterval() {} }
  const view = mountSession(root, () => p, { clock })
  view.controller.start()
  return { root, view, approve() { const s = view.controller.state(); return view.controller.approve(s.key, s.input, s.selection.stamp) } }
}

test('ordre 1704: today pass shows the coach squat warmup once and the computed ramp for bench', async () => {
  const t = session(['Squat', 'Bænkpres'], [squat])
  try {
    const warm = () => t.root.querySelector('[data-detail="warmup"]')
    assert.equal(t.root.querySelectorAll('h3').filter(n => n.textContent === 'Fra din coach').length, 1)
    assert.match(warm().textContent, /Hoftecirkler 2 x 10/)
    assert.doesNotMatch(warm().querySelector('.e2-opvarmning').textContent, /af arbejdsvægten/)
    await t.approve()
    assert.equal(t.view.controller.state().next.exercise.name, 'Bænkpres')
    assert.doesNotMatch(warm().textContent, /Fra din coach/)
    assert.match(warm().textContent, /32,5 kg × 5/)
  } finally { t.view.dispose() }
})

test('ordre 1704: without templates the pass is unchanged', () => {
  const t = session(['Squat'], undefined)
  try {
    assert.doesNotMatch(t.root.textContent, /Fra din coach/)
    assert.match(t.root.querySelector('[data-detail="warmup"]').textContent, /32,5 kg × 5/)
  } finally { t.view.dispose() }
})
