import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './prog3Loader.mjs'
import { mount, nodes, text, io } from './prog3Dom.mjs'
import { programQolFixture } from './programQolFixture.mjs'
import { contrastRatio } from './programContrastFixture.mjs'
install()
const { default: Program } = await import('./ProgramTab.jsx')
const render = extra => mount(Program, programQolFixture(extra)).render()
const passes = tree => nodes(tree, n => n.props['data-program-session-tone'])
const firstCard = tree => passes(tree)[0].props.children[0]
const badge = (tree, label) => nodes(tree, n => n.type === 'span' && text(n) === label)[0]
const log = skipped => ({ exercise_id: 'ex-1-0', set_number: 1, skipped })

test('colours: empty and error cards stay neutral, accessible and independent of planned content', () => {
  for (const programError of [false, true]) {
    const calls = []
    const tree = render({ allWeeks: [], currentWeek: null, programError,
      fetchProgram: id => calls.push(id) })
    const cards = nodes(tree, n => Object.hasOwn(n.props, 'data-program-empty-state'))
    assert.equal(cards.length, 1)
    const card = cards[0]
    assert.equal(card.type, 'section')
    assert.equal(card.props.role, programError ? 'alert' : 'status')
    assert.equal(card.props['data-program-accessible'], '')
    assert.equal(card.props.style.background, '#1c1c18')
    for (const [key, value] of Object.entries({ padding: 20, borderRadius: 16,
      boxSizing: 'border-box', minWidth: 0, overflowWrap: 'anywhere', color: '#edeae2' })) {
      assert.equal(card.props.style[key], value, key)
    }
    assert.equal(passes(tree).length, 0)
    assert.equal(nodes(tree, n => n.props['data-program-week-tone']).length, 0)
    assert.match(text(card), programError ? /Dit program kunne ikke hentes/ : /Dit program er på vej/)
    assert.doesNotMatch(text(card), /Gennemført|sæt sprunget over|I dag/)
    const buttons = nodes(card, n => n.type === 'button')
    assert.deepEqual(calls, [], 'render does not retry')
    assert.equal(buttons.length, programError ? 1 : 0)
    if (programError) {
      const retry = buttons[0]
      assert.equal(text(retry), 'Prøv igen')
      assert.equal(retry.props.type, 'button')
      assert.equal(retry.props.style.minHeight, 48)
      assert.equal(retry.props.style.fontSize, 16)
      assert.equal(retry.props.style.textTransform, 'none')
      retry.props.onClick()
      assert.deepEqual(calls, ['synthetic-qol'])
    }
    assert.match(text(nodes(tree, n => n.type === 'style')[0]), /outline: 3px solid #c8923a !important/)
  }
  const planned = render({ viewingWeekIdx: 2 })
  assert.deepEqual(nodes(planned, n => n.props['data-program-week-navigation']).map(n => n.props.style.background),
    ['#1c1c18', '#202b3b'], 'block keeps its neutral surface while the planned week receives blue')
  assert.equal(firstCard(planned).props.style.background, '#202b3b')
})

test('colours: today, completed and skipped passes have distinct surfaces and explicit labels', t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-09T12:00:00Z') })
  for (const [exerciseLogs, tone, label, foreground, background] of [
    [[], 'today', 'I dag', '#edc17b', '#302719'],
    [[log(false)], 'done', 'Gennemført ✓', '#b9d5a0', '#243020'],
    [[log(true)], 'skipped', 'Afsluttet · sæt sprunget over', '#d7bce7', '#302437'],
  ]) {
    const tree = render({ exerciseLogs })
    assert.equal(passes(tree)[0].props['data-program-session-tone'], tone)
    assert.equal(firstCard(tree).props.style.background, background)
    assert.equal(badge(tree, label).props.style.color, foreground)
    assert.ok(contrastRatio(foreground, background) >= 4.5)
    assert.ok(badge(tree, 'I dag'), 'today remains explicit even after closing a pass')
    assert.ok(contrastRatio('#edc17b', '#302719') >= 4.5)
  }
  const planned = passes(render({ viewingWeekIdx: 2 }))[0]
  assert.equal(planned.props['data-program-session-tone'], 'plan')
  assert.equal(planned.props.children[0].props.style.background, '#202b3b')
})

test('colours: unknown evidence, wrong set numbers and empty plans never turn green or lilac', t => {
  // This scenario expects PLAN: the displayed Monday pass is still tomorrow.
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-08T12:00:00Z') })
  try {
  for (const extra of [{ programError: true, exerciseLogs: [log(false)] },
    { programError: true, exerciseLogs: [log(true)] },
    { exerciseLogs: [{ ...log(false), set_number: 2 }] },
    { exerciseLogs: [] }]) {
    const tree = render(extra)
    assert.doesNotMatch(text(tree), /Gennemført ✓|Afsluttet · sæt sprunget over/)
    assert.ok(passes(tree).every(n => !['done', 'skipped'].includes(n.props['data-program-session-tone'])))
  }
  for (const incomplete of [true, false]) {
    const props = programQolFixture({ exerciseLogs: [log(false)] })
    if (incomplete) props.allWeeks[1].readEvidence = { complete: false }
    else props.allWeeks[1].sessions[0].exercises = []
    const tree = mount(Program, props).render()
    assert.equal(passes(tree)[0].props['data-program-session-tone'], 'plan')
    assert.doesNotMatch(text(firstCard(tree)), /Gennemført ✓/)
  }
  } finally { t.mock.timers.reset() }
})

test('colours: mixed completed/skipped sets stay lilac with the original undo handler', () => {
  const props = programQolFixture({ progOpenSession: 'session-1-0' })
  props.allWeeks[1].sessions[0].exercises[0].sets = 2
  props.exerciseLogs = [log(false), { ...log(true), set_number: 2 }]
  const calls = []
  props.unskipSet = (...args) => calls.push(args)
  const tree = mount(Program, props).render()
  assert.equal(passes(tree)[0].props['data-program-session-tone'], 'skipped')
  assert.equal(badge(tree, 'Sprunget over').props.style.color, '#d7bce7')
  const undo = nodes(tree, n => n.type === 'button' && text(n) === 'Fortryd')[0]
  assert.ok(parseFloat(undo.props.style.minHeight) >= 44)
  undo.props.onClick()
  assert.deepEqual(calls, [['ex-1-0', 2]])
})

test('colours: week navigation keeps original indices, current label, selected aria and 44px targets', () => {
  const calls = []
  const tree = render({ viewingWeekIdx: 0, setViewingWeekIdx: index => calls.push(index) })
  const weeks = nodes(tree, n => n.props['data-program-week-tone'])
  assert.equal(weeks.length, 3)
  const current = weeks.find(n => n.props['aria-current'] === 'step')
  assert.equal(current.props.style.background, '#302719')
  assert.match(text(current), /Aktuel uge/)
  for (const week of weeks) {
    assert.ok(contrastRatio(week.props.style.color, week.props.style.background) >= 4.5)
    assert.ok(parseFloat(week.props.style.minHeight) >= 44)
    assert.equal(week.props.style.overflowWrap, 'anywhere')
    assert.equal(typeof week.props['aria-pressed'], 'boolean')
  }
  weeks.find(n => /^Uge 2/.test(text(n))).props.onClick()
  assert.deepEqual(calls, [2])
  assert.match(text(nodes(tree, n => n.type === 'style')[0]), /\[data-program-week-navigation\] button:focus-visible/)
})

test('colours: weekly and exercise prescriptions share violet without reinterpreting coach targets', () => {
  const props = programQolFixture({ progOpenSession: 'session-1-0', programIntensityHelp: true })
  props.allWeeks[1].sessions[0].exercises[0].intensity = '65–75 % / RPE 6,5 · Roligt'
  const before = JSON.stringify(props.allWeeks)
  const tree = mount(Program, props).render()
  const target = badge(tree, '65–75 % / RPE 6,5 · Roligt')
  assert.equal(target.props.style.color, '#d3c5f0')
  assert.equal(target.props.style.background, '#2b2538')
  const prescription = nodes(tree, n => Object.hasOwn(n.props, 'data-exercise-prescription'))[0]
  assert.equal(prescription.props.style.background, '#2b2538')
  assert.match(text(prescription), /65–75 % \/ RPE 6,5 · Roligt/)
  assert.equal(JSON.stringify(props.allWeeks), before)
  for (const background of ['#1c1c18', '#202b3b', '#302719', '#243020', '#302437', '#181816', '#2b2538']) {
    for (const foreground of ['#edeae2', '#c4c0b5', '#c8923a']) assert.ok(contrastRatio(foreground, background) >= 4.5, foreground + ' on ' + background)
    assert.ok(contrastRatio('#c8923a', background) >= 3, 'focus on ' + background)
  }
})

test('colours: strict OFF produces no new tone markers or palette styles, backend remains untouched', () => {
  const before = io.rpc
  for (const entropi2 of [false, null, 0, 1, 'true']) {
    const tree = render({ entropi2, progOpenSession: 'session-1-0' })
    assert.equal(nodes(tree, n => n.props['data-program-week-tone'] || n.props['data-program-session-tone']).length, 0)
    for (const node of nodes(tree, n => n.props.style)) {
      assert.ok(!['#202b3b', '#302719', '#243020', '#302437', '#2b2538'].includes(node.props.style.background))
    }
  }
  assert.equal(io.rpc, before)
})
