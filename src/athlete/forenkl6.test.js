import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, nodes, text, button } from './forenkl6Dom.mjs'
import { Program, Baseline, helpers, propsFor, render, byType, assertLayout, domShape } from './forenkl6Cases.mjs'

test('defaultOFF: exact baseline element tree for omitted, false and nonboolean flags', () => {
  for (const flag of [undefined, false, 'true', 1, null]) for (const index of [0, 1]) {
    const p = Object.assign(propsFor(), { programUgeFoerst: flag })
    p.viewingWeekIdx = index
    assert.deepEqual(domShape(render(p)), domShape(mount(Baseline, p).render()))
  }
})
test('ON: sessions precede one closed block line with all existing block information', () => {
  const p = Object.assign(propsFor(), { programUgeFoerst: true })
  const tree = render(p), details = assertLayout(tree, 'Pas 0')
  assert.match(text(details), /Beskrivelse 0/)
  assert.match(text(details), /Ugenote 0/)
  assert.equal(details.props.key, 'week-0')
  const card = nodes(tree, n => n.type === 'div' && n.props.onClick && text(n).includes('Pas 0'))[0]
  card.props.onClick()
  assert.equal(p.progOpenSession, 'session-0')
})
for (const [date, start] of [['2026-10-25T12:00:00', '2026-10-19'], ['2026-03-29T12:00:00', '2026-03-23']]) {
  test(`Sunday and clock change: next week navigation on ${date}`, t => {
    t.mock.timers.enable({ apis: ['Date'], now: new Date(date).getTime() })
    const p = Object.assign(propsFor(start), { programUgeFoerst: true })
    assert.equal(helpers.computeActiveWeekIdx(p.allWeeks), 0)
    button(render(p), 'Næste uge →').props.onClick()
    assert.equal(p.viewingWeekIdx, 1)
    const tree = render(p), details = assertLayout(tree, 'Pas 1')
    assert.equal(details.props.key, 'week-1')
    assert.match(text(tree), /planlagt/)
    assert.ok(!text(tree).includes('Pas 0'))
    assert.ok(text(tree).includes(helpers.fmtWeekRange(helpers.weekStartDate(p.allWeeks, 2))))
    assert.equal(p.fetched, undefined)
    button(tree, '↩ Tilbage til denne uge').props.onClick()
    assert.equal(p.viewingWeekIdx, 0)
  })
}
