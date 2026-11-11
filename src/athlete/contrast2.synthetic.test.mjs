// Actual copied modules with synthetic elements/hooks; no ReactDOM/layout claim.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { install } from './prog3Loader.mjs'
import { mount, nodes, text } from './prog3Dom.mjs'
import { programQolFixture } from './programQolFixture.mjs'
import { contrastRatio } from './programContrastFixture.mjs'

install()
const { default: Program } = await import('./ProgramTab.jsx')
const { default: Profile } = await import('../entropi2/profile/Profile.mjs')
const css = readFileSync(new URL('../entropi2/entropi2.css', import.meta.url), 'utf8')
const render = props => mount(Program, programQolFixture(props)).render()
const find = (tree, label) => nodes(tree, n => n.type === 'button' && text(n).trim() === label)[0]
const aa = colour => {
  for (const background of ['#141410', '#1c1c18', '#181816', '#292216'])
    assert.ok(contrastRatio(colour, background) >= 4.5, `${colour} on ${background}`)
}

test('F4: actual profile headings override the global dark heading colour at AA', () => {
  const tree = mount(Profile, { enabled: true, athlete: { name: 'Testatlet', kcal_target: 2200 } }).render()
  const headings = nodes(tree, n => ['h1', 'h2'].includes(n.type))
  assert.equal(headings.length, 2)
  for (const heading of headings) aa(heading.props.style.color)
  assert.equal(Profile({ enabled: false, get athlete() { assert.fail('OFF read') } }), null)
  assert.ok(contrastRatio('#08060d', '#1c1c18') < 4.5)
})

test('F4: program helper text in ready, historical, future, empty and error states meets AA', () => {
  for (const props of [{}, { viewingWeekIdx: 0 }, { viewingWeekIdx: 2 },
    { allWeeks: [], currentWeek: null }, { allWeeks: [], currentWeek: null, programError: true }]) {
    const tree = render(props)
    const coloured = nodes(tree, n => n.props.style?.color)
    assert.ok(coloured.some(n => n.props.style.color === '#c4c0b5'))
    assert.equal(coloured.some(n => ['#4a4844', '#7a7770'].includes(n.props.style.color)), false)
    for (const node of coloured.filter(n => n.props.style.color === '#c4c0b5')) aa(node.props.style.color)
  }
  for (const old of ['#4a4844', '#7a7770']) assert.ok(contrastRatio(old, '#1c1c18') < 4.5)
})

test('F6: secondary return and retry actions have 44 by 44 px minimums and keep their callbacks', () => {
  const calls = []
  const tree = render({ viewingWeekIdx: 0, setViewingWeekIdx: index => calls.push(index) })
  const back = find(tree, '↩ Tilbage til denne uge')
  assert.ok(back)
  for (const button of [back, find(render({ allWeeks: [], currentWeek: null, programError: true }), 'Prøv igen')]) {
    assert.ok(button.props.style.minHeight >= 44)
    assert.ok(button.props.style.minWidth >= 44)
    assert.equal(button.props.style.boxSizing, 'border-box')
  }
  back.props.onClick()
  assert.deepEqual(calls, [1])
})

test('F6: open logger has accessible RPE help, RPE choices, skip and undo controls', () => {
  const calls = []
  const tree = render({ progOpenSession: 'session-1-0', openRpePicker: 'ex-1-0_1',
    setShowRpeGuide: value => calls.push(['guide', value]) })
  for (const label of ['ℹ', '5,5', '10', 'Spring sæt over', 'Auto-udfyld', 'Spring over']) {
    const button = find(tree, label)
    assert.ok(button, label)
    assert.ok(parseFloat(button.props.style.minHeight) >= 44, label)
    assert.ok(parseFloat(button.props.style.minWidth) >= 44, label)
  }
  find(tree, 'ℹ').props.onClick()
  assert.deepEqual(calls, [['guide', true]])
  const skipped = render({ progOpenSession: 'session-1-0',
    exerciseLogs: [{ exercise_id: 'ex-1-0', set_number: 1, skipped: true }] })
  assert.ok(find(skipped, 'Fortryd').props.style.minHeight >= 44)
})

test('strict OFF keeps original helper colours and secondary target dimensions', () => {
  for (const entropi2 of [false, null, 0, 1, 'true']) {
    const tree = render({ entropi2, viewingWeekIdx: 0 })
    const back = find(tree, '↩ Tilbage til denne uge')
    assert.equal(back.props.style.minHeight, undefined)
    assert.equal(back.props.style.minWidth, undefined)
    assert.ok(nodes(tree, n => ['#4a4844', '#7a7770'].includes(n.props.style?.color)).length)
  }
})

test('F6: timed exercise start and pause targets grow only with Entropi 2', () => {
  for (const entropi2 of [true, false]) {
    const props = programQolFixture({ entropi2, progOpenSession: 'session-1-0' })
    props.currentWeek.sessions[0].exercises[0].reps = '30 sek'
    const view = mount(Program, props)
    for (const label of ['▶ Start timer', '⏸ Pause']) {
      const button = find(view.render(), label)
      assert.ok(button, label)
      assert.equal(button.props.style.minHeight, entropi2 ? 44 : undefined)
      assert.equal(button.props.style.minWidth, entropi2 ? 44 : undefined)
      button.props.onClick()
    }
  }
})

test('F6: record history overrides the old inline 32 px only inside the Entropi 2 athlete root', () => {
  const rule = css.match(/\[data-entropi2-athlete\] \[data-rekord-historik-knap\]\s*\{([^}]+)\}/)
  assert.ok(rule)
  assert.match(rule[1], /min-height:\s*44px\s*!important;/)
  assert.match(rule[1], /min-width:\s*44px;/)
  assert.match(rule[1], /box-sizing:\s*border-box;/)
  assert.equal((css.match(/data-rekord-historik-knap/g) ?? []).length, 1)
  for (const file of ['FremgangTab.jsx', 'EnkelFremgangTab.jsx']) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8')
    assert.match(source, /data-rekord-historik-knap=/)
    assert.match(source, /minHeight: 32/)
  }
})
