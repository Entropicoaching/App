// Actual mounted screen with the existing synthetic React adapter; no app services.
import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from '../../../athlete/prog3Loader.mjs'
import { mount, nodes, text } from '../../../athlete/prog3Dom.mjs'
install()
const { default: Program } = await import('../../../athlete/ProgramTab.jsx')
const helpers = await import('../../../athlete/ugeHjaelp.js')

function fixture(extra = {}) {
  const week = { id: 'week-fixture', week_number: 4, block_name: 'Styrke', start_date: '2026-11-02',
    sessions: [{ id: 'session-fixture', title: 'Pas A', weekday: 2,
      exercises: [{ id: 'exercise-fixture', name: 'Squat', sets: 2, reps: '5', intensity: 'RPE 8' }] }] }
  return { ...helpers, allWeeks: [week], currentWeek: week, viewingWeekIdx: 0,
    athlete: { id: 'athlete-fixture' }, exerciseLogs: [], pastLogs: [], readinessLog: { readiness_score: 90 },
    sessionRefs: { current: {} }, dismissedFeedback: new Set(), feedbackInputs: {}, logInputs: {}, setConfirm: {},
    lastLogByExerciseName: {}, exerciseHistory: {}, exWarmupExpanded: {}, exWarmupWeightOverride: {}, warmupChecked: {},
    suggestNextWeight: () => null, calcWarmupSets: () => [], suggestWarmupOverride: () => null,
    fetchProgramBlockLogs: async () => [], ...extra }
}
const render = props => mount(Program, props).render()
const intensity = tree => nodes(tree, n => Object.hasOwn(n.props, 'data-program-intensity'))[0]
// The decorated card and its native disclosure are separate elements.
const card = tree => nodes(tree, n => n.type === 'div' && n.props.style?.borderInlineStart && text(n).startsWith('Pas A'))[0]
const opener = tree => nodes(card(tree), n => n.type === 'button' && n.props['aria-expanded'] !== undefined)[0]
const logs = (skipped = false) => [1, 2].map(set_number => ({ exercise_id: 'exercise-fixture', set_number, skipped }))

test('mounted default has block and week accents, deduplicated plan targets and honest missing data', () => {
  const props = fixture()
  props.allWeeks[0].sessions[0].exercises.push(
    { id: 'second', sets: 1, intensity: '75–80 %' },
    { id: 'third', sets: 1, intensity: 'RPE 8' }, { id: 'fourth', sets: 1 })
  const original = JSON.stringify(props.allWeeks)
  const tree = render(props), summary = nodes(tree, n => n.props['aria-label'] === 'Din aktuelle blok')[0]
  assert.equal(summary.props.style.borderInlineStart, '4px solid #c8923a')
  assert.match(text(summary), /Styrke.*Uge 1 af 1/)
  const view = intensity(tree)
  assert.equal(nodes(view, n => n.type === 'span' && text(n) === 'RPE 8').length, 1)
  assert.match(text(view), /75–80 %/)
  assert.match(text(view), /Ikke angivet for alle øvelser/)
  assert.doesNotMatch(text(view), /gennemsnit|høj intensitet|lav intensitet/i)
  assert.equal(JSON.stringify(props.allWeeks), original)
  props.allWeeks[0].sessions[0].exercises = []
  assert.match(text(intensity(render(props))), /Ikke angivet i planen/)
  props.allWeeks[0].readEvidence = { complete: false }
  assert.match(text(intensity(render(props))), /ikke tilgængelig/)
})

test('today is the Copenhagen calendar date, including when browsing an advanced active anchor', t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-03T23:30:00Z') })
  const props = fixture()
  assert.match(text(card(render(props))), /I dag/)
  props.allWeeks.push({ ...props.allWeeks[0], id: 'next-week', week_number: 5, start_date: '2026-11-09', sessions: [] })
  props.currentWeek = props.allWeeks[1]
  assert.match(text(card(render(props))), /I dag/, 'calendar week wins over advanced logging anchor')
  for (const weekday of [null, -1, 7, '2', 1, 3]) {
    props.allWeeks[0].sessions[0].weekday = weekday
    assert.doesNotMatch(text(card(render(props))), /I dag/, String(weekday))
  }
  props.allWeeks[0].sessions[0].weekday = 2
  for (const start_date of [null, '2026-11-09', '2026-02-30', 'bad-date']) {
    props.allWeeks[0].start_date = start_date
    props.weekStartDate = () => null
    assert.doesNotMatch(text(card(render(props))), /I dag/, String(start_date))
  }
})

test('only every exact prescribed set earns green completion; skipped and malformed sets never do', () => {
  const props = fixture({ exerciseLogs: logs() })
  assert.match(text(card(render(props))), /Gennemført ✓/)
  assert.equal(card(render(props)).props.style.borderInlineStart, '4px solid #b9d5a0')
  for (const exerciseLogs of [logs(true), [logs()[0]], [logs()[0], logs()[0]],
    [logs()[0], { ...logs()[1], set_number: 9 }], [{ exercise_id: 'unrelated', set_number: 1 }]]) {
    props.exerciseLogs = exerciseLogs
    assert.doesNotMatch(text(card(render(props))), /Gennemført/)
  }
  props.exerciseLogs = logs(true)
  assert.match(text(card(render(props))), /Afsluttet · sæt sprunget over/)
  props.exerciseLogs = logs()
  for (const sets of [null, undefined, '', true, -1, 0, 2.5]) {
    props.allWeeks[0].sessions[0].exercises[0].sets = sets
    assert.doesNotMatch(text(card(render(props))), /Gennemført/)
  }
})

test('existing session opener and set logging stay outside every details fold with the same arguments', () => {
  const calls = []
  const props = fixture({ progOpenSession: 'session-fixture', logSet: (...args) => calls.push(args),
    openSession: id => calls.push(id) })
  const tree = render(props), found = []
  function walk(node, folds = []) {
    if (node == null || typeof node !== 'object') return
    if (node.type === 'button' && text(node) === 'Log') found.push({ node, folds })
    for (const child of node.props.children) walk(child, node.type === 'details' ? [...folds, node] : folds)
  }
  walk(tree)
  assert.equal(found.length, 2)
  assert.ok(found.every(row => row.folds.length === 0))
  found[0].node.props.onClick()
  assert.deepEqual(calls, [['exercise-fixture', 1, 2, '5', 8]])
  opener(tree).props.onClick()
  assert.deepEqual(calls.at(-1), null)
  const legacy = render({ ...props, entropi2: false })
  assert.equal(nodes(tree, n => n.type === 'details').length, nodes(legacy, n => n.type === 'details').length + 1)
})

test('OFF/nonboolean gates have no new appearance, while read errors suppress status and intensity facts', () => {
  for (const entropi2 of [false, null, 0, 1, 'true']) {
    const tree = render(fixture({ entropi2, exerciseLogs: logs() }))
    assert.equal(intensity(tree), undefined)
    assert.doesNotMatch(text(tree), /Gennemført ✓|I dag|Ugens intensitet/)
    assert.match(text(tree), /Færdig ✓/)
  }
  const tree = render(fixture({ programError: true, exerciseLogs: logs() }))
  assert.match(text(intensity(tree)), /ikke tilgængelig/)
  assert.doesNotMatch(text(intensity(tree)), /RPE 8/)
  assert.doesNotMatch(text(card(tree)), /Gennemført|I dag/)
})

test('mobile header wraps and exposes real headings without changing the closed-session logger state', () => {
  const props = fixture()
  props.allWeeks.push({ ...props.allWeeks[0], id: 'next', week_number: 5 })
  const tree = render(props)
  assert.equal(nodes(card(tree), n => n.type === 'h2').length, 1)
  assert.equal(nodes(tree, n => n.type === 'button' && text(n) === 'Log').length, 0)
  const previous = nodes(tree, n => n.type === 'button' && text(n) === '← Forrige uge')[0]
  assert.equal(previous.props.style.minHeight, 44)
  assert.equal(previous.props.style.whiteSpace, 'normal')
  assert.equal(card(tree).props.style.padding, 16)
})
