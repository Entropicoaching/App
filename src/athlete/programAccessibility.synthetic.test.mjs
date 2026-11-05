// Executes handlers on the actual copied module; the tree/hook adapter is synthetic.
import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './prog3Loader.mjs'
import { mount, nodes, text } from './prog3Dom.mjs'
import { accessibilityFixture, sessionName, setName, inputKey, completeLogs } from './programAccessibilityFixture.mjs'
install()
const { default: Program } = await import('./ProgramTab.jsx')
const named = (tree, name) => {
  const matches = nodes(tree, node => node.props['aria-label'] === name)
  assert.equal(matches.length, 1, name)
  return matches[0]
}
const render = extra => mount(Program, accessibilityFixture(extra)).render()

test('F1: native pass buttons expose expansion, target open content and toggle existing handlers', () => {
  const calls = []
  const props = accessibilityFixture({ progOpenSession: null, openSession: id => calls.push(id) })
  const view = mount(Program, props)
  let tree = view.render()
  const first = named(tree, sessionName(1)), second = named(tree, sessionName(2))
  for (const button of [first, second]) {
    assert.equal(button.type, 'button')
    assert.equal(button.props.type, 'button')
    assert.equal(button.props['aria-expanded'], false)
    assert.equal(button.props.onKeyDown, undefined, 'native Enter/Space activation needs no custom key handler')
    assert.equal(nodes(button, n => ['button', 'input', 'textarea'].includes(n.type)).length, 1)
  }
  assert.equal(nodes(tree, n => n.type === 'input').length, 0)
  first.props.onClick()
  assert.deepEqual(calls, ['session-1-0'])
  tree = view.render({ ...props, progOpenSession: calls[0] })
  const opened = named(tree, sessionName(1))
  assert.equal(opened.props['aria-expanded'], true)
  assert.equal(nodes(tree, n => n.props.id === opened.props['aria-controls']).length, 1)
  assert.equal(nodes(tree, n => n.type === 'div' && n.props.onClick && text(n).includes('Testpas')).length, 0)
  opened.props.onClick()
  assert.deepEqual(calls, ['session-1-0', null])
  tree = view.render({ ...props, progOpenSession: null })
  assert.equal(nodes(tree, n => n.type === 'input').length, 0)
})

test('F5: repeated fields/actions have distinct pass, exercise and set names; original writes are preserved', () => {
  const calls = []
  let inputs = {}
  const props = accessibilityFixture({
    logSet: (...args) => calls.push(['log', ...args]), skipSet: (...args) => calls.push(['skip', ...args]),
    setLogInputs: update => { inputs = update(inputs) },
  })
  const tree = mount(Program, props).render()
  const fields = nodes(tree, n => ['input', 'textarea'].includes(n.type))
  assert.equal(fields.length, 12)
  assert.equal(new Set(fields.map(n => n.props['aria-label'])).size, fields.length)
  for (const exercise of [1, 2]) for (const set of [1, 2]) {
    const scope = setName(exercise, set)
    named(tree, `Vægt · ${scope}`).props.onChange({ target: { value: '82,5' } })
    named(tree, `Reps · ${scope}`).props.onChange({ target: { value: '4' } })
    named(tree, `Note · ${scope}`).props.onChange({ target: { value: 'Syntetisk note' } })
    assert.deepEqual(inputs[inputKey(exercise, set)], { weight: '82.5', reps: '4', note: 'Syntetisk note' })
    named(tree, `Log sæt · ${scope}`).props.onClick()
    named(tree, `Spring over · ${scope}`).props.onClick()
  }
  assert.deepEqual(calls[0], ['log', 'session-1-0-row-1', 1, 2, '5', 8])
  assert.deepEqual(calls[1], ['skip', 'session-1-0-row-1', 1, 8])
  const other = render({ progOpenSession: 'session-1-1' })
  assert.ok(named(other, `Vægt · ${setName(1, 1, 2)}`))
})

test('F5: RPE picker states and chosen values remain truthful and preserve the existing updater', () => {
  const key = inputKey(1, 1), calls = []
  let inputs = { [key]: { rpe: '7', note: 'Bevar note' } }
  const props = accessibilityFixture({ openRpePicker: key, logInputs: inputs,
    setLogInputs: update => { inputs = update(inputs) }, setOpenRpePicker: value => calls.push(value) })
  const view = mount(Program, props)
  let tree = view.render()
  assert.equal(named(tree, `Vælg RPE 7 · ${setName(1, 1)}`).props['aria-expanded'], true)
  const choices = nodes(tree, n => n.type === 'button' && /^RPE /.test(n.props['aria-label'] || '') && n.props['aria-pressed'] !== undefined)
  assert.equal(choices.length, 10)
  assert.equal(choices.filter(n => n.props['aria-pressed']).length, 1)
  assert.equal(text(choices.find(n => n.props['aria-pressed'])), '7 ✓')
  named(tree, `RPE 8.5 · ${setName(1, 1)}`).props.onClick()
  assert.equal(inputs[key].rpe, '8.5')
  assert.match(inputs[key].note, /Bevar note/)
  assert.deepEqual(calls, [null])
  tree = view.render({ ...props, logInputs: inputs, openRpePicker: null })
  assert.equal(named(tree, `Vælg RPE 8.5 · ${setName(1, 1)}`).props['aria-expanded'], false)
})

test('F5: saved, failed and undone sets expose context without inventing a successful save', () => {
  const key = inputKey(1, 1)
  const empty = render()
  assert.equal(nodes(empty, n => n.props.role === 'status').length, 4)
  assert.ok(nodes(empty, n => n.props.role === 'status').every(n => text(n) === ''))
  const saved = render({ exerciseLogs: completeLogs().slice(0, 1), setConfirm: { [key]: 'saved' } })
  assert.equal(text(named(saved, `Gemt ✓, opdatér sæt · ${setName(1, 1)}`)), 'Gemt ✓')
  assert.ok(nodes(saved, n => n.props.role === 'status' && text(n) === `${setName(1, 1)}: Gemt ✓`).length)
  const failed = render({ setConfirm: { [key]: 'error' } })
  assert.ok(nodes(failed, n => n.props.role === 'status' && text(n) === `${setName(1, 1)}: Ikke gemt. Prøv igen`).length)
  assert.doesNotMatch(text(failed), /Gemt ✓/)
  let undo
  const skipped = render({ exerciseLogs: [{ ...completeLogs()[0], skipped: true }],
    unskipSet: (...args) => { undo = args } })
  named(skipped, `Fortryd spring over · ${setName(1, 1)}`).props.onClick()
  assert.deepEqual(undo, ['session-1-0-row-1', 1])
})

test('F5: feedback selection, comments, pending/failed save and persisted feedback use actual state', () => {
  let feedback = {}, saved, dismissed
  const props = accessibilityFixture({ exerciseLogs: completeLogs(),
    setFeedbackInputs: update => { feedback = update(feedback) }, saveFeedback: id => { saved = id },
    setDismissedFeedback: update => { dismissed = update(new Set()) } })
  const view = mount(Program, props)
  let tree = view.render()
  const rate = `Vurder træningen 4 af 5 · ${sessionName(1)}`
  assert.equal(named(tree, rate).props['aria-pressed'], false)
  named(tree, rate).props.onClick()
  named(tree, `Kommentar til træningsfeedback · ${sessionName(1)}`).props.onChange({ target: { value: 'Syntetisk kommentar' } })
  tree = view.render({ ...props, feedbackInputs: feedback })
  assert.equal(named(tree, rate).props['aria-pressed'], true)
  assert.equal(text(named(tree, rate)), '4 ✓')
  assert.equal(feedback['session-1-0'].comment, 'Syntetisk kommentar')
  named(tree, `Gem feedback · ${sessionName(1)}`).props.onClick()
  assert.equal(saved, 'session-1-0')
  assert.doesNotMatch(text(tree), /Træningsfeedback gemt/)
  const pending = view.render({ ...props, feedbackInputs: feedback, pendingSessionAction: 'session-1-0:feedback' })
  assert.equal(named(pending, `Gem feedback · ${sessionName(1)}`).props.disabled, true)
  assert.doesNotMatch(text(pending), /Træningsfeedback gemt/)
  // An unsuccessful save leaves the form and rating intact; it cannot set the persisted field.
  tree = view.render({ ...props, feedbackInputs: feedback })
  assert.equal(named(tree, rate).props['aria-pressed'], true)
  named(tree, `Spring træningsfeedback over · ${sessionName(1)}`).props.onClick()
  assert.ok(dismissed.has('session-1-0'))
  props.allWeeks[1].sessions[0].athlete_rating = 4
  tree = view.render(props)
  assert.match(text(tree), /Træningsfeedback gemt · Testpas · pas 1, uge 1: 4 af 5/)
  assert.equal(nodes(tree, n => n.type === 'textarea').length, 0)
})

test('F3: focus CSS is scoped, overrides inline outline reset and leaves OFF without styling', () => {
  const tree = render()
  const style = nodes(tree, n => n.type === 'style')
  assert.equal(style.length, 1)
  assert.match(text(style[0]), /\[data-program-accessible\] :is\(input, textarea, select, button\):focus-visible/)
  assert.match(text(style[0]), /outline: 3px solid #c8923a !important/)
  assert.match(text(style[0]), /outline-offset: 3px/)
  for (const entropi2 of [false, null, 0, 1, 'true']) {
    const off = render({ entropi2 })
    assert.equal(nodes(off, n => n.props['data-program-accessible']).length, 0)
    assert.equal(nodes(off, n => n.type === 'style').length, 0)
    assert.equal(nodes(off, n => n.type === 'input' && n.props['aria-label'] === 'Vægt, sæt 1').length, 2)
  }
})

test('read-only, historical, future, closed and empty views never gain write controls', () => {
  for (const extra of [{ readOnly: true }, { viewingWeekIdx: 0, progOpenSession: 'session-0-0' },
    { viewingWeekIdx: 2, progOpenSession: 'session-2-0' }, { progOpenSession: null }, { allWeeks: [] }]) {
    const tree = render(extra)
    assert.equal(nodes(tree, n => ['input', 'textarea'].includes(n.type)).length, 0)
    assert.equal(nodes(tree, n => /^Log sæt|^Gem feedback/.test(n.props['aria-label'] || '')).length, 0)
  }
})
