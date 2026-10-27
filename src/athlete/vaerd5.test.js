import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './vaerd5Loader.mjs'
import { mount, text, nodes } from './vaerd5Dom.mjs'
install()
const { default: ProgramTab } = await import('./ProgramTab.jsx')
const { fixture } = await import('./vaerd5Fixture.mjs')
const label = 'Din lokale rettelse af opvarmningen'
const render = f => mount(ProgramTab, f.props).render()

test('F6 opvarmningssaet: saved local correction gets explicit scope only with flag true', () => {
  const f = fixture({ vaerdF6: true })
  assert.equal(f.save(), true)
  const tree = render(f)
  assert.ok(text(tree).includes(label))
  assert.ok(text(tree).includes('55kg'))
  assert.ok(text(tree).includes('100kg'))
  const badge = nodes(tree, n => n.type === 'span' && text(n) === label)[0]
  assert.match(badge.props.title, /samme øvelse, arbejdsvægt inden for 5%/)
  assert.equal(f.writes.length, 0)
  assert.equal(f.ex.recommended_weight, 100)
})

test('default OFF and non-boolean values keep previous badge and tree', () => {
  const f = fixture()
  f.save()
  const previous = render(f)
  assert.ok(text(previous).includes('dine sidste'))
  assert.ok(!text(previous).includes(label))
  // Compare all rendered values; closures are equivalent handlers, not serialized.
  const serial = tree => JSON.stringify(tree)
  for (const value of [false, undefined, null, 1, 'true']) {
    f.props.vaerdF6 = value
    assert.equal(serial(render(f)), serial(previous))
  }
})

test('flag ON model sets and missing storage never claim a local correction', () => {
  const f = fixture({ vaerdF6: true })
  assert.ok(!text(render(f)).includes(label))
  f.props.suggestWarmupOverride = () => null
  assert.ok(!text(render(f)).includes(label))
  assert.equal(f.writes.length, 0)
})

test('actual skip handler preserves same local correction writes with flag ON and OFF', () => {
  const results = []
  for (const enabled of [false, true]) {
    const f = fixture({ vaerdF6: enabled })
    f.save()
    const tree = render(f)
    const skip = nodes(tree, n => n.type === 'button' && n.props.title === 'Spring dette opvarmningssæt over')[0]
    let stopped = false
    skip.props.onClick({ stopPropagation() { stopped = true } })
    assert.equal(stopped, true)
    assert.equal(f.writes.length, 1)
    assert.equal(f.writes[0][2], 100)
    results.push(f.writes)
    assert.equal(f.ex.recommended_weight, 100)
  }
  assert.deepEqual(results[0], results[1])
})
