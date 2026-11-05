// Actual copied components with synthetic hooks/elements. No ReactDOM or layout claim.
import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './prog3Loader.mjs'
import { mount, nodes, text, button } from './prog3Dom.mjs'
import { programQolFixture } from './programQolFixture.mjs'
import { contrastRatio } from './programContrastFixture.mjs'
install()
const { default: Program } = await import('./ProgramTab.jsx')
const { default: Profile } = await import('../entropi2/profile/Profile.mjs')
const render = extra => mount(Program, programQolFixture({ allWeeks: [], currentWeek: null, ...extra })).render()
const states = tree => nodes(tree, n => n.props['data-program-empty-state'] !== undefined)

test('profile supplies its own dark surface for light system themes, including empty data', () => {
  for (const athlete of [null, {}, { name: 'Testatlet', kcal_target: 2200 }]) {
    const tree = mount(Profile, { enabled: true, athlete }).render()
    assert.equal(tree.props.style.background, '#141410')
    for (const heading of nodes(tree, n => ['h1', 'h2'].includes(n.type))) {
      for (const background of [tree.props.style.background, '#1c1c18'])
        assert.ok(contrastRatio(heading.props.style.color, background) >= 4.5)
    }
  }
  assert.equal(Profile({ enabled: false, get athlete() { assert.fail('OFF read') } }), null)
})

test('empty program keeps original copy and signature in one visible status without retry', () => {
  const tree = render(), [state] = states(tree)
  assert.equal(states(tree).length, 1)
  assert.equal(state.props.role, 'status')
  assert.equal(nodes(state, n => n.type === 'h2').length, 1)
  assert.match(text(state), /Entropi\.Dit program er på vej\.Din coach sætter det op inden din næste træning\./)
  assert.doesNotMatch(text(tree), /Du har ikke et program endnu|kunne ikke hentes/)
  assert.equal(nodes(tree, n => n.type === 'button').length, 0)
  assert.equal(nodes(tree, n => n.type === 'details').length, 0)
})

test('fetch failure is one alert, retains the existing scoped retry, and never reads during rendering', () => {
  const calls = [], tree = render({ programError: true, fetchProgram: (...args) => calls.push(args) })
  const [state] = states(tree)
  assert.equal(states(tree).length, 1)
  assert.equal(state.props.role, 'alert')
  assert.match(text(state), /Dit program kunne ikke hentes.*Tjek din forbindelse/)
  assert.doesNotMatch(text(tree), /Entropi\.|Dit program er på vej|inden din næste træning/)
  assert.deepEqual(calls, [])
  const retry = button(tree, 'Prøv igen')
  assert.equal(retry.props.type, 'button')
  assert.equal(retry.props.style.minHeight, 48)
  assert.equal(retry.props.style.fontSize, 16)
  assert.match(retry.props.style.fontFamily, /IBM Plex Sans/)
  assert.equal(retry.props.style.lineHeight, 1.5)
  assert.equal(retry.props.style.letterSpacing, 'normal')
  assert.equal(retry.props.style.textTransform, 'none')
  assert.equal(retry.props.style.whiteSpace, 'normal')
  assert.equal(retry.props.style.overflowWrap, 'anywhere')
  assert.ok(retry.props.style.minWidth >= 44)
  retry.props.onClick()
  assert.deepEqual(calls, [['synthetic-qol']])
})

test('empty and error copy uses readable contrast, normal spacing and a wrapping mobile card', () => {
  for (const programError of [false, true]) {
    const [state] = states(render({ programError }))
    assert.equal(state.props.style.padding, 20)
    assert.equal(state.props.style.borderRadius, 16)
    assert.ok(Object.hasOwn(state.props, 'data-program-accessible'))
    assert.equal(state.props.style.minWidth, 0)
    assert.equal(state.props.style.boxSizing, 'border-box')
    assert.equal(state.props.style.overflowWrap, 'anywhere')
    for (const paragraph of nodes(state, n => n.type === 'p')) {
      assert.ok(paragraph.props.style.fontSize >= 16)
      assert.equal(paragraph.props.style.letterSpacing, 'normal')
      assert.ok(contrastRatio(paragraph.props.style.color, state.props.style.background) >= 4.5)
    }
  }
})

test('rerender replaces empty, failed, recovered and populated states without duplicate notices', () => {
  const empty = programQolFixture({ allWeeks: [], currentWeek: null })
  const runtime = mount(Program, empty)
  assert.equal(states(runtime.render())[0].props.role, 'status')
  assert.equal(states(runtime.render({ ...empty, programError: true }))[0].props.role, 'alert')
  assert.equal(states(runtime.render(empty))[0].props.role, 'status')
  const populated = runtime.render(programQolFixture())
  assert.equal(states(populated).length, 0)
  assert.match(text(populated), /Pas 1-0/)
})

test('strict OFF keeps original empty/error text, retry and card markup', () => {
  for (const entropi2 of [false, null, 0, 1, 'true']) for (const programError of [false, true]) {
    const tree = render({ entropi2, programError })
    assert.equal(states(tree).length, 0)
    assert.match(text(tree), programError ? /Dit program kunne ikke hentes/ : /Dit program er på vej.*inden din næste træning/)
    assert.equal(nodes(tree, n => ['status', 'alert'].includes(n.props.role)).length, 0)
  }
})
