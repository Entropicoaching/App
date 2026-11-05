// Separate counterexamples with an independently constructed fixture.
// This process is not an independent human/model review or a browser keyboard test.
import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './prog3Loader.mjs'
import { mount, nodes, text } from './prog3Dom.mjs'
install()
const { default: Program } = await import('./ProgramTab.jsx')

function fixture(extra = {}) {
  const session = { id: 'pass/æ #1', title: 'Pas <A> & B', weekday: 0,
    exercises: [{ id: 'timed', name: 'Planke', sets: 1, reps: '30 sek', intensity: '' },
      { id: 'warm', name: 'Squat', sets: 1, reps: '5', intensity: 'RPE 8', recommended_weight: 80 }] }
  const week = { id: 'week/æ #1', week_number: 0, block_name: 'Test', sessions: [session] }
  return { entropi2: true, athlete: { id: 'counter-athlete' }, allWeeks: [week], currentWeek: week, viewingWeekIdx: 0,
    progOpenSession: session.id, computeActiveWeekIdx: () => 0, fmtWeekRange: () => null, weekStartDate: () => null,
    WEEKDAYS_LONG: [], exerciseLogs: [], pastLogs: [], logInputs: {}, setConfirm: {},
    lastLogByExerciseName: {}, exerciseHistory: {}, readinessLog: { readiness_score: 80 },
    exWarmupExpanded: new Set(['warm']), exWarmupWeightOverride: {}, warmupChecked: {},
    exWarmupWeightEditing: 'warm', warmupSetEditing: 'warm_0', sessionRefs: { current: {} },
    dismissedFeedback: new Set(), feedbackInputs: {}, parsePlannedRpe: () => 8,
    suggestNextWeight: () => null, suggestWarmupOverride: () => null,
    calcWarmupSets: () => [{ weight: 40, reps: 5, pct: '50%' }, { weight: 60, reps: 3, pct: '75%' }],
    ...extra }
}

test('counter: unusual IDs keep the expanded target valid; warmup edits and timers are explicitly named', () => {
  const tree = mount(Program, fixture()).render()
  const namespace = nodes(tree, n => n.props['data-program-accessible'])[0]
  const disclosure = nodes(namespace, n => n.type === 'button' && n.props['aria-label'] === 'Pas <A> & B · pas 1, uge 0')[0]
  assert.ok(disclosure)
  assert.ok(nodes(namespace, n => n.props.id === disclosure.props['aria-controls']).length)
  assert.doesNotMatch(disclosure.props['aria-controls'], /\s/)
  const fields = nodes(namespace, n => n.type === 'input')
  assert.ok(fields.some(n => n.props['aria-label'].startsWith('Arbejdsvægt til opvarmning ·')))
  assert.ok(fields.some(n => n.props['aria-label'].startsWith('Opvarmningsvægt, sæt 1 ·')))
  assert.ok(fields.every(n => n.props['aria-label']))
  const buttons = nodes(namespace, n => n.type === 'button')
  assert.ok(buttons.every(n => n.props['aria-label']), 'every rendered native action has context')
  assert.equal(new Set(buttons.map(n => n.props['aria-label'])).size, buttons.length)
  assert.ok(buttons.some(n => n.props['aria-label'].startsWith('Start timer · Pas <A> & B · pas 1, uge 0, Planke, øvelse 1')))
  assert.ok(buttons.some(n => n.props['aria-label'].startsWith('Spring opvarmningssæt 2 over ·')))
})

test('counter: session actions never toggle the fold and preserve the confirmation boundary', () => {
  const calls = []
  const p = fixture({ openSession: id => calls.push(['open', id]),
    askConfirm: (message, action) => calls.push(['confirm', message, action]),
    autoCompleteSession: session => calls.push(['fill', session.id]),
    skipRemainingSets: session => calls.push(['skip', session.id]) })
  const tree = mount(Program, p).render()
  for (const label of ['Auto-udfyld', 'Spring resten over']) {
    const button = nodes(tree, n => n.type === 'button' && n.props['aria-label']?.startsWith(label + ' ·'))[0]
    button.props.onClick({ stopPropagation: () => calls.push(['stop']) })
    assert.equal(calls.at(-1)[0], 'confirm')
    calls.at(-1)[2]()
  }
  assert.equal(calls.filter(call => call[0] === 'confirm').length, 2)
  assert.equal(calls.filter(call => call[0] === 'open').length, 0)
  assert.deepEqual(calls.filter(call => ['fill', 'skip'].includes(call[0])), [['fill', 'pass/æ #1'], ['skip', 'pass/æ #1']])
})

test('counter: program errors/empty plans retain existing honest messages and strict OFF stays undecorated', () => {
  const empty = mount(Program, fixture({ allWeeks: [] })).render()
  const failed = mount(Program, fixture({ allWeeks: [], programError: true })).render()
  assert.doesNotMatch(text(empty), /Gemt ✓|Træningsfeedback gemt|Næste pas/)
  assert.match(text(failed), /Prøv igen/)
  for (const entropi2 of [false, null, 0, 1, 'true']) {
    const tree = mount(Program, fixture({ entropi2 })).render()
    assert.equal(nodes(tree, n => n.props['data-program-accessible']).length, 0)
    assert.equal(nodes(tree, n => n.type === 'style').length, 0)
    assert.equal(nodes(tree, n => n.type === 'button' && n.props['aria-expanded'] !== undefined).length, 0)
  }
})
