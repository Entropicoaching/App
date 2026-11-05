import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './prog3Loader.mjs'
import { mount, nodes, text } from './prog3Dom.mjs'
import { programQolFixture } from './programQolFixture.mjs'
install()
const { default: Program } = await import('./ProgramTab.jsx')
const render = extra => mount(Program, programQolFixture(extra)).render()
const button = (tree, label) => nodes(tree, n => n.type === 'button' && text(n) === label)[0]
const readable = node => {
  assert.ok(node)
  for (const [key, value] of Object.entries({ fontSize: '1rem', lineHeight: 1.5,
    letterSpacing: 'normal', textTransform: 'none', whiteSpace: 'normal', overflowWrap: 'anywhere' })) {
    assert.equal(node.props.style[key], value, key)
  }
}

test('week selection, dates and current/planned/historical context use readable wrapping text', () => {
  for (const viewingWeekIdx of [0, 1, 2]) {
    const tree = render({ viewingWeekIdx, fmtWeekRange: () => 'Lang syntetisk datoperiode' })
    for (const label of ['← Forrige uge', 'Næste uge →', ...(viewingWeekIdx === 1 ? [] : ['↩ Tilbage til denne uge'])]) {
      const action = button(tree, label)
      readable(action)
      assert.equal(action.props.style.minHeight, 44)
      assert.equal(action.props.style.minWidth, 44)
    }
    const heading = nodes(tree, n => n.type === 'div' && text(n).startsWith(`Uge ${viewingWeekIdx} · Lang`)
      && n.props.style?.color === '#c8923a')[0]
    readable(heading)
    assert.match(text(heading), viewingWeekIdx === 0 ? /historisk/ : viewingWeekIdx === 2 ? /planlagt/ : /Lang syntetisk datoperiode$/)
    const caption = nodes(tree, n => n.props.style?.textAlign === 'center'
      && /^(● Du er her|Historisk|Planlagt)/.test(text(n)))[0]
    readable(caption)
    readable(nodes(tree, n => n.type === 'span' && /^2\. nov.*22\. nov/.test(text(n)))[0])
    assert.equal(button(tree, '← Forrige uge').props.disabled, viewingWeekIdx === 0)
    assert.equal(button(tree, 'Næste uge →').props.disabled, viewingWeekIdx === 2)
  }
})

test('single week remains readable; long block names wrap; missing dates stay absent', () => {
  const p = programQolFixture(), week = { ...p.allWeeks[1], week_number: 0,
    block_name: 'LangtBloknavn'.repeat(20), start_date: null }
  const tree = render({ allWeeks: [week], currentWeek: week, viewingWeekIdx: 0 })
  readable(nodes(tree, n => n.type === 'div' && text(n) === 'Uge 0')[0])
  const blockName = nodes(tree, n => n.type === 'span' && text(n) === week.block_name)[0]
  assert.equal(blockName.props.style.whiteSpace, 'normal')
  assert.equal(blockName.props.style.overflowWrap, 'anywhere')
  assert.equal(button(tree, '← Forrige uge'), undefined)
  assert.equal(button(tree, 'Næste uge →'), undefined)
  assert.doesNotMatch(text(tree), /Invalid Date|undefined/)
})

test('week navigation retains handlers and has a scoped keyboard focus rule', () => {
  const calls = []
  const tree = render({ viewingWeekIdx: 0, setViewingWeekIdx: index => calls.push(['week', index]),
    setProgOpenSession: id => calls.push(['session', id]), setPastLogs: logs => calls.push(['logs', logs]) })
  button(tree, 'Næste uge →').props.onClick()
  assert.deepEqual(calls, [['week', 1], ['session', null], ['logs', []]])
  button(tree, '↩ Tilbage til denne uge').props.onClick()
  assert.deepEqual(calls.slice(3), [['week', 1], ['session', null], ['logs', []]])
  const scopes = nodes(tree, n => n.props['data-program-week-navigation'])
  assert.equal(scopes.length, 2)
  assert.ok(scopes.some(scope => button(scope, 'Næste uge →')))
  assert.match(text(nodes(tree, n => n.type === 'style')[0]), /\[data-program-week-navigation\] button:focus-visible/)
})

test('long adjacent block links wrap without ellipsis and retain original week indices', () => {
  const p = programQolFixture(), calls = []
  p.allWeeks[0].block_name = 'TidligereBlok'.repeat(12)
  p.allWeeks[2].block_name = 'FølgendeBlok'.repeat(12)
  const tree = render({ allWeeks: p.allWeeks, currentWeek: p.allWeeks[1],
    setViewingWeekIdx: index => calls.push(index) })
  for (const [label, index] of [[`‹ ${p.allWeeks[0].block_name}`, 0], [`${p.allWeeks[2].block_name} ›`, 2]]) {
    const link = button(tree, label)
    readable(link)
    assert.equal(link.props.style.overflow, 'visible')
    assert.equal(link.props.style.textOverflow, 'clip')
    assert.equal(link.props.style.minHeight, '44px')
    link.props.onClick()
    assert.equal(calls.at(-1), index)
  }
})

test('strict OFF retains legacy sizes, uppercase and unscoped week navigation', () => {
  for (const entropi2 of [false, null, 0, 1, 'true']) {
    const tree = render({ entropi2, viewingWeekIdx: 0 })
    assert.equal(button(tree, 'Næste uge →').props.style.fontSize, '0.58rem')
    assert.equal(button(tree, '↩ Tilbage til denne uge').props.style.fontSize, '0.52rem')
    assert.equal(nodes(tree, n => n.props['data-program-week-navigation']).length, 0)
    assert.equal(nodes(tree, n => n.type === 'style').length, 0)
  }
})
