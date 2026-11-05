// Separate-process checks with independent fixtures and the actual copied screen/model.
import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './prog3Loader.mjs'
import { mount, nodes, text } from './prog3Dom.mjs'
install()
const { default: Program } = await import('./ProgramTab.jsx')
const { default: Before } = await import('./prog3Baseline.jsx')
const { DEFAULT_ENTROPI2 } = await import('../entropi2/flag.mjs')

function fixture(extra = {}) {
  const weeks = [
    ['a', 11, 'Basis'], ['b', 12, 'Basis'], ['c', 13, 'Deload'],
    ['d', 14, 'Test'], ['e', 15, 'Basis'],
  ].map(([id, week_number, block_name]) => ({
    id, week_number, block_name, athlete_id: 'review-fixture', sessions: [],
  }))
  const calls = []
  const props = { hviledageListe: true, allWeeks: weeks, currentWeek: weeks[1], viewingWeekIdx: 4,
    athlete: { id: 'review-fixture' }, computeActiveWeekIdx: () => 0,
    weekStartDate: () => null, fmtWeekRange: () => null,
    exerciseLogs: [], pastLogs: [], readinessLog: null,
    setViewingWeekIdx: i => calls.push(['week', i]),
    setProgOpenSession: value => calls.push(['session', value]),
    fetchPastLogs: (week, id) => calls.push(['past', week.id, id]),
    setPastLogs: value => calls.push(['logs', value]),
    fetchProgram: id => calls.push(['retry', id]), ...extra }
  return { props, calls }
}
const summary = tree => nodes(tree, n => n.props['aria-label'] === 'Din aktuelle blok')[0]
const render = props => mount(Program, props).render()
function shape(value) {
  if (typeof value === 'function') return '[handler]'
  if (Array.isArray(value)) return value.map(shape)
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, shape(item)]))
  return value
}

test('review: actual shared default enables top summary, active block wins over browsing', () => {
  assert.equal(DEFAULT_ENTROPI2, true)
  const { props, calls } = fixture()
  const original = JSON.stringify(props.allWeeks)
  const tree = render(props), block = summary(tree)
  assert.ok(block)
  assert.equal(nodes(tree, n => n.type === 'section')[0], block)
  assert.match(text(block), /Uge 2 af 2/)
  assert.doesNotMatch(text(block), /Næste test eller deload|Deload i programuge 13/)
  assert.doesNotMatch(text(block), /Test i programuge 14/)
  assert.equal(JSON.stringify(props.allWeeks), original)
  assert.deepEqual(calls, [])
  const fold = nodes(block, n => n.type === 'details')[0]
  assert.equal(fold.props.open, undefined)
  assert.equal(nodes(block, n => n.type === 'h2').length, 1)
  const visible = block.props.children.filter(n => n.type !== 'details').map(text).join(' ')
  assert.doesNotMatch(visible, /planlagte sæt|Hviledage|Logstatus/)
  const history = nodes(block, n => n.props['data-program-history'])[0]
  assert.equal(history.props.open, undefined)
  assert.match(text(history), /Vis tidligere uger/)
  const previous = nodes(history, n => n.type === 'button')[0]
  previous.props.onClick()
  assert.deepEqual(calls, [['week', 0], ['session', null], ['past', 'a', 'review-fixture']])
})

test('review: OFF and nonboolean gates match pinned legacy tree exactly', () => {
  for (const entropi2 of [false, null, 0, 1, 'true']) {
    const { props } = fixture({ entropi2, programBlokOversigt: false })
    assert.equal(summary(render(props)), undefined)
    assert.deepEqual(shape(render(props)), shape(mount(Before, props).render()))
  }
})

test('review: missing volume, undated marker and unsafe-looking name stay honest text', () => {
  const { props } = fixture()
  props.allWeeks[0].sessions = undefined
  props.allWeeks[0].block_name = props.allWeeks[1].block_name = '<svg onload=fixture()>'
  const tree = summary(render(props))
  assert.match(text(tree), /Planlagt volumen ukendt/)
  assert.match(text(tree), /Uge 12.*0 planlagte sæt/)
  assert.match(text(tree), /<svg onload=fixture\(\)>/)
  assert.equal(nodes(tree, n => n.props.dangerouslySetInnerHTML !== undefined).length, 0)
})

test('review: refresh error hides current facts and retries through the existing reader', () => {
  const { props, calls } = fixture({ programError: true })
  const block = summary(render(props))
  assert.doesNotMatch(text(block), /Uge \d+ af|Deload i programuge|planlagte sæt/)
  assert.equal(nodes(block, n => n.props.role === 'status').length, 1)
  nodes(block, n => n.type === 'button')[0].props.onClick()
  assert.deepEqual(calls, [['retry', 'review-fixture']])
})

test('review: incomplete nested relations cannot fabricate zero sets, rest days or log status', () => {
  for (const sessions of [undefined, [null], [{}], [{ exercises: [null] }]]) {
    const { props } = fixture()
    props.allWeeks[0].sessions = sessions
    const history = nodes(summary(render(props)), n => n.props['data-program-history'])[0]
    const row = nodes(history, n => n.type === 'button')[0]
    assert.match(text(row), /Planlagt volumen ukendt/)
    assert.match(text(row), /Logstatus ikke tilgængelig/)
    assert.match(text(row), /Hviledage ikke fastlagt/)
    assert.doesNotMatch(text(row), /0 planlagte sæt|Ingen planlagte sæt|Ugen er logget/)
  }
})

test('review: empty and failed empty reads retain distinct established screen states', () => {
  for (const programError of [false, true]) {
    const { props } = fixture({ allWeeks: [], currentWeek: null, programError })
    const tree = render(props)
    assert.equal(summary(tree), undefined)
    assert.match(text(tree), programError ? /kunne ikke hentes/ : /Dit program er på vej/)
    assert.doesNotMatch(text(tree), /Uge \d+ af/)
  }
})

// Regression cases from round two: visible content is inspected outside details.
function visibleText(node) {
  if (node == null || typeof node !== 'object') return node == null ? '' : String(node)
  if (node.type === 'details' && node.props.open !== true) return ''
  return (node.props.children || []).map(visibleText).join(' ')
}
test('round two: coach information and block navigation remain visible with either layout flag', () => {
  for (const programUgeFoerst of [false, true]) {
    const { props } = fixture({ programUgeFoerst })
    props.allWeeks[4].coach_note = 'Syntetisk ugenote'
    props.allWeeks[4].block_description = 'Syntetisk coachbeskrivelse'
    const tree = render(props), visible = visibleText(tree)
    assert.match(visible, /Syntetisk ugenote/)
    assert.match(visible, /Fra din coach.*Syntetisk coachbeskrivelse/)
    assert.doesNotMatch(text(tree), /aktiv uge .* af/)
    assert.equal(nodes(tree, n => n.type === 'details').length, 2)
    // Old circular week buttons must not duplicate the detailed weekly list.
    assert.equal(nodes(tree, n => n.type === 'button' && n.props.style?.borderRadius === '50%').length, 0)
    assert.equal(nodes(tree, n => n.type === 'button' && /‹|›/.test(text(n))).length > 0, true)
  }
})
test('round two: week zero and repeated numbers retain distinct navigation targets', () => {
  const { props, calls } = fixture()
  props.allWeeks = [0, 1, 1, 2].map((week_number, i) => ({ id: `usable-${i}`, week_number,
    block_name: 'Basis', sessions: [] }))
  props.currentWeek = props.allWeeks[2]
  props.viewingWeekIdx = 2
  const tree = summary(render(props))
  assert.match(text(tree), /Uge 3 af 4/)
  const buttons = nodes(tree, n => n.type === 'button')
  assert.equal(buttons.length, 4)
  assert.equal(buttons[0].props['aria-current'], 'step')
  const history = nodes(tree, n => n.props['data-program-history'])[0]
  nodes(history, n => n.type === 'button')[1].props.onClick()
  assert.deepEqual(calls, [['week', 1], ['session', null], ['past', 'usable-1', 'review-fixture']])
})
test('round two: only an upcoming marker in this block produces the milestone heading', () => {
  const { props } = fixture()
  let block = summary(render(props))
  assert.doesNotMatch(text(block), /Næste test eller deload/)
  props.allWeeks[0].block_name = props.allWeeks[1].block_name = 'Test / deload'
  props.currentWeek = props.allWeeks[0]
  block = summary(render(props))
  assert.match(text(block), /Næste test eller deload.*Test og Deload i programuge 12/)
  props.currentWeek = props.allWeeks[1]
  assert.doesNotMatch(text(summary(render(props))), /Næste test eller deload/)
})
