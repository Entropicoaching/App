// Own counterexamples executed against the exact final ProgramTab import.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, text, nodes, button } from './forenkl6Dom.mjs'
import { Program, Baseline, propsFor, render, byType, assertLayout, domShape, helpers } from './forenkl6Cases.mjs'

test('Counterexample: empty programme and failed read preserve legacy retry', () => {
  for (const programError of [null, 'synthetic error']) {
    const p = Object.assign(propsFor(), { allWeeks: [], programError, programUgeFoerst: true })
    let retries = 0; p.fetchProgram = id => { assert.equal(id, p.athlete.id); retries++ }
    const tree = render(p)
    assert.deepEqual(domShape(tree), domShape(mount(Baseline, p).render()))
    assert.equal(byType(tree, 'details').length, 0)
    if (programError) button(tree, 'Prøv igen').props.onClick()
    assert.equal(retries, programError ? 1 : 0)
  }
})
test('Counterexample: single empty week retains empty state and a named closed line', () => {
  const p = Object.assign(propsFor(), { programUgeFoerst: true })
  p.allWeeks = [p.allWeeks[0]]; p.allWeeks[0].sessions = []; p.allWeeks[0].block_name = null
  const tree = render(p)
  assert.match(text(tree), /Ingen træninger i denne uge endnu/)
  assert.equal(text(byType(tree, 'summary')[0]), 'Blokinfo: Dit program')
  assert.equal(byType(tree, 'details')[0].props.open, undefined)
  assert.equal(byType(tree, 'button').length, 1, 'only existing week dot control')
})
test('Counterexample: Sunday anchor on next week remains current with current logs', t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-25T12:00:00').getTime() })
  const p = Object.assign(propsFor(), { programUgeFoerst: true })
  assert.equal(helpers.computeActiveWeekIdx(p.allWeeks), 0)
  p.currentWeek = p.allWeeks[1]; p.viewingWeekIdx = 1
  const tree = render(p)
  assertLayout(tree, 'Pas 1')
  assert.ok(!text(tree).includes('planlagt'))
  assert.ok(!text(tree).includes('historisk'))
  button(tree, '← Forrige uge').props.onClick()
  assert.deepEqual(p.fetched, ['week-0', 'synthetic-athlete'])
  assert.equal(p.progOpenSession, null)
  assert.match(text(render(p)), /historisk/)
})
test('Counterexample: native disclosure has no storage or submit handler and resets by week key', () => {
  const p = Object.assign(propsFor(), { programUgeFoerst: true })
  const first = assertLayout(render(p), 'Pas 0')
  assert.equal(first.props.onToggle, undefined)
  assert.equal(first.props.onClick, undefined)
  assert.equal(nodes(first, n => n.type === 'form' || n.type === 'input').length, 0)
  p.viewingWeekIdx = 1
  assert.notEqual(assertLayout(render(p), 'Pas 1').props.key, first.props.key)
})
test('Counterexample: missing anchor uses the actual date helper without changing the week', t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-03-29T12:00:00').getTime() })
  const p = Object.assign(propsFor('2026-03-23'), { programUgeFoerst: true, currentWeek: null })
  assertLayout(render(p), 'Pas 0')
  assert.ok(!text(render(p)).includes('planlagt'))
  button(render(p), 'Næste uge →').props.onClick()
  assert.match(text(render(p)), /planlagt/)
})
