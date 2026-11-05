// Actual ProgramTab import; hooks and element trees are synthetic, not a browser.
import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './prog3Loader.mjs'
import { mount, nodes, text } from './prog3Dom.mjs'
import { programQolFixture } from './programQolFixture.mjs'
install()
const { default: Program } = await import('./ProgramTab.jsx')
const render = extra => mount(Program, programQolFixture(extra)).render()
const folds = tree => nodes(tree, n => n.type === 'details' && n.props['data-program-session-actions'])
const firstFold = tree => folds(tree)[0]
const named = (tree, name) => nodes(tree, n => n.props['aria-label'] === name)[0]
const context = 'Pas 1-0 · pas 1, uge 1'
const readable = node => {
  assert.ok(node)
  for (const [key, value] of Object.entries({ fontSize: 14, lineHeight: 1.5,
    letterSpacing: 'normal', textTransform: 'none', whiteSpace: 'normal', overflowWrap: 'anywhere' })) {
    assert.equal(node.props.style[key], value, key)
  }
}

test('readiness labels retain both recommendations and colours with readable sentence typography', () => {
  for (const [score, colour, recommendation] of [[30, '#e05555', 'Lav parathed.'], [60, '#c8923a', 'Moderat parathed.']]) {
    const tree = render({ readinessLog: { readiness_score: score } })
    const label = nodes(tree, n => n.type === 'div' && text(n) === `Parathed ${score}/100 i dag`)[0]
    readable(label)
    assert.equal(label.props.style.color, colour)
    assert.ok(text(tree).includes(recommendation))
  }
  const calls = []
  const tree = render({ readinessLog: null, openReadiness: () => calls.push('readiness') })
  const label = nodes(tree, n => n.type === 'span' && text(n).startsWith('Log dagens parathed'))[0]
  readable(label)
  const opener = nodes(tree, n => n.type === 'button' && text(n).startsWith('◐Log dagens parathed'))[0]
  assert.equal(opener.props.style.minHeight, 44)
  assert.deepEqual(calls, [])
  opener.props.onClick()
  assert.deepEqual(calls, ['readiness'])
  assert.doesNotMatch(text(render({ readinessLog: { readiness_score: 75 } })), /Parathed 75/)
})

test('long weekday and visible set progress wrap with readable text; missing weekdays stay absent', () => {
  const day = 'En meget lang syntetisk ugedag uden afkortning'
  const tree = render({ WEEKDAYS_LONG: [day], exerciseLogs: [{ exercise_id: 'ex-1-0', set_number: 1, skipped: true }] })
  const badge = nodes(tree, n => n.type === 'span' && text(n) === day)[0]
  readable(badge)
  assert.equal(badge.props.style.color, '#c8923a')
  const progress = nodes(tree, n => n.type === 'div' && text(n) === '1 øvelse · 0/1 sæt logget · 1 skippet')[0]
  readable(progress)
  assert.doesNotMatch(text(render({ WEEKDAYS_LONG: [] })), new RegExp(day))
})

test('native action folds start closed without callbacks; pass opener and progress stay outside them', () => {
  const calls = []
  const props = programQolFixture({ openSession: id => calls.push(id),
    askConfirm: () => assert.fail('Opening a fold must not confirm'),
    skipRemainingSets: () => assert.fail('Unexpected skip'), autoCompleteSession: () => assert.fail('Unexpected autofill') })
  const view = mount(Program, props), tree = view.render()
  assert.equal(folds(tree).length, 2)
  const fold = firstFold(tree), summary = nodes(fold, n => n.type === 'summary')[0]
  assert.equal(fold.props.open, undefined)
  assert.equal(fold.props.onToggle, undefined, 'native expansion needs no write handler')
  assert.equal(summary.props.onClick, undefined)
  assert.equal(summary.props.onKeyDown, undefined, 'native keyboard activation')
  assert.equal(summary.props['aria-label'], `Flere handlinger for passet · ${context}`)
  readable(summary)
  assert.equal(summary.props.style.minHeight, 44)
  const opener = named(tree, context)
  assert.equal(opener.props['aria-expanded'], false)
  assert.equal(named(fold, context), undefined)
  assert.doesNotMatch(text(fold), /sæt logget/)
  assert.equal(nodes(fold, n => n.type === 'input').length, 0)
  assert.deepEqual(calls, [])
  opener.props.onClick()
  assert.deepEqual(calls, ['session-1-0'])
  const opened = view.render({ ...props, progOpenSession: 'session-1-0' })
  const openedButton = named(opened, context)
  assert.equal(openedButton.props['aria-expanded'], true)
  assert.equal(nodes(opened, n => n.props.id === openedButton.props['aria-controls']).length, 1)
})

test('both bulk actions keep their exact confirmation boundary and 44px targets', () => {
  const calls = [], confirmations = []
  const tree = render({ askConfirm: (message, action) => confirmations.push({ message, action }),
    skipRemainingSets: session => calls.push(['skip', session.id]),
    autoCompleteSession: session => calls.push(['fill', session.id]),
    openSession: () => assert.fail('Bulk action opened the pass') })
  for (const [label, message, result] of [
    ['Spring resten over', 'Spring de resterende sæt over? De markeres som ikke gennemført, så træningen lukkes.', 'skip'],
    ['Auto-udfyld', 'Udfyld manglende sæt med sidst loggede vægt og reps? Brug kun hvis du faktisk lavede sættene.', 'fill'],
  ]) {
    const button = named(firstFold(tree), `${label} · ${context}`)
    assert.equal(button.props.style.minHeight, 44)
    assert.equal(button.props.style.minWidth, 44)
    readable(button)
    let stopped = false
    const before = calls.length
    button.props.onClick({ stopPropagation() { stopped = true } })
    assert.equal(stopped, true)
    assert.equal(calls.length, before, 'cancel/no confirmation callback produces no write')
    assert.equal(confirmations.at(-1).message, message)
    confirmations.at(-1).action()
    assert.deepEqual(calls.at(-1), [result, 'session-1-0'])
  }
})

test('busy locks stay scoped to the affected pass and keep the pending label', () => {
  for (const action of ['skip', 'autofill', 'feedback']) {
    const tree = render({ pendingSessionAction: `session-1-0:${action}` })
    const buttons = nodes(firstFold(tree), n => n.type === 'button')
    assert.equal(buttons.length, 2)
    assert.ok(buttons.every(n => n.props.disabled && n.props.style.opacity === 0.6))
    const other = nodes(folds(tree)[1], n => n.type === 'button')
    assert.ok(other.every(n => !n.props.disabled && n.props.style.opacity === 1))
    if (action !== 'feedback') assert.ok(buttons.some(n => text(n) === '...'))
  }
})

test('read-only, completed, skipped, zero-set and upcoming-preview passes gain no fold or actions', () => {
  const props = programQolFixture()
  const allLogs = props.allWeeks[1].sessions.map(session => ({ exercise_id: session.exercises[0].id, set_number: 1 }))
  const emptyWeeks = props.allWeeks.map(week => ({ ...week, sessions: week.sessions.map(session => ({ ...session, exercises: [] })) }))
  for (const extra of [{ readOnly: true }, { exerciseLogs: allLogs },
    { exerciseLogs: allLogs.map(row => ({ ...row, skipped: true })) }, { allWeeks: emptyWeeks },
    { viewingWeekIdx: 2, programNaesteUge: true }, { programNaesteUge: true, weekStartDate: () => '2099-01-05' }]) {
    const tree = render(extra)
    assert.equal(folds(tree).length, 0)
    assert.doesNotMatch(text(tree), /Spring resten over|Auto-udfyld/)
  }
})

test('today, next pass and completed status retain their meanings outside action folds', t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-05T12:00:00Z') })
  const props = programQolFixture()
  props.allWeeks[1].start_date = '2026-11-02'
  props.allWeeks[1].sessions[0].weekday = 3
  const tree = render({ allWeeks: props.allWeeks, currentWeek: props.allWeeks[1], weekStartDate: () => '2026-11-02',
    exerciseLogs: [{ exercise_id: 'ex-1-0', set_number: 1, skipped: false }] })
  const completed = nodes(tree, n => n.type === 'span' && text(n) === 'Gennemført ✓')[0]
  assert.equal(completed.props.style.color, '#b9d5a0')
  assert.ok(nodes(tree, n => n.type === 'span' && text(n) === 'I dag').length)
  assert.match(text(tree), /Næste pas · Pas 1-1/)
  assert.ok(folds(tree).every(fold => !text(fold).includes('Gennemført ✓')))
})

test('summary focus styling stays in the program namespace; strict OFF retains original labels and actions', () => {
  const css = text(nodes(render(), n => n.type === 'style')[0])
  assert.match(css, /\[data-program-accessible\] summary:focus-visible/)
  assert.match(css, /outline: 3px solid #c8923a !important/)
  for (const entropi2 of [false, null, 0, 1, 'true']) {
    const tree = render({ entropi2, WEEKDAYS_LONG: ['Mandag'], readinessLog: { readiness_score: 30 } })
    assert.equal(folds(tree).length, 0)
    assert.equal(nodes(tree, n => n.type === 'style').length, 0)
    assert.equal(nodes(tree, n => n.type === 'span' && text(n) === 'Mandag')[0].props.style.fontSize, '0.52rem')
    assert.equal(nodes(tree, n => n.type === 'div' && text(n) === 'Parathed 30/100 i dag')[0].props.style.fontSize, '0.56rem')
    const buttons = nodes(tree, n => n.type === 'button' && ['Auto-udfyld', 'Spring resten over'].includes(text(n)))
    assert.equal(buttons.length, 4)
    assert.ok(buttons.every(n => n.props.style.fontSize === '0.62rem'))
  }
})
