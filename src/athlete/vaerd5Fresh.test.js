import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './vaerd5Loader.mjs'
import { mount, text, nodes } from './vaerd5Dom.mjs'
install()
const { default: ProgramTab } = await import('./ProgramTab.jsx')
const { fixture } = await import('./vaerd5Fixture.mjs')
const label = 'Din lokale rettelse af opvarmningen'
const render = f => mount(ProgramTab, f.props).render()

test('fresh counterexample: only boolean true enables the scoped label', () => {
  const f = fixture(); f.save()
  for (const value of [undefined, false, null, 0, 1, 'true', {}, [], true]) {
    f.props.vaerdF6 = value
    assert.equal(text(render(f)).includes(label), value === true)
  }
  assert.deepEqual(f.writes, [])
})

test('fresh counterexample: enabled flag requires a stored local correction', () => {
  const f = fixture({ vaerdF6: true })
  assert.equal(text(render(f)).includes(label), false)
  f.save()
  const badge = nodes(render(f), n => n.type === 'span' && text(n) === label)
  assert.equal(badge.length, 1)
  const title = badge[0].props.title
  f.props.vaerdF6 = false
  assert.equal(nodes(render(f), n => n.type === 'span' && text(n) === 'dine sidste')[0].props.title, title)
  assert.deepEqual(f.writes, [])
})
