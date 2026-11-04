import test from 'node:test'
import assert from 'node:assert/strict'
import { renderCompetitionPlan } from './view.mjs'
import { element, input, nodes, text } from './fixture.mjs'

const render = (overrides = {}, props = {}) => renderCompetitionPlan(element,
  { enabled: true, role: 'coach', input: input(overrides), ...props })

test('OFF and non-coach render nothing and never inspect input', () => {
  for (const props of [{}, { enabled: 'true', role: 'coach' }, { enabled: true },
    { enabled: true, role: 'athlete' }, { enabled: true, role: 'admin' }]) {
    assert.equal(renderCompetitionPlan(() => { throw Error('render') },
      { ...props, get input() { throw Error('read') } }), null)
  }
})

test('empty, invalid, safety stop and stale date expose honest feedback without stale targets', () => {
  for (const props of [{ input: null }, { input: input({ weightKg: NaN }) },
    { input: input({ adult: false }) }, { input: input({ asOf: '2026-11-29' }) }]) {
    const tree = render({}, props), all = nodes(tree)
    assert.match(text(tree), /Tal med din coach/)
    assert.equal(all.filter(n => n.type === 'li').length, 0)
    assert.equal(all.filter(n => n.type === 'details').length, 0)
    assert.ok(all.some(n => ['alert', 'status'].includes(n.props.role)))
    assert.doesNotMatch(text(tree), /Uge 1|78 kg som pejlemærke/)
  }
})

test('mobile view is read-only, essential summary visible, recovery and evidence folded', () => {
  const tree = render(), all = nodes(tree)
  assert.equal(tree.type, 'section'); assert.equal(tree.props.style.width, '100%')
  assert.equal(tree.props.style.boxSizing, 'border-box')
  assert.equal(tree.props.style.overflowWrap, 'anywhere')
  assert.match(text(tree), /Coachkladde/); assert.match(text(tree), /ændrer intet hos atleten/)
  assert.match(text(tree), /80 kg nu · vægtklasse 78 kg/)
  assert.equal(all.filter(n => n.type === 'li' && text(n).startsWith('Uge ')).length, 4)
  const details = all.filter(n => n.type === 'details')
  assert.equal(details.length, 2); assert.ok(details.every(n => !n.props.open))
  assert.deepEqual(details.map(n => text(n.children[0])), ['Efter vejning', 'Sikkerhedsgrænser og kilder'])
  assert.ok(all.filter(n => n.type === 'summary').every(n => n.props.style.minHeight >= 44))
  assert.equal(all.filter(n => ['button', 'form', 'input'].includes(n.type)).length, 0)
  assert.ok(all.every(n => !Object.keys(n.props).some(key => key.startsWith('on'))))
  assert.equal(all.filter(n => n.type === 'a' && n.props.href.startsWith('https://doi.org/')).length, 3)
})

test('2h shortfall remains a prominent review, without a water allowance', () => {
  const tree = render({ competitionDate: '2026-11-08', weighInHours: 2, weightClassKg: 79 })
  assert.ok(nodes(tree).some(n => n.props.role === 'alert' && /Vægtklassen nås ikke/.test(text(n))))
  assert.match(text(tree), /Ingen akut vandreduktion ved 2 timers vejning/)
  assert.doesNotMatch(text(tree), /Vurderingsloft ved 24 timer/)
})

test('24h review labels the assessment ceiling explicitly as no permission', () => {
  const tree = render({ competitionDate: '2026-11-09', weightClassKg: 78.8 })
  assert.match(text(tree), /Restforskel:/); assert.match(text(tree), /ikke et vandtabsmål eller en tilladelse/)
  assert.match(text(tree), /ikke en dokumenteret sikker dosis/)
  assert.match(text(tree), /søg akut lægehjælp/)
})

test('partial weeks and a future start are clear', () => {
  assert.match(text(render({ competitionDate: '2026-11-10', weightClassKg: 79.5 })), /\(1 dage\)/)
  assert.match(text(render({ competitionDate: '2027-01-01' })), /Hent en ny aktuel kropsvægt/)
})
