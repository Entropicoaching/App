// Ordre 1702: atleten ser sin egen kommentar til et afsluttet pas i Program (Entropi 2). Syntetisk adapter som programAccessibility.
import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './prog3Loader.mjs'
import { mount, nodes, text } from './prog3Dom.mjs'
import { accessibilityFixture, completeLogs } from './programAccessibilityFixture.mjs'
install()
const { default: Program } = await import('./ProgramTab.jsx')
const render = (comment, extra = {}) => {
  const props = accessibilityFixture({ exerciseLogs: completeLogs(), ...extra })
  props.allWeeks[1].sessions[0].athlete_rating = 4
  props.allWeeks[1].sessions[0].athlete_comment = comment
  return mount(Program, props).render()
}
const count = (tree, needle) => text(tree).split(needle).length - 1

test('afsluttet pas viser atletens egen kommentar en gang', () => {
  const tree = render('  Syntetisk kort kommentar  ')
  assert.equal(count(tree, 'Syntetisk kort kommentar'), 1)
  assert.match(text(tree), /Din kommentar/)
  assert.equal(nodes(tree, n => n.type === 'details' && /Din kommentar/.test(text(n))).length, 0)
})
test('lang kommentar er foldet og står stadig kun en gang', () => {
  const long = 'Syntetisk lang kommentar. '.repeat(12).trim()
  const tree = render(long)
  assert.equal(count(tree, long), 1)
  assert.equal(nodes(tree, n => n.type === 'details' && text(n).includes(long)).length, 1)
})
test('uden kommentar vises intet', () => {
  for (const c of [null, '', '   ']) assert.doesNotMatch(text(render(c)), /Din kommentar/)
})
