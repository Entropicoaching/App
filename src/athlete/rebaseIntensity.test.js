import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './prog5Loader.mjs'
import { mount, nodes, text, io } from './prog5Dom.mjs'
install()
const { default: Explanation } = await import('./IntensityExplanation.jsx')
const { intensityExplanation } = await import('./intensityExplanation.mjs')

test('rebase probe 5: all ten actual intensity badges toggle independently with explicit expected words', () => {
  const values = [['RPE 6','fire'],['RPE 7','tre'],['RPE 8','to'],['RPE 9','en'],['RPE 10','ingen'],
    ['RIR 0','ingen'],['RIR 1','en'],['RIR 2','to'],['RIR 3','tre'],['RIR 4','fire']]
  for (const [intensity, word] of values) {
    const view = mount(Explanation, { intensity })
    let tree = view.render()
    const button = nodes(tree, n => n.type === 'button')[0]
    assert.equal(button.props.type, 'button')
    assert.equal(button.props['aria-expanded'], false)
    assert.ok(button.props.style.minHeight >= 44)
    button.props.onClick(); tree = view.render()
    assert.equal(nodes(tree, n => n.type === 'button')[0].props['aria-expanded'], true)
    assert.ok(text(tree).normalize('NFD').replace(/\p{M}/gu,'').includes(word + ' gentagelse'))
    nodes(tree, n => n.type === 'button')[0].props.onClick()
    assert.doesNotMatch(text(view.render()), /tekst fra Marc/)
  }
  assert.equal(io.rpc, 0)
})

test('rebase probe 6: unsupported intensity text never becomes an explanation control', () => {
  for (const intensity of ['RPE 8-9', 'RPE 8.5', 'RPE 8,5', 'RIR 5', 'RPE 08', 'RPE 8 RIR 2']) {
    assert.equal(intensityExplanation(intensity), null)
    assert.equal(nodes(mount(Explanation, { intensity }).render(), n => n.type === 'button').length, 0)
  }
})

test('rebase probe 7: new component key starts closed after changing intensity', () => {
  const Pair = ({ intensity }) => ({ type: Explanation, props: { intensity, key: intensity, children: [] } })
  const view = mount(Pair, { intensity: 'RPE 8' })
  nodes(view.render(), n => n.type === 'button')[0].props.onClick()
  assert.match(text(view.render()), /Erfaring og teknik påvirker vurderingen/)
  const changed = view.render({ intensity: 'RIR 2' })
  assert.equal(nodes(changed, n => n.type === 'button')[0].props['aria-expanded'], false)
  assert.doesNotMatch(text(changed), /tekst fra Marc/)
})
