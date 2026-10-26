import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './kost2Loader.mjs'
import { athleteViewUrl } from './kost2Paths.mjs'
import { reset, begin, nodes } from './kost2Dom.mjs'
import { kostSynlig } from './kostValg.mjs'
const hooks = install()
const { default: AthleteView } = await import(athleteViewUrl.href)
test.after(() => hooks.deregister())
const component = (tree, name) => nodes(tree, n => n.type?.name === name)[0]
const costPage = tree => nodes(tree, n => n.props?.label === 'Kost').length
test('Review: revoke an open cost page without remount in both presentations', () => {
  for (const simple of [false, true]) {
    reset({ athlete: { id: 'review-a' }, requestedTab: 'kost', enkelRoute: 'kost' })
    const props = { enkelPrototype: simple, kostPerAtlet: true, kostValg: { 'review-a': true } }
    begin(); assert.equal(costPage(AthleteView(props)), 1)
    begin(); const hidden = AthleteView({ ...props, kostValg: { 'review-a': false } })
    assert.equal(costPage(hidden), 0)
    assert.ok(component(hidden, simple ? 'LazyEnkelHjemTab' : 'HjemTab'))
    begin(); assert.equal(costPage(AthleteView({ ...props, kostPerAtlet: false, kostValg: {} })), 1)
  }
})
test('Review: choices never leak to a different athlete or coach preview', () => {
  const props = { kostPerAtlet: true, kostValg: { 'review-a': true }, coachAthleteId: 'review-a' }
  for (const id of ['review-b', 'review-c']) {
    reset({ athlete: { id }, requestedTab: 'kost', enkelRoute: 'kost' })
    begin(); const tree = AthleteView(props)
    assert.equal(costPage(tree), 0)
    assert.equal(component(tree, 'HjemTab').props.kostCompact, false)
  }
})
test('Review: truthy flag and choice values cannot enable restriction or selection', () => {
  for (const enabled of [undefined, null, false, 'true', 1, {}]) assert.equal(kostSynlig(null, enabled, null), true)
  for (const choices of [null, undefined, {}, [], { 'review-a': 'true' }, { 'review-a': 1 }]) assert.equal(kostSynlig({ id: 'review-a' }, true, choices), false)
})
